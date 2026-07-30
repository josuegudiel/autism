import Foundation

// MARK: - Índice (biblioteca-indice.json)

/// Índice ligero que se carga al arrancar la app (~295 KB).
struct IndiceBiblioteca: Codable, Sendable {
    let totalTemas: Int
    let verificados: Int
    let totalFuentes: Int
    let categorias: [CategoriaResumen]
    /// Frase en lenguaje natural -> códigos de tema. Ej: "no duerme" -> ["W", "EN"]
    let sinonimos: [String: [String]]
    let temas: [TemaResumen]

    init(totalTemas: Int,
         verificados: Int,
         totalFuentes: Int,
         categorias: [CategoriaResumen],
         sinonimos: [String: [String]],
         temas: [TemaResumen]) {
        self.totalTemas = totalTemas
        self.verificados = verificados
        self.totalFuentes = totalFuentes
        self.categorias = categorias
        self.sinonimos = sinonimos
        self.temas = temas
    }

    // Decodificación tolerante: si falta un campo la app no se cae.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let listaTemas = try c.decodeIfPresent([TemaResumen].self, forKey: .temas) ?? []
        temas = listaTemas
        categorias = try c.decodeIfPresent([CategoriaResumen].self, forKey: .categorias) ?? []
        sinonimos = try c.decodeIfPresent([String: [String]].self, forKey: .sinonimos) ?? [:]
        totalTemas = try c.decodeIfPresent(Int.self, forKey: .totalTemas) ?? listaTemas.count
        verificados = try c.decodeIfPresent(Int.self, forKey: .verificados)
            ?? listaTemas.filter { $0.verificado }.count
        totalFuentes = try c.decodeIfPresent(Int.self, forKey: .totalFuentes)
            ?? listaTemas.reduce(0) { $0 + $1.nFuentes }
    }
}

struct CategoriaResumen: Codable, Hashable, Identifiable, Sendable {
    let clave: String
    let nombre: String
    /// Número de temas de la categoría.
    let n: Int

    var id: String { clave }

    init(clave: String, nombre: String, n: Int) {
        self.clave = clave
        self.nombre = nombre
        self.n = n
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let claveLeida = try c.decodeIfPresent(String.self, forKey: .clave) ?? ""
        clave = claveLeida
        nombre = try c.decodeIfPresent(String.self, forKey: .nombre) ?? claveLeida.capitalized
        n = try c.decodeIfPresent(Int.self, forKey: .n) ?? 0
    }
}

/// Recuento de marcadores de evidencia dentro de un tema.
struct Semaforos: Codable, Hashable, Sendable {
    let verde: Int
    let amarillo: Int
    let rojo: Int
    let vivencial: Int

    static let vacio = Semaforos(verde: 0, amarillo: 0, rojo: 0, vivencial: 0)

    var total: Int { verde + amarillo + rojo + vivencial }

    init(verde: Int, amarillo: Int, rojo: Int, vivencial: Int) {
        self.verde = verde
        self.amarillo = amarillo
        self.rojo = rojo
        self.vivencial = vivencial
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        verde = try c.decodeIfPresent(Int.self, forKey: .verde) ?? 0
        amarillo = try c.decodeIfPresent(Int.self, forKey: .amarillo) ?? 0
        rojo = try c.decodeIfPresent(Int.self, forKey: .rojo) ?? 0
        vivencial = try c.decodeIfPresent(Int.self, forKey: .vivencial) ?? 0
    }
}

struct TemaResumen: Codable, Hashable, Identifiable, Sendable {
    let codigo: String
    let titulo: String
    let categoria: String
    let categoriaNombre: String
    let verificado: Bool
    /// Mensaje clave en una frase, pensado para leerse de un vistazo.
    let mensaje: String
    let nFuentes: Int
    let semaforos: Semaforos
    let claves: [String]

    var id: String { codigo }

    init(codigo: String,
         titulo: String,
         categoria: String,
         categoriaNombre: String,
         verificado: Bool,
         mensaje: String,
         nFuentes: Int,
         semaforos: Semaforos,
         claves: [String]) {
        self.codigo = codigo
        self.titulo = titulo
        self.categoria = categoria
        self.categoriaNombre = categoriaNombre
        self.verificado = verificado
        self.mensaje = mensaje
        self.nFuentes = nFuentes
        self.semaforos = semaforos
        self.claves = claves
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        codigo = try c.decodeIfPresent(String.self, forKey: .codigo) ?? ""
        titulo = try c.decodeIfPresent(String.self, forKey: .titulo) ?? ""
        categoria = try c.decodeIfPresent(String.self, forKey: .categoria) ?? ""
        categoriaNombre = try c.decodeIfPresent(String.self, forKey: .categoriaNombre) ?? ""
        verificado = try c.decodeIfPresent(Bool.self, forKey: .verificado) ?? false
        mensaje = try c.decodeIfPresent(String.self, forKey: .mensaje) ?? ""
        nFuentes = try c.decodeIfPresent(Int.self, forKey: .nFuentes) ?? 0
        semaforos = try c.decodeIfPresent(Semaforos.self, forKey: .semaforos) ?? .vacio
        claves = try c.decodeIfPresent([String].self, forKey: .claves) ?? []
    }
}

// MARK: - Cuerpo (biblioteca-cuerpo.json)

/// Contenido largo de un tema. Se carga bajo demanda (~1,6 MB el archivo completo).
struct TemaCuerpo: Codable, Hashable, Identifiable, Sendable {
    let codigo: String
    let titulo: String
    /// Texto tal cual viene del JSON, ej: "✅✅ VERIFICADO (3 votos, 2026-06-21)".
    let estado: String
    let categoriaNombre: String
    /// Markdown ligero: **negritas**, *cursivas*, [enlaces](url), "- " y "> ".
    let cuerpo: String
    let fuentes: [Fuente]

    var id: String { codigo }

    /// Estado sin los emojis de verificación, para mostrarlo como badge de texto.
    var estadoLimpio: String {
        let sinIconos = estado.unicodeScalars.filter { escalar in
            !(escalar.properties.isEmoji && escalar.properties.isEmojiPresentation)
        }
        return String(String.UnicodeScalarView(sinIconos))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var estaVerificado: Bool {
        estadoLimpio.folding(options: .diacriticInsensitive, locale: nil)
            .lowercased()
            .contains("verificado")
    }

    init(codigo: String,
         titulo: String,
         estado: String,
         categoriaNombre: String,
         cuerpo: String,
         fuentes: [Fuente]) {
        self.codigo = codigo
        self.titulo = titulo
        self.estado = estado
        self.categoriaNombre = categoriaNombre
        self.cuerpo = cuerpo
        self.fuentes = fuentes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        codigo = try c.decodeIfPresent(String.self, forKey: .codigo) ?? ""
        titulo = try c.decodeIfPresent(String.self, forKey: .titulo) ?? ""
        estado = try c.decodeIfPresent(String.self, forKey: .estado) ?? ""
        categoriaNombre = try c.decodeIfPresent(String.self, forKey: .categoriaNombre) ?? ""
        cuerpo = try c.decodeIfPresent(String.self, forKey: .cuerpo) ?? ""
        fuentes = try c.decodeIfPresent([Fuente].self, forKey: .fuentes) ?? []
    }
}

struct Fuente: Codable, Hashable, Identifiable, Sendable {
    let label: String
    let url: String

    var id: String { "\(label)|\(url)" }

    /// URL válida o nil (no queremos abrir enlaces rotos).
    var enlace: URL? {
        let limpio = url.trimmingCharacters(in: .whitespacesAndNewlines)
        guard limpio.hasPrefix("http") else { return nil }
        return URL(string: limpio)
    }

    /// Dominio legible para mostrar bajo la etiqueta.
    var dominio: String {
        guard let host = enlace?.host() else { return "" }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    init(label: String, url: String) {
        self.label = label
        self.url = url
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let etiqueta = try c.decodeIfPresent(String.self, forKey: .label) ?? ""
        let direccion = try c.decodeIfPresent(String.self, forKey: .url) ?? ""
        url = direccion
        label = etiqueta.isEmpty ? direccion : etiqueta
    }
}

// MARK: - Ayuda urgente (ayuda-urgente.json)

struct AyudaUrgente: Codable, Sendable {
    let titulo: String
    let intro: String
    let avisoCuidador: String
    let paises: [PaisAyuda]
    let senalesDeAlarma: [TextoFlexible]
    let queHacer: [TextoFlexible]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        titulo = try c.decodeIfPresent(String.self, forKey: .titulo) ?? "Ayuda urgente"
        intro = try c.decodeIfPresent(String.self, forKey: .intro) ?? ""
        avisoCuidador = try c.decodeIfPresent(String.self, forKey: .avisoCuidador) ?? ""
        paises = try c.decodeIfPresent([PaisAyuda].self, forKey: .paises) ?? []
        senalesDeAlarma = try c.decodeIfPresent([TextoFlexible].self, forKey: .senalesDeAlarma) ?? []
        queHacer = try c.decodeIfPresent([TextoFlexible].self, forKey: .queHacer) ?? []
    }
}

struct PaisAyuda: Codable, Hashable, Identifiable, Sendable {
    let pais: String
    let linea: String
    let descripcion: String
    let emergencias: String
    let fuente: String

    var id: String { pais + linea }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pais = try c.decodeIfPresent(String.self, forKey: .pais) ?? ""
        linea = try c.decodeIfPresent(String.self, forKey: .linea) ?? ""
        descripcion = try c.decodeIfPresent(String.self, forKey: .descripcion) ?? ""
        emergencias = try c.decodeIfPresent(String.self, forKey: .emergencias) ?? ""
        fuente = try c.decodeIfPresent(String.self, forKey: .fuente) ?? ""
    }
}

/// Acepta tanto `"texto"` como `{"titulo": "texto"}` en los arrays de ayuda.
struct TextoFlexible: Codable, Hashable, Identifiable, Sendable {
    let texto: String

    var id: String { texto }

    init(_ texto: String) { self.texto = texto }

    init(from decoder: Decoder) throws {
        if let contenedor = try? decoder.singleValueContainer(),
           let cadena = try? contenedor.decode(String.self) {
            texto = cadena
            return
        }
        if let objeto = try? decoder.container(keyedBy: ClaveLibre.self) {
            for nombre in ["texto", "titulo", "descripcion", "detalle", "mensaje", "item"] {
                if let clave = ClaveLibre(stringValue: nombre),
                   let valor = try? objeto.decode(String.self, forKey: clave) {
                    texto = valor
                    return
                }
            }
        }
        texto = ""
    }

    func encode(to encoder: Encoder) throws {
        var contenedor = encoder.singleValueContainer()
        try contenedor.encode(texto)
    }
}

struct ClaveLibre: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }

    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

// MARK: - Nivel de evidencia

/// Los marcadores 🟢🟡🔴⚪ del texto se convierten en este dato y NUNCA se
/// muestran como emoji: se pintan como punto de color + etiqueta.
enum NivelEvidencia: String, CaseIterable, Identifiable, Hashable, Sendable {
    case solida
    case limitada
    case desaconsejado
    case vivencial

    var id: String { rawValue }

    /// Marcador original -> nivel. Se comparan escalares sin selector de variación.
    static let marcadores: [Character: NivelEvidencia] = [
        "🟢": .solida,
        "🟡": .limitada,
        "🟠": .limitada,
        "🔴": .desaconsejado,
        "⚪": .vivencial,
        "⚫": .vivencial
    ]

    var etiqueta: String {
        switch self {
        case .solida: return "Evidencia sólida"
        case .limitada: return "Evidencia limitada"
        case .desaconsejado: return "Desaconsejado"
        case .vivencial: return "Experiencia vivida"
        }
    }

    var descripcion: String {
        switch self {
        case .solida: return "Respaldado por estudios consistentes."
        case .limitada: return "Poca evidencia o todavía en debate."
        case .desaconsejado: return "La evidencia desaconseja hacerlo."
        case .vivencial: return "Testimonio de personas autistas o familias."
        }
    }

    var simbolo: String {
        switch self {
        case .solida: return "checkmark.seal"
        case .limitada: return "questionmark.circle"
        case .desaconsejado: return "xmark.octagon"
        case .vivencial: return "quote.bubble"
        }
    }
}
