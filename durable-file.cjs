const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function immutableWrite(file,bytes){
 await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';
 try{
  const handle=await fs.open(temp,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
  try{await fs.link(temp,file);}catch(e){if(e.code!=='EEXIST')throw e;if(sha(await fs.readFile(file))!==sha(bytes))throw Object.assign(new Error('Submission content changed. Keep the original draft for office review.'),{status:409});}
 }finally{await fs.unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
module.exports={immutableWrite};
