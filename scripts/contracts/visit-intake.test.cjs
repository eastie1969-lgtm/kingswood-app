const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createIntake,sha}=require('../../visit-intake.cjs');
function fakeStore(){
 const files=new Map(),folders=new Map();return {files,rootId:'private',folder:async(_p,name)=>{const value={id:name,webUrl:'https://example.invalid/'+name};folders.set(name,value);return value;},get:async(parent,name)=>parent==='private'?folders.get(name)||null:files.has(parent+'/'+name)?{id:parent+'/'+name}:null,read:async item=>files.get(item.id),ensure:async(parent,name,bytes)=>{const key=parent+'/'+name;if(files.has(key)){if(sha(files.get(key))!==sha(bytes))throw Object.assign(new Error('Cloud content differs'),{status:409});}else files.set(key,Buffer.from(bytes));return {id:key,name,sha256:sha(bytes),bytes:bytes.length};}};
}
const session={context:{technicianId:'tech-1',fullName:'Test Technician'}};
const job={jobId:'dummy',assignedTechnicianId:'tech-1',intakeVerified:true,arkReference:'TEST-900001',address:'TEST ONLY — Flat 1'};
const makePayload=()=>({submissionId:randomUUID(),jobId:'dummy',visitDate:'2026-11-25',notes:'Synthetic visit notes',photos:[],missingEvidenceReason:'No access; no photographs available.'});
test('No-photo intake with explanation remains review-only; retry is identical; changed retry rejected',async t=>{
 const ledgerDir=await fs.mkdtemp(path.join(os.tmpdir(),'kw-intake-test-'));t.after(()=>fs.rm(ledgerDir,{recursive:true,force:true}));
 const store=fakeStore(),service=createIntake({store,ledgerDir,jobs:()=>[job]}),p=makePayload();
 const first=await service.submit(session,p),count=store.files.size;
 assert.equal(first.verified,true);assert.equal(first.reviewRequired,true);assert.equal(first.arkReportSaved,false);assert.equal(first.status,'Received for review');
 assert.deepEqual(await service.submit(session,p),first);assert.equal(store.files.size,count);
  await fs.unlink(path.join(ledgerDir,p.submissionId+'.json'));
  assert.deepEqual(await service.status(session,p),first,'Cloud intent and all evidence recover receipt after local ledger loss');
 await assert.rejects(service.submit(session,{...p,notes:'Changed after receipt'}),e=>e.status===409);
 const manifestKey=p.submissionId+'/submission.json',originalManifest=store.files.get(manifestKey);
 const omitted=JSON.parse(originalManifest);omitted.files=[];store.files.set(manifestKey,Buffer.from(JSON.stringify(omitted)));
 await assert.rejects(service.status(session,p),e=>e.status===409);
 store.files.set(manifestKey,originalManifest);
 store.files.set(p.submissionId+'/technician-note.txt',Buffer.from('Corrupted cloud note'));
 await assert.rejects(service.status(session,p),e=>e.status===503);
 assert.equal(job.status,undefined);assert.equal(job.reportId,undefined);
});
test('Assigned identity, verified mapping, real dates and missing-evidence explanation enforced',async t=>{
 const ledgerDir=await fs.mkdtemp(path.join(os.tmpdir(),'kw-intake-test-'));t.after(()=>fs.rm(ledgerDir,{recursive:true,force:true}));
 const service=createIntake({store:fakeStore(),ledgerDir,jobs:()=>[job]});
 for(const p of [{...makePayload(),visitDate:'2026-02-31'},{...makePayload(),missingEvidenceReason:''},{...makePayload(),notes:''}]) await assert.rejects(service.submit(session,p),e=>e.status===422);
 await assert.rejects(service.submit({context:{technicianId:'other'}},makePayload()),e=>e.status===403);
 const unverified=createIntake({store:fakeStore(),ledgerDir,jobs:()=>[{...job,intakeVerified:false}]});
 await assert.rejects(unverified.submit(session,makePayload()),e=>e.status===422);
});
