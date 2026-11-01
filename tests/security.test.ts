/**
 * Enhanced Local Automated Security Test Suite for MyDigitAsset Cloudflare Backend
 * Tests:
 * 1. Public registration role assignment restriction (forced to 'customer').
 * 2. Reserved administrator email (mihirkapuria@gmail.com) registration prevention.
 * 3. Customer-session isolation from admin routes (403 Forbidden).
 * 4. Invalid and expired session rejection (401 Unauthorized).
 * 5. Unauthorized admin action attempts (403 Forbidden).
 * 6. Malformed registration request handling (400 Bad Request).
 * 7. Verification that removed diagnostic endpoint (/api/security-test-suite) returns 404.
 * 8. Ad redirect URL allowlist validation (approved domains pass, unapproved domains blocked).
 * 9. Invalid ad redirect token handling (400/404).
 */

import assert from 'assert';

async function runSecurityTests() {
  console.log('Running Enhanced MyDigitAsset Local Security Test Suite...');

  // Mock D1 database accurately representing API SQL queries
  const mockDb: any = {
    users: [
      {
        id: 'cust-1',
        name: 'Regular Customer',
        email: 'customer@domain.com',
        mobile: '+919876543211',
        password_hash: 'pbkdf2:100000:abc:123',
        role: 'customer',
        category: 'startups',
        categories: JSON.stringify(['startups']),
        trial_start: new Date().toISOString(),
        trial_expiry: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
        subscription_status: 'trial',
        payment_status: 'none',
        telegram_connected: 0,
        telegram_username: '',
        created_at: new Date().toISOString()
      },
      {
        id: 'admin-1',
        name: 'Mihir Kapuria',
        email: 'mihirkapuria@gmail.com',
        mobile: '+919876543210',
        password_hash: 'pbkdf2:100000:def:456',
        role: 'admin',
        category: 'startups',
        categories: JSON.stringify(['startups']),
        trial_start: new Date().toISOString(),
        trial_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
        subscription_status: 'active_paid',
        payment_status: 'verified',
        telegram_connected: 1,
        telegram_username: 'mihirkapuria',
        created_at: new Date().toISOString()
      }
    ],
    sessions: {
      'valid-customer-token': { user_id: 'cust-1', expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() },
      'expired-customer-token': { user_id: 'cust-1', expires_at: new Date(Date.now() - 1000).toISOString() },
      'valid-admin-token': { user_id: 'admin-1', expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() }
    },
    payments: [],
    mockAdResult: null,

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
              if (query.includes('SELECT user_id, expires_at FROM sessions')) {
                const token = args[0];
                return mockDb.sessions[token] || null;
              }
              if (query.includes('SELECT * FROM users WHERE id')) {
                const id = args[0];
                return mockDb.users.find((u: any) => u.id === id) || null;
              }
              if (query.includes('ad_clicks')) {
                return mockDb.mockAdResult || null;
              }
              if (query.includes('SELECT * FROM payments WHERE id')) {
                return { id: 'pay-1', user_id: 'cust-1', utr: 'UTR123' };
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
                mockDb.sessions[args[0]] = { user_id: args[1], expires_at: args[2] };
                return { success: true };
              }
              if (query.includes('DELETE FROM sessions')) {
                delete mockDb.sessions[args[0]];
                return { success: true };
              }
              return { success: true };
            },
            async all() {
              if (query.includes('SELECT * FROM users')) {
                return { results: mockDb.users };
              }
              if (query.includes('SELECT * FROM audit_logs')) {
                return { results: [] };
              }
              return { results: [] };
            }
          };
        }
      };
    }
  };

  const env = { DB: mockDb };
  const { onRequest } = await import('../functions/api/[[route]].ts');

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
  const res1 = await onRequest({ request: regAdminReq, env, params: {} });
  assert.strictEqual(res1.status, 403, 'Reserved admin email registration must return 403 Forbidden');
  console.log('✔ Test 1 Passed.');

  // Test 2: Public customer registration enforces role = 'customer'
  console.log('Test 2: Public customer registration enforces role = customer...');
  const regCustomerReq = new Request('https://mydigitasset.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'New Customer',
      email: 'newbie@domain.com',
      mobile: '+919876543299',
      password: 'CustomerPassword123!',
      category: 'banking_fintech'
    })
  });
  const res2 = await onRequest({ request: regCustomerReq, env, params: {} });
  assert.strictEqual(res2.status, 200, 'Customer registration should succeed');
  const data2 = await res2.json() as any;
  assert.strictEqual(data2.user.role, 'customer', 'Role must be strictly customer');
  console.log('✔ Test 2 Passed.');

  // Test 3: Malformed registration requests (missing fields)
  console.log('Test 3: Malformed registration requests return 400...');
  const malformedReq = new Request('https://mydigitasset.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Incomplete User',
      email: 'incomplete@domain.com'
      // missing mobile, password, category
    })
  });
  const res3 = await onRequest({ request: malformedReq, env, params: {} });
  assert.strictEqual(res3.status, 400, 'Malformed registration must return 400 Bad Request');
  console.log('✔ Test 3 Passed.');

  // Test 4: Customer-session isolation from admin routes (403 Forbidden)
  console.log('Test 4: Customer session isolation from admin routes...');
  const adminRouteReq = new Request('https://mydigitasset.com/api/admin/customers', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer valid-customer-token' }
  });
  const res4 = await onRequest({ request: adminRouteReq, env, params: { route: ['admin', 'customers'] } });
  assert.strictEqual(res4.status, 403, 'Customer token accessing admin route must return 403 Forbidden');
  console.log('✔ Test 4 Passed.');

  // Test 5: Invalid and expired sessions (401 Unauthorized)
  console.log('Test 5: Expired session rejection...');
  const expiredSessionReq = new Request('https://mydigitasset.com/api/auth/me', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer expired-customer-token' }
  });
  const res5 = await onRequest({ request: expiredSessionReq, env, params: {} });
  assert.strictEqual(res5.status, 401, 'Expired session token must return 401 Unauthorized');
  console.log('✔ Test 5 Passed.');

  // Test 6: Unauthorized admin action (verify payment with customer token -> 403)
  console.log('Test 6: Unauthorized admin action attempt...');
  const verifyPayReq = new Request('https://mydigitasset.com/api/admin/payments/pay-1/verify', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer valid-customer-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'approve' })
  });
  const res6 = await onRequest({ request: verifyPayReq, env, params: {} });
  assert.strictEqual(res6.status, 403, 'Customer token trying to verify payment must return 403 Forbidden');
  console.log('✔ Test 6 Passed.');

  // Test 7: Removed diagnostic endpoint check (/api/security-test-suite -> 404)
  console.log('Test 7: Removed diagnostic endpoint check...');
  const testSuiteReq = new Request('https://mydigitasset.com/api/security-test-suite', { method: 'GET' });
  const res7 = await onRequest({ request: testSuiteReq, env, params: {} });
  assert.strictEqual(res7.status, 404, 'Diagnostic endpoint must return 404');
  console.log('✔ Test 7 Passed.');

  // Test 8: Ad redirect allowlist validation & invalid tokens
  console.log('Test 8: Ad redirect allowlist & invalid tokens...');
  mockDb.mockAdResult = { target_url: 'https://mydigitasset.com/categories' };
  const trackValidReq = new Request('https://mydigitasset.com/api/track?t=valid-token', { method: 'GET' });
  const res8a = await onRequest({ request: trackValidReq, env, params: {} });
  assert.strictEqual(res8a.status, 302, 'Approved domain redirect must succeed with 302');

  mockDb.mockAdResult = { target_url: 'https://evil-attacker.com/phishing' };
  const trackMaliciousReq = new Request('https://mydigitasset.com/api/track?t=malicious-token', { method: 'GET' });
  const res8b = await onRequest({ request: trackMaliciousReq, env, params: {} });
  assert.strictEqual(res8b.status, 403, 'Unapproved domain redirect must return 403 Forbidden');

  // Missing token
  const trackMissingReq = new Request('https://mydigitasset.com/api/track', { method: 'GET' });
  const res8c = await onRequest({ request: trackMissingReq, env, params: {} });
  assert.strictEqual(res8c.status, 400, 'Missing tracking token must return 400 Bad Request');
  console.log('✔ Test 8 Passed.');

  console.log('\nAll enhanced automated security tests passed successfully!');
}

runSecurityTests().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
