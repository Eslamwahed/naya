  /* ================= المحاسبة الإدارية ================= */
  /* تحليل التكلفة–الحجم–الربح (CVP). الأساس:
       هامش المساهمة = الإيراد − التكاليف المتغيّرة
       صافي الربح    = هامش المساهمة − التكاليف الثابتة
       مبيعات التعادل = التكاليف الثابتة ÷ نسبة هامش المساهمة
     المتغيّر عندنا: تكلفة البضاعة المباعة + صافي تكلفة الشحن + المصاريف
     المصنّفة «متغيّر». الثابت: المصاريف المصنّفة «ثابت».
     دي مقاييس إدارية (Management Accounting) — مش بنود في القوايم
     المالية ومالهاش معيار IFRS، بتتحسب بأرقام فعلية مسجّلة. */

  // شهور من تاريخ لتاريخ، كل واحد {from,to}
  function monthSlices(from, to){
    if(!from || !to || from > to) return [];
    var out = [], y = Number(from.slice(0,4)), m = Number(from.slice(5,7));
    var guard = 0;
    while(guard++ < 600){
      var a = y + "-" + String(m).padStart(2,"0") + "-01";
      var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      var b = y + "-" + String(m).padStart(2,"0") + "-" + String(lastDay).padStart(2,"0");
      if(a > to) break;
      out.push({ from: a < from ? from : a, to: b > to ? to : b, key: a.slice(0,7) });
      m++; if(m > 12){ m = 1; y++; }
    }
    return out;
  }

  // صافي ربح كل شهر — بتتحسب مرة وبتستعملها كل حسابات الاسترداد
  var _mnet = null;
  function monthlyNets(){
    if(_mnet) return _mnet;
    var st = earliestDate(), en = today();
    if(!st || st > en){ _mnet = []; return _mnet; }
    _mnet = monthSlices(st, en).map(function(mo){
      var c = periodStats(mo);
      /* شهر من غير أي حركة مش «شهر ربحه صفر» — دي غالبًا فترة الداتا
         واقفة فيها. لو حسبناه في المتوسط، معدل الربح بينزل غلط وفترة
         الاسترداد بتطلع «مستحيلة» رغم إن الشغل ماشي. */
      var active = c.list.length > 0 || c.expenses > 0.009;
      return { from:mo.from, to:mo.to, key:mo.key, net:c.net, active:active };
    });
    return _mnet;
  }
  function clearMonthly(){ _mnet = null; }

  /* الربح المحقّق للشريك = مجموع (ربح كل شهر × نسبته المرجّحة في الشهر ده).
     مش «اللي سحبه» ولا «اللي اتوزّع رسميًا» — ده اللي فلوسه كسبته فعلاً،
     وهو الأساس الصح لقياس استرداد رأس المال. */
  function partnerEarned(id){
    return monthlyNets().reduce(function(a, mo){
      if(!mo.net) return a;
      return a + mo.net * weightedRatio(id, mo.from, mo.to);
    }, 0);
  }
  // كاش فعلي خرج للشريك: صرف أرباح + سحب من رأس ماله
  function partnerCashOut(id){
    return live("cash").reduce(function(a, c){
      if(c.partyId !== id || !isCapType(c.type)) return a;
      if(c.type === "cap_payout" || c.type === "cap_out") return a + (Number(c.amount)||0);
      return a;
    }, 0);
  }
  // معدل ربحه الشهري على آخر N شهر فيها حركة
  // آخر N شهر **فيها حركة** — شهور السكوت مش بتتحسب في المتوسط
  function activeMonths(n){
    var act = monthlyNets().filter(function(mo){ return mo.active; });
    return act.slice(Math.max(0, act.length - (n||3)));
  }
  function partnerMonthlyRate(id, n){
    var take = activeMonths(n);
    if(!take.length) return 0;
    var sum = take.reduce(function(a, mo){
      return a + (mo.net || 0) * weightedRatio(id, mo.from, mo.to); }, 0);
    return sum / take.length;
  }

  function pctTxt(v){ return (isFinite(v) ? (v*100).toFixed(1) : "0.0") + "%"; }

  /* ---------- «فلوس لسه ما رجعتش» (كان «لازم تبيع بكام») ----------
     ده رقم كاش مش رقم محاسبي: كل اللي خرج من جيبك على الشغل ناقص كل
     اللي رجع من البيع. تراكمي من البداية، وبيتحدّث مع كل حركة.

     ليه ده غير نقطة التعادل المحاسبية؟ التعادل = المصاريف الثابتة ÷
     نسبة الهامش، والبضاعة مش داخلة فيه لأن تكلفتها جوّه الهامش أصلاً —
     فبيطلع صفر لو مفيش مصاريف ثابتة، وده مالوش معنى لواحد لسه دافع
     فلوسه في بضاعة. التعادل المحاسبي مكانه التقارير.

     رأس المال والأرصدة الافتتاحية مش داخلة: دي فلوس دخلت مش تكلفة.
     و«سحب من شركة شحن» (settle) مش داخل كدخل، لأن الفلوس دي اتعدّت
     خلاص وقت ما الشركة حصّلتها — وإلا كانت هتتعدّ مرتين. */
  function cashOutlay(){
    var v = 0;
    live("purchases").forEach(function(p){
      var pd = Number(p.paid)||0;
      if(pd > 0) v += pd;                 // مدفوع للمورد
      v += pFreight(p);                   // نقل البضاعة
    });
    live("sales").forEach(function(s){
      if(shipCounts(s)) v += shipOut(s);  // مدفوع لشركة الشحن
    });
    live("cash").forEach(function(c){
      if((c.type === "expense" && !c.paidBy) || c.type === "out" || c.type === "cap_repay") v += Number(c.amount)||0;   // ترجيع الشريك = المصروف خرج دلوقتي
    });
    return v;
  }
  function cashBack(){
    var v = 0;
    live("sales").forEach(function(s){
      // المحصّل من العميل — سواء في إيدك أو لسه عند شركة الشحن
      if(isCancelled(s)) v += shipIn(s);
      else v += Number(s.paid)||0;
    });
    live("purchases").forEach(function(p){
      var pd = Number(p.paid)||0;
      if(pd < 0) v += -pd;                // استرداد من مورد
    });
    live("cash").forEach(function(c){
      if(c.type === "in") v += Number(c.amount)||0;
    });
    return v;
  }
  function toBreakCash(){ return cashOutlay() - cashBack(); }

  function cashBeTxt(){
    var n = toBreakCash();
    return money(n > 0.009 ? n : 0);
  }
  function cashBeCls(){ return toBreakCash() > 0.009 ? "" : "v-gain"; }
  /* v122 — «فلوس لسه ما رجعتش» (كان «لازم تبيع بكام»): أغلبه غالباً بضاعة على
     الرف مش خسارة، فبنقسمه: البضاعة بقيمتها في الدفاتر، والباقي — ولو الباقي هو
     الخسارة بالظبط بنسمّيه باسمه، وإلا «الباقي» من غير ما نفترض. */
  function cashBeSplit(){
    var n = toBreakCash(), st = Math.max(0, stockBookValue());
    var stock = Math.min(st, Math.max(0, n)), rest = Math.max(0, n - stock), loss = -netProfitAll();
    return { n:n, stock:stock, rest:rest, isLoss: rest > 0.009 && Math.abs(rest - loss) < 0.5 };
  }
  function cashBeSubTxt(){
    var b = cashBeSplit();
    if(b.n <= 0.009) return "رجّعت فلوسك ✓ واللي بعده مكسب";
    return (b.stock > 0.009 ? "منها " + money(b.stock) + " بضاعة على الرف" : "") +
      (b.rest > 0.009 ? (b.stock > 0.009 ? " · و" : "") + money(b.rest) + (b.isLoss ? " خسارة لحد النهارده" : " الباقي") : "");
  }
  function cashBeSub(){
    return "<span class='sub" + (toBreakCash() > 0.009 ? "" : " v-gain") + "'>" + esc(cashBeSubTxt()) + "</span>";
  }



