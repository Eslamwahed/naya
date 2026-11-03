  /* ---------- شركات الشحن: الأحداث ---------- */
  document.getElementById("t-shipco").addEventListener("click", function(e){
    var dr = e.target.closest("[data-shdraw]");
    if(dr){
      e.stopPropagation();
      openShipDraw(dr.dataset.shdraw, null);
      return;
    }
    var tr = e.target.closest("[data-shco]"); if(!tr) return;
    // نفس السطر تاني = قفل، زي سطر تفاصيل الأوردر في المبيعات
    var same = (shipFor !== null && shipFor === tr.dataset.shco);
    shipFor = same ? null : tr.dataset.shco;
    markShipRow();
    renderShipStmt();
    if(!same) document.getElementById("shstmt-panel").scrollIntoView({ block:"nearest" });
  });
  document.getElementById("t-shipco").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var tr = e.target.closest("[data-shco]"); if(!tr) return;
    e.preventDefault(); tr.click();
  });
  document.getElementById("b-shstmt-close").addEventListener("click", function(){
    shipFor = null; markShipRow(); renderShipStmt();
  });
  // من الكشف للأوردر نفسه
  document.getElementById("t-shstmt").addEventListener("click", function(e){
    var tr = e.target.closest("[data-shorder]"); if(!tr) return;
    startEditSale(tr.dataset.shorder);
  });

  /* خانة الاستلام متعبّية — من سطر الشركة (الرصيد كله) أو من خطوة ٤
     في الأوردر (اللي يقفل الأوردر ده والأقدم منه). */
  function openShipDraw(co, amt){
    if(activeTab !== "ship") goTab("ship");
    shipFor = co;
    markShipRow(); renderShipStmt();
    var bal = shipCoStats(co).bal;
    var v = (amt === null || amt === undefined) ? bal : Math.min(amt, bal);
    var box = document.getElementById("sh-draw-amt");
    var dt  = document.getElementById("sh-draw-date");
    if(dt && !dt.value) dt.value = today();
    var val = String(Math.round(Math.max(v, 0) * 100) / 100);
    if(box) box.value = val;                           // الكشف القديم (مطوي تحت)
    // كارت الشركة: «استلم جزء» مفتوح والمبلغ مكتوب
    shcPart = squish(co); renderShipCards();
    var inp = document.querySelector("[data-shcamt='" + squish(co) + "']");
    if(inp){
      inp.value = val;
      setTimeout(function(){ inp.scrollIntoView({ block:"center" }); try{ inp.focus(); inp.select(); }catch(err){} }, 80);
    }
    toast("المبلغ مكتوب — دوس «سجّل»، أو غيّره لو استلمت جزء", 4200);
  }

  /* استلام فلوس من الشركة = حركة خزنة نوعها settle. بتخصم من محفظتها
     وتدخل الخزنة — نفس اللي بيتعمل يدوي من شاشة الخزنة، بس من هنا
     الرقم والشركة متعبّيين لوحدهم فمفيش غلط في الاسم. */
  function shipDraw(all){
    if(shipFor === null) return;
    var o = shipCoStats(shipFor), bal = o.bal;
    var box = document.getElementById("sh-draw-amt");
    var amt = all ? bal : Number(toEn(box ? box.value : ""))||0;
    var d = document.getElementById("sh-draw-date").value || today();
    if(!(amt > 0)){ toast("اكتب المبلغ اللي استلمته"); if(box) box.focus(); return; }
    if(amt > bal + 0.009){ toast("المبلغ أكبر من رصيدك عندها (" + money(bal) + ")"); return; }
    if(!squish(shipFor)){ toast("الأوردرات دي من غير اسم شركة — افتحها واكتب الاسم الأول"); return; }
    if(!guardLock(d, "الاستلام")) return;
    db.cash.push(stamp({ date:d, type:"settle", partyId:"", amount:amt,
      shipCo:squish(shipFor), note:"استلام من " + squish(shipFor) }));
    if(box) box.value = "";
    saveSoon("cash"); renderAll();
    var left = bal - amt;
    toast("اتسجّل استلام " + money(amt) +
          (left > 0.009 ? " · باقي لك " + money(left) : " · خلص رصيدك عندها"));
  }
  document.getElementById("b-sh-draw").addEventListener("click", function(){ shipDraw(false); });
  document.getElementById("b-sh-drawall").addEventListener("click", function(){ shipDraw(true); });
  document.getElementById("sh-draw-amt").addEventListener("keydown", function(e){
    if(e.key === "Enter"){ e.preventDefault(); shipDraw(false); }
  });

  function renderVersion(){
    var bd = document.getElementById("ver-badge");
    if(bd) bd.textContent = "إصدار " + VERSION;
    var vn = document.getElementById("ver-num");
    if(vn) vn.textContent = VERSION;
    var vd = document.getElementById("ver-date");
    if(vd) vd.textContent = CHANGELOG.length ? CHANGELOG[0].d : "";
    var box = document.getElementById("changelog");
    if(!box) return;
    /* السجل بقى عشرات الإصدارات وكان بيطوّل شاشة الإعدادات لوحده
       بآلاف البكسلات. آخر ٥ بيكفوا، والباقي بضغطة. */
    var row = function(c, i){
      return "<details class='explain'" + (i === 0 ? " open" : "") + ">" +
        "<summary>إصدار " + esc(c.v) + " · " + esc(c.d) + "</summary>" +
        "<div class='xbody'><ul style='margin:0;padding-inline-start:18px;display:grid;gap:var(--sp-1)'>" +
        c.items.map(function(x){
          return "<li style='font-size:var(--fs-3);color:var(--ink-soft)'>" + esc(x) + "</li>"; }).join("") +
        "</ul></div></details>";
    };
    var SHOW = 5;
    var rest = CHANGELOG.length > SHOW
      ? "<details class='explain'><summary>" +
        plural(CHANGELOG.length - SHOW, "إصدار أقدم", "إصدارين أقدم", "إصدارات أقدم") +
        "</summary><div class='xbody'>" +
        CHANGELOG.slice(SHOW).map(function(c){ return row(c, 1); }).join("") +
        "<p class='hint'>الإصدارات قبل 142 في ملف CHANGELOG.md على GitHub.</p></div></details>"
      : "";
    box.innerHTML = CHANGELOG.slice(0, SHOW).map(row).join("") + rest;
  }

