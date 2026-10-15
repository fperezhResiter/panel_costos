const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.resolve('panel_costos/Panel Costos Resiter.html')).href);
await page.locator('#gatePass').fill(fs.readFileSync('panel_costos/motor/clave.txt','utf8').trim());await page.locator('#gateBtn').click();await page.locator('#gate').waitFor({state:'detached'});
assert.equal(await page.locator('.kpi').count(),5);
const testMatch=async()=>{
 const cells=await page.locator('#pie tr').first().locator('td').allTextContents(),cards=await page.locator('.kpi strong').allTextContents();
 assert.equal(cards[0],cells[1]);assert.equal(cards[1],cells[2]);assert.equal(cards[2],cells[3]);assert.equal(cards[3],cells[4]);assert.equal(cards[4],cells[5]);
 const mes=await page.locator('#fPeriodo').inputValue();const bars=await page.locator(`.barra-real[data-mes="${mes}"]`).getAttribute('data-valor');
 const monthly=await page.locator('#tablaMensual .periodo-activo td').allTextContents();assert.equal(monthly[1],cards[0]);assert.equal(monthly[2],cards[4]);assert.equal(monthly[3],cards[1]);assert.ok(Number.isFinite(Number(bars)));
};
await testMatch();await page.screenshot({path:'panel_costos/motor/respaldos/resumen_graficos_20261014/tarjetas.png',fullPage:true});
const before=await page.locator('#pie').textContent();await page.locator('#vista-graficos').click();assert.equal(await page.locator('#pie').textContent(),before);
assert.equal(await page.locator('#reporteCostos').isVisible(),false);assert.equal(await page.locator('#vistaGraficos').isVisible(),true);
await page.locator('.marca-mensual').first().hover();assert.equal(await page.locator('.marca-mensual.activa').count(),1);assert.equal(await page.locator('#pie').textContent(),before);
await page.locator('#tituloGrafico').hover();assert.equal(await page.locator('.marca-mensual.activa').count(),0);
await page.locator('#fPeriodo').selectOption('2026-08');await testMatch();
await page.locator('#fZona').selectOption('Zona 1 + 2');await testMatch();
await page.locator('#fUnidad').selectOption({index:1});await testMatch();await page.locator('#fLinea').selectOption({index:1});await testMatch();
await page.locator('.barra-real[data-mes="2026-09"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#fPeriodo').inputValue(),'2026-09');await testMatch();
await page.screenshot({path:'panel_costos/motor/respaldos/resumen_graficos_20261014/grafico.png',fullPage:true});
await page.locator('#detalleMesGrafico').click();assert.equal(await page.locator('#modalBg').isVisible(),true);await page.locator('#mCerrar').click();
await page.locator('#fPeriodo').selectOption('2026-07');assert.equal(await page.locator('.kpi strong').nth(1).innerText(),'–');assert.equal(await page.locator('.barra-proyectado[data-mes="2026-07"]').count(),0);
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.screenshot({path:'panel_costos/motor/respaldos/resumen_graficos_20261014/movil.png',fullPage:true});
await page.locator('header [data-control-tema]').click();await page.waitForTimeout(300);assert.equal(await page.locator('.kpi').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(14, 32, 51)');await page.screenshot({path:'panel_costos/motor/respaldos/resumen_graficos_20261014/oscuro.png',fullPage:true});
assert.deepEqual(errors,[]);console.log('OK: tarjetas y meses concilian con tabla; filtros combinados; hover sin alterar totales; selección por teclado; ausencia de metas; detalle; móvil; modo oscuro sin errores.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});

