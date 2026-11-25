const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {immutableWrite}=require('./durable-file.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const CHUNK=1024*1024;
// Restart-safe bounded original uploads on the server's durable DATA_DIR.
function createVisitStaging({directory,context,submit,status}){
 const locks=new Set();
 const location=id=>{if(!/^[a-f0-9-]{36}$/.test(id||''))fail(422,'Invalid submission ID.');return path.join(directory,id);};
 async function atomic(file,bytes){
  await immutableWrite(file,bytes);
 }
 async function plan(session,p){
  const job=await context(session,p);const photos=p.photos;
  if(p.assignmentVersion!==job.assignmentVersion)fail(409,'Refresh the verified assigned job before submitting. Draft retained.');
  if(!Array.isArray(photos)||photos.length>20)fail(422,'Maximum 20 original photos.');
  if(typeof p.notes!=='string'||!p.notes.trim()||p.notes.length>16000)fail(422,'Visit notes required.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.visitDate||'')||Number.isNaN(Date.parse(p.visitDate))||new Date(p.visitDate).toISOString().slice(0,10)!==p.visitDate)fail(422,'Valid visit date required.');
  const reason=String(p.missingEvidenceReason||'');if(reason.length>2000||(photos.length<6&&!reason.trim()))fail(422,'Explain missing or limited evidence for office review.');
  let total=0;
  for(const photo of photos){total+=photo.bytes;if(!Number.isSafeInteger(photo.bytes)||photo.bytes<1||photo.bytes>15*1024*1024||! /^[a-f0-9]{64}$/.test(photo.sha256||'')||typeof photo.originalName!=='string'||!photo.originalName||photo.originalName.length>255||!/^image\/(jpeg|png|webp|heic|heif)$/.test(photo.type)||!['','Before','After','Context',null].includes(photo.label))fail(422,'Invalid original photo metadata.');}
  if(total>96*1024*1024)fail(422,'Maximum 96 MB originals per visit.');
  const value={owner:session.context.technicianId,job,submissionId:p.submissionId,jobId:p.jobId,visitDate:p.visitDate,notes:p.notes,missingEvidenceReason:reason,assignmentVersion:job.assignmentVersion||1,photos:photos.map(f=>({originalName:f.originalName,type:f.type,label:f.label||null,bytes:f.bytes,sha256:f.sha256}))};
  return value;
 }
 async function begin(session,p){
  const value=await plan(session,p),dir=location(p.submissionId);
  await atomic(path.join(dir,'intent.json'),Buffer.from(JSON.stringify(value)));
  const uploaded=[];
  for(let i=0;i<value.photos.length;i++){
   const chunks=[];for(let c=0;c<Math.ceil(value.photos[i].bytes/CHUNK);c++){try{await fs.access(path.join(dir,`${i}-${c}.part`));chunks.push(c);}catch{}}
   uploaded.push(chunks);
  }
  return {ok:true,chunkBytes:CHUNK,uploaded};
 }
 async function owned(session,p){
  const dir=location(p.submissionId);let intent;try{intent=JSON.parse(await fs.readFile(path.join(dir,'intent.json'),'utf8'));}catch(e){if(e.code==='ENOENT')fail(404,'Upload plan missing. Retry the visit.');throw e;}
  if(intent.owner!==session.context.technicianId||intent.jobId!==p.jobId)fail(403,'Submission owner differs.');
  const job=await context(session,p);
  if(JSON.stringify(job)!==JSON.stringify(intent.job))fail(409,'Job identity or assignment changed. Your original draft is retained for office review.');
  return {dir,intent};
 }
 async function chunk(session,p,bytes){
  const {dir,intent}=await owned(session,p);const photo=intent.photos[p.photo];
  if(!Number.isInteger(p.photo)||!photo||!Number.isInteger(p.chunk)||p.chunk<0||p.chunk>=Math.ceil(photo.bytes/CHUNK))fail(422,'Invalid photo chunk.');
  const expected=Math.min(CHUNK,photo.bytes-p.chunk*CHUNK);if(bytes.length!==expected)fail(422,'Incomplete photo chunk. Retry.');
  await atomic(path.join(dir,`${p.photo}-${p.chunk}.part`),bytes);return {ok:true};
 }
 async function finish(session,p){
  if(locks.has(p.submissionId))fail(409,'Submission in progress. Retry shortly.');locks.add(p.submissionId);
  try{
   const {dir,intent}=await owned(session,p),prior=await status(session,p);if(prior.verified)return prior;
   const photos=[];
   for(let i=0;i<intent.photos.length;i++){
    const f=intent.photos[i],parts=[];for(let c=0;c<Math.ceil(f.bytes/CHUNK);c++){try{parts.push(await fs.readFile(path.join(dir,`${i}-${c}.part`)));}catch(e){if(e.code==='ENOENT')fail(422,'Photo upload incomplete. Retry to resume.');throw e;}}
    const bytes=Buffer.concat(parts);if(sha(bytes)!==f.sha256)fail(409,'Original photo checksum differs. Keep the draft for office review.');
    photos.push({...f,base64:bytes.toString('base64')});
   }
   return await submit(session,{...intent,photos});
  }finally{locks.delete(p.submissionId);}
 }
 return {begin,chunk,finish};
}
module.exports={createVisitStaging,CHUNK};
