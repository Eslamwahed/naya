  /* ---------- المزامنة بين الأجهزة ---------- */
  var sync = { url:"", key:"", on:false, lastSeen:null, timer:null,
               state:"واقفة", pushed:{}, busy:false, err:"", pushTimer:null };

  // بصمة قصيرة للسجل — بنخزّنها بدل الـJSON كامل عشان تدخل localStorage
  function fp(str){
    var h = 0x811c9dc5;
    for(var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(36);
  }

  // بصمات آخر رفعة. من غير تخزينها كان السيستم بيرفع كل الداتا من الأول
  // مع كل فتحة للصفحة، وده بيساوي updated_at لكل الصفوف وبيربك المزامنة.
  function loadPushed(){
    if(!LS) return;
    try{
      var o = JSON.parse(LS.getItem("naya:pushed")||"null");
      // البصمات مربوطة بمشروع معيّن — لو الرابط اتغيّر تبقى ملهاش لازمة
      sync.pushed = (o && o.u === sync.url && o.m) ? o.m : {};
    }catch(e){ sync.pushed = {}; }
  }
  function savePushed(){
    if(!LS) return;
    try{ LS.setItem("naya:pushed", JSON.stringify({ u:sync.url, m:sync.pushed })); }
    catch(e){}                       // امتلت؟ مش مشكلة، أسوأ حاجة رفعة زيادة
  }
  function clearPushed(){
    sync.pushed = {};
    if(LS){ try{ LS.removeItem("naya:pushed"); }catch(e){} }
  }

  function loadSyncCfg(){
    if(!LS) return;
    try{
      var c = JSON.parse(LS.getItem("naya:sync")||"null");
      if(c){ sync.url=c.url||""; sync.key=c.key||""; sync.on=!!c.on; sync.lastSeen=c.lastSeen||null; }
    }catch(e){}
    loadPushed();
  }
  function saveSyncCfg(){
    if(!LS) return;
    try{ LS.setItem("naya:sync", JSON.stringify({url:sync.url,key:sync.key,on:sync.on,lastSeen:sync.lastSeen})); }catch(e){}
  }
  // بيقبل الرابط الكامل أو اسم المشروع بس ويكمّله لوحده
  function normalizeSyncUrl(v){
    var u = String(v||"").trim().replace(/\/+$/,"");
    if(!u) return "";
    if(/^https?:\/\//i.test(u)) return u.replace(/^http:\/\//i,"https://");
    if(u.indexOf(".") > -1) return "https://" + u;
    return "https://" + u + ".supabase.co";   // اسم المشروع بس
  }
  function syncURL(q){ return sync.url + "/rest/v1/naya_records" + (q||""); }
  function syncHeaders(extra){
    var h = { "apikey": sync.key, "Authorization": "Bearer " + sync.key, "Content-Type": "application/json" };
    if(extra) Object.keys(extra).forEach(function(k){ h[k]=extra[k]; });
    return h;
  }

  function rowsToPush(){
    var out = [];
    LISTS.forEach(function(list){
      db[list].forEach(function(r){
        if(!r || !r.id) return;
        var h = fp(JSON.stringify(r));
        if(sync.pushed[r.id] !== h) out.push({ id:r.id, list:list, payload:r, _h:h });
      });
    });
    var sh = fp(JSON.stringify(settings));
    if(sync.pushed["__settings"] !== sh)
      out.push({ id:"__settings", list:"settings", payload:settings, _h:sh });
    return out;
  }

  async function syncPush(){
    if(!sync.on || sync.busy) return;
    var rows = rowsToPush();
    if(!rows.length) return;
    sync.busy = true;
    try{
      var body = rows.map(function(r){ return { id:r.id, list:r.list, payload:r.payload }; });
      var res = await withTimeout(fetch(syncURL(), {
        method:"POST",
        headers: syncHeaders({ "Prefer":"resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(body)
      }), 15000);
      if(!res.ok) throw new Error("HTTP " + res.status);
      rows.forEach(function(r){ sync.pushed[r.id] = r._h; });
      savePushed();
      sync.state = "متزامنة"; sync.err = "";
      lastSaved = Date.now();
    }catch(e){
      sync.state = "مشكلة في الاتصال"; sync.err = String(e.message||e);
    }
    sync.busy = false;
    renderStorageState();
  }

  async function syncPull(){
    if(!sync.on) return false;
    try{
      var q = "?select=id,list,payload,updated_at&order=updated_at.asc";
      if(sync.lastSeen) q += "&updated_at=gt." + encodeURIComponent(sync.lastSeen);
      var res = await withTimeout(fetch(syncURL(q), { headers: syncHeaders() }), 15000);
      if(!res.ok) throw new Error("HTTP " + res.status);
      var rows = await res.json();
      sync.state = "متزامنة"; sync.err = "";
      if(!rows.length){ renderStorageState(); return false; }
      var changed = false;
      rows.forEach(function(row){
        sync.lastSeen = row.updated_at;
        sync.pushed[row.id] = fp(JSON.stringify(row.payload));
        if(row.list === "settings"){
          if(row.payload && row.payload.currency){ settings = row.payload; changed = true; }
          return;
        }
        if(LISTS.indexOf(row.list) < 0) return;
        var mine = db[row.list].find(function(x){ return x.id === row.id; });
        if(!mine || (Number(row.payload.at)||0) >= (Number(mine.at)||0)){
          db[row.list] = mergeById(db[row.list], [row.payload]);
          changed = true;
        }
      });
      saveSyncCfg(); savePushed();
      /* المزامنة بتدمج هنا مباشرة مش عن طريق absorb — فلازم التحذير
         يتنادى من هنا كمان، وإلا مش هيشتغل في أهم حالة أصلاً */
      if(changed){ writeLocal(); writeFileSoon(); warnIfOpenChanged(); renderAll(); }
      renderStorageState();
      return changed;
    }catch(e){
      sync.state = "مشكلة في الاتصال";
      sync.err = /fetch/i.test(String(e.message||e))
        ? "الرابط غلط أو مفيش نت — اتأكد إنه بالشكل https://xxxx.supabase.co"
        : String(e.message||e);
      renderStorageState();
      return false;
    }
  }

  async function syncTick(){ await syncPull(); await syncPush(); }

  function startSync(silent){
    if(!sync.url || !sync.key){ if(!silent) toast("اكتب رابط المشروع والمفتاح"); return; }
    sync.on = true; sync.state = "بتشتغل…"; saveSyncCfg();
    clearInterval(sync.timer);
    sync.timer = setInterval(syncTick, 4000);
    syncTick();
    renderStorageState();
  }
  // بتلغي علامة «آخر حاجة شفتها» فالسحب الجاي بيجيب كل حاجة من الأول.
  // ده المخرج لما العلامة تتقدّم من غير ما البيانات توصل للجهاز ده.
  async function pullEverything(){
    if(!sync.on){ toast("شغّل المزامنة الأول"); return; }
    sync.lastSeen = null;
    clearPushed();
    saveSyncCfg();
    toast("بيسحب كل البيانات…");
    var got = await syncPull();
    renderAll();
    var n = LISTS.reduce(function(a,x){ return a + live(x).length; }, 0);
    toast(n ? ("اتسحب — السيستم فيه " + qty(n) + " سجل") : "السيرفر فاضي فعلاً");
  }

  function stopSync(){
    sync.on = false; clearInterval(sync.timer); sync.timer = null;
    sync.state = "واقفة"; saveSyncCfg(); renderStorageState();
  }

  // ---------- ربط ملف على الجهاز ----------
  function fsSupported(){ return typeof window.showSaveFilePicker === "function"; }

  async function linkNewFile(){
    try{
      fileHandle = await window.showSaveFilePicker({
        suggestedName: "lora-data.json",
        types: [{ description: "بيانات Lora Collection", accept: { "application/json": [".json"] } }]
      });
      writeFileSoon(); toast("الملف اتربط — الحفظ هيبقى تلقائي");
    }catch(e){ if(e && e.name !== "AbortError") toast("متعذّر ربط الملف"); }
    renderStorageState();
  }

  async function linkExistingFile(){
    try{
      var picked = await window.showOpenFilePicker({
        types: [{ description: "بيانات Lora Collection", accept: { "application/json": [".json"] } }]
      });
      fileHandle = picked[0];
      var f = await fileHandle.getFile();
      absorb(JSON.parse(await f.text()));
      renderAll(); saveAll(); toast("البيانات اتحمّلت من الملف");
    }catch(e){ if(e && e.name !== "AbortError") toast("متعذّر فتح الملف"); }
    renderStorageState();
  }

  function unlinkFile(){ fileHandle = null; sinks.file = false; renderStorageState(); toast("اتفك ارتباط الملف"); }

  // ---------- بيان حالة التخزين ----------
  function renderStorageState(){
    var where = [];
    if(sinks.local) where.push("ذاكرة المتصفح");
    if(sinks.cloud) where.push("تخزين المحادثة");
    if(fileHandle) where.push("ملف: " + fileHandle.name);
    var safe = where.length > 0;

    var bar = document.getElementById("offline");
    bar.hidden = safe;

    var line = document.getElementById("storage-state");
    if(line){
      line.textContent = safe
        ? "البيانات بتتحفظ تلقائي في: " + where.join(" + ") +
          (lastSaved ? " · آخر حفظ " + new Date(lastSaved).toLocaleTimeString("en-GB",{hour12:false}) : "")
        : "مفيش تخزين متاح — الشغل في الذاكرة بس. نزّل نسخة قبل ما تقفل.";
      line.className = safe ? "note ok" : "note bad";
    }
    var ub = document.getElementById("b-unlink");
    if(ub) ub.hidden = !fileHandle;
    var pill = document.getElementById("save-pill");
    if(pill){
      if(sync.on){
        var okSync = sync.state === "متزامنة";
        pill.textContent = okSync ? "متزامن" : sync.state;
        pill.className = "savep" + (okSync ? "" : " warn");
      } else {
        pill.textContent = safe ? "محفوظ" : "غير محفوظ";
        pill.className = "savep" + (safe ? "" : " bad");
      }
    }

    var sl = document.getElementById("sync-state");
    if(sl){
      if(sync.on){
        var n = LISTS.reduce(function(a,x){ return a + live(x).length; }, 0);
        // «متزامنة» لوحدها كانت بتخفي إن السيستم فاضي: السحب بيجيب اللي
        // اتغيّر بعد آخر مرة بس، فلو العلامة اتقدّمت غلط مابيرجعش حاجة
        // وبيقول متزامنة وهو مش شايف داتا. العدد بيكشف ده على طول.
        if(sync.state === "متزامنة" && n === 0){
          sl.innerHTML = "المزامنة شغالة بس <strong>السيستم فاضي</strong> — " +
            "لو المفروض فيه بيانات على السيرفر، اضغط <strong>«اسحب كل البيانات»</strong>.";
          sl.className = "note bad";
        } else {
          sl.textContent = "المزامنة شغالة · " + sync.state +
            " · " + qty(n) + " سجل" +
            (sync.err ? " (" + sync.err + ")" : "") +
            (lastSaved ? " · آخر تحديث " + new Date(lastSaved).toLocaleTimeString("en-GB",{hour12:false}) : "");
          sl.className = (sync.state === "متزامنة") ? "note ok" : "note bad";
        }
      } else {
        sl.textContent = "المزامنة واقفة — كل جهاز شغال لوحده.";
        sl.className = "note";
      }
    }
    var on = document.getElementById("b-sync-on"), off = document.getElementById("b-sync-off");
    if(on && off){
      // المفتاح بيتقرا من الخانة وقت الضغط بس. لو المستخدم لصق مفتاح جديد
      // والمزامنة شغالة، الزرار كان مخفي فمكانش فيه طريقة يطبّقه.
      var uEl = document.getElementById("sb-url"), kEl = document.getElementById("sb-key");
      var typedU = uEl ? normalizeSyncUrl(uEl.value) : "";
      var typedK = kEl ? kEl.value.trim() : "";
      var differs = sync.on && (typedU !== sync.url || typedK !== sync.key);
      on.hidden = sync.on && !differs;
      on.textContent = differs ? "طبّق البيانات الجديدة" : "تشغيل المزامنة";
      off.hidden = !sync.on;
    }
  }

  function live(name){ return db[name].filter(function(r){ return !r.deleted; }); }

