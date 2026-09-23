# Estado de la cadena de rondas

Este archivo es la memoria de la cadena de investigación. El vigía horario
(cron) no repite el procedimiento: dice que se lea esto. **Actualízalo al
final de cada ronda, antes del commit**, y así el vigía nunca queda obsoleto.

El usuario pidió encadenar rondas hasta agotar los créditos. Si nada necesita
acción, no escribas nada al usuario y termina el turno.

## Ronda en curso

**Ninguna. La 52 se publicó entera** (RR, RS). Para la 53, encarga desde
`research/pendientes/RESERVA.md`, **leyendo primero los avisos de su cabecera**,
y **con dos temas si no sabes cuánto presupuesto de búsqueda queda**.

**Lo que enseñó la 52:** otra vez las dos fichas volvieron con
`publicable=false`, y otra vez ninguna lo estaba de verdad. Pero el segundo
choque merece leerse entero, porque **no era "la publicada está mal"**:

- **RR ← RA y PR.** RA decía literalmente «(Este cuadro no aparece en ninguna
  otra ficha de la biblioteca: si buscas hernia inguinal, es aquí.)». Publicar
  RR habría convertido esa frase **publicada** en mentira. Se dejó RA como dueña
  del cuadro, RR solo remite, y el paréntesis se reescribió. Y PR publicaba la
  misma lista de alarma abdominal que RR sin que ninguna citara a la otra: **dos
  listas paralelas divergen en la revisión siguiente**, así que ahora se enlazan
  con un «si cambias una, cambia la otra».
- **RS ↔ PT: las dos tenían media razón, y esa es la moraleja.** Parecían leer
  distinto la misma guía del National Capital Poison Center sobre cuándo empieza
  la miel en una pila de botón —PT decía «mientras vais de camino», el borrador
  de RS decía «desde que la radiografía confirma»—. El corrector no podía buscar
  y dejó RS sin afirmar ninguna. **Con dos búsquedas se resolvió: no es la misma
  cosa.** La **miel** se puede empezar **antes de llegar** (en casa o de camino,
  desde los 12 meses, dentro de las primeras horas, **sin radiografía**); el
  **sucralfato** es hospitalario y empieza **cuando la radiografía confirma** la
  pila en el esófago. PT describía la miel y acertaba; RS mezclaba las dos y se
  quedaba con el criterio del sucralfato. **Ya está separado y no hay que volver
  a litigarlo.**
  **La lección general:** cuando dos fichas citan la MISMA fuente y se
  contradicen, antes de decidir cuál está mal comprueba si están hablando de dos
  cosas distintas. Aquí ninguna mentía.

**Y lo que dio más de sí cuando se acabó el presupuesto de búsqueda:** TRES
tandas de veinte consultas escritas con las palabras de una familia —síntomas
del cuerpo; colegio, derechos y dinero; adolescencia y vida adulta—. **En las
tres, once o doce de veinte abrían en la ficha equivocada**, y la ficha existía
siempre: EM publica los tics desde la ronda 8 y «no para de parpadear y hacer
ruiditos» no devolvía *nada*; DT publica el uso de sustancias desde la ronda 7 y
«fuma porros» tampoco devolvía nada; DE publica el acoso escolar y «le pegan y
el colegio dice que son cosas de niños» abría en mutismo selectivo; «lo han
expulsado tres días» abría en estreñimiento; «ha visto porno» abría en «se
cancela el plan y se hunde». **Tres muestras de veinte, en áreas que no se
tocan, las tres a uno de cada dos: eso ya no es mala suerte, es la propiedad
medida del buscador. No está roto en un sitio concreto; cada área sin probar
tiene lo suyo, y van unas ochenta frases probadas de un espacio sin fondo.** Cuando no haya presupuesto para investigar,
esto es lo que más rinde: veinte consultas nuevas de un área que nadie haya
probado, y mirar la primera respuesta de cada una.

**Y la auditoría de alcance, que es lo que hay que hacer en vez de una cuarta
tanda a mano.** Las tandas de veinte encuentran mucho pero no tienen fondo: no
dicen cuánto queda. Así que se probaron **las 454 fichas con las palabras de su
propio título** (`scripts/pruebas/alcance-fichas.tsv`, regenerable con el
generador de abajo) contra la app: **428 salen las primeras y ninguna da cero
resultados.** Eso sí es una propiedad acotada y medible, y conviene repetirla
después de cada ronda.

De las 26 que no salían primeras, **casi todas son artefacto del generador**:
quitar «no» y «qué» deja la consulta ambigua y gana la ficha paraguas, que
normalmente es lo correcto (A sobre AF, D sobre la de comunicación no verbal, Q
sobre JQ). **Pero tirar de dos de ellas con las palabras de un padre dio lo más
grave de toda la sesión:**

- **«se está convulsionando ahora»** abría «cuido a mi hijo y también a mis
  padres». **«le ha dado una convulsión»** abría pubertad precoz. De tres formas
  de escribir una convulsión en curso, **solo una llegaba a JQ**.
- **«no sabe nadar y nos vamos a la piscina»** abría separación o divorcio, y
  **«se tira al agua sin mirar»** abría alimentación selectiva. El ahogamiento
  es de las primeras causas de muerte evitable en niños autistas y JD existe
  desde hace muchas rondas.

Las dos están arregladas y asertadas (sección 67). **La lección: el buscador
falla más justo donde menos se puede permitir, porque las urgencias se escriben
con frases cortas y desesperadas que nadie había probado.** Cuando pruebes
consultas, empieza por las urgencias.

Y una tercera, de fontanería: **el servidor de pruebas se cae solo** (dio
`ERR_CONNECTION_REFUSED` a mitad de la ronda). Levántalo antes de cualquier
comprobación con navegador, como dice el procedimiento.

## Ya publicado

Rondas 29 a 52.
Biblioteca en **454 temas / 226 verificados / 228 síntesis / 4.635 fuentes**.
Suite **910/910** (23/09). Reserva: **27 encargables de 31**, en
`research/pendientes/RESERVA.md` (unas ocho rondas). La generó
`detectar-huecos.mjs` el 23/09 con tres lentes sobre el índice de las 448
publicadas, y **ese fichero se lee ENTERO antes de encargar una ronda**: lleva
arriba los cruces que el detector no podía ver, porque solo mira lo publicado y
no sabe qué hay en vuelo ni qué está bloqueado. De hecho volvió a proponer
"dice que quiere morirse", que es **NI** y no se investiga.

Ronda 51 **ya no está parada: está corriendo** (arriba, con su runId). QO sigue
libre a propósito, como PO; confírmalo con grep antes de asignar un código.

Para la **52**, mira primero lo que devuelva `detectar-huecos.mjs`, que está
corriendo ahora mismo para rellenar la reserva. Candidata que ya viene de antes:
**RM otra vez** (lectura fácil, reencargada y acotada; el borrador está en
`research/pendientes/RM.md`). Y un aviso que ya costó una equivocación: **"salir
de casa cuando ya usa pañal fuera" NO es un hueco, es RH** —mira la reserva
antes de encargar—. **Cuando queden menos de 4 investigables, lanza otra vez
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
  **Revisión completa el 23/09, y esto cambia cómo se usa.** Hasta ese día el
  script imprimía sus 18 primeros pares y nadie sabía cuántos había detrás:
  eran **159**. Revisados los **46 pares de fichas distintos**, **ninguno era
  una contradicción nueva**. Las tres clases de ruido que quedaban ya no salen
  —el redondeo deliberado ("1 de cada 4 (25 %)" frente a 25,2 %), las etiquetas
  de intervalo de confianza ("IC 95 %" no es una afirmación) y el vocabulario de
  método, que emparejaba la sensibilidad de un cribado de autismo con la de la
  autotoma del VPH— y los 114 pares restantes van escritos **con su motivo** en
  `REVISADOS`, dentro del propio script, y se imprimen aparte. Hoy sale **PARES
  NUEVOS: 0**, así que lo que aparezca ahí mañana es nuevo de verdad y hay que
  mirarlo. **Si tocas una ficha que está en `REVISADOS`, quita su línea y vuelve
  a mirar el par:** con O y HQ pasó exactamente eso —se arregló O, se dejó HQ, y
  HQ siguió rondas asustando a los 12 meses con lo que O explica que es normal
  hasta los 18—.


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

- **Dos fuentes citadas con dos años distintos: resueltas (23/09).** De las
  3.822 URLs de la biblioteca, 279 aparecen con más de una etiqueta —normal, la
  redacción cambia— y siete cambiaban además el año. Cinco eran benignas (el
  año de vigilancia frente al de publicación en el ADDM del CDC y en la cohorte
  PECARN, el número de la Ley 1996 de 2019 de Colombia, la Ley 6/2022 citando el
  RDL 1/2013 que modifica, y el IPT de Slenyto de 2025 que sustituye al de
  2021). **Las otras dos eran errores de verdad y ya están corregidas:**
  1. `PMC6590432` se citaba como "Schoen et al., 2019" y como "Schoen 2018". Es
     **Schoen et al. 2019**, *Autism Research* 12:6-19. El "2018" venía del epub
     de diciembre de 2018. Corregida la etiqueta y también el cuerpo, que decía
     "una revisión 2018".
  2. `link.springer.com/…/s10803-020-04844-2` se citaba como "Hume et al. 2021"
     y como "Steinbrenner et al. (2020)". Es **Hume et al. 2021** (JADD, 15/01/2021).
     **Steinbrenner et al. 2020 es el INFORME del NCAEP, que es otro documento**,
     y la ficha que lo citaba mal ya enlazaba ese informe aparte en PDF: o sea
     que citaba dos veces el informe y ninguna el artículo. Corregida.
  La lista blanca de la prueba baja de siete a cinco, y la comprobación que
  cuenta su tamaño va con ella. **Si vuelve a aparecer un par en conflicto, es
  nuevo: míralo, no lo añadas a la lista sin comprobarlo en fuente.**
  Para la próxima: **el proxy de salida bloquea `pmc.ncbi.nlm.nih.gov` y
  `link.springer.com`** (EGRESS_BLOCKED), así que WebFetch no sirve para estas
  dos; se resolvieron con WebSearch, que devuelve autor y año en el propio
  resultado sin necesidad de abrir el artículo.

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

- **La puerta de entrada estaba peor que el contenido (23/09).** Escribí ochenta
  consultas como las escribe una familia —no como las escribiría quien conoce la
  biblioteca— y **cuarenta aterrizaban en la ficha equivocada**. Todas tenían
  ficha, y buena: lo que faltaba era la frase. Las peores:
  «quiere morirse» → dolor crónico · «alguien le ha tocado» → cuentas ajenas en
  internet · «convulsión qué hago» → lista de espera · «se queda mirando al
  vacío» → el niño que no juega · «la profesora dice que es vago» → sedación en
  el dentista · «mi hija de 14 se autolesiona» → valproato y la regla · «le
  huele el aliento fatal» → la regla · «se queja de la tripa» → los vecinos se
  quejan del ruido.
  **86 entradas nuevas en `sinonimos.json`** y **31 de esas consultas quedan como
  prueba**, con el título que tienen que abrir. **Haz esto en cada ronda**:
  escribe veinte consultas con las palabras de una familia y mira la primera
  respuesta. Es la comprobación que más fallos por hora ha dado de todas las de
  esta sesión, y no cuesta ninguna búsqueda web.
  **Y sirve para lo otro:** la cuarta tanda, toda de síntomas del cuerpo, dejó
  ver **huecos de contenido**, no solo de sinónimos. Hoy no hay ficha propia
  para: **la piel** (picor generalizado, manchas, eccema), **los moretones sin
  golpe**, **el acné** y **la depilación** en la adolescencia. Se resolvieron
  mandando a KG, JR, DA e IO, que es lo más cercano, pero **son candidatos para
  `detectar-huecos.mjs`**.
- **Y una regla del buscador que cambió con ello:** el **orden en que un sinónimo
  lista sus fichas decide el desempate**. Antes todas recibían el mismo empuje y
  ganaba el título alfabéticamente menor —por eso «quiere morirse», mapeado a G,
  IC, FP y KS, abría en «Autolesión» en vez de en «Salud mental y seguridad»—.
  El descuento por posición es pequeño (0,5 por puesto, hasta seis) para ordenar
  dentro del sinónimo sin alterar el peso frente a las demás señales. **La
  primera ficha de cada lista es ahora el destino principal**, que es como se
  venían escribiendo las listas sin que sirviera de nada. Está en `web/app.js` y
  replicado en `scripts/pruebas/simular-busqueda.py`: **si tocas uno, toca el
  otro**, que si no el simulador deja de simular.
- **Y el simulador NO es la app.** Reimplementa `buscarTemas()`, que puntúa
  sobre el índice —título, claves, mensaje clave—, pero la app hace ADEMÁS una
  búsqueda dentro del CUERPO de las fichas (`biblioteca-busqueda.json`), y eso
  cambia el orden. El 23/09, tres de setenta y siete consultas asertadas daban
  primera respuesta distinta en uno y en otro, y en las tres la de la app era
  mejor: «corregí» una expectativa que estaba bien y puse la suite en rojo.
  Itera con el simulador, que es instantáneo y no necesita navegador, pero
  **comprueba contra la app antes de asertar**, con
  `scripts/pruebas/comprobar-consultas.mjs` (un TSV de `consulta<TAB>trozo del
  título`, o consultas sueltas para ver solo qué abre cada una). Cuando falla
  dice en qué puesto quedó lo que esperabas, que es el dato que distingue
  «el sinónimo está mal» de «solo le falta empuje».

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
