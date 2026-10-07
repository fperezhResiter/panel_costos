#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETL REAL v2 del Panel de Costos — MODELO MENSUAL (habilita filtro de fecha histórico).

Fuentes (fuentes/):
  - Ppto:  Detalle Ppto 2026 ... (Ventas + Mg Explotación)
  - OC:    OC 2025 hasta 15-06-2026.xlsx   (compras, por FECHAGENERACION)
  - IG:    IG 202604 Resiter Final.xlsm    (P&L completo por faena/partida/mes, hasta abr-2026)
  - Plan de cuentas: hoja 'Clasificacion' del IG 202512.

Modelo de gasto (acordado):
  - OC = partidas de compra (todas menos remuneraciones y depreciación), con detalle para drill-down.
  - IG = remuneraciones (2.01) y depreciación (2.06), TODAS las zonas, meses cerrados (no el mes en curso).
  - faena -> zona y nombre canónico salen del IG (autoridad). El IG define las 8 zonas.

Salida: data/data.json  +  dist/panel_costos.html
"""
import warnings
warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')   # celdas con fechas basura en columnas de la OC que no usamos
import openpyxl, csv, json, os, re, unicodedata, hashlib, base64, datetime as dt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MOTOR = os.path.dirname(os.path.abspath(__file__))
RAIZ  = os.path.dirname(MOTOR)
FUENTES = os.path.join(RAIZ, "Fuentes")
P = lambda *a: os.path.join(MOTOR, *a)        # template/mapeos/data viven en motor/

def _buscar(desc, kws=(), ext=None):
    if not os.path.isdir(FUENTES):
        raise SystemExit("ERROR: no encuentro la carpeta 'Fuentes'. Ejecutá el motor desde la carpeta del panel.")
    cands=[f for f in os.listdir(FUENTES) if not f.startswith('~$') and (ext is None or f.lower().endswith(ext))]
    for f in cands:
        if not kws or any(k in f.lower() for k in kws): return os.path.join(FUENTES, f)
    raise SystemExit(f"ERROR: falta el archivo de {desc} en 'Fuentes' "
                     f"(debe ser {ext or 'un archivo'}" + (f" con '{kws[0]}' en el nombre)." if kws else ")."))

IG   = _buscar("IG (Informe de Gestion)", (), ".xlsm")
PPTO = _buscar("Presupuesto", ("presu","ppto","detalle"), ".xlsx")
CLAS = _buscar("Plan de cuentas", ("plan","cuenta","clasif","lgch","202512"), ".xlsx")
def _buscar_opcional(kws, ext):
    if not os.path.isdir(FUENTES): return None
    for f in os.listdir(FUENTES):
        if f.startswith('~$'): continue
        if f.lower().endswith(ext) and any(k in f.lower() for k in kws): return os.path.join(FUENTES, f)
    return None
# Proyección comprometida: la plantilla viva de Control de Gestión manda; si no está, se usa Fuentes/
_OD = '/Users/manueljose/Library/CloudStorage/OneDrive-RESITERS.A/'
_CANDIDATOS_PROY = [
    _OD+'02_Presupuesto_y_Proyecciones/Proyeccion_Cierre_2026/Proyeccion_Cierre_2026.xlsx',   # estructura sep-2026
    _OD+'Control de Gestión Resiter/02_Presupuesto_y_Proyecciones/Proyeccion_Cierre_2026/Proyeccion_Cierre_2026.xlsx',
    _OD+'Control de Gestión Resiter/02_Presupuesto_y_Proyecciones/Proyección Actualizada/Proyeccion_Cierre_2026.xlsx']
PROY_CG = next((p for p in _CANDIDATOS_PROY if os.path.exists(p)), None)
PROY = PROY_CG or _buscar_opcional(("proy",), ".xlsx")   # opcional

SCALE_PPTO = 1000          # ppto en miles de CLP -> CLP (la OC está en pesos)
def ym(d): return f"{d.year:04d}-{d.month:02d}"
def mes_off_str(s, n):
    y,m = int(s[:4]), int(s[5:7]); m2 = m-1+n; return f"{y+m2//12:04d}-{m2%12+1:02d}"
def dias_mes(y, m): return (dt.date(y+(m==12), m%12+1, 1) - dt.date(y, m, 1)).days

# --- OC INCREMENTAL: se acumula un archivo por mes; no se recarga el histórico ---
def _oc_files():
    """Archivos de OC: todos los de la subcarpeta Fuentes/OC/ (un export por mes),
    o un OC.xlsx suelto en Fuentes/ (compatibilidad)."""
    sub=os.path.join(FUENTES,"OC")
    if os.path.isdir(sub):
        fs=[os.path.join(sub,f) for f in sorted(os.listdir(sub))
            if f.lower().endswith((".xlsx",".xlsm")) and not f.startswith("~$")]
        if fs: return fs
    return [_buscar("OC (compras SAP)", ("oc",), ".xlsx")]

OC_COLS=['NOMBRECCONSUMO','NOMBRELINEADENEGOC','NOMBRECONCEPTOIMPU','FECHAGENERACION',
         'VALORTOTALNETOOC','NOMBREPROVEEDOR','NUMEROOC','NOMBREPRODUCTO','LINEAOC']
_OC=None
def cargar_oc():
    """Lee TODOS los archivos de OC y los une a nivel de LÍNEA de OC (NUMEROOC, LINEAOC).
    - Dentro de un archivo, la OC se denormaliza (varias filas por recepción/factura): el valor
      está en una fila y las demás van en 0, por eso se SUMAN las filas de la misma línea.
    - Entre archivos, si una línea se repite (re-export de un mes), gana el archivo más reciente.
    Así podés ir agregando un archivo por mes sin recargar el histórico ni duplicar montos."""
    global _OC
    if _OC is not None: return _OC
    master={}
    for path in _oc_files():
        wb=openpyxl.load_workbook(path, read_only=True, data_only=True); ws=wb['Hoja1']
        hdr=[c.value for c in next(ws.iter_rows(min_row=1,max_row=1))]
        ix=[next((i for i,h in enumerate(hdr) if h and str(h).startswith(c)),None) for c in OC_COLS]
        iNoc,iLin,iVal=ix[6],ix[8],ix[4]
        pf={}   # línea -> [valor_sumado, fila_representativa]
        for r in ws.iter_rows(min_row=2, values_only=True):
            key=(r[iNoc] if iNoc is not None else None, r[iLin] if iLin is not None else None)
            try: v=float(r[iVal] or 0)
            except: v=0.0
            e=pf.get(key)
            if e is None: pf[key]=[v, [r[i] if i is not None else None for i in ix]]
            else:
                e[0]+=v
                if v: e[1]=[r[i] if i is not None else None for i in ix]   # fila con el valor manda
        for key,(vs,rep) in pf.items():
            rep[4]=vs
            old=master.get(key)   # algunos exports de SAP vienen con FECHAGENERACION vacía: conservar la fecha buena anterior
            if old is not None and not isinstance(rep[3],dt.datetime) and isinstance(old[3],dt.datetime):
                rep[3]=old[3]
            master[key]=tuple(rep)   # el último archivo procesado gana
        wb.close()
    _OC=list(master.values())
    return _OC

HOY = max((r[3].date() for r in cargar_oc() if isinstance(r[3],dt.datetime)), default=dt.date.today())
MES_ACT = ym(HOY); DIA_HOY = HOY.day
# meses seleccionables = últimos 6 meses hasta el corte; detalle = últimos 8 (para modal P, P-1, P-2)
MESES_SEL = [mes_off_str(MES_ACT,-i) for i in range(5,-1,-1)]
MESES_DET = [mes_off_str(MES_ACT,-i) for i in range(7,-1,-1)]
IG_HASTA = MES_ACT          # se recalcula con el último mes real del IG

def norm(s):
    if s is None: return ''
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii','ignore').decode().upper().strip()
    return ' '.join(s.split())

# OJO: ' II' y ' WOOD' NO se recortan — Collahuasi II, Lomas Bayas II y Centinela Wood son centros de costo propios
SUF = ['ASEO INDUSTRIAL','ASEO ASE','ASEO','BARRIDO','INTEGRAL','LIX','LAV','ASE',' RO','PLANTA RO','SPIGOTS','OSMOSIS','HIDRICO']
def base_faena(s):
    n = norm(s)
    for suf in SUF:
        if n.endswith(suf): n = n[:-len(suf)].strip()
    return n

def canon_ln(s):
    n = norm(s)
    for kw, fam in [('RESIDUO','Gestión de residuos'),('SANITIZ','Sanitización'),('SANITAR','Servicios sanitarios'),
                    ('ASEO','Aseo industrial'),('INTEGRAL','Servicios integrales'),('CONSTRUC','Servicios de construcción'),
                    ('COMERCIAL','Comercialización'),('LAVAND','Lavandería'),('ECONOMIA','Economía circular'),
                    ('ADMIN','Administración'),('AGUA','Aguas')]:
        if kw in n: return fam
    return s.strip().title() if isinstance(s,str) and s.strip() else '(s/LN)'

# sufijo de hoja IG -> línea canónica
LINE_MAP = {'RES':'Gestión de residuos','PLA':'Aguas','SAN':'Servicios sanitarios','COM':'Servicios integrales',
            'INS':'Comercialización','CONST':'Servicios de construcción','SANIT':'Sanitización',
            'ASEO':'Aseo industrial','BARRIDO':'Aseo industrial','LIX':'Aseo industrial','SPIGOTS':'Aseo industrial',
            'OSMOSIS':'Aguas','REDES':'Aguas','STWC':'Aguas','WOOD':'Servicios sanitarios'}
MES_HDR = {'DIC-25':'2025-12','ENERO':'2026-01','FEBRERO':'2026-02','MARZO':'2026-03','ABRIL':'2026-04',
           'MAYO':'2026-05','JUNIO':'2026-06','JULIO':'2026-07','AGOSTO':'2026-08','SEPTIEMBRE':'2026-09',
           'OCTUBRE':'2026-10','NOVIEMBRE':'2026-11','DICIEMBRE':'2026-12'}

# --------------------------------------------------------------------
def cargar_clasificacion():
    wb = openpyxl.load_workbook(CLAS, read_only=True, data_only=True); ws = wb['Clasificacion']
    partidas = {}
    for r in ws.iter_rows(min_row=2, max_row=51, values_only=True):
        cod_niv, nom_niv, nom_part = r[3], r[4], r[2]
        if not cod_niv: continue
        cod_niv = str(cod_niv)
        grupo = {'1':'Ingresos','2':'Costo directo','5':'Gasto administración'}.get(cod_niv.split('.')[0],'Otros')
        partidas.setdefault(cod_niv, (cod_niv, (nom_niv or nom_part), grupo))
    wb.close(); return partidas

# --------------------------------------------------------------------
# IG: faena -> (zona, nombre canónico)  +  remun/deprec mensual por faena/línea
# --------------------------------------------------------------------
MESES_NOMBRE_HOJA = re.compile(r'^(Dic-25|Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)$', re.I)
def parse_ig():
    wb = openpyxl.load_workbook(IG, read_only=True, data_only=True)
    faena2zona = {}        # norm(faena_base) -> (zona, display)
    z8_bases = set()
    ig_rows = []           # (zona, faena_display, linea, cod_partida, mes, monto)
    zona = None
    for ws in wb.worksheets:
        t = ws.title.strip()
        mz = re.match(r'^Zona (\d)$', t)
        if mz: zona = 'Zona '+mz.group(1); continue
        if zona is None or t in ('Hoja1','Consolidado') or MESES_NOMBRE_HOJA.match(t): continue
        toks = t.split()
        suf = toks[-1].upper() if len(toks) > 1 else ''
        linea = LINE_MAP.get(suf)
        faena_disp = ' '.join(toks[:-1]) if (linea and len(toks) > 1) else t
        fb = base_faena(faena_disp)
        _ab = ALIAS_FAENA.get(fb)   # typos del IG (ej. hoja 'Tecks CMRS San' → 'Teck CMRS')
        if _ab:
            _fb2 = base_faena(_ab)
            faena_disp = faena2zona[_fb2][1] if _fb2 in faena2zona else _ab.title()
            fb = _fb2
        if zona == 'Zona 8': z8_bases.add(fb)
        else: faena2zona.setdefault(fb, (zona, faena_disp))
        if zona == 'Zona 8': faena2zona.setdefault('ASEO::'+fb, ('Zona 8', faena_disp))
        if linea is None: continue
        # localizar columnas de mes desde la fila 7
        hdr = list(ws.iter_rows(min_row=7, max_row=7, values_only=True))[0]
        col_mes = {}
        for ci, v in enumerate(hdr):
            k = MES_HDR.get(norm(v).replace(' ',''))
            if k: col_mes[ci] = k
        # recorrer filas de costo del PRIMER bloque (hasta 'TOTAL COSTOS')
        for r in ws.iter_rows(min_row=8, max_row=40, values_only=True):
            nom = r[1] if len(r) > 1 else None
            if not nom: continue
            nn = norm(nom)
            if nn.startswith('TOTAL COSTOS') or nn.startswith('MARGEN'): break
            cod = None
            if 'PERSONAL' in nn and 'TRANSPORTE' not in nn: cod = '2.01'
            elif 'DEPRECIAC' in nn: cod = '2.06'
            if not cod: continue
            for ci, mes in col_mes.items():
                if mes > MES_ACT or ci >= len(r): continue   # nunca más allá del mes en curso
                v = r[ci]
                if isinstance(v, (int, float)) and v:
                    ig_rows.append((zona, faena_disp, linea, cod, mes, float(v)*1000.0))  # IG en miles -> CLP
    wb.close()
    return faena2zona, z8_bases, ig_rows

# --------------------------------------------------------------------
# faena (OC) -> (zona, nombre canónico) usando el IG como autoridad
# --------------------------------------------------------------------
def cargar_ppto_f2z():
    wb = openpyxl.load_workbook(PPTO, read_only=True, data_only=True); ws = wb['Resiter Minería (Ventas)']
    zona=cc=None; m={}
    es_zona=lambda z: isinstance(z,str) and re.match(r'^Zona \d', z.strip())
    for r in ws.iter_rows(min_row=5, values_only=True):
        z,c,ln=r[3],r[4],r[5]
        if es_zona(z): zona=z
        elif isinstance(z,str) and z.strip()=='Zona': zona=cc=None
        if isinstance(c,str) and c.strip() and c.strip()!='CC': cc=c
        if ln and es_zona(zona) and cc: m.setdefault(base_faena(cc),(zona,cc.strip()))
    wb.close(); return m

ALIAS_FAENA = {'GOLDS FIELDS':'GOLDFIELDS','SUCURSAL IQUIQUE':'SUC IQUIQUE','SUCURSAL COPIAPO':'SUC COPIAPO',
    'SUCURSAL CALAMA':'SUC CALAMA','SUCURSAL ANTOFAGASTA':'SUC ANTOFAGASTA','SUCURSAL LA SERENA':'SUC LA SERENA',
    'LOS PELAMBRES':'PELAMBRES','MLP':'PELAMBRES','CODELCO EL SALVADOR PLANTA RO':'CODELCO EL SALVADOR PLANTA RO P',
    'MEL SERVICIO INDUSTRIAL':'MEL 5400','WATER SUPPLY 2':'WATERSUPPLY2',
    # equivalencias confirmadas por el usuario (jun-2026)
    'SAL PUNTA DE LOBOS':'SAL PUNTA LOBOS','ECOMETALES SPOT':'ECOMETALES POLVO','TECKS CMRS':'TECK CMRS',
    'DCH SUBTERRANEO':'DCH SUBTERREANO','MLP PUERTO CHUNGO':'MLP PTO CHUNGO',
    'AGUAS PACIFICO':'AGUA PACIFICO','CMP VALLE DEL HUASCO':'VALLE HUASCO','CMP VALLE HUASCO':'VALLE HUASCO'}
# Áreas corporativas (no son faena): van a "Administración". SG Activos y los Proyectos = corporativo.
CORP_KW = ('DEPTO','GERENCIA','MARKETING','RRHH','FINANZAS','CONTABILIDAD','CASA MATRIZ','SISTEMAS','ABASTECIMIENTO',
           'PREVENCION','COMPLIANCE','DESARROLLO ORGANIZACIONAL','EDIFICIO','SAP ','DPTO','SGP','BI 2.0',
           'GESTION DE PERSONAS','RESPONSAB','HIGIENE Y SALUD','SG COMPRAS','SG CONTROL','SG FILIALES','SG ACTIVOS','SG ASESORIAS',
           'INGENIERIA Y CONST','PROYECTO')
def construir_resolver(faena2zona, z8_bases, ppto_f2z):
    es_aseo = lambda n: ('ASEO' in n or 'BARRIDO' in n or 'SPIGOTS' in n or n.endswith('LIX'))
    def resolver(f):
        n = norm(f); b = base_faena(f)
        if es_aseo(n): return ('Zona 8', f.strip().title())   # TODO aseo = Zona 8 (regla del usuario)
        if b in faena2zona: return faena2zona[b]
        if n in ALIAS_FAENA:
            ab = base_faena(ALIAS_FAENA[n])
            if ab in faena2zona: return faena2zona[ab]
            if es_aseo(n) and ab in z8_bases: return ('Zona 8', f.strip().title())
        if b in ppto_f2z: return ppto_f2z[b]
        for fb,(z,disp) in faena2zona.items():
            if fb and len(fb)>5 and not es_aseo(n) and (fb in n or n in fb): return (z,disp)
        if any(k in n for k in CORP_KW): return ('Administración', f.strip().title())
        return ('(Revisar)', f.strip().title())
    return resolver

# --------------------------------------------------------------------
# OC: mensual por (zona,faena,linea,partida) + detalle  (reruteo de 2.01/2.06 fuera de OC)
# --------------------------------------------------------------------
REGLAS = [
    ('ACTIVO','CAPEX'),   # compras de activo fijo: no son gasto, se separan del panel
    ('EXAMEN','2.03'),('PSICOLAB','2.03'),('REGALIA','2.13'),('BENEF','2.13'),('COLACION','2.13'),
    ('ALIMENT','2.13'),('CASINO','2.13'),('TRANSPORTE PERSONAL','2.04'),('TRANSPORTE DEL','2.04'),
    ('HOSPEDAJE','2.16'),('VIAJE','2.16'),('CAPACITAC','2.03'),('RECLUT','2.03'),
    ('FINIQUITO','2.02'),('ARRIENDO','2.07'),('COMBUSTIBLE','2.08'),('LUBRICANTE','2.08'),
    ('GAS VAPOR','2.08'),('NEUMATICO','2.09'),('ELEMENTOS DE TRABAJO','2.11'),('ELEMENTO DE TRABAJO','2.11'),
    ('ROPA','2.11'),('DETERGENTE','2.11'),('MATERIALES DE ASEO','2.11'),('ARTICULOS DE ASEO','2.11'),
    ('EPP','2.12'),('SEGURIDAD INDUSTRIAL','2.12'),('ELEMENTOS SEGURIDAD','2.12'),
    ('IT Y TELE','2.14'),('SISTEMAS','2.14'),('TELECOMUNIC','2.14'),
    ('MANTENC','2.17'),('REPARAC','2.17'),('REPUESTO','2.17'),('FILTRO','2.17'),
    ('COMPRA DE COMER','2.19'),('VENTA DE COMERC','2.19'),('FLETE','2.20'),('MULTA','2.21'),
    ('ASESORIA','2.22'),('REEMBOLS','2.23'),
    ('AGUA POTABLE','2.15'),('AGUA Y ALC','2.15'),('ENERGIA','2.15'),('LAVANDERIA','2.15'),
    ('VERTEDERO','2.15'),('BAÑOS','2.15'),('BANOS','2.15'),('ARTICULOS DE ESCRIT','2.15'),
    ('ARTICULOS DE OFICINA','2.15'),('PAPELERIA','2.15'),('OFICINA','2.15'),
    ('QUIMICO','2.15'),('FERRETERIA','2.15'),('HIDRAULICO','2.15'),('ELECTRICO','2.15'),
    ('MAQUINARIA','2.07'),('CAMION','2.07'),('TRANSPORTE','2.20'),('SERV','2.22'),
    # NOTA: los conceptos de activo ('Puente Activo fijo', 'Activos para la venta') van a CAPEX:
    # se excluyen del gasto (vuelven como depreciación 2.06 vía IG) y se informan aparte.
    # 2.01/2.06 son exclusivos del IG.
]
def sembrar_concepto_partida(conceptos):
    path = P("mapeos","concepto_partida.csv")
    if os.path.exists(path): return cargar_csv(path)
    os.makedirs(P("mapeos"), exist_ok=True)
    filas = []
    for c in sorted(conceptos):
        cn = norm(c); cod = next((p for sub,p in REGLAS if sub in cn), '(Revisar)')
        filas.append((c, cod))
    escribir_csv(path, ["concepto","partida_cod"], filas)
    return {c:cod for c,cod in filas}

def procesar_oc(resolver, c2p):
    # filas ya deduplicadas (OC_COLS): 0=faena 1=ln 2=concepto 3=fecha 4=val 5=prov 6=noc 7=prod 8=linea
    cache={}
    def res(f):
        if f not in cache: cache[f]=resolver(f)
        return cache[f]
    mens={}      # (zona,faena,linea,part) -> {mes: monto}
    capex={}     # (zona,faena,linea) -> {mes: monto}  — activo fijo: NO es gasto, se informa aparte
    detalle=[]   # filas detalle (meses MESES_DET)
    for r in cargar_oc():
        fecha=r[3]
        if not isinstance(fecha, dt.datetime): continue
        mes=f"{fecha.year:04d}-{fecha.month:02d}"
        zona,faena = res(r[0] or '')
        linea = canon_ln(r[1])
        if linea=='Aseo industrial': zona='Zona 8'   # el negocio de aseo ES la Zona 8, sin importar la faena
        part = c2p.get((r[2] or '').strip(), '(Revisar)')
        if part in ('2.01','2.06'): part='(Revisar)'   # 2.01/2.06 son exclusivos del IG
        try: v=float(r[4] or 0)
        except: v=0.0
        if part=='CAPEX':
            d=capex.setdefault((zona,faena,linea),{}); d[mes]=d.get(mes,0)+v
            continue
        k=(zona,faena,linea,part)
        d=mens.setdefault(k,{}); d[mes]=d.get(mes,0)+v
        if mes in MESES_DET:
            detalle.append((zona,faena,linea,part,fecha.strftime('%Y-%m-%d'),round(v),
                            (r[5] or '').strip(),(r[7] or r[2] or '').strip(),str(r[6] or '')))
    return mens, detalle, capex

# --------------------------------------------------------------------
# (El presupuesto ya no se usa como comparador: el plan es la Proyección comprometida.
#  El archivo de ppto se mantiene solo como apoyo del mapa faena→zona.)
# --------------------------------------------------------------------
# Proyección de cierre: total de costo del mes por contrato -> mismo formato que costo_ppto
# --------------------------------------------------------------------
def proy_costo_mes():
    if not PROY: return {}
    wb = openpyxl.load_workbook(PROY, read_only=True, data_only=True)
    if 'Resumen Costos x Mes' not in wb.sheetnames: wb.close(); return {}
    ws = wb['Resumen Costos x Mes']
    es_zona = lambda z: isinstance(z,str) and re.match(r'^Zona \d', z.strip())
    out = {}
    for r in ws.iter_rows(min_row=3, values_only=True):
        zona, unidad, contrato = r[0], r[1], r[2]
        if not (es_zona(zona) and unidad and contrato): continue   # descarta subtotales 'Total Zona X'
        toks = str(contrato).split()
        linea = LINE_MAP.get(toks[-1].upper()) if len(toks) > 1 else None
        if linea is None and len(toks) > 2:   # sufijo compuesto, ej. 'Planta Ro P' -> 'RO'
            linea = {**LINE_MAP, 'RO':'Aguas'}.get(toks[-2].upper())
        if linea is None: continue
        meses = [(float(r[4+i])*SCALE_PPTO if isinstance(r[4+i],(int,float)) else 0.0) for i in range(12)]
        zk = 'Zona 8' if linea=='Aseo industrial' else zona.strip()   # aseo siempre en su propia zona
        b = base_faena(unidad); b = base_faena(ALIAS_FAENA.get(b, b))   # corrige typos de la plantilla (ej. 'Tecks CMRS')
        k = (zk, b, linea)
        prev = out.get(k); out[k] = [(prev[i] if prev else 0)+meses[i] for i in range(12)]
    wb.close(); return out

# helpers csv
def escribir_csv(path, cols, filas):
    with open(path,"w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(cols); w.writerows(filas)
def cargar_csv(path):
    out={}
    with open(path,encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            ks=list(row.keys()); out[row[ks[0]].strip()]=row[ks[1]].strip()
    return out

# --------------------------------------------------------------------
# Contraseña + cifrado del panel (AES-GCM; la clave deriva por PBKDF2)
# --------------------------------------------------------------------
def clave_panel():
    cp = P("clave.txt")
    if os.path.exists(cp):
        c = open(cp, encoding="utf-8").read().strip()
        if c: return c
    c = "Resiter.Costos.2026"
    open(cp, "w", encoding="utf-8").write(c)
    print("\n*** AVISO: se creó 'motor/clave.txt' con una contraseña por defecto.")
    print("    Editá ese archivo para poner la tuya y volvé a actualizar. ***")
    return c

def cifrar(payload, clave):
    salt = os.urandom(16); iv = os.urandom(12)
    key = hashlib.pbkdf2_hmac('sha256', clave.encode('utf-8'), salt, 200000, 32)
    ct = AESGCM(key).encrypt(iv, payload.encode('utf-8'), None)
    b = lambda x: base64.b64encode(x).decode()
    return {"v":1, "iter":200000, "salt":b(salt), "iv":b(iv), "ct":b(ct)}

# --------------------------------------------------------------------
def main():
    partidas = cargar_clasificacion()
    faena2zona, z8_bases, ig_rows = parse_ig()
    ig_hasta = max((r[4] for r in ig_rows), default=MES_ACT)   # último mes real con datos de IG
    ppto_f2z = cargar_ppto_f2z()
    resolver = construir_resolver(faena2zona, z8_bases, ppto_f2z)

    # conceptos OC -> sembrar mapeo (desde las filas ya cargadas)
    conceptos={ (r[2] or '').strip() for r in cargar_oc() }
    c2p = sembrar_concepto_partida(conceptos)

    oc_mens, detalle, capex = procesar_oc(resolver, c2p)

    # unificar actuals mensuales: OC (compras) + IG (2.01/2.06)
    mens = {}   # (zona,faena,linea,part) -> {mes: monto}
    for k,d in oc_mens.items():
        mens.setdefault(k,{}).update({m:mens.get(k,{}).get(m,0)+v for m,v in d.items()})
    for (zona,faena,linea,cod,mes,v) in ig_rows:
        if linea=='Aseo industrial': zona='Zona 8'
        k=(zona,faena,linea,cod); mens.setdefault(k,{}); mens[k][mes]=mens[k].get(mes,0)+v

    # proyección comprometida por contrato (zona, faena, línea, mes) — SIN reparto por partida
    dims_faena = {}   # (zona,base,linea) -> faena display (de mens)
    for (zona,faena,linea,part) in mens: dims_faena.setdefault((zona,base_faena(faena),linea), faena)
    proy_rows=[]   # (zona,faena,linea,mes,monto)
    for dimk,cm in proy_costo_mes().items():
        zona,bfa,linea = dimk; faena = dims_faena.get(dimk, bfa.title())
        for M in range(1,13):
            if cm[M-1]: proy_rows.append((zona,faena,linea,f"2026-{M:02d}",cm[M-1]))

    # ---- catálogos e índices ----
    pnom = lambda c: partidas.get(c,(c, c if c!='(Revisar)' else '(Revisar)','Costo directo'))
    parts_presentes = sorted({k[3] for k in mens})
    PARTIDAS = [{"cod":c, "nombre":pnom(c)[1], "grupo":pnom(c)[2]} for c in parts_presentes]
    pidx = {c:i for i,c in enumerate(parts_presentes)}
    zonas = sorted({k[0] for k in mens} | {r[0] for r in proy_rows} | {k[0] for k in capex})
    unidades = sorted({(k[1],k[0]) for k in mens} | {(r[1],r[0]) for r in proy_rows} | {(k[1],k[0]) for k in capex})
    lineas = sorted({k[2] for k in mens} | {r[2] for r in proy_rows} | {k[2] for k in capex})
    zidx={z:i for i,z in enumerate(zonas)}; uidx={(n,z):i for i,(n,z) in enumerate(unidades)}; lidx={l:i for i,l in enumerate(lineas)}

    MENS=[]
    for (zona,faena,linea,part),d in mens.items():
        if (faena,zona) not in uidx: continue
        fu = 1 if part in ('2.01','2.06') else 0
        for m,v in d.items():
            if v: MENS.append([zidx[zona],uidx[(faena,zona)],lidx[linea],pidx[part],m,round(v),fu])
    PROY=[]   # proyección por contrato: [zi, ui, li, mes, monto]
    for (zona,faena,linea,mes,v) in proy_rows:
        if (faena,zona) in uidx:
            PROY.append([zidx[zona],uidx[(faena,zona)],lidx[linea],mes,round(v)])
    CAPEX=[]
    for (zona,faena,linea),d in capex.items():
        for m,v in d.items():
            if v: CAPEX.append([zidx[zona],uidx[(faena,zona)],lidx[linea],m,round(v)])

    provs={}; concs={}
    def interna(d,s):
        s=s or '—'
        if s not in d: d[s]=len(d)
        return d[s]
    DET=[]
    for (zona,faena,linea,part,fecha,monto,prov,conc,noc) in detalle:
        if (faena,zona) not in uidx: continue
        DET.append([zidx[zona],uidx[(faena,zona)],lidx[linea],pidx[part],fecha,monto,interna(provs,prov),interna(concs,conc),noc])

    data=dict(
        meta=dict(hoy=HOY.isoformat(), mes_actual=MES_ACT, dia_hoy=DIA_HOY, ig_hasta=ig_hasta,
                  meses=MESES_SEL, moneda="CLP", escala=1_000_000, generado=HOY.isoformat()+"T11:00:00",
                  origen="real (OC SAP + IG) vs proyección comprometida"),
        dim=dict(zona=zonas, unidad=[{"nombre":n,"zona":z} for n,z in unidades], linea=lineas),
        partidas=PARTIDAS, cat=dict(prov=list(provs.keys()), conc=list(concs.keys())),
        mens=MENS, proy=PROY, det=DET, capex=CAPEX)

    os.makedirs(P("data"),exist_ok=True)
    json.dump(data, open(P("data","data.json"),"w",encoding="utf-8"), ensure_ascii=False)
    clave = clave_panel()
    blob = cifrar(json.dumps(data, ensure_ascii=False), clave)
    html=open(P("template.html"),encoding="utf-8").read().replace("/*__CIFRADO__*/ null", json.dumps(blob))
    logo_path=P("logo_white.b64")
    if os.path.exists(logo_path):
        html=html.replace("__LOGO__", open(logo_path,encoding="utf-8").read().strip())
    salida=os.path.join(RAIZ,"Panel Costos Resiter.html")
    open(salida,"w",encoding="utf-8").write(html)

    sm=lambda mes: sum(v for k,d in mens.items() for m,v in d.items() if m==mes)
    cx=lambda mes: sum(v for k,d in capex.items() for m,v in d.items() if m==mes)
    print("\n========================================")
    print("  PANEL ACTUALIZADO CORRECTAMENTE")
    print("========================================")
    print(f"  Unidades: {len(unidades)} | Partidas: {len(parts_presentes)} | OC al {HOY} | IG hasta {ig_hasta}")
    m2,m1,m0 = mes_off_str(MES_ACT,-2), mes_off_str(MES_ACT,-1), MES_ACT
    print(f"  Gasto {m2}: {sm(m2)/1e6:,.0f} MM | {m1}: {sm(m1)/1e6:,.0f} MM | {m0} (a hoy): {sm(m0)/1e6:,.0f} MM")
    print(f"  Activo fijo EXCLUIDO del gasto -> {m2}: {cx(m2)/1e6:,.0f} MM | {m1}: {cx(m1)/1e6:,.0f} MM | {m0}: {cx(m0)/1e6:,.0f} MM")
    ruta_proy = globals()['PROY']   # la ruta global (PROY local es el array de salida)
    if ruta_proy: print(f"  Proyección leída de: {os.path.basename(ruta_proy)}" + (" (Control de Gestión)" if ruta_proy==PROY_CG else " (Fuentes/)"))
    print(f"\n  Abri el archivo:  Panel Costos Resiter.html")
    print("========================================")

if __name__=="__main__":
    main()
