# Brújula TEA 🧭

**Guía confiable en español para familias de niños con autismo (TEA).**
Información basada en evidencia + detector de pseudociencia + seguimiento personal de tu hijo + un asistente que cita fuentes y nunca recomienda algo peligroso.

Es una **PWA estática** (se instala como app, funciona sin conexión para el contenido) que **no requiere instalar nada** para probarse. El asistente con IA se entrega como **interfaz + modo demostración**, listo para "encender" Claude cuando quieras.

> ⚠️ Esta app **informa y orienta; no diagnostica ni sustituye** a un profesional de la salud.

**Estado:** MVP funcional (las 4 piezas), respaldado por una **biblioteca de investigación de ~45 temas con fuentes** ([`research/biblioteca-autismo.md`](research/biblioteca-autismo.md)). Lo hecho y lo pendiente está en **[ESTADO.md](ESTADO.md)**. Proyecto **sin ánimo de lucro** y **gratuito**.

---

## Qué incluye (MVP)

1. **📚 Centro de evidencia** — qué es el TEA, cómo se diagnostica y qué intervenciones funcionan, con etiquetas 🟢/🟡/🔴 (nivel de evidencia) y **fuentes enlazadas**.
2. **🚩 Detector de pseudociencia** — escribe una terapia o producto (quelación, MMS, test de cabello, dieta-cura…) y te dice si es confiable, dudoso o peligroso, con fuentes.
3. **📈 Seguimiento de mi hijo** — registra intervenciones y el día a día; gráfica simple de progreso. **Los datos se guardan solo en tu dispositivo** (IndexedDB); sin cuentas ni nube.
4. **💬 Asistente** — chat que responde con fuentes. Hoy en **modo demostración**; abajo se explica cómo activar la IA real.

---

## Probarlo en tu computadora (sin instalar nada)

La app es estática, así que basta con un servidor de archivos. En esta Mac ya tienes Python:

```bash
cd "web"
python3 -m http.server 8080
```

Luego abre **http://localhost:8080** en el navegador. (Usa un servidor; abrir el `index.html` directo con `file://` puede bloquear el `fetch` de los JSON y el service worker.)

### Instalarla como app
En Chrome/Edge: menú → "Instalar Brújula TEA". En iPhone (Safari): Compartir → "Añadir a pantalla de inicio".

---

## Publicarla gratis (para que otras familias la usen)

La carpeta `web/` se sube tal cual a cualquier hosting estático:
- **Netlify Drop** (arrastrar la carpeta), **GitHub Pages**, **Cloudflare Pages** o **Vercel**.
- No hay paso de build.

---

## "Encender" la IA real (cuando quieras)

El asistente ya tiene la **interfaz lista** y un **backend stub** en `api/chat.ts` con las reglas de seguridad escritas. Para conectarlo a Claude:

1. **Crea una API key** en la consola de Anthropic (console.anthropic.com) → guárdala como secreto del servidor. **Nunca** la pongas en el código del navegador.
2. Despliega `api/chat.ts` como **función serverless** (Vercel/Cloudflare/Netlify). Necesita Node y el SDK:
   ```bash
   cd api && npm install        # instala @anthropic-ai/sdk
   ```
   En el panel del hosting, define la variable de entorno **`ANTHROPIC_API_KEY`**.
3. En `web/app.js`, cambia la función `demoReply(text)` por una llamada al backend, p. ej.:
   ```js
   async function aiReply(messages) {
     const r = await fetch("/api/chat", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ messages })
     });
     return r.json(); // { reply, sources }
   }
   ```

Detalles técnicos del agente (ya implementados en `api/chat.ts`):
- **Modelo:** `claude-opus-4-8` (alternativa de menor costo: `claude-sonnet-4-6`).
- **Streaming** (`messages.stream()` + `.finalMessage()`).
- **Prompt caching** del system prompt (reglas + base de evidencia) con `cache_control: { type: "ephemeral", ttl: "1h" }` → ahorra ~90% en llamadas repetidas. Verifica con `usage.cache_read_input_tokens`.
- **Seguridad:** el system prompt (construido desde `shared/knowledge-base.json`) prohíbe diagnosticar, dar dosis y recomendar quelación/MMS/dietas-cura/desintoxicación; obliga a citar fuentes y a derivar a profesionales.

---

## Privacidad

- **Datos del niño = solo en el dispositivo** (IndexedDB). No hay cuentas ni servidores en el MVP. El botón "Borrar todos mis datos" los elimina.
- Posicionamiento **no diagnóstico** (evita ser "dispositivo médico" ante la FDA).
- Si más adelante agregas cuentas/nube, revisa privacidad de datos de **menores** (COPPA, GDPR, LGPD).

---

## Estructura

```
web/                      PWA estática (esto es lo que se publica)
  index.html  styles.css  app.js
  manifest.webmanifest  sw.js
  assets/    icon.svg  icon-maskable.svg
  content/   evidencia.json  banderas-rojas.json  fuentes.json  asistente-demo.json
api/
  chat.ts                 proxy serverless de Claude (stub listo para activar)
  package.json
shared/
  knowledge-base.json     evidencia + reglas de seguridad (base del agente)
research/
  biblioteca-autismo.md   investigación con fuentes (~45 temas) que alimenta la app
serve.py                  servidor estático portable para probar en local
README.md  ESTADO.md  LICENSE
```

## Editar el contenido

Todo el contenido vive en JSON, sin tocar código:
- `web/content/evidencia.json` — tarjetas del centro de evidencia.
- `web/content/banderas-rojas.json` — fichas del detector.
- `web/content/fuentes.json` — bibliografía.
- `shared/knowledge-base.json` — hechos y **reglas de seguridad** del asistente.

---

## Cómo colaborar o apoyar

Es un proyecto **sin ánimo de lucro** para las familias. Formas de ayudar:
- **Contenido**: mejorar/traducir fichas y revisar fuentes (todo el contenido vive en JSON y en `research/`).
- **Código**: accesibilidad, publicar la app, activar la IA, pulir la interfaz. Ver **[ESTADO.md](ESTADO.md)** para lo pendiente.
- **Difusión / financiación**: si representas una **ONG, fundación o donante** interesado en salud, discapacidad o desinformación, este proyecto busca apoyo para sostenerse y crecer.

Las contribuciones son bienvenidas por *issues* y *pull requests*.

## Licencia

Código bajo **MIT**; contenido educativo bajo **CC BY 4.0**. Ver [LICENSE](LICENSE).

---

*Hecho para acompañar a las familias con información honesta. La ciencia publica sus límites; la pseudociencia los esconde.*
