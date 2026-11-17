const {test}=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs');
const text=fs.readFileSync(__dirname+'/.preview-server.cjs','utf8');
const start=text.indexOf('  if (routePath === "/api/automation/revolut/gbp-balance")'); const end=text.indexOf('  if (routePath === "/api/revolut/gbp-balance"',start);
const route=new Function('routePath','request','response','revolutAutomationAuth','revolutGbpBalanceSnapshot','sendJson',text.slice(start,end));
async function run(method,auth,snapshot) {let calls=0; let result; route('/api/automation/revolut/gbp-balance',{method},{},async()=>auth,async()=>{calls++;if(snapshot instanceof Error)throw snapshot;return snapshot},(_,status,body,headers)=>result={status,body,headers}); await new Promise(setImmediate);return {calls,...result};}
test('no anonymous balance access',async()=>{let r=await run('GET',{ok:false,status:401},{secret:1});assert.equal(r.calls,0);assert.equal(r.status,401)});
test('no write methods',async()=>{for(const method of ['POST','PUT','DELETE']){let r=await run(method,{ok:true},{});assert.equal(r.status,405);assert.equal(r.calls,0)}});
test('allowlist response only',async()=>{const input={ok:true,connected:true,currency:'GBP',activeGbpAccountFound:true,availableBalance:500,lastUpdatedAt:'2026-11-17T00:00:00Z',accountId:'NEVER',token:'NEVER'};let r=await run('GET',{ok:true},input);assert.equal(r.status,200);assert.equal(r.body.accountId,undefined);assert.equal(r.body.token,undefined);assert.equal(r.body.availableBalance,500);assert.equal(r.headers['Cache-Control'],'no-store')});
test('upstream error sanitized',async()=>{let r=await run('GET',{ok:true},new Error('SECRET'));assert.equal(r.status,502);assert.ok(!JSON.stringify(r).includes('SECRET'))});
