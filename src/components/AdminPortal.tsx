import React, { useState, useEffect } from 'react';
import { User, PaymentRecord, AuditLog, Category } from '../types';
import { AdminCampaignManager } from './AdminCampaignManager';
import { AdminSiteManager } from './AdminSiteManager';
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, Users,
  CreditCard, FileText, AlertCircle, LogOut, Settings
} from 'lucide-react';

interface AdminPortalProps {
  currentUser: User;
  token: string;
  onLogout: () => void;
  categories: Category[];
}

interface PricingSettings {
  monthlyPrice: number;
  annualBasePrice: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  token,
  onLogout,
  categories
}) => {
  const [activeTab, setActiveTab] = useState<
    'users' | 'customers' | 'payments' | 'audit' | 'pricing' | 'marketing' | 'website'
  >('users');

  const [customers, setCustomers] = useState<User[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedNewsCategory, setSelectedNewsCategory] = useState('');
  const [newsTesting, setNewsTesting] = useState(false);
  const [newsTestResult, setNewsTestResult] = useState<any>(null);
  const [newsTestSummary, setNewsTestSummary] = useState('');



  // Pricing settings
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [monthlyPriceInput, setMonthlyPriceInput] = useState('');
  const [gstRateInput, setGstRateInput] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const [pricingMessage, setPricingMessage] = useState('');

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');

    try {
      const [custRes, payRes, auditRes] = await Promise.all([
        fetch('/api/admin/customers', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/payments', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/audit-logs', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!custRes.ok || !payRes.ok || !auditRes.ok) {
        throw new Error(
          'Customer, payment or audit data could not be loaded.'
        );
      }

      const custData = await custRes.json();
      const payData = await payRes.json();
      const auditData = await auditRes.json();

      setCustomers(custData);
      setPayments(payData);
      setAuditLogs(auditData);
    } catch (err: any) {
      setError(err.message || 'Unable to load administration data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPricing = async () => {
    setPricingLoading(true);
    setPricingError('');
    setPricingMessage('');

    try {
      const response = await fetch('/api/admin/pricing', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load pricing settings.');
      }

      setPricing(data);
      setMonthlyPriceInput(String(data.monthlyPrice));
      setGstRateInput(String(data.gstRate));
    } catch (err: any) {
      setPricingError(
        err.message || 'Unable to load pricing settings.'
      );
    } finally {
      setPricingLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    fetchPricing();
  }, [token]);

  const handleSavePricing = async () => {
    setPricingError('');
    setPricingMessage('');

    const monthlyPrice = Number(monthlyPriceInput);
    const gstRate = Number(gstRateInput);

    if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
      setPricingError('Enter a valid monthly price greater than zero.');
      return;
    }

    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
      setPricingError('GST rate must be between 0 and 100.');
      return;
    }

    setPricingSaving(true);

    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          monthlyPrice,
          gstRate
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save pricing settings.');
      }

      setPricing(data);
      setMonthlyPriceInput(String(data.monthlyPrice));
      setGstRateInput(String(data.gstRate));

      setPricingMessage(
        'Pricing settings have been saved successfully.'
      );
    } catch (err: any) {
      setPricingError(
        err.message || 'Unable to save pricing settings.'
      );
    } finally {
      setPricingSaving(false);
    }
  };


  useEffect(() => {
    if (!selectedNewsCategory && categories.length > 0) {
      setSelectedNewsCategory(categories[0].id);
    }
  }, [categories, selectedNewsCategory]);

  const handleTestSelectedNewsCategory = async () => {
    const selectedCategory = categories.find(category => category.id === selectedNewsCategory);
    if (!selectedCategory) {
      setNewsTestSummary('Please select a category first.');
      return;
    }
    if (!confirm(`Send a clearly labelled test news digest to the ${selectedCategory.title} Telegram channel? This tests only this one category. Normal scheduled deliveries will not be changed.`)) return;

    setNewsTesting(true);
    setNewsTestResult(null);
    setNewsTestSummary('Testing ' + selectedCategory.title + '…');
    try {
      const response = await fetch('/api/admin/news/test/channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ categoryId: selectedCategory.id })
      });
      const data = await response.json();
      const result = data.result || data;
      setNewsTestResult(result);
      if (!response.ok || result.status !== 'sent') {
        throw new Error(result.error || data.error || 'The selected category test failed.');
      }
      setNewsTestSummary(`Test successful: ${selectedCategory.title} · ${result.storyCount || 0} stories sent.`);
    } catch (err: any) {
      setNewsTestSummary('Test failed: ' + (err.message || 'Unknown error'));
    } finally {
      setNewsTesting(false);
    }
  };

  const handleVerifyPayment = async (
    paymentId: string,
    action: 'approve' | 'reject'
  ) => {
    try {
      const res = await fetch(
        `/api/admin/payments/${paymentId}/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ action })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify payment.');
      }

      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSetCustomerStatus = async (
    customerId: string,
    status: string
  ) => {
    try {
      const res = await fetch(
        `/api/admin/customers/${customerId}/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'Failed to update customer status.'
        );
      }

      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (customerId: string, email: string) => {
    if (!confirm(`Invalidate the current password for ${email}? They will need to use Forgot Password with their registered email and mobile number.`)) return;
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to require a password reset.');
      alert(data.message || 'Password reset required.');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAccount = async (accountType: 'user' | 'customer') => {
    const firstName = prompt(`New ${accountType}: first name`);
    if (!firstName?.trim()) return;
    const surname = prompt('Surname (optional)') || '';
    const email = prompt('Email address');
    if (!email?.trim()) return;
    const mobileNumber = prompt('10-digit Indian mobile number');
    if (!mobileNumber?.trim()) return;
    const category = prompt('Category ID (for example: startup, real-estate, stock-market)');
    if (!category?.trim()) return;
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName, surname, email, mobileNumber, category, accountType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create account.');
      alert(data.message || 'Account created.');
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditAccount = async (account: User) => {
    const firstName = prompt('First name', account.firstName || account.name.split(' ')[0] || '');
    if (firstName === null) return;
    const surname = prompt('Surname', account.surname || '');
    if (surname === null) return;
    const email = prompt('Email address', account.email);
    if (email === null) return;
    const mobileNumber = prompt('10-digit Indian mobile number', account.mobileNumber || '');
    if (mobileNumber === null) return;
    const category = prompt('Category ID', account.category);
    if (category === null) return;
    try {
      const res = await fetch(`/api/admin/customers/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName, surname, email, mobileNumber, category })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update account.');
      alert(data.message || 'Account updated.');
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAccount = async (account: User) => {
    const confirmed = confirm(
      `PERMANENTLY DELETE ${account.name} (ID ${account.id})?\n\nThis removes the account and its linked payments, subscriptions, sessions and Telegram records. This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/customers/${account.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete account.');
      alert(data.message || 'Account deleted.');
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportAccounts = async () => {
    try {
      const res = await fetch(`/api/admin/customers/export.csv?type=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'CSV export failed.');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = activeTab === 'customers' ? 'mydigitasset-customers.csv' : 'mydigitasset-users.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (
    currentUser.email !== 'mihirkapuria@gmail.com' ||
    currentUser.role !== 'admin'
  ) {
    return (
      <div className="py-24 max-w-xl mx-auto px-6 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900">
          Access Restricted
        </h2>

        <p className="text-sm text-slate-600">
          The authorized administrator account is
          <strong className="text-slate-900">
            {' '}mihirkapuria@gmail.com
          </strong>.
          Your current account does not have administrative privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 space-y-8">

        {/* ADMIN HEADER */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Authorized Administrator Portal
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight">
              System Administration
            </h1>

            <p className="text-sm text-slate-400">
              Verified Administrator:
              <strong className="text-white">
                {' '}{currentUser.email}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="admin-news-category" className="text-xs font-semibold text-slate-300">
              Test one category
            </label>
            <select
              id="admin-news-category"
              value={selectedNewsCategory}
              onChange={(event) => {
                setSelectedNewsCategory(event.target.value);
                setNewsTestResult(null);
                setNewsTestSummary('');
              }}
              disabled={newsTesting || categories.length === 0}
              className="min-w-64 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {categories.length === 0 && <option value="">No categories available</option>}
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.title}</option>
              ))}
            </select>
            <button
              onClick={handleTestSelectedNewsCategory}
              disabled={newsTesting || !selectedNewsCategory}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white"
            >
              {newsTesting ? 'Testing…' : 'Test Selected Category'}
            </button>

            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700 flex-wrap">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                  activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Users ({customers.filter(c => c.accountType !== 'customer').length})
              </button>
              <button
                onClick={() => setActiveTab('customers')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                  activeTab === 'customers' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Customers ({customers.filter(c => c.accountType === 'customer').length})
              </button>

              <button
                onClick={() => setActiveTab('payments')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                  activeTab === 'payments'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Payments ({payments.filter(p => p.status === 'pending').length} Pending)
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                  activeTab === 'audit'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                Audit Logs ({auditLogs.length})
              </button>

              <button
                onClick={() => setActiveTab('website')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                  activeTab === 'website'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                Website Content
              </button>

              <button
                onClick={() => setActiveTab('marketing')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                  activeTab === 'marketing'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                Campaigns & Channels
              </button>

              <button
                onClick={() => setActiveTab('pricing')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                  activeTab === 'pricing'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                Pricing
              </button>
            </div>

            <button
              onClick={onLogout}
              title="Sign out"
              className="p-3 text-slate-300 hover:text-red-400 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && activeTab !== 'pricing' && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        {newsTestSummary && (
          <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 text-violet-900 space-y-2">
            <p className="text-sm font-semibold">{newsTestSummary}</p>
            {newsTestResult?.status === 'sent' && (
              <p className="text-xs">
                Telegram message ID(s): {(newsTestResult.messageIds || []).join(', ') || 'confirmed'}
              </p>
            )}
            {newsTestResult?.status === 'failed' && newsTestResult.error && (
              <p className="text-xs text-red-700">{newsTestResult.error}</p>
            )}
          </div>
        )}

        {/* PRICING TAB */}
        {activeTab === 'pricing' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                Subscription Pricing Settings
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                Set the monthly category price and GST rate.
                Changes will be used for future customer payment calculations.
              </p>
            </div>

            <div className="p-6 md:p-8 max-w-2xl space-y-6">
              {pricingLoading && (
                <p className="text-sm text-slate-500">
                  Loading pricing settings...
                </p>
              )}

              {pricingError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {pricingError}
                </div>
              )}

              {pricingMessage && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 inline mr-2" />
                  {pricingMessage}
                </div>
              )}

              {!pricingLoading && pricing && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Monthly price per category (₹)
                    </label>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={monthlyPriceInput}
                      onChange={e => setMonthlyPriceInput(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                    />

                    <p className="text-xs text-slate-500 mt-1">
                      Current monthly price: ₹{pricing.monthlyPrice.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      GST rate (%)
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={gstRateInput}
                      onChange={e => setGstRateInput(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-900"
                    />

                    <p className="text-xs text-slate-500 mt-1">
                      Current GST rate: {pricing.gstRate}%
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h4 className="font-bold text-slate-900">
                      Current Annual Price Calculation
                    </h4>

                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Monthly price</span>
                      <span>₹{pricing.monthlyPrice.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Annual base price (12 months)</span>
                      <span>₹{pricing.annualBasePrice.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm text-slate-600">
                      <span>GST ({pricing.gstRate}%)</span>
                      <span>₹{pricing.gstAmount.toFixed(2)}</span>
                    </div>

                    <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-900">
                      <span>Total annual payment</span>
                      <span className="text-indigo-600">
                        ₹{pricing.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleSavePricing}
                    disabled={pricingSaving}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50"
                  >
                    {pricingSaving
                      ? 'Saving pricing settings...'
                      : 'Save Pricing Settings'}
                  </button>

                  <p className="text-xs text-slate-500">
                    The server calculates the payment amount using these
                    saved settings. Customers cannot choose or alter the
                    payment amount themselves.
                  </p>
                </>
              )}

              {!pricingLoading && !pricing && !pricingError && (
                <p className="text-sm text-slate-500">
                  Pricing settings are not available.
                </p>
              )}

              <button
                onClick={fetchPricing}
                disabled={pricingLoading || pricingSaving}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
              >
                Refresh pricing settings
              </button>
            </div>
          </div>
        )}

        {/* OTHER ADMIN TABS */}
        {activeTab !== 'pricing' && (
          loading ? (
            <div className="py-20 text-center text-slate-500 text-sm">
              Loading administration data...
            </div>
          ) : (
            <>
              {/* WEBSITE CMS, BLOG, TOOLS AND ADSENSE */}
              {activeTab === 'website' && (
                <AdminSiteManager token={token} />
              )}

              {/* PROMOTIONS, CATEGORY CHANNELS AND AFFILIATE ANALYTICS */}
              {activeTab === 'marketing' && (
                <AdminCampaignManager token={token} />
              )}

              {/* CUSTOMERS TAB */}
              {(activeTab === 'users' || activeTab === 'customers') && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      {activeTab === 'customers' ? 'Paid Customers' : 'Free-Tier Users'} Management
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500 font-mono">
                        Total: {customers.filter(c => activeTab === 'customers' ? c.accountType === 'customer' : c.accountType !== 'customer').length}
                      </span>
                      <button onClick={() => handleCreateAccount(activeTab === 'customers' ? 'customer' : 'user')} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
                        Add {activeTab === 'customers' ? 'Customer' : 'User'}
                      </button>
                      <button onClick={handleExportAccounts} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold">
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                          <th className="p-4">Account Type</th>\n                          <th className="p-4">Name</th>
                          <th className="p-4">Email</th>
                          <th className="p-4">Mobile</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Subscription</th>
                          <th className="p-4">Payment Status</th>
                          <th className="p-4">Telegram</th>
                          <th className="p-4">Trial Expiry</th>
                          <th className="p-4 text-right">Admin Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {customers.filter(c => activeTab === 'customers' ? c.accountType === 'customer' : c.accountType !== 'customer').map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${c.accountType === 'customer' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                                {c.accountType === 'customer' ? 'Customer' : 'User'}
                              </span>
                            </td>
                            <td className="p-4 font-semibold text-slate-900">{c.name}</td>
                            <td className="p-4 text-slate-600">{c.email}</td>
                            <td className="p-4 font-mono text-slate-600">
                              {c.mobile}
                            </td>
                            <td className="p-4 text-slate-600">{c.categoryTitle || c.category || '—'}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                c.subscriptionStatus === 'active_paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.subscriptionStatus === 'pending_approval'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : c.subscriptionStatus === 'stopped'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {c.subscriptionStatus.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-4 capitalize font-semibold text-slate-700">
                              {c.paymentStatus}
                            </td>
                            <td className="p-4">
                              {c.telegramConnected ? (
                                <span className="text-emerald-600 font-medium">
                                  Connected
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  Not Connected
                                </span>
                              )}
                            </td>
                            <td className="p-4 font-mono text-slate-500">
                              {c.trialExpiry
                                ? new Date(c.trialExpiry).toLocaleDateString()
                                : '-'}
                            </td>
                            <td className="p-4 text-right space-x-1.5">
                              {c.email !== 'mihirkapuria@gmail.com' && (
                                <>
                                  {c.subscriptionStatus !== 'active_paid' && (
                                    <button
                                      onClick={() => handleSetCustomerStatus(c.id, 'active_paid')}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded"
                                      title="Manually Approve Subscription"
                                    >
                                      Approve
                                    </button>
                                  )}

                                  {c.subscriptionStatus !== 'stopped' && (
                                    <button
                                      onClick={() => handleSetCustomerStatus(c.id, 'stopped')}
                                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-semibold rounded"
                                      title="Manually Stop Subscription"
                                    >
                                      Stop
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleEditAccount(c)}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded"
                                    title="Edit account details"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleResetPassword(c.id, c.email)}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded"
                                    title="Require account holder to reset password"
                                  >
                                    Require Reset
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAccount(c)}
                                    className="px-2.5 py-1 bg-red-700 hover:bg-red-600 text-white font-semibold rounded"
                                    title="Permanently delete account and linked records"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PAYMENTS TAB */}
              {activeTab === 'payments' && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      Payment Submissions & UTR Verification
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      Pending: {payments.filter(p => p.status === 'pending').length}
                    </span>
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
                        {payments.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-4">
                              <div className="font-semibold text-slate-900">
                                {p.userName}
                              </div>
                              <div className="text-slate-500">
                                {p.userEmail}
                              </div>
                            </td>
                            <td className="p-4 font-mono font-semibold text-slate-900">
                              ₹{p.totalAmount}
                            </td>
                            <td className="p-4 font-mono font-bold text-indigo-600">
                              {p.utr}
                            </td>
                            <td className="p-4 text-slate-600">
                              {p.notes || '-'}
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                p.status === 'verified'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="p-4 text-slate-500">
                              {p.submittedAt
                                ? new Date(p.submittedAt).toLocaleString()
                                : '-'}
                            </td>
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
                                <span className="text-slate-400 italic">
                                  Processed
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* AUDIT LOGS TAB */}
              {activeTab === 'audit' && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      Administrative Audit Trail
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      Total Logs: {auditLogs.length}
                    </span>
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
                        {auditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="p-4 font-mono text-slate-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="p-4 font-semibold text-slate-900">
                              {log.adminEmail}
                            </td>
                            <td className="p-4 font-mono text-indigo-600">
                              {log.action}
                            </td>
                            <td className="p-4 text-slate-600">
                              {log.details}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};
