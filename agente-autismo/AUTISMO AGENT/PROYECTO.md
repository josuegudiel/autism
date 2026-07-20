# Brújula TEA — Estado del proyecto (documento de continuidad)

> **Para retomar en una nueva sesión:** lee este archivo y `README.md`. Resume TODO lo hecho, las decisiones y lo pendiente, para que no se pierda información entre sesiones. Última actualización: 2026-06-21.

---

## 1. Qué es y para quién
**Brújula TEA**: PWA **gratuita, en español, sin ánimo de lucro** para familias de niños con autismo (TEA). Su cuña/diferenciador es la **"capa de confianza"** que casi nadie ofrece junta:
1. **Información basada en evidencia** (con niveles 🟢🟡🔴 y fuentes).
2. **Detector de pseudociencia** (consulta de terapias/afirmaciones).
3. **Seguimiento personalizado** del niño ("¿qué le funciona a mi hijo?"), datos **solo en el dispositivo**.
4. **Asistente de IA** que cita fuentes y **nunca** recomienda algo peligroso.

**Contexto/origen:** el creador es padre/madre de un niño de ~4 años con sospecha de autismo. Llegó aquí tras investigar un informe de pseudociencia (EpicGen Labs / test de cabello "epigenético") que casi compra; al descubrir el fraude, decidió construir la herramienta de confianza que le hubiera gustado tener. **No piensa cobrar**; busca ONG/donantes/filantropía para sostenerlo.

---

## 2. Estado actual — MVP construido y verificado ✅
Las 4 piezas están **funcionando y probadas en navegador** (capturas verificadas a 375px):
- 📚 Centro de evidencia: 16 tarjetas, niveles + 18 fuentes enlazadas.
- 🚩 Detector: 9 fichas (quelación, MMS, test de cabello, células madre, vacunas, etc.); "quelación" → 🔴 Evítalo.
- 📈 Rastreador: registro persistente en IndexedDB (sobrevive recarga), gráfica + historial, **solo local**.
- 💬 Asistente: chat en **modo demo** (responde con fuentes); IA real de Claude **aún NO conectada**.
Es PWA instalable (manifest + service worker, funciona offline para el contenido).

## 3. Decisiones tomadas (confirmadas por el usuario)
- **Alcance:** las 4 piezas, versión ligera.
- **Plataforma:** PWA **estática sin build** (porque **Node.js NO está instalado** en la Mac).
- **IA:** interfaz + modo demo ahora; **conectar Claude después** (stub listo en `api/chat.ts`).
- **Datos del niño:** **solo en el dispositivo** (IndexedDB), sin cuentas ni nube.
- **Modelo de negocio:** gratuito / sin ánimo de lucro, financiado por donantes/ONG.

## 4. Arquitectura y archivos
```
web/        PWA estática (esto se publica)
  index.html app.js styles.css manifest.webmanifest sw.js
  assets/ icon.svg icon-maskable.svg
  content/ evidencia.json banderas-rojas.json fuentes.json asistente-demo.json
api/chat.ts            stub serverless de Claude (listo para activar)
api/package.json
shared/knowledge-base.json   evidencia + reglas de seguridad (base del agente)
serve.py              servidor local (python3 serve.py → :8099)
README.md             cómo correr/publicar/activar IA
PROYECTO.md           este documento de estado
```
**Privacidad:** `Report-*.pdf` (informe del niño) y `.claude/settings.local.json` están en `.gitignore` (no se publican). Git inicializado; **aún sin commit** (esperando al usuario).

## 5. Cómo correr
```bash
cd "/Users/macbookpro/Desktop/DIEGO ALVARADO"
python3 serve.py      # → http://127.0.0.1:8099
```
(El preview de Claude Code NO puede servirlo: macOS bloquea el acceso del sandbox a la carpeta Escritorio; se verificó copiando a /tmp.)

## 6. Cómo activar la IA real (pendiente)
1. Crear API key de Anthropic (console.anthropic.com), guardarla como secreto del servidor.
2. Desplegar `api/chat.ts` (Vercel/Cloudflare/Netlify), definir env `ANTHROPIC_API_KEY`. Usa `claude-opus-4-8`, streaming, prompt caching, y system prompt de seguridad desde `shared/knowledge-base.json`.
3. En `web/app.js` cambiar `demoReply(text)` por `fetch('/api/chat', …)`. Detalles en README.

---

## 7. Hallazgos clave de la investigación (resumen)

### Mercado / competidores (verificado en pasadas previas)
- **Hueco confirmado:** nadie junta las 4 piezas (evidencia + anti-pseudociencia + seguimiento + IA), y casi nada es **gratuito + en español**.
- **Español:** el referente es **Autismo Diario** (estático, sin app/IA/seguimiento). Apps en español son de nicho (CAA/educación), gratuitas/ONG (Otsimo, Proyecto DANE, OTTAA). No hay un "agente IA de autismo en español" consolidado.
- **Inglés (esta pasada):**
  - *Información basada en evidencia (gratis, pero estática):* **Autism Speaks 100 Day Kit** (gratis, **EN y ES**, niños ≤4 años, 8 temas) → comparación directa, pero es un kit estático, sin app/IA/detector/seguimiento. **AAP HealthyChildren.org** (gratis, desmiente mitos: vacunas no causan autismo, no a leucovorina de rutina). **National Autism Center** — "A Parent's Guide to Evidence-based Practice and Autism" (PDF gratis; **sin** apps/IA/seguimiento/detector).
  - *Capa anti-pseudociencia (el análogo más cercano):* **ASAT — Association for Science in Autism Treatment** (asatonline.org): synopses de investigación, "Media Watch", guía "Savvy Consumer", fichas de tratamientos (incl. bleach/MMS). **Es justo tu detector, pero en web estática y en inglés.** A imitar y posible aliado/fuente.
  - *Apps/IA (comerciales, sin capa de confianza):* Cognoa/Canvas Dx (diagnóstico, con receta, de pago), AnswersNow (ABA por seguro EE.UU.), y productos tipo "NotAlone" (apoyo a padres con IA, comercial/suscripción). Ninguno combina evidencia + anti-pseudociencia + seguimiento + IA gratis.
- **Conclusión:** la combinación **gratis + español + 4 piezas + anti-desinformación** sigue vacía. Ese es el posicionamiento.

### Financiación sin ánimo de lucro (a profundizar — la pasada tocó el límite)
- **Por qué encaja con donantes:** gratis, basado en evidencia, anti-desinformación, y **fundador con experiencia vivida** → perfil muy financiable.
- **Vías a explorar:** subvenciones de autismo (Organization for Autism Research, Autism Science Foundation, Autism Speaks); filantropía de IA/tech-para-el-bien (Patrick J. McGovern Foundation, Mozilla, Google.org, Fast Forward — acelerador de tech-nonprofits); para empezar **sin ser ONG todavía**: patrocinio fiscal (Open Collective, Hack Club Bank/HCB ~7% aprox — verificar) + crowdfunding (Donorbox/GoFundMe).
- **Qué piden los donantes:** teoría del cambio, base de evidencia, métricas de impacto, alianzas (p. ej. ASAT, clínicas/ONG de autismo en LatAm), y la historia del fundador.

---

## 8. Pendiente / próximos pasos
- [ ] **Terminar la investigación de financiación** (se cortó por límite de créditos; reanudar la 2ª mitad: fondos concretos, montos, fechas, casos a imitar).
- [ ] **Pitch para donantes** (1 página) + teoría del cambio + métricas de impacto.
- [ ] **Activar la IA** real (key + desplegar `api/chat.ts` + cambiar `demoReply`).
- [ ] **Publicar** la PWA (Netlify/GitHub Pages/Cloudflare).
- [ ] **Posible:** app nativa; sincronización en la nube (cuidado legal con datos de menores: COPPA/GDPR/LGPD).
- [ ] **Primer commit** de git cuando el usuario lo pida.
- [ ] Ampliar contenido (más fichas de detector, más temas de evidencia) — todo es JSON.

## 9. Historial de investigación hecha (deep-research)
1. Análisis del informe PDF (EpicGen Labs / test de cabello) — pseudociencia.
2. Credibilidad de EpicGen Labs / Mike Mery — sin respaldo, señales de alarma.
3. Cómo se diagnostica el autismo (fuentes primarias).
4. Por qué subió la prevalencia (artefacto de medición; mitos desacreditados).
5. Biología/genética + qué intervenciones funcionan + tratamientos a evitar.
6. Panorama competitivo (apps/IA de autismo) — pasada 1 y 2 (español/LatAm).
7. Panorama en inglés + financiación sin ánimo de lucro (esta pasada, parcial).

### 9.1 Biblioteca de autismo — `research/biblioteca-autismo.md` (✅ MAPA COMPLETO)
Investigación temática sistemática, dominio por dominio, con hallazgos verificados (3 votos adversariales) + fuentes enlazadas + nota "Para la app" en cada uno. **22 dominios cubiertos:**
- **Mapa principal A–O (15):** A comorbilidades · B pseudociencia · C niñas/mujeres y adultos · D comunicación/CAA · E sensorial/meltdowns · F medicación · G salud mental y seguridad · H educación · I adolescencia/transición · J neurodiversidad · K genética/sindrómico · L intervenciones comparadas · M acceso LatAm · N bienestar de cuidadores · O señales tempranas por edad.
- **Ronda 2 P–V (7):** P alimentación selectiva · Q epilepsia · R TCC adaptada (ansiedad) · S educación sexual/privacidad · T empleo con apoyo · U TDAH co-ocurrente · V lenguaje (identity-first) + NCAEP 28 EBPs.
- **Ronda 3 W–AK (13, temas prácticos):** W sueño · X intervención temprana (NDBI/ESDM) · Y TO e integración sensorial · Z conductas desafiantes/PBS · AA problemas GI · AB regulación emocional/alexitimia · AC habilidades sociales (PEERS, anti-masking) · AD cómo explicar el autismo · AE seguridad (wandering/pica) · AF discapacidad intelectual co-ocurrente · AG visitas médicas/dentales adaptadas · AH escuela: inclusión/derechos (CDPD, PIAR) · AK estigma y apoyo entre padres. **AI tecnología/pantallas = ✅✅ VERIFICADO (3 votos)**.
- **Estado de verificación:** A–O verificados (3 votos) · P–T verificados · **U, V y W–AK = síntesis desde fuentes canónicas** (workflow se cayó por límite de sesión) → **re-verificar con deep-research** (el límite ya se reinició; AI ya se re-verificó con éxito). Método honesto: cada sección de síntesis lleva su ⚠️ nota.
- **Siguiente paso sugerido:** ya hay **36 temas** cubiertos → **volcar la biblioteca al Centro de evidencia** de la app y usar las **28 EBPs del NCAEP** como vara en el Detector. (El usuario pidió seguir alimentando el conocimiento antes de construir.)

El plan de implementación aprobado está en `~/.claude/plans/haz-el-plan-y-jiggly-puddle.md`.
