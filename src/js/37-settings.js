  /* ================= الأرصدة الافتتاحية وإقفال الفترة ================= */

  function renderOpening(){
    var el = document.getElementById("t-opening");
    if(!el) return;

    var rows = [];
    live("cash").filter(function(c){ return c.type==="opening"; }).forEach(function(c){
      rows.push({ d:c.date, t:"خزنة", who:"—",
        v:money(Number(c.amount)||0), cls:"", id:c.id, list:"cash" });
    });
    live("purchases").filter(function(p){ return p.opening; }).forEach(function(p){
      var vl = vLabel(vColor(p), vSize(p));
      rows.push({ d:p.date, t:"بضاعة", who: itemName(p.itemId) + (vl ? " ("+vl+")" : ""),
        v: qty(Number(p.qty)||0) + " × " + money(p.cost) + " = " + money(purchTotal(p)),
        cls:"", id:p.id, list:"purchases" });
    });
    live("cash").filter(function(c){ return c.type==="opening_party"; }).forEach(function(c){
      var a = Number(c.amount)||0;
      rows.push({ d:c.date, t:(a>=0 ? "ليك عند" : "عليك لـ"), who:partyName(c.partyId),
        v:money(Math.abs(a)), cls:(a>=0?"v-gain":"v-due"), id:c.id, list:"cash" });
    });
    rows.sort(function(a,b){ return (a.d||"") < (b.d||"") ? -1 : 1; });

    table("t-opening", ["التاريخ","النوع","الجهة / الصنف","القيمة",""],
      rows.map(function(r){
        return "<tr><td class='num'>"+esc(r.d||"—")+"</td><td>"+esc(r.t)+"</td>"+
          "<td class='wide'>"+esc(r.who)+"</td>"+
          "<td class='num "+r.cls+"'>"+esc(r.v)+"</td>"+
          "<td><button class='del' data-del='"+r.list+"' data-id='"+r.id+"'>حذف</button></td></tr>";
      }), "مفيش أرصدة افتتاحية — لو البيزنس بدأ مع السيستم مش محتاجها.");

    var st = document.getElementById("opening-state");
    if(st){
      if(!hasOpening()){
        st.textContent = "مفيش أرصدة افتتاحية مسجّلة — التقارير بتبدأ من أول حركة سجّلتها.";
        st.className = "note";
      } else {
        var stockVal = live("purchases").filter(function(p){ return p.opening; })
          .reduce(function(a,p){ return a + purchTotal(p); }, 0);
        var due = live("cash").filter(function(c){ return c.type==="opening_party"; })
          .reduce(function(a,c){ return a + (Number(c.amount)||0); }, 0);
        st.textContent = "خزنة " + money(openingCash()) + " · بضاعة " + money(stockVal) +
          " · صافي أرصدة الجهات " + money(due);
        st.className = "note ok";
      }
    }
  }

  function renderLock(){
    var st = document.getElementById("lock-state");
    var un = document.getElementById("b-unlock");
    if(!st) return;
    var L = lockDate();
    if(L){
      var n = live("sales").filter(function(x){ return saleLocked(x); }).length;
      st.textContent = "الفترة مقفولة لحد " + L + " — " + qty(n) + " أوردر محمي من التعديل والحذف.";
      st.className = "note ok";
    } else {
      st.textContent = "مفيش فترة مقفولة — أي حركة قديمة ممكن تتعدّل وتغيّر تقارير قفلتها.";
      st.className = "note";
    }
    if(un) un.hidden = !L;
    var inp = document.getElementById("lock-until");
    if(inp && !inp.value) inp.value = L || "";
  }

  document.getElementById("b-lock").addEventListener("click", function(){
    var v = document.getElementById("lock-until").value;
    if(!v){ toast("اختر التاريخ الأول"); return; }
    if(v >= today()){
      toast("اقفل لتاريخ عدّى — لو قفلت النهاردة مش هتقدر تسجّل حركات النهاردة");
      return;
    }
    settings.lockedUntil = v;
    saveSettings(); renderLock(); renderAll();
    toast("الفترة اتقفلت لحد " + v);
  });

  // الفتح بخطوتين — مش حركة عابرة
  document.getElementById("b-unlock").addEventListener("click", function(){
    if(this.dataset.armed !== "1"){
      this.dataset.armed = "1";
      this.textContent = "متأكد؟ الأرقام هتبقى قابلة للتغيير";
      var b = this;
      setTimeout(function(){
        if(b.dataset.armed === "1"){ b.dataset.armed = ""; b.textContent = "افتح الفترة"; }
      }, 5000);
      return;
    }
    this.dataset.armed = ""; this.textContent = "افتح الفترة";
    settings.lockedUntil = "";
    saveSettings(); renderLock(); renderAll();
    toast("الفترة اتفتحت — التعديل مسموح تاني");
  });

  document.getElementById("b-ob-cash").addEventListener("click", function(){
    var d = document.getElementById("ob-date").value || today();
    var a = Number(document.getElementById("ob-cash").value)||0;
    if(!a){ toast("اكتب المبلغ"); return; }
    if(!guardLock(d, "الرصيد الافتتاحي")) return;
    db.cash.push(stamp({ date:d, type:"opening", amount:a, partyId:"", shipCo:"",
      note:"رصيد افتتاحي" }));
    document.getElementById("ob-cash").value = "";
    saveSoon("cash"); renderAll(); toast("اتسجّل رصيد الخزنة الافتتاحي");
  });

  document.getElementById("b-ob-stock").addEventListener("click", function(){
    var d  = document.getElementById("ob-date").value || today();
    var it = document.getElementById("ob-item").value;
    var q  = Number(document.getElementById("ob-qty").value)||0;
    var c  = Number(document.getElementById("ob-cost").value)||0;
    if(!it || !q){ toast("اختر الصنف واكتب الكمية"); return; }
    if(!c){ toast("اكتب تكلفة القطعة — من غيرها الربح هيطلع غلط"); return; }
    var col = document.getElementById("ob-color").value;
    var sz  = document.getElementById("ob-size").value;
    var miss = variantMissing(it, col, sz);
    if(miss){ toast(miss); return; }
    if(!guardLock(d, "الرصيد الافتتاحي")) return;
    // فاتورة شراء بمدفوع صفر ومن غير مورد: بتدخل المخزون والتكلفة بس
    db.purchases.push(stamp({ date:d, partyId:"", itemId:it, color:col, size:sz,
      qty:q, cost:c, paid:0, opening:true, note:"مخزون افتتاحي" }));
    ["ob-qty","ob-cost"].forEach(function(x){ document.getElementById(x).value = ""; });
    saveSoon("purchases"); renderAll(); toast("اتسجّلت البضاعة الافتتاحية");
  });

  document.getElementById("b-ob-party").addEventListener("click", function(){
    var d  = document.getElementById("ob-date").value || today();
    var pid = document.getElementById("ob-party").value;
    var a  = Number(document.getElementById("ob-amount").value)||0;
    var dir = Number(document.getElementById("ob-dir").value)||1;
    if(!pid || !a){ toast("اختر الجهة واكتب المبلغ"); return; }
    if(!guardLock(d, "الرصيد الافتتاحي")) return;
    db.cash.push(stamp({ date:d, type:"opening_party", partyId:pid, amount:Math.abs(a)*dir,
      shipCo:"", note:"رصيد افتتاحي" }));
    document.getElementById("ob-amount").value = "";
    saveSoon("cash"); renderAll(); toast("اتسجّل الرصيد الافتتاحي للجهة");
  });

  document.getElementById("ob-item").addEventListener("change", function(){
    fillVariantSelects("ob", this.value);
  });

  /* ---------- الإعدادات: كل لوحة بتتفتح وتتقفل من عنوانها ----------
     ٩ لوحات في skroll واحد بطول ٦٠٣٥ بكسل. اللي بتحتاجه كل يوم
     مفتوح، والباقي بضغطة. الاختيار بيتفكر في نفس الجلسة. */
  var FOLD_OPEN = { "المزامنة بين الأجهزة":1, "التخزين":1, "مين بيشوف إيه":1 };
  function foldSettings(){
    var sec = document.getElementById("tab-backup");
    if(!sec) return;
    Array.prototype.forEach.call(sec.querySelectorAll(".panel"), function(pn){
      if(pn.dataset.fold) return;
      var h = pn.querySelector("h3");
      if(!h || h.parentNode !== pn) return;
      pn.dataset.fold = "1";
      var body = document.createElement("div");
      body.className = "foldbody";
      while(h.nextSibling) body.appendChild(h.nextSibling);
      pn.appendChild(body);
      h.classList.add("foldhead");
      h.setAttribute("role", "button");
      h.tabIndex = 0;
      var key = squish(h.textContent);
      h.setAttribute("aria-expanded", FOLD_OPEN[key] ? "true" : "false");
      pn.classList.toggle("open", !!FOLD_OPEN[key]);
      var flip = function(){
        var on = !pn.classList.contains("open");
        pn.classList.toggle("open", on);
        h.setAttribute("aria-expanded", on ? "true" : "false");
        FOLD_OPEN[key] = on ? 1 : 0;
      };
      h.addEventListener("click", flip);
      h.addEventListener("keydown", function(e){
        if(e.key === "Enter" || e.key === " "){ e.preventDefault(); flip(); }
      });
    });
  }

  /* ---------- كروت لوحة المتابعة: كل رقم بيتفتح ---------- */
  document.getElementById("kpis").addEventListener("click", function(e){
    var c = e.target.closest("[data-kpi]"); if(!c) return;
    kpiOpen = (kpiOpen === c.dataset.kpi) ? null : c.dataset.kpi;
    renderKPIs();
    if(kpiOpen) document.getElementById("kpi-panel").scrollIntoView({ block:"nearest" });
  });
  document.getElementById("kpis").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var c = e.target.closest("[data-kpi]"); if(!c) return;
    e.preventDefault(); c.click();
  });
  document.getElementById("b-kpi-close").addEventListener("click", function(){
    kpiOpen = null; renderKPIs();
  });
  // من أي سطر في التفاصيل للأوردر نفسه
  document.getElementById("t-kpi").addEventListener("click", function(e){
    var a = e.target.closest("[data-goorder]"); if(!a) return;
    e.preventDefault(); startEditSale(a.dataset.goorder);
  });

  /* ---------- كروت المخزون: نفس السلوك ---------- */
  document.getElementById("inv-kpis").addEventListener("click", function(e){
    var c = e.target.closest("[data-invkpi]"); if(!c) return;
    invKpiOpen = (invKpiOpen === c.dataset.invkpi) ? null : c.dataset.invkpi;
    renderInventory();
    if(invKpiOpen) document.getElementById("inv-kpi-panel").scrollIntoView({ block:"nearest" });
  });
  document.getElementById("inv-kpis").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var c = e.target.closest("[data-invkpi]"); if(!c) return;
    e.preventDefault(); c.click();
  });
  document.getElementById("b-invkpi-close").addEventListener("click", function(){
    invKpiOpen = null; renderInventory();
  });
  document.getElementById("t-invkpi").addEventListener("click", function(e){
    var a = e.target.closest("[data-goorder]"); if(!a) return;
    e.preventDefault(); startEditSale(a.dataset.goorder);
  });

