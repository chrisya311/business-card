/* 名片管家：名片自動裁切＋轉正（在手機上直接算，不用網路、不花 AI 額度）
   做法像「用油漆桶把桌面塗掉」：從照片四邊開始，把跟桌面顏色接近、連在一起的地方標成背景，
   剩下最大的一塊就是名片；找出它的四個角，再把名片拉成正正方方的長方形。
   找不到（例如名片佔滿整張照片、或跟桌面顏色太像）就保留原本的照片，可以按「裁切」自己拖四個角。 */
'use strict';
const slotOrig={scan:{front:null,back:null},edit:{front:null,back:null}};   // 每個照片框的原始照片和四個角，給「裁切」微調用
const CARD_RATIO=90/54;   // 台灣名片 9 × 5.4 公分

function imgToCanvas(img,max){const s=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
  const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round((img.naturalWidth||img.width)*s));cv.height=Math.max(1,Math.round((img.naturalHeight||img.height)*s));
  cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);return cv}

/* ---------- 找名片的四個角（回傳原圖座標 [左上,右上,右下,左下]，找不到回傳 null） ---------- */
function detectCard(img){
  const cv=imgToCanvas(img,320),w=cv.width,h=cv.height,N=w*h;if(w<40||h<40)return null;
  const src=cv.getContext('2d').getImageData(0,0,w,h).data;
  // 1. 模糊一點，名片上的字和桌面的紋路比較不會干擾
  let R=new Float32Array(N),G=new Float32Array(N),B=new Float32Array(N);
  for(let i=0;i<N;i++){R[i]=src[i*4];G[i]=src[i*4+1];B[i]=src[i*4+2]}
  const blur=a=>{const t=new Float32Array(N),o=new Float32Array(N);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,n=0;for(let k=-2;k<=2;k++){const xx=x+k;if(xx>=0&&xx<w){s+=a[y*w+xx];n++}}t[y*w+x]=s/n}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,n=0;for(let k=-2;k<=2;k++){const yy=y+k;if(yy>=0&&yy<h){s+=t[yy*w+x];n++}}o[y*w+x]=s/n}return o};
  R=blur(R);G=blur(G);B=blur(B);
  // 2. 桌面的顏色：照片最外圈的中位數，順便看桌面花不花
  const ring=[];for(let x=0;x<w;x++){ring.push(x,(h-1)*w+x)}for(let y=1;y<h-1;y++){ring.push(y*w,y*w+w-1)}
  const med=a=>{const v=ring.map(i=>a[i]).sort((p,q)=>p-q);return v[v.length>>1]};
  const br=med(R),bg=med(G),bb=med(B);
  const dBg=i=>Math.hypot(R[i]-br,G[i]-bg,B[i]-bb);
  const ds=ring.map(dBg).sort((p,q)=>p-q);const spread=ds[Math.floor(ds.length*.8)];
  const TG=Math.max(30,Math.min(95,spread*2.2+18)),TL=22;
  // 3. 從四邊開始「塗油漆」：顏色跟桌面接近、而且跟旁邊沒有突然變色的，都算背景
  const bgM=new Uint8Array(N),st=[];
  for(const i of ring)if(!bgM[i]&&dBg(i)<TG){bgM[i]=1;st.push(i)}
  while(st.length){const i=st.pop(),x=i%w,y=(i-x)/w;
    const go=j=>{if(bgM[j])return;if(dBg(j)<TG&&Math.hypot(R[j]-R[i],G[j]-G[i],B[j]-B[i])<TL){bgM[j]=1;st.push(j)}};
    if(x>0)go(i-1);if(x<w-1)go(i+1);if(y>0)go(i-w);if(y<h-1)go(i+w)}
  // 4. 剩下的地方先縮一圈再放回來（去掉細細的雜點和連到名片的細線），留下最大的一塊
  const morph=(m,grow)=>{const o=new Uint8Array(N);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let v=m[i];
      if(grow){if(!v)v=(x>0&&m[i-1])||(x<w-1&&m[i+1])||(y>0&&m[i-w])||(y<h-1&&m[i+w])?1:0}
      else if(v)v=(x>0&&m[i-1])&&(x<w-1&&m[i+1])&&(y>0&&m[i-w])&&(y<h-1&&m[i+w])?1:0;o[i]=v}return o};
  let fg=new Uint8Array(N);for(let i=0;i<N;i++)fg[i]=bgM[i]?0:1;
  fg=morph(morph(morph(morph(fg,false),false),true),true);
  const lab=new Int32Array(N);let best=0,bestN=0,cur=0;
  for(let s=0;s<N;s++){if(!fg[s]||lab[s])continue;cur++;let n=0;const q=[s];lab[s]=cur;
    while(q.length){const i=q.pop();n++;const x=i%w;
      for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,i-w,i+w])if(j>=0&&j<N&&fg[j]&&!lab[j]){lab[j]=cur;q.push(j)}}
    if(n>bestN){bestN=n;best=cur}}
  if(bestN<N*.1||bestN>N*.97)return null;
  // 5. 這一塊的外框（凸包），再找面積最大的四邊形 = 名片的四個角
  const pts=[];for(let y=0;y<h;y++){let a=-1,b=-1;for(let x=0;x<w;x++)if(lab[y*w+x]===best){if(a<0)a=x;b=x}if(a>=0){pts.push([a,y]);if(b!==a)pts.push([b+1,y])}}
  let hull=convexHull(pts);if(hull.length<4)return null;
  for(let eps=1;hull.length>40;eps+=.5)hull=simplifyLoop(hull,eps);
  const quad=maxQuad(hull);if(!quad)return null;
  const qa=polyArea(quad);if(qa<N*.1||bestN/qa<.75)return null;   // 形狀不像長方形（例如連手一起）就不要亂切
  const k=(img.naturalWidth||img.width)/w;
  // 往內收一點點：模糊和陰影會讓邊界往外擴，寧可切掉名片最邊邊，也不要留一條桌面
  const cx=quad.reduce((s,p)=>s+p[0],0)/4,cy=quad.reduce((s,p)=>s+p[1],0)/4,f=.015;
  return orderQuad(quad.map(([x,y])=>[(x+(cx-x)*f)*k,(y+(cy-y)*f)*k]))}

function convexHull(p){p=[...p].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
  for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
  up.pop();lo.pop();return lo.concat(up)}
/* 把凸包上幾乎在同一直線的點拿掉，點少一點比較快 */
function simplifyLoop(p,eps){if(p.length<=8)return p;const out=[];const n=p.length;
  for(let i=0;i<n;i++){const a=out.length?out[out.length-1]:p[n-1],b=p[i],c=p[(i+1)%n];
    const d=Math.abs((c[0]-a[0])*(a[1]-b[1])-(a[0]-b[0])*(c[1]-a[1]))/(Math.hypot(c[0]-a[0],c[1]-a[1])||1);if(d>eps)out.push(b)}
  return out.length>=4?out:p}
const polyArea=q=>{let s=0;for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length];s+=a[0]*b[1]-b[0]*a[1]}return Math.abs(s)/2};
function maxQuad(p){const n=p.length;if(n<4)return null;let best=0,bq=null;const tri=(a,b,c)=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
  for(let i=0;i<n;i++)for(let k=i+2;k<n;k++){let m1=0,j1=-1;for(let j=i+1;j<k;j++){const t=tri(p[i],p[j],p[k]);if(t>m1){m1=t;j1=j}}
    let m2=0,l1=-1;for(let l=k+1;l<n+i;l++){const t=tri(p[i],p[k],p[l%n]);if(t>m2){m2=t;l1=l%n}}
    if(j1>=0&&l1>=0&&m1+m2>best){best=m1+m2;bq=[p[i],p[j1],p[k],p[l1]]}}
  return bq}
/* 排成 左上、右上、右下、左下（照著照片原本的方向） */
function orderQuad(q){const cx=q.reduce((s,p)=>s+p[0],0)/4,cy=q.reduce((s,p)=>s+p[1],0)/4;
  const s=[...q].sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));   // 順時針（y 往下）
  let st=0,m=Infinity;s.forEach((p,i)=>{const v=p[0]+p[1];if(v<m){m=v;st=i}});return [0,1,2,3].map(i=>s[(st+i)%4])}

/* ---------- 把四邊形拉成長方形（透視校正） ---------- */
function homography(from,to){// 解 8 個未知數：to = H·from
  const A=[],b=[];for(let i=0;i<4;i++){const [x,y]=from[i],[u,v]=to[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v)}
  for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];
    const d=A[c][c]||1e-12;for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/d;if(!f)continue;for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c]}}
  return b.map((v,i)=>v/(A[i][i]||1e-12))}
function warpCard(img,quad,maxOut=1400){
  const [tl,tr,br,bl]=quad,L=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  let W=Math.max(L(tl,tr),L(bl,br)),H=Math.max(L(tl,bl),L(tr,br));if(W<10||H<10)return null;
  // 比例接近標準名片就直接調成標準比例（拍歪造成的變形會一起修正）
  const r=W/H;if(r>=1&&Math.abs(r/CARD_RATIO-1)<.2)H=W/CARD_RATIO;else if(r<1&&Math.abs(r*CARD_RATIO-1)<.2)W=H/CARD_RATIO;
  const s=Math.min(1,maxOut/Math.max(W,H));W=Math.round(W*s);H=Math.round(H*s);
  const srcCv=imgToCanvas(img,2400),sk=srcCv.width/(img.naturalWidth||img.width),sw=srcCv.width,sh=srcCv.height;
  const S=srcCv.getContext('2d').getImageData(0,0,sw,sh).data;
  const h=homography([[0,0],[W,0],[W,H],[0,H]],quad.map(([x,y])=>[x*sk,y*sk]));
  const out=document.createElement('canvas');out.width=W;out.height=H;const g=out.getContext('2d');const od=g.createImageData(W,H),D=od.data;
  for(let y=0;y<H;y++){for(let x=0;x<W;x++){const u=x+.5,v=y+.5,z=h[6]*u+h[7]*v+1;let sx=(h[0]*u+h[1]*v+h[2])/z-.5,sy=(h[3]*u+h[4]*v+h[5])/z-.5;
      sx=sx<0?0:sx>sw-1?sw-1:sx;sy=sy<0?0:sy>sh-1?sh-1:sy;const x0=sx|0,y0=sy|0,x1=Math.min(x0+1,sw-1),y1=Math.min(y0+1,sh-1),fx=sx-x0,fy=sy-y0;
      const a=(y0*sw+x0)*4,b=(y0*sw+x1)*4,c=(y1*sw+x0)*4,d=(y1*sw+x1)*4,o=(y*W+x)*4;
      for(let k=0;k<3;k++)D[o+k]=(S[a+k]*(1-fx)+S[b+k]*fx)*(1-fy)+(S[c+k]*(1-fx)+S[d+k]*fx)*fy;D[o+3]=255}}
  g.putImageData(od,0,0);return out.toDataURL('image/jpeg',.92)}

/* 壓到 230KB 以下（雲端同步每筆的大小限制），跟原本存照片的規則一樣 */
async function compressPhoto(src){let q=.8,max=1400,d=await shrinkTo(src,max,q);
  while(d.length>230000&&(q>.45||max>700)){if(q>.5)q-=.1;else max-=200;d=await shrinkTo(src,max,q)}return d}

/* 選好一張名片照片：自動裁切轉正。回傳 {d:存起來的照片, orig:原始照片（給微調用）, quad:四個角或 null} */
async function cardPhoto(file){
  const url=typeof file==='string'?file:URL.createObjectURL(file);
  try{const img=await loadImg(url);const orig=imgToCanvas(img,1800).toDataURL('image/jpeg',.88);const oi=await loadImg(orig);
    let quad=null,d='';try{quad=detectCard(oi);if(quad){const w=warpCard(oi,quad);if(w)d=await compressPhoto(w);else quad=null}}catch(_){quad=null}
    if(!d)d=await compressPhoto(orig);
    return{d,orig,quad}}
  finally{if(typeof file!=='string')URL.revokeObjectURL(url)}}
/* 放進照片框，順便告訴使用者有沒有裁到 */
async function putCardPhoto(target,side,file){const r=await cardPhoto(file);slotState[target][side]=r.d;slotOrig[target][side]={src:r.orig,quad:r.quad};paintSlots(target);
  toast(r.quad?'已自動裁切、轉正名片，不滿意可以按「裁切」調整':'沒找到名片的邊，先保留整張照片，可以按「裁切」自己拉四個角',3200);return r}

/* ---------- 手動調整：拖四個角 ---------- */
const CR={target:null,side:null,img:null,quad:null,drag:-1};
async function openCrop(target,side){const o=slotOrig[target][side];const src=o&&o.src||slotState[target][side];if(!src)return;
  CR.target=target;CR.side=side;CR.img=await loadImg(src);const W=CR.img.naturalWidth,H=CR.img.naturalHeight;
  CR.quad=o&&o.quad?o.quad.map(p=>[...p]):fullQuad();
  if(!o)slotOrig[target][side]={src,quad:null};
  $('#cropImg').src=src;$('#cropSvg').setAttribute('viewBox',`0 0 ${W} ${H}`);paintCrop();openModal('#mCrop')}
const fullQuad=()=>{const W=CR.img.naturalWidth,H=CR.img.naturalHeight,m=Math.min(W,H)*.04;return [[m,m],[W-m,m],[W-m,H-m],[m,H-m]]};
function paintCrop(){const W=CR.img.naturalWidth,H=CR.img.naturalHeight,q=CR.quad;
  const pts=q.map(p=>p.join(',')).join(' L');
  $('#cropSvg').innerHTML=`<path d="M0,0 H${W} V${H} H0 Z M${pts} Z" fill="rgba(0,0,0,.5)" fill-rule="evenodd"/><path d="M${pts} Z" fill="none" stroke="#8FD3B0" stroke-width="${Math.max(W,H)/220}"/>`;
  $$('#cropBox .ch').forEach((el,i)=>{el.style.left=(q[i][0]/W*100)+'%';el.style.top=(q[i][1]/H*100)+'%'})}
(()=>{const box=$('#cropBox'),lp=$('#cropLoupe');
  const at=(e)=>{const r=$('#cropImg').getBoundingClientRect(),W=CR.img.naturalWidth,H=CR.img.naturalHeight;
    return[Math.max(0,Math.min(W,(e.clientX-r.left)/r.width*W)),Math.max(0,Math.min(H,(e.clientY-r.top)/r.height*H)),r]};
  const loupe=(x,y,r)=>{const W=CR.img.naturalWidth,H=CR.img.naturalHeight,Z=3,S=110;const px=x/W*r.width,py=y/H*r.height;
    lp.hidden=false;lp.style.backgroundImage=`url("${$('#cropImg').src}")`;lp.style.backgroundSize=`${r.width*Z}px ${r.height*Z}px`;
    lp.style.backgroundPosition=`${S/2-px*Z}px ${S/2-py*Z}px`;lp.style.left=px+'px';lp.style.top=(py-S*.95)+'px'};
  box.addEventListener('pointerdown',e=>{const h=e.target.closest('.ch');let i=h?+h.dataset.i:-1;
    if(i<0){// 點在照片上：抓最近的角
      const [x,y,r]=at(e);let m=Infinity;CR.quad.forEach((p,j)=>{const d=Math.hypot(p[0]-x,p[1]-y);if(d<m){m=d;i=j}});
      if(m/CR.img.naturalWidth*r.width>60)return}
    e.preventDefault();CR.drag=i;box.setPointerCapture(e.pointerId);const [x,y,r]=at(e);CR.quad[i]=[x,y];paintCrop();loupe(x,y,r)});
  box.addEventListener('pointermove',e=>{if(CR.drag<0)return;e.preventDefault();const [x,y,r]=at(e);CR.quad[CR.drag]=[x,y];paintCrop();loupe(x,y,r)});
  const end=()=>{CR.drag=-1;lp.hidden=true};box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
  box.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
})();
$('#cropFull').onclick=()=>{CR.quad=fullQuad();paintCrop()};
$('#cropAuto').onclick=()=>{const q=detectCard(CR.img);if(q){CR.quad=q;paintCrop();toast('找到名片了')}else toast('找不到名片的邊，請自己拖四個角')};
$('#cropOk').onclick=async()=>{const q=orderQuad(CR.quad);if(polyArea(q)<CR.img.naturalWidth*CR.img.naturalHeight*.02){toast('範圍太小了');return}
  const btn=$('#cropOk');btn.disabled=true;
  try{const w=warpCard(CR.img,q);if(!w){toast('範圍太小了');return}const d=await compressPhoto(w);
    slotState[CR.target][CR.side]=d;slotOrig[CR.target][CR.side].quad=q;paintSlots(CR.target);closeModal($('#mCrop'));
    if(CR.target==='scan')$('#scanStatus').hidden=true}
  catch(_){toast('裁切失敗，請再試一次')}finally{btn.disabled=false}};
