// Verifica la descarga con datos controlados, sin cambiar el panel ni sus fuentes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
const fixture={meta:{mes_actual:'2026-10',dia_hoy:15,ig_hasta:'2026-08',meses:['2026-09','2026-10']},
  dim:{zona:['Zona 1','Administración'],unidad:[{nombre:'Unidad prueba',zona:'Zona 1'}],linea:['Línea A','Línea B']},
  partidas:[{cod:'2.02',nombre:'Compra azul'},{cod:'2.03',nombre:'Compra amarilla'},{cod:'2.04',nombre:'Compra roja'},{cod:'2.01',nombre:'Remuneraciones'},{cod:'2.05',nombre:'Nueva'}],
  cat:{prov:['=Proveedor & prueba'],conc:['Detalle <con> "comillas"'],comentario:['Comentario original de SAP\nSegunda línea']},mens:[],proy:[[0,0,0,'2026-10',3100]],det:[]};
for(const mes of ['2026-07','2026-08','2026-09'])for(let pi=0;pi<4;pi++)fixture.mens.push([0,0,0,pi,mes,100,pi===3?1:0]);
for(const[pi,v]of [[0,300],[1,400],[2,500],[4,100]]){
  fixture.mens.push([0,0,0,pi,'2026-10',v,0]);
  fixture.det.push([0,0,0,pi,'2026-10-10',v,0,0,'000123',0]);
}
fixture.det.push([0,0,1,0,'2026-10-10',999,0,0,'Otra línea'],[0,0,0,0,'2026-10-20',999,0,0,'Fuera del corte'],[1,0,0,0,'2026-10-10',999,0,0,'Administración']);
const elements=new Map(),document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',dataset:{},classList:{toggle(){}},addEventListener(){}});return elements.get(id);},addEventListener(){}};
let code=fs.readFileSync(path.join(__dirname,'template.js'),'utf8').replace('let DATA;','let DATA=fixture;').replace('  refrescarUnidades(); actualizar(true);','  globalThis.testApi={resumenPartidas,filasOcModal,excelOcModal,pintarModal,filasReporteCosto,excelReporteCosto};');
const sandbox={fixture,document,TextEncoder,Blob};vm.createContext(sandbox);vm.runInContext(code+'\niniciar();',sandbox);
const api=sandbox.testApi,c={zi:0,ui:0,li:0,zona:'Zona 1',unidad:'Unidad prueba',linea:'Línea A'},per={mes:'2026-10',dia:15};
const rows=api.filasOcModal(c,per);assert.equal(rows.length,4);assert.equal(rows.reduce((s,r)=>s+r[5],0),1300);
const summary=api.resumenPartidas(c,per);assert.equal(summary.refNombre,'Proyectado');
for(const[cod,state]of [['2.02','Azul'],['2.03','Amarillo'],['2.04','Rojo'],['2.01','llega con IG'],['2.05','nuevo']])assert.equal(summary.filas.find(r=>r.cod===cod).estado,state);
assert.equal(summary.filas.find(r=>r.cod==='2.03').referencia,375);
assert.equal(summary.filas.find(r=>r.cod==='2.03').diferencia,25);
assert.equal(api.resumenPartidas(c,{mes:'2026-08',dia:null}).refNombre,'Habitual');
assert.equal(api.resumenPartidas(c,{mes:'2026-08',dia:null}).filas.find(r=>r.cod==='2.01').pendiente,false);
assert.equal(api.resumenPartidas(c,{mes:'2026-06',dia:null}).filas.length,0);
assert.equal(api.filasOcModal({...c,li:null},per).length,5);
const out=path.join(os.tmpdir(),'resiter-verificacion-descarga.xlsx');
const report=api.filasReporteCosto(rows,c,per),detail=report.filter(r=>r[2]==='000123');
assert.equal(detail.length,4);assert.equal(detail.reduce((s,r)=>s+r[1].v,0),1300);
assert.ok(detail.every(r=>r[4]==='Comentario original de SAP\nSegunda línea'));
assert.equal(report.at(-1)[1].v,1300);
assert.ok(report.findIndex(r=>r[0]?.v==='Remuneraciones')<report.findIndex(r=>r[0]?.v==='Compra azul'));
Promise.all([api.excelOcModal(rows,c,per).arrayBuffer(),api.excelReporteCosto(rows,c,per).arrayBuffer()]).then(([b,r])=>{
  fs.writeFileSync(out,Buffer.from(b));fs.writeFileSync(path.join(os.tmpdir(),'resiter-verificacion-reporte.xlsx'),Buffer.from(r));
  console.log('OK: filtros, corte, colores, diferencia, histórico, pendientes IG y reporte agrupado con comentarios SAP.');
});
