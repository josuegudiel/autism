#!/usr/bin/env python3
"""Parte la biblioteca en un archivo por dominio.

Sirve para auditar: cada revisor lee solo el dominio que le toca en vez de
cargar el archivo entero (1,5 MB). No modifica la biblioteca.

Uso:  python3 scripts/partir-dominios.py <carpeta-de-salida>
"""
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIBLIOTECA = os.path.join(RAIZ, "research", "biblioteca-autismo.md")
CABECERA = re.compile(r"^### ([A-Z]{1,2})\. (.+?) — (.+)$")


def main():
    salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "research", "dominios")
    os.makedirs(salida, exist_ok=True)

    with open(BIBLIOTECA, encoding="utf-8") as f:
        lineas = f.readlines()

    # Localiza el inicio de cada dominio
    marcas = []
    for i, linea in enumerate(lineas):
        m = CABECERA.match(linea.rstrip("\n"))
        if m:
            marcas.append((i, m.group(1), m.group(2).strip(), m.group(3).strip()))

    inventario = []
    for n, (inicio, codigo, titulo, estado) in enumerate(marcas):
        fin = marcas[n + 1][0] if n + 1 < len(marcas) else len(lineas)
        cuerpo = "".join(lineas[inicio:fin]).rstrip() + "\n"
        with open(os.path.join(salida, codigo + ".md"), "w", encoding="utf-8") as f:
            f.write(cuerpo)
        fuentes = len(re.findall(r"\]\(https?://", cuerpo))
        inventario.append((codigo, titulo, estado, inicio + 1, fin, fuentes))

    with open(os.path.join(salida, "_inventario.tsv"), "w", encoding="utf-8") as f:
        f.write("codigo\ttitulo\testado\tlinea_inicio\tlinea_fin\tenlaces\n")
        for fila in inventario:
            f.write("\t".join(str(c) for c in fila) + "\n")

    print("Dominios escritos: %d" % len(inventario))
    print("Carpeta: %s" % salida)


if __name__ == "__main__":
    main()
