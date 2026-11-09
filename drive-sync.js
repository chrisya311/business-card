/* 名片管家：Google 雲端硬碟同步 */
'use strict';
/* ---------- Google Drive sync ---------- */
const GOOGLE_CLIENT_ID='509507706932-9ijod4g5nea7dgqtvsillrp9g1va44k5.apps.googleusercontent.com';   // 在 Google Cloud 建立的 OAuth 用戶端 ID
const Sync={
  scope:'https://www.googleapis.com/auth/drive.appdata',
  dataName:'mpgj-data.json',
  busy:false,timer:null,pending:false,
  enabled(){return !!GOOGLE_CLIENT_ID},
  st(){try{return JSON.parse(localStorage.getItem('mpgj.sync')||'{}')}catch(_){return{}}},
  save(v){try{localStorage.setItem('mpgj.sync',JSON.stringify({...this.st(),...v}))}catch(_){}},
  linked(){return this.enabled()&&!!this.st().linked},
  tokenOk(){const t=this.st();return !!(t.token&&t.exp&&Date.now()<t.exp-60000)},
  redirectUri(){return location.origin+location.pathname.replace(/index\.html$/,'')},
  login(forceConsent){
    if(!this.enabled())return;
    const state=uid();try{sessionStorage.setItem('mpgj.oauth',state);localStorage.setItem('mpgj.oauth',state)}catch(_){}
    const q=new URLSearchParams({client_id:GOOGLE_CLIENT_ID,redirect_uri:this.redirectUri(),response_type:'token',scope:this.scope,include_granted_scopes:'true',state});
    const st=this.st();if(forceConsent||!st.linked)q.set('prompt','consent select_account');else if(st.email)q.set('login_hint',st.email);
    location.href='https://accounts.google.com/o/oauth2/v2/auth?'+q.toString();
  },
  takeRedirect(){
    if(!location.hash||!/access_token=|error=/.test(location.hash))return null;
    const h=new URLSearchParams(location.hash.slice(1));history.replaceState(history.state,'',location.pathname+location.search);
    let saved='';try{saved=localStorage.getItem('mpgj.oauth')||sessionStorage.getItem('mpgj.oauth')||'';localStorage.removeItem('mpgj.oauth')}catch(_){}
    if(h.get('error'))return{error:h.get('error')};
    if(!h.get('access_token')||(saved&&h.get('state')!==saved))return{error:'state'};
    this.save({token:h.get('access_token'),exp:Date.now()+(+h.get('expires_in')||3600)*1000,linked:true});
    return{ok:true};
  },
  unlink(){const t=this.st().token;try{localStorage.removeItem('mpgj.sync')}catch(_){}
    if(t)fetch('https://oauth2.googleapis.com/revoke?token='+encodeURIComponent(t),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'}}).catch(()=>{});paintSync()},
  async api(path,opt={},raw){
    const r=await fetch(path.startsWith('http')?path:'https://www.googleapis.com/drive/v3/'+path,{...opt,headers:{...(opt.headers||{}),authorization:'Bearer '+this.st().token}});
    if(r.status===401){this.save({token:'',exp:0});throw{code:'auth'}}
    if(!r.ok)throw{code:'http',status:r.status,message:(await r.text().catch(()=>'')).slice(0,200)};
    return raw?r:(r.status===204?null:r.json());
  },
  async list(){let files=[],tok='';do{const j=await this.api(`files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)${tok?'&pageToken='+tok:''}`);files=files.concat(j.files||[]);tok=j.nextPageToken||''}while(tok);return files},
  async upload(name,blob,id){
    if(id)return this.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,{method:'PATCH',headers:{'content-type':blob.type||'application/octet-stream'},body:blob});
    const fd=new FormData();fd.append('metadata',new Blob([JSON.stringify({name,parents:['appDataFolder']})],{type:'application/json'}));fd.append('file',blob);
    return this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',{method:'POST',body:fd});
  },
  dirty(){if(!this.linked())return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.run(),4000)},
  async run(manual){
    if(!this.linked())return;
    if(this.busy){this.pending=true;return}
    if(!navigator.onLine){paintSync();return}
    if(!this.tokenOk()){paintSync();if(manual)this.login();return}
    this.busy=true;paintSync('同步中…');
    try{await this.syncOnce();this.save({last:new Date().toISOString(),err:''});}
    catch(e){this.save({err:e&&e.code==='auth'?'auth':'fail'});if(manual&&e&&e.code!=='auth')toast('同步失敗，請稍後再試',3500)}
    finally{this.busy=false;paintSync();if(this.pending){this.pending=false;this.dirty()}}
  },
  async syncOnce(){
    const files=await this.list();const byName=new Map(files.map(f=>[f.name,f]));
    // 1. remote data
    let remote={contacts:[],deleted:{}};const df=byName.get(this.dataName);
    if(df){const r=await this.api(`files/${df.id}?alt=media`,{},true);try{remote=await r.json()}catch(_){}}
    const rDel=remote.deleted||{};const lDel=(await Meta.get('deleted'))||{};
    const del={...rDel};for(const k in lDel)if(!del[k]||lDel[k]>del[k])del[k]=lDel[k];
    // 2. make sure local photo hashes exist (older records)
    for(const c of contacts){for(const sd of ['front','back']){const has=c['has'+(sd==='front'?'Front':'Back')];if(has&&!c.photoHash[sd]){const d=await Store.getPhoto(c.id,sd);if(d){c.photoHash={...c.photoHash,[sd]:hashStr(d)};await Store.put(c)}}}}
    // 3. merge
    const L=new Map(contacts.map(c=>[c.id,c])),R=new Map((remote.contacts||[]).map(c=>[c.id,normalize(c)]));
    const ids=new Set([...L.keys(),...R.keys()]);const merged=[];
    for(const id of ids){
      const a=L.get(id),b=R.get(id);
      let w=!a?b:!b?a:((a.updated||'')>=(b.updated||'')?a:b);
      if(a&&b){const dv=[...new Set([...(a.deletedVisits||[]),...(b.deletedVisits||[])])];const dp=[...new Set([...(a.deletedPhotos||[]),...(b.deletedPhotos||[])])];const vm=new Map();
        [...b.visits,...a.visits].forEach(v=>{if(dv.includes(v.id))return;const prev=vm.get(v.id);const ph=new Map();[...((prev&&prev.photos)||[]),...(v.photos||[])].forEach(p=>{if(!dp.includes(p.id))ph.set(p.id,p)});const base=prev&&(prev.updated||'')>(v.updated||'')?prev:v;vm.set(v.id,{...base,photos:[...ph.values()]})});
        w={...w,deletedVisits:dv,deletedPhotos:dp,visits:[...vm.values()]}}
      if(del[id]&&del[id]>=(w.updated||''))continue;
      if(del[id])delete del[id];
      merged.push(w);
    }
    // 4. write local changes
    const mIds=new Set(merged.map(c=>c.id));
    for(const c of contacts)if(!mIds.has(c.id)){await LDB.del('contacts',c.id);for(const sd of ['front','back']){await LDB.del('photos',c.id+':'+sd).catch(()=>{});photoCache.delete(c.id+':'+sd)}}
    for(const c of merged){const a=L.get(c.id);if(!a||JSON.stringify(a)!==JSON.stringify(c))await Store.put(c)}
    // 5. photos
    const want=new Set();
    for(const c of merged)for(const sd of ['front','back']){const h=c.photoHash&&c.photoHash[sd];if(!h||!c['has'+(sd==='front'?'Front':'Back')])continue;
      const name=`p-${c.id}-${sd}-${h}.jpg`;want.add(name);
      const local=await Store.getPhoto(c.id,sd);const lh=local?hashStr(local):'';
      if(lh===h&&!byName.has(name)){await this.upload(name,dataUrlToBlob(local));}
      else if(lh!==h&&byName.has(name)){const r=await this.api(`files/${byName.get(name).id}?alt=media`,{},true);const d=await blobToDataURL(new Blob([await r.blob()],{type:'image/jpeg'}));await Store.putPhoto(c.id,sd,d);
        if(sd==='front'){c.thumb=await makeThumb(d);await Store.put(c)}}
    }
    for(const c of merged)for(const v of c.visits||[])for(const ph of v.photos||[]){if(!ph.h)continue;const name=`v-${ph.id}-${ph.h}.jpg`;want.add(name);
      const local=await VP.get(ph.id);
      if(local&&!byName.has(name))await this.upload(name,dataUrlToBlob(local));
      else if(!local&&byName.has(name)){const r=await this.api(`files/${byName.get(name).id}?alt=media`,{},true);await VP.put(ph.id,await blobToDataURL(new Blob([await r.blob()],{type:'image/jpeg'})))}}
    // local cleanup of visit photos that were deleted elsewhere
    for(const c of contacts)for(const v of c.visits||[])for(const ph of v.photos||[])if(!want.has(`v-${ph.id}-${ph.h}.jpg`)&&!merged.some(m=>m.visits.some(x=>(x.photos||[]).some(p=>p.id===ph.id))))await VP.del(ph.id);
    // 6. upload data + clean old photos
    const payload={app:'名片管家',version:3,updated:new Date().toISOString(),contacts:merged,deleted:del};
    await this.upload(this.dataName,new Blob([JSON.stringify(payload)],{type:'application/json'}),df&&df.id);
    for(const f of files)if((f.name.startsWith('p-')||f.name.startsWith('v-'))&&!want.has(f.name))await this.api(`files/${f.id}`,{method:'DELETE'},true).catch(()=>{});
    await Meta.set('deleted',del);
    // 7. refresh UI
    contacts=merged.map(normalize);
    if(needsLink()&&localStorage.getItem('mpgj.coMigrated'))await linkAll();
    if(S.sel&&!contacts.some(c=>c.id===S.sel))S.sel=null;
    renderList();if(!$('#mEdit').classList.contains('on')&&!$('#mVisit').classList.contains('on'))renderDetail();
  }
};
function blobToDataURL(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=()=>rej(r.error);r.readAsDataURL(b)})}
function fmtTime(iso){if(!iso)return '';const d=new Date(iso);return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`}
function paintSync(busyText){
  if(!navigator.onLine){setSync('離線');}
  else if(!Sync.linked()){setSync('本機');}
  else if(busyText){setSync(busyText,'busy');}
  else if(!Sync.tokenOk()){setSync('點我同步','warn');}
  else{const st=Sync.st();setSync(st.err==='fail'?'同步失敗':st.last?'已同步 '+fmtTime(st.last):'已連結',st.err==='fail'?'err':'ok');}
  const box=$('#syncBox');if(!box)return;
  $('#syncSec').hidden=!Sync.enabled();
  if(!Sync.linked())box.innerHTML=`目前<b>還沒開啟同步</b>，資料只存在這台裝置。<div style="margin-top:8px"><button class="btn pri" id="syLink">用 Google 帳號開啟同步</button></div>`;
  else{const st=Sync.st();box.innerHTML=`已開啟同步<br>上次同步：<b>${st.last?fmtTime(st.last):'還沒同步過'}</b>${!Sync.tokenOk()?'<br><span style="color:var(--org)">登入已過期（Google 每小時會要求重新確認一次），按「立即同步」會自動重新確認。</span>':''}
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="syNow">立即同步</button><button class="btn danger" id="syOff">取消同步</button></div>`}
}
document.addEventListener('click',async e=>{
  if(e.target.closest('#syLink')){if(!navigator.onLine){toast('需要網路才能開啟同步');return}
    if(contacts.length)await infoBox('接下來會跳到 Google 登入頁面，登入後會自動回到名片管家。\n\n這台裝置上現有的名片會和雲端的合併，不會被刪除。',{ok:'繼續'});Sync.login(true);return}
  if(e.target.closest('#syNow')||e.target.closest('#syncBadge')){if(!Sync.linked()){if(Sync.enabled()&&e.target.closest('#syncBadge'))openSettings();return}Sync.run(true);return}
  if(e.target.closest('#syOff')){if(await confirmBox('取消同步後，這台裝置的資料會保留，但不會再和其他裝置同步。\n（雲端硬碟裡的資料不會被刪除）',{ok:'取消同步'})){Sync.unlink();toast('已取消同步')}}
});
