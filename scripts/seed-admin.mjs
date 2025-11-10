import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}
const supabase = createClient(url, key);

async function run() {
  const slug = process.env.SEED_RESTAURANT_SLUG || 'singhs';
  const name = process.env.SEED_RESTAURANT_NAME || "Singh's Spices";
  const adminUser = process.env.SEED_ADMIN_USERNAME || 'singhsres';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'thisissinghsres';

  // Ensure restaurants
  const { data: r, error: rErr } = await supabase.from('restaurants').select('slug').eq('slug', slug).single();
  if (!r) {
    const { error } = await supabase.from('restaurants').insert({ slug, name }).select();
    if (error) {
      console.error('Failed to insert restaurant:', error);
      process.exit(1);
    }
    console.log('Inserted restaurant', slug);
  } else {
    console.log('Restaurant exists:', slug);
  }

  // Ensure admin user
  const { data: u } = await supabase.from('admin_users').select('id,username').eq('username', adminUser).single();
  if (!u) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const password_hash = await bcrypt.hash(adminPass, rounds);
    const { error } = await supabase.from('admin_users').insert({ username: adminUser, password_hash, restaurant_slug: slug }).select();
    if (error) {
      console.error('Failed to insert admin user:', error);
      process.exit(1);
    }
    console.log('Inserted admin user', adminUser);
  } else {
    console.log('Admin user exists:', adminUser);
  }

  console.log('Seed complete');
}

run().catch(e => { console.error(e); process.exit(1); });
