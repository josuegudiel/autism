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

/* Pinta los iconos de la barra de pestañas (declarados con data-ico en el HTML). */
function pintarTabbar() {
  document.querySelectorAll(".tabbar a[data-ico]").forEach((a) => {
    if (a.querySelector("svg")) return;
    a.insertAdjacentHTML("afterbegin", ICONOS[a.dataset.ico] || "");
  });
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
  "⚪": { clase: "vivida", texto: "Experiencia vivida" },
};
const badge = (clase, texto) => `<span class="badge ${clase}">${esc(texto)}</span>`;

/* Emojis de estado que la biblioteca usa en su texto y que no deben verse en la app. */
const EMOJI_ESTADO = /[\u2705\u26A0\uFE0F\u25FD\u2714\u2B50\u274C\u23F3\u2B1C]/g;

/** Separa el marcador de nivel y limpia los emojis de estado del texto. */
function extraerNivel(texto) {
  let t = texto, nivel = null;
  for (const marca of Object.keys(NIVELES)) {
    if (t.includes(marca)) { nivel = NIVELES[marca]; t = t.split(marca).join(""); }
  }
  t = t.replace(EMOJI_ESTADO, "").replace(/\s{2,}/g, " ");
  return { texto: t.replace(/\s+([.,;:])/g, "$1").trim(), nivel };
}

/* ---------- Mini-render de markdown (negritas, enlaces, listas, citas) ---------- */
function mdInline(t) {
  return esc(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

/** Cada viñeta se convierte en una tarjeta con su badge de evidencia. */
function mdRender(md) {
  const out = [];
  for (const linea of String(md || "").split("\n")) {
    const l = linea.trim();
    if (!l) continue;
    if (l.startsWith("- ")) {
      const { texto, nivel } = extraerNivel(l.slice(2));
      out.push(`<div class="punto"><p>${mdInline(texto)}</p>${
        nivel ? badge(nivel.clase, nivel.texto) : ""}</div>`);
    } else if (l.startsWith(">")) {
      const { texto } = extraerNivel(l.replace(/^>\s*/, ""));
      out.push(`<blockquote>${mdInline(texto)}</blockquote>`);
    } else {
      const { texto, nivel } = extraerNivel(l);
      out.push(`<p>${mdInline(texto)}${nivel ? " " + badge(nivel.clase, nivel.texto) : ""}</p>`);
    }
  }
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
  setActiveTab(tab === "fuentes" ? "inicio" : tab);
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
  const idx = await cargarIndice();
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
  `;
  const ir = (q) => { if (q.trim()) location.hash = "#biblioteca/" + encodeURIComponent(q.trim()); };
  document.getElementById("f-inicio").addEventListener("submit", (e) => {
    e.preventDefault(); ir(document.getElementById("q-inicio").value);
  });
  view.querySelectorAll(".chips button").forEach((b) => b.onclick = () => ir(b.dataset.q));
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
  loading();
  const idx = await cargarIndice();
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

  const pintar = (q) => {
    if (!q.trim()) {
      const lista = cat ? idx.temas.filter((t) => t.categoria === cat.clave) : idx.temas;
      caja.innerHTML = chipsCat +
        `<h3 class="sec">${cat ? "Temas" : "Todos los temas"} · ${lista.length}</h3>` +
        lista.map(tarjetaTema).join("");
      return;
    }
    const res = buscarTemas(q, idx);
    if (!res.length) {
      caja.innerHTML = `<h3 class="sec">Sin resultados</h3><div class="card">
        <h4>No encontré nada para «${esc(q)}»</h4>
        <p>Prueba con otras palabras —por ejemplo «duerme» en vez de «insomnio»—
        o explora por categorías.</p></div>` + chipsCat;
      return;
    }
    caja.innerHTML = `<h3 class="sec" style="margin-top:8px">${res.length} resultado${
      res.length > 1 ? "s" : ""} para «${esc(q)}»</h3>` +
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

  const verificado = /VERIFICADO/.test(tema.estado || "");
  view.innerHTML = `
    <p class="migas"><a href="#biblioteca/${esc(meta.categoria || "")}">${
      esc(tema.categoriaNombre || "Biblioteca")}</a></p>
    <h1 class="page">${esc(tema.titulo)}</h1>
    <p class="estado">${verificado
      ? badge("verificado", "Fuentes comprobadas")
      : badge("vivida", "Síntesis con fuentes")}</p>
    <article class="tema-cuerpo">${mdRender(tema.cuerpo)}</article>
    ${tema.fuentes && tema.fuentes.length ? `
      <h3 class="sec">Fuentes · ${tema.fuentes.length}</h3>
      <div class="lista fuentes">${tema.fuentes.map((f) => `
        <a class="fila" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">
          <span class="txt"><span class="titulo">${esc(f.label)}</span></span>
          <span class="ext">${ICONOS.externo}</span></a>`).join("")}</div>` : ""}
    ${relacionados.length ? `
      <h3 class="sec">También te puede servir</h3>
      ${relacionados.map(tarjetaTema).join("")}` : ""}
    <div class="nota">Esta información orienta; <strong>no diagnostica ni sustituye</strong>
      a un profesional. ¿Hay riesgo ahora? <a href="#ayuda">Teléfonos de ayuda</a>.</div>
  `;
}

/* ---------- Ayuda urgente ---------- */
async function renderAyuda() {
  loading();
  const d = await getJSON("content/ayuda-urgente.json");
  // El número principal se convierte en enlace de llamada cuando es marcable.
  const tel = (linea) => {
    const m = String(linea).match(/[\d*][\d\s*]{2,}/);
    return m ? m[0].replace(/\s/g, "") : null;
  };
  view.innerHTML = `
    <h1 class="page">${esc(d.titulo)}</h1>
    <div class="aviso">${esc(d.intro)}</div>
    ${d.paises.map((p) => {
      const num = tel(p.linea);
      return `<article class="pais">
        <div class="nombre">${esc(p.pais)}</div>
        ${num
          ? `<a class="tel" href="tel:${esc(num)}">${ICONOS.telefono}<span>${esc(p.linea)}</span></a>`
          : `<div class="tel">${ICONOS.telefono}<span>${esc(p.linea)}</span></div>`}
        <p class="desc">${esc(p.descripcion)}</p>
        ${p.emergencias ? `<p class="emg">Emergencias: <strong>${esc(p.emergencias)}</strong></p>` : ""}
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
  loading();
  const data = await getJSON("content/evidencia.json");
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
async function renderDetector() {
  loading();
  _detector = _detector || await getJSON("content/banderas-rojas.json");
  try { await cargarIndice(); } catch (_) {}   // para poder sugerir temas relacionados
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
          placeholder="p. ej. quelación, test de cabello" /></div>
      <button class="btn" id="go" type="submit">Revisar</button>
    </form>
    <div class="chips">${chips}</div>
    <div id="result"></div>
  `;
  const input = document.getElementById("q");
  const result = document.getElementById("result");
  const run = (text) => { result.innerHTML = detectorResult(text); result.scrollIntoView({ block: "nearest" }); };
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
  view.addEventListener("click", (e) => {
    const f = e.target.closest("[data-ficha]");
    if (!f) return;
    e.preventDefault();
    const c = _detector.casos.find((x) => x.id === f.dataset.ficha);
    if (c) { input.value = c.nombre; run(c.nombre); }
  });
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
  const clase = v === "ok" ? "alta" : v === "media" ? "media" : "evitar";
  const titulo = v === "ok" ? "Tiene evidencia"
    : v === "media" ? "Cautela: evidencia incierta" : "Evítalo";
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
    <div class="demo-note"><strong>Modo demostración.</strong> Responde a temas frecuentes con fuentes.
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
