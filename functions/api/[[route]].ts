/**
 * Cloudflare Pages Functions Backend for MyDigitAsset
 * Security-hardened version:
 * - Public test suite endpoint removed.
 * - Strict admin identity protection (preventing self-registration as admin; Mihir Kapuria pre-seeded / protected).
 * - Explicit domain allowlist checking for ad redirect tracking.
 * - PBKDF2 password security with legacy SHA-256 fallback & auto-upgrade.
 */

interface Env {
  DB: any;
  ALLOWED_REDIRECT_DOMAINS?: string; // Optional environment binding for ad redirect allowlist
}

export async function onRequest(context: { request: Request; env: Env; params: { route?: string[] } }) {
  const url = new URL(context.request.url);
  const pathSegments = url.pathname.replace(/^\/api\//, '').split('/');
  const route = pathSegments.join('/');
  const method = context.request.method;
  const env = context.env;

  const json = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  };

  // Normalize Indian mobile numbers to a canonical 10-digit value.
  // The website uses country code +91, but users may paste spaces or +91.
  function normalizeIndianMobile(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    let digits = String(value).replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
    if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) return null;
    return digits;
  }

  // Compare stored numbers after normalization too, so older formatting variants
  // such as +91 9876543210 cannot bypass duplicate checks.
  async function findMobileDuplicate(normalizedMobile: string, excludeUserId?: string): Promise<boolean> {
    const { results } = await env.DB.prepare('SELECT id, mobile FROM users').all();
    return (results as any[]).some((row: any) =>
      row.id !== excludeUserId && normalizeIndianMobile(row.mobile) === normalizedMobile
    );
  }

  // --- Password Security: PBKDF2 with Legacy SHA-256 Fallback & Auto-Upgrade ---
  async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `pbkdf2:100000:${saltHex}:${hashHex}`;
  }

  async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsUpgrade: boolean }> {
    if (!storedHash) return { valid: false, needsUpgrade: false };

    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':');
      if (parts.length !== 4) return { valid: false, needsUpgrade: false };
      const iterations = parseInt(parts[1], 10);
      const saltHex = parts[2];
      const originalHashHex = parts[3];

      const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
      return { valid: hashHex === originalHashHex, needsUpgrade: false };
    } else {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const legacyHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return { valid: legacyHex === storedHash, needsUpgrade: legacyHex === storedHash };
    }
  }

  // --- Authentication & Session Management ---
  async function getAuthUser(req: Request): Promise<any | null> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    
    const session = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').bind(token).first();
    if (!session) return null;

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      return null;
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first();
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      category: user.category,
      categories: JSON.parse(user.categories || '["' + user.category + '"]'),
      trialStart: user.trial_start,
      trialExpiry: user.trial_expiry,
      subscriptionStatus: user.subscription_status,
      paymentStatus: user.payment_status,
      telegramConnected: user.telegram_connected === 1,
      telegramUsername: user.telegram_username,
      createdAt: user.created_at
    };
  }

  try {
    // 1. GET /api/categories
    if (route === 'categories' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM categories').all();
      return json(results.map((c: any) => ({ ...c, active: c.active === 1 })));
    }

    // 2. POST /api/auth/register (prevents duplicate accounts and repeat trials)
    if (route === 'auth/register' && method === 'POST') {
      const body = await context.request.json() as any;
      const { name, email, mobile, password, confirmPassword, category } = body;
      if (!name || !email || !mobile || !password || !confirmPassword || !category) {
        return json({ error: 'Name, email, mobile, password, confirm password, and category are required.' }, 400);
      }
      if (typeof password !== 'string' || password.length < 8) {
        return json({ error: 'Password must be at least 8 characters long.' }, 400);
      }
      if (password !== confirmPassword) {
        return json({ error: 'Password and Confirm Password do not match.' }, 400);
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const normalizedMobile = normalizeIndianMobile(mobile);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return json({ error: 'Please enter a valid email address.' }, 400);
      }
      if (!normalizedMobile) {
        return json({ error: 'Enter a valid 10-digit Indian mobile number. Country code +91 is fixed.' }, 400);
      }

      // Prevent unauthorized public registration using the reserved admin identity.
      if (normalizedEmail === 'mihirkapuria@gmail.com') {
        return json({ error: 'Registration using reserved administrator identity is not permitted.' }, 403);
      }

      const existingEmail = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
      if (existingEmail) {
        return json({ error: 'Email address is already registered. Please log in instead of starting another trial.' }, 409);
      }
      if (await findMobileDuplicate(normalizedMobile)) {
        return json({ error: 'Mobile number is already registered. One free trial is allowed per mobile number.' }, 409);
      }

      // Accept only active categories that exist in the staging database.
      const selectedCategory = await env.DB.prepare('SELECT id FROM categories WHERE id = ? AND active = 1').bind(category).first();
      if (!selectedCategory) return json({ error: 'Please select an available category.' }, 400);

      const userId = 'user-' + crypto.randomUUID().slice(0, 8);
      const passwordHash = await hashPassword(password);
      const role = 'customer'; // Never accept a public role from the request.
      // Record signup time separately from the free-trial start time.
      const nowDate = new Date();
      const now = nowDate.toISOString();

      // The 3-day free trial starts at midnight India time on the day after signup.
      const indiaDateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(nowDate);

      const indiaDatePart = (type: string): number =>
        Number(indiaDateParts.find(part => part.type === type)!.value);

      // Midnight IST is 18:30 UTC on the previous calendar day.
      const trialStartDate = new Date(Date.UTC(
        indiaDatePart('year'),
        indiaDatePart('month') - 1,
        indiaDatePart('day') + 1,
        -5,
        -30
      ));
      const trialStart = trialStartDate.toISOString();
      const trialExpiry = new Date(
        trialStartDate.getTime() + 3 * 24 * 60 * 60 * 1000
      ).toISOString();

      try {
        await env.DB.prepare(`
          INSERT INTO users (id, name, email, mobile, password_hash, role, category, categories, trial_start, trial_expiry, subscription_status, payment_status, telegram_connected, telegram_username, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'trial', 'none', 0, '', ?)
        `).bind(userId, String(name).trim(), normalizedEmail, normalizedMobile, passwordHash, role, category, JSON.stringify([category]), trialStart, trialExpiry, now).run();
      } catch (error: any) {
        // Database unique constraints are the final protection against simultaneous requests.
        const message = String(error?.message || '');
        if (message.includes('users.email')) {
          return json({ error: 'Email address is already registered. Please log in instead.' }, 409);
        }
        if (message.includes('users.mobile')) {
          return json({ error: 'Mobile number is already registered. One free trial is allowed per mobile number.' }, 409);
        }
        throw error;
      }

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expiresAt).run();

      const user = {
        id: userId,
        name: String(name).trim(),
        email: normalizedEmail,
        mobile: normalizedMobile,
        role,
        category,
        categories: [category],
        trialStart,
        trialExpiry,
        subscriptionStatus: 'trial',
        paymentStatus: 'none',
        telegramConnected: false,
        telegramUsername: '',
        createdAt: now
      };

      return json({ token, user });
    }

    // 3. POST /api/auth/login
    if (route === 'auth/login' && method === 'POST') {
      const body = await context.request.json() as any;
      const { email, password } = body;
      if (!email || !password) {
        return json({ error: 'Email and password are required' }, 400);
      }

      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
      if (!user) {
        return json({ error: 'Invalid email or password' }, 401);
      }

      const verification = await verifyPassword(password, user.password_hash);
      if (!verification.valid) {
        return json({ error: 'Invalid email or password' }, 401);
      }

      if (verification.needsUpgrade) {
        const upgradedHash = await hashPassword(password);
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(upgradedHash, user.id).run();
      }

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expiresAt).run();

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        category: user.category,
        categories: JSON.parse(user.categories || '["' + user.category + '"]'),
        trialStart: user.trial_start,
        trialExpiry: user.trial_expiry,
        subscriptionStatus: user.subscription_status,
        paymentStatus: user.payment_status,
        telegramConnected: user.telegram_connected === 1,
        telegramUsername: user.telegram_username,
        createdAt: user.created_at
      };

      return json({ token, user: safeUser });
    }

    // 4. GET /api/auth/me
    if (route === 'auth/me' && method === 'GET') {
      const user = await getAuthUser(context.request);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      return json(user);
    }

    // 5. POST /api/auth/recover
    if (route === 'auth/recover' && method === 'POST') {
      const body = await context.request.json() as any;
      const { email, mobile, newPassword } = body;
      if (!email || !mobile || !newPassword) {
        return json({ error: 'Email, registered mobile number, and new password are required' }, 400);
      }

      const user = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND mobile = ?').bind(email.toLowerCase().trim(), mobile).first();
      if (!user) {
        return json({ error: 'No account found matching this exact email and mobile number combination.' }, 404);
      }

      const newHash = await hashPassword(newPassword);
      await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, user.id).run();

      await env.DB.prepare(`
        INSERT INTO audit_logs (id, timestamp, admin_email, action, details)
        VALUES (?, ?, ?, 'PASSWORD_RECOVERY', ?)
      `).bind('log-' + crypto.randomUUID().slice(0, 8), new Date().toISOString(), email.toLowerCase().trim(), `Password recovered via verified mobile match.`).run();

      return json({ success: true, message: 'Password successfully reset. You can now log in.' });
    }

    // 6. PUT /api/profile (customers may not take another account's mobile number)
    if (route === 'profile' && method === 'PUT') {
      const user = await getAuthUser(context.request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const body = await context.request.json() as any;
      const normalizedMobile = normalizeIndianMobile(body.mobile);
      if (!normalizedMobile) {
        return json({ error: 'Enter a valid 10-digit Indian mobile number. Country code +91 is fixed.' }, 400);
      }
      if (await findMobileDuplicate(normalizedMobile, user.id)) {
        return json({ error: 'This mobile number is already registered to another account.' }, 409);
      }

      try {
        await env.DB.prepare('UPDATE users SET mobile = ? WHERE id = ?').bind(normalizedMobile, user.id).run();
      } catch (error: any) {
        const message = String(error?.message || '');
        if (message.includes('users.mobile')) {
          return json({ error: 'This mobile number is already registered to another account.' }, 409);
        }
        throw error;
      }
      const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

      return json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        mobile: updated.mobile,
        role: updated.role,
        category: updated.category,
        categories: JSON.parse(updated.categories || '[\"' + updated.category + '\"]'),
        trialStart: updated.trial_start,
        trialExpiry: updated.trial_expiry,
        subscriptionStatus: updated.subscription_status,
        paymentStatus: updated.payment_status,
        telegramConnected: updated.telegram_connected === 1,
        telegramUsername: updated.telegram_username,
        createdAt: updated.created_at
      });
    }

    // 7. POST /api/telegram/connect
    if (route === 'telegram/connect' && method === 'POST') {
      const user = await getAuthUser(context.request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const body = await context.request.json() as any;
      const telegramUsername = body.telegramUsername || 'mydigital_user_' + user.id.slice(-4);

      await env.DB.prepare('UPDATE users SET telegram_connected = 1, telegram_username = ? WHERE id = ?').bind(telegramUsername, user.id).run();
      const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

      return json({
        success: true,
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          mobile: updated.mobile,
          role: updated.role,
          category: updated.category,
          categories: JSON.parse(updated.categories || '["' + updated.category + '"]'),
          trialStart: updated.trial_start,
          trialExpiry: updated.trial_expiry,
          subscriptionStatus: updated.subscription_status,
          paymentStatus: updated.payment_status,
          telegramConnected: updated.telegram_connected === 1,
          telegramUsername: updated.telegram_username,
          createdAt: updated.created_at
        },
        message: 'Telegram account successfully connected.'
      });
    }

    // 8. POST /api/payments/submit
    if (route === 'payments/submit' && method === 'POST') {
      const user = await getAuthUser(context.request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const body = await context.request.json() as any;
      const { utr, notes } = body;
      if (!utr) return json({ error: 'Payment UTR / reference number is required' }, 400);

      const paymentId = 'pay-' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO payments (id, user_id, user_name, user_email, amount_base, gst, total_amount, utr, notes, status, submitted_at)
        VALUES (?, ?, ?, ?, 252.00, 45.36, 297.36, ?, ?, 'pending', ?)
      `).bind(paymentId, user.id, user.name, user.email, utr, notes || 'UPI payment submission', now).run();

      await env.DB.prepare('UPDATE users SET payment_status = ? WHERE id = ?').bind('pending', user.id).run();

      const paymentRecord = {
        id: paymentId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        amountBase: 252.00,
        gst: 45.36,
        totalAmount: 297.36,
        utr,
        notes: notes || 'UPI payment submission',
        status: 'pending',
        submittedAt: now
      };

      return json({ success: true, payment: paymentRecord, message: 'Payment UTR submitted successfully. Awaiting manual administrator verification.' });
    }

    // 9. GET /api/payments
    if (route === 'payments' && method === 'GET') {
      const user = await getAuthUser(context.request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const { results } = await env.DB.prepare('SELECT * FROM payments WHERE user_id = ?').bind(user.id).all();
      return json(results.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        userName: p.user_name,
        userEmail: p.user_email,
        amountBase: p.amount_base,
        gst: p.gst,
        totalAmount: p.total_amount,
        utr: p.utr,
        notes: p.notes,
        status: p.status,
        submittedAt: p.submitted_at,
        verifiedAt: p.verified_at,
        verifiedBy: p.verified_by
      })));
    }

    // --- Admin Routes (Strictly mihirkapuria@gmail.com with server role check) ---

    // 10. GET /api/admin/customers
    if (route === 'admin/customers' && method === 'GET') {
      const user = await getAuthUser(context.request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const { results } = await env.DB.prepare('SELECT * FROM users').all();
      return json(results.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        category: u.category,
        categories: JSON.parse(u.categories || '["' + u.category + '"]'),
        trialStart: u.trial_start,
        trialExpiry: u.trial_expiry,
        subscriptionStatus: u.subscription_status,
        paymentStatus: u.payment_status,
        telegramConnected: u.telegram_connected === 1,
        telegramUsername: u.telegram_username,
        createdAt: u.created_at
      })));
    }

    // 11. GET /api/admin/payments
    if (route === 'admin/payments' && method === 'GET') {
      const user = await getAuthUser(context.request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const { results } = await env.DB.prepare('SELECT * FROM payments').all();
      return json(results.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        userName: p.user_name,
        userEmail: p.user_email,
        amountBase: p.amount_base,
        gst: p.gst,
        totalAmount: p.total_amount,
        utr: p.utr,
        notes: p.notes,
        status: p.status,
        submittedAt: p.submitted_at,
        verifiedAt: p.verified_at,
        verifiedBy: p.verified_by
      })));
    }

    // 12. POST /api/admin/payments/:id/verify
    if (pathSegments[0] === 'admin' && pathSegments[1] === 'payments' && pathSegments[2] && pathSegments[3] === 'verify' && method === 'POST') {
      const user = await getAuthUser(context.request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const paymentId = pathSegments[2];
      const body = await context.request.json() as any;
      const action = body.action; // 'approve' or 'reject'

      const payment = await env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first();
      if (!payment) return json({ error: 'Payment not found' }, 404);

      const now = new Date().toISOString();
      const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      if (action === 'approve') {
        await env.DB.prepare('UPDATE payments SET status = ?, verified_at = ?, verified_by = ? WHERE id = ?')
          .bind('verified', now, user.email, paymentId).run();
        await env.DB.prepare('UPDATE users SET payment_status = ?, subscription_status = ?, trial_expiry = ? WHERE id = ?')
          .bind('verified', 'active_paid', newExpiry, payment.user_id).run();

        await env.DB.prepare(`
          INSERT INTO audit_logs (id, timestamp, admin_email, action, details)
          VALUES (?, ?, ?, 'PAYMENT_APPROVED', ?)
        `).bind('log-' + crypto.randomUUID().slice(0, 8), now, user.email, `Approved payment ${paymentId} (UTR: ${payment.utr}) for user ${payment.user_email}`).run();
      } else if (action === 'reject') {
        await env.DB.prepare('UPDATE payments SET status = ?, verified_at = ?, verified_by = ? WHERE id = ?')
          .bind('rejected', now, user.email, paymentId).run();
        await env.DB.prepare('UPDATE users SET payment_status = ? WHERE id = ?')
          .bind('rejected', payment.user_id).run();

        await env.DB.prepare(`
          INSERT INTO audit_logs (id, timestamp, admin_email, action, details)
          VALUES (?, ?, ?, 'PAYMENT_REJECTED', ?)
        `).bind('log-' + crypto.randomUUID().slice(0, 8), now, user.email, `Rejected payment ${paymentId} (UTR: ${payment.utr}) for user ${payment.user_email}`).run();
      } else {
        return json({ error: 'Invalid action' }, 400);
      }

      const updatedPayment = await env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first();
      return json({ success: true, payment: updatedPayment });
    }

    // 13. GET /api/admin/audit-logs
    if (route === 'admin/audit-logs' && method === 'GET') {
      const user = await getAuthUser(context.request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const { results } = await env.DB.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC').all();
      return json(results);
    }

    // 14. GET /api/admin/export-csv (Admin-only CSV export excluding credentials)
    if (route === 'admin/export-csv' && method === 'GET') {
      const user = await getAuthUser(context.request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const { results: users } = await env.DB.prepare('SELECT id, name, email, mobile, role, category, trial_start, trial_expiry, subscription_status, payment_status, telegram_connected, telegram_username, created_at FROM users').all();
      const { results: payments } = await env.DB.prepare('SELECT id, user_email, total_amount, utr, status, submitted_at, verified_at FROM payments').all();

      let csv = '=== CUSTOMERS & SUBSCRIPTIONS ===\n';
      csv += 'ID,Name,Email,Mobile,Role,Category,Trial Start (UTC),Trial Expiry (UTC),Subscription Status,Payment Status,Telegram Connected,Telegram Username,Created At (UTC)\n';
      for (const u of (users as any[])) {
        csv += `"${u.id}","${u.name}","${u.email}","${u.mobile}","${u.role}","${u.category}","${u.trial_start}","${u.trial_expiry}","${u.subscription_status}","${u.payment_status}",${u.telegram_connected},"${u.telegram_username || ''}","${u.created_at}"\n`;
      }

      csv += '\n=== PAYMENTS ===\n';
      csv += 'Payment ID,User Email,Total Amount (INR),UTR Reference,Status,Submitted At (UTC),Verified At (UTC)\n';
      for (const p of (payments as any[])) {
        csv += `"${p.id}","${p.user_email}",${p.total_amount},"${p.utr}","${p.status}","${p.submitted_at}","${p.verified_at || ''}"\n`;
      }

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="mydigitasset_export_' + new Date().toISOString().slice(0, 10) + '.csv"'
        }
      });
    }

    // 15. GET /api/track (Ad-click tracking with strict explicit domain allowlist validation)
    if (route === 'track' && method === 'GET') {
      const token = url.searchParams.get('t');
      if (!token) return new Response('Invalid tracking token', { status: 400 });

      const click = await env.DB.prepare('SELECT c.target_url FROM ad_clicks a JOIN ad_campaigns c ON a.campaign_id = c.id WHERE a.tracking_token = ?').bind(token).first();
      if (!click) return new Response('Campaign link not found or expired', { status: 404 });

      const targetUrl = click.target_url;
      if (!targetUrl) return new Response('Unsafe redirect destination', { status: 400 });

      // Explicit domain allowlist verification
      // Default approved domains: mydigitasset.com, www.mydigitasset.com (plus any configured in environment ALLOWED_REDIRECT_DOMAINS)
      const defaultAllowedDomains = ['mydigitasset.com', 'www.mydigitasset.com'];
      const envAllowed = env.ALLOWED_REDIRECT_DOMAINS ? env.ALLOWED_REDIRECT_DOMAINS.split(',').map((d: string) => d.trim()) : [];
      const allowedDomains = [...defaultAllowedDomains, ...envAllowed];

      let parsedTarget: URL;
      try {
        parsedTarget = new URL(targetUrl);
      } catch {
        return new Response('Malformed redirect destination URL', { status: 400 });
      }

      if (!allowedDomains.includes(parsedTarget.hostname.toLowerCase())) {
        return new Response('Forbidden: Redirect destination domain is not on the approved allowlist', { status: 403 });
      }

      return Response.redirect(parsedTarget.toString(), 302);
    }

    return json({ error: 'Not found' }, 404);
  } catch (err: any) {
    // Keep unexpected backend details out of public API responses.
    return json({ error: 'An unexpected server error occurred. Please try again later.' }, 500);
  }
}
