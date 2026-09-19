// Beállítások betöltése a projekt melletti .env fájlból (ha van).
// Hasznos ott, ahol nem lehet tetszőleges környezeti változót felvenni (pl. Pterodactyl panel).
// A már beállított környezeti változókat nem írja felül.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('./.env', import.meta.url));
if (fs.existsSync(file)) process.loadEnvFile(file);
