const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRevolutAutomationAuth } = require('./revolut-automation-auth.cjs');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = {...publicKey.export({format:'jwk'}), kid:'test', alg:'RS256', use:'sig'};
const now = 1800000000000, t = now / 1000;
const audience = 'https://kingswood-hub.onrender.com/api/automation/revolut/gbp-balance';
const claims = {iss:'https://token.actions.githubusercontent.com',aud:audience,sub:'repo:eastie1969-lgtm/ark-daily-report:ref:refs/heads/main',repository:'eastie1969-lgtm/ark-daily-report',repository_id:'1325029173',repository_owner_id:'295796504',ref:'refs/heads/main',workflow_ref:'eastie1969-lgtm/ark-daily-report/.github/workflows/revolut-alert.yml@refs/heads/main',event_name:'schedule',iat:t-10,nbf:t-10,exp:t+290};
const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
function token(overrides={},header={}) {const a=encode({alg:'RS256',kid:'test',...header}), b=encode({...claims,...overrides}); return a+'.'+b+'.'+crypto.sign('RSA-SHA256',Buffer.from(a+'.'+b),privateKey).toString('base64url');}
const req = token => ({headers:{authorization:'Bearer '+token}});
const auth = createRevolutAutomationAuth({audience,enabled:true,now:()=>now,fetchKeys:async()=>[jwk]});
test('valid exact workflow accepted',async()=>assert.equal((await auth(req(token()))).ok,true));
for(const [name,overrides] of Object.entries({expired:{exp:t},future:{nbf:t+60},stale:{iat:t-700},longlife:{exp:t+700},wrongAudience:{aud:'other'},wrongIssuer:{iss:'other'},wrongRepoId:{repository_id:'1'},wrongOwner:{repository_owner_id:'1'},wrongWorkflow:{workflow_ref:'other'},wrongBranch:{ref:'refs/heads/dev'},wrongSubject:{sub:'other'},pullRequest:{event_name:'pull_request'},missingExpiry:{exp:null}})) test(name,async()=>assert.equal((await auth(req(token(overrides)))).ok,false));
test('none algorithm rejected',async()=>assert.equal((await auth(req(token({}, {alg:'none'})))).ok,false));
test('forged signature rejected',async()=>assert.equal((await auth(req(token().slice(0,-10)+'AAAAAAAAAA'))).ok,false));
test('missing bearer rejected',async()=>assert.equal((await auth({headers:{'x-kingswood-user':'Kevin'}})).ok,false));
test('disabled by default',async()=>assert.equal((await createRevolutAutomationAuth({audience})(req(token()))).status,503));
test('JWKS outage fails closed',async()=>assert.equal((await createRevolutAutomationAuth({enabled:true,audience,fetchKeys:async()=>{throw new Error('failure')}})(req(token()))).ok,false));

test("immutable subject accepted with exact IDs", async()=>assert.equal((await auth(req(token({sub:"repo:eastie1969-lgtm@295796504/ark-daily-report@1325029173:ref:refs/heads/main"})))).ok,true));
