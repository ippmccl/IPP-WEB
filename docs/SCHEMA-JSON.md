# SCHEMA-JSON — Estructura del JSON diario del agente IPP

Documento derivado 1:1 de `docs/INSTRUCCIONES-AGENTE.md`.
El agente **debe validar** su JSON contra este esquema antes de hacer `push` al repositorio (§13, paso 6).
El pipeline de GitHub Actions aplica la misma validación como segunda barrera (ver `scripts/build-informe.mjs`).

---

## 1. Reglas generales

| Regla | Referencia |
|-------|-----------|
| Solo contenido de 2025 o 2026 | §2.1 |
| Todas las URLs verificadas con WebFetch antes de incluirlas | §2.3 |
| Todos los DOIs verificados en `https://doi.org/{doi}` | §2.3 |
| Mínimo 3 URLs en `fuentes_verificadas` | §2.3 |
| Exactamente 3 elementos en `prioridades` | §7.6 |
| Los `alertas[].estado` solo pueden ser los cuatro valores fijos | §3 |
| Total de noticias (nacionales + internacionales): entre 3 y 5 | §7.3 |
| Lenguaje condicional en impactos normativos (§3.3) | §3.3 |

---

## 2. Estructura completa del JSON

```
{
  "titulo":             string        — Titular del informe del día
  "resumen":            string        — Resumen rápido (4-6 líneas)
  "audiencia":          string        — enum: "ambos" | "clinico" | "neuropsicologia"

  "nacionales":         Noticia[]     — Noticias de ámbito nacional (0-3)
  "internacionales":    Noticia[]     — Noticias de ámbito internacional (0-3)

  "papers":             Paper[]       — Publicaciones científicas (0-N)
  "herramientas":       Herramienta[] — Instrumentos o tests (0-N)
  "alertas":            Alerta[]      — Alertas normativas (0-N)

  "prioridades":        Prioridad[3]  — Exactamente 3 prioridades del día

  "fuentes_verificadas": string[]     — URLs verificadas con WebFetch (mínimo 3)

  "carousel":           Carousel      — Bloque para las 5 diapositivas
  "copy_rrss":          string        — Copy RRSS (1-2 líneas)
  "hashtags":           string[5]     — Exactamente 5 hashtags
}
```

---

## 3. Definición de cada tipo

### 3.1 Noticia

```
{
  "tipo":     string  — Etiqueta temática en mayúsculas:
                        "CLÍNICA" | "INVESTIGACIÓN" | "SALUD PÚBLICA"
                        | "NORMATIVA" | "HERRAMIENTA" | "NEUROCIENCIA"
  "titular":  string  — Titular periodístico conciso
  "cuerpo":   string  — Explicación de hechos + impacto sectorial
                        (sin copiar literalmente de la fuente — §2.5)
}
```

### 3.2 Paper

```
{
  "apa":        string  — Referencia completa en formato APA 7
  "doi":        string  — DOI verificado en doi.org (solo la parte "10.xxx/...")
  "hallazgo":   string  — Hallazgos clave en terminología científica
  "implicacion": string — Implicación directa para la práctica clínica española
}
```

### 3.3 Herramienta

```
{
  "nombre":      string  — Nombre oficial del instrumento o herramienta
  "descripcion": string  — Descripción funcional, validación en España, acceso
}
```

### 3.4 Alerta

```
{
  "estado":      string  — SOLO estos cuatro valores exactos (§3):
                           "APROBADO" | "EN TRAMITACIÓN"
                           | "EN DESARROLLO" | "PROPUESTA"
  "titulo":      string  — Nombre de la norma o medida
  "descripcion": string  — Descripción con lenguaje condicional obligatorio (§3.3)
}
```

### 3.5 Prioridad

```
{
  "titulo":      string  — Título de la prioridad (acción concreta)
  "descripcion": string  — Desarrollo de la prioridad para el profesional
}
```

### 3.6 Carousel

```
{
  "noticia_seleccionada": string  — Título de la noticia principal elegida (§8.1)

  "slide1": {
    "titular":   string  — Gancho profesional (máximo 10 palabras — §8.2)
    "subtitulo": string  — Subtítulo complementario breve
  }

  "slide2": { "puntos": string[1-3] }  — Máx. 3 puntos, máx. 15 palabras/punto
  "slide3": { "puntos": string[1-3] }
  "slide4": { "puntos": string[1-3] }

  "slide5": {
    "mensaje_autoridad": string  — Mensaje de autoridad profesional (§8.2)
    "fuente_apa":        string  — Fuente en APA (sin etiqueta "formato APA" — §8.2)
    "cta":               string  — Llamada a la acción de RRSS (§8.2)
                                   Ej: "guárdalo", "compártelo",
                                   "síguenos en @IPP.Psicologia"
  }
}
```

---

## 4. JSON Schema (draft 7) — para validación automática

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "IPP Informe Diario",
  "type": "object",
  "required": [
    "titulo", "resumen", "audiencia",
    "prioridades", "fuentes_verificadas",
    "carousel", "copy_rrss", "hashtags"
  ],
  "additionalProperties": false,
  "properties": {
    "titulo":  { "type": "string", "minLength": 10 },
    "resumen": { "type": "string", "minLength": 50 },
    "audiencia": {
      "type": "string",
      "enum": ["ambos", "clinico", "neuropsicologia"]
    },
    "nacionales": {
      "type": "array",
      "items": { "$ref": "#/definitions/Noticia" }
    },
    "internacionales": {
      "type": "array",
      "items": { "$ref": "#/definitions/Noticia" }
    },
    "papers": {
      "type": "array",
      "items": { "$ref": "#/definitions/Paper" }
    },
    "herramientas": {
      "type": "array",
      "items": { "$ref": "#/definitions/Herramienta" }
    },
    "alertas": {
      "type": "array",
      "items": { "$ref": "#/definitions/Alerta" }
    },
    "prioridades": {
      "type": "array",
      "items": { "$ref": "#/definitions/Prioridad" },
      "minItems": 3,
      "maxItems": 3
    },
    "fuentes_verificadas": {
      "type": "array",
      "items": { "type": "string", "format": "uri" },
      "minItems": 3
    },
    "carousel": { "$ref": "#/definitions/Carousel" },
    "copy_rrss": { "type": "string", "minLength": 10 },
    "hashtags": {
      "type": "array",
      "items": { "type": "string", "pattern": "^#" },
      "minItems": 5,
      "maxItems": 5
    }
  },
  "definitions": {
    "Noticia": {
      "type": "object",
      "required": ["tipo", "titular", "cuerpo"],
      "properties": {
        "tipo":    { "type": "string" },
        "titular": { "type": "string", "minLength": 10 },
        "cuerpo":  { "type": "string", "minLength": 50 }
      }
    },
    "Paper": {
      "type": "object",
      "required": ["apa", "doi", "hallazgo", "implicacion"],
      "properties": {
        "apa":        { "type": "string" },
        "doi":        { "type": "string", "pattern": "^10\\." },
        "hallazgo":   { "type": "string" },
        "implicacion":{ "type": "string" }
      }
    },
    "Herramienta": {
      "type": "object",
      "required": ["nombre", "descripcion"],
      "properties": {
        "nombre":      { "type": "string" },
        "descripcion": { "type": "string" }
      }
    },
    "Alerta": {
      "type": "object",
      "required": ["estado", "titulo", "descripcion"],
      "properties": {
        "estado": {
          "type": "string",
          "enum": ["APROBADO", "EN TRAMITACIÓN", "EN DESARROLLO", "PROPUESTA"]
        },
        "titulo":      { "type": "string" },
        "descripcion": { "type": "string" }
      }
    },
    "Prioridad": {
      "type": "object",
      "required": ["titulo", "descripcion"],
      "properties": {
        "titulo":      { "type": "string" },
        "descripcion": { "type": "string" }
      }
    },
    "Carousel": {
      "type": "object",
      "required": ["noticia_seleccionada", "slide1", "slide2", "slide3", "slide4", "slide5"],
      "properties": {
        "noticia_seleccionada": { "type": "string" },
        "slide1": {
          "type": "object",
          "required": ["titular", "subtitulo"],
          "properties": {
            "titular":   { "type": "string" },
            "subtitulo": { "type": "string" }
          }
        },
        "slide2": { "$ref": "#/definitions/SlidePuntos" },
        "slide3": { "$ref": "#/definitions/SlidePuntos" },
        "slide4": { "$ref": "#/definitions/SlidePuntos" },
        "slide5": {
          "type": "object",
          "required": ["mensaje_autoridad", "fuente_apa", "cta"],
          "properties": {
            "mensaje_autoridad": { "type": "string" },
            "fuente_apa":        { "type": "string" },
            "cta":               { "type": "string" }
          }
        }
      }
    },
    "SlidePuntos": {
      "type": "object",
      "required": ["puntos"],
      "properties": {
        "puntos": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "maxItems": 3
        }
      }
    }
  }
}
```

---

## 5. Ejemplo mínimo válido

```json
{
  "titulo": "Nuevas evidencias sobre el papel de la microglía en los trastornos depresivos",
  "resumen": "Un metaanálisis publicado en Nature Neuroscience en 2026 consolida el papel de la neuroinflamación mediada por la microglía como factor patogénico en la depresión mayor resistente al tratamiento. El estudio analiza biomarcadores inflamatorios en 12.000 pacientes europeos y abre vías para el desarrollo de marcadores diagnósticos objetivos.",
  "audiencia": "ambos",
  "nacionales": [
    {
      "tipo": "INVESTIGACIÓN",
      "titular": "El CIBERSAM publica un protocolo de evaluación neuroinflamatoria en depresión resistente",
      "cuerpo": "El Centro de Investigación Biomédica en Red de Salud Mental ha publicado un protocolo de evaluación de biomarcadores inflamatorios para pacientes con depresión resistente al tratamiento..."
    }
  ],
  "internacionales": [
    {
      "tipo": "NEUROCIENCIA",
      "titular": "Metaanálisis en Nature Neuroscience vincula microglía y depresión mayor",
      "cuerpo": "Un metaanálisis con datos de 12.000 participantes europeos concluye que la activación microglial representa un factor patogénico independiente en la depresión mayor resistente..."
    }
  ],
  "papers": [
    {
      "apa": "Khandaker, G. M., et al. (2026). Microglial activation and treatment-resistant depression. Nature Neuroscience, 29(2), 145–158.",
      "doi": "10.1038/s41593-026-01234-5",
      "hallazgo": "La activación microglial se asocia con una reducción del 42% en la respuesta a antidepresivos en pacientes con depresión mayor.",
      "implicacion": "Los psicólogos clínicos deben considerar la derivación a neuropsiquiatría cuando el paciente presente biomarcadores inflamatorios elevados y ausencia de respuesta tras dos líneas de tratamiento."
    }
  ],
  "herramientas": [],
  "alertas": [
    {
      "estado": "EN TRAMITACIÓN",
      "titulo": "Ley General de Salud Mental",
      "descripcion": "El proyecto de Ley General de Salud Mental continúa su tramitación parlamentaria. El texto prevé la inclusión de biomarcadores inflamatorios en los protocolos diagnósticos del Sistema Nacional de Salud, aunque su aplicación concreta aún no está definida."
    }
  ],
  "prioridades": [
    {
      "titulo": "Actualizar el protocolo de evaluación en depresión resistente",
      "descripcion": "Incorporar la solicitud de marcadores inflamatorios (PCR-us, IL-6) en la historia clínica de pacientes con depresión mayor que no responden a dos líneas de tratamiento."
    },
    {
      "titulo": "Revisar criterios de derivación a neuropsiquiatría",
      "descripcion": "Establecer un umbral claro de derivación cuando los biomarcadores inflamatorios superen los valores de referencia publicados por el CIBERSAM."
    },
    {
      "titulo": "Seguir la tramitación de la Ley General de Salud Mental",
      "descripcion": "Monitorizar el desarrollo normativo de la ley, especialmente las disposiciones relativas a la integración de marcadores biológicos en la práctica clínica pública."
    }
  ],
  "fuentes_verificadas": [
    "https://www.nature.com/articles/s41593-026-01234-5",
    "https://www.cibersam.es/noticias/protocolo-neuroinflamacion-2026",
    "https://doi.org/10.1038/s41593-026-01234-5"
  ],
  "carousel": {
    "noticia_seleccionada": "Metaanálisis en Nature Neuroscience vincula microglía y depresión mayor",
    "slide1": {
      "titular": "La microglía, nuevo objetivo en la depresión resistente",
      "subtitulo": "Metaanálisis en Nature Neuroscience · 12.000 pacientes europeos"
    },
    "slide2": {
      "puntos": [
        "La microglía regula la respuesta inflamatoria en el sistema nervioso central.",
        "Su activación crónica reduce la eficacia de los antidepresivos en un 42%.",
        "El hallazgo es independiente de otros factores de riesgo conocidos."
      ]
    },
    "slide3": {
      "puntos": [
        "Biomarcadores como la PCR-us y la IL-6 permiten identificar este perfil.",
        "El CIBERSAM ha publicado un protocolo de evaluación validado en España.",
        "La derivación temprana a neuropsiquiatría mejora el pronóstico clínico."
      ]
    },
    "slide4": {
      "puntos": [
        "Incluir la solicitud de marcadores inflamatorios en la historia clínica inicial.",
        "Aplicar el protocolo del CIBERSAM en depresión resistente a dos líneas.",
        "Integrar esta evidencia en los criterios de derivación internos."
      ]
    },
    "slide5": {
      "mensaje_autoridad": "La neuroinflamación abre una nueva vía diagnóstica en depresión resistente.",
      "fuente_apa": "Khandaker, G. M., et al. (2026). Microglial activation and treatment-resistant depression. Nature Neuroscience, 29(2), 145–158. https://doi.org/10.1038/s41593-026-01234-5",
      "cta": "Guárdalo y compártelo con tu equipo · síguenos en @IPP.Psicologia"
    }
  },
  "copy_rrss": "La microglía modifica la respuesta a antidepresivos. Nueva evidencia con 12.000 pacientes que cambia la evaluación en depresión resistente.",
  "hashtags": ["#Neuropsicología", "#SaludMental", "#Depresión", "#Neuroinflamación", "#PsicologíaClínica"]
}
```

---

## 6. Campos que el pipeline usa actualmente

El script `scripts/build-informe.mjs` usa estos campos para generar el HTML y PDF del informe:

| Campo JSON | Placeholder en template.html |
|-----------|------------------------------|
| `titulo` | `{{TITULO}}` |
| `resumen` | `{{RESUMEN}}` |
| `nacionales` | `{{SECCION_NACIONALES}}` |
| `internacionales` | `{{SECCION_INTERNACIONALES}}` |
| `papers` | `{{SECCION_PAPERS}}` |
| `herramientas` | `{{SECCION_HERRAMIENTAS}}` |
| `alertas` | `{{SECCION_ALERTAS}}` |
| `prioridades` | `{{PRIORIDADES}}` |
| `audiencia` | guardado en `informes.json` |

Los campos `carousel`, `copy_rrss`, `hashtags` y `fuentes_verificadas` son validados por el pipeline pero **la generación de imágenes PNG y PDF del carrusel está pendiente de implementación** (ver `docs/PIPELINE-TECNICO.md`).
