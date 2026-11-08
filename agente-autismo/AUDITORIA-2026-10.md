# Auditoría del 22 de octubre de 2026

Segunda auditoría completa de Brújula TEA: la app web, el contenido y su
constructor, el Detector y el asistente, la API, el despliegue, la app de iOS y
las herramientas. Se hizo en dos pasadas: una revisión nueva, de cero, y un
cruce línea por línea con los 172 hallazgos de la primera auditoría
(`AUDITORIA-CODIGO.md`, septiembre), para saber cuáles seguían abiertos.

**La regla de este informe:** un arreglo cuenta como hecho solo si hay una
prueba que falla con el código de antes y pasa con el de después. Las que se
escribieron para esta auditoría están en la sección 77 de
`scripts/pruebas/prueba-app.mjs`.

## 1. En una frase

La app funcionaba y la suite estaba en verde (1.131 comprobaciones), pero
había fallos que la suite no veía porque nadie los había buscado: enlaces de
fuentes rotos, notas internas publicadas a las familias, un Detector que ponía
«Evítalo» junto a la palabra «vacunas», y una app que bajaba la biblioteca
entera —1,6 MB comprimidos— para abrir un solo tema. Todo eso está arreglado y
probado; la suite pasa ahora 1.192 comprobaciones.

## 2. Lo que una familia va a notar

- **Los temas abren al momento, también con datos móviles.** Antes, abrir el
  primer tema bajaba la biblioteca entera (5 MB, 1,6 MB comprimidos): con 3G
  eran decenas de segundos de «Cargando…», también para leer qué hacer durante
  una convulsión. Ahora cada tema baja solo (unos 3 KB comprimidos de mediana).
  **Medido** abriendo «Convulsiones: qué hacer en el momento» sin nada
  guardado: de **5.604 KB a 600 KB** sin comprimir (de ~1,7 MB a ~0,18 MB tal
  como los sirve GitHub Pages, comprimidos).
  Quien quiera la biblioteca entera sin conexión la guarda a propósito con
  «Usar sin conexión», en Inicio, sabiendo antes lo que pesa.
- **Las remisiones se pueden pulsar.** Más de 3.700 referencias del tipo «ve
  **QQ. Llamar al 112…**» eran negrita sin más. Ahora llevan a la ficha. Y
  «También te puede servir» ofrece las fichas que el tema cita, en vez de los
  cuatro primeros de la categoría (los 101 temas de salud ofrecían los mismos).
- **Las fuentes llevan a donde dicen.** 41 enlaces se cortaban en el primer
  paréntesis de la URL (Lancet, JAACAP, Cell, Elsevier) y llevaban a un 404; 36
  fuentes de LL, LO y LP tenían la URL escrita pero no se podían pulsar; y 44
  «fuentes» eran basura (restos de URL pegados al título). La cifra real de
  fuentes es **4.715**, no las 4.753 que se anunciaban.
- **El Detector dice «Es un mito», no «Evítalo», a los mitos sobre la causa.**
  Quien buscaba «vacunas» o «paracetamol embarazo» veía un «Evítalo» rojo al
  lado de la palabra, que se lee justo al revés de lo que dice la ficha.
- **Los seis chips de sugerencia del Detector funcionan** (no hacían nada).
- **Los números de emergencias (112, 911, 107…) se pueden pulsar** en Ayuda.
- **La fecha del seguimiento es la del teléfono.** En México, desde las seis de
  la tarde, proponía el día de mañana; en España, de doce a dos de la noche, no
  dejaba guardar el registro de hoy.
- **Borrar un registro suelto pregunta antes**, un doble toque en «Guardar» ya
  no duplica, y «Borrar todos mis datos» borra todo o nada.
- **16 fichas ya no terminan con notas internas.** Las que cerraban cada ronda
  publicaban, pegadas al final, la cabecera de la ronda siguiente y notas de
  método («Nota técnica: algunas fuentes primarias devuelven 403…»).
- **Las sub-viñetas van dentro de su viñeta.** Eran 430 en 47 fichas, pintadas
  como tarjetas sueltas sin saber a qué punto pertenecían. Y los «---» ya no
  salen como texto.
- **52 tarjetas dejan de prometer avisos que la ficha no tiene**: los semáforos
  se contaban con la nota interna que no se publica (AJ anunciaba «2 a evitar»
  y no lleva ninguno).
- **Sin conexión**: la app abre aunque el enlace traiga «?algo» detrás; un tema
  no guardado lo dice y ofrece los teléfonos; y lo guardado ya no desaparece
  con cada despliegue.
- **En iPhone**, «Añadir a pantalla de inicio» pone el icono de la app (iOS no
  acepta SVG y salía una captura de la página).

## 3. Lo que se arregló, por área

### App web (`web/`)
La columna «Prueba» remite a la sección 77 de la suite: «77c» es su apartado c).

| Qué fallaba | Arreglo | Prueba |
|---|---|---|
| Abrir un tema bajaba 5 MB | Un fichero por tema (`content/temas/XX.json`); el cuerpo entero solo con «Usar sin conexión» | 77c, 77i |
| Remisiones no pulsables, relacionados genéricos | `enlazarRemisiones()`; relacionados = fichas citadas | 77b |
| URL cortada en el primer «)» | Expresión con un nivel de paréntesis (app y constructor) | 77a |
| Chips del Detector muertos; manejadores acumulados en `<main>` | Un manejador por pantalla, colgado de lo que se repinta | 77d |
| Fecha UTC en el seguimiento | `hoyLocal()` | 77e (zona horaria simulada) |
| Carrera entre pantallas | Contador de rutas; la que llega tarde no pinta | 77k |
| Emergencias no pulsables | `telefonosPulsables()` | 77f |
| Disparadores del asistente por trozo de palabra | Deben empezar palabra; «$» = palabra entera | 77g, 77v |
| Variable CSS inexistente (`--txt-2`) | `--label-2` | 77h |
| Sin conexión: página de error con «?algo»; caché borrada en cada despliegue | Respaldo de navegación; el `activate` conserva `/content/` | 77i, 77j |
| Sub-viñetas sueltas, «---» como texto | `mdRender` las anida y omite los separadores | 77r, 77s |
| Borrado sin confirmar, doble toque, borrado total no atómico | `confirm`, botón bloqueado, `dbClear()` | 77o, 77u |
| Una conexión nueva a IndexedDB por operación, ninguna cerrada | Una conexión por sesión, con `onversionchange` | suite (rastreador) |
| Sin política de contenido; fuentes sin validar el esquema | CSP en `index.html`; solo se enlaza http(s) | 77q, 77w |
| Icono SVG en iOS | PNG 180/192/512 y enmascarable | 77q |
| «Sin resultados» no ofrecía el Detector | Enlace con la consulta ya escrita (`#detector/…`) | 77p |

### Contenido y constructor (`scripts/construir-contenido.py`)
- **Valida antes de escribir y para si algo no cuadra**: código repetido,
  encabezado dentro de un cuerpo, cuerpo casi vacío. Hasta ahora no fallaba
  nunca. Al estrenarla cazó las 16 fichas con notas internas pegadas.
- Un tema termina en el siguiente encabezado `##`.
- Fuentes con la URL escrita a pelo, URLs con paréntesis, semáforos sobre lo
  publicado, escritura atómica, un fichero por tema.
- Es **determinista** (mismos bytes en dos corridas y con cualquier semilla de
  hash), y por eso CI puede exigir que `web/content` esté regenerado.

### Detector y asistente
- Veredicto «mito» para los cuatro mitos sobre la causa. Tres pruebas antiguas
  exigían el «Evítalo»: protegían en verde la respuesta equivocada.

### API (`api/chat.ts`)
- Valida lo que manda el navegador (roles, tipo, tamaño, número de mensajes):
  sin eso, con la clave en el servidor, era un proxy gratuito de Claude.
- El system prompt incluye las líneas de crisis que sus propias reglas exigen.
- Modelo por defecto actual y SDK al día (1.1.0), esfuerzo bajo para chat,
  respaldo del servidor si las salvaguardas declinan (`fallbacks: "default"`),
  manejo de `refusal` y de respuestas cortadas, errores registrados.
- Comprobado con `tsc --strict` contra el SDK real y con 8 casos de validación
  ejecutados (ninguno llega a la red). **No** se ha probado contra la API real:
  no hay clave en este entorno.

### Despliegue (`.github/workflows/publicar.yml`)
- `actions/checkout` y `setup-node` en v5 y Node 22 (la v4 corría sobre Node
  20, retirado; cada ejecución lo avisaba).
- Playwright con versión fija (antes, la última de cada día).
- **Nuevo paso: el contenido publicado tiene que estar regenerado.** Y el
  workflow salta también cuando cambia la biblioteca, los sinónimos o el
  constructor. Antes, corregir la biblioteca sin regenerar publicaba lo viejo.
- Un despliegue de Pages en curso ya no se cancela a medias.

### iOS
- `DetectorView.swift` y `AyudaView.swift` reescritas (el target no compilaba).
  **Escritas sin compilador de Swift**: falta abrirlo en un Mac.
- El Detector de iOS ya no pinta el veredicto deducido de los semáforos, que
  decía «Con respaldo» a «las vacunas causan autismo».

### La propia suite de pruebas
- **La prueba «sin conexión» no probaba sin conexión.** `context.setOffline(true)`
  de Playwright no llega al service worker en este Chromium: la página cree
  estar sin red, pero lo que pide a través del worker sigue llegando al
  servidor (comprobado: un fichero inexistente devolvía 404, no un fallo de
  red). La prueba antigua pasaba aunque no hubiera nada guardado. Las nuevas
  (77i) levantan un servidor propio y lo **apagan**; la antigua queda con un
  aviso que remite a ellas.
- **La mitad de tiempo.** Cada una de las ~470 búsquedas esperaba 1,8 s fijos;
  ahora espera a que el índice de palabras esté cargado (con tope). La suite
  pasa de 19 min 23 s a 9 min 20 s con más comprobaciones.
- Dos lecciones de método que conviene no repetir: una prueba que lee el
  registro entero del asistente se tropieza con el mensaje de bienvenida (hay
  que leer solo la última respuesta), y tres pruebas antiguas exigían el
  «Evítalo» de los mitos: protegían en verde la respuesta equivocada.

### Herramientas y workflows de investigación
- El simulador publicado aceptaba `?base=javascript:…`: código en el mismo
  origen que la app y que los datos del niño. Ahora solo páginas del mismo origen.
- `ver-en-iphone.command`: la rama `npx` servía la carpeta entera a la red local.
- `investigar-temas.mjs`: si el editor final moría, la ficha salía publicable
  con las críticas graves sin aplicar. `verificar-fichas.mjs`: el límite de
  4 fichas por tanda se aplica.

## 4. Estado de los 63 hallazgos críticos y altos de septiembre

Resumen: **27 ya estaban arreglados** en septiembre, **22 se cierran hoy**, 4
quedan a medias y 10 siguen abiertos (6 de ellos son de iOS y piden compilar).
Los 109 de gravedad media y baja se revisaron también; los que se cierran hoy
están en la sección 3.

| # | Gravedad | Dónde | Hallazgo (septiembre) | Estado | Nota |
|---|---|---|---|---|---|
| 1 | critica | `api/chat.ts:66` | El historial del cliente se reenvía sin validar el rol, y en el modelo configurado entonces un mensaje con rol "system" anula todas las reglas de seguridad | **Hoy** | La API valida el rol de cada mensaje: solo `user` y `assistant`. |
| 2 | critica | `api/chat.ts:33` | El system prompt obliga a dar un teléfono de crisis pero nunca inyecta 'lineas_de_crisis' de la base de conocimiento | **Hoy** | El system prompt incluye ya la lista de líneas de crisis por país. |
| 3 | critica | `web/content/asistente-demo.json:11` | El asistente responde "¿funciona la quelación?" con la ficha de terapias que SÍ funcionan, sin ninguna advertencia | **Sept.** | Tanda 1: el orden de respuestas es la política de seguridad. |
| 4 | critica | `ios/BrujulaTEA/Datos/Biblioteca.swift:422` | El Detector responde «Con respaldo — La evidencia disponible lo apoya» a «las vacunas causan autismo» | **Hoy** | iOS ya no pinta el veredicto que deduce de los semáforos; abre la ficha. |
| 5 | critica | `ios/BrujulaTEA/Vistas/DetectorView.swift:1` | DetectorView.swift y AyudaView.swift están truncados: el target iOS no compila y desaparecen el Detector y la pantalla de Ayuda urgente | **Hoy*** | Vistas reescritas. *Sin compilador de Swift: falta compilar en un Mac. |
| 6 | critica | `ios/BrujulaTEA/Vistas/DetectorView.swift:1` | DetectorView.swift es un fragmento huerfano de 4 lineas: el detector de pseudociencia no existe en iOS, pero RootView lo ofrece como pestana | **Hoy*** | Ídem. |
| 7 | critica | `ios/BrujulaTEA/Vistas/AyudaView.swift:3` | AyudaView.swift perdio AyudaView y AyudaContenidoView: la pantalla de telefonos de crisis no existe, pero la pestana y la tarjeta de Inicio la anuncian | **Hoy*** | Ídem. |
| 8 | critica | `PROYECTO.md:50` | PROYECTO.md esta publicado en un repositorio PUBLICO con datos personales de un menor y su estado de salud | **Parcial** | Redactado en septiembre; sigue rastreado por git. Decisión del dueño (ver abajo). |
| 9 | critica | `.github/workflows/publicar.yml:33` | Cada redespliegue es invisible para quien ya abrio la app: el service worker sirve para siempre la copia vieja y el workflow nunca invalida la cache | **Sept.** | El despliegue estampa la versión de la caché. |
| 10 | critica | `scripts/pruebas/prueba-app.mjs:115` | La suite sale «TODO CORRECTO» con 12 de las 15 fichas de terapias peligrosas marcadas como seguras y 6 de los 8 telefonos de crisis borrados | **Sept.** | La suite pasó de 29 a más de 1.100 comprobaciones. |
| 11 | critica | `ESTADO.md:67` | ESTADO.md promete que un .gitignore protege el informe médico del niño, pero no existe ningún .gitignore en el repositorio | **Sept.** | `.gitignore` creado. |
| 12 | critica | `web/sw.js:39` | El service worker sirve siempre desde caché sin revalidar: una corrección de seguridad nunca llega al usuario | **Sept.** | Stale-while-revalidate. |
| 13 | critica | `web/sw.js:39` | Cache-first sin revalidacion + version de cache a mano: las correcciones de contenido publicadas NUNCA llegan a quien ya abrio la app | **Sept.** | Ídem. |
| 14 | alta | `web/index.html:25` | aria-live="polite" sobre todo el <main>: el lector de pantalla lee la página entera en cada render | **Sept.** | Región viva acotada. |
| 15 | alta | `web/styles.css:15` | El texto secundario en modo claro tiene 3,30:1 de contraste: falla WCAG 1.4.3 en más de 20 reglas, incluido el descargo médico | **Sept.** | Contrastes medidos y corregidos. |
| 16 | alta | `web/styles.css:128` | En modo oscuro el texto blanco de los botones principales queda en 2,29:1 sobre el acento verde | **Sept.** | Ídem. |
| 17 | alta | `api/chat.ts:48` | Endpoint sin autenticación ni límite de peticiones: cualquiera puede agotar el presupuesto de la API | **Parcial** | Hoy: topes de tamaño por petición. El límite por IP es de la plataforma de despliegue; queda documentado en `api/chat.ts`. |
| 18 | alta | `api/chat.ts:66` | No hay tope al tamaño del historial ni comprobación de los elementos: 500 con un cuerpo trivial y coste ilimitado por petición | **Hoy** | Máx. 20 mensajes, 2.000 caracteres cada uno, 12.000 en total. |
| 19 | alta | `api/package.json:7` | La versión fijada del SDK (^0.40.0) no compila con el código: 'ttl' no existe en CacheControlEphemeral | **Hoy** | SDK 1.1.0; comprobado con `tsc --strict`. |
| 20 | alta | `api/chat.ts:49` | Ni cabeceras CORS ni comprobación de Origin: roto desde el PWA publicado y abierto para cualquier otro cliente | **Abierto** | Solo hace falta si la API vive en otro dominio que la web. Depende del despliegue. |
| 21 | alta | `web/content/asistente-demo.json:3` | El asistente no tiene ningún disparador de crisis: a «mi hijo se quiere morir» responde con terapias o con el texto genérico, sin dar un teléfono | **Sept.** | Respuesta de crisis la primera. |
| 22 | alta | `scripts/construir-contenido.py:155` | El extractor corta las URLs en el primer paréntesis: 24 fuentes quedan con enlaces rotos en biblioteca-cuerpo.json | **Hoy** | 41 URLs enteras y 44 «fuentes» basura retiradas. |
| 23 | alta | `scripts/construir-contenido.py:170` | Las URLs sueltas de la línea "**Fuentes:**" se descartan: 3 temas anuncian 9, 9 y 18 fuentes y ninguna es clicable | **Hoy** | LL, LO y LP: 35 de 36 fuentes ya se pueden pulsar (la otra no tiene URL, a propósito). |
| 24 | alta | `ios/BrujulaTEA/Datos/Biblioteca.swift:408` | La regla «supera a la segunda en un 50 %» impide dar veredicto a quelación y MMS porque el 29 % de los sinónimos apunta a dos temas | **Abierto** | iOS. Mitigado: una coincidencia ambigua ofrece candidatos, no un veredicto. |
| 25 | alta | `ios/BrujulaTEA/Modelos/Modelos.swift:34` | La decodificación «tolerante» convierte cualquier cambio del generador en una biblioteca vacía o de fichas en blanco, sin error | **Abierto** | iOS; no verificable sin compilador. |
| 26 | alta | `ios/BrujulaTEA/Vistas/BibliotecaView.swift:41` | La pestaña Biblioteca no muestra ningún error si falta el JSON en el bundle: pantalla en blanco | **Abierto** | iOS; ídem. |
| 27 | alta | `ios/BrujulaTEA/Utilidades/MarkdownLigero.swift:156` | El badge de evidencia se queda con el ULTIMO marcador de la linea, no con el que califica la afirmacion | **Abierto** | iOS; ídem. |
| 28 | alta | `ios/BrujulaTEA/Utilidades/MarkdownLigero.swift:54` | Las sub-viñetas anidadas se aplanan: listas de triaje médico pierden la jerarquía | **Abierto en iOS** | En la web se arregló hoy: las sub-viñetas van dentro de su viñeta. |
| 29 | alta | `ios/BrujulaTEA/Utilidades/MarkdownLigero.swift:163` | Borrar los marcadores en mitad de la frase deja el texto mutilado (la leyenda de colores queda sin sentido) | **Abierto** | iOS; no verificable sin compilador. |
| 30 | alta | `ios/README-iOS.md:83` | La documentacion de iOS describe como existentes el detector y la ayuda urgente, y omite que iOS no tiene rastreador: solo quedan 2 pantallas reales de las 8 de la web | **Hoy** | READMEs de iOS al día. |
| 31 | alta | `scripts/workflows/investigar-temas.mjs:51` | El formato de cabecera que impone el workflow no lo reconoce el detector de "verificado" de la app: 30 fichas verificadas se muestran con el sello mas debil | **Abierto** | Decisión editorial: qué cuenta como «verificado» en la app (ver abajo). |
| 32 | alta | `scripts/workflows/investigar-temas.mjs:314` | Si el editor final muere, la ficha se devuelve con publicable=true y con los problemas graves de seguridad sin corregir | **Hoy** | Si el editor final muere y hay críticas sin aplicar, la ficha sale NO publicable. |
| 33 | alta | `scripts/workflows/investigar-temas.mjs:231` | El respaldo del verificador es codigo muerto: si el verificador muere, se pierde la ficha entera en silencio | **Parcial** | Reintentos y aviso en el registro (sept.); la ficha ya no se pierde en silencio. |
| 34 | alta | `scripts/workflows/investigar-temas.mjs:282` | Si mueren las tres lentes criticas, el informe afirma que no encontraron ningun problema | **Sept.** | Contador de lentes muertas. |
| 35 | alta | `scripts/workflows/verificar-fichas.mjs:37` | No se aplica el limite de 4 fichas por tanda que el propio archivo documenta como obligatorio | **Hoy** | El límite de 4 fichas por tanda se aplica. |
| 36 | alta | `ESTADO.md:67` | No existe ningun .gitignore en el repositorio, pero ESTADO.md y PROYECTO.md afirman que protege el informe medico del nino | **Sept.** | `.gitignore`. |
| 37 | alta | `../README.md:3` | El README de la raiz manda subir 'todo el contenido' de la carpeta del nino a un repositorio publico | **Sept.** | Aviso de repositorio público. |
| 38 | alta | `.github/workflows/publicar.yml:26` | Ningun workflow ejecuta la suite: publicar.yml despliega a produccion sin ninguna comprobacion previa | **Sept.** | El despliegue pasa la suite antes de publicar. |
| 39 | alta | `scripts/pruebas/prueba-app.mjs:80` | 6 de las 10 pruebas de busqueda pasan aunque el buscador este completamente roto, porque la cabecera de resultados repite la consulta | **Sept.** | Aserciones de búsqueda reescritas en rondas posteriores. |
| 40 | alta | `scripts/pruebas/prueba-app.mjs:134` | El rastreador —los unicos datos del nino— no tiene ninguna prueba de guardado: con IndexedDB rota del todo la suite dice «TODO CORRECTO» | **Sept.** | Pruebas del rastreador. |
| 41 | alta | `scripts/construir-contenido.py:155` | La regex de enlaces corta las URLs en el primer parentesis: 24 fuentes cientificas quedan rotas | **Hoy** | = nº 22. |
| 42 | alta | `scripts/construir-contenido.py:196` | Una cabecera que no encaje en [A-Z]{1,2} borra el tema en silencio y pega su texto al tema anterior | **Hoy** | `validar()` aborta antes de escribir; y cazó 16 fichas reales (ver abajo). |
| 43 | alta | `scripts/construir-contenido.py:288` | El script no valida su salida ni falla nunca: sobrescribe los JSON aunque pierda cientos de temas | **Hoy** | Validación + escritura atómica de los JSON. |
| 44 | alta | `research/auditoria/INFORME.md:33` | El informe de auditoria afirma 100% de cobertura, pero 42 dominios nunca se han auditado, varios de seguridad vital | **Abierto** | Informe de la auditoría de contenido; fuera de la app. |
| 45 | alta | `scripts/informe-auditoria.py:52` | El informe descarta en silencio 312 de los 598 hallazgos y marca como "sin fallos" 128 dominios que si tienen hallazgos no refutados | **Abierto** | `informe-auditoria.py`, herramienta de investigación. |
| 46 | alta | `herramientas/simulador-iphone.html:138` | El simulador toma la URL del iframe de un parametro (?base=) sin validar, y se publica en el mismo origen que la app | **Hoy** | El simulador solo acepta páginas http(s) del mismo origen. |
| 47 | alta | `web/sw.js:38` | El service worker sirve cache-first sin revalidar nunca: una correccion de contenido no llega jamas a quien ya tiene la app instalada | **Sept.** | = nº 12. |
| 48 | alta | `ios/BrujulaTEA/Vistas/DetectorView.swift:1` | DetectorView.swift quedó truncado a 4 líneas sueltas: la app iOS no compila y su Detector de pseudociencia no existe | **Hoy*** | = nº 5. |
| 49 | alta | `web/sw.js:39` | El service worker sirve siempre desde caché con una versión fija: las correcciones de contenido no llegan nunca a quien ya abrió la app | **Sept.** | = nº 12. |
| 50 | alta | `web/app.js:5` | El Centro de evidencia y el Asistente existen en el código y en la documentación, pero no hay ningún enlace en la app que lleve a ellos | **Sept.** | Evidencia y asistente enlazados desde Inicio. |
| 51 | alta | `ios/BrujulaTEA/Datos/Biblioteca.swift:424` | El detector de iOS deduce el veredicto contando emojis y devuelve «Con respaldo» para cannabis/CBD, mientras que para quelación y MMS no da ninguno | **Hoy** | = nº 4. |
| 52 | alta | `scripts/construir-contenido.py:313` | El indice de busqueda no contiene el cuerpo de los temas: los nombres reales de terapias peligrosas devuelven cero resultados | **Sept.** | Índice de palabras del cuerpo. |
| 53 | alta | `web/app.js:179` | El impulso por sinonimos usa includes() de cadena, sin limites de palabra: sinonimos de 3 letras contaminan el ranking | **Sept.** | Coincidencia por palabra (`dentroComoPalabra`). |
| 54 | alta | `web/app.js:189` | El arreglo del commit 11409e3 esta incompleto: las frases hechas solo de palabras vacias siguen devolviendo cero | **Sept.** | Los sinónimos se miran antes de exigir palabras útiles. |
| 55 | alta | `web/app.js:585` | Los alias de 3 letras (MMS, CDS, RPM, AIT, FMT, MMR, S2C) son invisibles en cuanto la consulta lleva otra palabra o un signo | **Sept.** | Tanda 1. |
| 56 | alta | `web/app.js:550` | Los 6 chips sugeridos del Detector no hacen absolutamente nada al pulsarlos | **Hoy** | Los seis chips del Detector abren su ficha. |
| 57 | alta | `web/app.js:641` | Una consulta explicitamente peligrosa escrita como frase se resuelve como 'ambigua' y no muestra ninguna advertencia | **Sept.** | Aviso de lo que conviene evitar en una coincidencia ambigua. |
| 58 | alta | `web/content/banderas-rojas.json:36` | Terapias peligrosas documentadas en la propia biblioteca no tienen ficha en el Detector, que responde 'no quiere decir que sea bueno ni malo' | **Parcial** | El Detector pasó de 15 a 35 fichas en septiembre; sigue sin cubrir los 460 temas. |
| 59 | alta | `web/app.js:662` | No existe ninguna forma de exportar o respaldar los registros del niño, ni se pide almacenamiento persistente | **Sept.** | Exportación CSV y almacenamiento persistente. |
| 60 | alta | `web/app.js:707` | La fecha por defecto y el limite 'max' se calculan en UTC, no en la zona horaria del usuario | **Hoy** | Fecha del reloj del teléfono, probada en México y España. |
| 61 | alta | `web/app.js:213` | Carrera entre renders: una vista lenta pisa la que el usuario ya está viendo, incluida «Ayuda urgente» | **Hoy** | Cada pantalla lleva un número; la que llega tarde no pinta. |
| 62 | alta | `web/app.js:751` | El rastreador pierde el registro en silencio si IndexedDB falla, y muestra «Aún no hay registros» aunque sí los haya | **Sept.** | Fallos de IndexedDB visibles. |
| 63 | alta | `web/sw.js:41` | Se cachean respuestas de error (500/404) sin comprobar res.ok, y como nunca se revalidan dejan la biblioteca rota para siempre | **Sept.** | Solo se guardan respuestas buenas y propias. |

## 5. Lo que queda abierto, y por qué no se ha tocado

**Decisiones que son del dueño del proyecto, no técnicas:**
- **`PROYECTO.md` sigue rastreado por git.** Está redactado (sin nombre ni ruta
  desde septiembre), pero el `.gitignore` no actúa sobre un fichero ya rastreado.
  `git rm --cached` lo arregla, con un efecto que conviene saber antes: quien
  tenga el repositorio clonado y haga `git pull` verá desaparecer su copia local.
- **Qué significa «verificado» en la app.** El sello «Fuentes comprobadas» sale
  solo con la marca antigua `✅✅ VERIFICADO`; las fichas de las rondas nuevas
  («✅ cubierto (Ronda N, fuentes verificadas)») pasaron verificador y cuatro
  lentes y salen como «Síntesis con fuentes». Peca de prudente, no de
  arriesgado, pero es una decisión editorial.
- **NI** sigue esperando la decisión de umbral, sin tocar.
- **El PR #2 lleva 134 commits y su descripción habla de la ronda 28.**

**Lo que necesita algo que aquí no hay:**
- **Compilar la app de iOS** (hace falta un Mac con Xcode). Siguen abiertos los
  hallazgos de iOS que no se pueden comprobar sin compilador (descodificación
  tolerante, marcador de evidencia, sub-viñetas aplanadas…), y que el Detector
  de iOS lea `banderas-rojas.json` como la web.
- **Probar la API contra Claude** (hace falta una clave). Y, si se despliega en
  otro dominio que la web, añadir CORS y ese dominio al `connect-src` de la CSP.
- **15 fuentes enlazan por `http://`** (gobiernos de Paraguay, Perú, México,
  SciELO Colombia…). No se han pasado a https a ciegas: aquí no se puede abrir
  la web para comprobar que la versión segura existe.

**Mejoras posibles, de más a menos impacto:**
1. **La suite aún podría ir más rápido.** Las búsquedas ya no esperan tiempo
   fijo (de ~19 a ~9 min), pero cada cambio de pantalla sigue esperando 0,7 s
   fijos (`ir()`), y hay unas 1.000. Esperar a una condición en vez de a un
   reloj lo bajaría bastante más.
2. **El índice es ahora lo que más pesa** (594 KB sin comprimir, ~180 KB
   comprimido): lo baja cualquier primera visita. Lleva dentro las ~1.900 claves
   de sinónimos y las palabras clave de cada tema; separarlas o bajarlas al
   buscar lo reduciría mucho.
3. **El Detector cubre 35 terapias frente a 460 temas**; la biblioteca documenta
   más pseudoterapias de las que el Detector reconoce.
4. **El buscador** puntúa títulos por trozo de palabra («tea» dentro de
   «teatro») y no tiene puntuación mínima; no se ha tocado porque mueve cientos
   de consultas asertadas y merece una ronda propia, midiendo.
5. Hay una rama antigua en el remoto (`claude/autism-agent-github-kxon0i`, rondas
   28–34) que no está en ningún PR: conviene borrarla o archivarla.

## 6. Cómo se verificó

- **Línea base**: la suite completa sobre el código anterior, 1.131/1.131
  en verde (19 min).
- **Después**: la suite completa sobre el código arreglado, 1.192/1.192
  en verde. Incluye la sección 77, con unas 61 comprobaciones nuevas, cada una
  escrita para fallar con el código anterior.
- **Constructor**: determinista (dos corridas y otra semilla de hash, mismos
  bytes); la validación nueva se probó rompiendo a propósito una copia de la
  biblioteca (cabecera mal escrita y código repetido): aborta sin tocar los JSON.
- **API**: `tsc --strict` contra `@anthropic-ai/sdk` 1.1.0, y 8 casos de
  validación ejecutados.
- **iOS**: equilibrio de llaves y paréntesis, y revisión contra las APIs que
  ya existían. **No compilado.**
- **Workflows de investigación**: sintaxis comprobada envolviéndolos como lo hace
  el runtime. No se han ejecutado (la investigación está parada).
