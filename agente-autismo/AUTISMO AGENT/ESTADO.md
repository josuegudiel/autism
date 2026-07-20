# Estado del proyecto — Brújula TEA 🧭

_Última actualización: 2026-07-08_

Este documento explica **qué está hecho** y **qué falta**, para quien retome el proyecto (o quiera colaborar/apoyar).

## En una frase

**Brújula TEA** es una PWA gratuita en español para familias de niños con autismo: junta **información basada en evidencia**, un **detector de pseudociencia**, un **seguimiento personal** (privado, en el dispositivo) y un **asistente de IA** que cita fuentes y nunca recomienda algo peligroso. Sin ánimo de lucro.

---

## ✅ Lo que ya está hecho

### La app (MVP funcional)
- **PWA estática** instalable y con contenido offline (service worker + manifest). No requiere build ni Node para probarse (`python3 serve.py`).
- **Pieza 1 — Centro de evidencia**: tarjetas con niveles 🟢/🟡/🔴 y fuentes enlazadas (`web/content/evidencia.json`).
- **Pieza 2 — Detector de pseudociencia**: 15 fichas (quelación, MMS, test de cabello/bioresonancia, dietas-cura, cámara hiperbárica, secretina, comunicación facilitada, etc.) con veredicto + porqué + fuentes (`web/content/banderas-rojas.json`).
- **Pieza 3 — Seguimiento de mi hijo**: registro local con **IndexedDB** (los datos **no salen del dispositivo**; sin cuentas ni nube).
- **Pieza 4 — Asistente**: interfaz de chat completa en **modo demostración** + backend **stub** (`api/chat.ts`) con las **reglas de seguridad** ya escritas (no diagnostica, no da dosis, nunca recomienda quelación/MMS/etc., cita fuentes, deriva a profesionales).
- **Base de conocimiento** del agente (`shared/knowledge-base.json`).
- **README** con cómo correr, publicar y "encender" la IA real.

### La biblioteca de investigación (`research/biblioteca-autismo.md`)
Un respaldo documental grande y citado que **alimentará el contenido de la app**: **~45 temas** cubiertos dominio por dominio, cada uno con hallazgos, **fuentes enlazadas**, etiquetas de fiabilidad y una nota **"Para la app"**.
- **~24 temas verificados** con verificación adversarial de 3 votos (marcados ✅✅).
- **~21 temas en "síntesis desde fuentes canónicas"** (marcados ⚠️) — redactados desde fuentes establecidas cuando el motor de verificación estaba limitado; **pendientes de re-verificar**.

---

## ⏳ / 📋 Lo que falta

| Prioridad | Tarea | Notas |
|---|---|---|
| 🔴 **Alta** | **Volcar la biblioteca (45 temas) al Centro de evidencia y al Detector** | Hoy la app tiene ~16 tarjetas de evidencia y 15 del detector; la biblioteca tiene mucho más (comorbilidades, niñas/mujeres, sueño, señales por edad, seguridad, derechos, etc.). Es el paso que más valor añade. |
| 🟠 **Alta** | **Activar la IA real de Claude** | El asistente está en modo demo. Ver README → "Encender la IA real" (poner `ANTHROPIC_API_KEY` en el servidor + cambiar el stub por la llamada real). |
| 🟡 **Media** | **Re-verificar los ~21 temas de síntesis** | Subirlos de "síntesis" a "verificado 3 votos" (ya se hizo con Sueño, Intervención temprana, Pantallas y Cannabis/CBD). |
| 🟡 **Media** | **Publicar la app** | `web/` se sube tal cual a Netlify / GitHub Pages / Cloudflare Pages (sin build). |
| 🟢 **Baja** | **Pulido**: iconos/branding definitivos, pase de accesibilidad (a11y), revisión de textos | Los iconos actuales son SVG de marcador de posición. |
| 🟢 **Baja** | **Materiales para ONG/donantes** | Pitch + datos de impacto (empleo, seguridad, acceso en LatAm) que ya están en la biblioteca. |

---

## 📚 Detalle de la biblioteca (mapa de temas)

**Mapa principal A–O** (verificado ✅✅): comorbilidades · pseudociencia · niñas/mujeres y adultos · comunicación/CAA · sensorial y meltdowns · medicación · salud mental y seguridad · educación · adolescencia/transición · neurodiversidad · genética/sindrómico · intervenciones comparadas · acceso LatAm · bienestar de cuidadores · señales tempranas por edad.

**Ronda 2 P–V**: alimentación selectiva ✅ · epilepsia ✅ · TCC adaptada ✅ · educación sexual/privacidad ✅ · empleo con apoyo ✅ · TDAH co-ocurrente (síntesis) · lenguaje identity-first + NCAEP 28 EBPs (síntesis).

**Ronda 3 W–AS** (temas prácticos): sueño ✅✅ · intervención temprana ✅✅ · TO/integración sensorial · conductas desafiantes/PBS · problemas GI · regulación emocional/alexitimia · habilidades sociales · cómo explicar el autismo · seguridad (wandering/pica) · discapacidad intelectual co-ocurrente · visitas médicas/dentales · escuela y derechos (CDPD, PIAR) · **tecnología/pantallas ✅✅** · **cannabis/CBD ✅✅** · estigma y apoyo entre padres · salud física y esperanza de vida · bilingüismo · burnout autista · diversidad de género · ejercicio · musicoterapia · trauma · animales de apoyo.

_(Los temas sin ✅✅ están redactados desde fuentes canónicas y marcados para re-verificar.)_

---

## 🗺️ Siguiente paso recomendado

1. **Volcar la biblioteca a la app** (Centro de evidencia + Detector) — usar las **28 prácticas basadas en evidencia del NCAEP** como vara en el Detector.
2. **Publicar** `web/` en un hosting estático para que las familias la usen ya.
3. **Activar la IA** cuando haya presupuesto/API key.
4. Re-verificar los temas de síntesis y pulir.

---

## 🔒 Privacidad — qué NO se sube al repo

Protegido por `.gitignore`:
- **El informe PDF del niño** (`Report-*.pdf`) — nunca se publica.
- **`.claude/`** (config local de la herramienta, con rutas del equipo).
- **`PROYECTO.md`** (notas internas de estrategia/contexto personal). _Para hacerlo público, borra su línea en `.gitignore`._
- Claves y `.env` (la `ANTHROPIC_API_KEY` va **solo** como variable de entorno del servidor, nunca en el código).
