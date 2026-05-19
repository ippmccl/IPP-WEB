import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const jsonPath = path.join(ROOT, 'informes.json');

const FIXES = [
  [/Ã¡/g, 'á'], [/Ã©/g, 'é'], [/Ã­/g, 'í'], [/Ã³/g, 'ó'], [/Ãº/g, 'ú'],
  [/Ã±/g, 'ñ'], [/Ã€/g, 'À'], [/Ã‰/g, 'É'], [/Ã/g, 'Í'], [/Ã"/g, 'Ó'],
  [/Ãš/g, 'Ú'], [/Ã'/g, 'Ñ'], [/Â¡/g, '¡'], [/Â¿/g, '¿'],
  [/â€"/g, '—'], [/â€"/g, '–'], [/â€œ/g, '"'], [/â€/g, '"'], [/â€™/g, "'"]
];

function arreglar(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const [re, rep] of FIXES) out = out.replace(re, rep);
  return out;
}

const data = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));

const limpios = data
  .map(it => Object.fromEntries(Object.entries(it).map(([k, v]) => [k, arreglar(v)])))
  .filter(it =>
    (it.link && it.link.trim() !== '') ||
    (it.linkPdf && it.linkPdf.trim() !== '')
  );

const vistos = new Set();
const final = limpios.filter(it => {
  const key = it.link || it.linkPdf;
  if (vistos.has(key)) return false;
  vistos.add(key);
  return true;
});

await fs.writeFile(jsonPath, JSON.stringify(final, null, 2), 'utf-8');
console.log(`Limpiado: ${data.length} → ${final.length} entradas válidas.`);
