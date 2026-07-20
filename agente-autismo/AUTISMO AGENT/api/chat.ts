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
 *   1) `npm i @anthropic-ai/sdk`
 *   2) tsconfig con "resolveJsonModule": true y "esModuleInterop": true
 *   3) Variable de entorno del servidor: ANTHROPIC_API_KEY=sk-ant-...
 *   4) En web/app.js, reemplazar demoReply(text) por una llamada a fetch('/api/chat').
 */

import Anthropic from "@anthropic-ai/sdk";
import kb from "../shared/knowledge-base.json";

// Modelo recomendado (el más capaz). Alternativa de menor costo: "claude-sonnet-4-6".
const MODEL = "claude-opus-4-8";

/** System prompt estable = identidad + reglas de seguridad + base de evidencia.
 *  Es el "prefijo" que se cachea para abaratar ~90% las llamadas repetidas. */
function buildSystemPrompt(): string {
  const reglas = (kb.reglas_de_seguridad || []).map((r: string) => "- " + r).join("\n");
  const hechos = (kb.hechos_clave || [])
    .map((h: any) => `- [${h.tema}] ${h.texto} (fuente: ${h.fuente})`)
    .join("\n");
  return [
    kb.identidad,
    "",
    "REGLAS DE SEGURIDAD (obligatorias, sin excepción):",
    reglas,
    "",
    "BASE DE EVIDENCIA (única fuente de hechos; cita estas URLs):",
    hechos,
    "",
    "Responde en español, con calidez y sin condescendencia. Si no estás seguro, dilo y deriva a un profesional.",
  ].join("\n");
}

type Msg = { role: "user" | "assistant"; content: string };

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

  const messages: Msg[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) {
    res.status(400).json({ error: "Falta 'messages'." });
    return;
  }

  const client = new Anthropic({ apiKey });

  try {
    // Streaming recomendado para chat (evita timeouts y se siente fluido).
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      // El system va como bloque cacheado (prefijo estable). TTL 1h porque la
      // base de evidencia es fija. Verifica con usage.cache_read_input_tokens.
      system: [
        { type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      messages,
    });

    const final = await stream.finalMessage();
    const reply = final.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    res.status(200).json({ demo: false, reply, model: final.model });
  } catch (err: any) {
    // No filtrar detalles sensibles al cliente.
    res.status(500).json({ error: "No se pudo generar la respuesta. Intenta de nuevo." });
  }
}
