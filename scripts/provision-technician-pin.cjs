// Administrative CLI. Pass the PIN on stdin, never as a command-line argument.
const fs=require('node:fs/promises'),path=require('node:path');
const {hashPin}=require('../technician-auth.cjs');
(async()=>{
 const file=process.env.KINGSWOOD_TECHNICIAN_CREDENTIALS_FILE,id=process.argv[2];
 if(!file||!id||!/^[A-Za-z0-9-]{1,100}$/.test(id))throw new Error('Set private KINGSWOOD_TECHNICIAN_CREDENTIALS_FILE and supply technician ID. PIN is read from stdin.');
 const target=path.resolve(file),repo=path.resolve(__dirname,'..');if(target.toLowerCase().startsWith(repo.toLowerCase()+path.sep))throw new Error('Keep the credential file outside the repository and outside the web root.');
 let pin='';for await(const chunk of process.stdin){pin+=chunk;if(pin.length>32)throw new Error('PIN must be 4–12 digits.');}pin=pin.trim();if(!/^\d{4,12}$/.test(pin))throw new Error('PIN must be 4–12 digits.');
 let entries={};try{entries=JSON.parse(await fs.readFile(target,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 entries[id]=hashPin(pin);pin='';await fs.mkdir(path.dirname(target),{recursive:true});
 const temp=target+'.pending';const handle=await fs.open(temp,'wx',0o600);try{await handle.writeFile(JSON.stringify(entries,null,2));await handle.sync();}finally{await handle.close();}
 await fs.rename(temp,target);console.log('Technician credential stored. Existing sessions for this credential will require sign-in again.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
