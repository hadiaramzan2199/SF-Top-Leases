import { useState } from 'react';

const NUMERIC = ['sf', 'pct_leased', 'cap_low', 'cap_high', 'psf_low', 'psf_high', 'price_low', 'price_high'];

export default function TransactionForm({ initial, properties, onSubmit, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    property_id: initial?.property_id || properties[0]?.id || '',
    name: initial?.name || '',
    status: initial?.status || 'on_market',
    sub_status: initial?.sub_status || '',
    as_of_date: initial?.as_of_date || '',
    sf: initial?.sf ?? '',
    pct_leased: initial?.pct_leased ?? '',
    cap_low: initial?.cap_low ?? '',
    cap_high: initial?.cap_high ?? '',
    psf_low: initial?.psf_low ?? '',
    psf_high: initial?.psf_high ?? '',
    price_low: initial?.price_low ?? '',
    price_high: initial?.price_high ?? '',
    buyer: initial?.buyer || '',
    seller: initial?.seller || '',
    notes: initial?.notes || '',
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    if (!form.property_id) return alert('Select a property first.');
    setSaving(true);
    try {
      const payload = { ...form, property_id: Number(form.property_id) };
      for (const field of NUMERIC) payload[field] = payload[field] === '' ? null : Number(payload[field]);
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="field">
        <label>Property</label>
        <select value={form.property_id} onChange={(e) => set('property_id', e.target.value)}>
          {properties.map((property) => <option key={property.id} value={property.id}>{property.display_name || property.address}</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div className="field"><label>Transaction name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>As-of date</label><input type="date" value={form.as_of_date} onChange={(e) => set('as_of_date', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Status</label><select value={form.status} onChange={(e) => set('status', e.target.value)}><option value="on_market">Active / on market</option><option value="closed">Closed</option></select></div>
        <div className="field"><label>Sub-status</label><input placeholder="Marketing / Bidding / Awarded" value={form.sub_status} onChange={(e) => set('sub_status', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Building SF</label><input type="number" value={form.sf} onChange={(e) => set('sf', e.target.value)} /></div>
        <div className="field"><label>% leased</label><input type="number" step="0.01" value={form.pct_leased} onChange={(e) => set('pct_leased', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Cap rate low</label><input type="number" step="0.01" value={form.cap_low} onChange={(e) => set('cap_low', e.target.value)} /></div>
        <div className="field"><label>Cap rate high</label><input type="number" step="0.01" value={form.cap_high} onChange={(e) => set('cap_high', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Price / SF low</label><input type="number" value={form.psf_low} onChange={(e) => set('psf_low', e.target.value)} /></div>
        <div className="field"><label>Price / SF high</label><input type="number" value={form.psf_high} onChange={(e) => set('psf_high', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Price low</label><input type="number" value={form.price_low} onChange={(e) => set('price_low', e.target.value)} /></div>
        <div className="field"><label>Price high</label><input type="number" value={form.price_high} onChange={(e) => set('price_high', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Buyer</label><input value={form.buyer} onChange={(e) => set('buyer', e.target.value)} /></div>
        <div className="field"><label>Seller</label><input value={form.seller} onChange={(e) => set('seller', e.target.value)} /></div>
      </div>
      <div className="field"><label>Notes</label><textarea rows="3" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      <div className="form-actions">
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn" type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save transaction'}</button>
      </div>
    </div>
  );
}
