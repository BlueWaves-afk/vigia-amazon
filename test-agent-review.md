# Test: Can Agent Identify Hazards Needing Review?

## Current Agent Instructions (in AWS Console)
```
You are VIGIA's infrastructure intelligence agent. You can: 
1) Verify hazards using historical data 
2) Analyze DePIN network health and coverage gaps 
3) Prioritize maintenance tasks and estimate costs 
4) Propose optimal road paths to bypass hazard zones. 
Always provide clear reasoning.
```

## Test Query
**User asks**: "What hazards need review?"
**Context**: "Current session: boston-2026, Current geohash: drt2yzr"

## Expected Agent Behavior (with current instructions)
❌ **Likely won't work** - Agent doesn't know:
- That it should call `query_hazards` first
- That it should then call `calculate_score` for each hazard
- That verificationScore < 60 means "needs review"
- How to chain the two functions together

## What Agent Will Probably Do
1. Call `query_hazards(geohash="drt2yzr")` ✅
2. Return raw list of hazards ❌ (doesn't know to calculate scores)
3. OR just say "I found X hazards" without review status ❌

## Solution: Update Agent Instructions in AWS Console

**New Instructions** (copy from `.kiro/steering/agent_instructions_updated.md`):
```
You are VIGIA's infrastructure intelligence agent with 4 capabilities:

## 1. Hazard Verification (QueryAndVerify)
- query_hazards(geohash, radiusMeters, hoursBack) - Find similar hazards
- calculate_score(similarHazards) - Compute verification score

[... full instructions from the file ...]

## Common Workflows

### Hazard Review Summary
When asked "what hazards need review" or "which hazards need attention":
1. Use query_hazards(geohash, radiusMeters=5000, hoursBack=168) to get all hazards
2. For each hazard, use calculate_score(similarHazards=[hazard]) to get verification score
3. Filter hazards with verificationScore < 60 (these need review)
4. Summarize by hazard type and urgency
```

## Action Required
**Manual Step**: Update agent instructions in AWS Bedrock Console
- Navigate to: Amazon Bedrock → Agents → TAWWC3SQ0L
- Edit → Instructions → Paste updated instructions
- Create new version → Update alias TSTALIASID

## After Update - Expected Behavior
✅ Agent will:
1. Call `query_hazards(geohash="drt2yzr", radiusMeters=5000, hoursBack=168)`
2. For each hazard, call `calculate_score(similarHazards=[hazard])`
3. Filter hazards where verificationScore < 60
4. Summarize: "3 potholes need review (scores: 45, 52, 58)"
