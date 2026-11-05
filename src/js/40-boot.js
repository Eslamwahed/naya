  /* ---------- بدء ---------- */
  (async function init(){
    document.getElementById("p-date").value = firstOpenDate();
    document.getElementById("c-date").value = firstOpenDate();
    await loadAll();
    loadSyncCfg();
    document.getElementById("sb-url").value = sync.url;
    document.getElementById("sb-key").value = sync.key;
    renderStorageState();
    document.getElementById("me").value = me;
    renderVersion();
    document.getElementById("cur").value = settings.currency;

    var note = document.getElementById("fs-note");
    if(!fsSupported()){
      note.textContent = "ربط الملف مدعوم في Chrome و Edge على الكمبيوتر فقط. في المتصفحات التانية اعتمد على ذاكرة المتصفح + نسخة JSON يدوية.";
      document.getElementById("b-link").disabled = true;
      document.getElementById("b-open").disabled = true;
    } else {
      note.textContent = "بعد ربط الملف، كل تعديل بيتكتب فيه خلال ثانية. لما تفتح السيستم بكرة، اضغط \"فتح ملف بيانات موجود\" مرة واحدة عشان يرجع الارتباط.";
    }

    try{ if(LS) applyTheme(LS.getItem("naya:theme") || "light"); }catch(e){}
    backfillSaleNos();
    backfillPurchNos();   // عشان رقم الفاتورة يبان في الخزنة والسجل مش في شاشة المشتريات بس
    readFilters();
    readCashFilters();
    numify();
    var cur = document.querySelector('#nav button[aria-current="true"]');
    activeTab = cur ? cur.dataset.tab : "dash";

    // الجلسة محفوظة على الجهاز ده بس — مش بتتزامن مع باقي الأجهزة
    try{ if(LS) authUser = LS.getItem("naya:auth") || null; }catch(e){}
    if(lockOn()){
      if(curUser()){ me = curUser().name; var mi = document.getElementById("me"); if(mi) mi.value = me; }
      else authUser = null;
    }
    applyPerms();
    if(lockOn() && !curUser()) lockShow();
    renderAll();
    renderStorageState();
    tabEnter(document.querySelector("main > section[id^='tab-']:not([hidden])"));

    // المزامنة بتكمّل لوحدها من غير ما حد يشغّلها كل مرة
    if(sync.on && sync.url && sync.key) startSync(true);
    document.addEventListener("visibilitychange", function(){
      if(!document.hidden && sync.on) syncTick();
    });
  })();
  /* v177 — مدخل الاختبارات (tests/) بس: بيتفتح لما الاختبار يحط window.__NAYA_TEST__ قبل ما الصفحة تحمّل.
     في الاستخدام العادي مش موجود ومش بيغيّر حاجة. */
  if(window.__NAYA_TEST__) window.__T = {
    db:function(){ return db; }, settings:function(){ return settings; }, clearStockIdx:clearStockIdx, stampDelivery:stampDelivery,
    periodStats:periodStats, projStats:projStats, finIS:finIS, finBS:finBS, stockBookValue:stockBookValue, cashBox:cashBox,
    cashLedger:cashLedger, partyBalance:partyBalance, walletOf:walletOf, avgCostVB:avgCostVB, costTrueUps:costTrueUps,
    addPay:addPay, openPRet:openPRet, computeShares:computeShares, weightedRatio:weightedRatio, revDate:revDate, canTab:canTab, metaBook:metaBook, shipPendMap:shipPendMap
  };
})();
