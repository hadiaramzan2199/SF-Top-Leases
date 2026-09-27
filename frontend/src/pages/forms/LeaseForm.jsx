import { useState } from 'react';

const DEAL_TYPES = ['New Lease', 'Renewal', 'Relocation', 'Expansion', 'Extension', 'New to Market'];
const LEASE_TYPES = ['Direct', 'Sublease', 'Undisclosed'];

export default function LeaseForm({ initial, properties, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    property_id: initial?.property_id || properties[0]?.id || '',
    tenant: initial?.tenant || '',
    name: initial?.name || '',
    rank_ytd: initial?.rank_ytd ?? '',
    signed_date: initial?.signed_date || '',
    sf: initial?.sf ?? '',
    floors: initial?.floors || '',
    term_months: initial?.term_months ?? '',
    lease_type: initial?.lease_type || 'Direct',
    yr1_rent_psf: initial?.yr1_rent_psf ?? '',
    escalation_pct: initial?.escalation_pct ?? '',
    free_rent_months: initial?.free_rent_months ?? '',
    ti_psf: initial?.ti_psf ?? '',
    deal_type: initial?.deal_type || 'New Lease',
    notes: initial?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    if (!form.property_id) return alert('Select a property first.');
    if (!form.tenant.trim()) return alert('Tenant is required.');
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        property_id: Number(form.property_id),
        rank_ytd: form.rank_ytd === '' ? null : Number(form.rank_ytd),
        sf: form.sf === '' ? null : Number(form.sf),
        term_months: form.term_months === '' ? null : Number(form.term_months),
        yr1_rent_psf: form.yr1_rent_psf === '' ? null : Number(form.yr1_rent_psf),
        escalation_pct: form.escalation_pct === '' ? null : Number(form.escalation_pct),
        free_rent_months: form.free_rent_months === '' ? null : Number(form.free_rent_months),
        ti_psf: form.ti_psf === '' ? null : Number(form.ti_psf),
      });
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="field"><label>Property (building)</label><select value={form.property_id} onChange={(e) => set('property_id', e.target.value)}>{properties.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.address}</option>)}</select></div>
      <div className="grid-2"><div className="field"><label>Tenant</label><input value={form.tenant} onChange={(e) => set('tenant', e.target.value)} /></div><div className="field"><label>Executed date</label><input type="date" value={form.signed_date} onChange={(e) => set('signed_date', e.target.value)} /></div></div>
      <div className="grid-2"><div className="field"><label>Leased area (SF)</label><input type="number" value={form.sf} onChange={(e) => set('sf', e.target.value)} /></div><div className="field"><label>Floors</label><input value={form.floors} onChange={(e) => set('floors', e.target.value)} /></div></div>
      <div className="grid-2"><div className="field"><label>Year-1 rent ($/SF/Yr)</label><input type="number" step="0.01" value={form.yr1_rent_psf} onChange={(e) => set('yr1_rent_psf', e.target.value)} /></div><div className="field"><label>Term (months)</label><input type="number" value={form.term_months} onChange={(e) => set('term_months', e.target.value)} /></div></div>
      <div className="grid-2"><div className="field"><label>Escalation (%)</label><input type="number" step="0.1" value={form.escalation_pct} onChange={(e) => set('escalation_pct', e.target.value)} /></div><div className="field"><label>Free rent (months)</label><input type="number" value={form.free_rent_months} onChange={(e) => set('free_rent_months', e.target.value)} /></div></div>
      <div className="grid-2"><div className="field"><label>TI ($/SF)</label><input type="number" step="0.01" value={form.ti_psf} onChange={(e) => set('ti_psf', e.target.value)} /></div><div className="field"><label>Lease type</label><select value={form.lease_type} onChange={(e) => set('lease_type', e.target.value)}>{LEASE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div></div>
      <div className="grid-2"><div className="field"><label>Deal type</label><select value={form.deal_type} onChange={(e) => set('deal_type', e.target.value)}>{DEAL_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div><div className="field"><label>YTD rank <em>optional</em></label><input type="number" value={form.rank_ytd} onChange={(e) => set('rank_ytd', e.target.value)} /></div></div>
      <div className="field"><label>Notes</label><textarea rows="3" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      <div className="form-actions"><button className="btn secondary" type="button" onClick={onCancel}>Cancel</button><button className="btn" type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save lease'}</button></div>
    </div>
  );
}
