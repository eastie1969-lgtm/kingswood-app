const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const {createVisitStaging,CHUNK}=require('../../visit-staging.cjs');
const {hashPin,createTechnicianPinVerifier}=require('../../technician-auth.cjs');
const {assignedVisitJobs,verifyVisitIdentity,preserveOfficeVerification}=require('../../visit-job-context.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
test('PIN is checked on server, missing/disabled credentials fail, attempts throttle',()=>{
 let now=0;const entries={tech:hashPin('5678')},verify=createTechnicianPinVerifier({credentials:()=>entries,now:()=>now});
 assert.equal(verify('tech','5678').ok,true);assert.equal(verify('missing','5678').ok,false);
 for(let i=0;i<5;i++)assert.equal(verify('tech','1111').status,403);
 assert.equal(verify('tech','5678').status,429);now=16*60*1000;assert.equal(verify('tech','5678').ok,true);
 entries.tech.disabled=true;assert.equal(verify('tech','5678').ok,false);
});
test('ARK identity requires explicit office verification matching address and flat',()=>{
 const raw={id:'job',number:'900001',address:'1 Test Street',flat:'1',assignedTechnicianId:'tech',dispatchVersion:2};
 assert.equal(assignedVisitJobs({jobs:[raw]})[0].intakeVerified,false);
 raw.intakeVerification={verified:true,arkReference:'900001',address:raw.address,flat:'1',assignedTechnicianId:'tech',assignmentVersion:2,verifiedBy:'office',verifiedAt:'2026-11-25'};
 const forged=preserveOfficeVerification({jobs:[{...raw,intakeVerification:{...raw.intakeVerification,arkReference:'999999'}}]},{jobs:[raw]});
 assert.equal(forged.jobs[0].intakeVerification.arkReference,'900001');
 assert.throws(()=>verifyVisitIdentity(raw,{}, {role:'Technician'}),e=>e.status===403);
 assert.throws(()=>verifyVisitIdentity(raw,{confirmed:true,arkReference:'900001',address:raw.address,flat:'1',assignmentVersion:1},{role:'Director',userId:'test-office'}),e=>e.status===409);
 assert.equal(assignedVisitJobs({jobs:[raw]})[0].intakeVerified,true);raw.address='Changed address';assert.equal(assignedVisitJobs({jobs:[raw]})[0].intakeVerified,false);
});
test('Chunk upload survives restart, refuses changes and cross-owner access, verifies originals before finish',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'kw-stage-'));t.after(()=>fs.rm(directory,{force:true,recursive:true}));
 const session={context:{technicianId:'tech'}},bytes=Buffer.alloc(CHUNK+25,17),p={submissionId:randomUUID(),jobId:'job',assignmentVersion:3,visitDate:'2026-11-25',notes:'TEST',missingEvidenceReason:'limited evidence',photos:[{originalName:'IMG_0001.jpg',type:'image/jpeg',label:null,bytes:bytes.length,sha256:sha(bytes)}]};
 let version=3,submitted=0;
 const context=(s,p)=>{if(s.context.technicianId!=='tech')throw Object.assign(new Error('owner'),{status:403});return {jobId:p.jobId,assignmentVersion:version,arkReference:'900001',address:'test'};};
 const options={directory,context,status:async()=>({verified:false}),submit:async(_s,payload)=>{assert.equal(sha(Buffer.from(payload.photos[0].base64,'base64')),sha(bytes));submitted++;return {verified:true};}};
 let service=createVisitStaging(options);assert.equal((await service.begin(session,p)).chunkBytes,CHUNK);
 await service.chunk(session,{...p,photo:0,chunk:0},bytes.subarray(0,CHUNK));
 service=createVisitStaging(options);assert.deepEqual((await service.begin(session,p)).uploaded,[[0]]);
 await assert.rejects(service.finish(session,p),e=>e.status===422);assert.equal(submitted,0);
 await assert.rejects(service.chunk(session,{...p,photo:0,chunk:0},Buffer.alloc(CHUNK,99)),e=>e.status===409);
 await assert.rejects(service.begin(session,{...p,notes:'changed'}),e=>e.status===409);
 await assert.rejects(service.chunk({context:{technicianId:'other'}},{...p,photo:0,chunk:1},bytes.subarray(CHUNK)),e=>e.status===403);
 version=4;await assert.rejects(service.chunk(session,{...p,photo:0,chunk:1},bytes.subarray(CHUNK)),e=>e.status===409);version=3;
 await service.chunk(session,{...p,photo:0,chunk:1},bytes.subarray(CHUNK));assert.equal((await service.finish(session,p)).verified,true);assert.equal(submitted,1);
});
