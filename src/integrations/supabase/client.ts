import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://bvdslbzafjuvihrxetkj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_S0Ee8RWS5Qkkbd-gUF61Aw_hfCqm5fg";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});
