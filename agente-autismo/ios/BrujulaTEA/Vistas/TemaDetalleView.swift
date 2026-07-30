import SwiftUI

struct TemaDetalleView: View {
    let tema: TemaResumen

    @Environment(Biblioteca.self) private var biblioteca
    @State private var cuerpo: TemaCuerpo?
    @State private var bloques: [BloqueMarkdown] = []
    @State private var cargando = true
    @State private var error: String?

    private var relacionados: [TemaResumen] {
        biblioteca.relacionados(de: tema, limite: 5)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tema.espacioSeccion) {
                cabecera

                if !tema.mensaje.isEmpty {
                    mensajeClave
                }

                contenido

                if let cuerpo, !cuerpo.fuentes.isEmpty {
                    seccionFuentes(cuerpo.fuentes)
                }

                if !relacionados.isEmpty {
                    seccionRelacionados
                }

                LeyendaEvidencia()
            }
            .padding(.horizontal, Tema.margen)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(Tema.fondo)
        .navigationTitle(tema.titulo)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: tema.codigo) {
            await cargar()
        }
    }

    // MARK: Secciones

    private var cabecera: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(tema.titulo)
                .font(.largeTitle.weight(.bold))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            if !tema.categoriaNombre.isEmpty {
                Text(tema.categoriaNombre)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 10) {
                BadgeVerificado(verificado: tema.verificado)
                EtiquetaFuentes(cantidad: max(tema.nFuentes, cuerpo?.fuentes.count ?? 0))
                Spacer(minLength: 0)
            }

            ResumenSemaforos(semaforos: tema.semaforos)

            if let cuerpo, !cuerpo.estadoLimpio.isEmpty {
                Text(cuerpo.estadoLimpio)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var mensajeClave: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Mensaje clave")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Tema.acento)
                .textCase(.uppercase)
            Text(tema.mensaje)
                .font(.title3)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .tarjeta()
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var contenido: some View {
        if cargando {
            HStack(spacing: 10) {
                ProgressView()
                Text("Cargando el tema…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 30)
        } else if let error {
            EstadoVacio(icono: "exclamationmark.triangle",
                        titulo: "No se pudo abrir el contenido",
                        mensaje: error)
                .tarjeta()
        } else if bloques.isEmpty {
            EstadoVacio(icono: "doc.text",
                        titulo: "Sin contenido ampliado",
                        mensaje: "Este tema todavía no tiene desarrollo largo.")
                .tarjeta()
        } else {
            CuerpoMarkdownView(bloques: bloques)
                .tarjeta(relleno: 18)
        }
    }

    private func seccionFuentes(_ fuentes: [Fuente]) -> some View {
        VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
            EncabezadoSeccion(titulo: "Fuentes",
                              subtitulo: "Se abren en Safari.")

            VStack(spacing: 0) {
                ForEach(Array(fuentes.enumerated()), id: \.element.id) { indice, fuente in
                    if indice > 0 {
                        Divider().padding(.leading, 16)
                    }
                    FilaFuente(fuente: fuente)
                }
            }
            .background(Tema.tarjeta, in: RoundedRectangle(cornerRadius: Tema.radio, style: .continuous))
        }
    }

    private var seccionRelacionados: some View {
        VStack(alignment: .leading, spacing: Tema.espacioTarjeta) {
            EncabezadoSeccion(titulo: "Temas relacionados")
            ForEach(relacionados) { relacionado in
                NavigationLink(value: relacionado) {
                    TarjetaTema(tema: relacionado)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Carga

    private func cargar() async {
        cargando = true
        error = nil
        do {
            let encontrado = try await biblioteca.cuerpo(de: tema.codigo)
            cuerpo = encontrado
            bloques = encontrado.map { descartarMensajeClave(biblioteca.bloques(de: $0)) } ?? []
        } catch {
            self.error = error.localizedDescription
        }
        cargando = false
    }

    /// El mensaje clave ya se muestra arriba: evitamos repetirlo.
    private func descartarMensajeClave(_ bloques: [BloqueMarkdown]) -> [BloqueMarkdown] {
        guard let primero = bloques.first else { return bloques }
        let plano = primero.plano
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
            .lowercased()
        return plano.hasPrefix("mensaje clave") ? Array(bloques.dropFirst()) : bloques
    }
}

/// Fila de fuente con enlace externo.
struct FilaFuente: View {
    let fuente: Fuente

    var body: some View {
        if let enlace = fuente.enlace {
            Link(destination: enlace) {
                contenido(externo: true)
            }
            .accessibilityLabel("\(fuente.label). Abrir en Safari")
        } else {
            contenido(externo: false)
        }
    }

    private func contenido(externo: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(fuente.label)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                if !fuente.dominio.isEmpty {
                    Text(fuente.dominio)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            if externo {
                Image(systemName: "arrow.up.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Tema.acento)
                    .accessibilityHidden(true)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}
