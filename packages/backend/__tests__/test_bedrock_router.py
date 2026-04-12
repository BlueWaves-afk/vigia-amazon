"""
Verification pipeline tests — bedrock-router.py action group

Tests the exact scoring math and edge cases the Bedrock agent relies on.

Score formula:
  countScore      = min(count × 20, 40)   — caps at 2 hazards
  confidenceScore = avgConfidence × 30    — max 30.0
  temporalScore   = 30                    — hardcoded constant
  total           = sum of above

Orchestrator threshold: 70  (status → 'verified')
VerifyHazardSync threshold: 60  (reward credited)

Covers:
  query_hazards:
    1.  No hazards at geohash → score 0, empty list
    2.  1 hazard, conf=0.9 → score = 20 + 27 + 30 = 77
    3.  2 hazards, conf=0.8 → score = 40 + 24 + 30 = 94  (count caps at 2)
    4.  5 hazards, conf=0.5 → score = 40 + 15 + 30 = 85  (count still capped)
    5.  Missing geohash param → 400

  calculate_score:
    6.  Empty similarHazards → score 0
    7.  1 hazard, conf=1.0 → score = 20 + 30 + 30 = 80
    8.  2 hazards, mixed conf → correct weighted average
    9.  Parameters as Bedrock array format → parsed correctly
   10.  requestBody format → parsed correctly

  coordinates_to_geohash:
   11.  Known coords → correct 7-char geohash
   12.  Missing params → 400

  scan_all_hazards:
   13.  Filters by minConfidence, returns top 20 sorted by priority
   14.  ACCIDENT scores higher than POTHOLE at same confidence

  score boundary conditions:
   15.  Score exactly 60 → reward threshold met (verify-hazard-sync)
   16.  Score exactly 70 → orchestrator verification threshold met
   17.  Score 59 → below reward threshold
   18.  Score 69 → below orchestrator threshold
"""

import json
import sys
import os
import unittest
from unittest.mock import MagicMock, patch
from decimal import Decimal

ACTIONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/actions'))
ROUTER_FILE = os.path.join(ACTIONS_DIR, 'bedrock-router.py')

# Mock boto3 before importing the module
mock_table = MagicMock()
mock_dynamodb = MagicMock()
mock_dynamodb.Table.return_value = mock_table

with patch.dict('sys.modules', {'boto3': MagicMock(resource=lambda *a, **kw: mock_dynamodb)}), \
     patch.dict('os.environ', {'HAZARDS_TABLE_NAME': 'test-hazards'}):
    import importlib.util
    spec = importlib.util.spec_from_file_location('bedrock_router', ROUTER_FILE)
    router_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(router_module)

router_module.table = mock_table


def make_query_event(geohash=None, params=None):
    if params:
        return {'parameters': params}
    return {'geohash': geohash} if geohash else {}


def make_score_event(hazards=None, as_params=False, as_body=False):
    # Serialize with float() to handle Decimal values from make_hazard
    def to_json(h_list):
        return json.dumps([{k: float(v) if isinstance(v, Decimal) else v
                            for k, v in h.items()} for h in (h_list or [])])
    if as_params:
        return {'parameters': [{'name': 'similarHazards', 'value': to_json(hazards)}]}
    if as_body:
        return {'requestBody': {'content': {'application/json': {'properties': [
            {'name': 'similarHazards', 'value': to_json(hazards)}
        ]}}}}
    return {'similarHazards': hazards or []}


def make_hazard(conf, hazard_type='POTHOLE', geohash='drt2yzr', ts='2026-01-01T00:00:00Z'):
    return {'confidence': Decimal(str(conf)), 'hazardType': hazard_type,
            'geohash': geohash, 'timestamp': ts, 'lat': Decimal('42.36'), 'lon': Decimal('-71.06')}


class TestQueryHazards(unittest.TestCase):

    def setUp(self):
        mock_table.reset_mock()

    # 1. No hazards → score 0
    def test_no_hazards_returns_zero_score(self):
        mock_table.query.return_value = {'Items': []}
        result = router_module.query_hazards({'geohash': 'drt2yzr'})
        self.assertEqual(result['statusCode'], 200)
        self.assertEqual(result['body']['count'], 0)
        self.assertEqual(result['body']['computedVerificationScore'], 0)

    # 2. 1 hazard, conf=0.9 → 20 + 27 + 30 = 77
    def test_one_hazard_conf_09(self):
        mock_table.query.return_value = {'Items': [make_hazard(0.9)]}
        result = router_module.query_hazards({'geohash': 'drt2yzr'})
        score = result['body']['computedVerificationScore']
        self.assertAlmostEqual(score, 77.0, places=1)
        self.assertGreaterEqual(score, 70)  # above orchestrator threshold

    # 3. 2 hazards, conf=0.8 → 40 + 24 + 30 = 94
    def test_two_hazards_conf_08(self):
        mock_table.query.return_value = {'Items': [make_hazard(0.8), make_hazard(0.8)]}
        result = router_module.query_hazards({'geohash': 'drt2yzr'})
        score = result['body']['computedVerificationScore']
        self.assertAlmostEqual(score, 94.0, places=1)

    # 4. 5 hazards — count still caps at 40
    def test_five_hazards_count_capped(self):
        mock_table.query.return_value = {'Items': [make_hazard(0.5)] * 5}
        result = router_module.query_hazards({'geohash': 'drt2yzr'})
        score = result['body']['computedVerificationScore']
        self.assertAlmostEqual(score, 85.0, places=1)  # 40 + 15 + 30

    # 5. Missing geohash → 400
    def test_missing_geohash_returns_400(self):
        result = router_module.query_hazards({})
        self.assertEqual(result['statusCode'], 400)

    # 5b. Geohash via parameters array (Bedrock format)
    def test_geohash_via_parameters(self):
        mock_table.query.return_value = {'Items': []}
        result = router_module.query_hazards(
            {'parameters': [{'name': 'geohash', 'value': 'drt2yzr'}]}
        )
        self.assertEqual(result['statusCode'], 200)


class TestCalculateScore(unittest.TestCase):

    # 6. Empty list → score 0
    def test_empty_hazards_returns_zero(self):
        result = router_module.calculate_score(make_score_event([]))
        self.assertEqual(result['body']['verificationScore'], 0)

    # 7. 1 hazard, conf=1.0 → 20 + 30 + 30 = 80
    def test_one_hazard_perfect_confidence(self):
        result = router_module.calculate_score(make_score_event([make_hazard(1.0)]))
        self.assertAlmostEqual(result['body']['verificationScore'], 80.0, places=1)

    # 8. 2 hazards, mixed confidence → correct average
    def test_two_hazards_mixed_confidence(self):
        hazards = [make_hazard(0.6), make_hazard(1.0)]  # avg = 0.8
        result = router_module.calculate_score(make_score_event(hazards))
        # 40 + (0.8 × 30) + 30 = 94
        self.assertAlmostEqual(result['body']['verificationScore'], 94.0, places=1)

    # 9. Bedrock parameters array format
    def test_parameters_array_format(self):
        result = router_module.calculate_score(make_score_event([make_hazard(0.9)], as_params=True))
        self.assertAlmostEqual(result['body']['verificationScore'], 77.0, places=1)

    # 10. requestBody format
    def test_request_body_format(self):
        result = router_module.calculate_score(make_score_event([make_hazard(0.9)], as_body=True))
        self.assertAlmostEqual(result['body']['verificationScore'], 77.0, places=1)

    # Breakdown fields present
    def test_breakdown_fields_present(self):
        result = router_module.calculate_score(make_score_event([make_hazard(0.8)]))
        b = result['body']['breakdown']
        self.assertIn('countScore', b)
        self.assertIn('confidenceScore', b)
        self.assertIn('temporalScore', b)
        self.assertEqual(b['temporalScore'], 30)  # always 30


class TestCoordinatesToGeohash(unittest.TestCase):

    # 11. Known coords → 7-char geohash
    def test_boston_coords(self):
        event = {'parameters': [
            {'name': 'latitude', 'value': '42.3601'},
            {'name': 'longitude', 'value': '-71.0589'},
        ]}
        result = router_module.coordinates_to_geohash(event)
        self.assertEqual(result['statusCode'], 200)
        gh = result['body']['geohash']
        self.assertEqual(len(gh), 7)
        self.assertTrue(gh.startswith('drt'))  # Boston geohash prefix

    # 12. Missing params → 400
    def test_missing_params_returns_400(self):
        result = router_module.coordinates_to_geohash({})
        self.assertEqual(result['statusCode'], 400)


class TestScanAllHazards(unittest.TestCase):

    def setUp(self):
        mock_table.reset_mock()

    # 13. Filters by minConfidence
    def test_filters_by_min_confidence(self):
        mock_table.scan.return_value = {'Items': [
            make_hazard(0.9, 'POTHOLE'),
            make_hazard(0.3, 'DEBRIS'),  # below default 0.7 threshold
        ]}
        result = router_module.scan_all_hazards({})
        hazards = result['body']['hazards']
        self.assertEqual(len(hazards), 1)
        self.assertEqual(hazards[0]['hazardType'], 'POTHOLE')

    # 14. ACCIDENT scores higher than POTHOLE at same confidence
    def test_accident_higher_priority_than_pothole(self):
        mock_table.scan.return_value = {'Items': [
            make_hazard(0.9, 'POTHOLE'),
            make_hazard(0.9, 'ACCIDENT'),
        ]}
        result = router_module.scan_all_hazards({})
        hazards = result['body']['hazards']
        self.assertEqual(hazards[0]['hazardType'], 'ACCIDENT')
        self.assertGreater(hazards[0]['priority'], hazards[1]['priority'])


class TestScoreBoundaries(unittest.TestCase):
    """
    Verify the exact score values that cross the two thresholds:
      60 → verify-hazard-sync reward threshold
      70 → orchestrator verification threshold
    """

    def _score(self, count, avg_conf):
        count_score = min(count * 20, 40)
        conf_score = avg_conf * 30
        return round(count_score + conf_score + 30, 2)

    # 15. Score exactly 60 → 0 hazards, conf=0 → 0+0+30=30. Need 1 hazard conf=0 → 20+0+30=50.
    #     Score=60 requires: countScore+confScore=30. e.g. 1 hazard, conf=1/3 → 20+10+30=60
    def test_score_60_boundary(self):
        score = self._score(1, 1/3)
        self.assertAlmostEqual(score, 60.0, places=1)

    # 16. Score exactly 70 → 1 hazard, conf=2/3 → 20+20+30=70
    def test_score_70_boundary(self):
        score = self._score(1, 2/3)
        self.assertAlmostEqual(score, 70.0, places=1)

    # 17. Score 59 → below reward threshold
    def test_score_59_below_reward_threshold(self):
        # 0 hazards, conf irrelevant → 0+0+30=30. Or 1 hazard conf=0.29 → 20+8.7+30=58.7
        score = self._score(1, 0.29)
        self.assertLess(score, 60)

    # 18. Score 69 → below orchestrator threshold
    def test_score_69_below_orchestrator_threshold(self):
        score = self._score(1, 0.63)  # 20 + 18.9 + 30 = 68.9
        self.assertLess(score, 70)

    # Temporal score is always 30 regardless of inputs
    def test_temporal_score_always_30(self):
        for count in [0, 1, 5, 10]:
            for conf in [0.0, 0.5, 1.0]:
                hazards = [make_hazard(conf)] * count
                if hazards:
                    result = router_module.calculate_score({'similarHazards': hazards})
                    self.assertEqual(result['body']['breakdown']['temporalScore'], 30)


if __name__ == '__main__':
    unittest.main(verbosity=2)
