#!/usr/bin/env node
/**
 * End-to-end test for Enterprise Auth & Burn flow
 * Usage: ENTERPRISE_API=https://... node scripts/test-enterprise-e2e.js
 */

const API = process.env.ENTERPRISE_API;
if (!API) { console.error('Set ENTERPRISE_API env var'); process.exit(1); }

const email = `test+${Date.now()}@vigia-test.com`;
const password = 'Test1234';
let idToken, trialVga, dataCredits;

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('\n=== VIGIA Enterprise E2E Test ===\n');

  // 1. Register
  console.log('1. Register:', email);
  const reg = await post('/enterprise/register', { email, password });
  console.assert(reg.status === 200, `Register failed: ${JSON.stringify(reg.data)}`);
  console.assert(reg.data.apiKey?.startsWith('vigia_live_'), 'API key format wrong');
  console.assert(reg.data.trialVga === 20, 'Trial VGA should be 20');
  console.log('   ✓ userId:', reg.data.userId, '| apiKey:', reg.data.apiKey);

  // 2. Login
  console.log('2. Login');
  const login = await post('/enterprise/login', { email, password });
  console.assert(login.status === 200, `Login failed: ${JSON.stringify(login.data)}`);
  console.assert(login.data.idToken, 'No idToken returned');
  idToken = login.data.idToken;
  trialVga = login.data.trialVga;
  dataCredits = login.data.dataCredits;
  console.log('   ✓ idToken received | trialVga:', trialVga, '| dataCredits:', dataCredits);

  // 3. GET /me
  console.log('3. GET /enterprise/me');
  const me = await get('/enterprise/me', idToken);
  console.assert(me.status === 200, `GET /me failed: ${JSON.stringify(me.data)}`);
  console.assert(me.data.email === email, 'Email mismatch');
  console.log('   ✓ email:', me.data.email, '| trialVga:', me.data.trialVga);

  // 4. Burn 5 VGA
  console.log('4. Burn 5 VGA');
  const burn = await post('/enterprise/burn', { vgaAmount: 5 }, idToken);
  console.assert(burn.status === 200, `Burn failed: ${JSON.stringify(burn.data)}`);
  console.assert(burn.data.trialVga === 15, `Expected 15 VGA, got ${burn.data.trialVga}`);
  console.assert(burn.data.creditsProvisioned === 5000, `Expected 5000 credits, got ${burn.data.creditsProvisioned}`);
  console.assert(burn.data.txHash?.startsWith('0x'), 'No txHash');
  console.log('   ✓ trialVga:', burn.data.trialVga, '| credits:', burn.data.dataCredits, '| tx:', burn.data.txHash.slice(0, 12) + '…');

  // 5. Trial limit enforcement — try to burn 20 (only 15 left)
  console.log('5. Trial limit enforcement (burn 20, only 15 left)');
  const overBurn = await post('/enterprise/burn', { vgaAmount: 20 }, idToken);
  console.assert(overBurn.status === 400, `Expected 400, got ${overBurn.status}`);
  console.assert(overBurn.data.error?.includes('Insufficient'), `Expected Insufficient error, got: ${overBurn.data.error}`);
  console.log('   ✓ Correctly rejected:', overBurn.data.error);

  // 6. Duplicate registration
  console.log('6. Duplicate registration rejected');
  const dup = await post('/enterprise/register', { email, password });
  console.assert(dup.status === 409, `Expected 409, got ${dup.status}`);
  console.log('   ✓ Correctly rejected:', dup.data.error);

  // 7. Wrong password
  console.log('7. Wrong password rejected');
  const badLogin = await post('/enterprise/login', { email, password: 'wrongpass' });
  console.assert(badLogin.status === 401, `Expected 401, got ${badLogin.status}`);
  console.log('   ✓ Correctly rejected:', badLogin.data.error);

  console.log('\n✅ All tests passed\n');
}

run().catch(e => { console.error('\n❌ Test failed:', e.message); process.exit(1); });
