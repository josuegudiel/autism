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
# Vocabulario de metodo: aparece alrededor de CUALQUIER cifra y no dice de que
# trata. Emparejaba la sensibilidad de un cribado de autismo (MF) con la de la
# autotoma del VPH (NW) solo porque las dos frases dicen 'sensibilidad' y
# 'especificidad'. Lo que tiene que coincidir para sospechar una contradiccion
# es el TEMA, no el aparato estadistico.
VACIAS |= set('''sensibilidad especificidad metanalisis metaanalisis analisis revision sistematica estudio
 estudios ensayo ensayos cohorte muestra muestras participantes personas ninos ninas adultos adolescentes
 jovenes autistas autista poblacion prevalencia frecuencia cifras cifra datos media mediana rango horquilla
 intervalo confianza odds ratio riesgo proporcion porcentaje encontro hallo reporto describe publicado
 publicada segun frente comparacion grupo grupos general veces mayor menor alrededor entorno unos unas
 profesional profesionales sanitario clinico clinica primero tenido hecho intento'''.split())

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
            # "IC 95 %" no es una afirmacion: es la etiqueta del intervalo de
            # confianza, y emparejaba cualquier cifra con cualquier otra en
            # decenas de pares. Lo mismo "p<0,05" y los "95 % 22,1-30,5".
            antes = cuerpo[max(0, m.start()-14):m.start()].lower()
            if re.search(r'\b(ic|i\.c\.|intervalo de confianza|confianza)\s*$', antes.strip()):
                continue
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

    # Pares ya revisados a mano y descartados como contradiccion (23/09). Se
    # siguen calculando, pero salen al final y aparte, para que un par NUEVO no
    # se pierda entre dieciocho conocidos. Si tocas una de estas fichas, quita su
    # linea y vuelve a mirarlo: el par de O y HQ ya se colo una vez asi, se
    # arreglo O y se dejo HQ diciendo lo contrario durante rondas.
    REVISADOS = {
        # --- El estudio de fugas (Anderson 2012) y sus derivados. 49% intento
        # escaparse x 53% de esos = 26% del total; 65% trafico y 24% agua son
        # subcifras de los que estuvieron desaparecidos. Todo cuadra.
        ('MJ','NH'), ('JD','MJ'), ('MJ','PF'), ('LH','MJ'), ('LI','NH'), ('MA','MJ'), ('LH','PF'),
        # --- Ahogamientos (Guan y Li): 52% estanques, 13% rios, 13% lagos.
        # --- Digestivo: McElhanon 2014 (37% estrenimiento) y Wang 2022 (~26%).
        # A, AA y ME lo dicen las tres, y AA y ME se remiten entre si.
        ('A','ME'), ('AA','ME'), ('A','AA'),
        # --- Suicidalidad: ideacion 34,2%, planes 21,9%, intentos 24,3% del
        # mismo metanalisis. G, AL, LN, MZ y RK citan subcifras distintas.
        ('LN','MZ'), ('MZ','RK'), ('MS','MZ'), ('G','LN'), ('AL','LN'), ('AL','G'), ('LN','RK'),
        # --- Recurrencia en hermanos: 18,7% (2011, n=664) y 20,2% (2024,
        # n=1.605), que el propio texto dice que no difieren; y el 3-10% viejo.
        ('BM','LS'), ('FA','HP'), ('EK','HP'),
        # --- Heredabilidad (~80%) frente a recurrencia en hermanos (~20%): dos
        # cosas distintas que comparten vocabulario.
        # --- Diferencias sensoriales: ~90% (E) cae dentro del ~80-95% (Y).
        ('E','Y'),
        # --- El mito del divorcio: DM lo cita como "80%" y GE como "80-90%";
        # las dos lo desmienten.
        ('DM','GE'),
        # --- Alexitimia: ~50% en autismo (Kinnaird) frente a ~5% en poblacion
        # general. Son las dos poblaciones del mismo dato.
        ('AB','RB'),
        # --- Violencia y discapacidad: Jones 2012 (26,7%) y su actualizacion
        # de 2022 (31,7%).
        ('LL','PN'),
        # --- Otros revisados el 23/09 y descartados: cifras distintas del mismo
        # informe, poblaciones distintas, o pruebas distintas que comparten
        # "sensibilidad" y "especificidad".
        ('LB','QI'), ('KA','KC'), ('PP','QR'), ('MQ','QP'), ('AF','CG'), ('JH','LA'),
        ('GN','PW'), ('O','HQ'), ('BJ','O'), ('BJ','JK'), ('MF','NW'), ('LJ','NS'),
        ('QI','RF'), ('QH','QZ'), ('QC','QS'), ('PH','RJ'), ('PC','RJ'), ('AY','P'),
        ('NA','NB'), ('MB','QJ'), ('LV','PB'), ('LM','MI'), ('LM','NY'), ('LI','QX'),
        ('KH','PB'), ('IQ','PW'), ('IM','QX'), ('IM','LI'), ('I','NY'), ('ET','I'),
        ('FU','RJ'), ('FI','PJ'), ('EV','EW'), ('DX','EA'), ('DV','HY'), ('CX','DR'),
        ('BQ','EM'), ('BF','HX'), ('MR','RL'), ('DM','GE'), ('S','EF'),
    }
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
            # Redondeo, no contradiccion: MZ publica "1 de cada 4 (25 %)" donde
            # MS da el 25,2 % exacto, y "1 de cada 3 (34 %)" donde RK da 34,2 %.
            # Es una decision de lectura deliberada y emparejaba doce pares.
            try:
                fi, fj = float(ni.replace(',','.')), float(nj.replace(',','.'))
                if abs(fi-fj) <= 0.5 and ('.' in ni or ',' in ni or '.' in nj or ',' in nj):
                    continue
            except ValueError:
                pass
            if len(comun)>=3 and ni!=nj:
                par=(ci,cj,ti,tj)
                if par in vistos: continue
                vistos.add(par)
                salida.append((len(comun), ci, ti, cj, tj, sorted(comun)[:5], vi, vj))
    salida.sort(reverse=True)
    nuevos = [x for x in salida if tuple(sorted((x[1], x[3]))) not in
              {tuple(sorted(par)) for par in REVISADOS}]
    conocidos = len(salida) - len(nuevos)
    def pinta(titulo, lista, lim):
        print('\n===== %s (%d) =====' % (titulo, len(lista)))
        for n,ci,ti,cj,tj,com,vi,vj in lista[:lim]:
            print('\n[%d palabras en comun] %s dice "%s" / %s dice "%s"' % (n,ci,ti,cj,tj))
            print('   comun:', ', '.join(com))
            print('   %s: ...%s...' % (ci, ' '.join(vi.split())[:160]))
            print('   %s: ...%s...' % (cj, ' '.join(vj.split())[:160]))

    todas = '--todas' in sys.argv
    print('afirmaciones con cifra: %d | pares divergentes: %d (%d ya revisados a mano)'
          % (len(afirm), len(salida), conocidos))
    pinta('PARES NUEVOS, para mirar', nuevos, len(nuevos))
    if todas:
        pinta('Pares ya revisados y descartados', [x for x in salida if x not in nuevos], len(salida))
    elif conocidos:
        print('\n(%d pares ya revisados; pasa --todas para verlos)' % conocidos)

main()
