  /* ---------- جدول أسعار الشحن بالمنطقة ----------
     بدل ما تكتب رقم الشحن في كل أوردر: بتحدّد المنطقة مرة واحدة
     بسعرها والمحافظات اللي جواها، وبعدها أول ما تختار العميل بيتملّى
     لوحده من محافظته. كله قابل للتعديل من شاشة «شركات الشحن». */

  /* آخر شركة شحن اتستخدمت للمحافظة دي. الأرقام دي فلوس، فما ينفعش
     تتحط في الخانات من غير ما اللي بيسجّل يعرف — بيظهر سطر بيقول جت منين.
     والملغي مش مصدر: مصاريفه مش بتاعت توصيل ناجح. */
  /* الفرق بين اللي بتدفعه واللي بتحمّله بيطلع من جيبك في كل أوردر،
     فبيتقال وإنت بتكتب مش بعد ما تحفظ. */
  // الدرج: الأوردر ده ملغي قبل الشحن؟ نفس قاعدة preCancelFix (الشحن مكتوب بس مش متحسب)
  function draftPreShip(st){
    if(st !== "cancelled" || (!draft.selfDel && squish(draft.shipCode))) return false;
    var o = editing.sales ? db.sales.find(function(x){ return x.id === editing.sales; }) : null;
    return !o || !o.shippedAt || !!o.preCancel;
  }
  function shipHint(){
    var el = document.getElementById("e-pocket");
    if(!el) return;
    var out = Number(draft.shipOut)||0, inn = Number(draft.shipIn)||0;
    if((out || inn) && draftPreShip(draft.status)){
      el.textContent = "ملغي قبل الشحن — الشحن ده مش متحسب، وهيرجع يتحسب لو الأوردر رجع."; el.hidden = false; return;
    }
    if(!out && !inn){ el.textContent = ""; el.hidden = true; return; }
    var gap = out - inn;
    el.innerHTML = "بتدفع <strong>" + esc(money(out)) + "</strong> · بتحمّل العميل <strong>" +
      esc(money(inn)) + "</strong>" +
      (Math.abs(gap) < 0.009 ? " — الشحن مغطّى بالظبط."
        : (gap > 0 ? " — يعني <span class='v-due'><strong>" + esc(money(gap)) + "</strong> من جيبك</span>."
                   : " — يعني <span class='v-gain'><strong>" + esc(money(-gap)) + "</strong> ليك</span>."));
    el.hidden = false;
  }
  /* «تفاصيل زيادة» بتتفتح لوحدها لو فيها حاجة متكتوبة. و«التحصيل»
     بالذات بيبان في عنوان المطوي من غير ما تفتحه — لأنه هو اللي
     بيحدّد الفلوس هتنزل الخزنة ولا محفظة شركة الشحن، ومينفعش يبقى
     مخفي تمامًا. */
  function syncMore(reset){
    var d = document.getElementById("e-more");
    if(!d) return;
    var hasNote = !!squish(draft.note || ""), direct = draft.payVia === "direct";
    // أوردر الشركة المحصّل بتاعه بيتحسب لوحده — مش سبب يفتح القسم
    var hasPaid = direct && !!Number(draft.paid);
    var want = hasPaid || hasNote || direct;
    /* بيتفتح لوحده بس عمره ما بيتقفل لوحده: لو فتحته بإيدك وبعدين
       مسحت الرقم، القسم كان هيتقفل في وشك وإنت بتكتب جواه. */
    d.open = reset ? want : (d.open || want);
    var sum = document.getElementById("e-more-sum");
    if(!sum) return;
    var bits = ["التحصيل: " + (direct ? "مباشر ليك" : "شركة الشحن")];
    if(hasPaid) bits.push("محصّل " + money(Number(draft.paid)||0));
    if(!hasPaid && direct) bits.push("المحصّل");
    bits.push("ملاحظة");
    sum.textContent = bits.join(" · ");
  }
  /* اختيار العميل من القايمة بيبعت input و change، فالدالة كانت
     بتتنفّذ مرتين: الأولى بتملا وبتكتب السطر، والتانية بتلاقي الخانات
     مليانة فتمسحه. بنعمل الاقتراح مرة واحدة لكل عميل. */
  var suggestFor = null;
  /* ---------- توصيل بنفسك (أو مع مندوبك) ----------
     مفيش شركة شحن ولا بوليصة، والتحصيل مباشر ليك. العميل بيدفع للي وصّله
     تمن اللي خده + الشحن، والفلوس بتدخل الخزنة نفس اليوم. */
  function syncSelfPaid(rec, before){
    if(!rec || !rec.selfDel || !isDelivered(rec)) return;
    var full = Math.round((saleTotal(rec) + shipIn(rec)) * 100) / 100;
    if(!rec.paidAt && full - (Number(before)||0) > 0.009){
      rec.dep = Number(before)||0;                 // العربون اللي اتدفع قبل التسليم
      rec.paidAt = rec.deliveredAt || today();     // يوم ما الفلوس دخلت فعلاً
    }
    rec.paid = full;
  }
  function syncDelMode(){
    var self = !!draft.selfDel;
    document.querySelectorAll("#e-delmode [data-delmode]").forEach(function(b){
      b.classList.toggle("on", (b.dataset.delmode === "self") === self);
      b.setAttribute("aria-pressed", (b.dataset.delmode === "self") === self ? "true" : "false");
    });
    var g = function(id){ return document.getElementById(id); };
    g("e-shipco-wrap").hidden = self; g("e-shipcode-wrap").hidden = self;
    g("e-courier-wrap").hidden = !self;
    g("e-shipout-lab").textContent = self ? "هتدفع للي هيوصّله" : "شحن هتدفعه للشركة";
    var pv = g("e-payvia");
    // الخانة لازم تقول نفس اللي هيتسجّل — قبل v110 لما ترجع من «أنا/مندوبي» كانت فاضلة «مباشر» وهو «شركة»
    if(pv){ pv.disabled = self; if(self) draft.payVia = "direct"; pv.value = payVia(draft); }
    var dl = g("courier-list");
    if(dl){
      var seen = {};
      live("sales").forEach(function(x){ var c = squish(x.courier); if(c) seen[c] = 1; });
      dl.innerHTML = Object.keys(seen).map(function(c){ return "<option value='" + esc(c) + "'></option>"; }).join("");
    }
    var n = g("e-selfnote");
    if(n){
      n.hidden = !self;
      n.textContent = self ? "شركة الشحن وكود البوليصة مش مطلوبين، والتحصيل مباشر ليك. سيب العربون فاضي — لما يتسلّم دوس «استلم ودفع» والفلوس تدخل الخزنة نفس اليوم." : "";
    }
  }
  /* v110 — شركة شحن = التحصيل عن طريقها، أنا/مندوبي = مباشر ليك (syncDelMode).
     بيتنادى بس لما الاسم يتكتب في خانة كانت فاضية — لو غيّرت التحصيل بإيدك
     بعدها لـ«مباشر»، باقي كتابة الاسم ما بترجّعوش. ولو في محصّل متكتب
     بإيدك (عربون) بنسيبه: أوردر الشركة المحصّل بتاعه بيتحسب لوحده فكان هيضيع. */
  function autoPayViaShip(){
    if(draft.selfDel || draft.payVia === "ship" || (Number(draft.paid)||0)) return;
    draft.payVia = "ship";
    var pv = document.getElementById("e-payvia"); if(pv) pv.value = "ship";
    syncMore();
  }
  document.getElementById("e-delmode").addEventListener("click", function(e){
    var b = e.target.closest("[data-delmode]"); if(!b) return;
    draft.selfDel = b.dataset.delmode === "self";
    if(draft.selfDel){ draft.payVia = "direct"; draft.shipOut = draft.shipOut || ""; }
    else if(payVia(draft) === "direct" && !(Number(draft.paid)||0)) draft.payVia = "ship";
    syncDelMode(); shipHint(); syncMore(); updateEntryCalc();
  });

  function suggestShipping(){
    if(draft.selfDel) return;              // بتوصّله بنفسك — مفيش شركة تتقترح
    if(suggestFor === draft.partyId) return;
    suggestFor = draft.partyId;
    var note = document.getElementById("e-shipnote");
    if(note){ note.textContent = ""; note.hidden = true; }
    var p = db.parties.find(function(x){ return x.id === draft.partyId; });
    if(!p || !p.gov) return;
    var last = live("sales").filter(function(x){
      var q = db.parties.find(function(y){ return y.id===x.partyId; });
      return q && q.gov === p.gov && !isCancelled(x) && squish(x.shipCo);
    }).sort(byDate)[0];
    if(!last) return;
    // السطر ده لازم يقول اللي اتملّى فعلاً بس، مش كل اللي في آخر أوردر
    var filled = [];
    if(!squish(draft.shipCo || "")){
      draft.shipCo = last.shipCo; filled.push(squish(last.shipCo));
      autoPayViaShip();
    }
    if(!draft.shipIn && (Number(last.shipIn)||0)){
      draft.shipIn = last.shipIn;
      filled.push("على العميل " + money(shipIn(last)));
    }
    if(!draft.shipOut && (Number(last.shipOut)||0)){
      draft.shipOut = last.shipOut;
      filled.push("للشركة " + money(shipOut(last)));
    }
    ["shipCo","shipIn","shipOut"].forEach(function(f){
      var el = SD.querySelector("[data-f='"+f+"']:not([data-li])");
      if(el) el.value = draft[f];
    });
    if(note && filled.length){
      // «لـ» + «الإسكندرية» بتتكتب «للإسكندرية» مش «لـالإسكندرية»
      var gv = p.gov.indexOf("ال") === 0 ? "ل" + p.gov.slice(1) : "لـ" + p.gov;
      note.textContent = "من آخر أوردر " + gv + " (#" + (last.no || "—") + "): " +
        filled.join(" · ") + " — غيّرها لو مختلفة.";
      note.hidden = false;
    }
  }

  // Enter بيحفظ · Esc بيقفل الدرج
  SD.addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.tagName !== "BUTTON" && e.target.tagName !== "A" && e.target.id !== "e-camp"){ e.preventDefault(); saveDraft(); }
    if(e.key === "Escape"){ e.preventDefault(); cancelDraft(); }
  });
  document.getElementById("sale-scrim").addEventListener("click", cancelDraft);
  document.getElementById("b-closedraft").addEventListener("click", cancelDraft);
  document.getElementById("b-newsale").addEventListener("click", function(){
    editing.sales = null; clearEditBase("sales");
    draft = newDraft(draft);
      openDrawer();
  });

  SD.addEventListener("click", function(e){
    var b = e.target.closest("button"); if(!b) return;
    if(b.id === "b-savedraft"){ saveDraft(); return; }
    if(b.id === "b-addline"){ draft.lines.push(blankLine()); renderDrawerLines();
      var sels = document.querySelectorAll("#e-lines [data-f='itemId']");
      if(sels.length) sels[sels.length-1].focus();
      return; }
    if(b.id === "b-canceldraft"){ cancelDraft(); return; }
    if(b.id === "b-newcust"){ fillNcGov();
      var box = document.getElementById("newcust-box");
      box.hidden = false; document.getElementById("nc-name").focus();
      box.scrollIntoView({block:"nearest"}); return; }
    if(b.dataset.rmline !== undefined){
      draft.lines.splice(Number(b.dataset.rmline), 1);
      if(!draft.lines.length) draft.lines = [blankLine()];
      renderDrawerLines(); return;
    }
  });

  /* تسجيل المرتجع من سطر التفاصيل. البضاعة بترجع المخزن لوحدها لأن
     lineSold بتطرح المرتجع، وكل حسابات المخزون بتقرا منها. */
  function saveRet(box){
    var parts = String(box.dataset.ret).split("|");
    var rec = db.sales.find(function(x){ return x.id === parts[0]; });
    if(!rec) return;
    var l = SL(rec)[Number(parts[1])];
    if(!l) return;
    var was = lineRet(l);
    if(saleLocked(rec)){ box.value = was ? qty(was) : ""; toast("الأوردر ده في فترة مقفولة"); return; }
    var v = Number(toEn(box.value))||0, max = Number(l.qty)||0;
    if(v < 0) v = 0;
    if(v > max){
      box.value = was ? qty(was) : "";
      toast("المرتجع أكبر من المشحون (" + qty(max) + ")"); box.focus(); return;
    }
    if(v === was){ box.value = v ? qty(v) : ""; return; }
    l.ret = v;
    // العميل بيدفع للمندوب تمن اللي خده بس — المحصّل بيتحسب تاني معاه
    var cut = syncShipPaid(rec);
    rec.editedBy = me || "غير محدد"; rec.at = Date.now();
    saveSoon("sales"); renderAll();
    var due = saleTotal(rec) + shipIn(rec) - (Number(rec.paid)||0);
    toast(v > was
      ? "اترجّع " + qty(v - was) + " " + itemName(l.itemId) + " للمخزن" +
        (cut ? " · العميل دفع لـ " + (squish(rec.shipCo) || "الشركة") + " " + money(Number(rec.paid)||0) +
               " بس — محفظتها نزلت " + money(cut)
             : (due < -0.009 ? " · ترجّعله " + money(-due) : ""))
      : "اتعدّل المرتجع لـ " + qty(v), 4200);
  }
  TSALES.addEventListener("change", function(e){
    var r = e.target.closest("[data-ret]");
    if(r){ saveRet(r); return; }
  });
  TSALES.addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    var r = e.target.closest("[data-ret]"); if(!r) return;
    e.preventDefault(); e.stopPropagation(); r.blur();
  });

  /* الموبايل: دوسة طويلة على أوردر بتختاره، ووإنت بتختار الدوسة العادية
     بتضيف/تشيل بدل ما تفتح التفاصيل. على الكمبيوتر المربعات ظاهرة زي ما هي. */
  (function(){
    var mq = window.matchMedia ? window.matchMedia("(max-width:760px)") : null;
    var lpT = null, lpPend = false, lpFired = false, sx = 0, sy = 0;
    function selToggle(tr){
      var id = tr.dataset.row; if(!id) return;
      if(selSales[id]) delete selSales[id]; else selSales[id] = 1;
      var cb = tr.querySelector("[data-sel]"); if(cb) cb.checked = !!selSales[id];
      tr.classList.toggle("sel", !!selSales[id]);
      renderBulkBar();
    }
    function skip(t){ return !!t.closest("button, select, input, a, label, .detail-in"); }
    TSALES.addEventListener("touchstart", function(e){
      var tr = e.target.closest("tr.order");
      lpFired = false; clearTimeout(lpT);
      if(!tr || skip(e.target) || e.touches.length !== 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      lpPend = true;
      lpT = setTimeout(function(){
        lpPend = false; lpFired = true; selToggle(tr);
        if(navigator.vibrate){ try{ navigator.vibrate(15); }catch(_){} }
      }, 500);
    }, { passive:true });
    TSALES.addEventListener("touchmove", function(e){
      var t = e.touches[0];
      if(Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10){ clearTimeout(lpT); lpPend = false; }
    }, { passive:true });
    TSALES.addEventListener("touchend", function(){ clearTimeout(lpT); lpPend = false; }, { passive:true });
    TSALES.addEventListener("touchcancel", function(){ clearTimeout(lpT); lpPend = false; }, { passive:true });
    // أندرويد بيفتح قايمته هو مع الضغطة الطويلة — نمنعها وإحنا بنعدّ أو بعد ما اخترنا
    TSALES.addEventListener("contextmenu", function(e){ if(lpPend || lpFired) e.preventDefault(); });
    // capture: قبل ما دوسة السطر تفتح التفاصيل
    TSALES.addEventListener("click", function(e){
      if(lpFired){ lpFired = false; e.stopPropagation(); e.preventDefault(); return; }
      if(!(mq && mq.matches) || !TSALES.classList.contains("sel-mode")) return;
      var tr = e.target.closest("tr.order");
      if(!tr || skip(e.target)) return;
      e.stopPropagation(); e.preventDefault(); selToggle(tr);
    }, true);
  })();

  // مربعات الاختيار + شريط الإجراء
  TSALES.addEventListener("change", function(e){
    var cb = e.target.closest("[data-sel]");
    if(cb){
      if(cb.checked) selSales[cb.dataset.sel] = 1; else delete selSales[cb.dataset.sel];
      var tr = cb.closest("tr"); if(tr) tr.classList.toggle("sel", cb.checked);
      renderBulkBar();
      return;
    }
    if(e.target.id === "s-selall"){
      var on = e.target.checked;
      Array.prototype.forEach.call(TSALES.querySelectorAll("[data-sel]"), function(x){
        x.checked = on;
        if(on) selSales[x.dataset.sel] = 1; else delete selSales[x.dataset.sel];
        var r = x.closest("tr"); if(r) r.classList.toggle("sel", on);
      });
      renderBulkBar();
    }
  });
  document.getElementById("s-bulk").addEventListener("click", function(e){
    var b = e.target.closest("[data-bulk]");
    if(b){ bulkRun(b.dataset.bulk, null); return; }
    if(e.target.id === "b-bulk-clear"){ selSales = {}; renderSales(); }
  });
  document.getElementById("s-bulk-st").addEventListener("change", function(){
    if(!this.value) return;
    var v = this.value; this.value = "";
    bulkRun("status", v);
  });

  // فتح وقفل سطر التفاصيل
  // أوردر واحد مفتوح في المرة — تفاصيله في اللوحة جنب القايمة
  function toggleDetail(id){
    var was = !!openRows[id];
    openRows = {}; if(!was) openRows[id] = 1;
    renderSales();
    var tr = document.querySelector("#t-sales tr[data-row='"+id+"']");
    if(tr) tr.focus({ preventScroll:true });
  }
  function closeDetail(){ if(!Object.keys(openRows).length) return; openRows = {}; renderSales(); }
  // الأسهم: الأوردر اللي فوقه/تحته في القايمة من غير ما تقفل اللوحة
  function navDetail(dir){
    var ids = Array.prototype.map.call(document.querySelectorAll("#t-sales tr.order"), function(tr){ return tr.dataset.row; });
    var cur = Object.keys(openRows)[0], i = ids.indexOf(cur);
    var j = i + (dir === "next" ? 1 : -1);
    if(i < 0 || j < 0 || j >= ids.length){ toast(dir === "next" ? "ده آخر أوردر في القايمة" : "ده أول أوردر في القايمة"); return; }
    openRows = {}; openRows[ids[j]] = 1;
    renderSales();
    var tr = document.querySelector("#t-sales tr[data-row='" + ids[j] + "']");
    if(tr) tr.scrollIntoView({ block:"nearest" });
  }
  TSALES.addEventListener("click", function(e){
    var t;
    if((t = e.target.closest("[data-snav]"))){ e.stopPropagation(); navDetail(t.dataset.snav); return; }
    if(e.target.closest("[data-sclose]")){ e.stopPropagation(); closeDetail(); return; }
    if((t = e.target.closest("[data-rowout]"))){ e.stopPropagation(); markOut(t.dataset.rowout); return; }
  }, true);
  /* capture: بيتشاف قبل معالج الدرج — لو الدرج أو الصورة المكبّرة مفتوحين، Esc بتاعهم هما
     (من غيرها الدرج بيتقفل الأول وبعدين ده بيلاقي مفيش درج فبيقفل اللوحة كمان) */
  window.addEventListener("keydown", function(e){
    if(e.key !== "Escape" || activeTab !== "sales" || !Object.keys(openRows).length) return;
    if(document.querySelector(".drawer.on, .as-drawer.on, #sale-drawer.on")) return;
    var mm = document.getElementById("me-menu"); if(mm && !mm.hidden) return;
    var z = document.getElementById("img-zoom"); if(z && !z.hidden) return;
    var lk = document.getElementById("lock"); if(lk && !lk.hidden) return;
    closeDetail();
  }, true);
  // مكان اللوحة: جنب الجدول على الشاشة الواسعة، وبتمشي معاه وانت بتسكرول
  function placeSide(){
    var on = !!document.querySelector("#t-sales tr.detail");
    var av = document.getElementById("s-allview");
    if(!av) return;
    av.classList.toggle("side-on", on);
    var pan = document.querySelector("#t-sales tr.detail .detail-in"), wrap = av.querySelector(".s-wrap");
    if(!pan || !wrap || window.innerWidth < 1366){ if(pan){ pan.style.left = ""; pan.style.top = ""; pan.style.maxHeight = ""; } return; }
    var r = wrap.getBoundingClientRect(), box = av.getBoundingClientRect();
    var top = Math.max(12, r.top);
    pan.style.left = Math.round(box.left) + "px";
    pan.style.top = Math.round(top) + "px";
    pan.style.maxHeight = Math.round(window.innerHeight - top - 12) + "px";
  }
  window.addEventListener("scroll", function(){ if(activeTab === "sales") placeSide(); }, { passive:true });
  window.addEventListener("resize", function(){ if(activeTab === "sales") placeSide(); });
  // الرسومات بتتحسب بعرض الشاشة — لو اتغيّر نرسمها تاني
  // (شريط العنوان في الموبايل بيطلّع resize وإنت بتسكرل — من غير ما العرض يتغيّر)
  var vzResize = null, vzLastW = 0;
  window.addEventListener("resize", function(){
    if(activeTab !== "viz") return;
    clearTimeout(vzResize);
    vzResize = setTimeout(function(){
      var h = document.getElementById("vz-wf"), w = h ? h.clientWidth : 0;
      if(w && w !== vzLastW){ vzLastW = w; renderViz(); }
    }, 150);
  });
  TSALES.addEventListener("click", function(e){
    // الأزرار جوه السطر ليها معالجاتها الخاصة
    if(e.target.closest("button,select,input,a,[data-zoom]")) return;
    var tr = e.target.closest("tr.order");
    if(tr) toggleDetail(tr.dataset.row);
  });
  TSALES.addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var tr = e.target.closest ? e.target.closest("tr.order") : null;
    if(tr && e.target === tr){ e.preventDefault(); toggleDetail(tr.dataset.row); }
  });

  // فلاتر الخزنة
  document.getElementById("b-cfilters").addEventListener("click", function(){
    var pnl = document.getElementById("cash-filters");
    pnl.hidden = !pnl.hidden;
    this.setAttribute("aria-expanded", String(!pnl.hidden));
  });
  ["cf-dir","cf-kind","cf-src","cf-from","cf-to"].forEach(function(id){
    document.getElementById(id).addEventListener("change", function(){ readCashFilters(); resetPage("cash"); renderCash(); });
  });
  document.getElementById("cf-text").addEventListener("input", function(){ readCashFilters(); resetPage("cash"); renderCash(); });
  document.getElementById("cf-chips").addEventListener("click", function(e){
    var rm = e.target.closest("[data-rmcf]");
    if(rm){
      var el = document.getElementById(CF_ID[rm.dataset.rmcf]);
      if(el){ el.value = ""; readCashFilters(); resetPage("cash"); renderCash(); }
      return;
    }
    if(e.target.id === "b-clearcf"){
      Object.keys(CF_ID).forEach(function(k){
        var el = document.getElementById(CF_ID[k]); if(el) el.value = "";
      });
      readCashFilters(); resetPage("cash"); renderCash();
    }
  });

  // شرايط الحالة — بتحرّك نفس الفلتر اللي في اللوحة عشان يفضلوا متزامنين
  document.getElementById("s-tabs").addEventListener("click", function(e){
    var b = e.target.closest("[data-stab]"); if(!b) return;
    document.getElementById("flt-status").value = b.dataset.stab;
    readFilters(); resetPage("sales"); renderSales();
  });

  // الفلاتر المطوية + الـ chips
  document.getElementById("b-filters").addEventListener("click", function(){
    var pnl = document.getElementById("filters-panel");
    pnl.hidden = !pnl.hidden;
    this.setAttribute("aria-expanded", String(!pnl.hidden));
  });
  document.getElementById("flt-chips").addEventListener("click", function(e){
    var rm = e.target.closest("[data-rmflt]");
    if(rm){
      var id = { status:"flt-status", party:"flt-party", item:"flt-item", ship:"flt-ship",
                 owner:"flt-owner", from:"flt-from", to:"flt-to", text:"flt-text" }[rm.dataset.rmflt];
      var el = document.getElementById(id);
      if(el){ el.value = ""; readFilters(); resetPage("sales"); renderSales(); }
      return;
    }
    if(e.target.id === "b-clearf"){
      ["flt-status","flt-party","flt-item","flt-ship","flt-owner","flt-from","flt-to","flt-text"]
        .forEach(function(x){ var el = document.getElementById(x); if(el) el.value = ""; });
      readFilters(); resetPage("sales"); renderSales();
    }
  });

  // تعديل التاريخ من سطر التفاصيل
  TSALES.addEventListener("change", function(e){
    var el = e.target.closest("[data-date]"); if(!el) return;
    var rec = db.sales.find(function(x){ return x.id === el.dataset.date; });
    if(!rec) return;
    if(saleLocked(rec) || isLocked(el.value)){ el.value = rec.date || today();
      toast("التاريخ ده في فترة مقفولة"); return; }
    if(!el.value){ el.value = rec.date || today(); return; }
    rec.date = el.value; rec.editedBy = me || "غير محدد"; rec.at = Date.now();
    saveSoon("sales"); renderAll(); toast("التاريخ بقى " + rec.date);
  });

  /* v170: تحصيل دفعة النهارده. الخزنة بتسجّل كل دفعة يومها (pays)، و«خلص» بتعدّ الأوردر
     يوم ما اتحصّل آخر قرش (paidAt). قبل كده الدفعات كلها كانت بتتسجّل في يوم آخر دفعة،
     والدفعة القديمة (قبل الإصدار ده) بتتحفظ بيومها الأول. */
  function addPay(rec, add){
    if(!rec.paidAt) rec.dep = Number(rec.paid)||0;
    if(!Array.isArray(rec.pays)){
      var prev = Math.round(((Number(rec.paid)||0) - (Number(rec.dep)||0)) * 100) / 100;
      rec.pays = rec.paidAt && prev > 0.009 ? [{ d:rec.paidAt, a:prev }] : [];
    }
    rec.pays.push({ d:today(), a:Math.round(add * 100) / 100 });
    rec.paid = (Number(rec.paid)||0) + add;
    rec.paidAt = today();
  }
  /* تحصيل سريع: العميل دفع الباقي وإنت واقف في الجدول.
     نفس الحواجز اللي في الدرج — الفترة المقفولة، وشحن من غير اسم شركة. */
  function quickPay(id, all){
    var rec = db.sales.find(function(x){ return x.id === id; });
    if(!rec) return;
    if(saleLocked(rec)){ toast("الأوردر ده في فترة مقفولة — مينفعش يتعدّل"); return; }
    if(!isDelivered(rec)){ toast("سجّل الأول إن العميل استلم (خطوة ٣) — وبعدين التحصيل", 4200); return; }
    // أوردر الشركة: العميل دفع للمندوب وقت الاستلام — مفيش تحصيل منه بعد كده
    if(viaShip(rec)){ toast("العميل بيدفع لـ " + (squish(rec.shipCo) || "شركة الشحن") +
      " وقت الاستلام — فلوسك بتستلمها من «شركات الشحن»", 4200); return; }
    var due = saleTotal(rec) + shipIn(rec) - (Number(rec.paid)||0);
    var box = document.querySelector("[data-qp='" + id + "']");
    var add = all ? due : Number(toEn(box ? box.value : ""))||0;
    if(!(add > 0)){ toast("اكتب المبلغ اللي اتحصّل"); if(box) box.focus(); return; }
    if(add > due + 0.009){ toast("المبلغ أكبر من الباقي (" + money(due) + ")"); return; }
    addPay(rec, add);
    rec.editedBy = me || "غير محدد"; rec.at = Date.now();
    saveSoon("sales"); renderAll();
    var left = due - add;
    toast("اتحصّل " + money(add) +
          (left > 0.009 ? " · باقي " + money(left) : " · الأوردر خلص"));
  }

  /* ---------- زراير الخطوة الجاية ---------- */
  TSALES.addEventListener("click", function(e){
    // خطوة ٢: يفتح التعديل ويحط المؤشر في أول خانة ناقصة
    var sh = e.target.closest("[data-stepship]");
    if(sh){
      e.stopPropagation();
      var r0 = db.sales.find(function(x){ return x.id === sh.dataset.stepship; });
      startEditSale(sh.dataset.stepship);
      setTimeout(function(){
        var f = document.getElementById(r0 && !squish(r0.shipCo) ? "e-shipco" : "e-shipcode");
        if(f){ f.focus(); f.scrollIntoView({block:"center"}); }
      }, 120);
      return;
    }
    // خطوة ٣: نتيجة المعاينة — بتعدّي من setSaleStatus زي القايمة بالظبط
    var go = e.target.closest("[data-stepgo]");
    if(go){
      e.stopPropagation();
      var pr = go.dataset.stepgo.split("|");
      var rec = db.sales.find(function(x){ return x.id === pr[0]; });
      if(!rec) return;
      var ok = setSaleStatus(rec, pr[1] === "none" ? "cancelled" : "delivered");
      if(ok && pr[1] === "part"){
        // خانة المرتجع بتظهر مع «مسلّم» — نوديك عليها على طول
        setTimeout(function(){
          var r = document.querySelector("#t-sales tr.detail[data-detail='" + rec.id + "'] .retin");
          if(r){ r.focus(); r.scrollIntoView({block:"center"}); }
          toast("اكتب عدد المرتجع جنب كل صنف رجع");
        }, 150);
      }
      return;
    }
    // خطوة ٣ في أوردر قديم: العميل دفع للمندوب تمن اللي خده
    var fx = e.target.closest("[data-fixpaid]");
    if(fx){
      e.stopPropagation();
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      var r3 = db.sales.find(function(x){ return x.id === fx.dataset.fixpaid; });
      if(!r3 || saleLocked(r3)) return;
      var cut = syncShipPaid(r3);
      if(!cut){ toast("مفيش حاجة تتصحّح"); return; }
      r3.editedBy = me || "غير محدد"; r3.at = Date.now();
      saveSoon("sales"); renderAll();
      toast("اتسجّل: العميل دفع " + money(Number(r3.paid)||0) + " لـ " + (squish(r3.shipCo) || "الشركة") +
            " — مش عليه حاجة خلاص", 4200);
      return;
    }
    // خطوة ٤: استلم فلوسك من الشركة — شاشة الشركة والمبلغ مكتوب
    var dw = e.target.closest("[data-stepdraw]");
    if(dw){
      e.stopPropagation();
      var r4 = db.sales.find(function(x){ return x.id === dw.dataset.stepdraw; });
      if(!r4) return;
      openShipDraw(squish(r4.shipCo), shipPend(r4).upto);
      return;
    }
    // خطوة ٥: كل القطع الراجعة وصلت
    var ab = e.target.closest("[data-allback]");
    if(ab){
      e.stopPropagation();
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      var s2 = db.sales.find(function(x){ return x.id === ab.dataset.allback; });
      if(!s2) return;
      var n = 0;
      SL(s2).forEach(function(l, i){
        if(lineHeld(l, s2) > 0 && !lineBack(l, s2)){ markLineBack(s2.id, i, false); n += lineHeld(l, s2); }
      });
      renderAll();
      toast(n ? "اتسجّل إن " + qty(n) + " قطعة رجعت المخزن" : "مفيش حاجة معلّقة");
      return;
    }
  }, true);

