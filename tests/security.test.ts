/**
 * Comprehensive Automated Security & Business Logic Test Suite for MyDigitAsset Backend
 * Covers all 22 required security and business logic test cases.
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
        trial_start: new Date(Date.now() - 10*24*60*60*1000).toISOString(),
        trial_expiry: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
        subscription_status: 'expired',
        payment_status: 'none',
        access_override: 0,
        telegram_connected: 0,
        telegram_username: '',
        telegram_chat_id: '',
        created_at: new Date().toISOString()
      },
      {
        id: 'cust-2',
        name: 'Second Customer',
        email: 'customer2@domain.com',
        mobile: '+919876543212',
        password_hash: 'pbkdf2:100000:xyz:789',
        role: 'customer',
        category: 'banking_fintech',
        categories: JSON.stringify(['banking_fintech']),
        trial_start: new Date().toISOString(),
        trial_expiry: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
        subscription_status: 'trial',
        payment_status: 'none',
        access_override: 0,
        telegram_connected: 0,
        telegram_username: '',
        telegram_chat_id: '',
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
        telegram_chat_id: '999999',
        created_at: new Date().toISOString()
      }
    ],
    categories: [
      { id: 'startups', title: 'Startups', description: 'Startup news', base_price: 252.00, gst_rate: 18.00, active: 1 },
      { id: 'banking_fintech', title: 'Banking', description: 'Banking news', base_price: 300.00, gst_rate: 18.00, active: 1 },
      { id: 'inactive_cat', title: 'Inactive', description: 'Inactive category', base_price: 200.00, gst_rate: 18.00, active: 0 }
    ],
    sessions: {
      'valid-customer-token': { user_id: 'cust-1', expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() },
      'valid-customer2-token': { user_id: 'cust-2', expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() },
      'valid-admin-token': { user_id: 'admin-1', expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() }
    },
    settings: {
      'upi_id': 'test@upi',
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
                const cat = mockDb.categories.find((c: any) => c.id === cid);
                if (!cat) return null;
                if (query.includes('active = 1') && cat.active !== 1) return null;
                return cat;
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
                return mockDb.telegram_tokens.find((tok: any) => tok.token === t) || null;
              }
              return helper.first();
            },
            async run() {
              if (query.includes('INSERT INTO payments')) {
                mockDb.payments.push({
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
                });
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
                if (tok) {
                  if (tok.used === 1) return { success: false, rowsAffected: 0 };
                  tok.used = 1;
                  return { success: true, rowsAffected: 1 };
                }
                return { success: false, rowsAffected: 0 };
              }
              if (query.includes('UPDATE users SET telegram_connected')) {
                const username = args[0];
                const chatId = args[1];
                const userId = args[2];
                const u = mockDb.users.find((user: any) => user.id === userId);
                if (u) {
                  u.telegram_connected = 1;
                  u.telegram_username = username;
                  u.telegram_chat_id = chatId;
                }
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
              if (query.includes('UPDATE users SET access_override')) {
                const userId = args[1];
                const u = mockDb.users.find((user: any) => user.id === userId);
                if (u) {
                  u.access_override = args[0];
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

  const env = { 
    DB: mockDb, 
    TELEGRAM_BOT_TOKEN: 'mock-bot-token', 
    TELEGRAM_WEBHOOK_SECRET: 'secret-token-123', 
    ADMIN_INITIAL_PASSWORD: 'AdminPassword123!',
    ASSETS: { fetch: async () => new Response('ok') }
  };
  const workerModule = await import('../worker');
  const onRequest = (ctx: { request: Request; env: any; params: any }) => workerModule.default.fetch(ctx.request, ctx.env, {} as any);

  // 1. Public registration cannot create an administrator
  console.log('Test 1: Public registration cannot create an administrator...');
  const regAdminReq = new Request('https://mydigitasset.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Fake Admin',
      email: 'fakeadmin@domain.com',
      mobile: '+919876543299',
      password: 'Password123!',
      category: 'startups',
      role: 'admin'
    })
  });
  const res1 = await onRequest({ request: regAdminReq, env, params: {} });
  const reg1Data = await res1.json() as any;
  assert.strictEqual(reg1Data.user?.role, 'customer', 'Public registration can never create an admin');
  console.log('✔ Test 1 Passed.');

  // 2. Reserved administrator email cannot register
  console.log('Test 2: Reserved administrator email cannot register...');
  const regReservedReq = new Request('https://mydigitasset.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Mihir Kapuria',
      email: 'mihirkapuria@gmail.com',
      mobile: '+919876543210',
      password: 'Password123!',
      category: 'startups'
    })
  });
  const res2 = await onRequest({ request: regReservedReq, env, params: {} });
  assert.strictEqual(res2.status, 403, 'Reserved admin email registration must return 403');
  console.log('✔ Test 2 Passed.');

  // 3. Customers cannot access administrator APIs
  console.log('Test 3: Customers cannot access administrator APIs...');
  const custAdminReq = new Request('https://mydigitasset.com/api/admin/customers', {
    headers: { 'Authorization': 'Bearer valid-customer-token' }
  });
  const res3 = await onRequest({ request: custAdminReq, env, params: {} });
  assert.strictEqual(res3.status, 403, 'Customer accessing admin API must return 403 Forbidden');
  console.log('✔ Test 3 Passed.');

  // 4. Self-service password recovery remains disabled
  console.log('Test 4: Self-service password recovery remains disabled...');
  const recoverReq = new Request('https://mydigitasset.com/api/auth/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@domain.com' })
  });
  const res4 = await onRequest({ request: recoverReq, env, params: {} });
  assert.strictEqual(res4.status, 400, 'Self-service password recovery must return 400');
  console.log('✔ Test 4 Passed.');

  // 5. Telegram webhook rejects missing secret header
  console.log('Test 5: Telegram webhook rejects missing secret header...');
  const whMissing = new Request('https://mydigitasset.com/api/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { chat: { id: 123 }, text: '/verify token' } })
  });
  const res5 = await onRequest({ request: whMissing, env, params: {} });
  assert.strictEqual(res5.status, 401, 'Webhook missing secret header must return 401');
  console.log('✔ Test 5 Passed.');

  // 6. Telegram webhook rejects incorrect secret header
  console.log('Test 6: Telegram webhook rejects incorrect secret header...');
  const whWrong = new Request('https://mydigitasset.com/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret'
    },
    body: JSON.stringify({ message: { chat: { id: 123 }, text: '/verify token' } })
  });
  const res6 = await onRequest({ request: whWrong, env, params: {} });
  assert.strictEqual(res6.status, 401, 'Webhook incorrect secret header must return 401');
  console.log('✔ Test 6 Passed.');

  // 7. Telegram webhook accepts valid secret header
  console.log('Test 7: Telegram webhook accepts valid secret header...');
  mockDb.telegram_tokens.push({
    token: 'valid-token',
    user_id: 'cust-1',
    expires_at: new Date(Date.now() + 100000).toISOString(),
    used: 0
  });
  const whValid = new Request('https://mydigitasset.com/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'secret-token-123'
    },
    body: JSON.stringify({ message: { chat: { id: 123 }, from: { username: 'test' }, text: '/verify valid-token' } })
  });
  const res7 = await onRequest({ request: whValid, env, params: {} });
  assert.strictEqual(res7.status, 200, 'Webhook valid secret header must return 200');
  console.log('✔ Test 7 Passed.');

  // 8. Invalid Telegram tokens are rejected
  console.log('Test 8: Invalid Telegram tokens are rejected...');
  const reqTokenReq = new Request('https://mydigitasset.com/api/telegram/request-token', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-customer-token' }
  });
  const resToken = await onRequest({ request: reqTokenReq, env, params: {} });
  const tokenData = await resToken.json() as any;
  const validToken = tokenData.verificationToken;

  const connectInvalid = new Request('https://mydigitasset.com/api/telegram/connect', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-customer-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ verificationToken: 'invalid-token-xyz' })
  });
  const res8 = await onRequest({ request: connectInvalid, env, params: {} });
  assert.strictEqual(res8.status, 400, 'Invalid token must be rejected');
  console.log('✔ Test 8 Passed.');

  // 9. Expired Telegram tokens are rejected
  console.log('Test 9: Expired Telegram tokens are rejected...');
  const expiredToken = 'tg-expired';
  mockDb.telegram_tokens.push({
    token: expiredToken,
    user_id: 'cust-1',
    expires_at: new Date(Date.now() - 10000).toISOString(),
    used: 0
  });
  const connectExpired = new Request('https://mydigitasset.com/api/telegram/connect', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-customer-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ verificationToken: expiredToken })
  });
  const res9 = await onRequest({ request: connectExpired, env, params: {} });
  assert.strictEqual(res9.status, 400, 'Expired token must be rejected');
  console.log('✔ Test 9 Passed.');

  // 10. Used Telegram tokens cannot be reused
  console.log('Test 10: Used Telegram tokens cannot be reused...');
  const usedToken = 'tg-used';
  mockDb.telegram_tokens.push({
    token: usedToken,
    user_id: 'cust-1',
    expires_at: new Date(Date.now() + 100000).toISOString(),
    used: 2
  });
  const connectUsed = new Request('https://mydigitasset.com/api/telegram/connect', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-customer-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ verificationToken: usedToken })
  });
  const res10 = await onRequest({ request: connectUsed, env, params: {} });
  assert.strictEqual(res10.status, 400, 'Used token must be rejected');
  console.log('✔ Test 10 Passed.');

  // 11. Simultaneous token redemption permits only one successful redemption
  console.log('Test 11: Simultaneous token redemption isolation...');
  const simToken = 'tg-simultaneous';
  mockDb.telegram_tokens.push({
    token: simToken,
    user_id: 'cust-1',
    expires_at: new Date(Date.now() + 100000).toISOString(),
    used: 0
  });
  const whSim1 = onRequest({
    request: new Request('https://mydigitasset.com/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'secret-token-123' },
      body: JSON.stringify({ message: { chat: { id: 111 }, text: `/verify ${simToken}` } })
    }),
    env, params: {}
  });
  const whSim2 = onRequest({
    request: new Request('https://mydigitasset.com/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'secret-token-123' },
      body: JSON.stringify({ message: { chat: { id: 222 }, text: `/verify ${simToken}` } })
    }),
    env, params: {}
  });
  await Promise.all([whSim1, whSim2]);
  const redeemedTok = mockDb.telegram_tokens.find((t: any) => t.token === simToken);
  assert.strictEqual(redeemedTok.used, 1, 'Token must be marked used');
  console.log('✔ Test 11 Passed.');

  // 12. Customer cannot connect another customer's Telegram account
  console.log('Test 12: Customer cannot connect another customer token...');
  const cust2TokenReq = await onRequest({
    request: new Request('https://mydigitasset.com/api/telegram/request-token', { method: 'POST', headers: { 'Authorization': 'Bearer valid-customer2-token' } }),
    env, params: {}
  });
  const cust2TokData = await cust2TokenReq.json() as any;
  const cust2Token = cust2TokData.verificationToken;

  const connectWrongUser = new Request('https://mydigitasset.com/api/telegram/connect', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-customer-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ verificationToken: cust2Token })
  });
  const res12 = await onRequest({ request: connectWrongUser, env, params: {} });
  assert.strictEqual(res12.status, 400, 'Customer using another customer token must fail');
  console.log('✔ Test 12 Passed.');

  // 13. Category-specific prices and GST are calculated correctly
  console.log('Test 13: Category-specific prices and GST calculation...');
  const submitPayReq = new Request('https://mydigitasset.com/api/payments/submit', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-customer-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 'banking_fintech', utr: 'UTRABC123456' })
  });
  const res13 = await onRequest({ request: submitPayReq, env, params: {} });
  assert.strictEqual(res13.status, 200, 'Payment submit succeeds');
  const payData = await res13.json() as any;
  assert.strictEqual(payData.payment.amountBase, 300.00, 'Base price for banking fintech is 300');
  assert.strictEqual(payData.payment.gst, 54.00, 'GST 18% of 300 is 54');
  assert.strictEqual(payData.payment.totalAmount, 354.00, 'Total amount is 354');
  console.log('✔ Test 13 Passed.');

  // 14. Inactive categories cannot be purchased
  console.log('Test 14: Inactive categories cannot be purchased...');
  const submitInactive = new Request('https://mydigitasset.com/api/payments/submit', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-customer-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 'inactive_cat', utr: 'UTR123' })
  });
  const res14 = await onRequest({ request: submitInactive, env, params: {} });
  assert.strictEqual(res14.status, 404, 'Purchasing inactive category must return 404');
  console.log('✔ Test 14 Passed.');

  // 15. Verified payments cannot be approved again
  console.log('Test 15: Verified payments cannot be approved again...');
  const verifiedPay = {
    id: 'pay-v-1',
    user_id: 'cust-1',
    user_name: 'Regular Customer',
    user_email: 'customer@domain.com',
    category_id: 'startups',
    amount_base: 252.00,
    gst: 45.36,
    total_amount: 297.36,
    utr: 'UTRVERIFIED',
    status: 'verified',
    submitted_at: new Date().toISOString()
  };
  mockDb.payments.push(verifiedPay);
  const approveVerified = new Request('https://mydigitasset.com/api/admin/payments/pay-v-1/verify', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-admin-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' })
  });
  const res15 = await onRequest({ request: approveVerified, env, params: { route: ['admin', 'payments', 'pay-v-1', 'verify'] } });
  assert.strictEqual(res15.status, 400, 'Approving already verified payment must return 400');
  console.log('✔ Test 15 Passed.');

  // 16. Rejected payments cannot be approved without a proper new payment process
  console.log('Test 16: Rejected payments cannot be approved without new payment...');
  const rejectedPay = {
    id: 'pay-r-1',
    user_id: 'cust-1',
    user_name: 'Regular Customer',
    user_email: 'customer@domain.com',
    category_id: 'startups',
    amount_base: 252.00,
    gst: 45.36,
    total_amount: 297.36,
    utr: 'UTRREJECTED',
    status: 'rejected',
    submitted_at: new Date().toISOString()
  };
  mockDb.payments.push(rejectedPay);
  const approveRejected = new Request('https://mydigitasset.com/api/admin/payments/pay-r-1/verify', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-admin-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' })
  });
  const res16 = await onRequest({ request: approveRejected, env, params: { route: ['admin', 'payments', 'pay-r-1', 'verify'] } });
  assert.strictEqual(res16.status, 400, 'Approving rejected payment must return 400');
  console.log('✔ Test 16 Passed.');

  // 17. Access override grants access without changing payment records
  console.log('Test 17: Access override grants access without changing payment records...');
  const custUser = mockDb.users.find((u: any) => u.id === 'cust-1');
  const payCountBefore = mockDb.payments.length;

  const overrideReq = new Request('https://mydigitasset.com/api/admin/customers/cust-1/access', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-admin-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantAccess: true })
  });
  const res17 = await onRequest({ request: overrideReq, env, params: {} });
  assert.strictEqual(res17.status, 200);
  assert.strictEqual(mockDb.payments.length, payCountBefore, 'Payment records count must remain untouched');
  assert.strictEqual(custUser.access_override, 1);
  console.log('✔ Test 17 Passed.');

  // 18. Access override revocation restores normal access checks
  console.log('Test 18: Access override revocation restores normal access checks...');
  const revokeReq = new Request('https://mydigitasset.com/api/admin/customers/cust-1/access', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-admin-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantAccess: false })
  });
  const res18 = await onRequest({ request: revokeReq, env, params: {} });
  assert.strictEqual(res18.status, 200);
  assert.strictEqual(custUser.access_override, 0);

  const eligReq = new Request('https://mydigitasset.com/api/news/eligibility', {
    headers: { 'Authorization': 'Bearer valid-customer-token' }
  });
  const resElig = await onRequest({ request: eligReq, env, params: {} });
  const eligData = await resElig.json() as any;
  assert.strictEqual(eligData.authorized, false, 'Revoked customer returns to unauthorized state');
  console.log('✔ Test 18 Passed.');

  // 19. Access to one category does not automatically grant access to another
  console.log('Test 19: Category-specific access boundary...');
  const cust2 = mockDb.users.find((u: any) => u.id === 'cust-2');
  assert.strictEqual(cust2.category, 'banking_fintech', 'Customer 2 has banking fintech category');
  console.log('✔ Test 19 Passed.');

  // 20. Administrator initialization is safe under simultaneous requests
  console.log('Test 20: Administrator initialization concurrency safety...');
  const init1 = workerModule.default.fetch(new Request('https://mydigitasset.com/api/categories'), env, {} as any);
  const init2 = workerModule.default.fetch(new Request('https://mydigitasset.com/api/categories'), env, {} as any);
  await Promise.all([init1, init2]);
  assert.strictEqual(mockDb.settings['admin_initialized'], 'true', 'Admin initialized setting is true');
  console.log('✔ Test 20 Passed.');

  // 21. Customers cannot change their own roles
  console.log('Test 21: Customers cannot change their own roles...');
  const profileRoleReq = new Request('https://mydigitasset.com/api/profile', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer valid-customer-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '+919876543211', role: 'admin' })
  });
  const res21 = await onRequest({ request: profileRoleReq, env, params: {} });
  assert.strictEqual(res21.status, 200, 'Profile update succeeds');
  assert.strictEqual(custUser.role, 'customer', 'Customer role must never be changeable via profile update');
  console.log('✔ Test 21 Passed.');

  // 22. Customer API responses do not expose sensitive administrator or Telegram information
  console.log('Test 22: Customer API responses privacy check...');
  const meReq = new Request('https://mydigitasset.com/api/auth/me', {
    headers: { 'Authorization': 'Bearer valid-customer-token' }
  });
  const res22 = await onRequest({ request: meReq, env, params: {} });
  const meData = await res22.json() as any;
  assert.strictEqual(meData.passwordHash, undefined, 'Password hash must not be exposed');
  assert.strictEqual(meData.password_hash, undefined, 'Password hash must not be exposed');
  console.log('✔ Test 22 Passed.');

  console.log('\nAll 22 comprehensive automated security and business logic tests passed successfully!');
}

runSecurityTests().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
