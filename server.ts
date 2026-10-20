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
    active: true
  },
  {
    id: 'banking_fintech',
    title: 'India Banking & FinTech',
    description: 'Banking, digital payments, fintech, lending, financial services, and relevant regulation.',
    active: true
  },
  {
    id: 'real_estate',
    title: 'India Real Estate & Infrastructure',
    description: 'Property markets, real estate businesses, housing, commercial property, construction, and infrastructure.',
    active: true
  },
  {
    id: 'it_ai',
    title: 'India IT, AI, Cybersecurity & General Technology',
    description: 'IT services, artificial intelligence, cybersecurity, software, digital technology, and technology companies.',
    active: true
  },
  {
    id: 'consumer_fmcg',
    title: 'India Consumer & FMCG',
    description: 'Consumer products, fast-moving consumer goods, retail brands, and consumer markets.',
    active: true
  },
  {
    id: 'manufacturing_auto',
    title: 'India Manufacturing & Auto',
    description: 'Manufacturing, automobiles, components, industrial production, and supply chains.',
    active: true
  },
  {
    id: 'energy_renewables',
    title: 'India Energy & Renewables',
    description: 'Power, oil and gas where relevant, clean energy, renewable projects, and energy technology.',
    active: true
  },
  {
    id: 'economy_business',
    title: 'India Economy & Business',
    description: 'Macroeconomics, major business developments, corporate performance, trade, and economic policy.',
    active: true
  },
  {
    id: 'hr_employment',
    title: 'India HR & Employment',
    description: 'Recruitment, employment trends, workplace developments, skills, and human resources.',
    active: true
  },
  {
    id: 'marketing_advertising',
    title: 'India Marketing & Advertising',
    description: 'Advertising, digital marketing, agencies, media buying, brand campaigns, and marketing technology.',
    active: true
  }
];

const INITIAL_DB = {
  users: [
    {
      id: 'admin-user-1',
      name: 'Mihir Kapuria',
      email: 'mihirkapuria@gmail.com',
      mobile: '+919876543210',
      passwordHash: crypto.createHash('sha256').update('admin123').digest('hex'),
      role: 'admin',
      categories: ['startups', 'banking_fintech', 'it_ai', 'economy_business'],
      trialStart: new Date().toISOString(),
      trialExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      subscriptionStatus: 'active_paid',
      paymentStatus: 'verified',
      telegramConnected: true,
      telegramUsername: 'mihirkapuria',
      createdAt: new Date().toISOString()
    }
  ],
  categories: DEFAULT_CATEGORIES,
  payments: [
    {
      id: 'pay-001',
      userId: 'admin-user-1',
      userName: 'Mihir Kapuria',
      userEmail: 'mihirkapuria@gmail.com',
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
      details: 'MyDigitAsset initialized with default admin and categories.'
    }
  ],
  sessions: {} // token -> userId
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
      return INITIAL_DB;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
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

async function startServer() {
  const app = express();
  app.use(express.json());

  // Helper middleware to get current user from Authorization header (Bearer token)
  const authenticateUser = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split(' ')[1];
    const db = readDb();
    const userId = db.sessions[token];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  };

  // Helper for admin check
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user || req.user.email !== 'mihirkapuria@gmail.com' || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' });
    }
    next();
  };

  // --- Public API Routes ---

  // Get categories
  app.get('/api/categories', (req, res) => {
    const db = readDb();
    res.json(db.categories);
  });

  // Register
  app.post('/api/auth/register', (req, res) => {
    const { name, email, mobile, password, categories } = req.body;
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ error: 'Missing required registration fields' });
    }

    const db = readDb();
    if (db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email address is already registered.' });
    }

    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 calendar days
    const newUser = {
      id: 'user-' + crypto.randomBytes(4).toString('hex'),
      name,
      email: email.toLowerCase(),
      mobile,
      passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
      role: email.toLowerCase() === 'mihirkapuria@gmail.com' ? 'admin' : 'customer',
      categories: Array.isArray(categories) && categories.length > 0 ? categories : ['startups', 'economy_business'],
      trialStart: now.toISOString(),
      trialExpiry: trialExpiry.toISOString(),
      subscriptionStatus: 'trial', // trial, active_paid, expired
      paymentStatus: 'none', // none, pending, verified, rejected
      telegramConnected: false,
      telegramUsername: '',
      createdAt: now.toISOString()
    };

    db.users.push(newUser);
    
    // Create session token
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = newUser.id;
    writeDb(db);

    const { passwordHash, ...safeUser } = newUser;
    res.json({ token, user: safeUser });
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = readDb();
    const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
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

  // Get current session user
  app.get('/api/auth/me', authenticateUser, (req: any, res) => {
    const { passwordHash, ...safeUser } = req.user;
    res.json(safeUser);
  });

  // Password Recovery Policy (Without OTP/Email/SMS verification, matching email + mobile number)
  app.post('/api/auth/recover', (req, res) => {
    const { email, mobile, newPassword } = req.body;
    if (!email || !mobile || !newPassword) {
      return res.status(400).json({ error: 'Email, registered mobile number, and new password are required' });
    }

    const db = readDb();
    const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.mobile === mobile);
    if (!user) {
      return res.status(404).json({ error: 'No account found matching this exact email and mobile number combination.' });
    }

    user.passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    
    db.auditLogs.push({
      id: 'log-' + crypto.randomBytes(3).toString('hex'),
      timestamp: new Date().toISOString(),
      adminEmail: user.email,
      action: 'PASSWORD_RECOVERY',
      details: `Password recovered for account ${user.email} using verified mobile number match.`
    });

    writeDb(db);
    res.json({ success: true, message: 'Password successfully reset. You can now log in.' });
  });

  // --- Authenticated Customer Routes ---

  // Update profile (permitted to update mobile number only)
  app.put('/api/profile', authenticateUser, (req: any, res) => {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const db = readDb();
    const index = db.users.findIndex((u: any) => u.id === req.user.id);
    if (index === -1) return res.status(404).json({ error: 'User not found' });

    db.users[index].mobile = mobile;
    writeDb(db);

    const { passwordHash, ...safeUser } = db.users[index];
    res.json(safeUser);
  });

  // Connect Telegram (simulated secure token link)
  app.post('/api/telegram/connect', authenticateUser, (req: any, res) => {
    const { telegramUsername } = req.body;
    const db = readDb();
    const index = db.users.findIndex((u: any) => u.id === req.user.id);
    if (index === -1) return res.status(404).json({ error: 'User not found' });

    db.users[index].telegramConnected = true;
    db.users[index].telegramUsername = telegramUsername || 'mydigital_user_' + req.user.id.slice(-4);
    writeDb(db);

    const { passwordHash, ...safeUser } = db.users[index];
    res.json({ success: true, user: safeUser, message: 'Telegram account successfully connected to MyDigitAsset Bot.' });
  });

  // Submit Payment UTR
  app.post('/api/payments/submit', authenticateUser, (req: any, res) => {
    const { utr, notes } = req.body;
    if (!utr) {
      return res.status(400).json({ error: 'Payment UTR / reference number is required' });
    }

    const db = readDb();
    const paymentRecord = {
      id: 'pay-' + crypto.randomBytes(3).toString('hex'),
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      amountBase: 252.00,
      gst: 45.36,
      totalAmount: 297.36,
      utr,
      notes: notes || 'UPI payment submission',
      status: 'pending', // pending, verified, rejected
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

  // Get user payments
  app.get('/api/payments', authenticateUser, (req: any, res) => {
    const db = readDb();
    const userPayments = db.payments.filter((p: any) => p.userId === req.user.id);
    res.json(userPayments);
  });

  // --- Administrator Routes (Strictly mihirkapuria@gmail.com) ---

  app.get('/api/admin/customers', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    const safeUsers = db.users.map(({ passwordHash, ...u }: any) => u);
    res.json(safeUsers);
  });

  app.get('/api/admin/payments', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    res.json(db.payments);
  });

  app.post('/api/admin/payments/:paymentId/verify', authenticateUser, requireAdmin, (req: any, res) => {
    const { paymentId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const db = readDb();
    const paymentIndex = db.payments.findIndex((p: any) => p.id === paymentId);
    if (paymentIndex === -1) return res.status(404).json({ error: 'Payment record not found' });

    const payment = db.payments[paymentIndex];
    const targetUserId = payment.userId;
    const userIndex = db.users.findIndex((u: any) => u.id === targetUserId);

    if (action === 'approve') {
      payment.status = 'verified';
      payment.verifiedAt = new Date().toISOString();
      payment.verifiedBy = req.user.email;

      if (userIndex !== -1) {
        db.users[userIndex].paymentStatus = 'verified';
        db.users[userIndex].subscriptionStatus = 'active_paid';
        // Extend trial/subscription by 1 year
        db.users[userIndex].trialExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      db.auditLogs.push({
        id: 'log-' + crypto.randomBytes(3).toString('hex'),
        timestamp: new Date().toISOString(),
        adminEmail: req.user.email,
        action: 'PAYMENT_APPROVED',
        details: `Approved payment ${paymentId} (UTR: ${payment.utr}) for user ${payment.userEmail}`
      });
    } else if (action === 'reject') {
      payment.status = 'rejected';
      payment.verifiedAt = new Date().toISOString();
      payment.verifiedBy = req.user.email;

      if (userIndex !== -1) {
        db.users[userIndex].paymentStatus = 'rejected';
      }

      db.auditLogs.push({
        id: 'log-' + crypto.randomBytes(3).toString('hex'),
        timestamp: new Date().toISOString(),
        adminEmail: req.user.email,
        action: 'PAYMENT_REJECTED',
        details: `Rejected payment ${paymentId} (UTR: ${payment.utr}) for user ${payment.userEmail}`
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be approve or reject.' });
    }

    writeDb(db);
    res.json({ success: true, payment });
  });

  app.get('/api/admin/audit-logs', authenticateUser, requireAdmin, (req: any, res) => {
    const db = readDb();
    res.json(db.auditLogs);
  });

  // Vite integration
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MyDigitAsset server running on http://localhost:${port}`);
  });
}

startServer();
