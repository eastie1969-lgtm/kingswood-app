const {scryptSync,randomBytes,timingSafeEqual}=require('node:crypto');
function hashPin(pin){const salt=randomBytes(16).toString('hex');return {salt,hash:scryptSync(String(pin),salt,32).toString('hex')};}
function createTechnicianPinVerifier({credentials,now=Date.now}){
 const attempts=new Map();
 return (technicianId,pin)=>{
  const key=String(technicianId||'unknown'),time=now();
  const prior=attempts.get(key);
  if(prior&&prior.until>time&&prior.count>=5)return {ok:false,status:429,message:'Too many attempts. Try again in 15 minutes.'};
  const entry=credentials()[key];
  const validFormat=typeof pin==='string'&&/^\d{4,12}$/.test(pin);
  const candidate=scryptSync(validFormat?pin:'invalid',entry?.salt||'missing-credential',32);
  const expected=Buffer.from(entry?.hash||'00'.repeat(32),'hex');
  if(entry&&!entry.disabled&&expected.length===32&&timingSafeEqual(candidate,expected)&&validFormat){attempts.delete(key);return {ok:true};}
  attempts.set(key,{count:prior&&prior.until>time?prior.count+1:1,until:prior&&prior.until>time?prior.until:time+15*60*1000});
  return {ok:false,status:403,message:'Name or PIN not recognised. Contact Kingswood Office if access is needed.'};
 };
}
module.exports={hashPin,createTechnicianPinVerifier};
