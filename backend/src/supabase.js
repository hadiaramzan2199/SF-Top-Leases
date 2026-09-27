import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('\n[!] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env\n');
  process.exit(1);
}

// Service role bypasses RLS — this is why it must stay server-side only.
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
