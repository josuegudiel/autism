// Pruebas de la app en un navegador real, a tamaño de iPhone.
//
// Uso:
//   cd agente-autismo && python3 -m http.server 8098 --bind 127.0.0.1 &
//   node scripts/pruebas/prueba-app.mjs
//
// Comprueba que la biblioteca se busca con lenguaje de padre, que los temas
// abren con sus fuentes, que el Detector no inventa veredictos y que las
// líneas de ayuda urgente siguen ahí. Sale con código 1 si algo falla.

// Playwright suele estar instalado de forma global, y los módulos ESM no leen
// NODE_PATH. Lo resolvemos a mano para no depender de un node_modules local.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const global = execSync('npm root -g', { encoding: 'utf8' }).trim();
  ({ chromium } = require(global + '/playwright'));
}

const B = process.env.BASE || 'http://localhost:8098/web/index.html';
// En este entorno el Chromium vive fuera de donde Playwright lo busca, así que
// hay que señalárselo. En un runner de CI, en cambio, Playwright ya sabe dónde
// está el suyo: si la ruta no existe, es mejor dejar que la resuelva él que
// fallar al arrancar con una ruta que sólo vale en una máquina.
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const errores = [];
const nav = await chromium.launch(existsSync(CHROME) ? { executablePath: CHROME } : {});
const pag = await nav.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
// Se guarda la referencia del anotador para poder desengancharlo un momento:
// hay comprobaciones que piden a propósito un fichero que no existe, y ese 404
// no es un fallo de la app.
const anotaConsola = (m) => { if (m.type() === 'error') errores.push('CONSOLA: ' + m.text()); };
pag.on('console', anotaConsola);
pag.on('pageerror', (e) => errores.push('JS: ' + e.message));

const ir = async (hash) => {
  await pag.goto(B + hash, { waitUntil: 'load' });
  await pag.waitForTimeout(700);
};
const texto = async () => (await pag.textContent('#view')) || '';

const check = (nombre, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${nombre}${cond ? '' : '  << ' + extra}`);
  if (!cond) errores.push('FALLO: ' + nombre + ' ' + extra);
};

// 1. Inicio
await ir('#inicio');
let t = await texto();
check('Inicio muestra el buscador y el nº de temas', /\b\d{3} temas\b/.test(t), t.slice(0, 120));
check('Inicio enlaza a ayuda urgente', /[Aa]yuda urgente/.test(t));

// 2. Búsqueda en lenguaje natural
const buscar = async (q) => {
  await ir('#biblioteca');
  await pag.fill('#q-bib', q);
  await pag.click('#f-bib button[type=submit]');
  await pag.waitForTimeout(500);
  return await pag.textContent('#res-bib');
};

const casos = [
  // Frase hecha solo de palabras vacías: sin el rescate por sinónimo, el
  // buscador se quedaba sin tokens y no devolvía nada. Es lo que escribe
  // un padre de verdad.
  ['es por el autismo', /causa médica/i, 'encuentra la ficha del sesgo médico'],
  ['no come nada', /ARFID|selectividad|come/i, 'encuentra alimentación'],
  ['mi hijo no duerme', /Sueño/i, 'encuentra Sueño'],
  ['no habla', /Comunicaci|CAA|logopedia/i, 'encuentra Comunicación/CAA'],
  ['se pega', /Conductas|Agresi|Salud mental|autolesi/i, 'encuentra conductas/autolesión'],
  ['en la escuela', /[Ee]scuela|aula/, 'encuentra escuela'],
  ['las vacunas causan autismo', /[Vv]acunas/, 'encuentra el tema de vacunas'],
  ['en mexico', /México/, 'encuentra México'],
  ['se atraganta', /atragant/i, 'encuentra atragantamiento'],
  ['no oye bien', /audici|oye|otitis/i, 'encuentra audición'],
];
for (const [q, re, desc] of casos) {
  const r = await buscar(q);
  // La app repite la consulta en el mensaje de "sin resultados", así que hay
  // que exigir además que haya resultados: si no, una prueba puede pasar
  // reconociendo su propia pregunta.
  const hay = !/Sin resultados|No encontré nada/i.test(r);
  check(`"${q}" → ${desc}`, hay && re.test(r), r.slice(0, 160));
}

let r = await buscar('asdfghjkl');
check('consulta sin sentido → dice que no hay resultados', /Sin resultados/i.test(r), r.slice(0, 160));

// 2bis. El buscador solo miraba título, mensaje y claves, así que un nombre que
// vive dentro del texto no lo encontraba nadie: a una familia a la que le
// ofrecen ozonoterapia, escribir «ozono» le devolvía cero resultados.
const buscarHondo = async (q) => {
  await ir('#biblioteca');
  await pag.fill('#q-bib', q);
  await pag.click('#f-bib button[type=submit]');
  // Las palabras del cuerpo se bajan al buscar, no al entrar: hay que darle
  // tiempo a esa petición y al repintado que viene detrás.
  await pag.waitForTimeout(1800);
  return await pag.textContent('#res-bib');
};
for (const q of ['ozono', 'secretina', 'mercurio']) {
  const rr = await buscarHondo(q);
  check(`«${q}» encuentra su tema, que solo aparece dentro del cuerpo`,
    !/Sin resultados/i.test(rr), rr.slice(0, 160));
}

// Las palabras del cuerpo se consultan por la palabra que escribe la familia, y
// «constructor» es una palabra española corriente que todo objeto de JavaScript
// trae ya puesta. Tiene que decir que no hay nada, no tirar la biblioteca.
const rc = await buscarHondo('constructor');
check('«constructor» no rompe la biblioteca', /Sin resultados/i.test(rc), rc.slice(0, 160));

// El cuerpo sirve para APARECER, nunca para adelantar: un tema que menciona una
// palabra de pasada no puede ponerse por delante del que se llama así.
await buscarHondo('sueño');
const primeros = await pag.$$eval('#res-bib .tema-card h4', (el) => el.slice(0, 3).map((x) => x.textContent));
check('Un acierto en el título sigue mandando sobre una mención en el cuerpo',
  /Sueño/i.test(primeros[0] || ''), JSON.stringify(primeros));

// 3. Abrir un tema
await ir('#tema/W');
t = await texto();
check('Tema W (Sueño) se abre con contenido', t.includes('Sueño') && t.length > 600, 'len=' + t.length);
check('Tema W muestra sus fuentes', /Fuentes · \d+/.test(t));
const enlaces = await pag.$$eval('.tema-cuerpo a', (a) => a.length);
check('Tema W tiene enlaces clicables en el cuerpo', enlaces > 0, 'enlaces=' + enlaces);

await ir('#tema/BC');
t = await texto();
check('Tema BC (vacunas) se abre', /[Vv]acunas/.test(t) && t.length > 600);

// 4. Detector: no debe inventar veredictos
const detectar = async (q) => {
  await ir('#detector');
  await pag.fill('#q', q);
  await pag.click('#go');
  await pag.waitForTimeout(400);
  return await pag.textContent('#result');
};

let d = await detectar('a');
check('Detector: "a" NO da veredicto rojo', !/Evítalo/.test(d), d.slice(0, 140));
d = await detectar('e');
check('Detector: "e" NO da veredicto rojo', !/Evítalo/.test(d), d.slice(0, 140));
d = await detectar('terapia');
check('Detector: "terapia" NO da un rojo directo', !/Evítalo/.test(d), d.slice(0, 140));
check('Detector: "terapia" pregunta a cuál se refiere', /A cuál te refieres|cuál/i.test(d), d.slice(0, 140));
d = await detectar('quelacion');
check('Detector: "quelación" SÍ da su veredicto', /Quelaci/i.test(d) && /Evítalo/.test(d), d.slice(0, 140));
d = await detectar('vitamina c');
check('Detector: algo sin ficha no inventa veredicto',
  !/Evítalo/.test(d) && /No tengo una ficha/.test(d), d.slice(0, 140));

// 4bis. Nadie escribe fichas: escribe frases. El detector tiene que reconocer
// el nombre del producto dentro de la frase, con signos y con alias cortos.
for (const frase of ['quieren darle MMS a mi hijo', 'gotas de mms',
                     '¿mms?', 'me ofrecen enemas de cds', 'protocolo de dióxido de cloro']) {
  d = await detectar(frase);
  check(`Detector: «${frase}» reconoce el MMS`,
    /Evítalo/.test(d) && /lej[ií]a|MMS/i.test(d), d.slice(0, 140));
}
d = await detectar('sistema');
check('Detector: "sistema" NO dispara "stem" (células madre)',
  !/Evítalo/.test(d) && !/c[ée]lulas madre/i.test(d), d.slice(0, 140));
d = await detectar('terapia');
check('Detector: en una coincidencia ambigua sí avisa de lo que hay que evitar',
  /conviene evitar/i.test(d), d.slice(0, 200));

// 4ter. Asistente en modo demostración: el orden de las respuestas es la
// política de seguridad. Lo peligroso y la crisis van antes que lo general.
const preguntar = async (q) => {
  await ir('#asistente');
  await pag.fill('#chati', q);
  await pag.press('#chati', 'Enter');
  await pag.waitForTimeout(600);
  return await pag.textContent('#log');
};
let a = await preguntar('¿funciona la quelación?');
check('Asistente: "¿funciona la quelación?" advierte, no lista terapias',
  /NO funcionan|peligros/i.test(a) && !/intervención temprana/i.test(a), a.slice(-200));
a = await preguntar('no puedo más, estoy desbordada');
check('Asistente: la angustia del cuidador saca los teléfonos de ayuda',
  /024/.test(a) && /Ayuda urgente/i.test(a), a.slice(-200));
a = await preguntar('¿qué terapias funcionan?');
check('Asistente: la pregunta general sigue respondiendo lo que funciona',
  /intervención temprana/i.test(a), a.slice(-200));

// 5. Ayuda urgente
await ir('#ayuda');
t = await texto();
check('Ayuda muestra España 024', t.includes('024') && t.includes('España'));
check('Ayuda muestra México 800 911 2000', t.includes('800 911 2000'));
check('Ayuda muestra señales de alarma', /Señales de alarma/.test(t));

// 6. El resto de secciones sigue viva
await ir('#evidencia');
t = await texto();
check('Centro de evidencia sigue funcionando', t.includes('Centro de evidencia') && t.length > 500);
await ir('#rastreador');
t = await texto();
check('Rastreador sigue funcionando', t.includes('Seguimiento de mi hijo'));
await ir('#fuentes');
t = await texto();
check('Fuentes sigue funcionando', t.length > 300);

// 6bis. Evidencia y Asistente estaban declarados en TABS y los pintaba el
// router, pero sin ninguna puerta desde Inicio: en la práctica no existían, y
// con ellos las cinco tarjetas de «Tratamientos a EVITAR». Se lee TABS de la
// propia app para que esto valga también para la sección que venga mañana.
await ir('#inicio');
const tabs = await pag.evaluate(() => TABS);
const rutas = await pag.$$eval('#view a[href^="#"]', (el) => el.map((x) => x.getAttribute('href')));
const huerfanas = tabs.filter((s) => s !== 'inicio' &&
  !rutas.some((h) => h === '#' + s || h.startsWith('#' + s + '/')));
check('Desde Inicio se llega a todas las secciones de TABS', huerfanas.length === 0,
  'sin puerta desde Inicio: ' + huerfanas.join(', '));

// Las secciones que cuelgan de Inicio dejan Inicio encendido: una barra entera
// apagada le dice al padre que se ha salido de la app.
for (const h of ['#evidencia', '#asistente', '#fuentes']) {
  await ir(h);
  const activas = await pag.$$eval('.tabbar a.active', (el) => el.map((x) => x.dataset.tab));
  check(`En ${h} la barra de abajo marca Inicio`,
    activas.length === 1 && activas[0] === 'inicio', 'activas=' + JSON.stringify(activas));
}

// 7. Service worker: lo publicado tiene que llegar a quien ya abrió la app.
// Va al final a propósito: en cuanto el service worker toma el control, sirve
// desde su caché, y eso enturbiaría cualquier comprobación posterior.
const fs = require('node:fs');
const swSrc = await (await fetch(new URL('sw.js', B))).text();
check('sw.js declara la versión en la línea exacta que sustituye el despliegue',
  /^const VERSION = "[^"]+";$/m.test(swSrc), swSrc.slice(0, 200));
check('el nombre de la caché sale de esa versión, no de un número a mano',
  /^const CACHE = "brujula-tea-" \+ VERSION;$/m.test(swSrc) && !/brujula-tea-v\d/.test(swSrc),
  swSrc.slice(0, 400));

const rutaWf = new URL('../../../.github/workflows/publicar.yml', import.meta.url);
const wf = fs.existsSync(rutaWf) ? fs.readFileSync(rutaWf, 'utf8') : '';
check('el despliegue estampa el SHA en la copia publicada de sw.js',
  /sed -i .*VERSION.*GITHUB_SHA.*sitio\/sw\.js/.test(wf), 'publicar.yml');
check('el despliegue falla si no encuentra esa línea, en vez de publicar sin versionar',
  /grep -q .*GITHUB_SHA.*sitio\/sw\.js/.test(wf) && /exit 1/.test(wf), 'publicar.yml');
check('el despliegue no publica sin haber pasado antes la suite',
  /needs:\s*pruebas/.test(wf) && /prueba-app\.mjs/.test(wf), 'publicar.yml');

// El SW lo registra la propia app, pero hasta que no controla la página estas
// comprobaciones no medirían nada.
await ir('#inicio');
const controla = await pag.evaluate(async () => {
  await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise((ok) => {
      navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true });
      setTimeout(ok, 3000);
    });
  }
  return !!navigator.serviceWorker.controller;
});
check('el service worker controla la página', controla);

// Un 404 del hosting en mitad de un despliegue no puede quedarse guardado. El
// 404 de aquí es a propósito, así que se desengancha un momento el anotador de
// la consola para que no cuente como error de la app.
pag.off('console', anotaConsola);
const basura = await pag.evaluate(async () => {
  const url = new URL('content/no-existe-en-el-repo.json', location.href).href;
  const res = await fetch(url);
  await new Promise((ok) => setTimeout(ok, 600));
  return { estado: res.status, guardado: !!(await caches.match(url)) };
});
pag.on('console', anotaConsola);
check('el service worker no guarda en caché un 404 del hosting',
  basura.estado === 404 && basura.guardado === false, JSON.stringify(basura));

// Copia vieja fabricada a mano: es lo que tiene una familia que abrió la app
// antes de que se corrigiera el contenido. Tiene que reemplazarse sola.
const swr = await pag.evaluate(async () => {
  const url = new URL('content/fuentes.json', location.href).href;
  const nombre = (await caches.keys()).find((k) => k.startsWith('brujula-tea-'));
  if (!nombre) return { primera: '', segunda: '', error: 'no hay caché de la app' };
  await (await caches.open(nombre)).put(url, new Response('{"intro":"COPIA VIEJA"}'));
  const primera = (await (await fetch(url)).text()).slice(0, 40);
  await new Promise((ok) => setTimeout(ok, 1000));
  const segunda = (await (await fetch(url)).text()).slice(0, 40);
  return { nombre, primera, segunda };
});
check('el service worker revalida por detrás: la copia vieja se reemplaza sola',
  swr.primera.includes('COPIA VIEJA') && !swr.segunda.includes('COPIA VIEJA'), JSON.stringify(swr));

// Y con todo eso, sin conexión la app tiene que seguir abriendo.
await pag.context().setOffline(true);
await pag.reload({ waitUntil: 'load' });
await pag.waitForTimeout(900);
t = await texto();
check('sin conexión la app sigue abriendo desde la caché', /\b\d{3} temas\b/.test(t), t.slice(0, 100));
await pag.context().setOffline(false);

// 8. Un fallo de almacenamiento tiene que VERSE. La familia no puede creer que
// ha guardado el día de su hijo y no haberlo guardado. Se comprueba en una
// pestaña aparte, con IndexedDB anulado: borrar la base de verdad colgaría la
// suite, porque openDB abre una conexión en cada llamada y no cierra ninguna.
const pagSinDB = await nav.newPage({ viewport: { width: 393, height: 852 } });
await pagSinDB.addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
});
await pagSinDB.goto(B + '#rastreador', { waitUntil: 'load' });
await pagSinDB.waitForTimeout(900);
let sinDB = (await pagSinDB.textContent('#view')) || '';
check('Sin almacenamiento, el rastreador avisa en vez de fingir una lista vacía',
  /No hemos podido leer tus registros/.test(sinDB), sinDB.slice(0, 220));
check('Y explica la salida en lenguaje llano, no con el nombre del error',
  /ventana privada|incógnito/i.test(sinDB) && !/SecurityError/.test(sinDB), sinDB.slice(0, 220));
check('Y no miente con «Sin registros todavía»', !/Sin registros todav/.test(sinDB), sinDB.slice(0, 220));

await pagSinDB.fill('#interv', 'terapia de lenguaje');
await pagSinDB.click('#f-track button[type="submit"]');
await pagSinDB.waitForTimeout(700);
sinDB = (await pagSinDB.textContent('#view')) || '';
check('Un registro que no se pudo guardar se dice, no se da por bueno',
  /no se ha guardado/i.test(sinDB), sinDB.slice(0, 220));
check('Y lo escrito sigue en el formulario para poder reintentarlo',
  (await pagSinDB.inputValue('#interv')) === 'terapia de lenguaje');
await pagSinDB.close();

// 9. Accesibilidad. Esta app la usa una madre o un padre agotado, de noche, en
// un móvil y a veces con una mano: que el texto se lea no es cumplimiento
// formal, es la diferencia entre servir y no servir.
await ir('#inicio');
const regiones = await pag.evaluate(() => ({
  mainVivo: document.querySelector('main#view')?.hasAttribute('aria-live'),
  anuncio: !!document.querySelector('#anuncio[aria-live]'),
}));
check('El <main> ya no es región viva: no relee la pantalla entera en cada navegación',
  regiones.mainVivo === false, JSON.stringify(regiones));
check('Hay una región viva pequeña donde anunciar solo lo que cambia', regiones.anuncio);

check('La pestaña activa se marca con aria-current, no solo con color',
  (await pag.$$eval('.tabbar a[aria-current="page"]', (el) => el.length)) === 1);

// Se lee con $eval y no con textContent: si la región no existiera, textContent
// se quedaría 30 segundos esperándola y la suite moriría de timeout en vez de
// decir qué falla. Una prueba que cuelga el arnés no informa de nada.
const anuncio = async () => pag.$eval('#anuncio', (el) => el.textContent).catch(() => '');

// Buscar y revisar no cambian de pantalla: si no se anuncian, quien no ve la
// pantalla no se entera de que ha habido respuesta.
await ir('#biblioteca');
await pag.fill('#q-bib', 'no duerme');
await pag.press('#q-bib', 'Enter');
await pag.waitForTimeout(800);
check('Buscar en la biblioteca anuncia cuántos resultados hay',
  /\d+ resultados? para/.test(await anuncio()), await anuncio());

await ir('#detector');
check('El campo del detector tiene nombre accesible',
  !!(await pag.getAttribute('#q', 'aria-label')));
await pag.fill('#q', 'quelación');
await pag.click('#go');
await pag.waitForTimeout(600);
check('El detector dice en voz alta su veredicto, que es a lo que se venía',
  /Evítalo.*Quelaci/i.test(await anuncio()), await anuncio());

await ir('#asistente');
check('El chat del asistente es región viva: ahí está la respuesta de crisis',
  !!(await pag.$('#log[aria-live]')));

// Contraste medido en el navegador, no deducido de los tokens.
const razon = async () => pag.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const rgba = (s) => s.match(/[\d.]+/g).map(Number);
  const sobre = (fg, bg) => { const a = fg.length > 3 ? fg[3] : 1; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const fondo = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3);
  const mide = (sel, bg) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const base = bg ? rgba(getComputedStyle(el).backgroundColor).slice(0, 3) : fondo;
    return Math.round(ratio(sobre(rgba(getComputedStyle(el).color), base), base) * 100) / 100;
  };
  return { aviso: mide('.disclaimer'), boton: mide('.btn', true) };
});
const claro = await razon();
check('El aviso sanitario se lee en modo claro', claro.aviso >= 4.5, 'razón ' + claro.aviso);
check('El rótulo de los botones se lee en modo claro', claro.boton >= 4.5, 'razón ' + claro.boton);
await pag.emulateMedia({ colorScheme: 'dark' });
await pag.reload({ waitUntil: 'load' });
await pag.waitForTimeout(700);
const oscuro = await razon();
check('El aviso sanitario se lee también de noche', oscuro.aviso >= 4.5, 'razón ' + oscuro.aviso);
check('Y el rótulo de los botones también: era 2,29:1 y no se leía',
  oscuro.boton >= 4.5, 'razón ' + oscuro.boton);
await pag.emulateMedia({ colorScheme: 'light' });

// 10. Exportar. Los registros del niño viven solo en este navegador y el
// navegador puede vaciarlos cuando le falte espacio: meses de seguimiento se
// pierden sin que la familia haya hecho nada mal. Tiene que haber una salida, y
// el dato no puede pasar por ningún servidor para salir.
// Va en una pestaña aparte para no dejar registros en la base que usan las
// otras comprobaciones.
const pagExp = await nav.newPage({ viewport: { width: 393, height: 852 } });
await pagExp.goto(B + '#rastreador', { waitUntil: 'load' });
await pagExp.waitForTimeout(800);
check('Sin registros no hay nada que exportar, y el botón no está', !(await pagExp.$('#export')));
await pagExp.fill('#interv', 'logopedia; con "comillas"');
await pagExp.fill('#nota', 'buen día\nsegunda línea');
await pagExp.click('#f-track button[type="submit"]');
await pagExp.waitForTimeout(900);
check('Con registros guardados aparece el botón de exportar', !!(await pagExp.$('#export')));
const [descarga] = await Promise.all([
  pagExp.waitForEvent('download'),
  pagExp.click('#export'),
]);
const csv = fs.readFileSync(await descarga.path(), 'utf8');
check('El fichero es un CSV que Excel abre sin romper los acentos',
  csv.startsWith('﻿') && /"Fecha";"Ánimo/.test(csv), JSON.stringify(csv.slice(0, 90)));
check('Una nota con comillas, punto y coma y saltos de línea sobrevive entera',
  csv.includes('""comillas""') && /buen día\r?\nsegunda línea/.test(csv), JSON.stringify(csv.slice(-160)));
check('El nombre del fichero no lleva datos del niño',
  /^brujula-tea-registros-\d{4}-\d{2}-\d{2}\.csv$/.test(descarga.suggestedFilename()),
  descarga.suggestedFilename());
await pagExp.close();

// 11. Las cifras escritas a mano en la documentación caducan solas: así fue como
// README-iOS.md acabó prometiendo 308 temas mientras el índice traía 360. Se
// atan aquí al JSON que las genera, para que la próxima vez lo diga una prueba y
// no una auditoría. Se aceptan las tres cifras que el índice sí sostiene —el
// total, los verificados y los que quedan por verificar—; cualquier otra es una
// cifra vieja que alguien copió y nadie volvió a mirar.
const idxJson = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const legitimas = new Set([idxJson.totalTemas, idxJson.verificados, idxJson.totalTemas - idxJson.verificados]);
const viejas = [];
for (const rel of ['../../README.md', '../../ESTADO.md', '../../ios/README-iOS.md', '../../ios/README.md']) {
  const txt = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  for (const m of txt.matchAll(/(\d[\d.]*)\s+temas/g)) {
    const n = Number(m[1].replaceAll('.', ''));
    if (!legitimas.has(n)) viejas.push(`${rel.split('/').pop()}: «${m[0].trim()}»`);
  }
}
check(`La documentación no arrastra cifras de temas que el índice ya no sostiene`,
  viejas.length === 0, viejas.join(' · '));

// 12. Ronda 28. Las tres fichas nuevas tienen que abrirse y encontrarse con las
// palabras que escribiría un padre, no con su código.
for (const [codigo, marca] of [['MW', /domiciliaria|hospitalaria/i], ['MX', /pensi[óo]n/i], ['MZ', /planificaci[óo]n/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 28: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['no puede ir a clase', /domiciliaria|hospitalaria|clase/i],
                       ['si trabaja pierde la pensión', /pensi[óo]n/i],
                       ['qué pasa cuando termine el colegio', /planificar|adulta|colegio/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 28: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
// MY se rechazó por solapamiento con JX, que ya explica el artículo 34.8. No
// puede estar en la app: dos fichas contando lo mismo con números distintos es
// peor que una sola.
const sinMY = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
check('Ronda 28: la ficha MY, rechazada por duplicar a JX, NO está publicada',
  !sinMY.temas.some((t) => t.codigo === 'MY'));

// 13. Ronda 29. Los cuatro temas nuevos, y las dos cosas que esta ronda arregló
// y que una prueba tiene que sostener para que no vuelvan a romperse.
for (const [codigo, marca] of [['NA', /discriminaci[óo]n por asociaci[óo]n/i],
                               ['NB', /asistente personal|ayuda a domicilio/i],
                               ['NC', /incertidumbre|imprevisto/i],
                               ['ND', /herman/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 29: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['me quieren echar del trabajo por cuidar a mi hijo', /despido|discriminaci[óo]n|trabajo/i],
                       ['necesito ayuda en casa', /asistente|domicilio|cuidador/i],
                       ['se cancela un plan y se hunde', /imprevisto|incertidumbre|plan/i],
                       ['va a nacer un hermanito', /herman/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 29: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
// El editor de NB encabezó su ficha como «### NA.»: dos temas con el mismo
// código habrían dejado uno de los dos inalcanzable por URL. Se corrigió a mano,
// pero el fallo es del tipo que no se ve leyendo, así que se vigila para todos.
const ind = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const vistos = new Set(), repes = new Set();
for (const t of ind.temas) { if (vistos.has(t.codigo)) repes.add(t.codigo); vistos.add(t.codigo); }
check('Ningún código de tema está repetido en el índice', repes.size === 0, [...repes].join(' '));
// MY se rechazó en la ronda 28 y se reescribió acotada; se publicó como NA. El
// borrador viejo sigue en research/pendientes/ y no puede colarse en la app.
check('Ronda 29: MY sigue sin publicarse; su reescritura vive como NA',
  !ind.temas.some((t) => t.codigo === 'MY') && ind.temas.some((t) => t.codigo === 'NA'));
// La lente de contradicción paró NA porque chocaba con GL en qué ley rige en
// Ecuador. Se resolvió: la de 2025 derogó la de 2012. Si alguien vuelve a meter
// la ley derogada como marco vigente, esto lo caza.
const cuerpo = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const gl = cuerpo.slice(cuerpo.indexOf('### GL.'), cuerpo.indexOf('### ', cuerpo.indexOf('### GL.') + 6));
check('GL cita la ley ecuatoriana vigente (2025), no la derogada de 2012',
  /Ley Orgánica de las Personas con Discapacidad \(2025\)/.test(gl) && /derog/i.test(gl));


// 14. Ronda 30. Tres publicadas, una rechazada, y una ficha vieja corregida
// porque la lente de contradicción destapó que decía algo que no se sostenía.
for (const [codigo, marca] of [['NE', /residencia|inadmisibilidad|visado|pa[íi]s/i],
                               ['NF', /expediente|historia cl[íi]nica|datos/i],
                               ['NH', /canguro|ni[ñn]era|abuelos|noche fuera/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 30: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['nos mudamos a otro país con mi hijo autista', /residencia|visado|pa[íi]s|mudan/i],
                       ['tengo que dar el informe del diagnóstico al colegio', /informe|expediente|datos|colegio/i],
                       ['dejar al niño a dormir en casa de los abuelos', /abuelos|noche|canguro|ni[ñn]era/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 30: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const ind30 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
// NG repetía el mensaje clave de IS con otra franja horaria. Su borrador vive en
// research/pendientes/NG.md; en la app no puede estar.
check('Ronda 30: NG, rechazada por repetir a IS, NO está publicada',
  !ind30.temas.some((t) => t.codigo === 'NG') && ind30.temas.some((t) => t.codigo === 'IS'));
// NG afirmaba que el ejercicio mejora sobre todo lo social; DH, publicada y
// verificada, que es lo que menos mejora. Ninguna lo tenía bien: el metaanálisis
// de 2025 ordena motor > social > ejecutiva > comunicación, y la comunicación ni
// siquiera alcanza significación. DH quedó corregida; esto vigila que siga así.
const lib30 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const dh = lib30.slice(lib30.indexOf('### DH.'), lib30.indexOf('### ', lib30.indexOf('### DH.') + 6));
check('DH separa habilidades sociales de comunicación y no las da por igual',
  /habilidades sociales/i.test(dh) && /no alcanz/i.test(dh) && !/en menor medida, comunicación\/interacción social/.test(dh));


// 15. Ronda 31. Tres publicadas; NI terminada pero NO publicada, a la espera de
// una decisión editorial sobre el umbral de riesgo suicida.
for (const [codigo, marca] of [['NJ', /acatisia|diston[íi]a|discinesia|risperidona/i],
                               ['NK', /custodia|esta noche|carpeta|quien se quede/i],
                               ['NL', /herman/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 31: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['no para quieto desde que toma la medicación', /acatisia|inquietud|medicaci[óo]n|risperidona/i],
                       ['si me ingresan quién se queda con mi hijo', /noche|custodia|carpeta|quede/i],
                       ['pega a su hermana', /herman/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 31: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const ind31 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
// Mientras NI no esté, el tema lo sostienen las fichas que ya mandan a urgencias.
// Si alguien publica NI sin unificar el umbral, esta prueba es el aviso.
check('Ronda 31: NI no está publicada mientras el umbral de urgencia no se unifique',
  !ind31.temas.some((t) => t.codigo === 'NI'));
// NK se publicó recortada porque su entrada es otra; si no enlaza con NH, la
// familia se queda sin la hoja de traspaso justo la noche que la necesita.
const lib31 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const trozo = (cod) => lib31.slice(lib31.indexOf('### ' + cod + '.'), lib31.indexOf('### ', lib31.indexOf('### ' + cod + '.') + 6));
check('NK y NH se enlazan en los dos sentidos', /NK\./.test(trozo('NH')) && /NH\./.test(trozo('NK')));
// Ninguna ficha publicada puede quedarse con el estado en suspenso que pone el
// editor cuando deja una decisión a un humano: o se resuelve, o no se publica.
check('Ninguna ficha publicada arrastra un estado «pendiente de decisión»',
  !/^### .*⏳/m.test(lib31), (lib31.match(/^### .*⏳.*$/m) || [''])[0].slice(0, 110));


// 16. Ronda 32. Las cuatro publicadas. Y una comprobación que nace de que el
// mismo fallo se ha repetido dos veces: el editor encabeza la ficha con el
// código de otra (NB en la ronda 29, NN en la 32).
for (const [codigo, marca] of [['NM', /rescate|si precisa|calmante/i],
                               ['NN', /levetiracetam|antiepil[ée]ptic/i],
                               ['NP', /espalda|ducharlo|moverlo|lesion/i],
                               ['NQ', /mutismo/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 32: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['me han dado algo para cuando se ponga muy mal', /rescate|calmante|precisa/i],
                       ['está más irritable desde que toma el antiepiléptico', /levetiracetam|antiepil[ée]ptic|irritab/i],
                       ['me duele la espalda de levantarlo', /espalda|lesion|ducharlo|moverlo/i],
                       ['no habla en el colegio pero sí en casa', /mutismo/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 32: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
// Publicar una ficha son dos escrituras: el markdown en la biblioteca y la línea
// en indice-temas.txt. Si una se hace y la otra no, el tema existe a medias y no
// se nota leyendo. Esto compara los dos ficheros código a código.
const libro = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const idxTxt = fs.readFileSync(new URL('../../research/indice-temas.txt', import.meta.url), 'utf8');
const codsLibro = new Set([...libro.matchAll(/^### ([A-Z]{1,2})\. /gm)].map((m) => m[1]));
const codsIdx = new Set(idxTxt.split('\n').map((l) => (l.match(/^([A-Z]{1,2})\. /) || [])[1]).filter(Boolean));
const soloLibro = [...codsLibro].filter((c) => !codsIdx.has(c));
const soloIdx = [...codsIdx].filter((c) => !codsLibro.has(c));
check('La biblioteca y el índice de temas contienen exactamente los mismos códigos',
  soloLibro.length === 0 && soloIdx.length === 0,
  'solo en la biblioteca: ' + (soloLibro.join(' ') || '-') + ' · solo en el índice: ' + (soloIdx.join(' ') || '-'));
// Y que el índice publicado a la app no pierda ninguno por el camino.
const ind32 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const enApp = new Set(ind32.temas.map((t) => t.codigo));
const perdidos = [...codsLibro].filter((c) => !enApp.has(c));
check('Ningún tema de la biblioteca se queda fuera de la app al convertir',
  perdidos.length === 0, perdidos.join(' '));

// 17. Ronda 33. Las cuatro publicadas; NU salió bloqueada por tres cosas que el
// editor no podía tocar desde dentro de su ficha, y que se arreglaron aquí.
for (const [codigo, marca] of [['NR', /colegio|rescate|adrenalina|plan de/i],
                               ['NS', /risperidona|aripiprazol|peso|metformina/i],
                               ['NT', /resonancia/i],
                               ['NU', /certificado|dictamen|informe/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 33: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['en el colegio dicen que no pueden medicar', /colegio|medicar|rescate/i],
                       ['ha engordado mucho con la medicación', /peso|engord|risperidona|metformina/i],
                       ['le quieren hacer una resonancia', /resonancia/i],
                       ['no sé qué papel necesito', /certificado|dictamen|informe|papel/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 33: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const lib33 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bloque = (cod) => lib33.slice(lib33.indexOf('### ' + cod + '.'), lib33.indexOf('### ', lib33.indexOf('### ' + cod + '.') + 6));
// LP mandaba a una familia mexicana o colombiana a buscarse la vida («esta ficha
// no te sirve») cuando la biblioteca sí tiene su ruta, ahora en NU.
check('LP ya no deja sin salida a quien vive en México o Colombia',
  !/Si vives en México, Colombia u otro país, esta ficha \*\*no te sirve\*\*/.test(bloque('LP'))
  && /NU\./.test(bloque('LP')));
// Una ficha sin entradas propias en el buscador no la encuentra nadie: las
// consultas de certificado ya iban todas a LP.
const sin = JSON.parse(fs.readFileSync(new URL('../../scripts/sinonimos.json', import.meta.url), 'utf8'));
const haciaNU = Object.entries(sin).filter(([, v]) => Array.isArray(v) && v.includes('NU'));
check('NU tiene consultas propias en el buscador, no solo las de LP', haciaNU.length >= 5,
  haciaNU.length + ' entradas');


// 18. Ronda 34. Las cuatro publicadas tras resolver cuatro choques con fichas
// que ya estaban en la app. Dos de ellos eran errores de las publicadas.
for (const [codigo, marca] of [['NV', /funcional|epilepsia|tics|desmayo/i],
                               ['NW', /ginec[óo]log|anticoncep/i],
                               ['NX', /atenci[óo]n temprana|colegio/i],
                               ['NY', /pediatra|adultos|seguimiento/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 34: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['me dicen que no es epilepsia', /funcional|epilepsia/i],
                       ['llevarla al ginecólogo', /ginec[óo]log|anticoncep/i],
                       ['se acaba la atención temprana', /temprana|colegio/i],
                       ['ya no le corresponde el pediatra', /pediatra|adultos/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 34: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const lib34 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bl = (cod) => lib34.slice(lib34.indexOf('### ' + cod + '. '), lib34.indexOf('### ', lib34.indexOf('### ' + cod + '. ') + 6));
// S y NW citaban el MISMO trabajo (Ragaglia 2023) con lecturas opuestas, las dos
// en verde. La revisión dice que ninguna intervención logró ambas cosas a la vez:
// mejorar el conocimiento Y cambiar la conducta. S prometía el salto a la conducta.
check('S ya no promete que enseñar educación sexual cambie la conducta',
  !/añadir práctica produce cambios conductuales/.test(bl('S'))
  && /ninguna intervención demostró a la vez/.test(bl('S')));
// MO citaba la 5.ª edición de los criterios de la OMS; la 6.ª (2025) la sustituyó.
check('MO cita la edición vigente de los criterios de la OMS, no la superada',
  /6\.ª edición, de 2025/.test(bl('MO')));
// MZ repetía casi literalmente lo que ahora desarrolla NY.
check('MZ ya no duplica el traspaso a adultos: remite a NY',
  /NY\./.test(bl('MZ')) && !/averigua a qué edad exacta termina\s+la pediatría/.test(bl('MZ')));
// Tres fichas daban tres edades para empezar a planificar la transición sin decir
// de dónde salían. Ahora cada una nombra su fuente.
check('I y MZ explican de dónde sale su edad para planificar la transición',
  /AAP \(estadounidense\)/.test(bl('I')) && /la AAP\s+estadounidense dice ~12/.test(bl('MZ')));


// 19. Ronda 35. Las cuatro publicadas tras resolver tres choques; dos eran
// errores de fichas publicadas y el tercero, dos papeles que nadie distinguía.
for (const [codigo, marca] of [['NZ', /par[áa]lisis cerebral/i],
                               ['PA', /psic[óo]log|decidir|consentimiento/i],
                               ['PB', /prestaci|beca|deducci|ayuda/i],
                               ['PC', /cupo|reserva|oposici|empleo/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 35: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['tiene parálisis cerebral y autismo', /par[áa]lisis cerebral/i],
                       ['se niega a ir al psicólogo', /psic[óo]log|decidir/i],
                       ['qué ayudas económicas puedo pedir', /prestaci|beca|deducci|ayuda/i],
                       ['manda currículos y no le llaman', /cupo|reserva|empleo|curr[íi]cul/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 35: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const lib35 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bq = (cod) => lib35.slice(lib35.indexOf('### ' + cod + '. '), lib35.indexOf('### ', lib35.indexOf('### ' + cod + '. ') + 6));
// FU decía "más de 50", que deja fuera a la empresa de exactamente 50 — justo la
// que suele decir que no. El art. 42.1 del RDL 1/2013 dice "50 o más".
check('FU da el umbral correcto de la cuota de reserva (50 o más, no más de 50)',
  /50 o más\*\* trabajadores/.test(bq('FU')) && !/del 2% en empresas de más de 50 trabajadores/.test(bq('FU')));
// R presentaba en verde que la TCC adaptada supera a la estándar. Es un solo
// ensayo; la diferencia que importa está entre hacer terapia y no hacerla.
check('R ya no vende como zanjada la ventaja de la TCC adaptada sobre la estándar',
  /Es \*\*un solo\s+ensayo\*\*/.test(bq('R')) && /quién lo\s+midió/.test(bq('R')));
// CEDis y certificado médico de discapacidad permanente son dos papeles para dos
// ventanillas: tener uno no da el otro, y confundirlos cuesta un viaje.
check('NU distingue el CEDis del certificado que pide la pensión mexicana',
  /CEDis/.test(bq('NU')) && /Pensión para el Bienestar/.test(bq('NU')));
// Ninguna cabecera publicada puede arrastrar la marca de estado que los editores
// se inventan al dejar algo a un humano: ⏳, ⏸ EN ESPERA, retenida, NO PUBLICABLE.
const cabeceras = [...lib35.matchAll(/^### [A-Z]{1,2}\. .*$/gm)].map((m) => m[0]);
// 'pendiente de decisi' se quedaba corto: PC llevaba tres rondas publicada
// diciendo 'pendiente de resolver una contradicción con FU' que ya se había
// resuelto en la 35. Y no vale con buscar 'pendiente' a secas: lo lleva dentro
// 'vida independiente', que es el título de CM.
const BLOQUEO = /[⏳⏸]|EN ESPERA|retenida|NO PUBLICABLE|no publicar hasta|pendiente de |pendiente:|bloquea la publicaci|bloquead|ve \*Pendiente editorial\*/i;
const sucias = cabeceras.filter((h) => BLOQUEO.test(h));
check('Ninguna ficha publicada arrastra una marca de estado sin resolver',
  sucias.length === 0, sucias.slice(0, 2).join(' | ').slice(0, 150));


// 20. Ronda 36. Cuatro publicadas tras corregir tres fichas vivas.
for (const [codigo, marca] of [['PD', /matr[íi]cula|admisi[óo]n|plaza/i],
                               ['PE', /seguro|asegurador|responsabilidad civil/i],
                               ['PF', /GPS|localizador/i],
                               ['PG', /autob[úu]s|trayecto/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 36: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['nos han dado un colegio que no puede atenderle', /matr[íi]cula|admisi[óo]n|colegio/i],
                       ['me niegan el seguro por su discapacidad', /seguro|asegurador/i],
                       ['le pongo un gps', /GPS|localizador/i],
                       ['que coja el autobús solo', /autob[úu]s|trayecto/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 36: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
const lib36 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bt = (cod) => lib36.slice(lib36.indexOf('### ' + cod + '. '), lib36.indexOf('### ', lib36.indexOf('### ' + cod + '. ') + 6));
// AE metía el GPS dentro de «Prevención de bajo riesgo» en verde. Un localizador
// no impide que salga por la puerta: como mucho acorta la búsqueda, y ni eso
// está medido. El riesgo real es comprarlo y relajar la cerradura.
check('AE no vende el GPS como prevención',
  !/\*\*identificación\*\* \(pulseras\/ID o GPS con consentimiento\)/.test(bt('AE'))
  && /NO son prevención/.test(bt('AE')));
// MR le decía a un padre español «no busques uno» sobre un organismo que sí
// existe cuando quien deniega es un seguro privado.
check('MR ya no manda a no buscar la vía que sí existe para los seguros privados',
  !/Aquí no hay un organismo equivalente a las superintendencias del paso 4, así que no busques uno\./.test(bt('MR'))
  && /DGSFP/.test(bt('MR')) && /CONDUSEF/.test(bt('MR')));
// Ninguna ficha publicada puede arrastrar el bloque que el editor deja para el
// humano: describe trabajo ya hecho y le pide a la familia cosas que no existen.
check('Ninguna ficha publicada conserva un bloque que bloquee su propia publicación',
  !/bloquea la publicación/.test(lib36));


// 21. Ronda 37. Primera ronda en siete sin ningún bloqueo: las cuatro salieron
// publicables a la primera. PH es la prueba de que acotar el tema por escrito
// antes de investigarlo funciona: se le dijo que JX y NA ya cubrían su terreno
// y que solo investigara la jubilación, y salió sin solaparse.
for (const [codigo, marca] of [['PH', /jubilaci[óo]n|cotiza/i],
                               ['PI', /abogad|justicia gratuita|pleito/i],
                               ['PJ', /carga mental|repartir/i],
                               ['PK', /pueblo|distancia|kil[óo]metro|lejos/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 37: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['dejar el trabajo para cuidar', /jubilaci[óo]n|cotiza|trabajo/i],
                       ['necesito un abogado', /abogad|justicia gratuita/i],
                       ['lo hago todo yo', /carga mental|repartir/i],
                       ['vivimos en un pueblo', /pueblo|distancia|lejos/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 37: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}
// PH tenía que quedarse en la jubilación y no reescribir a JX ni a NA. Si alguien
// la amplía a los permisos, vuelve el solapamiento que hundió a MY.
const lib37 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const ph = lib37.slice(lib37.indexOf('### PH. '), lib37.indexOf('### ', lib37.indexOf('### PH. ') + 6));
check('PH se queda en la jubilación y remite a JX y NA para el resto',
  /JX\./.test(ph) && /NA\./.test(ph) && /jubilaci[óo]n/i.test(ph));


// 22. Ronda 38. Tres publicables a la primera y una, PP, que venía bloqueada por
// cosas que solo se pueden cerrar desde fuera de la ficha: el reparto con MC, el
// alta del código y los enlaces inversos. Se cerraron y se publicó.
for (const [codigo, marca] of [['PL', /abuelos|piscina|alquiler/i],
                               ['PM', /farmacorresistente|SUDEP/i],
                               ['PN', /declarar|denuncia|juicio/i],
                               ['PP', /centro de d[íi]a|piso tutelado|respiro/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 38: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['casa de los abuelos', /abuelos|piscina|vivienda/i],
                       ['la piscina no tiene valla', /piscina|valla|ahoga/i],
                       ['sigue teniendo crisis', /farmacorresistente|epilepsia|crisis/i],
                       ['sudep', /SUDEP|muerte s[úu]bita/i],
                       ['tiene que declarar', /declarar|denuncia|juicio/i],
                       ['le tratan mal en el centro', /centro|maltrato|respiro/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 38: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}

const lib38 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b38 = (cod) => lib38.slice(lib38.indexOf('### ' + cod + '. '), lib38.indexOf('### ', lib38.indexOf('### ' + cod + '. ') + 6));

// El editor de PP renombró su ficha a PL, que ya era de otra ficha de esta misma
// ronda. Sexta vez que un editor encabeza su ficha con el código de otra.
check('PP se publicó con su propio código y PL sigue siendo la casa ajena',
  /^### PP\. Sospecho que le tratan mal/m.test(lib38)
  && /^### PL\. Este fin de semana dormimos/m.test(lib38));

// El bloqueo real de PP: MC ya publicaba las mismas urgencias y las mismas
// preguntas. El reparto es que MC se queda con la plaza y PP con la supervisión,
// y eso solo vale si MC lo dice y enlaza.
const mc = b38('MC');
check('MC manda a PP para la supervisión y se queda con la plaza',
  /\*\*PP\. Sospecho que le tratan mal/.test(mc) && /ficha de la supervisi[óo]n/.test(mc));
check('MC ya no se queda sola con las preguntas de supervisión',
  /peor turno/.test(mc) && /registro de contenciones/.test(mc));

// Las dos fichas tenían que decir lo mismo de la pérdida de peso: ninguna tiene
// fuente clínica para el plazo, así que se eligió la versión más protectora y
// tiene que quedar igual en las dos. Si alguien cambia una, esto salta.
check('MC y PP dicen lo mismo de la pérdida de peso rápida',
  /p[ée]rdida de peso r[áa]pida/.test(mc) && /p[ée]rdida de peso r[áa]pida/.test(b38('PP')));

// PL es para la casa que no puedes tocar; LH para la tuya. Si PL deja de decirlo,
// vuelve a ser un duplicado de LH.
check('PL se distingue de LH y no repite la casa propia',
  /LH/.test(b38('PL')) && /no es la vuestra|no es la tuya|ajena/i.test(b38('PL')));
check('LH manda a PL cuando la casa no es la vuestra', /\*\*PL\. Este fin de semana/.test(b38('LH')));

// Una ficha de epilepsia no puede dar dosis ni pautas de retirada.
check('PM no da dosis ni pauta de retirada de ningún antiepiléptico',
  !/\b\d+\s?mg\b/i.test(b38('PM')) && /SUDEP/.test(b38('PM')));

// LL es la gemela escolar y menor de edad: tiene que abrir las dos puertas.
const ll = b38('LL');
check('LL manda a PN cuando ya se ha denunciado y a PP si el sitio es de adultos',
  /\*\*PN\. He denunciado/.test(ll) && /\*\*PP\. Sospecho que le tratan mal/.test(ll));

// PC llevaba desde la ronda 35 publicada anunciando un bloqueo que esa misma
// ronda resolvió: el umbral de la cuota española. La prueba de cabeceras no lo
// cazó porque buscaba «pendiente de decisión» y PC decía «pendiente de resolver».
const pc = b38('PC');
check('PC ya no anuncia como pendiente el umbral que se resolvió en la ronda 35',
  !/pendiente de resolver/i.test(pc) && !/sin cerrar en esta biblioteca/i.test(pc));
check('PC y FU dicen lo mismo del umbral de la cuota: 50 o más',
  /50 o más/.test(pc) && /42\.1/.test(pc) && /50 o más/.test(b38('FU')));

// CJ es la persona autista investigada; PN es la víctima. Se confundían.
check('CJ distingue al investigado de la víctima y manda a PN',
  /\*\*PN\. He denunciado/.test(b38('CJ')));


// 23. Ronda 39. Las cuatro publicables a la primera. PQ es la segunda prueba de
// que acotar el tema por escrito funciona: la entrada de la reserva incluía
// «asegurar la casa de noche», que ya estaba en LH, PL y AE, y se le dijo al
// investigador que no gastara ni una búsqueda ahí.
for (const [codigo, marca] of [['PQ', /dormir|sue[ñn]o|noche/i],
                               ['PR', /gluten|celiaqu[íi]a|leche/i],
                               ['PS', /l[íi]mite|TLP|bipolar/i],
                               ['PT', /aud[íi]fono|CPAP|f[ée]rula|parche/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 39: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['llevo meses sin dormir', /dormir|sue[ñn]o|agotamiento/i],
                       ['me duermo conduciendo', /conduc|sue[ñn]o|volante/i],
                       ['quitarle el gluten', /gluten|celiaqu[íi]a/i],
                       ['le dijeron bipolar', /bipolar|l[íi]mite|TLP|diagn[óo]stico/i],
                       ['se quita el audifono', /aud[íi]fono|pr[óo]tesis|aparato/i],
                       ['cpap', /CPAP|apnea|mascarilla/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 39: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}

const lib39 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b39 = (cod) => lib39.slice(lib39.indexOf('### ' + cod + '. '), lib39.indexOf('### ', lib39.indexOf('### ' + cod + '. ') + 6));

// Séptima vez que un editor encabeza su ficha con el código de otra: PR venía
// como «### PQ.», que es la ficha de al lado de esta misma ronda.
check('PR se publicó con su propio código y PQ sigue siendo el sueño del cuidador',
  /^### PR\. Dieta sin gluten/m.test(lib39) && /^### PQ\. Llevo meses sin dormir/m.test(lib39));

// PQ tenía prohibido reexplicar cómo se asegura la casa: eso es LH, PL y AE.
const pq = b39('PQ');
check('PQ se queda en la salud del adulto y remite a LH, PL y AE para la casa',
  /\*\*LH/.test(pq) && /\*\*PL/.test(pq) && /\*\*AE/.test(pq) && /TCC-I/.test(pq));
// El riesgo concreto del que no duerme no es el cansancio, es el volante.
check('PQ dice qué hacer cuando te duermes al volante', /microsue[ñn]o/.test(pq));
check('W y PJ mandan a PQ, que es el sueño del que cuida',
  /\*\*PQ\. Llevo meses sin dormir/.test(b39('W')) && /\*\*PQ\. Llevo meses sin dormir/.test(b39('PJ')));

// El error irreversible de PR: quitar el gluten antes de la prueba la inutiliza.
const pr = b39('PR');
check('PR avisa de que hay que seguir comiendo gluten para poder diagnosticar la celiaquía',
  /seguir comiendo gluten|sigue comiendo gluten|sin retirar el gluten/i.test(pr) && /celiaqu[íi]a/i.test(pr));
check('PR desmonta los paneles de intolerancias por IgG', /IgG/.test(pr));
check('CR manda a PR antes de retirar ningún alimento', /\*\*PR\. Dieta sin gluten/.test(b39('CR')));

// PS no puede leerse como «toda etiqueta anterior es un error» ni sugerir dejar
// la medicación por cuenta propia.
const ps = b39('PS');
check('PS nombra el TLP y no manda retirar medicación por cuenta propia',
  /TLP/.test(ps) && /por tu cuenta|sin hablarlo|no la retires/i.test(ps));
check('C y CT mandan a PS cuando la etiqueta llegó antes que el autismo',
  /\*\*PS\. Le pusieron trastorno l[íi]mite/.test(b39('C')) && /\*\*PS\. Le pusieron trastorno l[íi]mite/.test(b39('CT')));

// «Audífono» es la prótesis en España y los auriculares en media América Latina:
// la ficha tiene que fijar el término sin declarar una palabra ganadora.
const pt = b39('PT');
check('PT fija el vocabulario de «audífono» sin declarar una palabra ganadora',
  /pr[óo]tesis/.test(pt) && /auriculares/.test(pt) && /CPAP/.test(pt));
check('EN y EO mandan a PT para que el aparato se use de verdad',
  /\*\*PT\. No se deja poner/.test(b39('EN')) && /\*\*PT\. No se deja poner/.test(b39('EO')));


// 24. Ronda 40. PV vino marcada no publicable: el editor pedía elegir entre
// publicarla como ficha propia o disolverla dentro de PB. Se eligió ficha propia
// porque el disparador es otro (buscar fechas en el curso de los 17, no el mapa
// de ayudas) y porque el deslinde ya estaba hecho dentro del texto.
for (const [codigo, marca] of [['PU', /delito|denuncia|cuenta ajena/i],
                               ['PV', /18|calendario|revisi[óo]n/i],
                               ['PW', /guarder[íi]a|tres a[ñn]os/i],
                               ['PX', /mam[áa]|cuidador|se queda/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 40: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['le he encontrado fotos en el movil', /delito|im[áa]genes|abogado/i],
                       ['mi hijo puede ir a la carcel', /delito|polic[íi]a|abogado/i],
                       ['que pasa con la ayuda cuando cumple 18', /18|prestaci[óo]n|calendario/i],
                       ['la guarderia no puede con el', /guarder[íi]a|escuela infantil|apoyo/i],
                       ['solo quiere a mama', /mam[áa]|cuidador|se queda/i],
                       ['no se queda con nadie', /cuidador|se queda|traspaso/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 40: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}

const lib40 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b40 = (cod) => lib40.slice(lib40.indexOf('### ' + cod + '. '), lib40.indexOf('### ', lib40.indexOf('### ' + cod + '. ') + 6));

// PU se escribió para un padre asustado, no para un juez: lo primero es el riesgo
// de suicidio del hijo, y el estereotipo del «autista cibercriminal» se desmonta.
const pu = b40('PU');
check('PU antepone el riesgo del hijo al expediente', /024/.test(pu) && /urgencias hoy/i.test(pu));
check('PU desmonta el estereotipo con el único estudio que lo ha mirado', /Payne/.test(pu));
check('PU no reescribe CJ: la remite para cuando la policía ya está delante', /\*\*CJ/.test(pu));
check('CJ, DV y HY mandan a PU',
  /\*\*PU\. Entró en una cuenta ajena/.test(b40('CJ')) && /\*\*PU\. Entró en una cuenta ajena/.test(b40('DV'))
  && /\*\*PU\. Entró en una cuenta ajena/.test(b40('HY')));

// El deslinde de PV con PB: PV es el calendario, PB los umbrales y las cuantías.
const pv = b40('PV');
check('PV manda a PB los umbrales y las cuantías, y no los repite',
  /\*\*PB/.test(pv) && /no se repiten aquí/.test(pv));
check('PV trae lo que no estaba en ninguna parte: los cuatro relojes y el aviso chileno',
  /Cuatro relojes/.test(pv) && /17 años y 6 meses/.test(pv));
check('PB, LP y NY enlazan de vuelta a PV',
  /\*\*PV\. El calendario/.test(b40('PB')) && /\*\*PV\. El calendario/.test(b40('LP'))
  && /\*\*PV\. El calendario/.test(b40('NY')));

// PW es el limbo del 0-3, donde no hay dictamen que obligue a nadie.
const pw = b40('PW');
check('PW dice qué se puede pedir cuando no hay circuito escolar que obligue',
  /por escrito/.test(pw) && /(tres a[ñn]os|0-3)/.test(pw));
check('X y NX mandan a PW, que es el otro extremo del tramo',
  /\*\*PW\. La guardería dice/.test(b40('X')) && /\*\*PW\. La guardería dice/.test(b40('NX')));

// PX separa la preferencia de siempre del rechazo nuevo hacia una persona: eso
// segundo no se reensaya por escalones, se consulta.
const px = b40('PX');
check('PX distingue la preferencia de siempre del rechazo nuevo a una persona',
  /nuevo, repentino/.test(px) && /no le interrogues/i.test(px));
check('PX no infla la evidencia: la figura preferida no va en verde',
  /ansiedad por separación/.test(px) && (px.match(/🟢/g) || []).length <= 1);
check('NH, EE y PQ mandan a PX cuando el niño no acepta a un segundo adulto',
  /\*\*PX\. Solo quiere a mam[áa]/.test(b40('NH')) && /\*\*PX\. Solo quiere a mam[áa]/.test(b40('EE'))
  && /\*\*PX\. Solo quiere a mam[áa]/.test(b40('PQ')));


// 25. Ronda 41. PZ vino retenida por tres arreglos que estaban fuera de ella: dos
// frases sobre caries en EO y KF que la evidencia no sostiene, y una cita de
// Cermak 2015 que AG enlazaba a un PMID que no es el del ensayo.
for (const [codigo, marca] of [['PY', /colon|mamograf[íi]a|colesterol|cribado/i],
                               ['PZ', /dentista|sedaci[óo]n|anestesia|brackets/i],
                               ['QA', /coordina|gestor de caso|carpeta/i],
                               ['QB', /separa|convenio|pensi[óo]n/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 41: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['revisiones de adulto', /cribado|colon|revisi[óo]n|chequeo/i],
                       ['colonoscopia', /colon|sangre oculta|cribado/i],
                       ['el dentista dice que hay que dormirlo', /dentista|sedaci[óo]n|anestesia/i],
                       ['brackets', /brackets|ortodoncia|dentista/i],
                       ['nadie coordina', /coordina|gestor|carpeta/i],
                       ['convenio regulador', /convenio|separa|pensi[óo]n/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 41: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}

const lib41 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b41 = (cod) => lib41.slice(lib41.indexOf('### ' + cod + '. '), lib41.indexOf('### ', lib41.indexOf('### ' + cod + '. ') + 6));

// Octava vez que un editor encabeza su ficha con el código de otra: QA venía
// como «### PY.», la ficha de al lado de esta misma ronda.
check('QA se publicó con su propio código y PY sigue siendo el chequeo del adulto',
  /^### QA\. Cada uno va por su lado/m.test(lib41) && /^### PY\. El chequeo del adulto/m.test(lib41));

// La corrección que desbloqueó PZ: las revisiones no coinciden en caries, sí en
// necesidad no tratada y acceso. EO lo afirmaba en verde y KF lo daba por hecho.
const eo = b41('EO');
check('EO ya no afirma más riesgo de caries y remite a PZ',
  !/más riesgo de bruxismo, caries/.test(eo) && /las revisiones no coinciden/.test(eo)
  && /\*\*PZ\. El dentista dice/.test(eo));
check('KF apoya el argumento del flúor en lo que sí está documentado',
  /más necesidad dental no tratada/.test(b41('KF')) && !/ya tiene más riesgo de caries/.test(b41('KF')));

// AG enlazaba Cermak 2015 a un PMID que no es el del ensayo, y lo daba en verde
// siendo un piloto de 44 niños.
const ag = b41('AG');
check('AG enlaza el PMID correcto de Cermak 2015 y ya no lo vende como ensayo grande',
  /25931290/.test(ag) && !/25488121/.test(ag) && /piloto/.test(ag));

// «Ninguna muerte» en un registro de centros con programa no es «ningún riesgo».
check('MK pone el recuento de Lee junto al registro de Cravero',
  /Lee y cols\., 2013/.test(b41('MK')) && /\*\*PZ\. El dentista dice/.test(b41('MK')));

// PZ no puede dar dosis de ningún sedante, y tiene que remitir en vez de repetir.
const pz = b41('PZ');
check('PZ no da dosis y se apoya en MK y en PT en vez de reescribirlas',
  !/\b\d+\s?mg\b/i.test(pz) && /\*\*MK/.test(pz) && /\*\*PT/.test(pz));

// PY tenía prohibido reescribir LC y NW, y su regla central es que un síntoma
// no espera al cribado.
const py = b41('PY');
check('PY remite a LC y NW y no repite el cribado de cuello de útero',
  /\bLC\b/.test(py) && /\bNW\b/.test(py) && /cribado es (solo )?para quien no tiene síntomas/.test(py));
check('AL, NY y LC mandan a PY',
  /\*\*PY\. El chequeo del adulto/.test(b41('AL')) && /\*\*PY\. El chequeo del adulto/.test(b41('NY'))
  && /\*\*PY\. El chequeo del adulto/.test(b41('LC')));

// QA es la costura entre tres sistemas, no un plan dentro de uno.
check('QA trae el gestor de caso y la carpeta única, que no estaban en ninguna ficha',
  /gestor de caso/i.test(b41('QA')) && /carpeta/i.test(b41('QA')));
check('ML y MB mandan a QA',
  /\*\*QA\. Cada uno va por su lado/.test(b41('ML')) && /\*\*QA\. Cada uno va por su lado/.test(b41('MB')));

// QB: lo que casi nadie sabe es que la pensión puede no acabarse a los 18.
check('QB dice que la pensión puede no extinguirse a los 18 y enlaza el calendario de PV',
  /(no se extingue|prórroga|no se acaba a los 18)/.test(b41('QB')) && /\*\*PV/.test(b41('QB')));
check('GE y CL mandan a QB para lo legal de la ruptura',
  /\*\*QB\. Nos separamos/.test(b41('GE')) && /\*\*QB\. Nos separamos/.test(b41('CL')));


// 26. Ronda 42. La ronda murió con el límite de sesión y se reanudó desde caché.
// QD vino bloqueada por CL, que era de la ronda 5 y la única de su grupo sin
// revisar tras la Ley 8/2021: ofrecía cuentas conjuntas como medida de apoyo y
// trataba la incapacitación como una opción viva.
for (const [codigo, marca] of [['QC', /diente|traumatismo|avulsi/i],
                               ['QD', /banco|guarda de hecho|poder/i],
                               ['QE', /mis padres|cuidar|abuel/i],
                               ['QF', /tirar|colecci|acumulaci/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 42: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['se ha roto un diente', /diente|dental|dentista/i],
                       ['se le ha salido un diente', /diente|reimplant|leche/i],
                       ['no puedo mover su cuenta del banco', /banco|cuenta|guarda de hecho/i],
                       ['guarda de hecho', /guarda de hecho|apoyo|banco/i],
                       ['cuido tambien a mis padres', /padres|cuidar|abuel/i],
                       ['no deja tirar nada', /tirar|colecci|acumulaci/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 42: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}

const lib42 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b42 = (cod) => lib42.slice(lib42.indexOf('### ' + cod + '. '), lib42.indexOf('### ', lib42.indexOf('### ' + cod + '. ') + 6));

// Novena vez que un editor encabeza su ficha con el código de otra: QD venía
// como «### QC.», la ficha de al lado de esta misma ronda.
check('QD se publicó con su propio código y QC sigue siendo el diente',
  /^### QD\. Ya es mayor de edad/m.test(lib42) && /^### QC\. Se le ha roto un diente/m.test(lib42));

// Lo que desbloqueó QD: CL seguía ofreciendo la cuenta conjunta como apoyo y la
// incapacitación como opción, cinco años después de que la ley la suprimiera.
const cl = b42('CL');
check('CL ya no ofrece las cuentas conjuntas como alternativa de apoyo',
  !/cuentas conjuntas/.test(cl) && /cotitular/.test(cl) && /\*\*QD\./.test(cl));
check('CL dice que en España la incapacitación de adultos ya no existe',
  /suprimió la incapacitación judicial/.test(cl) && /curatela/.test(cl));

// En un traumatismo dental la conducta es la CONTRARIA según el diente, y el
// agua estropea el diente que se quiere salvar.
const qc = b42('QC');
check('QC distingue diente de leche de definitivo y no manda guardarlo en agua',
  /de leche/.test(qc) && /definitivo/.test(qc) && /IADT/.test(qc)
  && /(El agua NO sirve|el agua lo estropea)/i.test(qc));
check('QC pone al niño antes que el diente', /[Aa]ntes que el diente está el niño/.test(qc));
check('EO, LH y PZ mandan a QC',
  /\*\*QC\. Se le ha roto un diente/.test(b42('EO')) && /\*\*QC\. Se le ha roto un diente/.test(b42('LH'))
  && /\*\*QC\. Se le ha roto un diente/.test(b42('PZ')));

// QD no puede tapar lo que no pudo verificar sobre el art. 18.2.
const qd = b42('QD');
check('QD dice que poner a alguien de cotitular no es una medida de apoyo',
  /cotitular/.test(qd) && /No es una medida de apoyo/i.test(qd));
check('QD deja escrito lo que no pudo verificar sobre la historia clínica',
  /no hemos comprobado si la guarda de hecho/.test(qd));
check('LQ y PV mandan a QD para el trámite concreto',
  /\*\*QD\. Ya es mayor de edad/.test(b42('LQ')) && /\*\*QD\. Ya es mayor de edad/.test(b42('PV')));

// QE no puede sonar a elegir entre el hijo y los padres.
check('QE no plantea elegir entre el hijo y los padres',
  /no.{0,40}elegir entre/i.test(b42('QE')) && /\*\*PQ/.test(b42('QE')));
check('DN y HN mandan a QE',
  /\*\*QE\. Cuido a mi hijo/.test(b42('DN')) && /\*\*QE\. Cuido a mi hijo/.test(b42('HN')));

// QF tenía que desmontar la comparación del 30%, no repetirla ni callarla.
check('QF desmonta la comparación del 30% en vez de repetirla',
  /no la repitas/i.test(b42('QF')) && /53\.378/.test(b42('QF')));
check('BI y HW mandan a QF',
  /\*\*QF\. No deja tirar nada/.test(b42('BI')) && /\*\*QF\. No deja tirar nada/.test(b42('HW')));

// Las fichas de vida adulta caían en el cajón por defecto del conversor.
const idx42 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const temas42 = idx42.temas || idx42;
const catDe = (cod) => (temas42.find((t) => t.codigo === cod) || {}).categoria;
check('LQ, PV y QD ya no caen en el cajón por defecto del conversor',
  catDe('LQ') === 'adultez' && catDe('PV') === 'adultez' && catDe('QD') === 'adultez');
// «tutela» a secas se llevaría PP (piso tutelado) y «los 18» se llevaría MU y QB.
check('Los patrones nuevos no se llevan por delante PP, MU ni QB',
  catDe('PP') !== 'adultez' && catDe('MU') !== 'adultez' && catDe('QB') !== 'adultez');


// 27. Ronda 43. Dos fichas vinieron bloqueadas por choques con fichas publicadas,
// y las dos veces el bloqueo se resolvió buscando: las dos cifras de adherencia a
// la CPAP eran ciertas y medían lo mismo con definiciones distintas, y el ensayo
// de Project SEARCH estaba mal atribuido en FL.
for (const [codigo, marca] of [['QG', /am[íi]gdalas|apnea|CPAP/i],
                               ['QH', /prematur|edad corregida/i],
                               ['QI', /verano|pr[áa]cticas|empleo/i],
                               ['QJ', /pareja|presentar/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 43: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['amigdalas', /am[íi]gdalas|apnea|operar/i],
                       ['deja de respirar durmiendo', /apnea|respir|sue[ñn]o/i],
                       ['nacio prematuro', /prematur|corregida|seguimiento/i],
                       ['que trabaje este verano', /verano|empleo|pr[áa]cticas/i],
                       ['tengo pareja nueva', /pareja|presentar|convivir/i],
                       ['familia reconstituida', /pareja|hijos|convivir/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 43: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}

const lib43 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b43 = (cod) => lib43.slice(lib43.indexOf('### ' + cod + '. '), lib43.indexOf('### ', lib43.indexOf('### ' + cod + '. ') + 6));

// Décima vez que un editor encabeza su ficha con el código de otra: QI venía
// como «### QG.», que es la ficha de las amígdalas de esta misma ronda.
check('QI se publicó con su propio código y QG sigue siendo la de las amígdalas',
  /^### QI\. Quiero que trabaje/m.test(lib43) && /^### QG\. Ronca y deja de respirar/m.test(lib43));

// EN confirmaba la apnea y ofrecía la CPAP como único paso siguiente: invertía
// por omisión el orden de la guía que las dos fichas comparten.
const en43 = b43('EN');
check('EN ya nombra la cirugía como primera línea y enlaza a QG',
  /adenoamigdalectom[íi]a/.test(en43) && /\*\*QG\. Ronca y deja de respirar/.test(en43));

// Las dos cifras de adherencia eran ciertas: lo que fallaba era publicar una sola.
const pt43 = b43('PT');
check('PT publica el rango de adherencia a la CPAP y por qué no hay una cifra única',
  /56,9/.test(pt43) && /46,6/.test(pt43) && /24 %|24%/.test(pt43) && /definiciones/.test(pt43));
check('QG no repite la cifra de adherencia y remite a PT',
  !/46,6|56,9/.test(b43('QG').replace(/> \*\*Para la app.*/s, '')) && /\*\*PT/.test(b43('QG')));

// FL colgaba del artículo de 2017 (49 participantes) las cifras del ensayo
// multicéntrico de 2020 (156). T ya citaba bien el piloto de 2014.
const fl43 = b43('FL');
check('FL atribuye el 73,4% al ensayo multicéntrico de 2020 y no al de 2017',
  /2020/.test(fl43) && /156/.test(fl43) && /73,4/.test(fl43));
check('T sigue citando bien el piloto de 40 participantes',
  /40/.test(b43('T')) && /87,5/.test(b43('T')));

// MZ ofrecía la FCT a los 13-14, y en esta biblioteca esa sigla ya es otra cosa.
const mz43 = b43('MZ');
check('MZ ya no ofrece la FCT a los 13-14 y deshace la colisión de siglas',
  /módulo de los ciclos de FP/.test(mz43) && /\*\*KR\*\*/.test(mz43) && /\*\*QI\. Quiero que trabaje/.test(mz43));

// QG: lo que mata después de operar es el sangrado, y hay dos fármacos prohibidos.
const qg43 = b43('QG');
check('QG manda a urgencias ante cualquier sangre y nombra codeína y tramadol',
  /cualquier sangre/i.test(qg43) && /code[íi]na/.test(qg43) && /tramadol/.test(qg43));
check('QG cuenta que una parte se resuelve sin operar (ensayo CHAT)', /CHAT/.test(qg43) && /42%/.test(qg43));

// QH tiene que sostener los dos errores simétricos a la vez.
const qh43 = b43('QH');
check('QH explica la edad corregida y los dos errores contrarios',
  /edad corregida/.test(qh43) && /M-CHAT/.test(qh43) && /por la prematuridad/.test(qh43));
check('BK y ME mandan a QH',
  /\*\*QH\. Nació muy prematuro/.test(b43('BK')) && /\*\*QH\. Nació muy prematuro/.test(b43('ME')));

// QI y QJ tenían dos cifras míticas prohibidas: el 85% de paro y el 80% de divorcio.
check('QI desmonta el 85% de desempleo en vez de usarlo para motivar',
  /85/.test(b43('QI')) && /(no tiene fuente|mito|circula)/i.test(b43('QI')));
check('QJ no abre con el mito del 80% de divorcios y trae la cautela de EF',
  /\*\*EF/.test(b43('QJ')) && /(Hartley|Freedman|mito)/i.test(b43('QJ')));
check('T y FL mandan a QI, y GE y QB mandan a QJ',
  /\*\*QI\. Quiero que trabaje/.test(b43('T')) && /\*\*QI\. Quiero que trabaje/.test(b43('FL'))
  && /\*\*QJ\. Tengo pareja nueva/.test(b43('GE')) && /\*\*QJ\. Tengo pareja nueva/.test(b43('QB')));


// 28. Ronda 44. Las cuatro publicables a la primera, con dos arreglos del
// conversor: QL caía en "Diagnóstico" por la palabra «diagnosticado» de su
// título, y QN y LP en el cajón por defecto en vez de en "Derechos".
for (const [codigo, marca] of [['QK', /madrugada|retraso de fase|reloj/i],
                               ['QL', /c[áa]ncer|paliativos|ingreso/i],
                               ['QM', /vecin|ruido|casero/i],
                               ['QN', /mudar|certificado|lista de espera/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 44: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re] of [['no se duerme hasta las tres', /madrugada|reloj|fase|sue[ñn]o/i],
                       ['retraso de fase', /fase|reloj|circadian/i],
                       ['mi hijo tiene cancer', /c[áa]ncer|enfermedad grave|ingreso/i],
                       ['cuidados paliativos', /paliativos|s[íi]ntomas|enfermedad/i],
                       ['los vecinos se quejan', /vecin|ruido|comunidad/i],
                       ['nos mudamos de comunidad', /mudar|certificado|traslad/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 44: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re.test(rr), rr.slice(0, 160));
}

const lib44 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b44 = (cod) => lib44.slice(lib44.indexOf('### ' + cod + '. '), lib44.indexOf('### ', lib44.indexOf('### ' + cod + '. ') + 6));
const cuerpo44 = (cod) => b44(cod).replace(/> \*\*Para la app[\s\S]*/, '');

// La regla más vieja de la biblioteca: aquí no se dan dosis de melatonina. Los
// únicos miligramos de QK son los del CBD que apareció en una gominola mal
// etiquetada, que es justo el argumento contrario.
// La regla es que aquí no se receta: los únicos miligramos que aparecen son los
// del CBD hallado en una gominola mal etiquetada, que es el argumento contrario.
check('QK no da ninguna dosis de melatonina y remite a quien la receta',
  !/\d+([.,]\d+)?\s?mg de melatonina/i.test(cuerpo44('QK'))
  && !/melatonina[^.]{0,60}(dosis de|tomar)\s*\d/i.test(cuerpo44('QK'))
  && /quien la receta/.test(cuerpo44('QK')));
check('QK explica que no es rebeldía sino un reloj desplazado',
  /retraso de fase/.test(b44('QK')) && /rebeld[íi]a/.test(b44('QK')));
check('W, LO y KH mandan a QK',
  /\*\*QK\. No se duerme hasta las tres/.test(b44('W')) && /\*\*QK\. No se duerme hasta las tres/.test(b44('LO'))
  && /\*\*QK\. No se duerme hasta las tres/.test(b44('KH')));

// QL no puede vender los paliativos como "el final" ni inventar evidencia de
// autismo donde no la hay.
const ql44 = b44('QL');
check('QL dice que los paliativos pueden ir con el tratamiento curativo',
  /a la vez que el tratamiento|junto al tratamiento|no.{0,40}el final/i.test(ql44));
check('QL admite que casi nada de esto está estudiado en niños autistas',
  /esa literatura apenas existe|casi nada de lo anterior viene de estudios/.test(ql44));
check('CZ, GD y LD mandan a QL',
  /\*\*QL\. Tiene un c[áa]ncer/.test(b44('CZ')) && /\*\*QL\. Tiene un c[áa]ncer/.test(b44('GD'))
  && /\*\*QL\. Tiene un c[áa]ncer/.test(b44('LD')));

// QM tenía prohibido inventar prevalencias de un conflicto que nadie ha medido.
const qm44 = cuerpo44('QM');
check('QM no inventa porcentajes de familias en conflicto vecinal',
  !/\d+\s?% de (las )?familias/.test(qm44) && /gui[óo]n/i.test(qm44));
check('JU y AK mandan a QM',
  /\*\*QM\. Los vecinos se quejan/.test(b44('JU')) && /\*\*QM\. Los vecinos se quejan/.test(b44('AK')));

// QN y NE son dos mudanzas distintas y tienen que distinguirse.
check('QN se distingue de NE y enlaza con ella',
  /\*\*NE/.test(b44('QN')) && /\*\*QN\. Nos mudamos/.test(b44('NE')));
check('LP e IT mandan a QN',
  /\*\*QN\. Nos mudamos/.test(b44('LP')) && /\*\*QN\. Nos mudamos/.test(b44('IT')));

// Dos arreglos del conversor, con sus efectos colaterales vigilados.
const idx44 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const temas44 = idx44.temas || idx44;
const cat44 = (cod) => (temas44.find((t) => t.codigo === cod) || {}).categoria;
check('QL está en salud y no en diagnóstico, y QM en familia',
  cat44('QL') === 'salud' && cat44('QM') === 'familia');
check('QN y LP están en derechos, y NU sigue en escuela',
  cat44('QN') === 'derechos' && cat44('LP') === 'derechos' && cat44('NU') === 'escuela');


// 29. Auditoría de las notas "Antes de publicar". Seis fichas publicadas habían
// dejado escrito trabajo que tocaba a OTRA ficha. Cuatro seguían sin hacer, y no
// eran cosméticas: la biblioteca se contradecía a sí misma en los cuatro casos.
const libA = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bA = (cod) => libA.slice(libA.indexOf('### ' + cod + '. '), libA.indexOf('### ', libA.indexOf('### ' + cod + '. ') + 6));

// DM daba en verde el mismo consejo que PJ marca como propuesta nuestra.
const dm = bA('DM');
check('DM ya no da en verde un consejo que es consenso, y enlaza a PJ',
  !/ser flexible con las expectativas de cada uno\. 🟢/.test(dm)
  && /\*\*PJ\. Lo hago todo yo\*\*/.test(dm));

// N declaraba "sueño del cuidador" como laguna pendiente dos líneas antes de
// mandar a la ficha que ya lo desarrolla.
const n = bA('N');
check('N ya no declara pendiente el sueño del cuidador, que es PQ',
  !/◽ \*\*Hermanos\/as, sueño del cuidador/.test(n) && /\*\*PQ\*\*/.test(n));

// EE resumía un metanálisis sin decir qué concluyó. PQ sí lo decía.
const ee = bA('EE');
check('EE dice lo que concluyó el metanálisis de respiro, no solo que existe',
  /cinco/.test(ee) && /sigue sin estar clara/.test(ee) && !/metaanálisis reciente evaluó la calidad de vida/.test(ee));

// AV metía las historias sociales en el mismo saco verde que las agendas
// visuales; IV las tiene en amarillo desde la ronda 15.
const av = bA('AV');
check('AV separa las historias sociales de los apoyos visuales y manda a IV',
  /narrativas sociales/.test(av) && /\*\*IV\. Cómo escribir una historia social\*\*/.test(av)
  && !/\*\*historias sociales\*\* para preparar situaciones nuevas\. Son \*\*prácticas basadas en evidencia\*\* \(NCAEP\)\. 🟢/.test(av));

// PX decía que sin un segundo adulto aceptado no hay nada que repartir ni a
// quién contratar: NB y PJ lo daban por hecho.
check('NB y PJ enlazan a PX antes de dar por hecho que hay un segundo adulto',
  /\*\*PX\. Solo quiere a mam[áa]/.test(bA('NB')) && /\*\*PX\. Solo quiere a mam[áa]/.test(bA('PJ')));

// Seis fichas publicadas no tenían ni una entrada de búsqueda: existían, pero no
// las encontraba quien escribe con sus palabras.
const sinon = JSON.parse(fs.readFileSync(new URL('../sinonimos.json', import.meta.url), 'utf8'));
const conEntrada = new Set();
for (const v of Object.values(sinon)) if (Array.isArray(v)) v.forEach((c) => conEntrada.add(c));
check('JV, NK, NN, NP, NY y NZ ya tienen entradas de búsqueda',
  ['JV', 'NK', 'NN', 'NP', 'NY', 'NZ'].every((c) => conEntrada.has(c)));



// 30. Ronda 45. Cuatro fichas de seguridad que se tocan entre sí (medicamento,
// emergencias, contención escolar, cabezazos). Dos volvieron bloqueadas, y los
// bloqueos no eran suyos: eran contradicciones con fichas ya publicadas.
for (const [codigo, marca] of [['QP', /sarpullido|erupci[óo]n|urgencias hoy/i],
                               ['QQ', /112|911|emergencias/i],
                               ['QR', /contenci[óo]n|aislamiento|colegio/i],
                               ['QS', /cabezazos|casco|fondo de ojo/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 45: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re45] of [['le ha salido un sarpullido', /sarpullido|erupci[óo]n|medicament/i],
                         ['reaccion al medicamento', /medicament|urgencias|reacci[óo]n/i],
                         ['llamar a emergencias', /112|911|emergencias/i],
                         ['ha venido la policia', /polic[íi]a|112|911/i],
                         ['lo encierran en un cuarto', /aislamiento|cuarto|contenci[óo]n/i],
                         ['contencion en el colegio', /contenci[óo]n|colegio|sujet/i],
                         ['se da cabezazos', /cabeza|casco|golpe/i],
                         ['casco protector', /casco/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 45: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re45.test(rr), rr.slice(0, 160));
}

const lib45 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b45 = (cod) => {
  const i = lib45.indexOf('### ' + cod + '. ');
  const j = lib45.indexOf('\n### ', i + 6);
  return j === -1 ? lib45.slice(i) : lib45.slice(i, j);
};
const cuerpo45 = (cod) => b45(cod).replace(/> \*\*Para la app[\s\S]*/, '');

// QP chocaba con LV en el umbral del síndrome serotoninérgico: LV exigía fiebre
// alta para ir a urgencias, y los criterios clínicos no la exigen. Se corrigió
// LV, que era la equivocada, no QP.
const lv45 = cuerpo45('LV');
check('LV ya no pide esperar a la fiebre para ir a urgencias',
  /la fiebre puede llegar después o no llegar/.test(lv45) && !/fiebre alta con rigidez/.test(lv45));

// QQ chocaba con CJ, que vendía la formación policial como algo que reduce el
// riesgo. No hay evidencia de que reduzca detenciones ni uso de la fuerza.
const cj45 = cuerpo45('CJ');
check('CJ ya no promete que la formación policial reduzca el riesgo',
  !/la formación policial en autismo reducen mucho ese riesgo/.test(cj45)
  && /su efecto no está demostrado/.test(cj45) && /\*\*QQ\./.test(cj45));

// GX daba por universal un trámite que solo hemos podido documentar en dos países.
const gx45 = cuerpo45('GX');
check('GX acota el formulario de necesidades especiales a EE. UU. y Canadá',
  /Estados Unidos y Canadá/.test(gx45) && /No hemos verificado que exista nada equivalente/.test(gx45));

// QP es triaje, no receta: ninguna dosis, ninguna pauta de retirada.
const qp45 = cuerpo45('QP');
check('QP no da dosis ni pautas y dice que la retirada la decide quien atiende',
  !/\b\d+([.,]\d+)?\s?mg\b/.test(qp45) && /La retirada ante una reacción la decide quien atiende/.test(qp45));
check('QP deja fuera los estimulantes del TDAH y manda a U y NJ',
  /No cubre los estimulantes del TDAH/.test(qp45) && /\*\*NJ\./.test(qp45));

// La regla de la erupción vale en cualquier mes: si se escribiera solo para el
// inicio, un padre del mes cuarto se quedaría en casa.
check('QP mantiene la erupción como urgencia en cualquier momento del tratamiento',
  /en cualquier momento del tratamiento, no solo al empezar/.test(qp45));

// Los bloques de emergencia no llevan píldora de semáforo: un "Evidencia
// sólida" verde pegado a un 🚨 se lee como "todo en orden".
for (const cod of ['QP', 'QQ', 'QR', 'QS']) {
  const conPildora = cuerpo45(cod).split('\n')
    .filter((l) => l.startsWith('- ') && l.includes('🚨') && /[🟢🟡🔴⚪]\s*$/.test(l));
  check(`${cod}: ningún bloque 🚨 lleva píldora de nivel`, conPildora.length === 0, conPildora[0]);
}
for (const cod of ['QP', 'QQ', 'QR', 'QS']) {
  check(`${cod} avisa de que el color es evidencia y no prisa`,
    /Los colores indican \*\*cuánta evidencia hay detrás de cada punto\*\*/.test(cuerpo45(cod)));
}

// Enlaces inversos: una ficha a la que no apunta nadie no existe para quien no
// llega por el buscador.
check('MQ, NN, MI, NM, NS, NJ y MH mandan a QP',
  ['MQ', 'NN', 'MI', 'NM', 'NS', 'NJ', 'MH'].every((c) => /\*\*QP\. ¿Esta reacción al medicamento/.test(b45(c))));
check('AE, JB, FP, CJ y GX mandan a QQ',
  ['AE', 'JB', 'FP', 'CJ', 'GX'].every((c) => /\*\*QQ\. Llamar al 112/.test(b45(c))));
check('FQ, LL y MV mandan a QR',
  ['FQ', 'LL', 'MV'].every((c) => /QR\. En el colegio lo sujetan/.test(b45(c))));
check('KS, DR, LK, QC, MN y FQ mandan a QS',
  ['KS', 'DR', 'LK', 'QC', 'MN', 'FQ'].every((c) => /\*\*QS\. Se golpea la cabeza/.test(b45(c))));

// FQ mandaba a PP a cualquiera que buscase el registro de una contención,
// incluidos los padres de un escolar, que es justo lo que ahora cubre QR.
check('FQ reparte entre QR (colegio) y PP (centro de adultos)',
  /si fue en el colegio, en QR/.test(b45('FQ')) && /si fue en un centro de día, un piso tutelado o un respiro, en PP/.test(b45('FQ')));

// «se golpea la cabeza» mandaba a tres temas que no son este.
const sinon45 = JSON.parse(fs.readFileSync(new URL('../sinonimos.json', import.meta.url), 'utf8'));
check('«se golpea la cabeza» lleva a QS antes que a Z, G y CY',
  sinon45['se golpea la cabeza'][0] === 'QS');
check('las cuatro de la ronda 45 tienen entradas de búsqueda propias',
  ['QP', 'QQ', 'QR', 'QS'].every((c) => Object.values(sinon45).some((v) => Array.isArray(v) && v.includes(c))));

// El conversor: QP y QS a salud, y QR con LL en escuela (la palabra
// «contención» se la llevaba a conducta). MV caía en el cajón por defecto.
const idx45 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const temas45 = idx45.temas || idx45;
const cat45 = (cod) => (temas45.find((t) => t.codigo === cod) || {}).categoria;
check('QP y QS están en salud', cat45('QP') === 'salud' && cat45('QS') === 'salud');
check('QR está en escuela, con LL, y no en conducta',
  cat45('QR') === 'escuela' && cat45('LL') === 'escuela');
check('MV sale del cajón por defecto y se va a escuela', cat45('MV') === 'escuela');
check('la excepción de QR no arrastró a FQ ni a PP fuera de su sitio',
  cat45('FQ') === 'conducta' && cat45('PP') === 'familia');

// Las dos deudas que QS dejó escritas en su propia nota, cerradas en la misma
// ronda. La primera era una contradicción viva: la biblioteca mandaba ir con un
// vómito en tres fichas y con dos en otras cinco.
const VOMITO_VIEJO = /vomita más de una vez|Vomita más de una vez/;
for (const cod of ['QC', 'MT', 'NC', 'PP', 'QF', 'QS']) {
  check(`${cod} cuenta desde el primer vómito tras un golpe en la cabeza`,
    !VOMITO_VIEJO.test(cuerpo45(cod)) && /primer vómito|una sola vez|Vomita, \*\*y cuenta desde el primer vómito/.test(cuerpo45(cod)),
    cuerpo45(cod).slice(0, 80));
}
check('QS dice de dónde sale el umbral de la guía y que el suyo es más bajo a propósito',
  /tres o más episodios de vómito/.test(cuerpo45('QS'))
  && /precaución declarada nuestra, no un criterio publicado/.test(cuerpo45('QS')));
check('ND baja el umbral del bebé a un solo vómito',
  /vomita \*\*aunque sea una sola vez\*\*/.test(cuerpo45('ND')));
check('QS nombra el retinoblastoma y avisa del antiojos rojos',
  /retinoblastoma/i.test(cuerpo45('QS')) && /antiojos rojos/.test(cuerpo45('QS')));

// Comprobación por búsqueda de una cifra de QP: las de la lamotrigina salieron
// exactas, pero la del síndrome neuroléptico maligno estaba publicada como UNA
// cifra cuando la literatura da un rango de dos órdenes de magnitud. Es el mismo
// error que ya cayó con la adherencia a la CPAP: las dos cifras eran ciertas.
for (const cod of ['QP', 'MQ']) {
  check(`${cod} da el rango del síndrome neuroléptico maligno, no una cifra sola`,
    /0,01% a más del 2%/.test(cuerpo45(cod)), cuerpo45(cod).slice(0, 60));
}
check('QP conserva exactas las cifras de la lamotrigina que se comprobaron en la ficha del fabricante',
  /0,3%–0,8% de los niños/.test(cuerpo45('QP')) && /0,08%–0,3% de los adultos/.test(cuerpo45('QP'))
  && /1\.983 niños/.test(cuerpo45('QP')));

// Dos cifras de QR colgaban del denominador equivocado. En el estudio de Nunno
// las 38 muertes en prono son sobre las 63 sujeciones físicas, no sobre las 79
// muertes totales; y el GAO habla de nueve distritos de más de 100.000 alumnos,
// no de "nueve de los treinta más grandes".
const qr45 = cuerpo45('QR');
check('QR atribuye las 38 muertes en prono a las 63 sujeciones físicas, no a las 79',
  /63 fueron sujeciones físicas/.test(qr45) && /38 de esos 63/.test(qr45)
  && !/79 fallecimientos, de los cuales 38 —casi la mitad—/.test(qr45));
check('QR describe bien lo que encontró el GAO sobre los distritos que declararon cero',
  /nueve distritos de más de 100\.000 alumnos declararon cero por error/.test(qr45)
  && /solo uno/.test(qr45) && !/nueve de los treinta distritos más grandes/.test(qr45));


// 31. Ninguna ficha muda. 155 de 426 fichas no tenían una sola entrada en
// sinonimos.json: existían, estaban en el índice y se abrían por su enlace,
// pero el buscador puntúa 8 por palabra del título, 5 por clave y 1 por cuerpo,
// así que quien escribía con sus palabras no llegaba. Esta prueba impide que
// vuelva a publicarse una ficha sin una puerta de entrada en lenguaje de familia.
const sinonMudas = JSON.parse(fs.readFileSync(new URL('../sinonimos.json', import.meta.url), 'utf8'));
const idxMudas = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const temasMudas = idxMudas.temas || idxMudas;
const alcanzados = new Set();
for (const [clave, v] of Object.entries(sinonMudas)) {
  if (clave.startsWith('_') || !Array.isArray(v)) continue;
  v.forEach((c) => alcanzados.add(c));
}
const mudas = temasMudas.map((t) => t.codigo).filter((c) => !alcanzados.has(c));
check('ninguna ficha se queda sin entrada de búsqueda en sinonimos.json',
  mudas.length === 0, mudas.slice(0, 12).join(' '));

// Y los códigos que aparecen en sinonimos.json tienen que existir: una entrada
// hacia una ficha que no está publicada no falla, simplemente no lleva a nadie.
const codigosVivos = new Set(temasMudas.map((t) => t.codigo));
const fantasmas = [];
for (const [clave, v] of Object.entries(sinonMudas)) {
  if (clave.startsWith('_') || !Array.isArray(v)) continue;
  for (const c of v) if (!codigosVivos.has(c)) fantasmas.push(`${clave} -> ${c}`);
}
check('ninguna entrada de búsqueda apunta a un código que no existe',
  fantasmas.length === 0, fantasmas.slice(0, 6).join(' | '));

// El orden de los códigos dentro de una clave NO lo lee nadie: buscarTemas()
// hace impulso[c] = max(...) para todos por igual y, si empatan, gana el título
// alfabéticamente menor. Por eso las frases de cabezazos apuntan solo a QS: con
// KS dentro, empataban y ganaba «Autolesión», que no es la que dice qué mirar hoy.
for (const frase of ['se da cabezazos', 'cabezazos contra la pared', 'se golpea la cabeza contra la pared']) {
  check(`«${frase}» apunta solo a QS`,
    Array.isArray(sinonMudas[frase]) && sinonMudas[frase].length === 1 && sinonMudas[frase][0] === 'QS',
    JSON.stringify(sinonMudas[frase]));
}
// Las dos fichas que LLEVAN el título de una frase no estaban dentro de ella.
check('«se tapa los oídos» y «no se deja cortar las uñas» incluyen su propia ficha',
  (sinonMudas['se tapa los oidos'] || []).includes('IN')
  && (sinonMudas['no se deja cortar las unas'] || []).includes('IO'));


// 32. "Comprender el autismo" era el cajón por defecto del conversor y tenía
// dentro 113 de las 429 fichas: "Convulsiones: qué hacer en el momento" vivía
// en la misma categoría que "Historia del concepto de autismo". Los títulos de
// esta biblioteca están escritos como habla una familia, así que ningún patrón
// de palabras los alcanza; van asignados a mano en CATEGORIA_POR_CODIGO.
const convSrc = fs.readFileSync(new URL('../construir-contenido.py', import.meta.url), 'utf8');
const bloqueMapa = convSrc.slice(convSrc.indexOf('CATEGORIA_POR_CODIGO = {'),
  convSrc.indexOf('}', convSrc.indexOf('CATEGORIA_POR_CODIGO = {')));
const mapaCat = new Map();
for (const m of bloqueMapa.matchAll(/"([A-Z]{1,2})":\s*"([a-z]+)"/g)) mapaCat.set(m[1], m[2]);
check('CATEGORIA_POR_CODIGO se lee y no está vacío', mapaCat.size > 50, String(mapaCat.size));

const porCodigo = new Map(temasMudas.map((t) => [t.codigo, t]));
const desviadas = [];
for (const [cod, cat] of mapaCat) {
  const tema = porCodigo.get(cod);
  if (!tema) { desviadas.push(`${cod} no existe`); continue; }
  if (tema.categoria !== cat) desviadas.push(`${cod}: ${tema.categoria} != ${cat}`);
}
check('cada ficha asignada a mano acaba en la categoría que declara',
  desviadas.length === 0, desviadas.slice(0, 6).join(' | '));

// El cajón por defecto deja de ser el más grande de la biblioteca: lo que queda
// dentro es lo que de verdad es conceptual o de identidad.
const porCategoria = {};
for (const t of temasMudas) porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + 1;
check('"Comprender el autismo" ya no es un cajón de sastre',
  porCategoria.comprender <= 25, `comprender=${porCategoria.comprender}`);
check('el cajón por defecto no es la categoría más grande',
  Math.max(...Object.values(porCategoria)) > porCategoria.comprender,
  JSON.stringify(porCategoria));
check('las 12 categorías siguen teniendo fichas', Object.keys(porCategoria).length === 12,
  Object.keys(porCategoria).join(' '));

// Las que un padre buscaría explícitamente donde ahora están.
const cat32 = (c) => (porCodigo.get(c) || {}).categoria;
check('las fichas médicas están en salud',
  ['JQ', 'MH', 'NJ', 'NM', 'PZ', 'QG'].every((c) => cat32(c) === 'salud'));
check('la casa y el día a día están en familia',
  ['IE', 'IF', 'AE', 'NK', 'PJ'].every((c) => cat32(c) === 'familia'));
check('los apoyos que se fabrican están en terapias',
  ['IU', 'IV', 'KT', 'KU'].every((c) => cat32(c) === 'terapias'));
check('lo conceptual se queda en comprender',
  ['J', 'BX', 'BZ', 'FZ', 'KO'].every((c) => cat32(c) === 'comprender'));


// 33. El Detector conocía 15 términos para una biblioteca de 429 temas, y la
// auditoría ya avisó de que la suite solo probaba UNO de los 15. Ahora son 35
// casos —los 20 nuevos salen de fichas ya publicadas y verificadas, entre ellas
// CS, que se escribió justo para esto y llevaba rondas sin volcarse— y esta
// sección los prueba uno a uno contra la app de verdad, no contra el JSON.
const detSrc = JSON.parse(fs.readFileSync(new URL('../../web/content/banderas-rojas.json', import.meta.url), 'utf8'));
check('el Detector tiene al menos 35 casos', detSrc.casos.length >= 35, String(detSrc.casos.length));

const idsDet = detSrc.casos.map((c) => c.id);
check('ningún caso del Detector repite id', new Set(idsDet).size === idsDet.length);
const sinFuente = detSrc.casos.filter((c) => !Array.isArray(c.fuentes) || c.fuentes.length === 0);
check('todo veredicto del Detector viene con al menos una fuente',
  sinFuente.length === 0, sinFuente.map((c) => c.id).join(' '));
const veredictosRaros = detSrc.casos.filter((c) => !['ok', 'media', 'evitar'].includes(c.veredicto));
check('todos los veredictos son ok, media o evitar',
  veredictosRaros.length === 0, veredictosRaros.map((c) => c.id).join(' '));
// Un alias en dos casos distintos es un empate que el detector resuelve solo, y
// nadie se entera: la familia recibe el veredicto del otro producto.
const duenoAlias = new Map();
const chocan = [];
for (const c of detSrc.casos) {
  for (const a of (c.alias || [])) {
    const k = a.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (duenoAlias.has(k) && duenoAlias.get(k) !== c.id) chocan.push(`${a}: ${duenoAlias.get(k)} / ${c.id}`);
    else duenoAlias.set(k, c.id);
  }
}
check('ningún alias pertenece a dos casos del Detector', chocan.length === 0, chocan.slice(0, 5).join(' | '));

// Lo que escribe una familia, contra la app servida. Se comprueba el veredicto,
// no solo que salga algo: un rojo que sale verde es peor que no salir.
for (const [q, esperado] of [['gcmaf', /Evítalo/],
                             ['leche de camella', /Evítalo/],
                             ['quieren hacerle un exorcismo', /Evítalo/],
                             ['bano ionico de pies', /Evítalo/],
                             ['suplementos de metilacion', /Evítalo/],
                             ['intestino permeable', /Evítalo/],
                             ['dicen que el wifi causa autismo', /Evítalo/],
                             ['tome paracetamol en el embarazo', /Evítalo/],
                             ['aceites esenciales', /Cautela/],
                             ['cbd para el autismo', /Cautela/],
                             ['leucovorina', /Cautela/],
                             ['dieta cetogenica', /Cautela/],
                             ['sulforafano', /Cautela/],
                             ['equinoterapia', /Cautela/],
                             ['perro de asistencia', /Cautela/],
                             ['pandas', /Cautela/],
                             ['musicoterapia', /Cautela/],
                             ['curcuma', /Cautela/],
                             ['sales de epsom', /Cautela/],
                             ['cromoterapia', /Cautela/]]) {
  const r = await detectar(q);
  check(`Detector: «${q}» da su veredicto`, esperado.test(r), r.slice(0, 120));
}
// Y el pilar de todo esto: que ampliarlo no haya vuelto gritón al Detector.
for (const q of ['terapia', 'sistema', 'agua', 'musica', 'perro']) {
  const r = await detectar(q);
  check(`Detector: «${q}» no dispara un rojo a la ligera`, !/Evítalo/.test(r), r.slice(0, 110));
}
// Una palabra suelta no resuelve a una ficha concreta, por corto que sea su
// alias. Antes bastaba con que el alias midiera el doble que la consulta:
// "dieta" ya caía en «dieta cura» —un fallo que estaba desde antes—, y al
// añadir «terapia de luz» también cayó "terapia". Ahora las dos preguntan.
for (const q of ['terapia', 'dieta']) {
  const r = await detectar(q);
  check(`Detector: «${q}» a secas pregunta en vez de dar un veredicto`,
    /cuál te refieres/i.test(r), r.slice(0, 130));
}


// 34. Ronda 46, primera mitad. QT y QU salieron publicables; QV y QW se
// quedaron a medias porque el límite de sesión mató sus editores finales
// —38 y 30 críticas sin aplicar— y una ficha sin corregir no se publica.
for (const [codigo, marca] of [['QT', /cama de seguridad|arn[ée]s|carro/i],
                               ['QU', /cuarto|habitaci[óo]n|retraimiento|encierr/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 46: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re46] of [['cama de seguridad', /cama|arn[ée]s|sujeci[óo]n/i],
                         ['se escapa de noche', /noche|cama|fuga|escap/i],
                         ['silla de paseo grande', /carro|silla|paseo/i],
                         ['no sale de su cuarto', /cuarto|habitaci[óo]n|encierr/i],
                         ['hikikomori', /cuarto|retraimiento|encierr/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 46: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re46.test(rr), rr.slice(0, 160));
}

const lib46 = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const b46 = (cod) => {
  const i = lib46.indexOf('### ' + cod + '. ');
  const j = lib46.indexOf('\n### ', i + 6);
  return j === -1 ? lib46.slice(i) : lib46.slice(i, j);
};
const cuerpo46 = (cod) => b46(cod).replace(/> \*\*Para la app[\s\S]*/, '');

// QT no puede recomendar marcas ni productos: el daño documentado aquí es el
// atrapamiento, y una cama cerrada mal elegida es justo el riesgo.
const qt46 = cuerpo46('QT');
check('QT dice sin rodeos lo que no se hace nunca',
  /nunca lo ates a la cama/i.test(qt46) && /con llave por fuera/i.test(qt46));
check('QT da criterios que un padre puede aplicar solo, no una lista de compra',
  /¿puede salir él solo/i.test(qt46) && /le limite menos/i.test(qt46)
  && /cinco preguntas/i.test(qt46));

// QU tenía prohibido presentar como medida en autismo lo que se midió en otra
// población: la mayor parte de la literatura de hikikomori es japonesa y no autista.
const qu46 = cuerpo46('QU');
check('QU dice de dónde viene su evidencia en vez de aparentar que es de autismo',
  /investigación disponible es japonesa/i.test(qu46) && /\*\*no\*\* autist/i.test(qu46)
  && /serie clínica de Barcelona/i.test(qu46));
// Y no vende como cifra firme un intervalo que va de 1 de cada 4 a 1 de cada 2.
check('QU publica el intervalo de confianza del 41 %, no solo el 41 %',
  /41,0%/.test(qu46) && /26,3%–57,7%/.test(qu46));

// Enlaces inversos: una ficha a la que no apunta nadie no existe para quien no
// llega por el buscador.
check('AE, LH, PF, LI, FQ y QS mandan a QT',
  ['AE', 'LH', 'PF', 'LI', 'FQ', 'QS'].every((c) => /\*\*QT\. Se escapa de la cama/.test(b46(c))));
check('AN, IC, LO y MW mandan a QU',
  ['AN', 'IC', 'LO', 'MW'].every((c) => /\*\*QU\. Lleva meses sin salir/.test(b46(c))));

// La deuda que QU dejó escrita, cerrada en el mismo commit: DO era la ficha
// canónica de la catatonía y no tenía bloque de urgencia, mientras LM publicaba
// ese criterio exacto. La ficha más específica era la menos protectora.
const do46 = cuerpo46('DO');
check('DO ya manda a urgencias ante la pérdida de habilidades, como LM',
  /🚨 URGENCIAS/.test(do46) && /deja de lavarse o de vestirse solo/.test(do46)
  && /\*\*LM\. ¿Hay que ingresarlo/.test(do46));
check('DO distingue la catatonía del encierro de QU y del cuadro de NJ',
  /\*\*QU\. Lleva meses sin salir/.test(do46) && /\*\*NJ\*\*/.test(do46));

// El conversor: QT caía otra vez en el cajón por defecto.
const idx46 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const temas46 = idx46.temas || idx46;
const cat46 = (cod) => (temas46.find((t) => t.codigo === cod) || {}).categoria;
check('QT está en familia y QU en adultez',
  cat46('QT') === 'familia' && cat46('QU') === 'adultez');

// La clave «arnes» mandaba solo al cinturón del coche.
const sinon46 = JSON.parse(fs.readFileSync(new URL('../sinonimos.json', import.meta.url), 'utf8'));
check('«arnes» llega también a QT, no solo a LI',
  (sinon46['arnes'] || []).includes('QT') && (sinon46['arnes'] || []).includes('LI'));


// 35. El Centro de evidencia tenía 4 secciones y 15 tarjetas para 431 temas, y
// ESTADO.md lo llevaba marcado como prioridad alta. Ahora son 7 y 24: lo que
// faltaba no era relleno, era lo que más cambia lo que una familia hace el
// mismo día —el sueño, la epilepsia, el ensombrecimiento diagnóstico, que la
// CAA no retrasa el habla, y las cifras de fuga y ahogamiento—.
const evi = JSON.parse(fs.readFileSync(new URL('../../web/content/evidencia.json', import.meta.url), 'utf8'));
const itemsEvi = evi.secciones.flatMap((s) => s.items || []);
check('el Centro de evidencia tiene al menos 7 secciones y 24 tarjetas',
  evi.secciones.length >= 7 && itemsEvi.length >= 24,
  `${evi.secciones.length} secciones, ${itemsEvi.length} tarjetas`);
const sinFuenteEvi = itemsEvi.filter((i) => !Array.isArray(i.fuentes) || i.fuentes.length === 0);
check('toda tarjeta de evidencia viene con al menos una fuente',
  sinFuenteEvi.length === 0, sinFuenteEvi.map((i) => i.titulo).join(' | '));
const nivelesRaros = itemsEvi.filter((i) => !['alta', 'media', 'evitar'].includes(i.nivel));
check('todos los niveles del Centro de evidencia son alta, media o evitar',
  nivelesRaros.length === 0, nivelesRaros.map((i) => i.titulo).join(' | '));
const idsEvi = evi.secciones.map((s) => s.id);
check('ninguna sección del Centro de evidencia repite id',
  new Set(idsEvi).size === idsEvi.length, idsEvi.join(' '));
check('la sección de lo que hay que evitar cierra la página',
  /EVITAR/.test(evi.secciones[evi.secciones.length - 1].titulo),
  evi.secciones[evi.secciones.length - 1].titulo);

// Las cifras nuevas son las que la biblioteca ya publica verificadas: si
// alguien las cambia en un sitio y no en el otro, esto lo caza.
const textoEvi = JSON.stringify(itemsEvi);
check('el Centro de evidencia da el rango de la epilepsia, no una cifra redonda',
  /6%–27%/.test(textoEvi) && !/\b20-25%\b/.test(textoEvi));
check('el Centro de evidencia dice que la CAA no retrasa el habla',
  /no impiden la producción del habla/.test(textoEvi));
check('las cifras de fuga y ahogamiento coinciden con las de AE',
  /49%/.test(textoEvi) && /160 veces/.test(textoEvi)
  && /49%/.test(b46('AE')) && /160 veces/.test(b46('AE')));
check('la cifra de sujeción en prono coincide con la corregida en QR',
  /38 —seis de cada diez—/.test(textoEvi) && /38 de esos 63/.test(b46('QR')));

await ir('#evidencia');
const texEvi = await texto();
for (const titulo of ['La salud que hay que vigilar', 'Comunicación', 'Seguridad']) {
  check(`Centro de evidencia: la sección «${titulo}» se ve en la app`,
    texEvi.includes(titulo), texEvi.slice(0, 120));
}
check('Centro de evidencia: la tarjeta del sueño llega a la pantalla',
  /44%|44-83|44 %/.test(texEvi) || /sue[ñn]o/i.test(texEvi), texEvi.slice(0, 120));


// 36. Ronda 46, segunda mitad. QV y QW se publican ya corregidas: sus editores
// finales, que el límite de sesión había matado, se recuperaron al reanudar.
// QT y QU se reemplazan por su versión de la segunda pasada, que trae lo que
// aquellos editores no habían llegado a aplicar.
for (const [codigo, marca] of [['QV', /valproato|anticoncep|regla/i],
                               ['QW', /peso|curva|crecimiento|sonda/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 46: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re46b] of [['valproato', /valproato|epilep|regla/i],
                          ['puede tomar la pildora', /anticoncep|p[íi]ldora|valproato/i],
                          ['no engorda', /peso|curva|crece/i],
                          ['le quieren poner sonda', /sonda|gastrostom|peso/i],
                          ['gastrostomia', /sonda|gastrostom/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 46: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re46b.test(rr), rr.slice(0, 160));
}

// QV no receta: dice qué preguntar. Y la regla de oro de la biblioteca sigue ahí.
const qv46 = cuerpo46('QV');
check('QV no da dosis ni pautas de antiepiléptico', !/\b\d+([.,]\d+)?\s?mg\b/.test(qv46));
check('QV mantiene que un antiepiléptico no se retira ni se cambia por cuenta propia',
  /no se retira|no retires|nunca .{0,30}por (tu |su )?cuenta/i.test(qv46));

// QW tenía prohibido dramatizar la sonda y tenía que decir de dónde sale su evidencia.
const qw46 = cuerpo46('QW');
check('QW dice qué parte viene de pediatría general y no de autismo',
  /pediatr[íi]a general|población general|no.{0,25}en niños autistas/i.test(qw46));

// Las dos ediciones que QV dejó pedidas en fichas ya publicadas, y que eran de
// seguridad: NW ofrecía el implante sin decir que los antiepilépticos
// inductores lo desaconsejan, y KG seguía con un criterio de erupción más
// estrecho que el que publican QP y NN.
const nw46 = cuerpo46('NW');
check('NW avisa de que el implante no se recomienda con antiepilépticos inductores',
  /el implante no se recomienda/.test(nw46) && /DIU de cobre/.test(nw46)
  && /\*\*QV\. Mi hija toma valproato/.test(nw46));
const kg46 = cuerpo46('KG');
check('KG ya usa el criterio ancho de la erupción, como QP y NN',
  /cualquier erupción en la piel si toma un antiepiléptico/.test(kg46)
  && !/\*\*erupción extensa, con ampollas o que afecta a labios y ojos\*\*/.test(kg46));

// Enlaces inversos.
check('QP, NN, MO, DA, BK y NW mandan a QV',
  ['QP', 'NN', 'MO', 'DA', 'BK', 'NW'].every((c) => /\*\*QV\. Mi hija toma valproato/.test(b46(c))));
check('LU, P, LG, HJ, NS, KE y U mandan a QW',
  ['LU', 'P', 'LG', 'HJ', 'NS', 'KE', 'U'].every((c) => /\*\*QW\. No gana peso/.test(b46(c))));

// QV es farmacología, no adolescencia: va donde ya está NW.
const idx46b = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const temas46b = idx46b.temas || idx46b;
const cat46b = (cod) => (temas46b.find((t) => t.codigo === cod) || {}).categoria;
check('QV y QW están en salud, con NW', cat46b('QV') === 'salud' && cat46b('QW') === 'salud');

// La segunda pasada de QT y QU trajo cosas que la primera no tenía.
check('QU trae ya los bloques 🚨 de riesgo, no solo la frase del mensaje clave',
  (cuerpo46('QU').match(/🚨/g) || []).length >= 4
  && /preguntar no le mete la idea en la cabeza/.test(cuerpo46('QU')));
check('QT declara que sus cifras de fugas y atrapamiento son estadounidenses',
  /Las cifras de fugas y de atrapamiento son de Estados Unidos/.test(cuerpo46('QT')));


// 37. Coherencia entre fichas. Las contradicciones que han ido apareciendo
// —la fiebre en LV y QP, el vómito en ocho fichas, el implante de NW, la
// formación policial de CJ— tenían todas la misma forma: dos fichas hablando
// de lo mismo con cifras distintas, y nadie mirándolas juntas.
// `scripts/pruebas/coherencia-cifras.py` las busca; estas prueban las que ya
// se cerraron, para que no vuelvan.
const libC = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const bC = (cod) => {
  const i = libC.indexOf('### ' + cod + '. ');
  const j = libC.indexOf('\n### ', i + 6);
  return j === -1 ? libC.slice(i) : libC.slice(i, j);
};
// El 26% de Anderson es del total de la muestra; el 53% es de los que sí se
// escaparon. JD daba el 26% pegado al 49% sin decir de qué era, y se leía como
// si fuera el mismo dato que el 53% de MJ.
check('JD dice de qué es el 26% de Anderson y lo distingue del 53%',
  /26% \*\*del total de la muestra\*\*/.test(bC('JD')) && /53%/.test(bC('JD')));
check('MJ y NH siguen diciendo cada uno su denominador',
  /de los que se escaparon, el 53%/.test(bC('MJ')) && /26% del total/.test(bC('NH')));
// O publicaba «1 de cada 4» para la regresión cuando BJ ya publicaba que
// depende de la definición.
check('O da el rango de la regresión en vez de una cifra sola',
  /La frecuencia depende de cómo se defina/.test(bC('O')) && /\*\*BJ\*\*/.test(bC('O')));
// LJ y NS publicaban dos ensayos de retirada de risperidona con magnitudes muy
// distintas (62,5 % vs 12,5 % en RUPP; 52,9 % vs 70,7 % en Dinnissen) sin que
// ninguna mencionara a la otra: el mismo padre sacaba una impresión u otra
// según por dónde entrara. Las dos son ciertas y describen tiempos de
// tratamiento y velocidades de retirada distintos, que es lo que faltaba decir.
check('LJ y NS se citan la una a la otra al hablar de retirar la risperidona',
  /\*\*NS\*\*/.test(bC('LJ')) && /62,5 %/.test(bC('LJ'))
  && /lo que publica LJ/.test(bC('NS')) && /52,9 %/.test(bC('NS')));
check('las dos explican por qué las cifras difieren, en vez de elegir una',
  /cuánto tiempo llevaba tomándolo y a qué velocidad se bajó/.test(bC('LJ'))
  && /Las dos cifras son ciertas/.test(bC('NS')));


// 38. Las notas "Para la app" de cada ficha encargan trabajo de integración
// —darla de alta en sinonimos.json, añadirla al índice— y ese encargo se ha
// hecho a mano en cada ronda. Esta prueba lo automatiza: si una ficha pide su
// alta y no la tiene, la suite lo dice antes de que la ronda se dé por cerrada.
// Hoy pasa porque las 15 que lo piden ya están hechas.
const indTxt = fs.readFileSync(new URL('../../research/indice-temas.txt', import.meta.url), 'utf8');
const sinTodos = new Set();
for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(new URL('../sinonimos.json', import.meta.url), 'utf8')))) {
  if (!k.startsWith('_') && Array.isArray(v)) v.forEach((c) => sinTodos.add(c));
}
const deudasIntegracion = [];
for (const trozo of libC.split(/(?=^### )/m)) {
  const cod = (trozo.match(/^### ([A-Z]{1,2})\. /) || [])[1];
  if (!cod) continue;
  const i = trozo.indexOf('> **Para la app');
  if (i === -1) continue;
  const nota = trozo.slice(i);
  if (/(dar de alta|a[ñn]adir)[\s\S]{0,80}sinonimos\.json/i.test(nota) && !sinTodos.has(cod)) {
    deudasIntegracion.push(`${cod}: pide entradas de búsqueda y no las tiene`);
  }
  if (new RegExp(`a[ñn]adir\\s+\\*?\\*?${cod}\\*?\\*?\\s+a\\s+\`?research/indice-temas`, 'i').test(nota)
      && !new RegExp(`^${cod}\\. `, 'm').test(indTxt)) {
    deudasIntegracion.push(`${cod}: pide estar en el índice y no está`);
  }
}
check('ninguna ficha pide una integración que siga sin hacerse',
  deudasIntegracion.length === 0, deudasIntegracion.slice(0, 6).join(' | '));

// Y el índice y la biblioteca tienen que contener exactamente los mismos temas:
// una ficha fuera del índice existe pero no se lista, y una línea del índice sin
// ficha es un enlace a la nada.
const codsLib = [...libC.matchAll(/^### ([A-Z]{1,2})\. /gm)].map((m) => m[1]);
const codsInd = [...indTxt.matchAll(/^([A-Z]{1,2})\. /gm)].map((m) => m[1]);
const soloLib = codsLib.filter((c) => !codsInd.includes(c));
const soloInd = codsInd.filter((c) => !codsLib.includes(c));
check('la biblioteca y el índice de temas contienen los mismos códigos',
  soloLib.length === 0 && soloInd.length === 0,
  `solo en la biblioteca: ${soloLib.join(' ')} | solo en el índice: ${soloInd.join(' ')}`);

// El detector de coherencia, ampliado a plazos, encontró que O marcaba como
// señal de alarma no señalar a los ~14 meses mientras HQ publicaba que señalar
// aparece entre los 12 y los 18: el mismo padre leía «alarma» o «va en plazo»
// según por dónde entrara. Lo comprobado es que las señales reconocidas son no
// hacer NINGÚN gesto a los 12 meses y no señalar a los 18.
check('O y HQ dicen lo mismo sobre cuándo señalar es señal de alarma',
  /12 y los 18 meses/.test(bC('O')) && /no señalar nada a los 18/.test(bC('O'))
  && /\*\*HQ\. Desarrollo del lenguaje/.test(bC('O'))
  && /ningún gesto a los 12 meses/.test(bC('HQ')) && /como recoge \*\*O\*\*/.test(bC('HQ')));
check('ninguna de las dos convierte el margen normal en un plazo para esperar',
  /no se espera a ver/.test(bC('O')) && /no un plazo para esperar/.test(bC('HQ')));

// Tres fichas publicaban la prevalencia del estreñimiento con dos cifras
// distintas —~26% (Wang 2022) en A, ~37% (McElhanon 2014) en AA y ME— sin que
// ninguna nombrara a la otra. Las dos son ciertas y vienen de metanálisis
// distintos; lo que faltaba era decirlo.
check('A, AA y ME dan las dos cifras del estreñimiento y dicen de dónde salen',
  /McElhanon 2014/.test(bC('A')) && /\*\*AA\*\*/.test(bC('A'))
  && /Wang 2022/.test(bC('AA')) && /McElhanon 2014\*\* estima/.test(bC('AA'))
  && /Wang 2022/.test(bC('ME')));
check('AA explica por qué difieren en vez de elegir una',
  /revisiones de épocas y criterios de inclusión distintos/.test(bC('AA'))
  && /48,7%/.test(bC('AA')));

// Las fichas se citan entre sí por código, y un código que no existe es un
// callejón: el lector busca «QO» y no hay nada. Ya pasó una vez, con un auditor
// que citó «la ficha QO (línea 8617)» como prueba de algo. Esto lo vigila.
// NI es el caso vivo: está terminada pero sin publicar a propósito, así que
// ninguna ficha publicada puede mandar a ella todavía.
const ESPANOL = new Set(['NO', 'SI']); // «**NO**» en negrita no es un código
const refsRotas = [];
for (const trozo of libC.split(/(?=^### )/m)) {
  const cod = (trozo.match(/^### ([A-Z]{1,2})\. /) || [])[1];
  if (!cod) continue;
  const cuerpo = trozo.split('> **Para la app')[0].replace(/\]\([^)]*\)/g, ']');
  const refs = new Set([...cuerpo.matchAll(/\*\*([A-Z]{1,2})\.\s/g)].map((m) => m[1])
    .concat([...cuerpo.matchAll(/\*\*([A-Z]{1,2})\*\*/g)].map((m) => m[1])));
  for (const r of refs) {
    if (ESPANOL.has(r)) continue;
    if (!codsLib.includes(r)) refsRotas.push(`${cod} → ${r}`);
  }
}
check('ninguna ficha remite a un código que no existe',
  refsRotas.length === 0, refsRotas.slice(0, 8).join(' | '));


await nav.close();
console.log('\n' + (errores.length
  ? '❌ ' + errores.length + ' problema(s):\n' + errores.join('\n')
  : '🎉 TODO CORRECTO'));
process.exit(errores.length ? 1 : 0);
