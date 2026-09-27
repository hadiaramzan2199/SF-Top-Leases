import { Router } from 'express';
import { supabase } from '../supabase.js';

const r = Router();
const SELECT = '*, properties(id, address, display_name, latitude, longitude, image_url)';

r.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('transactions').select(SELECT).order('as_of_date', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

const FIELDS = [
  'property_id','name','status','sub_status','as_of_date','sf','pct_leased',
  'cap_low','cap_high','psf_low','psf_high','price_low','price_high',
  'buyer','seller','notes',
];
function pick(body) {
  const out = {};
  for (const f of FIELDS) if (f in body) out[f] = body[f] === '' ? null : body[f];
  return out;
}

r.post('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('transactions').insert([pick(req.body)]).select(SELECT).single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

r.put('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('transactions').update(pick(req.body)).eq('id', req.params.id).select(SELECT).single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('transactions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
