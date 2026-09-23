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
// Una nota que empieza por "=" la hoja de cálculo la lee como fórmula, y la
// celda que la familia lleva a la consulta acaba mostrando #NAME? en vez de lo
// que escribió. Se exporta como texto, sin tocar el dato.
await pagExp.fill('#interv', '+ sesión doble');
await pagExp.fill('#nota', '=llegó tarde y se durmió');
await pagExp.click('#f-track button[type="submit"]');
await pagExp.waitForTimeout(900);
const [descarga2] = await Promise.all([
  pagExp.waitForEvent('download'),
  pagExp.click('#export'),
]);
const csv2 = fs.readFileSync(await descarga2.path(), 'utf8');
check('Una nota que empieza por "=" o "+" no se exporta como fórmula',
  csv2.includes(`"'=llegó tarde y se durmió"`) && csv2.includes(`"'+ sesión doble"`),
  JSON.stringify(csv2.slice(-160)));
check('Y el resto de notas no se toca',
  csv2.includes('""comillas""') && !csv2.includes(`"'buen día`), JSON.stringify(csv2.slice(-260)));
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
const BLOQUEO = /[⏳⏸]|\bEN ESPERA\b|retenida|NO PUBLICABLE|no publicar hasta|\bpendiente de |\bpendiente:|bloquea la publicaci|bloquead|ve \*Pendiente editorial\*/i;
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

// El conversor avisaba en CADA build de que B y V no tenían "Mensaje clave", y
// el aviso llevaba rondas ignorado. No era cosmético: sin esa línea, la tarjeta
// que ve el padre en los resultados de búsqueda es la primera frase del cuerpo,
// y en B esa frase estaba escrita para quien construye la app ("Fichas nuevas
// para ampliar el Detector…"). Ahora las 433 tienen mensaje propio.
const TITULARES = /(\*\*Mensaje clave|\*\*Resumen|\*\*Encuadre obligatorio para la app)/;
const sinMensaje = [];
for (const trozo of libC.split(/(?=^### )/m)) {
  const cod = (trozo.match(/^### ([A-Z]{1,2})\. /) || [])[1];
  if (!cod) continue;
  if (!TITULARES.test(trozo.split('> **Para la app')[0])) sinMensaje.push(cod);
}
check('todas las fichas tienen un mensaje escrito para el lector',
  sinMensaje.length === 0, sinMensaje.join(' '));
// Y que ese mensaje no sea una instrucción interna.
const idxMsg = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const mensajesInternos = (idxMsg.temas || idxMsg).filter((t) =>
  /Fichas nuevas para ampliar|para la app\b|marcador de posición|en el Centro de evidencia y refuerza/i
    .test(t.mensaje || ''));
check('ninguna tarjeta muestra una instrucción para quien construye la app',
  mensajesInternos.length === 0, mensajesInternos.map((t) => t.codigo).join(' '));


// 39. Ronda 47: QX (lo que compras sin receta y choca con lo recetado), QY (el
// niño que lleva años con melatonina), QZ (pubertad precoz y tiroides) y RA
// (urología del chico, con la torsión testicular y su reloj de horas).
for (const [codigo, marca] of [['QX', /suplement|hierba|interacc|mezclar/i],
                               ['QY', /melatonina/i],
                               ['QZ', /pubertad|tiroides/i],
                               ['RA', /test[íi]culo|prepucio|orina/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 47: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re47] of [['le doy vitaminas', /vitamin|suplement|mezcl/i],
                         ['hierba de san juan', /hierba|interacc|medicaci/i],
                         ['lleva anos con melatonina', /melatonina/i],
                         ['dejar la melatonina', /melatonina/i],
                         ['le sale pecho', /pubertad|precoz|pecho/i],
                         ['tiroides', /tiroides|hipotiroid/i],
                         ['le duele un testiculo', /test[íi]culo|torsi[óo]n/i],
                         ['fimosis', /prepucio|fimosis/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 47: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re47.test(rr), rr.slice(0, 160));
}

const b47 = (cod) => {
  const i = libC.indexOf('### ' + cod + '. ');
  const j = libC.indexOf('\n### ', i + 6);
  return j === -1 ? libC.slice(i) : libC.slice(i, j);
};
const cuerpo47 = (cod) => b47(cod).replace(/> \*\*Para la app[\s\S]*/, '');

// RA es de reloj: la torsión se opera en horas y en un chico que comunica poco
// puede llegar sin una sola queja del testículo.
const ra47 = cuerpo47('RA');
check('RA pone la torsión testicular arriba y con su plazo',
  /torsi[óo]n/i.test(ra47) && /hora/i.test(ra47)
  && ra47.indexOf('🚨') >= 0 && ra47.indexOf('🚨') < ra47.search(/\n- /));
// Y lo mismo para las cuatro de la ronda: el bloque de urgencia va antes que
// cualquier punto de la lista, no enterrado entre ellos.
for (const cod of ['QX', 'QY', 'QZ', 'RA']) {
  const s = cuerpo47(cod);
  check(`${cod}: el bloque 🚨 va antes del primer punto de la lista`,
    s.indexOf('🚨') >= 0 && s.indexOf('🚨') < s.search(/\n- /), `🚨 en ${s.indexOf('🚨')}`);
}
check('RA avisa de que puede presentarse sin queja del testículo',
  /dolor de (barriga|tripa|abdom)/i.test(ra47) && /v[óo]mito/i.test(ra47));
check('RA prohíbe forzar la retracción del prepucio', /forzar|retraer/i.test(ra47) && /🔴/.test(ra47));

// QX no receta y su regla de oro es no tocar lo recetado.
const qx47 = cuerpo47('QX');
check('QX dice que la interacción se resuelve quitando lo de fuera, no lo recetado',
  /no se hace al leer esto/i.test(qx47) || /cambiando o separando \*\*lo de fuera\*\*/.test(qx47));

// QY es el uso prolongado, no «probar melatonina», y no da dosis.
const qy47 = cuerpo47('QY');
check('QY no da ninguna dosis de melatonina', !/\d+([.,]\d+)?\s?mg de melatonina/i.test(qy47));

// QZ tenía que decir cuándo dejar de aceptar «es por el autismo».
check('QZ nombra el análisis concreto que hay que pedir',
  /TSH/.test(cuerpo47('QZ')) && /T4/.test(cuerpo47('QZ')));

// Enlaces inversos.
check('LV, QA, BL, AJ, MM, KE, QP y MH mandan a QX',
  ['LV', 'QA', 'BL', 'AJ', 'MM', 'KE', 'QP', 'MH'].every((c) => /\*\*QX\. Le doy vitaminas/.test(b47(c))));
check('QK y W mandan a QY', ['QK', 'W'].every((c) => /\*\*QY\. Lleva dos años con melatonina/.test(b47(c))));
check('DA, QW, NS, ME, EF y CX mandan a QZ',
  ['DA', 'QW', 'NS', 'ME', 'EF', 'CX'].every((c) => /\*\*QZ\. Le está cambiando el cuerpo/.test(b47(c))));
check('JR, EQ, LD, AG, S e IO mandan a RA',
  ['JR', 'EQ', 'LD', 'AG', 'S', 'IO'].every((c) => /\*\*RA\. Le duele un testículo/.test(b47(c))));

// Dos correcciones que la ronda dejó señaladas en fichas ya publicadas.
check('QK ya no dice ser la única ficha con la advertencia de la melatonina',
  !/QK es la única ficha con la advertencia/.test(b47('QK')) && /QY/.test(b47('QK')));
check('la biblioteca llama igual al ensombrecimiento diagnóstico',
  /ensombrecimiento diagnóstico/.test(cuerpo47('CX')) && /ensombrecimiento diagnóstico/.test(cuerpo47('AL'))
  && /\*\*ME\*\*/.test(cuerpo47('AL')));

// Las cuatro van donde un padre las buscaría; QX cayó en terapias por la
// palabra «medicación» y es la hermana de LV.
const idx47 = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-indice.json', import.meta.url), 'utf8'));
const cat47 = (cod) => ((idx47.temas || idx47).find((t) => t.codigo === cod) || {}).categoria;
check('QX, QY, QZ y RA están en salud',
  ['QX', 'QY', 'QZ', 'RA'].every((c) => cat47(c) === 'salud'));
// Y el código de RA: su editor la encabezó como QX, que ya estaba tomada.
check('RA se publicó con su propio código y no con el de QX',
  /^### RA\. /m.test(libC) && (libC.match(/^### QX\. /gm) || []).length === 1);


// 40. El badge de evidencia de cada viñeta. `extraerNivel()` (web/app.js) se
// queda con el último marcador que encuentra recorriendo NIVELES, así que en
// una viñeta con varios gana el más severo de los presentes. Eso es lo correcto
// casi siempre, porque la biblioteca usa a propósito «🟢/🟡» para decir «sólida
// para esto, limitada para aquello» y conviene enseñar el conservador. Lo que
// NO puede pasar es que un marcador MENCIONADO de pasada dentro del texto
// decida el badge: en B, «(sobreafirmación 🔴)» hacía que una viñeta que dice
// que la ASI con objetivos concretos tiene evidencia limitada apareciera como
// «Desaconsejado», que es lo contrario de lo que el texto sostiene.
const cuerpoJSON = JSON.parse(fs.readFileSync(new URL('../../web/content/biblioteca-cuerpo.json', import.meta.url), 'utf8'));
const temasCuerpo = cuerpoJSON.temas || cuerpoJSON;
const MARCAS = ['🟢', '🟡', '🔴', '⚪'];
const nivelDe = (l) => { let n = null; for (const m of MARCAS) if (l.includes(m)) n = m; return n; };
const textoDe = (md) => (typeof md === 'string' ? md : (md.cuerpo || ''));
const ayres = textoDe(temasCuerpo.B).split('\n').find((l) => l.includes('Ayres'));
check('la viñeta de la integración sensorial de B no se pinta como «Desaconsejado»',
  !!ayres && nivelDe(ayres) === '🟡', ayres && ayres.slice(0, 90));

// Y que no crezca el número de viñetas con dos marcadores sin que nadie mire:
// las que hay son la convención «🟢/🟡» y desgloses por partes, no mezclas.
let dobles = 0;
for (const md of Object.values(temasCuerpo)) {
  for (const l of textoDe(md).split('\n')) {
    if (!l.startsWith('- ')) continue;
    if (MARCAS.filter((m) => l.includes(m)).length > 1) dobles++;
  }
}
check('las viñetas con más de un marcador siguen siendo las contadas', dobles <= 27, String(dobles));


// 41. Ayuda urgente, país por país. Es la pantalla donde una errata cuesta más
// caro: un número mal copiado, un horario inventado o un país que desaparece de
// la lista los ve alguien que está buscando ayuda a las tres de la mañana. La
// suite sólo miraba dos de los ocho países, así que aquí se comprueban todos,
// contra el JSON y contra lo que acaba pintado en la pantalla.
await ir('#ayuda');
const ayudaJSON = JSON.parse(fs.readFileSync(new URL('../../web/content/ayuda-urgente.json', import.meta.url), 'utf8'));
const tAyuda = await texto();
const PAISES_AYUDA = ['España', 'México', 'Argentina', 'Chile', 'Colombia', 'Perú',
  'Estados Unidos (en español)', 'Otros países'];
check('Ayuda urgente conserva los ocho países y en el mismo orden',
  ayudaJSON.paises.map((p) => p.pais).join(' | ') === PAISES_AYUDA.join(' | '),
  ayudaJSON.paises.map((p) => p.pais).join(' | '));

for (const p of ayudaJSON.paises) {
  check('Ayuda pinta ' + p.pais + ' con su número y su explicación',
    tAyuda.includes(p.pais) && tAyuda.includes(p.linea) && tAyuda.includes(p.descripcion.slice(0, 40)),
    p.linea);
}

// Los datos, antes de pintarlos: sin huecos donde importa y con fuente oficial.
check('Ayuda: ningún país se queda sin país, línea, descripción o fuente',
  ayudaJSON.paises.every((p) => p.pais && p.linea && p.descripcion && p.fuente),
  ayudaJSON.paises.filter((p) => !(p.pais && p.linea && p.descripcion && p.fuente)).map((p) => p.pais).join(','));
check('Ayuda: todas las fuentes van por https',
  !/"http:\/\//.test(JSON.stringify(ayudaJSON))
  && ayudaJSON.paises.every((p) => /^https:\/\//.test(p.fuente)
    && (!p.fuenteSecundaria || /^https:\/\//.test(p.fuenteSecundaria))));
check('Ayuda: la nota de mantenimiento sigue exigiendo comprobar número y horario',
  /nunca de oídas/.test(ayudaJSON._nota) && /HORARIO/.test(ayudaJSON._nota));

// El enlace de marcado. `tel()` (web/app.js) se queda con el primer número del
// texto, así que el número que encabeza cada línea es el que se marca.
const telsAyuda = await pag.$$eval('.pais a.tel', (as) => as.map((a) => a.getAttribute('href')));
check('Ayuda: los siete números marcables generan enlace tel: y el octavo bloque no',
  telsAyuda.length === 7, telsAyuda.join(' '));
check('Ayuda: ningún tel: arrastra espacios, paréntesis ni letras',
  telsAyuda.every((h) => /^tel:[0-9*+#]+$/.test(h)), telsAyuda.join(' '));
check('Ayuda: cada enlace marca el número de su país',
  telsAyuda.join(' ') === 'tel:024 tel:8009112000 tel:08009990091 tel:*4141 tel:192 tel:113 tel:988',
  telsAyuda.join(' '));

// Argentina: el 135 del Centro de Asistencia al Suicida atiende de 8 a 24 h, no
// las 24. La ficha lo anunciaba como «24 h», que es justo la hora a la que no
// contesta. Encabeza ahora la línea nacional del Ministerio de Salud, que sí lo
// es, y el horario real del CAS queda escrito.
const argAyuda = ayudaJSON.paises.find((p) => p.pais === 'Argentina');
check('Ayuda: Argentina encabeza con la línea nacional de 24 h, no con el 135',
  /0800\s*999\s*0091/.test(argAyuda.linea) && !/^135/.test(argAyuda.linea.trim()), argAyuda.linea);
const fraseCAS = argAyuda.descripcion.split(/(?<=\.)\s+/).find((f) => /Asistencia al Suicida/.test(f)) || '';
check('Ayuda: la frase del Centro de Asistencia al Suicida da su horario real',
  /de 8 a 24 h/.test(fraseCAS) && /no de madrugada/.test(fraseCAS) && /135/.test(fraseCAS), fraseCAS);
check('Ayuda: el horario del 135 llega a la pantalla, no sólo al JSON',
  /de 8 a 24 h/.test(tAyuda) && /no de madrugada/.test(tAyuda));

// Canales por escrito: media biblioteca trata de gente que no puede sostener
// una llamada. Donde el propio servicio ofrece chat o WhatsApp, se dice.
check('Ayuda explica por qué hay canales por escrito y para quién',
  /Por escrito/.test(tAyuda) && /personas autistas/.test(tAyuda));
const conEscrito = ayudaJSON.paises.filter((p) => p.escrito);
check('Ayuda: seis de los ocho bloques ofrecen ya un canal por escrito',
  conEscrito.length === 6, conEscrito.map((p) => p.pais).join(','));
for (const p of conEscrito) {
  check('Ayuda pinta el canal por escrito de ' + p.pais,
    tAyuda.includes(p.escrito.slice(0, 35)), p.escrito.slice(0, 60));
}
check('Ayuda: el 024 sale con su chat y con la videointerpretación en lengua de signos',
  /[Cc]hat en la web del 024/.test(tAyuda) && /linea024\.svisual\.org/.test(tAyuda));
check('Ayuda: Infosalud sale con sus dos números de WhatsApp y Telegram',
  /955 557 000/.test(tAyuda) && /952 842 623/.test(tAyuda));
check('Ayuda: el 988 sale con la palabra que hay que enviar y con el chat en español',
  /AYUDA al 988/.test(tAyuda) && /988lifeline\.org\/es/.test(tAyuda));
check('Ayuda: la Línea 106 sale con el WhatsApp de Bogotá y dicho que es de Bogotá',
  /300 754 8933/.test(tAyuda) && /En Bogotá/.test(tAyuda));
check('Ayuda: Chile y Argentina no inventan un canal por escrito que no existe',
  !ayudaJSON.paises.find((p) => p.pais === 'Chile').escrito && !argAyuda.escrito);
check('Ayuda: «qué puedes hacer» ofrece el camino por escrito a quien no puede llamar',
  ayudaJSON.queHacer.some((q) => /por escrito/.test(q)) && /atiende el mismo equipo/.test(tAyuda));

// Y lo que ya se comprobaba, que no se pierda: opciones de menú incluidas.
check('Ayuda: Perú conserva la opción 5 y Colombia la opción 4',
  /113 opción 5/.test(tAyuda) && /192 opción 4/.test(tAyuda));
check('Ayuda: los números de emergencias siguen a la vista',
  ['112', '911', '131 (SAMU)', '123', '106 (SAMU)'].every((n) => tAyuda.includes(n)));

// 42. Los teléfonos de crisis viven en tres archivos: la pantalla de ayuda
// (`ayuda-urgente.json`), la base que se le inyecta a la IA real
// (`shared/knowledge-base.json`) y la respuesta de crisis del asistente en modo
// demostración (`asistente-demo.json`). El error del 135 argentino estaba en los
// tres a la vez, porque nadie los comparaba. Aquí se comparan.
const kbCrisis = JSON.parse(fs.readFileSync(new URL('../../shared/knowledge-base.json', import.meta.url), 'utf8'));
const demoCrisis = JSON.parse(fs.readFileSync(new URL('../../web/content/asistente-demo.json', import.meta.url), 'utf8'));
const textoCrisis = (demoCrisis.respuestas.find((r) => r.disparadores.includes('suicid')) || {}).texto || '';
const clavePais = (n) => n.replace(' (en español)', '');

check('Crisis: la respuesta del asistente en demo sigue siendo la primera, por disparador de suicidio',
  demoCrisis.respuestas[0].disparadores.includes('suicid') && textoCrisis.length > 300);
check('Crisis: la base de la IA cubre los mismos países que la pantalla de ayuda',
  ayudaJSON.paises.map((p) => clavePais(p.pais)).every((n) => n in kbCrisis.lineas_de_crisis),
  Object.keys(kbCrisis.lineas_de_crisis).join(','));

// El número que marca la app es el que encabeza `linea`; los otros dos archivos
// tienen que dar ese mismo, no uno antiguo.
for (const pais of ayudaJSON.paises) {
  if (pais.pais === 'Otros países') continue;
  const clave = clavePais(pais.pais);
  const num = pais.linea.split(/\s+[(·]/)[0].trim();
  const emg = (pais.emergencias.match(/\d+/) || [''])[0];
  check('Crisis: los tres archivos dan el mismo número para ' + clave,
    kbCrisis.lineas_de_crisis[clave].includes(num) && textoCrisis.includes(num),
    num + ' | ' + kbCrisis.lineas_de_crisis[clave]);
  check('Crisis: los tres archivos dan las mismas emergencias para ' + clave,
    kbCrisis.lineas_de_crisis[clave].includes(emg) && textoCrisis.includes(emg), emg);
}

// Y la regla que se saltaron los tres: el Centro de Asistencia al Suicida no es
// de 24 h. Donde salgan sus números, tiene que salir su horario.
const trozosCrisis = [JSON.stringify(ayudaJSON), JSON.stringify(kbCrisis.lineas_de_crisis), textoCrisis];
check('Crisis: donde aparece el 0800 345 1435 se dice que no atiende de madrugada',
  trozosCrisis.every((t) => !t.includes('0800 345 1435') || /de 8 a 24 h/.test(t)));
check('Crisis: ningún archivo llama 24 h al Centro de Asistencia al Suicida',
  trozosCrisis.every((t) => !/Asistencia al Suicida[^.·]{0,80}24 h(?!, no)/.test(t)));
check('Crisis: la nota de la base de la IA manda comprobar también el horario',
  /HORARIO/.test(kbCrisis.lineas_de_crisis._nota) && /ayuda-urgente\.json/.test(kbCrisis.lineas_de_crisis._nota));
check('Crisis: la respuesta del asistente ofrece también un canal por escrito',
  /por escrito/.test(textoCrisis) && /AYUDA al 988/.test(textoCrisis) && /955 557 000/.test(textoCrisis));

// 43. Las fuentes del Detector tienen que sostener lo que dice la tarjeta. El
// fallo real que encontramos: la tarjeta del test de cabello citaba "AAP —
// Choosing Wisely" y enlazaba a aafp.org, que es otra sociedad (los médicos de
// familia, no los pediatras). Y la de los aceites esenciales citaba un reportaje
// sobre la FDA retirando una página de advertencia, que no dice nada de lo que
// la tarjeta afirma. Un enlace que no sostiene la afirmación es peor que ninguno:
// da la apariencia de estar comprobado.
const detJSON = JSON.parse(fs.readFileSync(new URL('../../web/content/banderas-rojas.json', import.meta.url), 'utf8'));
const eviJSON = JSON.parse(fs.readFileSync(new URL('../../web/content/evidencia.json', import.meta.url), 'utf8'));
const tarjetasEvi = eviJSON.secciones.flatMap((s2) => s2.items || s2.tarjetas || []);
check('Detector: ninguna tarjeta se queda sin fuente, y todas van por https',
  detJSON.casos.every((c) => c.fuentes.length >= 1 && c.fuentes.every((f) => /^https:\/\//.test(f.url) && f.label)),
  detJSON.casos.filter((c) => !c.fuentes.length).map((c) => c.id).join(','));
check('Detector: los identificadores no se repiten',
  new Set(detJSON.casos.map((c) => c.id)).size === detJSON.casos.length);
const aliasVistos = new Map();
for (const c of detJSON.casos) for (const a of c.alias) {
  const k = a.toLowerCase();
  if (!aliasVistos.has(k)) aliasVistos.set(k, []);
  aliasVistos.get(k).push(c.id);
}
const aliasChocan = [...aliasVistos].filter(([, ids]) => ids.length > 1);
check('Detector: ningún alias pertenece a dos tarjetas a la vez',
  aliasChocan.length === 0, aliasChocan.map(([a, ids]) => a + '→' + ids.join('/')).join(' · '));

// Quién firma la fuente tiene que coincidir con el dominio que la aloja.
const FIRMAS = [
  [/\bAAP\b|Academia Americana de Pediatr/i, ['aap.org', 'choosingwisely.org', 'healthychildren.org']],
  [/\bAAFP\b/i, ['aafp.org']],
  [/Cochrane/i, ['cochrane.org', 'cochranelibrary.com']],
  [/\bASHA\b/i, ['asha.org']],
  [/\bASAT\b/i, ['asatonline.org']],
  [/\bFDA\b/i, ['fda.gov', 'ecfr.gov', 'law.cornell.edu']],
  [/\bOMS\b|\bWHO\b/i, ['who.int']],
  [/Quackwatch/i, ['quackwatch.org']],
  [/\bNIMH\b/i, ['nimh.nih.gov']],
  [/ProPublica/i, ['propublica.org']],
  [/Poison Control/i, ['poison.org']],
  [/\bASA\b(?!T)|\bCAP\b/, ['asa.org.uk']],
  [/Child Neurology Society/i, ['childneurologysociety.org']],
  [/Anticancer Fund/i, ['anticancerfund.org']],
  [/Raising Children/i, ['raisingchildren.net.au']],
  [/\bCBS\b/i, ['cbsnews.com']],
];
const desajustes = [];
const fuentesJSON = JSON.parse(fs.readFileSync(new URL('../../web/content/fuentes.json', import.meta.url), 'utf8'));
const conFuentes = [
  ...detJSON.casos.map((c) => [c.id, c.fuentes]),
  ...tarjetasEvi.map((t) => ['evidencia/' + t.titulo, t.fuentes || []]),
  ...fuentesJSON.grupos.map((g) => ['fuentes/' + g.titulo, g.fuentes || []]),
];
// Los repositorios que alojan el trabajo de cualquiera —PubMed, PMC, doi.org—
// no dicen nada sobre quién firma, así que no se les aplica la regla: una
// revisión Cochrane leída en PMC sigue siendo de Cochrane. Lo que se caza es
// citar a un organismo y enlazar la web de OTRO organismo.
const REPOSITORIOS = ['pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'doi.org'];
for (const [quien, fuentes] of conFuentes) {
  for (const f of fuentes) {
    const host = new URL(f.url).hostname.replace(/^www\./, '');
    if (REPOSITORIOS.includes(host)) continue;
    for (const [firma, dominios] of FIRMAS) {
      if (!firma.test(f.label)) continue;
      if (!dominios.some((d) => host === d || host.endsWith('.' + d))) {
        desajustes.push(quien + ': «' + f.label + '» → ' + host);
      }
    }
  }
}
check('Detector y Centro de evidencia: quien firma cada fuente coincide con el dominio que la aloja',
  desajustes.length === 0, desajustes.join(' · '));
check('Centro de evidencia: ninguna tarjeta se queda sin fuente, y todas van por https',
  tarjetasEvi.every((t) => (t.fuentes || []).length >= 1
    && t.fuentes.every((f) => /^https:\/\//.test(f.url) && f.label)),
  tarjetasEvi.filter((t) => !(t.fuentes || []).length).map((t) => t.titulo).join(','));

// Y las cuatro tarjetas que se corrigieron, por si alguien las revierte.
const caso = (id) => detJSON.casos.find((c) => c.id === id);
check('Detector: el test de cabello cita a los pediatras, no a otra sociedad',
  /AAP/.test(caso('bioresonancia').fuentes[0].label)
  && caso('bioresonancia').fuentes[0].url.includes('choosingwisely.org'));
check('Detector: los aceites esenciales citan a quien documenta el envenenamiento',
  caso('aceites-esenciales').fuentes.some((f) => f.url.includes('poison.org'))
  && !caso('aceites-esenciales').fuentes.some((f) => f.url.includes('propublica')));
check('Detector: la terapia de luz ya no dice que falten controles, habiendo un ensayo simulado',
  !/sin los controles/.test(caso('terapia-luz-color').porque)
  && /grupo simulado/.test(caso('terapia-luz-color').porque)
  && /30 niños/.test(caso('terapia-luz-color').porque));
check('Detector: el ozono apoya su riesgo en la norma que lo define como gas tóxico',
  /gas tóxico/.test(caso('ozono').porque)
  && caso('ozono').fuentes.some((f) => f.url.includes('ecfr.gov')));

// 44. La comprobación 11 ata a la documentación las cifras de TEMAS. Faltaban
// las otras tres que ESTADO.md publica como estado actual —fuentes, tarjetas del
// Centro de evidencia y fichas del Detector—, y las tres estaban caducadas: la
// documentación decía 15 fichas cuando había 35, y 15 tarjetas en 4 secciones
// cuando eran 24 en 7. Aquí se atan a los JSON que las generan. Las cifras
// viejas dentro de una frase histórica («pasó de 15 a 35») son legítimas y no se
// tocan: lo que se comprueba es que la afirmación en presente sea la verdadera.
const estadoMd = fs.readFileSync(new URL('../../ESTADO.md', import.meta.url), 'utf8');
const nSecciones = eviJSON.secciones.length;
const nTarjetas = eviJSON.secciones.reduce((a, s2) => a + (s2.items || s2.tarjetas || []).length, 0);
const nEnlacesEvi = eviJSON.secciones.reduce(
  (a, s2) => a + (s2.items || s2.tarjetas || []).reduce((b, it) => b + (it.fuentes || []).length, 0), 0);
const milesEs = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

check('ESTADO.md da el número de fichas del Detector que hay hoy',
  estadoMd.includes(detJSON.casos.length + ' fichas'), detJSON.casos.length + ' fichas');
check('ESTADO.md da las tarjetas y secciones del Centro de evidencia que hay hoy',
  estadoMd.includes(nTarjetas + ' tarjetas en ' + nSecciones + ' secciones')
  && estadoMd.includes(nEnlacesEvi + ' enlaces a fuentes'),
  nTarjetas + '/' + nSecciones + '/' + nEnlacesEvi);
check('ESTADO.md da el total de fuentes que dice el índice',
  estadoMd.includes('(' + milesEs(idxJson.totalFuentes) + ' en total)'),
  milesEs(idxJson.totalFuentes));

// 45. Ronda 48: RB (dolor crónico y fatiga), RC (babeo), RD (pedir plaza) y RE
// (le retiran los apoyos porque aprueba). Las cuatro se abren con fuentes y se
// encuentran con las palabras que escribiría una familia, no con su código.
for (const [codigo, marca] of [['RB', /fibromialgia|fatiga/i], ['RC', /baba|sialorrea/i],
                               ['RD', /residencia|plaza/i], ['RE', /apoyos|notas/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 48: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re48] of [['se le cae la baba', /baba/i],
                         ['le duele todo', /duele todo|dolor crónico/i],
                         ['pedir plaza residencia', /residencia/i],
                         ['le han quitado el apoyo', /apoyos|notas/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 48: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re48.test(rr), rr.slice(0, 160));
}

// Lo que la ronda destapó en fichas ya publicadas, que es lo que de verdad
// conviene atar:
const libMd = fs.readFileSync(new URL('../../research/biblioteca-autismo.md', import.meta.url), 'utf8');
const fichaDe = (cod) => {
  const i = libMd.search(new RegExp('^### ' + cod + '\\. ', 'm'));
  if (i < 0) return '';
  const j = libMd.slice(i + 5).search(/^### /m);
  return j < 0 ? libMd.slice(i) : libMd.slice(i, i + 5 + j);
};

// (a) LW mandaba a «pedir cita (semanas, no urgencia)» ante la pérdida de
// habilidades ya adquiridas, que en BJ, DO, NU y NX es señal de valoración sin
// demora. Dos respuestas contrarias a la misma señal, y la peligrosa era la de LW.
const lw = fichaDe('LW');
const lineaSemanas = lw.split('\n').find((l) => /Cuándo pedir cita \(semanas/.test(l)) || '';
check('LW ya no mete la pérdida de habilidades en «semanas, no urgencia»',
  !!lineaSemanas && !/pierde habilidades/.test(lineaSemanas), lineaSemanas.slice(0, 180));
check('LW sí dice, aparte, que esa pérdida se valora sin demora',
  /pierde habilidades que ya tenía, eso no entra en «semanas»/.test(lw) && /catatonia/i.test(lw));

// (b) CM llamaba a la vivienda tutelada «apoyo 24 horas». El nombre no dice el
// nivel de apoyo: cambia por comunidad y por entidad, y eso es justo lo que una
// familia necesita saber antes de elegir.
const cm = fichaDe('CM');
check('CM ya no vende la vivienda tutelada como apoyo 24 horas',
  !/vivienda tutelada con apoyo 24 horas/.test(cm) && /qué personal hay por la noche/.test(cm));

// (c) La reforma de la Ley 39/2006 se aprobó el 16/09/2026 pero no está en el
// BOE: RD, NB y PH tienen que decir lo mismo, o la biblioteca publica tres
// respuestas distintas a «¿puedo cobrar esto y tener además el servicio?».
for (const cod of ['RD', 'NB', 'PH']) {
  const f = fichaDe(cod);
  check(`${cod} fecha la reforma de dependencia y dice que aún no está en vigor`,
    /16 de septiembre de 2026/.test(f) && /no est[áa] publicada en el BOE|todavía no está publicada en el BOE/.test(f),
    cod);
}
check('RD dice expresamente que no hay contradicción, sino una regla vigente y otra que viene',
  /no hay contradicción entre las tres fichas/.test(fichaDe('RD')));

// (d) Referencias inversas: una ficha a la que no apunta nadie no existe para
// quien no la busca por su nombre.
for (const [origen, destino] of [['AP', 'RB'], ['AN', 'RB'], ['CY', 'RB'],
                                 ['NJ', 'RC'], ['LG', 'RC'], ['KF', 'RC'], ['QG', 'RC'],
                                 ['CM', 'RD'], ['NB', 'RD'], ['PH', 'RD'],
                                 ['LW', 'RE'], ['BZ', 'RE'], ['IA', 'RE']]) {
  check(`${origen} apunta ya a ${destino}`, new RegExp('\\*\\*' + destino + '\\.').test(fichaDe(origen)));
}
check('AP avisa de que con malestar posesfuerzo no se aplica el aumento progresivo',
  /malestar posesfuerzo/.test(fichaDe('AP')) && /no se aplica/.test(fichaDe('AP')));

// 46. La sirena y la píldora de evidencia no pueden convivir. La biblioteca lo
// dice en su propia leyenda —"los bloques 🚨 no llevan color: ante esas señales
// se actúa igual"—, pero 64 de las 153 viñetas de urgencia traían además un
// marcador de color, así que la app pintaba "Evidencia limitada" al lado de un
// atragantamiento, de una anafilaxia o de un síndrome neuroléptico maligno. Un
// badge de calidad de prueba junto a una urgencia se lee como "esto puede
// esperar", que es lo contrario de lo que dice el texto.
const MARCAS_NIVEL = ['🟢', '🟡', '🔴', '⚪'];
const vinetasDe = (md) => textoDe(md).split('\n').filter((l) => l.trim().startsWith('- '));
let urgentesConColor = 0, urgentesTotal = 0;
for (const md of Object.values(temasCuerpo)) {
  for (const l of vinetasDe(md)) {
    if (!l.includes('🚨')) continue;
    urgentesTotal++;
    if (MARCAS_NIVEL.some((m) => l.includes(m))) urgentesConColor++;
  }
}
check('La biblioteca sigue teniendo viñetas de urgencia con marcador de color',
  urgentesConColor > 0 && urgentesTotal > urgentesConColor,
  urgentesConColor + ' de ' + urgentesTotal);

// La sirena solo manda cuando ENCABEZA la viñeta. Hay cinco viñetas que la
// nombran por dentro para remitir a otro bloque ("eso es el cuarto bloque 🚨"):
// esas no son urgencias, son referencias cruzadas, y conservan su nivel.
const remiten = [];
for (const [cod, md] of Object.entries(temasCuerpo)) {
  for (const l of vinetasDe(md)) {
    const i = l.indexOf('🚨');
    if (i > 12) remiten.push(cod);
  }
}
check('Las viñetas que solo remiten a otro bloque de urgencia siguen siendo pocas y conocidas',
  remiten.length <= 8, remiten.join(','));
await ir('#tema/QB');
const qbUrg = await pag.$$eval('.tema-cuerpo .punto.urgente', (ns) => ns.length);
const qbRef = await pag.$$eval('.tema-cuerpo .punto',
  (ns) => ns.filter((n) => !n.classList.contains('urgente') && n.textContent.includes('bloque 🚨')).length);
check('QB: la viñeta que solo cita "el bloque 🚨" no se pinta como urgencia',
  qbRef >= 1, qbUrg + ' urgentes, ' + qbRef + ' remisiones);');

// Y la otra mitad de la regla que la biblioteca repite ficha tras ficha ("el
// bloque 🚨 va arriba, siempre visible, nunca plegado"): la app pinta en el
// orden del documento, así que "arriba" se decide en el markdown. LQ tenía su
// única urgencia —que en una urgencia vital la atención médica no espera a
// ningún trámite judicial, y que hay que actuar hoy si alguien está haciendo
// firmar créditos a tu hijo— en la viñeta 9 de 13, detrás de nueve párrafos
// sobre el artículo 12 de la Convención de la ONU.
const urgenciaTardia = [];
for (const [cod, md] of Object.entries(temasCuerpo)) {
  const v = vinetasDe(md).map((l) => l.trim());
  const idx = v.map((l, i) => (l.includes('🚨') && l.indexOf('🚨') <= 12 ? i : -1)).filter((i) => i >= 0);
  if (idx.length && Math.min(...idx) > 0) urgenciaTardia.push(cod + ':' + Math.min(...idx) + '/' + v.length);
}
check('Toda ficha con bloque de urgencia lo pone en su primera viñeta',
  urgenciaTardia.length === 0, urgenciaTardia.join(' · '));
await ir('#tema/LQ');
const primeraLQ = await pag.$$eval('.tema-cuerpo .punto', (ns) => ns[0].className);
check('LQ abre ya con su urgencia, no con el artículo 12 de la Convención',
  /urgente/.test(primeraLQ), primeraLQ);

// Y el teléfono, donde hace falta. RB abre con cinco bloques de urgencia —una de
// ellas quirúrgica, con reloj— y el único acceso a la pantalla de teléfonos
// estaba al final de la ficha, detrás de 26 viñetas y de la lista de fuentes.
// Ahora el enlace se cuela justo detrás del bloque de urgencia que abre.
for (const cod of ['RB', 'LQ', 'NM']) {
  await ir('#tema/' + cod);
  const orden = await pag.$$eval('.tema-cuerpo > *',
    (ns) => ns.map((n) => (n.classList.contains('cta-ayuda') ? 'CTA'
      : n.classList.contains('urgente') ? 'U'
      : n.classList.contains('punto') ? 'p' : '·')).join(''));
  check(`${cod}: el enlace a los teléfonos va pegado al bloque de urgencia`,
    /U+CTA/.test(orden) && orden.indexOf('CTA') === orden.lastIndexOf('CTA'), orden.slice(0, 60));
}
// Una ficha sin bloque de urgencia no lo lleva: el aviso vale porque es raro.
await ir('#tema/BZ');
const ctaBZ = await pag.$$eval('.tema-cuerpo .cta-ayuda', (ns) => ns.length);
check('Una ficha sin urgencias no se llena de avisos que no vienen a cuento', ctaBZ === 0, String(ctaBZ));

// 47. La cuarta copia de los teléfonos: 58 fichas de la biblioteca escriben el
// número de emergencias dentro del texto ("112 en España, 911 en México y en
// buena parte de América"). Están bien hoy, y la forma de que sigan estándolo
// es atarlas a la pantalla de ayuda, que es la fuente.
const PERMITIDOS = {};
for (const pais of ayudaJSON.paises) {
  const clave = clavePais(pais.pais);
  const nums = new Set();
  for (const m of (pais.emergencias + ' ' + pais.linea).matchAll(/\d{3,}/g)) nums.add(m[0]);
  PERMITIDOS[clave] = nums;
}
PERMITIDOS['la Unión Europea'] = new Set(['112']);
PERMITIDOS['la UE'] = new Set(['112']);
PERMITIDOS['EE. UU.'] = PERMITIDOS['Estados Unidos'];
const sinLimpiar = libMd.replace(/\*\*/g, '');
const numeroMal = [];
const PAISES_RE = /(\d{3})\s+en\s+(España|la Unión Europea|la UE|México|Argentina|Chile|Colombia|Perú|Estados Unidos|EE\. UU\.)/g;
for (const m of sinLimpiar.matchAll(PAISES_RE)) {
  const permitidos = PERMITIDOS[m[2]];
  if (permitidos && !permitidos.has(m[1])) numeroMal.push(m[0]);
}
check('Los números de emergencias escritos dentro de las fichas coinciden con la pantalla de ayuda',
  numeroMal.length === 0, [...new Set(numeroMal)].join(' · '));
check('Y el 131 de Chile, que la biblioteca escribe con otra forma, también',
  !/1(?!31)\d\d\s+para la ambulancia en Chile/.test(sinLimpiar)
  && /131 para la ambulancia en Chile/.test(sinLimpiar));

// LG las tiene de las dos clases: el atragantamiento en curso (🚨 + 🟢) y
// viñetas normales con su nivel.
await ir('#tema/LG');
const urgLG = await pag.$$eval('.tema-cuerpo .punto.urgente',
  (ns) => ns.map((n) => ({ t: n.textContent.slice(0, 50), b: n.querySelectorAll('.badge').length })));
const puntosLG = await pag.$$eval('.tema-cuerpo .punto',
  (ns) => ns.filter((n) => !n.classList.contains('urgente')).map((n) => n.querySelectorAll('.badge').length));
check('Las viñetas de urgencia se pintan como urgencia, no como una viñeta más',
  urgLG.length >= 2, JSON.stringify(urgLG).slice(0, 200));
check('Ninguna viñeta de urgencia lleva píldora de nivel de evidencia',
  urgLG.every((u) => u.b === 0), JSON.stringify(urgLG).slice(0, 200));
check('Las viñetas normales sí conservan su píldora',
  puntosLG.filter((n) => n > 0).length >= 3, puntosLG.join(','));
const tLG = await texto();
check('La sirena sigue viéndose en el texto de la viñeta', tLG.includes('🚨'));

// Y en una ficha donde la urgencia es de medicación, por si el estilo se pierde.
await ir('#tema/NM');
const urgNM = await pag.$$eval('.tema-cuerpo .punto.urgente', (ns) => ns.length);
const badgesNM = await pag.$$eval('.tema-cuerpo .punto.urgente .badge', (ns) => ns.length);
check('NM también pinta sus urgencias como urgencias y sin píldora',
  urgNM >= 2 && badgesNM === 0, urgNM + ' urgentes, ' + badgesNM + ' badges');

// 48. Contraste, medido en el navegador y en los dos esquemas. El pase de
// accesibilidad del proyecto se hizo a mano y no dejó prueba, así que el estilo
// de urgencia que se acaba de añadir se coló con un enlace de 2,8:1 en modo
// oscuro: --ev-evitar es un coral claro ahí, y el texto blanco encima no se
// leía. Ahora hay un token propio para el texto que va ENCIMA del relleno, y
// esta comprobación lo vigila en los dos modos.
const mideContraste = (sel) => pag.evaluate((s2) => {
  const el = document.querySelector(s2);
  if (!el) return null;
  const nums = (c) => c.match(/[\d.]+/g).map(Number);
  const lum = (c) => {
    const [r, g, b] = nums(c).slice(0, 3).map((v) => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // Los fondos con alfa se componen sobre lo que tienen debajo: medir
  // rgba(192,42,27,0.1) como rojo sólido da un contraste falso.
  const capas = [];
  let n = el;
  while (n) {
    const [r, g, b, a = 1] = nums(getComputedStyle(n).backgroundColor);
    if (a > 0) { capas.push([r, g, b, a]); if (a === 1) break; }
    n = n.parentElement;
  }
  capas.push([255, 255, 255, 1]);
  let [R, G, B] = capas[capas.length - 1];
  for (let i = capas.length - 2; i >= 0; i--) {
    const [r, g, b, a] = capas[i];
    R = r * a + R * (1 - a); G = g * a + G * (1 - a); B = b * a + B * (1 - a);
  }
  const a1 = lum(getComputedStyle(el).color), b1 = lum(`rgb(${R},${G},${B})`);
  return Math.round(((Math.max(a1, b1) + 0.05) / (Math.min(a1, b1) + 0.05)) * 100) / 100;
}, sel);

for (const esquema of ['light', 'dark']) {
  await pag.emulateMedia({ colorScheme: esquema });
  await ir('#tema/RB');
  for (const [sel, nombre, minimo] of [
    ['.tema-cuerpo .punto.urgente p', 'el texto de una viñeta de urgencia', 4.5],
    ['.tema-cuerpo .cta-ayuda span', 'el enlace a los teléfonos de ayuda', 4.5],
    ['.tema-cuerpo .punto:not(.urgente) p', 'el texto de una viñeta normal', 4.5],
  ]) {
    const r = await mideContraste(sel);
    check(`Contraste (${esquema}): ${nombre} llega a ${minimo}:1`, r !== null && r >= minimo, String(r));
  }
  await ir('#ayuda');
  for (const [sel, nombre, minimo] of [
    ['.pais .tel', 'el número de teléfono de ayuda', 4.5],
    ['.pais .desc', 'la descripción de la línea', 4.5],
    ['.pais .escrito', 'el canal por escrito', 4.5],
  ]) {
    const r = await mideContraste(sel);
    check(`Contraste (${esquema}): ${nombre} llega a ${minimo}:1`, r !== null && r >= minimo, String(r));
  }
}
await pag.emulateMedia({ colorScheme: 'light' });

// 49. Ronda 49: RF (un servicio privado lo rechaza), RG (no puede llamar por
// teléfono), RH (dónde cambiarlo fuera de casa) y RI (enseñarle a ocupar su
// tiempo).
for (const [codigo, marca] of [['RF', /campamento|academia|gimnasio/i], ['RG', /teléfono|llamar/i],
                               ['RH', /pañal|cambiador/i], ['RI', /tablet|tiempo/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 49: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re49] of [['no puede llamar por telefono', /teléfono/i],
                         ['sigue con panal', /pañal|cambiador/i],
                         ['no sabe jugar solo', /tablet|tiempo|solo/i],
                         ['no pueden con el', /campamento|academia|gimnasio/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 49: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re49.test(rr), rr.slice(0, 160));
}

// Lo que la ronda destapó, que otra vez estaba en fichas ya publicadas:
// (a) FW resumía la Ley 1618 de Colombia como un deber de las entidades
// PÚBLICAS. Su artículo 14 pone el deber de diseñar, implementar y financiar
// los ajustes razonables sobre las entidades públicas Y PRIVADAS encargadas de
// prestar servicios públicos. Ni una lectura ni la otra: la letra exacta, con
// el matiz de que "servicio público" no es "negocio abierto al público".
const fw = fichaDe('FW');
check('FW ya no deja la Ley 1618 en un deber solo de las entidades públicas',
  /públicas y privadas/.test(fw) && /artículo 14/.test(fw) && /servicios públicos/.test(fw));
check('Y RF y FW cuentan la misma ley con la misma letra',
  /artículo 14/.test(fichaDe('RF')) && /servicio público/.test(fichaDe('RF')));

// (b) EZ publicaba "más de 350 adultos autistas (muestra de ~500)" del estudio
// de Doherty (BMJ Open 2022), que son 507 autistas y 157 no autistas; y decía
// "no haber buscado atención" donde el estudio dice no haber podido acceder.
const ez = fichaDe('EZ');
check('EZ da ya el denominador real del estudio de Doherty',
  /507 adultos autistas y 157 no autistas/.test(ez) && !/más de 350 adultos autistas/.test(ez));
check('EZ dice "no pudo acceder", que es lo que midió el estudio',
  /no pudo acceder/.test(ez) && /potencialmente mortal/.test(ez));

// (c) Referencias inversas de la ronda.
for (const [origen, destino] of [['GV', 'RF'], ['PW', 'RF'], ['PY', 'RG'], ['EZ', 'RG'],
                                 ['EQ', 'RH'], ['NP', 'RH'], ['MJ', 'RI'], ['DH', 'RI']]) {
  check(`${origen} apunta ya a ${destino}`, new RegExp('\\*\\*' + destino + '\\.').test(fichaDe(origen)));
}

// 50. La píldora roja tiene que decir lo mismo que la viñeta. El caso de B (la
// integración sensorial pintada como «Desaconsejado» por un 🔴 mencionado de
// pasada) no era único: hay 31 viñetas que matizan el marcador entre paréntesis
// —"🔴 (mito a evitar)", "🔴 (mal uso)"— y casi todas están bien, porque lo que
// la viñeta sostiene ES el mito o la mala práctica. Dos no lo estaban:
// EC abría con "el principio que sí conviene rescatar… reducen la ansiedad y
// facilitan el aprendizaje" y salía con un badge rojo encima; DD abría diciendo
// que las miradas de desconocidos no juzgan a la familia, y también.
const ec = fichaDe('EC'), dd = fichaDe('DD');
check('EC separa el principio que sirve del programa del que hay que desconfiar',
  /individualización[^\n]*🟡/.test(ec) && /Desconfía del programa que se vende como solución única[^\n]*🔴/.test(ec));
check('DD separa "las miradas no juzgan" de lo que no se hace',
  /miradas o comentarios de desconocidos[^\n]*⚪/.test(dd) && /Lo que no se hace delante de esas miradas[^\n]*🔴/.test(dd));

// Y la regla general, por si vuelve a colarse: una viñeta marcada 🔴 tiene que
// sostener algo que NO hay que hacer o creer, no una recomendación.
const ROJO_OK = /\bno\b|nunca|evita|desaconsej|peligros|da[ñn]|prohib|mito|desconf[ií]|cuidado|falso|falsa|riesgo|presi[oó]n injusta|mala pr[aá]ctica/i;
const rojasRaras = [];
for (const [cod, md] of Object.entries(temasCuerpo)) {
  for (const l of vinetasDe(md)) {
    const t = l.trim();
    if (!t.includes('🔴') || t.indexOf('🚨') <= 12 && t.includes('🚨')) continue;
    if (!ROJO_OK.test(t)) rojasRaras.push(cod);
  }
}
check('Toda viñeta «Desaconsejado» habla de algo que no hay que hacer o creer',
  rojasRaras.length <= 12, [...new Set(rojasRaras)].join(','));

// 51. La etiqueta de ⚪. La biblioteca lo explica en su leyenda, doce veces:
// "⚪ marca lo que proponemos nosotros sin estudio detrás". La app lo pintaba
// como "Experiencia vivida", que en autismo significa otra cosa —el testimonio
// de personas autistas y de sus familias, que es una categoría de evidencia
// reconocida y reivindicada—. Son 369 viñetas presentadas con un peso que no
// tienen.
const leyendasBlanco = [...libMd.matchAll(/⚪ marca ([^.]{5,160})\./g)].map((m) => m[1]);
check('La biblioteca sigue explicando ⚪ como criterio propio sin estudio detrás',
  leyendasBlanco.length >= 10
  && leyendasBlanco.filter((t) => /proponemos nosotros|no tiene ningún estudio/.test(t)).length
     >= leyendasBlanco.length - 1,
  leyendasBlanco.slice(0, 2).join(' | '));
await ir('#tema/DD');
const badges = await pag.$$eval('.tema-cuerpo .badge', (ns) => [...new Set(ns.map((n) => n.textContent))]);
check('La app no llama "Experiencia vivida" a lo que la biblioteca llama criterio propio',
  !badges.includes('Experiencia vivida') && badges.some((b) => /Criterio nuestro/.test(b)),
  badges.join(' · '));
const swift = fs.readFileSync(new URL('../../ios/BrujulaTEA/Modelos/Modelos.swift', import.meta.url), 'utf8');
check('Y el target de iOS dice lo mismo que la web',
  !/Experiencia vivida/.test(swift) && /Criterio nuestro, sin estudios/.test(swift));

// 52. La clave de colores. Las cuatro píldoras llevaban desde siempre sin
// explicación en ninguna pantalla: solo 53 de las 445 fichas traen dentro la
// línea de leyenda, y en las otras 392 el lector veía "Evidencia limitada" o
// "Criterio nuestro, sin estudios" sin saber a qué se refiere —ni, sobre todo,
// que el color habla de la prueba y no de la prisa, que es la confusión que más
// daño hace al lado de un bloque de urgencia.
await ir('#tema/RB');
const leyenda = await pag.$$eval('details.leyenda', (ns) => ns.map((n) => ({
  resumen: n.querySelector('summary')?.textContent || '',
  claves: [...n.querySelectorAll('.badge')].map((b) => b.textContent),
  texto: n.querySelector('p')?.textContent || '',
})));
check('La ficha trae una clave de colores', leyenda.length === 1, JSON.stringify(leyenda).slice(0, 200));
check('La clave dice que el color es evidencia y no prisa',
  /no cuánta prisa corre/.test(leyenda[0]?.texto || '') && /urgencia no llevan color/.test(leyenda[0]?.texto || ''),
  (leyenda[0]?.texto || '').slice(0, 120));
check('La clave solo lista los niveles que esa ficha usa',
  (leyenda[0]?.claves || []).length >= 2 && (leyenda[0]?.claves || []).length <= 4,
  (leyenda[0]?.claves || []).join(' · '));
// Y va plegada, para no empujar hacia abajo el bloque de urgencia.
const ordenRB = await pag.$$eval('#view > *', (ns) => ns.map((n) => n.tagName + (n.className ? '.' + String(n.className).split(' ')[0] : '')).join(' '));
check('La clave va antes del cuerpo y plegada, sin empujar la urgencia fuera de pantalla',
  /DETAILS\.leyenda ARTICLE\.tema-cuerpo/.test(ordenRB)
  && (await pag.$$eval('details.leyenda', (ns) => ns.every((n) => !n.open))), ordenRB.slice(0, 120));

// 53. La misma fuente citada de dos maneras. 3.822 URLs distintas sostienen la
// biblioteca y 279 aparecen con más de una etiqueta, lo cual es normal: la
// redacción cambia según la ficha. Lo que no es normal es que cambien el AÑO o
// el PRIMER AUTOR, porque entonces una de las dos citas está mal y el lector no
// tiene forma de saber cuál.
const etiquetasPorUrl = new Map();
for (const m of libMd.matchAll(/\[([^\]]{3,200})\]\((https?:\/\/[^\s)]+)\)/g)) {
  if (!etiquetasPorUrl.has(m[2])) etiquetasPorUrl.set(m[2], new Set());
  etiquetasPorUrl.get(m[2]).add(m[1].trim());
}
// Casos ya mirados y que NO son un error: el año de vigilancia frente al de
// publicación (CDC ADDM 2022 publicado en MMWR 2025; cohorte PECARN 2016-2021
// publicada en 2025), el número de una ley que parece un año (Ley 1996 de 2019
// de Colombia) y una ley que cita la que modifica (Ley 6/2022 sobre el RDL
// 1/2013).
const AÑOS_OK = new Set([
  'https://www.cdc.gov/mmwr/volumes/74/ss/ss7402a1.htm',
  'https://pubmed.ncbi.nlm.nih.gov/41330306/',
  'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=99712',
  'https://www.boe.es/buscar/doc.php?id=BOE-A-2022-5140',
  'https://www.aemps.gob.es/medicamentosUsoHumano/informesPublicos/docs/2025/IPT-400-Slenyto-melatonina.pdf',
]);
// Los dos que quedaban pendientes se comprobaron en fuente el 23/09 y eran
// errores de verdad, así que ya no están aquí: se corrigió la etiqueta.
//   PMC6590432 -> Schoen et al. 2019 (Autism Research 12:6-19; el epub de
//     diciembre de 2018 es de donde salía el "2018").
//   s10803-020-04844-2 -> Hume et al. 2021. Steinbrenner et al. 2020 es el
//     INFORME del NCAEP, que es otro documento; la ficha que lo citaba así ya
//     enlazaba el informe aparte en PDF, o sea que lo citaba dos veces y al
//     artículo ninguna.
const añosEnConflicto = [];
for (const [url, etiquetas] of etiquetasPorUrl) {
  if (etiquetas.size < 2 || AÑOS_OK.has(url)) continue;
  const años = new Set();
  for (const e of etiquetas) for (const a of e.matchAll(/\b(?:19|20)\d{2}\b/g)) años.add(a[0]);
  if (años.size > 1) añosEnConflicto.push(url + ' → ' + [...años].join('/'));
}
check('Ninguna fuente nueva se cita con dos años distintos',
  añosEnConflicto.length === 0, añosEnConflicto.slice(0, 4).join(' · '));
check('Y los casos conocidos siguen siendo los mismos, no han crecido',
  AÑOS_OK.size === 5, String(AÑOS_OK.size));

// 54. Las referencias cruzadas. La biblioteca se sostiene sobre 1.496 remisiones
// del tipo "ve **DO. Catatonia en el autismo**", y una que apunte a un código
// que no existe manda a una familia a una pantalla de error justo cuando está
// siguiendo un rastro de urgencia. Hoy no hay ninguna: esto es para que siga así.
const codigosReales = new Set([...libMd.matchAll(/^### ([A-Z]{1,2})\. /gm)].map((m) => m[1]));
const remisiones = [...libMd.matchAll(/\*\*([A-Z]{1,2})\.\s*([^*]{4,160}?)\*\*/g)];
const rotas = [...new Set(remisiones.map((m) => m[1]).filter((c) => !codigosReales.has(c)))];
check('Ninguna remisión apunta a una ficha que no existe',
  rotas.length === 0, rotas.join(','));
check('Y hay remisiones de sobra: la biblioteca está cosida, no es una lista suelta',
  remisiones.length > 1200 && codigosReales.size > 400,
  remisiones.length + ' remisiones entre ' + codigosReales.size + ' fichas');
// Las mismas, pero abriendo de verdad las diez más citadas en la app.
const masCitadas = [...remisiones.reduce((m, r) => m.set(r[1], (m.get(r[1]) || 0) + 1), new Map())]
  .sort((a, b) => b[1] - a[1]).slice(0, 10).map((x) => x[0]);
for (const cod of masCitadas) {
  await ir('#tema/' + cod);
  const tx = await texto();
  check(`La ficha más citada ${cod} abre de verdad`, !/No encuentro ese tema/.test(tx) && tx.length > 400,
    tx.slice(0, 80));
}

// 55. Lo que de verdad tiene que estar sin conexión. El service worker ya se
// comprobaba a fondo —versión, 404, stale-while-revalidate—, pero nadie miraba
// si lo que promete precachear acaba en la caché. El archivo que no puede
// faltar es `ayuda-urgente.json`: una parte del público al que sirve esta app
// vive donde los datos móviles se acaban, y los teléfonos de emergencia son
// justo lo que no se puede dejar para cuando haya cobertura.
await ir('#ayuda');
const enCache = await pag.evaluate(async (rutas) => {
  const out = {};
  for (const r of rutas) {
    const url = new URL(r, location.href).href;
    out[r] = !!(await caches.match(url));
  }
  return out;
}, ['content/ayuda-urgente.json', 'index.html', 'styles.css', 'app.js',
    'content/banderas-rojas.json', 'content/evidencia.json', 'content/biblioteca-indice.json']);
check('Los teléfonos de ayuda están precacheados: funcionan sin conexión',
  enCache['content/ayuda-urgente.json'] === true, JSON.stringify(enCache));
check('Y con ellos el resto del armazón de la app',
  Object.values(enCache).every(Boolean), JSON.stringify(enCache));
// Y que la lista del sw no se quede atrás respecto de lo que la app pide.
check('sw.js sigue declarando en ASSETS los teléfonos de ayuda',
  /\.\/content\/ayuda-urgente\.json/.test(swSrc));

// 56. Ronda 50: RJ (grado bajo y sin empleo), RK (el adulto que dice que no) y
// RL (acoso o despido por discapacidad). La cuarta, RM (lectura fácil), no se
// publica: al depurarla se quedó en un resumen de IH, IQ, KZ, JA y GO, que ya
// publican lo mismo. El borrador y lo que le falta están en research/pendientes/RM.md.
for (const [codigo, marca] of [['RJ', /grado|baremo|empleo/i], ['RK', /certificado|adulto/i],
                               ['RL', /despido|acoso/i]]) {
  await ir('#tema/' + codigo);
  const tx = await texto();
  check(`Ronda 50: el tema ${codigo} se abre con contenido y fuentes`,
    marca.test(tx) && tx.length > 600 && /Fuentes · \d+/.test(tx), tx.slice(0, 140));
}
for (const [q, re50] of [['le han dado un grado bajo', /grado|baremo/i],
                         ['no quiere el certificado', /certificado/i],
                         ['lo han despedido por su discapacidad', /despido|despedid/i]]) {
  const rr = await buscarHondo(q);
  check(`Ronda 50: «${q}» encuentra su tema`, !/Sin resultados/i.test(rr) && re50.test(rr), rr.slice(0, 160));
}
await ir('#tema/RM');
check('RM no está en la app: se quedó en un resumen de cinco fichas que ya existen',
  /No encuentro ese tema/.test(await texto()));

// NA (el despido de quien cuida) llevaba publicado "no hemos verificado ningún
// plazo en ningún país". Con RL verificados los de España, México y Chile, esa
// frase ya no era cierta: la ronda la corrigió y acotó lo que sigue sin saberse.
const na = fichaDe('NA');
check('NA da ya los plazos de despido que RL verificó, en vez de decir que no hay ninguno',
  /20 días hábiles/.test(na) && /art\. 518/.test(na) && /489 del Código del Trabajo/.test(na)
  && !/ni ningún plazo en días para impugnar un despido o una sanción laboral en ningún país/.test(na));
check('Y NA manda a RL para el detalle', /\*\*RL\./.test(na));

for (const [origen, destino] of [['LP', 'RJ'], ['MX', 'RJ'], ['LQ', 'RK'], ['LB', 'RK'],
                                 ['QU', 'RK'], ['JX', 'RL'], ['T', 'RL']]) {
  check(`${origen} apunta ya a ${destino}`, new RegExp('\\*\\*' + destino + '\\.').test(fichaDe(origen)));
}

// 57. Viñetas gemelas. Un hecho mantenido en dos sitios se desincroniza, y eso
// es literalmente lo que produjo las contradicciones de las rondas 48 a 50: LW
// contra BJ sobre la pérdida de habilidades, EZ contra RG sobre el estudio de
// Doherty, FW contra RF sobre la Ley 1618, NA contra RL sobre los plazos de
// despido. `scripts/pruebas/vinetas-gemelas.py` busca los pares casi idénticos;
// aquí se fija el techo para que no crezcan sin que nadie mire.
const PALABRAS_MIN = 12;
const CONVENCION = /los colores indican|el color dice|marca lo que proponemos|no cuánta prisa corre|aviso de alcance|transparencia:/i;
const limpia = (t) => t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#]/g, ' ')
  .toLowerCase().replace(/[^0-9a-záéíóúüñ ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
const todas = [];
for (const [cod, md] of Object.entries(temasCuerpo)) {
  for (const l of vinetasDe(md)) {
    if (CONVENCION.test(l)) continue;
    const ps = new Set(limpia(l));
    if (ps.size >= PALABRAS_MIN) todas.push([cod, ps]);
  }
}
let gemelas = 0;
const frecuencia = new Map();
for (const [, ps] of todas) for (const p of ps) frecuencia.set(p, (frecuencia.get(p) || 0) + 1);
const indice = new Map();
todas.forEach(([, ps], i) => {
  const raras = [...ps].filter((p) => (frecuencia.get(p) || 0) <= 40).slice(0, 14);
  for (const p of raras) { if (!indice.has(p)) indice.set(p, []); indice.get(p).push(i); }
});
const paresVistos = new Set();
for (const lista of indice.values()) {
  for (let a = 0; a < lista.length; a++) for (let b = a + 1; b < lista.length; b++) {
    const i = lista[a], j = lista[b], clave = i + ':' + j;
    if (paresVistos.has(clave)) continue;
    paresVistos.add(clave);
    if (todas[i][0] === todas[j][0]) continue;
    const si = todas[i][1], sj = todas[j][1];
    let comunes = 0;
    for (const p of si) if (sj.has(p)) comunes++;
    if (comunes / (si.size + sj.size - comunes) >= 0.72) gemelas++;
  }
}
check('Las viñetas casi idénticas entre fichas siguen siendo las contadas',
  gemelas <= 8, gemelas + ' pares (eran 6 el 23/09: bloques de urgencia repetidos a propósito)');
// Y las dos que sí eran una lista de seguridad desincronizada, alineadas:
check('QS no se deja "no ve bien" fuera de sus señales de fallo neurológico',
  /no ve bien, no camina igual/.test(fichaDe('QS')) && /no ve bien, no camina igual/.test(fichaDe('QC')));
check('MO avisa del sangrado abundante tras un DIU, igual que NW',
  /sangrado abundante en los días o semanas siguientes/.test(fichaDe('MO')));

// 58. El hito de señalar, que es el que más sustos falsos da. O ya traía la
// reconciliación escrita —señalar aparece entre los 12 y los 18 meses, así que
// a los 14 todavía puede estar llegando; lo que sí es señal a los 12 meses es no
// hacer NINGÚN gesto, y a los 18, no señalar nada— pero HQ seguía publicando
// "no señala ni usa gestos para pedir/mostrar hacia los 12 meses" a secas. Una
// madre que leyera HQ con un hijo de 12 meses que dice adiós con la mano pero
// todavía no señala se llevaba un susto que la propia biblioteca desmiente dos
// fichas más allá.
const hq = fichaDe('HQ'), o = fichaDe('O');
check('HQ ya distingue "ningún gesto a los 12 meses" de "no señalar a los 18"',
  /no hace ningún gesto/i.test(hq) && /no señala nada\*\* hacia los 18 meses/.test(hq)
  && !/no señala ni usa gestos para pedir\/mostrar hacia los 12 meses/.test(hq));
check('Y O y HQ cuentan el mismo hito con la misma horquilla',
  /entre los 12 y los 18 meses/.test(hq) && /entre los 12 y los 18 meses/.test(o));
check('HQ manda a O, que es donde está el desarrollo del matiz', /\*\*O\. /.test(hq));

// 59. El detector de cifras incoherentes, atado. Hasta hoy imprimía sus 18
// primeros pares y nadie sabía cuántos había detrás: eran 159. Se revisaron los
// 46 pares de fichas distintos y ninguno era una contradicción nueva —el estudio
// de fugas y sus subcifras, McElhanon contra Wang en lo digestivo (que A, AA y
// ME ya reconcilian por escrito), la recurrencia en hermanos de 2011 contra la
// de 2024, la heredabilidad del 80% contra el 20% de recurrencia, la alexitimia
// en autismo contra la de población general—. Van todos escritos con su motivo
// en el propio script, así que lo que salga a partir de ahora es nuevo.
const coh = fs.readFileSync(new URL('../../scripts/pruebas/coherencia-cifras.py', import.meta.url), 'utf8');
check('El detector de cifras distingue los pares ya revisados de los nuevos',
  /PARES NUEVOS, para mirar/.test(coh) && /REVISADOS = \{/.test(coh));
check('Y no cuenta como contradicción un redondeo ni una etiqueta de intervalo',
  /Redondeo, no contradiccion/.test(coh) && /no es una afirmacion: es la etiqueta del intervalo/.test(coh));
const revisados = (coh.match(/\('[A-Z]{1,2}','[A-Z]{1,2}'\)/g) || []).length;
check('La lista de pares revisados está escrita, no en la cabeza de nadie',
  revisados >= 60, revisados + ' pares anotados');

// 60. La puerta de entrada. Probé cuarenta consultas escritas como las escribe
// una familia —no como las escribiría quien conoce la biblioteca— y dieciséis
// aterrizaban en la ficha equivocada. Las peores no eran las raras:
//   «quiere morirse»               -> dolor crónico
//   «alguien le ha tocado»         -> cuentas ajenas en internet
//   «convulsión qué hago»          -> lista de espera del diagnóstico
//   «se queda mirando al vacío»    -> el niño que no juega con otros
//   «la profesora dice que es vago»-> sedación en el dentista
// Todas tienen ficha, y buena. Lo que faltaba era la frase con la que se busca.
for (const [q, titulo] of [
  ['quiere morirse', 'Salud mental y seguridad'],
  ['dice que quiere morirse', 'Salud mental y seguridad'],
  ['mi hija de 14 se autolesiona', 'Autolesión'],
  ['convulsion que hago', 'Convulsiones: qué hacer en el momento'],
  ['se queda mirando al vacio', 'Epilepsia'],
  ['alguien le ha tocado', 'Seguridad personal y prevención del abuso'],
  ['le pegan en clase', 'Acoso escolar'],
  ['se escapa de casa', 'fugas y pica'],
  ['se tira del pelo', 'Se arranca el pelo'],
  ['la profesora dice que es vago', 'Saca buenas notas'],
  ['tiene la regla y no lo lleva bien', 'La regla le hace sufrir'],
  ['se toca en publico', 'Educación sexual'],
  ['la policia lo paro en la calle', 'sistema de justicia'],
  ['le rechinan los dientes', 'Salud dental y bruxismo'],
  ['no encuentra trabajo', 'Entrevistas de trabajo'],
  // Segunda tanda de cuarenta consultas (23/09): otras veinticuatro fallaban.
  ['que es el ados', 'Diagnóstico diferencial'],
  ['copia lo que dicen en la tele', 'Ecolalia'],
  ['mueve las manos todo el rato', 'Stimming'],
  ['se enfada si cambiamos de ruta', 'Transiciones y apoyos visuales'],
  ['le huele el aliento fatal', 'higiene bucal'],
  ['se queja de la tripa siempre', 'Problemas digestivos'],
  ['le duele la cabeza a menudo', 'migraña'],
  ['juega al mismo videojuego sin parar', 'uso problemático de videojuegos'],
  ['habla con desconocidos en internet', 'vida online'],
  ['quiero cambiarlo de colegio', 'Elegir colegio'],
  ['el psicologo privado es carisimo', 'pobreza'],
  ['la abuela dice que es culpa mia', 'abuelos y familia extensa'],
  ['mi otro hijo se siente desplazado', 'repartir el tiempo'],
  ['soy autista y acabo de enterarme', 'diagnóstico en la adultez'],
  ['mi hijo dice que es chica', 'diversidad de género'],
  ['tiene la piel fatal de rascarse', 'Se arranca el pelo'],
  // Tercera tanda (23/09): el colegio, los papeles y el acceso en LatAm.
  ['el informe dice cosas que no entiendo', 'Entender un informe'],
  ['el medico no me escucha', 'es por el autismo'],
  ['quiero un comunicador', 'Elegir un sistema de CAA'],
  ['le sujetan en el cole', 'lo sujetan o lo encierran'],
  ['lo castigan sin recreo', 'lo sujetan o lo encierran'],
  ['no avisa para ir al bano', 'Aprendizaje del baño'],
  ['tiene que llevar panal al cole', 'ya no cabe en el cambiador'],
  ['se despierta a las cuatro', 'se levanta a las tres'],
  ['eps me niega la terapia', 'Me han denegado la terapia'],
  ['tengo que pagar todo privado', 'pobreza'],
  ['rompe cosas cuando se enfada', 'Agresión hacia otros'],
  ['vomita en el autobus escolar', 'Transporte escolar'],
  // Cuarta tanda (23/09): el cuerpo, que es donde más se confundía.
  ['le cuesta concentrarse', 'TDAH'],
  ['toma metilfenidato', 'TDAH'],
  ['es muy flexible se disloca', 'hipermovilidad'],
  ['se le doblan los tobillos', 'hipermovilidad'],
  ['tiene el corazon acelerado', 'hipermovilidad'],
  ['le cuesta tragar', 'Se atraganta al comer'],
  ['se cansa muchisimo', 'dolor crónico'],
  ['tiene ataques de panico', 'ansiedad'],
  ['no le ha venido la regla todavia', 'Le está cambiando el cuerpo demasiado pronto'],
  ['le huelen mucho los pies', 'Cortar las uñas'],
  ['se me trepa por todos lados', 'Hiperactividad'],
  // Quinta tanda (23/09): cómo se dice esto en América y la vida adulta.
  ['la seno dice que molesta', 'Apoyar en el aula'],
  ['lo echaron del kinder', 'La guardería dice que no puede'],
  ['necesito una sombra en el aula', 'Auxiliares y apoyos personales'],
  ['cud como se tramita', 'certificado o valoración de discapacidad'],
  ['prestaciones basicas ley 24901', 'Autismo en Argentina'],
  ['que es el pei', 'Reuniones escolares'],
  ['compre una pulsera con gps', 'Le pongo un GPS'],
  ['como le dejo dinero', 'Planificación financiera'],
  ['quiere vivir solo', 'Vivienda y vida independiente'],
  ['le dan mas tiempo en selectividad', 'Universidad'],
  ['le hacen bromas en el trabajo', 'lo acosan o lo han despedido'],
  ['esta quemado del trabajo', 'Burnout autista'],
  ['lo dejo solo en casa una hora', 'dejarlo solo en casa'],
  // Sexta tanda (23/09): el día a día, que es lo que más se teclea.
  ['llora cuando apago la tele', 'Apagar la tablet'],
  ['habla sin parar del mismo tema', 'Intereses intensos'],
  ['le cuesta esperar su turno', 'Enseñar a esperar'],
  ['no mira cuando le hablo', 'Contacto visual'],
  ['necesita saber el plan del dia', 'Transiciones y apoyos visuales'],
  ['no soporta las costuras', 'Ropa y vestirse'],
  ['en invierno va en manga corta', 'Termorregulación'],
  ['no sabe decir si le duele', 'dolor y su expresión'],
  ['se llena la boca de comida', 'Se atraganta al comer'],
  ['no quiere ducharse', 'Cortar las uñas'],
]) {
  const rr = await buscarHondo(q);
  const cabeza = rr.slice(0, 220);
  check(`Buscar «${q}» abre con «${titulo}»`, cabeza.includes(titulo), cabeza.slice(0, 150));
}

// Y la regla que lo hace posible: el orden en que un sinónimo lista sus fichas
// decide el desempate. Antes todas recibían el mismo empuje y ganaba el título
// alfabéticamente menor, así que «quiere morirse» —mapeado a G, IC, FP y KS—
// aterrizaba en «Autolesión» en vez de en «Salud mental y seguridad».
const appSrc = fs.readFileSync(new URL('../../web/app.js', import.meta.url), 'utf8');
check('El orden dentro de un sinónimo pesa: la primera ficha es el destino',
  /codigos\.forEach\(\(c, i\)/.test(appSrc) && /peso - Math\.min\(i, 6\) \* 0\.5/.test(appSrc));
check('Y el simulador de búsqueda usa la misma regla que la app',
  /min\(i,6\)\*0\.5/.test(fs.readFileSync(new URL('../../scripts/pruebas/simular-busqueda.py', import.meta.url), 'utf8')));

// Y la otra regla del mismo sitio: el sinónimo casa por PALABRA, no por trozo
// de palabra. Con `includes` a secas, una consulta de tres letras casaba dentro
// de cualquier sinónimo que la contuviera —"aba" está dentro de "trabajo", de
// "caballos" y de "acaban de diagnosticarlo", 33 sinónimos— y empujaba a sus
// fichas: buscar «ABA» abría "lo acosan o lo han despedido en el trabajo".
check('El sinónimo casa por palabra entera, no por trozo de palabra',
  /function dentroComoPalabra/.test(appSrc)
  && /dentroComoPalabra\(nf, q\) \|\| dentroComoPalabra\(q, nf\)/.test(appSrc));
for (const [q, titulo] of [
  ['aba', 'El debate sobre el ABA'],
  ['ados', 'Diagnóstico diferencial'],
  ['denver', 'Intervención temprana'],
  ['camuflaje', 'niñas/mujeres'],
  ['tgd', 'Criterios diagnósticos'],
]) {
  const rr = await buscarHondo(q);
  check(`Buscar la sigla «${q}» abre con «${titulo}»`, rr.slice(0, 220).includes(titulo), rr.slice(0, 140));
}

// 61. La herramienta que faltaba, y la razón por la que faltaba. El simulador
// puntúa sobre el índice; la app busca ADEMÁS dentro del cuerpo de las fichas,
// así que el orden puede no coincidir. Tres de las consultas asertadas arriba
// se «corrigieron» según el simulador y pusieron la suite en rojo: en las tres
// la app tenía razón. Que la herramienta y el aviso sigan ahí es lo único que
// impide repetirlo, porque el error no se nota hasta la vuelta siguiente.
const comprobador = new URL('../../scripts/pruebas/comprobar-consultas.mjs', import.meta.url);
check('Existe la herramienta para comprobar consultas contra la app', fs.existsSync(comprobador));
const compSrc = fs.readFileSync(comprobador, 'utf8');
check('Y mira el título de la primera tarjeta, no un trozo suelto de la caja',
  /#res-bib \.tema-card h4/.test(compSrc));
check('Y avisa por escrito de que el simulador no es la app',
  /simulador.*no es la app|no es la app|NO es la app/i.test(compSrc));
const simSrc = fs.readFileSync(new URL('../../scripts/pruebas/simular-busqueda.py', import.meta.url), 'utf8');
check('El simulador lleva el aviso en su propia cabecera',
  /no es la app/i.test(simSrc) && /comprobar-consultas/.test(simSrc));
const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
check('El README manda comprobar contra la app antes de dar una frase por buena',
  /comprobar-consultas\.mjs/.test(readme) && /el simulador no es la app/i.test(readme));
const cadena = fs.readFileSync(new URL('../../research/pendientes/ESTADO-CADENA.md', import.meta.url), 'utf8');
check('Y la memoria de la cadena guarda por qué, no solo el qué',
  /simulador NO es la app/.test(cadena) && /comprobar-consultas/.test(cadena));

// Y que las herramientas se puedan ejecutar donde dice el README. Dos de ellas
// llevaban la raíz del repo escrita a mano —la ruta de la máquina donde se
// escribieron—, así que el comando que el README le da a quien quiera colaborar
// fallaba en cualquier otro sitio. Se deduce del propio fichero.
for (const util of ['simular-busqueda.py', 'coherencia-cifras.py', 'vinetas-gemelas.py',
                    'comprobar-consultas.mjs']) {
  const ruta = new URL('../../scripts/pruebas/' + util, import.meta.url);
  if (!fs.existsSync(ruta)) continue;
  check(`${util} no lleva una ruta absoluta de nadie escrita a mano`,
    !/\/(home|Users)\/[a-z]/i.test(fs.readFileSync(ruta, 'utf8')));
}

await nav.close();
console.log('\n' + (errores.length
  ? '❌ ' + errores.length + ' problema(s):\n' + errores.join('\n')
  : '🎉 TODO CORRECTO'));
process.exit(errores.length ? 1 : 0);
