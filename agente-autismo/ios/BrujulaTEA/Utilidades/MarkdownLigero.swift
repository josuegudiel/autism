import Foundation
import SwiftUI

/// Un trozo de contenido ya interpretado, listo para pintar.
struct BloqueMarkdown: Identifiable, Hashable {
    enum Tipo: Hashable {
        case parrafo
        case vineta
        case cita
        case encabezado(Int)
        case separador
    }

    let id: Int
    let tipo: Tipo
    let texto: AttributedString
    /// Marcador de evidencia extraído del final de la línea (ya no está en `texto`).
    let evidencia: NivelEvidencia?
    /// Numeral de una lista ordenada, ej. "3.".
    let ordinal: String?

    /// Texto plano, útil para VoiceOver y para detectar el "Mensaje clave".
    var plano: String { String(texto.characters) }
}

/// Intérprete del campo `cuerpo`: markdown ligero -> bloques.
/// Extrae los marcadores 🟢🟡🔴⚪ como dato para pintarlos como badge.
enum MarkdownLigero {

    static func analizar(_ texto: String) -> [BloqueMarkdown] {
        var bloques: [BloqueMarkdown] = []
        var acumulado: [String] = []
        var contador = 0

        func siguienteID() -> Int {
            contador += 1
            return contador
        }

        func cerrarParrafo() {
            guard !acumulado.isEmpty else { return }
            let unido = acumulado.joined(separator: " ")
            acumulado.removeAll()
            let (limpio, nivel) = extraerEvidencia(unido)
            guard !limpio.isEmpty else { return }
            bloques.append(BloqueMarkdown(id: siguienteID(),
                                          tipo: .parrafo,
                                          texto: atribuir(limpio),
                                          evidencia: nivel,
                                          ordinal: nil))
        }

        for lineaCruda in texto.components(separatedBy: .newlines) {
            let linea = lineaCruda.trimmingCharacters(in: .whitespaces)

            if linea.isEmpty {
                cerrarParrafo()
                continue
            }

            if esSeparador(linea) {
                cerrarParrafo()
                bloques.append(BloqueMarkdown(id: siguienteID(),
                                              tipo: .separador,
                                              texto: AttributedString(""),
                                              evidencia: nil,
                                              ordinal: nil))
                continue
            }

            if let (nivel, resto) = encabezado(linea) {
                cerrarParrafo()
                let (limpio, evidencia) = extraerEvidencia(resto)
                bloques.append(BloqueMarkdown(id: siguienteID(),
                                              tipo: .encabezado(nivel),
                                              texto: atribuir(limpio),
                                              evidencia: evidencia,
                                              ordinal: nil))
                continue
            }

            if let resto = prefijoVineta(linea) {
                cerrarParrafo()
                let (limpio, evidencia) = extraerEvidencia(resto)
                guard !limpio.isEmpty else { continue }
                bloques.append(BloqueMarkdown(id: siguienteID(),
                                              tipo: .vineta,
                                              texto: atribuir(limpio),
                                              evidencia: evidencia,
                                              ordinal: nil))
                continue
            }

            if let (numeral, resto) = prefijoOrdinal(linea) {
                cerrarParrafo()
                let (limpio, evidencia) = extraerEvidencia(resto)
                guard !limpio.isEmpty else { continue }
                bloques.append(BloqueMarkdown(id: siguienteID(),
                                              tipo: .vineta,
                                              texto: atribuir(limpio),
                                              evidencia: evidencia,
                                              ordinal: numeral))
                continue
            }

            if linea.hasPrefix(">") {
                cerrarParrafo()
                let resto = String(linea.dropFirst()).trimmingCharacters(in: .whitespaces)
                let (limpio, evidencia) = extraerEvidencia(resto)
                guard !limpio.isEmpty else { continue }
                bloques.append(BloqueMarkdown(id: siguienteID(),
                                              tipo: .cita,
                                              texto: atribuir(limpio),
                                              evidencia: evidencia,
                                              ordinal: nil))
                continue
            }

            acumulado.append(linea)
        }

        cerrarParrafo()
        return bloques
    }

    // MARK: - Inline

    /// Convierte **negritas**, *cursivas* y [enlaces](url) a AttributedString.
    static func atribuir(_ texto: String) -> AttributedString {
        let opciones = AttributedString.MarkdownParsingOptions(
            allowsExtendedAttributes: true,
            interpretedSyntax: .inlineOnlyPreservingWhitespace,
            failurePolicy: .returnPartiallyParsedIfPossible
        )
        guard var atribuido = try? AttributedString(markdown: texto, options: opciones) else {
            return AttributedString(texto)
        }
        // Los enlaces se tiñen con el acento; sin subrayado decorativo.
        let rangosEnlace = atribuido.runs.compactMap { $0.link != nil ? $0.range : nil }
        for rango in rangosEnlace {
            atribuido[rango].foregroundColor = Tema.acento
        }
        return atribuido
    }

    // MARK: - Evidencia

    /// Devuelve el texto sin marcadores y el nivel del último marcador encontrado.
    static func extraerEvidencia(_ texto: String) -> (String, NivelEvidencia?) {
        // Quitamos el selector de variación para que "⚪️" y "⚪" coincidan igual.
        var limpio = texto.replacingOccurrences(of: "\u{FE0F}", with: "")

        var nivel: NivelEvidencia?
        var ultimaPosicion: String.Index?

        for (marcador, candidato) in NivelEvidencia.marcadores {
            guard let rango = limpio.range(of: String(marcador), options: .backwards) else { continue }
            if let previa = ultimaPosicion, rango.lowerBound <= previa { continue }
            ultimaPosicion = rango.lowerBound
            nivel = candidato
        }

        if nivel != nil {
            for marcador in NivelEvidencia.marcadores.keys {
                limpio = limpio.replacingOccurrences(of: String(marcador), with: "")
            }
        }

        // El cuerpo también trae adornos que NO son marcadores de evidencia
        // (✅ ◽ ⚠️ ⭐). La app nunca muestra emojis, así que fuera.
        let sinAdornos = limpio.sinIconos
        if sinAdornos.unicodeScalars.count != limpio.unicodeScalars.count {
            limpio = sinAdornos.espaciosCompactos
        }

        limpio = limpio.trimmingCharacters(in: .whitespacesAndNewlines)

        // Solo si se quitó un marcador limpiamos la puntuación que lo unía al
        // texto ("… mejora el sueño — 🟢"); si no, respetamos el texto tal cual.
        if nivel != nil {
            let sobrantes = CharacterSet(charactersIn: " \t—–-·:;,")
            while let ultimo = limpio.unicodeScalars.last, sobrantes.contains(ultimo) {
                limpio.unicodeScalars.removeLast()
            }
            limpio = limpio.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        return (limpio, nivel)
    }

    // MARK: - Prefijos de línea

    private static func esSeparador(_ linea: String) -> Bool {
        linea == "---" || linea == "***" || linea == "___" || linea == "—"
    }

    private static func encabezado(_ linea: String) -> (Int, String)? {
        for nivel in stride(from: 6, through: 1, by: -1) {
            let prefijo = String(repeating: "#", count: nivel) + " "
            if linea.hasPrefix(prefijo) {
                return (nivel, String(linea.dropFirst(prefijo.count)).trimmingCharacters(in: .whitespaces))
            }
        }
        return nil
    }

    private static func prefijoVineta(_ linea: String) -> String? {
        for prefijo in ["- ", "* ", "• ", "– "] where linea.hasPrefix(prefijo) {
            return String(linea.dropFirst(prefijo.count)).trimmingCharacters(in: .whitespaces)
        }
        return nil
    }

    private static func prefijoOrdinal(_ linea: String) -> (String, String)? {
        var digitos = ""
        var resto = Substring(linea)
        while let primero = resto.first, primero.isNumber, digitos.count < 3 {
            digitos.append(primero)
            resto = resto.dropFirst()
        }
        guard !digitos.isEmpty, let separador = resto.first, separador == "." || separador == ")" else {
            return nil
        }
        resto = resto.dropFirst()
        guard resto.first == " " else { return nil }
        return (digitos + ".", String(resto).trimmingCharacters(in: .whitespaces))
    }
}
