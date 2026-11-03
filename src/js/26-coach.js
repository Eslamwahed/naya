  /* ================= الرسم الكسول =================
     قبل كده كل حفظة كانت بتعيد رسم الـ١٢ شاشة كلهم — بما فيهم جدول
     مبيعات بآلاف الصفوف مخفي ورا. على موبايل متوسط ده كان بيوصل
     لـ١٨ ثانية للحركة الواحدة. دلوقتي بنرسم الشاشة المفتوحة بس،
     والباقي بيتعلّم "محتاج رسم" وبيترسم أول ما تفتحه. */
  /* ================= ماشي إزاي؟ (v121) =================
     تقييم الشغل من الحركات نفسها — مفيش ولا رقم بيتكتب بإيد، وبيتحدّث مع
     أي حركة (renderAll بيعلّم الشاشة محتاجة رسم). الأرقام من نفس الدوال
     اللي بتحسب التقارير والرئيسية: periodStats · expProfit · stageLists ·
     cashBox · walletsTotal · netAssets · totalEquity — فالرقم هنا = الرقم هناك.
     المسطرة (✓ ⚠ ✗) ثابتة ومكتوبة جنب كل مؤشر:
       هامش البضاعة: ✓ 40% أو أكتر · ✗ أقل من 30%
       الإعلان على الأوردر: ✓ أقل من تلت ربح بضاعة الأوردر · ✗ أكتر من النص
       الشحن: ✓ العميل بيدفع زي الشركة · ✗ أكتر من 25 من جيبك في الأوردر
       الرفض: بيتحسب من 5 أوردرات خلصوا · ✓ أقل من 10% · ✗ 20% أو أكتر */
  var coPer = "all";
  var CO_SHIP_BAD = 25, CO_STOCK_DAYS = 30;
  function coShift(d, n){ var x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function coDiff(a, b){ return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5); }
  function coRange(){
    if(coPer === "all") return null;
    var n = Number(coPer), to = today();
    return { from:coShift(to, -(n - 1)), to:to };
  }
  // عدد أيام الفترة: «من البداية» = من أول أوردر لحد النهارده
  function coDays(r){
    if(r) return coDiff(r.from, r.to) + 1;
    var first = live("sales").reduce(function(a, s){ return s.date && (!a || s.date < a) ? s.date : a; }, "");
    return first ? Math.max(1, coDiff(first, today()) + 1) : 1;
  }
  // البضاعة في الأوردر: اللي اتسلّم بالفعلي (بعد المرتجع)، واللي لسه ماشي بالمتوقع
  function coGoods(s){
    if(isDelivered(s)){
      var g = 0, c = 0;
      SL(s).forEach(function(l){ var q = lineSold(l, s); g += q * (Number(l.price)||0); c += q * lineCost(l); });
      return { goods:g, cost:c };
    }
    var e = expProfit(s); return { goods:e.goods, cost:e.cost };
  }
  function coStats(r){
    var all = live("sales").filter(function(s){ return inRange(s.date, r); });
    var ok = all.filter(function(s){ return !isCancelled(s); });
    var S = { n:ok.length, pcs:0, goods:0, cost:0, gap:0, shipN:0, freeShip:0, lowShip:0, days:coDays(r) };
    ok.forEach(function(s){
      SL(s).forEach(function(l){ S.pcs += Math.max(0, Number(l.qty)||0); });
      var g = coGoods(s); S.goods += g.goods; S.cost += g.cost;
    });
    /* v122 — الفلوس (الهامش والإعلان والشحن) من قايمة الدخل نفسها (projStats «لو كله
       اتسلّم») — فالرقم هنا = الرقم في التقارير والرئيسية بالظبط. الشحن: نفس الأوردرات
       اللي القايمة بتحسب شحنها — اللي خلص (مسلّم أو مرفوض) واللي لسه ماشي. */
    var P = projStats(r), V = P.exp;
    P.c.list.forEach(function(s){
      var open = !isDelivered(s) && !isCancelled(s);
      if(!(shipOut(s) > 0) || !(shipCounts(s) || open)) return;
      S.shipN++;
      if(shipIn(s) <= 0) S.freeShip++; else if(shipIn(s) < shipOut(s)) S.lowShip++;
    });
    S.gap = -V.ship; S.ads = V.ads; S.P = P;
    var done = all.filter(function(s){ return isDelivered(s) || isCancelled(s); });
    S.done = done.length; S.refused = done.filter(isCancelled).length;
    S.perDay = S.n / S.days;
    S.margin = V.margin;
    S.gpOrder = P.n ? V.gross / P.n : 0;
    S.adOrder = P.n && S.ads > 0 ? S.ads / P.n : null;
    S.gapOrder = P.n ? S.gap / P.n : 0;          // زي عمود «على الأوردر» في قايمة الدخل
    return S;
  }
  /* الأصناف: معدّل الطلب (قطع في اليوم من الأوردرات اللي مش ملغية) والمتاح —
     منها «واقف» (بيكفي أكتر من ٣٠ يوم، أو ما اتطلبش خالص من أسبوع شراء)
     و«قرّب يخلص وبيتباع». الفترة ثابتة: آخر ١٤ يوم أو من أول أوردر لو أقصر. */
  function coItems(){
    var to = today(), r = { from:coShift(to, -13), to:to }, days = Math.min(14, coDays(null));
    var ord = {}; live("sales").forEach(function(s){
      if(isCancelled(s) || !inRange(s.date, r)) return;
      SL(s).forEach(function(l){ if(l.itemId) ord[l.itemId] = (ord[l.itemId]||0) + Math.max(0, Number(l.qty)||0); });
    });
    return live("items").map(function(it){
      var buys = live("purchases").filter(function(p){ return p.itemId === it.id; });
      var first = buys.reduce(function(a, p){ return p.date && (!a || p.date < a) ? p.date : a; }, "");
      var fs = freeSplit(it.id), free = fs.pos, stock = Math.max(0, stockOf(it.id)), q = ord[it.id] || 0;
      var rate = q / days, ac = avgCost(it.id);
      var pp = (Number(it.price)||0) > 0 && ac > 0 ? (Number(it.price)||0) - ac : null;
      return { it:it, q:q, rate:rate, free:free, value:stock * ac, pp:pp,
               cover: rate > 0 ? free / rate : null,
               idle: !q && free > 0 && first && coDiff(first, to) >= 7,
               slow: q > 0 && free > 0 && free / rate > CO_STOCK_DAYS && free * ac >= 1000,
               short: q >= 5 && free <= 3, neg:fs.neg };
    });
  }
  function coSet(id, html){ var el = document.getElementById(id); if(el) el.innerHTML = html; }
  function renderCoach(){
    var r = coRange(), S = coStats(r), IT = coItems();
    Array.prototype.forEach.call(document.querySelectorAll("#co-per [data-coper]"), function(b){ b.classList.toggle("on", b.dataset.coper === coPer); });
    var T = [], good = [], bad = [];
    var tile = function(st, stTxt, label, val, sub){ T.push({ st:st, stTxt:stTxt, label:label, val:val, sub:sub }); };
    var top = IT.filter(function(x){ return x.pp !== null; }).sort(function(a, b){ return b.pp - a.pp; });
    var topNames = top.slice(0, 2).map(function(x){ return x.it.name; });

    // ١ الطلب — ومقارنة بالفترة اللي قبلها لو الفترة محددة
    var prev = null;
    if(r){ var n = coDays(r); prev = coStats({ from:coShift(r.from, -n), to:coShift(r.from, -1) }); }
    var down = prev && prev.n >= 3 && S.perDay < prev.perDay * 0.75;
    if(!S.n) tile("bd", "✗ مفيش", "الطلب", "0 أوردر", "مفيش أوردرات في الفترة دي");
    else tile(down ? "wr" : "ok", down ? "⚠ قل" : "✓ كويس", "الطلب",
      qty(Math.round(S.perDay * 10) / 10) + " أوردر/يوم",
      qty(S.n) + " أوردر في " + qty(S.days) + " يوم" + (prev && prev.n ? " · قبلها " + qty(Math.round(prev.perDay * 10) / 10) + "/يوم" : ""));
    if(S.n && !down) good.push("فيه طلب: " + qty(Math.round(S.perDay * 10) / 10) + " أوردر في اليوم.");
    if(down) bad.push(["الأوردرات قلّت عن الفترة اللي قبلها (" + qty(Math.round(S.perDay * 10) / 10) + " بدل " + qty(Math.round(prev.perDay * 10) / 10) + " في اليوم).",
                       "زوّد الإعلان على الأصناف اللي بتكسب" + (topNames.length ? " (" + topNames.join(" · ") + ")" : "")]);

    // ٢ حجم الأوردر
    if(S.n){
      var ppo = S.pcs / S.n, big = ppo >= 1.5;
      tile(big ? "ok" : "wr", big ? "✓ كويس" : "⚠ صغير", "حجم الأوردر",
        qty(Math.round(ppo * 10) / 10) + " قطعة · " + money(S.goods / S.n), "متوسط القطع وقيمة البضاعة في الأوردر");
      if(big) good.push("العميل بياخد " + qty(Math.round(ppo * 10) / 10) + " قطعة في المتوسط.");
      else bad.push(["أغلب الأوردرات قطعة واحدة — والمصاريف على الأوردر مش على القطعة.", "اعرض على العميل قطعة تانية مع الأوردر"]);
    }

    // ٣ هامش البضاعة
    if(S.margin !== null){
      var mp = Math.round(S.margin * 1000) / 10, mst = S.margin >= 0.4 ? "ok" : (S.margin >= 0.3 ? "wr" : "bd");
      tile(mst, mst === "ok" ? "✓ كويس" : (mst === "wr" ? "⚠ ضعيف" : "✗ قليل"), "هامش البضاعة", mp + "%", "من سعر البيع · الهدف 40% أو أكتر");
      if(mst === "ok") good.push("هامش البضاعة " + mp + "%" + (top.length ? " — أكسب صنف: " + top[0].it.name + " (" + qty(Math.round(top[0].pp)) + " في القطعة)" : "") + ".");
      else bad.push(["هامش البضاعة " + mp + "% بس.", "راجع أسعار الأصناف اللي ربحها أقل" +
        (top.length > 1 ? " (" + top.slice(-2).map(function(x){ return x.it.name; }).join(" · ") + ")" : "")]);
    }

    // ٤ الإعلان على الأوردر — مصاريف الخزنة اللي نوعها «إعلانات»
    if(S.adOrder === null) tile("na", "مش متسجّل", "الإعلان على الأوردر", "—", "سجّل مصروف الإعلانات في الخزنة ونوعه «إعلانات»");
    else if(!(S.gpOrder > 0)){
      // البضاعة نفسها مش بتكسب — مفيش نسبة تتحسب ولا حد للحملة
      tile("bd", "✗ عالي", "الإعلان على الأوردر", money(S.adOrder), "إعلانات " + money(S.ads) + " ÷ " + qty(S.P.n) + " أوردر · والبضاعة نفسها مش بتكسب");
      bad.push(["الإعلان بيتكلّف " + money(S.adOrder) + " على الأوردر والبضاعة نفسها مش بتكسب.", "راجع أسعار البيع الأول، وبعدين الإعلان"]);
    } else {
      var share = S.adOrder / S.gpOrder, ast = share <= 1/3 ? "ok" : (share <= 0.5 ? "wr" : "bd");
      tile(ast, ast === "ok" ? "✓ كويس" : (ast === "wr" ? "⚠ عالي" : "✗ عالي"), "الإعلان على الأوردر", money(S.adOrder),
        "إعلانات " + money(S.ads) + " ÷ " + qty(S.P.n) + " أوردر · بياكل " + Math.round(share * 100) + "% من ربح بضاعة الأوردر (" + money(S.gpOrder) + ")");
      if(ast === "ok") good.push("الإعلان بيتكلّف " + money(S.adOrder) + " على الأوردر — في الحدود.");
      else bad.push(["الإعلان بيتكلّف " + money(S.adOrder) + " على الأوردر — بياكل " + Math.round(share * 100) + "% من ربح البضاعة.",
        "وقّف الحملة اللي الأوردر منها فوق " + qty(Math.round(S.gpOrder / 3)) + (topNames.length ? "، وركّز على " + topNames.join(" · ") : "")]);
    }

    // ٥ الشحن من جيبك
    if(S.shipN){
      var gst = S.gapOrder <= 0.005 ? "ok" : (S.gapOrder <= CO_SHIP_BAD ? "wr" : "bd");
      tile(gst, gst === "ok" ? "✓ متغطّي" : (gst === "wr" ? "⚠ من جيبك" : "✗ من جيبك"), "الشحن",
        gst === "ok" ? "متغطّي" : "−" + money(S.gapOrder) + " للأوردر",
        gst === "ok" ? "العميل بيدفع زي الشركة أو أكتر" : money(S.gap) + " ÷ " + qty(S.P.n) + " أوردر · العميل بيدفع أقل من الشركة");
      if(gst === "ok") good.push("الشحن متغطّي من العميل.");
      else bad.push([money(S.gap) + " شحن طلعوا من جيبك" + (S.freeShip || S.lowShip ? " (" +
          [S.freeShip ? qty(S.freeShip) + " أوردر العميل ما دفعش فيهم شحن" : "", S.lowShip ? qty(S.lowShip) + " أقل من الشركة" : ""].filter(Boolean).join(" و") + ")" : "") + ".",
        "خلّي العميل يدفع الشحن زي الشركة، ووقّف الشحن المجاني"]);
    }

    // ٦ الرفض والإلغاء — بعد ٥ أوردرات خلصوا
    if(S.done < 5) tile("na", "لسه بدري", "الرفض والإلغاء", qty(S.refused) + " من " + qty(S.done), "بيتحسب لما 5 أوردرات على الأقل يخلصوا");
    else {
      var rr = S.refused / S.done, rst = rr < 0.1 ? "ok" : (rr < 0.2 ? "wr" : "bd");
      tile(rst, rst === "ok" ? "✓ قليل" : (rst === "wr" ? "⚠ عالي" : "✗ عالي"), "الرفض والإلغاء", Math.round(rr * 100) + "%", qty(S.refused) + " من " + qty(S.done) + " أوردر خلصوا");
      if(rst === "ok") good.push("الرفض والإلغاء " + Math.round(rr * 100) + "% بس.");
      else bad.push([Math.round(rr * 100) + "% من الأوردرات اترفضت أو اتلغت — كل واحد بيكلّفك إعلان وشحن من غير إيراد.", "أكّد مع العميل بالتليفون قبل الشحن"]);
    }

    // v155: أصناف بتخسر بعد الإعلان والشحن والتغليف — مش ظاهرة في أي حتة تانية
    (function(){
      var IP = itemProfit(S.P, false).M;
      var lose = Object.keys(IP).filter(function(id){ return id && IP[id].q > 0 && IP[id].net / IP[id].q < -5; })                 // خسارة أقل من 5 في القطعة = تقريب مش مشكلة
        .sort(function(a, b){ return IP[a].net - IP[b].net; });
      if(lose.length) bad.push([lose.slice(0, 3).map(function(id){ return itemName(id) + " بيخسر " + money(-IP[id].net / IP[id].q) + " في القطعة"; }).join(" · ") +
        " — بعد نصيبه من الإعلان والشحن والتغليف.", "زوّد سعره أو وقّف إعلانه"]);
    })();

    // ٧ الكاش
    var cash = cashBox(), cap = totalCapital();
    tile(cash >= 0 ? "ok" : "bd", cash >= 0 ? "✓ في أمان" : "✗ بالسالب", "الكاش", money(cash),
      cap > 0 ? Math.round(cash / cap * 100) + "% من رأس المال في الخزنة" : "رصيد الخزنة");
    if(cash > 0) good.push("الفلوس في أمان: " + money(cash) + " في الخزنة.");
    if(cash < 0) bad.push(["الخزنة بالسالب " + money(-cash) + ".", "سجّل الفلوس اللي دخلت أو قلّل المشتريات لحد ما تحصّل"]);

    // ٨ البضاعة — تركيز في صنف واحد أو أصناف واقفة
    var sv = IT.reduce(function(a, x){ return a + x.value; }, 0);
    var byVal = IT.slice().sort(function(a, b){ return b.value - a.value; }), big1 = byVal[0];
    // صنف واقف بيتحسب لو حابس فلوس تفرق: 1,000 أو أكتر و10% من البضاعة على الأقل
    IT.forEach(function(x){ if(x.slow && x.free * avgCost(x.it.id) < sv * 0.1) x.slow = false; });
    var conc = sv > 0 && big1 && big1.value / sv > 0.35, stuck = IT.filter(function(x){ return x.slow || x.idle; });
    tile(conc || stuck.length ? "wr" : "ok", conc || stuck.length ? "⚠ مش متوزّعة" : "✓ كويس", "البضاعة", money(sv),
      conc ? Math.round(big1.value / sv * 100) + "% منها في صنف واحد (" + big1.it.name + ")"
           : (stuck.length ? qty(stuck.length) + " صنف واقف" : "بالتكلفة"));
    IT.filter(function(x){ return x.slow; }).sort(function(a, b){ return b.value - a.value; }).slice(0, 2).forEach(function(x){
      bad.push([x.it.name + ": " + qty(x.free) + " قطعة متاحة (" + money(x.free * avgCost(x.it.id)) + ") — بتكفي حوالي " + qty(Math.round(x.cover)) + " يوم بالمعدل ده.", "ما تشتريش منه تاني لحد ما يتحرك"]);
    });
    var idle = IT.filter(function(x){ return x.idle; }).map(function(x){ return x.it.name; });
    if(idle.length) bad.push([idle.join(" و") + ": ولا قطعة اتطلبت في آخر أسبوعين.", "اعمل إعلان أو عرض عليهم"]);

    // الحكم — نفس «صافي الربح» في قايمة الدخل والرئيسية بالظبط
    var en = S.P.nOpen, tn = S.P.exp.net, okBase = S.n > 0 && S.margin !== null && S.margin >= 0.3;
    var badNames = T.filter(function(t){ return t.st === "bd"; }).map(function(t){ return t.label; });
    var vd = !S.n ? { ic:"⚪", cls:"na", t:"مفيش أوردرات في الفترة دي", s:"اختار فترة أطول من فوق." }
      : tn >= 0 ? { ic:"🟢", cls:"ok", t:"ماشي كويس وبتكسب", s:"الأرقام كويسة — كمّل وراقب المؤشرات." }
      : okBase ? { ic:"🟡", cls:"wr", t:(coPer === "all" && S.days <= 30 ? "بداية كويسة — بس لسه مش بتكسب" : "الطلب والهامش كويسين — بس لسه مش بتكسب"),
                   s: badNames.length ? badNames.join(" و") + " بياكلوا الربح." : "المصاريف لسه أكبر من الربح." }
      : { ic:"🔴", cls:"bd", t:"بتخسر", s:"شوف «اللي محتاج يتظبط» تحت." };
    coSet("co-verdict", "<div class='co-vd " + vd.cls + "'><span class='co-ic' aria-hidden='true'>" + vd.ic + "</span>" +
      "<div class='co-vt'><b>" + esc(vd.t) + "</b><span>" + esc(vd.s) + "</span></div>" +
      (S.n ? "<div class='co-exp money-only'><small>" + (en ? "لو الأوردرات اللي ماشية اتسلّمت" : "صافي الربح في الفترة") + "</small>" +
        "<b class='num " + (tn >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(tn)) + "</b><small>بعد كل المصاريف المسجّلة</small></div>" : "") + "</div>");
    coSet("co-tiles", T.map(function(t){
      return "<div class='co-t " + t.st + "'><span class='co-st'>" + esc(t.stTxt) + "</span><small>" + esc(t.label) + "</small>" +
        "<b class='num'>" + esc(t.val) + "</b><span class='co-sub'>" + esc(t.sub) + "</span></div>";
    }).join(""));
    coSet("co-good", "<h3 class='v-gain'>✓ اللي ماشي كويس</h3>" + (good.length
      ? good.map(function(x){ return "<p class='co-li'>" + esc(x) + "</p>"; }).join("") : "<p class='co-li hint'>لسه مفيش — كمّل.</p>"));
    coSet("co-bad", "<h3 class='v-due'>⚠ اللي محتاج يتظبط</h3>" + (bad.length
      ? bad.map(function(x){ return "<p class='co-li'>" + esc(x[0]) + "<span class='co-act'>← " + esc(x[1]) + "</span></p>"; }).join("")
      : "<p class='co-li hint'>مفيش حاجة — كله في الحدود ✓</p>"));
    renderCoachTodo(IT);
    renderCoachBal();
  }
  /* نصايح المشتريات — v173: المهام اليومية (اشحن · حصّل · تابع · المرتجع · اشتري للأوردرات) في الرئيسية بس،
     هنا اللي بيحتاج قرار: اطلب تاني · ما تشتريش */
  function renderCoachTodo(IT){
    var D = [];
    // زرار لشاشة مش من حقك ما يظهرش أصلاً (نفس قاعدة الرئيسية)
    var add = function(t, s, go, lab){ if(!canTab(go.split("|")[0])) return; D.push("<button type='button' class='co-td' data-cgo='" + esc(go) + "'><b>" + esc(t) + "</b><span>" + esc(s) + "</span><em>" + esc(lab) + " ←</em></button>"); };
    IT.filter(function(x){ return x.short; }).sort(function(a, b){ return b.q - a.q; }).slice(0, 2).forEach(function(x){
      add("اطلب " + x.it.name + " تاني", "اتطلب منه " + qty(x.q) + " في آخر أسبوعين وفاضل " + qty(x.free) +
        (x.neg ? " · وناقص " + qty(x.neg) : ""), "purch", "فاتورة شراء");
    });
    var slow = IT.filter(function(x){ return x.slow; }).sort(function(a, b){ return b.value - a.value; })[0];
    if(slow) add("ما تشتريش " + slow.it.name, "عندك " + qty(slow.free) + " قطعة = حوالي " + qty(Math.round(slow.cover)) + " يوم بيع بالمعدل ده", "inv", "المخزون");
    coSet("co-todo", D.length ? D.slice(0, 6).join("") : "<p class='hint' style='margin:0'>مفيش نصايح دلوقتي — المخزون ماشي مع البيع ✓ · المهام اليومية في الرئيسية</p>");
  }
  // فلوسك فين — نفس أرقام «توفيق الميزانية» في رأس المال
  function renderCoachBal(){
    var a = netAssets(), e = totalEquity(), d = a - e, dues = reconDues(), w = walletsTotal(), sv = a - cashBox() - w - dues;
    var P = function(l, v){ return "<span class='co-p'><small>" + esc(l) + "</small><b class='num'>" + esc(money(v)) + "</b></span>"; };
    var parts = [P("الخزنة", cashBox()), P("بضاعة", sv)];
    if(Math.abs(w) >= 0.01) parts.push(P("عند شركات الشحن", w));
    if(Math.abs(dues) >= 0.01) parts.push(P("عند العملاء والموردين", dues));
    var re = retainedEarnings();
    coSet("co-bal-badge", Math.abs(d) < 0.01 ? "<span class='co-okb'>✓ الميزانية مظبوطة</span>"
      : canTab("capital") ? "<button type='button' class='co-badb' data-cgo='capital'>⚠ فيه فرق " + esc(money(d)) + " — شوف رأس المال</button>"
      : "<span class='co-badb'>⚠ فيه فرق " + esc(money(d)) + "</span>");
    coSet("co-bal", parts.join("<span class='co-op'>+</span>") + "<span class='co-op'>=</span>" + P("كل اللي عندك", a) +
      "<span class='co-op'>=</span>" + P("رأس المال " + money(totalCapital()) + (re < 0 ? " − الخسارة لحد النهارده" : " + الأرباح"), e));
  }
  document.getElementById("co-per").addEventListener("click", function(e){
    var b = e.target.closest("[data-coper]"); if(!b) return;
    coPer = b.dataset.coper; renderCoach();
  });
  document.getElementById("tab-coach").addEventListener("click", function(e){
    var t = e.target.closest("[data-cgo]"); if(!t) return;
    var q = t.dataset.cgo.split("|");
    if(!canTab(q[0])){ toast("مالكش صلاحية الشاشة دي"); return; }
    if(q[0] === "sales"){ goTab("sales"); setSView(q[1]); window.scrollTo(0, 0); return; }
    goTab(q[0]);
  });

