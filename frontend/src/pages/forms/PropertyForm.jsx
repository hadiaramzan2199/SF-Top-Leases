import { useRef, useState } from 'react';
import LocationPicker from '../../components/LocationPicker.jsx';
import { api } from '../../api.js';

export default function PropertyForm({ initial, onSubmit, onCancel }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    address: initial?.address || '',
    display_name: initial?.display_name || '',
    image_url: initial?.image_url || '',
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function handlePick({ lat, lon, address }) {
    setForm((current) => ({
      ...current,
      latitude: lat,
      longitude: lon,
      address: address || current.address,
      display_name: current.display_name || (address ? address.split(',')[0] : ''),
    }));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploading(true);
    try {
      const uploaded = await api.uploadPropertyImage(file, initial?.id);
      set('image_url', uploaded.image_url);
    } catch (error) {
      setUploadError(error.message || 'Image upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function clearImage() {
    set('image_url', '');
    setUploadError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save() {
    if (!form.address.trim()) return alert('Choose/search a property address first.');
    if (form.latitude == null || form.longitude == null) return alert('Place the property pin on the map.');
    setSaving(true);
    try { await onSubmit(form); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="form-intro">
        <strong>Building information</strong>
        <span>Search for the property on the map. Coordinates are captured automatically and are not entered manually.</span>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Display name</label>
          <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="e.g. 300 Howard" />
        </div>
        <div className="field">
          <label>Building photo</label>
          <div className="property-image-field">
            {form.image_url ? (
              <div className="property-image-preview">
                <img src={form.image_url} alt="" />
                <button type="button" className="btn secondary" onClick={clearImage}>Remove</button>
              </div>
            ) : (
              <label className="property-image-upload">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageChange}
                  disabled={uploading}
                />
                <span>{uploading ? 'Uploading…' : 'Upload building photo'}</span>
              </label>
            )}
            {uploadError && <small className="field-error">{uploadError}</small>}
          </div>
        </div>
      </div>
      <div className="field"><label>Address</label><input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Filled when you choose a map search result" /></div>
      <div className="field"><label>Property location</label><LocationPicker value={{ lat: form.latitude, lon: form.longitude, address: form.address }} onChange={handlePick} /></div>

      <div className="form-actions">
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn" type="button" onClick={save} disabled={saving || uploading || form.latitude == null}>
          {saving ? 'Saving…' : 'Save property'}
        </button>
      </div>
    </div>
  );
}
