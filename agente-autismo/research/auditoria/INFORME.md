# Auditoría de la biblioteca — informe

Este archivo se genera solo. No lo edites a mano:
`python3 scripts/informe-auditoria.py`

## Cómo se audita cada tema

Cada tema pasa por **dos agentes que no se conocen entre sí**:

1. **Un revisor** comprueba cifras, atribuciones, semáforos de evidencia y
   seguridad del niño, y anota lo que cree que está mal.
2. **Un abogado del diablo** recibe cada fallo alegado y trata de
   **demostrar que el revisor se equivocó**. Solo si no lo consigue, el
   fallo cuenta como real.

Ese segundo paso no es un adorno: hasta ahora ha descartado
**65** hallazgos que eran falsas alarmas. Sin él se habrían
estropeado temas que estaban bien.

### Lo que esta auditoría NO puede comprobar

La política de red del entorno impide abrir páginas web (devuelve error
403 para cualquier dirección, incluso las más comunes). Los revisores
verifican con buscador, que sí funciona: pueden confirmar que un estudio
existe, su autoría, año y revista, y contrastar cifras contra el resumen.
**No pueden comprobar que un enlace concreto siga funcionando.**
Donde el detalle dice `enlaces comprobados: 0`, significa *no comprobado*,
no *correcto*.

## Estado

- Tandas hechas: **1, 2, 3**
- Temas auditados: **132 de 318** (41%)
- Temas sin ningún fallo confirmado: **62**
- Fallos confirmados: **102** (graves o medios: **36**)
- Falsas alarmas descartadas: **65**

## Fallos confirmados que exigían corrección

Ordenados por gravedad. Todos han sido aplicados a la biblioteca.

### GRAVE · AN. Burnout autista (autistic burnout)

*riesgo para el niño*

> - **Distinto de la depresión** (y del burnout laboral): distinguirlo **importa** porque los tratamientos diseñados para la depresión **podrían empeorar** el burnout autista → hace falta un abordaje adecuado. 🟢

Esta es la unica ficha de las cuatro que NO remite en ningun momento a un profesional. Describe a un nino o adolescente con agotamiento prolongado (3+ meses), perdida de habilidades (lenguaje, autocuidado, funcion ejecutiva), aislamiento y reduccion del funcionamiento, y le dice al padre que eso NO es depresion y que los tratamientos de la depresion 'podrian empeorar' el cuadro, sin anadir en ningun sitio que hay que consultar. Ese cuadro clinico es indistinguible a ojos de un padre de una depresion mayor adolescente, de una catatonia autista (que puede ser potencialmente mortal y requiere tratamiento especifico), o de una regresion de causa medica o neurologica. La propia ficha AL de esta m

### GRAVE · BK. Factores prenatales y perinatales asociados (con matices)

*atribuido al estudio equivocado*

> intervalos menores a 12 meses (y también los muy largos, de más de 6 años) se asocian con un riesgo de autismo 2 a 3 veces mayor comparado con intervalos de 36-47 meses, en un estudio poblacional de Dinamarca, Finlandia y Suecia (>900.000 nacimientos) con un patrón consistente en forma de "U"

La cifra y el estudio no se corresponden. El "2 a 3 veces mayor" frente a la categoria de referencia de 36-47 meses procede de Zerbo et al. (2015, Pediatrics 136(4):651), una cohorte de Kaiser Permanente del norte de California con 45.261 ninos, y un resultado similar (aproximadamente el doble, referencia 24-47 meses) esta en Durkin, DuBois y Maenner (2015, J Autism Dev Disord 45(7):2056-66), cohorte de Wisconsin con 31.467 segundos hijos, que es justamente el articulo al que apunta el enlace PMC citado. El estudio multinacional de Dinamarca, Finlandia y Suecia con mas de 900.000 nacimientos (Pereira et al., 2021, Autism Research, N=925.523) si existe y si describe una curva en U, pero sus r

### GRAVE · BR. Elegir profesionales y terapias con criterio

*riesgo para el niño*

> sé especialmente cauto con "detox", quelación, células madre o suplementos "milagro" para el autismo — pueden causar daño físico real y no deben intentarse sin supervisión médica rigurosa y evidencia sólida.

La formulación condiciona la prohibición: dice que estas prácticas "no deben intentarse SIN supervisión médica rigurosa", lo que implica que CON un médico que las supervise serían aceptables. Para la quelación, los protocolos de "detox" y las inyecciones de células madre en autismo no existe ninguna indicación legítima: no curan el autismo, no hay evidencia que las respalde y han causado daños graves y muertes. Un padre desesperado puede leer esto como permiso para buscar una clínica que ofrezca quelación "bajo control médico", que es exactamente el modelo de negocio de las clínicas biomédicas. La propia ASAT, citada en la ficha, advierte que los tratamientos de "detox" exponen a las persona

### GRAVE · CS. Más pseudociencias para el Detector

*riesgo para el niño*

> No es dañina en sí como alimento, pero venderla como tratamiento es engañoso.

La ficha declara la leche de camella inocua sin advertir que el producto que se promueve para autismo es leche CRUDA (sin pasteurizar). La propia lista de la FDA que la ficha cita en el punto anterior habla de "leche de camella cruda", y la FDA/CDC advierten que la leche sin pasteurizar puede transportar E. coli, Campylobacter, Listeria, Salmonella y (en camélidos) MERS, con riesgo especialmente alto en niños. Un padre que lea "no es dañina" puede darle leche de camella cruda a su hijo.

### Medio · AH. Escuela: inclusión, adaptaciones y derechos

*atribuido al estudio equivocado*

> **EE.UU.:** IEP/Plan 504 (ley IDEA). 🟢

Atribución legal incorrecta: el IEP procede de la ley IDEA (Individuals with Disabilities Education Act), pero el Plan 504 NO procede de IDEA — procede de la Sección 504 de la Rehabilitation Act de 1973 (ley de derechos civiles, aplicada junto con la ADA). Son dos vías distintas, con criterios de elegibilidad, procedimientos y garantías diferentes. El error importa para una decisión real: un niño que no cumple los criterios de IDEA para un IEP puede seguir teniendo derecho a un Plan 504, y un padre que crea que ambos dependen de IDEA puede darse por vencido tras una denegación de IDEA. Además, ninguna de las tres fuentes listadas es estadounidense, por lo que esta afirmación no tiene respald

### Medio · AP. Ejercicio físico

*riesgo para el niño*

> - **Ideas prácticas:** **natación** (¡también seguridad! — enlaza con AE), caminar, cama elástica, artes marciales, bicicleta, baile — **estructurado** y **disfrutable**. 🟢

Se recomienda la cama elástica a padres sin ninguna advertencia de seguridad, en una ficha que por lo demás presume de tener en cuenta la seguridad. La Academia Americana de Pediatría desaconseja el uso recreativo de camas elásticas domésticas en niños (riesgo de fracturas y lesión cervical, muy aumentado con más de un usuario a la vez). Lo que se usa en terapia ocupacional suele ser una minicama elástica supervisada, que no es lo mismo que una cama elástica de jardín. La bicicleta tampoco lleva mención del casco.

### Medio · AQ. Musicoterapia

*la fuente no lo sostiene*

> su **evidencia como tratamiento es mixta**: no está demostrado que mejore los **síntomas centrales** del autismo. Disfrútala por lo que es; no inviertas esperando una "cura".

El veredicto de la ficha se apoya en el ECA TIME-A (2017) y en la revisión Cochrane de 2014, ignorando la actualización Cochrane de 2022, que ya incorpora TIME-A y aun así concluye que, frente a cuidado estándar o terapia placebo, la musicoterapia probablemente produce una mejora de la valoración global y puede mejorar levemente la interacción social y la calidad de vida. Un padre que lea esta ficha puede descartar una intervención segura cuya síntesis más reciente y de mayor calidad es moderadamente favorable, no simplemente "mixta". Nota: no he podido abrir la revisión para citarla textualmente (todas las peticiones web devolvieron 403); este punto debe re-comprobarse contra el resumen de 

### Medio · AS. Animales de apoyo / terapia

*riesgo para el niño*

> - **Perros de asistencia para autismo:** pueden mejorar la **seguridad** (p. ej. **anclaje anti-fuga** — enlaza con AE), el **sueño** y el **funcionamiento familiar**; evidencia **creciente** pero aún limitada. 🟡

La ficha presenta el perro de asistencia como medida de seguridad frente a la fuga ("anclaje anti-fuga") sin la advertencia que acompana siempre a esta practica: el perro NO sustituye la supervision de un adulto. El anclaje (tethering) solo se realiza bajo el protocolo del programa que entrena al perro y con un adulto manejando la correa; en ningun caso el nino queda "asegurado" por el animal. Un padre que lea esta ficha en el contexto del dominio AE (fuga/elopement) puede relajar la vigilancia. Ademas se enumera la mejora del **sueño** como beneficio en el mismo nivel que la seguridad, cuando los resultados sobre sueño infantil en los estudios de perros de asistencia son inconsistentes (los

### Medio · AU. Motricidad y dispraxia

*riesgo para el niño*

> Afectan la escritura, el deporte y el autocuidado — y conviene **apoyarlas**, sin asumir que "no quiere" cuando en realidad "le cuesta".

Es la unica de las cuatro fichas sin apartado "Cuándo consultar" ni señales de alarma. La ficha normaliza en bloque las dificultades motoras y las encamina a terapia ocupacional, pero no advierte de los signos que exigen valoracion medica o neurologica antes de asumir que se trata de dispraxia: perdida de habilidades motoras ya adquiridas (regresion), asimetria entre los dos lados del cuerpo, hipotonia marcada, debilidad progresiva, caidas frecuentes de aparicion nueva, dolor. Atribuir todo eso a "diferencia motora del autismo" puede retrasar el diagnostico de una condicion tratable.

### Medio · BB. Prevalencia y el "aumento" de casos (¿hay una epidemia?)

*dato incorrecto*

> el DSM-5 (2013) fusionó categorías antes separadas (autismo clásico, síndrome de Asperger, trastorno generalizado del desarrollo no especificado) en un solo espectro, lo que permitió identificar a personas con presentaciones más leves o atípicas que antes quedaban fuera o mal etiquetadas. 🟢

La fusión de categorías en 2013 es cierta, pero la consecuencia que se le atribuye (ampliar la identificación y explicar el aumento de prevalencia) no la sostiene la evidencia, y menos con semáforo 🟢. Los estudios que compararon ambos manuales encontraron que los criterios DSM-5 son igual de estrictos o MÁS estrictos que los del DSM-IV: en una muestra epidemiológica la prevalencia bajó ~17% (2,64% con DSM-IV-TR frente a 2,20% con DSM-5) y solo el 81,2% de los casos DSM-IV-TR cumplían criterios DSM-5. Además, la mayor parte del aumento es anterior a 2013 (ADDM pasó de 1 de cada 150 en 2000 a 1 de cada 68 en 2012). La ampliación de criterios que sí explica buena parte del aumento es la del DSM

### Medio · BC. Vacunas y autismo — el mito a fondo

*dato incorrecto*

> el diagnóstico de autismo suele hacerse entre los 18 y 24 meses, justo cuando se aplican varias vacunas de rutina

Confunde la aparición de los primeros signos con la edad del diagnóstico. Los datos de la red ADDM de los CDC (vigilancia 2022, publicada 2025) sitúan la mediana de edad del diagnóstico más temprano conocido en 49 meses (unos 4 años), con rango de 36 a 59 meses según el estado. Lo que ocurre entre los 12 y los 24 meses es la aparición de los primeros signos y de la preocupación de las familias, no el diagnóstico. Para un padre esto importa: da a entender que a los 2 años ya debería haber diagnóstico y puede generar falsa tranquilidad si no lo hay.

### Medio · BE. Funciones ejecutivas

*semáforo demasiado optimista*

> un estudio español con niños y adolescentes autistas sin discapacidad intelectual (CI normal) mostró déficits en los cinco dominios evaluados —atención, memoria de trabajo, flexibilidad mental, control inhibitorio y solución de problemas— que NO correlacionaron con el CI (Merchán-Naranjo et al., *Rev. Psiquiatría y Salud Mental*, 2016). 🟢

El contenido del bullet es exacto (comprobado: el estudio halló diferencias significativas en los cinco dominios —atención, memoria de trabajo, flexibilidad mental, control inhibitorio y solución de problemas— que se mantuvieron al controlar el CI), pero la muestra es de solo 24 participantes autistas sin discapacidad intelectual frente a 32 controles. Un único estudio con n = 24 no es «evidencia sólida» según el propio criterio de semáforos de la biblioteca (verde = metaanálisis, guías clínicas o ensayos replicados). Además, la ficha no informa del tamaño muestral, lo que impide al lector calibrar la fuerza del dato.

### Medio · BH. Stimming (conductas autoestimulatorias)

*riesgo para el niño*

> **Cuándo sí conviene intervenir:** solo cuando el stimming es autolesivo (por ejemplo, golpearse la cabeza, morderse hasta lastimarse) o pone en riesgo físico a la persona o a otros. En esos casos la prioridad es la seguridad, no eliminar la necesidad sensorial de raíz. 🟢

En el único punto de la ficha que trata autolesión (golpes en la cabeza, mordeduras que lastiman) no se remite en ningún momento a un profesional. El punto siguiente propone directamente que la familia identifique la función y ofrezca una alternativa, lo que invita a manejarlo en casa. La autolesión de aparición o aumento reciente puede ser señal de dolor no comunicado (otitis, dolor dental, migraña, problemas gastrointestinales) o de un problema de salud que requiere valoración médica, y golpearse la cabeza conlleva riesgo físico real. Para una ficha dirigida a padres, omitir la derivación profesional en el apartado de autolesión es una laguna de seguridad.

### Medio · BH. Stimming (conductas autoestimulatorias)

*semáforo demasiado optimista*

> hacer stimming a tiempo puede evitar emociones negativas, crisis (meltdown) o bloqueos (shutdown), y puede aumentar la capacidad de enfocarse, procesar información y tomar decisiones, según la National Autistic Society del Reino Unido. 🟢

La afirmación reproduce el texto de una página divulgativa de una organización, no un hallazgo de investigación. La propia ficha reconoce la fuente ('según la National Autistic Society'), pero la marca 🟢, que en esta biblioteca significa metaanálisis, guías clínicas o ensayos replicados. Las mejoras concretas en 'procesar información y tomar decisiones' no están respaldadas por ningún estudio entre las fuentes listadas. Es la afirmación más ambiciosa de la ficha y la que menos evidencia empírica tiene detrás.

### Medio · BK. Factores prenatales y perinatales asociados (con matices)

*atribuido al estudio equivocado*

> [PMC – Inter-Pregnancy Intervals and the Risk of ASD: población de Dinamarca, Finlandia y Suecia](https://pmc.ncbi.nlm.nih.gov/articles/PMC4474747/)

La etiqueta de la fuente describe una poblacion que no es la del articulo enlazado. El titulo "Inter-Pregnancy Intervals and the Risk of Autism Spectrum Disorder: Results of a Population-Based Study" corresponde a Durkin MS, DuBois LA y Maenner MJ (2015), Journal of Autism and Developmental Disorders 45(7):2056-2066, realizado sobre una cohorte de nacimientos de Wisconsin (Estados Unidos) de 31.467 segundos hijos, no sobre poblacion de Dinamarca, Finlandia y Suecia. El estudio nordico multinacional es otro trabajo distinto (Pereira et al., 2021, Autism Research).

### Medio · BL. Nutrición y suplementos basados en evidencia

*la fuente no lo sostiene*

> la alimentación restringida es muy común en autismo y se asocia a mayor riesgo real de deficiencia de hierro, vitamina D, zinc y otras vitaminas; algunos casos graves han llegado a anemia, escorbuto o encefalopatía de Wernicke.

Es la única afirmación de la ficha marcada 🟢 (evidencia sólida), pero la única fuente de la lista que la cubre es el enlace de Springer, cuyo DOI (10.1186/s13030-020-00182-y, BioPsychoSocial Medicine 2020) corresponde a UN INFORME DE CASO individual: 'Iron deficiency anemia, stunted growth, and developmental delay due to avoidant/restrictive food intake disorder by restricted eating in autism spectrum disorder'. Un caso clínico no sostiene ni la prevalencia ('muy común'), ni el listado de déficits (zinc, vitamina D), ni los casos de escorbuto o encefalopatía de Wernicke, que no aparecen en ninguna fuente listada. La etiqueta del enlace ('Deficiencia de hierro y ARFID en TEA') tampoco adviert

### Medio · C. Autismo en niñas/mujeres y en adultos

*atribuido al estudio equivocado*

> [Wood-Downie 2021 (FAP)](https://link.springer.com/article/10.1007/s40489-020-00197-9)

El DOI 10.1007/s40489-020-00197-9 NO es Wood-Downie 2021: corresponde a Hull, Petrides y Mandy (2020), 'The Female Autism Phenotype and Camouflaging: A Narrative Review', Review Journal of Autism and Developmental Disorders 7:306-317. Wood-Downie y cols. 2021 es otro trabajo distinto (diferencias por sexo/genero en camuflaje en ninos y adolescentes). Es exactamente el error tipico de esta biblioteca: estudio real citado bajo el nombre equivocado. Ademas cambia la naturaleza de la evidencia: lo que se enlaza es una revision NARRATIVA, no un estudio empirico.

### Medio · CA. Terapia del habla y lenguaje (logopedia/fonoaudiología)

*semáforo demasiado optimista*

> **El trabajo con la familia es parte del tratamiento, no un extra:** enfoques recomendados (por ejemplo, intervenciones sociocomunicativas basadas en el juego con padres/cuidadores) forman parte de las guías clínicas como NICE (Reino Unido), que además recomienda **no usar** neurofeedback ni entrenamiento de integración auditiva para tratar problemas de habla y lenguaje en autismo por falta de evi

La viñeta mezcla dos mensajes opuestos bajo un solo semáforo rojo. Según la propia leyenda de la biblioteca, rojo = 'desaconsejado o dañino', de modo que un padre que lea el titular en negrita ('el trabajo con la familia es parte del tratamiento') junto al 🔴 puede entender que la intervención mediada por familia está desaconsejada. Es justo lo contrario: NICE CG170 recomienda considerar una intervención sociocomunicativa específica con estrategias basadas en el juego con padres/cuidadores. El rojo solo corresponde a neurofeedback e integración auditiva.

### Medio · CB. Microbioma intestinal y autismo

*la fuente no lo sostiene*

> clínicas que ofrecen FMT casero, "detox intestinal" o kits de trasplante fecal sin supervisión médica rigurosa exponen a riesgos reales (infecciones, reacciones alérgicas, shock anafiláctico documentado en casos pediátricos) sin evidencia de que mejoren el autismo

Ninguna de las seis fuentes listadas en la ficha documenta un 'shock anafiláctico en casos pediátricos', y las alertas de la FDA citadas se refieren a infecciones (ESBL, STEC/EPEC) en adultos, no a anafilaxia ni a niños. Sí existe un reporte de reacciones alérgicas tras FMT en dos niños autistas (Frontiers in Pediatrics, 2026), pero ocurrió en un contexto clínico supervisado, no en 'FMT casero' ni en kits comerciales: la ficha atribuye el daño a un escenario distinto del documentado y presenta como 'shock anafiláctico' lo que la fuente describe como reacción alérgica. Un dato de seguridad concreto debe ir con la fuente que realmente lo respalda.

### Medio · CC. Sistema inmune, inflamación y la teoría del "intestino permeable"

*atribuido al estudio equivocado*

> la idea de que proteínas del gluten/caseína "escapan" del intestino y "envenenan" el cerebro fue popularizada por Andrew Wakefield, el médico inhabilitado por fraude en el caso de la vacuna triple viral

La atribución histórica es incorrecta y es un flanco fácil para quien defienda estas dietas: basta señalar el error para desacreditar todo el párrafo. La teoría del exceso de opioides (péptidos del gluten y la caseína que atraviesan una barrera intestinal permeable y actúan sobre receptores opioides del cerebro) fue propuesta por Jaak Panksepp en 1979 y difundida sobre todo por Kalle Reichelt y Paul Shattock, quienes promovieron la dieta sin gluten ni caseína desde los años ochenta y noventa — más de una década antes del artículo de Wakefield de 1998. Wakefield sí fue inhabilitado por fraude en el caso de la triple vírica y sí popularizó el vínculo entre problemas intestinales ('enterocoliti

### Medio · CE. Biomarcadores y pruebas emergentes

*dato incorrecto*

> pruebas de microarreglo cromosómico (identifica alteraciones en hasta ~20-40% de los casos)

La cifra está inflada. El rendimiento diagnóstico del microarreglo cromosómico (CMA) en autismo que reporta la literatura clínica es de alrededor del 10-20% para hallazgos clínicamente relevantes, y del orden del 5-15% para variantes claramente patogénicas (frente a ~3% de la citogenética convencional). El rango '20-40%' no aparece en las guías ni en las fuentes citadas, y puede llevar a una familia a sobreestimar mucho la probabilidad de que la prueba genética le dé una respuesta.

### Medio · CJ. Autismo y el sistema de justicia

*semáforo demasiado optimista*

> una tarjeta o pulsera de identificación, practicar con antelación qué hacer si se cruza con la policía ("quédate quieto, mantén las manos visibles, puedes decir 'soy autista'"), y guardar los datos de contacto de familiares accesibles ayudan a reducir malentendidos peligrosos, sobre todo en meltdowns en público. 🟢

Se marca en verde una recomendación práctica para la que no existe evidencia de eficacia en ninguna de las fuentes listadas: ningún estudio citado mide si las tarjetas/pulseras de identificación o el ensayo previo reducen incidentes o detenciones. Es consenso de organizaciones y experiencia práctica, no evidencia sólida. Un verde aquí puede dar a los padres una falsa seguridad sobre la protección real que ofrece una pulsera.

### Medio · CK. Autismo, orientación sexual e identidad (LGBTQ+)

*la fuente no lo sostiene*

> confirma que la mayoría de los adultos autistas está interesada en relaciones sexuales/románticas y que las mujeres autistas reportan una gama más amplia de identidades sexuales que las mujeres no autistas y que los hombres autistas

Weir, Allison y Baron-Cohen (2021, Autism Research 14(11):2342-2354, doi 10.1002/aur.2604) no mide el interés en relaciones sexuales o románticas: mide actividad sexual declarada, riesgo de ITS y orientación en una encuesta online de 2.386 adultos (1.183 autistas). Su resultado es, además, en dirección contraria a como se resume: las personas autistas fueron MENOS propensas a reportar actividad sexual y heterosexualidad, y MÁS propensas a auto-identificarse como asexuales o de orientación 'otra'. Atribuir a este estudio la conclusión de que "la mayoría está interesada en relaciones sexuales/románticas" es hacerle decir algo que no dice, y de paso invisibiliza a las personas autistas asexuale

### Medio · CT. Ser madre/padre autista y el diagnóstico en la adultez

*atribuido al estudio equivocado*

> aunque también deja necesidades emocionales y de apoyo postdiagnóstico sin cubrir (Sinclair-Palm y cols., PMC9889483)

La autoría es falsa. PMC9889483 corresponde a "Exploring the Experiences of Parents Whose Child has Received a Diagnosis of Autistic Spectrum Disorder in Adulthood", de Hannah Legg, Anna Tickle, Alinda Gillott y Sarah Wilde (Journal of Autism and Developmental Disorders, 2023; 53:205-215; estudio cualitativo con 11 progenitores). Sinclair-Palm no firma ese trabajo. El contenido descrito sí coincide con el estudio, pero la cita atribuye el hallazgo a autores que no lo hicieron, lo que impide a una familia (o a un profesional) rastrear la fuente.

### Medio · CV. Síndrome de Rett

*desactualizado*

> **No tiene cura, pero sí manejo eficaz:** el abordaje es sintomático y de apoyo, coordinado por un equipo multidisciplinar (neurología, gastroenterología, ortopedia por la escoliosis, nutrición, terapia física/ocupacional y del habla, manejo de convulsiones), siguiendo guías de consenso internacionales (BMJ Paediatrics Open, 2020)

La ficha describe el manejo del Rett como exclusivamente 'sintomático y de apoyo' y omite por completo que desde el 10 de marzo de 2023 existe un fármaco aprobado por la FDA específicamente para el síndrome de Rett: trofinetide (DAYBUE), indicado en adultos y niños desde los 2 años, con base en el ensayo fase 3 LAVENDER (187 pacientes). Una familia que lea esta ficha en 2026 concluirá que no hay ninguna opción farmacológica aprobada y puede no plantearla a su neurólogo. La afirmación posterior de que 'no existe hoy un tratamiento que revierta la condición' sigue siendo cierta (trofinetide mejora síntomas, no revierte el trastorno), pero no sustituye a esta información.

### Medio · DH. Deporte, ejercicio inclusivo y ocio

*semáforo demasiado optimista*

> el problema no es el deporte de equipo en sí, sino la falta de adaptación o el exceso de presión competitiva. 🟢

La afirmación sobre deporte de equipo adaptado / Unified Sports está marcada en verde (evidencia sólida: metaanálisis, guías clínicas o ensayos replicados), pero las únicas fuentes que la acompañan son la página institucional del propio Special Olympics (no es investigación) y un estudio cualitativo de percepciones de 23 padres (Rodriquez et al., 2022, Int J Environ Res Public Health 19(17):10889), sin grupo control, sin medidas objetivas y con muestra de jóvenes con discapacidad intelectual/del desarrollo en general, no autistas específicamente. Con esa base el semáforo debe ser amarillo.

### Medio · DH. Deporte, ejercicio inclusivo y ocio

*la fuente no lo sostiene*

> mejora la inclusión social, reduce conductas problema y cambia positivamente las actitudes de compañeros sin discapacidad

El estudio citado para este punto (When the Normative Is Formative, Rodriquez et al., 2022) es un análisis temático de 23 entrevistas semiestructuradas a padres de jóvenes con discapacidad intelectual y del desarrollo participantes en Unified Sports. Reporta mejoras PERCIBIDAS por los padres en habilidades sociales y emocionales, sentido de pertenencia y nuevas amistades. No mide ni reporta reducción de conductas problema, ni evalúa el cambio de actitudes de los compañeros sin discapacidad. La ficha atribuye a esa fuente dos resultados que la fuente no contiene.

### Medio · DI. Arte, música y teatro: expresión y bienestar

*la fuente no lo sostiene*

> una revisión Cochrane (26 ensayos, 1.165 participantes) encontró que probablemente aumenta la probabilidad de mejoría global y mejora ligeramente la calidad de vida al final de la terapia, con certeza de la evidencia de baja a moderada; no está claro que mejore la interacción social o la comunicación verbal/no verbal, y no parece aumentar eventos adversos.

Los datos de muestra (26 ensayos, 1.165 participantes) y lo dicho sobre mejoría global, calidad de vida e interacción social son correctos, pero la ficha omite el resultado principal de esa misma revisión Cochrane: la musicoterapia probablemente produce una reducción GRANDE de la gravedad total de los síntomas de autismo (DME −0,83; IC 95% −1,41 a −0,24; 9 estudios, 575 participantes; certeza MODERADA). Al omitirlo y presentar la evidencia como "modesta" y, en el mensaje clave, como "limitada" respecto a los síntomas nucleares, la ficha describe la fuente de forma más pesimista de lo que la fuente sostiene y puede llevar a una familia a descartar una opción con evidencia de certeza moderada.

### Medio · DR. Autismo y salud visual / oftalmologica

*atribuido al estudio equivocado*

> en ese mismo metaanálisis, de los errores de refracción solo el **astigmatismo** mostró un riesgo significativamente mayor en autismo; la miopía y la hipermetropía **no** alcanzaron una asociación estadísticamente significativa. Las prevalencias combinadas fueron aproximadamente astigmatismo 16.5%, miopía 14.1% e hipermetropía 9.8%.

'Ese mismo metaanalisis' remite al de Perna et al. 2023 en Molecular Psychiatry (el citado en la vineta anterior), pero esas tres cifras y el hallazgo de que solo el astigmatismo alcanza significacion proceden de OTRO metaanalisis: 'Refractive Errors Linked to Autism Spectrum Disorders in the Pediatric Population and Young Adults' (Review Journal of Autism and Developmental Disorders, 2024, 28 articulos), que reporta exactamente 14.1% de miopia, 9.8% de hipermetropia y 16.5% de astigmatismo, sin asociacion significativa con miopia ni hipermetropia. Ese trabajo no figura en la linea de Fuentes, asi que tal como esta redactada la ficha ninguna fuente listada respalda las tres cifras. Ademas, l

### Medio · EB. Autismo y educación en casa (homeschooling)

*dato incorrecto*

> **Marco legal (ejemplo Reino Unido):** la National Autistic Society recuerda que en Inglaterra la educación en casa es una opción legal: la educación es obligatoria pero asistir a la escuela no, y la ley no define *cómo* se debe educar en casa; solo exige que sea "adecuada" a la edad, capacidad y aptitud del niño (no se exige título docente, horario fijo ni un currículo específico). 🟢

Unico bloque legal de una ficha escrita en espanol para familias hispanohablantes, y describe solo Inglaterra, en verde y en tono tranquilizador. La educacion en casa NO es una opcion legal equivalente en buena parte de los paises de habla hispana: en Espana no esta reconocida como forma de cumplir la escolarizacion obligatoria (doctrina del Tribunal Constitucional, sentencia 133/2010) y retirar al nino del centro puede desencadenar expediente de absentismo e intervencion de servicios sociales; en varios paises de America Latina esta restringida o requiere autorizacion. Un padre que lea esta ficha puede sacar a su hijo autista de la escuela creyendo que es una via legal disponible. Ademas, l

### Medio · G. Salud mental y seguridad

*redacción confusa*

> Factores asociados: **camuflaje** y **necesidades de apoyo no atendidas** (Cassidy 2018: 72% vs 33%).

Las cifras 72% y 33% no describen el camuflaje ni las necesidades de apoyo no atendidas. En Cassidy, Bradley, Shaw y Baron-Cohen (2018, Molecular Autism 9:42), el 72% de los adultos autistas puntuó por encima del punto de corte clínico de suicidalidad (SBQ-R) frente al 33% del grupo de comparación no autista de la misma encuesta. Colocadas justo después de los dos factores de riesgo, un padre las leerá como "72% de los que camuflan frente a 33% de los que no", que no es lo que dice el estudio. Además el 33% no es una tasa poblacional: es el grupo comparador de una encuesta online autoseleccionada.

### Medio · K. Genética y formas sindrómicas

*dato incorrecto*

> heredabilidad ~**64-91%** (gemelos idénticos concuerdan ~0,98 vs ~0,53 mellizos)

Confunde correlación con concordancia. Los valores 0,98 y 0,53 de Tick et al. 2016 son correlaciones tetracóricas de responsabilidad (liability correlations), no tasas de concordancia entre gemelos. Un padre que lea 'los gemelos idénticos concuerdan ~0,98' entenderá que en el 98% de los casos ambos gemelos son autistas, lo cual es falso: las tasas de concordancia observadas en gemelos monocigóticos están muy por debajo de eso. Además, el 0,53 en dicigóticos está condicionado a asumir una prevalencia poblacional del 5%; con supuestos de prevalencia más baja la correlación DZ sube y la heredabilidad estimada baja (de ahí el rango 64-91%).

### Medio · N. Bienestar de cuidadores y familia

*la fuente no lo sostiene*

> el estrés parental alto puede **afectar al niño y contrarrestar los avances** de la intervención (y se asocia a mayor riesgo de maltrato/negligencia). 🟢

El paréntesis sobre maltrato/negligencia no está respaldado por ninguna de las cinco fuentes listadas: Hayes & Watson 2013 compara niveles de estrés; Yorke 2018 es un metaanálisis de la relación bidireccional entre problemas emocionales/conductuales del niño y distrés parental; Al-Farsi 2016 mide estrés/ansiedad/depresión en Omán; el PLOS ONE 2025 modela predictores de estrés parental en Nueva Zelanda; y el estudio de madres (2024) mide ansiedad+depresión. Ninguno estudia maltrato ni negligencia. Es una afirmación fuerte y potencialmente culpabilizante, dirigida justo a los padres a los que la ficha quiere dar permiso para cuidarse, y va marcada 🟢 (evidencia sólida). También la parte de 'con

### Medio · P. Alimentación selectiva / problemas de alimentación

*dato incorrecto*

> En una cohorte, **76%** tenían problemas de alimentación y **54%** un trastorno de alimentación.

La cohorte es la de Nygren et al. 2021 (Frontiers in Pediatrics 9:780680), un estudio longitudinal prospectivo de 46 niños con TEA en una zona multiétnica de bajos recursos de Gotemburgo, Suecia. Ese estudio reporta 76% con problemas de alimentación y 28% que cumplen criterios de ARFID; entre los 35 niños que sí tenían problemas de alimentación, el 37% cumplía criterios de ARFID. No he podido localizar en ese estudio ni en las demás fuentes listadas ninguna cifra de 54% de 'trastorno de alimentación'. La ficha además usa el 28% correcto dos bullets más abajo, con lo que el 54% queda descolgado y contradictorio.

### Medio · U. Manejo del TDAH co-ocurrente

*atribuido al estudio equivocado*

> [metaanálisis prevalencia TDAH-TEA (Autism Research)](https://onlinelibrary.wiley.com/doi/full/10.1002/aur.3146)

El enlace no es un metaanálisis. DOI 10.1002/aur.3146 corresponde a Canals et al. 2024, «Prevalence of comorbidity of autism and ADHD and associated characteristics in school population: EPINED study» (Autism Research 17(6):1276-1286), un estudio de prevalencia en población escolar de Cataluña. La cifra agrupada de ~40% que la ficha atribuye a un metaanálisis procede en realidad de Rong et al. 2021, que ese artículo solo cita (38,5% prevalencia actual; 40,2% prevalencia vital).

### Medio · X. Intervención temprana

*atribuido al estudio equivocado*

> [Rogers et al. 2019 — ESDM multisitio](https://pmc.ncbi.nlm.nih.gov/articles/PMC4951085/)

PMC4951085 NO es el ensayo multisitio de Rogers 2019: es Dawson et al. 2010, «Randomized, Controlled Trial of an Intervention for Toddlers With Autism: The Early Start Denver Model», el ECA original de 48 niños que la ficha ya cita en el punto anterior. Es decir, el único enlace que respalda el apartado de «honestidad — la replicación fue parcial» lleva al lector al ensayo original positivo, no al que matiza sus resultados. Un padre que quiera comprobar la parte crítica acaba leyendo la parte optimista.

## Temas sin fallos confirmados

A, AC, AF, AG, AJ, AL, AM, AO, AR, AT, AV, AX, AZ, B, BJ, BM, BN, BP, BT, BU, BV, BY, BZ, CD, CF, CG, CH, CI, CN, CP, CQ, CR, CU, CW, CY, D, DB, DC, DF, DG, DJ, DK, DL, DN, DO, DP, DQ, DS, DT, DW, DY, DZ, EA, F, H, M, O, Q, S, T, W, Y

