/* 名片管家：拍名片相機
   畫面上有一個名片形狀的框，把名片對準框框再按快門。因為知道名片「大概在框裡」，
   就算桌面顏色跟名片很像也找得到：先照平常的方法找，找到的位置跟框差太多（或沒找到），
   就從框的位置出發，用 refineQuad 把四條邊吸到真正的名片邊上；再不行就直接照框裁。
   電腦（沒有觸控螢幕）或相機打不開時，照舊用系統的拍照／選照片。 */
'use strict';
const Cam={stream:null,ctx:null,
  /* 手機、平板才用（電腦的視訊鏡頭拍名片不好用） */
  ok(){return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)&&matchMedia('(pointer:coarse)').matches},
  async open(ctx){this.ctx=ctx;$('#camErr').hidden=true;$('#camShot').disabled=true;openModal('#mCam');camLayout();
    try{this.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2160}}});
      if(!$('#mCam').classList.contains('on')){this.stop();return}   // 等權限的時候使用者已經按了取消
      const v=$('#camVideo');v.srcObject=this.stream;
      await new Promise(r=>{if(v.readyState>=1)r();else v.onloadedmetadata=()=>r()});await v.play().catch(()=>{});
      $('#camShot').disabled=false;camLayout()}
    catch(e){this.stop();camFail(e)}},
  stop(){if(this.stream){this.stream.getTracks().forEach(t=>t.stop());this.stream=null}const v=$('#camVideo');if(v)v.srcObject=null}
};
function camFail(e){const denied=e&&(e.name==='NotAllowedError'||e.name==='SecurityError');
  $('#camErrTx').textContent=denied?'沒有取得相機權限。請允許使用相機，或改用系統相機拍照。':'相機打不開，請改用系統相機拍照。';
  $('#camErr').hidden=false;$('#camShot').disabled=true}

/* 框框的位置：直拿手機時寬度佔 86%，橫拿時高度佔 62%，維持名片 9:5.4 的比例 */
function camLayout(){const wr=$('#camWrap'),f=$('#camFrame');const cw=wr.clientWidth,ch=wr.clientHeight;if(!cw||!ch)return;
  let fw=cw*.86,fh=fw/CARD_RATIO;if(fh>ch*.62){fh=ch*.62;fw=fh*CARD_RATIO}
  f.style.width=fw+'px';f.style.height=fh+'px';f.style.left=(cw-fw)/2+'px';f.style.top=Math.max(12,(ch-fh)/2-ch*.04)+'px'}
addEventListener('resize',()=>{if($('#mCam').classList.contains('on'))camLayout()});

/* 按快門：把現在的畫面存成照片，算出框框在照片上的位置，交給 putCardPhoto */
async function camShoot(){const v=$('#camVideo'),vw=v.videoWidth,vh=v.videoHeight;if(!vw||!vh||!Cam.ctx)return;
  const cv=document.createElement('canvas');cv.width=vw;cv.height=vh;cv.getContext('2d').drawImage(v,0,0,vw,vh);
  // 影片用 cover 填滿畫面（左右或上下會被切掉一點），要換算回影片本身的座標
  const wr=$('#camWrap').getBoundingClientRect(),fr=$('#camFrame').getBoundingClientRect();
  const s=Math.max(wr.width/vw,wr.height/vh),ox=(wr.width-vw*s)/2,oy=(wr.height-vh*s)/2;
  const X=x=>(x-wr.left-ox)/s,Y=y=>(y-wr.top-oy)/s;
  const guide=[[X(fr.left),Y(fr.top)],[X(fr.right),Y(fr.top)],[X(fr.right),Y(fr.bottom)],[X(fr.left),Y(fr.bottom)]];
  const url=cv.toDataURL('image/jpeg',.92);const ctx=Cam.ctx;
  const fl=$('#camFlash');fl.classList.remove('on');void fl.offsetWidth;fl.classList.add('on');
  closeModal($('#mCam'));
  try{await putCardPhoto(ctx.target,ctx.side,url,guide);if(ctx.target==='scan')$('#scanStatus').hidden=true}catch(err){toast(err.message)}}

$('#camShot').onclick=camShoot;
$('#camCancel').onclick=()=>closeModal($('#mCam'));
/* 相簿／系統相機：關掉這個相機，改開系統的選照片（iPhone 會問要拍照還是選照片） */
const camSystem=()=>{closeModal($('#mCam'));const inp=$('#photoInput');inp.value='';inp.click()};
$('#camAlbum').onclick=camSystem;$('#camErrBtn').onclick=camSystem;
/* 相機畫面關掉（取消、返回鍵、拍完）就把鏡頭關掉，不然手機會一直開著相機 */
new MutationObserver(()=>{if(!$('#mCam').classList.contains('on'))Cam.stop()}).observe($('#mCam'),{attributes:true,attributeFilter:['class']});
