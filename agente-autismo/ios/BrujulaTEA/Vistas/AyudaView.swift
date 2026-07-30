import SwiftUI

struct AyudaView: View {
    var body: some View {
        NavigationStack {
            AyudaContenidoView()
                .navigationTitle("Ayuda urgente")
                .destinosBiblioteca()
        }
    }
}

/// Contenido reutilizable: se usa como pestaña y también empujado desde Inicio.
struct AyudaContenidoView: View {
    @Environment(Biblioteca.self) private var biblioteca
    @Environment(\.openURL) private var abrirURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tema.espacioSeccion) {
                switch biblioteca.estadoAyuda {
                case .inactivo, .cargando:
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 60)

                case .fallo(let mensaje):
                    EstadoVacio(icono: "exclamationmark.triangle",
                                titulo: "No se pudo cargar la ayuda",
                                mensaje: mensaje)
                        .tarjeta()

                case .listo:
                    if let ayuda = biblioteca.ayuda {
                        contenido(ayuda)
                    }
                }
            }
            .padding(.horizontal, Tema.margen)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Tema.fondo)
        .task {
            await biblioteca.cargarAyuda()
        }
    }

    @ViewBuilder
    private func contenido(_ ayuda: AyudaUrgente) -> some View {
        if !ayuda.intro.isEmpty {
            Text(ayuda.intro)
                .font(.body)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }

        if !ayuda.paises.isEmpty {
            VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
                EncabezadoSeccion(titulo: "Teléfonos por país",
                                  subtitulo: "Toca un número para llamar.")
                ForEach(ayuda.paises) { pais in
                    TarjetaPais(pais: pais) { numero in
                        abrirURL(numero)
                    }
                }
            }
        }

        if !ayuda.avisoCuidador.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    Image(systemName: "heart.text.square")
                        .font(.title3)
                        .foregroundStyle(Tema.acento)
                        .accessibilityHidden(true)
                    Text("Si quien lo está pasando mal eres tú")
                        .font(.headline)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(ayuda.avisoCuidador)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .tarjeta()
        }

        if !ayuda.senalesDeAlarma.isEmpty {
            ListaPuntos(titulo: "Señales de alarma",
                        subtitulo: "Busca ayuda profesional si aparece alguna.",
                        color: Tema.alerta,
                        simbolo: "exclamationmark.triangle",
                        elementos: ayuda.senalesDeAlarma)
        }

        if !ayuda.queHacer.isEmpty {
            ListaPuntos(titulo: "Qué hacer",
                        subtitulo: nil,
                        color: Tema.acento,
                        simbolo: "checkmark.circle",
                        elementos: ayuda.queHacer)
        }

        Text("Esta app no es un servicio de emergencias. Ante peligro inmediato, llama al número de emergencias de tu país.")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - Tarjeta de país

struct TarjetaPais: View {
    let pais: PaisAyuda
    let llamar: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(pais.pais)
                .font(.headline)
                .fixedSize(horizontal: false, vertical: true)

            if !pais.descripcion.isEmpty {
                Text(pais.descripcion)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !pais.linea.isEmpty {
                BotonLlamada(titulo: pais.linea,
                             subtitulo: "Línea de ayuda",
                             color: Tema.acento,
                             llamar: llamar)
            }

            if !pais.emergencias.isEmpty {
                BotonLlamada(titulo: pais.emergencias,
                             subtitulo: "Emergencias",
                             color: Tema.alerta,
                             llamar: llamar)
            }

            if !pais.fuente.isEmpty {
                Text("Fuente: \(pais.fuente)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tarjeta()
    }
}

struct BotonLlamada: View {
    let titulo: String
    let subtitulo: String
    let color: Color
    let llamar: (URL) -> Void

    private var url: URL? { Telefono.url(desde: titulo) }

    var body: some View {
        Button {
            if let url { llamar(url) }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: url == nil ? "info.circle" : "phone.fill")
                    .font(.footnote)
                    .foregroundStyle(color)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(titulo)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(url == nil ? Color.primary : color)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(subtitulo)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 4)
                if url != nil {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.tertiary)
                        .accessibilityHidden(true)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(0.10),
                        in: RoundedRectangle(cornerRadius: Tema.radioPequeno, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(url == nil)
        .accessibilityLabel(url == nil ? titulo : "Llamar a \(titulo). \(subtitulo)")
    }
}

// MARK: - Lista de puntos

struct ListaPuntos: View {
    let titulo: String
    let subtitulo: String?
    let color: Color
    let simbolo: String
    let elementos: [TextoFlexible]

    var body: some View {
        VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
            EncabezadoSeccion(titulo: titulo, subtitulo: subtitulo)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(elementos) { elemento in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: simbolo)
                            .font(.footnote)
                            .foregroundStyle(color)
                            .padding(.top, 2)
                            .accessibilityHidden(true)
                        Text(elemento.texto)
                            .font(.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .tarjeta()
        }
    }
}

// MARK: - Teléfonos

enum Telefono {
    /// Extrae el número más largo del texto y devuelve su URL `tel:`.
    static func url(desde texto: String) -> URL? {
        var actual = ""
        var mejor = ""

        func cerrar() {
            if actual.count > mejor.count { mejor = actual }
            actual = ""
        }

        for caracter in texto {
            if caracter.isNumber || (caracter == "+" && actual.isEmpty) {
                actual.append(caracter)
            } else if caracter == " " || caracter == "-" || caracter == "." || caracter == "(" || caracter == ")" {
                continue    // separadores dentro del mismo número
            } else {
                cerrar()
            }
        }
        cerrar()

        let digitos = mejor.filter { $0.isNumber }
        guard digitos.count >= 3 else { return nil }
        return URL(string: "tel:\(mejor)")
    }
}
