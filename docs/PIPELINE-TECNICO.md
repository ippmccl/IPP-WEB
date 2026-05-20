# PIPELINE TÉCNICO — Sistema IPP Informe Diario

Descripción completa de la arquitectura, componentes y flujo de ejecución del sistema de generación automática del Briefing Diario de Psicología y Neuropsicología del Instituto Politécnico de Psicología.

---

## 1. Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENTE REMOTO (Claude Code Routine)                            │
│  Disparo: 06:00 UTC (08:00 Madrid) · ID: trig_016rNMqViqme7M4GY │
│                                                                  │
│  1. Lee  data/temas-recientes.json  (evita repetición §13)      │
│  2. Investiga noticias 2025-2026    (WebSearch + WebFetch §2)   │
│  3. Verifica URLs y DOIs            (WebFetch · doi.org §2.3)   │
│  4. Redacta con voz institucional   (§4 + §5)                   │
│  5. Produce JSON completo           (docs/SCHEMA-JSON.md)       │
│  6. Valida JSON                     (docs/CHECKLIST-AUDITORIA)  │
│  7. Push  data/YYYY-MM-DD.json  →  GitHub                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ push a data/*.json
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS  (.github/workflows/build-informe.yml)          │
│                                                                  │
│  Trigger: push en data/*.json                                   │
│                                                                  │
│  1. checkout + npm install                                       │
│  2. Instalar Chromium                                           │
│  3. Detectar fecha del JSON pusheado                            │
│  4. node scripts/build-informe.mjs YYYY-MM-DD                   │
│     ├── Valida JSON (fuentes_verificadas, prioridades, alertas) │
│     ├── Genera YYYY-MM-DD/informe-YYYY-MM-DD.html               │
│     ├── Genera YYYY-MM-DD/informe-YYYY-MM-DD.pdf  (Puppeteer)   │
│     ├── Actualiza informes.json                                  │
│     └── Actualiza data/temas-recientes.json                     │
│  5. git commit + push (bot: IPP Build Bot)                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │ push de artefactos
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  GITHUB PAGES  (ippmccl.github.io/IPP-WEB)                      │
│  Sirve: index.html + YYYY-MM-DD/informe-*.html + *.pdf          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Estructura del repositorio

```
IPP-WEB/
├── .github/
│   └── workflows/
│       ├── build-informe.yml         ← Pipeline principal (push data/*.json)
│       └── actualizar-informes.yml   ← Mantenimiento del índice informes.json
│
├── data/
│   ├── YYYY-MM-DD.json               ← JSON diario producido por el agente
│   └── temas-recientes.json          ← Historial de temas (últimos 30 días)
│
├── docs/
│   ├── INSTRUCCIONES-AGENTE.md       ← Contrato operativo del agente (13 §§)
│   ├── SCHEMA-JSON.md                ← Esquema JSON + JSON Schema draft 7
│   ├── PIPELINE-TECNICO.md           ← Este documento
│   └── CHECKLIST-AUDITORIA.md        ← Verificaciones automáticas por build
│
├── scripts/
│   ├── build-informe.mjs             ← Build principal: HTML + PDF + validación
│   ├── generar-informes-json.mjs     ← Regenera informes.json desde cero
│   └── limpiar-informes-json.mjs     ← Elimina entradas huérfanas de informes.json
│
├── YYYY-MM-DD/                       ← Carpeta generada por el build (una por día)
│   ├── informe-YYYY-MM-DD.html
│   └── informe-YYYY-MM-DD.pdf
│
├── index.html                        ← Página principal (índice de informes)
├── template.html                     ← Plantilla HTML del informe diario
├── informes.json                     ← Índice de todos los informes publicados
├── logo-ipp-real.png                 ← Logotipo oficial IPP (§6.1)
└── package.json
```

---

## 3. Ficheros de soporte del agente

### 3.1 data/temas-recientes.json

Controla el anti-repetición de noticias (§3.7 y §13 paso 1). El agente lo lee al inicio de cada ejecución y lo actualiza (paso 8) tras el push.

El pipeline de build también lo actualiza automáticamente como seguridad adicional.

**Formato:**

```json
[
  {
    "fecha": "YYYY-MM-DD",
    "titulo": "Título del informe del día",
    "keywords": ["keyword1", "keyword2", "keyword3"]
  }
]
```

**Política de retención:** Solo se conservan entradas de los últimos 30 días. Las entradas anteriores se eliminan automáticamente en cada build.

### 3.2 informes.json

Índice de todos los informes publicados. Sirve como fuente de datos para `index.html`.

```json
[
  {
    "fecha":      "lunes 19 de mayo de 2026",
    "fechaCorta": "19 may 2026",
    "titulo":     "Título del informe",
    "resumen":    "Primeros 220 caracteres del resumen...",
    "link":       "2026-05-19/informe-2026-05-19.html",
    "linkPdf":    "2026-05-19/informe-2026-05-19.pdf",
    "audiencia":  "ambos"
  }
]
```

---

## 4. Script build-informe.mjs

**Ruta:** `scripts/build-informe.mjs`
**Ejecución:** `node scripts/build-informe.mjs YYYY-MM-DD`

### Flujo interno

```
1. Leer data/YYYY-MM-DD.json
2. Validar campos obligatorios → si falla: exit 1 (el commit no se hace)
3. Leer template.html
4. Sustituir placeholders {{...}} con el contenido del JSON
5. Escribir YYYY-MM-DD/informe-YYYY-MM-DD.html
6. Lanzar Puppeteer → PDF A4 con márgenes 15mm/12mm
7. Actualizar informes.json (insertar entrada al inicio, eliminar duplicados)
8. Actualizar data/temas-recientes.json (insertar hoy, limpiar >30 días)
```

### Validaciones que aplica el script (§CHECKLIST-AUDITORIA)

| Validación | Campo | Criterio |
|-----------|-------|---------|
| Campos mínimos | `titulo`, `resumen`, `audiencia`, `prioridades`, `fuentes_verificadas` | Presencia obligatoria |
| Prioridades | `prioridades` | Exactamente 3 elementos |
| Fuentes | `fuentes_verificadas` | Mínimo 3 URLs |
| Estado de alertas | `alertas[].estado` | Solo los 4 valores permitidos |
| Noticias | `nacionales` + `internacionales` | Entre 3 y 5 en total |

Si alguna validación falla, el script termina con `exit 1`, lo que impide el commit y push del build bot, dejando el error visible en el log de GitHub Actions.

### Placeholders de template.html

| Placeholder | Origen |
|------------|--------|
| `{{TITULO}}` | `data.titulo` |
| `{{FECHA_LARGA}}` | Calculada desde la fecha del archivo |
| `{{RESUMEN}}` | `data.resumen` |
| `{{SECCION_NACIONALES}}` | `data.nacionales` |
| `{{SECCION_INTERNACIONALES}}` | `data.internacionales` |
| `{{SECCION_PAPERS}}` | `data.papers` |
| `{{SECCION_HERRAMIENTAS}}` | `data.herramientas` |
| `{{SECCION_ALERTAS}}` | `data.alertas` |
| `{{PRIORIDADES}}` | `data.prioridades` |

---

## 5. GitHub Actions — build-informe.yml

**Trigger:** `push` en `data/*.json` o `workflow_dispatch` con parámetro `fecha`.

**Entorno:** `ubuntu-latest` + Node 20 + Chromium (`/usr/bin/chromium-browser`).

**Pasos:**

1. `actions/checkout@v4` con `fetch-depth: 2` (necesario para `git diff HEAD~1`).
2. `actions/setup-node@v4` con caché npm.
3. `npm install` (instala `puppeteer-core`).
4. `apt-get install chromium-browser`.
5. Detectar fecha: del parámetro manual o del nombre del JSON pusheado.
6. `node scripts/build-informe.mjs $DATE` con `CHROME_PATH=/usr/bin/chromium-browser`.
7. `git add DATE/ informes.json data/temas-recientes.json && git commit && git push`.

**Permisos:** `contents: write` (necesario para el push del bot).

---

## 6. Token de autenticación del agente

El agente remoto necesita un GitHub PAT para hacer `push` de `data/YYYY-MM-DD.json`.

- El PAT está configurado en la URL de origen de la rutina programada.
- **Si el token caduca**, la rutina fallará silenciosamente (sin error visible en GitHub Actions, porque el JSON nunca llega al repo).
- **Diagnóstico:** comparar `last_fired_at` de la rutina con la presencia de un JSON nuevo en `data/`.
- El token tiene permisos de escritura en `ippmccl/IPP-WEB` (scope: `repo`).

---

## 7. Pendiente de implementación — Carrusel

El JSON del agente incluye el bloque `carousel`, `copy_rrss` y `hashtags` (ver `docs/SCHEMA-JSON.md`), pero la generación de los artefactos visuales del carrusel **no está aún implementada** en el pipeline.

Lo que falta:

| Artefacto | Nombre esperado | Estado |
|-----------|----------------|--------|
| 5 imágenes PNG (slides) | `YYYY-MM-DD_N-carrusel.png` | Pendiente |
| PDF 5 páginas (LinkedIn) | `carrusel_YYYY-MM-DD.pdf` | Pendiente |
| Copy RRSS | `YYYY-MM-DD_copy-rrss.txt` | Pendiente |

**Aproximación propuesta para implementar el carrusel:**

1. Añadir `template-carousel.html` con las 5 diapositivas en layout 1:1 (CSS `aspect-ratio: 1`).
2. Añadir `scripts/build-carousel.mjs` que:
   - Lee `carousel`, `copy_rrss` y `hashtags` del JSON.
   - Renderiza cada slide con Puppeteer (`page.screenshot()` a 1080×1080 px).
   - Genera el PDF con `page.pdf()` iterando las 5 páginas.
   - Escribe el `.txt` del copy RRSS.
3. Añadir llamada a `build-carousel.mjs` en `build-informe.yml` tras el paso de build del informe.
4. Incluir los artefactos del carrusel en el `git add` del paso de commit.

---

## 8. Diagnóstico de errores frecuentes

| Síntoma | Causa probable | Acción |
|--------|----------------|--------|
| No aparece JSON nuevo en `data/` | PAT caducado | Renovar token en la rutina |
| Build falla en validación | JSON incompleto (falta `fuentes_verificadas` u otro campo) | Revisar log de Actions y corregir el JSON manualmente |
| PDF se genera vacío o cortado | Puppeteer no esperó a `networkidle0` | Verificar que `waitUntil: 'networkidle0'` está en el script |
| Badge de estado desbordado en PDF | Se usó `Badge Flowable` con título largo | Usar párrafo con estado inline coloreado (§7.9) |
| `informes.json` desincronizado con GitHub | Mirror local desactualizado | Hacer pull desde GitHub antes de modificar localmente |
