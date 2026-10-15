const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.resolve('panel_costos/Panel Costos Resiter.html')).href);
await page.locator('#gatePass').fill(fs.readFileSync('panel_costos/motor/clave.txt','utf8').trim());await page.locator('#gateBtn').click();await page.locator('#gate').waitFor({state:'detached'});
assert.equal(await page.locator('#colapsar').count(),0);
const total=await page.locator('#pie').textContent(),initialRows=await page.locator('#cuerpo tr').count();
assert.equal(await page.locator('#expandir').innerText(),'Expandir todo');await page.locator('#expandir').click();
assert.equal(await page.locator('#expandir').innerText(),'Contraer todo');assert.ok(await page.locator('#cuerpo tr').count()>initialRows);
await page.locator('.twirl').first().click();assert.equal(await page.locator('#expandir').innerText(),'Expandir todo');
await page.locator('#expandir').click();assert.equal(await page.locator('#expandir').innerText(),'Contraer todo');
await page.locator('#expandir').click();assert.equal(await page.locator('#cuerpo tr').count(),initialRows);assert.equal(await page.locator('#pie').textContent(),total);
await page.locator('#fPeriodo').selectOption('2026-08');await page.locator('#fZona').selectOption('Zona 1');await page.locator('#fUnidad').selectOption({index:1});await page.locator('#fLinea').selectOption({index:1});await page.locator('#fDetalle').selectOption('zona');
assert.equal(await page.locator('#expandir').isDisabled(),true);
await page.locator('#detalleTotal').click();const summary=await page.locator('#mResumen').textContent();
const readMoney=s=>Number(s.replace(/[^\d,\-]/g,'').replace(',','.'));
for(const [id,col]of [['tablaPartidas',1],['tablaIg',4],['tablaOc',6]]){
 const th=page.locator('#'+id+' thead th').nth(col);await th.locator('button').click();assert.equal(await th.getAttribute('aria-sort'),'ascending');
 const rows=page.locator('#'+id+' tbody tr').filter({has:page.locator('td:nth-child('+(col+1)+')')});
 const vals=(await rows.locator('td:nth-child('+(col+1)+')').allTextContents()).filter(s=>!['–','—'].includes(s.trim())).map(readMoney);
 assert.deepEqual(vals,vals.slice().sort((a,b)=>a-b),id+' ascendente');
 await th.locator('button').click();assert.equal(await th.getAttribute('aria-sort'),'descending');
 const desc=(await rows.locator('td:nth-child('+(col+1)+')').allTextContents()).filter(s=>!['–','—'].includes(s.trim())).map(readMoney);assert.deepEqual(desc,desc.slice().sort((a,b)=>b-a),id+' descendente');
 await page.locator('#'+id+' thead th').first().locator('button').click();
 const texts=await page.locator('#'+id+' tbody tr td:first-child').allTextContents();
 const detail=id==='tablaIg'?texts.slice(0,-1):texts;assert.deepEqual(detail,detail.slice().sort((a,b)=>a.localeCompare(b,'es',{numeric:true})));
 assert.equal(await page.locator('#mResumen').textContent(),summary);
}
assert.equal(await page.locator('#tablaIg tbody tr').last().locator('td').first().innerText(),'Total IG');
await page.screenshot({path:'panel_costos/motor/respaldos/controles_detalle_20261014/detalle.png'});
await page.locator('#mCerrar').click();await page.locator('#limpiarFiltros').click();
assert.equal(await page.locator('#fPeriodo').inputValue(),await page.evaluate(()=>DATA.meta.mes_actual));for(const id of ['fZona','fUnidad','fLinea'])assert.equal(await page.locator('#'+id).inputValue(),'');
assert.equal(await page.locator('#fDetalle').inputValue(),'contrato');assert.equal(await page.locator('#pie').textContent(),total);
await page.locator('#vista-graficos').click();await page.locator('#fZona').selectOption('Zona 1');await page.locator('#limpiarFiltros').click();assert.equal(await page.locator('#vistaGraficos').isVisible(),true);assert.equal(await page.locator('#fZona').inputValue(),'');
await page.locator('#tablaMensual button[data-mes="2026-08"]').click();assert.equal(await page.locator('#fPeriodo').inputValue(),'2026-08');
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);console.log('OK: expansión total/parcial y contracción; modo zona; limpieza en ambas vistas; tres tablas ordenan cifras y texto, conservando totales y total IG fijo; sin errores; móvil.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
