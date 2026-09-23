# -*- coding: utf-8 -*-
"""Busca vinetas casi identicas en fichas distintas.

Un hecho mantenido en dos sitios se desincroniza: es lo que produjo las
contradicciones de las rondas 48-50 (LW contra BJ sobre la perdida de
habilidades, EZ contra RG sobre el estudio de Doherty, FW contra RF sobre la
Ley 1618, NA contra RL sobre los plazos de despido). Lo que aqui se busca no es
el plagio: es el mantenimiento duplicado. Cuando dos fichas dicen casi lo mismo,
una de las dos deberia remitir a la otra.

Da falsos positivos a proposito (formulas de la casa que se repiten adrede, como
el bloque de urgencia o el aviso de alcance): se lee, no se obedece.

Uso:  python3 scripts/pruebas/vinetas-gemelas.py [umbral]
"""
import io, json, re, sys, collections

UMBRAL = float(sys.argv[1]) if len(sys.argv) > 1 else 0.72
MINIMO_PALABRAS = 12

# Formulas que la casa repite a proposito, ficha por ficha, y que no son
# mantenimiento duplicado sino convencion.
CONVENCION = re.compile(
    r'los colores indican|el color dice|marca lo que proponemos|no cuánta prisa corre'
    r'|aviso de alcance|transparencia:', re.I)

d = json.load(io.open('web/content/biblioteca-cuerpo.json', encoding='utf-8'))
temas = d.get('temas', d)

def cuerpo(md):
    return md if isinstance(md, str) else (md.get('cuerpo') or '')

def palabras(t):
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)          # enlaces -> texto
    t = re.sub(r'[*_`>#]', ' ', t)
    t = re.sub(r'[^0-9a-záéíóúüñ ]', ' ', t.lower())
    return [p for p in t.split() if len(p) > 3]

vinetas = []
for cod, md in temas.items():
    for linea in cuerpo(md).split('\n'):
        l = linea.strip()
        if not l.startswith('- ') or CONVENCION.search(l):
            continue
        ps = palabras(l)
        if len(ps) < MINIMO_PALABRAS:
            continue
        vinetas.append((cod, l, set(ps)))

# Indice invertido por las palabras menos frecuentes, para no comparar todo con todo.
frec = collections.Counter(p for _, _, s in vinetas for p in s)
raras = {p for p, n in frec.items() if n <= 40}
indice = collections.defaultdict(list)
for i, (_, _, s) in enumerate(vinetas):
    for p in list(s & raras)[:14]:
        indice[p].append(i)

vistos, pares = set(), []
for candidatos in indice.values():
    for a in range(len(candidatos)):
        for b in range(a + 1, len(candidatos)):
            i, j = candidatos[a], candidatos[b]
            if (i, j) in vistos:
                continue
            vistos.add((i, j))
            if vinetas[i][0] == vinetas[j][0]:
                continue
            si, sj = vinetas[i][2], vinetas[j][2]
            jac = len(si & sj) / len(si | sj)
            if jac >= UMBRAL:
                pares.append((jac, vinetas[i][0], vinetas[j][0], vinetas[i][1], vinetas[j][1]))

pares.sort(reverse=True)
print('vinetas comparadas: %d · pares por encima de %.2f: %d\n' % (len(vinetas), UMBRAL, len(pares)))
for jac, c1, c2, t1, t2 in pares[:40]:
    print('[%.2f] %s  <->  %s' % (jac, c1, c2))
    print('   %s: %s' % (c1, t1[:230]))
    print('   %s: %s' % (c2, t2[:230]))
    print()
