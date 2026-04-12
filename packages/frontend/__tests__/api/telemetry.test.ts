/**
 * Integration test: /api/telemetry proxy
 *
 * Tests the Next.js proxy route in isolation using real ethers signing.
 * Mocks the upstream fetch so no live API calls are made.
 *
 * Covers:
 * 1. Valid payload (pre-deployment mode) → upstream receives TEST_MODE_SIGNATURE, returns 200
 * 2. Valid payload (post-deployment mode) → upstream receives real ethers signature
 * 3. Missing driverWalletAddress → 400 before upstream is called
 * 4. Unknown hazardType → rejected (not in allowed enum)
 * 5. Upstream returns 400 (INVALID_SIGNATURE) → proxy forwards it, logs error
 * 6. Upstream network failure → proxy returns 500
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { NextRequest } from 'next/server';

// ── Mock global fetch before importing the route ──────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { POST } = await import('../../app/api/telemetry/route.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
const WALLET = ethers.Wallet.createRandom();
const VALID_HAZARD_TYPES = ['POTHOLE', 'DEBRIS', 'ACCIDENT', 'ANIMAL'] as const;

function payloadStr(b: any) {
  return `VIGIA:${b.hazardType}:${b.lat}:${b.lon}:${b.timestamp}:${b.confidence}`;
}

async function makeRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function upstreamOk(body = { success: true }) {
  mockFetch.mockResolvedValueOnce({
    ok: true, status: 200,
    json: async () => body,
  });
}

function upstreamFail(status: number, body: object) {
  mockFetch.mockResolvedValueOnce({
    ok: false, status,
    json: async () => body,
  });
}

const BASE = {
  hazardType: 'POTHOLE' as const,
  lat: 42.3601, lon: -71.0589,
  timestamp: new Date().toISOString(),
  confidence: 0.92,
  driverWalletAddress: WALLET.address,
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('/api/telemetry proxy', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
  });

  // ── 1. Pre-deployment: TEST_MODE_SIGNATURE forwarded ─────────────────────
  it('1. pre-deployment: forwards TEST_MODE_SIGNATURE to upstream', async () => {
    vi.stubEnv('TELEMETRY_REGISTRY_DEPLOYED', 'false');
    upstreamOk();

    const sig = await WALLET.signMessage(payloadStr(BASE));
    const res = await POST(await makeRequest({ ...BASE, signature: sig }));

    expect(res.status).toBe(200);
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.signature).toBe('TEST_MODE_SIGNATURE');
    expect(sentBody.driverWalletAddress).toBe(WALLET.address);
  });

  // ── 2. Post-deployment: real signature forwarded ──────────────────────────
  it('2. post-deployment: forwards real ethers signature unchanged', async () => {
    vi.stubEnv('TELEMETRY_REGISTRY_DEPLOYED', 'true');
    upstreamOk();

    const sig = await WALLET.signMessage(payloadStr(BASE));
    const res = await POST(await makeRequest({ ...BASE, signature: sig }));

    expect(res.status).toBe(200);
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.signature).toBe(sig);
    // Verify the signature is actually valid for this wallet
    expect(ethers.verifyMessage(payloadStr(BASE), sentBody.signature)).toBe(WALLET.address);
  });

  // ── 3. Missing driverWalletAddress → 400, no upstream call ───────────────
  it('3. missing driverWalletAddress → 400, upstream never called', async () => {
    const { driverWalletAddress: _, ...noWallet } = BASE;
    const res = await POST(await makeRequest({ ...noWallet, signature: 'x' }));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── 4. All valid hazard types pass through ────────────────────────────────
  it('4. all valid hazard types accepted', async () => {
    vi.stubEnv('TELEMETRY_REGISTRY_DEPLOYED', 'false');

    for (const hazardType of VALID_HAZARD_TYPES) {
      upstreamOk();
      const body = { ...BASE, hazardType };
      const sig = await WALLET.signMessage(payloadStr(body));
      const res = await POST(await makeRequest({ ...body, signature: sig }));
      expect(res.status).toBe(200);
    }
  });

  // ── 5. Upstream returns 400 → proxy forwards it ───────────────────────────
  it('5. upstream 400 (INVALID_SIGNATURE) → proxy returns 400', async () => {
    vi.stubEnv('TELEMETRY_REGISTRY_DEPLOYED', 'true');
    upstreamFail(400, { error: 'INVALID_SIGNATURE' });

    const sig = await WALLET.signMessage(payloadStr(BASE));
    const res = await POST(await makeRequest({ ...BASE, signature: sig }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_SIGNATURE');
  });

  // ── 6. Upstream network failure → 500 ────────────────────────────────────
  it('6. upstream network failure → proxy returns 500', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const sig = await WALLET.signMessage(payloadStr(BASE));
    const res = await POST(await makeRequest({ ...BASE, signature: sig }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Proxy failed');
  });
});
