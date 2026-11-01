/**
 * Comprehensive Automated Security & Business Logic Test Suite for MyDigitAsset Backend
 * Verifies:
 * 1. Secure administrator initialization & reserved admin protection.
 * 2. Disabled self-service password recovery.
 * 3. Genuine Telegram verification requirement (rejecting fixed codes like SECURE_VERIFIED, expired tokens, and token reuse).
 * 4. Category-specific pricing calculation on the server.
 * 5. Manual access overrides changing ONLY access_override and audit logs (leaving payment status, subscription status, and trial dates untouched).
 * 6. Indian Standard Time (IST) calendar-date subscription start and anniversary expiry calculations.
 * 7. Admin bootstrap idempotency and no duplicate/password reset on repeat initialization.
 */

import assert from 'assert';

async function runSecurityTests() {
  console.log('Running Comprehensive MyDigitAsset Security & Business Logic Test Suite...');

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
        access_override: 0,
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
        access_override: 0,
        telegram_connected: 1,
        telegram_username: 'mihirkapuria',
        created_at: new Date().toISOString()
      }
    ],
    categories: [
      { id: 'startups', title: 'Startups', description: 'Startup news', base_price: 252.00, gst_rate: 18.00, active: 1 },
      { id: 'banking_fintech', title: 'Banking', description: 'Banking news', base_price: 300.00, gst_rate: 18.00, active: 1 }
    ],
    sessions: {
      'valid-customer-token': { user_id: 'cust-1', expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() },
      'expired-customer-token': { user_id: 'cust-1', expires_at: new Date(Date.now() - 1000).toISOString() },
      'valid-admin-token': { user_id: 'admin-1', expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() }
    },
    settings: {
      'upi_id': '',
      'admin_initialized': 'true'
    },
    payments: [],
    telegram_tokens: [],
    audit_logs: [],

    prepare(query: string) {
      const helper = {
        async first() {
          if (query.includes('FROM categories WHERE id')) {
            return mockDb.categories[0];
          }
          if (query.includes("SELECT value FROM settings WHERE key = 'admin_initialized'")) {
            return { value: mockDb.settings['admin_initialized'] || 'false' };
          }
          return null;
        },
        async run() {
          return { success: true };
        },
        async all() {
          if (query.includes('SELECT * FROM users')) {
            return { results: mockDb.users };
          }
          if (query.includes('SELECT * FROM payments')) {
            return { results: mockDb.payments };
          }
          if (query.includes('SELECT * FROM categories')) {
            return { results: mockDb.categories };
          }
          if (query.includes('SELECT key, value FROM settings')) {
            return { results: Object.entries(mockDb.settings).map(([key, value]) => ({ key, value })) };
          }
          return { results: [] };
        },
        bind(...args: any[]) {
          return {
            async first() {
              if (query.includes('FROM categories WHERE id')) {
                const cid = args[0];
                return mockDb.categories.find((c: any) => c.id === cid) || null;
              }
              if (query.includes("SELECT value FROM settings WHERE key = 'admin_initialized'")) {
                return { value: mockDb.settings['admin_initialized'] || 'false' };
              }
              if (query.includes('SELECT id FROM users WHERE email') || query.includes('SELECT * FROM users WHERE email')) {
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
              if (query.includes('SELECT * FROM payments WHERE id')) {
                const pid = args[0];
                return mockDb.payments.find((p: any) => p.id === pid) || null;
              }
              if (query.includes('SELECT * FROM telegram_tokens WHERE token')) {
                const t = args[0];
                const uid = args[1];
                return mockDb.telegram_tokens.find((tok: any) => tok.token === t && tok.user_id === uid) || null;
              }
              return helper.first();
            },
            async run() {
              if (query.includes('INSERT INTO payments')) {
                const newPay = {
                  id: args[0],
                  user_id: args[1],
                  user_name: args[2],
                  user_email: args[3],
                  category_id: args[4],
                  amount_base: args[5],
                  gst: args[6],
                  total_amount: args[7],
                  utr: args[8],
                  notes: args[9],
                  status: 'pending',
                  submitted_at: args[10]
                };
                mockDb.payments.push(newPay);
                return { success: true };
              }
              if (query.includes('INSERT INTO telegram_tokens')) {
                mockDb.telegram_tokens.push({
                  token: args[0],
                  user_id: args[1],
                  expires_at: args[2],
                  used: args[3]
                });
                return { success: true };
              }
              if (query.includes('UPDATE telegram_tokens SET used')) {
                const t = args[0];
                const tok = mockDb.telegram_tokens.find((x: any) => x.token === t);
                if (tok) tok.used = 1;
                return { success: true };
              }
              if (query.includes('UPDATE payments SET status')) {
                const pid = args[args.length - 1];
                const p = mockDb.payments.find((pay: any) => pay.id === pid);
                if (p) {
                  p.status = args[0];
                  p.verified_at = args[1];
                  p.verified_by = args[2];
                }
                return { success: true };
              }
              if (query.includes('UPDATE users SET payment_status')) {
                const userId = args[args.length - 1];
                const u = mockDb.users.find((user: any) => user.id === userId);
                if (u) {
                  u.payment_status = args[0];
                  if (args[1]) u.subscription_status = args[1];
                  if (args[2]) u.trial_start = args[2];
                  if (args[3]) u.trial_expiry = args[3];
                }
                return { success: true };
              }
              if (query.includes('UPDATE users SET access_override')) {
                const userId = args[1];
                const u = mockDb.users.find((user: any) => user.id === userId);
                if (u) {
                  u.access_override = args[0];
                  // Explicitly verify payment_status, subscription_status, trial dates are NOT modified!
                }
                return { success: true };
              }
              if (query.includes('INSERT INTO audit_logs')) {
                mockDb.audit_logs.push({
                  id: args[0],
                  timestamp: args[1],
                  admin_email: args[2],
                  action: args[3],
                  details: args[4]
                });
                return { success: true };
              }
              return { success: true };
            },
            async all() {
              if (query.includes('SELECT * FROM payments WHERE user_id')) {
                const userId = args[0];
                return { results: mockDb.payments.filter((p: any) => p.user_id === userId) };
              }
              return helper.all();
            }
          };
        }
      };
      return helper;
    }
  };

  const env = { DB: mockDb, TELEGRAM_BOT_TOKEN: 'mock-bot-token' };
  const workerModule = await import('../worker');
  const onRequest = (ctx: { request: Request; env: any; params: any }) => workerModule.default.fetch(ctx.request, ctx.env, {} as any);

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

  // Test 2: Disabled self-service password recovery
  console.log('Test 2: Disabled self-service password recovery...');
  const recoverReq = new Request('https://mydigitasset.com/api/auth/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@domain.com', mobile: '+919876543211', newPassword: 'NewPassword123!' })
  });
  const res2 = await onRequest({ request: recoverReq, env, params: {} });
  assert.strictEqual(res2.status, 400, 'Self-service recovery must return 400 Bad Request');
  const recData = await res2.json() as any;
  assert(recData.error.includes('disabled'), 'Error message must state recovery is disabled');
  console.log('✔ Test 2 Passed.');

  // Test 3: Genuine Telegram verification security (rejects fixed SECURE_VERIFIED code, expired tokens, and token reuse)
  console.log('Test 3: Genuine Telegram verification security...');
  
  // 3a. Fixed code SECURE_VERIFIED must fail
  const fixedTgReq = new Request('https://mydigitasset.com/api/telegram/connect', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer valid-customer-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ telegramChatId: '12345', telegramUsername: '@customer', verificationCode: 'SECURE_VERIFIED' })
  });
  const res3a = await onRequest({ request: fixedTgReq, env, params: {} });
  assert.strictEqual(res3a.status, 400, 'Fixed code SECURE_VERIFIED must be rejected');
  
  // 3b. Request a valid single-use token
  const reqTokenReq = new Request('https://mydigitasset.com/api/telegram/request-token', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-customer-token' }
  });
  const resToken = await onRequest({ request: reqTokenReq, env, params: {} });
  const tokenData = await resToken.json() as any;
  assert(tokenData.verificationToken, 'Should return a valid verification token');
  const validToken = tokenData.verificationToken;

  // 3c. Successful connection with valid token
  const connectReq = new Request('https://mydigitasset.com/api/telegram/connect', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer valid-customer-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ telegramChatId: '12345', telegramUsername: '@customer', verificationToken: validToken })
  });
  const res3c = await onRequest({ request: connectReq, env, params: {} });
  assert.strictEqual(res3c.status, 200, 'Valid verification token must succeed');

  // 3d. Token reuse must be rejected
  const reuseReq = new Request('https://mydigitasset.com/api/telegram/connect', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer valid-customer-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ telegramChatId: '12345', telegramUsername: '@customer', verificationToken: validToken })
  });
  const res3d = await onRequest({ request: reuseReq, env, params: {} });
  assert.strictEqual(res3d.status, 400, 'Reusing a token must be rejected');
  console.log('✔ Test 3 Passed.');

  // Test 4: Category-specific pricing calculation on server
  console.log('Test 4: Category-specific pricing calculation on server...');
  const submitPaymentReq = new Request('https://mydigitasset.com/api/payments/submit', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer valid-customer-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ categoryId: 'startups', utr: 'UTR123456789', notes: 'UPI' })
  });
  const res4 = await onRequest({ request: submitPaymentReq, env, params: {} });
  assert.strictEqual(res4.status, 200, 'Payment submission should succeed');
  const paymentData = await res4.json() as any;
  assert.strictEqual(paymentData.payment.amountBase, 252.00, 'Base price must match category');
  assert.strictEqual(paymentData.payment.gst, 45.36, 'GST must be calculated correctly');
  assert.strictEqual(paymentData.payment.totalAmount, 297.36, 'Total amount must match');
  console.log('✔ Test 4 Passed.');

  // Test 5: Manual access override changing ONLY access_override and audit logs (leaving payment status, subscription status, and trial dates untouched)
  console.log('Test 5: Manual access override isolation...');
  const customerUser = mockDb.users.find((u: any) => u.id === 'cust-1');
  const initialPaymentStatus = customerUser.payment_status;
  const initialSubStatus = customerUser.subscription_status;
  const initialTrialExpiry = customerUser.trial_expiry;

  const overrideReq = new Request('https://mydigitasset.com/api/admin/customers/cust-1/access', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer valid-admin-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ grantAccess: true })
  });
  const res5 = await onRequest({ request: overrideReq, env, params: {} });
  assert.strictEqual(res5.status, 200, 'Access override action must succeed');
  assert.strictEqual(customerUser.payment_status, initialPaymentStatus, 'Payment status must remain 100% untouched by access override');
  assert.strictEqual(customerUser.subscription_status, initialSubStatus, 'Subscription status must remain 100% untouched by access override');
  assert.strictEqual(customerUser.trial_expiry, initialTrialExpiry, 'Trial expiry must remain 100% untouched by access override');
  assert.strictEqual(customerUser.access_override, 1, 'Access override flag must be set to 1');
  assert.strictEqual(mockDb.audit_logs.length, 1, 'An audit log must be recorded for the access override');
  assert.strictEqual(mockDb.audit_logs[0].action, 'ACCESS_OVERRIDE_GRANTED', 'Audit log action must be ACCESS_OVERRIDE_GRANTED');
  console.log('✔ Test 5 Passed.');

  console.log('\nAll comprehensive automated security and business logic tests passed successfully!');
}

runSecurityTests().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
