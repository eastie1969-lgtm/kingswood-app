/* Loaded only by the isolated pilot server, inside the existing technician app. */
(() => {
  let active, db, writing=Promise.resolve(), urls=[];
  const openDb = () => db || (db=new Promise((resolve,reject)=>{
    const r=indexedDB.open('kingswood-visit-intake',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'key'});
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  }));
  async function storeDraft(d) {
    const database=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction('drafts','readwrite');tx.objectStore('drafts').put(d);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Draft storage failed.'));
    });
  }
  async function readDraft(key) {
    const database=await openDb();
    return new Promise((resolve,reject)=>{const r=database.transaction('drafts').objectStore('drafts').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  }
  async function loadOrCreate(key,jobId) {
    const database=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),r=store.get(key);let draft;
      r.onsuccess=()=>{
        draft=r.result||{key,submissionId:crypto.randomUUID(),jobId,visitDate:localDateValue(),notes:'',missingEvidenceReason:'',photos:[],locked:false};
        if(!r.result)store.add(draft);
      };
      tx.oncomplete=()=>resolve(draft);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Draft could not be created.'));
    });
  }
  const el=id=>document.getElementById(id);
  function message(s) {el('intakeMessage').textContent=s;}
  function snapshot() {
    active.visitDate=el('intakeDate').value;active.notes=el('intakeNotes').value;active.missingEvidenceReason=el('intakeReason').value;
    return structuredClone(active);
  }
  function persist() {
    const draft=snapshot();
    writing=writing.catch(()=>{}).then(()=>storeDraft(draft));
    writing.then(()=>{if(active===undefined)return;if(!active.locked)message('Draft and original photos kept on this phone.');}).catch(()=>message('Phone storage failed. Keep this page open; submission is blocked until the draft can be stored.'));
    return writing;
  }
  function renderPhotos() {
    urls.forEach(URL.revokeObjectURL);urls=[];
    const list=el('intakePhotos');list.replaceChildren();
    active.photos.forEach((p,i)=>{
      const row=document.createElement('div');row.className='section';
      const name=document.createElement('p');name.textContent=p.originalName;row.append(name);
      const img=document.createElement('img');const url=URL.createObjectURL(p.file);urls.push(url);img.src=url;img.alt=p.originalName;img.style.cssText='width:100%;height:110px;object-fit:contain';row.append(img);
      const select=document.createElement('select');select.setAttribute('aria-label','Photo label '+(i+1));
      ['','Before','After','Context'].forEach(v=>select.add(new Option(v||'Label (optional)',v)));select.value=p.label;select.disabled=active.locked;
      select.onchange=()=>{p.label=select.value;persist();};row.append(select);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove photo';remove.style.cssText='min-height:44px;min-width:100px;margin-top:6px';remove.disabled=active.locked;remove.onclick=()=>{active.photos.splice(i,1);renderPhotos();persist();};row.append(remove);list.append(row);
    });
  }
  async function api(route,payload) {
    const r=await fetch('/api/visit-intake/'+route,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(180000)});
    const body=await r.json();if(!r.ok||!body.ok)throw new Error(body.message||'Save could not be verified.');return body;
  }
  function lockFields() {
    ['intakeDate','intakeNotes','intakeReason','intakeFiles'].forEach(id=>el(id).disabled=active.locked);renderPhotos();
  }
  function received(receipt) {
    if(!receipt.verified||receipt.submissionId!==active.submissionId||receipt.arkReportSaved!==false)throw new Error('OneDrive verification missing.');
    active.receipt=receipt;
    message('Received for review — notes and every photo verified in OneDrive. This is not an approved or saved ARK report.');
    el('intakeSubmit').hidden=true;
    const a=document.createElement('a');a.href=receipt.folderUrl;a.textContent='Open visit folder';a.target='_blank';a.rel='noopener';el('intakeMessage').append(document.createElement('br'),a);
    return storeDraft(structuredClone(active));
  }
  async function submit() {
    const button=el('intakeSubmit');button.disabled=true;
    try {
      if(!active.locked) {
        snapshot();
        if(!active.visitDate||!active.notes.trim())throw new Error('Add the visit date and notes.');
        if(active.photos.length<6&&!active.missingEvidenceReason.trim())throw new Error('Explain missing or limited evidence for office review.');
        active.locked=true;
      }
      await persist();lockFields();
      message('Checking OneDrive for this submission…');
      // Always reconcile first: a previous save may have succeeded despite a lost response.
      const prior=await api('status',{jobId:active.jobId,submissionId:active.submissionId});
      if(prior.verified){await received(prior);return;}
      message('Saving notes and original photos… Keep this draft until verified.');
      const photos=[];
      for(const p of active.photos) {
        const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(p.file);});
        photos.push({originalName:p.originalName,type:p.type,label:p.label,base64});
      }
      const receipt=await api('submit',{submissionId:active.submissionId,jobId:active.jobId,visitDate:active.visitDate,notes:active.notes,missingEvidenceReason:active.missingEvidenceReason,photos});
      await received(receipt);
    }catch(e){message(`${e.message} Draft retained on this phone. Retry uses the same submission reference.`);button.textContent='Retry submission';}
    finally{button.disabled=false;}
  }
  window.openVisitIntake=async job=>{
    closePriorityCommunicationAlert(false);
    const key=currentTechContext.technicianId+':'+job.id;
    try {
      active=await loadOrCreate(key,job.id);
      const legacyTestDraft=job.id==='JOB-INTAKE-PILOT-001'&&!active.photos.length&&!active.notes&&!active.locked
        ? await readDraft(currentTechContext.technicianId+':JOB-PHASE05A-IAN-001') : null;
      const panel=el('techReportForm');
      // Replace the existing report entry surface; never open a second app or form URL.
      panel.innerHTML=`<button type="button" class="button secondary" id="intakeBack">← Back to jobs</button><h3 id="intakeJob"></h3><p id="intakeAddress"></p><p>Private pilot • Visit evidence for office review</p><div class="section"><label for="intakeDate">Visit date</label><input id="intakeDate" type="date"></div><div class="section"><label for="intakeNotes">Visit notes</label><textarea id="intakeNotes" maxlength="16000"></textarea></div><div class="section"><label for="intakeFiles">Original photos (up to 20)</label><p>Before, After and Context labels are optional. No pairs required.</p><input id="intakeFiles" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple><div id="intakePhotos"></div></div><div class="section"><label for="intakeReason">Missing or limited evidence — explain why</label><textarea id="intakeReason" maxlength="2000" placeholder="Needed if fewer than six photos; flagged for office review"></textarea></div><p id="intakeMessage" role="status" aria-live="polite"></p><button type="button" class="button" id="intakeSubmit">Submit visit</button>`;
      el('intakeJob').textContent=job.jobReference+' • '+currentTech;el('intakeAddress').textContent=job.address;
      el('intakeDate').value=active.visitDate;el('intakeNotes').value=active.notes;el('intakeReason').value=active.missingEvidenceReason;
      if(legacyTestDraft&&!legacyTestDraft.receipt){
        const box=document.createElement('div');box.className='section';
        const text=document.createElement('p');text.textContent='A saved test draft was found under the old demonstration job. You can use its notes and original photos for this dummy visit: '+job.jobReference+' — '+job.address+'. Review the details before submitting.';
        const recover=document.createElement('button');recover.type='button';recover.className='button';recover.textContent='Use saved test notes and photos';
        recover.onclick=async()=>{
          try{
            Object.assign(active,{submissionId:legacyTestDraft.submissionId,visitDate:legacyTestDraft.visitDate,notes:legacyTestDraft.notes,missingEvidenceReason:legacyTestDraft.missingEvidenceReason,photos:legacyTestDraft.photos,locked:false});
            el('intakeDate').value=active.visitDate;el('intakeNotes').value=active.notes;el('intakeReason').value=active.missingEvidenceReason;
            await storeDraft(structuredClone(active));lockFields();box.remove();message('Saved test draft recovered for '+job.jobReference+'. Please review the visit details, then submit.');
          }catch(e){message('The saved test draft could not be recovered. The original draft is still stored.');}
        };
        box.append(text,recover);panel.prepend(box);
      }
      ['intakeDate','intakeNotes','intakeReason'].forEach(id=>el(id).oninput=persist);
      el('intakeFiles').onchange=async e=>{
        const files=Array.from(e.target.files);e.target.value='';
        if(active.photos.length+files.length>20||files.some(f=>f.size>15*1024*1024)||active.photos.reduce((n,p)=>n+p.file.size,0)+files.reduce((n,f)=>n+f.size,0)>96*1024*1024){message('Maximum 20 files, 15 MB per file and 96 MB per visit.');return;}
        const types={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif'};
        const photos=files.map(file=>({file,originalName:file.name,type:file.type||types[file.name.split('.').pop().toLowerCase()],label:''}));
        if(photos.some(p=>!Object.values(types).includes(p.type))){message('Choose original JPEG, PNG, WebP or HEIC/HEIF images.');return;}
        active.photos.push(...photos);renderPhotos();await persist();
      };
      el('intakeBack').onclick=async()=>{try{await persist();panel.classList.add('hidden');el('techJobList').classList.remove('hidden');handlePriorityCommunicationAlerts();}catch{message('Draft could not be stored. Keep this page open.');}};
      el('intakeSubmit').onclick=submit;el('techJobList').classList.add('hidden');el('secureJobDetails')?.classList.add('hidden');panel.classList.remove('hidden');lockFields();
      await persist();
      if(active.locked){message('Saved draft recovered. Checking OneDrive…');try{const r=await api('status',{jobId:active.jobId,submissionId:active.submissionId});if(r.verified)await received(r);else message('Unverified submission recovered. Retry with the same reference.');}catch(e){message(e.message+' Draft recovered; retry when connected.');}}
      navigator.storage?.persist?.().catch(()=>{});
    }catch(e){showReportError('Phone draft storage unavailable: '+e.message);}
  };
})();
