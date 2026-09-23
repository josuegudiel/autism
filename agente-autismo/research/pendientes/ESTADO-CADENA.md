# Estado de la cadena de rondas

Este archivo es la memoria de la cadena de investigación. El vigía horario
(cron) no repite el procedimiento: dice que se lea esto. **Actualízalo al
final de cada ronda, antes del commit**, y así el vigía nunca queda obsoleto.

El usuario pidió encadenar rondas hasta agotar los créditos. Si nada necesita
acción, no escribas nada al usuario y termina el turno.

## Ronda en curso

**Ninguna. La ronda 51 se lanzó y se PARÓ a propósito: se agotó el presupuesto
de búsquedas web de la sesión (200/200).** Es la primera vez que el cuello de
botella no son los tokens —quedaban 14 millones— sino las búsquedas, que se
gastan entre la sesión y todos los subagentes de los workflows. El investigador
de RN ya recibía "web search budget 200 of 200" en su primera búsqueda, así que
la ronda entera habría devuelto cuatro fichas sin verificar, y la regla de la
casa es clara: **sin verificador no está verificada**. Pararla ahorró unos tres
millones de tokens de trabajo impublicable.

**Lo primero de la sesión siguiente: relanzar la ronda 51 tal cual.** Códigos
**RN, RO, RP, RQ**, con estos cuatro encargos, ya acotados:

- **RN — permisos, excedencia y reducción de jornada para cuidar**, acotada al
  **TRÁMITE** (qué escrito, con cuánta antelación, a quién, qué plazo tiene la
  empresa para contestar, qué pasa si calla, qué cambia con convenio o con
  contrato temporal, qué se cobra y qué pasa con la cotización). **JX, PH y NA
  ya publican lo de al lado**: si al terminar es un resumen de JX y PH, no se
  publica. Es el mismo riesgo que tumbó a RM.
- **RO — el hermano que hace de cuidador hoy** (no el relevo de mañana, que es
  HN): qué está medido, qué es razonable pedirle a cada edad y qué no lo es
  nunca, cómo se detecta que está pagando un precio, y qué se le debe a cambio.
- **RP — tarjeta de aparcamiento, acceso preferente, acompañante y distintivos
  de discapacidad no visible**: con el aviso que más falta hace, que la tarjeta
  suele exigir movilidad reducida y muchos niños autistas no la tienen.
- **RQ — duerme en nuestra cama**: empezando por que el colecho no es un
  problema por sí mismo, y qué descartar en médico antes de tratarlo como hábito
  (W ya publica el sueño en general: no reescribirla).

**Y antes o después de esa ronda, `scripts/workflows/detectar-huecos.mjs`**: la
reserva baja a 8 entradas, o sea dos rondas. Ese workflow gasta pocas búsquedas
a propósito, pero gasta algunas: hazlo con el presupuesto fresco.

## Ya publicado

Rondas 29 a 50.
Biblioteca en **448 temas / 226 verificados / 222 síntesis / 4.516 fuentes**.
Suite **718/718**. Reserva: **8 entradas** (la 0, "dice que se quiere morir",
sigue sin investigarse: terminada como NI y esperando decisión).

Ronda 51, parada y por relanzar: códigos **RN, RO, RP, RQ** (QO sigue libre a propósito, como
PO; confírmalo con grep). Para la **52**, candidatas por orden de la reserva:
**RM otra vez** (lectura fácil, reencargada y acotada; el borrador está en
`research/pendientes/RM.md`), **salir de casa cuando ya usa pañal fuera** —no,
esa ya es RH: mira la reserva antes de encargar—, y lo que quede de las ocho
entradas. **Con ocho entradas quedan dos rondas: lanza ya
`scripts/workflows/detectar-huecos.mjs`** antes de la 52 para rellenar la
reserva, que es la instrucción de abajo y toca ahora. **Cuando queden menos de 4 investigables, lanza antes
`scripts/workflows/detectar-huecos.mjs`.**

**NO investigues** "de cinco a ocho pide la tablet" (rechazada como NG por
solaparse con IS) ni "dice que se quiere morir" (terminada, esperando decisión).

**Antes de correr la suite, levanta el servidor** (se cae entre sesiones):
`(setsid nohup python3 -m http.server 8098 --bind 127.0.0.1 >/dev/null 2>&1 &)`
desde `agente-autismo/`. Y **no uses `pkill -f prueba-app`** para parar una
suite: el patrón casa también con tu propio shell y con el navegador de la que
está corriendo. Mata por PID.

## NI está bloqueada a propósito

Terminada y verificada en `research/pendientes/NI.md`. Seis fichas publicadas
(MT, NC, MS, LM, IC, MH) mandan a urgencias ante la sola mención de querer
morirse; NI escalona según plan, método y acceso. El usuario elige entre
unificar en urgencias (A) o hacer NI canónica y reescribir los seis avisos (B).
**No la publiques ni elijas tú.**

## ¿Sigue viva la ronda?

```
D=/root/.claude/projects/-home-user-autism/8095f1f6-d7c0-5388-99b3-464bfb1e7510/subagents/workflows/<runId>
date -u; ls -lat --time-style=full-iso $D | head -5
```

- `agent-*.jsonl` escrito en los últimos ~10 minutos: viva, no toques nada. Con
  `conAguante()` puede pasar hasta 5 minutos esperando entre reintentos sin escribir.
- Nada en ~25 minutos y sin notificación de fin: reanuda con
  `Workflow({scriptPath, resumeFromRunId, args})` y los MISMOS args; lo completado
  replica desde caché.
- Terminó y no se publicó: publícala y lanza la siguiente.

**Cómo se muere una ronda:** límite de sesión (rondas 34 y 37) o 529/500 del
servidor en cadena (ronda 38, cuatro intentos). En `pipeline()`, una etapa que
devuelve null tira el item entero. Desde el 22/09 el script aguanta solo:
`conAguante()` reintenta a los 60 s, 150 s y 300 s. Si aun así vuelve
`fichas:[]`, mira el error: 529/500 → espera 10-15 min y reanuda; límite de
sesión → espera al reset que dice el error. Los args aceptan `modelo_respaldo`;
no lo uses salvo que el modelo esté caído de verdad, y dilo en el commit.

**No publiques nada a medias.** Sin verificador no está verificada; sin las
cuatro lentes no está criticada. El script marca `publicable=false` si muere
alguna lente.

**Al leer el journal:** no emparejes `started` con el `result` siguiente; con
concurrencia la atribución sale CRUZADA. Fíate del campo `codigo` dentro del
propio resultado.

## Procedimiento de publicación

0. El servidor de pruebas se cae entre sesiones:
   `(nohup python3 -m http.server 8098 --bind 127.0.0.1 >/dev/null 2>&1 &)`
   desde `agente-autismo/`; confirma 200 en `/web/index.html`.
1. Cada ficha `publicable=true`: markdown al final de
   `research/biblioteca-autismo.md` y línea "CODIGO. Titulo" en
   `research/indice-temas.txt`. Los scripts de la última ronda quedan en el
   scratchpad (`publicarNN.py`, `enlacesNN.py`): cópialos y cambia ronda y códigos.
   **Dos arreglos obligatorios en la cabecera:**
   - (a) **fuerza el código** al del pipeline. OCHO veces ya un editor ha
     encabezado su ficha con el código de otra: NB→NA, NN→NM, PB→NZ, PF→PD,
     PK→PH, PP→PL, PR→PQ, QA→PY, QD→QC, QI→QG.
   - (b) **reconstruye la cabecera** descartando los trozos que hablen del
     bloqueo, y **comprueba la cabecera entera al final**: en la ronda 38 se
     tiró el trozo bueno ("fuentes depuradas") y se conservó el malo
     ("pendiente: repartir el solapamiento"). Si no queda nada limpio, pon
     "(Ronda N, fuentes verificadas)". La prueba busca
     `[⏳⏸]|EN ESPERA|retenida|NO PUBLICABLE|no publicar hasta|pendiente de |pendiente:|bloquea la publicaci|bloquead|ve \*Pendiente editorial\*`.
     **No busques "pendiente" a secas:** lo lleva dentro "vida independiente",
     el título de CM. Mira también la nota "Para la app" del final: ahí es donde
     el editor deja escrito el bloqueo (le pasó a PV en la 40 y a PZ en la 41).
2. **Rechazadas: antes del cajón, mira si el bloqueo lo puedes cerrar tú.** El
   editor solo toca su propia ficha, así que marca como bloqueo cosas que tú sí
   resuelves. Ronda 38: PP venía bloqueada por el reparto con MC, el código y una
   frase a igualar en dos fichas. Ronda 40: PV pedía ELEGIR entre publicarla o
   disolverla dentro de PB (se eligió ficha propia; faltaban los enlaces de vuelta).
   Ronda 41: PZ venía retenida por dos frases sobre caries en EO y KF y una cita
   mal enlazada en AG. Si el editor pide elegir, elige y explica por qué.
   - **Patrón firme:** cuando una ficha nueva contradice a una publicada, la
     equivocada suele ser LA PUBLICADA. Ya han caído GL, DH, LP, S, MO, FU, R, AE,
     MR, PC, EO, KF, AG, CL, EN, FL y MZ. La ronda 44 no corrigió ninguna: salió limpia. Pero no siempre: en la 39 la equivocada era la nueva
     (PT decía al revés lo de "audífono" y MT lo tenía bien). Comprueba con una o
     dos búsquedas antes de corregir.
   - Bloqueos falsos habituales: "el código no está en indice-temas.txt" (eso lo
     hace publicarla) y "no tiene entradas en sinonimos.json" (añádeselas).
2b. **Cuando un editor diga que una ficha publicada dice X, compruébalo tú antes
   de darlo por bueno y antes de descartarlo.** En la ronda 43 casi descarto una
   corrección buena a MZ porque mi propio grep no encontró la frase que el editor
   citaba: estaba. Y en otras rondas los editores han señalado cosas que no
   estaban. Se mira el archivo, no la memoria de ninguno de los dos.
3. Quitar de la reserva los temas publicados, y **añadir los huecos nuevos que
   detecten las lentes** (así entró el traumatismo dental). Todo JSON del repo se
   reescribe con `indent=1` y salto final.
4. `python3 scripts/construir-contenido.py`.
5. Cifras en `README.md` (2 sitios), `ESTADO.md` (varios, incluido el cálculo
   "425 − 226 = 199") e `ios/README-iOS.md`.
6. Sección de ronda en `scripts/pruebas/prueba-app.mjs`, más una prueba por cada
   corrección a una ficha vieja. **Comprueba que la premisa de cada prueba nueva
   es cierta antes de escribirla** (una vez escribí una sobre una premisa falsa
   y falló al instante).
7. `node scripts/pruebas/prueba-app.mjs` → TODO CORRECTO. Cuenta los ✅ y
   actualiza el número en `AUDITORIA-CODIGO.md`.
8. Enlazar la ficha nueva desde sus hermanas, **en los dos sentidos** (tres
   enlaces inversos por ficha).
9. Actualizar este archivo con la ronda siguiente, commit y push a
   `claude/autism-code-audit-m84mky`.

LÍMITE DURO: 4 temas por ronda.

## Deuda conocida, para una ronda de limpieza

- **Las notas "Para la app" que encargan integración ya no hay que auditarlas a
  mano.** Las 15 que piden alta en `sinonimos.json` o en el índice (NV, PD, PF,
  PJ, PM, PQ, PR, PX, PY, QC, QE, QM, QN, QS, QT) están **todas hechas**; no las
  rehagas. Y desde el 22/09 hay dos pruebas que lo vigilan solas: ninguna ficha
  puede pedir una integración que siga sin hacerse, y la biblioteca y
  `research/indice-temas.txt` tienen que contener exactamente los mismos
  códigos. Eso cubre el paso del procedimiento que hasta ahora se hacía a ojo.


- **`scripts/pruebas/coherencia-cifras.py` (nuevo, 22/09).** Busca cifras que la
  biblioteca publica de dos maneras: agrupa afirmaciones con número por las
  palabras raras que las rodean y saca los pares que no coinciden. Todas las
  contradicciones que han ido apareciendo tenían esa forma (la fiebre de LV y
  QP, el vómito en ocho fichas, el implante de NW, la formación policial de CJ).
  **Pásalo cuando publiques una ronda**, antes del commit. Da falsos positivos
  y se lee, no se obedece. **Revisados ya los ~60 pares con más palabras en
  común** (22/09): salieron tres arreglos —JD y su denominador, O y la cifra
  única de la regresión, y LJ/NS con los dos ensayos de retirada de
  risperidona—. Lo de más abajo en la lista es casi todo ruido de tres clases:
  dos datos distintos del mismo estudio (AA y ME con McElhanon; IC y ID con
  Hollocks, que son depresión y ansiedad), una cifra redondeada en una ficha y
  con decimal en otra (G y LN, LH y MJ), y dos encuestas distintas sobre el
  mismo tema (JH con el VEQ de Griffiths y LA con la de la NAS). **La clase de
  ruido más grande ya está filtrada:** si las dos ventanas contienen las dos
  cifras, las fichas están de acuerdo y el par se descarta (así bajó de 257 a
  215).


- **Las notas "Antes de publicar"**: auditadas las seis que pedían trabajo en
  OTRA ficha (MT, PJ→DM, PQ→N y EE, PX→cinco fichas, QE→AV, PV). Cuatro seguían
  sin hacer y **ninguna era cosmética**: en los cuatro casos la biblioteca se
  contradecía a sí misma. Arregladas. Quedan las notas cuyo encargo era de índice
  o de sinónimos, que sí estaban hechas; conviene reescribirlas cuando se toque
  cada ficha, pero no bloquean nada.
  **Lección del método:** un auditor dio HECHO donde el escéptico encontró que la
  marca de bloqueo seguía viva, y otro citó como prueba "la ficha QO (línea
  8617)", que **no existe**. La fase escéptica no es opcional.
- ~~El cajón por defecto~~ **CERRADA el 22/09.** "Comprender el autismo" tenía
  113 de las 429 fichas y ahora tiene **20**, que son las que de verdad son
  conceptuales o de identidad. Las 93 restantes van asignadas a mano en
  `CATEGORIA_POR_CODIGO` (`scripts/construir-contenido.py`), porque los títulos
  de esta biblioteca están escritos como habla una familia —"Se le rompen los
  huesos con poco"— y ningún patrón de palabras los alcanza. **Al publicar una
  ficha nueva: mira en qué categoría cae y, si el patrón no la coloca sola,
  métela en ese diccionario**; hay una prueba que comprueba que cada código del
  mapa acaba donde dice, que el cajón no vuelve a pasar de 25 y que las 12
  categorías siguen teniendo fichas.

- ~~Fichas sin entrada de búsqueda~~ **CERRADA el 22/09.** Eran 155 de 426 y hoy
  son 0 de 429, con 1.211 claves en `scripts/sinonimos.json` y dos pruebas que lo
  vigilan (ninguna ficha muda, ningún código fantasma). Lo que queda de esto es
  mantenimiento: **cada ficha nueva entra con sus frases en el mismo commit**, y
  se comprueban con `scripts/pruebas/simular-busqueda.py` antes de darlas por
  buenas.

- **`web/content/ayuda-urgente.json` se audita país por país, no a ojo (22/09).**
  Es el archivo donde una errata cuesta más caro, y tenía un error de bulto: la
  entrada de Argentina anunciaba el 135 como "24 h" cuando el Centro de
  Asistencia al Suicida atiende **de 8 a 24 h**, o sea que a la hora a la que más
  falta hace no contesta nadie. Ahora encabeza la Línea Nacional del Ministerio
  de Salud (0800 999 0091), que sí es de 24 h. Comprobados los ocho países contra
  la web del ministerio correspondiente y añadidos los canales por escrito que
  el propio servicio publica (chat del 024 y videointerpretación en lengua de
  signos, WhatsApp/Telegram de Infosalud en Perú, AYUDA al 988, WhatsApp de la
  Línea 106 en Bogotá, Chat de Confianza en CDMX). **Chile y Argentina se quedan
  con `escrito` vacío a propósito**: no hay canal escrito publicado por el
  servicio y suponerlo aquí sería peor que no ponerlo.
  Al tocar este archivo: **comprueba el horario, no sólo el número** —es el fallo
  que se cuela— y pasa la sección 41 de `prueba-app.mjs`, que mira los ocho
  países, sus opciones de menú y el `tel:` que genera cada línea. La fuente tiene
  que ser del ministerio de salud del país; `fuenteSecundaria` es para cuando el
  dato viene de dos sitios (el horario del CAS, el WhatsApp de Bogotá).

- **Las notas "Para la app" también encargan cosas a la APP, y nadie las miraba
  (23/09).** Se auditaron las 438 y tres estaban sin hacer, las tres con efecto
  sobre una pantalla de urgencia:
  1. *"Los bloques 🚨 no llevan color"* lo dice la leyenda de 53 fichas, pero 64
     de las 153 viñetas de urgencia traían además un marcador de color y el
     renderizador pintaba la píldora igual: un atragantamiento salía con un
     "Evidencia limitada" amarillo debajo. **Arreglado en el renderizador, no en
     las 64 viñetas**, que es donde vive la regla. Con un matiz: la sirena solo
     manda si **encabeza** la viñeta; hay cinco que la nombran por dentro para
     remitir a otro bloque y esas conservan su nivel.
  2. *"El bloque 🚨 va arriba"*: 50 de las 51 fichas con urgencia lo tenían en su
     primera viñeta. **LQ** la tenía en la 9 de 13, detrás del artículo 12 de la
     Convención. Subida, y hay prueba que lo exige a las 51.
  3. *"Acceso directo a la pantalla de Teléfonos de ayuda"*: el único enlace
     estaba en el descargo del final, detrás de las fuentes. Ahora se cuela justo
     detrás del bloque de urgencia, y **solo** en las fichas que lo tienen.
- **El contraste se mide, no se supone (23/09).** El estilo de urgencia que se
  añadió ese mismo día se coló con un enlace de **2,8:1 en modo oscuro**, porque
  `--ev-evitar` es un rojo oscuro en claro y un coral claro en oscuro: la paleta
  lo usa como color de TEXTO. Hay ya un token `--on-evitar` para lo que va
  ENCIMA del relleno, y la suite mide el contraste en el navegador y en los dos
  esquemas. **Al medir, compón los fondos con alfa sobre lo que tienen debajo**:
  medir `rgba(192,42,27,0.1)` como rojo sólido daba 3,59:1 en una viñeta que
  tiene 16:1 y me mandó a arreglar algo que no estaba roto.

- **Dos fuentes citadas con dos años distintos, sin resolver (23/09).** De las
  3.822 URLs de la biblioteca, 279 aparecen con más de una etiqueta —normal, la
  redacción cambia— y **siete** cambian además el año. Cinco son benignas (el
  año de vigilancia frente al de publicación en el ADDM del CDC y en la cohorte
  PECARN, el número de la Ley 1996 de 2019 de Colombia, la Ley 6/2022 citando el
  RDL 1/2013 que modifica, y el IPT de Slenyto de 2025 que sustituye al de
  2021). **Las otras dos hay que comprobarlas en fuente y no pude: el
  presupuesto de WebSearch de la sesión se agotó (200/200).**
  1. `PMC6590432` se cita como **"Schoen et al., 2019"** y como **"Schoen 2018"**
     (revisión sistemática de la integración sensorial de Ayres).
  2. `link.springer.com/…/s10803-020-04844-2` se cita como **"Hume et al. 2021
     (J Autism Dev Disord)"** y como **"Steinbrenner et al. (2020), revisión de
     tercera generación"**. Ahí no cambia solo el año: cambia el primer autor.
     Ojo, porque el informe del NCAEP (Steinbrenner) y el artículo de JADD
     (Hume) **son dos documentos distintos**, y si lo son, una de las dos fichas
     está enlazando al que no es.
  **Abre la sesión siguiente por aquí**: dos búsquedas resuelven las dos. La
  prueba que las vigila lleva las siete en una lista blanca comentada; al
  corregir una etiqueta, quítala de esa lista.

- **`scripts/pruebas/vinetas-gemelas.py` (nuevo, 23/09).** Busca viñetas casi
  idénticas en fichas distintas: un hecho mantenido en dos sitios se
  desincroniza, y eso es exactamente lo que produjo las cuatro contradicciones
  de las rondas 48-50 (LW contra BJ, EZ contra RG, FW contra RF, NA contra RL).
  De 4.644 viñetas salen **6 pares** por encima de 0,72, y cuatro son
  repeticiones deliberadas: un bloque 🚨 tiene que ser autosuficiente en la ficha
  donde aterriza el padre, así que se repite a propósito. Los otros dos sí eran
  la misma lista de seguridad desincronizada y ya están alineados: **QS** se
  dejaba "no ve bien" fuera de sus señales de fallo neurológico —en una ficha que
  se titula, precisamente, "el casco y las revisiones de salud (ojos, oídos,
  cuello, dientes)"— y **MO** no avisaba del sangrado abundante tras un DIU, que
  NW sí trae. **Pásalo al publicar una ronda**, junto con `coherencia-cifras.py`:
  uno busca cifras que no cuadran y el otro, texto duplicado que se va a separar.
  La suite fija el techo en 8 pares.

## El PR #2

Head `861a83b` (ronda 41). Borrador, sin comentarios ni reviews; todos los runs
en verde.

`mcp__github__pull_request_read` con get_check_runs + get_comments + get_reviews
en una tanda.

- **Cero check runs sobre el head:** no concluyas que el CI no se disparó.
  GitHub tarda minutos. Confirma con `actions_list` (list_workflow_runs, perPage 3).
- **Rojo:** es mío. `get_job_logs`, reproduce en local, arregla y empuja. Un run
  `cancelled` NO es un fallo.
- **Conflicto con main:** `git fetch origin main && git merge origin/main`,
  resolver, pasar la suite, empujar.

Pendiente y sin respuesta del usuario (**no lo empujes por tu cuenta**):
`actions/checkout` y `actions/setup-node` de @v4 a @v5 en `publicar.yml`.
