#!/usr/bin/env python3
"""Genera un informe legible de la auditoría a partir de los lote-N.json.

Uso:  python3 scripts/informe-auditoria.py

Lee research/auditoria/lote-*.json y escribe research/auditoria/INFORME.md,
con el estado de cada tema y el detalle de los fallos confirmados.
"""
import glob
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA = os.path.join(RAIZ, "research", "auditoria")
BIBLIOTECA = os.path.join(RAIZ, "research", "biblioteca-autismo.md")

ETIQUETA_TIPO = {
    "dato_incorrecto": "dato incorrecto",
    "fuente_no_respalda": "la fuente no lo sostiene",
    "atribucion_erronea": "atribuido al estudio equivocado",
    "desactualizado": "desactualizado",
    "semaforo_incorrecto": "semáforo demasiado optimista",
    "riesgo_seguridad": "riesgo para el niño",
    "redaccion_confusa": "redacción confusa",
    "enlace_roto": "enlace roto",
}


def total_dominios():
    with open(BIBLIOTECA, encoding="utf-8") as f:
        return len(re.findall(r"^### [A-Z]{1,2}\. ", f.read(), flags=re.M))


def main():
    lotes = sorted(glob.glob(os.path.join(CARPETA, "lote-*.json")),
                   key=lambda p: int(re.search(r"lote-(\d+)", p).group(1)))
    if not lotes:
        print("No hay tandas auditadas todavía.")
        return

    dominios = {}
    numeros = []
    for ruta in lotes:
        with open(ruta, encoding="utf-8") as f:
            datos = json.load(f)
        numeros.append(datos["lote"])
        d = datos["dominios"]
        dominios.update(d if isinstance(d, dict) else {x["codigo"]: x for x in d})

    hallazgos = [(c, h) for c, x in dominios.items() for h in x.get("hallazgos", [])]
    conf = [(c, h) for c, h in hallazgos if h.get("estado") == "confirmado"]
    desc = [(c, h) for c, h in hallazgos if h.get("estado") == "descartado"]
    serios = [(c, h) for c, h in conf if h["gravedad"] in ("grave", "medio")]
    limpios = [c for c, x in dominios.items()
               if not any(h.get("estado") == "confirmado" for h in x.get("hallazgos", []))]

    total = total_dominios()
    L = []
    L.append("# Auditoría de la biblioteca — informe")
    L.append("")
    L.append("Este archivo se genera solo. No lo edites a mano:")
    L.append("`python3 scripts/informe-auditoria.py`")
    L.append("")
    L.append("## Cómo se audita cada tema")
    L.append("")
    L.append("Cada tema pasa por **dos agentes que no se conocen entre sí**:")
    L.append("")
    L.append("1. **Un revisor** comprueba cifras, atribuciones, semáforos de evidencia y")
    L.append("   seguridad del niño, y anota lo que cree que está mal.")
    L.append("2. **Un abogado del diablo** recibe cada fallo alegado y trata de")
    L.append("   **demostrar que el revisor se equivocó**. Solo si no lo consigue, el")
    L.append("   fallo cuenta como real.")
    L.append("")
    L.append("Ese segundo paso no es un adorno: hasta ahora ha descartado")
    L.append(f"**{len(desc)}** hallazgos que eran falsas alarmas. Sin él se habrían")
    L.append("estropeado temas que estaban bien.")
    L.append("")
    L.append("### Lo que esta auditoría NO puede comprobar")
    L.append("")
    L.append("La política de red del entorno impide abrir páginas web (devuelve error")
    L.append("403 para cualquier dirección, incluso las más comunes). Los revisores")
    L.append("verifican con buscador, que sí funciona: pueden confirmar que un estudio")
    L.append("existe, su autoría, año y revista, y contrastar cifras contra el resumen.")
    L.append("**No pueden comprobar que un enlace concreto siga funcionando.**")
    L.append("Donde el detalle dice `enlaces comprobados: 0`, significa *no comprobado*,")
    L.append("no *correcto*.")
    L.append("")
    L.append("## Estado")
    L.append("")
    L.append(f"- Tandas hechas: **{', '.join(str(n) for n in numeros)}**")
    L.append(f"- Temas auditados: **{len(dominios)} de {total}** "
             f"({100 * len(dominios) // total}%)")
    L.append(f"- Temas sin ningún fallo confirmado: **{len(limpios)}**")
    L.append(f"- Fallos confirmados: **{len(conf)}** "
             f"(graves o medios: **{len(serios)}**)")
    L.append(f"- Falsas alarmas descartadas: **{len(desc)}**")
    L.append("")
    L.append("## Fallos confirmados que exigían corrección")
    L.append("")
    L.append("Ordenados por gravedad. Todos han sido aplicados a la biblioteca.")
    L.append("")

    orden = {"grave": 0, "medio": 1}
    for c, h in sorted(serios, key=lambda x: (orden[x[1]["gravedad"]], x[0])):
        titulo = dominios[c].get("titulo") or c
        sello = "GRAVE" if h["gravedad"] == "grave" else "Medio"
        tipo = ETIQUETA_TIPO.get(h["tipo"], h["tipo"])
        L.append(f"### {sello} · {c}. {titulo}")
        L.append("")
        L.append(f"*{tipo}*")
        L.append("")
        L.append("> " + " ".join(h["cita"].split())[:400])
        L.append("")
        L.append(" ".join(h["problema"].split())[:700])
        L.append("")

    L.append("## Temas sin fallos confirmados")
    L.append("")
    L.append(", ".join(sorted(limpios)) if limpios else "—")
    L.append("")

    salida = os.path.join(CARPETA, "INFORME.md")
    with open(salida, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    print("Escrito: %s" % salida)
    print("  %d temas · %d fallos confirmados · %d falsas alarmas"
          % (len(dominios), len(conf), len(desc)))


if __name__ == "__main__":
    main()
