/* 名片管家：共用工具（常數、圖示、對話框、日期、資料庫、照片縮圖、統編檢查、版本紀錄） */
'use strict';
/* ---------- constants ---------- */
const CATS=['客戶','潛在客戶','經銷商','供應商','同業','私人'];
const STATUSES=['開發中','報價中','已成交','暫停'];
const PROCS=['車削','銑削','鑽孔','切槽／切斷','螺紋','搪孔','其他'];
const REGIONS=['基隆市','台北市','新北市','桃園市','新竹市','新竹縣','苗栗縣','台中市','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','台南市','高雄市','屏東縣','宜蘭縣','花蓮縣','台東縣','澎湖縣','金門縣','連江縣','海外'];
const VTYPES=['拜訪','試刀','電話','Email','LINE','展覽','視訊會議','其他'];
const MATERIALS=['S45C','S50C','SCM440','SCM415','SUJ2','SUS304','SUS316','SUS420','FC250','FC300','FCD450','FCD600','SKD11','SKD61','NAK80','AL6061','A7075','黃銅','銅','鈦合金 Ti-6Al-4V','Inconel 718'];
const COOLANTS=['水溶性','油性','乾切','MQL','高壓冷卻'];
const RESULTS=['成功','持平','失敗','待確認'];
const TRIAL_SHARED=['mat','proc','ref','refLife','surf'];
const RUN_KEYS=['tool','vc','f','ap','n','fm','cool','life','result','note'];
/* 試刀：共用資料＋好幾組條件（runs）；舊格式（只有一組）自動轉成第 1 組 */
function cleanTrial(t){if(!t||typeof t!=='object')return null;const o={};let any=false;
  for(const k of TRIAL_SHARED){o[k]=String(t[k]??'').trim();if(o[k])any=true}
  let runs=Array.isArray(t.runs)?t.runs:(['tool','vc','f','ap','cool','life','result'].some(k=>t[k])?[t]:[]);
  o.runs=runs.map(r=>{const x={};let has=false;for(const k of RUN_KEYS){x[k]=String((r&&r[k])??'').trim();if(x[k])has=true}x.best=!!(r&&r.best);return has?x:null}).filter(Boolean);
  if(o.runs.length)any=true;if(o.runs.filter(r=>r.best).length>1){let seen=false;o.runs.forEach(r=>{if(r.best){if(seen)r.best=false;seen=true}})}
  return any?o:null}
function trialResult(t){if(!t||!t.runs||!t.runs.length)return '';const b=t.runs.find(r=>r.best&&r.result);if(b)return b.result;if(t.runs.length===1)return t.runs[0].result||'';
  const rs=t.runs.map(r=>r.result).filter(Boolean);return rs.includes('成功')?'成功':rs[0]||''}
function runLine(r,i,many){const cond=[r.vc&&'Vc '+r.vc,r.f&&'f '+r.f,r.ap&&'ap '+r.ap,r.n&&'S '+r.n,r.fm&&'F '+r.fm,r.cool].filter(Boolean).join('　');
  return (r.best?'★ ':'')+(many?`第 ${i+1} 組　`:'')+[r.tool,cond,r.life&&'壽命 '+r.life,r.result,r.note].filter(Boolean).join(' · ')}
function trialLines(t){if(!t)return [];const L=[];
  const a=[t.mat,t.proc].filter(Boolean).join(' · ')+(t.ref?`（對照 ${t.ref}${t.refLife?`，壽命 ${t.refLife}`:''}）`:(t.refLife?`（對照壽命 ${t.refLife}）`:''));if(a)L.push(a);
  (t.runs||[]).forEach((r,i)=>L.push(runLine(r,i,t.runs.length>1)));
  if(t.surf)L.push(t.surf);return L}
const resultCls=r=>r?optCls('result',r):'';
const COMPOUND=['張簡','范姜','張廖','歐陽','司馬','諸葛','上官','東方','皇甫','慕容','令狐','周黃','江謝','陳黃','簡李','司徒','夏侯','尉遲','公孫'];
const ROLES=['決策者','採購','技術／工程','現場','其他'];
const CO_FIELDS=['company','taxId','phone','fax','address','region','website','brands','nextFollow','notes'];
const FIELDS=['name','nameEn','company','taxId','title','dept','mobile','phone','fax','email','address','region','website','brands','metAt','nextFollow','notes'];

/* ---------- utils ---------- */
/* ---------- line icons (森霧 Forest Mist：線條圖示，不用 emoji) ---------- */
const IC={
up:'<path d="M6 15l6-6 6 6"/>',
down:'<path d="M6 9l6 6 6-6"/>',
grip:'<path d="M5 8h14M5 12h14M5 16h14"/>',
lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
cam:'<path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5z"/><circle cx="12" cy="13" r="3.5"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
imp:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
exp:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
layers:'<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
back:'<path d="M15 18l-6-6 6-6"/>',
chev:'<path d="M9 18l6-6-6-6"/>',
edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
spark:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
x:'<path d="M18 6L6 18M6 6l12 12"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
mobile:'<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
fax:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M6 14h12v7H6z"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
pin:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
factory:'<path d="M2 20V9l6 4V9l6 4V5h4l1 15z"/><path d="M2 20h20"/>',
link:'<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
receipt:'<path d="M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2l-3 2-2-2-2 2-2-2-2 2z"/><path d="M9 9h6M9 13h6"/>',
building:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
map:'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
cog:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
tool:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>',
users:'<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
check:'<path d="M20 6L9 17l-5-5"/>',
card:'<rect x="2" y="5" width="20" height="14" rx="2.5"/><circle cx="8" cy="11" r="2"/><path d="M5 16a3 3 0 0 1 6 0M14 10h5M14 14h4"/>',
table:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
save:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
plug:'<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v4"/>',
book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
refresh:'<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
google:'<path d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.8h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3A9 9 0 0 0 21 12.2z"/><path d="M12 21a8.8 8.8 0 0 0 6.1-2.2l-3-2.3a5.5 5.5 0 0 1-8.2-2.9H3.8v2.4A9 9 0 0 0 12 21z"/><path d="M6.9 13.6a5.4 5.4 0 0 1 0-3.4V7.8H3.8a9 9 0 0 0 0 8.2z"/><path d="M12 6.6a4.9 4.9 0 0 1 3.5 1.4l2.6-2.6A8.8 8.8 0 0 0 3.8 7.8l3.1 2.4A5.4 5.4 0 0 1 12 6.6z"/>',
};
const ic=(n,s)=>`<svg class="i" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${s?` style="width:${s}px;height:${s}px"`:''}>${IC[n]||''}</svg>`;
const EMOJI_RE=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2139}\u{FE0F}\u{200D}]\s?/gu;
const noEmoji=s=>String(s??'').replace(EMOJI_RE,'');
function hydrateIcons(root=document){root.querySelectorAll('i[data-ic]').forEach(el=>{el.outerHTML=ic(el.dataset.ic)})}
/* 亮色／暗色 */
const Theme={get(){return document.documentElement.dataset.theme==='light'?'light':'dark'},
  set(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('mpgj.theme',t)}catch(_){}
    const m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='light'?'#EDF1EC':'#0D1210';
    const b=document.getElementById('bTheme');if(b){b.innerHTML=ic(t==='light'?'moon':'sun');b.setAttribute('aria-label',t==='light'?'切換成暗色':'切換成亮色');b.title=b.getAttribute('aria-label')}}};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>ymd(new Date());
const addDays=(s,n)=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+n);return ymd(d)};
const daysBetween=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5);
const fmtD=s=>s?s.replace(/-/g,'/'):'';
const stamp=()=>today().replace(/-/g,'');
const findRegion=a=>a?REGIONS.find(r=>a.includes(r)||a.includes(r.replace('台','臺'))):'';
function toast(msg,ms=2600){const t=$('#toast');t.textContent=noEmoji(msg);t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),ms)}

/* in-page dialogs (alert/confirm/prompt are blocked here) */
let dlgQ=Promise.resolve();
function dialog(msg,o){const p=dlgQ.then(()=>dialog1(msg,o));dlgQ=p.catch(()=>{});return p}
function dialog1(msg,{ok='確定',cancel='取消',danger=false,text=null}={}){
  return new Promise(res=>{
    const d=$('#dlg');$('#dlgMsg').textContent=noEmoji(msg);
    const ta=$('#dlgText');ta.hidden=text==null;if(text!=null){ta.value=text;setTimeout(()=>{ta.focus();ta.select()},50)}
    const y=$('#dlgYes'),n=$('#dlgNo');y.textContent=ok;y.classList.toggle('danger',danger);n.hidden=cancel==null;if(cancel)n.textContent=cancel;
    const done=v=>{d.classList.remove('on');y.onclick=n.onclick=d.onclick=null;res(v)};
    if(cancel==null)d.onclick=e=>{if(e.target===d)done(true)};
    y.onclick=()=>done(true);n.onclick=()=>done(false);d.classList.add('on');
  });
}
const confirmBox=(m,o)=>dialog(m,o);
const infoBox=(m,o={})=>dialog(m,{cancel:null,...o});

function setNotice(html,err){const n=$('#notice');if(!html){n.hidden=true;return}n.hidden=false;n.className='notice'+(err?' err':'');n.innerHTML=html}
function setSync(t,st){const b=$('#syncBadge');b.querySelector('.stx').textContent=noEmoji(t);b.querySelector('.dot').className='dot '+(st||'')}

const APP_VERSION='2026.11.09-8';
const CHANGELOG=[
  {v:'2026.11.09-8',items:['左右滑切換類別更順：下一個類別的清單會跟著一起滑進來，不再中間空白、卡一下']},
  {v:'2026.11.09-7',items:['首頁的類別按鈕改成「液態玻璃」效果：選中的類別下面墊一塊半透明玻璃，換類別時會滑過去','在清單上左右滑時，玻璃會跟著手指移動']},
  {v:'2026.11.09-6',items:['首頁可以左右滑切換類別：往左滑換到下一個，往右滑回上一個，上方的類別按鈕會跟著移動']},
  {v:'2026.11.09-5',items:['確認刪除的按鈕改成紅底白字，比較清楚']},
  {v:'2026.11.09-4',items:['修正：在編輯選項的畫面點選項時，會跳出 iPhone 的「檔案」App','選項可以長按拖曳調整順序（或按住右邊的 ≡ 直接拖）；點一下名字就能改名']},
  {v:'2026.11.09-3',items:['選項可以自訂：類別、狀態、加工類型、地區、拜訪類型、工件材質、冷卻方式、試刀結果，旁邊按「＋」就能新增、改名、刪除、調整順序','類別、狀態、試刀結果可以選顏色（灰、綠、藍、橘、紅、紫）','正在使用的選項改名或刪除時會先提醒；舊資料保留原本的名字（表單裡用虛線框顯示），不會被改掉','自訂的選項會跟著 Google 雲端硬碟同步，也會存進完整備份','「私人」類別和「試刀」類型有特別用途，不能改名或刪除']},
  {v:'2026.11.09-2',items:['右滑返回時，上方的按鈕列固定不動','修正：從公司點進聯絡人，再右滑返回時，會先閃到首頁才回到公司頁；現在會直接回到公司頁，也會回到原本捲動的位置']},
  {v:'2026.11.09-1',items:['程式整理：拆成幾個小檔案，之後比較好維護。功能和外觀都沒有改變']},
  {v:'2026.11.07-18',items:['Logo 去背，不再有白色底；深色 logo 在暗色模式會加一圈淡淡的白邊，才看得清楚','修正：用 Gemini 時找不到 logo（Gemini 回報位置的方式不一樣），之前沒找到的公司會再找一次']},
  {v:'2026.11.07-17',items:['公司 logo 改成直接從名片上剪下來：拍名片時一起找，已經存好的名片也會自動補（每家公司找一次）','不用再上網找網站圖示','剪得不好看可以到「編輯公司」按「不要這個 logo」','沒有 logo 的公司，漸層圖示再縮小一點']},
  {v:'2026.11.07-15',items:['修正：清單上找得到 logo 的公司，圖示是一片白的']},
  {v:'2026.11.07-14',items:['拿掉「在公司的角色」','可以把兩家公司合併：到「編輯公司」最下面按「合併到另一家公司」，舊名字會留在「其他名稱」，公司頁會顯示「也叫：…」','用其他名稱也搜尋得到；之後拍到舊名字的名片，也會自動加入同一家','公司 logo 縮小一點、圖示放大填滿；沒有 logo 的漸層不再放字']},
  {v:'2026.11.07-13',items:['修正：點進公司或名片有時候畫面是空白的','類別、狀態、角色選了之後，再點同一個就能取消','沒有 logo 的公司改用彩色漸層加公司第一個字']},
  {v:'2026.11.07-12',items:['改成以公司為主：清單一家公司一列，下面小字是這家公司的人（最多 2 位，其他顯示 +N）','拜訪紀錄和跟進日期記在公司，每筆紀錄可以選這次的窗口；私人分類照舊記在人身上','公司頁會依接觸次數排聯絡人（還沒有紀錄時依職稱）；換工作的人在舊公司顯示「已離職」，舊紀錄保留','自動找公司網站的 logo，找不到就留白','分享可以選要給哪些人、附幾筆紀錄、要不要附備註','Excel 匯出改成「公司」、「聯絡人」、「拜訪紀錄」三個工作表']},
  {v:'2026.11.07-11',items:['試刀可以記好幾組條件：按「新增一組條件」會帶入上一組的設定，只要改不同的地方','每組都有刀具、Vc、f、ap、S 轉速、F 進給、冷卻、壽命、結果、備註；按星號標出建議條件','Excel 匯出時每一組條件各佔一列，方便篩選比較；舊的試刀紀錄會自動變成第 1 組']},
  {v:'2026.11.07-10',items:['修正：打開別人分享的名片時，有時會看到舊版頁面，試刀內容沒有顯示']},
  {v:'2026.11.07-9',items:['拍名片、編輯、拜訪紀錄等全螢幕頁面，右滑返回也改成跟 iPhone 一樣的效果；從螢幕最左邊滑也能正常關閉']},
  {v:'2026.11.07-8',items:['新增／修改拜訪紀錄改成獨立的全螢幕頁面，內容框會跟著字數變大，適合寫長的試刀過程','點一下舊紀錄（或鉛筆圖示）就能修改','新增「試刀」類型，有材質、加工方式、刀具、切削條件、壽命、結果等欄位，Excel 也會一起匯出','寫到一半關掉會自動保留草稿，上方的「清除草稿」可以一次清掉']},
  {v:'2026.11.07-7',items:['「已更新」通知太長時可以上下滑動，「知道了」按鈕一定看得到；點旁邊空白處也能關閉','更新通知只顯示最近的內容，完整紀錄在「設定 → 更新紀錄」']},
  {v:'2026.11.07-6',items:['手機主畫面的 App 圖示換成森霧風格（要把舊圖示刪掉、重新加入主畫面才會換）']},
  {v:'2026.11.07-5',items:['右滑回上一頁改成跟 iPhone 一樣的效果：詳細頁跟著手指移動，名片清單從左邊滑出來；快速一撥也能返回']},
  {v:'2026.11.07-4',items:['手機上方區域變精簡（大約只佔畫面三分之一），名片清單看得更多','地區、加工、排序收進搜尋框旁邊的篩選按鈕，有用篩選時按鈕上會有小綠點','不再跳出提醒備份的訊息']},
  {v:'2026.11.07-3',items:['修正手機上名片很多、公司名稱很長時，畫面變太寬、右邊被切掉的問題']},
  {v:'2026.11.07-2',items:['拍名片、設定、編輯等全螢幕畫面，也可以往右滑回上一頁','拍名片畫面的「正面／背面」拍照按鈕移到下面，單手大拇指就按得到']},
  {v:'2026.11.07-1',items:['全新「森霧」風格：暗色毛玻璃卡片、背景極光、鼠尾草綠主色','右上角太陽／月亮按鈕可以切換亮色和暗色','所有圖示改成線條圖示，不再用 emoji','手機上「拍名片」移到右下角的大按鈕，單手好按','名片詳細頁改成四個大按鈕（編輯、分享、查公司、拜訪前查詢），拜訪紀錄日期更好讀','給同事看的唯讀分享頁和使用說明也換成新風格']},
  {v:'2026.11.06-4',items:['名片詳細頁新增「分享」：產生一個唯讀網址，用 LINE 傳給同事，對方不用安裝 App 也能看到名片資料、備註和拜訪紀錄（不含照片）','分享連結 1 天後自動失效，對方打開只會看到「連結已過期」']},
  {v:'2026.11.06-3',items:['開啟 Google 雲端同步：到「設定」最下面按「用 Google 帳號開啟同步」，手機和電腦的資料就會自動同步','每個人的資料存在自己的 Google 雲端硬碟，不會跟別人混在一起']},
  {v:'2026.11.06-2',items:['拜訪／聯絡紀錄可以加照片（例如試刀後的工件），一筆紀錄可以放好幾張','已經存好的紀錄也能按「加照片」補上，點照片可以放大','照片會跟著完整備份和雲端同步一起保存']},
  {v:'2026.11.06-1',items:['新增「手機和電腦同步」：用 Google 帳號連結後，名片、照片、拜訪紀錄會存到你自己的 Google 雲端硬碟，在每台裝置自動同步','兩台裝置都修改過同一張名片時，以最後修改的為準；拜訪紀錄會合併，不會互相蓋掉','上方的狀態標籤會顯示上次同步時間，點一下就能立即同步']},
  {v:'2026.11.04-5',items:['新增「更新紀錄」：在設定最下面點版本號就能查看','更新到新版本後，會自動告訴你這次改了什麼']},
  {v:'2026.11.04-4',items:['批次辨識碰到 AI「每分鐘次數上限」時，會自動等 30 秒再繼續，不用重按','當天免費額度用完時，會提醒你額度重置的時間']},
  {v:'2026.11.04-3',items:['設定最下面顯示版本號','有新版本時會自動更新，並跳出「已更新到新版本」']},
  {v:'2026.11.04-2',items:['預設改用輕量模型（Gemini 3.5 Flash-Lite、Claude Haiku），比較快也比較省','在名片頁面往右滑就能回到清單','AI 暫時出錯時會自動再試一次','測試連線失敗時，會顯示錯誤代碼和原因']},
  {v:'2026.11.04-1',items:['第一版：拍照辨識名片、批次拖拉辨識、拜訪紀錄、跟進提醒','多個地址、統一編號、匯出 Excel／Outlook、完整備份與匯入','可以離線使用，資料存在自己的裝置','支援 Claude、ChatGPT、Gemini，使用自己的 API 金鑰']}
];
function changelogHTML(list){return list.map(c=>`<div style="margin-bottom:14px"><div style="font-weight:700;color:var(--pri)">版本 ${c.v}${c.v===APP_VERSION?' <span class="badge" style="background:var(--grn-soft);color:var(--grn)">目前版本</span>':''}</div><ul style="margin:6px 0 0;padding-left:20px;line-height:1.7">${c.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}

/* ---------- local store (IndexedDB) ---------- */
let contacts=[];
const photoCache=new Map();
const LDB={db:null,
  open(){return new Promise(res=>{try{const r=indexedDB.open('mpgj',1);
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('contacts',{keyPath:'id'});d.createObjectStore('photos');d.createObjectStore('meta')};
    r.onsuccess=()=>{this.db=r.result;res(true)};r.onerror=()=>res(false)}catch(_){res(false)}})},
  req(store,mode,fn){return new Promise((res,rej)=>{if(!this.db){rej(new Error('無法存取本機資料庫'));return}const tx=this.db.transaction(store,mode);const r=fn(tx.objectStore(store));tx.oncomplete=()=>res(r&&r.result);tx.onerror=()=>rej(tx.error||new Error('儲存失敗'));tx.onabort=()=>rej(tx.error||new Error('儲存空間不足或被拒絕'))})},
  all(){return this.req('contacts','readonly',s=>s.getAll())},
  get(store,k){return this.req(store,'readonly',s=>s.get(k))},
  put(store,v,k){return this.req(store,'readwrite',s=>k===undefined?s.put(v):s.put(v,k))},
  del(store,k){return this.req(store,'readwrite',s=>s.delete(k))}
};
const Store={
  async put(c){await LDB.put('contacts',JSON.parse(JSON.stringify(c)))},
  async del(c){const t=(await Meta.get('deleted'))||{};t[c.id]=new Date().toISOString();await Meta.set('deleted',t);Sync.dirty();await LDB.del('contacts',c.id);for(const v of c.visits||[])for(const ph of v.photos||[])await VP.del(ph.id);for(const s of ['front','back']){await LDB.del('photos',c.id+':'+s).catch(()=>{});photoCache.delete(c.id+':'+s)}},
  async putPhoto(id,side,data){const k=id+':'+side;if(data)await LDB.put('photos',data,k);else await LDB.del('photos',k);photoCache.set(k,data||'')},
  async getPhoto(id,side){const k=id+':'+side;if(photoCache.has(k))return photoCache.get(k);try{const v=(await LDB.get('photos',k))||'';photoCache.set(k,v);return v}catch(_){return ''}}
};
const VP={key:id=>'vp:'+id,
  async put(id,d){await LDB.put('photos',d,this.key(id));photoCache.set(this.key(id),d)},
  async get(id){const k=this.key(id);if(photoCache.has(k))return photoCache.get(k);try{const v=(await LDB.get('photos',k))||'';photoCache.set(k,v);return v}catch(_){return ''}},
  async del(id){await LDB.del('photos',this.key(id)).catch(()=>{});photoCache.delete(this.key(id))}};
const Meta={get:k=>LDB.get('meta',k).catch(()=>null),set:(k,v)=>LDB.put('meta',v,k).catch(()=>{})};
function hashStr(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(16).padStart(8,'0')+'-'+str.length.toString(36)}
async function setPhoto(c,side,data){await Store.putPhoto(c.id,side,data||'');c['has'+(side==='front'?'Front':'Back')]=!!data;c.photoHash={...(c.photoHash||{}),[side]:data?hashStr(data):''}}

function parseAddrText(t){return String(t||'').split(/\n|；/).map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.match(/^([^：:]{1,12})[：:]\s*(.+)$/);return m?{label:m[1].trim(),address:m[2].trim()}:{label:'',address:l}})}
const addrText=c=>c.addresses.map(a=>(a.label?a.label+'：':'')+a.address).join('\n');
const mapLink=a=>`<a class="btn sm" style="margin-left:6px;vertical-align:middle" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}">${ic('map')}地圖</a>`;
function normalize(c){
  const o={id:c.id||uid(),name:'',nameEn:'',company:'',taxId:'',title:'',dept:'',mobile:'',phone:'',fax:'',email:'',address:'',region:'',website:'',
    kind:'',companyId:'',role:'',aka:[],logo:'',logoTone:'',logoOff:false,logoTry:'',category:'',status:'',addresses:[],processes:[],photoHash:{},deletedVisits:[],deletedPhotos:[],brands:'',metAt:'',notes:'',nextFollow:'',thumb:'',hasFront:false,hasBack:false,visits:[],created:'',updated:''};
  for(const k in o){if(c[k]!=null)o[k]=c[k]}
  if(typeof o.processes==='string')o.processes=o.processes.split(/[;；、,，]/).map(s=>s.trim()).filter(Boolean);
  if(!Array.isArray(o.processes))o.processes=[];
  if(typeof o.addresses==='string')o.addresses=parseAddrText(o.addresses);
  o.addresses=(Array.isArray(o.addresses)?o.addresses:[]).map(a=>({label:String(a&&a.label||'').trim(),address:String(a&&a.address||'').trim()})).filter(a=>a.address);
  if(!o.photoHash||typeof o.photoHash!=='object')o.photoHash={};
  if(!Array.isArray(o.deletedVisits))o.deletedVisits=[];
  o.visits=(Array.isArray(o.visits)?o.visits:[]).map(v=>({id:v.id||uid(),date:v.date||'',type:v.type||'拜訪',content:v.content||'',next:v.next||'',updated:v.updated||'',trial:cleanTrial(v.trial),who:Array.isArray(v.who)?v.who.filter(Boolean):[],whoN:Array.isArray(v.whoN)?v.whoN:[],other:v.other||'',photos:(Array.isArray(v.photos)?v.photos:[]).filter(x=>x&&x.id).map(x=>{const p={id:x.id,h:x.h||''};if(x.o)p.o=x.o;if(x.d)p.d=x.d;return p})}));
  if(!Array.isArray(o.deletedPhotos))o.deletedPhotos=[];
  if(!o.created)o.created=new Date().toISOString();
  if(!o.updated)o.updated=o.created;
  if(!o.region)o.region=findRegion(o.address)||'';
  return o;
}
async function save(c){c.updated=new Date().toISOString();await Store.put(c);const i=contacts.findIndex(x=>x.id===c.id);if(i>=0)contacts[i]=c;else contacts.push(c);Sync.dirty()}

/* ---------- images ---------- */
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('無法讀取這張圖片'));i.src=src})}
async function shrinkTo(src,max,q){const img=await loadImg(src);const s=Math.min(1,max/Math.max(img.width,img.height));const cv=document.createElement('canvas');cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);return cv.toDataURL('image/jpeg',q)}
async function fileToPhoto(file){
  const url=URL.createObjectURL(file);
  try{let q=.8,max=1400,d=await shrinkTo(url,max,q);
    while(d.length>230000&&(q>.45||max>700)){if(q>.5)q-=.1;else max-=200;d=await shrinkTo(url,max,q)} // stays under the 256 KiB per-document limit
    return d}finally{URL.revokeObjectURL(url)}
}
const makeThumb=d=>d?shrinkTo(d,180,.6):Promise.resolve('');
function dataUrlToBlob(d){const [h,b]=d.split(',');const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:h.match(/:(.*?);/)[1]})}

/* ---------- photo slot widgets ---------- */
let pickCtx=null; // {target:'scan'|'edit', side}
const slotState={scan:{front:'',back:''},edit:{front:'',back:''}};
function paintSlots(target){
  const root=target==='scan'?$('#scanSlots'):$('#editSlots');
  root.querySelectorAll('.pslot').forEach(s=>{const src=slotState[target][s.dataset.side];const pv=s.querySelector('.pv');
    pv.style.backgroundImage=src?`url('${src}')`:'';[...pv.children].forEach(ch=>ch.style.visibility=src?'hidden':'visible');pv.style.color=src?'transparent':'';
    s.querySelector('[data-clear]').style.visibility=src?'visible':'hidden'});
  if(target==='scan')$('#scanGo').disabled=!slotState.scan.front||!canScan();
}

/* ---------- 統一編號 checksum (財政部規則：加權和可被 5 整除；第 7 碼為 7 時另一算法) ---------- */
function validTaxId(id){
  if(!/^\d{8}$/.test(id))return false;
  const w=[1,2,1,2,1,2,4,1];let sum=0;
  for(let i=0;i<8;i++){const p=+id[i]*w[i];sum+=Math.floor(p/10)+(p%10)}
  return sum%5===0||(id[6]==='7'&&(sum+1)%5===0);
}

/* ---------- name split ---------- */
function splitName(n){
  n=(n||'').trim();if(!n)return['',''];
  if(!/[一-鿿]/.test(n)){const p=n.split(/\s+/);return p.length===1?[p[0],'']:[p.slice(0,-1).join(' '),p[p.length-1]]}
  const s=n.replace(/\s+/g,'');const cs=COMPOUND.find(x=>s.startsWith(x)&&s.length>x.length);
  if(cs)return[s.slice(cs.length),cs];return s.length<=1?[s,'']:[s.slice(1),s[0]];
}
