  /* ---------- الشراء: وحدة الشراء ومصاريف النقل ----------
     السجل بيتخزّن دايماً بـ qty = عدد القطع و cost = تكلفة القطعة واصلة المخزن،
     فكل حسابات المخزون والربح شغالة عليهم زي ما هي. الحقول الجديدة (packs/packQty/
     packCost/freight) للعرض والتعديل وللتفرقة بين دَين المورد وقيمة المخزون.
     السجلات القديمة مالهاش الحقول دي، فبترجع لنفس سلوكها الأول بالظبط. */
  function pPackQty(p){ var n = Number(p && p.packQty)||0; return n > 0 ? n : 1; }
  function pPacks(p){
    if(p && p.packs != null && p.packs !== "") return Number(p.packs)||0;
    return Number(p && p.qty)||0;                     // قديم: الوحدة = القطعة
  }
  function pPackCost(p){
    if(p && p.packCost != null && p.packCost !== "") return Number(p.packCost)||0;
    return Number(p && p.cost)||0;
  }
  function pPackName(p){ return ((p && p.packName) || "").trim(); }
  // مرتجع للمورد = شراء بكمية بالسالب. كل معادلات المخزون والمتوسط
  // بتتعامل معاه صح من غير أي استثناء: الرصيد بيقل، ومتوسط التكلفة
  // بيتحسب على اللي فضل (مصاريف النقل بتفضل على البضاعة اللي عندك).
  function isPRet(p){ return !!(p && (p.isReturn || (Number(p.qty)||0) < 0)); }
  function pFreight(p){ return Number(p && p.freight)||0; }
  // الواصل للمخزن = بضاعة + نقل. ده اللي بيتحط في قيمة المخزون (IAS 2.11)
  function purchTotal(p){ return (Number(p.qty)||0)*(Number(p.cost)||0); }
  // اللي للمورد = البضاعة بس. النقل بيتدفع للناقل مش للمورد
  function goodsTotal(p){ return purchTotal(p) - pFreight(p); }
  // ربح البضاعة (المسلّم بس)
  function goodsProfit(s){
    if(!isDelivered(s)) return 0;
    return SL(s).reduce(function(a,l){
      return a + ((Number(l.price)||0) - lineCost(l)) * lineSold(l,s);
    },0);
  }
  // صافي الأوردر بعد الشحن — الملغي بيطلع بالسالب بقيمة شحنه
  /* v113 — الربح المتوقع لأوردر لسه ما اتسلّمش: لو العميل خد كله. نفس حسبة
     «صافي الربح المتوقع» في درج الأوردر (v99): البضاعة − تكلفتها بمتوسط الشراء
     النهارده + شحن على العميل − شحن للشركة. صنف لسه ما اتشراش (مالوش تكلفة
     ومش متثبّتة) بيطلع بره الحسبة بدل ما سعره كله يتحسب ربح. */
  /* الأوردر لسه ما اتسلّمش: الربح الفعلي بيتحسب بعد التسليم، بس بنوريك المتوقع
     لو اتسلّم زي ما هو — نفس رقم «صافي الربح المتوقع» في «مع المندوب». */
  function ddExpProfit(s){
    var e = expProfit(s);
    return "<div class='dd-profit money-only'><span>صافي الربح المتوقع لو اتسلّم" +
        "<small>بضاعة " + esc(money(e.goods)) + " − تكلفتها " + esc(money(e.cost)) +
          (e.sin || e.sout ? " · شحن " + esc(money(e.sin)) + " − " + esc(money(e.sout)) : "") + "</small>" +
        (e.noCost.length ? "<small class='v-due' style='display:block'>" + esc(e.noCost.join(" · ")) + " لسه ما اتشراش — تكلفته مش معروفة فمش داخل في الحسبة</small>" : "") +
      "</span><b class='num " + (e.net >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(e.net)) + "</b></div>";
  }
  function expProfit(s){
    var goods = 0, cost = 0, noCost = [];
    SL(s).forEach(function(l){
      var q = Number(l.qty)||0; if(!l.itemId || q <= 0) return;
      var pinned = l.unitCost != null && l.unitCost !== "", uc = lineCost(l);
      if(uc > 0 || pinned){ goods += q * (Number(l.price)||0); cost += q * uc; }
      else if(noCost.indexOf(itemName(l.itemId)) < 0) noCost.push(itemName(l.itemId));
    });
    var sin = shipIn(s), sout = shipOut(s);
    return { goods: goods, cost: cost, sin: sin, sout: sout, ship: sin - sout,
             net: goods - cost + sin - sout, noCost: noCost };
  }
  /* الشاشة الجانبية: تحليل الربح المتوقع لكل أوردر في المرحلة */
  var expStage = null;
  function renderExp(){
    var g = stageLists(), list = (g.st[expStage] || []);
    var T = { goods:0, cost:0, sin:0, sout:0, net:0 }, nc = 0;
    var rows = list.map(function(s){
      var e = expProfit(s);
      ["goods","cost","sin","sout","net"].forEach(function(k){ T[k] += e[k]; });
      if(e.noCost.length) nc++;
      var gp = e.goods - e.cost;
      return "<tr><td class='wide'><a href='#' class='ono' data-expgo='" + esc(s.id) + "'>#" + esc(s.no || "—") + "</a> " +
          esc(partyName(s.partyId)) + "<span class='sub'>" + esc(itemsLabel(s)) + "</span>" +
          (e.noCost.length ? "<span class='sub v-due'>⚠ " + esc(e.noCost.join(" · ")) + ": لسه ما اتشراش — بره الحسبة</span>" : "") + "</td>" +
        "<td class='num'>" + money(e.goods) + "</td>" +
        "<td class='num'>" + money(e.cost) + "</td>" +
        "<td class='num " + (gp >= 0 ? "v-gain" : "v-due") + "'>" + money(gp) + "</td>" +
        "<td class='num'>" + money(e.sin) + "</td>" +
        "<td class='num'>" + money(e.sout) + "</td>" +
        "<td class='num " + (e.ship >= 0 ? "v-gain" : "v-due") + "'>" + money(e.ship) + "</td>" +
        "<td class='num " + (e.net >= 0 ? "v-gain" : "v-due") + "' style='font-weight:700'>" + money(e.net) + "</td></tr>";
    });
    if(rows.length) rows.push("<tr class='tot'><td>الإجمالي · " + qty(list.length) + " أوردر</td>" +
      "<td class='num'>" + money(T.goods) + "</td><td class='num'>" + money(T.cost) + "</td>" +
      "<td class='num'>" + money(T.goods - T.cost) + "</td><td class='num'>" + money(T.sin) + "</td>" +
      "<td class='num'>" + money(T.sout) + "</td><td class='num'>" + money(T.sin - T.sout) + "</td>" +
      "<td class='num " + (T.net >= 0 ? "v-gain" : "v-due") + "'>" + money(T.net) + "</td></tr>");
    table("t-exp", ["الأوردر","سعر البيع","سعر الشراء","ربح البضاعة","شحن على العميل","شحن للشركة","صافي الشحن","صافي الربح المتوقع"],
      rows, "مفيش أوردرات في المرحلة دي.");
    var n = document.getElementById("exp-note");
    if(n) n.innerHTML = rows.length
      ? "لو الـ" + esc(qty(list.length)) + " أوردر اتسلّموا كلهم زي ما هم: هتبيع بضاعة بـ <b>" + esc(money(T.goods)) +
        "</b> تكلفتها عليك <b>" + esc(money(T.cost)) + "</b> (بمتوسط سعر الشراء)، والشحن " +
        (T.sin - T.sout >= 0 ? "هيكسّبك <b>" + esc(money(T.sin - T.sout)) + "</b>" : "هيطلع من جيبك <b>" + esc(money(T.sout - T.sin)) + "</b>") +
        " — يعني صافي ربحك <b class='" + (T.net >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(T.net)) + "</b>." +
        " الرقم متوقع: لو عميل رجّع أو رفض الربح الفعلي هيقل، والربح بيتسجّل في الحسابات لما الأوردر يتسلّم بس." +
        (nc ? " <span class='v-due'>" + esc(qty(nc)) + " أوردر فيهم صنف لسه ما اتشراش — بره الحسبة.</span>" : "")
      : "";
  }
  function openExp(stage){
    expStage = stage;
    var t = document.getElementById("exp-title");
    if(t) t.textContent = "صافي الربح المتوقع — " + (stage === "2" ? "الأوردرات اللي مع المندوب" : "الأوردرات");
    renderExp();
    var box = document.getElementById("exp-drawer"), sc = document.getElementById("gen-scrim");
    box.hidden = false; sc.hidden = false;
    requestAnimationFrame(function(){ box.classList.add("on"); sc.classList.add("on"); });
  }
  function closeExp(quick){
    var box = document.getElementById("exp-drawer"), sc = document.getElementById("gen-scrim");
    if(!box || box.hidden) return;
    expStage = null;
    box.classList.remove("on"); if(!openEntryKey) sc.classList.remove("on");
    var done = function(){ if(expStage) return; box.hidden = true; if(!openEntryKey) sc.hidden = true; };
    if(quick) done(); else setTimeout(done, 240);
  }
  function saleProfit(s){
    var net = goodsProfit(s);
    if(shipCounts(s)) net += shipIn(s) - shipOut(s);
    return net;
  }

  /* قصة فلوس الأوردر في مكان واحد — كل الشاشات بتقراها من هنا عشان
     الأرقام ما تختلفش من شاشة لشاشة. ثلاث حتت:
       داخل  = بضاعة + شحن على العميل  (ده اللي العميل عليه)
       خارج  = تكلفة البضاعة + مدفوع لشركة الشحن
       الربح = داخل − خارج
     مصاريف الشحن اللي مش محمّلة على العميل بتطلع من جيبك — والرقم ده
     كان مخفي في «صافي الشحن» بالسالب، ومحدش بيفهمه. */
  function saleMoney(s){
    var goods = saleTotal(s), canc = isCancelled(s), deliv = isDelivered(s);
    var sIn = shipCounts(s) ? shipIn(s) : 0;
    var sOut = shipCounts(s) ? shipOut(s) : 0;
    var cost = deliv ? SL(s).reduce(function(a,l){
      return a + lineCost(l) * lineSold(l,s); },0) : 0;
    var paid = canc ? shipIn(s) : (Number(s.paid)||0);
    return {
      goods: goods,                  // البضاعة بسعر البيع
      shipIn: sIn,                   // شحن محمّل على العميل
      owed: goods + sIn,             // المطلوب من العميل
      paid: paid,                    // المحصّل منه
      due: deliv ? (goods + sIn - paid) : 0,
      cost: cost,                    // تكلفة البضاعة اللي خرجت
      shipOut: sOut,                 // مدفوع لشركة الشحن
      outlay: cost + sOut,           // إجمالي اللي طلع منك
      pocket: sOut - sIn,            // شحن من جيبك (بالسالب يبقى كسبت من الشحن)
      profit: saleProfit(s),
      known: deliv || canc           // لسه ما اتسلّمش؟ التكلفة والربح مش متحددين
    };
  }

  /* الأوردر اللي تحصيله عن طريق شركة الشحن: العميل لسه عليه فلوس فعلاً
     (البضاعة اتسلّمت والفلوس ما وصلتش)، بس إنت مش هتجري وراه — الشركة
     هي اللي هتحصّل. فالمديونية لازم تتقسم في العرض: إيه اللي عليك تجريه
     من العميل، وإيه اللي مستني من الشركة. الميزانية زي ما هي. */
  function dueViaShip(id){
    var v = 0;
    live("sales").forEach(function(s){
      if(s.partyId !== id || !viaShip(s) || !isDelivered(s)) return;
      var d = saleTotal(s) + shipIn(s) - (Number(s.paid)||0);
      if(d > 0.009) v += d;
    });
    return v;
  }

  function partyBalance(id){
    var bal = 0;
    live("sales").forEach(function(s){
      if(s.partyId !== id) return;
      // المسلّم بيعمل مديونية: بضاعة + شحن محصّل − اللي اتدفع
      if(isDelivered(s)){ bal += saleTotal(s) + shipIn(s) - (Number(s.paid)||0); return; }
      // لسه ما اتسلّمش: اللي دفعه عربون — فلوسه عندك وإنت مدين له بيها.
      // قبل كده كان بيدخل الخزنة من غير التزام مقابل، فالميزانية تختل.
      if(!isCancelled(s)) bal -= (Number(s.paid)||0);
    });
    live("purchases").forEach(function(p){
      // المخزون الافتتاحي مالوش مورد — قيمته اتسجّلت في حقوق الملكية
      // (openingStock)، فلو اتحسبت كمان مديونية تبقى اتعدّت مرتين
      if(p.opening) return;
      if(p.partyId===id) bal -= goodsTotal(p) - (Number(p.paid)||0);
      // استبدال: المورد حسب القطعة بأقل من تكلفتها — الفرق بيقلّل اللي ليك عنده
      if(p.partyId===id && p.xloss) bal -= Number(p.xloss)||0;
    });
    live("cash").forEach(function(c){
      if(c.partyId!==id) return;
      if(isCapType(c.type)) return;                              // رأس مال — مش مديونية
      if(c.type==="opening_party") bal += Number(c.amount)||0;   // موجب = ليك عنده
      if(c.type==="in")  bal -= Number(c.amount)||0;
      if(c.type==="out") bal += Number(c.amount)||0;
    });
    return bal; // موجب = ليك عنده، سالب = عليك له
  }
  function cashBox(){
    var v=0;
    live("sales").forEach(function(s){
      if(viaShip(s)) return;                      // الفلوس دي في محفظة شركة الشحن مش في الخزنة
      if(isCancelled(s)) v += shipIn(s);
      else v += Number(s.paid)||0;
      if(shipCounts(s)) v -= shipOut(s);
    });
    live("purchases").forEach(function(p){ v -= (Number(p.paid)||0) + pFreight(p); });
    live("cash").forEach(function(c){
      var a = Number(c.amount)||0;
      // معالجة صريحة: قبل كده أي نوع مجهول كان بيتعامل كخروج بالغلط
      if(isCapType(c.type)) { v += CAP[c.type].cash * a; return; }   // رأس مال وشركاء
      if(c.type === "opening")      v += a;    // رصيد افتتاحي للخزنة
      else if(c.type === "opening_party") return;  // ده بيأثّر على رصيد الجهة بس
      else if(c.type === "in" || c.type === "settle") v += a;
      else if(c.type === "out" || (c.type === "expense" && !c.paidBy)) v -= a;   // v142: شريك دفعه من جيبه
    });
    return v;
  }

