/* Service worker — caché offline del contenido estático (app shell + JSON) */
// El nombre de la caché tiene que cambiar en cada despliegue: mientras no
// cambie, `install` no vuelve a ejecutarse y quien ya tiene la app abierta se
// queda con la versión vieja para siempre. Ya no se sube a mano, porque eso se
// olvida: lo estampa el despliegue (.github/workflows/publicar.yml), que
// sustituye la línea de abajo por el SHA del commit sobre la copia que publica.
// En local se queda en "desarrollo", que es JavaScript válido y funciona igual,
// así que abrir web/index.html o serve.py sigue yendo. No reescribas esa línea:
// el despliegue comprueba que la sustitución ocurrió y falla si no la encuentra.
const VERSION = "desarrollo";
const CACHE = "brujula-tea-" + VERSION;
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-maskable.svg",
  "./content/evidencia.json",
  "./content/banderas-rojas.json",
  "./content/fuentes.json",
  "./content/asistente-demo.json",
  "./content/ayuda-urgente.json",
  "./content/biblioteca-indice.json"
];
// Ni el cuerpo completo de la biblioteca (≈2,4 MB) ni las palabras del cuerpo
// para buscar (biblioteca-busqueda.json, ≈350 KB) se precachean: los guarda el
// `fetch` de aquí abajo la primera vez que se abre un tema o se busca, para no
// cobrarle la primera visita a quien entra con datos móviles. No los añadas a
// ASSETS sin medir antes lo que tarda esa primera pantalla.

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Antes de guardar nada: que la respuesta sea buena y sea nuestra. Hasta ahora
// se guardaba lo que viniera, así que un 404 o un 502 del hosting en mitad de un
// despliegue, o la página de login del wifi de un hospital, se quedaban dentro
// como si fueran el fichero bueno, y ahí seguían hasta que alguien subiera la
// versión de la caché a mano.
function sePuedeGuardar(req, res) {
  if (req.method !== "GET") return false;
  if (new URL(req.url).origin !== self.location.origin) return false;
  // "basic" es la respuesta del propio origen; descarta las opacas, de las que
  // ni siquiera se puede leer el código de estado.
  return res.ok && res.status === 200 && !res.redirected && res.type === "basic";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // No cacheamos la API del asistente
  if (req.url.includes("/api/")) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      // La red se pide SIEMPRE, también cuando ya hay copia guardada: es lo que
      // hace que un teléfono de crisis corregido acabe llegando a quien abrió la
      // app hace meses, en vez de quedarse con lo que hubiera aquel día.
      //
      // `actualiza` sólo resuelve cuando la copia YA está guardada, no cuando
      // llegan las cabeceras. Importa: si resolviera antes, el waitUntil de
      // abajo no cubriría la escritura, el navegador podría matar al worker con
      // el cuerpo a medio guardar, y este stale-while-revalidate no revalidaría
      // nunca — que es justo el fallo que viene a arreglar.
      const actualiza = fetch(req).then((res) => {
        if (!sePuedeGuardar(req, res)) return res;
        const copia = res.clone();
        return caches.open(CACHE).then((c) => c.put(req, copia)).then(() => res);
      });
      if (cached) {
        // Se contesta ya con la copia guardada y la red sigue por detrás.
        event.waitUntil(actualiza.catch(() => {}));
        return cached;
      }
      // Sin copia no hay nada que servir: toca esperar a la red de todas formas,
      // así que esperar también a que se guarde cuesta poco y asegura que la
      // próxima visita, esa sí, abra sin red.
      return actualiza.catch(() => cached);
    })
  );
});
