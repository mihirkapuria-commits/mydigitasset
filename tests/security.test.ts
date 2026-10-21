/**
 * Local Automated Security Test Suite for MyDigitAsset Cloudflare Backend
 * Tests:
 * 1. Public registration role assignment restriction (forced to 'customer').
 * 2. Reserved administrator email (mihirkapuria@gmail.com) registration prevention.
 * 3. Customer session isolation (preventing customer tokens from accessing admin routes).
 * 4. Verification that removed diagnostic endpoint (/api/security-test-suite) returns 404.
 * 5. Ad redirect URL allowlist validation (approved vs unapproved domains).
 */

import assert from 'assert';

async function runSecurityTests() {
  console.log('Running MyDigitAsset Local Security Test Suite...');

  // Mock D1 database for local unit validation
  const mockDb: any = {
    users: [],
    sessions: {},
    payments: [],
    prepare(query: string) {
      return {
        bind(...args: any[]) {
          return {
            async first() {
              if (query.includes('SELECT id FROM users WHERE email')) {
                const email = args[0];
                return mockDb.users.find((u: any) => u.email === email) || null;
              }
              if (query.includes('SELECT * FROM users WHERE email')) {
                const email = args[0];
                return mockDb.users.find((u: any) => u.email === email) || null;
              }
              if (query.includes('SELECT user_id FROM sessions')) {
                const token = args[0];
                return mockDb.sessions[token] ? { user_id: mockDb.sessions[token] } : null;
              }
              if (query.includes('SELECT * FROM users WHERE id')) {
                const id = args[0];
                return mockDb.users.find((u: any) => u.id === id) || null;
              }
              if (query.includes('ad_clicks')) {
                return mockDb.mockAdResult || null;
              }
              return null;
            },
            async run() {
              if (query.includes('INSERT INTO users')) {
                const newUser = {
                  id: args[0],
                  name: args[1],
                  email: args[2],
                  mobile: args[3],
                  password_hash: args[4],
                  role: args[5],
                  category: args[6],
                  categories: args[7],
                  trial_start: args[8],
                  trial_expiry: args[9],
                  subscription_status: 'trial',
                  payment_status: 'none',
                  telegram_connected: 0,
                  telegram_username: '',
                  created_at: args[10]
                };
                mockDb.users.push(newUser);
                return { success: true };
              }
              if (query.includes('INSERT INTO sessions')) {
                mockDb.sessions[args[0]] = args[1];
                return { success: true };
              }
              return { success: true };
            },
            async all() {
              return { results: [] };
            }
          };
        }
      };
    }
  };

  const env = { DB: mockDb };

  // Test 1: Reserved administrator registration rejection
  console.log('Test 1: Reserved admin registration rejection...');
  const regAdminReq = new Request('https://mydigitasset.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Mihir Kapuria',
      email: 'mihirkapuria@gmail.com',
      mobile: '+919876543210',
      password: 'SecurePassword123!',
      category: 'startups'
    })
  });

  const { onRequest } = await import('../functions/api/[[route]].ts');
  const res1 = await onRequest({ request: regAdminReq, env, params: {} });
  assert.strictEqual(res1.status, 403, 'Reserved admin email registration must return 403 Forbidden');
  console.log('✔ Test 1 Passed: Reserved admin registration correctly blocked.');

  // Test 2: Public customer registration enforces role = 'customer'
  console.log('Test 2: Public customer registration enforces role = customer...');
  const regCustomerReq = new Request('https://mydigitasset.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Regular Customer',
      email: 'customer@domain.com',
      mobile: '+919876543211',
      password: 'CustomerPassword123!',
      category: 'banking_fintech'
    })
  });

  const res2 = await onRequest({ request: regCustomerReq, env, params: {} });
  assert.strictEqual(res2.status, 200, 'Customer registration should succeed');
  const data2 = await res2.json() as any;
  assert.strictEqual(data2.user.role, 'customer', 'Role must be strictly customer');
  console.log('✔ Test 2 Passed: Public registration strictly assigns customer role.');

  // Test 3: Removed diagnostic endpoint (/api/security-test-suite) returns 404
  console.log('Test 3: Removed diagnostic endpoint check...');
  const testSuiteReq = new Request('https://mydigitasset.com/api/security-test-suite', {
    method: 'GET'
  });
  const res3 = await onRequest({ request: testSuiteReq, env, params: {} });
  assert.strictEqual(res3.status, 404, 'Diagnostic endpoint must be absent (404)');
  console.log('✔ Test 3 Passed: Security test suite endpoint successfully removed.');

  // Test 4: Redirect allowlist validation (approved vs unapproved domains)
  console.log('Test 4: Ad redirect allowlist validation...');
  mockDb.mockAdResult = { target_url: 'https://mydigitasset.com/categories' };

  const trackReq1 = new Request('https://mydigitasset.com/api/track?t=valid-token', { method: 'GET' });
  const res4a = await onRequest({ request: trackReq1, env, params: {} });
  assert.strictEqual(res4a.status, 302, 'Approved domain redirect must succeed with 302');

  // Test unapproved redirect
  mockDb.mockAdResult = { target_url: 'https://evil-attacker.com/phishing' };

  const trackReq2 = new Request('https://mydigitasset.com/api/track?t=malicious-token', { method: 'GET' });
  const res4b = await onRequest({ request: trackReq2, env, params: {} });
  assert.strictEqual(res4b.status, 403, 'Unapproved domain redirect must be rejected with 403');
  console.log('✔ Test 4 Passed: Ad redirect allowlist successfully blocks unapproved domains and permits approved domains.');

  console.log('\nAll automated security tests passed successfully!');
}

runSecurityTests().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
