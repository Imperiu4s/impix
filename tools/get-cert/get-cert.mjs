// Ingyenes HTTPS tanúsítvány kérése (Let's Encrypt), DNS-ellenőrzéssel.
// A saját gépeden fut (nem a szerveren). A végén létrehozza a ../../tls/fullchain.pem és privkey.pem fájlt,
// amit fel kell töltened a szerver `tls` mappájába. A szerver újraindítás nélkül átveszi.
//
// Használat: get-cert.bat (dupla kattintás), vagy: node get-cert.mjs [domain] [email] [--staging]

import acme from 'acme-client';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { Resolver } from 'node:dns/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '..', 'tls');
const accountKeyFile = path.join(here, 'account.key');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const staging = process.argv.includes('--staging'); // próbaüzem: nem valódi tanúsítványt ad, de a menet ugyanaz
const abortAfterChallenge = process.argv.includes('--abort-after-challenge'); // csak tesztelésre

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, def) => ((await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def || '');

console.log('\n=== Impix – HTTPS tanúsítvány kérése (Let\'s Encrypt) ===\n');
const domain = (args[0] || (await ask('Domain, amire a tanúsítvány kell', 'api.impix.hu'))).toLowerCase();
const email = args[1] || (await ask('E-mail cím (lejárati értesítésekhez)'));
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { console.error('Érvénytelen domain.'); process.exit(1); }
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Érvénytelen e-mail cím.'); process.exit(1); }

// Fiókkulcs: első alkalommal létrejön, utána újra felhasználjuk
let accountKey;
if (fs.existsSync(accountKeyFile)) accountKey = fs.readFileSync(accountKeyFile);
else { accountKey = await acme.crypto.createPrivateKey(); fs.writeFileSync(accountKeyFile, accountKey, { mode: 0o600 }); }

const client = new acme.Client({
  directoryUrl: staging ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production,
  accountKey,
});

const [certKey, csr] = await acme.crypto.createCsr({ commonName: domain });

// A DNS-ellenőrzés: a Let's Encrypt egy TXT rekordot vár a _acme-challenge.<domain> névre.
async function waitForTxt(name, expected) {
  const resolver = new Resolver();
  resolver.setServers(['1.1.1.1', '8.8.8.8']); // nyilvános DNS: a helyi gyorsítótár ne tévesszen meg
  process.stdout.write('   Várakozás a DNS terjedésére');
  for (let i = 0; i < 60; i++) { // legfeljebb ~10 perc
    try {
      const records = (await resolver.resolveTxt(name)).map((r) => r.join(''));
      if (records.includes(expected)) { console.log(' – megvan.'); return; }
    } catch { /* még nincs rekord */ }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log('');
  throw new Error('A TXT rekord nem jelent meg a DNS-ben. Ellenőrizd a Rackhostnál, majd futtasd újra.');
}

const certificate = await client.auto({
  csr,
  email,
  termsOfServiceAgreed: true,
  challengePriority: ['dns-01'],
  async challengeCreateFn(authz, challenge, keyAuthorization) {
    const name = `_acme-challenge.${authz.identifier.value}`;
    console.log('\nVedd fel ezt a DNS-rekordot a Rackhost DNS-kezelőjében:\n');
    console.log('   Típus : TXT');
    console.log(`   Név   : ${name.replace(`.${domain.split('.').slice(-2).join('.')}`, '')}   (teljes név: ${name})`);
    console.log(`   Érték : ${keyAuthorization}\n`);
    console.log('A Név mezőbe a Rackhost általában csak a domain előtti részt kéri (pl. _acme-challenge.api).');
    if (abortAfterChallenge) { console.log('(teszt: itt megszakítom)'); rl.close(); process.exit(0); }
    await ask('Ha felvetted a rekordot, nyomj Entert');
    await waitForTxt(name, keyAuthorization);
  },
  async challengeRemoveFn() {
    console.log('   A TXT rekordot most már törölheted a Rackhostnál (nem kötelező).');
  },
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'fullchain.pem'), certificate);
fs.writeFileSync(path.join(outDir, 'privkey.pem'), certKey, { mode: 0o600 });
rl.close();

console.log(`\nKész! ${staging ? '(PRÓBAÜZEM – ez a tanúsítvány nem megbízható)' : ''}`);
console.log(`A fájlok itt vannak: ${outDir}`);
console.log('   fullchain.pem  és  privkey.pem');
console.log('Töltsd fel mindkettőt a szerver "tls" mappájába (a server.js mellé). Újraindítás nem kell.');
console.log('Ez a tanúsítvány kb. 90 napig érvényes, az admin panel figyelmeztet, ha közeleg a lejárat.');
