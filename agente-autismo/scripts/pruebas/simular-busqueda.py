#!/usr/bin/env python3
"""Reimplementa buscarTemas() de web/app.js para poder probar en seco una
entrada de sinonimos ANTES de anadirla. Sirve sobre todo para cazar el
secuestro por subcadena: nf.includes(q) da 30 puntos a cualquier consulta que
sea subcadena de la frase, asi que "tiene tdah y autismo" -> A le roba la
consulta "tdah" a U, cuyo titulo solo suma 28.

AVISO IMPORTANTE (23/09): esto NO es la app. Reimplementa `buscarTemas()`,
que puntua sobre el indice -titulo, claves, mensaje-, pero la app hace ademas
una busqueda dentro del CUERPO de las fichas (biblioteca-busqueda.json) que
cambia el orden. En tres de setenta y siete consultas probadas, la app y este
simulador daban primeras respuestas distintas, y en las tres la de la app era
mejor: "dice que quiere morirse" (app: Salud mental y seguridad; aqui: Plan de
crisis), "le huelen mucho los pies" (app: Cortar las unas; aqui: Higiene
sensorial) y "se me trepa por todos lados" (app: Hiperactividad; aqui:
Asegurar la casa).

Uselo para iterar rapido -es instantaneo y no necesita navegador-, pero
**antes de asertar una consulta en la suite, compruebala contra la app**.
"""
import json, re, unicodedata, sys

REPO='/home/user/autism/agente-autismo'
VACIAS=set()

def norm(s):
    s=unicodedata.normalize('NFD', (s or '').lower())
    s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    return re.sub(r'[^a-z0-9 ]',' ', s)

def dentro_como_palabra(aguja, pajar):
    if not aguja or not pajar: return False
    i = pajar.find(aguja)
    if i < 0: return False
    antes = pajar[i-1] if i else ''
    despues = pajar[i+len(aguja)] if i+len(aguja) < len(pajar) else ''
    return not (antes.isalnum() or despues.isalnum())

def tokenizar(s):
    return [t for t in norm(s).split() if len(t)>=3 and t not in VACIAS]

idx=json.load(open(REPO+'/web/content/biblioteca-indice.json',encoding='utf-8'))
TEMAS=idx['temas'] if isinstance(idx,dict) else idx
SIN_BASE=json.load(open(REPO+'/scripts/sinonimos.json',encoding='utf-8'))

def buscar(q, extra=None):
    sin=dict((k,v) for k,v in SIN_BASE.items() if not k.startswith('_') and isinstance(v,list))
    if extra: sin.update(extra)
    q=norm(q).strip(); q=re.sub(r'\s+',' ',q)
    tokens=tokenizar(q)
    imp={}
    for frase,cods in sin.items():
        nf=norm(frase).strip(); nf=re.sub(r'\s+',' ',nf)
        tf=tokenizar(nf); peso=0
        # Por palabra entera, igual que web/app.js: una consulta de tres
        # letras no puede casar dentro de otra palabra.
        if dentro_como_palabra(nf,q) or dentro_como_palabra(q,nf): peso=30
        elif tf:
            com=sum(1 for t in tf if t in tokens)
            if com==len(tf): peso=24
            elif com>=2: peso=14
        if peso:
            # El orden dentro del sinonimo decide el desempate: la primera ficha
            # es el destino principal (mismo descuento que web/app.js).
            for i,c in enumerate(cods):
                imp[c]=max(imp.get(c,0), peso - min(i,6)*0.5)
    res=[]
    for t in TEMAS:
        titulo=norm(t['titulo']); mensaje=norm(t.get('mensaje') or '')
        p=imp.get(t['codigo'],0)
        if titulo==q: p+=60
        elif titulo.startswith(q): p+=30
        elif q and q in titulo: p+=20
        for tk in tokens:
            if tk in titulo: p+=8
            elif tk in (t.get('claves') or []): p+=5
            elif tk in mensaje: p+=2
        if p>0: res.append((p,t['codigo'],t['titulo'][:60]))
    res.sort(key=lambda r:(-r[0], r[2]))
    return res

if __name__=='__main__':
    for q in sys.argv[1:]:
        print('==', q)
        for p,c,t in buscar(q)[:5]: print('  %3d %-3s %s' % (p,c,t))
