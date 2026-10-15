const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.resolve('panel_costos/Panel Costos Resiter.html')).href);
await page.locator('#gatePass').fill(fs.readFileSync('panel_costos/motor/clave.txt','utf8').trim());await page.locator('#gateBtn').click();await page.locator('#gate').waitFor({state:'detached'});
await page.locator('#fPeriodo').selectOption('2026-08');await page.locator('#fDetalle').selectOption('zona');
const num=s=>Number(s.replace(/[^0-9,\-]/g,'').replace(',','.'));
const totals=await page.locator('#pie').innerText();
const defaultNames=await page.locator('#cuerpo tr td:first-child').allTextContents();
const values=async()=>Promise.all((await page.locator('#cuerpo tr td:nth-child(2)').allTextContents()).map(num));
await page.locator('#th_real button').click();let v=await values();assert.deepEqual(v,v.slice().sort((a,b)=>b-a));
await page.locator('#th_real button').click();v=await values();assert.deepEqual(v,v.slice().sort((a,b)=>a-b));
assert.equal(await page.locator('#pie').innerText(),totals);
await page.locator('#ordenDefault').click();assert.deepEqual(await page.locator('#cuerpo tr td:first-child').allTextContents(),defaultNames);
const checkModal=async(expected)=>{
 const text=await page.locator('#mResumen').innerText();const match=text.match(/Total real OC \+ IG\s+([\d.,\-]+)/);assert.ok(match,text);assert.ok(Math.abs(num(match[1])-expected)<0.11,`${match[1]} vs ${expected}`);
 assert.ok(await page.locator('#tablaIg tbody tr').count()>0);
};
const zoneValue=num(await page.locator('#cuerpo tr').first().locator('td').nth(1).innerText());
await page.locator('#cuerpo .clk').first().click();await checkModal(zoneValue);await page.locator('#mCerrar').click();
const allValue=num(await page.locator('#pie tr').first().locator('td').nth(1).innerText());
await page.locator('#detalleTotal').click();await checkModal(allValue);await page.locator('#mCerrar').click();
await page.locator('#fZona').selectOption('Zona 1');await page.locator('#fUnidad').selectOption({index:1});
await page.locator('#fLinea').selectOption({index:1});
const filteredValue=num(await page.locator('#pie tr').first().locator('td').nth(1).innerText());
await page.locator('#detalleTotal').click();await checkModal(filteredValue);
const unit=await page.locator('#fUnidad').inputValue();const line=await page.locator('#fLinea').inputValue();
const igRows=await page.locator('#tablaIg tbody tr').allTextContents();assert.ok(igRows.slice(0,-1).every(s=>s.includes(unit)&&s.includes(line)));
await page.screenshot({path:'panel_costos/motor/respaldos/detalle_zona_20261014/detalle-filtrado.png'});
await page.locator('#mCerrar').click();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);console.log('OK: zona e IG/OC concilian con tabla; total global y tres filtros concilian; orden descendente/ascendente y original; sin errores; móvil sin desbordamiento.');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
