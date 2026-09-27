import { Router } from 'express';
import { supabase } from '../supabase.js';

const r = Router();

// Every lease comes back with its property (address + coordinates) nested,
// so the frontend can plot it on the map without a second call.
const SELECT = '*, properties(id, address, display_name, latitude, longitude, image_url)';

r.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('leases').select(SELECT).order('signed_date', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('leases').select(SELECT).eq('id', req.params.id).single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

const FIELDS = [
  'property_id','tenant','name','rank_ytd','signed_date','sf','floors',
  'term_months','lease_type','yr1_rent_psf','escalation_pct',
  'free_rent_months','ti_psf','deal_type','notes',
];
function pick(body) {
  const out = {};
  for (const f of FIELDS) if (f in body) out[f] = body[f] === '' ? null : body[f];
  return out;
}

r.post('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('leases').insert([pick(req.body)]).select(SELECT).single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

r.put('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('leases').update(pick(req.body)).eq('id', req.params.id).select(SELECT).single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('leases').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
