export interface Category {
  id: string;
  title: string;
  description: string;
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: 'admin' | 'customer';
  categories: string[];
  trialStart: string;
  trialExpiry: string;
  subscriptionStatus: 'trial' | 'active_paid' | 'expired';
  paymentStatus: 'none' | 'pending' | 'verified' | 'rejected';
  telegramConnected: boolean;
  telegramUsername?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountBase: number;
  gst: number;
  totalAmount: number;
  utr: string;
  notes: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  details: string;
}
