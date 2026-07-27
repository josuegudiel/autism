/* Brújula TEA — PWA estática. Vanilla JS, sin dependencias. */
"use strict";

const view = document.getElementById("view");
const TABS = ["inicio", "biblioteca", "evidencia", "detector", "rastreador", "asistente", "fuentes", "ayuda"];

/* ---------- helpers ---------- */
const esc = (s) => String(s == null ? "" : s)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const _cache = {};
async function getJSON(path) {
  if (_cache[path]) return _cache[path];
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error("No se pudo cargar " + path);
  const data = await res.json();
  _cache[path] = data;
  return data;
}

function sourcesHTML(fuentes) {
  if (!fuentes || !fuentes.length) return "";
  return `<div class="sources">${fuentes.map(
    (f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.label)}</a>`
  ).join("")}</div>`;
}

function setActiveTab(tab) {
  document.querySelectorAll(".tabbar a").forEach((a) =>
    a.classList.toggle("active", a.dataset.tab === tab));
}

function loading() { view.innerHTML = `<div class="empty">Cargando…</div>`; }
function errorBox(msg) { view.innerHTML = `<div class="callout warn">${esc(msg)}</div>`; }

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

/* ---------- Mini-render de markdown (negritas, enlaces, listas, citas) ---------- */
function mdInline(t) {
  return esc(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}
function mdRender(md) {
  const out = [];
  let lista = null;
  const cerrar = () => { if (lista) { out.push(`<ul class="md-list">${lista.join("")}</ul>`); lista = null; } };
  for (const linea of String(md || "").split("\n")) {
    const l = linea.trim();
    if (!l) { cerrar(); continue; }
    if (l.startsWith("- ")) {
      (lista = lista || []).push(`<li>${mdInline(l.slice(2))}</li>`);
    } else if (l.startsWith(">")) {
      cerrar();
      out.push(`<blockquote>${mdInline(l.replace(/^>\s*/, ""))}</blockquote>`);
    } else {
      cerrar();
      out.push(`<p>${mdInline(l)}</p>`);
    }
  }
  cerrar();
  return out.join("");
}

/* ---------- Buscador de la biblioteca ---------- */
let _indice = null;
async function cargarIndice() {
  _indice = _indice || await getJSON("content/biblioteca-indice.json");
  return _indice;
}

/**
 * Busca temas y devuelve [{tema, puntos}] ordenados. Nunca devuelve un único
 * resultado "adivinado": si la consulta es muy corta o vaga, devuelve [].
 */
function buscarTemas(consulta, indice) {
  const q = normalize(consulta).trim();
  if (q.length < 3) return [];
  const tokens = tokenizar(q);
  if (!tokens.length) return [];

  // 1) Sinónimos: lo que escribe una familia -> temas concretos.
  const impulso = {};
  for (const [frase, codigos] of Object.entries(indice.sinonimos || {})) {
    if (frase.startsWith("_")) continue;
    const nf = normalize(frase);
    const tf = tokenizar(nf);
    if (!tf.length) continue;
    const comunes = tf.filter((t) => tokens.includes(t)).length;
    let peso = 0;
    if (q.includes(nf) || nf.includes(q)) peso = 30;          // la frase completa aparece
    else if (comunes === tf.length) peso = 24;                // están todas sus palabras
    else if (comunes >= 2) peso = 14;                         // coinciden dos o más
    if (peso) for (const c of codigos) impulso[c] = Math.max(impulso[c] || 0, peso);
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
    if (puntos > 0) resultados.push({ tema, puntos });
  }
  return resultados.sort((a, b) =>
    b.puntos - a.puntos || a.tema.titulo.localeCompare(b.tema.titulo));
}

/* ---------- router ---------- */
async function route() {
  const bruto = location.hash.replace("#", "") || "inicio";
  // Rutas con parámetro: #tema/BA  ·  #biblioteca/salud
  const [raiz, param] = bruto.split("/");
  const hash = raiz.toLowerCase();

  if (hash === "tema" && param) {
    setActiveTab("biblioteca");
    view.scrollIntoView({ block: "start" });
    try { await renderTema(decodeURIComponent(param)); }
    catch (e) { errorBox("Ocurrió un error: " + e.message); }
    view.focus({ preventScroll: true });
    return;
  }

  const tab = TABS.includes(hash) ? hash : "inicio";
  setActiveTab(["fuentes", "ayuda"].includes(tab) ? "inicio" : tab);
  view.scrollIntoView({ block: "start" });
  try {
    if (tab === "inicio") return renderInicio();
    if (tab === "biblioteca") return await renderBiblioteca(param ? decodeURIComponent(param) : "");
    if (tab === "evidencia") return await renderEvidencia();
    if (tab === "detector") return await renderDetector();
    if (tab === "rastreador") return await renderRastreador();
    if (tab === "asistente") return await renderAsistente();
    if (tab === "fuentes") return await renderFuentes();
    if (tab === "ayuda") return await renderAyuda();
  } catch (e) {
    errorBox("Ocurrió un error: " + e.message);
  }
  view.focus({ preventScroll: true });
}
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

/* ---------- Inicio ---------- */
const EJEMPLOS = ["no duerme", "no habla", "se pega", "berrinches", "quelación", "en la escuela"];

async function renderInicio() {
  let n = 222, nf = 1218;
  try { const i = await cargarIndice(); n = i.totalTemas; nf = i.totalFuentes; } catch (_) {}
  view.innerHTML = `
    <div class="hero">
      <h1>Información en la que puedes confiar</h1>
      <p>Escribe lo que te preocupa, con tus palabras. Buscamos entre <strong>${n} temas</strong>
      sobre autismo respaldados por <strong>${nf} fuentes</strong>.</p>
      <form class="buscador" id="f-inicio" autocomplete="off" role="search">
        <input id="q-inicio" type="search" aria-label="Buscar en la biblioteca"
          placeholder="p. ej. mi hijo no duerme" />
        <button class="btn" type="submit">Buscar</button>
      </form>
      <div class="suggest suggest-hero">${EJEMPLOS.map(
        (e) => `<button type="button" data-q="${esc(e)}">${esc(e)}</button>`).join("")}</div>
    </div>
    <div class="tiles">
      <a class="tile" href="#biblioteca"><div class="ico">📚</div><h4>Biblioteca</h4><p>Los ${n} temas, ordenados por categorías: diagnóstico, terapias, escuela, salud, día a día, derechos…</p></a>
      <a class="tile" href="#detector"><div class="ico">🚩</div><h4>Detector de pseudociencia</h4><p>Consulta si una terapia o producto es confiable, dudoso o peligroso.</p></a>
      <a class="tile" href="#rastreador"><div class="ico">📈</div><h4>Seguimiento de mi hijo</h4><p>Registra intervenciones y avances. Los datos se quedan en tu dispositivo.</p></a>
      <a class="tile" href="#evidencia"><div class="ico">✅</div><h4>Lo esencial</h4><p>Un resumen corto para empezar: qué es el TEA, cómo se diagnostica y qué funciona.</p></a>
    </div>
    <div class="spacer"></div>
    <div class="callout">
      ¿Sospechas autismo en tu hijo? Lo más valioso a edades tempranas es una <strong>evaluación formal</strong> y
      empezar pronto la <strong>intervención</strong>. <a href="#tema/BA">Así es el proceso real de diagnóstico.</a>
    </div>
    <div class="callout urgente">
      <strong>¿Necesitas ayuda urgente?</strong> Si tú o tu hijo estáis en peligro o hay pensamientos de hacerse daño,
      <a href="#ayuda">aquí tienes teléfonos de ayuda por país</a>.
    </div>
    <p style="text-align:center;margin-top:18px"><a class="btn ghost" href="#fuentes">Ver todas las fuentes</a></p>
  `;
  const ir = (q) => { if (q.trim()) location.hash = "#biblioteca/" + encodeURIComponent(q.trim()); };
  document.getElementById("f-inicio").addEventListener("submit", (e) => {
    e.preventDefault(); ir(document.getElementById("q-inicio").value);
  });
  view.querySelectorAll(".suggest-hero button").forEach((b) => b.onclick = () => ir(b.dataset.q));
}

/* ---------- Biblioteca (buscar y explorar los temas) ---------- */
function tarjetaTema(tema) {
  const s = tema.semaforos || {};
  const puntos = [
    s.verde ? `<span title="afirmaciones con evidencia sólida">🟢 ${s.verde}</span>` : "",
    s.amarillo ? `<span title="evidencia limitada o en debate">🟡 ${s.amarillo}</span>` : "",
    s.rojo ? `<span title="desaconsejado o desacreditado">🔴 ${s.rojo}</span>` : "",
  ].filter(Boolean).join(" ");
  return `
    <a class="card tema" href="#tema/${esc(tema.codigo)}">
      <div class="tema-cat">${esc(tema.categoriaNombre)}${
        tema.verificado ? ` · <span class="ok" title="fuentes comprobadas">✔ verificado</span>` : ""}</div>
      <h4>${esc(tema.titulo)}</h4>
      <p>${esc((tema.mensaje || "").slice(0, 190))}${(tema.mensaje || "").length > 190 ? "…" : ""}</p>
      <div class="tema-meta">${puntos} <span class="nf">${tema.nFuentes} fuentes</span></div>
    </a>`;
}

async function renderBiblioteca(param) {
  loading();
  const idx = await cargarIndice();
  const cat = (idx.categorias || []).find((c) => c.clave === normalize(param || ""));
  const consulta = cat ? "" : (param || "");

  const chipsCat = (idx.categorias || []).map(
    (c) => `<a class="chip" href="#biblioteca/${esc(c.clave)}">${esc(c.nombre)} <b>${c.n}</b></a>`
  ).join("");

  view.innerHTML = `
    <h1 class="page">Biblioteca</h1>
    <h2 class="page-sub">${idx.totalTemas} temas sobre autismo, con ${idx.totalFuentes} fuentes que puedes abrir y comprobar.</h2>
    <div class="card">
      <label for="q-bib">¿Qué te preocupa? Escríbelo con tus palabras</label>
      <form class="chat-form" id="f-bib" autocomplete="off" role="search">
        <input id="q-bib" type="search" placeholder="p. ej. se despierta de noche" value="${esc(consulta)}" />
        <button class="btn" type="submit">Buscar</button>
      </form>
    </div>
    <div class="cats">${chipsCat}</div>
    <div id="res-bib"></div>
  `;

  const caja = document.getElementById("res-bib");
  const input = document.getElementById("q-bib");

  const pintar = (q) => {
    if (!q.trim()) {
      const lista = cat ? idx.temas.filter((t) => t.categoria === cat.clave) : idx.temas;
      const titulo = cat ? cat.nombre : "Todos los temas";
      caja.innerHTML = `<h3 class="sec">${esc(titulo)} <span class="nf">(${lista.length})</span></h3>` +
        lista.map(tarjetaTema).join("");
      return;
    }
    const res = buscarTemas(q, idx);
    if (!res.length) {
      caja.innerHTML = `<div class="card"><h4>🔎 Sin resultados para «${esc(q)}»</h4>
        <p>Prueba con otras palabras (por ejemplo, «duerme» en vez de «insomnio»), o explora por
        categorías arriba. Si crees que falta un tema, se puede añadir a la biblioteca.</p></div>`;
      return;
    }
    caja.innerHTML = `<h3 class="sec">${res.length} resultado${res.length > 1 ? "s" : ""} para «${esc(q)}»</h3>` +
      res.slice(0, 25).map((r) => tarjetaTema(r.tema)).join("") +
      (res.length > 25 ? `<p class="nf" style="text-align:center">Mostrando los 25 más relacionados.</p>` : "");
  };

  document.getElementById("f-bib").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    history.replaceState(null, "", q ? "#biblioteca/" + encodeURIComponent(q) : "#biblioteca");
    pintar(q);
  });
  pintar(consulta);
}

/* ---------- Un tema de la biblioteca ---------- */
let _cuerpos = null;
async function renderTema(codigo) {
  loading();
  const idx = await cargarIndice();
  _cuerpos = _cuerpos || await getJSON("content/biblioteca-cuerpo.json");
  const cod = String(codigo || "").toUpperCase();
  const tema = _cuerpos[cod];
  if (!tema) {
    view.innerHTML = `<div class="callout warn">No encuentro ese tema.
      <a href="#biblioteca">Volver a la biblioteca</a>.</div>`;
    return;
  }
  const meta = (idx.temas || []).find((t) => t.codigo === cod) || {};
  const relacionados = (idx.temas || [])
    .filter((t) => t.categoria === meta.categoria && t.codigo !== cod).slice(0, 4);

  view.innerHTML = `
    <p class="migas"><a href="#biblioteca">← Biblioteca</a> ·
      <a href="#biblioteca/${esc(meta.categoria || "")}">${esc(tema.categoriaNombre || "")}</a></p>
    <h1 class="page">${esc(tema.titulo)}</h1>
    ${tema.estado ? `<p class="estado">${esc(tema.estado)}</p>` : ""}
    <article class="card tema-cuerpo">${mdRender(tema.cuerpo)}</article>
    ${tema.fuentes && tema.fuentes.length ? `
      <section>
        <h3 class="sec">Fuentes (${tema.fuentes.length})</h3>
        <div class="card">${sourcesHTML(tema.fuentes)}</div>
      </section>` : ""}
    ${relacionados.length ? `
      <section>
        <h3 class="sec">También te puede servir</h3>
        ${relacionados.map(tarjetaTema).join("")}
      </section>` : ""}
    <div class="callout">
      Esta información orienta; <strong>no diagnostica ni sustituye</strong> a un profesional.
      ¿Necesitas ayuda urgente? <a href="#ayuda">Teléfonos por país</a>.
    </div>
  `;
}

/* ---------- Ayuda urgente ---------- */
async function renderAyuda() {
  loading();
  const d = await getJSON("content/ayuda-urgente.json");
  view.innerHTML = `
    <h1 class="page">${esc(d.titulo)}</h1>
    <div class="callout urgente"><p>${esc(d.intro)}</p></div>
    ${d.paises.map((p) => `
      <article class="card">
        <h4>${esc(p.pais)}</h4>
        <p class="linea-tel">${esc(p.linea)}</p>
        <p>${esc(p.descripcion)}</p>
        ${p.emergencias ? `<p class="nf">Emergencias: <strong>${esc(p.emergencias)}</strong></p>` : ""}
        ${p.fuente ? `<div class="sources"><a href="${esc(p.fuente)}" target="_blank" rel="noopener noreferrer">Fuente oficial</a></div>` : ""}
      </article>`).join("")}
    <section>
      <h3 class="sec">Señales de alarma</h3>
      <div class="card"><ul class="checks">${d.senalesDeAlarma.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
    </section>
    <section>
      <h3 class="sec">Qué puedes hacer</h3>
      <div class="card"><ul class="checks">${d.queHacer.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
    </section>
    <div class="callout"><strong>Y tú también cuentas.</strong> ${esc(d.avisoCuidador)}</div>
  `;
}

/* ---------- Evidencia ---------- */
async function renderEvidencia() {
  loading();
  const data = await getJSON("content/evidencia.json");
  const lg = data.leyenda;
  const legend = ["alta", "media", "evitar"].map(
    (k) => `<span class="lvl ${k}">${lg[k].icono} ${esc(lg[k].texto)}</span>`
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
    <div class="card" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">${legend}</div>
    <div class="spacer"></div>
    ${secciones}
  `;
}

function card(it) {
  const lvl = it.nivel;
  const dot = lvl === "evitar" ? "🔴" : lvl === "media" ? "🟡" : "🟢";
  return `
    <article class="card ${lvl === "evitar" ? "evitar" : ""}">
      <h4><span class="dot" aria-hidden="true">${dot}</span><span>${esc(it.titulo)}</span>
        <span class="lvl ${esc(lvl)}" style="margin-left:auto">${lvlLabel(lvl)}</span></h4>
      <p>${esc(it.texto)}</p>
      ${sourcesHTML(it.fuentes)}
    </article>`;
}
function lvlLabel(l) {
  return l === "alta" ? "Evidencia alta" : l === "media" ? "Evidencia limitada"
    : l === "evitar" ? "Evitar" : l === "ok" ? "Sí tiene evidencia" : l;
}

/* ---------- Detector ---------- */
let _detector = null;
async function renderDetector() {
  loading();
  _detector = _detector || await getJSON("content/banderas-rojas.json");
  try { await cargarIndice(); } catch (_) {}   // para poder sugerir temas relacionados
  const chips = _detector.casos.map(
    (c) => `<button type="button" data-id="${esc(c.id)}">${esc(c.nombre)}</button>`
  ).join("");
  view.innerHTML = `
    <h1 class="page">Detector de pseudociencia</h1>
    <h2 class="page-sub">${esc(_detector.intro)}</h2>
    <div class="card">
      <label for="q">Escribe una terapia, producto o afirmación</label>
      <div class="chat-form">
        <input id="q" type="text" placeholder="p. ej. quelación, test de cabello, dieta…" autocomplete="off" />
        <button class="btn" id="go">Revisar</button>
      </div>
      <div class="suggest">${chips}</div>
    </div>
    <div id="result"></div>
  `;
  const input = document.getElementById("q");
  const result = document.getElementById("result");
  const run = (text) => { result.innerHTML = detectorResult(text); result.scrollIntoView({ block: "nearest" }); };
  document.getElementById("go").onclick = () => run(input.value);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(input.value); });
  // Los chips sugeridos y los de "¿buscabas otra cosa?" (que se crean después).
  view.addEventListener("click", (e) => {
    const b = e.target.closest(".suggest button[data-id]");
    if (!b) return;
    const c = _detector.casos.find((x) => x.id === b.dataset.id);
    if (!c) return;
    input.value = c.nombre;
    run(c.nombre);
  });
}

/**
 * Puntúa las fichas del detector. Importante: NUNCA devolvemos un veredicto
 * "adivinado" por una coincidencia de letras sueltas — un falso 🔴 asusta a una
 * familia sin motivo. Exigimos 3 caracteres y coincidencia real de palabra.
 */
function buscarFichas(text) {
  const q = normalize(text || "").trim();
  if (q.length < 3) return [];
  const tokens = tokenizar(q);
  const salida = [];
  for (const c of _detector.casos) {
    const nombre = normalize(c.nombre);
    const objetivos = [nombre, ...(c.alias || []).map(normalize)];
    let p = 0;
    // La coincidencia debe empezar en un límite de palabra: así "terapia" no
    // coincide dentro de "ozonoterapia", y solo es fuerte si la consulta cubre
    // buena parte del nombre (para que "terapia" tampoco resuelva por sí sola
    // a "terapia con células madre").
    const patron = new RegExp("(^|[^a-z0-9ñ])" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    for (const o of objetivos) {
      if (!o) continue;
      if (o === q) { p = 100; break; }
      if (patron.test(o)) p = Math.max(p, q.length >= o.length * 0.5 ? 55 : 35);
    }
    if (p === 0) {
      const heno = objetivos.join(" ");
      const aciertos = tokens.filter((t) => t.length >= 4 && heno.includes(t)).length;
      if (aciertos) p = 15 * aciertos;
    }
    if (p > 0) salida.push({ caso: c, puntos: p });
  }
  return salida.sort((a, b) => b.puntos - a.puntos);
}

function fichaHTML(hit) {
  const v = hit.veredicto;
  const head = v === "ok"
    ? `🟢 <span style="color:#1c6c47">Tiene evidencia</span>`
    : v === "media"
      ? `🟡 <span style="color:#8a5d10">Cautela / incertidumbre</span>`
      : `🔴 <span style="color:#9b2f22">Evítalo</span>`;
  return `
    <article class="card ${v === "evitar" ? "evitar" : ""}">
      <div class="verdict">${head}</div>
      <h4 style="margin-top:8px"><span>${esc(hit.nombre)}</span></h4>
      <p><strong>${esc(hit.resumen)}</strong></p>
      <p>${esc(hit.porque)}</p>
      ${sourcesHTML(hit.fuentes)}
    </article>`;
}

function detectorResult(text) {
  const bruto = String(text || "").trim();
  if (!bruto) return "";
  if (normalize(bruto).length < 3) {
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
    return `<div class="card"><h4><span aria-hidden="true">🔎</span> No tengo una ficha de «${esc(bruto)}»</h4>
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
    return `<div class="card"><h4>¿A cuál te refieres?</h4>
      <p>«${esc(bruto)}» ${varias ? "coincide con varias fichas" : "coincide en parte con esta ficha"}.
      Elige para ver el veredicto con sus fuentes:</p>
      <div class="suggest">${res.slice(0, 6).map(
        (o) => `<button type="button" data-id="${esc(o.caso.id)}">${esc(o.caso.nombre)}</button>`
      ).join("")}</div></div>`;
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
function openDB() {
  return new Promise((resolve, reject) => {
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
    tx.onsuccess = () => resolve(tx.result.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)));
    tx.onerror = () => reject(tx.error);
  });
}
async function dbAdd(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).add(entry);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const MOODS = ["😟", "😐", "🙂", "😀", "🤩"];
async function renderRastreador() {
  loading();
  let entries = [];
  try { entries = await dbAll(); } catch (_) {}
  const today = new Date().toISOString().slice(0, 10);
  view.innerHTML = `
    <h1 class="page">Seguimiento de mi hijo</h1>
    <h2 class="page-sub">Registra qué intervención hiciste y cómo estuvo el día. <strong>Todo se guarda solo en este dispositivo.</strong></h2>

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
    await dbAdd(entry);
    renderRastreador();
  });
  const wipe = document.getElementById("wipe");
  if (wipe) wipe.onclick = async () => {
    if (!confirm("¿Borrar TODOS los registros de este dispositivo? No se puede deshacer.")) return;
    for (const en of entries) await dbDelete(en.id);
    renderRastreador();
  };
  paintChart(entries);
  paintList(entries);
}

function paintChart(entries) {
  const el = document.getElementById("chart");
  if (!entries.length) { el.innerHTML = `<div class="empty">Aún no hay registros. Agrega el primero arriba.</div>`; return; }
  const last = entries.slice(0, 14).reverse();
  el.innerHTML = `<div class="bars">${last.map((e) => {
    const h = (e.animo / 5) * 100;
    return `<div class="bar" style="height:${h}%" title="${esc(e.fecha)}: ${MOODS[e.animo - 1]}"><span>${esc(e.fecha.slice(5))}</span></div>`;
  }).join("")}</div><div class="spacer"></div>`;
}

function paintList(entries) {
  const el = document.getElementById("list");
  if (!entries.length) { el.innerHTML = `<div class="empty">Sin registros todavía.</div>`; return; }
  el.innerHTML = entries.map((e) => `
    <article class="card">
      <div class="tracker-entry">
        <div>
          <strong>${esc(e.fecha)}</strong> <span class="mood">${MOODS[e.animo - 1] || ""}</span>
          ${e.interv ? `<div>${esc(e.interv)}</div>` : ""}
          ${e.nota ? `<small>${esc(e.nota)}</small>` : ""}
        </div>
        <button class="btn ghost" data-del="${e.id}" aria-label="Borrar">✕</button>
      </div>
    </article>`).join("");
  el.querySelectorAll("[data-del]").forEach((b) =>
    b.onclick = async () => { await dbDelete(Number(b.dataset.del)); renderRastreador(); });
}

/* ---------- Asistente (modo demo; listo para conectar Claude) ---------- */
let _demo = null;
async function renderAsistente() {
  loading();
  _demo = _demo || await getJSON("content/asistente-demo.json");
  view.innerHTML = `
    <h1 class="page">Asistente</h1>
    <div class="demo-note">⚙️ <strong>Modo demostración.</strong> Responde a temas frecuentes con fuentes.
      Cuando se conecte la IA (Claude), podrá responder a cualquier pregunta, citando fuentes y sin recomendar nada peligroso. Ver el README.</div>
    <div class="chat-wrap">
      <div class="chat-log" id="log"></div>
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

/* Coincidencia simple por disparadores. Sustituible por fetch('/api/chat') al activar Claude. */
function demoReply(text) {
  const q = normalize(text);
  for (const r of _demo.respuestas) {
    if ((r.disparadores || []).some((d) => q.includes(normalize(d))))
      return { texto: r.texto, fuentes: r.fuentes || [] };
  }
  return { texto: _demo.fallback, fuentes: [] };
}

/* ---------- Fuentes ---------- */
async function renderFuentes() {
  loading();
  const data = await getJSON("content/fuentes.json");
  const grupos = data.grupos.map((g) => `
    <section>
      <h3 class="sec">${esc(g.titulo)}</h3>
      <div class="card"><div class="sources">${g.fuentes.map(
        (f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.label)}</a>`
      ).join("")}</div></div>
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
