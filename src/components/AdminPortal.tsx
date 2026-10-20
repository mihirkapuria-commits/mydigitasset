import React, { useState, useEffect } from 'react';
import { User, PaymentRecord, AuditLog } from '../types';
import { ShieldCheck, CheckCircle2, XCircle, Clock, Users, CreditCard, FileText, AlertCircle } from 'lucide-react';

interface AdminPortalProps {
  currentUser: User;
  token: string;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ currentUser, token }) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'payments' | 'audit'>('customers');
  const [customers, setCustomers] = useState<User[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const [custRes, payRes, auditRes] = await Promise.all([
        fetch('/api/admin/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/payments', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/audit-logs', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!custRes.ok || !payRes.ok || !auditRes.ok) {
        throw new Error('Unauthorized or failed to load administrator data.');
      }

      const custData = await custRes.json();
      const payData = await payRes.json();
      const auditData = await auditRes.json();

      setCustomers(custData);
      setPayments(payData);
      setAuditLogs(auditData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const handleVerifyPayment = async (paymentId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify payment');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (currentUser.email !== 'mihirkapuria@gmail.com' || currentUser.role !== 'admin') {
    return (
      <div className="py-24 max-w-xl mx-auto px-6 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-600">
          The authorized administrator account is <strong className="text-slate-900">mihirkapuria@gmail.com</strong>. Your current account does not have administrative privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        {/* Admin Header */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Authorized Administrator Portal
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">System Administration</h1>
            <p className="text-sm text-slate-400">
              Verified Administrator: <strong className="text-white">{currentUser.email}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'customers' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              Customers ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'payments' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Payments ({payments.filter(p => p.status === 'pending').length} Pending)
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Audit Logs ({auditLogs.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Loading administration data...</div>
        ) : (
          <>
            {/* Customers Tab */}
            {activeTab === 'customers' && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Registered Customers Overview</h3>
                  <span className="text-xs text-slate-500 font-mono">Total: {customers.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="p-4">Customer Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Mobile</th>
                        <th className="p-4">Subscription</th>
                        <th className="p-4">Payment Status</th>
                        <th className="p-4">Telegram</th>
                        <th className="p-4">Trial Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-semibold text-slate-900">{c.name}</td>
                          <td className="p-4 text-slate-600">{c.email}</td>
                          <td className="p-4 font-mono text-slate-600">{c.mobile}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                              c.subscriptionStatus === 'active_paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {c.subscriptionStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-4 capitalize font-semibold text-slate-700">{c.paymentStatus}</td>
                          <td className="p-4">
                            {c.telegramConnected ? (
                              <span className="text-emerald-600 font-medium">Connected</span>
                            ) : (
                              <span className="text-slate-400">Not Connected</span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-slate-500">{new Date(c.trialExpiry).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Payment Submissions & UTR Verification</h3>
                  <span className="text-xs text-slate-500 font-mono">Pending: {payments.filter(p => p.status === 'pending').length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="p-4">Customer</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">UTR Reference</th>
                        <th className="p-4">Notes</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Submitted At</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-4">
                            <div className="font-semibold text-slate-900">{p.userName}</div>
                            <div className="text-slate-500">{p.userEmail}</div>
                          </td>
                          <td className="p-4 font-mono font-semibold text-slate-900">₹{p.totalAmount}</td>
                          <td className="p-4 font-mono font-bold text-indigo-600">{p.utr}</td>
                          <td className="p-4 text-slate-600">{p.notes || '-'}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                              p.status === 'verified' ? 'bg-emerald-100 text-emerald-850' :
                              p.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500">{new Date(p.submittedAt).toLocaleString()}</td>
                          <td className="p-4 text-right space-x-2">
                            {p.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => handleVerifyPayment(p.id, 'approve')}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleVerifyPayment(p.id, 'reject')}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">Processed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audit' && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Administrative Audit Trail</h3>
                  <span className="text-xs text-slate-500 font-mono">Total Logs: {auditLogs.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Administrator</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="p-4 font-semibold text-slate-900">{log.adminEmail}</td>
                          <td className="p-4 font-mono text-indigo-600">{log.action}</td>
                          <td className="p-4 text-slate-600">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
