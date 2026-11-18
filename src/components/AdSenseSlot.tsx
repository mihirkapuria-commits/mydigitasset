import React, { useEffect, useState } from 'react';

type Slot = {
  placementKey: string;
  enabled: number;
  clientId: string;
  slotId: string;
};

interface Props { placementKey: string; }

export const AdSenseSlot: React.FC<Props> = ({ placementKey }) => {
  const [slot, setSlot] = useState<Slot | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/adsense')
      .then(r => r.ok ? r.json() : [])
      .then((rows: Slot[]) => {
        if (!active) return;
        setSlot(rows.find(x => x.placementKey === placementKey && x.enabled && x.clientId && x.slotId) || null);
      })
      .catch(() => { if (active) setSlot(null); });
    return () => { active = false; };
  }, [placementKey]);

  useEffect(() => {
    if (!slot) return;
    const client = slot.clientId.trim();
    const scriptId = 'adsense-script-' + client.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
      document.head.appendChild(script);
    }
    try {
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
    } catch (error) {
      console.warn('AdSense slot could not be initialized:', error);
    }
  }, [slot]);

  if (!slot) return null;

  return (
    <div className="w-full my-8 overflow-hidden text-center" aria-label="Advertisement">
      <ins className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={slot.clientId}
        data-ad-slot={slot.slotId}
        data-ad-format="auto"
        data-full-width-responsive="true" />
    </div>
  );
};
