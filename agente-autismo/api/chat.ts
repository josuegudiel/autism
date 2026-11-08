/**
 * /api/chat — Backend del Asistente (proxy de Claude).
 *
 * ESTADO: listo para ACTIVAR. Mientras no exista la variable de entorno
 * ANTHROPIC_API_KEY, responde en "modo demo" (un aviso). En cuanto pongas la
 * key en el servidor (NUNCA en el cliente) y despliegues, el asistente real
 * de Claude queda funcionando: anclado en la base de evidencia, citando
 * fuentes y SIN recomendar nada peligroso.
 *
 * Pensado como función serverless estilo Vercel (Node). Para Cloudflare/Netlify
 * el cuerpo es casi idéntico; solo cambia la firma del handler.
 *
 * Requisitos para activar:
 *   1) `npm install` en esta carpeta (usa @anthropic-ai/sdk 1.x)
 *   2) tsconfig con "resolveJsonModule": true y "esModuleInterop": true
 *   3) Variable de entorno del servidor: ANTHROPIC_API_KEY=sk-ant-...
 *   4) En web/app.js, reemplazar demoReply(text) por una llamada a fetch('/api/chat').
 *   5) Poner un límite de peticiones por IP en la plataforma (Vercel, Cloudflare…):
 *      este fichero acota el TAMAÑO de cada petición, no CUÁNTAS llegan.
 */

import Anthropic from "@anthropic-ai/sdk";
import kb from "../shared/knowledge-base.json";

// El modelo por defecto de Anthropic hoy. Piensa siempre (thinking adaptativo,
// no se puede apagar); para una conversación con una familia basta el esfuerzo
// bajo, que además responde antes y gasta menos.
const MODEL = "claude-opus-5-5";

// Topes de lo que se acepta del navegador. La clave de la API vive en el
// servidor, así que sin estos límites el endpoint era un proxy gratuito de
// Claude para cualquiera que lo encontrara: aceptaba cualquier número de
// mensajes, de cualquier longitud y con cualquier rol.
const MAX_MENSAJES = 20;          // se conservan los últimos
const MAX_CARACTERES_MENSAJE = 2000;
const MAX_CARACTERES_TOTAL = 12000;

/** System prompt estable = identidad + reglas de seguridad + base de evidencia.
 *  Es el "prefijo" que se cachea para abaratar ~90% las llamadas repetidas. */
function buildSystemPrompt(): string {
  const reglas = (kb.reglas_de_seguridad || []).map((r: string) => "- " + r).join("\n");
  const hechos = (kb.hechos_clave || [])
    .map((h: { tema: string; texto: string; fuente: string }) => `- [${h.tema}] ${h.texto} (fuente: ${h.fuente})`)
    .join("\n");
  // Las reglas obligan a dar «el teléfono concreto de lineas_de_crisis», pero
  // la lista no se le pasaba nunca al modelo: tenía que dar un número de crisis
  // sin tenerlo delante. La suite comprueba que esta lista coincide con
  // web/content/ayuda-urgente.json, que es la que ve la familia.
  const crisis = Object.entries(kb.lineas_de_crisis || {})
    .filter(([pais]) => !pais.startsWith("_"))
    .map(([pais, lineas]) => `- ${pais}: ${lineas}`)
    .join("\n");
  return [
    kb.identidad,
    "",
    "REGLAS DE SEGURIDAD (obligatorias, sin excepción):",
    reglas,
    "",
    "LÍNEAS DE CRISIS POR PAÍS (da el número EXACTO de esta lista, nunca uno de memoria):",
    crisis,
    "",
    "BASE DE EVIDENCIA (única fuente de hechos; cita estas URLs):",
    hechos,
    "",
    "Responde en español, con calidez y sin condescendencia. Si no estás seguro, dilo y deriva a un profesional.",
  ].join("\n");
}
// Se construye una vez: el prefijo cacheado tiene que ser idéntico byte a byte
// en cada llamada.
const SYSTEM_PROMPT = buildSystemPrompt();

// Cuando el modelo declina responder por sus salvaguardas, la familia no puede
// quedarse con una pantalla vacía: se le dice qué hacer y dónde están los
// teléfonos.
const RESPUESTA_SI_DECLINA =
  "No puedo responder a eso aquí. Si hay riesgo ahora, abre «Ayuda urgente» en la app: ahí están los teléfonos de crisis y de emergencias de tu país. Para todo lo demás, consúltalo con el profesional que lleva a tu hijo.";

/** Valida y recorta lo que manda el navegador. Devuelve un texto de error si
 *  no se puede aceptar. */
function validarMensajes(crudo: unknown): Anthropic.Beta.BetaMessageParam[] | string {
  if (!Array.isArray(crudo) || crudo.length === 0) return "Falta 'messages'.";
  const limpios: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of crudo.slice(-MAX_MENSAJES)) {
    const rol = (m as { role?: unknown })?.role;
    const texto = (m as { content?: unknown })?.content;
    if ((rol !== "user" && rol !== "assistant") || typeof texto !== "string") {
      return "Cada mensaje tiene que ser { role: 'user' | 'assistant', content: texto }.";
    }
    const recortado = texto.trim();
    if (!recortado) continue;
    if (recortado.length > MAX_CARACTERES_MENSAJE) return "Un mensaje es demasiado largo.";
    limpios.push({ role: rol, content: recortado });
  }
  // La conversación empieza por la familia y termina en una pregunta suya.
  while (limpios.length && limpios[0].role !== "user") limpios.shift();
  if (!limpios.length || limpios[limpios.length - 1].role !== "user") return "El último mensaje tiene que ser de la familia.";
  const total = limpios.reduce((n, m) => n + (m.content as string).length, 0);
  if (total > MAX_CARACTERES_TOTAL) return "La conversación es demasiado larga. Empieza una nueva.";
  return limpios;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Usa POST" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // MODO DEMO: la IA aún no está activada.
    res.status(200).json({
      demo: true,
      reply:
        "El asistente con IA aún no está activado en el servidor. Configura ANTHROPIC_API_KEY y despliega para encenderlo. Mientras tanto, usa el modo demostración de la app.",
      sources: [],
    });
    return;
  }

  const messages = validarMensajes(req.body?.messages);
  if (typeof messages === "string") {
    res.status(400).json({ error: messages });
    return;
  }

  const client = new Anthropic({ apiKey });

  try {
    // Streaming para no chocar con los tiempos de espera, y finalMessage()
    // porque aquí no se reenvía la respuesta trozo a trozo.
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low" },
      // Si las salvaguardas del modelo declinan, la API reintenta en el modelo
      // que Anthropic recomienda para ese caso, dentro de la misma llamada.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // El system va como bloque cacheado (prefijo estable). TTL 1h porque la
      // base de evidencia es fija. Verifica con usage.cache_read_input_tokens.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral", ttl: "1h" } }],
      messages,
    });

    const final = await stream.finalMessage();

    // Antes de leer el contenido: si toda la cadena declinó, el contenido puede
    // venir vacío o a medias, y eso no se enseña.
    if (final.stop_reason === "refusal") {
      res.status(200).json({ demo: false, reply: RESPUESTA_SI_DECLINA, sources: [], declinado: true });
      return;
    }

    const reply = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    res.status(200).json({
      demo: false,
      reply: reply || RESPUESTA_SI_DECLINA,
      // Mismo contrato que el modo demo. Las fuentes van citadas dentro del
      // texto (el system prompt lo exige); aquí no se inventa una lista aparte.
      sources: [],
      model: final.model,
      // La respuesta se cortó por longitud: se avisa en vez de fingir que está entera.
      incompleta: final.stop_reason === "max_tokens",
    });
  } catch (err: unknown) {
    // El detalle se queda en el registro del servidor, que es donde se puede
    // investigar; antes se tiraba y un fallo de la API no dejaba rastro.
    console.error("api/chat:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    // No filtrar detalles sensibles al cliente, pero sí distinguir lo que la
    // familia puede hacer: esperar un momento no es lo mismo que un fallo.
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "Hay mucha gente usando el asistente ahora mismo. Inténtalo en un minuto." });
    } else {
      res.status(500).json({ error: "No se pudo generar la respuesta. Intenta de nuevo." });
    }
  }
}
