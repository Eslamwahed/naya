  /* ---------- تصدير / استيراد ---------- */
  function download(name, text, mime){
    var blob = new Blob([mime.indexOf("csv")>-1 ? "\uFEFF"+text : text], {type:mime+";charset=utf-8"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  }
  var SQL = [
    "create table if not exists naya_records (",
    "  id text primary key,",
    "  list text not null,",
    "  payload jsonb not null,",
    "  updated_at timestamptz not null default now()",
    ");",
    "",
    "create or replace function naya_touch() returns trigger as $$",
    "begin new.updated_at = now(); return new; end $$ language plpgsql;",
    "",
    "drop trigger if exists naya_touch_trg on naya_records;",
    "create trigger naya_touch_trg before insert or update on naya_records",
    "for each row execute function naya_touch();",
    "",
    "create index if not exists naya_updated_idx on naya_records (updated_at);",
    "",
    "alter table naya_records enable row level security;",
    "drop policy if exists naya_all on naya_records;",
    "create policy naya_all on naya_records for all to anon using (true) with check (true);"
  ].join("\n");

  document.getElementById("b-sql").addEventListener("click", function(){
    var box = document.getElementById("sql-box");
    box.style.display = "block";
    box.value = SQL;
    box.focus(); box.select();
    try{ document.execCommand("copy"); toast("الكود اتنسخ — الصقه في SQL Editor"); }
    catch(e){ toast("انسخ الكود من الصندوق تحت"); }
  });

  document.getElementById("b-sql-img").addEventListener("click", function(){
    var box = document.getElementById("sql-box");
    box.style.display = "block"; box.value = SQL_IMG;
    box.focus(); box.select();
    try{ document.execCommand("copy"); toast("كود الصور اتنسخ — الصقه في SQL Editor"); }
    catch(e){ toast("انسخ الكود من الصندوق تحت"); }
  });

  document.getElementById("b-sync-on").addEventListener("click", function(){
    var newUrl = normalizeSyncUrl(document.getElementById("sb-url").value);
    // مشروع تاني = بصمات قديمة ملهاش معنى، وعلامة «آخر حاجة شفتها» كمان
    if(newUrl !== sync.url){ clearPushed(); sync.lastSeen = null; }
    sync.url = newUrl;
    sync.key = document.getElementById("sb-key").value.trim();
    document.getElementById("sb-url").value = sync.url;
    if(/sb_secret_|service_role/i.test(sync.key)){
      toast("ده مفتاح سري — استخدم الـ Publishable key"); return;
    }
    startSync();
  });
  document.getElementById("b-sync-off").addEventListener("click", function(){ stopSync(); toast("المزامنة اتوقفت"); });
  document.getElementById("b-sync-now").addEventListener("click", function(){
    if(!sync.on){ toast("شغّل المزامنة الأول"); return; }
    syncTick(); toast("بيزامن…");
  });
  document.getElementById("b-sync-all").addEventListener("click", pullEverything);
  ["sb-url","sb-key"].forEach(function(id){
    document.getElementById(id).addEventListener("input", renderStorageState);
  });

  document.getElementById("b-link").addEventListener("click", linkNewFile);
  document.getElementById("b-open").addEventListener("click", linkExistingFile);
  document.getElementById("b-unlink").addEventListener("click", unlinkFile);

  ["flt-status","flt-party","flt-item","flt-ship","flt-owner","flt-from","flt-to","flt-text"].forEach(function(id){
    var el = document.getElementById(id);
    el.addEventListener(id === "flt-text" ? "input" : "change", function(){
      readFilters(); resetPage("sales"); renderSales();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".per"), function(el){
    el.addEventListener("change", function(){
      period.mode = this.value;
      syncPeriodUI(); renderAll();
    });
  });
  document.getElementById("rep-per").addEventListener("click", function(e){
    var b = e.target.closest("[data-repper]"); if(!b) return;
    period.mode = b.dataset.repper; syncPeriodUI(); renderAll();
  });
  Array.prototype.forEach.call(document.querySelectorAll(".per-from"), function(el){
    el.addEventListener("change", function(){ period.from = this.value; period.mode="custom"; syncPeriodUI(); renderAll(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".per-to"), function(el){
    el.addEventListener("change", function(){ period.to = this.value; period.mode="custom"; syncPeriodUI(); renderAll(); });
  });

  document.getElementById("b-invfilters").addEventListener("click", function(){
    var pnl = document.getElementById("inv-filters");
    pnl.hidden = !pnl.hidden;
    this.setAttribute("aria-expanded", String(!pnl.hidden));
  });
  ["inv-item","inv-color","inv-size"].forEach(function(id){
    document.getElementById(id).addEventListener("change", function(){
      // تغيير الصنف بيقلّب قوايم اللون والمقاس، فالاختيار القديم ممكن ما يبقاش موجود
      if(id === "inv-item"){ ifilt.color = ""; ifilt.size = ""; }
      renderInventory();
    });
  });
  document.getElementById("inv-q").addEventListener("input", renderInventory);
  document.getElementById("inv-quick").addEventListener("click", function(e){
    var b = e.target.closest("[data-invonly]");
    if(!b) return;
    ifilt.only = b.dataset.invonly;
    renderInventory();
  });
  document.getElementById("inv-chips").addEventListener("click", function(e){
    var rm = e.target.closest("[data-rmif]");
    if(rm){
      var k = rm.dataset.rmif;
      if(k === "only") ifilt.only = "all";
      else { var el = document.getElementById(IF_ID[k]); if(el) el.value = ""; ifilt[k] = ""; }
      renderInventory(); return;
    }
    if(e.target.id === "b-clear-inv"){
      ifilt.only = "all";
      ["item","color","size","text"].forEach(function(k){
        var el = document.getElementById(IF_ID[k]); if(el) el.value = ""; ifilt[k] = "";
      });
      renderInventory();
    }
  });

  // ---------- تهيئة السيستم ----------
  function resetCounts(){
    return { sales:live("sales").length, purchases:live("purchases").length,
             cash:live("cash").length, items:live("items").length, parties:live("parties").length };
  }
  function resetSummary(){
    var c = resetCounts();
    return "هيتمسح: " + qty(c.sales) + " أوردر · " + qty(c.purchases) + " شراء · " +
      qty(c.cash) + " حركة خزنة · " + qty(c.items) + " صنف · " + qty(c.parties) + " عميل ومورد.";
  }
  function openReset(){
    document.getElementById("reset-count").textContent = resetSummary();
    document.getElementById("reset-word").value = "";
    document.getElementById("b-reset-do").disabled = true;
    document.getElementById("reset-box").hidden = false;
  }
  function closeReset(){ document.getElementById("reset-box").hidden = true; }

  // المسح بيتم بعلامة حذف على كل سجل عشان يتزامن مع باقي الأجهزة كمان
  function doReset(){
    if(lockDate()){
      toast("فيه فترة مقفولة لحد " + lockDate() + " — افتحها الأول لو متأكد إنك عايز تمسح");
      closeReset(); return;
    }
    downloadBackup();                       // نسخة احتياطية إجبارية الأول
    var now = Date.now();
    LISTS.forEach(function(name){
      db[name].forEach(function(r){
        if(!r.deleted){ r.deleted = true; r.at = now; r.editedBy = me || "غير محدد"; }
      });
    });
    editing = { items:null, parties:null, sales:null, purchases:null, cash:null };
    moveFor = null; offersFor = null; varsFor = null; freshId = null;
    ["flt-status","flt-party","flt-item","flt-ship","flt-owner","flt-from","flt-to","flt-text"]
      .forEach(function(id){ var el=document.getElementById(id); if(el) el.value=""; });
    readFilters();
    writeLocal(); writeFileSoon();
    LISTS.forEach(function(n){ saveSoon(n); });
    renderAll();
    closeReset();
    toast("السيستم اتهيّأ — نزّلنا نسخة احتياطية قبل المسح");
  }

  /* ---------- إعادة ترقيم الأوردرات ---------- */
  // الأوردر المحذوف بيسيب رقمه محجوز فالعدّاد بيفضل ماشي. ده بيرجّع
  // الترقيم من ١ على الأوردرات الموجودة بترتيب التاريخ، وبيفكّ أرقام المحذوف.
  function renumSales(){
    var liveS = live("sales").slice().sort(function(a,b){
      return (a.date||"") !== (b.date||"") ? ((a.date||"") < (b.date||"") ? -1 : 1)
                                           : (a.at||0) - (b.at||0);
    });
    var now = Date.now(), n = 0;
    liveS.forEach(function(x){
      var next = ++n;
      if(x.no === next) return;
      x.no = next; x.editedBy = me || "غير محدد"; x.at = now;
    });
    db.sales.forEach(function(x){
      if(x.deleted && x.no != null){ delete x.no; x.at = now; }
    });
    saveSoon("sales"); renderAll(); renderSnoState();
    document.getElementById("renum-box").hidden = true;
    toast(n ? "اتعاد ترقيم " + qty(n) + " أوردر — الجاي رقم " + qty(n+1)
            : "مفيش أوردرات — الجاي هيبدأ من ١");
  }
  function renderSnoState(){
    var el = document.getElementById("sno-state");
    if(!el) return;
    var n = live("sales").length;
    el.textContent = "عندك " + qty(n) + " أوردر، والجاي هياخد رقم " + qty(nextSaleNo()) + ".";
  }
  document.getElementById("b-renum").addEventListener("click", function(){
    var box = document.getElementById("renum-box");
    var n = live("sales").length;
    document.getElementById("renum-warn").textContent = n
      ? "هيتعاد ترقيم " + qty(n) + " أوردر موجود، والجاي هياخد رقم " + qty(n+1) + "."
      : "مفيش أوردرات موجودة — الترقيم هيرجع يبدأ من ١.";
    box.hidden = false;
    box.scrollIntoView({block:"nearest"});
  });
  document.getElementById("b-renum-cancel").addEventListener("click", function(){
    document.getElementById("renum-box").hidden = true;
  });
  document.getElementById("b-renum-do").addEventListener("click", renumSales);

  document.getElementById("b-reset-open").addEventListener("click", openReset);
  document.getElementById("b-reset-cancel").addEventListener("click", closeReset);
  document.getElementById("reset-word").addEventListener("input", function(){
    document.getElementById("b-reset-do").disabled = this.value.trim() !== "مسح";
  });
  document.getElementById("b-reset-do").addEventListener("click", function(){
    if(document.getElementById("reset-word").value.trim() !== "مسح") return;
    doReset();
  });

  function downloadBackup(){
    download("lora-backup-"+today()+".json", JSON.stringify({db:db,settings:settings},null,2), "application/json");
  }
  document.getElementById("b-export").addEventListener("click", downloadBackup);
  document.getElementById("b-csv").addEventListener("click", function(){
    var head = ["رقم الأوردر","التاريخ","الحالة","العميل","التليفون","المحافظة","الصنف","اللون","المقاس",
      "المشحون","المرتجع","المباع","السعر","إجمالي السطر","إجمالي الأوردر",
      "شركة الشحن","كود الشحن","التحصيل عن طريق","شحن محصّل","شحن مدفوع","المحصّل","صافي ربح الأوردر","المستخدم"];
    var lines = [head.join(",")];
    filteredSales().slice().sort(byDate).forEach(function(s){
      var p = db.parties.find(function(x){ return x.id===s.partyId; }) || {};
      var ls = SL(s);
      ls.forEach(function(l, i){
        lines.push([s.no||"", s.date, saleStateTxt(s), partyName(s.partyId), p.phone||"", p.gov||"",
          itemName(l.itemId), vColor(l), vSize(l), Number(l.qty)||0, lineRet(l), lineSold(l,s),
          Number(l.price)||0, lineTotal(l,s),
          i===0 ? saleTotal(s) : "",
          i===0 ? (s.shipCo||"") : "", i===0 ? (s.shipCode||"") : "",
          i===0 ? (viaShip(s)?"شركة الشحن":"مباشر") : "",
          i===0 ? shipIn(s) : "", i===0 ? shipOut(s) : "", i===0 ? (s.paid||0) : "",
          i===0 ? saleProfit(s).toFixed(2) : "", s.by||""]
          .map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(","));
      });
    });
    download("lora-sales-"+today()+".csv", lines.join("\n"), "text/csv");
  });
  document.getElementById("b-import").addEventListener("click", function(){ document.getElementById("file-import").click(); });
  document.getElementById("file-import").addEventListener("change", function(){
    var f = this.files && this.files[0]; if(!f) return;
    var reader = new FileReader();
    reader.onload = async function(){
      try{
        var data = JSON.parse(reader.result);
        var src = data.db || data;
        var names = ["items","parties","purchases","sales","cash"];
        for(var i=0;i<names.length;i++){
          var n = names[i];
          if(!Array.isArray(src[n])) continue;
          var have = {};
          db[n].forEach(function(r){ have[r.id]=true; });
          src[n].forEach(function(r){ if(r && r.id && !have[r.id]) db[n].push(r); });
          saveSoon(n);
        }
        renderAll(); toast("تم الاسترجاع");
      }catch(err){ toast("الملف مش مقروء"); }
    };
    reader.readAsText(f);
    this.value = "";
  });

  // تنبيه لو في تعديلات والتخزين مش شغال
  window.addEventListener("beforeunload", function(e){
    if(!sinks.local && !sinks.cloud && !fileHandle && (db.sales.length || db.purchases.length || db.items.length)){
      e.preventDefault(); e.returnValue = "";
    }
  });

