export const meta = {
  name: 'detectar-huecos-tea',
  description: 'Busca qué temas faltan en la biblioteca de autismo y devuelve una reserva ordenada para las próximas rondas',
  whenToUse: 'Cuando se agota la reserva de temas y hace falta volver a mirar qué falta',
  phases: [
    { title: 'Huecos', detail: 'tres analistas con lentes distintas' },
    { title: 'Elegir', detail: 'depura duplicados y ordena por valor' },
  ],
}

// Uso:
//   Workflow({ scriptPath: "agente-autismo/scripts/workflows/detectar-huecos.mjs",
//              args: { indice: "<ruta a un .txt con un titulo por linea>" } })
//
// Gasta pocas busquedas a proposito: el trabajo es leer el indice y pensar, no
// investigar. La investigacion la hace despues investigar-temas.mjs, de 4 en 4.

const E = typeof args === 'string' ? JSON.parse(args) : args
const INDICE = E.indice

const ESQUEMA_HUECOS = {
  type: 'object',
  properties: {
    huecos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          porque: { type: 'string', description: 'para que le sirve al padre Y por que no lo cubre ninguna ficha (nombra las mas cercanas)' },
          valor: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
        },
        required: ['titulo', 'porque', 'valor'],
      },
    },
  },
  required: ['huecos'],
}

const ESQUEMA_SELECCION = {
  type: 'object',
  properties: {
    reserva: {
      type: 'array',
      description: 'todos los huecos validos, sin duplicados, ordenados por valor',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          porque: { type: 'string' },
        },
        required: ['titulo', 'porque'],
      },
    },
    descartados: { type: 'string', description: 'que has tirado y por que' },
  },
  required: ['reserva'],
}

const LENTES = [
  { clave: 'salud', prompt: `Tu lente: SALUD Y CLINICA. Condiciones que acompañan al autismo,
procedimientos sanitarios, urgencias, medicacion, salud mental, salud de la
mujer, envejecimiento, odontologia, cirugia y anestesia, epilepsia,
alimentacion, sueño, dolor.` },
  { clave: 'vida', prompt: `Tu lente: VIDA DIARIA Y FAMILIA. Rutinas, transiciones, ocio,
viajes, vacaciones, mudanzas, animales de compañia, celebraciones, tecnologia,
dinero, hermanos, abuelos, separacion de los padres, cuidadores externos, el
barrio, el transporte.` },
  { clave: 'derechos', prompt: `Tu lente: DERECHOS, EDUCACION Y ADULTEZ. Tramites,
prestaciones, valoracion de discapacidad, atencion temprana, sistema educativo,
transicion a la vida adulta, empleo, vivienda, justicia, proteccion juridica, y
como todo esto cambia entre paises de habla hispana.` },
]

phase('Huecos')
const propuestas = await parallel(LENTES.map((l) => () =>
  agent(`Eres un especialista en autismo revisando una biblioteca en español
dirigida a padres. Tu trabajo es encontrar QUE FALTA.

${l.prompt}

INDICE COMPLETO DE LO QUE YA EXISTE: ${INDICE}
Leelo ENTERO con Read antes de proponer nada.

Propon entre 8 y 12 temas que NO esten ya cubiertos.

CRITERIOS:
- Un tema es un hueco real solo si NO lo cubre ninguna ficha del indice. Muchos
  titulos cubren mas de lo que parece: leelos con cuidado.
- Prioriza lo que un padre buscaria de verdad en un momento concreto de su vida,
  no lo que quedaria bien en un temario.
- Prioriza lo que se puede documentar. Sin literatura ni guias detras, no sirve.
- Marca "alto" solo si afecta a la seguridad, a la salud o a una decision
  importante, y hoy no esta en ninguna parte.
- No propongas temas de un pais concreto: ya hay 15 fichas por paises.

En "porque" explica DOS cosas: para que le sirve al padre, y por que no lo cubre
ninguna ficha existente (nombra las mas cercanas). Si has visto que alguna cifra
tipica del tema es dudosa o varia mucho entre estudios, avisalo ahi: quien
redacte la ficha lo necesita.

No hace falta que investigues el tema a fondo: basta con que sepas que existe
literatura. Usa pocas busquedas.`, {
    label: `huecos:${l.clave}`,
    phase: 'Huecos',
    schema: ESQUEMA_HUECOS,
  })
))

const todos = propuestas.filter(Boolean).flatMap((p) => p.huecos || [])
log(`Huecos propuestos: ${todos.length}`)
if (!todos.length) return { reserva: [] }

phase('Elegir')
const sel = await agent(`Tres especialistas han propuesto temas que faltan en una
biblioteca sobre autismo para padres. Depuralos y ordenalos.

INDICE DE LO QUE YA EXISTE: ${INDICE}   (leelo con Read antes de decidir)

PROPUESTAS:
${todos.map((h, i) => `${i + 1}. [${h.valor}] ${h.titulo}\n   ${h.porque}`).join('\n')}

TU TRABAJO:
1. ELIMINA los que ya esten cubiertos por una ficha existente. Se estricto: con
   mas de 300 temas, el solapamiento es el riesgo principal. Si dudas, fuera.
2. FUSIONA duplicados y casi duplicados en un solo tema con el mejor titulo.
3. ORDENA por valor real para una familia: primero seguridad y salud, luego
   decisiones importantes, luego vida diaria.
4. Devuelve TODOS los que sigan siendo validos en "reserva", ya ordenados.
5. Conserva en "porque" los avisos sobre cifras dudosas: quien redacte los necesita.

Los titulos deben sonar a lo que un padre escribiria en un buscador, no a
titulo de manual.`, {
  label: 'elegir-huecos',
  phase: 'Elegir',
  schema: ESQUEMA_SELECCION,
})

log(`Reserva nueva: ${(sel?.reserva || []).length} temas`)
return { reserva: sel?.reserva || [], descartados: sel?.descartados || '' }
