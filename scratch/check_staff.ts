
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStaff() {
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('name, profile_image, role');
  const { data: managed, error: mErr } = await supabase.from('managed_staff').select('name, profile_image');
  
  console.log('--- PROFILES ---');
  console.log(JSON.stringify(profiles, null, 2));
  console.log('--- MANAGED STAFF ---');
  console.log(JSON.stringify(managed, null, 2));
}

checkStaff();
