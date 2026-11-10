/* 名片管家：AI 設定、拍名片辨識、批次辨識 */
'use strict';
/* ---------- AI settings ---------- */
const PROVIDERS={
  claude:{name:'Claude',models:['claude-haiku-5-5','claude-sonnet-5-5','claude-opus-5-5'],keyUrl:'https://console.anthropic.com/settings/keys',keyHint:'sk-ant-'},
  openai:{name:'ChatGPT',models:['gpt-5.4-mini','gpt-5.4','gpt-5.4-nano'],keyUrl:'https://platform.openai.com/api-keys',keyHint:'sk-'},
  gemini:{name:'Gemini',models:['gemini-3.5-flash-lite','gemini-3.6-flash','gemini-3.8-flash'],keyUrl:'https://aistudio.google.com/apikey',keyHint:'AIza'}
};
const AI={
  get(){let v={};try{v=JSON.parse(localStorage.getItem('mpgj.ai')||'{}')}catch(_){}
    const provider=PROVIDERS[v.provider]?v.provider:'claude';const keys=v.keys||{};const models=v.models||{};
    return{provider,key:keys[provider]||'',model:models[provider]||PROVIDERS[provider].models[0],keys,models}},
  set(provider,key,model){const cur=this.get();cur.keys[provider]=key;cur.models[provider]=model||PROVIDERS[provider].models[0];
    try{localStorage.setItem('mpgj.ai',JSON.stringify({provider,keys:cur.keys,models:cur.models}))}catch(_){toast('這個瀏覽器無法儲存設定')}}
};
function blobToB64(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const u=String(r.result);res({mime:b.type||'image/jpeg',data:u.slice(u.indexOf(',')+1)})};r.onerror=()=>rej(r.error);r.readAsDataURL(b)})}
async function callAI(prompt,blobs,signal,cfg){
  try{return await callAIOnce(prompt,blobs,signal,cfg)}
  catch(e){if(e&&(e.code==='upstream_error')&&!(signal&&signal.aborted)){await new Promise(r=>setTimeout(r,1500));return await callAIOnce(prompt,blobs,signal,cfg)}throw e}
}
async function callAIOnce(prompt,blobs,signal,cfg){
  const s=cfg||AI.get();
  if(!s.key)throw{code:'no_key'};
  if(!navigator.onLine)throw{code:'offline'};
  const imgs=await Promise.all((blobs||[]).map(blobToB64));
  let res;
  try{
    if(s.provider==='claude'){
      res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal,headers:{'content-type':'application/json','x-api-key':s.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:s.model,max_tokens:2000,messages:[{role:'user',content:[...imgs.map(i=>({type:'image',source:{type:'base64',media_type:i.mime,data:i.data}})),{type:'text',text:prompt}]}]})});
    }else if(s.provider==='openai'){
      res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal,headers:{'content-type':'application/json','authorization':'Bearer '+s.key},
        body:JSON.stringify({model:s.model,response_format:{type:'json_object'},messages:[{role:'user',content:[{type:'text',text:prompt},...imgs.map(i=>({type:'image_url',image_url:{url:`data:${i.mime};base64,${i.data}`}}))]}]})});
    }else{
      res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent?key=${encodeURIComponent(s.key)}`,{method:'POST',signal,headers:{'content-type':'application/json'},
        body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},...imgs.map(i=>({inline_data:{mime_type:i.mime,data:i.data}}))]}],generationConfig:{responseMimeType:'application/json'}})});
    }
  }catch(e){if(e&&e.name==='AbortError')throw{code:'cancelled'};throw{code:navigator.onLine?'network':'offline'}}
  if(!res.ok){
    const t=await res.text().catch(()=>'');
    const code=res.status===401||res.status===403?'auth':res.status===429?'rate_limited':res.status===404?'bad_model':res.status>=500?'upstream_error':(/model/i.test(t)?'bad_model':'bad_request');
    let msg=t;try{const j=JSON.parse(t);msg=(j.error&&(j.error.message||j.error.status))||t}catch(_){}
    throw{code,status:res.status,message:String(msg).slice(0,300)};
  }
  const j=await res.json();
  let text='';
  if(s.provider==='claude')text=(j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
  else if(s.provider==='openai')text=(((j.choices||[])[0]||{}).message||{}).content||'';
  else text=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(p=>p.text||'').join('');
  if(!text)throw{code:'empty_completion'};
  return text;
}
function parseJSONText(t){
  t=String(t||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  try{return JSON.parse(t)}catch(_){}
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch(_){}}
  return null;
}
/* ---------- scan (Claude reads the card) ---------- */
const canScan=()=>!!AI.get().key;
let scanCtl=null;
function openScan(){
  slotState.scan={front:'',back:''};slotOrig.scan={front:null,back:null};paintSlots('scan');$('#scanStatus').hidden=true;
  $('#scanGo').hidden=!canScan();
  $('#scanTip').textContent=canScan()?'拍照小技巧：名片放在深色桌面、拍正一點、避開反光，字會辨識得更準。':'還沒設定 AI 金鑰，所以不能自動辨識。拍好照片後按「自己填」，或先到「設定」貼上金鑰。';
  openModal('#mScan');
}
const PROMPT=`你會看到一張台灣商務名片的照片（第一張是正面，如果有第二張是背面）。請讀出名片上的資料，只回覆一個 JSON 物件，不要其他文字。

欄位（沒有的填空字串 ""，不要猜）：
{"name":"中文姓名（沒有中文名就填英文名）","nameEn":"英文名","company":"公司全名（優先中文）","taxId":"統一編號（8 位數字，名片上常寫「統編」或「統一編號」；沒有就填空字串）","title":"職稱","dept":"部門","mobile":"手機（09 開頭）","phone":"公司電話，分機用 # 表示，例：04-2359-1234 #101","fax":"傳真","email":"","address":"主要地址（優先中文；有總公司就放總公司）","otherAddresses":[{"label":"這個地址在名片上的名稱，例如 工廠、二廠、台中廠","address":"其他地址"}],"website":"網址或 LINE ID","region":"從這個清單選一個：${REGIONS.join('、')}；看不出來填空字串","rotate":"第一張照片要「順時針」轉幾度，名片上的字才會是正的（不是倒的、不是側躺）：0、90、180 或 270","rotateBack":"第二張照片（背面）同上；沒有背面就填 0","uncertain":["看不清楚或不確定的欄位名稱，例如 \\"phone\\""]}

規則：
- 電話保留原本的分隔格式（例：0912-345-678）。若有多支電話，09 開頭的放 mobile，其他第一支放 phone。
- 名片上有中英文兩種公司名稱或地址時，用中文。
- 使用繁體中文，不要轉成簡體。
- 只抄名片上看得到的字，不要補資料。`;
const OCR_KEYS=['name','nameEn','company','taxId','title','dept','mobile','phone','fax','email','address','website','region'];
async function recognize(blobs,signal){
  const r=parseJSONText(await callAI(PROMPT,blobs,signal));
  if(!r||typeof r!=='object'||Array.isArray(r))throw {code:'invalid_json'};
  const pre={};for(const k of OCR_KEYS)pre[k]=typeof r[k]==='string'?r[k].trim():'';
  pre.addresses=(Array.isArray(r.otherAddresses)?r.otherAddresses:[]).map(a=>({label:String(a&&a.label||'').trim(),address:String(a&&a.address||'').trim()})).filter(a=>a.address&&a.address!==pre.address);
  if(pre.region&&!REGIONS.includes(pre.region))pre.region=findRegion(pre.region)||'';
  if(!pre.region)pre.region=findRegion(pre.address)||'';
  const unc=(Array.isArray(r.uncertain)?r.uncertain:[]).map(String);
  const rk=v=>{const n=Math.round(Number(v)/90);return Number.isFinite(n)?((n%4)+4)%4:0};
  pre.rot={front:rk(r.rotate),back:rk(r.rotateBack)};
  pre.taxId=pre.taxId.replace(/\D/g,'');
  if(pre.taxId&&!validTaxId(pre.taxId))unc.push('taxId');
  if(!pre.name&&pre.nameEn)pre.name=pre.nameEn;
  if(!pre.name)unc.push('name');
  return{pre,unc};
}
const scanErrMsg=code=>({no_key:'還沒設定 AI 金鑰，請先到「設定」貼上金鑰。',auth:'AI 金鑰錯誤或沒有權限，請到「設定」檢查。',offline:'目前沒有網路，辨識名片需要連網。',network:'連不上 AI 服務，請檢查網路後再試。',bad_model:'AI 找不到這個模型名稱，請到「設定」改回預設模型。',bad_request:'AI 不接受這次的請求，請換一張照片或到「設定」換模型。',invalid_json:'AI 回覆的格式看不懂，請再試一次。',empty_completion:'AI 沒有回覆內容，請再試一次。',
  rate_limited:'辨識太頻繁，或 AI 帳號的額度用完了，請稍後再試或到 AI 公司網站加值。',upstream_error:'AI 服務暫時有問題，請稍後再試。'}[code]||'辨識沒有成功，可以再試一次。');
async function runScan(){
  if(!slotState.scan.front)return;
  scanCtl=new AbortController();
  $('#scanStatus').hidden=false;$('#scanStatus').querySelector('.spin').hidden=false;$('#scanStatusTx').textContent='Claude 正在讀名片…（大約 10–40 秒）';$('#scanGo').disabled=true;$('#scanManual').disabled=true;
  const imgs=[slotState.scan.front,slotState.scan.back].filter(Boolean).map(dataUrlToBlob);
  try{
    const {pre,unc}=await recognize(imgs,scanCtl.signal);
    // AI 說名片是倒的或側躺：自動轉正
    for(const sd of ['front','back'])if(pre.rot[sd]&&slotState.scan[sd])await rotateSlot('scan',sd,pre.rot[sd]);delete pre.rot;
    closeModal($('#mScan'));
    openEdit(normalize({...pre,metAt:today().slice(0,7).replace('-','/')+' '}),{photos:{...slotState.scan},uncertain:unc,fromScan:true});
  }catch(e){
    const code=e&&e.code;
    if(code==='cancelled'){$('#scanStatus').hidden=true}
    else{
      const msg=scanErrMsg(code)+' 也可以按「自己填」。';
      $('#scanStatus').hidden=false;$('#scanStatusTx').textContent=''+msg;$('#scanStatus').querySelector('.spin').hidden=true;

    }
  }finally{
    scanCtl=null;$('#scanManual').disabled=false;$('#scanGo').disabled=!slotState.scan.front||!canScan();
    $('#scanStop').hidden=false;
  }
}

/* ---------- batch ---------- */
const B={rows:[],ctl:null,running:false};
const BCOLS=['name','nameEn','company','taxId','title','mobile','phone','email','address'];
const MAX_BATCH=40;
function batchDupe(pre,self){
  const dig=s=>(s||'').replace(/\D/g,'');
  const same=x=>(pre.email&&x.email&&x.email.toLowerCase()===pre.email.toLowerCase())||(dig(pre.mobile).length>=8&&dig(x.mobile)===dig(pre.mobile));
  const ex=contacts.find(same);if(ex)return{name:ex.name+(ex.company?'（'+ex.company+'）':'')};
  const idx=B.rows.indexOf(self);
  const inBatch=B.rows.slice(0,idx).find(r=>r.pre&&same(r.pre));
  return inBatch?{name:(inBatch.pre.name||'這批裡的另一張')+'（同一批）'}:null;
}
function openBatch(){
  if(!canScan()){infoBox('批次辨識需要 AI 金鑰，請先到「設定」貼上金鑰。');return}
  if(!$('#mBatch').classList.contains('on')){
    $('#bCat').innerHTML='<option value="">（不設定）</option>'+CATS.map(c=>`<option>${c}</option>`).join('');
    if(!B.rows.length)$('#bMet').value=today().slice(0,7).replace('-','/')+' ';
    openModal('#mBatch');
  }
  renderBatch();
}
async function addBatchFiles(files){
  const imgs=[...files].filter(f=>/^image\//.test(f.type)||/\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
  if(!imgs.length){toast('沒有可用的圖片檔');return}
  openBatch();if(!$('#mBatch').classList.contains('on'))return;
  const room=MAX_BATCH-B.rows.length;
  if(imgs.length>room)toast(`一次最多 ${MAX_BATCH} 張，先處理前 ${room} 張`,4000);
  for(const f of imgs.slice(0,Math.max(0,room))){
    const row={id:uid(),file:f,photo:'',state:'wait',err:'',pre:null,unc:[],on:true,dupe:null};
    B.rows.push(row);
    try{const r=await cardPhoto(f);row.photo=r.d;row.orig={d:r.orig,q:r.quad}}catch(_){row.state='err';row.err='無法讀取這張圖片';row.on=false}
  }
  renderBatch();runBatch();
}
function batchStatus(r){return {wait:'<span class="bst wait">等待中</span>',run:'<span class="bst run">辨識中…</span>',ok:'<span class="bst ok">完成</span>',err:`<span class="bst err" title="${esc(r.err)}">${esc(r.err||'失敗')}</span>`,saved:'<span class="bst ok">已儲存</span>'}[r.state]}
function renderBatch(){
  const body=$('#bBody');
  const ae=document.activeElement,keep=ae&&ae.dataset&&ae.dataset.bk&&body.contains(ae)?{r:ae.closest('tr').dataset.r,k:ae.dataset.bk,s:ae.selectionStart,e:ae.selectionEnd}:null;
  const sc=$('#mBatch .btable').scrollTop;
  body.innerHTML=B.rows.map((r,i)=>`<tr data-r="${r.id}" class="${r.on?'':'off'}">
    <td><input type="checkbox" data-bon ${r.on?'checked':''} ${r.state==='ok'?'':'disabled'}></td>
    <td>${r.photo?`<img class="bthumb" src="${r.photo}" data-zoom alt="">`:''}</td>
    <td>${batchStatus(r)}${r.dupe?`<span class="dupe">可能重複：${esc(r.dupe.name)}</span>`:''}${r.pre&&r.pre.addresses&&r.pre.addresses.length?`<span class="dupe" style="color:var(--sub)" title="${esc(r.pre.addresses.map(x=>(x.label?x.label+'：':'')+x.address).join('\n'))}">另有 ${r.pre.addresses.length} 個地址</span>`:''}<div style="display:flex;gap:4px;margin-top:4px">${r.state==='err'?`<button class="btn sm" data-bretry>重試</button>`:''}${r.state!=='run'?`<button class="btn sm danger" data-bdel title="從這批移除">移除</button>`:''}</div></td>
    ${BCOLS.map(k=>`<td><input type="text" data-bk="${k}" value="${esc(r.pre?r.pre[k]:'')}" class="${r.unc.includes(k)?'warn':''}" ${r.state==='ok'?'':'disabled'} style="width:${{name:80,nameEn:100,company:170,taxId:88,title:90,mobile:110,phone:130,email:170,address:200}[k]}px"></td>`).join('')}
  </tr>`).join('')||`<tr><td colspan="12" style="padding:40px;text-align:center;color:var(--sub)">把名片照片拖到這個視窗，或按「加入照片」一次選好幾張</td></tr>`;
  $('#mBatch .btable').scrollTop=sc;
  if(keep){const el=body.querySelector(`tr[data-r="${keep.r}"] [data-bk="${keep.k}"]`);if(el&&!el.disabled){el.focus();try{el.setSelectionRange(keep.s,keep.e)}catch(_){}}}
  updateBatchBar();
}
function updateBatchBar(){
  const n=B.rows.length,done=B.rows.filter(r=>r.state==='ok'||r.state==='err').length,ok=B.rows.filter(r=>r.state==='ok').length,sel=B.rows.filter(r=>r.on&&r.state==='ok').length;
  const waitS=B.pauseUntil?Math.ceil((B.pauseUntil-Date.now())/1000):0;
  $('#bProgTx').textContent=n?(B.running&&waitS>0?`AI 每分鐘的次數到上限了，${waitS} 秒後自動繼續…（${done} / ${n}）`:B.running?`辨識中… ${done} / ${n}`:`辨識完成 ${ok} 張${n-ok?`，${B.rows.filter(r=>r.state==='err').length} 張失敗`:''}`):'把名片照片拖進來，或按右邊的按鈕選照片';
  $('#bProgBar').style.width=n?(done/n*100)+'%':'0';
  $('#bStop').hidden=!B.running;
  $('#bSel').textContent=n?`已勾選 ${sel} 張`:'';
  $('#bSave').disabled=!sel||B.running;
  $('#bAll').checked=ok>0&&B.rows.filter(r=>r.state==='ok').every(r=>r.on);
}
async function runBatch(){
  if(B.running)return;B.running=true;B.ctl=new AbortController();updateBatchBar();
  const worker=async()=>{
    while(true){
      if(B.ctl.signal.aborted)return;
      while(B.pauseUntil&&Date.now()<B.pauseUntil){if(B.ctl.signal.aborted)return;updateBatchBar();await new Promise(r=>setTimeout(r,1000))}
      const r=B.rows.find(x=>x.state==='wait');if(!r)return;
      r.state='run';renderBatch();
      try{
        const {pre,unc}=await recognize([dataUrlToBlob(r.photo)],B.ctl.signal);
        if(pre.rot.front){r.photo=await rotatePhoto(r.photo,pre.rot.front);if(r.orig)r.orig.r=pre.rot.front}delete pre.rot;
        r.pre=pre;r.unc=unc;r.state='ok';r.dupe=batchDupe(pre,r);r.on=!r.dupe;
      }catch(e){
        const code=e&&e.code;
        if(code==='cancelled'){r.state='wait';return}
        const daily=/day|daily|每日|per.?day/i.test(String(e&&e.message||''));
        if(code==='rate_limited'&&!daily&&(r.tries||0)<4){r.tries=(r.tries||0)+1;r.state='wait';B.pauseUntil=Math.max(B.pauseUntil||0,Date.now()+30000);renderBatch();continue}
        if(code==='rate_limited'&&daily){r.state='err';r.err='今天的免費額度用完了';r.on=false;B.ctl.abort();B.rows.filter(x=>x.state==='wait').forEach(x=>{x.state='err';x.err='未辨識'});
          infoBox('今天的 AI 免費額度用完了。\n\n已辨識好的可以先儲存，其他的等額度重置後按「重試」。\n（Gemini 的每日額度在台灣時間下午 3～4 點重置）');renderBatch();continue}
        r.state='err';r.err=code==='rate_limited'?'額度或頻率限制':code==='offline'||code==='network'?'沒有網路':code==='auth'?'金鑰錯誤':'辨識失敗';r.on=false;
        if(['no_key','auth','offline','network','bad_model','rate_limited'].includes(code)){
          B.ctl.abort();B.rows.filter(x=>x.state==='wait').forEach(x=>{x.state='err';x.err='未辨識'});
          infoBox(scanErrMsg(code)+(code==='rate_limited'?'\n\n已辨識好的可以先儲存，其他的稍後按「重試」。':''));
        }
      }
      renderBatch();
    }
  };
  await Promise.all([worker(),worker()]); // two at a time
  B.running=false;B.ctl=null;B.pauseUntil=0;renderBatch();
}
async function saveBatch(){
  const list=B.rows.filter(r=>r.on&&r.state==='ok');if(!list.length)return;
  const cat=$('#bCat').value,met=$('#bMet').value.trim();
  const btn=$('#bSave');btn.disabled=true;let n=0,fail=0;
  for(const r of list){
    btn.textContent=`儲存中… ${++n}/${list.length}`;
    try{
      const c=normalize({...r.pre,category:cat,metAt:met});
      if(!c.name){r.state='err';r.err='沒有姓名';r.on=false;fail++;continue}
      c.taxId=(c.taxId||'').replace(/\D/g,'');
      await setPhoto(c,'front',r.photo);c.thumb=await makeThumb(r.photo);c.cropV=CROP_V;if(r.orig)await Store.putOrig(c.id,'front',r.orig);
      await save(c);r.state='saved';r.on=false;
    }catch(e){r.state='err';r.err=e&&e.code==='quota_exceeded'?'雲端空間已滿':'儲存失敗';r.on=false;fail++}
  }
  try{await linkAll()}catch(_){}
  btn.textContent='儲存勾選的名片';
  const saved=list.filter(r=>r.state==='saved').length;
  B.rows=B.rows.filter(r=>r.state!=='saved');
  refresh();
  if(!B.rows.length){closeModal($('#mBatch'))}else renderBatch();
  toast(`已儲存 ${saved} 張名片${fail?`，${fail} 張沒存成功`:''}`,3500);
}
