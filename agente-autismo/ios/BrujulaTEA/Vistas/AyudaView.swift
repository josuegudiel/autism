// MARK: - Teléfonos

enum Telefono {
    private static let separadores: Set<Character> = [" ", "-", ".", "(", ")", "\u{00A0}"]

    /// Extrae del texto el número con más dígitos y devuelve su URL `tel:`.
    /// Conserva los prefijos de marcación `+` y `*`: varias líneas de ayuda son
    /// códigos cortos (Chile marca `*4141`) y sin el asterisco no se llama.
    static func url(desde texto: String) -> URL? {
        var actual = ""
        var mejor = ""

        func digitos(_ cadena: String) -> Int {
            cadena.reduce(0) { $1.isNumber ? $0 + 1 : $0 }
        }

        func cerrar() {
            if digitos(actual) > digitos(mejor) { mejor = actual }
            actual = ""
        }

        for caracter in texto {
            if caracter.isNumber {
                actual.append(caracter)
            } else if (caracter == "+" || caracter == "*") && actual.isEmpty {
                actual.append(caracter)          // prefijo de marcación
            } else if caracter == "#" && !actual.isEmpty {
                actual.append(caracter)          // sufijo de marcación
            } else if Self.separadores.contains(caracter) {
                continue                         // separador dentro del mismo número
            } else {
                cerrar()
            }
        }
        cerrar()

        guard digitos(mejor) >= 3 else { return nil }
        // "#" abriría un fragmento de URL: hay que codificarlo.
        return URL(string: "tel:" + mejor.replacingOccurrences(of: "#", with: "%23"))
    }
}
