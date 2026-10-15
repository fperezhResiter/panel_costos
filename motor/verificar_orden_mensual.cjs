const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.resolve('panel_costos/web/pages/Panel_Reporte_Costos.html')).href);
await page.locator('#gatePass').fill(fs.readFileSync('panel_costos/motor/clave.txt','utf8').trim());await page.locator('#gateBtn').click();await page.locator('#gate').waitFor({state:'detached'});await page.locator('#vista-graficos').click();await page.locator('#graficoMensual svg').waitFor();
const chart=await page.locator('#graficoMensual').innerHTML(),cards=await page.locator('#tarjetasResumen').innerText(),period=await page.locator('#fPeriodo').inputValue();
const headers=page.locator('#tablaMensual').locator('..').locator('thead th');
for(let col=0;col<5;col++)for(const dir of [-1,1]){
 await headers.nth(col).locator('button').click();assert.equal(await headers.nth(col).getAttribute('aria-sort'),dir===1?'ascending':'descending');
 const rows=await page.locator('#tablaMensual tr').evaluateAll((es,col)=>es.map(e=>col===0?e.querySelector('button').dataset.mes:e.cells[col].textContent),col);
 const vals=rows.map(v=>col>0&&col<4?(v==='–'?null:Number(v.replaceAll('.','').replace(',','.'))):v);
 let seenNull=false;for(let i=0;i<vals.length;i++){if(vals[i]==null){seenNull=true;continue;}assert.equal(seenNull,false);if(i&&vals[i-1]!=null){const cmp=typeof vals[i]==='number'?vals[i-1]-vals[i]:vals[i-1].localeCompare(vals[i],'es',{numeric:true});assert.ok(cmp*dir<=0);}}
 assert.equal(await page.locator('#graficoMensual').innerHTML(),chart);assert.equal(await page.locator('#tarjetasResumen').innerText(),cards);assert.equal(await page.locator('#fPeriodo').inputValue(),period);
}
await headers.nth(1).locator('button').focus();await page.keyboard.press('Enter');assert.equal(await headers.nth(1).getAttribute('aria-sort'),'descending');assert.equal(await headers.nth(1).locator('button').evaluate(e=>e===document.activeElement),true);
await page.locator('#fZona').selectOption('Zona 1 + 2');assert.equal(await headers.nth(1).getAttribute('aria-sort'),'descending');
await page.locator('#tablaMensual .mes-detalle').first().click();assert.equal(await headers.nth(1).getAttribute('aria-sort'),'descending');
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);console.log('OK: cinco columnas en ambas direcciones, cifras numéricas y ausentes al final; gráfico y totales estables; teclado, filtros, selección de mes y móvil.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
