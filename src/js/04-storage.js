  /* ---------- تخزين: ذاكرة الجهاز + المحادثة + ملف على الجهاز ---------- */
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  var LISTS = ["items","parties","purchases","sales","cash"];
  var fileHandle = null;      // ملف مربوط على الجهاز
  var lastSaved = null;
  var sinks = { local:false, cloud:false, file:false };

  function withTimeout(p, ms){
    return Promise.race([p, new Promise(function(_,rej){
      setTimeout(function(){ rej(new Error("timeout")); }, ms||6000);
    })]);
  }

  // ١) ذاكرة المتصفح — بتشتغل حتى لو الملف مفتوح من الجهاز
  var LS = (function(){
    try{ window.localStorage.setItem("naya:t","1"); window.localStorage.removeItem("naya:t"); return window.localStorage; }
    catch(e){ return null; }
  })();

  // ٢) تخزين المحادثة — بيشتغل لما الملف يتفتح من Claude
  var CLOUD = (window.storage && typeof window.storage.get === "function") ? window.storage : null;

  // الأحدث بيكسب: كل سجل ليه ختم وقت
  function mergeById(a, b){
    var map = {};
    (a||[]).forEach(function(r){ if(r && r.id) map[r.id] = r; });
    (b||[]).forEach(function(r){
      if(!r || !r.id) return;
      var old = map[r.id];
      if(!old || (Number(r.at)||0) >= (Number(old.at)||0)) map[r.id] = r;
    });
    return Object.keys(map).map(function(k){ return map[k]; });
  }

  function snapshot(){ return { v:2, savedAt:Date.now(), settings:settings, db:db }; }

  function absorb(data){
    if(!data) return false;
    clearStockIdx();                  // داتا جاية من السحابة أو من ملف
    var src = data.db || data;
    var got = false;
    LISTS.forEach(function(n){
      if(Array.isArray(src[n])){ db[n] = mergeById(db[n], src[n]); got = true; }
    });
    if(data.settings && data.settings.currency) settings = data.settings;
    // داتا جديدة وصلت — لو فيها السجل اللي إنت فاتحه، قوله دلوقتي
    if(got && typeof warnIfOpenChanged === "function") warnIfOpenChanged();
    return got;
  }

  // ---------- الكتابة ----------
  function writeLocal(){
    if(!LS) return false;
    try{ LS.setItem("naya:data", JSON.stringify(snapshot())); return true; }
    catch(e){ return false; }
  }

  async function writeCloud(name){
    if(!CLOUD) return false;
    try{
      var key = KEYS[name];
      var cur = null;
      try{
        var r = await withTimeout(CLOUD.get(key, true));
        if(r && r.value) cur = JSON.parse(r.value);
      }catch(e){}
      if(Array.isArray(cur)) db[name] = mergeById(cur, db[name]);
      await withTimeout(CLOUD.set(key, JSON.stringify(db[name]), true));
      return true;
    }catch(e){ return false; }
  }

  var fileTimer = null;
  function writeFileSoon(){
    if(!fileHandle) return;
    clearTimeout(fileTimer);
    fileTimer = setTimeout(async function(){
      try{
        var w = await fileHandle.createWritable();
        await w.write(JSON.stringify(snapshot(), null, 2));
        await w.close();
        sinks.file = true;
      }catch(e){ sinks.file = false; }
      renderStorageState();
    }, 400);
  }

  // نداء واحد بيكتب في كل الأماكن المتاحة
  function saveSoon(name){
    clearStockIdx();                  // الداتا اتغيّرت — فهرس المخزون بقى قديم
    sinks.local = writeLocal();
    writeFileSoon();
    if(CLOUD){
      writeCloud(name).then(function(ok){ sinks.cloud = ok; lastSaved = Date.now(); renderStorageState(); });
    }
    lastSaved = Date.now();
    if(sync.on){ clearTimeout(sync.pushTimer); sync.pushTimer = setTimeout(syncPush, 300); }
    renderStorageState();
  }
  function saveAll(){ LISTS.forEach(function(n){ saveSoon(n); }); }

  // ---------- القراءة ----------
  async function loadAll(){
    sinks.local = !!LS;          // متاح = هيتحفظ، حتى لو لسه مفيش بيانات
    sinks.cloud = !!CLOUD;
    // من ذاكرة الجهاز
    if(LS){
      try{
        var raw = LS.getItem("naya:data");
        if(raw){ absorb(JSON.parse(raw)); sinks.local = true; }
        var mm = LS.getItem("naya:me"); if(mm) me = mm;
      }catch(e){}
    }
    // من تخزين المحادثة
    if(CLOUD){
      for(var i=0;i<LISTS.length;i++){
        try{
          var r = await withTimeout(CLOUD.get(KEYS[LISTS[i]], true));
          if(r && r.value){ db[LISTS[i]] = mergeById(db[LISTS[i]], JSON.parse(r.value)); sinks.cloud = true; }
        }catch(e){}
      }
      try{
        var st = await withTimeout(CLOUD.get(KEYS.settings, true));
        if(st && st.value){ var o = JSON.parse(st.value); if(o.currency) settings = o; }
      }catch(e){}
      if(!me){
        try{ var m = await withTimeout(CLOUD.get("trade:me", false)); if(m && m.value) me = m.value; }catch(e){}
      }
    }

  }

  // اسمك على زرار القايمة فوق
  function meLab(){ var l = document.getElementById("me-lab"); if(l) l.textContent = me || "اسمك"; }
  function saveMe(){
    meLab();
    if(LS){ try{ LS.setItem("naya:me", me); }catch(e){} }
    if(CLOUD){ try{ withTimeout(CLOUD.set("trade:me", me, false)).catch(function(){}); }catch(e){} }
  }

  function saveSettings(){
    if(LS) writeLocal();
    writeFileSoon();
    if(CLOUD){ try{ withTimeout(CLOUD.set(KEYS.settings, JSON.stringify(settings), true)).catch(function(){}); }catch(e){} }
  }

