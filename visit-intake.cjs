// Visit evidence receipt only. No tracker, report approval or ARK mutations.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {immutableWrite}=require('./durable-file.cjs');
const sha = b => createHash('sha256').update(b).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const noteBytes = record => Buffer.from(`KINGSWOOD VISIT INTAKE — RECEIVED FOR REVIEW\nARK: ${record.arkReference}\nAddress: ${record.address}\nFlat: ${record.flat}\nDate: ${record.visitDate}\nTechnician: ${record.technician}\n\n${record.notes}\n\nMissing/limited evidence: ${record.missingEvidenceReason||'None declared'}\n\n${record.workflow}\n`);

class GraphStore {
  constructor({driveId, rootId, token}) { Object.assign(this, {driveId, rootId, token}); }
  async call(method, tail, body, binary = false) {
    const r = await fetch(`https://graph.microsoft.com/v1.0/drives/${this.driveId}/${tail}`, {
      method, headers: {Authorization: `Bearer ${await this.token()}`, ...(body ? {'Content-Type': binary ? 'application/octet-stream' : 'application/json'} : {})},
      body: body ? (binary ? body : JSON.stringify(body)) : undefined, signal: AbortSignal.timeout(60000)
    });
    if (r.status === 404) return null;
    if (!r.ok) fail(r.status === 409 ? 409 : 503, `OneDrive ${method} failed (${r.status}). Draft retained; retry.`);
    return binary && method === 'GET' ? Buffer.from(await r.arrayBuffer()) : r.json();
  }
  async folder(parent, name) {
    const found = await this.call('GET', `items/${parent}:/${encodeURIComponent(name)}`);
    if (found) { if (!found.folder) fail(409, 'Expected a folder.'); return found; }
    try { return await this.call('POST', `items/${parent}/children`, {name, folder:{}, '@microsoft.graph.conflictBehavior':'fail'}); }
    catch (e) { if(e.status !== 409) throw e; return this.call('GET', `items/${parent}:/${encodeURIComponent(name)}`); }
  }
  async get(parent, name) { return this.call('GET', `items/${parent}:/${encodeURIComponent(name)}`); }
  async read(item) { return this.call('GET', `items/${item.id}/content`, undefined, true); }
  async ensure(parent, name, bytes) {
    let item = await this.get(parent, name);
    if (!item) {
      try { item = await this.call('PUT', `items/${parent}:/${encodeURIComponent(name)}:/content?@microsoft.graph.conflictBehavior=fail`, bytes, true); }
      catch(e) { if(e.status !== 409) throw e; item = await this.get(parent,name); }
    }
    const actual = await this.read(item);
    if (!actual || sha(actual) !== sha(bytes)) fail(409, `OneDrive read-back differs for ${name}; office review needed.`);
    return {id:item.id, name:item.name, webUrl:item.webUrl, bytes:bytes.length, sha256:sha(bytes)};
  }
}

function createIntake({store, ledgerDir, jobs, fault = async()=>{}}) {
  const locks = new Map();
  function context(session,p){
    const job=jobs().find(j=>j.jobId===p.jobId);
    if(!job||job.assignedTechnicianId!==session.context.technicianId)fail(403,'Assigned job required.');
    if(job.cancelled)fail(409,'This job has been cancelled or withdrawn. Draft retained for office review.');
    if(!job.intakeVerified||!job.arkReference||!job.address)fail(422,'Office must verify the ARK reference and address first.');
    const value={jobId:job.jobId,arkReference:job.arkReference,address:job.address,flat:job.flat||'',visitId:job.visitId||job.jobId,assignmentVersion:job.assignmentVersion||1};
    if(p.assignmentVersion!==undefined&&p.assignmentVersion!==value.assignmentVersion)fail(409,'Job assignment changed. Keep this draft for office review.');
    return value;
  }
  async function expected(session, p) {
    if (!/^[a-f0-9-]{36}$/.test(p.submissionId || '')) fail(422,'Invalid submission ID.');
    const job = jobs().find(j => j.jobId === p.jobId);
    context(session,p);
    // Explicit office-verified mapping, never a technician-entered reference/address.
    if (!job.intakeVerified || !job.arkReference || !job.address) fail(422,'Office must verify the ARK reference and address first.');
    return {job, owner:session.context.technicianId};
  }
  async function status(session, p) {
    const {owner} = await expected(session,p);
    let saved;
    try { saved = JSON.parse(await fs.readFile(path.join(ledgerDir,p.submissionId+'.json'),'utf8')); }
    catch(e) {
      if(e.code!=='ENOENT')throw e;
      const folder=await store.get(store.rootId,p.submissionId);if(!folder)return {ok:true,verified:false};
      const intent=await store.get(folder.id,'intake-intent.json');if(!intent)return {ok:true,verified:false};
      saved=JSON.parse((await store.read(intent)).toString());
    }
    if (saved.owner !== owner || saved.record.jobId !== p.jobId) fail(403,'Submission owner differs.');
    const folder = await store.folder(store.rootId,p.submissionId);
    const manifest = await store.get(folder.id,'submission.json');
    if (!manifest) return {ok:true,verified:false};
    const m = JSON.parse((await store.read(manifest)).toString());
    if(m.digest !== saved.digest || sha(JSON.stringify(m.record)) !== saved.digest) fail(409,'Submission manifest differs.');
    const expectedFiles=[{name:'technician-note.txt',sha256:sha(noteBytes(saved.record))},...saved.record.photos];
    if(!Array.isArray(m.files)||m.files.length!==expectedFiles.length||expectedFiles.some(f=>m.files.filter(g=>g.name===f.name&&g.sha256===f.sha256).length!==1)) fail(409,'Submission manifest is missing expected evidence.');
    // Re-download every original AND the note, including on a response-loss retry.
    for (const f of m.files) {
      const item = await store.get(folder.id,f.name);
      if(!item || item.id!==f.id || sha(await store.read(item)) !== f.sha256) fail(503,'OneDrive evidence could not be verified. Retry when connected.');
    }
    return {ok:true,verified:true,status:'Received for review',submissionId:p.submissionId,folderUrl:folder.webUrl,reviewRequired:m.record.reviewRequired,arkReportSaved:false};
  }
  async function submit(session,p) {
    if(locks.has(p.submissionId)) fail(409,'Submission in progress. Retry to reconcile.');
    locks.set(p.submissionId,true);
    try {
      const {job,owner} = await expected(session,p);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(p.visitDate||'') || Number.isNaN(Date.parse(p.visitDate)) || new Date(p.visitDate).toISOString().slice(0,10)!==p.visitDate) fail(422,'Valid visit date required.');
      if(typeof p.notes!=='string'||!p.notes.trim()||p.notes.length>16000) fail(422,'Visit notes required (maximum 16000 characters).');
      if(!Array.isArray(p.photos)||p.photos.length>20) fail(422,'Maximum 20 originals.');
      const reason = String(p.missingEvidenceReason||'').trim();
      if(reason.length>2000 || (p.photos.length<6&&!reason)) fail(422,'Explain missing or limited evidence for office review.');
      let total=0;
      const photos=p.photos.map((f,i)=>{
        if(typeof f.originalName!=='string'||!f.originalName||f.originalName.length>255||!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type)) fail(422,'Use original JPEG, PNG, WebP or HEIC/HEIF files.');
        if(typeof f.base64!=='string'||f.base64.length>21*1024*1024||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.base64)) fail(422,'Invalid original image.');
        const bytes=Buffer.from(f.base64,'base64'); total+=bytes.length;
        if(!bytes.length||bytes.length>15*1024*1024||total>96*1024*1024) fail(422,'Photos exceed the 15 MB per file or 96 MB visit limit.');
        const kind=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':bytes.toString('ascii',4,8)==='ftyp'&&['heic','heix','hevc','hevx','mif1','msf1'].includes(bytes.toString('ascii',8,12))?'heif':null;
        if(!kind||(kind==='heif'?!['image/heic','image/heif'].includes(f.type):kind!==f.type)) fail(422,'Image content does not match a supported original format.');
        const label=['Before','After','Context'].includes(f.label)?f.label:null;
        const safe=f.originalName.replace(/[\\/:*?"<>|#%\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(-150)||'image';
        return {originalName:f.originalName,name:`${String(i+1).padStart(2,'0')}-${safe}`,type:f.type,label,bytes:bytes.length,sha256:sha(bytes),buffer:bytes};
      });
      const record={schema:2,submissionId:p.submissionId,jobId:job.jobId,visitId:job.visitId||job.jobId,assignmentVersion:job.assignmentVersion||1,arkReference:job.arkReference,address:job.address,flat:job.flat||'',technician:session.context.fullName,technicianId:owner,visitDate:p.visitDate,notes:p.notes,missingEvidenceReason:reason,reviewRequired:reason.length>0||photos.length<6,workflow:'Received for review; Albert template, Second Look and Kevin approval required before ARK save',photos:photos.map(({buffer,...f})=>f)};
      const digest=sha(JSON.stringify(record));
      const folder=await store.folder(store.rootId,p.submissionId);
      // Bind the immutable cloud identity before a local ledger can be created.
      // This also prevents a changed retry poisoning recovery after disk loss.
      await store.ensure(folder.id,'intake-intent.json',Buffer.from(JSON.stringify({owner,digest,record})));
      await fs.mkdir(ledgerDir,{recursive:true});
      const ledger=path.join(ledgerDir,p.submissionId+'.json');
      await immutableWrite(ledger,Buffer.from(JSON.stringify({owner,digest,record})));
      const prior=await status(session,p); if(prior.verified)return prior;
      const note=noteBytes(record);
      const files=[await store.ensure(folder.id,'technician-note.txt',note)];
      for(const photo of photos) { files.push(await store.ensure(folder.id,photo.name,photo.buffer)); await fault('after-photo',files.length-1); }
      await store.ensure(folder.id,'submission.json',Buffer.from(JSON.stringify({record,digest,files},null,2)));
      const receipt=await status(session,p);
      await fault('after-verified');
      return receipt;
    } finally { locks.delete(p.submissionId); }
  }
  return {submit,status,context};
}
module.exports={GraphStore,createIntake,sha};
