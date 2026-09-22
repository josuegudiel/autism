#!/usr/bin/env python3
"""Busca cifras que la biblioteca publica de dos maneras distintas.

Las contradicciones que han ido apareciendo (el umbral de la fiebre en LV y QP,
el del vomito en ocho fichas, el implante de NW, la formacion policial de CJ)
tenian todas la misma forma: dos fichas hablando de LO MISMO con numeros o
umbrales distintos, y nadie mirandolas juntas. Esto las busca antes de que una
ronda nueva se tropiece con ellas.

Uso: coherencia.py [--todas]
"""
import re, sys, unicodedata, collections

LIB='/home/user/autism/agente-autismo/research/biblioteca-autismo.md'
VACIAS=set('de la el los las en y a que con por para un una del al se su sus lo es son como mas o ni sin sobre entre cada'.split())
# Palabras del andamiaje de la ficha: aparecen en todas y no dicen de que va la
# afirmacion, pero dentro de una ventana son "raras" y emparejaban cualquier cosa.
VACIAS |= set('clave mensaje cubierto verificado fuentes comprobadas verificadas ronda revisada sintesis depurada seguridad lectura encaje contradicciones'.split())

def norm(s):
    s=unicodedata.normalize('NFD', s.lower())
    s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    return re.sub(r'[^a-z0-9 ]',' ', s)

def fichas():
    t=open(LIB,encoding='utf-8').read()
    partes=re.split(r'(?m)^### ', t)
    for p in partes[1:]:
        cod=p.split('.')[0].strip()
        cuerpo=('### '+p).split('> **Para la app')[0]
        # Fuera los enlaces: un %2F de una fecha dentro de una URL no es una
        # cifra que la biblioteca afirme, y llenaba la salida de ruido.
        cuerpo=re.sub(r'\]\([^)]*\)', ']', cuerpo)
        cuerpo=re.sub(r'https?://\S+', ' ', cuerpo)
        cuerpo=cuerpo.split('**Fuentes:**')[0]
        # Fuera la cabecera: "JL. Autismo en la etapa preescolar (3 a 6 anos) —
        # VERIFICADO (Ronda 16...)" no afirma nada, pero metia "3 a 6 anos" en la
        # lista y emparejaba titulos entre si por las palabras del estado.
        cuerpo=re.sub(r'^[^\n]*\n', '', cuerpo, count=1)
        yield cod, cuerpo

# Una "afirmacion con cifra" = el numero + las palabras de contenido a su lado.
# Los porcentajes no son el unico sitio donde la biblioteca se contradice: el
# choque del vomito tras un golpe en la cabeza era un UMBRAL ("basta uno" contra
# "mas de una vez"), y el de la fiebre en LV era una condicion de tiempo. Por eso
# tambien se miran los plazos y los umbrales contados.
CIFRA=re.compile(r'(\d+(?:[.,]\d+)?)\s?(%|(?:veces|de cada \d+|minutos?|horas?|d[ií]as?|semanas?|meses|a[nñ]os?)\b)')
def claves(ventana):
    ws=[w for w in norm(ventana).split() if len(w)>=4 and w not in VACIAS and not w.isdigit()]
    return ws

def main():
    afirm=[]
    for cod, cuerpo in fichas():
        for m in CIFRA.finditer(cuerpo):
            a=max(0, m.start()-90); b=min(len(cuerpo), m.end()+90)
            ventana=cuerpo[a:b]
            unidad=re.sub(r'^\d+(?:[.,]\d+)?\s?','',m.group(0))
            unidad=re.sub(r'de cada \d+','de cada',unidad)
            unidad=re.sub(r'(minuto|hora|d[ií]a|semana|mes|a[nñ]o)s?$',r'\1',unidad)
            afirm.append((cod, m.group(0), m.group(1), set(claves(ventana)), ventana, unidad))

    # Dos afirmaciones "del mismo tema" si comparten >=3 palabras de contenido
    # poco frecuentes. Si ademas el numero difiere, es candidata a contradiccion.
    frec=collections.Counter()
    for _,_,_,ks,_,_ in afirm: frec.update(ks)
    raras=lambda ks: {k for k in ks if frec[k]<=25}

    vistos=set(); salida=[]
    for i in range(len(afirm)):
        ci,ti,ni,ki,vi,ui = afirm[i]
        ri=raras(ki)
        if len(ri)<3: continue
        for j in range(i+1, len(afirm)):
            cj,tj,nj,kj,vj,uj = afirm[j]
            if ci==cj: continue
            # Un plazo y un porcentaje nunca se contradicen: "4 años" contra
            # "26%" salia en seis pares del estudio de fugas sin ser nada.
            if ui!=uj: continue
            comun=ri & raras(kj)
            # Si las DOS ventanas contienen las DOS cifras, las fichas estan de
            # acuerdo y solo las emparejamos nosotros: 65 % de trafico y 24 % de
            # agua salian enfrentados en seis pares y en ninguno habia conflicto.
            if ni in vj and nj in vi: continue
            if len(comun)>=3 and ni!=nj:
                par=(ci,cj,ti,tj)
                if par in vistos: continue
                vistos.add(par)
                salida.append((len(comun), ci, ti, cj, tj, sorted(comun)[:5], vi, vj))
    salida.sort(reverse=True)
    lim=len(salida) if '--todas' in sys.argv else 18
    print('afirmaciones con cifra: %d | pares divergentes: %d' % (len(afirm), len(salida)))
    for n,ci,ti,cj,tj,com,vi,vj in salida[:lim]:
        print('\n[%d palabras en comun] %s dice "%s" / %s dice "%s"' % (n,ci,ti,cj,tj))
        print('   comun:', ', '.join(com))
        print('   %s: ...%s...' % (ci, ' '.join(vi.split())[:160]))
        print('   %s: ...%s...' % (cj, ' '.join(vj.split())[:160]))

main()
