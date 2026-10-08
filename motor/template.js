const CIFRADO = /*__CIFRADO__*/ null;   // datos cifrados (AES-GCM); se descifran con la contraseña
let DATA;
const el=id=>document.getElementById(id);
const _b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function descifrar(clave){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(clave),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:_b64(CIFRADO.salt),iterations:CIFRADO.iter,hash:'SHA-256'},
            km,{name:'AES-GCM',length:256},false,['decrypt']);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:_b64(CIFRADO.iv)},key,_b64(CIFRADO.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
el('gateForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const b=el('gateBtn'), er=el('gateErr');
  er.textContent=''; b.disabled=true; b.textContent='Abriendo…';
  try{ DATA=await descifrar(el('gatePass').value); el('gate').remove(); iniciar(); }
  catch(_){ er.textContent='Contraseña incorrecta.'; b.disabled=false; b.textContent='Entrar'; el('gatePass').select(); }
});

function iniciar(){
const META=DATA.meta, ESC=META.escala||1e6;
const ZN=DATA.dim.zona, UN=DATA.dim.unidad.map(u=>u.nombre), LN=DATA.dim.linea;
const PART=DATA.partidas, PROV=DATA.cat.prov, CONC=DATA.cat.conc;
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
el('corteLbl').innerHTML='Datos al <b>'+META.hoy+'</b><br><b>Cifras en MM$ (millones de pesos)</b>';
el('th_dif').dataset.tip='Diferencia = costo real − costo proyectado a hoy.\nPositiva (roja) = se gastó más que el plan; negativa (verde) = bajo el plan.';
el('th_sem').dataset.tip='% Avance = costo real / proyectado a hoy.\nAzul: dentro del plan (hasta 100%).\nAmarillo: hasta +10% sobre el plan.\nRojo: más de +10% sobre el plan.\nEl criterio es el mismo en contrato, unidad, zona y división.';
el('th_pm').dataset.tip='Costo total comprometido del mes según la Proyección de Cierre de Control de Gestión.\nIncluye remuneraciones y depreciación.';
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
function recomputar(){
  const P=el('fPeriodo').value||META.mes_actual;
  const esActual=(P===META.mes_actual);
  DIM=diasMes(P); DIA=esActual?META.dia_hoy:DIM;
  const P1=prevMes(P);
  IGOK=(P<=META.ig_hasta);
  HAY_META=(P>=META_DESDE);
  el('tabla').classList.toggle('sin-meta', !HAY_META);
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
  HECHOS=[];
  for(const o of map.values()){
    HECHOS.push({zona:ZN[o.zi],unidad:UN[o.ui],linea:LN[o.li],zi:o.zi,ui:o.ui,li:o.li,
      mtd:o.mtd,proy_mes:o.pj,proy_fecha:o.pj*DIA/DIM,ig3:o.ig3,tot3:o.tot3});
  }
  // capex (activo fijo): informativo, fuera del gasto
  const cmap=new Map();
  for(const r of CAPEX){ if(r[3]===P){ const k=r[0]+'|'+r[1]+'|'+r[2];
    cmap.set(k,(cmap.get(k)||{zona:ZN[r[0]],unidad:UN[r[1]],linea:LN[r[2]],mtd:0}));
    cmap.get(k).mtd+=r[4]; } }
  CAPEXH=[...cmap.values()];
  // cabeceras + estado del mes
  el('th_real').innerHTML='Real<span class="sub">'+mesNom(P)+(esActual?(' (días 1–'+DIA+')'):(IGOK?' (mes completo)':' (compras del mes)'))+'</span>';
  el('th_ph').innerHTML='Proyectado a hoy<span class="sub">'+(esActual?('al día '+DIA):'mes completo')+(IGOK?'':' · sin remun/deprec')+' <i class="ic">i</i></span>';
  el('th_ph').dataset.tip=IGOK
    ?'Costo proyectado del mes (Proyección de Cierre). Con el mes completo, es la proyección entera.'
    :'Costo proyectado comparable: proyección del mes prorrateada al día '+DIA+' de '+DIM+',\nSIN la parte de remuneraciones y depreciación (que aún no está en el real,\nporque el IG cierra el 15–20 del mes siguiente). Así real y proyectado hablan de lo mismo.';
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
  el('notaPie').textContent='Meta = Proyección de Cierre comprometida (Control de Gestión), por contrato y mes; rige desde '+mesNom(META_DESDE)+' — los meses anteriores muestran solo el costo real. Real = órdenes de compra SAP (actualización diaria) + remuneraciones y depreciación del IG en meses cerrados (IG disponible hasta '+mesNom(META.ig_hasta)+'). Clic en un contrato (línea de negocio) para ver sus OCs. Las compras de activo fijo no son gasto y se informan aparte bajo el TOTAL. Los centros corporativos (Administración) no se incluyen.';
}

// ---------- árbol y render ----------
const AGG=['mtd','proy_mes','proy_fecha','ig3','tot3'];
const zero=()=>Object.fromEntries(AGG.map(k=>[k,0]));
const addM=(a,h)=>{for(const k of AGG)a[k]+=(h[k]||0);};
let NIVEL='contrato';   // detalle del árbol: por contrato (unidad → línea) o por unidad
function filtros(){return{z:el('fZona').value,u:el('fUnidad').value,l:el('fLinea').value};}
function niveles(f){
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
let leaves=[];
function ordZona(z){const m=/^Zona (\d+)/.exec(z);if(m)return +m[1];if(z==='(Revisar)')return 99;return 80;}
// unidades sin ninguna compra en el período: fuera del árbol, agrupadas en una fila informativa
function partirSinMov(rows){
  const act=new Set();
  for(const h of rows) if(h.mtd) act.add(h.ui);
  const mov=[],sin=[],us=new Set();
  for(const h of rows){ if(act.has(h.ui))mov.push(h); else {sin.push(h);us.add(h.ui);} }
  return {mov,sin,n:us.size};
}

function render(){
  const f=filtros(),lvls=niveles(f);
  const {mov,sin,n:nSin}=partirSinMov(HECHOS.filter(h=>zOk(h.zona,f.z)&&(!f.u||h.unidad===f.u)&&(!f.l||h.linea===f.l)));
  const raiz=construir(mov,lvls);
  leaves=[]; let html='';
  (function walk(nodo,path){
    const hijos=[...nodo.ch.entries()].sort((a,b)=>
      a[1].lvl==='zona' ? ordZona(a[0])-ordZona(b[0])
                        : (b[1].m.mtd-a[1].m.mtd || a[0].localeCompare(b[0])));
    for(const [key,c] of hijos){
      const p=path+'¦'+key, depth=Object.keys(c.ctx).length-1, esHoja=(!c.ch);
      const abierto=!colapsado.has(p);
      const tw=esHoja?`<span class="sangria" style="width:14px"></span>`:`<span class="twirl" data-k="${p}">${abierto?'▾':'▸'}</span>`;
      let etiq=key;
      if(esHoja){ const esLin=(c.lvl==='linea');
        const li=leaves.length; leaves.push({zi:c.leaf.zi,ui:c.leaf.ui,li:esLin?c.leaf.li:null,zona:c.leaf.zona,unidad:c.leaf.unidad,linea:esLin?key:null});
        etiq=`<span class="clk" data-leaf="${li}">${key}</span>`; }
      html+=`<tr class="lvl-${c.lvl}"><td class="izq"><span class="sangria" style="width:${depth*16}px"></span>${tw} ${etiq}</td><td>${fmt(c.m.mtd)}</td><td>${fmt(planHoy(c.m))}</td>${difCell(c.m)}<td>${semaforo(c.m)}</td><td>${fmt(c.m.proy_mes)}</td></tr>`;
      if(!esHoja&&abierto)walk(c,p);
    }
  })(raiz,'');
  el('cuerpo').innerHTML=html||'<tr><td class="izq" colspan="6" style="padding:20px;color:#5b6b78">Sin datos para esta selección.</td></tr>';
  el('pie').innerHTML=`<tr><td class="izq">${f.z?f.z.toUpperCase():'TOTAL DIVISIÓN'}</td><td>${fmt(raiz.m.mtd)}</td><td>${fmt(planHoy(raiz.m))}</td>${difCell(raiz.m)}<td>${semaforo(raiz.m)}</td><td>${fmt(raiz.m.proy_mes)}</td></tr>`;
  if(HAY_META&&nSin){
    const sm=zero(); sin.forEach(h=>addM(sm,h));
    el('pie').innerHTML+=`<tr class="capex"><td class="izq" data-tip="Unidades con meta comprometida pero sin ninguna compra registrada en el período. Para no llenar el panel de filas en cero, se agrupan aquí y no se incluyen en las filas ni en el TOTAL de arriba.">Unidades sin movimiento en el mes (${nSin}) <i class="ic">i</i></td><td>–</td><td>${fmt(planHoy(sm))}</td><td>–</td><td>–</td><td>${fmt(sm.proy_mes)}</td></tr>`;
  }
  const cx=CAPEXH.filter(h=>zOk(h.zona,f.z)&&(!f.u||h.unidad===f.u)&&(!f.l||h.linea===f.l))
    .reduce((s,h)=>s+h.mtd,0);
  if(cx){
    el('pie').innerHTML+=`<tr class="capex"><td class="izq" data-tip="Órdenes de compra de activo fijo (concepto 'Puente Activo fijo'). No son gasto del período: se activan y vuelven como depreciación vía IG. Por eso van fuera del TOTAL.">Inversión en activo fijo <i class="ic">i</i> (no es gasto; fuera del total)</td><td>${fmt(cx)}</td><td>–</td><td>–</td><td>–</td><td>–</td></tr>`;
  }
  const ctx=[]; if(f.z)ctx.push(f.z); if(f.u)ctx.push(f.u); if(f.l)ctx.push(f.l);
  el('unidadCap').textContent=ctx.length?('Filtro: '+ctx.join(' · ')):'Vista división — subtotales por zona, unidad y contrato';
  document.querySelectorAll('.twirl').forEach(t=>t.onclick=()=>{const k=t.dataset.k;colapsado.has(k)?colapsado.delete(k):colapsado.add(k);render();});
  document.querySelectorAll('.clk').forEach(s=>s.onclick=()=>abrirModal(leaves[+s.dataset.leaf]));
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
el('expandir').onclick=()=>{colapsado.clear();render();};
el('colapsar').onclick=()=>{colapsarBase();render();};

// ---------- modal de OCs del contrato ----------
let modalCtx=null, modalPeriodo=null;
function filasOcModal(c,per){
  return DET.filter(d=>d[0]===c.zi && d[1]===c.ui && (c.li==null||d[2]===c.li)
    && d[4].slice(0,7)===per.mes && (per.dia==null||(+d[4].slice(8,10))<=per.dia)).sort((a,b)=>b[5]-a[5]);
}
function csvOcModal(filas){
  const celda=v=>{
    let s=String(v??'');
    if(typeof v!=='number' && /^[\s]*[=+\-@]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  const cabecera=['Zona','Unidad','Línea de negocio','Fecha de creación','Nº OC','Proveedor','Detalle','Código de partida','Partida','Monto (CLP)'];
  const registros=filas.map(d=>[ZN[d[0]],UN[d[1]],LN[d[2]],d[4],d[8],PROV[d[6]]||'—',CONC[d[7]]||'—',
    (PART[d[3]]||{}).cod||'',(PART[d[3]]||{}).nombre||'—',d[5]]);
  return '\uFEFF'+[cabecera,...registros].map(r=>r.map(celda).join(';')).join('\r\n')+'\r\n';
}
function descargarOcModal(){
  if(!modalCtx||!modalPeriodo)return;
  const filas=filasOcModal(modalCtx,modalPeriodo);
  if(!filas.length)return;
  const limpio=s=>String(s).replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim().slice(0,60);
  const nombre=['OC',modalCtx.zona,modalCtx.unidad,modalCtx.linea||'Todas las líneas',modalPeriodo.mes,
    modalPeriodo.dia?'hasta_dia_'+modalPeriodo.dia:'mes_completo'].map(limpio).join('_')+'.csv';
  const url=URL.createObjectURL(new Blob([csvOcModal(filas)],{type:'text/csv;charset=utf-8;'}));
  const enlace=document.createElement('a');
  enlace.href=url;enlace.download=nombre;document.body.appendChild(enlace);enlace.click();enlace.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el('mDescargarCSV').onclick=descargarOcModal;
function periodosModal(){
  const P=el('fPeriodo').value||META.mes_actual, esActual=(P===META.mes_actual);
  const dia=esActual?META.dia_hoy:null, P1=prevMes(P);
  return [
    {id:'cur', lbl:'Este período · '+mesNom(P)+(dia?(' (1–'+dia+')'):''), mes:P, dia:dia},
    {id:'prev',lbl:'Mes anterior · '+mesNom(P1), mes:P1, dia:null},
  ];
}
function abrirModal(ctx){ modalCtx=ctx; el('mTitulo').textContent=ctx.unidad+(ctx.linea?(' · '+ctx.linea):'');
  el('mContexto').textContent=ctx.zona+' — detalle por línea de costo y órdenes de compra'+(ctx.linea?'':' (toda la unidad)');
  const ps=periodosModal();
  el('mTabs').innerHTML=ps.map((p,i)=>`<button class="tab${i===0?' on':''}" data-i="${i}">${p.lbl}</button>`).join('');
  document.querySelectorAll('#mTabs .tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('#mTabs .tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');pintarModal(ps[+b.dataset.i]);});
  pintarModal(ps[0]);
  el('modalBg').classList.add('on');
}
function pintarModal(per){
  modalPeriodo=per;
  const c=modalCtx;
  // --- resumen por línea de costo (partida): real del período vs gasto habitual (promedio 3 meses previos) ---
  const dimM=diasMes(per.mes), frac=(per.dia?per.dia/dimM:1);
  const H=[prevMes(per.mes),prevMes(prevMes(per.mes)),prevMes(prevMes(prevMes(per.mes)))];
  const cur={}, hist={};
  for(const r of MENS){
    if(r[0]!==c.zi||r[1]!==c.ui||(c.li!=null&&r[2]!==c.li))continue;
    if(r[4]===per.mes)cur[r[3]]=(cur[r[3]]||0)+r[5];
    if(H.includes(r[4]))hist[r[3]]=(hist[r[3]]||0)+r[5]/3;
  }
  const igPend=(per.mes>META.ig_hasta);
  // referencia: desde META_DESDE, la proyección comprometida del contrato repartida por partida
  // según el mix de los últimos 3 meses; antes, el gasto habitual (promedio 3 meses)
  const conMeta=(per.mes>=META_DESDE);
  let proyMes=0;
  if(conMeta){ for(const r of PROY){ if(r[0]===c.zi&&r[1]===c.ui&&(c.li==null||r[2]===c.li)&&r[3]===per.mes) proyMes+=r[4]; } }
  const histTot=Object.values(hist).reduce((s,v)=>s+v,0);
  const usarProy=(conMeta&&proyMes>0&&histTot>0);
  const ref=pi=>usarProy?(hist[pi]||0)/histTot*proyMes*frac:(hist[pi]||0)*frac;
  const REF_N=usarProy?'Proyectado':'Habitual', REF_V=usarProy?'vs proyectado':'vs habitual';
  const REF_NOTA=usarProy
    ?('real vs proyección comprometida del mes, repartida por línea según el mix de los últimos 3 meses'+(per.dia?(', prorrateada al día '+per.dia):''))
    :('real vs gasto habitual (promedio 3 meses previos'+(per.dia?(', prorrateado al día '+per.dia):'')+')');
  const pids=[...new Set([...Object.keys(cur),...Object.keys(hist)])].map(Number)
    .sort((a,b)=>(cur[b]||0)-(cur[a]||0)||(hist[b]||0)-(hist[a]||0));
  let resumen='';
  if(pids.length){
    resumen=`<h3 style="margin:12px 8px 6px;font-size:13px;color:var(--navy)">Líneas de costo del período <span style="font-weight:400;color:#8593a0;font-size:11px">${REF_NOTA}</span></h3>`+
      `<table style="margin-bottom:14px"><thead><tr><th class="izq">Partida</th><th>Real</th><th>${REF_N}</th><th>Diferencia</th><th>${REF_V}</th></tr></thead><tbody>`+
      pids.map(pi=>{
        const p=PART[pi]||{}; const esIG=(p.cod==='2.01'||p.cod==='2.06');
        const re=cur[pi]||0, ha=ref(pi), d=re-ha;
        if(esIG&&igPend) return `<tr><td class="izq">${p.nombre||'—'}</td><td>–</td><td>${fmt(ha)}</td><td>–</td><td><span class="sem sem-mini sem-nd">llega con IG</span></td></tr>`;
        const chip=!ha?'<span class="sem sem-mini sem-nd">nuevo</span>':(()=>{const r2=re/ha;const cls=r2<=SEM_AMARILLO?'sem-azul':(r2<=SEM_ROJO?'sem-amarillo':'sem-rojo');return `<span class="sem sem-mini ${cls}">${r2>9.99?'&gt;999%':Math.round(r2*100)+'%'}</span>`;})();
        return `<tr><td class="izq">${p.nombre||'—'}</td><td>${fmt(re)}</td><td>${fmt(ha)}</td><td class="${d>0?'neg':'pos'}">${d>0?'+':''}${fmt(d)}</td><td>${chip}</td></tr>`;
      }).join('')+`</tbody></table>`;
  }
  // --- órdenes de compra ---
  const filas=filasOcModal(c,per);
  el('mDescargarCSV').disabled=!filas.length;
  const suma=filas.reduce((s,d)=>s+d[5],0);
  el('mResumen').innerHTML=`<span><b>${filas.length}</b> OCs</span><span>Total compras <b>${fmt(suma)}</b> MM$</span><span>(${pesos(suma)})</span>`;
  if(!filas.length&&!pids.length){
    el('mBody').innerHTML=`<div class="vacio">Sin datos en este período.</div>`;
    return;
  }
  el('mBody').innerHTML=resumen+
    `<h3 style="margin:6px 8px 6px;font-size:13px;color:var(--navy)">Órdenes de compra</h3>`+
    (filas.length?`<table><thead><tr><th class="izq">Fecha de creación</th><th class="izq">Nº OC</th><th class="izq">Proveedor</th><th class="izq">Detalle</th><th class="izq">Partida</th><th>Monto ($)</th></tr></thead><tbody>`+
    filas.slice(0,1500).map(d=>`<tr><td class="izq">${d[4]}</td><td class="izq">${d[8]}</td><td class="izq">${PROV[d[6]]||'—'}</td><td class="izq">${CONC[d[7]]||'—'}</td><td class="izq">${(PART[d[3]]||{}).nombre||'—'}</td><td>${pesos(d[5])}</td></tr>`).join('')+
    (filas.length>1500?`<tr><td class="izq" colspan="6">… ${filas.length-1500} OCs más (mostrando las 1.500 mayores)</td></tr>`:'')+`</tbody></table>`
    :`<div class="vacio">Sin OCs en este período.</div>`);
}
el('mCerrar').onclick=()=>el('modalBg').classList.remove('on');
el('modalBg').onclick=e=>{if(e.target===el('modalBg'))el('modalBg').classList.remove('on');};
document.addEventListener('keydown',e=>{if(e.key==='Escape')el('modalBg').classList.remove('on');});

  refrescarUnidades(); actualizar(true);
}
