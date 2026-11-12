import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory and default DB exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_CATEGORIES = [
  {
    id: 'startups',
    title: 'India Startups, Startup Discovery & Funding',
    description: 'Startup launches, emerging companies, funding rounds, investors, venture capital, accelerators, incubators, fundraising, and startup growth.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'banking_fintech',
    title: 'India Banking & FinTech',
    description: 'Banking, digital payments, fintech, lending, financial services, and relevant regulation.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'real_estate',
    title: 'India Real Estate & Infrastructure',
    description: 'Property markets, real estate businesses, housing, commercial property, construction, and infrastructure.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'it_ai',
    title: 'India IT, AI, Cybersecurity & General Technology',
    description: 'IT services, artificial intelligence, cybersecurity, software, digital technology, and technology companies.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'consumer_fmcg',
    title: 'India Consumer & FMCG',
    description: 'Consumer products, fast-moving consumer goods, retail brands, and consumer markets.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'manufacturing_auto',
    title: 'India Manufacturing & Auto',
    description: 'Manufacturing, automobiles, components, industrial production, and supply chains.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'energy_renewables',
    title: 'India Energy & Renewables',
    description: 'Power, oil and gas where relevant, clean energy, renewable projects, and energy technology.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'economy_business',
    title: 'India Economy & Business',
    description: 'Macroeconomics, major business developments, corporate performance, trade, and economic policy.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'hr_employment',
    title: 'India HR & Employment',
    description: 'Recruitment, employment trends, workplace developments, skills, and human resources.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  },
  {
    id: 'marketing_advertising',
    title: 'India Marketing & Advertising',
    description: 'Advertising, digital marketing, agencies, media buying, brand campaigns, and marketing technology.',
    basePrice: 252.00,
    gstRate: 18.00,
    active: true
  }
];

const INITIAL_DB = {
  users: [
    {
      id: 'admin-user-1',
      name: 'Mihir Kapuria',
      firstName: 'Mihir',
      surname: 'Kapuria',
      email: 'mihirkapuria@gmail.com',
      countryCode: '+91',
      mobileNumber: '9876543210',
      mobile: '+919876543210',
      passwordHash: crypto.createHash('sha256').update('admin123').digest('hex'),
      role: 'admin',
      category: 'startups',
      categories: ['startups'],
      trialStart: new Date().toISOString(),
      trialExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      trialExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      subscriptionStatus: 'active_paid',
      paymentStatus: 'verified',
      accessOverride: false,
      telegramConnected: true,
      telegramUsername: 'mihirkapuria',
      createdAt: new Date().toISOString()
    }
  ],
  categories: DEFAULT_CATEGORIES,
  settings: {
    bank_name: '',
    account_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: ''
  },
  payments: [
    {
      id: 'pay-001',
      userId: 'admin-user-1',
      userName: 'Mihir Kapuria',
      userEmail: 'mihirkapuria@gmail.com',
      categoryId: 'startups',
      amountBase: 252.00,
      gst: 45.36,
      totalAmount: 297.36,
      utr: 'UTR987654321012',
      notes: 'Annual Subscription UPI payment verified',
      status: 'verified',
      submittedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'mihirkapuria@gmail.com'
    }
  ],
  auditLogs: [
    {
      id: 'log-001',
      timestamp: new Date().toISOString(),
      adminEmail: 'mihirkapuria@gmail.com',
      action: 'SYSTEM_INIT',
      details: 'MyDigitAsset initialized with blank settings and category-specific pricing.'
    }
  ],
  sessions: {}
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
      return INITIAL_DB;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.settings) parsed.settings = INITIAL_DB.settings;
    return parsed;
  } catch (err) {
    console.error('Error reading DB, falling back to initial:', err);
    return INITIAL_DB;
  }
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Indian Standard Time (IST, UTC+5:30) Calendar Date Calculation Helper
function calculateIstSubscriptionDates(confirmationDate = new Date()): { startIso: string; expiryIso: string } {
  const utcMs = confirmationDate.getTime();
  const istOffsetMs = 330 * 60 * 1000;
  const istDate = new Date(utcMs + istOffsetMs);

  const nextIstYear = istDate.getUTCFullYear();
  const nextIstMonth = istDate.getUTCMonth();
  const nextIstDay = istDate.getUTCDate() + 1;

  const startIst = new Date(Date.UTC(nextIstYear, nextIstMonth, nextIstDay, 0, 0, 0, 0));
  const startUtcMs = startIst.getTime() - istOffsetMs;

  const expiryIst = new Date(Date.UTC(nextIstYear + 1, nextIstMonth, nextIstDay, 0, 0, 0, 0));
  const expiryUtcMs = expiryIst.getTime() - istOffsetMs;

  return {
    startIso: new Date(startUtcMs).toISOString(),
    expiryIso: new Date(expiryUtcMs).toISOString()
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Helper middleware for auth
  const authenticateUser = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split(' ')[1];
    const db = readDb();
    const session = db.sessions[token];
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }
    const userId = typeof session === 'string' ? session : session.user_id;
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user || req.user.email !== 'mihirkapuria@gmail.com' || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' });
    }
    next();
  };

  // --- Public API Routes ---

  app.get('/api/categories', (req, res) => {
    const db = readDb();
    res.json(db.categories.filter((c: any) => c.active).map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      basePrice: c.basePrice || c.base_price || 252.00,
      gstRate: c.gstRate || c.gst_rate || 18.00,
      active: c.active
    })));
  });

  app.get('/api/settings', (req, res) => {
    const db = readDb();
    const s = db.settings || {};
    res.json({
      bankName: s.bank_name || '',
      accountName: s.account_name || '',
      accountNumber: s.account_number || '',
      ifscCode: s.ifsc_code || '',
      upiId: s.upi_id || ''
    });
  });

  app.get('/api/telegram/status', authenticateUser, (req: any, res) => {
    const isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    res.json({
      configured: isConfigured,
      connected: req.user.telegramConnected,
      username: req.user.telegramUsername || ''
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const { firstName, surname, name, email, countryCode, mobileNumber, mobile, password, category } = req.body;
    const fName = firstName || (name ? name.split(' ')[0] : '');
    const sName = surname || (name ? name.split(' ').slice(1).join(' ') : '');
    const fullName = `${fName} ${sName}`.trim() || name || '';
    const cCode = countryCode || '+91';
    const mNum = mobileNumber || (mobile ? mobile.replace(/^\+91/, '') : '');
    const fullMobile = mobile || (cCode + mNum);

    if (!fName || !sName || !email || !fullMobile || !password || !category) {
      return res.status(400).json({ error: 'Missing required registration fields (First Name, Surname, Email, Mobile, Password, Category)' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail === 'mihirkapuria@gmail.com') {
      return res.status(403).json({ error: 'Registration using reserved administrator identity is not permitted.' });
    }

    const db = readDb();
    if (db.users.some((u: any) => u.email.toLowerCase() === normalizedEmail)) {
      return res.status(400).json({ error: 'Email address is already registered.' });
    }

    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const newUser = {
      id: 'user-' + crypto.randomBytes(4).toString('hex'),
      name: fullName,
      firstName: fName,
      surname: sName,
      email: normalizedEmail,
      countryCode: cCode,
      mobileNumber: mNum,
      mobile: fullMobile,
      passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
      role: 'customer',
      category,
      categories: [category],
      trialStart: now.toISOString(),
      trialExpiry: trialExpiry.toISOString(),
      trialExpiresAt: trialExpiry.toISOString(),
      subscriptionStatus: 'trial',
      paymentStatus: 'none',
      accessOverride: false,
      telegramConnected: false,
      telegramUsername: '',
      createdAt: now.toISOString()
    };

    db.users.push(newUser);
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = newUser.id;
    writeDb(db);

    const { passwordHash, ...safeUser } = newUser;
    res.json({ token, user: safeUser });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = readDb();
    const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash !== hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = user.id;
    writeDb(db);

    const { passwordHash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  app.get('/api/auth/me', authenticateUser, (req: any, res) => {
    const { passwordHash, ...safeUser } = req.user;
    res.json(safeUser);
  });

  // Self-service recovery disabled per security requirements
  app.post('/api/auth/recover', (req, res) => {
    return res.status(400).json({ error: 'Self-service password recovery is disabled for security. Please contact the administrator at mihirkapuria@gmail.com for manual account recovery.' });
  });

  app.put('/api/profile', authenticateUser, (req: any, res) => {
    const { countryCode, mobileNumber, mobile } = req.body;
    const cCode = countryCode || req.user.countryCode || '+91';
    const mNum = mobileNumber || (mobile ? mobile.replace(/^\+91/, '') : '');
    const fullMobile = mobile || (cCode + mNum);
    if (!fullMobile) return res.status(400).json({ error: 'Mobile number is required' });

    const db = readDb();
    const index = db.users.findIndex((u: any) => u.id === req.user.id);
    if (index === -1) return res.status(404).json({ error: 'User not found' });

    db.users[index].countryCode = cCode;
    db.users[index].mobileNumber = mNum;
    db.users[index].mobile = fullMobile;
    writeDb(db);

    const { passwordHash, ...safeUser } = db.users[index];
    res.json(safeUser);
  });

  app.post('/api/telegram/connect', authenticateUser, (req: any, res) => {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(400).json({ error: 'Telegram Bot integration is not configured by the administrator.' });
    }

    const { telegramChatId, telegramUsername } = req.body;
    if (!telegramChatId || !telegramUsername) {
      return res.status(400).json({ error: 'Verified Telegram Chat ID and Username are required.' });
    }

    const db = readDb();
    const index = db.users.findIndex((u: any) => u.id === req.user.id);
    if (index === -1) return res.status(404).json({ error: 'User not found' });

    db.users[index].telegramConnected = true;
    db.users[index].telegramUsername = telegramUsername;
    writeDb(db);

    const { passwordHash, ...safeUser } = db.users[index];
    res.json({ success: true, user: safeUser, message: 'Telegram account successfully verified and connected.' });
  });

  // Submit Payment UTR (Category-specific pricing fetched from DB)
  app.post('/api/payments/submit', authenticateUser, (req: any, res) => {
    const { categoryId, utr, notes } = req.body;
    if (!utr || !categoryId) return res.status(400).json({ error: 'Category selection and payment UTR reference number are required' });

    const db = readDb();
    const cat = db.categories.find((c: any) => c.id === categoryId && c.active);
    if (!cat) return res.status(404).json({ error: 'Selected category not found or inactive' });

    const amountBase = parseFloat(cat.basePrice || cat.base_price || 252.00);
    const gstRate = parseFloat(cat.gstRate || cat.gst_rate || 18.00);
    const gst = parseFloat((amountBase * (gstRate / 100)).toFixed(2));
    const totalAmount = parseFloat((amountBase + gst).toFixed(2));

    const paymentRecord = {
      id: 'pay-' + crypto.randomBytes(3).toString('hex'),
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      categoryId,
      amountBase,
      gst,
      totalAmount,
      utr,
      notes: notes || 'UPI payment submission',
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    db.payments.push(paymentRecord);
    const userIndex = db.users.findIndex((u: any) => u.id === req.user.id);
    if (userIndex !== -1) {
      db.users[userIndex].paymentStatus = 'pending';
    }

    writeDb(db);
    res.json({ success: true, payment: paymentRecord, message: 'Payment UTR submitted successfully. Awaiting manual administrator verification.' });
  });

  app.get('/api/payments', authenticateUser, (req: any, res) => {
    const db = readDb();
    const userPayments = db.payments.filter((p: any) => p.userId === req.user.id);
    res.json(userPayments);
  });

  // --- Administrator Routes ---

  app.get('/api/admin/customers', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    const safeUsers = db.users.map(({ passwordHash, ...u }: any) => u);
    res.json(safeUsers);
  });

  // Manual access override (Completely separate from payment status and subscription dates)
  app.post('/api/admin/customers/:customerId/access', authenticateUser, requireAdmin, (req: any, res) => {
    const { customerId } = req.params;
    const { grantAccess } = req.body;

    const db = readDb();
    const userIndex = db.users.findIndex((u: any) => u.id === customerId);
    if (userIndex === -1) return res.status(404).json({ error: 'Customer not found' });

    db.users[userIndex].accessOverride = Boolean(grantAccess);
    db.users[userIndex].subscriptionStatus = grantAccess ? 'active_paid' : 'expired';

    db.auditLogs.push({
      id: 'log-' + crypto.randomBytes(3).toString('hex'),
      timestamp: new Date().toISOString(),
      adminEmail: req.user.email,
      action: 'ACCESS_OVERRIDE',
      details: `${grantAccess ? 'Granted' : 'Revoked'} manual access override for user ${db.users[userIndex].email}`
    });

    writeDb(db);
    const { passwordHash, ...updated } = db.users[userIndex];
    res.json({ success: true, user: updated });
  });

  // Admin-assisted password reset endpoint
  app.post('/api/admin/customers/:customerId/reset-password', authenticateUser, requireAdmin, (req: any, res) => {
    const { customerId } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });

    const db = readDb();
    const userIndex = db.users.findIndex((u: any) => u.id === customerId);
    if (userIndex === -1) return res.status(404).json({ error: 'Customer not found' });

    db.users[userIndex].passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

    db.auditLogs.push({
      id: 'log-' + crypto.randomBytes(3).toString('hex'),
      timestamp: new Date().toISOString(),
      adminEmail: req.user.email,
      action: 'ADMIN_PASSWORD_RESET',
      details: `Administrator reset password for customer ${db.users[userIndex].email}`
    });

    writeDb(db);
    res.json({ success: true, message: 'Password successfully reset by administrator.' });
  });

  app.get('/api/admin/payments', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    res.json(db.payments);
  });

  // Payment verification using IST calendar dates
  app.post('/api/admin/payments/:paymentId/verify', authenticateUser, requireAdmin, (req: any, res) => {
    const { paymentId } = req.params;
    const { action } = req.body;

    const db = readDb();
    const paymentIndex = db.payments.findIndex((p: any) => p.id === paymentId);
    if (paymentIndex === -1) return res.status(404).json({ error: 'Payment record not found' });

    const payment = db.payments[paymentIndex];
    const targetUserId = payment.userId;
    const userIndex = db.users.findIndex((u: any) => u.id === targetUserId);

    const now = new Date();
    const istDates = calculateIstSubscriptionDates(now);
    const nowIso = now.toISOString();

    if (action === 'approve') {
      payment.status = 'verified';
      payment.verifiedAt = nowIso;
      payment.verifiedBy = req.user.email;

      if (userIndex !== -1) {
        db.users[userIndex].paymentStatus = 'verified';
        db.users[userIndex].subscriptionStatus = 'active_paid';
        db.users[userIndex].trialStart = istDates.startIso;
        db.users[userIndex].trialExpiry = istDates.expiryIso;
      }

      db.auditLogs.push({
        id: 'log-' + crypto.randomBytes(3).toString('hex'),
        timestamp: nowIso,
        adminEmail: req.user.email,
        action: 'PAYMENT_APPROVED',
        details: `Approved payment ${paymentId} (UTR: ${payment.utr}) for user ${payment.userEmail}. IST Start: ${istDates.startIso}, Expiry: ${istDates.expiryIso}`
      });
    } else if (action === 'reject') {
      payment.status = 'rejected';
      payment.verifiedAt = nowIso;
      payment.verifiedBy = req.user.email;

      if (userIndex !== -1) {
        db.users[userIndex].paymentStatus = 'rejected';
      }

      db.auditLogs.push({
        id: 'log-' + crypto.randomBytes(3).toString('hex'),
        timestamp: nowIso,
        adminEmail: req.user.email,
        action: 'PAYMENT_REJECTED',
        details: `Rejected payment ${paymentId} (UTR: ${payment.utr}) for user ${payment.userEmail}`
      });
    } else {
      return res.status(400).json({ error: 'Invalid action.' });
    }

    writeDb(db);
    res.json({ success: true, payment });
  });

  app.get('/api/admin/categories', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    res.json(db.categories);
  });

  app.post('/api/admin/categories', authenticateUser, requireAdmin, (req: any, res) => {
    const { id, title, description, basePrice, gstRate, active } = req.body;
    if (!id || !title || !description) return res.status(400).json({ error: 'Missing category fields' });

    const db = readDb();
    const index = db.categories.findIndex((c: any) => c.id === id);
    const bp = basePrice !== undefined ? parseFloat(basePrice) : 252.00;
    const gr = gstRate !== undefined ? parseFloat(gstRate) : 18.00;
    const cat = { id, title, description, basePrice: bp, gstRate: gr, active: active !== false };

    if (index === -1) db.categories.push(cat);
    else db.categories[index] = cat;

    writeDb(db);
    res.json({ success: true, category: cat });
  });

  app.get('/api/admin/settings', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    res.json(db.settings || {});
  });

  app.put('/api/admin/settings', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    db.settings = { ...(db.settings || {}), ...req.body };
    writeDb(db);
    res.json({ success: true, settings: db.settings });
  });

  app.get('/api/admin/audit-logs', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    res.json(db.auditLogs);
  });

  // Static / Vite integration
  const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, 'dist'));

  if (isProduction) {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MyDigitAsset server running on http://0.0.0.0:${port}`);
  });
}

startServer();
