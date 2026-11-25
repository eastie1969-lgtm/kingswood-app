const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {hashPin}=require('../../technician-auth.cjs');
test('Real routes enforce PIN, office session/CSRF, assignment versions, verification and credential revocation',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'kw-intake-http-')),origin='http://127.0.0.1:8191';
 const credentials=path.join(dir,'credentials.json'),config=path.join(dir,'config.json'),dataFile=path.join(dir,'command-centre-data.json');
 await fs.writeFile(credentials,JSON.stringify({tech:hashPin('6842')}));
 await fs.writeFile(config,JSON.stringify({driveId:'test-drive',rootId:'test-folder',tenantId:'test-tenant',clientId:'test-client'}));
 const job={id:'test-job',address:'TEST ONLY',flat:'1',assignedTechnicianId:'tech',dispatchVersion:2,status:'Sent'};
 await fs.writeFile(dataFile,JSON.stringify({staffProfiles:[{staffId:'staff',technicianId:'tech',name:'Ian Dickens',role:'Technician',status:'Active'}],technicians:[{staffId:'staff',technicianId:'tech',name:'Ian Dickens'}],jobs:[job]}));
 const server=spawn(process.execPath,['.preview-server.cjs'],{cwd:path.resolve(__dirname,'../..'),windowsHide:true,stdio:'ignore',env:{...process.env,PORT:'8191',HOST:'127.0.0.1',NODE_ENV:'test',DATA_DIR:dir,KINGSWOOD_INTAKE_PILOT:'0',KINGSWOOD_VISIT_INTAKE_ENABLED:'1',KINGSWOOD_INTAKE_CONFIG:config,KINGSWOOD_TECHNICIAN_CREDENTIALS_FILE:credentials,KINGSWOOD_DIRECTOR_KEVIN_PIN:'12345678',FIELD_REPORTS_DIR:path.join(dir,'reports'),PROOFING_REPORT_DIR:path.join(dir,'proofing')}});
 t.after(async()=>{server.kill();await new Promise(resolve=>server.once('exit',resolve));await fs.rm(dir,{recursive:true,force:true});});
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/healthz')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
 const post=(route,body,cookie='',csrf)=>fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',cookie,...(csrf?{'X-CSRF-Token':csrf}:{})},body:JSON.stringify(body)});
 assert.equal((await post('/api/phase-05b/technician-login',{selectedName:'Ian D'})).status,403);
 const login=await post('/api/phase-05b/technician-login',{selectedName:'Ian D',pin:'6842'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const html=await(await fetch(origin+'/technician-app.html')).text();assert.ok(html.includes('const techPINs = {};'));
 assert.equal((await post('/api/visit-intake/context',{jobId:'test-job'},cookie)).status,422);
 const verification={jobId:'test-job',arkReference:'900001',address:'TEST ONLY',flat:'1',assignmentVersion:2,confirmed:true};
 assert.equal((await post('/api/phase-10/visit-intake-verification',verification,cookie)).status,401);
 const director=await post('/api/phase-10/director-login',{name:'Kevin',pin:'12345678'});assert.equal(director.status,200);const officeCookie=director.headers.get('set-cookie').split(';')[0],office=await director.json();
 assert.equal((await post('/api/phase-10/visit-intake-verification',verification,officeCookie)).status,403);
 assert.equal((await post('/api/phase-10/visit-intake-verification',verification,officeCookie,office.csrfToken)).status,200);
 const verified=await post('/api/visit-intake/context',{jobId:'test-job'},cookie);assert.equal(verified.status,200);assert.equal((await verified.json()).job.arkReference,'900001');
 const d=JSON.parse(await fs.readFile(dataFile));d.jobs[0].assignedTechnicianId='other';await fs.writeFile(dataFile,JSON.stringify(d));assert.equal((await post('/api/visit-intake/context',{jobId:'test-job'},cookie)).status,403);
 await fs.writeFile(credentials,JSON.stringify({tech:{...hashPin('6842'),disabled:true}}));assert.equal((await post('/api/visit-intake/context',{jobId:'test-job'},cookie)).status,401);
});
