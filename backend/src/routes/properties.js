import { Router } from 'express';
import { supabase } from '../supabase.js';

const r = Router();

// List all properties (optionally only those with coordinates, for the map)
r.get('/', async (req, res, next) => {
  try {
    let q = supabase.from('properties').select('*').order('id');
    if (req.query.located === 'true') {
      q = q.not('latitude', 'is', null).not('longitude', 'is', null);
    }
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('properties').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const { address, display_name, latitude, longitude, image_url } = req.body;
    const { data, error } = await supabase
      .from('properties')
      .insert([{ address, display_name, latitude, longitude, image_url }])
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
});

r.put('/:id', async (req, res, next) => {
  try {
    const { address, display_name, latitude, longitude, image_url } = req.body;
    const { data, error } = await supabase
      .from('properties')
      .update({ address, display_name, latitude, longitude, image_url })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('properties').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
