import { Router } from 'express';
import { supabase } from '../supabase.js';

const r = Router();

// Summary numbers (from the v_lease_stats view)
r.get('/lease-summary', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('v_lease_stats').select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// Monthly leasing volume / avg rent (from v_leasing_by_month)
r.get('/leasing-by-month', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('v_leasing_by_month').select('*');
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

// Lease term buckets (Short / Mid / Long) from v_lease_term_buckets
r.get('/term-buckets', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('v_lease_term_buckets').select('*');
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

export default r;
