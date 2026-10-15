const CIFRADO = /*__CIFRADO__*/ null;   // datos cifrados (AES-GCM); se descifran con la contraseña
const LOGO_PDF = /*__LOGO_PDF__*/ null; // incrustado para exportar también desde file://
let DATA;
// Excel OOXML sin dependencias externas: funciona también al abrir el panel localmente.
function excelOc(hojas){
  const xml=v=>String(v??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const col=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
  const archivos=[];
  const add=(nombre,contenido)=>archivos.push([nombre,new TextEncoder().encode(contenido)]);
  add('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add('xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h,i)=>`<sheet name="${xml(h.nombre)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
  add('xl/_rels/workbook.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // Estilos: normal, cabecera, pesos, porcentaje, azul, amarillo, rojo y pendiente.
  add('xl/styles.xml',`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${['17365D','DCEAF7','FFF2CC','FCE4D6','E7E6E6'].map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8">${[[0,0,0],[0,1,2],[3,0,0],[9,0,0],[9,0,3],[9,0,4],[9,0,5],[0,0,6]].map(([n,f,b])=>`<xf numFmtId="${n}" fontId="${f}" fillId="${b}" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  hojas.forEach((h,i)=>{
    const last=col(h.anchos.length-1), fin=h.filas.length;
  const rows=h.filas.map((r,ri)=>`<row r="${ri+1}"${h.alturas?.[ri]?` ht="${h.alturas[ri]}" customHeight="1"`:ri===h.cabecera-1?' ht="32" customHeight="1"':''}>${r.map((cel,ci)=>{
      const v=cel&&typeof cel==='object'?cel.v:cel;
      const s=cel&&typeof cel==='object'?(cel.s||0):0;
      const ref=col(ci)+(ri+1);
      return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}" s="${s}"><v>${v}</v></c>`:`<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    add(`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="${ns}"><dimension ref="A1:${last}${fin}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="${h.cabecera}" topLeftCell="A${h.cabecera+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${h.anchos.map((w,j)=>`<col min="${j+1}" max="${j+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${h.filtro===false?'':`<autoFilter ref="A${h.cabecera}:${last}${fin}"/>`}</worksheet>`);
  });
  // Contenedor ZIP sin compresión (método STORE), con CRC32 por entrada.
  const tabla=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
  const crc=b=>{let c=0xFFFFFFFF;for(const v of b)c=tabla[(c^v)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
  const partes=[],central=[];let offset=0,tamCentral=0;
  for(const[nombre,b]of archivos){
    const n=new TextEncoder().encode(nombre),c=crc(b);
    const local=new Uint8Array(30+n.length),lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034B50,true);lv.setUint16(4,20,true);lv.setUint16(12,33,true);
    lv.setUint32(14,c,true);lv.setUint32(18,b.length,true);lv.setUint32(22,b.length,true);lv.setUint16(26,n.length,true);local.set(n,30);
    partes.push(local,b);
    const dir=new Uint8Array(46+n.length),dv=new DataView(dir.buffer);
    dv.setUint32(0,0x02014B50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(14,33,true);
    dv.setUint32(16,c,true);dv.setUint32(20,b.length,true);dv.setUint32(24,b.length,true);dv.setUint16(28,n.length,true);dv.setUint32(42,offset,true);dir.set(n,46);
    central.push(dir);tamCentral+=dir.length;offset+=local.length+b.length;
  }
  const fin=new Uint8Array(22),fv=new DataView(fin.buffer);
  fv.setUint32(0,0x06054B50,true);fv.setUint16(8,archivos.length,true);fv.setUint16(10,archivos.length,true);fv.setUint32(12,tamCentral,true);fv.setUint32(16,offset,true);
  return new Blob([...partes,...central,fin],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const el=id=>document.getElementById(id);
const _b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const SESION_COSTOS='resiterCostosSesion';
const PASES_COSTOS='resiterCostosNavegacion';
const DOCUMENTOS_COSTOS='resiterCostosDocumentos';
function leerSesionCostos(){
  try{return JSON.parse(sessionStorage.getItem(SESION_COSTOS));}catch(_){return null;}
}
function rutaAcceso(url){const u=new URL(url,location.href);return u.origin+u.pathname;}
function autorizarDestinoCostos(url){
  const destino=new URL(url,location.href),sesion=leerSesionCostos();
  if(!DATA||!sesion?.id||sesion.salt!==CIFRADO.salt)return destino;
  try{
    const ahora=Date.now(),pases=JSON.parse(sessionStorage.getItem(PASES_COSTOS))||{};
    for(const[token,pase]of Object.entries(pases))if(ahora-pase.creado>120000)delete pases[token];
    const token=crypto.randomUUID();
    pases[token]={ruta:rutaAcceso(destino),sesion:sesion.id,creado:ahora};
    sessionStorage.setItem(PASES_COSTOS,JSON.stringify(pases));
    destino.searchParams.set('acceso',token);
  }catch(_){}
  return destino;
}
function permiteRestaurarAcceso(sesion){
  const url=new URL(location.href),token=url.searchParams.get('acceso');
  if(token){
    let pase;
    try{
      const pases=JSON.parse(sessionStorage.getItem(PASES_COSTOS))||{};
      pase=pases[token];delete pases[token];sessionStorage.setItem(PASES_COSTOS,JSON.stringify(pases));
    }catch(_){}
    url.searchParams.delete('acceso');history.replaceState(history.state,'',url.href);
    return pase?.sesion===sesion.id&&pase.ruta===rutaAcceso(url)&&Date.now()-pase.creado<=120000;
  }
  // Recargar o retroceder conserva el acceso del documento desbloqueado.
  const tipo=performance.getEntriesByType('navigation')[0]?.type;
  let documentos={};try{documentos=JSON.parse(sessionStorage.getItem(DOCUMENTOS_COSTOS))||{};}catch(_){}
  return ['reload','back_forward'].includes(tipo)&&documentos[rutaAcceso(url)]===sesion.id;
}
function recordarAccesoActual(){
  const sesion=leerSesionCostos();
  if(!sesion?.id)return;
  try{
    const documentos=JSON.parse(sessionStorage.getItem(DOCUMENTOS_COSTOS))||{};
    documentos[rutaAcceso(location.href)]=sesion.id;
    sessionStorage.setItem(DOCUMENTOS_COSTOS,JSON.stringify(documentos));
  }catch(_){}
}
document.addEventListener('click',ev=>{
  const enlace=ev.target.closest('.panel-enlace,.navegacion-paneles a,.volver-inicio,.dic-volver-reporte');
  if(enlace&&DATA)enlace.href=autorizarDestinoCostos(enlace.href).href;
});
async function descifrarConLlave(key){
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:_b64(CIFRADO.iv)},key,_b64(CIFRADO.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function descifrar(clave){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(clave),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:_b64(CIFRADO.salt),iterations:CIFRADO.iter,hash:'SHA-256'},
            km,{name:'AES-GCM',length:256},true,['decrypt']);
  const datos=await descifrarConLlave(key);
  try{
    const bytes=new Uint8Array(await crypto.subtle.exportKey('raw',key));
    sessionStorage.setItem(SESION_COSTOS,JSON.stringify({id:crypto.randomUUID(),salt:CIFRADO.salt,llave:btoa(String.fromCharCode(...bytes))}));
  }catch(_){}
  return datos;
}
el('gateForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const b=el('gateBtn'), er=el('gateErr');
  er.textContent=''; b.disabled=true; b.textContent='Abriendo…';
  try{ DATA=await descifrar(el('gatePass').value); }
  catch(_){ er.textContent='Contraseña incorrecta.'; b.disabled=false; b.textContent='Entrar'; el('gatePass').select(); return; }
  el('gatePass').value='';recordarAccesoActual();el('gate').remove();iniciar();
});
// La llave vive en la pestaña. Solo los enlaces autorizados o una recarga
// del documento desbloqueado la reutilizan; abrir un HTML directamente pide clave.
(async()=>{
  const sesion=leerSesionCostos();
  if(!sesion?.id||sesion.salt!==CIFRADO.salt||!permiteRestaurarAcceso(sesion))return;
  try{
    const key=await crypto.subtle.importKey('raw',_b64(sesion.llave),{name:'AES-GCM'},false,['decrypt']);
    DATA=await descifrarConLlave(key);
  }catch(_){try{sessionStorage.removeItem(SESION_COSTOS);}catch(_){}return;}
  recordarAccesoActual();el('gate').remove();iniciar();
})();

function iniciar(){
if(document.body.dataset.vista==='inicio')return;
const META=DATA.meta, ESC=META.escala||1e6;
const ZN=DATA.dim.zona, UN=DATA.dim.unidad.map(u=>u.nombre), LN=DATA.dim.linea;
const PART=DATA.partidas, PROV=DATA.cat.prov, CONC=DATA.cat.conc, COMENT=DATA.cat.comentario||[];
// Administración (centros corporativos) no se muestra en el panel: fuera de filas, filtros y totales
const _zAdm=ZN.indexOf('Administración');
const _sinAdm=rows=>rows.filter(r=>r[0]!==_zAdm);
const MENS=_sinAdm(DATA.mens), PROY=_sinAdm(DATA.proy||[]), DET=_sinAdm(DATA.det), CAPEX=_sinAdm(DATA.capex||[]);
// semáforo: real vs proyectado al día (comparable). Umbrales editables:
const SEM_AMARILLO=1.00, SEM_ROJO=1.10;   // azul <=100% del plan · amarillo hasta +10% · rojo sobre +10%
const META_DESDE='2026-08';   // la proyección comprometida rige como meta desde este mes
let IGOK=true;    // ¿el período visto ya tiene IG (remuneraciones/depreciación) cargado?
let HAY_META=true;   // ¿el período visto tiene meta comparable?
const fmt=v=>(v==null)?'–':(Math.round(v/ESC*10)/10).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
const pesos=v=>'$ '+Math.round(v).toLocaleString('es-CL');
const MESNOM=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const mesNom=m=>{const[a,mm]=m.split('-');return MESNOM[+mm-1]+'-'+a.slice(2);};
const diasMes=m=>{const[a,mm]=m.split('-').map(Number);return new Date(a,mm,0).getDate();};
const prevMes=m=>{let[a,mm]=m.split('-').map(Number);mm--;if(mm<1){mm=12;a--;}return a+'-'+String(mm).padStart(2,'0');};

el('origen').textContent=META.origen;
el('corteLbl').textContent='Última publicación: '+String(META.generado||META.hoy).replace('T',' ')+' · Datos al '+META.hoy+' · Cifras en MM$ (millones de pesos)';
if(el('th_dif')){
el('th_dif').dataset.tip='Diferencia = costo real − costo proyectado a hoy.\nPositiva (roja) = se gastó más que el plan; negativa (verde) = bajo el plan.';
el('th_sem').dataset.tip='% Avance = costo real / proyectado a hoy.\nAzul: dentro del plan (hasta 100%).\nAmarillo: hasta +10% sobre el plan.\nRojo: más de +10% sobre el plan.\nEl criterio es el mismo en contrato, unidad, zona y división.';
el('th_pm').dataset.tip='Costo total comprometido del mes según la Proyección de Cierre de Control de Gestión.\nIncluye remuneraciones y depreciación.';
}
// tooltip propio (los nativos son lentos/poco fiables)
const _tip=el('tip');
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]');if(t){_tip.textContent=t.dataset.tip;_tip.classList.add('on');}});
document.addEventListener('mousemove',e=>{if(_tip.classList.contains('on')){let x=e.clientX+14;if(x+_tip.offsetWidth>innerWidth-8)x=e.clientX-_tip.offsetWidth-14;_tip.style.left=x+'px';_tip.style.top=(e.clientY+18)+'px';}});
document.addEventListener('mouseout',e=>{if(e.target.closest('[data-tip]'))_tip.classList.remove('on');});

// período: el más reciente por defecto
opciones(el('fPeriodo'), META.meses.slice().reverse(), null);
el('fPeriodo').value=META.mes_actual;
// Zona 1 + 2 se ven juntas (comparten gerente): opción combinada en el filtro
const COMBO='Zona 1 + 2';
const zOk=(zona,fz)=>!fz||zona===fz||(fz===COMBO&&(zona==='Zona 1'||zona==='Zona 2'));
const zLista=[];
for(const z of ZN.filter(z=>z&&z!=='Administración')){ zLista.push(z); if(z==='Zona 2')zLista.push(COMBO); }
opciones(el('fZona'), zLista);
function opciones(sel,items,todos='(Todas)'){
  sel.innerHTML=(todos?'<option value="">'+todos+'</option>':'')+items.map(i=>`<option>${i}</option>`).join('');
}
function refrescarUnidades(){
  const z=el('fZona').value;
  const us=DATA.dim.unidad.filter(u=>u.zona!=='Administración'&&zOk(u.zona,z)).map(u=>u.nombre);
  opciones(el('fUnidad'),[...new Set(us)].sort());
}
function refrescarLineas(){
  const z=el('fZona').value,u=el('fUnidad').value,cur=el('fLinea').value;
  const con=new Set();
  for(const h of HECHOS){ if(!zOk(h.zona,z))continue; if(u&&h.unidad!==u)continue; if(h.mtd||h.proy_mes)con.add(h.linea); }
  el('fLinea').innerHTML='<option value="">(Todas)</option>'+LN.filter(l=>l!=='Administración').map(l=>{
    const dis=con.has(l)?'':' disabled'; const sel=(l===cur&&!dis)?' selected':'';
    return `<option${dis}${sel}>${l}</option>`;}).join('');
  if(cur&&!con.has(cur))el('fLinea').value='';
}

// ---------- recálculo por contrato (zona · unidad · línea) para el período elegido ----------
let HECHOS=[],CAPEXH=[],DIA=1,DIM=30;
function hechosPeriodo(P){
  const esActual=P===META.mes_actual,DIM=diasMes(P),DIA=esActual?META.dia_hoy:DIM,P1=prevMes(P);
  const map=new Map();
  const get=(zi,ui,li)=>{const k=zi+'|'+ui+'|'+li;let o=map.get(k);if(!o){o={zi,ui,li,mtd:0,pj:0,ig3:0,tot3:0};map.set(k,o);}return o;};
  // últimos 3 meses cerrados CON IG: peso esperado de remuneraciones+depreciación por contrato
  let b=esActual?P1:P; if(META.ig_hasta&&META.ig_hasta<b)b=META.ig_hasta;
  const M3=[b,prevMes(b),prevMes(prevMes(b))];
  for(const r of MENS){ const m=r[4],v=r[5];
    if(m===P) get(r[0],r[1],r[2]).mtd+=v;
    if(M3.includes(m)){ const o=get(r[0],r[1],r[2]); o.tot3+=v; if(r[6])o.ig3+=v; }
  }
  for(const r of PROY){ if(r[3]===P) get(r[0],r[1],r[2]).pj+=r[4]; }
  const hechos=[];
  for(const o of map.values()){
    hechos.push({zona:ZN[o.zi],unidad:UN[o.ui],linea:LN[o.li],zi:o.zi,ui:o.ui,li:o.li,
      mtd:o.mtd,proy_mes:o.pj,proy_fecha:o.pj*DIA/DIM,ig3:o.ig3,tot3:o.tot3});
  }
  return hechos;
}
function recomputar(){
  const P=el('fPeriodo').value||META.mes_actual;
  const esActual=(P===META.mes_actual);
  DIM=diasMes(P); DIA=esActual?META.dia_hoy:DIM;
  const P1=prevMes(P);
  IGOK=(P<=META.ig_hasta);
  HAY_META=(P>=META_DESDE);
  if(el('tabla'))el('tabla').classList.toggle('sin-meta', !HAY_META);
  HECHOS=hechosPeriodo(P);
  // capex (activo fijo): informativo, fuera del gasto
  const cmap=new Map();
  for(const r of CAPEX){ if(r[3]===P){ const k=r[0]+'|'+r[1]+'|'+r[2];
    cmap.set(k,(cmap.get(k)||{zona:ZN[r[0]],unidad:UN[r[1]],linea:LN[r[2]],mtd:0}));
    cmap.get(k).mtd+=r[4]; } }
  CAPEXH=[...cmap.values()];
  // cabeceras + estado del mes
  if(el('th_real')){
  el('th_real').innerHTML='Real<span class="sub">'+mesNom(P)+(esActual?(' (días 1–'+DIA+')'):(IGOK?' (mes completo)':' (compras del mes)'))+'</span>';
  el('th_ph').innerHTML='Proyectado a hoy<span class="sub">'+(esActual?('al día '+DIA):'mes completo')+(IGOK?'':' · sin remun/deprec')+' <i class="ic">i</i></span>';
  el('th_ph').dataset.tip=IGOK
    ?'Costo proyectado del mes (Proyección de Cierre). Con el mes completo, es la proyección entera.'
    :'Costo proyectado comparable: proyección del mes prorrateada al día '+DIA+' de '+DIM+',\nSIN la parte de remuneraciones y depreciación (que aún no está en el real,\nporque el IG cierra el 15–20 del mes siguiente). Así real y proyectado hablan de lo mismo.';
  }
  const LEY=' &nbsp;<span class="sem sem-mini sem-azul">azul: en plan</span> <span class="sem sem-mini sem-amarillo">amarillo: hasta +10%</span> <span class="sem sem-mini sem-rojo">rojo: sobre +10%</span>';
  const SINMETA=' <b>Este mes no tiene meta</b>: la proyección comprometida rige desde '+mesNom(META_DESDE)+', por eso se muestra solo el costo real (clic en un contrato para ver su detalle).';
  const eM=el('estadoMes');
  if(esActual){
    eM.className='estado';
    eM.innerHTML='<b>'+mesNom(P)+' está en curso</b> (día '+DIA+' de '+DIM+'): compras al día'+(HAY_META?' contra proyección comprometida al día. Las remuneraciones y la depreciación llegan con el IG el mes siguiente, por eso el proyectado comparable las excluye.'+LEY:'.'+SINMETA);
  }else if(!IGOK){
    eM.className='estado';
    eM.innerHTML='<b>'+mesNom(P)+' está cerrado en compras, pero el IG aún no llega</b>: faltan remuneraciones y depreciación.'+(HAY_META?' El proyectado comparable las excluye para que la comparación sea justa.'+LEY:SINMETA);
  }else{
    eM.className='estado completo';
    eM.innerHTML='<b>'+mesNom(P)+' es un mes completo</b> (compras + remuneraciones y depreciación del IG).'+(HAY_META?' El semáforo compara el costo total real contra la proyección comprometida del mes.'+LEY:SINMETA);
  }
  if(el('notaPie'))el('notaPie').textContent='Meta = Proyección de Cierre comprometida (Control de Gestión), por contrato y mes; rige desde '+mesNom(META_DESDE)+' — los meses anteriores muestran solo el costo real. Real = órdenes de compra SAP (actualización diaria) + remuneraciones y depreciación del IG en meses cerrados (IG disponible hasta '+mesNom(META.ig_hasta)+'). Clic en un contrato (línea de negocio) para ver sus OCs. Las compras de activo fijo no son gasto y se informan aparte bajo el TOTAL. Los centros corporativos (Administración) no se incluyen.';
}

// ---------- árbol y render ----------
const AGG=['mtd','proy_mes','proy_fecha','ig3','tot3'];
const zero=()=>Object.fromEntries(AGG.map(k=>[k,0]));
const addM=(a,h)=>{for(const k of AGG)a[k]+=(h[k]||0);};
let ORDEN=null;
const VISTA=document.body.dataset.vista||'reporte';
let NIVEL='contrato';   // detalle del árbol: por contrato (unidad → línea) o por unidad
function filtros(){return{z:el('fZona').value,u:el('fUnidad').value,l:el('fLinea').value};}
function niveles(f){
  if(NIVEL==='zona')return ['zona'];
  const n=[];
  if(!f.z||f.z===COMBO)n.push('zona');
  if(!f.u)n.push('unidad');
  if(NIVEL==='contrato')n.push('linea');
  if(!n.length)n.push('linea');   // unidad filtrada en vista por unidad: mostrar sus contratos igual
  return n;
}
function construir(rows,lvls){
  const raiz={m:zero(),ch:new Map()};
  for(const h of rows){ addM(raiz.m,h); let nodo=raiz;
    for(let i=0;i<lvls.length;i++){ const key=h[lvls[i]];
      let c=nodo.ch.get(key);
      if(!c){c={m:zero(),ch:(i<lvls.length-1?new Map():null),key,lvl:lvls[i],leaf:(i===lvls.length-1)?h:null,ctx:Object.assign({},nodo.ctx||{},{[lvls[i]]:key})};nodo.ch.set(key,c);}
      addM(c.m,h); nodo=c;
    }
  }
  return raiz;
}
const rIG=m=>m.tot3?m.ig3/m.tot3:0;   // peso esperado de remun+deprec (últimos 3 meses con IG)
const planHoy=m=>IGOK?m.proy_fecha:m.proy_fecha*(1-rIG(m));   // proyectado comparable al día
function semaforo(m){
  const plan=planHoy(m);
  if(!plan||plan<0) return '<span class="sem sem-nd">–</span>';
  const r=m.mtd/plan, pct=Math.round(r*100)+'%';
  const cls=r<=SEM_AMARILLO?'sem-azul':(r<=SEM_ROJO?'sem-amarillo':'sem-rojo');
  return `<span class="sem ${cls}">${pct}</span>`;
}
function difCell(m){
  const plan=planHoy(m);
  if(!plan) return '<td>–</td>';
  const d=m.mtd-plan;
  return `<td class="${d>0?'neg':'pos'}">${d>0?'+':''}${fmt(d)}</td>`;
}
const colapsado=new Set();
let ramasActivas=[];
let leaves=[];
let contextoTotal;
function ordZona(z){const m=/^Zona (\d+)/.exec(z);if(m)return +m[1];if(z==='(Revisar)')return 99;return 80;}
// unidades sin ninguna compra en el período: fuera del árbol, agrupadas en una fila informativa
function partirSinMov(rows){
  const act=new Set();
  for(const h of rows) if(h.mtd) act.add(h.ui);
  const mov=[],sin=[],us=new Set();
  for(const h of rows){ if(act.has(h.ui))mov.push(h); else {sin.push(h);us.add(h.ui);} }
  return {mov,sin,n:us.size};
}

function coincideContexto(r,c){
  if(c.pares)return c.pares.has(r[0]+'|'+r[1]+'|'+r[2]);
  return (c.zi==null||r[0]===c.zi)&&(c.ui==null||r[1]===c.ui)&&(c.li==null||r[2]===c.li);
}
function contextoGrupo(rows,titulo){
  const f=filtros();
  return {titulo,zona:f.z||'Todas las zonas',unidad:f.u||'Todas las unidades',linea:f.l||null,
    pares:new Set(rows.map(h=>h.zi+'|'+h.ui+'|'+h.li))};
}
function valorOrden(c,col){
  const m=c.m,plan=planHoy(m);
  return col==='apertura'?c.key:col==='real'?m.mtd:col==='ph'?plan:
    col==='dif'?(plan?m.mtd-plan:null):col==='sem'?(plan>0?m.mtd/plan:null):m.proy_mes;
}
function compararNodos(a,b){
  if(!ORDEN)return a[1].lvl==='zona'?ordZona(a[0])-ordZona(b[0]):b[1].m.mtd-a[1].m.mtd||a[0].localeCompare(b[0]);
  const x=valorOrden(a[1],ORDEN.col),y=valorOrden(b[1],ORDEN.col);
  if(x==null||y==null)return x==null?(y==null?0:1):-1;
  const cmp=typeof x==='string'?x.localeCompare(y,'es',{numeric:true}):x-y;
  return cmp*ORDEN.dir||a[0].localeCompare(b[0],'es',{numeric:true});
}
function activarOrden(){
  for(const col of ['apertura','real','ph','dif','sem','pm']){
    const th=el('th_'+col);if(!th)continue;
    if(!th.querySelector('button'))th.innerHTML='<button type="button" class="orden-columna">'+th.innerHTML+'</button>';
    th.setAttribute('aria-sort',ORDEN?.col===col?(ORDEN.dir===-1?'descending':'ascending'):'none');
    const boton=th.querySelector('button');
    boton.title='Ordenar '+(ORDEN?.col===col&&ORDEN.dir===-1?'de menor a mayor':'de mayor a menor');
    boton.onclick=()=>{ORDEN={col,dir:ORDEN?.col===col?-ORDEN.dir:-1};render();};
  }
  if(el('ordenDefault'))el('ordenDefault').disabled=!ORDEN;
}
function render(){
  const f=filtros(),lvls=niveles(f);
  const {mov,sin,n:nSin}=partirSinMov(HECHOS.filter(h=>zOk(h.zona,f.z)&&(!f.u||h.unidad===f.u)&&(!f.l||h.linea===f.l)));
  const raiz=construir(mov,lvls);
  contextoTotal=contextoGrupo(mov,'Total División');
  if(el('cuerpo')){
  ramasActivas=[];
  (function ramas(nodo,path){if(!nodo.ch)return;for(const[key,c]of nodo.ch){const p=path+'¦'+key;if(c.ch){ramasActivas.push(p);ramas(c,p);}}})(raiz,'');
  const todasAbiertas=ramasActivas.length>0&&ramasActivas.every(p=>!colapsado.has(p));
  el('expandir').textContent=todasAbiertas?'Contraer todo':'Expandir todo';
  el('expandir').disabled=!ramasActivas.length;
  el('expandir').setAttribute('aria-expanded',String(todasAbiertas));
  leaves=[]; let html='';
  (function walk(nodo,path){
    const hijos=[...nodo.ch.entries()].sort(compararNodos);
    for(const [key,c] of hijos){
      const p=path+'¦'+key, depth=Object.keys(c.ctx).length-1, esHoja=(!c.ch);
      const abierto=!colapsado.has(p);
      const tw=esHoja?`<span class="sangria" style="width:14px"></span>`:`<span class="twirl" data-k="${p}">${abierto?'▾':'▸'}</span>`;
      let etiq=key;
      if(esHoja){ const esLin=(c.lvl==='linea');
        const li=leaves.length; leaves.push(c.lvl==='zona'?Object.assign(contextoGrupo(mov.filter(h=>h.zona===key),key),{zona:key}):{zi:c.leaf.zi,ui:c.leaf.ui,li:esLin?c.leaf.li:null,zona:c.leaf.zona,unidad:c.leaf.unidad,linea:esLin?key:null});
        etiq=`<button type="button" class="clk" data-leaf="${li}">${key}</button>`; }
      html+=`<tr class="lvl-${c.lvl}"><td class="izq"><span class="sangria" style="width:${depth*16}px"></span>${tw} ${etiq}</td><td>${fmt(c.m.mtd)}</td><td>${fmt(planHoy(c.m))}</td>${difCell(c.m)}<td>${semaforo(c.m)}</td><td>${fmt(c.m.proy_mes)}</td></tr>`;
      if(!esHoja&&abierto)walk(c,p);
    }
  })(raiz,'');
  el('cuerpo').innerHTML=html||'<tr><td class="izq" colspan="6" style="padding:20px;color:#5b6b78">Sin datos para esta selección.</td></tr>';
  el('pie').innerHTML=`<tr><td class="izq"><button type="button" class="detalle-total" id="detalleTotal">TOTAL DIVISIÓN${f.z||f.u||f.l?' · filtrado':''}</button></td><td>${fmt(raiz.m.mtd)}</td><td>${fmt(planHoy(raiz.m))}</td>${difCell(raiz.m)}<td>${semaforo(raiz.m)}</td><td>${fmt(raiz.m.proy_mes)}</td></tr>`;
  if(HAY_META&&nSin){
    const sm=zero(); sin.forEach(h=>addM(sm,h));
    el('pie').innerHTML+=`<tr class="capex"><td class="izq" data-tip="Unidades con meta comprometida pero sin ninguna compra registrada en el período. Para no llenar el panel de filas en cero, se agrupan aquí y no se incluyen en las filas ni en el TOTAL de arriba.">Unidades sin movimiento en el mes (${nSin}) <i class="ic">i</i></td><td>–</td><td>${fmt(planHoy(sm))}</td><td>–</td><td>–</td><td>${fmt(sm.proy_mes)}</td></tr>`;
  }
  const cx=CAPEXH.filter(h=>zOk(h.zona,f.z)&&(!f.u||h.unidad===f.u)&&(!f.l||h.linea===f.l))
    .reduce((s,h)=>s+h.mtd,0);
  if(cx){
    el('pie').innerHTML+=`<tr class="capex"><td class="izq" data-tip="Órdenes de compra de activo fijo (concepto 'Puente Activo fijo'). No son gasto del período: se activan y vuelven como depreciación vía IG. Por eso van fuera del TOTAL.">Inversión en activo fijo <i class="ic">i</i> (no es gasto; fuera del total)</td><td>${fmt(cx)}</td><td>–</td><td>–</td><td>–</td><td>–</td></tr>`;
  }
  el('detalleTotal').onclick=()=>abrirModal(contextoTotal);
  }
  pintarTarjetas(raiz.m);
  pintarDiccionario(raiz.m);
  el('ayudaIg').hidden=IGOK||VISTA==='diccionario';
  pintarEvolucion();
  activarOrden();
  const ctx=[]; if(f.z)ctx.push(f.z); if(f.u)ctx.push(f.u); if(f.l)ctx.push(f.l);
  el('unidadCap').textContent=ctx.length?('Filtro: '+ctx.join(' · ')):(NIVEL==='zona'?'Vista división — detalle por zona':NIVEL==='unidad'?'Vista división — subtotales por zona y unidad':'Vista división — subtotales por zona, unidad y contrato');
  document.querySelectorAll('.twirl').forEach(t=>t.onclick=()=>{const k=t.dataset.k;colapsado.has(k)?colapsado.delete(k):colapsado.add(k);render();});
  document.querySelectorAll('#cuerpo .clk').forEach(s=>s.onclick=()=>abrirModal(leaves[+s.dataset.leaf]));
  guardarSeleccion();
}
function colapsarBase(){
  const f=filtros(),lvls=niveles(f);
  const raiz=construir(partirSinMov(HECHOS.filter(h=>zOk(h.zona,f.z)&&(!f.u||h.unidad===f.u)&&(!f.l||h.linea===f.l))).mov,lvls);
  colapsado.clear();
  (function mark(nodo,path){ if(!nodo.ch)return; for(const[key,c]of nodo.ch){const p=path+'¦'+key;if(c.ch){colapsado.add(p);mark(c,p);}} })(raiz,'');
}
function actualizar(reset){ recomputar(); refrescarLineas(); if(reset)colapsarBase(); render(); }

el('fPeriodo').onchange=()=>actualizar(true);
el('fZona').onchange=()=>{refrescarUnidades();actualizar(true);};
el('fUnidad').onchange=()=>actualizar(true);
el('fLinea').onchange=()=>render();
el('fDetalle').onchange=()=>{NIVEL=el('fDetalle').value;actualizar(true);};
el('expandir').onclick=()=>{if(ramasActivas.every(p=>!colapsado.has(p)))colapsarBase();else colapsado.clear();render();};
if(el('limpiarFiltros'))el('limpiarFiltros').onclick=()=>{
  el('fPeriodo').value=META.mes_actual;el('fZona').value='';refrescarUnidades();
  el('fUnidad').value='';el('fLinea').value='';el('fDetalle').value='contrato';
  NIVEL='contrato';ORDEN=null;el('modalBg').classList.remove('on');actualizar(true);
};
if(el('ordenDefault'))el('ordenDefault').onclick=()=>{ORDEN=null;render();};


// Resumen y evolución comparten los hechos y criterios de la tabla.
const escapar=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function pintarTarjetas(m){
  const plan=HAY_META?planHoy(m):null,dif=plan?m.mtd-plan:null,ratio=plan>0?m.mtd/plan:null;
  const estado=ratio==null?'neutro':ratio<=SEM_AMARILLO?'azul':ratio<=SEM_ROJO?'amarillo':'rojo';
  const datos=[
    ['Real',fmt(m.mtd),'MM$ · '+mesNom(el('fPeriodo').value),'azul'],
    ['Proyectado comparable',fmt(plan),'MM$ · mismo alcance que el real','azul'],
    ['Diferencia',dif==null?'–':(dif>0?'+':'')+fmt(dif),'MM$ · real − proyectado',dif==null?'neutro':dif>0?'rojo':'verde'],
    ['Avance',ratio==null?'–':Math.round(ratio*100)+'%','Real / proyectado comparable',estado],
    ['Proyección comprometida',HAY_META?fmt(m.proy_mes):'–','MM$ · mes completo','neutro']
  ];
  el('tarjetasResumen').innerHTML=datos.map(([nombre,valor,nota,color],i)=>`<article class="kpi kpi-${color}"><span>${nombre}</span><strong${i===3?' class="sem sem-'+estado+'"':''}>${valor}</strong><small>${nota}</small></article>`).join('');
}
function evolucionMensual(){
  const f=filtros();
  return META.meses.slice().sort().map(mes=>{
    const rows=hechosPeriodo(mes).filter(h=>zOk(h.zona,f.z)&&(!f.u||h.unidad===f.u)&&(!f.l||h.linea===f.l));
    const {mov}=partirSinMov(rows),m=zero();mov.forEach(h=>addM(m,h));
    const conMeta=mes>=META_DESDE,igOk=mes<=META.ig_hasta;
    return {mes,real:m.mtd,proyectado:conMeta?m.proy_mes:null,
      comparable:conMeta?(igOk?m.proy_fecha:m.proy_fecha*(1-rIG(m))):null,
      parcial:mes===META.mes_actual,igOk,registros:mov.length};
  });
}
function seleccionarMes(mes){el('fPeriodo').value=mes;actualizar(true);}
let ordenMensual=null;
const estadoMensual=d=>(d.parcial?'En curso':d.igOk?'Completo':'IG pendiente')+(d.proyectado==null?' · sin meta':'');
function ordenarMensual(datos){
  if(!ordenMensual)return datos;
  const {col,dir}=ordenMensual,valor=[d=>d.mes,d=>d.real,d=>d.proyectado,d=>d.comparable,estadoMensual][col];
  return datos.slice().sort((a,b)=>{
    const x=valor(a),y=valor(b);
    if(x==null||y==null)return x==null?(y==null?a.mes.localeCompare(b.mes):1):-1;
    const diferencia=typeof x==='number'?x-y:String(x).localeCompare(String(y),'es',{numeric:true});
    return diferencia*dir||a.mes.localeCompare(b.mes);
  });
}
function pintarTablaMensual(datos,seleccion){
  const cuerpo=el('tablaMensual');
  cuerpo.innerHTML=ordenarMensual(datos).map(d=>`<tr${d.mes===seleccion?' class="periodo-activo"':''}><td class="izq"><button class="clk mes-detalle" type="button" data-mes="${d.mes}">${mesNom(d.mes)}</button></td><td>${fmt(d.real)}</td><td>${fmt(d.proyectado)}</td><td>${fmt(d.comparable)}</td><td class="izq">${estadoMensual(d)}</td></tr>`).join('');
  cuerpo.querySelectorAll('.mes-detalle').forEach(b=>b.onclick=()=>seleccionarMes(b.dataset.mes));
  cuerpo.closest('table').querySelectorAll('thead th').forEach((th,col)=>{
    const actual=ordenMensual?.col===col;
    th.setAttribute('aria-sort',actual?(ordenMensual.dir===1?'ascending':'descending'):'none');
    if(!th.querySelector('button'))th.innerHTML='<button type="button" class="orden-columna">'+th.innerHTML+'</button>';
    const boton=th.querySelector('button'),dir=actual?-ordenMensual.dir:-1;
    boton.title=boton.textContent+': ordenar '+(dir===-1?'de mayor a menor':'de menor a mayor');
    boton.onclick=()=>{ordenMensual={col,dir};pintarTablaMensual(datos,seleccion);};
  });
}
function pintarEvolucion(){
  if(!el('graficoMensual'))return;
  const datos=evolucionMensual(),seleccion=el('fPeriodo').value;
  const W=1120,H=410,left=78,right=28,top=24,bottom=70,plotH=H-top-bottom,step=(W-left-right)/Math.max(datos.length,1);
  const valores=datos.flatMap(d=>[d.real,d.proyectado,d.comparable]).filter(v=>v!=null);
  const max=Math.max(0,...valores),min=Math.min(0,...valores),margen=(max-min)*.05;
  const limiteMax=max>0?max+margen:(min<0?0:ESC),limiteMin=min<0?min-margen:0;
  // Elegir un paso redondo para unas cinco marcas, uniforme dentro de cada vista.
  const pasoIdeal=(limiteMax-limiteMin)/ESC/4,potencia=10**Math.floor(Math.log10(pasoIdeal));
  const intervalo=[1,2,2.5,5,10].find(n=>n>=pasoIdeal/potencia)*potencia*ESC;
  const maxY=Math.ceil(limiteMax/intervalo)*intervalo,minY=Math.floor(limiteMin/intervalo)*intervalo;
  const y=v=>top+(maxY-v)/(maxY-minY||1)*plotH,x=i=>left+step*(i+.5);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Comparación mensual en millones de pesos">`;
  for(let i=0;i<=Math.round((maxY-minY)/intervalo);i++){const val=minY+i*intervalo,yy=y(val);svg+=`<line class="grafico-rejilla" x1="${left}" y1="${yy}" x2="${W-right}" y2="${yy}"/><text class="grafico-eje grafico-eje-y" x="${left-12}" y="${yy+4}" text-anchor="end">${(val/ESC).toLocaleString('es-CL',{maximumFractionDigits:8})}</text>`;}
  datos.forEach((d,i)=>{if(d.mes===seleccion)svg+=`<rect class="mes-seleccionado" x="${x(i)-step*.46}" y="${top}" width="${step*.92}" height="${plotH}" rx="6"/>`;});
  const series=[['proyectado','Proyección comprometida',9],['real','Real',7],['comparable','Proyectado comparable',4]];
  for(const[key]of series){let tramo=false,path='';datos.forEach((d,i)=>{if(d[key]==null){tramo=false;return;}path+=`${tramo?'L':'M'}${x(i)},${y(d[key])} `;tramo=true;});svg+=`<path class="linea-mensual linea-${key}" data-serie="${key}" d="${path}"/>`;}
  datos.forEach((d,i)=>{
    const xx=x(i);
    for(const[key,label,r]of series){const val=d[key];if(val==null)continue;
      const tip=`${mesNom(d.mes)} · ${label}: ${fmt(val)} MM$${d.parcial?' · mes en curso':''}${!d.igOk&&key==='real'?' · IG pendiente':''}`;
      svg+=`<circle class="marca-mensual punto-${key}" data-mes="${d.mes}" data-valor="${val}" data-serie="${key}" data-etiqueta="${escapar(mesNom(d.mes)+' · '+label)}" data-descripcion="${escapar(tip)}" cx="${xx}" cy="${y(val)}" r="${r}" tabindex="0" role="button" aria-label="${escapar(tip)}. Seleccionar período"/>`;
    }
    svg+=`<text class="grafico-eje" x="${xx}" y="${H-bottom+26}" text-anchor="middle">${mesNom(d.mes)}</text>`;
    if(d.parcial||!d.igOk)svg+=`<text class="grafico-eje grafico-estado" x="${xx}" y="${H-bottom+44}" text-anchor="middle">${d.parcial?'En curso':'IG pendiente'}</text>`;
  });
  svg+='<g class="tooltip-mensual" style="display:none" pointer-events="none"><rect width="360" height="54" rx="6"/><text x="12" y="21" class="tooltip-etiqueta"></text><text x="12" y="42" class="tooltip-valor"></text></g>';
  svg+='</svg>';
  el('graficoMensual').innerHTML=svg;
  pintarTablaMensual(datos,seleccion);
  const mensaje=el('valorGrafico'),tooltip=el('graficoMensual').querySelector('.tooltip-mensual');
  el('graficoMensual').querySelectorAll('.marca-mensual').forEach(marca=>{
    const activar=()=>{el('graficoMensual').classList.add('con-destaque');marca.classList.add('activa');mensaje.textContent=marca.dataset.descripcion;
      const xx=Number(marca.getAttribute('cx')),yy=Number(marca.getAttribute('cy'));
      tooltip.setAttribute('transform',`translate(${Math.max(left,Math.min(W-right-360,xx-180))},${yy>top+70?yy-68:yy+16})`);
      tooltip.querySelector('.tooltip-etiqueta').textContent=marca.dataset.etiqueta;
      tooltip.querySelector('.tooltip-valor').textContent=fmt(Number(marca.dataset.valor))+' MM$';tooltip.style.display='';
    };
    const salir=()=>{marca.classList.remove('activa');el('graficoMensual').classList.remove('con-destaque');tooltip.style.display='none';mensaje.textContent='Pase el mouse o enfoque un punto para ver su valor. Pulse para seleccionar el período.';};
    marca.onmouseenter=activar;marca.onmouseleave=salir;marca.onfocus=activar;marca.onblur=salir;
    marca.onclick=()=>seleccionarMes(marca.dataset.mes);
    marca.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();seleccionarMes(marca.dataset.mes);}};
  });
}
// La navegación abre HTML independientes y conserva la selección.
const CLAVE_FILTROS='resiterCostosFiltros';
const CAMPOS_FILTROS={periodo:'fPeriodo',zona:'fZona',unidad:'fUnidad',linea:'fLinea',detalle:'fDetalle'};
function seleccionActual(){return Object.fromEntries(Object.entries(CAMPOS_FILTROS).map(([nombre,id])=>[nombre,el(id).value]));}
function guardarSeleccion(){
  try{sessionStorage.setItem(CLAVE_FILTROS,JSON.stringify(seleccionActual()));}catch(_){}
}
function restaurarSeleccion(){
  let guardada={};try{guardada=JSON.parse(sessionStorage.getItem(CLAVE_FILTROS))||{};}catch(_){}
  const parametros=new URLSearchParams(location.search);
  const seleccion=Object.fromEntries(Object.keys(CAMPOS_FILTROS).map(nombre=>[nombre,parametros.get(nombre)??guardada[nombre]??'']));
  const asignar=(nombre)=>{
    const campo=el(CAMPOS_FILTROS[nombre]),valor=seleccion[nombre];
    if([...campo.options].some(o=>!o.disabled&&o.value===valor))campo.value=valor;
  };
  asignar('periodo');asignar('zona');refrescarUnidades();asignar('unidad');
  recomputar();refrescarLineas();asignar('linea');asignar('detalle');NIVEL=el('fDetalle').value;
}
function enlaceConSeleccion(enlace){
  const destino=new URL(enlace,location.href);
  for(const[nombre,valor]of Object.entries(seleccionActual()))destino.searchParams.set(nombre,valor);
  destino.searchParams.set('tema',document.documentElement.dataset.tema||'claro');
  return destino;
}
document.querySelectorAll('.navegacion-paneles a,.volver-inicio,.dic-volver-reporte').forEach(enlace=>{
  enlace.addEventListener('click',()=>{enlace.href=enlaceConSeleccion(enlace.href).href;});
});
document.addEventListener('click',ev=>{
  const boton=ev.target.closest('[data-ir-diccionario]');if(!boton)return;
  if(VISTA!=='diccionario'){
    const destino=enlaceConSeleccion(el('vista-diccionario').href);
    destino.hash=boton.dataset.irDiccionario;location.assign(autorizarDestinoCostos(destino).href);return;
  }
  el('modalBg').classList.remove('on');
  limpiarBusquedaDiccionario();
  irDiccionario(boton.dataset.irDiccionario);
});

function seleccionarPanelDiccionario(id){
  document.querySelectorAll('[data-dic-panel]').forEach(boton=>{
    const activo=boton.dataset.dicPanel===id;
    boton.setAttribute('aria-selected',String(activo));boton.tabIndex=activo?0:-1;
    el(boton.dataset.dicPanel).hidden=!activo;
  });
}
function irDiccionario(id){
  const destino=el(id);if(!destino||!el('vistaDiccionario').contains(destino))return;
  const panel=destino.closest('[role="tabpanel"]');
  if(panel)seleccionarPanelDiccionario(panel.id);
  for(let nodo=destino;nodo&&nodo!==panel;nodo=nodo.parentElement){
    if(nodo.tagName==='DETAILS')nodo.open=true;
  }
  if(destino.dataset.dicAbrir)el(destino.dataset.dicAbrir).open=true;
  destino.scrollIntoView({block:'start'});
  const foco=destino.tagName==='DETAILS'?destino.querySelector('summary'):destino;
  foco.focus({preventScroll:true});
  history.replaceState(history.state,'','#'+id);
}
function limpiarBusquedaDiccionario(){
  if(!el('dicBuscar'))return;
  el('dicBuscar').value='';el('dicBuscar').dispatchEvent(new Event('input'));
}

// Diccionario: describe las reglas del motor y reutiliza el agregado del reporte.
const TERMINOS_DIC=[
  ['IG · Informe de Gestión','Datos y estados','Informe que incorpora los costos de personal (2.01) y depreciación (2.06) al real. Las demás compras se obtienen de SAP.','Los importes del IG están en miles de pesos: monto CLP = valor IG × 1.000.','Fuentes/IG.xlsm; meses de fila 7 y primer bloque de costos de las hojas de contrato.'],
  ['IG pendiente / llega con IG / mes completo','Datos y estados','Pendiente indica que el período es posterior al último mes IG reconocido. «Llega con IG» se aplica a personal y depreciación en el detalle. «Mes completo» indica cobertura global del mes; revisa también cada contrato.','IG pendiente si período > IG reconocido hasta. La cobertura es el máximo mes con un importe numérico distinto de cero de personal o depreciación, incluyendo histórico conservado. No es una validación de integridad por contrato.','IG + motor/data/data.json. Reemplaza el IG, ejecuta el actualizador y recarga.'],
  ['Real · costo del período','Indicadores','Suma de compras netas SAP y costos de personal y depreciación IG reconocidos para el período y selección. Con IG pendiente, el real normalmente contiene solo compras.','Real = Σ compras OC de gasto + Σ personal IG + Σ depreciación IG. Administración y CAPEX se excluyen del total.','VALORTOTALNETOOC de SAP + partidas 2.01 y 2.06 del IG.'],
  ['Proyección comprometida · Proy. mes','Indicadores','Costo total comprometido del mes por contrato, incluyendo personal y depreciación. Es la meta del panel desde agosto de 2026; los meses anteriores muestran solo real.','Proyección mes = Σ metas de los contratos incluidos. No se calcula desde el presupuesto ni desde el real.','Proyección de cierre, hoja Resumen Costos x Mes; miles de pesos × 1.000.'],
  ['Proyectado a hoy · comparable','Fórmulas','Referencia ajustada al día de corte y al alcance del real. Si el IG está pendiente, excluye el peso histórico estimado de personal y depreciación.','Base al corte = proyección mes × día de corte / días del mes. Con IG reconocido: comparable = base. Con IG pendiente: comparable = base × (1 − peso IG). Para meses anteriores al mes de corte se usa el mes entero.','Proyección comprometida + corte OC + mezcla histórica de OC e IG.'],
  ['Peso IG · mezcla de tres meses','Fórmulas','Proporción histórica de personal y depreciación utilizada para ajustar el comparable. Para el mes de corte parte del mes anterior; para un mes histórico parte del propio mes, sin superar el último IG reconocido. Se toman ese mes y sus dos anteriores.','Peso IG = Σ(personal + depreciación de esos tres meses) / Σ(real de esos tres meses). Se calcula después de sumar los registros filtrados; no se promedian porcentajes de contratos. Si el total histórico es cero, el motor usa peso 0.','Histórico mensual de compras e IG de la misma zona, unidad y línea de negocio.'],
  ['Diferencia','Indicadores','Cuánto se supera o se queda bajo el comparable. Positiva: gasto sobre la referencia. Negativa: gasto bajo la referencia.','Diferencia = real − proyectado comparable. Sin meta o con comparable cero se muestra —.','Real y proyección comparable de la misma selección.'],
  ['Avance · semáforo','Indicadores','Porcentaje del comparable ya consumido. Azul hasta 100%; amarillo sobre 100% y hasta 110%; rojo sobre 110%. El color se decide con el porcentaje sin redondear.','Avance = real / comparable × 100. En totales se usa la razón de importes agregados; no el promedio de porcentajes. Con comparable ≤ 0 o sin meta se muestra —.','Real y proyección comparable. El porcentaje visible se redondea al entero.'],
  ['Proyectado por partida · detalle','Fórmulas','La fuente aporta una meta por contrato. El detalle distribuye esa meta entre partidas según el mix real de los tres meses inmediatamente anteriores al período. Esta ventana puede ser distinta de la usada para el peso IG del total.','Referencia partida = (histórico partida / histórico total) × proyección mes × fracción del período. Se usa cuando hay meta positiva desde agosto de 2026 y un histórico total positivo.','Proyección por contrato + histórico de los tres meses anteriores de la selección del detalle.'],
  ['Habitual · referencia alternativa','Fórmulas','Referencia del detalle cuando no puede usar la proyección repartida: antes de agosto de 2026, sin proyección positiva o sin histórico total positivo.','Habitual partida = (suma de esa partida en los tres meses anteriores / 3) × fracción del período. La división es siempre por tres, aunque un mes no aporte registros.','Histórico mensual OC + IG. En el detalle, comprueba si el encabezado dice Proyectado o Habitual.'],
  ['Nuevo · sin referencia','Datos y estados','Una partida sin referencia distinta de cero se marca «nuevo». Puede tener gasto real; la etiqueta indica que no existe base para calcular su porcentaje, aunque el concepto ya haya aparecido antes.','Sin referencia o con partida IG pendiente, no se calcula el porcentaje de esa fila.','Resumen de partidas del contrato o grupo seleccionado.'],
  ['Fecha de corte · período · en curso','Datos y estados','El corte es la última fecha de creación de las OC cargadas. El mes de esa fecha se considera en curso y se prorratea al día del corte, aunque el calendario ya haya avanzado.','Corte = máximo FECHACREACION. Se ofrecen seis meses hasta ese corte; el detalle conserva ocho meses de OC.','Fuentes/OC/. Actualizar solamente el IG no avanza la fecha de corte.'],
  ['MM$ · CLP · redondeo','Unidades','CLP son pesos chilenos. MM$ significa millones de pesos. El detalle OC y las descargas Excel muestran pesos; los indicadores muestran MM$.','MM$ = monto en CLP / 1.000.000. El motor redondea los importes mensuales a pesos; el panel presenta una décima de MM$.','OC en pesos; IG y proyección en miles de pesos convertidos a CLP.'],
  ['Partida · ítem · concepto · (Revisar)','Clasificación','La partida agrupa el gasto en categorías como combustible, mantención o arriendos. El número CONCEPTOIMPUTACION determina su partida. «(Revisar)» puede señalar un concepto sin clasificación o una unidad sin zona resuelta.','CONCEPTOIMPUTACION → Codigo_partida. Los conceptos enteros se normalizan (por ejemplo, 022310 y 22310.0 corresponden al mismo código). Las OC asignadas a 2.01 o 2.06 se envían a (Revisar), porque esas partidas se obtienen del IG.','motor/mapeos/dicionario.csv y mapa de unidades IG/presupuesto. Confirma el código o asociación y actualiza.'],
  ['CAPEX · inversión en activo fijo','Clasificación','Compras de activo fijo que se informan separadamente bajo el TOTAL. Se excluyen del gasto real del período; la depreciación que corresponda llega por el IG.','CAPEX = Σ OC cuyos conceptos están clasificados como CAPEX. No se suma al TOTAL DIVISIÓN.','Diccionario numérico de conceptos OC + compras SAP.'],
  ['Zona · unidad · contrato · línea de negocio','Organización','La unidad corresponde a la faena o centro de consumo. En este panel un contrato se identifica por zona, unidad y línea de negocio. Las zonas se resuelven principalmente con el IG y, como apoyo, con presupuesto y equivalencias configuradas.','Agrupación: zona → unidad → línea. Aseo industrial se asigna a Zona 8. «Zona 1 + 2» reúne ambas zonas. Administración queda fuera de filas, filtros y totales.','Hojas y sufijos del IG, campos SAP, presupuesto y reglas acordadas del motor.'],
  ['Unidades sin movimiento · total filtrado','Alcance','Una unidad se incluye en el total cuando tiene algún importe real mensual distinto de cero en sus contratos de la selección. Las unidades sin ese movimiento quedan fuera del total y sus metas se informan aparte. El movimiento puede venir de OC o IG.','Se aplican filtros y se identifican unidades con real distinto de cero; se suman sus contratos. CAPEX no activa el movimiento de gasto. Expandir o contraer filas no cambia los totales.','Los mismos hechos mensuales alimentan tarjetas, tabla y gráfico. Cada mes evalúa su propio movimiento.'],
  ['Órdenes de compra · duplicados · comentarios','Trazabilidad','Dentro de un export se suman las filas de una misma combinación de NUMEROOC y LINEAOC, que pueden repetirse por recepciones o facturas. Entre archivos se conserva una sola versión por esa combinación.','Los archivos OC se procesan en orden alfabético; el último procesado reemplaza la línea repetida. No se comparan fechas de modificación. COMENTARIOSAPROBACION aporta el comentario del reporte.','Hoja1 de Fuentes/OC/. Mantén un export vigente por mes para evitar que una copia anterior prevalezca.'],
  ['Descargas · resumen de ítem · reporte de costo','Trazabilidad','La descarga OC + Resumen incluye las OC filtradas y un resumen por partida. «Generar reporte de costo» agrupa las líneas OC por ítem y muestra el proveedor y comentario de cada línea. Los importes están en CLP.','Las descargas incluyen todas las OC de la selección, aunque la pantalla limite el detalle a 1.500 líneas. El reporte de costo suma solo compras OC; el costo total del panel también incorpora IG cuando corresponde.','Detalle del contrato, unidad, zona o total y período elegido.'],
  ['Publicación · actualización · histórico IG','Actualización','El panel abre una copia cifrada generada por el actualizador. Las fuentes no se consultan en vivo. Si el IG fuente es anterior, el motor conserva los meses IG posteriores que ya estaban publicados.','IG reconocido hasta = máximo mes IG entre el archivo fuente y el histórico conservado. Un mes posterior a esa cobertura continúa pendiente hasta incorporar datos nuevos.','Fuentes + motor/data/data.json → portada Panel Costos Resiter.html + tres HTML en web/pages + estilos, código y datos cifrados compartidos en app.']
];
function prepararDiccionario(){
  if(!el('dicTerminos'))return;
  el('dicTerminos').innerHTML=TERMINOS_DIC.map(([nombre,categoria,definicion,formula,fuente],i)=>`<details class="dic-termino" id="dic-termino-${i}" data-dic-articulo="${escapar(nombre)}" data-dic-categoria="${escapar(categoria)}"><summary><span>${escapar(nombre)}</span><small>${escapar(categoria)}</small></summary><div><p>${escapar(definicion)}</p><p class="dic-formula">${escapar(formula)}</p><p class="dic-fuente"><b>Fuente / acción:</b> ${escapar(fuente)}</p></div></details>`).join('');
  const articulos=[...document.querySelectorAll('[data-dic-articulo]')].map((nodo,i)=>{
    if(!nodo.id)nodo.id='dic-articulo-'+i;
    if(!nodo.hasAttribute('tabindex'))nodo.tabIndex=-1;
    const nombre=nodo.dataset.dicArticulo||nodo.querySelector('summary,td b')?.textContent||'';
    const texto=nodo.textContent.replace(/\s+/g,' ').trim();
    return {nombre,texto,categoria:nodo.dataset.dicCategoria,destino:nodo.dataset.dicDestino||nodo.id};
  });
  const normalizar=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  el('dicBuscar').oninput=()=>{
    const consulta=normalizar(el('dicBuscar').value).trim(),palabras=consulta.split(/\s+/).filter(Boolean);
    const resultados=palabras.length?articulos.filter(a=>palabras.every(p=>normalizar(a.nombre+' '+a.texto).includes(p))).sort((a,b)=>Number(normalizar(b.nombre).includes(consulta))-Number(normalizar(a.nombre).includes(consulta))):[];
    el('dicBusquedaResultados').hidden=!palabras.length;
    el('dicLimpiarBusqueda').hidden=!palabras.length;
    el('dicVacio').hidden=!palabras.length||resultados.length!==0;
    el('dicResultados').textContent=palabras.length?`${resultados.length} ${resultados.length===1?'respuesta encontrada':'respuestas encontradas'}. Elige una para abrir la explicación.`:'Busca en términos, instrucciones, soluciones y fuentes. También puedes elegir una sección debajo.';
    el('dicCoincidencias').innerHTML=resultados.map(a=>`<button type="button" class="dic-resultado" data-ir-diccionario="${escapar(a.destino)}"><small>${escapar(a.categoria)}</small><b>${escapar(a.nombre)}</b><span>${escapar(a.texto.slice(0,180))}${a.texto.length>180?'…':''}</span><em>Abrir explicación →</em></button>`).join('');
  };
  el('dicBuscar').onkeydown=ev=>{
    if(ev.key==='Escape'){ev.preventDefault();limpiarBusquedaDiccionario();}
    if(ev.key==='Enter'&&el('dicBuscar').value.trim()){
      ev.preventDefault();el('dicCoincidencias').querySelector('button')?.click();
    }
  };
  el('dicLimpiarBusqueda').onclick=()=>{limpiarBusquedaDiccionario();el('dicBuscar').focus();};
  const botones=[...document.querySelectorAll('[data-dic-panel]')];
  botones.forEach((boton,i)=>{
    boton.onclick=()=>{
      limpiarBusquedaDiccionario();seleccionarPanelDiccionario(boton.dataset.dicPanel);
      history.replaceState(history.state,'','#'+boton.dataset.dicPanel);
    };
    boton.onkeydown=ev=>{
      const siguiente=ev.key==='ArrowRight'?(i+1)%botones.length:ev.key==='ArrowLeft'?(i+botones.length-1)%botones.length:ev.key==='Home'?0:ev.key==='End'?botones.length-1:null;
      if(siguiente==null)return;
      ev.preventDefault();botones[siguiente].click();botones[siguiente].focus();
    };
  });
  const terminos=[...el('dicTerminos').querySelectorAll('details')],expandir=el('dicExpandirTerminos');
  const actualizarExpansion=()=>{
    const todos=terminos.every(t=>t.open);
    expandir.textContent=todos?'Cerrar todos los términos':'Abrir todos los términos';
    expandir.setAttribute('aria-expanded',String(todos));
  };
  terminos.forEach(t=>t.addEventListener('toggle',actualizarExpansion));
  expandir.onclick=()=>{const abrir=!terminos.every(t=>t.open);terminos.forEach(t=>t.open=abrir);actualizarExpansion();};
  el('dicBuscar').oninput();
}
function pintarDiccionario(m){
  if(!el('dicEstado'))return;
  const P=el('fPeriodo').value,f=filtros(),fuente=META.ig_hasta_fuente;
  const mesTexto=v=>v?mesNom(v):'Sin información';
  const estados=[['Corte de compras',META.hoy,'Última FECHACREACION cargada'],
    ['IG reconocido hasta',mesTexto(META.ig_hasta),'Fuente + histórico conservado'],
    ['IG del archivo fuente hasta',mesTexto(fuente),fuente?'Último mes leído del libro':'Vuelve a actualizar para registrar su cobertura'],
    ['Período seleccionado',mesNom(P),IGOK?'IG reconocido para el mes':'IG pendiente para el mes']];
  el('dicEstado').innerHTML=estados.map(([titulo,valor,nota],i)=>`<div class="dic-estado-celda${i===3&&!IGOK?' dic-pendiente':''}"><span>${escapar(titulo)}</span><strong>${escapar(valor)}</strong><small>${escapar(nota)}</small></div>`).join('');
  const guardado=fuente&&fuente<META.ig_hasta;
  el('dicHistorico').textContent=guardado?`El archivo fuente aporta IG hasta ${mesTexto(fuente)}, pero esta publicación conserva histórico hasta ${mesTexto(META.ig_hasta)}. Para completar un mes posterior necesitas el nuevo cierre de IG. La cobertura es global; revisa los contratos y partidas del mes.`:'El mes reconocido se detecta por importes numéricos de personal o depreciación. Esta cobertura global no certifica que todos los contratos estén completos.';
  el('dicEjemploIg').textContent=IGOK?`Para ${mesNom(P)}, la publicación ya reconoce IG. Si un contrato no tiene datos, revisa su detalle y concilia con el libro; volver a cargar el mismo archivo no garantiza corregir una hoja sin valores.`:`Para ${mesNom(P)}, el IG está pendiente: la cobertura actual llega hasta ${mesTexto(META.ig_hasta)}. Necesitas un IG cerrado que incluya ${mesNom(P)}, ejecutar el actualizador y recargar. ${P===META.mes_actual?'Este período se considera en curso según el corte OC; normalmente su IG llega al mes siguiente.':''}`;
  el('dicSeleccion').textContent=[mesNom(P),f.z||'Todas las zonas',f.u||'Todas las unidades',f.l||'Todas las líneas'].join(' · ');
  let b=P===META.mes_actual?prevMes(P):P;if(META.ig_hasta&&META.ig_hasta<b)b=META.ig_hasta;
  const ventana=[b,prevMes(b),prevMes(prevMes(b))].map(mesNom).join(', ');
  const porcentaje=v=>(v*100).toLocaleString('es-CL',{maximumFractionDigits:2})+'%';
  const plan=HAY_META?planHoy(m):null,filas=[
    ['Real',`${fmt(m.mtd)} MM$ = compras de gasto + personal y depreciación IG reconocidos.`],
    ['Proyección mes',HAY_META?`${fmt(m.proy_mes)} MM$ = suma de metas mensuales de los contratos incluidos.`:`Sin meta comparable: la regla del panel comienza en ${mesNom(META_DESDE)}.`],
    ['Fracción del mes',`${DIA} / ${DIM} días ≈ ${porcentaje(DIA/DIM)}. ${P===META.mes_actual?'Se aplica el día de corte de las OC.':'Se compara el mes entero.'}`],
    ['Peso histórico IG',m.tot3?`${fmt(m.ig3)} / ${fmt(m.tot3)} MM$ ≈ ${porcentaje(rIG(m))}. Ventana: ${ventana}.`:`Sin total histórico en ${ventana}; el motor usa peso IG 0%.`],
    ['Comparable',!HAY_META?'— · sin meta para este período.':IGOK?`${fmt(m.proy_mes)} × (${DIA} / ${DIM}) ≈ ${fmt(plan)} MM$. El IG está reconocido: no se descuenta su peso.`:`${fmt(m.proy_mes)} × (${DIA} / ${DIM}) × (1 − ${porcentaje(rIG(m))}) ≈ ${fmt(plan)} MM$. Se excluye el peso estimado del IG pendiente.`],
    ['Diferencia',plan?`${fmt(m.mtd)} − ${fmt(plan)} ≈ ${fmt(m.mtd-plan)} MM$.`:'— · sin una referencia distinta de cero.'],
    ['Avance',plan>0?`${fmt(m.mtd)} / ${fmt(plan)} × 100 ≈ ${Math.round(m.mtd/plan*100)}%. Azul ≤ 100%; amarillo > 100% y ≤ 110%; rojo > 110%.`:'— · sin comparable positivo.']
  ];
  el('dicCalculo').innerHTML=filas.map(([nombre,texto])=>`<div><dt>${escapar(nombre)}</dt><dd>${escapar(texto)}</dd></div>`).join('');
}
if(el('detalleMesGrafico'))el('detalleMesGrafico').onclick=()=>abrirModal(contextoTotal);

async function descargarPdfMensual(){
  const boton=el('descargarPdfMensual');
  // Capturar la selección al iniciar: los cambios posteriores no alteran el informe.
  const datos=ordenarMensual(evolucionMensual()),f=filtros(),svg=el('graficoMensual').querySelector('svg').cloneNode(true);
  const periodo=el('fPeriodo').value,logo=LOGO_PDF;
  boton.disabled=true;boton.textContent='Generando PDF…';
  try{
    const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create();
    const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
    const colores={real:rgb(.055,.506,.773),proyectado:rgb(.357,.42,.486),comparable:rgb(.851,.541,.118)};
    const navy=rgb(.027,.216,.384),gris=rgb(.357,.42,.486),blanco=rgb(1,1,1),borde=rgb(.867,.894,.925);
    const limpiar=v=>String(v??'').replace(/[–—−]/g,'-').replace(/\u2026/g,'...');
    let pagina=doc.addPage([841.89,595.28]);
    const texto=(v,x,y,size=10,color=navy,font=regular)=>pagina.drawText(limpiar(v),{x,y,size,color,font});
    const ajustar=(v,ancho,size=9,font=regular)=>{let t=limpiar(v);if(font.widthOfTextAtSize(t,size)<=ancho)return t;while(t.length&&font.widthOfTextAtSize(t+'...',size)>ancho)t=t.slice(0,-1);return t+'...';};
    const envolver=(v,x,y,ancho,size=9)=>{let linea='';for(const palabra of limpiar(v).split(/\s+/)){const nueva=linea?linea+' '+palabra:palabra;if(regular.widthOfTextAtSize(nueva,size)>ancho&&linea){texto(linea,x,y,size,gris);y-=12;linea=palabra;}else linea=nueva;}if(linea)texto(linea,x,y,size,gris);return y-12;};
    const imagen=await doc.embedPng(logo);
    pagina.drawImage(imagen,{x:32,y:531,width:46,height:46});
    texto('Panel de Costos - Resiter',92,561,16,navy,bold);
    texto('Proyectado vs real por mes',92,542,11);
    texto('Datos al '+META.hoy+' | Cifras en MM$ (millones de pesos)',32,515,9,gris);
    let filtrosY=envolver('Zona: '+(f.z||'Todas')+' | Unidad: '+(f.u||'Todas')+' | Línea de negocio: '+(f.l||'Todas'),32,500,778);
    texto('Período seleccionado: '+mesNom(periodo),32,filtrosY,9,gris);
    const escala=720/1120,escalaY=.52,ox=61,oy=filtrosY-12,px=x=>ox+Number(x)*escala,py=y=>oy-Number(y)*escalaY;
    for(const linea of svg.querySelectorAll('.grafico-rejilla'))pagina.drawLine({start:{x:px(linea.getAttribute('x1')),y:py(linea.getAttribute('y1'))},end:{x:px(linea.getAttribute('x2')),y:py(linea.getAttribute('y2'))},thickness:.5,color:borde});
    for(const t of svg.querySelectorAll('.grafico-eje')){
      const size=t.classList.contains('grafico-estado')?6.5:8,v=limpiar(t.textContent),ancho=regular.widthOfTextAtSize(v,size),anchor=t.getAttribute('text-anchor');
      texto(v,px(t.getAttribute('x'))-(anchor==='end'?ancho:anchor==='middle'?ancho/2:0),py(t.getAttribute('y')),size,gris);
    }
    for(const path of svg.querySelectorAll('.linea-mensual')){
      let anterior=null;
      for(const match of path.getAttribute('d').matchAll(/([ML])([\d.eE+-]+),([\d.eE+-]+)/g)){
        const punto={x:px(match[2]),y:py(match[3])};
        if(match[1]==='L'&&anterior)pagina.drawLine({start:anterior,end:punto,thickness:1.6,color:colores[path.dataset.serie],...(path.dataset.serie==='comparable'?{dashArray:[4,3]}:{})});
        anterior=punto;
      }
    }
    for(const punto of svg.querySelectorAll('.marca-mensual'))pagina.drawCircle({x:px(punto.getAttribute('cx')),y:py(punto.getAttribute('cy')),size:Number(punto.getAttribute('r'))*escala,color:colores[punto.dataset.serie],borderColor:blanco,borderWidth:1});
    let y=oy-410*escalaY-2;
    for(const[key,label,x]of [['real','Real',48],['proyectado','Proyección comprometida del mes',145],['comparable','Proyectado comparable al real',423]]){
      pagina.drawLine({start:{x,y:y+3},end:{x:x+18,y:y+3},thickness:1.6,color:colores[key],...(key==='comparable'?{dashArray:[4,3]}:{})});
      texto(label,x+25,y,9,gris);
    }
    y-=22;
    const columnas=[32,160,310,460,610,810],cabeceras=['Mes','Real','Proyección mes','Proyectado comparable','Estado'];
    const cabecera=()=>{pagina.drawRectangle({x:32,y:y-6,width:778,height:22,color:navy});cabeceras.forEach((v,i)=>texto(v,columnas[i]+8,y+1,9,blanco,bold));y-=26;};
    cabecera();
    for(const d of datos){
      if(y<70){pagina=doc.addPage([841.89,595.28]);texto('Panel de Costos - Valores mensuales',32,557,14,navy,bold);y=522;cabecera();}
      if(d.mes===periodo)pagina.drawRectangle({x:32,y:y-5,width:778,height:20,color:rgb(.875,.929,.973)});
      const estado=(d.parcial?'En curso':d.igOk?'Completo':'IG pendiente')+(d.proyectado==null?' | sin meta':'');
      const fila=[mesNom(d.mes),fmt(d.real),fmt(d.proyectado),fmt(d.comparable),estado];
      fila.forEach((v,i)=>{const t=ajustar(v,columnas[i+1]-columnas[i]-16);texto(t,i>0&&i<4?columnas[i+1]-8-regular.widthOfTextAtSize(t,9):columnas[i]+8,y,9,i===0?navy:gris);});
      pagina.drawLine({start:{x:32,y:y-6},end:{x:810,y:y-6},color:borde,thickness:.4});y-=20;
    }
    if(y<58){pagina=doc.addPage([841.89,595.28]);y=557;}
    envolver('Proyección comprometida: mes completo. Comparable: prorrateo al corte y exclusión estimada de remuneraciones y depreciación mientras el IG está pendiente. Se excluyen las unidades sin movimiento de cada mes.',32,y-9,778,8);
    doc.getPages().forEach((p,i)=>p.drawText('Resiter | '+(i+1)+' / '+doc.getPageCount(),{x:32,y:20,size:8,font:regular,color:gris}));
    doc.setTitle('Panel de Costos - Proyectado vs real por mes');
    const blob=new Blob([await doc.save()],{type:'application/pdf'}),url=URL.createObjectURL(blob),enlace=document.createElement('a');
    enlace.href=url;enlace.download='Costos_Proyectado_vs_real_'+META.hoy+'.pdf';document.body.appendChild(enlace);enlace.click();enlace.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(error){console.error(error);alert('No se pudo generar el PDF. Intente nuevamente.');}
  finally{boton.disabled=false;boton.textContent='Descargar PDF';}
}
if(el('descargarPdfMensual'))el('descargarPdfMensual').onclick=descargarPdfMensual;

// ---------- modal de OCs del contrato ----------
let modalCtx=null, modalPeriodo=null;
let ordenDetalle={};
const columnasDetalle={
  tablaPartidas:[r=>r.nombre,r=>r.pendiente?null:r.real,r=>r.referencia,r=>r.pendiente?null:r.diferencia,r=>r.ratio],
  tablaIg:[r=>ZN[r[0]],r=>UN[r[1]],r=>LN[r[2]],r=>(PART[r[3]]||{}).nombre,r=>r[5]],
  tablaOc:[r=>ZN[r[0]]+' · '+UN[r[1]]+' · '+LN[r[2]],r=>r[4],r=>String(r[8]??''),r=>PROV[r[6]],r=>CONC[r[7]],r=>(PART[r[3]]||{}).nombre,r=>r[5]]
};
function ordenarDetalle(filas,id){
  const orden=ordenDetalle[id];if(!orden)return filas;
  const valor=columnasDetalle[id][orden.col];
  return filas.slice().sort((a,b)=>{
    const x=valor(a),y=valor(b);
    if(x==null||y==null)return x==null?(y==null?0:1):-1;
    return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'es',{numeric:true}))*orden.dir;
  });
}
function activarOrdenDetalle(){
  for(const id of Object.keys(columnasDetalle)){
    const tabla=el(id);if(!tabla)continue;
    tabla.querySelectorAll('thead th').forEach((th,col)=>{
      const orden=ordenDetalle[id],actual=orden?.col===col;
      th.setAttribute('aria-sort',actual?(orden.dir===1?'ascending':'descending'):'none');
      const titulo=th.textContent;
      th.innerHTML='<button type="button" class="orden-columna">'+escapar(titulo)+'</button>';
      const boton=th.querySelector('button');
      boton.title=titulo+': ordenar '+(actual&&orden.dir===1?'de mayor a menor':'de menor a mayor');
      boton.onclick=()=>{
        const scroll=el('mBody').scrollTop;
        ordenDetalle[id]={col,dir:actual?-orden.dir:1};pintarModal(modalPeriodo);
        el('mBody').scrollTop=scroll;
        el(id).querySelectorAll('thead button')[col].focus({preventScroll:true});
      };
    });
  }
}
function filasOcModal(c,per){
  return DET.filter(d=>coincideContexto(d,c)
    && d[4].slice(0,7)===per.mes && (per.dia==null||(+d[4].slice(8,10))<=per.dia)).sort((a,b)=>b[5]-a[5]);
}
function excelOcModal(filas,c,per){
  const resumen=resumenPartidas(c,per), celda=(v,s=0)=>({v,s});
  const contexto=c.zona+' · '+c.unidad+' · '+(c.linea||'Todas las líneas');
  const periodo=per.mes+(per.dia?' (días 1–'+per.dia+')':' (mes completo)');
  const cabecera=['Zona','Unidad','Línea de negocio','Fecha de creación','Nº OC','Proveedor','Detalle','Código de partida','Partida','Monto (CLP)'];
  const registros=filas.map(d=>[ZN[d[0]],UN[d[1]],LN[d[2]],d[4],String(d[8]??''),PROV[d[6]]||'—',CONC[d[7]]||'—',
    (PART[d[3]]||{}).cod||'',(PART[d[3]]||{}).nombre||'—',celda(d[5],2)]);
  const detalle=resumen.filas.map(r=>[r.cod,r.nombre,celda(r.pendiente?null:r.real,2),celda(r.referencia,2),
    celda(r.pendiente?null:r.diferencia,2),celda(r.ratio,r.estilo),celda(r.estado,r.estilo)]);
  return excelOc([
    {nombre:'Resumen',anchos:[20,48,24,24,24,22,28],cabecera:8,filas:[
      ['Resumen por partida'],['Selección',contexto],['Período',periodo],['Moneda','CLP (pesos)'],
      ['Referencia',resumen.nota],['Diferencia','Real − '+resumen.refNombre.toLowerCase()],
      ['Semáforo','Azul: hasta 100%. Amarillo: más de 100% hasta 110%. Rojo: más de 110%.'],
      ['Código de partida','Partida','Valor real (CLP)',resumen.refNombre+' (CLP)','Diferencia (CLP)',resumen.refVs+' (%)','Semáforo'].map(v=>celda(v,1)),...detalle]},
    {nombre:'OC',anchos:[18,32,26,22,18,40,60,20,40,22],cabecera:1,filas:[cabecera.map(v=>celda(v,1)),...registros]}
  ]);
}
function descargarOcModal(){
  if(!modalCtx||!modalPeriodo)return;
  const filas=filasOcModal(modalCtx,modalPeriodo);
  if(!filas.length)return;
  const limpio=s=>String(s).replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim().slice(0,60);
  const nombre=['OC',modalCtx.zona,modalCtx.unidad,modalCtx.linea||'Todas las líneas',modalPeriodo.mes,
    modalPeriodo.dia?'hasta_dia_'+modalPeriodo.dia:'mes_completo'].map(limpio).join('_')+'.xlsx';
  const url=URL.createObjectURL(excelOcModal(filas,modalCtx,modalPeriodo));
  const enlace=document.createElement('a');
  enlace.href=url;enlace.download=nombre;document.body.appendChild(enlace);enlace.click();enlace.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el('mDescargarExcel').onclick=descargarOcModal;
function filasReporteCosto(filas,c,per){
  const cabecera=['ITEM','Monto Gasto del Mes (CLP)','N° O/C','Nombre Proveedor','Comentario'];
  const salida=[['REPORTE DE COSTO'],['Selección',c.zona+' · '+c.unidad+' · '+(c.linea||'Todas las líneas')],
    ['Período',per.mes+(per.dia?' (días 1–'+per.dia+')':' (mes completo)')],
    ['Moneda','CLP (pesos)'],cabecera.map(v=>({v,s:1}))];
  // Orden de los ítems del formato de reporte; conserva otras partidas al final.
  const orden=['2.01','2.02','2.03','2.04','2.05','2.07','2.08','2.09','2.10','2.11','2.12','2.13','2.14','2.15','2.16','2.17','2.18','2.20','2.23','2.22','2.19'];
  const grupos=new Map();
  for(const d of filas){if(!grupos.has(d[3]))grupos.set(d[3],[]);grupos.get(d[3]).push(d);}
  const indices=[...new Set([...PART.map((p,i)=>orden.includes(p.cod)?i:null).filter(i=>i!=null),...grupos.keys()])];
  const pos=pi=>{const i=orden.indexOf((PART[pi]||{}).cod);return i<0?orden.length:i;};
  indices.sort((a,b)=>pos(a)-pos(b)||String((PART[a]||{}).cod).localeCompare(String((PART[b]||{}).cod),undefined,{numeric:true}));
  for(const pi of indices){
    const item=(PART[pi]||{}).nombre||'(Revisar)';
    salida.push([item,'','','',''].map(v=>({v,s:1})));
    const detalle=(grupos.get(pi)||[]).slice().sort((a,b)=>String(a[8]).localeCompare(String(b[8]),undefined,{numeric:true})||a[4].localeCompare(b[4])||a[7]-b[7]);
    for(const d of detalle){const comentario=COMENT[d[9]];salida.push(['',{v:d[5],s:2},String(d[8]??''),PROV[d[6]]||'',comentario==='—'?'':comentario||'']);}
    if(!detalle.length)salida.push(['','','','','']);
  }
  salida.push(['TOTAL GASTO OC',{v:filas.reduce((s,d)=>s+d[5],0),s:2},'','','']);
  return salida;
}
function excelReporteCosto(filas,c,per){
  const registros=filasReporteCosto(filas,c,per);
  const texto=v=>String(v&&typeof v==='object'?v.v??'':v??'');
  const alturas=registros.map(r=>Math.max(24,...r.map((v,i)=>texto(v).split('\n').reduce((s,l)=>s+Math.max(1,Math.ceil(l.length/[40,24,20,38,70][i])),0)*15+6)));
  return excelOc([{nombre:'Reporte de costo',anchos:[44,26,22,40,75],cabecera:5,filtro:false,filas:registros,alturas}]);
}
function generarReporteCosto(){
  if(!modalCtx||!modalPeriodo)return;
  const filas=filasOcModal(modalCtx,modalPeriodo);
  if(!filas.length)return;
  const limpio=s=>String(s).replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim().slice(0,60);
  const nombre=['Reporte de costo',modalCtx.zona,modalCtx.unidad,modalCtx.linea||'Todas las líneas',modalPeriodo.mes,
    modalPeriodo.dia?'hasta_dia_'+modalPeriodo.dia:'mes_completo'].map(limpio).join('_')+'.xlsx';
  const url=URL.createObjectURL(excelReporteCosto(filas,modalCtx,modalPeriodo));
  const enlace=document.createElement('a');
  enlace.href=url;enlace.download=nombre;document.body.appendChild(enlace);enlace.click();enlace.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el('mReporteCosto').onclick=generarReporteCosto;
function periodosModal(){
  const P=el('fPeriodo').value||META.mes_actual, esActual=(P===META.mes_actual);
  const dia=esActual?META.dia_hoy:null, P1=prevMes(P);
  return [
    {id:'cur', lbl:'Este período · '+mesNom(P)+(dia?(' (1–'+dia+')'):''), mes:P, dia:dia},
    {id:'prev',lbl:'Mes anterior · '+mesNom(P1), mes:P1, dia:null},
  ];
}
function abrirModal(ctx){ ordenDetalle={}; modalCtx=ctx; el('mTitulo').textContent=ctx.titulo||ctx.unidad+(ctx.linea?(' · '+ctx.linea):'');
  el('mContexto').textContent=[ctx.zona,ctx.unidad,ctx.linea].filter(Boolean).join(' · ')+' — detalle de IG y órdenes de compra';
  const ps=periodosModal();
  el('mTabs').innerHTML=ps.map((p,i)=>`<button class="tab${i===0?' on':''}" data-i="${i}">${p.lbl}</button>`).join('');
  document.querySelectorAll('#mTabs .tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('#mTabs .tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');pintarModal(ps[+b.dataset.i]);});
  pintarModal(ps[0]);
  el('modalBg').classList.add('on');
}
function resumenPartidas(c,per){
  // --- resumen por línea de costo (partida): real del período vs gasto habitual (promedio 3 meses previos) ---
  const dimM=diasMes(per.mes), frac=(per.dia?per.dia/dimM:1);
  const H=[prevMes(per.mes),prevMes(prevMes(per.mes)),prevMes(prevMes(prevMes(per.mes)))];
  const cur={}, hist={};
  for(const r of MENS){
    if(!coincideContexto(r,c))continue;
    if(r[4]===per.mes)cur[r[3]]=(cur[r[3]]||0)+r[5];
    if(H.includes(r[4]))hist[r[3]]=(hist[r[3]]||0)+r[5]/3;
  }
  const igPend=(per.mes>META.ig_hasta);
  // referencia: desde META_DESDE, la proyección comprometida del contrato repartida por partida
  // según el mix de los últimos 3 meses; antes, el gasto habitual (promedio 3 meses)
  const conMeta=(per.mes>=META_DESDE);
  let proyMes=0;
  if(conMeta){ for(const r of PROY){ if(coincideContexto(r,c)&&r[3]===per.mes) proyMes+=r[4]; } }
  const histTot=Object.values(hist).reduce((s,v)=>s+v,0);
  const usarProy=(conMeta&&proyMes>0&&histTot>0);
  const ref=pi=>usarProy?(hist[pi]||0)/histTot*proyMes*frac:(hist[pi]||0)*frac;
  const REF_N=usarProy?'Proyectado':'Habitual', REF_V=usarProy?'vs proyectado':'vs habitual';
  const REF_NOTA=usarProy
    ?('real vs proyección comprometida del mes, repartida por línea según el mix de los últimos 3 meses'+(per.dia?(', prorrateada al día '+per.dia):''))
    :('real vs gasto habitual (promedio 3 meses previos'+(per.dia?(', prorrateado al día '+per.dia):'')+')');
  const pids=[...new Set([...Object.keys(cur),...Object.keys(hist)])].map(Number)
    .sort((a,b)=>(cur[b]||0)-(cur[a]||0)||(hist[b]||0)-(hist[a]||0));
  const filas=pids.map(pi=>{
    const p=PART[pi]||{},real=cur[pi]||0,referencia=ref(pi);
    const pendiente=igPend&&(p.cod==='2.01'||p.cod==='2.06');
    const ratio=pendiente||!referencia?null:real/referencia;
    const estilo=ratio==null?7:ratio<=SEM_AMARILLO?4:ratio<=SEM_ROJO?5:6;
    return {cod:p.cod||'',nombre:p.nombre||'—',real,referencia,diferencia:real-referencia,pendiente,ratio,estilo,
      estado:pendiente?'llega con IG':ratio==null?'nuevo':estilo===4?'Azul':estilo===5?'Amarillo':'Rojo'};
  });
  return {filas,refNombre:REF_N,refVs:REF_V,nota:REF_NOTA};
}
function filasIgModal(c,per){
  return MENS.filter(r=>coincideContexto(r,c)&&r[4]===per.mes&&r[6]===1)
    .slice().sort((a,b)=>b[5]-a[5]);
}
function pintarModal(per){
  modalPeriodo=per;
  const c=modalCtx, datos=resumenPartidas(c,per);
  datos.filas=ordenarDetalle(datos.filas,'tablaPartidas');
  let resumen='';
  if(datos.filas.length){
    resumen=`<h3 style="margin:12px 8px 6px;font-size:13px;color:var(--navy)">Líneas de costo del período <span style="font-weight:400;color:#8593a0;font-size:11px">${datos.nota}</span></h3>`+
      `<table id="tablaPartidas" style="margin-bottom:14px"><thead><tr><th class="izq">Partida</th><th>Real</th><th>${datos.refNombre}</th><th>Diferencia</th><th>${datos.refVs}</th></tr></thead><tbody>`+
      datos.filas.map(r=>{
        if(r.pendiente) return `<tr><td class="izq">${r.nombre}</td><td>–</td><td>${fmt(r.referencia)}</td><td>–</td><td><span class="sem sem-mini sem-nd">llega con IG</span></td></tr>`;
        const cls=r.estilo===4?'sem-azul':r.estilo===5?'sem-amarillo':'sem-rojo';
        const chip=r.ratio==null?'<span class="sem sem-mini sem-nd">nuevo</span>':`<span class="sem sem-mini ${cls}">${r.ratio>9.99?'&gt;999%':Math.round(r.ratio*100)+'%'}</span>`;
        return `<tr><td class="izq">${r.nombre}</td><td>${fmt(r.real)}</td><td>${fmt(r.referencia)}</td><td class="${r.diferencia>0?'neg':'pos'}">${r.diferencia>0?'+':''}${fmt(r.diferencia)}</td><td>${chip}</td></tr>`;
      }).join('')+`</tbody></table>`;
  }
  // --- órdenes de compra ---
  const filas=ordenarDetalle(filasOcModal(c,per),'tablaOc');
  el('mDescargarExcel').disabled=!filas.length;
  el('mReporteCosto').disabled=!filas.length;
  const ig=ordenarDetalle(filasIgModal(c,per),'tablaIg'),sumaIg=ig.reduce((s,r)=>s+r[5],0);
  const suma=filas.reduce((s,d)=>s+d[5],0);
  el('mResumen').innerHTML=`<span><b>${filas.length}</b> OCs</span><span>Total compras <b>${fmt(suma)}</b> MM$</span><span>(${pesos(suma)})</span><span>Total IG <b>${per.mes>META.ig_hasta?'Pendiente':fmt(sumaIg)+' MM$'}</b></span><span>Total real OC + IG <b>${fmt(suma+sumaIg)}</b> MM$</span>`;
  if(!filas.length&&!datos.filas.length&&!ig.length){
    el('mBody').innerHTML=`<div class="vacio">Sin datos en este período.</div>`;
    return;
  }
  const detalleIg='<h3 class="detalle-seccion">IG · remuneraciones y depreciación</h3>'+
    (ig.length?'<table id="tablaIg"><thead><tr><th class="izq">Zona</th><th class="izq">Unidad</th><th class="izq">Línea de negocio</th><th class="izq">Partida IG</th><th>Monto ($)</th></tr></thead><tbody>'+
      ig.map(r=>`<tr><td class="izq">${ZN[r[0]]}</td><td class="izq">${UN[r[1]]}</td><td class="izq">${LN[r[2]]}</td><td class="izq">${(PART[r[3]]||{}).nombre||'—'}</td><td>${pesos(r[5])}</td></tr>`).join('')+
      `<tr><td class="izq" colspan="4"><b>Total IG</b></td><td><b>${pesos(sumaIg)}</b></td></tr></tbody></table>`:
      `<p class="vacio">${per.mes>META.ig_hasta?'IG pendiente de cierre para este período.':'Sin registros IG para esta selección.'}</p>`);
  el('mBody').innerHTML=resumen+detalleIg+
    `<h3 style="margin:6px 8px 6px;font-size:13px;color:var(--navy)">Órdenes de compra</h3>`+
    (filas.length?`<table id="tablaOc"><thead><tr><th class="izq">Zona / Unidad / Línea</th><th class="izq">Fecha de creación</th><th class="izq">Nº OC</th><th class="izq">Proveedor</th><th class="izq">Detalle</th><th class="izq">Partida</th><th>Monto ($)</th></tr></thead><tbody>`+
    filas.slice(0,1500).map(d=>`<tr><td class="izq">${ZN[d[0]]} · ${UN[d[1]]} · ${LN[d[2]]}</td><td class="izq">${d[4]}</td><td class="izq">${d[8]}</td><td class="izq">${PROV[d[6]]||'—'}</td><td class="izq">${CONC[d[7]]||'—'}</td><td class="izq">${(PART[d[3]]||{}).nombre||'—'}</td><td>${pesos(d[5])}</td></tr>`).join('')+
    (filas.length>1500?`<tr><td class="izq" colspan="7">… ${filas.length-1500} OCs más (mostrando las primeras 1.500 según el orden de esta tabla; la descarga incluye todas)</td></tr>`:'')+`</tbody></table>`
    :`<div class="vacio">Sin OCs en este período.</div>`);
  activarOrdenDetalle();
}
el('mCerrar').onclick=()=>el('modalBg').classList.remove('on');
el('modalBg').onclick=e=>{if(e.target===el('modalBg'))el('modalBg').classList.remove('on');};
document.addEventListener('keydown',e=>{if(e.key==='Escape')el('modalBg').classList.remove('on');});

  prepararDiccionario(); refrescarUnidades(); restaurarSeleccion(); actualizar(true);
  el('descargarPdfMensual').hidden=VISTA!=='graficos';
  if(VISTA==='diccionario'&&location.hash)irDiccionario(location.hash.slice(1));
}
