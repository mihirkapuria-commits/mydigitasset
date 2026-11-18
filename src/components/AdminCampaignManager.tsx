import React, { useEffect, useState } from 'react';

type Category = {
  id: string; title: string; description: string; telegramChatId: string;
  active: number; displayOrder: number;
};
type Campaign = {
  id: string; campaign_name: string; product_name: string; message_text: string;
  image_url: string; affiliate_url: string; link_label: string;
  affiliate_disclosure: string; status: string; scheduled_for: string;
  sent_channels: number; failed_channels: number;
};
type AnalyticsRow = {
  campaign_id: string; product_name: string; source_type: string;
  source_id: string; clicks: number; reported_order_amount: number;
  reported_commission: number; reported_purchases: number;
};

interface Props { token: string; }

const emptyCampaign = {
  campaignName: '', productName: '', messageText: '', imageUrl: '',
  affiliateUrl: '', linkLabel: 'View Offer',
  affiliateDisclosure: 'We may earn a commission from qualifying purchases.'
};

export const AdminCampaignManager: React.FC<Props> = ({ token }) => {
  const [view, setView] = useState<'campaigns' | 'categories' | 'analytics'>('campaigns');
  const [categories, setCategories] = useState<Category[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [editingCampaignId, setEditingCampaignId] = useState('');
  const [categoryForm, setCategoryForm] = useState({
    id: '', title: '', description: '', telegramChatId: '', displayOrder: '0'
  });
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const loadAll = async () => {
    setLoading(true); setError('');
    try {
      const [catRes, campaignRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/categories', { headers }),
        fetch('/api/admin/promotions', { headers }),
        fetch('/api/admin/affiliate/analytics', { headers })
      ]);
      const catData = await catRes.json();
      const campaignData = await campaignRes.json();
      const analyticsData = await analyticsRes.json();
      if (!catRes.ok || !campaignRes.ok || !analyticsRes.ok) {
        throw new Error(catData.error || campaignData.error || analyticsData.error || 'Unable to load campaign administration data.');
      }
      setCategories(catData);
      setCampaigns(campaignData);
      setAnalytics(analyticsData);
    } catch (e: any) {
      setError(e.message || 'Unable to load data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [token]);

  const saveCampaign = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const url = editingCampaignId
        ? `/api/admin/promotions/${encodeURIComponent(editingCampaignId)}`
        : '/api/admin/promotions';
      const response = await fetch(url, {
        method: editingCampaignId ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save campaign.');
      setCampaignForm(emptyCampaign); setEditingCampaignId('');
      setNotice('Campaign draft saved.');
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const approveCampaign = async (id: string) => {
    if (!window.confirm('Approve this campaign? It will be sent to every active, configured category Telegram channel on its scheduled 14th or 28th date.')) return;
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/promotions/${encodeURIComponent(id)}/approve`, {
        method: 'POST', headers
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not approve campaign.');
      setNotice(`Approved. Scheduled for ${data.scheduledFor} (India time).`);
      await loadAll();
    } catch (e: any) { setError(e.message); }
  };

  const editCampaign = (c: Campaign) => {
    setEditingCampaignId(c.id);
    setCampaignForm({
      campaignName: c.campaign_name || '', productName: c.product_name || '',
      messageText: c.message_text || '', imageUrl: c.image_url || '',
      affiliateUrl: c.affiliate_url || '', linkLabel: c.link_label || 'View Offer',
      affiliateDisclosure: c.affiliate_disclosure || ''
    });
    setView('campaigns');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCampaign = async (id: string) => {
    if (!window.confirm('Delete this unsent campaign?')) return;
    const response = await fetch(`/api/admin/promotions/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Could not delete campaign.'); return; }
    setNotice('Campaign deleted.');
    await loadAll();
  };

  const saveCategory = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const url = editingCategoryId
        ? `/api/admin/categories/${encodeURIComponent(editingCategoryId)}`
        : '/api/admin/categories';
      const response = await fetch(url, {
        method: editingCategoryId ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...categoryForm,
          active: true,
          displayOrder: Number(categoryForm.displayOrder || 0)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save category.');
      setCategoryForm({ id: '', title: '', description: '', telegramChatId: '', displayOrder: '0' });
      setEditingCategoryId('');
      setNotice('Category saved.');
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const editCategory = (c: Category) => {
    setEditingCategoryId(c.id);
    setCategoryForm({
      id: c.id, title: c.title, description: c.description || '',
      telegramChatId: c.telegramChatId, displayOrder: String(c.displayOrder || 0)
    });
  };

  const deleteCategory = async (c: Category) => {
    if (!window.confirm(`Permanently delete "${c.title}"? This is allowed only when no customer, subscription or payment uses it.`)) return;
    const response = await fetch(`/api/admin/categories/${encodeURIComponent(c.id)}`, { method: 'DELETE', headers });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Could not delete category.'); return; }
    setNotice('Category deleted.');
    await loadAll();
  };

  const deactivateCategory = async (c: Category) => {
    if (!window.confirm(`Deactivate "${c.title}"? It will no longer appear for new registrations or receive promotional messages.`)) return;
    const response = await fetch(`/api/admin/categories/${encodeURIComponent(c.id)}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, active: false })
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Could not deactivate category.'); return; }
    setNotice('Category deactivated.');
    await loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {([
          ['campaigns', 'Promotional Campaigns'],
          ['categories', 'Categories & Channels'],
          ['analytics', 'Affiliate Analytics']
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${view === key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
            {label}
          </button>
        ))}
        <button onClick={loadAll} className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white">
          Refresh
        </button>
      </div>

      {notice && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {view === 'campaigns' && <>
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-bold text-slate-900">{editingCampaignId ? 'Edit promotional campaign' : 'Create promotional campaign'}</h2>
            <p className="text-xs text-slate-500 mt-1">Drafts can be prepared early. Approval schedules the latest version for the next 14th or 28th. Sending is limited to active, configured category channels.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-700">Campaign name
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" value={campaignForm.campaignName} onChange={e => setCampaignForm({ ...campaignForm, campaignName: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Product / item name
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" value={campaignForm.productName} onChange={e => setCampaignForm({ ...campaignForm, productName: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700 md:col-span-2">Promotional message
              <textarea rows={4} className="mt-1 w-full border rounded-lg p-2 text-sm" value={campaignForm.messageText} onChange={e => setCampaignForm({ ...campaignForm, messageText: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Product image URL
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" placeholder="https://..." value={campaignForm.imageUrl} onChange={e => setCampaignForm({ ...campaignForm, imageUrl: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Affiliate purchase URL
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" placeholder="https://..." value={campaignForm.affiliateUrl} onChange={e => setCampaignForm({ ...campaignForm, affiliateUrl: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Clickable button text
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" value={campaignForm.linkLabel} onChange={e => setCampaignForm({ ...campaignForm, linkLabel: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Affiliate disclosure
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" value={campaignForm.affiliateDisclosure} onChange={e => setCampaignForm({ ...campaignForm, affiliateDisclosure: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} onClick={saveCampaign} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save draft'}</button>
            <button onClick={() => { setCampaignForm(emptyCampaign); setEditingCampaignId(''); }} className="px-4 py-2.5 rounded-xl border text-sm">Clear form</button>
          </div>
          <p className="text-xs text-slate-500">For now, add an image by providing its hosted HTTPS image URL. Direct image-file uploads require a Cloudflare image-storage binding, which is not yet configured.</p>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b"><h3 className="font-bold">Saved campaigns</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr>
                <th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Scheduled</th><th className="p-3">Delivered</th><th className="p-3">Failed</th><th className="p-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y">
                {campaigns.map(c => <tr key={c.id}>
                  <td className="p-3"><strong>{c.campaign_name}</strong><div className="text-slate-500">{c.product_name}</div></td>
                  <td className="p-3 capitalize">{c.status}</td><td className="p-3">{c.scheduled_for}</td>
                  <td className="p-3">{c.sent_channels || 0}</td><td className="p-3">{c.failed_channels || 0}</td>
                  <td className="p-3 whitespace-nowrap space-x-1">
                    {c.status !== 'sent' && c.status !== 'cancelled' && <>
                      <button onClick={() => editCampaign(c)} className="px-2 py-1 rounded bg-slate-100">Edit</button>
                      <button onClick={() => approveCampaign(c.id)} className="px-2 py-1 rounded bg-emerald-600 text-white">Approve</button>
                      <button onClick={() => deleteCampaign(c.id)} className="px-2 py-1 rounded bg-red-50 text-red-700">Delete</button>
                    </>}
                  </td>
                </tr>)}
                {!campaigns.length && <tr><td className="p-4 text-slate-500" colSpan={6}>No campaigns yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}

      {view === 'categories' && <>
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-bold">{editingCategoryId ? 'Edit category and Telegram channel' : 'Add category and Telegram channel'}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold">Category ID
              <input disabled={!!editingCategoryId} className="mt-1 w-full border rounded-lg p-2 text-sm disabled:bg-slate-100" value={categoryForm.id} onChange={e => setCategoryForm({ ...categoryForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
            </label>
            <label className="text-xs font-semibold">Category title
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" value={categoryForm.title} onChange={e => setCategoryForm({ ...categoryForm, title: e.target.value })} />
            </label>
            <label className="text-xs font-semibold">Telegram channel ID
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" value={categoryForm.telegramChatId} onChange={e => setCategoryForm({ ...categoryForm, telegramChatId: e.target.value })} />
            </label>
            <label className="text-xs font-semibold">Display order
              <input type="number" className="mt-1 w-full border rounded-lg p-2 text-sm" value={categoryForm.displayOrder} onChange={e => setCategoryForm({ ...categoryForm, displayOrder: e.target.value })} />
            </label>
            <label className="text-xs font-semibold md:col-span-2">Description
              <textarea rows={2} className="mt-1 w-full border rounded-lg p-2 text-sm" value={categoryForm.description} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={saving} onClick={saveCategory} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">{saving ? 'Saving...' : 'Save category'}</button>
            <button onClick={() => { setCategoryForm({ id: '', title: '', description: '', telegramChatId: '', displayOrder: '0' }); setEditingCategoryId(''); }} className="px-4 py-2.5 rounded-xl border text-sm">Clear</button>
          </div>
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b"><h3 className="font-bold">Category channels ({categories.filter(c => c.active).length} active)</h3><p className="text-xs text-slate-500 mt-1">All active rows with a Telegram channel ID receive the scheduled promotion. The count is not capped at 15.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Category</th><th className="p-3">Telegram channel</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
            <tbody className="divide-y">{categories.map(c => <tr key={c.id}>
              <td className="p-3"><strong>{c.title}</strong><div className="text-slate-500">{c.id}</div></td>
              <td className="p-3 font-mono">{c.telegramChatId}</td><td className="p-3">{c.active ? 'Active' : 'Inactive'}</td>
              <td className="p-3 whitespace-nowrap"><button onClick={() => editCategory(c)} className="px-2 py-1 rounded bg-slate-100 mr-1">Edit</button>{c.active ? <button onClick={() => deactivateCategory(c)} className="px-2 py-1 rounded bg-amber-50 text-amber-700 mr-1">Deactivate</button> : null}<button onClick={() => deleteCategory(c)} className="px-2 py-1 rounded bg-red-50 text-red-700">Delete</button></td>
            </tr>)}</tbody>
          </table></div>
        </section>
      </>}

      {view === 'analytics' && <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b"><h2 className="font-bold">Affiliate performance</h2><p className="text-xs text-slate-500 mt-1">Click counts are recorded by MyDigitAsset. Purchases and commissions appear only when reported by the affiliate network or merchant.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Product</th><th className="p-3">Source</th><th className="p-3">Source ID</th><th className="p-3">Clicks</th><th className="p-3">Reported purchases</th><th className="p-3">Order amount</th><th className="p-3">Commission</th></tr></thead>
          <tbody className="divide-y">{analytics.map((a, i) => <tr key={i}>
            <td className="p-3">{a.product_name}</td><td className="p-3">{a.source_type}</td><td className="p-3">{a.source_id}</td><td className="p-3">{a.clicks}</td><td className="p-3">{a.reported_purchases}</td><td className="p-3">₹{Number(a.reported_order_amount || 0).toFixed(2)}</td><td className="p-3">₹{Number(a.reported_commission || 0).toFixed(2)}</td>
          </tr>)}
          {!analytics.length && <tr><td colSpan={7} className="p-4 text-slate-500">No affiliate clicks or conversion reports yet.</td></tr>}</tbody>
        </table></div>
      </section>}
    </div>
  );
};
