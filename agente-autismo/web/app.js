/* Brújula TEA — PWA estática. Vanilla JS, sin dependencias. */
"use strict";

const view = document.getElementById("view");
const TABS = ["inicio", "biblioteca", "evidencia", "detector", "rastreador", "asistente", "fuentes", "ayuda"];

/* ---------- helpers ---------- */
const esc = (s) => String(s == null ? "" : s)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/* Se guarda la PROMESA, no el dato: dos pantallas que piden el mismo fichero
   a la vez comparten una sola descarga. Si falla, se olvida, para que el
   siguiente intento vuelva a pedirlo. */
const _cache = Object.create(null);
function getJSON(path) {
  if (!_cache[path]) {
    _cache[path] = fetch(path, { cache: "no-cache" }).then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar " + path);
      return res.json();
    }).catch((e) => { delete _cache[path]; throw e; });
  }
  return _cache[path];
}

/* Solo se enlaza lo que es http(s). Las fuentes vienen de ficheros del propio
   proyecto, pero un «javascript:» colado en uno de ellos sería código
   ejecutándose en la app; la política de contenido ya lo para, y esto lo para
   antes. */
const urlSegura = (u) => /^https?:\/\//i.test(String(u || ""));

/* Una fuente puede estar citada sin enlace: el verificador confirmó que el
   trabajo existe pero no llegó a ver su dirección, y aquí no se inventan URLs.
   Esas se muestran como texto, no como un enlace que no lleva a ninguna parte. */
function fuenteHTML(f) {
  return urlSegura(f.url)
    ? `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.label)}</a>`
    : `<span class="sin-enlace">${esc(f.label)}</span>`;
}

function sourcesHTML(fuentes) {
  if (!fuentes || !fuentes.length) return "";
  return `<div class="sources">${fuentes.map(fuenteHTML).join("")}</div>`;
}

/* Pinta los iconos de la barra de pestañas (declarados con data-ico en el HTML). */
function pintarTabbar() {
  document.querySelectorAll(".tabbar a[data-ico]").forEach((a) => {
    if (a.querySelector("svg")) return;
    a.insertAdjacentHTML("afterbegin", ICONOS[a.dataset.ico] || "");
  });
}

function setActiveTab(tab) {
  document.querySelectorAll(".tabbar a").forEach((a) => {
    const activo = a.dataset.tab === tab;
    a.classList.toggle("active", activo);
    // La clase solo pinta color. aria-current es lo que le dice al lector de
    // pantalla en qué sección está parado quien no distingue ese verde.
    if (activo) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function loading() { view.innerHTML = `<div class="empty">Cargando…</div>`; }
function errorBox(msg) { view.innerHTML = `<div class="callout warn">${esc(msg)}</div>`; }

/* Escribe en la región viva del HTML (#anuncio). Solo el resumen de lo que ha
   cambiado dentro de una pantalla —«25 resultados para no duerme»—, porque el
   <main> ya no es región viva: lo era, y con él cada render le soltaba al lector
   de pantalla la página entera, 91.000 caracteres al entrar en la biblioteca. */
function anunciar(texto) {
  const el = document.getElementById("anuncio");
  if (el) el.textContent = texto || "";
}

function normalize(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* Palabras que no aportan nada al buscar. */
const VACIAS = new Set(("a al como con de del el en es esta este la las le lo los mas me mi no " +
  "o para pero por porque que se si sin sobre su sus tiene un una uno y ya mucho muy hace hacer " +
  "tengo tiene hijo hija nino nina bebe autismo autista").split(" "));

function tokenizar(q) {
  return normalize(q).split(/[^a-z0-9ñ]+/).filter((t) => t.length >= 3 && !VACIAS.has(t));
}

/* Normaliza y deja solo palabras: fuera signos («¿mms?», «MMS/CDS», guiones) y
   espacios de más, para que la misma pregunta escrita de cinco maneras sea una. */
function limpiaConsulta(s) {
  return normalize(s).replace(/[^a-z0-9ñ]+/g, " ").trim();
}

const escapaRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ¿Aparece `palabra` dentro de `texto` como palabra completa? Los dos límites
   importan: sin el de la derecha, "stem" saltaría dentro de "sistema". */
function palabraDentro(texto, palabra) {
  if (!texto || !palabra) return false;
  return new RegExp("(^|[^a-z0-9ñ])" + escapaRegex(palabra) + "([^a-z0-9ñ]|$)").test(texto);
}

/* ---------- Iconografía (trazo fino, estilo SF Symbols) ---------- */
const SVG = (d, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

const ICONOS = {
  buscar: SVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>'),
  inicio: SVG('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>'),
  biblioteca: SVG('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M10 4h4.5A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5H10z"/><path d="m17.5 5 2.6 12.6"/>'),
  detector: SVG('<path d="M12 3.5 20 6v6.2c0 4.2-3.2 7-8 8.3-4.8-1.3-8-4.1-8-8.3V6z"/><path d="M12 8.5v4"/><path d="M12 15.6h.01"/>'),
  seguimiento: SVG('<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7.5 15 3.5-4 3 2.5 4.5-6"/>'),
  ayuda: SVG('<path d="M12 20.5s-7.5-4.4-7.5-9.6A4.4 4.4 0 0 1 12 8a4.4 4.4 0 0 1 7.5 2.9c0 5.2-7.5 9.6-7.5 9.6z"/>'),
  chevron: SVG('<path d="m9 5 7 7-7 7"/>'),
  externo: SVG('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5.5A1.5 1.5 0 0 1 16.5 21h-12A1.5 1.5 0 0 1 3 19.5v-12A1.5 1.5 0 0 1 4.5 6H10"/>'),
  telefono: SVG('<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5z"/>'),
  // categorías
  diagnostico: SVG('<path d="M9 3.5h6v3H9z"/><path d="M6 6.5h12v14H6z"/><path d="M9.5 12.5h5"/><path d="M12 10v5"/>'),
  pseudociencia: SVG('<path d="M12 4 3.5 19h17z"/><path d="M12 10v4"/><path d="M12 17h.01"/>'),
  terapias: SVG('<path d="M6.5 3.5v6a5.5 5.5 0 0 0 11 0v-6"/><path d="M4.5 3.5h4"/><path d="M15.5 3.5h4"/><path d="M12 15v2.5a3 3 0 0 0 6 0v-1"/><circle cx="19" cy="15" r="2"/>'),
  comunicacion: SVG('<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8.5 10.5h7"/>'),
  conducta: SVG('<path d="M12 20.5s-7.5-4.4-7.5-9.6A4.4 4.4 0 0 1 12 8a4.4 4.4 0 0 1 7.5 2.9c0 5.2-7.5 9.6-7.5 9.6z"/>'),
  sensorial: SVG('<path d="M4 12a8 8 0 0 1 16 0"/><path d="M7.5 12a4.5 4.5 0 0 1 9 0v5a2.5 2.5 0 0 1-5 0v-4"/>'),
  salud: SVG('<path d="M3.5 12h4l2-4 3 8 2-4h6"/>'),
  escuela: SVG('<path d="m12 4 9 4.5-9 4.5-9-4.5z"/><path d="M6.5 10.5V16c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5.5"/>'),
  familia: SVG('<circle cx="8" cy="8" r="2.6"/><circle cx="16" cy="9" r="2.2"/><path d="M3.5 19.5c0-2.8 2-4.8 4.5-4.8s4.5 2 4.5 4.8"/><path d="M14 19.5c0-2.3 1.2-4 3-4s3 1.7 3 4"/>'),
  adultez: SVG('<circle cx="12" cy="7" r="3"/><path d="M5.5 20.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/>'),
  derechos: SVG('<path d="M12 3.5v17"/><path d="M5 7h14"/><path d="M7.5 7 5 13h5z"/><path d="M16.5 7 14 13h5z"/>'),
  comprender: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5A2.6 2.6 0 0 1 12 7.5a2.5 2.5 0 0 1 .6 4.9c-.6.2-.6.8-.6 1.4"/><path d="M12 16.5h.01"/>'),
};
const ICONO_CAT = {
  diagnostico: "diagnostico", pseudociencia: "pseudociencia", terapias: "terapias",
  comunicacion: "comunicacion", conducta: "conducta", sensorial: "sensorial",
  salud: "salud", escuela: "escuela", familia: "familia", adultez: "adultez",
  derechos: "derechos", comprender: "comprender",
};

/* ---------- Niveles de evidencia: del marcador del texto a un badge ---------- */
const NIVELES = {
  "🟢": { clase: "alta", texto: "Evidencia sólida" },
  "🟡": { clase: "media", texto: "Evidencia limitada" },
  "🔴": { clase: "evitar", texto: "Desaconsejado" },
  // La biblioteca dice en su propia leyenda, doce veces, qué es ⚪: "lo que
  // proponemos nosotros sin estudio detrás". Llamarlo "Experiencia vivida"
  // le prestaba el peso de una categoría que en autismo significa otra cosa
  // —el testimonio de personas autistas y de sus familias—, y son 369
  // viñetas. Se dice lo que es.
  "⚪": { clase: "vivida", texto: "Criterio nuestro, sin estudios" },
};
const badge = (clase, texto) => `<span class="badge ${clase}">${esc(texto)}</span>`;

/* Emojis de estado que la biblioteca usa en su texto y que no deben verse en la app. */
const EMOJI_ESTADO = /[\u2705\u26A0\uFE0F\u25FD\u2714\u2B50\u274C\u23F3\u2B1C]/g;

/* La sirena marca urgencia, no nivel de prueba: la viñeta se destaca y se
   queda sin píldora de evidencia. El emoji sí se conserva a la vista. */
const URGENCIA = "\u{1F6A8}";

/** Separa el marcador de nivel y limpia los emojis de estado del texto. */
function extraerNivel(texto) {
  let t = texto, nivel = null;
  // Solo cuenta como urgencia si la sirena ENCABEZA la viñeta. Cinco viñetas
  // de la biblioteca la nombran por dentro para remitir a otro bloque ('eso es
  // el cuarto bloque 🚨'), y esas no son urgencias: son referencias cruzadas, y
  // sí llevan su nivel de evidencia.
  const urgente = t.slice(0, 12).includes(URGENCIA);
  for (const marca of Object.keys(NIVELES)) {
    if (t.includes(marca)) { nivel = NIVELES[marca]; t = t.split(marca).join(""); }
  }
  t = t.replace(EMOJI_ESTADO, "").replace(/\s{2,}/g, " ");
  return { texto: t.replace(/\s+([.,;:])/g, "$1").trim(), nivel, urgente };
}

/** Clave de colores de la ficha. Hasta ahora las cuatro píldoras aparecían sin
 *  explicación en ningún sitio: solo 53 de las 445 fichas llevan dentro la línea
 *  de leyenda, y en las otras 392 el lector veía "Evidencia limitada" o
 *  "Criterio nuestro" sin saber a qué se refiere ni, sobre todo, que el color
 *  habla de la prueba y no de la prisa. Se muestran solo los niveles que esa
 *  ficha usa de verdad. */
function leyendaNiveles(cuerpo) {
  const md = String(cuerpo || "");
  const usados = Object.keys(NIVELES).filter((m) => md.includes(m));
  if (!usados.length) return "";
  return `<details class="leyenda"><summary>Qué significan los colores</summary>
    <div class="claves">${usados.map((m) => {
      const n = NIVELES[m];
      return `<span class="clave">${badge(n.clase, n.texto)}</span>`;
    }).join("")}</div>
    <p>El color dice <strong>cuánta evidencia hay detrás del punto</strong>, no cuánta prisa corre.
    Los bloques de urgencia no llevan color: ante esas señales se actúa igual.</p></details>`;
}

/* ---------- Mini-render de markdown (negritas, enlaces, listas, citas) ---------- */
/* La URL admite UN nivel de paréntesis dentro. Con `[^\s)]+` se cortaba en el
   primero, y 41 fuentes de la biblioteca —las de Lancet, JAACAP, Cell y las
   revistas de Elsevier, que llevan «S0890-8567(17)30152-1» en la ruta— salían
   como enlaces rotos: la familia que pulsaba para comprobar llegaba a un 404. */
const ENLACE_MD = /\[([^\]]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/g;

/* Códigos que en negrita suelta NO son una remisión: «**DI** (CI ≤70)» es
   discapacidad intelectual, no la ficha DI de arte y música. Con «DI. Título»
   sí es la ficha, y ese caso no pasa por aquí. */
const NO_ES_REMISION = new Set(["DI", "NO", "SI", "YA", "OK"]);

/** Convierte en enlace las remisiones a otras fichas: «ve **DO. Catatonia en
 *  el autismo**» o «(**QS**, **RV**)». Son más de 3.700 en la biblioteca y hasta
 *  ahora eran negrita sin más: la familia leía «está en QQ» y no podía ir.
 *  Solo se enlaza un código que existe de verdad en el índice. */
function enlazarRemisiones(html, codigos) {
  if (!codigos || !codigos.size) return html;
  // Lo que ya es un enlace se deja como está: un enlace dentro de otro no vale.
  return html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/).map((trozo, i) => (i % 2 ? trozo :
    trozo.replace(/<strong>([A-Z]{1,2})(\.\s[^<]*)?<\/strong>/g, (todo, cod, resto) => {
      if (!codigos.has(cod)) return todo;
      if (!resto && NO_ES_REMISION.has(cod)) return todo;
      return `<a class="remision" href="#tema/${cod}">${todo}</a>`;
    }))).join("");
}

function mdInline(t, codigos) {
  return enlazarRemisiones(esc(t)
    .replace(ENLACE_MD, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>"), codigos);
}

/** Cada viñeta se convierte en una tarjeta con su badge de evidencia.
 *  `ctaUrgencia`, si viene, se cuela justo detrás del bloque de urgencia que
 *  abre la ficha: ahí es donde hace falta el teléfono, no al final detrás de
 *  veintiséis viñetas y de la lista de fuentes. */
function mdRender(md, ctaUrgencia = "", codigos = null) {
  const out = [];
  const tipos = [];
  // La viñeta abierta: se escribe al cerrarla, para poder meterle dentro sus
  // sub-viñetas. Antes cada «  - » se pintaba como una tarjeta más, suelta, y
  // las 430 sub-viñetas de 47 fichas —listas de lo que hay que llevar, de qué
  // pedir, de señales— perdían a qué punto pertenecían.
  let punto = null;
  const pildora = (nivel, urgente) => (nivel && !urgente ? badge(nivel.clase, nivel.texto) : "");
  const cerrar = () => {
    if (!punto) return;
    const subs = punto.subs.length
      ? `<ul class="sub">${punto.subs.map((s) =>
          `<li>${mdInline(s.texto, codigos)}${s.nivel && !punto.urgente ? " " + pildora(s.nivel, false) : ""}</li>`).join("")}</ul>`
      : "";
    // Una viñeta de urgencia NO lleva píldora de evidencia. La biblioteca lo
    // dice en su propia leyenda —"los bloques 🚨 no llevan color: ante esas
    // señales se actúa igual"—, pero 64 de las 153 viñetas 🚨 traían además un
    // marcador de color, así que la app pintaba "Evidencia limitada" al lado
    // de un atragantamiento o de una anafilaxia. Un badge de calidad de prueba
    // junto a una urgencia se lee como "esto puede esperar".
    out.push(`<div class="punto${punto.urgente ? " urgente" : ""}"><p>${mdInline(punto.texto, codigos)}</p>${
      pildora(punto.nivel, punto.urgente)}${subs}</div>`);
    tipos.push(punto.urgente ? "urgente" : "punto");
    punto = null;
  };
  for (const linea of String(md || "").split("\n")) {
    const l = linea.trim();
    if (!l) continue;
    // «---» separa bloques en la biblioteca; pintado, era un párrafo con tres guiones.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(l)) continue;
    if (punto && /^\s{2,}[-*]\s/.test(linea)) {
      punto.subs.push(extraerNivel(l.replace(/^[-*]\s+/, "")));
      continue;
    }
    if (l.startsWith("- ")) {
      cerrar();
      const { texto, nivel, urgente } = extraerNivel(l.slice(2));
      punto = { texto, nivel, urgente, subs: [] };
      continue;
    }
    cerrar();
    if (l.startsWith(">")) {
      const { texto } = extraerNivel(l.replace(/^>\s*/, ""));
      out.push(`<blockquote>${mdInline(texto, codigos)}</blockquote>`);
      tipos.push("cita");
    } else {
      const { texto, nivel } = extraerNivel(l);
      out.push(`<p>${mdInline(texto, codigos)}${nivel ? " " + badge(nivel.clase, nivel.texto) : ""}</p>`);
      tipos.push("parrafo");
    }
  }
  cerrar();
  if (ctaUrgencia) {
    const primero = tipos.findIndex((t) => t === "urgente" || t === "punto");
    if (primero >= 0 && tipos[primero] === "urgente") {
      let fin = primero;
      while (tipos[fin + 1] === "urgente") fin++;
      out.splice(fin + 1, 0, ctaUrgencia);
    }
  }
  return out.join("");
}

/** ¿Aparece `aguja` dentro de `pajar` como palabra entera? Sin esto, una
 *  consulta corta casa dentro de cualquier palabra que la contenga. */
function dentroComoPalabra(aguja, pajar) {
  if (!aguja || !pajar) return false;
  const i = pajar.indexOf(aguja);
  if (i < 0) return false;
  const antes = i === 0 ? "" : pajar[i - 1];
  const despues = pajar[i + aguja.length] || "";
  return !/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(despues);
}

/* ---------- Buscador de la biblioteca ---------- */
let _indice = null;
async function cargarIndice() {
  _indice = _indice || await getJSON("content/biblioteca-indice.json");
  return _indice;
}

/* Las palabras del cuerpo de los temas viven en un fichero aparte que NO se
   precachea: son unos 350 KB y solo hacen falta cuando alguien busca de verdad.
   Hacer que la primera visita los pague, con datos móviles y el móvil de la
   familia a la que servimos, sería cobrar por adelantado algo que la mitad de
   quien entra no va a usar. Si no llega —sin cobertura, por ejemplo— la búsqueda
   sigue funcionando contra el índice, que es exactamente lo de antes. */
let _busqueda = null, _pideBusqueda = null;
function cargarBusqueda() {
  _pideBusqueda = _pideBusqueda || getJSON("content/biblioteca-busqueda.json")
    .then((d) => { _busqueda = d.palabras || {}; })
    .catch(() => { _pideBusqueda = null; });   // se reintenta en la siguiente búsqueda
  return _pideBusqueda;
}

/**
 * Busca temas y devuelve [{tema, puntos}] ordenados. Nunca devuelve un único
 * resultado "adivinado": si la consulta es muy corta o vaga, devuelve [].
 */
function buscarTemas(consulta, indice) {
  const q = normalize(consulta).trim();
  if (q.length < 3) return [];
  const tokens = tokenizar(q);

  // 1) Sinónimos: lo que escribe una familia -> temas concretos.
  //    Se miran ANTES de exigir palabras útiles, porque hay frases que un padre
  //    escribe entera con palabras vacías ("es por el autismo", "no come nada")
  //    y que sin esto no encontrarían nada.
  const impulso = {};
  for (const [frase, codigos] of Object.entries(indice.sinonimos || {})) {
    if (frase.startsWith("_")) continue;
    const nf = normalize(frase);
    const tf = tokenizar(nf);
    let peso = 0;
    // Por PALABRA, no por trozo de palabra. Con `includes` a secas, una
    // consulta de tres letras casaba dentro de cualquier sinonimo que la
    // contuviera: "aba" estaba dentro de "trabajo", "caballos" y "acaban de
    // diagnosticarlo" —33 sinonimos— y empujaba a sus fichas, asi que buscar
    // "ABA" abria "lo acosan o lo han despedido en el trabajo" en vez de la
    // ficha del ABA. Lo mismo "sol" dentro de "solo", "pan" dentro de "pantalla"
    // y "ados" dentro de "cuidados paliativos". Sobre las 201 consultas de
    // prueba escritas como las escribe una familia, el cambio no mueve ni una.
    if (dentroComoPalabra(nf, q) || dentroComoPalabra(q, nf)) peso = 30;
    else if (tf.length) {
      const comunes = tf.filter((t) => tokens.includes(t)).length;
      if (comunes === tf.length) peso = 24;                   // están todas sus palabras
      else if (comunes >= 2) peso = 14;                       // coinciden dos o más
    }
    // El ORDEN en que un sinónimo lista sus fichas importa: la primera es el
    // destino principal. Hasta ahora todas recibían el mismo empuje y el
    // desempate lo decidía el orden alfabético del título, así que "quiere
    // morirse" —mapeado a G, IC, FP y KS— aterrizaba en "Autolesión" en vez de
    // en "Salud mental y seguridad", solo porque la A va antes que la S. El
    // descuento es pequeño a propósito: ordena dentro del sinónimo sin alterar
    // el peso frente a las otras señales.
    if (peso) codigos.forEach((c, i) => {
      impulso[c] = Math.max(impulso[c] || 0, peso - Math.min(i, 6) * 0.5);
    });
  }

  // Sin palabras útiles y sin sinónimo que encaje, no hay nada que buscar.
  if (!tokens.length && !Object.keys(impulso).length) return [];

  // Los temas cuyo cuerpo contiene cada palabra. Se resuelve una sola vez, antes
  // del bucle, porque si no habría que partir la misma lista 360 veces. El mapa
  // va sin prototipo y solo se acepta texto: la clave es lo que escribe una
  // familia, y «constructor» es una palabra española corriente que todo objeto
  // trae ya puesta. Con un objeto normal, buscarla reventaba la biblioteca.
  const enCuerpo = Object.create(null);
  for (const t of tokens) {
    const codigos = _busqueda && _busqueda[t];
    if (typeof codigos === "string") enCuerpo[t] = new Set(codigos.split(" "));
  }

  const resultados = [];
  for (const tema of indice.temas) {
    const titulo = normalize(tema.titulo);
    const mensaje = normalize(tema.mensaje);
    let puntos = impulso[tema.codigo] || 0;

    if (titulo === q) puntos += 60;
    else if (titulo.startsWith(q)) puntos += 30;
    else if (titulo.includes(q)) puntos += 20;

    for (const t of tokens) {
      if (titulo.includes(t)) puntos += 8;
      else if ((tema.claves || []).includes(t)) puntos += 5;
      else if (mensaje.includes(t)) puntos += 2;
    }
    // El cuerpo solo sirve para APARECER, nunca para adelantar. Se mira después
    // del bucle y vale un punto fijo: si sumara por palabra, dos palabras sueltas
    // en mitad de 5.000 caracteres (4 puntos) adelantarían a un tema que sí sale
    // en el resumen (2) o en las claves (5), y la familia perdería de vista el
    // que buscaba. Un tema que ya puntuó por arriba se queda donde estaba.
    if (!puntos && tokens.some((t) => enCuerpo[t] && enCuerpo[t].has(tema.codigo))) puntos = 1;
    if (puntos > 0) resultados.push({ tema, puntos });
  }
  return resultados.sort((a, b) =>
    b.puntos - a.puntos || a.tema.titulo.localeCompare(b.tema.titulo));
}

/* ---------- router ---------- */
/* Cada cambio de pantalla lleva un número, y una pantalla que termina de
   cargar cuando ya no es la última pedida no pinta nada. Sin esto, tocar
   «Biblioteca» y enseguida «Ayuda» con mala cobertura dejaba que la biblioteca,
   al llegar tarde, pisara la pantalla de teléfonos que la familia ya tenía
   delante. Cada render guarda su número al empezar y lo comprueba después de
   cada espera. */
let _ruta = 0;

async function route() {
  const mia = ++_ruta;
  const bruto = location.hash.replace("#", "") || "inicio";
  // Rutas con parámetro: #tema/BA  ·  #biblioteca/salud
  const [raiz, param] = bruto.split("/");
  const hash = raiz.toLowerCase();

  if (hash === "tema" && param) {
    setActiveTab("biblioteca");
    view.scrollIntoView({ block: "start" });
    try { await renderTema(decodeURIComponent(param)); }
    catch (e) { if (mia === _ruta) errorBox("Ocurrió un error: " + e.message); }
    if (mia === _ruta) view.focus({ preventScroll: true });
    return;
  }

  const tab = TABS.includes(hash) ? hash : "inicio";
  /* Evidencia, asistente y fuentes cuelgan de Inicio: no tienen botón propio
     en la barra, y si no se marcara ninguno la barra quedaría entera apagada,
     que es como decirle a un padre que se ha salido de la app. */
  setActiveTab(["evidencia", "asistente", "fuentes"].includes(tab) ? "inicio" : tab);
  view.scrollIntoView({ block: "start" });
  anunciar("");   // el resumen de la pantalla anterior ya no vale
  // Una sola salida. Cada `return` se saltaba el focus() de abajo, que es la
  // única señal de «ya estás en otra pantalla» para quien usa lector de
  // pantalla; y el `return renderInicio()` sin await se llevaba también el
  // catch, así que un fallo del índice dejaba el inicio en blanco y sin aviso.
  try {
    if (tab === "inicio") await renderInicio();
    else if (tab === "biblioteca") await renderBiblioteca(param ? decodeURIComponent(param) : "");
    else if (tab === "evidencia") await renderEvidencia();
    else if (tab === "detector") await renderDetector(param ? decodeURIComponent(param) : "");
    else if (tab === "rastreador") await renderRastreador();
    else if (tab === "asistente") await renderAsistente();
    else if (tab === "fuentes") await renderFuentes();
    else if (tab === "ayuda") await renderAyuda();
  } catch (e) {
    if (mia === _ruta) errorBox("Ocurrió un error: " + e.message);
  }
  if (mia === _ruta) view.focus({ preventScroll: true });
}
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => { pintarTabbar(); route(); });

/* ---------- Inicio ---------- */
const EJEMPLOS = ["no duerme", "no habla", "se pega", "berrinches", "en la escuela", "no come"];

function campoBusqueda(id, valor, marcador) {
  return `<form class="buscador" id="f-${id}" autocomplete="off" role="search">
      <div class="campo">
        ${ICONOS.buscar}
        <input id="q-${id}" type="search" enterkeyhint="search"
          aria-label="Buscar en la biblioteca" placeholder="${esc(marcador)}" value="${esc(valor || "")}" />
      </div>
      <button class="btn" type="submit">Buscar</button>
    </form>`;
}

async function renderInicio() {
  const mia = _ruta;
  loading();
  const idx = await cargarIndice();
  if (mia !== _ruta) return;
  view.innerHTML = `
    <h1 class="page">¿Qué te preocupa?</h1>
    <h2 class="page-sub">Escríbelo con tus palabras. ${idx.totalTemas} temas sobre autismo,
      con ${idx.totalFuentes} fuentes que puedes comprobar.</h2>
    ${campoBusqueda("inicio", "", "mi hijo no duerme")}
    <div class="chips">${EJEMPLOS.map(
      (e) => `<button type="button" data-q="${esc(e)}">${esc(e)}</button>`).join("")}</div>

    <h3 class="sec">Explorar por tema</h3>
    <div class="grid-cat">${(idx.categorias || []).map((c) => `
      <a class="cat-card" href="#biblioteca/${esc(c.clave)}">
        <span class="ico">${ICONOS[ICONO_CAT[c.clave]] || ICONOS.comprender}</span>
        <div class="nombre">${esc(c.nombre)}</div>
        <div class="n">${c.n} temas</div>
      </a>`).join("")}</div>

    <h3 class="sec">Herramientas</h3>
    <div class="lista">
      <a class="fila" href="#detector">
        <span class="lead">${ICONOS.detector}</span>
        <span class="txt"><span class="titulo">Detector de pseudociencia</span>
          <span class="sub">Comprueba si una terapia o producto tiene respaldo</span></span>
        <span class="chevron">${ICONOS.chevron}</span></a>
      <a class="fila" href="#evidencia">
        <span class="lead">${ICONOS.derechos}</span>
        <span class="txt"><span class="titulo">Centro de evidencia</span>
          <span class="sub">Qué funciona, qué no y qué conviene evitar</span></span>
        <span class="chevron">${ICONOS.chevron}</span></a>
      <a class="fila" href="#rastreador">
        <span class="lead">${ICONOS.seguimiento}</span>
        <span class="txt"><span class="titulo">Seguimiento de mi hijo</span>
          <span class="sub">Registra el día a día. Se guarda solo en este dispositivo</span></span>
        <span class="chevron">${ICONOS.chevron}</span></a>
      <a class="fila" href="#tema/BA">
        <span class="lead">${ICONOS.diagnostico}</span>
        <span class="txt"><span class="titulo">Cómo es el diagnóstico</span>
          <span class="sub">El proceso real, paso a paso</span></span>
        <span class="chevron">${ICONOS.chevron}</span></a>
      <a class="fila" href="#asistente">
        <span class="lead">${ICONOS.comunicacion}</span>
        <span class="txt"><span class="titulo">Asistente</span>
          <span class="sub">Pregunta con tus palabras. Hoy en modo demostración</span></span>
        <span class="chevron">${ICONOS.chevron}</span></a>
      <a class="fila" href="#fuentes">
        <span class="lead">${ICONOS.biblioteca}</span>
        <span class="txt"><span class="titulo">Fuentes y cómo verificar</span></span>
        <span class="chevron">${ICONOS.chevron}</span></a>
    </div>

    <a class="fila lista" href="#ayuda" style="color:var(--ev-evitar)">
      <span class="lead" style="color:inherit">${ICONOS.ayuda}</span>
      <span class="txt"><span class="titulo" style="font-weight:600">Ayuda urgente</span>
        <span class="sub">Teléfonos por país si hay riesgo o crisis</span></span>
      <span class="chevron">${ICONOS.chevron}</span></a>

    <div class="card sin-conexion" id="sin-conexion" hidden></div>
  `;
  pintarSinConexion(idx);
  const ir = (q) => { if (q.trim()) location.hash = "#biblioteca/" + encodeURIComponent(q.trim()); };
  document.getElementById("f-inicio").addEventListener("submit", (e) => {
    e.preventDefault(); ir(document.getElementById("q-inicio").value);
  });
  view.querySelectorAll(".chips button").forEach((b) => b.onclick = () => ir(b.dataset.q));
}

/* ---------- Usar sin conexión ---------- */
/* La biblioteca entera solo se baja si la familia lo pide, y sabiendo antes lo
   que pesa: es la mitad de una foto de móvil, pero para quien paga los datos
   por megas no es lo mismo pagarlo sin saberlo. */
async function bibliotecaGuardada() {
  if (!("caches" in window)) return false;
  try { return !!(await caches.match(new URL(CUERPO_ENTERO, location.href).href)); }
  catch (_) { return false; }
}

async function pintarSinConexion(idx) {
  const caja = document.getElementById("sin-conexion");
  // Sin service worker no hay dónde guardarla: mejor no ofrecer lo que no se puede dar.
  if (!caja || !("serviceWorker" in navigator) || !("caches" in window)) return;
  const mb = idx.descargaSinConexionKB
    ? (idx.descargaSinConexionKB / 1024).toFixed(1).replace(".", ",") + " MB" : "";
  const guardada = await bibliotecaGuardada();
  if (!caja.isConnected) return;   // la familia ya se fue de Inicio
  if (guardada) {
    caja.innerHTML = `<h4>Biblioteca guardada en este teléfono</h4>
      <p>Los ${esc(idx.totalTemas)} temas se pueden leer sin conexión.</p>`;
    caja.hidden = false;
    return;
  }
  caja.innerHTML = `<h4>Usar sin conexión</h4>
    <p>Guarda los ${esc(idx.totalTemas)} temas en este teléfono para leerlos sin internet${
      mb ? ` (es una descarga de unos ${esc(mb)})` : ""}. Los teléfonos de ayuda ya funcionan sin conexión.</p>
    <button class="btn ghost" type="button" id="guardar-todo">Guardar la biblioteca</button>
    <p class="nf" id="guardar-estado" role="status"></p>`;
  caja.hidden = false;
  const boton = document.getElementById("guardar-todo");
  const estado = document.getElementById("guardar-estado");
  boton.onclick = async () => {
    boton.disabled = true;
    estado.textContent = "Guardando…";
    try {
      // Que haya un service worker al mando: es él quien la guarda al pasar.
      // Con tope de espera: si el registro falló, `ready` no resuelve nunca y
      // el botón se quedaría en «Guardando…» para siempre.
      await Promise.race([navigator.serviceWorker.ready,
        new Promise((_, no) => setTimeout(() => no(new Error("sin service worker")), 8000))]);
      _cuerpos = await getJSON(CUERPO_ENTERO);
      if (!(await bibliotecaGuardada())) throw new Error("no se guardó");
      caja.innerHTML = `<h4>Biblioteca guardada en este teléfono</h4>
        <p>Los ${esc(idx.totalTemas)} temas se pueden leer sin conexión.</p>`;
      anunciar("Biblioteca guardada para usarla sin conexión");
    } catch (_) {
      boton.disabled = false;
      estado.textContent = "No se ha podido guardar. Comprueba la conexión y vuelve a intentarlo.";
    }
  };
}

/* ---------- Biblioteca (buscar y explorar los temas) ---------- */
function tarjetaTema(tema) {
  const s = tema.semaforos || {};
  const marcas = [
    s.verde ? badge("alta", `${s.verde} sólida${s.verde > 1 ? "s" : ""}`) : "",
    s.amarillo ? badge("media", `${s.amarillo} con matiz`) : "",
    s.rojo ? badge("evitar", `${s.rojo} a evitar`) : "",
  ].filter(Boolean).join("");
  const m = tema.mensaje || "";
  return `
    <a class="tema-card" href="#tema/${esc(tema.codigo)}">
      <div class="cat">${esc(tema.categoriaNombre)}</div>
      <h4>${esc(tema.titulo)}</h4>
      <p>${esc(m.slice(0, 175))}${m.length > 175 ? "…" : ""}</p>
      <div class="tema-meta">${marcas}<span class="nf">${tema.nFuentes} fuentes</span></div>
    </a>`;
}

async function renderBiblioteca(param) {
  const mia = _ruta;
  loading();
  const idx = await cargarIndice();
  if (mia !== _ruta) return;
  const cat = (idx.categorias || []).find((c) => c.clave === normalize(param || ""));
  const consulta = cat ? "" : (param || "");

  view.innerHTML = `
    <h1 class="page">${cat ? esc(cat.nombre) : "Biblioteca"}</h1>
    <h2 class="page-sub">${cat
      ? `${cat.n} temas en esta categoría.`
      : `${idx.totalTemas} temas con ${idx.totalFuentes} fuentes que puedes abrir y comprobar.`}</h2>
    ${campoBusqueda("bib", consulta, "p. ej. se despierta de noche")}
    ${cat ? `<p class="migas"><a href="#biblioteca">Ver todas las categorías</a></p>` : ""}
    <div id="res-bib"></div>
  `;

  // Las categorías solo aparecen cuando NO hay búsqueda activa: si hay resultados,
  // deben verse de inmediato y no empujados debajo de una lista de chips.
  const chipsCat = cat ? "" : `<h3 class="sec" style="margin-top:8px">Explorar por tema</h3>
    <div class="chips" style="margin-top:0">${(idx.categorias || []).map(
      (c) => `<a href="#biblioteca/${esc(c.clave)}">${esc(c.nombre)}</a>`).join("")}</div>`;

  const caja = document.getElementById("res-bib");
  const input = document.getElementById("q-bib");

  const pintar = (q, esperando) => {
    if (!q.trim()) {
      const lista = cat ? idx.temas.filter((t) => t.categoria === cat.clave) : idx.temas;
      caja.innerHTML = chipsCat +
        `<h3 class="sec">${cat ? "Temas" : "Todos los temas"} · ${lista.length}</h3>` +
        lista.map(tarjetaTema).join("");
      return `${lista.length} temas`;
    }
    const res = buscarTemas(q, idx);
    if (!res.length) {
      // Mientras las palabras del cuerpo vienen de camino no se puede decir que
      // no hay nada: decirlo y desdecirse medio segundo después asusta para nada.
      if (esperando) { caja.innerHTML = `<div class="empty">Buscando…</div>`; return ""; }
      // Lo que no está en la biblioteca puede estar en el Detector: un producto,
      // una terapia con nombre comercial. Antes este «sin resultados» no lo decía.
      caja.innerHTML = `<h3 class="sec">Sin resultados</h3><div class="card">
        <h4>No encontré nada para «${esc(q)}»</h4>
        <p>Prueba con otras palabras —por ejemplo «duerme» en vez de «insomnio»—
        o explora por categorías.</p>
        <p>¿Es el nombre de una terapia, un producto o una prueba?
        <a href="#detector/${encodeURIComponent(q)}">Compruébalo en el Detector</a>.</p></div>` + chipsCat;
      return `Sin resultados para ${q}`;
    }
    caja.innerHTML = `<h3 class="sec" style="margin-top:8px">${res.length} resultado${
      res.length > 1 ? "s" : ""} para «${esc(q)}»</h3>` +
      res.slice(0, 25).map((r) => tarjetaTema(r.tema)).join("") +
      (res.length > 25 ? `<p class="nf" style="text-align:center">Mostrando los 25 más relacionados.</p>` : "");
    return `${res.length} resultado${res.length > 1 ? "s" : ""} para ${q}`;
  };

  // Se pinta ya con lo que hay en el índice y, si hace falta, se repinta cuando
  // llegan las palabras del cuerpo: nadie ve una rueda girando por una búsqueda
  // que el índice ya sabía contestar, y los resultados solo pueden mejorar.
  // Buscar no cambia de pantalla, solo la caja de resultados: si el resumen no
  // se anuncia, quien no ve la pantalla no se entera de que hay respuesta.
  const buscar = (q) => {
    const esperando = !!q.trim() && !_busqueda;
    anunciar(pintar(q, esperando));
    if (!esperando) return;
    cargarBusqueda().then(() => { if (input.value.trim() === q) anunciar(pintar(q)); });
  };

  // En cuanto alguien escribe se empieza a bajar, para que al pulsar "Buscar"
  // ya esté aquí. Quien solo mira categorías no lo baja nunca.
  input.addEventListener("input", cargarBusqueda);

  document.getElementById("f-bib").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    history.replaceState(null, "", q ? "#biblioteca/" + encodeURIComponent(q) : "#biblioteca");
    buscar(q);
  });
  buscar(consulta);
}

/* ---------- Un tema de la biblioteca ---------- */
/* Cada tema se baja SOLO: content/temas/XX.json, unos 3 KB comprimidos de
   mediana. Antes, abrir cualquier tema por primera vez bajaba el cuerpo entero
   de la biblioteca —5 MB, 1,6 MB comprimidos—: con datos móviles lentos eran
   decenas de segundos mirando «Cargando…», también para leer qué hacer durante
   una convulsión. El cuerpo entero sigue existiendo para quien lo pide a
   propósito («Usar sin conexión», en Inicio), y si ya está en memoria se usa. */
let _cuerpos = null;
const _temasSueltos = Object.create(null);
const CUERPO_ENTERO = "content/biblioteca-cuerpo.json";

async function cuerpoDe(cod) {
  if (_cuerpos && _cuerpos[cod]) return _cuerpos[cod];
  if (_temasSueltos[cod]) return _temasSueltos[cod];
  try {
    return (_temasSueltos[cod] = await getJSON(`content/temas/${encodeURIComponent(cod)}.json`));
  } catch (e) {
    // Sin red y sin ese tema guardado. Si la familia guardó la biblioteca
    // entera para usarla sin conexión, el service worker la sirve desde ahí.
    try { _cuerpos = _cuerpos || await getJSON(CUERPO_ENTERO); }
    catch (_) { throw e; }
    return _cuerpos[cod] || null;
  }
}

async function renderTema(codigo) {
  const mia = _ruta;
  loading();
  const idx = await cargarIndice();
  if (mia !== _ruta) return;
  const cod = String(codigo || "").toUpperCase();
  // El índice dice qué temas existen: un código que no está no se pide a la
  // red, y sobre todo no dispara la descarga de la biblioteca entera.
  if (!(idx.temas || []).some((t) => t.codigo === cod)) {
    view.innerHTML = `<div class="callout warn">No encuentro ese tema.
      <a href="#biblioteca">Volver a la biblioteca</a>.</div>`;
    return;
  }
  let tema, sinRed = false;
  try { tema = await cuerpoDe(cod); } catch (_) { sinRed = true; }
  if (mia !== _ruta) return;
  if (sinRed) {
    view.innerHTML = `<div class="callout warn"><strong>Sin conexión.</strong> Este tema todavía no
      está guardado en el teléfono. Se guarda solo la primera vez que lo abres con internet, o
      todos a la vez con «Usar sin conexión», en <a href="#inicio">Inicio</a>.</div>
      <a class="cta-ayuda" href="#ayuda">${ICONOS.telefono}<span>Los teléfonos de ayuda y emergencias sí
      funcionan sin conexión</span></a>`;
    return;
  }
  if (!tema) {
    view.innerHTML = `<div class="callout warn">No encuentro ese tema.
      <a href="#biblioteca">Volver a la biblioteca</a>.</div>`;
    return;
  }
  const temasIdx = idx.temas || [];
  const meta = temasIdx.find((t) => t.codigo === cod) || {};
  const codigos = new Set(temasIdx.map((t) => t.codigo));
  // «También te puede servir» eran los cuatro primeros temas de la misma
  // categoría, siempre los mismos: los 101 temas de salud ofrecían los mismos
  // cuatro, vinieran de una convulsión o de la regla. Ahora van primero las
  // fichas que este tema cita de verdad, en el orden en que las cita —que es
  // el orden editorial, con las urgencias delante—, y solo si faltan se
  // completa con la categoría.
  const porCodigo = new Map(temasIdx.map((t) => [t.codigo, t]));
  const citados = [];
  for (const m of String(tema.cuerpo || "").matchAll(/\*\*([A-Z]{1,2})(?:\.\s[^*]*)?\*\*/g)) {
    const c = m[1];
    if (c !== cod && porCodigo.has(c) && !citados.includes(c) && !NO_ES_REMISION.has(c)) citados.push(c);
  }
  const relacionados = citados.slice(0, 4).map((c) => porCodigo.get(c));
  for (const t of temasIdx) {
    if (relacionados.length >= 4) break;
    if (t.categoria === meta.categoria && t.codigo !== cod && !relacionados.includes(t)) relacionados.push(t);
  }

  const verificado = /VERIFICADO/.test(tema.estado || "");
  view.innerHTML = `
    <p class="migas"><a href="#biblioteca/${esc(meta.categoria || "")}">${
      esc(tema.categoriaNombre || "Biblioteca")}</a></p>
    <h1 class="page">${esc(tema.titulo)}</h1>
    <p class="estado">${verificado
      ? badge("verificado", "Fuentes comprobadas")
      : badge("vivida", "Síntesis con fuentes")}</p>
    ${leyendaNiveles(tema.cuerpo)}
    <article class="tema-cuerpo">${mdRender(tema.cuerpo,
      `<a class="cta-ayuda" href="#ayuda">${ICONOS.telefono}<span>Teléfonos de ayuda y emergencias de tu país</span></a>`,
      codigos)}</article>
    ${tema.fuentes && tema.fuentes.length ? `
      <h3 class="sec">Fuentes · ${tema.fuentes.length}</h3>
      <div class="lista fuentes">${tema.fuentes.map((f) => urlSegura(f.url) ? `
        <a class="fila" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">
          <span class="txt"><span class="titulo">${esc(f.label)}</span></span>
          <span class="ext">${ICONOS.externo}</span></a>` : `
        <div class="fila sin-enlace">
          <span class="txt"><span class="titulo">${esc(f.label)}</span></span></div>`).join("")}</div>` : ""}
    ${relacionados.length ? `
      <h3 class="sec">También te puede servir</h3>
      ${relacionados.map(tarjetaTema).join("")}` : ""}
    <div class="nota">Esta información orienta; <strong>no diagnostica ni sustituye</strong>
      a un profesional. ¿Hay riesgo ahora? <a href="#ayuda">Teléfonos de ayuda</a>.</div>
  `;
}

/* ---------- Ayuda urgente ---------- */
/* «911 · 107 (SAME)» → dos enlaces de llamada. El número de emergencias era el
   único de la pantalla que había que teclear a mano, y es el que se marca con
   más prisa. Solo se enlazan números cortos de emergencia (3 a 4 cifras); el
   resto del texto se queda como estaba. */
function telefonosPulsables(texto) {
  return esc(texto).replace(/(^|[^\d])(\d{3,4})(?!\d)/g,
    (todo, antes, num) => `${antes}<a class="tel-emg" href="tel:${num}"><strong>${num}</strong></a>`);
}

async function renderAyuda() {
  const mia = _ruta;
  loading();
  const d = await getJSON("content/ayuda-urgente.json");
  if (mia !== _ruta) return;
  // El número principal se convierte en enlace de llamada cuando es marcable.
  const tel = (linea) => {
    const m = String(linea).match(/[\d*][\d\s*]{2,}/);
    return m ? m[0].replace(/\s/g, "") : null;
  };
  view.innerHTML = `
    <h1 class="page">${esc(d.titulo)}</h1>
    <div class="aviso">${esc(d.intro)}</div>
    ${d.notaEscrito ? `<div class="nota">${esc(d.notaEscrito)}</div>` : ""}
    ${d.paises.map((p) => {
      const num = tel(p.linea);
      return `<article class="pais">
        <div class="nombre">${esc(p.pais)}</div>
        ${num
          ? `<a class="tel" href="tel:${esc(num)}">${ICONOS.telefono}<span>${esc(p.linea)}</span></a>`
          : `<div class="tel">${ICONOS.telefono}<span>${esc(p.linea)}</span></div>`}
        <p class="desc">${esc(p.descripcion)}</p>
        ${p.escrito ? `<p class="escrito"><strong>Por escrito:</strong> ${esc(p.escrito)}</p>` : ""}
        ${p.emergencias ? `<p class="emg">Emergencias: ${telefonosPulsables(p.emergencias)}</p>` : ""}
      </article>`;
    }).join("")}
    <h3 class="sec">Señales de alarma</h3>
    <ul class="checks">${d.senalesDeAlarma.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <h3 class="sec">Qué puedes hacer</h3>
    <ul class="checks">${d.queHacer.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <div class="nota" style="margin-top:16px"><strong>Y tú también cuentas.</strong>
      ${esc(d.avisoCuidador)}</div>
  `;
}

/* ---------- Evidencia ---------- */
async function renderEvidencia() {
  const mia = _ruta;
  loading();
  const data = await getJSON("content/evidencia.json");
  if (mia !== _ruta) return;
  const lg = data.leyenda;
  const legend = ["alta", "media", "evitar"].map(
    (k) => badge(k, lg[k].texto)
  ).join(" ");
  const secciones = data.secciones.map((s) => `
    <section id="${esc(s.id)}">
      <h3 class="sec">${esc(s.titulo)}</h3>
      <p class="sec-intro">${esc(s.intro)}</p>
      ${s.items.map((it) => card(it)).join("")}
    </section>
  `).join("");
  view.innerHTML = `
    <h1 class="page">Centro de evidencia</h1>
    <h2 class="page-sub">Cada afirmación está anclada a una fuente que puedes abrir y comprobar.</h2>
    <div class="tema-meta" style="margin-bottom:16px">${legend}</div>
    <div class="spacer"></div>
    ${secciones}
  `;
}

function card(it) {
  const clase = it.nivel === "evitar" ? "evitar" : it.nivel === "media" ? "media" : "alta";
  return `
    <article class="card">
      <h4>${esc(it.titulo)}</h4>
      <p>${esc(it.texto)}</p>
      <div class="tema-meta">${badge(clase, lvlLabel(it.nivel))}</div>
      ${sourcesHTML(it.fuentes)}
    </article>`;
}
function lvlLabel(l) {
  return l === "alta" ? "Evidencia alta" : l === "media" ? "Evidencia limitada"
    : l === "evitar" ? "Evitar" : l === "ok" ? "Sí tiene evidencia" : l;
}

/* ---------- Detector ---------- */
let _detector = null;
async function renderDetector(inicial = "") {
  const mia = _ruta;
  loading();
  _detector = _detector || await getJSON("content/banderas-rojas.json");
  try { await cargarIndice(); } catch (_) {}   // para poder sugerir temas relacionados
  if (mia !== _ruta) return;
  // Solo unas pocas sugerencias: un muro de 15 chips abruma en un móvil.
  const _todos = _detector.casos;
  const chips = _todos.slice(0, 6).map(
    (c) => `<button type="button" data-id="${esc(c.id)}">${esc(c.nombre)}</button>`
  ).join("") + (_todos.length > 6
    ? `<button type="button" id="ver-todas">Ver las ${_todos.length}</button>` : "");
  view.innerHTML = `
    <h1 class="page">Detector</h1>
    <h2 class="page-sub">${esc(_detector.intro)}</h2>
    <form class="buscador" id="f-det" autocomplete="off" role="search">
      <div class="campo">${ICONOS.buscar}
        <input id="q" type="search" enterkeyhint="search"
          aria-label="Comprobar una terapia, producto o prueba"
          placeholder="p. ej. quelación, test de cabello" /></div>
      <button class="btn" id="go" type="submit">Revisar</button>
    </form>
    <div class="chips" id="chips-det">${chips}</div>
    <div id="result"></div>
  `;
  const input = document.getElementById("q");
  const result = document.getElementById("result");
  const run = (text) => {
    result.innerHTML = detectorResult(text);
    result.scrollIntoView({ block: "nearest" });
    // Aquí tampoco cambia la pantalla, solo la ficha. Se anuncia el veredicto y
    // el nombre, que es lo que la familia ha venido a saber, y nada más.
    const v = result.querySelector(".verdict");
    const h = result.querySelector("h4");
    anunciar([v, h].filter(Boolean).map((n) => n.textContent.trim()).join(": "));
  };
  document.getElementById("f-det").addEventListener("submit", (e) => {
    e.preventDefault(); run(input.value);
  });
  const verTodas = document.getElementById("ver-todas");
  if (verTodas) verTodas.onclick = () => {
    result.innerHTML = `<h3 class="sec">Todas las fichas · ${_todos.length}</h3>
      <div class="lista">${_todos.map((c) => `
        <a class="fila" href="#" data-ficha="${esc(c.id)}">
          <span class="txt"><span class="titulo">${esc(c.nombre)}</span></span>
          <span class="chevron">${ICONOS.chevron}</span></a>`).join("")}</div>`;
  };
  // Un solo manejador por pantalla, colgado de un elemento que se repinta con
  // ella. Antes eran dos colgados de <main>, que no se repinta nunca: cada
  // visita al detector sumaba otros dos, ninguno se quitaba, y el veredicto se
  // calculaba y se anunciaba tantas veces como visitas llevara la familia. Y
  // los seis chips de sugerencia de arriba no los atendía ninguno de los dos
  // —uno miraba «[data-ficha]» y el otro solo «.suggest»—, así que pulsarlos
  // no hacía nada.
  const abrir = (id) => {
    const c = _detector.casos.find((x) => x.id === id);
    if (!c) return;
    input.value = c.nombre;
    run(c.nombre);
  };
  // «#detector/consulta»: llega ya escrita desde un «sin resultados» de la biblioteca.
  if (inicial) { input.value = inicial; run(inicial); }
  for (const zona of [document.getElementById("chips-det"), result]) {
    zona.addEventListener("click", (e) => {
      const el = e.target.closest("[data-ficha], button[data-id]");
      if (!el || !zona.contains(el)) return;
      e.preventDefault();
      abrir(el.dataset.ficha || el.dataset.id);
    });
  }
}

/**
 * Puntúa las fichas del detector. Importante: NUNCA devolvemos un veredicto
 * "adivinado" por una coincidencia de letras sueltas — un falso 🔴 asusta a una
 * familia sin motivo. Toda coincidencia es de palabra completa.
 *
 * Se mira en las dos direcciones, porque una familia no escribe fichas, escribe
 * frases: el alias dentro de la consulta («quieren darle MMS a mi hijo») y la
 * consulta dentro del nombre de la ficha («cabello» → «test de cabello»).
 */
function buscarFichas(text) {
  const q = limpiaConsulta(text);
  if (q.length < 3) return [];
  const tokens = tokenizar(q);
  const salida = [];
  for (const c of _detector.casos) {
    const objetivos = [c.nombre, ...(c.alias || [])].map(limpiaConsulta).filter(Boolean);
    let p = 0;
    for (const o of objetivos) {
      if (o === q) { p = 100; break; }
      // El alias completo aparece dentro de la frase. Aquí la coincidencia es
      // fuerte aunque el alias sea corto: "mms" y "cds" son justo los nombres
      // que más importa reconocer, y exigir palabra completa ya evita que
      // "stem" salte dentro de "sistema".
      if (palabraDentro(q, o)) { p = Math.max(p, 90); continue; }
      // La consulta es parte del nombre de la ficha. Solo es fuerte si son
      // VARIAS palabras y cubren buena parte de él. Una palabra suelta nunca
      // resuelve sola: antes bastaba con que el alias fuese corto, así que
      // "terapia" caía en "terapia de luz" y "dieta" en "dieta cura" y la
      // familia recibía un veredicto concreto de una palabra genérica. Con
      // varias palabras no pasa, y ninguna ficha deja de encontrarse por su
      // propio nombre: lo que hace esta regla es mandar la palabra suelta al
      // "¿a cuál te refieres?", que es donde tiene que ir.
      if (palabraDentro(o, q)) {
        const fuerte = q.includes(" ") && q.length >= o.length * 0.5;
        p = Math.max(p, fuerte ? 55 : 35);
      }
    }
    if (p === 0) {
      const aciertos = tokens.filter(
        (t) => t.length >= 4 && objetivos.some((o) => palabraDentro(o, t))
      ).length;
      if (aciertos) p = 15 * aciertos;
    }
    if (p > 0) salida.push({ caso: c, puntos: p });
  }
  return salida.sort((a, b) => b.puntos - a.puntos);
}

/* «Es un mito» es un veredicto aparte, no un «Evítalo». Las cuatro fichas de
   mitos sobre la causa del autismo —vacunas, paracetamol en el embarazo, wifi
   y antenas, intestino permeable— salían con un «Evítalo» rojo encima, y quien
   buscaba «vacunas» o «paracetamol embarazo» leía «Evítalo» al lado de la
   palabra: justo lo contrario de lo que la ficha dice. */
function fichaHTML(hit) {
  const v = hit.veredicto;
  const clase = v === "ok" ? "alta" : v === "media" ? "media" : "evitar";
  const titulo = v === "ok" ? "Tiene evidencia"
    : v === "media" ? "Cautela: evidencia incierta"
    : v === "mito" ? "Es un mito" : "Evítalo";
  return `
    <article class="card">
      <div class="verdict ${clase}"><span class="dot"></span>${esc(titulo)}</div>
      <h4>${esc(hit.nombre)}</h4>
      <p><strong>${esc(hit.resumen)}</strong></p>
      <p>${esc(hit.porque)}</p>
      ${sourcesHTML(hit.fuentes)}
    </article>`;
}

function detectorResult(text) {
  const bruto = String(text || "").trim();
  if (!bruto) return "";
  if (limpiaConsulta(bruto).length < 3) {
    return `<div class="card"><h4>Escribe un poco más</h4>
      <p>Necesito al menos tres letras para buscar sin confundirme. Prueba con el nombre
      completo de la terapia o el producto.</p></div>`;
  }
  const res = buscarFichas(bruto);

  // Sin ficha propia: no inventamos veredicto. Ofrecemos la regla general
  // y, si la biblioteca tiene algo del tema, un puente hacia ahí.
  if (!res.length) {
    let puente = "";
    if (_indice) {
      const rel = buscarTemas(bruto, _indice).slice(0, 3);
      if (rel.length) {
        puente = `<h4 style="margin-top:14px">En la biblioteca sí hay información relacionada</h4>` +
          rel.map((r) => tarjetaTema(r.tema)).join("");
      }
    }
    return `<div class="card"><h4>No tengo una ficha de «${esc(bruto)}»</h4>
      <p>Eso <strong>no</strong> quiere decir que sea bueno ni malo: simplemente aún no está en el detector.
      Regla general: si una terapia o prueba no aparece en estudios independientes, promete una
      «cura», o te piden dinero por desintoxicar, quelación o MMS, trátala como bandera roja
      y consúltalo con un profesional.</p>
      <a class="btn ghost" href="#tema/BR">Cómo elegir terapias con criterio</a></div>${puente}`;
  }

  // Coincidencia DÉBIL (una palabra genérica como "terapia" o "dieta", que solo
  // aparece dentro del nombre de alguna ficha): no damos veredicto todavía y
  // preguntamos a qué se refiere. Un 🔴 por una coincidencia parcial asustaría
  // a una familia sin motivo, que es justo lo contrario de lo que queremos.
  if (res[0].puntos < 50) {
    const varias = res.length > 1;
    // Si entre las candidatas hay algo que conviene evitar, se dice ya, sin
    // esperar a que la familia adivine cuál abrir. Callarlo es el fallo caro.
    const rojas = res.filter((o) => o.caso.veredicto === "evitar").slice(0, 4);
    const aviso = rojas.length
      ? `<div class="callout warn" style="margin-top:12px"><strong>Ojo.</strong> Entre las
          coincidencias hay ${rojas.length > 1
            ? "tratamientos que conviene evitar"
            : "un tratamiento que conviene evitar"}:
          ${rojas.map((o) => esc(o.caso.nombre)).join(" · ")}. Ábrelo y verás por qué.</div>`
      : "";
    return `<div class="card"><h4>¿A cuál te refieres?</h4>
      <p>«${esc(bruto)}» ${varias ? "coincide con varias fichas" : "coincide en parte con esta ficha"}.
      Elige para ver el veredicto con sus fuentes:</p>
      <div class="suggest">${res.slice(0, 6).map(
        (o) => `<button type="button" data-id="${esc(o.caso.id)}">${esc(o.caso.nombre)}</button>`
      ).join("")}</div>${aviso}</div>`;
  }

  // Coincidencia clara: mostramos la ficha. Si hay más candidatas, se listan debajo.
  const principal = fichaHTML(res[0].caso);
  const otras = res.slice(1, 4);
  if (!otras.length || res[0].puntos >= 100) return principal;
  return principal + `
    <div class="card"><h4>¿Buscabas otra cosa?</h4>
      <div class="suggest">${otras.map(
        (o) => `<button type="button" data-id="${esc(o.caso.id)}">${esc(o.caso.nombre)}</button>`
      ).join("")}</div></div>`;
}

/* ---------- Rastreador (IndexedDB local) ---------- */
const DB_NAME = "brujula-tea";
const STORE = "registros";
/* Una sola conexión para toda la sesión. Antes cada lectura y cada escritura
   abría una nueva y ninguna se cerraba; y sin `onversionchange`, el día que
   cambie el esquema una pestaña vieja abierta bloquearía la actualización de
   la nueva. Si abrir falla, se olvida, para reintentar la próxima vez. */
let _db = null;
function openDB() {
  if (!_db) {
    _db = abrirDB().then((db) => {
      db.onversionchange = () => { db.close(); _db = null; };
      return db;
    }).catch((e) => { _db = null; throw e; });
  }
  return _db;
}
function abrirDB() {
  return new Promise((resolve, reject) => {
    /* Cuando el navegador bloquea el almacenamiento ni siquiera existe
       indexedDB, y el fallo llegaría como un «no se puede leer open de
       undefined» que no le dice nada a nadie. Le ponemos aquí el nombre que el
       rastreador sabe traducir a un mensaje para la familia. */
    if (!window.indexedDB) {
      const bloqueado = new Error("El navegador no deja usar el almacenamiento");
      bloqueado.name = "SecurityError";
      return reject(bloqueado);
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    // Del más reciente al más antiguo; dos del mismo día, por cuándo se escribieron.
    tx.onsuccess = () => resolve(tx.result.sort((a, b) =>
      (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.creado || 0) - (a.creado || 0))));
    tx.onerror = () => reject(tx.error);
  });
}
async function dbAdd(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    /* Se espera a que la TRANSACCIÓN se confirme, no a que la petición diga que
       sí: onsuccess dispara con el dato todavía en memoria, y una escritura que
       luego aborta por falta de espacio se daría por guardada. La familia vería
       su registro en pantalla y mañana no estaría. */
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add(entry);
    tx.oncomplete = () => resolve(req.result);
    tx.onabort = tx.onerror = () => reject(tx.error || req.error);
  });
}
/* Borrar todo en UNA transacción: o se borra todo o no se borra nada. Antes se
   borraba registro a registro, y un fallo a mitad dejaba parte de los datos del
   niño en el dispositivo después de que la familia pidiera borrarlos. */
async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    // Igual que en dbAdd: manda la confirmación de la transacción, no la de la
    // petición. Un borrado que aborta no puede darse por hecho.
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || req.error);
  });
}

/* El fichero de salida es un CSV y no un JSON a propósito: quien lo va a abrir
   es la propia familia o el profesional que lleva al niño, y un CSV se abre en
   Excel, en Numbers y en Hojas de cálculo sin instalar nada. Lleva BOM porque
   sin él Excel se come los acentos, y separa con punto y coma porque es lo que
   espera un Excel en español: con comas, la hoja entera cae en una columna. */
function registrosCSV(entries) {
  // Una observación que empieza por "=", "+" o "@" la hoja de cálculo la lee
  // como fórmula y la celda acaba mostrando #NAME? en vez de lo que escribió la
  // familia. No es un problema de seguridad aquí —el texto lo escribe quien lo
  // va a leer— sino de que la nota que se lleva a la consulta llegue entera.
  // Se le antepone un apóstrofo, que es lo que Excel entiende como "esto es
  // texto"; el dato no se toca.
  const texto = (v) => {
    const t = String(v == null ? "" : v);
    return /^[=+@\t\r]/.test(t) ? "'" + t : t;
  };
  const campo = (v) => '"' + texto(v).replaceAll('"', '""') + '"';
  const fila = (celdas) => celdas.map(campo).join(";");
  // Del más antiguo al más reciente, al revés que en pantalla: así se lee una
  // evolución, que es para lo que se lleva esto a la consulta.
  const filas = entries.slice().reverse().map((e) => fila([e.fecha, e.animo, e.interv, e.nota]));
  const cabecera = fila(["Fecha", "Ánimo del día (1 = peor, 5 = mejor)", "Intervención o actividad", "Observación"]);
  return "\ufeff" + [cabecera].concat(filas).join("\r\n") + "\r\n";
}

/* La descarga se prepara y se consume dentro del navegador: no hay ninguna
   petición de red, los registros no salen del dispositivo ni para exportarse.
   El nombre del fichero no lleva el del niño porque acaba en la carpeta de
   descargas, que es un sitio que ve cualquiera que coja el teléfono. */
function descargar(texto, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revocar en el mismo tic deja a algunos navegadores sin fichero que guardar.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* IndexedDB es "best effort": el navegador puede vaciarlo cuando le falte
   espacio. persist() pide que no lo haga. Se pide al guardar un registro y no
   al abrir la app porque el permiso solo se entiende cuando ya hay algo que
   perder: en los navegadores que preguntan, la pregunta llega justo después de
   que la familia haya escrito algo que quiere conservar, y quien solo viene a
   leer la biblioteca no la ve nunca. Una vez por carga de página, para no
   convertir cada registro en una pregunta. Si el navegador lo niega no se
   insiste ni se bloquea nada: la pestaña ya avisa de que conviene exportar. */
let _persistPedida = false;
async function pedirPersistencia() {
  if (_persistPedida || !navigator.storage || !navigator.storage.persist) return;
  _persistPedida = true;
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch (_) {}
}

/* Que la base falle no es un detalle técnico: la familia cree que ha guardado
   el día de su hijo y no ha guardado nada. Separamos el navegador que bloquea el
   almacenamiento (modo privado: la salida es abrir la app en una ventana normal,
   y no es un fallo nuestro) del dispositivo sin espacio, porque lo que la
   familia puede hacer es distinto en cada caso. */
function motivoDB(err) {
  const nombre = String((err && err.name) || "");
  if (/^(SecurityError|InvalidStateError|NotAllowedError|UnknownError)$/.test(nombre))
    return "Tu navegador no está dejando guardar nada en este dispositivo. " +
      "Suele pasar en una ventana privada o de incógnito: abre la app en una ventana normal " +
      "y vuelve a intentarlo. No es un fallo de la app, y tus datos no han salido a ningún sitio.";
  if (nombre === "QuotaExceededError")
    return "Este dispositivo se ha quedado sin espacio libre. Libera espacio o borra algún " +
      "registro antiguo y vuelve a intentarlo.";
  return "Algo ha ido mal con el almacenamiento de este dispositivo. Cierra la app y vuelve a " +
    "abrirla; si sigue igual, prueba desde otro navegador.";
}

/* Todos los avisos del rastreador salen por el mismo hueco, arriba del
   formulario: la familia no tiene que buscar dónde está el problema. No se usa
   errorBox porque ese borra la vista entera, y aquí hay que dejar el formulario
   en pie con lo que la familia acaba de escribir. */
function avisoDB(titulo, err) {
  const el = document.getElementById("aviso-track");
  if (!el) return;
  el.innerHTML = `<div class="callout warn"><strong>${esc(titulo)}</strong><br>${esc(motivoDB(err))}</div>`;
  el.scrollIntoView({ block: "nearest" });
}

const MOODS = ["😟", "😐", "🙂", "😀", "🤩"];

/* La fecha de HOY en el reloj del teléfono. `toISOString()` da la de Greenwich:
   en México, a partir de las seis de la tarde, el formulario proponía ya el día
   de mañana; y en España, entre las doce y las dos de la noche, `max` era
   todavía ayer y el navegador se negaba a guardar el registro de hoy. */
function hoyLocal(d = new Date()) {
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
async function renderRastreador() {
  const mia = _ruta;
  loading();
  let entries = [];
  /* Un error de lectura no es una lista vacía: si nos lo tragamos, la familia
     con meses de registros lee «Sin registros todavía» y cree que los ha
     perdido. Lo guardamos para poder decirle la verdad más abajo. */
  let fallo = null;
  try { entries = await dbAll(); } catch (e) { fallo = e; }
  // persisted() no pregunta nada: solo dice si el navegador ya se comprometió a
  // conservar el almacén. Sirve para avisar a la familia, no para decidir.
  let persistente = null;
  try { persistente = await navigator.storage.persisted(); } catch (_) {}
  if (mia !== _ruta) return;
  const today = hoyLocal();
  view.innerHTML = `
    <h1 class="page">Seguimiento de mi hijo</h1>
    <h2 class="page-sub">Registra qué intervención hiciste y cómo estuvo el día. <strong>Todo se guarda solo en este dispositivo.</strong></h2>
    <div id="aviso-track"></div>

    <div class="card">
      <form id="f-track">
        <div class="row">
          <div><label for="fecha">Fecha</label><input id="fecha" type="date" value="${today}" max="${today}" required></div>
          <div><label for="animo">Ánimo / día (1 a 5)</label>
            <select id="animo">${MOODS.map((m, i) => `<option value="${i + 1}">${m} ${i + 1}</option>`).join("")}</select></div>
        </div>
        <label for="interv">Intervención o actividad</label>
        <input id="interv" type="text" placeholder="p. ej. terapia de lenguaje, juego compartido…" autocomplete="off">
        <label for="nota">Observación (opcional)</label>
        <textarea id="nota" rows="2" placeholder="¿Qué notaste? avances, dificultades…"></textarea>
        <div class="spacer"></div>
        <button class="btn block" type="submit">Guardar registro</button>
      </form>
    </div>

    <section>
      <h3 class="sec">Tu progreso</h3>
      <p class="sec-intro">Ánimo de los últimos registros (de izquierda = más antiguo a derecha = más reciente).</p>
      <div class="card" id="chart"></div>
    </section>

    <section>
      <h3 class="sec">Historial</h3>
      ${entries.length ? `<p class="sec-intro">Estos registros están solo en este teléfono: no viajan si cambias
        de móvil y se pierden si borras los datos de navegación. Exporta una copia de vez en cuando; el fichero se
        abre con Excel u Hojas de cálculo y sirve para enseñárselo a quien lleva a tu hijo.</p>
      <button class="btn ghost" id="export">Exportar mis registros</button>
      <div class="spacer"></div>` : ""}
      ${entries.length && persistente === false ? `<div class="callout">Este navegador no se ha comprometido a
        conservar los datos de la app, así que puede vaciarlos si se queda sin espacio. Añadir Brújula TEA a la
        pantalla de inicio suele evitarlo; mientras tanto, exporta una copia.</div>` : ""}
      <div id="list"></div>
      <div class="spacer"></div>
      <button class="btn danger" id="wipe" ${entries.length ? "" : "hidden"}>Borrar todos mis datos</button>
    </section>
  `;
  document.getElementById("f-track").addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = {
      fecha: document.getElementById("fecha").value,
      animo: Number(document.getElementById("animo").value),
      interv: document.getElementById("interv").value.trim(),
      nota: document.getElementById("nota").value.trim(),
      creado: Date.now()
    };
    if (!entry.fecha) return;
    // Un doble toque en «Guardar» creaba dos registros iguales: el botón se
    // bloquea mientras dura la escritura.
    const boton = e.submitter || document.querySelector("#f-track button[type=submit]");
    if (boton) { if (boton.disabled) return; boton.disabled = true; }
    /* Si la escritura falla no repintamos: el formulario se queda con lo que la
       familia escribió, para que pueda reintentarlo sin volver a teclearlo, y el
       aviso dice sin rodeos que ese registro NO está guardado. */
    try { await dbAdd(entry); }
    catch (err) { if (boton) boton.disabled = false; return avisoDB("Este registro no se ha guardado.", err); }
    // Guardar es el momento de pedir que el navegador no desaloje el almacén:
    // ahora sí hay algo que perder.
    await pedirPersistencia();
    renderRastreador();
  });
  const exportar = document.getElementById("export");
  if (exportar) exportar.onclick = () => descargar(
    registrosCSV(entries), `brujula-tea-registros-${today}.csv`, "text/csv;charset=utf-8");
  const wipe = document.getElementById("wipe");
  if (wipe) wipe.onclick = async () => {
    if (!confirm("¿Borrar TODOS los registros de este dispositivo? No se puede deshacer.")) return;
    /* Si el borrado se queda a medias repintamos antes de avisar, para que el
       historial muestre lo que de verdad sigue en el dispositivo. */
    try { await dbClear(); }
    catch (err) { await renderRastreador(); return avisoDB("No hemos podido borrar todos tus registros.", err); }
    renderRastreador();
  };
  if (fallo) avisoDB("No hemos podido leer tus registros guardados.", fallo);
  paintChart(entries, fallo);
  paintList(entries, fallo);
}

function paintChart(entries, fallo) {
  const el = document.getElementById("chart");
  if (fallo) { el.innerHTML = `<div class="empty">No hemos podido leer el historial.</div>`; return; }
  if (!entries.length) { el.innerHTML = `<div class="empty">Aún no hay registros. Agrega el primero arriba.</div>`; return; }
  const last = entries.slice(0, 14).reverse();
  // La gráfica es altura y nada más: el ánimo no está escrito en ninguna parte.
  // Se resume en una frase, del registro más antiguo al más reciente.
  const resumen = last.map((e) => `${e.fecha}, ${e.animo} de 5`).join("; ");
  el.innerHTML = `<div class="bars" role="img" aria-label="Ánimo de ${last.length} registro${
    last.length > 1 ? "s" : ""}, del más antiguo al más reciente: ${esc(resumen)}">${last.map((e) => {
    const h = (e.animo / 5) * 100;
    return `<div class="bar" style="height:${h}%" title="${esc(e.fecha)}: ${MOODS[e.animo - 1]}"><span>${esc(e.fecha.slice(5))}</span></div>`;
  }).join("")}</div><div class="spacer"></div>`;
}

function paintList(entries, fallo) {
  const el = document.getElementById("list");
  if (fallo) { el.innerHTML = `<div class="empty">No hemos podido leer el historial. Esto no significa que no tengas registros.</div>`; return; }
  if (!entries.length) { el.innerHTML = `<div class="empty">Sin registros todavía.</div>`; return; }
  el.innerHTML = entries.map((e) => `
    <article class="card">
      <div class="tracker-entry">
        <div>
          <strong>${esc(e.fecha)}</strong> <span class="mood">${MOODS[e.animo - 1] || ""}</span>
          ${e.interv ? `<div>${esc(e.interv)}</div>` : ""}
          ${e.nota ? `<small>${esc(e.nota)}</small>` : ""}
        </div>
        <button class="btn ghost" data-del="${e.id}" aria-label="Borrar el registro del ${esc(e.fecha)}">✕</button>
      </div>
    </article>`).join("");
  el.querySelectorAll("[data-del]").forEach((b) =>
    b.onclick = async () => {
      // La ✕ está pegada al registro y se toca sin querer al hacer scroll. Sin
      // esta pregunta el día se borraba al instante y sin forma de recuperarlo.
      const e = entries.find((x) => x.id === Number(b.dataset.del));
      if (!confirm(`¿Borrar el registro del ${e ? e.fecha : "día elegido"}? No se puede deshacer.`)) return;
      try { await dbDelete(Number(b.dataset.del)); }
      catch (err) { await renderRastreador(); return avisoDB("No hemos podido borrar ese registro.", err); }
      renderRastreador();
    });
}

/* ---------- Asistente (modo demo; listo para conectar Claude) ---------- */
let _demo = null;
async function renderAsistente() {
  const mia = _ruta;
  loading();
  _demo = _demo || await getJSON("content/asistente-demo.json");
  if (mia !== _ruta) return;
  view.innerHTML = `
    <h1 class="page">Asistente</h1>
    <div class="demo-note"><strong>Modo demostración.</strong> Responde a temas frecuentes con fuentes.
      Cuando se conecte la IA (Claude), podrá responder a cualquier pregunta, citando fuentes y sin recomendar nada peligroso. Ver el README.</div>
    <div class="chat-wrap">
      <!-- El chat es el único sitio donde el contenido crece sin cambiar de
           pantalla y sin pasar por anunciar(): las respuestas llegan solas, 250 ms
           después. role="log" con aria-live hace que se lea cada respuesta nueva y
           solo esa. Sin esto, quitar el aria-live del <main> dejaría mudo justo al
           asistente, que es donde está la respuesta de crisis con los teléfonos. -->
      <div class="chat-log" id="log" role="log" aria-live="polite" aria-label="Conversación"></div>
      <form class="chat-form" id="chatf" autocomplete="off">
        <input id="chati" type="text" placeholder="Escribe tu pregunta…" aria-label="Tu mensaje" />
        <button class="btn" type="submit">Enviar</button>
      </form>
    </div>
  `;
  const log = document.getElementById("log");
  pushMsg(log, "bot", _demo.bienvenida, []);
  document.getElementById("chatf").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chati");
    const text = input.value.trim();
    if (!text) return;
    pushMsg(log, "user", text, []);
    input.value = "";
    const reply = demoReply(text);
    setTimeout(() => pushMsg(log, "bot", reply.texto, reply.fuentes), 250);
  });
}

function pushMsg(log, who, text, fuentes) {
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.innerHTML = esc(text) + (who === "bot" ? sourcesHTML(fuentes) : "");
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

/* Coincidencia simple por disparadores. Sustituible por fetch('/api/chat') al activar Claude.
   El disparador tiene que EMPEZAR una palabra, aunque puede acabar dentro de
   ella: los hay que son raíces a propósito («quelac», «desintox», «suicid»).
   Con un `includes` a secas, «ados» saltaba dentro de «preocupados» y «pact»
   dentro de «impacto», y una pregunta sobre el lenguaje recibía la respuesta
   del diagnóstico. */
function demoReply(text) {
  const q = " " + limpiaConsulta(text);
  for (const r of _demo.respuestas) {
    if ((r.disparadores || []).some((d) => {
      // Un «$» al final pide palabra ENTERA: «pelo$» no salta con «pelota».
      const entera = String(d).endsWith("$");
      const dd = limpiaConsulta(d);
      return dd && (entera ? (q + " ").includes(" " + dd + " ") : q.includes(" " + dd));
    }))
      return { texto: r.texto, fuentes: r.fuentes || [] };
  }
  return { texto: _demo.fallback, fuentes: [] };
}

/* ---------- Fuentes ---------- */
async function renderFuentes() {
  const mia = _ruta;
  loading();
  const data = await getJSON("content/fuentes.json");
  if (mia !== _ruta) return;
  const grupos = data.grupos.map((g) => `
    <section>
      <h3 class="sec">${esc(g.titulo)}</h3>
      <div class="card"><div class="sources">${g.fuentes.map(fuenteHTML).join("")}</div></div>
    </section>`).join("");
  view.innerHTML = `
    <h1 class="page">Fuentes y cómo verificar</h1>
    <h2 class="page-sub">${esc(data.intro)}</h2>
    ${grupos}
    <section>
      <h3 class="sec">Cómo comprobarlo tú mismo</h3>
      <div class="card"><ul class="checks">${data.comoVerificar.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
    </section>
  `;
}

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
