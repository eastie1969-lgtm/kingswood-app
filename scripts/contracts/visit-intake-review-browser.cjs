const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {sha}=require('../../visit-intake.cjs');
const origin=process.env.INTAKE_TEST_ORIGIN||'http://127.0.0.1:8190';
const artifacts=process.env.INTAKE_TEST_DIR;
if(!artifacts)throw new Error('Set INTAKE_TEST_DIR to a private artifact directory outside the repository.');
const result={checks:[]};const pass=(name,value)=>{assert.ok(value,name);result.checks.push(name);console.log('PASS',name);};
let context,page;const profile=path.join(artifacts,'staged-profile-'+Date.now());
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const fixtures=[{name:'IMG_0001.png',mimeType:'image/png',buffer:Buffer.concat([pixel,Buffer.alloc(2*1024*1024,29)])},{name:'IMG_0001.png',mimeType:'image/png',buffer:Buffer.concat([pixel,Buffer.from('SECOND ORIGINAL')])},{name:'context.png',mimeType:'image/png',buffer:pixel}];
async function launch(){context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:390,height:844}});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());page=context.pages()[0]||await context.newPage();}
async function open(){
 await page.goto(origin+'/technician-app.html',{waitUntil:'domcontentloaded'});await page.selectOption('#techName','Ian D');await page.fill('#techPin','1001');await page.getByRole('button',{name:'Log In',exact:true}).click();await page.getByText('TEST ONLY — OneDrive intake',{exact:true}).first().waitFor();
 for(let i=0;i<5;i++){const b=page.getByRole('button',{name:'Dismiss',exact:true});if(!await b.isVisible())break;await b.click();await page.waitForTimeout(100);}
 await page.getByText('TEST ONLY — OneDrive intake',{exact:true}).first().click();await page.getByRole('button',{name:'Start Report',exact:true}).click();await page.waitForSelector('#intakeNotes');
}
async function draft(){return page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('kingswood-visit-intake');r.onsuccess=()=>{const q=r.result.transaction('drafts').objectStore('drafts').get('TECH-20260716-001:JOB-INTAKE-PILOT-001');q.onsuccess=()=>resolve({...q.result,photos:q.result.photos.map(p=>({...p,file:{size:p.file.size}}))});};}));}
async function main(){
 await fs.mkdir(artifacts,{recursive:true});await launch();
 const missing=await context.request.post(origin+'/api/phase-05b/technician-login',{headers:{Origin:origin},data:{selectedName:'Ian D'}});pass('Direct server login without PIN is rejected',missing.status()===403);
 await open();pass('Verified job identity is returned by the server',(await page.locator('#intakeJob').innerText()).includes('900001'));
 await page.fill('#intakeNotes','STAGED BUILD REVIEW ONLY. Original bytes and limited evidence are for testing.');await page.fill('#intakeReason','Three synthetic originals; review required.');await page.setInputFiles('#intakeFiles',fixtures);await page.getByLabel('Photo label 1',{exact:true}).selectOption('Context');
 await page.getByText('Draft and original photos kept on this phone.',{exact:true}).waitFor();const first=await draft();result.submissionId=first.submissionId;
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});pass(`Phone layout fits ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,`staged-${width}.png`),fullPage:true});}
 await context.setOffline(true);await page.click('#intakeSubmit');await page.getByText(/Draft retained on this phone/).waitFor();await context.setOffline(false);pass('Offline submit retains the same draft',(await draft()).submissionId===first.submissionId);
 let failed=false,chunkCount=0;
 await page.route('**/api/visit-intake/chunk?**',async route=>{chunkCount++;if(!failed&&new URL(route.request().url()).searchParams.get('chunk')==='1'){failed=true;await route.abort();}else await route.continue();});
 await page.click('#intakeSubmit');await page.waitForFunction(()=>!document.getElementById('intakeSubmit').disabled,{},{timeout:60000});await page.getByText(/Draft retained on this phone/).waitFor();pass('Photo transfer interruption is surfaced',failed);
 await context.close();await launch();await open();const recovered=await draft();pass('Browser restart recovers ID, notes and originals',recovered.submissionId===first.submissionId&&recovered.notes===first.notes&&recovered.photos.length===3);
 let repeatedFirstChunk=false,finishCount=0;
 await page.route('**/api/visit-intake/chunk?**',async route=>{const q=new URL(route.request().url()).searchParams;if(q.get('photo')==='0'&&q.get('chunk')==='0')repeatedFirstChunk=true;await route.continue();});
 await page.route('**/api/visit-intake/finish',async route=>{finishCount++;const response=await route.fetch({timeout:240000});const receipt=await response.json();assert.equal(receipt.verified,true);result.receipt=receipt;await route.abort();});
 await page.click('#intakeSubmit');await page.getByText(/Draft retained on this phone/).waitFor({timeout:240000});pass('Already stored chunks are skipped on retry',!repeatedFirstChunk);pass('Lost final response never shows receipt',!(await page.locator('#intakeMessage').innerText()).includes('Received for review —'));
 await page.unroute('**/api/visit-intake/finish');await open();await page.getByText(/Received for review —/).waitFor({timeout:240000});pass('Reopen reconciles verified OneDrive receipt without another finish',finishCount===1&&await page.locator('#intakeSubmit').isHidden());
 const feed=await page.evaluate(async()=> (await(await fetch('/api/phase-05b/technician-feed')).json()).feed);pass('No job completion or ARK-save state set',feed.jobs.length===1&&!feed.jobs[0].completedAt&&!feed.jobs[0].reportId&&!feed.jobs[0].status.includes('Completed')&&result.receipt.arkReportSaved===false);
 await page.screenshot({path:path.join(artifacts,'staged-received.png'),fullPage:true});
 await page.click('#intakeNewVisit');await page.waitForSelector('#intakeSubmit');const next=await draft();pass('Explicit next visit creates a new draft without replacing the receipt',next.submissionId!==first.submissionId&&!next.notes&&!next.photos.length);
 result.originals=fixtures.map(f=>({originalName:f.name,bytes:f.buffer.length,sha256:sha(f.buffer)}));await fs.writeFile(path.join(artifacts,'staged-browser-results.json'),JSON.stringify(result,null,2));await context.close();
}
main().catch(async e=>{console.error(e);result.failure=e.message;await fs.writeFile(path.join(artifacts,'staged-browser-results.json'),JSON.stringify(result,null,2));await context?.close();process.exitCode=1});
