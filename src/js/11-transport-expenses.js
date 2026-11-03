  /* ---------- انتقالات شراء البضاعة على تكلفة القطعة ----------
     كل مصروف «انتقالات شراء بضاعة» بيتربط بفواتير الشراء اللي في نفس يومه،
     ولو مفيش: بأقرب يوم فيه فاتورة لحد ٣ أيام قبل أو بعد (الأقرب، ولو
     اتساووا الأقدم). المبلغ بيتوزّع على سطور الفواتير دي حسب قيمتها،
     فكل قطعة بتشيل نصيبها. القطع اللي اتباعت نصيبها بيدخل في تكلفة
     البضاعة المباعة، واللي لسه على الرف نصيبها جوّه قيمة المخزون.
     مشوار مالوش فاتورة في الـ٣ أيام بيفضل مصروف ثابت عادي (unlinked).
     ما بيتخزّنش حاجة — بيتحسب من الداتا مع كل رسم، وبيتصفّر مع فهرس المخزون. */
  var _tidx = null;
  function trIdx(){
    if(_tidx) return _tidx;
    var byDate = {}, dates = [];
    live("purchases").forEach(function(p){
      if(isPRet(p) || !p.date || !(purchTotal(p) > 0)) return;
      if(!byDate[p.date]){ byDate[p.date] = []; dates.push(p.date); }
      byDate[p.date].push(p);
    });
    var T = { byP:{}, trD:{}, link:{}, unlinked:[], total:0, perV:{}, perI:{}, perC:{}, qV:{}, qI:{}, qC:{} };
    /* مشوار في فترة مقفولة ما يتربطش بفاتورة بعد القفل — وإلا فاتورة جديدة كانت
       هتشيل مصروف من شهر مقفول وتغيّر ربحه */
    var lk = lockDate();
    live("cash").forEach(function(c){
      if(c.type !== "expense" || expCat(c) !== "trans") return;
      var amt = Number(c.amount)||0; if(!(amt > 0)) return;
      var shut = lk && c.date && c.date <= lk;
      var d = byDate[c.date] ? c.date : "";
      if(!d && c.date){
        var best = null;
        dates.forEach(function(x){
          var n = Math.abs(daysBetween(c.date, x));
          if(n > 3 || (shut && x > lk)) return;    // ٣ أيام قبل أو بعد
          if(!best || n < best.n || (n === best.n && x < best.d)) best = { d:x, n:n };
        });
        if(best) d = best.d;
      }
      if(!d){ T.unlinked.push(c.id); return; }
      var ps = byDate[d], sum = ps.reduce(function(a, p){ return a + purchTotal(p); }, 0);
      T.link[c.id] = d; T.total += amt;
      ps.forEach(function(p){ T.byP[p.id] = (T.byP[p.id]||0) + amt * purchTotal(p) / sum; if(c.date > (T.trD[p.id]||"")) T.trD[p.id] = c.date; });
    });
    // الكميات بنفس طريقة avgCost (المرتجع للمورد بيطرح) — عشان نصيب القطعة يتحسب من غير لفة على المشتريات
    live("purchases").forEach(function(p){
      var a = T.byP[p.id] || 0, q = Number(p.qty)||0;
      var k = vKey(p.itemId, vColor(p), vSize(p)), kc = p.itemId + "\u0001" + vColor(p);
      T.qV[k] = (T.qV[k]||0) + q; T.qI[p.itemId] = (T.qI[p.itemId]||0) + q; T.qC[kc] = (T.qC[kc]||0) + q;
      if(!a) return;
      T.perV[k] = (T.perV[k]||0) + a; T.perI[p.itemId] = (T.perI[p.itemId]||0) + a; T.perC[kc] = (T.perC[kc]||0) + a;
    });
    _tidx = T;
    return T;
  }
  function trLinked(c){ return !!(c && trIdx().link[c.id]); }
  /* ═══ v142 — المصروف على مدته · المدفوع مقدّماً · حساب فيسبوك · الشريك يدفع من جيبه ═══
     قايمة الدخل بتحسب المصروف في الأيام اللي استفدت منه فيها، مش يوم الدفع (أساس الاستحقاق — IAS 1.27):
       · اشتراك: شهر من يوم الدفع (أو المدة اللي تكتبها). اللي لسه أيامه ما جتش = مدفوع مقدّماً.
       · شحن رصيد فيسبوك: اللي دخل الحساب أصل، ورسوم فوري مصروف على طول (cat "metatop", credit = اللي دخل).
         صرف فيسبوك بين كل مطابقتين = الرصيد اللي فات + الشحن − الرصيد دلوقتي، موزّع على أيامها (فيه ضريبة 14%).
       · أي مصروف تاني (تغليف، مرة واحدة، مرتبات…) يوم الدفع زي ما هو.
     paidBy = شريك دفع المصروف من جيبه: الخزنة ما بتتلمسش، والشركة عليها له لحد «رجّعناله» (cap_repay). */
  var SVC_DAYS = { subs:30 };
  /* المدة الافتراضية بتشتغل على المصاريف من يوم الإصدار ده وطالع بس — اللي قبله (والشهور المقفولة)
     بيفضل يوم الدفع زي ما كان، إلا لو المدة متكتبة على المصروف نفسه (svcDays). */
  var SVC_FROM = "2026-10-10";
  function svcDefault(cat, date){ return (date || "") >= SVC_FROM ? (SVC_DAYS[cat] || 1) : 1; }
  var SVC_OPTS = [[1, "يوم الدفع"], [7, "أسبوع"], [30, "شهر"], [90, "٣ شهور"], [365, "سنة"]];
  var META_MAX_GAP = 7;                                                       // أيام من غير مطابقة قبل التذكير
  function isMetaTop(c){ return c && c.type === "expense" && c.cat === "metatop"; }
  function metaCredit(c){ var v = Number(c.credit); return isFinite(v) && c.credit !== "" && c.credit != null ? v : Number(c.amount)||0; }
  function metaFee(c){ return Math.max(0, (Number(c.amount)||0) - metaCredit(c)); }
  function svcOf(c){
    var d = Number(c.svcDays) || svcDefault(expCat(c), c.date);
    return { from: c.svcFrom || c.date, days: Math.max(1, Math.round(d)) };
  }
  function svcTo(c){ var s = svcOf(c); return addDays(s.from, s.days - 1); }
  // نصيب مبلغ موزّع على days يوم من from، جوه الفترة r ولحد النهارده بس
  function shareIn(from, days, amount, r){
    if(!from || !amount) return 0;
    var b = addDays(from, days - 1), t = today(), a = from;
    if(b > t) b = t;
    if(r){ if(r.from && r.from > a) a = r.from; if(r.to && r.to < b) b = r.to; }
    if(a > b) return 0;
    return amount * (daysBetween(a, b) + 1) / days;
  }
  function metaRecs(){
    return (settings.metaRec || []).filter(function(x){ return x && x.d; })
      .slice().sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  }
  function metaTops(){ return live("cash").filter(isMetaTop); }
  // الشحنة بعد المطابقة؟ نفس اليوم: بالوقت اللي اتسجّلت فيه (مطابقة من غير وقت = آخر اليوم)
  // made = وقت تسجيل الشحنة أول مرة (التعديل ما بيغيّروش) — الشحنات القديمة من غيره بتتحسب قبل مطابقة نفس اليوم
  function afterRec(c, R){ return !!R && (c.date > R.d || (c.date === R.d && (c.made||0) > (R.at == null ? Infinity : R.at))); }
  // فترات المطابقة: كل فترة اتصرف فيها كام وعلى كام يوم
  var _mspan = null;                                                         // بيتصفّر في renderAll
  function metaSpans(){
    if(_mspan) return _mspan;
    var tops = metaTops(), out = [], prevD = "", prevB = 0, prevR = null;
    metaRecs().forEach(function(x){
      var cr = 0, first = "";
      tops.forEach(function(c){ if((!prevR || afterRec(c, prevR)) && !afterRec(c, x)){ cr += metaCredit(c); if(!first || c.date < first) first = c.date; } });
      var from = prevD ? addDays(prevD, 1) : (first || x.d);
      out.push({ from:from, to:x.d, days:daysBetween(from, x.d) + 1, start:prevB, credit:cr, bal:Number(x.bal)||0,
                 spent:Math.round((prevB + cr - (Number(x.bal)||0)) * 100) / 100 });
      prevD = x.d; prevB = Number(x.bal)||0; prevR = x;
    });
    _mspan = out;
    return out;
  }
  function metaSpendIn(r){
    return metaSpans().reduce(function(a, s){ return a + shareIn(s.from, s.days, s.spent, r); }, 0);
  }
  // رصيد فيسبوك دلوقتي في الدفاتر: آخر مطابقة + اللي اتشحن بعدها (صرف ما بعد المطابقة لسه ما اتحسبش)
  function metaBook(){
    var R = metaRecs(), last = R.length ? R[R.length - 1] : null, after = 0, t = today();
    metaTops().forEach(function(c){ if(!last || afterRec(c, last)) after += metaCredit(c); });   // حتى لو تاريخها جاي — الخزنة اتخصمت
    return { last:last, after:after, bal:(last ? Number(last.bal)||0 : 0) + after };
  }
  // نصيب المصروف من الفترة (قايمة الدخل)
  function expAmtIn(c, r){
    if(isMetaTop(c)) return inRange(c.date, r) ? metaFee(c) : 0;
    var s = svcOf(c);
    if(s.days <= 1) return inRange(c.date, r) ? Number(c.amount)||0 : 0;        // يوم الدفع — زي ما كان بالظبط
    return shareIn(s.from, s.days, Number(c.amount)||0, r);
  }
  // المدفوع مقدّماً: المصاريف اللي أيامها لسه ما جتش + رصيد فيسبوك
  function prepaidList(){
    var t = today(), L = [];
    live("cash").forEach(function(c){
      if(c.type !== "expense" || trLinked(c) || isMetaTop(c) || !c.date) return;      // تاريخها جاي: كلها مقدّم
      var s = svcOf(c); if(s.days <= 1) return;
      var a = Number(c.amount)||0, left = a - shareIn(s.from, s.days, a, null);
      if(left > 0.004) L.push({ c:c, left:left, to:svcTo(c), from:s.from, days:s.days });
    });
    return L;
  }
  // المطابقة دي تنفع؟ ما ينفعش رصيد أكبر من اللي اتشحن (كان هيطلع إعلان بالسالب = ربح وهمي)
  function metaRecsOk(L){
    var keep = settings.metaRec, bad;
    settings.metaRec = L; _mspan = null;
    try{ bad = metaSpans().filter(function(s){ return s.spent < -0.009; })[0] || null; }
    finally{ settings.metaRec = keep; _mspan = null; }
    return bad;
  }
  function prepaidTotal(){
    return prepaidList().reduce(function(a, x){ return a + x.left; }, 0) + metaBook().bal;
  }
  // الشريك دفع من جيبه: الشركة عليها له كام
  function owedOf(id){
    var v = 0;
    live("cash").forEach(function(c){
      if(c.type === "expense" && c.paidBy === id) v += Number(c.amount)||0;
      if(c.type === "cap_repay" && c.partyId === id) v -= Number(c.amount)||0;
    });
    return Math.round(v * 100) / 100;
  }
  function owedTotal(){ return partners().reduce(function(a, p){ return a + owedOf(p.id); }, 0); }
  // v142: مصاريف الفترة على أساس الاستحقاق — من expByCat عشان الرقمين يفضلوا واحد
  function expensesIn(r, kind){
    var X = expByCat(r), v = 0;
    EXP_CATS.forEach(function(x){ if(!kind || (kind === "var" ? x[2] === "var" : x[2] !== "var")) v += X[x[0]]; });
    return v + (!kind || kind === "var" ? xLossIn(r) : 0);
  }
  // مصاريف الفترة بالنوع — من غير الانتقالات اللي اتحطت على البضاعة
  function expByCat(r){
    var o = {}; EXP_CATS.forEach(function(x){ o[x[0]] = 0; });
    live("cash").forEach(function(c){
      if(c.type !== "expense" || trLinked(c)) return;
      if(isMetaTop(c)){ o.ads += expAmtIn(c, r); return; }               // رسوم فوري
      o[expCat(c)] += expAmtIn(c, r);
    });
    o.ads += metaSpendIn(r);                                              // اللي فيسبوك صرفه فعلاً (بالضريبة)
    o.metatop = 0;
    return o;
  }
  // خسارة (أو مكسب) الاستبدال مع المورد — مصروف متغيّر من غير خزنة
  function xLossIn(r){
    return live("purchases").reduce(function(a, p){
      return a + (p.xloss && inRange(p.date, r) ? (Number(p.xloss)||0) : 0); }, 0) +
      costTrueUps().reduce(function(a, x){ return a + (inRange(x.d, r) ? x.v : 0); }, 0);
  }
  /* v169 — فرق تكلفة: لون/مقاس خلص من المخزن وفضل عليه تكلفة (مشوار نقل اتسجّل بعد ما اتباع،
     أو تكلفة اتثبّتت قبل المتوسط المتحرّك). الفرق بيتحسب مصروف «فرق تكلفة» في يوم آخر حركة عليه
     (أو أول يوم بعد القفل) بدل ما يفضل قيمة مخزون على رف فاضي. */
  var _tu = null;
  function costTrueUps(){
    if(_tu && _tu.at === _sidx && _tu.t === _tidx) return _tu.L;
    var T = trIdx(), V = {};
    var g = function(k, it){ return V[k] = V[k] || { itemId:it, q:0, v:0, d:"" }; };
    var mx = function(o, d){ if(d && d > o.d) o.d = d; };
    live("purchases").forEach(function(p){
      if(!p.itemId) return;
      var o = g(keyOf(p), p.itemId); o.q += Number(p.qty)||0; o.v += purchTotal(p) + (T.byP[p.id]||0);
      mx(o, p.date); mx(o, T.trD[p.id]);
    });
    live("sales").forEach(function(s){
      if(!isDelivered(s)) return;
      SL(s).forEach(function(l){
        if(!l.itemId) return;
        var o = g(keyOf(l), l.itemId), n = lineSold(l, s); o.q -= n; o.v -= n * lineCost(l); mx(o, revDate(s));
      });
    });
    var lk = lockDate(), L = [];
    Object.keys(V).forEach(function(k){
      var o = V[k];
      if(Math.abs(o.q) > 0.0001 || Math.abs(o.v) < 1) return;       // كسور التقريب تحت الجنيه بتفضل زي ما هي
      var d = o.d || today(); if(lk && d <= lk) d = addDays(lk, 1);
      L.push({ k:k, itemId:o.itemId, d:d, v:Math.round(o.v * 100) / 100 });
    });
    stockIdx(); _tu = { at:_sidx, t:_tidx, L:L };
    return L;
  }

  // ملخص أرقام الفترة
  function periodStats(r){
    var list = salesIn(r);
    var deliv = list.filter(isDelivered);
    var revenue = deliv.reduce(function(a,s){ return a+saleTotal(s); },0);
    var profit  = list.reduce(function(a,s){ return a+goodsProfit(s); },0);
    // تكلفة البضاعة المباعة: الإيراد ناقص مجمل الربح — بنطلّعها رقم لوحدها
    var cogs    = deliv.reduce(function(a,s){
      return a + SL(s).reduce(function(b,l){ return b + lineCost(l) * lineSold(l,s); },0); },0);
    var netShip = list.reduce(function(a,s){ return a + (shipCounts(s) ? shipIn(s)-shipOut(s) : 0); },0);
    var exp     = expensesIn(r);
    var fixedExp = expensesIn(r, "fixed"), varExp = expensesIn(r, "var");
    /* هامش المساهمة = الإيراد − كل التكاليف المتغيّرة.
       المتغيّر هنا: تكلفة البضاعة + صافي تكلفة الشحن + المصاريف المتغيّرة.
       (netShip موجب يعني كسبت من الشحن، فبيزوّد الهامش مش بينقّصه.) */
    var varCost = cogs - netShip + varExp;
    var cm      = revenue - varCost;
    return { list:list, deliv:deliv, revenue:revenue, profit:profit, cogs:cogs,
             netShip:netShip, expenses:exp, fixedExp:fixedExp, varExp:varExp,
             varCost:varCost, cm:cm, cmPct: revenue ? cm / revenue : 0,
             net: profit + netShip - exp };
  }

  /* v122 — قايمة الدخل الموحّدة. رقم واحد بيتعرض في الرئيسية والتقارير و«ماشي إزاي؟»:
     الفعلي (periodStats — اللي اتسلّم والملغي) + الأوردرات اللي لسه ماشية لو اتسلّمت
     (expProfit)، والمصاريف بأنواعها. «على الأوردر» = المبلغ ÷ عدد أوردرات الفترة كلها
     (الملغي داخل — فلوس الإعلان اتصرفت عليه برضه). */
  function projStats(r){
    var c = periodStats(r), X = expByCat(r), xl = xLossIn(r);
    var A = { sin:0, sout:0 }, E = { goods:0, cost:0, sin:0, sout:0, net:0 }, nc = 0;
    c.list.forEach(function(s){ if(shipCounts(s)){ A.sin += shipIn(s); A.sout += shipOut(s); } });
    var open = c.list.filter(function(s){ return !isDelivered(s) && !isCancelled(s); });
    open.forEach(function(s){
      var e = expProfit(s);
      E.goods += e.goods; E.cost += e.cost; E.sin += e.sin; E.sout += e.sout; E.net += e.net;
      if(e.noCost.length) nc++;
    });
    var mk = function(goods, cost, sin, sout, n){
      var v = { goods:goods, cost:cost, gross:goods - cost, sin:sin, sout:sout, ship:sin - sout, n:n,
                ads:X.ads, pack:X.pack, xloss:xl, othervar:X.othervar, subs:X.subs, salary:X.salary, once:X.once, trans:X.trans, other:X.other };
      // المتغيّر والثابت من EXP_CATS نفسها — نوع جديد بيتحسب لوحده في الناحية الصح
      v.varExp = v.xloss; v.fixedExp = 0;
      EXP_CATS.forEach(function(x){ if(x[2] === "var") v.varExp += X[x[0]]; else v.fixedExp += X[x[0]]; });
      v.contrib = v.gross + v.ship - v.varExp;
      v.net = v.contrib - v.fixedExp;
      v.margin = goods > 0.009 ? v.gross / goods : null;
      return v;
    };
    var done = c.list.length - open.length;
    return { c:c, open:open, n:c.list.length, nOpen:open.length, nDone:done, noCost:nc,
             act: mk(c.revenue, c.cogs, A.sin, A.sout, done),
             exp: mk(c.revenue + E.goods, c.cogs + E.cost, A.sin + E.sin, A.sout + E.sout, c.list.length) };
  }
  /* «عشان تبدأ تكسب»: كل أوردر بيكسب كام قبل الثابت (بعد البضاعة والشحن والإعلان والتغليف)،
     والإعلان على الأوردر لازم ينزل لحد كام، وكام أوردر تغطّي الثابت. */
  function unitEcon(v){
    if(!v.n) return null;
    var per = function(x){ return x / v.n; };
    var pre = per(v.gross + v.ship - v.pack - v.xloss - v.othervar);     // ربح الأوردر قبل الإعلان
    var ad = per(v.ads), cu = pre - ad;
    // سيناريو: إعلان على الأوردر = تلات أرباع اللي الأوردر يقدر يستحمله، مقرّب لأقرب ١٠
    var adT = pre > 20 ? Math.max(10, Math.round(pre * 0.75 / 10) * 10) : null, cuT = adT === null ? null : pre - adT;
    var need = function(x){ return x > 0.009 ? Math.ceil(v.fixedExp / x - 1e-9) : null; };
    return { pre:pre, ad:ad, cu:cu, fixed:v.fixedExp, need:need(cu), adT:adT, cuT:cuT, needT: cuT === null ? null : need(cuT) };
  }

  function pct(now, before){
    if(!before) return null;
    return ((now - before) / Math.abs(before)) * 100;
  }
  function deltaHTML(now, before){
    var p = pct(now, before);
    if(p === null || !isFinite(p)) return "";
    var up = p >= 0;
    return "<span class='sub' style='color:"+(up?"var(--gain)":"var(--due)")+"'>"+
      (up?"▲ ":"▼ ")+Math.abs(p).toFixed(0)+"% عن الفترة السابقة</span>";
  }

  function syncPeriodUI(){
    Array.prototype.forEach.call(document.querySelectorAll(".per"), function(el){ el.value = period.mode; });
    Array.prototype.forEach.call(document.querySelectorAll(".per-from"), function(el){ el.value = period.from; });
    Array.prototype.forEach.call(document.querySelectorAll(".per-to"), function(el){ el.value = period.to; });
    Array.prototype.forEach.call(document.querySelectorAll(".per-cust"), function(el){
      el.hidden = period.mode !== "custom";
    });
    var r0 = periodRange();
    var txt = r0 ? ("الفترة: من " + r0.from + " لـ " + r0.to) : "كل الحركات المسجّلة من البداية";
    ["per-label","per-label-rep","per-label-viz"].forEach(function(id){
      var lbl = document.getElementById(id);
      if(lbl) lbl.textContent = txt;
    });
  }

  function renderKPIs(){
    var r = periodRange();
    var cur = periodStats(r);
    var prev = prevRange() ? periodStats(prevRange()) : null;
    var curP = projStats(r), prevP = prevRange() ? projStats(prevRange()) : null;

    var stockValue = stockBookValue();
    var recv=0, pay=0;
    live("parties").forEach(function(p){
      var b = partyBalance(p.id);
      if(p.type==="customer" && b>0) recv += b;
      if(p.type==="supplier" && b<0) pay += -b;
    });
    var open    = cur.list.filter(isReserved);
    var openVal = open.reduce(function(a,s){ return a + saleTotal(s); },0);
    var canc    = cur.list.filter(isCancelled);
    var cancCost= canc.reduce(function(a,s){ return a + (shipOut(s) - shipIn(s)); },0);

    // كل كارت ليه مفتاح، والمفتاح بيفتح جدول تفاصيله من KPI_DETAIL
    var cells = [
      ["rev",   "الإيرادات (مبيعات مسلّمة)", money(cur.revenue), "", prev?deltaHTML(cur.revenue, prev.revenue):""],
      ["cogs",  "تكلفة البضاعة المباعة", money(cur.cogs), cur.cogs>0?"v-due":"", "<span class='sub'>بمتوسط سعر الشراء</span>"],
      ["gross", "مجمل ربح البضاعة", money(cur.profit), cur.profit>=0?"v-gain":"v-due", prev?deltaHTML(cur.profit, prev.profit):""],
      ["ship",  "صافي الشحن", money(cur.netShip), cur.netShip>=0?"v-gain":"v-due", prev?deltaHTML(cur.netShip, prev.netShip):""],
      ["exp",   "المصاريف", money(cur.expenses), cur.expenses>0?"v-due":"", prev?deltaHTML(cur.expenses, prev.expenses):""],
      ["net",   "صافي الربح", money(curP.exp.net), curP.exp.net>=0?"v-gain":"v-due",
        (curP.nOpen ? "<span class='sub'>لو الـ" + qty(curP.nOpen) + " اللي ماشيين اتسلّموا · اتسلّم فعلاً " + esc(money(curP.act.net)) + "</span>" : "") +
        (prevP ? deltaHTML(curP.exp.net, prevP.exp.net) : "")],
      ["be",    "فلوس لسه ما رجعتش", cashBeTxt(), cashBeCls(), cashBeSub()],
      ["stock", "قيمة المخزون", money(stockValue), "", "<span class='sub'>تراكمي</span>"],
      ["cash",  "رصيد الخزنة", money(cashBox()), cashBox()>=0?"":"v-due", "<span class='sub'>تراكمي</span>"],
      ["wallet","لك عند شركات الشحن", money(walletsTotal()), walletsTotal()>0?"v-gain":"", "<span class='sub'>لسه ما اتسحبتش</span>"],
      ["recv",  "لك عند العملاء", money(recv), recv>0?"v-gain":"", "<span class='sub'>تراكمي</span>"],
      ["pay",   "عليك للموردين", money(pay), pay>0?"v-due":"", "<span class='sub'>تراكمي</span>"],
      ["deliv", "أوردرات مسلّمة", qty(cur.deliv.length), "", ""],
      ["open",  "أوردرات جارية", qty(open.length) + (openVal ? " · " + money(openVal) : ""), "", ""],
      ["canc",  "ملغية (صافي خسارتها)", qty(canc.length) + (cancCost ? " · " + money(cancCost) : ""), cancCost>0?"v-due":"", ""]
    ];
    // الكروت دي بتكشف الربح أو التكلفة — بتختفي عن اللي مالوش صلاحية
    var MONEY_KPI = { cogs:1, gross:1, net:1, be:1, stock:1 };
    var byKey = {}; cells.forEach(function(c){ byKey[c[0]] = c; });

    /* ٤ مجموعات مترتّبة بالأهمية بدل ١٥ كارت بنفس الحجم. لو كلهم زي
       بعض، عينك مالهاش دليل تروح فين الأول — والرقمين اللي بيقرّروا
       شغلك («كسبت كام» و«لازم تبيع بكام») بيضيعوا وسط العدّادات. */
    var GROUPS = [
      { t:"", hero:true, keys:["net","be"] },
      { t:"فلوسك دلوقتي",  keys:["cash","wallet","recv","pay","stock"] },
      { t:"حركة الفترة — اللي اتسلّم فعلاً",   keys:["rev","cogs","gross","ship","exp"] },
      { t:"الأوردرات",     keys:["deliv","open","canc"] }
    ];
    var card = function(c, hero){
      if(!c) return "";
      return '<div class="kpi' + (kpiOpen === c[0] ? ' on' : '') +
        (hero ? ' hero' : '') + (MONEY_KPI[c[0]] ? ' money-only' : '') +
        '" data-kpi="' + c[0] + '" tabindex="0" role="button"><span>'+c[1]+'</span>' +
        '<strong class="num '+c[3]+'">'+esc(c[2])+'</strong>'+(c[4]||'') +
        '<span class="kpi-go" aria-hidden="true">التفاصيل ›</span></div>';
    };
    document.getElementById("kpis").innerHTML = GROUPS.map(function(g){
      var inner = g.keys.map(function(k){ return card(byKey[k], g.hero); }).join("");
      return (g.t ? '<h3 class="bandhead">'+esc(g.t)+'</h3>' : "") +
        '<div class="band' + (g.hero ? ' band-hero' : '') + '">' + inner + '</div>';
    }).join("");
    renderKpiDetail();
  }

