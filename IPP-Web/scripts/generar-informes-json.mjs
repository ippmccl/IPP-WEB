// scripts/generar-informes-json.mjs
// Actualiza /informes.json añadiendo entradas de nuevos archivos HTML diarios.
// Preserva todas las entradas existentes (incluidos los enlaces Drive de entradas antiguas).
// Ejecutado automáticamente por GitHub Actions al hacer push de nuevos informes.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SALIDA = 'informes.json';

// Extrae el H1 principal del HTML (título del informe)
function extraerTitulo(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, '').trim();
  const title = html.match(/<title>([^<]+)<\/title>/i);
  return title ? title[1].replace(/IPP[^|]*\|\s*/, '').trim() : '(sin título)';
}

// Extrae el primer párrafo largo como resumen
function extraerResumen(html) {
  const p = html.match(/<p[^>]*>([\s\S]{60,400}?)<\/p>/i);
  return p ? p[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '';
}

// Convierte "2026-05-17" a "domingo 17 de mayo de 2026"
function fechaLarga(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${dias[date.getDay()]} ${d} de ${meses[m-1]} de ${y}`;
}

// Convierte "2026-05-17" a "17 may 2026"
function fechaCorta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${meses[m-1]} ${y}`;
}

// Cargar informes.json existente (preservar entradas antiguas)
let existentes = [];
try {
  const raw = await readFile(SALIDA, 'utf8');
  existentes = JSON.parse(raw);
  console.log(`  Entradas existentes: ${existentes.length}`);
} catch {
  console.log('  informes.json no existía, creando desde cero.');
}

// Fechas ya registradas (para no duplicar)
const fechasExistentes = new Set(
  existentes
    .map(e => e.link?.match(/(\d{4}-\d{2}-\d{2})/)?.[1])
    .filter(Boolean)
);

// Escanear carpetas con patrón YYYY-MM-DD/informe-YYYY-MM-DD.html
let nuevas = [];

let carpetas = [];
try {
  const entries = await readdir('.', { withFileTypes: true });
  carpetas = entries
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map(e => e.name);
} catch (err) {
  console.error('Error leyendo directorio raíz:', err.message);
}

for (const carpeta of carpetas) {
  const fecha = carpeta; // "2026-05-17"
  if (fechasExistentes.has(fecha)) {
    console.log(`  [=] ${fecha} ya existe, no se duplica.`);
    continue;
  }
  const rutaHtml = join(carpeta, `informe-${fecha}.html`);
  let html;
  try {
    html = await readFile(rutaHtml, 'utf8');
  } catch {
    console.log(`  [?] No se encontró ${rutaHtml}, ignorando.`);
    continue;
  }
  nuevas.push({
    fecha: fechaLarga(fecha),
    fechaCorta: fechaCorta(fecha),
    titulo: extraerTitulo(html),
    resumen: extraerResumen(html),
    link: `${carpeta}/informe-${fecha}.html`,
    linkPdf: '',
    audiencia: 'ambos'
  });
  console.log(`  [+] Añadida entrada: ${fecha}`);
}

// Combinar: nuevas primero (más recientes), luego existentes, ordenar por fecha desc
const todas = [...nuevas, ...existentes];
todas.sort((a, b) => {
  const fa = a.link?.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || a.fechaCorta;
  const fb = b.link?.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || b.fechaCorta;
  return fb.localeCompare(fa);
});

await writeFile(SALIDA, JSON.stringify(todas, null, 2) + '\n', 'utf8');
console.log(`\n✓ ${SALIDA} actualizado con ${todas.length} entradas.`);
