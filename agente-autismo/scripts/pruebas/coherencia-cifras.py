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
        yield cod, cuerpo

# Una "afirmacion con cifra" = el numero + las palabras de contenido a su lado.
CIFRA=re.compile(r'(\d+(?:[.,]\d+)?)\s?(%|veces|de cada \d+)')
def claves(ventana):
    ws=[w for w in norm(ventana).split() if len(w)>=4 and w not in VACIAS and not w.isdigit()]
    return ws

def main():
    afirm=[]
    for cod, cuerpo in fichas():
        for m in CIFRA.finditer(cuerpo):
            a=max(0, m.start()-90); b=min(len(cuerpo), m.end()+90)
            ventana=cuerpo[a:b]
            afirm.append((cod, m.group(0), m.group(1), set(claves(ventana)), ventana))

    # Dos afirmaciones "del mismo tema" si comparten >=3 palabras de contenido
    # poco frecuentes. Si ademas el numero difiere, es candidata a contradiccion.
    frec=collections.Counter()
    for _,_,_,ks,_ in afirm: frec.update(ks)
    raras=lambda ks: {k for k in ks if frec[k]<=25}

    vistos=set(); salida=[]
    for i in range(len(afirm)):
        ci,ti,ni,ki,vi = afirm[i]
        ri=raras(ki)
        if len(ri)<3: continue
        for j in range(i+1, len(afirm)):
            cj,tj,nj,kj,vj = afirm[j]
            if ci==cj: continue
            comun=ri & raras(kj)
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
