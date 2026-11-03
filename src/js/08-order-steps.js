  /* ================= خطوات الأوردر =================
     الأوردر قصتين ورا بعض، بالترتيب:

       مع العميل:        ١ اتسجّل   ٢ اتبعت (الشركة + كود البوليصة)
                         ٣ العميل استلم ودفع لشركة الشحن
                           (خد كله · خد جزء ورجّع جزء · رفض كله)
       مع شركة الشحن:    ٤ فلوسك عندها — تستلمها
                         ٥ المرتجع عندها — تستلمه

     أول ما العميل يدفع للمندوب خرج من القصة: مفيش حاجة اسمها «العميل
     لسه عليه» في أوردر تحصيله عن طريق الشركة. فالمحصّل في الأوردر ده
     مش خانة بتتكتب — هو نتيجة الخطوة ٣: اللي العميل خده + الشحن. وده
     اللي بيقفل الغلط اللي حصل في #4 (مرتجع اتسجّل بعد التحصيل والمحفظة
     فضلت على الرقم القديم): الرقم بيتحسب تاني مع كل تغيير.

     التحصيل المباشر (العميل بيدفعلك إنت) مختلف: هناك العميل ممكن يدفع
     عربون أو على دفعات، فخطوة ٤ بتبقى «حصّل من العميل».

     الخطوة مستنتجة من الأرقام مش متخزّنة، فمستحيل تقول حاجة والداتا
     تقول حاجة تانية. والمنع قاعدة واحدة (stepBlock) كل مكان بيغيّر
     الحالة بيعدّي عليها.

     ٤ و٥ مش مقفولين على بعض عن قصد: الشركة بترجّع البضاعة بعد يومين
     وبتحاسب على الفلوس كل أسبوع — لو قفلنا واحدة ورا التانية كنت
     هتتحبس. */
  var STEP_N = 5;
  function stepBlock(rec, next){
    var st = next || stOf(rec);
    if(rec && rec.selfDel) return null;    // بتوصّله بنفسك — مفيش شركة ولا بوليصة
    if(st === "cancelled" && rec && !squish(rec.shipCode) && !rec.shippedAt) return null;   // v139: إلغاء قبل الشحن
    if(st === "delivered" || st === "cancelled"){
      var miss = [];
      if(!squish(rec.shipCo))   miss.push("اسم شركة الشحن");
      if(!squish(rec.shipCode)) miss.push("كود البوليصة");
      if(miss.length)
        return "اكتب " + miss.join(" و") + " الأول (خطوة ٢) — بعدها تقدر تسجّل العميل استلم ولا لأ";
    }
    return null;
  }
  /* اللي العميل دفعه للمندوب في أوردر الشركة — مش رقم بيتكتب:
     استلم = تمن اللي خده + الشحن · لسه ما استلمش أو رفض = صفر
     (الرفض بيتحسب من خانة الشحن على العميل زي ما هو). */
  function shipPaidOf(s){
    return isDelivered(s) ? Math.round((saleTotal(s) + shipIn(s)) * 100) / 100 : 0;
  }
  // الفرق بين المسجّل والحقيقي — بيطلع في الأوردرات القديمة بس
  function shipPaidGap(s){
    if(!viaShip(s)) return 0;
    var g = (Number(s.paid)||0) - shipPaidOf(s);
    return Math.abs(g) > 0.009 ? g : 0;
  }
  // بيتنادى بعد أي تغيير في أوردر الشركة (الحالة · المرتجع · الأسعار · الشحن)
  function syncShipPaid(rec){
    var g = shipPaidGap(rec);
    if(g) rec.paid = shipPaidOf(rec);
    return g;
  }

  /* فلوسك عند شركة الشحن — بالأوردر، مش رقم واحد.
     الشركة ما بتقولكش «ده تمن أوردر كذا»، بتسلّمك مبلغ. فبنوزّعه على
     الأوردرات الأقدم الأول (زي ما الشركة بتحاسب). والأوردر اللي
     الشركة خصمت منه أكتر ما حصّلت (رفض والشحن عليك) بيتخصم من نفس
     المحفظة، فبيتحسب كأنه اتسلّم. مجموع «لسه عندها» على كل الأوردرات
     = رصيد المحفظة بالظبط. */
  var pendCache = null;
  function shipPendMap(){
    if(pendCache) return pendCache;
    var by = {}, out = {};
    live("sales").forEach(function(s){
      if(!viaShip(s)) return;
      var co = squish(s.shipCo);
      var net = (isCancelled(s) ? shipIn(s) : (Number(s.paid)||0)) - (shipCounts(s) ? shipOut(s) : 0);
      (by[co] = by[co] || []).push({ s:s, net:Math.round(net * 100) / 100 });
    });
    var drawn = {}, credits = {}, pick = {};
    live("cash").forEach(function(c){
      if(c.type !== "settle") return;
      var n = squish(c.shipCo), a = Number(c.amount)||0;
      // v146: استلام أوردر أوردر — المبلغ بيروح للأوردرات اللي اخترتها، واللي يزيد بيتوزع الأقدم الأول
      if(Array.isArray(c.orders) && c.orders.length){ (pick[n] = pick[n] || []).push({ d:c.date || "", at:c.at || 0, a:a, ids:c.orders }); return; }
      drawn[n] = (drawn[n]||0) + a;
      (credits[n] = credits[n] || []).push({ d:c.date || "", a:a });
    });
    Object.keys(by).forEach(function(co){
      /* الأقدم الأول — بتاريخ ما الفلوس وصلت الشركة (التسليم أو الرفض)،
         مش تاريخ الأوردر: استلام اتعمل قبل ما الأوردر يتسلّم مستحيل
         يكون فيه فلوسه. وبعدين رقم الأوردر (مش وقت آخر تعديل — ده بيتغيّر). */
      var moneyDate = function(x){ return x.deliveredAt || x.cancelledAt || x.date || ""; };
      var L = by[co].sort(function(a, b){
        var da = moneyDate(a.s), dbb = moneyDate(b.s);
        return da !== dbb ? (da < dbb ? -1 : 1) : (Number(a.s.no)||0) - (Number(b.s.no)||0);
      });
      var ix = {};
      L.forEach(function(x){ x.rest = x.net; x.exD = ""; ix[x.s.id] = x; });
      (pick[co] || []).sort(function(a, b){ return a.d !== b.d ? (a.d < b.d ? -1 : 1) : a.at - b.at; }).forEach(function(p){
        var pp = p.a;
        // v147: مرفوض في نفس الاستلام — الشركة خصمت مرتجعه من المبلغ، فبيتضاف للمبلغ اللي بيتوزع
        p.ids.forEach(function(id){
          var x = ix[id]; if(!x || x.net >= -0.009 || x.negUsed) return;
          pp += -x.net; x.negUsed = true; if(p.d > x.exD) x.exD = p.d;
        });
        p.ids.forEach(function(id){
          var x = ix[id]; if(!x || x.rest <= 0.009 || pp <= 0.009) return;
          var tk = Math.min(pp, x.rest); pp -= tk;
          x.rest = Math.round((x.rest - tk) * 100) / 100;
          if(p.d > x.exD) x.exD = p.d;
        });
        if(pp > 0.009){ drawn[co] = (drawn[co]||0) + pp; (credits[co] = credits[co] || []).push({ d:p.d, a:pp, rem:true }); }
      });
      var pool = drawn[co] || 0;
      /* v147: المرفوض اللي ما اتحددش في استلام بيتخصم من أي استلام بالإجمالي بعد ما اترفض؛
         لو مفيش، بيفضل سطر «عليك» في القايمة لحد ما تعلّمه مع أوردرات الاستلام الجاي */
      // v159: زيادة استلام أوردر أوردر (rem) مش استلام بالإجمالي — ما تبلعش مرتجعات لسه الشركة ما خصمتهاش
      var lumpD = (credits[co] || []).reduce(function(m, c){ return !c.rem && c.d > m ? c.d : m; }, "");
      L.forEach(function(x){ if(x.net < 0 && !x.negUsed && lumpD && lumpD >= moneyDate(x.s)){ pool += -x.net; x.absorbed = true; } });
      var run = 0;
      L.forEach(function(x){
        if(x.net < -0.009 && !x.negUsed && !x.absorbed){ out[x.s.id] = { left:x.net, upto:run }; return; }
        if(x.rest <= 0.009){ out[x.s.id] = { left:0, upto:run }; return; }
        var take = Math.min(pool, x.rest);
        pool -= take;
        var left = Math.round((x.rest - take) * 100) / 100;
        run += left;
        out[x.s.id] = { left:left, upto:Math.round(run * 100) / 100 };
      });
      /* يوم ما فلوس كل أوردر اكتملت: نفس ترتيب الأقدم الأول، بس الاستلامات
         بتتعدّ بتاريخها — الأوردر بيخلص يوم الاستلام اللي غطّى آخر قرش فيه
         (ومش قبل يوم ما الفلوس وصلت الشركة). */
      var cr = (credits[co] || []).slice();
      L.forEach(function(x){ if(x.absorbed) cr.push({ d:moneyDate(x.s), a:-x.net }); });
      cr.sort(function(a, b){ return a.d < b.d ? -1 : (a.d > b.d ? 1 : 0); });
      var ci = 0, have = 0, need = 0, lastD = "";
      L.forEach(function(x){
        var md = moneyDate(x.s); if(x.exD > md) md = x.exD;               // اتقفل يوم الاستلام اللي اخترته فيه
        if(x.rest <= 0.009){ out[x.s.id].closedAt = md; return; }
        need += x.rest;
        while(have < need - 0.009 && ci < cr.length){ have += cr[ci].a; lastD = cr[ci].d; ci++; }
        out[x.s.id].closedAt = have >= need - 0.009 ? (lastD > md ? lastD : md) : "";
      });
    });
    pendCache = out;
    setTimeout(function(){ pendCache = null; }, 0);
    return out;
  }
  function shipPend(s){ return shipPendMap()[s.id] || { left:0, upto:0 }; }
  /* يوم ما الأوردر خلص فعلاً: آخر حاجة حصلت فيه — التسليم/الرفض، والتحصيل
     (توصيل بنفسك)، وفلوسه من الشركة، والمرتجع لما رجع المخزن. */
  function doneDate(s){
    var d = s.deliveredAt || s.cancelledAt || s.date || "";
    var mx = function(x){ if(x && x > d) d = x; };
    mx(s.paidAt);
    if(viaShip(s)) mx(shipPend(s).closedAt);
    if(heldShipped(s)) SL(s).forEach(function(l){ if(lineHeld(l, s) > 0) mx(lineBack(l, s)); });
    return d;
  }

  // القطع الراجعة اللي لسه ما رجعتش المخزن
  function heldLeft(s){
    if(s && s.selfDel) return 0;           // المرتجع بيرجع مع اللي وصّله في نفس اليوم
    return SL(s).reduce(function(a, l){
      return a + (lineHeld(l, s) > 0 && !lineBack(l, s) ? lineHeld(l, s) : 0); }, 0);
  }
  function orderStep(s){
    var st = stOf(s), co = squish(s.shipCo) || "شركة الشحن", via = viaShip(s);
    if((st === "progress" || st === "proposed") && s.selfDel){
      var who = squish(s.courier) || "المندوب";
      if(!s.shippedAt) return { n:2, k:"ship", t:"اطلع بيه للعميل",
        hint:"بتوصّله بنفسك — اكتب مين هيوصّله ودوس «خرج للتوصيل»." };
      return { n:3, k:"inspect", t:"العميل استلم ودفع لـ" + who + "؟",
        hint:"خد كله · خد جزء ورجّع جزء · رفض كله. اللي بيخده بيدفع تمنه + الشحن، والفلوس بتدخل الخزنة النهارده." };
    }
    if(st === "progress" || st === "proposed"){
      var miss = [];
      if(!squish(s.shipCo))   miss.push("اسم شركة الشحن");
      if(!squish(s.shipCode)) miss.push("كود البوليصة");
      if(miss.length) return { n:2, k:"ship", t:"ابعته مع شركة الشحن",
        hint:"ناقص: " + miss.join(" و") + "." };
      return { n:3, k:"inspect", t: via ? "العميل استلم ودفع لـ " + co + "؟" : "العميل استلم؟",
        hint: via
          ? "خد كله · خد جزء ورجّع جزء · رفض كله. اللي بيخده بيدفع تمنه للمندوب وخلاص — مش هيبقى عليه حاجة."
          : "خد كله · خد جزء ورجّع جزء · رفض كله — اختار واحدة." };
    }
    var left = heldLeft(s);
    var also = left ? "وفيه " + qty(left) + " قطعة راجعة لسه عند " + co + " (خطوة ٥)." : "";
    // أوردر قديم اتسجّل قبل القاعدة: المحصّل مش مطابق للي العميل خده
    var gap = shipPaidGap(s);
    if(gap && !isCancelled(s))
      return { n:3, k:"custpaid", t:"سجّل إن العميل دفع لـ " + co,
        hint:"العميل خد بـ" + money(shipPaidOf(s)) + " (البضاعة + الشحن) ودفعهم للمندوب، والمسجّل " +
             money(Number(s.paid)||0) + ". دوس عشان المحفظة تبقى مظبوطة.", also:also };
    var m = saleMoney(s);
    if(!via && isDelivered(s) && m.due > 0.009)
      return { n:4, k:"collect", t:"حصّل من العميل",
        hint:"لسه " + money(m.due) + " على العميل.", also:also };
    if(!via && isDelivered(s) && m.due < -0.009)
      return { n:4, k:"refund", t:"المحصّل أكتر من المطلوب بـ" + money(-m.due),
        hint:"لو ده غلط في الرقم عدّله من «تعديل الأوردر»، ولو فعلاً اتدفع رجّعه للعميل.", also:also };
    if(via){
      var pd = shipPend(s);
      if(pd.left > 0.009)
        return { n:4, k:"draw", t:"استلم فلوسك من " + co, left:pd.left, upto:pd.upto,
          hint:money(pd.left) + " من الأوردر ده لسه عند " + co + "." +
               (pd.upto - pd.left > 0.009
                 ? " (ومعاها " + money(pd.upto - pd.left) + " من أوردرات أقدم — الاستلام بيقفل الأقدم الأول.)" : ""),
          also:also };
    }
    if(left)
      return { n:5, k:"back", t:"استلم المرتجع من " + co,
        hint:qty(left) + " قطعة لسه عند " + co + " — أول ما تسلّمهالك دوس «استلمتها»." };
    return { n:STEP_N + 1, k:"done", done:true, t:"خلص",
      hint: via ? (isCancelled(s) ? "العميل رفض، والحساب مع " + co + " اتقفل."
                                  : "العميل دفع لـ " + co + "، وفلوسك استلمتها منها.")
                : "" };
  }
  function stepTxt(stp){
    return stp.done ? "✓ خلص" : "خطوة " + stp.n + " من " + STEP_N + " · " + stp.t;
  }
  // السجلات القديمة من غير حالة تتعامل كمسلّمة عشان أرقامها ما تتغيّرش
  function stOf(s){ return s.status || "delivered"; }
  // رقم الأوردر: تسلسلي، بيتحسب من أعلى رقم موجود
  function nextSaleNo(){
    var m = 0;
    db.sales.forEach(function(s){ var n = Number(s.no)||0; if(n > m) m = n; });
    return m + 1;
  }
  // الأوردرات القديمة بتاخد أرقامها مرة واحدة بترتيب التاريخ — نفس الترتيب على كل الأجهزة
  function backfillSaleNos(){
    var miss = db.sales.filter(function(s){ return !s.no && !s.deleted; });
    if(!miss.length) return;
    var m = 0;
    db.sales.forEach(function(s){ var n = Number(s.no)||0; if(n > m) m = n; });
    miss.sort(function(a,b){
      return (a.date||"") !== (b.date||"") ? ((a.date||"") < (b.date||"") ? -1 : 1) : (a.at||0)-(b.at||0);
    }).forEach(function(s){ s.no = ++m; });
    saveSoon("sales");
  }
  function isDelivered(s){ return stOf(s) === "delivered"; }
  function isReserved(s){ return stOf(s) === "progress"; }
  function isCancelled(s){ return stOf(s) === "cancelled"; }

  // v141: الملغي قبل الشحن مالوش شحن — الأرقام فاضلة مكتوبة على الأوردر لو رجع
  function shipIn(s){ return s.preCancel ? 0 : Number(s.shipIn)||0; }    // محصّل من العميل
  function shipOut(s){ return s.preCancel ? 0 : Number(s.shipOut)||0; }  // مدفوع لشركة الشحن
  // الشحن بيتحسب على المسلّم والملغي بس — الباقي لسه ما اتشحنش
  function shipCounts(s){ return isDelivered(s) || isCancelled(s); }
  // السجلات القديمة كانت بتعتبر التحصيل مباشر، فبنحافظ على أرقامها
  function payVia(s){ return s.payVia || "direct"; }
  function viaShip(s){ return payVia(s) === "ship"; }

  // محفظة شركة الشحن: اللي حصّلته من العملاء ولسه عندها
  function walletOf(co){
    var w = 0, name = squish(co);
    live("sales").forEach(function(s){
      if(squish(s.shipCo) !== name || !viaShip(s)) return;
      // الشركة ماسكة الفلوس من ساعة ما حصّلتها، مش من ساعة التسليم.
      // قبل كده كان المحصّل على أوردر «جاري» مش بيبان في أي محفظة.
      if(!isCancelled(s)) w += Number(s.paid)||0;
      if(isCancelled(s))  w += shipIn(s);
      if(shipCounts(s))   w -= shipOut(s);    // بتخصم عمولتها من المحفظة
    });
    live("cash").forEach(function(c){
      if(c.type === "settle" && squish(c.shipCo) === name) w -= Number(c.amount)||0;
    });
    return w;
  }
  function shipCompanies(){
    var m = {};
    live("sales").forEach(function(s){ var c=squish(s.shipCo); if(c) m[c]=1; });
    live("cash").forEach(function(c){ if(c.type==="settle"){ var n=squish(c.shipCo); if(n) m[n]=1; } });
    return Object.keys(m);
  }
  // أوردر تحصيله «عن طريق شركة الشحن» بس اسم الشركة فاضي: الفلوس دي
  // مكانتش بتتحسب لا في الخزنة ولا في أي محفظة — يعني بتختفي من الميزانية.
  // بنطلّعها في دلو مستقل عشان تفضل ظاهرة والمستخدم يقدر يصلّحها.
  function hasOrphanShip(){
    return live("sales").some(function(s){
      return viaShip(s) && !squish(s.shipCo) && !isCancelled(s) &&
             ((Number(s.paid)||0) || shipIn(s) || shipOut(s));
    });
  }
  // كل الدلاء اللي فيها فلوس، وفيها الدلو المجهول لو موجود
  function shipBuckets(){
    var cos = shipCompanies();
    if(hasOrphanShip()) cos.push("");
    return cos;
  }
  function walletsTotal(){
    return shipBuckets().reduce(function(a,c){ return a + walletOf(c); },0);
  }

  function retQty(s){
    return SL(s).reduce(function(a,l){ return a + lineRet(l); },0);
  }
  // الكمية اللي اتباعت فعلاً: المشحونة ناقص المرتجع، والملغي بصفر
  function soldQty(s){
    return SL(s).reduce(function(a,l){ return a + lineSold(l,s); },0);
  }
  function saleTotal(s){
    return SL(s).reduce(function(a,l){ return a + lineTotal(l,s); },0);
  }
