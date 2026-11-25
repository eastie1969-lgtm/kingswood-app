// Only explicit office verification establishes ARK identity; free-text job numbers do not.
function assignedVisitJobs(data){
 return (data.jobs||[]).map(job=>{
  const v=job.intakeVerification;
  const valid=v?.verified===true&&typeof v.arkReference==='string'&&/^\d{4,12}$/.test(v.arkReference)&&v.verifiedBy&&v.verifiedAt&&v.address===job.address&&String(v.flat||'')===String(job.flat||'')&&v.assignedTechnicianId===job.assignedTechnicianId&&v.assignmentVersion===Number(job.dispatchVersion||1);
  return {jobId:String(job.jobId||job.id||''),assignedTechnicianId:job.assignedTechnicianId,arkReference:valid?v.arkReference:'',address:job.address,flat:job.flat||'',intakeVerified:Boolean(valid),assignmentVersion:Number(job.dispatchVersion||1),visitId:String(job.visitId||job.jobId||job.id||''),cancelled:/cancel|withdraw/i.test(String(job.dispatchStatus||job.status||''))};
 });
}
function verifyVisitIdentity(job,payload,office,now=new Date().toISOString()){
 if(office?.role!=='Director')throw Object.assign(new Error('Director sign-in required.'),{status:403});
 if(payload.confirmed!==true||!/^\d{4,12}$/.test(payload.arkReference||'')||!job.address)throw Object.assign(new Error('Confirm the ARK reference, address and flat against the job record.'),{status:422});
 if(payload.address!==job.address||String(payload.flat||'')!==String(job.flat||'')||payload.assignmentVersion!==Number(job.dispatchVersion||1))throw Object.assign(new Error('The job changed. Reopen it before verifying.'),{status:409});
 return {...job,intakeVerification:{verified:true,arkReference:payload.arkReference,address:job.address,flat:job.flat||'',assignedTechnicianId:job.assignedTechnicianId,assignmentVersion:Number(job.dispatchVersion||1),verifiedBy:office.userId||office.staffId,verifiedAt:now}};
}
function preserveOfficeVerification(incoming,existing){
 const byId=new Map((existing.jobs||[]).map(j=>[String(j.jobId||j.id),j.intakeVerification]));
 return {...incoming,jobs:(incoming.jobs||[]).map(j=>{const next={...j};const prior=byId.get(String(j.jobId||j.id));if(prior)next.intakeVerification=prior;else delete next.intakeVerification;return next;})};
}
module.exports={assignedVisitJobs,verifyVisitIdentity,preserveOfficeVerification};
