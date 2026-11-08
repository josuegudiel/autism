import SwiftUI

/// Pestaña «Ayuda»: su propia pila de navegación alrededor del contenido.
@MainActor
struct AyudaView: View {
    var body: some View {
        NavigationStack {
            AyudaContenidoView()
                .navigationTitle("Ayuda urgente")
                .destinosBiblioteca()
        }
    }
}

/// Teléfonos de crisis, señales de alarma y qué hacer. Se usa en la pestaña y
/// también como destino desde Inicio (`DestinoApp.ayuda`), así que no lleva
/// pila de navegación propia.
@MainActor
struct AyudaContenidoView: View {
    @Environment(Biblioteca.self) private var biblioteca

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tema.espacioSeccion) {
                switch biblioteca.estadoAyuda {
                case .fallo(let mensaje):
                    // Aunque el fichero falle, el número de emergencias no puede faltar.
                    EstadoVacio(
                        icono: "exclamationmark.triangle",
                        titulo: "No se han podido cargar los teléfonos",
                        mensaje: "\(mensaje) Si hay riesgo ahora, llama al número de emergencias de tu país: 112 en España y la Unión Europea; 911 en México, Estados Unidos y buena parte de América."
                    )
                    .tarjeta()
                default:
                    if let ayuda = biblioteca.ayuda {
                        contenido(ayuda)
                    } else {
                        ProgressView("Cargando…")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 32)
                    }
                }
            }
            .padding(.horizontal, Tema.margen)
            .padding(.top, 4)
            .padding(.bottom, 36)
        }
        .background(Tema.fondo)
        .task { await biblioteca.cargarAyuda() }
    }

    @ViewBuilder
    private func contenido(_ ayuda: AyudaUrgente) -> some View {
        if !ayuda.intro.isEmpty {
            Text(ayuda.intro)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Tema.alerta)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .tarjeta()
        }
        if !ayuda.notaEscrito.isEmpty {
            Text(ayuda.notaEscrito)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        ForEach(ayuda.paises) { pais in
            TarjetaPais(pais: pais)
        }
        if !ayuda.senalesDeAlarma.isEmpty {
            ListaPuntos(titulo: "Señales de alarma", puntos: ayuda.senalesDeAlarma)
        }
        if !ayuda.queHacer.isEmpty {
            ListaPuntos(titulo: "Qué puedes hacer", puntos: ayuda.queHacer)
        }
        if !ayuda.avisoCuidador.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("Y tú también cuentas.")
                    .font(.headline)
                Text(ayuda.avisoCuidador)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarjeta()
        }
    }
}

/// Un país: la línea principal se puede pulsar para llamar, y el número de
/// emergencias también —es el que se marca con más prisa—.
struct TarjetaPais: View {
    let pais: PaisAyuda

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(pais.pais.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if let url = Telefono.url(desde: pais.linea) {
                Link(destination: url) {
                    Label(pais.linea, systemImage: "phone.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Tema.alerta)
                }
                .accessibilityHint("Llama a este número")
            } else {
                Label(pais.linea, systemImage: "phone")
                    .font(.title3.weight(.semibold))
            }

            if !pais.descripcion.isEmpty {
                Text(pais.descripcion)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !pais.escrito.isEmpty {
                Text("Por escrito: \(pais.escrito)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !pais.emergencias.isEmpty {
                if let url = Telefono.url(desde: pais.emergencias) {
                    Link(destination: url) {
                        Text("Emergencias: \(pais.emergencias)")
                            .font(.footnote.weight(.semibold))
                    }
                    .accessibilityHint("Llama al número de emergencias")
                } else {
                    Text("Emergencias: \(pais.emergencias)")
                        .font(.footnote.weight(.semibold))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarjeta()
    }
}

/// Lista de puntos con su encabezado (señales de alarma, qué hacer).
struct ListaPuntos: View {
    let titulo: String
    let puntos: [TextoFlexible]

    var body: some View {
        VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
            EncabezadoSeccion(titulo: titulo)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(puntos.filter { !$0.texto.isEmpty }) { punto in
                    Label {
                        Text(punto.texto)
                            .fixedSize(horizontal: false, vertical: true)
                    } icon: {
                        Image(systemName: "checkmark.circle")
                            .foregroundStyle(Tema.acento)
                    }
                    .font(.subheadline)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarjeta()
        }
    }
}

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
