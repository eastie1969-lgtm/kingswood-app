const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {sha}=require('../../visit-intake.cjs');
const privateDir=process.env.INTAKE_TEST_DIR||'C:/Users/Kev/Documents/Codex/intake-pilot-private';
const origin=process.env.INTAKE_TEST_ORIGIN||'http://127.0.0.1:8187';
const results={checks:[],errors:[]};
const check=(name,condition)=>{assert.ok(condition,name);results.checks.push(name);console.log('PASS',name);};
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const fixtures=[0,1,2].map(i=>({name:i<2?'IMG_0001.png':'context.png',mimeType:'image/png',buffer:Buffer.concat([pixel,Buffer.from('SYNTHETIC PILOT ORIGINAL '+i)])}));
let context,page;
const profile=process.env.INTAKE_TEST_PROFILE||path.join(privateDir,'browser-profile-'+Date.now());
async function dismissAlerts(){for(let i=0;i<8;i++){const b=page.getByRole('button',{name:'Dismiss',exact:true});if(!(await b.isVisible()))break;await b.click();await page.waitForTimeout(150);}}
async function launch(){
 context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:390,height:844}});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 page=context.pages()[0]||await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
}
async function openJob(){
 await page.goto(origin+'/technician-app.html',{waitUntil:'domcontentloaded'});
 await page.selectOption('#techName','Ian D');await page.fill('#techPin','1001');
 await page.getByRole('button',{name:'Log In',exact:true}).click();
 await page.getByText('TEST ONLY — OneDrive intake',{exact:true}).first().waitFor();
 await dismissAlerts();
 await page.getByText('TEST ONLY — OneDrive intake',{exact:true}).first().click();
 await page.getByRole('button',{name:'Start Report',exact:true}).click();
 await page.waitForSelector('#intakeNotes');
}
async function draft(){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('kingswood-visit-intake',1);r.onsuccess=()=>{const q=r.result.transaction('drafts').objectStore('drafts').getAll();q.onsuccess=()=>resolve(q.result.map(d=>({...d,photos:d.photos.map(p=>({...p,file:{size:p.file.size,name:p.file.name}}))})));q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));}
async function main(){
 await fs.mkdir(privateDir,{recursive:true});await launch();await openJob();
 if(process.argv.includes('--reconcile-only')){
  await page.getByText(/Received for review — notes and every photo verified in OneDrive/).waitFor({timeout:180000});
  const expected=JSON.parse(await fs.readFile(path.join(privateDir,'browser-results.json'),'utf8'));
  check('Updated verifier reconciles existing original receipt', (await draft())[0].submissionId===expected.submissionId && await page.locator('#intakeSubmit').isHidden());
  await page.screenshot({path:path.join(privateDir,'phone-received.png'),fullPage:true});await context.close();return;
 }
 await page.fill('#intakeDate','2026-11-25');
 await page.fill('#intakeNotes','DUMMY VISIT ONLY. Inspected the synthetic flat. Three original evidence images supplied for Albert to prepare a draft. No ARK save authorised.');
 await page.fill('#intakeReason','TEST ONLY: limited access to the synthetic work area; three photos available. Please review missing evidence.');
 await page.setInputFiles('#intakeFiles',fixtures);
 await page.getByLabel('Photo label 1',{exact:true}).selectOption('Before');
 await page.getByLabel('Photo label 2',{exact:true}).selectOption('After');
 await page.getByLabel('Photo label 3',{exact:true}).selectOption('Context');
 await page.getByText('Draft and original photos kept on this phone.',{exact:true}).waitFor();
 const first=(await draft())[0];results.submissionId=first.submissionId;
 check('Three originals stored in phone draft, including duplicate camera names',first.photos.length===3&&first.photos[0].originalName===first.photos[1].originalName);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  check(`No horizontal overflow at ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(privateDir,`phone-${width}.png`),fullPage:true});
 }
 await context.setOffline(true);await page.click('#intakeSubmit');
 await page.getByText(/Draft retained on this phone. Retry uses the same submission reference./).waitFor();
 check('Offline submission retains draft without showing receipt',!(await page.locator('#intakeMessage').innerText()).includes('Received for review —'));
 await context.setOffline(false);
 await fs.writeFile(path.join(privateDir,'fault.txt'),'after-photo:1');
 await dismissAlerts();
 await page.click('#intakeSubmit');
 await page.getByText(/Save could not be verified/).waitFor({timeout:180000});
 check('Injected failure after first cloud photo gives no receipt',!(await page.locator('#intakeMessage').innerText()).includes('Received for review —'));
 await context.close();await launch();await openJob();
 const recovered=(await draft())[0];
 check('Full browser restart recovers same submission ID, notes and three originals',recovered.submissionId===first.submissionId&&recovered.notes===first.notes&&recovered.photos.length===3);
 let submitted=0,lost=false;
 await page.route('**/api/visit-intake/submit',async route=>{
  submitted++;const r=await route.fetch({timeout:180000});const receipt=await r.json();
  check('Cloud save verified before deliberately losing response',receipt.verified===true&&receipt.arkReportSaved===false);
  results.receipt=receipt;lost=true;await route.abort('failed');
 });
 await page.click('#intakeSubmit');
 await page.getByText(/Draft retained on this phone. Retry uses the same submission reference./).waitFor({timeout:180000});
 check('Lost final response does not show Submitted',lost&&!(await page.locator('#intakeMessage').innerText()).includes('Received for review —'));
 await page.unroute('**/api/visit-intake/submit');await openJob();
 await page.getByText(/Received for review — notes and every photo verified in OneDrive/).waitFor({timeout:180000});
 check('Reopen reconciles the existing cloud receipt without another submission',submitted===1&&await page.locator('#intakeSubmit').isHidden());
 check('Missing evidence is flagged for review',results.receipt.reviewRequired===true);
 await page.screenshot({path:path.join(privateDir,'phone-received.png'),fullPage:true});
 const feed=await page.evaluate(async()=> (await (await fetch('/api/phase-05b/technician-feed')).json()).feed);
 const job=feed.jobs.find(j=>j.jobId==='JOB-INTAKE-PILOT-001');
 check('Intake does not complete assigned job or set a report ID',!job.completedAt&&!job.reportId&&!job.status.includes('Completed'));
 const legacy=await page.evaluate(async()=>{const r=await fetch('/api/phase-05d/technician-report-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});return r.status;});
 check('Legacy completion endpoint blocked in pilot',legacy===409);
 const forbidden=await context.request.post(origin+'/api/visit-intake/status',{headers:{Origin:origin},data:{jobId:'not-assigned',submissionId:first.submissionId}});
 check('Unassigned job rejected by server',forbidden.status()===403);
 check('No browser runtime errors',results.errors.length===0);
 results.originals=fixtures.map(f=>({originalName:f.name,sha256:sha(f.buffer),bytes:f.buffer.length}));
 await fs.writeFile(path.join(privateDir,'browser-results.json'),JSON.stringify(results,null,2));await context.close();
}
main().catch(async e=>{console.error(e);results.failure=e.message;await fs.writeFile(path.join(privateDir,'browser-results.json'),JSON.stringify(results,null,2));await context?.close();process.exitCode=1});
