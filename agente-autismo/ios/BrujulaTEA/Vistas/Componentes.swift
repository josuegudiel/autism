import SwiftUI

// MARK: - Buscador

struct CampoBusqueda: View {
    var titulo: String = "Busca lo que te preocupa"
    @Binding var texto: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            TextField(titulo, text: $texto)
                .textInputAutocapitalization(.never)
                .submitLabel(.search)
                .accessibilityLabel(titulo)

            if !texto.isEmpty {
                Button {
                    texto = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Borrar búsqueda")
            }
        }
        .font(.body)
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(Tema.tarjeta, in: RoundedRectangle(cornerRadius: Tema.radio, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Tema.radio, style: .continuous)
                .strokeBorder(Tema.separador, lineWidth: 0.5)
        }
    }
}

/// Sugerencia de consulta frecuente.
struct ChipConsulta: View {
    let texto: String
    let accion: () -> Void

    var body: some View {
        Button(action: accion) {
            Text(texto)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Tema.acento)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(Tema.tarjeta, in: Capsule())
                .overlay {
                    Capsule().strokeBorder(Tema.acento.opacity(0.35), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Buscar \(texto)")
    }
}

// MARK: - Encabezados y estados

struct EncabezadoSeccion: View {
    let titulo: String
    var subtitulo: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(titulo)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)
            if let subtitulo {
                Text(subtitulo)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

struct EstadoVacio: View {
    let icono: String
    let titulo: String
    let mensaje: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icono)
                .font(.system(size: 30, weight: .regular))
                .foregroundStyle(.secondary)
            Text(titulo)
                .font(.headline)
                .multilineTextAlignment(.center)
            Text(mensaje)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Badges

struct BadgeEvidencia: View {
    let nivel: NivelEvidencia

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(nivel.color)
                .frame(width: 8, height: 8)
            Text(nivel.etiqueta)
                .font(.caption.weight(.semibold))
                .foregroundStyle(nivel.color)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(nivel.color.opacity(0.12), in: Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Nivel de evidencia: \(nivel.etiqueta)")
    }
}

struct BadgeVerificado: View {
    let verificado: Bool

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: verificado ? "checkmark.seal.fill" : "clock")
                .font(.caption2)
            Text(verificado ? "Verificado" : "En revisión")
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(verificado ? Tema.acento : Color.secondary)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background((verificado ? Tema.acento : Color.secondary).opacity(0.12), in: Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(verificado ? "Contenido verificado" : "Contenido en revisión")
    }
}

/// Recuento de fuentes de un tema.
struct EtiquetaFuentes: View {
    let cantidad: Int

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "text.book.closed")
                .font(.caption2)
            Text(cantidad == 1 ? "1 fuente" : "\(cantidad) fuentes")
                .font(.caption)
        }
        .foregroundStyle(.secondary)
        .accessibilityElement(children: .combine)
    }
}

/// Barra compacta con el reparto de marcadores de evidencia del tema.
struct ResumenSemaforos: View {
    let semaforos: Semaforos

    private var partes: [(nivel: NivelEvidencia, cantidad: Int)] {
        [(.solida, semaforos.verde),
         (.limitada, semaforos.amarillo),
         (.desaconsejado, semaforos.rojo),
         (.vivencial, semaforos.vivencial)].filter { $0.cantidad > 0 }
    }

    var body: some View {
        if !partes.isEmpty {
            HStack(spacing: 12) {
                ForEach(partes, id: \.nivel) { parte in
                    HStack(spacing: 5) {
                        Circle()
                            .fill(parte.nivel.color)
                            .frame(width: 7, height: 7)
                        Text("\(parte.cantidad)")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(parte.cantidad) puntos con \(parte.nivel.etiqueta.lowercased())")
                }
            }
        }
    }
}

// MARK: - Tarjetas y filas de tema

/// Fila compacta, pensada para listas largas.
struct FilaTema: View {
    let tema: TemaResumen
    var motivo: String? = nil
    var mostrarCategoria: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(tema.titulo)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                if tema.verificado {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(Tema.acento)
                        .accessibilityLabel("Verificado")
                }
            }

            if let motivo {
                Text(motivo)
                    .font(.caption)
                    .foregroundStyle(Tema.acento)
            } else if mostrarCategoria, !tema.categoriaNombre.isEmpty {
                Text(tema.categoriaNombre)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !tema.mensaje.isEmpty {
                Text(tema.mensaje)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Tarjeta con el mensaje clave, para usar fuera de List.
struct TarjetaTema: View {
    let tema: TemaResumen
    var motivo: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(tema.titulo)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(motivo ?? tema.categoriaNombre)
                        .font(.caption)
                        .foregroundStyle(motivo == nil ? Color.secondary : Tema.acento)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }

            if !tema.mensaje.isEmpty {
                Text(tema.mensaje)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 12) {
                BadgeVerificado(verificado: tema.verificado)
                EtiquetaFuentes(cantidad: tema.nFuentes)
                Spacer(minLength: 0)
            }
        }
        .tarjeta()
    }
}

struct TarjetaCategoria: View {
    let categoria: CategoriaResumen

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: Tema.icono(categoria: categoria))
                .font(.title3)
                .foregroundStyle(Tema.acento)
                .accessibilityHidden(true)

            Text(categoria.nombre)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)

            Text(categoria.n == 1 ? "1 tema" : "\(categoria.n) temas")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
        .padding(14)
        .background(Tema.tarjeta, in: RoundedRectangle(cornerRadius: Tema.radio, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityHint("Abre los temas de esta categoría")
    }
}

// MARK: - Leyenda

/// Explica qué significan los puntos de color. Plegada por defecto.
struct LeyendaEvidencia: View {
    @State private var desplegada = false

    var body: some View {
        DisclosureGroup(isExpanded: $desplegada) {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(NivelEvidencia.allCases) { nivel in
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(nivel.color)
                            .frame(width: 9, height: 9)
                            .padding(.top, 5)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(nivel.etiqueta)
                                .font(.subheadline.weight(.semibold))
                            Text(nivel.descripcion)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.top, 12)
        } label: {
            Text("Qué significan los colores")
                .font(.subheadline.weight(.semibold))
        }
        .tint(Tema.acento)
        .tarjeta()
    }
}

// MARK: - Cuerpo markdown

struct CuerpoMarkdownView: View {
    let bloques: [BloqueMarkdown]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(bloques) { bloque in
                BloqueMarkdownView(bloque: bloque)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct BloqueMarkdownView: View {
    let bloque: BloqueMarkdown

    var body: some View {
        switch bloque.tipo {
        case .separador:
            Divider()

        case .encabezado(let nivel):
            Text(bloque.texto)
                .font(nivel <= 2 ? .title3.weight(.semibold) : .headline)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)
                .accessibilityAddTraits(.isHeader)

        case .cita:
            HStack(alignment: .top, spacing: 12) {
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(Tema.acento.opacity(0.4))
                    .frame(width: 3)
                    .accessibilityHidden(true)
                contenido(cursiva: true)
            }

        case .vineta:
            HStack(alignment: .top, spacing: 10) {
                marca
                contenido(cursiva: false)
            }

        case .parrafo:
            contenido(cursiva: false)
        }
    }

    @ViewBuilder
    private var marca: some View {
        if let ordinal = bloque.ordinal {
            Text(ordinal)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Tema.acento)
                .frame(minWidth: 18, alignment: .leading)
                .accessibilityHidden(true)
        } else {
            Circle()
                .fill(Tema.acento.opacity(0.55))
                .frame(width: 6, height: 6)
                .padding(.top, 8)
                .frame(minWidth: 10, alignment: .leading)
                .accessibilityHidden(true)
        }
    }

    @ViewBuilder
    private func contenido(cursiva: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(bloque.texto)
                .font(.body)
                .italic(cursiva)
                .foregroundStyle(cursiva ? Color.secondary : Color.primary)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
            if let evidencia = bloque.evidencia {
                BadgeEvidencia(nivel: evidencia)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Previsualizaciones

#if DEBUG
extension TemaResumen {
    /// Datos de ejemplo solo para previsualizaciones.
    static let muestra = TemaResumen(
        codigo: "W",
        titulo: "Sueño",
        categoria: "salud",
        categoriaNombre: "Salud y condiciones asociadas",
        verificado: true,
        mensaje: "Los problemas de sueño son muy comunes y casi siempre se pueden mejorar.",
        nFuentes: 9,
        semaforos: Semaforos(verde: 6, amarillo: 3, rojo: 1, vivencial: 0),
        claves: ["sueño", "melatonina", "insomnio"]
    )
}

#Preview("Componentes") {
    ScrollView {
        VStack(spacing: 16) {
            TarjetaTema(tema: .muestra)
            TarjetaCategoria(categoria: CategoriaResumen(clave: "salud",
                                                        nombre: "Salud y condiciones asociadas",
                                                        n: 40))
            BadgeEvidencia(nivel: .solida)
            BadgeEvidencia(nivel: .desaconsejado)
            ResumenSemaforos(semaforos: TemaResumen.muestra.semaforos)
            LeyendaEvidencia()
        }
        .padding()
    }
    .background(Tema.fondo)
}
#endif
