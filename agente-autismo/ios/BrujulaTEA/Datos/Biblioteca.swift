import Foundation
import Observation

// MARK: - Estados y errores

enum ErrorBiblioteca: LocalizedError {
    case archivoNoEncontrado(String)

    var errorDescription: String? {
        switch self {
        case .archivoNoEncontrado(let nombre):
            return "No se encontró \(nombre) dentro de la app. Añádelo al target en Xcode."
        }
    }
}

enum EstadoCarga: Equatable {
    case inactivo
    case cargando
    case listo
    case fallo(String)
}

// MARK: - Búsqueda

struct ResultadoBusqueda: Identifiable, Hashable {
    enum Confianza: Int, Comparable, Hashable {
        case baja = 0
        case media = 1
        case alta = 2

        static func < (izquierda: Confianza, derecha: Confianza) -> Bool {
            izquierda.rawValue < derecha.rawValue
        }
    }

    let tema: TemaResumen
    let puntuacion: Double
    let confianza: Confianza
    /// Por qué salió este resultado, ej: "Coincide con «no duerme»".
    let motivo: String?

    var id: String { tema.codigo }
}

// MARK: - Detector

enum NivelVeredicto: Hashable {
    case respaldado
    case cautela
    case desaconsejado

    var titulo: String {
        switch self {
        case .respaldado: return "Con respaldo"
        case .cautela: return "Con cautela"
        case .desaconsejado: return "Desaconsejado"
        }
    }

    var explicacion: String {
        switch self {
        case .respaldado: return "La evidencia disponible lo apoya."
        case .cautela: return "La evidencia es mixta o insuficiente. Consúltalo con tu equipo sanitario."
        case .desaconsejado: return "La evidencia desaconseja su uso."
        }
    }

    var simbolo: String {
        switch self {
        case .respaldado: return "checkmark.seal"
        case .cautela: return "exclamationmark.triangle"
        case .desaconsejado: return "xmark.octagon"
        }
    }
}

struct Veredicto: Identifiable, Hashable {
    let tema: TemaResumen
    let nivel: NivelVeredicto

    var id: String { tema.codigo }
}

/// Resultado del detector. Si la coincidencia es débil NO se da veredicto:
/// se pregunta a cuál se refiere la persona.
enum ResultadoDetector {
    case vacio
    case sinDatos(String)
    case ambiguo([ResultadoBusqueda])
    case claro(Veredicto)
}

// MARK: - Biblioteca

@MainActor
@Observable
final class Biblioteca {

    private(set) var estado: EstadoCarga = .inactivo
    private(set) var estadoAyuda: EstadoCarga = .inactivo
    private(set) var indice: IndiceBiblioteca?
    private(set) var ayuda: AyudaUrgente?

    private var indexados: [TemaIndexado] = []
    private var sinonimos: [SinonimoIndexado] = []
    private var cuerpos: [String: TemaCuerpo] = [:]
    private var cacheBloques: [String: [BloqueMarkdown]] = [:]
    private var tareaCuerpo: Task<[String: TemaCuerpo], Error>?

    // MARK: Datos derivados

    var temas: [TemaResumen] { indice?.temas ?? [] }
    var categorias: [CategoriaResumen] { indice?.categorias ?? [] }
    var totalTemas: Int { indice?.totalTemas ?? temas.count }
    var totalVerificados: Int { indice?.verificados ?? 0 }
    var totalFuentes: Int { indice?.totalFuentes ?? 0 }
    var estaListo: Bool { estado == .listo }

    func temas(deCategoria clave: String) -> [TemaResumen] {
        temas.filter { $0.categoria == clave }.sorted { $0.titulo < $1.titulo }
    }

    func tema(codigo: String) -> TemaResumen? {
        indexados.first { $0.tema.codigo == codigo }?.tema
    }

    /// Clave de la categoría de pseudociencias (tolera variantes de nombre).
    var clavePseudociencia: String? {
        if let coincidencia = categorias.first(where: {
            Self.normalizar($0.clave).contains("pseudo") || Self.normalizar($0.nombre).contains("pseudo")
        }) {
            return coincidencia.clave
        }
        return temas.first { Self.normalizar($0.categoria).contains("pseudo") }?.categoria
    }

    // MARK: Carga

    /// Índice al arrancar. El cuerpo (1,6 MB) no se toca aquí.
    func cargarIndice() async {
        if estado == .cargando || estado == .listo { return }
        estado = .cargando
        do {
            let cargado = try await Self.decodificar(IndiceBiblioteca.self, recurso: "biblioteca-indice")
            aplicar(cargado)
            estado = .listo
        } catch {
            estado = .fallo(error.localizedDescription)
        }
    }

    func cargarAyuda() async {
        if estadoAyuda == .cargando || estadoAyuda == .listo { return }
        estadoAyuda = .cargando
        do {
            ayuda = try await Self.decodificar(AyudaUrgente.self, recurso: "ayuda-urgente")
            estadoAyuda = .listo
        } catch {
            estadoAyuda = .fallo(error.localizedDescription)
        }
    }

    /// Carga perezosa del cuerpo: solo al abrir el primer tema, y una única vez.
    func cuerpo(de codigo: String) async throws -> TemaCuerpo? {
        if let guardado = cuerpos[codigo] { return guardado }

        let tarea: Task<[String: TemaCuerpo], Error>
        if let enCurso = tareaCuerpo {
            tarea = enCurso
        } else {
            let nueva = Task<[String: TemaCuerpo], Error> {
                try await Self.decodificar([String: TemaCuerpo].self, recurso: "biblioteca-cuerpo")
            }
            tareaCuerpo = nueva
            tarea = nueva
        }

        do {
            let diccionario = try await tarea.value
            cuerpos = diccionario
            return diccionario[codigo]
        } catch {
            tareaCuerpo = nil   // permitimos reintentar
            throw error
        }
    }

    /// Bloques ya interpretados, con caché por código de tema.
    func bloques(de cuerpo: TemaCuerpo) -> [BloqueMarkdown] {
        if let guardados = cacheBloques[cuerpo.codigo] { return guardados }
        let nuevos = MarkdownLigero.analizar(cuerpo.cuerpo)
        cacheBloques[cuerpo.codigo] = nuevos
        return nuevos
    }

    private nonisolated static func decodificar<T: Decodable & Sendable>(
        _ tipo: T.Type,
        recurso: String
    ) async throws -> T {
        try await Task.detached(priority: .userInitiated) {
            guard let url = Bundle.main.url(forResource: recurso, withExtension: "json") else {
                throw ErrorBiblioteca.archivoNoEncontrado("\(recurso).json")
            }
            let datos = try Data(contentsOf: url, options: [.mappedIfSafe])
            return try JSONDecoder().decode(T.self, from: datos)
        }.value
    }

    private func aplicar(_ cargado: IndiceBiblioteca) {
        indice = cargado
        indexados = cargado.temas.map { tema in
            let tituloNorm = Self.normalizar(tema.titulo)
            return TemaIndexado(
                tema: tema,
                tituloNorm: tituloNorm,
                tokensTitulo: Set(tituloNorm.split(separator: " ").map(String.init)),
                clavesNorm: tema.claves.map(Self.normalizar).filter { !$0.isEmpty },
                mensajeNorm: Self.normalizar(tema.mensaje)
            )
        }
        sinonimos = cargado.sinonimos.compactMap { (par: (key: String, value: [String])) -> SinonimoIndexado? in
            let frase = par.key
            let codigos = par.value
            let normalizada = Self.normalizar(frase)
            guard !normalizada.isEmpty, !codigos.isEmpty else { return nil }
            let palabras = Set(normalizada.split(separator: " ").map(String.init).filter { $0.count >= 3 })
            return SinonimoIndexado(original: frase,
                                    fraseNorm: normalizada,
                                    palabras: palabras,
                                    codigos: codigos)
        }
    }

    // MARK: Motor de búsqueda

    /// Palabras vacías del español que no deben puntuar por sí solas.
    private static let vacias: Set<String> = [
        "que", "los", "las", "con", "por", "para", "como", "mas", "muy", "del", "una", "uno",
        "sus", "sin", "esta", "este", "esto", "hay", "son", "pero", "cuando", "porque", "sobre",
        "hijo", "hija", "nino", "nina", "mio", "mia", "tiene", "hace", "todo", "toda", "cada"
    ]

    /// Minúsculas, sin acentos y sin signos: "¿Por qué NO duerme?" -> "por que no duerme".
    static func normalizar(_ texto: String) -> String {
        let plegado = texto.folding(options: [.diacriticInsensitive, .caseInsensitive, .widthInsensitive],
                                    locale: Locale(identifier: "es_ES"))
        let caracteres = plegado.map { caracter -> Character in
            (caracter.isLetter || caracter.isNumber) ? caracter : " "
        }
        return String(caracteres).split(separator: " ").joined(separator: " ")
    }

    /// Búsqueda en lenguaje natural. Devuelve siempre una lista ordenada,
    /// nunca un único resultado adivinado.
    func buscar(_ consulta: String, en categoria: String? = nil, limite: Int = 40) -> [ResultadoBusqueda] {
        let normalizada = Self.normalizar(consulta)
        guard normalizada.count >= 3 else { return [] }

        let todosLosTokens = normalizada.split(separator: " ").map(String.init)
        let utiles = todosLosTokens.filter { $0.count >= 3 && !Self.vacias.contains($0) }
        let tokens = utiles.isEmpty ? todosLosTokens : utiles
        let conjunto = Set(tokens)

        // 1) Diccionario de sinónimos: impulso fuerte a los códigos asociados.
        var impulsos: [String: Double] = [:]
        var motivos: [String: String] = [:]
        var fuertes: Set<String> = []

        for sinonimo in sinonimos {
            var impulso = 0.0
            if !sinonimo.fraseNorm.isEmpty, normalizada.contains(sinonimo.fraseNorm) {
                impulso = 1000
            } else if !sinonimo.palabras.isEmpty {
                let comunes = sinonimo.palabras.intersection(conjunto).count
                if comunes == sinonimo.palabras.count {
                    impulso = 720
                } else if comunes > 0 {
                    impulso = 320 * (Double(comunes) / Double(sinonimo.palabras.count))
                }
            }
            guard impulso > 0 else { continue }
            for codigo in sinonimo.codigos {
                impulsos[codigo, default: 0] += impulso
                if impulso >= 700 {
                    fuertes.insert(codigo)
                    if motivos[codigo] == nil {
                        motivos[codigo] = "Coincide con «\(sinonimo.original)»"
                    }
                }
            }
        }

        // 2) Puntuación por título (alto), claves (medio) y mensaje (bajo).
        var resultados: [ResultadoBusqueda] = []

        for indexado in indexados {
            if let categoria, indexado.tema.categoria != categoria { continue }

            let codigo = indexado.tema.codigo
            var puntos = impulsos[codigo] ?? 0
            var motivo = motivos[codigo]
            var esFuerte = fuertes.contains(codigo)

            if indexado.tituloNorm == normalizada {
                puntos += 900
                esFuerte = true
                motivo = motivo ?? "Coincide con el título"
            } else if !indexado.tituloNorm.isEmpty, indexado.tituloNorm.contains(normalizada) {
                puntos += 520
                esFuerte = true
                motivo = motivo ?? "Coincide con el título"
            } else if indexado.tituloNorm.count >= 4, normalizada.contains(indexado.tituloNorm) {
                puntos += 400
                esFuerte = true
                motivo = motivo ?? "Coincide con el título"
            }

            for token in tokens where indexado.tokensTitulo.contains(token) {
                puntos += 130
            }

            var puntosClaves = 0.0
            for clave in indexado.clavesNorm {
                if clave == normalizada {
                    puntosClaves += 260
                    esFuerte = true
                    motivo = motivo ?? "Palabra clave: \(clave)"
                } else if clave.contains(normalizada) {
                    puntosClaves += 140
                    motivo = motivo ?? "Palabra clave: \(clave)"
                } else {
                    for token in tokens {
                        if clave == token {
                            puntosClaves += 80
                        } else if clave.contains(token) {
                            puntosClaves += 40
                        }
                    }
                }
            }
            puntos += min(puntosClaves, 420)

            if !indexado.mensajeNorm.isEmpty, indexado.mensajeNorm.contains(normalizada) {
                puntos += 60
            }
            var puntosMensaje = 0.0
            for token in tokens where indexado.mensajeNorm.contains(token) {
                puntosMensaje += 16
            }
            puntos += min(puntosMensaje, 90)

            guard puntos > 0 else { continue }
            if indexado.tema.verificado { puntos += 12 }

            let confianza: ResultadoBusqueda.Confianza
            if esFuerte && puntos >= 500 {
                confianza = .alta
            } else if puntos >= 250 {
                confianza = .media
            } else {
                confianza = .baja
            }

            resultados.append(ResultadoBusqueda(tema: indexado.tema,
                                                puntuacion: puntos,
                                                confianza: confianza,
                                                motivo: motivo))
        }

        resultados.sort {
            $0.puntuacion == $1.puntuacion ? $0.tema.titulo < $1.tema.titulo : $0.puntuacion > $1.puntuacion
        }
        return Array(resultados.prefix(limite))
    }

    /// Temas cercanos: misma categoría y palabras clave compartidas.
    func relacionados(de tema: TemaResumen, limite: Int = 6) -> [TemaResumen] {
        let claves = Set(tema.claves.map(Self.normalizar))
        var puntuados: [(tema: TemaResumen, puntos: Int)] = []

        for indexado in indexados where indexado.tema.codigo != tema.codigo {
            var puntos = 0
            if indexado.tema.categoria == tema.categoria { puntos += 2 }
            puntos += Set(indexado.clavesNorm).intersection(claves).count * 3
            if puntos > 0 { puntuados.append((indexado.tema, puntos)) }
        }

        puntuados.sort {
            $0.puntos == $1.puntos ? $0.tema.titulo < $1.tema.titulo : $0.puntos > $1.puntos
        }
        return puntuados.prefix(limite).map(\.tema)
    }

    // MARK: Detector

    /// Nunca inventa un veredicto: si la coincidencia no es clara, devuelve
    /// candidatos para que la familia elija.
    func evaluarDetector(_ consulta: String) -> ResultadoDetector {
        let normalizada = Self.normalizar(consulta)
        guard normalizada.count >= 3 else { return .vacio }
        guard let clave = clavePseudociencia else { return .sinDatos(consulta) }

        let resultados = buscar(consulta, en: clave, limite: 8)
        guard let mejor = resultados.first else { return .sinDatos(consulta) }

        let segunda = resultados.count > 1 ? resultados[1].puntuacion : 0
        let destacaClaramente = segunda == 0 || mejor.puntuacion >= segunda * 1.5

        guard mejor.confianza == .alta, destacaClaramente else {
            return .ambiguo(Array(resultados.prefix(5)))
        }
        return .claro(Veredicto(tema: mejor.tema, nivel: Self.nivel(de: mejor.tema)))
    }

    /// Ejemplos que se ofrecen en el detector cuando aún no se ha escrito nada.
    func ejemplosDetector(limite: Int = 6) -> [TemaResumen] {
        guard let clave = clavePseudociencia else { return [] }
        return Array(temas(deCategoria: clave).prefix(limite))
    }

    private static func nivel(de tema: TemaResumen) -> NivelVeredicto {
        let semaforos = tema.semaforos
        if semaforos.rojo > 0 && semaforos.rojo >= semaforos.verde {
            return .desaconsejado
        }
        if semaforos.verde > 0 && semaforos.verde > semaforos.amarillo + semaforos.rojo {
            return .respaldado
        }
        return .cautela
    }

    // MARK: Índices internos

    private struct TemaIndexado {
        let tema: TemaResumen
        let tituloNorm: String
        let tokensTitulo: Set<String>
        let clavesNorm: [String]
        let mensajeNorm: String
    }

    private struct SinonimoIndexado {
        let original: String
        let fraseNorm: String
        let palabras: Set<String>
        let codigos: [String]
    }
}
