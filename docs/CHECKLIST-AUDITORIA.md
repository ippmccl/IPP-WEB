# CHECKLIST DE AUDITORÍA — Build IPP Informe Diario

Cada ítem enlaza con la sección de `docs/INSTRUCCIONES-AGENTE.md` que lo exige.
Las verificaciones marcadas con **[BUILD]** las ejecuta automáticamente `scripts/build-informe.mjs`.
Las marcadas con **[AGENTE]** las debe cumplir el agente antes de hacer push.
Las marcadas con **[MANUAL]** requieren revisión humana periódica.

---

## A. Verificación de fuentes (§2)

| # | Verificación | Tipo | Criterio de fallo |
|---|-------------|------|-------------------|
| A1 | Toda noticia es de 2025 o 2026 | [AGENTE] | Fecha de publicación anterior a 2025 |
| A2 | Toda URL ha sido abierta con WebFetch y devuelve contenido válido | [AGENTE] | URL que redirige a 404, paywall o página de error |
| A3 | Todo DOI ha sido verificado en `https://doi.org/{doi}` | [AGENTE] | DOI que no resuelve o apunta a otra publicación |
| A4 | `fuentes_verificadas` contiene mínimo 3 URLs | [BUILD] | Array con menos de 3 elementos o campo ausente |
| A5 | Ninguna noticia copia literalmente frases de la fuente | [AGENTE] | Bloques de texto idénticos a la fuente sin comillas ni atribución |
| A6 | Las noticias de temática legal o normativa citan legislación española (Ley 41/2002, LOPDGDD, RGPD) | [AGENTE] | Cita de normativa de otro país hispanohablante |

---

## B. Control de estado normativo (§3)

| # | Verificación | Tipo | Criterio de fallo |
|---|-------------|------|-------------------|
| B1 | Cada alerta tiene uno de los cuatro estados permitidos | [BUILD] | `estado` con valor distinto de `APROBADO`, `EN TRAMITACIÓN`, `EN DESARROLLO`, `PROPUESTA` |
| B2 | Medidas sin normativa publicada no se presentan como implementadas | [AGENTE] | Frases como «se crea», «establece», «entra en vigor» sin referencia a BOE |
| B3 | Los impactos usan lenguaje condicional | [AGENTE] | Uso de «supondrá», «obligará», «garantiza», «cambiará» sin condición explícita |
| B4 | Hechos confirmados y pendientes aparecen en frases separadas | [AGENTE] | Una misma frase mezcla lo confirmado con lo especulativo |
| B5 | Planes estratégicos descritos como marcos en fase de implementación | [AGENTE] | Uso de «se crea» o «establece» para un plan sin norma publicada |

---

## C. Estructura y contenido del JSON (§7, §8, §13)

| # | Verificación | Tipo | Criterio de fallo |
|---|-------------|------|-------------------|
| C1 | Campo `titulo` presente y no vacío | [BUILD] | Campo ausente o `""` |
| C2 | Campo `resumen` presente (4-6 líneas) | [BUILD] | Campo ausente o menos de 50 caracteres |
| C3 | Campo `audiencia` es `ambos`, `clinico` o `neuropsicologia` | [BUILD] | Cualquier otro valor |
| C4 | Total de noticias (nacionales + internacionales) entre 3 y 5 | [BUILD] | Menos de 3 o más de 5 noticias en total |
| C5 | `prioridades` tiene exactamente 3 elementos | [BUILD] | Array con distinto número de elementos |
| C6 | Cada prioridad tiene `titulo` y `descripcion` | [BUILD] | Campo faltante en algún elemento |
| C7 | Bloque `carousel` completo (6 claves: noticia + 5 slides) | [AGENTE] | Falta algún slide o la clave `noticia_seleccionada` |
| C8 | `slide1.titular` tiene máximo 10 palabras | [AGENTE] | Titular con más de 10 palabras |
| C9 | Cada slide 2-4 tiene máximo 3 puntos de máximo 15 palabras | [AGENTE] | Punto con más de 15 palabras o array con más de 3 elementos |
| C10 | `slide5` incluye `mensaje_autoridad`, `fuente_apa` y `cta` | [AGENTE] | Falta alguna de las tres claves |
| C11 | `fuente_apa` en slide 5 sigue formato APA 7 | [AGENTE] | Referencia incompleta o en formato distinto de APA |
| C12 | `hashtags` contiene exactamente 5 elementos que empiezan por `#` | [BUILD] | Array con distinto número o elementos sin `#` |
| C13 | `copy_rrss` presente (1-2 líneas) | [BUILD] | Campo ausente o vacío |

---

## D. Redacción institucional (§4, §5)

| # | Verificación | Tipo | Criterio de fallo |
|---|-------------|------|-------------------|
| D1 | Todo el texto en tercera persona | [AGENTE] | Aparición de «tus», «tu», «puedes», «aquí tienes» |
| D2 | Sin lenguaje de asistente o promocional | [AGENTE] | Frases como «espero que te sirva», «te recomiendo», «nuestro servicio» |
| D3 | Sin referencias temporales del proceso (mañana, esta tarde, acabo de) | [AGENTE] | Mención a cuándo se recopiló la información |
| D4 | Sin términos meta-comunicativos visibles | [AGENTE] | Aparición de «conclusión», «llamada a la acción», «CTA», «cierre» en el texto publicado |
| D5 | Español de España: sin «celular», «computador», «ahorita» ni giros latinoamericanos | [AGENTE] | Cualquier término característico del español de América |
| D6 | Siglas definidas en su primera aparición | [AGENTE] | Sigla usada sin expansión en el texto donde aparece por primera vez |
| D7 | Acentuación correcta de términos técnicos (microglía, psicopatología, etc.) | [AGENTE] | Error de tilde en término técnico |

---

## E. Anti-repetición (§3.7)

| # | Verificación | Tipo | Criterio de fallo |
|---|-------------|------|-------------------|
| E1 | El tema principal no coincide con ningún tema de los últimos 30 días en `temas-recientes.json` | [AGENTE] | Solape temático con una entrada de los últimos 30 días |
| E2 | `data/temas-recientes.json` actualizado tras cada ejecución exitosa | [BUILD] | El archivo no registra el tema del día tras un build correcto |

---

## F. Identidad visual y nomenclatura (§6, §10)

| # | Verificación | Tipo | Criterio de fallo |
|---|-------------|------|-------------------|
| F1 | El HTML generado incluye el logo `logo-ipp-real.png` en la cabecera | [BUILD] | Tag `<img>` ausente o ruta incorrecta |
| F2 | El pie de página del HTML contiene el copyright completo | [BUILD] | Footer sin `© 2026 IPP \| Instituto Politécnico de Psicología` |
| F3 | El JSON se nombra `data/YYYY-MM-DD.json` | [AGENTE] | Nombre de archivo con formato distinto |
| F4 | El HTML se nombra `YYYY-MM-DD/informe-YYYY-MM-DD.html` | [BUILD] | Ruta o nombre generado incorrectamente |
| F5 | El PDF se nombra `YYYY-MM-DD/informe-YYYY-MM-DD.pdf` | [BUILD] | Ruta o nombre generado incorrectamente |

---

## G. Inventario de entregables (§11.4)

| Artefacto | Nombre esperado | Generado por | Estado actual |
|-----------|----------------|-------------|---------------|
| JSON diario | `data/YYYY-MM-DD.json` | Agente | ✅ Implementado |
| HTML informe | `YYYY-MM-DD/informe-YYYY-MM-DD.html` | Build script | ✅ Implementado |
| PDF informe | `YYYY-MM-DD/informe-YYYY-MM-DD.pdf` | Build script (Puppeteer) | ✅ Implementado |
| Índice informes | `informes.json` | Build script | ✅ Implementado |
| Historial temas | `data/temas-recientes.json` | Build script | ✅ Implementado |
| PNG slides (×5) | `YYYY-MM-DD_N-carrusel.png` | Pendiente | ⏳ No implementado |
| PDF carrusel | `carrusel_YYYY-MM-DD.pdf` | Pendiente | ⏳ No implementado |
| Copy RRSS | `YYYY-MM-DD_copy-rrss.txt` | Pendiente | ⏳ No implementado |

---

## H. Ejecución de la auditoría en CI

El script `scripts/build-informe.mjs` ejecuta automáticamente los controles **[BUILD]** antes de generar ningún artefacto. Si alguno falla:

1. El script termina con código de salida `1`.
2. GitHub Actions marca el build como **failed**.
3. No se genera HTML ni PDF.
4. No se hace commit ni push de artefactos.
5. El log de Actions muestra el mensaje de error concreto.

**Para ver los errores de validación:** ir a `https://github.com/ippmccl/IPP-WEB/actions` y abrir el build del día.
