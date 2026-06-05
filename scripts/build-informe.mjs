import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATE = process.argv[2] || new Date().toISOString().slice(0, 10);

const ESTADOS_VALIDOS = ['APROBADO', 'EN TRAMITACIÓN', 'EN DESARROLLO', 'PROPUESTA'];

// Normalización automática RAE: solo primera palabra y acrónimos en mayúscula
function normalizarTituloRAE(titulo) {
  if (!titulo) return titulo;
  return titulo.split(' ').map((word, i) => {
    if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1);
    // Conservar acrónimos (todo mayúsculas, ≥2 letras): ONU, COP, NICE, PIR, TCC, BOE…
    if (/^[A-ZÁÉÍÓÚÜÑ]{2,}[.:,-]?$/.test(word)) return word;
    // Conservar siglas con punto (A.P.A., D.S.M.)
    if (/^([A-Z]\.){2,}$/.test(word)) return word;
    return word.charAt(0).toLowerCase() + word.slice(1);
  }).join(' ');
}


function validarJSON(data) {
  const errores = [];

  if (!data.titulo) errores.push('Falta campo obligatorio: titulo');
  if (!data.resumen || data.resumen.length < 50) errores.push('Campo resumen ausente o demasiado corto (mínimo 50 caracteres)');
  if (!['ambos', 'clinico', 'neuropsicologia'].includes(data.audiencia))
    errores.push(`Campo audiencia inválido: "${data.audiencia}". Valores permitidos: ambos, clinico, neuropsicologia`);

  const totalNoticias = (data.nacionales?.length ?? 0) + (data.internacionales?.length ?? 0);
  if (totalNoticias < 1) errores.push('El JSON no contiene ninguna noticia (nacionales ni internacionales)');

  if (!Array.isArray(data.prioridades) || data.prioridades.length !== 3)
    errores.push(`prioridades debe tener exactamente 3 elementos (tiene ${data.prioridades?.length ?? 0})`);

  for (const alerta of (data.alertas ?? [])) {
    if (!ESTADOS_VALIDOS.includes(alerta.estado))
      errores.push(`Alerta "${alerta.titulo}": estado inválido "${alerta.estado}". Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`);
  }

  if (!Array.isArray(data.hashtags) || data.hashtags.length !== 5)
    errores.push(`hashtags debe tener exactamente 5 elementos (tiene ${data.hashtags?.length ?? 0})`);

  if (!data.copy_rrss) errores.push('Falta campo obligatorio: copy_rrss');

  return errores;
}

async function actualizarTemasRecientes(data) {
  const temasPath = path.join(ROOT, 'data', 'temas-recientes.json');
  let temas = [];
  try {
    temas = JSON.parse(await fs.readFile(temasPath, 'utf-8'));
  } catch {}

  temas = temas.filter(t => t.fecha !== DATE);
  temas.unshift({
    fecha: DATE,
    titulo: data.titulo,
    keywords: data.titulo.toLowerCase()
      .replace(/[^\w\sáéíóúüñ]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 6)
  });

  const hace30dias = new Date(DATE);
  hace30dias.setDate(hace30dias.getDate() - 30);
  temas = temas.filter(t => new Date(t.fecha) >= hace30dias);

  await fs.writeFile(temasPath, JSON.stringify(temas, null, 2), 'utf-8');
  console.log(`temas-recientes.json actualizado (${temas.length} entradas)`);
}

const TIMEOUT_VERIFICACION_MS = 12000;

async function verificarURL(url) {
  if (!url || typeof url !== 'string') return false;
  if (/^URL\d|accedida con|Hashtag|\.\.\./.test(url)) return false; // descartar placeholders
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_VERIFICACION_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPP-Verifier/1.0)' }
    });
    clearTimeout(timer);
    return res.status < 400;
  } catch {
    return false;
  }
}

async function verificarYFiltrar(data) {
  console.log('\nVerificando URLs del contenido...');

  const nacionales = [];
  for (const n of (data.nacionales || [])) {
    if (await verificarURL(n.url)) {
      nacionales.push(n);
      console.log(`  OK  ${n.url}`);
    } else {
      console.log(`  --  descartado (URL inactiva): ${(n.url || 'sin url').slice(0, 90)}`);
    }
  }

  const internacionales = [];
  for (const n of (data.internacionales || [])) {
    if (await verificarURL(n.url)) {
      internacionales.push(n);
      console.log(`  OK  ${n.url}`);
    } else {
      console.log(`  --  descartado (URL inactiva): ${(n.url || 'sin url').slice(0, 90)}`);
    }
  }

  const papers = [];
  for (const p of (data.papers || [])) {
    const doiUrl = p.doi ? `https://doi.org/${p.doi}` : (p.url_verificada || '');
    if (await verificarURL(doiUrl)) {
      papers.push(p);
      console.log(`  OK  DOI ${p.doi}`);
    } else {
      console.log(`  --  descartado paper (DOI inactivo): ${p.doi || 'sin doi'}`);
    }
  }

  const alertas = [];
  for (const a of (data.alertas || [])) {
    if (await verificarURL(a.url)) {
      alertas.push(a);
      console.log(`  OK  ${a.url}`);
    } else {
      console.log(`  --  descartado alerta (URL inactiva): ${(a.url || 'sin url').slice(0, 90)}`);
    }
  }

  const fuentes_verificadas = [
    ...nacionales.map(n => n.url),
    ...internacionales.map(n => n.url),
    ...papers.map(p => p.doi ? `https://doi.org/${p.doi}` : p.url_verificada),
    ...alertas.map(a => a.url)
  ].filter(Boolean);

  return { ...data, nacionales, internacionales, papers, alertas, fuentes_verificadas };
}

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
  const titulo = ambito === 'NACIONAL' ? 'Noticias nacionales' : 'Noticias internacionales';
  const items = lista.map(n => {
    const fuenteHtml = n.fuente
      ? `<p class="noticia-fuente">Fuente: ${n.url ? `<a href="${n.url}" target="_blank" rel="noopener">${n.fuente}</a>` : n.fuente}</p>`
      : (n.url ? `<p class="noticia-fuente"><a href="${n.url}" target="_blank" rel="noopener">${n.url}</a></p>` : '');
    return `
    <div class="news">
      <span class="tag">${n.tipo} · ${ambito}</span>
      <h3>${n.titular}</h3>
      <p>${n.cuerpo}</p>
      ${fuenteHtml}
    </div>`;
  }).join('');
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
  return `<section class="sec"><div class="sec-header">Publicaciones científicas recientes</div>${items}</section>`;
}

function bloqueHerramientas(lista) {
  if (!lista || lista.length === 0) return '';
  const items = lista.map(h => `<p>– <strong>${h.nombre}:</strong> ${h.descripcion}</p>`).join('');
  return `<section class="sec"><div class="sec-header">Herramientas clínicas e instrumentos</div>${items}</section>`;
}

function bloqueAlertas(lista) {
  if (!lista || lista.length === 0) return '';
  const items = lista.map(a => {
    const cls = a.estado.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
    const urlHtml = a.url ? `<p class="noticia-fuente"><a href="${a.url}" target="_blank" rel="noopener">Ver fuente</a></p>` : '';
    return `
    <div class="alerta">
      <span class="badge ${cls}">${a.estado}</span>
      <p><strong>${a.titulo}:</strong> ${a.descripcion}</p>
      ${urlHtml}
    </div>`;
  }).join('');
  return `<section class="sec"><div class="sec-header">Alertas normativas</div>${items}</section>`;
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

  const errores = validarJSON(data);
  if (errores.length > 0) {
    console.error('❌ JSON inválido — build abortado:');
    errores.forEach(e => console.error(`  · ${e}`));
    process.exit(1);
  }
  console.log('✅ Estructura JSON válida');

  const dataVerificado = await verificarYFiltrar(data);
  const totalVerificadas = dataVerificado.nacionales.length + dataVerificado.internacionales.length;
  if (totalVerificadas < 2) {
    console.error(`\n❌ Solo ${totalVerificadas} noticia(s) superaron la verificación de URL — se requieren al menos 2`);
    process.exit(1);
  }
  console.log(`\n✅ ${totalVerificadas} noticias verificadas | ${dataVerificado.papers.length} papers | ${dataVerificado.alertas.length} alertas`);

  let html = await fs.readFile(tplPath, 'utf-8');

  const reemplazos = {
    '{{TITULO}}': normalizarTituloRAE(dataVerificado.titulo),
    '{{FECHA_LARGA}}': fechaLarga(DATE),
    '{{RESUMEN}}': dataVerificado.resumen,
    '{{SECCION_NACIONALES}}': bloqueNoticias(dataVerificado.nacionales, 'NACIONAL'),
    '{{SECCION_INTERNACIONALES}}': bloqueNoticias(dataVerificado.internacionales, 'INTERNACIONAL'),
    '{{SECCION_PAPERS}}': bloquePapers(dataVerificado.papers),
    '{{SECCION_HERRAMIENTAS}}': bloqueHerramientas(dataVerificado.herramientas),
    '{{SECCION_ALERTAS}}': bloqueAlertas(dataVerificado.alertas),
    '{{PRIORIDADES}}': bloquePrioridades(dataVerificado.prioridades),
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
    titulo: normalizarTituloRAE(dataVerificado.titulo),
    resumen: dataVerificado.resumen.slice(0, 220),
    link: `${DATE}/informe-${DATE}.html`,
    linkPdf: `${DATE}/informe-${DATE}.pdf`,
    audiencia: dataVerificado.audiencia || 'ambos'
  });
  // Ordenar siempre por fecha descendente (más reciente primero)
  const MESES_IDX = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
  filtrados.sort((a, b) => {
    const p = s => { const t = s.split(' '); return new Date(+t[2], MESES_IDX[t[1]], +t[0]); };
    return p(b.fechaCorta) - p(a.fechaCorta);
  });
  await fs.writeFile(jsonPath, JSON.stringify(filtrados, null, 2), 'utf-8');
  console.log(`informes.json actualizado (${filtrados.length} entradas)`);

  await actualizarTemasRecientes(dataVerificado);
}

main().catch(err => { console.error(err); process.exit(1); });
