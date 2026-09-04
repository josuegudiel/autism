export const meta = {
  name: 'investigar-temas-tea',
  description: 'Investiga temas nuevos para la biblioteca de autismo, los verifica en fuente y los somete a tres críticas adversariales',
  whenToUse: 'Rondas de ampliación de la biblioteca, 4 temas como máximo por ronda',
  phases: [
    { title: 'Investigar', detail: 'un investigador por tema' },
    { title: 'Verificar', detail: 'comprueba cada fuente y borra lo que no se sostiene' },
    { title: 'Criticar', detail: 'tres lentes por ficha: seguridad, semáforos y solapamiento' },
    { title: 'Corregir', detail: 'aplica lo que las críticas confirman' },
  ],
}

// Uso:
//   Workflow({ scriptPath: "agente-autismo/scripts/workflows/investigar-temas.mjs",
//              args: { ronda: 25, codigos: ["MM","MN","MO","MP"],
//                      indice: "<ruta al indice de temas>",
//                      temas: [{titulo, porque}, ...] } })
//
// LIMITE DURO: 4 temas por ronda. El presupuesto de WebSearch de la sesion son
// 200 llamadas COMPARTIDAS. 4 investigadores x 15 + 4 verificadores x 15 = 120.
// Las tres criticas NO gastan busquedas a proposito: revisan coherencia interna,
// seguridad y solapamiento, que se comprueban leyendo, no buscando.

const E = typeof args === 'string' ? JSON.parse(args) : args
const TEMAS = (E.temas || []).slice(0, 4)
const CODIGOS = E.codigos
const RONDA = E.ronda
const INDICE = E.indice
const BUSQUEDAS = E.busquedas || 15

const REGLAS = `
REGLAS INNEGOCIABLES
- WEBFETCH NO FUNCIONA EN ESTE ENTORNO: la politica de red devuelve HTTP 403
  para CUALQUIER direccion, incluida example.com. No la llames ni una vez.
  Tu unica herramienta de comprobacion es WebSearch.
- No investigues ni intentes rodear esa restriccion. No toques el proxy, las
  variables de entorno ni archivos del sistema.
- NUNCA inventes ni adivines una URL. Solo puedes citar direcciones que hayas
  visto LITERALMENTE en un resultado de busqueda de esta sesion. Una URL
  reconstruida de memoria es el peor fallo posible aqui: puede llevar a un padre
  a un documento que dice otra cosa.
- Si no puedes verificar algo, NO lo escribas. Una ficha corta y solida vale mas
  que una larga y sin respaldo.
- El publico son padres de niños autistas, muchos sin formacion tecnica y en
  paises de habla hispana con recursos muy desiguales.
`

const FORMATO = `
FORMATO EXACTO DE LA FICHA (markdown, español neutro):

### CODIGO. Titulo del tema — ✅ cubierto (Ronda ${RONDA}, fuentes verificadas)
**Mensaje clave:** dos o tres frases para el padre o la madre, en lenguaje llano.

- **Titulo del punto en negrita:** explicacion, terminada en un semaforo:
  🟢 evidencia solida (metanalisis, revisiones sistematicas, guias clinicas)
  🟡 evidencia limitada o consenso profesional sin ensayos
  🔴 desaconsejado o dañino
  ⚪ experiencia vivida de familias, sin respaldo de estudios
- Entre 5 y 8 puntos.
- Si el tema toca salud: PRIMERO un punto de urgencias (lo que exige ir a
  urgencias hoy), DESPUES uno de "cuando consultar". Nunca al final.
- Nunca des dosis de nada.
- Si algo cambia segun el pais, dilo; no describas un pais como si fuera todos.
- Ningun 🔴 pegado a una recomendacion correcta: en la app el color se muestra
  como etiqueta separada del texto. Si un punto mezcla consejo y advertencia,
  partelo en dos.

**Fuentes:** [Autor, año, que es el trabajo](URL) · [otra](URL) · ...
> **Para la app:** una frase sobre como se usaria esta ficha.
`

const ESQ_FICHA = {
  type: 'object',
  properties: {
    codigo: { type: 'string' }, titulo: { type: 'string' }, markdown: { type: 'string' },
    fuentes_verificadas: { type: 'integer' },
    avisos: { type: 'string', description: 'lo que NO has podido verificar, dicho claramente' },
  },
  required: ['codigo', 'titulo', 'markdown', 'fuentes_verificadas'],
}

const ESQ_VERIF = {
  type: 'object',
  properties: {
    codigo: { type: 'string' }, publicable: { type: 'boolean' }, markdown_final: { type: 'string' },
    fuentes_confirmadas: { type: 'integer' }, fuentes_eliminadas: { type: 'integer' },
    afirmaciones_eliminadas: { type: 'integer' }, informe: { type: 'string' },
  },
  required: ['codigo', 'publicable', 'markdown_final', 'fuentes_confirmadas', 'informe'],
}

const ESQ_CRITICA = {
  type: 'object',
  properties: {
    problemas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gravedad: { type: 'string', enum: ['grave', 'medio', 'leve'] },
          que: { type: 'string', description: 'que esta mal, citando el texto exacto' },
          arreglo: { type: 'string', description: 'como se arregla, concreto' },
        },
        required: ['gravedad', 'que', 'arreglo'],
      },
    },
    veredicto: { type: 'string', description: 'una frase: se puede publicar, o no y por que' },
  },
  required: ['problemas', 'veredicto'],
}

const ESQ_FINAL = {
  type: 'object',
  properties: {
    codigo: { type: 'string' }, publicable: { type: 'boolean' }, markdown_final: { type: 'string' },
    cambios: { type: 'string', description: 'que criticas aplicaste y cuales rechazaste, y por que' },
  },
  required: ['codigo', 'publicable', 'markdown_final', 'cambios'],
}

const LENTES = [
  {
    clave: 'seguridad',
    prompt: `Tu lente: SEGURIDAD DEL NIÑO. No compruebas fuentes: compruebas que
esta ficha no pueda hacer daño si la lee un padre asustado a las tres de la
madrugada.
- ¿Hay algo que sea URGENCIA colocado en "pide cita" o "consulta pronto"? Ese es
  el fallo que mas veces hemos encontrado en esta biblioteca: informacion
  correcta en el escalon de urgencia equivocado.
- ¿El bloque de urgencias esta al principio? Si esta al final de una ficha larga,
  no existe.
- ¿Da dosis de algo? ¿Describe como aplicar algo medico sin profesional?
- ¿Presenta como inocuo algo que no lo es? ¿Falta un "cuando consultar" en un
  tema de salud?
- ¿Hay una recomendacion que, mal entendida, retrase una consulta necesaria?
- Ojo a las construcciones de permiso condicionado: "no debe hacerse SIN X" se
  lee en español como "con X si se puede". Si eso aplica a algo que no debe
  hacerse nunca, es un fallo grave.`,
  },
  {
    clave: 'lectura',
    prompt: `Tu lente: COMO SE LEE ESTO EN LA APP. La ficha se muestra en un movil,
y el semaforo aparece como una ETIQUETA DE COLOR SEPARADA del texto: un padre
que ojea la lista ve el color antes que la frase.
- ¿Hay algun 🔴 pegado a un consejo correcto? Se leeria como "esto no lo hagas".
- ¿Algun punto mezcla una recomendacion y una advertencia bajo un solo color?
  Hay que partirlo en dos puntos.
- ¿Algun 🟢 apoyado en un solo estudio pequeño, en una pagina divulgativa o en
  consenso sin estudios? Debe bajar a 🟡, o a ⚪ si es experiencia de familias.
- ¿El "Mensaje clave" dice de verdad lo que el padre necesita saber primero, en
  lenguaje llano, sin jerga y sin cifras que no entienda?
- ¿Hay parrafos tan largos que en un movil nadie los va a leer?
- ¿El titulo suena a lo que un padre escribiria en un buscador?`,
  },
  {
    clave: 'encaje',
    prompt: `Tu lente: ENCAJE EN LA BIBLIOTECA Y SESGO DE PAIS.
- SOLAPAMIENTO: lee el indice de temas que se te da. ¿Esta ficha repite lo que ya
  dice otra? Nombra cual. Si el solapamiento es grande, dilo como problema grave:
  con mas de 300 temas, duplicar es el riesgo principal.
- SESGO DE PAIS: ¿describe la ley, el sistema sanitario o el circuito educativo
  de un solo pais como si fuera universal? El publico es de toda Hispanoamerica y
  España. Si una parte solo vale para un pais, tiene que decirlo en el texto.
- ¿Presenta como disponible algo (una prueba, un dispositivo, una prestacion) que
  en muchos paises no lo esta?
- ¿Enlaza con las fichas hermanas que le corresponden?
- ¿Falta algo importante que un padre buscaria en este tema y no esta?`,
  },
]

log(`Ronda ${RONDA}: ${TEMAS.length} temas · ${BUSQUEDAS} busquedas por agente de investigacion`)

const fichas = await pipeline(
  TEMAS.map((t, i) => ({ ...t, codigo: CODIGOS[i] })),

  // --- 1. investigar ---
  (t) => agent(`Eres investigador de una biblioteca sobre autismo en español
para padres. Escribe una ficha nueva sobre este tema.

TEMA: ${t.titulo}
CODIGO: ${t.codigo}
POR QUE HACE FALTA: ${t.porque || '(no indicado)'}

${REGLAS}
- Tienes un presupuesto de unas ${BUSQUEDAS} busquedas. Es compartido: si lo
  agotas, dejas ciegos a los demas agentes.
${FORMATO}

COMO TRABAJAR:
1. Busca primero guias clinicas, revisiones sistematicas y organizaciones de
   referencia. Solo despues estudios sueltos.
2. Anota la cifra y la fuente a la vez, y COPIA la URL tal y como aparece en el
   resultado. Si no ves la URL, cita autor, año y revista sin enlace.
3. Distingue lo demostrado, lo que es consenso profesional y lo que es
   experiencia de familias. Los semaforos existen para eso.
4. En "avisos", di sin rodeos que has dejado sin verificar.

Empieza el markdown por la linea "### ${t.codigo}. ".`, {
      label: `investigar:${t.codigo}`, phase: 'Investigar', schema: ESQ_FICHA,
    }),

  // --- 2. verificar en fuente ---
  (ficha, t) => {
    if (!ficha || !ficha.markdown) return null
    return agent(`Eres el filtro de fuentes. Otro agente ha escrito esta ficha.
Tu trabajo no es mejorarla: es DEPURARLA. Deja solo lo que puedas confirmar.

FICHA PROPUESTA (tema: ${t.titulo}):
---
${ficha.markdown}
---
Lo que el autor dice haber dejado sin verificar: ${ficha.avisos || 'nada'}

${REGLAS}
- Tienes unas ${BUSQUEDAS} busquedas. Gastalas en este orden: 1º las cifras que
  un padre usaria para decidir, 2º las fuentes de los puntos de seguridad,
  3º el resto.

QUE COMPROBAR:
1. CADA FUENTE: busca titulo, autoria y año. ¿Existe? ¿Es lo que la etiqueta
   dice? ¿Sostiene la afirmacion que acompaña? Si no lo encuentras o dice otra
   cosa: BORRA la fuente Y la afirmacion que dependia de ella.
2. CADA URL: solo se conserva si TU la has visto en un resultado de busqueda de
   esta sesion. Si no, quita el enlace y deja la cita en texto.
3. CADA CIFRA: confirmala contra el resumen. Si no aparece, borrala.

"markdown_final": la ficha depurada, mismo formato. Puede quedar bastante mas
corta: eso es exito. "publicable": true solo si lo que queda esta confirmado y
la ficha sigue siendo util.`, {
      label: `verificar:${t.codigo}`, phase: 'Verificar', schema: ESQ_VERIF,
    }).then((v) => ({ ...(v || {}), codigo: t.codigo, titulo: ficha.titulo || t.titulo }))
      .catch(() => ({ codigo: t.codigo, titulo: t.titulo, publicable: false,
                      markdown_final: ficha.markdown, fuentes_confirmadas: 0,
                      informe: 'SIN VERIFICAR: el verificador fallo.' }))
  },

  // --- 3. tres criticas adversariales, sin gastar busquedas ---
  (verif, t) => {
    if (!verif || !verif.markdown_final) return null
    return parallel(LENTES.map((l) => () =>
      agent(`Eres un critico adversarial. Esta ficha va a publicarse en una
biblioteca sobre autismo que usan padres reales. Tu trabajo es encontrar lo que
esta mal ANTES de que se publique.

${l.prompt}

NO USES BUSQUEDAS WEB. Todo lo que tienes que revisar se comprueba leyendo.
Otro agente ya ha verificado las fuentes; no repitas ese trabajo.
${INDICE ? `\nINDICE DE LOS TEMAS QUE YA EXISTEN: ${INDICE}\n(leelo con Read si tu lente lo necesita)` : ''}

FICHA A CRITICAR (tema: ${t.titulo}):
---
${verif.markdown_final}
---

Para cada problema: cita el texto exacto, di por que esta mal y como se arregla.
Se concreto. Si la ficha esta bien en tu lente, devuelve la lista vacia: no
inventes problemas para parecer riguroso.`, {
        label: `criticar:${t.codigo}/${l.clave}`, phase: 'Criticar', schema: ESQ_CRITICA,
      })
    // Se etiqueta cada critica con su lente ANTES de filtrar: si un critico
    // muere, filtrar primero desplazaria los indices y las criticas quedarian
    // atribuidas a la lente equivocada.
    )).then((cs) => ({
      verif,
      criticas: cs.map((c, i) => (c ? { ...c, lente: LENTES[i].clave } : null)).filter(Boolean),
    }))
  },

  // --- 4. aplicar lo que las criticas confirman ---
  (paso, t) => {
    if (!paso || !paso.verif) return null
    const { verif, criticas } = paso
    const todos = criticas.flatMap((c) =>
      (c.problemas || []).map((p) => ({ lente: c.lente, ...p })))
    if (!todos.length) {
      return { codigo: t.codigo, titulo: verif.titulo, publicable: verif.publicable,
               markdown_final: verif.markdown_final, informe: verif.informe,
               fuentes_confirmadas: verif.fuentes_confirmadas || 0,
               fuentes_eliminadas: verif.fuentes_eliminadas || 0,
               afirmaciones_eliminadas: verif.afirmaciones_eliminadas || 0,
               criticas_total: 0, criticas_aplicadas: 'ninguna: las tres lentes no encontraron nada' }
    }
    return agent(`Eres el editor final. Tres criticos han revisado esta ficha con
lentes distintas. Aplica lo que sea correcto y rechaza lo que no.

FICHA ACTUAL (tema: ${t.titulo}):
---
${verif.markdown_final}
---

PROBLEMAS SEÑALADOS:
${todos.map((p, i) => `${i + 1}. [${p.gravedad}, lente ${p.lente}] ${p.que}\n   ARREGLO PROPUESTO: ${p.arreglo}`).join('\n')}

REGLAS PARA EDITAR:
- NO USES BUSQUEDAS WEB. No puedes añadir ninguna fuente ni cifra nueva: solo
  reordenar, partir puntos, cambiar semaforos, acortar, matizar o borrar.
- Aplica SIEMPRE los problemas de seguridad: subir una urgencia al principio,
  partir un punto que mezcla consejo y advertencia, quitar una dosis, añadir un
  "cuando consultar" con lo que ya esta escrito en la ficha.
- Aplica los de semaforo: bajar un 🟢 sin respaldo, despegar un 🔴 de un consejo.
- RECHAZA una critica si te pide añadir informacion que no puedes verificar, si
  se basa en algo que la ficha ya dice mas abajo, o si empeoraria el texto. Di
  cuales rechazaste y por que.
- Si un critico dice que la ficha se solapa con otra existente y tiene razon,
  ponlo en "cambios" y marca publicable=false: mejor no publicar un duplicado.

Devuelve la ficha entera y ya corregida en "markdown_final", con el mismo
formato (### CODIGO. Titulo — estado / Mensaje clave / puntos con semaforo /
**Fuentes:** / > **Para la app:**).`, {
      label: `corregir:${t.codigo}`, phase: 'Corregir', schema: ESQ_FINAL,
    }).then((fin) => ({
      codigo: t.codigo, titulo: verif.titulo,
      publicable: fin ? fin.publicable : verif.publicable,
      markdown_final: (fin && fin.markdown_final) || verif.markdown_final,
      informe: verif.informe,
      fuentes_confirmadas: verif.fuentes_confirmadas || 0,
      fuentes_eliminadas: verif.fuentes_eliminadas || 0,
      afirmaciones_eliminadas: verif.afirmaciones_eliminadas || 0,
      criticas_total: todos.length,
      criticas_graves: todos.filter((p) => p.gravedad === 'grave').length,
      criticas_aplicadas: (fin && fin.cambios) || 'el editor final fallo; se publica la version verificada',
    })).catch(() => ({
      codigo: t.codigo, titulo: verif.titulo, publicable: verif.publicable,
      markdown_final: verif.markdown_final, informe: verif.informe,
      fuentes_confirmadas: verif.fuentes_confirmadas || 0,
      fuentes_eliminadas: verif.fuentes_eliminadas || 0,
      afirmaciones_eliminadas: verif.afirmaciones_eliminadas || 0,
      criticas_total: todos.length, criticas_graves: todos.filter((p) => p.gravedad === 'grave').length,
      criticas_aplicadas: 'el editor final fallo; se publica la version verificada',
    }))
  }
)

const salida = fichas.filter(Boolean)
log(`Ronda ${RONDA}: ${salida.length} fichas · publicables ${salida.filter((f) => f.publicable).length} · criticas ${salida.reduce((n, f) => n + (f.criticas_total || 0), 0)}`)
return { ronda: RONDA, fichas: salida }
