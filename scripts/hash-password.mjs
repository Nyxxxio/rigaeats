import bcrypt from 'bcryptjs';

const pwd = process.argv[2];
if (!pwd) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}
const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const hash = await bcrypt.hash(pwd, rounds);
console.log('Hash:', hash);
console.log('Set ADMIN_PASSWORD_HASH to this value.');
