import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATE = process.argv[2] || new Date().toISOString().slice(0, 10);

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_C = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fechaLarga(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[dt.getUTCDay()]} ${d} de ${MESES[m - 1]} de ${y}`;
}

function fechaCorta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES_C[m - 1]} ${y}`;
}

function bloqueNoticias(lista, ambito) {
  if (!lista || lista.length === 0) return '';
  const titulo = ambito === 'NACIONAL' ? 'Noticias Nacionales' : 'Noticias Internacionales';
  const items = lista.map(n => `
    <div class="news">
      <span class="tag">${n.tipo} · ${ambito}</span>
      <h3>${n.titular}</h3>
      <p>${n.cuerpo}</p>
    </div>`).join('');
  return `<section class="sec"><div class="sec-header">${titulo}</div>${items}</section>`;
}

function bloquePapers(lista) {
  if (!lista || lista.length === 0) return '';
  const items = lista.map(p => `
    <div class="paper">
      <div class="apa">${p.apa}</div>
      <div class="doi">DOI: ${p.doi}</div>
      <p><strong>Hallazgo:</strong> ${p.hallazgo}</p>
      <p><strong>Implicación clínica:</strong> ${p.implicacion}</p>
    </div>`).join('');
  return `<section class="sec"><div class="sec-header">Publicaciones Científicas Recientes</div>${items}</section>`;
}

function bloqueHerramientas(lista) {
  if (!lista || lista.length === 0) return '';
  const items = lista.map(h => `<p>– <strong>${h.nombre}:</strong> ${h.descripcion}</p>`).join('');
  return `<section class="sec"><div class="sec-header">Herramientas Clínicas e Instrumentos</div>${items}</section>`;
}

function bloqueAlertas(lista) {
  if (!lista || lista.length === 0) return '';
  const items = lista.map(a => {
    const cls = a.estado.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
    return `
    <div class="alerta">
      <span class="badge ${cls}">${a.estado}</span>
      <p><strong>${a.titulo}:</strong> ${a.descripcion}</p>
    </div>`;
  }).join('');
  return `<section class="sec"><div class="sec-header">Alertas Normativas</div>${items}</section>`;
}

function bloquePrioridades(lista) {
  return lista.map(p => `<div class="prio"><h4>${p.titulo}</h4><p>${p.descripcion}</p></div>`).join('');
}

async function main() {
  const dataPath = path.join(ROOT, 'data', `${DATE}.json`);
  const tplPath = path.join(ROOT, 'template.html');
  const outDir = path.join(ROOT, DATE);

  await fs.mkdir(outDir, { recursive: true });

  const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
  let html = await fs.readFile(tplPath, 'utf-8');

  const reemplazos = {
    '{{TITULO}}': data.titulo,
    '{{FECHA_LARGA}}': fechaLarga(DATE),
    '{{RESUMEN}}': data.resumen,
    '{{SECCION_NACIONALES}}': bloqueNoticias(data.nacionales, 'NACIONAL'),
    '{{SECCION_INTERNACIONALES}}': bloqueNoticias(data.internacionales, 'INTERNACIONAL'),
    '{{SECCION_PAPERS}}': bloquePapers(data.papers),
    '{{SECCION_HERRAMIENTAS}}': bloqueHerramientas(data.herramientas),
    '{{SECCION_ALERTAS}}': bloqueAlertas(data.alertas),
    '{{PRIORIDADES}}': bloquePrioridades(data.prioridades),
  };

  for (const [k, v] of Object.entries(reemplazos)) {
    html = html.replaceAll(k, v ?? '');
  }

  const htmlPath = path.join(outDir, `informe-${DATE}.html`);
  await fs.writeFile(htmlPath, html, 'utf-8');
  console.log(`HTML escrito: ${htmlPath}`);

  const isWindows = process.platform === 'win32';
  const executablePath = isWindows
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : (process.env.CHROME_PATH || '/usr/bin/google-chrome');
  const browser = await puppeteer.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  const pdfPath = path.join(outDir, `informe-${DATE}.pdf`);
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' }
  });
  await browser.close();
  console.log(`PDF escrito: ${pdfPath}`);

  const jsonPath = path.join(ROOT, 'informes.json');
  const informes = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
  const filtrados = informes.filter(i => !i.link?.startsWith(`${DATE}/`));
  filtrados.unshift({
    fecha: fechaLarga(DATE),
    fechaCorta: fechaCorta(DATE),
    titulo: data.titulo,
    resumen: data.resumen.slice(0, 220),
    link: `${DATE}/informe-${DATE}.html`,
    linkPdf: `${DATE}/informe-${DATE}.pdf`,
    audiencia: data.audiencia || 'ambos'
  });
  await fs.writeFile(jsonPath, JSON.stringify(filtrados, null, 2), 'utf-8');
  console.log(`informes.json actualizado (${filtrados.length} entradas)`);
}

main().catch(err => { console.error(err); process.exit(1); });
