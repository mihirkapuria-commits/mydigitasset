import React, { useEffect, useState } from 'react';

type ContentItem = {
  id: string; section_key: string; title: string; summary: string; body: string;
  image_url: string; target_url: string; status: string; display_order: number;
};
type BlogItem = {
  id: string; title: string; slug: string; excerpt: string; body: string;
  featured_image_url: string; seo_title: string; seo_description: string; status: string;
};
type ToolItem = {
  id: string; title: string; description: string; target_url: string;
  icon_name: string; status: string; display_order: number;
};
type AdSlot = {
  placement_key: string; display_name: string; enabled: number;
  client_id: string; slot_id: string;
};

interface Props { token: string; }

const sections = [
  ['offers', 'Offers'],
  ['utilities', 'Utilities'],
  ['how-it-works', 'How It Works'],
  ['faq', 'FAQ']
] as const;

const blankContent = {
  title: '', summary: '', body: '', imageUrl: '', targetUrl: '',
  status: 'draft', displayOrder: '0'
};
const blankBlog = {
  title: '', slug: '', excerpt: '', body: '', featuredImageUrl: '',
  seoTitle: '', seoDescription: '', status: 'draft'
};
const blankTool = {
  title: '', description: '', targetUrl: '', iconName: '',
  status: 'draft', displayOrder: '0'
};

export const AdminSiteManager: React.FC<Props> = ({ token }) => {
  const [view, setView] = useState<'content' | 'blog' | 'tools' | 'adsense'>('content');
  const [section, setSection] = useState<string>('offers');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [newSlot, setNewSlot] = useState({ placementKey: '', displayName: '', clientId: '', slotId: '' });
  const [contentForm, setContentForm] = useState(blankContent);
  const [blogForm, setBlogForm] = useState(blankBlog);
  const [toolForm, setToolForm] = useState(blankTool);
  const [editingId, setEditingId] = useState('');
  const [editingBlogId, setEditingBlogId] = useState('');
  const [editingToolId, setEditingToolId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const loadContent = async (which = section) => {
    const r = await fetch(`/api/admin/site-content?section=${encodeURIComponent(which)}`, { headers });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Could not load section content.');
    setContentItems(d);
  };
  const loadAll = async () => {
    setError('');
    try {
      const [b, t, a] = await Promise.all([
        fetch('/api/admin/blog', { headers }),
        fetch('/api/admin/tools', { headers }),
        fetch('/api/admin/adsense', { headers })
      ]);
      const [bd, td, ad] = await Promise.all([b.json(), t.json(), a.json()]);
      if (!b.ok || !t.ok || !a.ok) throw new Error(bd.error || td.error || ad.error || 'Could not load website settings.');
      setBlogs(bd); setTools(td); setSlots(ad);
      await loadContent();
    } catch (e: any) { setError(e.message || 'Unable to load website content.'); }
  };
  useEffect(() => { loadAll(); }, [token]);

  const changeSection = async (value: string) => {
    setSection(value); setEditingId(''); setContentForm(blankContent);
    try { await loadContent(value); } catch (e: any) { setError(e.message); }
  };

  const saveContent = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const url = editingId ? `/api/admin/site-content/${encodeURIComponent(editingId)}` : '/api/admin/site-content';
      const r = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contentForm, section, displayOrder: Number(contentForm.displayOrder || 0) })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not save content.');
      setContentForm(blankContent); setEditingId(''); setNotice('Website content saved.');
      await loadContent();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const editContent = (x: ContentItem) => {
    setEditingId(x.id);
    setContentForm({
      title: x.title, summary: x.summary || '', body: x.body || '',
      imageUrl: x.image_url || '', targetUrl: x.target_url || '',
      status: x.status, displayOrder: String(x.display_order || 0)
    });
  };
  const deleteContent = async (id: string) => {
    if (!window.confirm('Delete this website content item?')) return;
    const r = await fetch(`/api/admin/site-content/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    const d = await r.json();
    if (!r.ok) { setError(d.error || 'Delete failed.'); return; }
    setNotice('Content item deleted.'); await loadContent();
  };

  const saveBlog = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const url = editingBlogId ? `/api/admin/blog/${encodeURIComponent(editingBlogId)}` : '/api/admin/blog';
      const r = await fetch(url, {
        method: editingBlogId ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(blogForm)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not save article.');
      setBlogForm(blankBlog); setEditingBlogId(''); setNotice('Blog article saved.');
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const editBlog = (x: BlogItem) => {
    setEditingBlogId(x.id);
    setBlogForm({
      title: x.title, slug: x.slug, excerpt: x.excerpt || '', body: x.body || '',
      featuredImageUrl: x.featured_image_url || '', seoTitle: x.seo_title || '',
      seoDescription: x.seo_description || '', status: x.status
    });
  };
  const deleteBlog = async (id: string) => {
    if (!window.confirm('Permanently delete this article?')) return;
    const r = await fetch(`/api/admin/blog/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    const d = await r.json();
    if (!r.ok) { setError(d.error || 'Delete failed.'); return; }
    setNotice('Article deleted.'); await loadAll();
  };

  const saveTool = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const url = editingToolId ? `/api/admin/tools/${encodeURIComponent(editingToolId)}` : '/api/admin/tools';
      const r = await fetch(url, {
        method: editingToolId ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...toolForm, displayOrder: Number(toolForm.displayOrder || 0) })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not save tool.');
      setToolForm(blankTool); setEditingToolId(''); setNotice('Tool saved.');
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const editTool = (x: ToolItem) => {
    setEditingToolId(x.id);
    setToolForm({
      title: x.title, description: x.description || '', targetUrl: x.target_url || '',
      iconName: x.icon_name || '', status: x.status, displayOrder: String(x.display_order || 0)
    });
  };
  const deleteTool = async (id: string) => {
    if (!window.confirm('Delete this tool?')) return;
    const r = await fetch(`/api/admin/tools/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    const d = await r.json();
    if (!r.ok) { setError(d.error || 'Delete failed.'); return; }
    setNotice('Tool deleted.'); await loadAll();
  };

  const addAdsenseSlot = async () => {
    setError(''); setNotice('');
    const r = await fetch('/api/admin/adsense', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(newSlot)
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error || 'Could not add AdSense placement.'); return; }
    setNewSlot({ placementKey: '', displayName: '', clientId: '', slotId: '' });
    setNotice('AdSense placement added.');
    await loadAll();
  };

  const deleteAdsenseSlot = async (key: string) => {
    if (!window.confirm('Delete this AdSense placement?')) return;
    const r = await fetch(`/api/admin/adsense/${encodeURIComponent(key)}`, { method: 'DELETE', headers });
    const d = await r.json();
    if (!r.ok) { setError(d.error || 'Could not delete placement.'); return; }
    setNotice('AdSense placement deleted.');
    await loadAll();
  };

  const saveAdsense = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await fetch('/api/admin/adsense', {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: slots.map(slot => ({ placementKey: slot.placement_key, enabled: Boolean(slot.enabled), clientId: slot.client_id, slotId: slot.slot_id })) })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not save AdSense settings.');
      setNotice('AdSense settings saved. Ads will display only after Google approves and serves them.');
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const tabs = [
    ['content', 'Offers / Utilities / How It Works / FAQ'],
    ['blog', 'Blog Articles'],
    ['tools', 'Tools'],
    ['adsense', 'AdSense Spaces']
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => <button key={key} onClick={() => setView(key)}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border ${view === key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>{label}</button>)}
        <button onClick={loadAll} className="ml-auto px-4 py-2 rounded-xl border bg-white text-xs font-semibold">Refresh</button>
      </div>
      {notice && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{notice}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {view === 'content' && <>
        <section className="bg-white border rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold">Manage website sections</h2><p className="text-xs text-slate-500">Add, edit, publish, hide or delete items in each section.</p></div>
            <select className="border rounded-lg p-2 text-sm" value={section} onChange={e => changeSection(e.target.value)}>
              {sections.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold">Title<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={contentForm.title} onChange={e => setContentForm({ ...contentForm, title: e.target.value })} /></label>
            <label className="text-xs font-semibold">Short summary / question<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={contentForm.summary} onChange={e => setContentForm({ ...contentForm, summary: e.target.value })} /></label>
            <label className="text-xs font-semibold md:col-span-2">Full text / answer<textarea rows={5} className="mt-1 w-full border rounded-lg p-2 text-sm" value={contentForm.body} onChange={e => setContentForm({ ...contentForm, body: e.target.value })} /></label>
            <label className="text-xs font-semibold">Image URL<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={contentForm.imageUrl} onChange={e => setContentForm({ ...contentForm, imageUrl: e.target.value })} /></label>
            <label className="text-xs font-semibold">Link URL<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={contentForm.targetUrl} onChange={e => setContentForm({ ...contentForm, targetUrl: e.target.value })} /></label>
            <label className="text-xs font-semibold">Status<select className="mt-1 w-full border rounded-lg p-2 text-sm" value={contentForm.status} onChange={e => setContentForm({ ...contentForm, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="hidden">Hidden</option></select></label>
            <label className="text-xs font-semibold">Display order<input type="number" className="mt-1 w-full border rounded-lg p-2 text-sm" value={contentForm.displayOrder} onChange={e => setContentForm({ ...contentForm, displayOrder: e.target.value })} /></label>
          </div>
          <div className="flex gap-2"><button disabled={busy} onClick={saveContent} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">{busy ? 'Saving...' : editingId ? 'Update item' : 'Add item'}</button><button onClick={() => { setContentForm(blankContent); setEditingId(''); }} className="px-4 py-2 rounded-lg border text-sm">Clear</button></div>
        </section>
        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="p-4 border-b font-bold text-sm">{sections.find(x => x[0] === section)?.[1]} items</div>
          <div className="divide-y">{contentItems.map(x => <div key={x.id} className="p-4 flex flex-wrap justify-between gap-3"><div><strong className="text-sm">{x.title}</strong><p className="text-xs text-slate-500">{x.summary}</p><span className="text-[11px] text-slate-400">Status: {x.status}</span></div><div className="flex gap-2"><button onClick={() => editContent(x)} className="px-3 py-1 rounded bg-slate-100 text-xs">Edit</button><button onClick={() => deleteContent(x.id)} className="px-3 py-1 rounded bg-red-50 text-red-700 text-xs">Delete</button></div></div>)}{!contentItems.length && <p className="p-4 text-xs text-slate-500">No managed items in this section yet.</p>}</div>
        </section>
      </>}

      {view === 'blog' && <>
        <section className="bg-white border rounded-2xl p-5 space-y-4">
          <h2 className="font-bold">{editingBlogId ? 'Edit blog article' : 'Create blog article'}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold">Article title<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={blogForm.title} onChange={e => setBlogForm({ ...blogForm, title: e.target.value })} /></label>
            <label className="text-xs font-semibold">URL slug<input className="mt-1 w-full border rounded-lg p-2 text-sm" placeholder="my-article-title" value={blogForm.slug} onChange={e => setBlogForm({ ...blogForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></label>
            <label className="text-xs font-semibold md:col-span-2">Short excerpt<textarea rows={2} className="mt-1 w-full border rounded-lg p-2 text-sm" value={blogForm.excerpt} onChange={e => setBlogForm({ ...blogForm, excerpt: e.target.value })} /></label>
            <label className="text-xs font-semibold md:col-span-2">Article body<textarea rows={10} className="mt-1 w-full border rounded-lg p-2 text-sm" value={blogForm.body} onChange={e => setBlogForm({ ...blogForm, body: e.target.value })} /></label>
            <label className="text-xs font-semibold">Featured image URL<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={blogForm.featuredImageUrl} onChange={e => setBlogForm({ ...blogForm, featuredImageUrl: e.target.value })} /></label>
            <label className="text-xs font-semibold">SEO title<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={blogForm.seoTitle} onChange={e => setBlogForm({ ...blogForm, seoTitle: e.target.value })} /></label>
            <label className="text-xs font-semibold md:col-span-2">SEO description<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={blogForm.seoDescription} onChange={e => setBlogForm({ ...blogForm, seoDescription: e.target.value })} /></label>
            <label className="text-xs font-semibold">Publishing status<select className="mt-1 w-full border rounded-lg p-2 text-sm" value={blogForm.status} onChange={e => setBlogForm({ ...blogForm, status: e.target.value })}><option value="draft">Draft</option><option value="published">Publish</option><option value="unpublished">Unpublish</option></select></label>
          </div>
          <div className="flex gap-2"><button disabled={busy} onClick={saveBlog} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">{busy ? 'Saving...' : editingBlogId ? 'Update article' : 'Save article'}</button><button onClick={() => { setBlogForm(blankBlog); setEditingBlogId(''); }} className="px-4 py-2 rounded-lg border text-sm">Clear</button></div>
        </section>
        <section className="bg-white border rounded-2xl overflow-hidden"><div className="p-4 border-b font-bold text-sm">All articles</div><div className="divide-y">{blogs.map(x => <div key={x.id} className="p-4 flex flex-wrap justify-between gap-3"><div><strong className="text-sm">{x.title}</strong><p className="text-xs text-slate-500">/{x.slug} · {x.status}</p></div><div className="flex gap-2"><button onClick={() => editBlog(x)} className="px-3 py-1 rounded bg-slate-100 text-xs">Edit</button><button onClick={() => deleteBlog(x.id)} className="px-3 py-1 rounded bg-red-50 text-red-700 text-xs">Delete</button></div></div>)}{!blogs.length && <p className="p-4 text-xs text-slate-500">No articles yet.</p>}</div></section>
      </>}

      {view === 'tools' && <>
        <section className="bg-white border rounded-2xl p-5 space-y-4">
          <h2 className="font-bold">{editingToolId ? 'Edit tool' : 'Add a tool'}</h2><p className="text-xs text-slate-500">Use icon name <strong>gst-calculator</strong> or <strong>compound-calculator</strong> for the built-in interactive calculators. Other icon names create ordinary link-based tools. You can edit or delete the built-in calculators here too.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold">Tool name<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={toolForm.title} onChange={e => setToolForm({ ...toolForm, title: e.target.value })} /></label>
            <label className="text-xs font-semibold">Icon name<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={toolForm.iconName} onChange={e => setToolForm({ ...toolForm, iconName: e.target.value })} /></label>
            <label className="text-xs font-semibold md:col-span-2">Description<textarea rows={2} className="mt-1 w-full border rounded-lg p-2 text-sm" value={toolForm.description} onChange={e => setToolForm({ ...toolForm, description: e.target.value })} /></label>
            <label className="text-xs font-semibold">Tool URL<input className="mt-1 w-full border rounded-lg p-2 text-sm" value={toolForm.targetUrl} onChange={e => setToolForm({ ...toolForm, targetUrl: e.target.value })} /></label>
            <label className="text-xs font-semibold">Status<select className="mt-1 w-full border rounded-lg p-2 text-sm" value={toolForm.status} onChange={e => setToolForm({ ...toolForm, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="hidden">Hidden</option></select></label>
            <label className="text-xs font-semibold">Display order<input type="number" className="mt-1 w-full border rounded-lg p-2 text-sm" value={toolForm.displayOrder} onChange={e => setToolForm({ ...toolForm, displayOrder: e.target.value })} /></label>
          </div>
          <div className="flex gap-2"><button disabled={busy} onClick={saveTool} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">{busy ? 'Saving...' : editingToolId ? 'Update tool' : 'Add tool'}</button><button onClick={() => { setToolForm(blankTool); setEditingToolId(''); }} className="px-4 py-2 rounded-lg border text-sm">Clear</button></div>
        </section>
        <section className="bg-white border rounded-2xl overflow-hidden"><div className="p-4 border-b font-bold text-sm">Tools</div><div className="divide-y">{tools.map(x => <div key={x.id} className="p-4 flex flex-wrap justify-between gap-3"><div><strong className="text-sm">{x.title}</strong><p className="text-xs text-slate-500">{x.description} · {x.status}</p></div><div className="flex gap-2"><button onClick={() => editTool(x)} className="px-3 py-1 rounded bg-slate-100 text-xs">Edit</button><button onClick={() => deleteTool(x.id)} className="px-3 py-1 rounded bg-red-50 text-red-700 text-xs">Delete</button></div></div>)}{!tools.length && <p className="p-4 text-xs text-slate-500">No custom tools yet.</p>}</div></section>
      </>}

      {view === 'adsense' && <>
        <section className="bg-white border rounded-2xl p-5 space-y-4">
          <div><h2 className="font-bold">Google AdSense placements</h2><p className="text-xs text-slate-500 mt-1">Enter the AdSense client and ad-unit slot IDs. Ad serving remains subject to Google account approval and policy.</p></div>
          <div className="grid md:grid-cols-5 gap-2 p-3 rounded-xl bg-slate-50 border">
            <input className="border rounded-lg p-2 text-xs" placeholder="placement-key" value={newSlot.placementKey} onChange={e => setNewSlot({ ...newSlot, placementKey: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
            <input className="border rounded-lg p-2 text-xs" placeholder="Display name" value={newSlot.displayName} onChange={e => setNewSlot({ ...newSlot, displayName: e.target.value })} />
            <input className="border rounded-lg p-2 text-xs" placeholder="Publisher client ID" value={newSlot.clientId} onChange={e => setNewSlot({ ...newSlot, clientId: e.target.value })} />
            <input className="border rounded-lg p-2 text-xs" placeholder="Ad slot ID" value={newSlot.slotId} onChange={e => setNewSlot({ ...newSlot, slotId: e.target.value })} />
            <button onClick={addAdsenseSlot} className="rounded-lg bg-slate-900 text-white text-xs font-semibold px-3 py-2">Add placement</button>
          </div>
          {slots.map((slot, index) => <div key={slot.placement_key} className="grid md:grid-cols-5 gap-3 items-end border-b pb-4">
            <div><p className="text-sm font-semibold">{slot.display_name}</p><p className="text-[11px] text-slate-500">{slot.placement_key}</p></div>
            <label className="text-xs font-semibold">Publisher client<input className="mt-1 w-full border rounded-lg p-2 text-xs" value={slot.client_id || ''} onChange={e => setSlots(slots.map((s,i) => i === index ? { ...s, client_id: e.target.value } : s))} /></label>
            <label className="text-xs font-semibold">Ad slot ID<input className="mt-1 w-full border rounded-lg p-2 text-xs" value={slot.slot_id || ''} onChange={e => setSlots(slots.map((s,i) => i === index ? { ...s, slot_id: e.target.value } : s))} /></label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(slot.enabled)} onChange={e => setSlots(slots.map((s,i) => i === index ? { ...s, enabled: e.target.checked ? 1 : 0 } : s))} /> Enabled</label>
            <button onClick={() => deleteAdsenseSlot(slot.placement_key)} className="px-2 py-2 rounded-lg bg-red-50 text-red-700 text-xs">Delete</button>
          </div>)}
          <button disabled={busy} onClick={saveAdsense} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">{busy ? 'Saving...' : 'Save AdSense settings'}</button>
        </section>
      </>}
    </div>
  );
};
