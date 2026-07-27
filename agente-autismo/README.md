# Brújula TEA 🧭

**Guía confiable en español para familias de niños con autismo (TEA).**
Información basada en evidencia + detector de pseudociencia + seguimiento personal de tu hijo + un asistente que cita fuentes y nunca recomienda algo peligroso.

Es una **PWA estática** (se instala como app, funciona sin conexión para el contenido) que **no requiere instalar nada** para probarse. El asistente con IA se entrega como **interfaz + modo demostración**, listo para "encender" Claude cuando quieras.

> ⚠️ Esta app **informa y orienta; no diagnostica ni sustituye** a un profesional de la salud.

**Estado:** app funcional con **buscador sobre 222 temas** (171 verificados) y **1.218 fuentes**, generados desde la biblioteca de investigación ([`research/biblioteca-autismo.md`](research/biblioteca-autismo.md)). Lo hecho y lo pendiente está en **[ESTADO.md](ESTADO.md)**. Proyecto **sin ánimo de lucro** y **gratuito**.

---

## Qué incluye

1. **📚 Biblioteca buscable (lo principal)** — escribe lo que te preocupa con tus palabras («mi hijo no duerme», «se pega», «en la escuela») y encuentra el tema que responde, con su nivel de evidencia 🟢/🟡/🔴 y sus fuentes. **222 temas** organizados en 12 categorías. Funciona **sin conexión y sin ningún coste**: no usa IA ni servidores.
2. **🚩 Detector de pseudociencia** — escribe una terapia o producto (quelación, MMS, test de cabello, dieta-cura…) y te dice si es confiable, dudoso o peligroso, con fuentes. Si la consulta es ambigua, **pregunta antes de dar un veredicto** en vez de arriesgarse a asustar sin motivo.
3. **🆘 Ayuda urgente** — teléfonos de crisis por país (España, México, Argentina, Chile, Colombia, Perú, EE. UU.), verificados con fuentes oficiales, más señales de alarma y qué hacer.
4. **📈 Seguimiento de mi hijo** — registra intervenciones y el día a día; gráfica simple de progreso. **Los datos se guardan solo en tu dispositivo** (IndexedDB); sin cuentas ni nube.
5. **✅ Centro de evidencia** — un resumen corto para empezar, y **💬 Asistente** en modo demostración.

## Cómo actualizar el contenido (sin tocar código)

Todo el conocimiento vive en un solo archivo de texto. Para añadir o corregir un tema:

1. Edita **`research/biblioteca-autismo.md`** (cada tema es una sección `### CÓDIGO. Título — estado`).
2. Ejecuta el conversor:
   ```bash
   python3 scripts/construir-contenido.py
   ```
   Regenera los JSON que lee la app y avisa si a algún tema le falta el mensaje clave o las fuentes.
3. Sube los cambios. Ya está: la app muestra el tema nuevo.

Para mejorar el buscador, edita **`scripts/sinonimos.json`**: traduce cómo habla una familia («no duerme») a los códigos de los temas (`["W", "EN"]`). No hace falta saber programar.

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

## Sobre la IA: por qué la app NO la necesita

**Decisión del proyecto: la app funciona sin IA y sin coste alguno.** Las respuestas ya están escritas y verificadas en la biblioteca; el buscador solo las encuentra. Eso tiene tres ventajas para un proyecto de salud:

- **Coste cero y para siempre.** Sin API, sin servidor, sin factura que pueda agotarse.
- **No puede inventarse nada.** Todo lo que muestra lo escribiste tú, con su fuente. Una IA generativa sí puede alucinar datos clínicos.
- **Funciona sin internet**, una vez instalada.

El código de `api/chat.ts` se conserva como **opción futura**, no como parte del producto. Si algún día se activara, antes habría que: limitar peticiones por IP (si no, un bot agota el presupuesto), validar el tamaño del historial, restringir el origen, y darle acceso al contenido de la biblioteca (hoy solo ve 5 hechos). Instrucciones históricas:

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
research/
  biblioteca-autismo.md   ← EL CORAZÓN: 222 temas con fuentes. Aquí se edita todo.
scripts/
  construir-contenido.py  conversor: biblioteca .md -> JSON que lee la app
  sinonimos.json          "no duerme" -> temas W, EN  (editable sin programar)
web/                      PWA estática (esto es lo que se publica)
  index.html  styles.css  app.js
  manifest.webmanifest  sw.js
  assets/    icon.svg  icon-maskable.svg
  content/   biblioteca-indice.json   generado: buscador (208 KB)
             biblioteca-cuerpo.json   generado: contenido de los temas (1 MB)
             ayuda-urgente.json       teléfonos de crisis por país
             evidencia.json  banderas-rojas.json  fuentes.json  asistente-demo.json
shared/
  knowledge-base.json     hechos y reglas de seguridad (para un bot futuro)
api/
  chat.ts                 proxy de IA — OPCIONAL, hoy no se usa
serve.py                  servidor estático portable para probar en local
README.md  ESTADO.md  LICENSE
```

> Los dos `biblioteca-*.json` son **generados**: no los edites a mano, se sobrescriben
> cada vez que ejecutas `scripts/construir-contenido.py`.

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
