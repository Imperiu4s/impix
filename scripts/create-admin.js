// Használat: npm run create-admin -- <email> <jelszó>
// Új admin fiókot hoz létre, vagy meglévő felhasználót admin joggal és új jelszóval lát el.
import db from '../db.js';
import { hashPassword } from '../security.js';

const [email, pass] = process.argv.slice(2);
if (!email || !pass || pass.length < 8) {
  console.error('Használat: npm run create-admin -- <email> <jelszó (min. 8 karakter)>');
  process.exit(1);
}
const mail = email.toLowerCase();
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(mail);
if (existing) {
  db.prepare("UPDATE users SET role = 'admin', banned = 0, password_hash = ? WHERE id = ?").run(hashPassword(pass), existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log(`Meglévő felhasználó admin lett, jelszó frissítve: ${mail}`);
} else {
  db.prepare("INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?, 'admin', ?)")
    .run(mail, 'Adminisztrátor', hashPassword(pass), Date.now());
  console.log(`Admin létrehozva: ${mail}`);
}
