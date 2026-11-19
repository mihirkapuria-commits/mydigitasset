import React, { useEffect, useState } from 'react';

type Category = {
  id: string; title: string; description: string; telegramChatId: string;
  active: number; displayOrder: number;
};
type Campaign = {
  id: string; campaign_name: string; product_name: string; message_text: string;
  image_url: string; affiliate_url: string; tracking_parameter: string; link_label: string;
  affiliate_disclosure: string; status: string; scheduled_for: string;
  sent_channels: number; failed_channels: number; target_channel_ids?: string;
};
type ConversionRow = { id: string; networkName: string; orderReference: string; orderAmount: number; commissionAmount: number; currency: string; status: string; purchasedAt?: string; reportedAt: string; productName: string; sourceType: string; sourceId: string; sourceName: string; campaignName: string; };
type DeliveryRow = { channelName: string; channelId: string; status: string; telegramMessageId?: string; trackingCode?: string; errorMessage?: string; attempts: number; deliveredAt?: string; };
type AnalyticsRow = {
  tracking_code: string; campaign_id: string; campaign_name: string; product_name: string; source_type: string;
  source_id: string; source_name: string; clicks: number; last_clicked_at?: string; last_purchase_at?: string; reported_order_amount: number;
  reported_commission: number; reported_purchases: number;
};

interface Props { token: string; }

const emptyCampaign = {
  campaignName: '', productName: '', messageText: '', imageUrl: '',
  affiliateUrl: '', trackingParameter: 'subid', linkLabel: 'View Offer',
  affiliateDisclosure: 'We may earn a commission from qualifying purchases.'
};

export const AdminCampaignManager: React.FC<Props> = ({ token }) => {
  const [view, setView] = useState<'campaigns' | 'categories' | 'analytics'>('campaigns');
  const [categories, setCategories] = useState<Category[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [conversionReports, setConversionReports] = useState<ConversionRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [deliveryCampaignName, setDeliveryCampaignName] = useState('');
  const [deliveryCampaignId, setDeliveryCampaignId] = useState('');
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [testMode, setTestMode] = useState(true);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [editingCampaignId, setEditingCampaignId] = useState('');
  const [categoryForm, setCategoryForm] = useState({
    id: '', title: '', description: '', telegramChatId: '', displayOrder: '0'
  });
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [conversionForm, setConversionForm] = useState({ trackingCode: '', networkName: '', orderReference: '', orderAmount: '', commissionAmount: '', purchasedAt: '', currency: 'INR' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const uploadCampaignImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUploading(true); setError(''); setNotice('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/admin/promotions/upload-image', {
        method: 'POST', headers, body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Image upload failed.');
      setCampaignForm(current => ({ ...current, imageUrl: data.imageUrl }));
      setNotice('Image uploaded and attached to this campaign.');
    } catch (e: any) {
      setError(e.message || 'Image upload failed.');
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  };


  const loadAll = async () => {
    setLoading(true); setError('');
    try {
      const [catRes, campaignRes, analyticsRes, conversionsRes] = await Promise.all([
        fetch('/api/admin/categories', { headers }),
        fetch('/api/admin/promotions', { headers }),
        fetch('/api/admin/affiliate/analytics', { headers }),
        fetch('/api/admin/affiliate/conversions', { headers })
      ]);
      const catData = await catRes.json();
      const campaignData = await campaignRes.json();
      const analyticsData = await analyticsRes.json();
      const conversionsData = await conversionsRes.json();
      if (!catRes.ok || !campaignRes.ok || !analyticsRes.ok || !conversionsRes.ok) {
        throw new Error(catData.error || campaignData.error || analyticsData.error || conversionsData.error || 'Unable to load campaign administration data.');
      }
      setCategories(catData);
      setSelectedChannelIds(current => current.length ? current.filter(id => catData.some((c: Category) => c.id === id && c.active)) : catData.filter((c: Category) => c.active).map((c: Category) => c.id));
      setCampaigns(campaignData);
      setAnalytics(analyticsData);
      setConversionReports(conversionsData);
    } catch (e: any) {
      setError(e.message || 'Unable to load data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [token]);

  const submitConversion = async () => {
    setError(''); setNotice('');
    const response = await fetch('/api/admin/affiliate/conversions', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...conversionForm, orderAmount: Number(conversionForm.orderAmount), commissionAmount: Number(conversionForm.commissionAmount) })
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Could not save purchase report.'); return; }
    setConversionForm({ trackingCode: '', networkName: '', orderReference: '', orderAmount: '', commissionAmount: '', purchasedAt: '', currency: 'INR' });
    setNotice('Purchase report saved.');
    await loadAll();
  };

  const saveCampaign = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const url = editingCampaignId
        ? `/api/admin/promotions/${encodeURIComponent(editingCampaignId)}`
        : '/api/admin/promotions';
      const response = await fetch(url, {
        method: editingCampaignId ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campaignForm,
          messageText: testMode
            ? (campaignForm.messageText.startsWith('🧪 TEST ADVERTISEMENT') ? campaignForm.messageText : '🧪 TEST ADVERTISEMENT\n\n' + campaignForm.messageText)
            : campaignForm.messageText.replace(/^🧪 TEST ADVERTISEMENT\n\n/, ''),
          targetChannelIds: selectedChannelIds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save campaign.');
      setCampaignForm(emptyCampaign); setEditingCampaignId('');
      setTestMode(true);
      setNotice(testMode ? 'TEST advertisement draft saved. The test label will appear in Telegram.' : 'Campaign draft saved.');
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const viewDeliveries = async (campaign: Campaign) => {
    setError(''); setDeliveryCampaignName(campaign.campaign_name); setDeliveryCampaignId(campaign.id);
    try {
      const response = await fetch(`/api/admin/promotions/${encodeURIComponent(campaign.id)}/deliveries`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load delivery report.');
      setDeliveries(data);
    } catch (e: any) { setError(e.message); }
  };

  const approveCampaign = async (id: string) => {
    if (!window.confirm('Schedule this advertisement for the next fixed 14th or 28th date at 06:15 IST? It will be sent only to the channels selected for this campaign, as a separate message after that day’s news delivery.')) return;
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/promotions/${encodeURIComponent(id)}/approve`, {
        method: 'POST', headers
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not approve campaign.');
      setNotice(`Scheduled for ${data.scheduledFor} at 06:15 IST. The advertisement will be a separate message after the news delivery.`);
      await loadAll();
    } catch (e: any) { setError(e.message); }
  };

  const sendCampaignNow = async (campaign: Campaign) => {
    const selectedCount = (() => { try { return JSON.parse(campaign.target_channel_ids || '[]').length || categories.filter(c => c.active).length; } catch { return categories.filter(c => c.active).length; } })();
    if (!window.confirm(`Send this advertisement now to ${selectedCount} selected channel(s)? This sends a separate Telegram message and cannot be recalled.`)) return;
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/promotions/${encodeURIComponent(campaign.id)}/send-now`, { method: 'POST', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send advertisement.');
      setNotice(`Advertisement send attempt finished: ${data.sent} sent, ${data.failed} failed.`);
      await viewDeliveries(campaign);
      await loadAll();
    } catch (e: any) { setError(e.message || 'Could not send advertisement.'); }
  };

  const editCampaign = (c: Campaign) => {
    setSelectedChannelIds((() => { try { const ids = JSON.parse(c.target_channel_ids || '[]'); return ids.length ? ids : categories.filter(x => x.active).map(x => x.id); } catch { return categories.filter(x => x.active).map(x => x.id); } })());
    setEditingCampaignId(c.id);
    const isTestCampaign = String(c.message_text || '').startsWith('🧪 TEST ADVERTISEMENT');
    setTestMode(isTestCampaign);
    setCampaignForm({
      campaignName: c.campaign_name || '', productName: c.product_name || '',
      messageText: isTestCampaign ? String(c.message_text || '').replace(/^🧪 TEST ADVERTISEMENT\n\n/, '') : (c.message_text || ''), imageUrl: c.image_url || '',
      affiliateUrl: c.affiliate_url || '', trackingParameter: c.tracking_parameter || 'subid', linkLabel: c.link_label || 'View Offer',
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
            <p className="text-xs text-slate-500 mt-1">Choose the channels for this campaign. Scheduling is restricted to the 14th and 28th at 06:15 IST. On those dates, the advertisement is sent as a separate message after that channel’s daily news delivery.</p>
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
            <label className="text-xs font-semibold text-slate-700">Upload product image (JPG, PNG or WebP; max 5 MB)
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageUploading} onChange={uploadCampaignImage} className="mt-1 block w-full border rounded-lg p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5" />
              {imageUploading && <span className="block mt-1 text-[11px] text-slate-500">Uploading image...</span>}
            </label>
            <label className="text-xs font-semibold text-slate-700">Or use an existing product image URL
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" placeholder="https://..." value={campaignForm.imageUrl} onChange={e => setCampaignForm({ ...campaignForm, imageUrl: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Affiliate purchase URL
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" placeholder="https://..." value={campaignForm.affiliateUrl} onChange={e => setCampaignForm({ ...campaignForm, affiliateUrl: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Affiliate tracking parameter
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" placeholder="subid" value={campaignForm.trackingParameter} onChange={e => setCampaignForm({ ...campaignForm, trackingParameter: e.target.value })} /><span className="text-[11px] text-slate-500">Use the click-ID parameter supported by the affiliate network (for example, subid or click_id).</span>
            </label>
            <label className="text-xs font-semibold text-slate-700">Clickable button text
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" value={campaignForm.linkLabel} onChange={e => setCampaignForm({ ...campaignForm, linkLabel: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Affiliate disclosure
              <input className="mt-1 w-full border rounded-lg p-2 text-sm" value={campaignForm.affiliateDisclosure} onChange={e => setCampaignForm({ ...campaignForm, affiliateDisclosure: e.target.value })} />
            </label>
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)} className="mt-0.5" />
            <span><strong>TEST advertisement mode</strong><span className="block">Recommended for the first live channel test. Adds a clear TEST label to the Telegram message. Turn this off only for a real advertisement.</span></span>
          </label>
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-sm font-bold">Target Telegram channels</h3><p className="text-xs text-slate-500">Select one or more active channels. All 15 are selected by default.</p></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelectedChannelIds(categories.filter(c => c.active).map(c => c.id))} className="px-3 py-1.5 rounded-lg border text-xs">Select all</button>
                <button type="button" onClick={() => setSelectedChannelIds([])} className="px-3 py-1.5 rounded-lg border text-xs">Clear</button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {categories.filter(c => c.active).map(c => <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs">
                <input type="checkbox" checked={selectedChannelIds.includes(c.id)} onChange={e => setSelectedChannelIds(current => e.target.checked ? [...current, c.id] : current.filter(id => id !== c.id))} />
                <span>{c.title}</span>
              </label>)}
            </div>
            {!selectedChannelIds.length && <p className="text-xs text-red-600">Select at least one channel before saving.</p>}
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Telegram message preview</h3>
            <div className="max-w-md bg-white rounded-xl border p-3 space-y-3">
              {campaignForm.imageUrl && <img src={campaignForm.imageUrl} alt="Product preview" className="w-full max-h-56 object-cover rounded-lg" />}
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{campaignForm.messageText || 'Your promotional message will appear here.'}</p>
              {campaignForm.affiliateUrl && <div className="text-center rounded-lg bg-sky-50 border border-sky-100 p-2 text-sm font-semibold text-sky-800">{campaignForm.linkLabel || 'View Offer'} ↗</div>}
              {campaignForm.affiliateDisclosure && <p className="text-[10px] text-slate-500">{campaignForm.affiliateDisclosure}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} onClick={saveCampaign} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save draft'}</button>
            <button onClick={() => { setCampaignForm(emptyCampaign); setEditingCampaignId(''); }} className="px-4 py-2.5 rounded-xl border text-sm">Clear form</button>
          </div>
          <p className="text-xs text-slate-500">Uploaded images are stored in Cloudflare R2. Telegram displays the affiliate purchase button below the photo; Telegram does not make the photo itself a direct external hyperlink.</p>
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
                      <button onClick={() => approveCampaign(c.id)} className="px-2 py-1 rounded bg-emerald-600 text-white">{c.status === 'approved' ? 'Retry / Reschedule' : 'Schedule Advertisement'}</button>
                      <button onClick={() => deleteCampaign(c.id)} className="px-2 py-1 rounded bg-red-50 text-red-700">Delete</button>
                    </>}
                    {(c.status !== 'sent' || c.failed_channels > 0) && <button onClick={() => sendCampaignNow(c)} className="px-2 py-1 rounded bg-sky-700 text-white">Send Advertisement Now</button>}
                    <button onClick={() => viewDeliveries(c)} className="px-2 py-1 rounded bg-indigo-50 text-indigo-700">Delivery report</button>
                  </td>
                </tr>)}
                {!campaigns.length && <tr><td className="p-4 text-slate-500" colSpan={6}>No campaigns yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        {deliveryCampaignId && <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center"><div><h3 className="font-bold text-sm">Delivery report: {deliveryCampaignName}</h3><p className="text-xs text-slate-500">Each active channel is listed separately.</p></div><button onClick={() => { setDeliveryCampaignId(''); setDeliveries([]); }} className="text-xs text-indigo-700">Close</button></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-3">Channel</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Tracking code</th><th className="p-3">Delivered at</th><th className="p-3">Error</th></tr></thead><tbody className="divide-y">{deliveries.map((d,i) => <tr key={i}><td className="p-3">{d.channelName}<div className="font-mono text-slate-400">{d.channelId}</div></td><td className="p-3 capitalize">{d.status}</td><td className="p-3">{d.attempts}</td><td className="p-3 font-mono">{d.trackingCode || '—'}</td><td className="p-3">{d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : '—'}</td><td className="p-3 text-red-600">{d.errorMessage || '—'}</td></tr>)}{!deliveries.length && <tr><td colSpan={6} className="p-4 text-slate-500">No delivery attempts yet. The campaign is waiting for its scheduled date.</td></tr>}</tbody></table></div>
        </section>}
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

      {view === 'analytics' && <>
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-bold">Record a reported purchase</h2>
          <p className="text-xs text-slate-500">Enter amounts only when an affiliate network or merchant has reported the order. The tracking code is used to connect the purchase to its campaign and channel.</p>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-xs font-semibold">Tracking code<input className="mt-1 w-full border rounded-lg p-2 text-xs" value={conversionForm.trackingCode} onChange={e => setConversionForm({ ...conversionForm, trackingCode: e.target.value })} /></label>
            <label className="text-xs font-semibold">Network / merchant<input className="mt-1 w-full border rounded-lg p-2 text-xs" value={conversionForm.networkName} onChange={e => setConversionForm({ ...conversionForm, networkName: e.target.value })} /></label>
            <label className="text-xs font-semibold">Order reference<input className="mt-1 w-full border rounded-lg p-2 text-xs" value={conversionForm.orderReference} onChange={e => setConversionForm({ ...conversionForm, orderReference: e.target.value })} /></label>
            <label className="text-xs font-semibold">Order amount<input type="number" min="0" className="mt-1 w-full border rounded-lg p-2 text-xs" value={conversionForm.orderAmount} onChange={e => setConversionForm({ ...conversionForm, orderAmount: e.target.value })} /></label>
            <label className="text-xs font-semibold">Commission earned<input type="number" min="0" className="mt-1 w-full border rounded-lg p-2 text-xs" value={conversionForm.commissionAmount} onChange={e => setConversionForm({ ...conversionForm, commissionAmount: e.target.value })} /></label>
            <label className="text-xs font-semibold">Currency<input className="mt-1 w-full border rounded-lg p-2 text-xs" value={conversionForm.currency} onChange={e => setConversionForm({ ...conversionForm, currency: e.target.value.toUpperCase() })} /></label>
            <label className="text-xs font-semibold">Purchase date & time (optional)<input type="datetime-local" className="mt-1 w-full border rounded-lg p-2 text-xs" value={conversionForm.purchasedAt} onChange={e => setConversionForm({ ...conversionForm, purchasedAt: e.target.value })} /></label>
          </div>
          <button onClick={submitConversion} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold">Save purchase report</button>
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b"><h2 className="font-bold">Affiliate performance</h2><p className="text-xs text-slate-500 mt-1">Click counts are recorded by MyDigitAsset. Purchases and commissions appear only when reported by the affiliate network or merchant.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Campaign</th><th className="p-3">Product</th><th className="p-3">Tracking code</th><th className="p-3">Source channel</th><th className="p-3">Clicks</th><th className="p-3">Last click</th><th className="p-3">Reported purchases</th><th className="p-3">Order amount</th><th className="p-3">Commission</th><th className="p-3">Last purchase report</th></tr></thead>
          <tbody className="divide-y">{analytics.map((a, i) => <tr key={i}>
            <td className="p-3">{a.campaign_name || a.campaign_id}</td><td className="p-3">{a.product_name}</td><td className="p-3 font-mono">{a.tracking_code}</td><td className="p-3">{a.source_name || a.source_id}</td><td className="p-3">{a.clicks}</td><td className="p-3">{a.last_clicked_at ? new Date(a.last_clicked_at).toLocaleString() : '—'}</td><td className="p-3">{a.reported_purchases}</td><td className="p-3">₹{Number(a.reported_order_amount || 0).toFixed(2)}</td><td className="p-3">₹{Number(a.reported_commission || 0).toFixed(2)}</td><td className="p-3">{a.last_purchase_at ? new Date(a.last_purchase_at).toLocaleString() : '—'}</td>
          </tr>)}
          {!analytics.length && <tr><td colSpan={10} className="p-4 text-slate-500">No affiliate clicks or conversion reports yet.</td></tr>}</tbody>
        </table></div>
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b"><h2 className="font-bold">Individual purchase reports</h2><p className="text-xs text-slate-500 mt-1">Each row represents a purchase reported by an affiliate network or entered by the admin.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-3">Purchase / report time</th><th className="p-3">Campaign / item</th><th className="p-3">Source channel</th><th className="p-3">Order reference</th><th className="p-3">Network</th><th className="p-3">Order amount</th><th className="p-3">Commission</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y">{conversionReports.map(v => <tr key={v.id}><td className="p-3">{new Date(v.purchasedAt || v.reportedAt).toLocaleString()}</td><td className="p-3">{v.campaignName || '—'}<div className="text-slate-500">{v.productName || '—'}</div></td><td className="p-3">{v.sourceName || v.sourceId || '—'}</td><td className="p-3">{v.orderReference || '—'}</td><td className="p-3">{v.networkName || 'Manual'}</td><td className="p-3">{v.currency} {Number(v.orderAmount || 0).toFixed(2)}</td><td className="p-3">{v.currency} {Number(v.commissionAmount || 0).toFixed(2)}</td><td className="p-3 capitalize">{v.status}</td></tr>)}{!conversionReports.length && <tr><td colSpan={8} className="p-4 text-slate-500">No purchase reports recorded yet.</td></tr>}</tbody></table></div>
        </section>
      </>}
    </div>
  );
};
