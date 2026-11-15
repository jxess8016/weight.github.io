(function(){
  var KP="wt_pin",KD="wt_data",SALT="wt-salt-v2",FN="weight-data.json";
  var $=function(i){return document.getElementById(i)};
  var records=[],editing=null,range=30,lastSaved=null,delArm=false;
  var WD=["일","월","화","수","목","금","토"];

  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
  function hash(s){var d=new TextEncoder().encode(SALT+s);
    if(window.crypto&&crypto.subtle)return crypto.subtle.digest("SHA-256",d).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,"0")}).join("")});
    var h=5381;for(var i=0;i<d.length;i++)h=((h<<5)+h+d[i])|0;return Promise.resolve("f"+h)}
  function toast(t){var e=$("toast");e.textContent=t;e.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.remove("on")},2200)}

  /* ---- Auto file storage (browser private file + local mirror) ---- */
  async function fileRead(){try{var d=await navigator.storage.getDirectory();var h=await d.getFileHandle(FN);return JSON.parse(await (await h.getFile()).text())}catch(e){return null}}
  async function fileWrite(o){try{var d=await navigator.storage.getDirectory();var h=await d.getFileHandle(FN,{create:true});var w=await h.createWritable();await w.write(JSON.stringify(o));await w.close()}catch(e){}}
  function norm(o){if(Array.isArray(o))return{updated:0,records:o};return o&&Array.isArray(o.records)?o:null}
  async function load(){
    var a=norm(await fileRead()),b=null;try{b=norm(JSON.parse(ls(KD)||"null"))}catch(e){}
    var pick=a&&b?((a.updated||0)>=(b.updated||0)?a:b):(a||b);
    records=pick?pick.records:[];sortR();
  }
  function persist(){var o={version:2,updated:Date.now(),records:records};ls(KD,JSON.stringify(o));fileWrite(o)}
  function sortR(){records.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0})}

  /* ---- Date helpers ---- */
  function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function md(s){var p=s.split("-");return +p[1]+"월 "+(+p[2])+"일"}
  function wd(s){return WD[new Date(s+"T00:00:00").getDay()]+"요일"}
  function f1(n){return (Math.round(n*10)/10).toFixed(1)}
  function sg(n){return (n>0?"+":n<0?"−":"")+f1(Math.abs(n))}

  /* ---- Passcode lock ---- */
  var buf="",mode=ls(KP)?"enter":"set",first="";
  function lockUI(){
    $("lt").textContent=mode==="enter"?"암호 입력":mode==="set"?"암호 만들기":"한 번 더 입력";
    $("ld").className="";$("ld").textContent=mode==="enter"?"":mode==="set"?"숫자 4자리를 정해주세요":"같은 암호를 다시 입력하세요";
  }
  function dots(){[].forEach.call($("dots").children,function(d,i){d.classList.toggle("on",i<buf.length)})}
  function fail(msg){$("ld").className="bad";$("ld").textContent=msg;$("dots").classList.add("shake");if(navigator.vibrate)navigator.vibrate(120);
    setTimeout(function(){$("dots").classList.remove("shake");buf="";dots()},450)}
  function submit(){
    if(mode==="enter"){hash(buf).then(function(h){h===ls(KP)?unlock():fail("암호가 틀렸어요")})}
    else if(mode==="set"){first=buf;buf="";mode="confirm";dots();lockUI()}
    else{if(buf===first){hash(buf).then(function(h){ls(KP,h);mode="enter";unlock()})}else{mode="set";fail("서로 달라요. 처음부터 다시");setTimeout(lockUI,1400)}}
  }
  function press(k){
    if(k==="del"){buf=buf.slice(0,-1);dots();return}
    if(buf.length>=4)return;buf+=k;dots();if(buf.length===4)setTimeout(submit,140);
  }
  var keys=["1","2","3","4","5","6","7","8","9","","0","del"];
  keys.forEach(function(k){var b=document.createElement("button");
    if(k==="")b.style.visibility="hidden";else{b.textContent=k==="del"?"⌫":k;if(k==="del")b.className="x";b.onclick=function(){press(k)}}
    $("pad").appendChild(b)});
  lockUI();

  function unlock(){
    buf="";dots();$("lock").classList.add("out");
    load().then(function(){
      $("app").classList.remove("hide");$("fab").classList.remove("hide");render(true);
      requestAnimationFrame(function(){$("app").classList.add("in")});
      setTimeout(function(){$("lock").classList.add("hide")},520);
    });
  }
  $("lockNow").onclick=function(){
    $("app").classList.remove("in");$("app").classList.add("hide");$("fab").classList.add("hide");
    $("lock").classList.remove("hide");requestAnimationFrame(function(){$("lock").classList.remove("out")});
    mode="enter";buf="";dots();lockUI();
  };

  /* ---- Render ---- */
  $("today").textContent=(function(){var d=new Date();return (d.getMonth()+1)+"월 "+d.getDate()+"일 "+WD[d.getDay()]+"요일"})();
  function count(el,to,from){var t0=performance.now(),D=800;(function s(t){var p=Math.min(1,(t-t0)/D),e=1-Math.pow(1-p,4);el.textContent=f1(from+(to-from)*e);if(p<1)requestAnimationFrame(s)})(t0)}
  var shown=null;
  function render(first){stats(first);chart();list()}
  function stats(first){
    var n=records.length;
    if(!n){$("cur").textContent="--";$("pill").className="pill";$("pill").textContent="아래 + 버튼으로 첫 기록을 남겨보세요";["sChange","sMin","sAvg"].forEach(function(i){$(i).textContent="-"});shown=null;return}
    var last=records[n-1].kg,prev=n>1?records[n-2].kg:null,ks=records.map(function(r){return r.kg});
    count($("cur"),last,shown===null?last-3:shown);shown=last;
    if(prev===null){$("pill").className="pill";$("pill").textContent="첫 기록이에요"}
    else{var d=last-prev;$("pill").className="pill "+(d<0?"dn":d>0?"upx":"");$("pill").textContent=(d===0?"변화 없음":"이전 기록보다 "+sg(d)+"kg")}
    $("sChange").textContent=sg(last-records[0].kg)+"kg";
    $("sMin").textContent=f1(Math.min.apply(null,ks))+"kg";
    $("sAvg").textContent=f1(ks.reduce(function(a,b){return a+b},0)/n)+"kg";
  }

  /* chart */
  function chart(){
    var data=records;
    if(range>0){var c=new Date();c.setDate(c.getDate()-range);var cs=iso(c);data=records.filter(function(r){return r.date>=cs})}
    $("scrub").textContent="";
    if(data.length<2){$("chart").innerHTML='<div class="empty">'+(data.length?"기록이 2개 이상이면 그래프가 그려져요":"아직 기록이 없어요")+"</div>";return}
    var W=340,H=190,pl=6,pr=6,pt=16,pb=22;
    var ks=data.map(function(r){return r.kg}),mn=Math.min.apply(null,ks),mx=Math.max.apply(null,ks),pad=Math.max(.4,(mx-mn)*.25);mn-=pad;mx+=pad;
    var t0=new Date(data[0].date).getTime(),t1=new Date(data[data.length-1].date).getTime();
    var X=function(d){return pl+(new Date(d).getTime()-t0)/((t1-t0)||1)*(W-pl-pr)},Y=function(v){return pt+(mx-v)/(mx-mn)*(H-pt-pb)};
    var P=data.map(function(r){return[X(r.date),Y(r.kg)]});
    var p="M"+P[0][0].toFixed(1)+","+P[0][1].toFixed(1);
    for(var i=1;i<P.length;i++){var cx=(P[i-1][0]+P[i][0])/2;p+=" C"+cx.toFixed(1)+","+P[i-1][1].toFixed(1)+" "+cx.toFixed(1)+","+P[i][1].toFixed(1)+" "+P[i][0].toFixed(1)+","+P[i][1].toFixed(1)}
    var L=P[P.length-1],s='<svg viewBox="0 0 '+W+" "+H+'" id="sv"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--blue);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--blue);stop-opacity:0"/></linearGradient></defs>';
    for(var k=0;k<3;k++){var y=pt+k*(H-pt-pb)/2;s+='<line x1="0" x2="'+W+'" y1="'+y+'" y2="'+y+'" style="stroke:var(--line)"/>'}
    s+='<path class="fadein" d="'+p+" L"+L[0]+","+(H-pb)+" L"+P[0][0]+","+(H-pb)+' Z" fill="url(#g)"/>';
    s+='<path class="draw" pathLength="1" d="'+p+'" fill="none" style="stroke:var(--blue)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>';
    s+='<g class="fadein"><circle class="pulse" cx="'+L[0]+'" cy="'+L[1]+'" r="6" style="fill:var(--blue)"/><circle cx="'+L[0]+'" cy="'+L[1]+'" r="6" style="fill:var(--blue);stroke:var(--card)" stroke-width="3"/></g>';
    s+='<line id="vl" y1="'+pt+'" y2="'+(H-pb)+'" style="stroke:var(--sub)" opacity="0" stroke-dasharray="3 3"/><circle id="sd" r="6" style="fill:var(--blue);stroke:var(--card)" stroke-width="3" opacity="0"/>';
    s+='<text x="'+pl+'" y="'+(H-4)+'" font-size="11" font-weight="600" style="fill:var(--sub)">'+md(data[0].date)+'</text><text x="'+(W-pr)+'" y="'+(H-4)+'" text-anchor="end" font-size="11" font-weight="600" style="fill:var(--sub)">'+md(data[data.length-1].date)+"</text></svg>";
    $("chart").innerHTML=s;
    var sv=$("sv");
    function mv(e){var r=sv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,bi=0;
      P.forEach(function(q,i){if(Math.abs(q[0]-x)<Math.abs(P[bi][0]-x))bi=i});
      $("vl").setAttribute("x1",P[bi][0]);$("vl").setAttribute("x2",P[bi][0]);$("vl").setAttribute("opacity",.6);
      $("sd").setAttribute("cx",P[bi][0]);$("sd").setAttribute("cy",P[bi][1]);$("sd").setAttribute("opacity",1);
      $("scrub").style.color="var(--ink)";$("scrub").textContent=md(data[bi].date)+"  ·  "+f1(data[bi].kg)+"kg"}
    function lv(){$("vl").setAttribute("opacity",0);$("sd").setAttribute("opacity",0);$("scrub").textContent="";$("scrub").style.color=""}
    sv.addEventListener("pointermove",mv);sv.addEventListener("pointerdown",mv);sv.addEventListener("pointerleave",lv);sv.addEventListener("pointerup",lv);
  }
  $("seg").onclick=function(e){var b=e.target.closest("button");if(!b)return;range=+b.dataset.r;seg();chart()};
  function seg(){var i=range===7?0:range===30?1:2;$("seg").firstChild.style.transform="translateX("+(i*100)+"%)";}
  seg();

  /* list */
  function list(){
    if(!records.length){$("list").innerHTML='<div class="empty">기록이 여기에 쌓여요</div>';return}
    var h="";
    for(var i=records.length-1;i>=0;i--){
      var r=records[i],p=records[i-1],dl="";
      if(p){var d=r.kg-p.kg;dl='<small class="'+(d<0?"dn":d>0?"upx":"")+'">'+(d===0?"–":sg(d))+"</small>"}
      h+='<button class="row'+(r.date===lastSaved?" new":"")+'" data-d="'+r.date+'"><span class="a">'+md(r.date)+"<small>"+wd(r.date)+'</small></span><span class="b">'+f1(r.kg)+" kg"+dl+"</span></button>";
    }
    $("list").innerHTML=h;
  }
  $("list").onclick=function(e){var b=e.target.closest(".row");if(b&&b.dataset.d)openSheet(b.dataset.d)};

  /* ---- Sheet ---- */
  function setKg(v){$("skg").value=f1(v)}
  function openSheet(date){
    editing=date||null;delArm=false;$("serr").textContent="";$("sdel").textContent="삭제";
    var r=date?records.filter(function(x){return x.date===date})[0]:null;
    $("stitle").textContent=r?"기록 수정":"기록 추가";
    $("sdate").value=r?r.date:iso(new Date());
    setKg(r?r.kg:(records.length?records[records.length-1].kg:60));
    $("sdel").classList.toggle("hide",!r);
    $("sbg").classList.add("open");
  }
  function closeSheet(){$("sbg").classList.remove("open")}
  $("fab").onclick=function(){openSheet()};
  $("sbg").onclick=function(e){if(e.target===$("sbg"))closeSheet()};
  $("mi").onclick=function(){setKg((parseFloat($("skg").value)||60)-.1)};
  $("pl").onclick=function(){setKg((parseFloat($("skg").value)||60)+.1)};
  $("ssave").onclick=function(){
    var d=$("sdate").value,w=parseFloat($("skg").value);
    if(!d){$("serr").textContent="날짜를 선택하세요";return}
    if(!(w>=20&&w<=300)){$("serr").textContent="몸무게를 20~300kg 사이로 입력하세요";return}
    if(editing!==null)records=records.filter(function(r){return r.date!==editing});
    var ex=records.filter(function(r){return r.date===d})[0];
    if(ex)ex.kg=w;else records.push({date:d,kg:w});
    sortR();persist();lastSaved=d;closeSheet();render();toast("저장했어요");
  };
  $("sdel").onclick=function(){
    if(!delArm){delArm=true;$("sdel").textContent="한 번 더 누르면 삭제돼요";return}
    records=records.filter(function(r){return r.date!==editing});persist();closeSheet();render();toast("삭제했어요");
  };

  /* ---- Manual backup (optional) ---- */
  $("exp").onclick=function(){
    var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({version:2,updated:Date.now(),records:records},null,2)],{type:"application/json"}));
    a.download="weight-"+iso(new Date())+".json";document.body.appendChild(a);a.click();a.remove();toast("파일로 내보냈어요");
  };
  $("imp").onclick=function(){$("file").click()};
  $("file").onchange=function(){
    var f=this.files[0];if(!f)return;var rd=new FileReader();
    rd.onload=function(){try{var o=norm(JSON.parse(rd.result)),n=0;
      o.records.forEach(function(r){if(/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.kg>=20&&r.kg<=300){records=records.filter(function(x){return x.date!==r.date});records.push({date:r.date,kg:+r.kg});n++}});
      sortR();persist();render();toast(n+"개 기록을 불러왔어요")}catch(e){toast("읽을 수 없는 파일이에요")}};
    rd.readAsText(f);this.value="";
  };
})();
