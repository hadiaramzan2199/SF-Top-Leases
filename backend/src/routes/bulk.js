import { Router } from 'express';
import { supabase } from '../supabase.js';

const r = Router();

const PROPERTY_FIELDS = ['address', 'display_name', 'latitude', 'longitude', 'image_url'];
const LEASE_FIELDS = [
  'property_id', 'tenant', 'name', 'rank_ytd', 'signed_date', 'sf', 'floors',
  'term_months', 'lease_type', 'yr1_rent_psf', 'escalation_pct',
  'free_rent_months', 'ti_psf', 'deal_type', 'notes',
];
const TRANSACTION_FIELDS = [
  'property_id', 'name', 'status', 'sub_status', 'as_of_date', 'sf', 'pct_leased',
  'cap_low', 'cap_high', 'psf_low', 'psf_high', 'price_low', 'price_high',
  'buyer', 'seller', 'notes',
];

function pick(body, fields) {
  const out = {};
  for (const field of fields) {
    if (!(field in body)) continue;
    out[field] = body[field] === '' ? null : body[field];
  }
  return out;
}

async function bulkInsert(table, fields, rows, select = '*') {
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error('No rows to import');
    error.status = 400;
    throw error;
  }
  if (rows.length > 500) {
    const error = new Error('CSV import is limited to 500 rows at a time');
    error.status = 400;
    throw error;
  }

  const payload = rows.map((row) => pick(row, fields));
  const { data, error } = await supabase.from(table).insert(payload).select(select);
  if (error) throw error;
  return data;
}

r.post('/properties', async (req, res, next) => {
  try {
    const data = await bulkInsert('properties', PROPERTY_FIELDS, req.body?.rows || []);
    res.status(201).json({ inserted: data.length, rows: data });
  } catch (error) {
    if (error.status) res.status(error.status).json({ error: error.message });
    else next(error);
  }
});

r.post('/leases', async (req, res, next) => {
  try {
    const select = '*, properties(id, address, display_name, latitude, longitude, image_url)';
    const data = await bulkInsert('leases', LEASE_FIELDS, req.body?.rows || [], select);
    res.status(201).json({ inserted: data.length, rows: data });
  } catch (error) {
    if (error.status) res.status(error.status).json({ error: error.message });
    else next(error);
  }
});

r.post('/transactions', async (req, res, next) => {
  try {
    const select = '*, properties(id, address, display_name, latitude, longitude, image_url)';
    const data = await bulkInsert('transactions', TRANSACTION_FIELDS, req.body?.rows || [], select);
    res.status(201).json({ inserted: data.length, rows: data });
  } catch (error) {
    if (error.status) res.status(error.status).json({ error: error.message });
    else next(error);
  }
});

export default r;
