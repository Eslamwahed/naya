  /* ================= الدرج الموحّد لكل شاشات الإدخال ================= */
  // كل لوحة إدخال بتتحوّل لدرج بإضافة كلاس، من غير ما نلمس الفورم ولا الـIDs
  // ولا المعالجات — فكل منطق الحفظ والتعديل شغال زي ما هو.
  var ENTRY = {
    purchases: { panel:"entry-purchases", title:"شراء جديد",  edit:"تعديل شراء",  focus:"p-party" },
    cash:      { panel:"entry-cash",      title:"حركة نقدية", edit:"تعديل حركة",  focus:"c-type"  },
    items:     { panel:"entry-items",     title:"صنف جديد",   edit:"تعديل صنف",   focus:"i-name"  },
    parties:   { panel:"entry-parties",   title:"جهة جديدة",  edit:"تعديل جهة",   focus:"pt-name" },
    capital:   { panel:"entry-capital",   title:"حركة رأس مال", edit:"حركة رأس مال", focus:"cp-partner" },
    pret:      { panel:"entry-pret",      title:"مرتجع للمورد", edit:"مرتجع للمورد", focus:"pr-qty"   },
    xchg:      { panel:"entry-xchg",      title:"⇄ استبدال مع مورد", edit:"⇄ تعديل استبدال", focus:"x-party" }
  };
  var openEntryKey = null;

  function entryScrim(){ return document.getElementById("gen-scrim"); }

  function openEntry(key){
    var cfg = ENTRY[key]; if(!cfg) return;
    var box = document.getElementById(cfg.panel); if(!box) return;
    if(openEntryKey && openEntryKey !== key) closeEntry(true);

    var t = document.getElementById("title-" + key);
    // رأس المال بيمسك حالة التعديل بتاعته لوحده (editingCap) مش في editing[]
    if(t) t.textContent = (key === "capital")
      ? (editingCap ? "تعديل حركة رأس مال" : cfg.title)
      : (editing[key] ? cfg.edit : cfg.title);
    // رقم الفاتورة يبان وإنت بتكتبها، زي رقم الأوردر في درج المبيعات
    if(key === "purchases" && t){
      var rec = editing.purchases
        ? db.purchases.find(function(x){ return x.id === editing.purchases; }) : null;
      t.textContent += "  #" + (rec && rec.pno ? rec.pno : nextPurchNo());
    }

    if(key === "cash") clearOver();
    if(key === "pret"){ renderPRetSrc(); renderPRetCalc(); }
    if(key === "purchases"){
      closeNewItem();
      if(!pdraft) pdraft = newPDraft();
      // تاريخ النهاردة للمسودة الفاضية بس — المسودة اللي فيها شغل تفضل بتاريخها
      if(!editing.purchases && !pdraft.batchId && !pDraftDirty()) pdraft.date = firstOpenDate();
      clearPOver(); syncPHead(); renderPLines(); renderPDraftNote();
    }
    box.classList.add("as-drawer");
    box.hidden = false;
    var sc = entryScrim(); sc.hidden = false;
    requestAnimationFrame(function(){ box.classList.add("on"); sc.classList.add("on"); });
    openEntryKey = key;
    updateImpact(key);
    var f = document.getElementById(cfg.focus);
    if(f) setTimeout(function(){ try{ f.focus(); }catch(e){} }, 60);
  }

  function closeEntry(quick){
    if(!openEntryKey) return;
    var cfg = ENTRY[openEntryKey];
    var box = document.getElementById(cfg.panel);
    var sc = entryScrim();
    var key = openEntryKey;
    openEntryKey = null;
    if(box) box.classList.remove("on");
    sc.classList.remove("on");
    var done = function(){
      if(openEntryKey) return;                  // اتفتح تاني في اللحظة دي
      if(box){ box.hidden = true; box.classList.remove("as-drawer"); }
      sc.hidden = true;
    };
    if(quick) done(); else setTimeout(done, 240);
    // تعديل مفتوح والمستخدم قفل الدرج = إلغاء التعديل
    if(key !== "capital" && editing[key]) cancelEdit(key);
  }

  document.body.addEventListener("click", function(e){
    var op = e.target.closest("[data-openentry]");
    if(op){ openEntry(op.dataset.openentry); return; }
    if(e.target.closest("[data-closeentry]")){ closeEntry(); return; }
  });
  document.getElementById("gen-scrim").addEventListener("click", function(){ closeEntry(); closeExp(); });
  document.body.addEventListener("click", function(e){
    var t;
    if((t = e.target.closest("[data-expopen]"))){ openExp(t.dataset.expopen); return; }
    if(e.target.closest("[data-expclose]")){ closeExp(); return; }
    // رقم الأوردر في التحليل بيفتح تفاصيله في «الكل»
    if((t = e.target.closest("[data-expgo]"))){ e.preventDefault(); closeExp(true); sgOpenRow(t.dataset.expgo); }
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && expStage) closeExp();
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && openEntryKey) closeEntry();
  });

  // الرصيد اللي الحركة هتأثّر عليه — بيتحدّث وانت بتكتب
  function updateImpact(key){
    var el = document.getElementById("impact-" + (key || openEntryKey));
    if(!el) return;
    var cash = cashBox();
    var html = "";
    if(key === "purchases"){
      var out = (Number((document.getElementById("p-paid")||{}).value)||0) +
                (Number((document.getElementById("p-freight")||{}).value)||0);
      html = "<span>الخزنة</span> <b>" + esc(money(cash)) + "</b>" +
        (out ? " <span class='arrow'>←</span> <b class='" + (cash-out < 0 ? "v-due" : "") + "'>" +
          esc(money(cash - out)) + "</b>" : "");
    } else if(key === "cash"){
      var t = (document.getElementById("c-type")||{}).value;
      var a = Number((document.getElementById("c-amount")||{}).value)||0;
      var sign = (t === "in" || t === "settle" || t === "opening") ? 1 : -1;
      var pbx = t === "expense" && (document.getElementById("c-paidby")||{}).value;      // v142: من جيب الشريك
      if(pbx) a = 0;
      html = "<span>الخزنة</span> <b>" + esc(money(cash)) + "</b>" + (pbx ? " <span class='arrow'>·</span> ما بتتأثرش — " + esc(partyName(pbx)) + " دفع من جيبه" : "") +
        (a ? " <span class='arrow'>←</span> <b class='" + (cash + sign*a < 0 ? "v-due" : "") + "'>" +
          esc(money(cash + sign*a)) + "</b>" : "");
    } else if(key === "capital"){
      var pid = (document.getElementById("cp-partner")||{}).value;
      if(pid) html = "<span>رأس ماله</span> <b>" + esc(money(capitalOf(pid))) + "</b>" +
        " <span class='arrow'>·</span> <span>نسبته</span> <b>" + (ratioOf(pid)*100).toFixed(2) + "%</b>";
    } else if(key === "pret"){
      var inCash = document.getElementById("pr-mode").value === "cash"
        ? pretQty() * pretUnit() : 0;
      html = "<span>الخزنة</span> <b>" + esc(money(cash)) + "</b>" +
        (inCash ? " <span class='arrow'>←</span> <b class='v-gain'>" +
          esc(money(cash + inCash)) + "</b>" : "");
    } else if(key === "items" || key === "parties"){
      el.hidden = true; return;
    }
    el.hidden = !html;
    el.innerHTML = html;
  }
  // أي كتابة في الدرج بتحدّث الرصيد
  document.body.addEventListener("input", function(e){
    if(openEntryKey && e.target.closest(".panel.as-drawer")) updateImpact(openEntryKey);
  });
  document.body.addEventListener("change", function(e){
    if(openEntryKey && e.target.closest(".panel.as-drawer")) updateImpact(openEntryKey);
  });

