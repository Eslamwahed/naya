  /* ---------- تقييم الأداء ---------- */
  function renderPerf(){
    var r = periodRange(), c = periodStats(r);
    var stockVal = Math.max(0, stockBookValue());
    var turns   = stockVal > 0 ? c.cogs / stockVal : 0;     // مرات الدوران في الفترة
    var days    = r ? daysBetween(r.from, r.to) + 1 : null;
    var shelf   = turns > 0 && days ? days / turns : null;  // أيام لحد ما البضاعة تتباع
    var nAll    = c.list.length;
    var nCanc   = c.list.filter(isCancelled).length;
    var retV    = c.deliv.reduce(function(a,s){
      return a + SL(s).reduce(function(b,l){ return b + lineRet(l)*(Number(l.price)||0); },0); },0);
    var be      = c.cmPct > 0 ? c.fixedExp / c.cmPct : null;
    var mos     = (be !== null && c.revenue > 0) ? (c.revenue - be) / c.revenue : null;
    /* v122: الهوامش ومتوسط الأوردر من نفس قايمة الدخل («لو كله اتسلّم»). وهامش
       الأمان والدوران والصافي ÷ المبيعات بيستنّوا ٣٠ يوم من أول أوردر — قبلها
       بيطلعوا أرقام زي −1634% مالهاش معنى غير إنها تخوّف. */
    var P = projStats(r).exp, okN = c.list.length - c.list.filter(isCancelled).length;
    var first = live("sales").reduce(function(a, s){ return s.date && (!a || s.date < a) ? s.date : a; }, "");
    var age = first ? daysBetween(first, today()) + 1 : 0, wait = age < 30;

    var cells = [
      ["هامش البضاعة", P.margin === null ? "—" : pctTxt(P.margin), (P.margin||0)>=0?"v-gain":"v-due",
       "ربح البضاعة ÷ المبيعات — لو كله اتسلّم"],
      ["هامش المساهمة", P.goods > 0.009 ? pctTxt(P.contrib/P.goods) : "—", P.contrib>=0?"v-gain":"v-due",
       "بعد البضاعة والشحن والإعلان والتغليف"],
      wait ? null : ["هامش صافي الربح", pctTxt(c.revenue ? c.net/c.revenue : 0), c.net>=0?"v-gain":"v-due",
       "بعد كل حاجة — اللي اتسلّم فعلاً"],
      wait ? null : ["هامش الأمان", mos === null ? "—" : pctTxt(mos), (mos||0)>0?"v-gain":"v-due",
       mos === null ? "محتاج هامش مساهمة موجب"
                    : "المبيعات ممكن تنزل كده قبل ما تخسر"],
      ["متوسط الأوردر", okN ? money(P.goods / okN) : "—", "", qty(okN) + " أوردر مش ملغي"],
      wait ? null : ["معدل دوران المخزون", turns ? turns.toFixed(2) + "×" : "—",
       "", shelf ? "البضاعة بتقعد " + Math.round(shelf) + " يوم في المتوسط" : "محتاج مخزون وتكلفة مبيعات"],
      ["نسبة الإلغاء", pctTxt(nAll ? nCanc/nAll : 0), nCanc?"v-due":"",
       qty(nCanc) + " من " + qty(nAll) + " أوردر"],
      ["قيمة المرتجع", money(retV), retV>0.009?"v-due":"",
       c.revenue ? pctTxt(retV/(c.revenue+retV)) + " من المبيعات قبل المرتجع" : "—"]
    ];
    var kw = document.getElementById("rep-kpi-wait");
    if(kw){ kw.hidden = !wait; kw.textContent = wait ? "هامش صافي الربح وهامش الأمان ودوران المخزون هيظهروا بعد 30 يوم من أول أوردر (فاضل " + qty(30 - age) + " يوم) — قبلها الأرقام بتبقى مالهاش معنى." : ""; }
    document.getElementById("rep-kpi").innerHTML = cells.filter(Boolean).map(function(x){
      return "<div><span>"+esc(x[0])+"</span><strong class='num "+x[2]+"'>"+esc(x[1])+"</strong>" +
        "<small>"+esc(x[3])+"</small></div>"; }).join("");

    // v122: المصاريف اللي نوعها اتعرف من البيان بقت سطر في ملاحظة قايمة الدخل
  }

  /* ---------- نقطة التعادل ---------- */
  function beBox(title, rows, note, big, bigCls){
    return "<div class='mbox" + (big ? " big" : "") + "'><h4>" + esc(title) + "</h4>" +
      (big ? "<div class='mbig num " + (bigCls||"") + "'>" + esc(big) + "</div>" : "") +
      rows.join("") + (note ? "<p class='mnote'>" + note + "</p>" : "") + "</div>";
  }

  /* v122 — «عشان تبدأ تكسب» بدل «أبيع بكام؟»: بالأوردر مش بالجنيه، ومن نفس قايمة
     الدخل (projStats — لو كله اتسلّم). الأوردر الواحد بيكسب كام قبل المصاريف
     الثابتة، ولو بيخسر: الإعلان على الأوردر لازم ينزل لحد فين. */
  function renderBreakEven(){
    var P = projStats(periodRange()), v = P.exp, u = unitEcon(v);
    var bs = document.getElementById("rep-be-sum"), box = document.getElementById("rep-be");
    if(!u){
      if(bs) bs.textContent = "";
      box.innerHTML = beBox("لسه بدري", [], "مفيش أوردرات في الفترة دي — اختار فترة تانية من فوق.", "—", "");
      table("t-rep-cost", ["البند"], [], "مفيش تكاليف في الفترة دي.");
      renderTarget();
      return;
    }
    var noFixed = u.fixed <= 0.009;
    if(bs) bs.textContent = u.cu <= 0.009 ? "كل أوردر بيخسر " + money(-u.cu) + " قبل الثابت"
      : "كل أوردر بيكسب " + money(u.cu) + " قبل الثابت — " +
        (noFixed ? "ومفيش مصاريف ثابتة في الفترة" : v.n >= u.need ? "غطّيت الثابت ✓" : "الثابت يتغطّى بعد " + qty(u.need) + " أوردر");
    var n = v.n, per = function(x){ return x / n; };
    var html = beBox("الأوردر الواحد بيكسب كام؟", [
        mRow("ربح البضاعة", per(v.gross)),
        mRow(v.ship >= 0 ? "+ ربح الشحن" : "− فرق الشحن", Math.abs(per(v.ship))),
        v.pack + v.xloss + v.othervar > 0.009 ? mRow(v.xloss + v.othervar > 0.009 ? "− تغليف ومتغيّر تاني" : "− تغليف", per(v.pack + v.xloss + v.othervar)) : "",
        mRow("= قبل الإعلان", u.pre, "tot"),
        mRow("− إعلان", u.ad),
        mRow("= قبل المصاريف الثابتة", u.cu, "tot " + (u.cu > 0.009 ? "v-gain" : "v-due"))
      ], "متوسط " + qty(n) + " أوردر في الفترة — لو كلهم اتسلّموا.");
    if(u.pre <= 0.009)
      html += beBox("مفيش عدد أوردرات يغطّي", [], "البضاعة والشحن نفسهم مش بيغطّوا بعض قبل أي إعلان — راجع أسعار البيع وفرق الشحن الأول.", "✗", "v-due");
    else if(u.cu <= 0.009)
      html += beBox("مفيش عدد أوردرات يغطّي", [
          mRow("الإعلان على الأوردر دلوقتي", u.ad),
          mRow("لازم ينزل تحت", u.pre, "tot v-gain")
        ], "كل أوردر بيخسر <b>" + esc(money(-u.cu)) + "</b> قبل المصاريف الثابتة — فكل ما الأوردرات تزيد الخسارة بتزيد.", "✗", "v-due");
    else if(noFixed)
      html += beBox("مفيش مصاريف ثابتة", [], "كل أوردر بيكسب <b>" + esc(money(u.cu)) + "</b> صافي — مفيش مصاريف ثابتة مسجّلة في الفترة.", "✓", "v-gain");
    else
      html += beBox("الثابت يتغطّى بعد", [
          mRow("المصاريف الثابتة", u.fixed),
          mRow("÷ كسب الأوردر", u.cu)
        ], "عندك " + qty(n) + " أوردر في الفترة" + (n >= u.need ? " — <b class='v-gain'>غطّيت الثابت ✓</b>" : " — ناقصك <b>" + qty(u.need - n) + "</b>") + ".",
        qty(u.need) + " أوردر", n >= u.need ? "v-gain" : "");
    if(u.adT !== null && u.adT < u.ad - 0.009)
      html += beBox("لو الإعلان نزل لـ " + money(u.adT) + " على الأوردر", [
          mRow("كل أوردر يكسب", u.cuT, "tot v-gain"),
          u.needT ? "<div class='mrow'><span>الثابت (" + esc(money(u.fixed)) + ") يتغطّى بعد</span><b class='num'>" + esc(qty(u.needT)) + " أوردر</b></div>" : ""
        ], "");
    box.innerHTML = html;

    // جدول هيكل التكلفة — بالأنواع
    var C = [
      ["تكلفة البضاعة المباعة", "متغيّرة", v.cost],
      [v.ship >= 0 ? "ربح الشحن" : "فرق الشحن", "متغيّرة", -v.ship],
      ["إعلانات", "متغيّرة", v.ads], ["تغليف", "متغيّرة", v.pack], ["خسارة استبدال", "متغيّرة", v.xloss], ["متغيّرة تانية", "متغيّرة", v.othervar],
      ["اشتراكات", "ثابتة", v.subs], ["مرتبات", "ثابتة", v.salary], ["مرة واحدة", "ثابتة", v.once],
      ["انتقالات من غير فاتورة", "ثابتة", v.trans], ["مصاريف تانية", "ثابتة", v.other]
    ].filter(function(x, i){ return i < 3 || Math.abs(x[2]) > 0.009; });
    var tot = C.reduce(function(a, x){ return a + x[2]; }, 0);
    var rows = C.map(function(x){
      return "<tr><td class='wide'>" + esc(x[0]) + "</td>" +
        "<td><span class='st st-" + (x[1]==="ثابتة"?"cancelled":"progress") + "'>" + esc(x[1]) + "</span></td>" +
        "<td class='num'>" + money(x[2]) + "</td>" +
        "<td class='num'>" + (v.goods ? pctTxt(x[2]/v.goods) : "—") + "</td></tr>";
    });
    rows.push("<tr class='sumrow'><td class='wide'>إجمالي التكاليف</td><td></td>" +
      "<td class='num'>" + money(tot) + "</td><td class='num'>" + (v.goods ? pctTxt(tot/v.goods) : "—") + "</td></tr>");
    table("t-rep-cost", ["البند","النوع","المبلغ","% من المبيعات"], rows, "مفيش تكاليف في الفترة دي.");

    renderTarget();
  }

  // وعشان أكسب مبلغ معيّن؟ — بعدد الأوردرات، من نفس كسب الأوردر فوق
  function renderTarget(){
    var box = document.getElementById("rep-target");
    if(!box) return;
    var t = Number(toEn((document.getElementById("be-target")||{}).value))||0;
    var d = Number(toEn((document.getElementById("be-days")||{}).value))||0;
    if(!t){ box.innerHTML = ""; return; }
    var u = unitEcon(projStats(periodRange()).exp);
    if(!u || u.cu <= 0.009){
      box.innerHTML = beBox("مينفعش يتحسب", [],
        u ? "كل أوردر بيخسر قبل المصاريف الثابتة — لازم الإعلان على الأوردر ينزل تحت " + esc(money(u.pre)) + " الأول."
          : "مفيش أوردرات في الفترة دي.", "—", "v-due");
      return;
    }
    var need = Math.ceil((u.fixed + t) / u.cu - 1e-9);
    box.innerHTML =
      beBox("محتاج كام أوردر؟", [
        d ? "<div class='mrow'><span>في اليوم</span><b class='num'>" + esc(qty(Math.ceil(need / d * 10) / 10)) + "</b></div>" : ""
      ], "عشان صافي الربح يبقى <b>" + esc(money(t)) + "</b>" + (d ? " في " + qty(d) + " يوم" : "") + ".", qty(need) + " أوردر", "v-gain") +
      beBox("المعادلة", [
        mRow("مصاريف ثابتة", u.fixed),
        mRow("+ الربح المطلوب", t),
        mRow("÷ كسب الأوردر", u.cu),
        "<div class='mrow tot'><span>= أوردرات</span><b class='num'>" + esc(qty(need)) + "</b></div>"
      ], "");
  }

  /* ---------- استرداد رأس المال ---------- */
  var PB_HEAD = ["الشريك","رأس ماله","كسب فعلاً","نسبة الاسترداد",
                 "قبض كاش","معدل ربحه الشهري","فاضل على الاسترداد"];

  function renderPayback(){
    var ps = partners();
    var note = document.getElementById("rep-pb-note");
    if(!ps.length){
      if(note) note.textContent = "لسه مفيش شركاء مسجّلين.";
      table("t-rep-payback", ["الشريك"], [], "");
      return;
    }
    var act = activeMonths(3), nM = act.length;
    if(note) note.innerHTML =
      "«كسب فعلاً» = نصيبه من ربح كل شهر بنسبته المرجّحة وقتها، من أول يوم لحد النهاردة — " +
      "سواء سحبه أو سابه في الشركة. ومعدل الربح الشهري محسوب على <strong>آخر " + qty(nM) +
      " شهر فيها حركة</strong>" +
      (nM ? " (" + esc(act[0].key) + (nM > 1 ? " ← " + esc(act[nM-1].key) : "") + ")" : "") + ". " +
      "<strong>ملحوظة:</strong> فترة الاسترداد مقياس إداري للتخطيط، مش بند في القوايم المالية.";

    var rows = ps.map(function(p){
      var cap = capitalOf(p.id);
      var earned = partnerEarned(p.id);
      var cash = partnerCashOut(p.id);
      var rate = partnerMonthlyRate(p.id, 3);
      var left = cap - earned;
      var pct  = cap > 0 ? earned / cap : 0;
      var monthsLeft = (left > 0.009 && rate > 0.009) ? left / rate : null;
      var when = left <= 0.009
        ? "<span class='v-gain'>استرد بالكامل</span>"
        : (rate <= 0.009
            ? "<span class='v-due'>محتاج ربح موجب</span>"
            : "<span class='num'>" + qty(Math.ceil(monthsLeft)) + " شهر</span>" +
              "<span class='sub'>باقي " + money(left) + "</span>");
      return { v: pct, h:
        "<tr><td class='wide'>" + esc(p.name) + "</td>" +
        "<td class='num'>" + money(cap) + "</td>" +
        "<td class='num " + (earned>=0?"v-gain":"v-due") + "'>" + money(earned) + "</td>" +
        "<td class='num'>" + pctTxt(pct) + "</td>" +
        "<td class='num'>" + money(cash) + "</td>" +
        "<td class='num " + (rate>=0?"":"v-due") + "'>" + money(rate) + "</td>" +
        "<td>" + when + "</td></tr>" };
    }).sort(function(a,b){ return b.v - a.v; }).map(function(x){ return x.h; });

    var tCap = ps.reduce(function(a,p){ return a + capitalOf(p.id); },0);
    var tEar = ps.reduce(function(a,p){ return a + partnerEarned(p.id); },0);
    var tCash= ps.reduce(function(a,p){ return a + partnerCashOut(p.id); },0);
    rows.push("<tr class='sumrow'><td class='wide'>الإجمالي</td>" +
      "<td class='num'>" + money(tCap) + "</td>" +
      "<td class='num'>" + money(tEar) + "</td>" +
      "<td class='num'>" + pctTxt(tCap ? tEar/tCap : 0) + "</td>" +
      "<td class='num'>" + money(tCash) + "</td><td></td><td></td></tr>");
    table("t-rep-payback", PB_HEAD, rows, "");
  }

  /* ---------- الربح شهر بشهر ---------- */
  // عمود مصغّر: الموضع والإشارة بيقولوا الاتجاه، مش اللون لوحده
  function miniBar(v, max){
    var w = max > 0 ? Math.min(Math.abs(v) / max * 100, 100) : 0;
    var t = (v >= 0 ? "ربح " : "خسارة ") + money(Math.abs(v));
    return "<div class='mbar' title='" + esc(t) + "'>" +
      "<div class='half neg'>" + (v < 0 ? "<i style='width:" + w.toFixed(1) + "%'></i>" : "") + "</div>" +
      "<div class='zero'></div>" +
      "<div class='half pos'>" + (v >= 0 ? "<i style='width:" + w.toFixed(1) + "%'></i>" : "") + "</div>" +
      "</div>";
  }
  function signed(v){ return (v > 0.009 ? "+" : "") + money(v); }

  var MON_HEAD = ["الشهر","الإيرادات","تكلفة البضاعة","مجمل الربح","مصاريف","صافي الربح","","التغيّر"];

  function renderMonths(){
    var ms = monthlyNets().filter(function(mo){ return mo.active; });
    if(!ms.length){ table("t-rep-months", ["الشهر"], [], "مفيش شهور فيها حركة لسه."); return; }
    var stats = ms.map(function(mo){ var c = periodStats(mo); c.key = mo.key; return c; });
    var max = stats.reduce(function(a,c){ return Math.max(a, Math.abs(c.net)); }, 0);

    /* v122: شهر خلص قبل أول بيعة (أول أوردر اتسلّم) = تجهيز — مش بيتقارن بيه، وإلا
       الشهر اللي بعده بيبان «اتحسّن» وهو أول شهر بيع. والشهر الحالي مكتوب لحد النهارده. */
    var first = live("sales").filter(isDelivered).reduce(function(a, s){ var d = revDate(s); return d && (!a || d < a) ? d : a; }, "");
    ms.forEach(function(mo, i){ stats[i].setup = !first || mo.to < first; stats[i].cur = inRange(today(), mo); });
    var rows = stats.map(function(c, i){
      var prev = i && !stats[i-1].setup && !c.setup ? stats[i-1].net : null;
      var d = prev === null ? null : c.net - prev;
      var why = c.setup ? "مش بيتقارن" : (i && stats[i-1].setup ? "أول شهر بيع" : "");
      return "<tr><td class='wide'><span class='num'>" + esc(c.key) + "</span>" +
          (c.setup ? " <span class='pis-tag fixed'>تجهيز — قبل أول بيعة</span>" : "") +
          (c.cur ? "<span class='sub'>لحد " + esc(dShort(today())) + "</span>" : "") + "</td>" +
        "<td class='num'>" + money(c.revenue) + "</td>" +
        "<td class='num'>" + money(c.cogs) + "</td>" +
        "<td class='num " + ((c.revenue-c.cogs)>=0?"v-gain":"v-due") + "'>" + money(c.revenue-c.cogs) + "</td>" +
        "<td class='num'>" + money(c.expenses) + "</td>" +
        "<td class='num " + (c.net>=0?"v-gain":"v-due") + "' style='font-weight:600'>" +
          esc(signed(c.net)) + "</td>" +
        "<td class='barcell'>" + miniBar(c.net, max) + "</td>" +
        "<td class='num " + (d === null ? "" : (d>=0?"v-gain":"v-due")) + "'>" +
          (d === null ? (why ? "<span style='color:var(--ink-soft)'>— " + esc(why) + "</span>" : "—") : esc(signed(d))) + "</td></tr>";
    });
    var T = stats.reduce(function(a,c){
      a.rev += c.revenue; a.cogs += c.cogs; a.exp += c.expenses; a.net += c.net; return a;
    }, { rev:0, cogs:0, exp:0, net:0 });
    rows.push("<tr class='sumrow'><td class='wide'>الإجمالي</td>" +
      "<td class='num'>" + money(T.rev) + "</td><td class='num'>" + money(T.cogs) + "</td>" +
      "<td class='num'>" + money(T.rev - T.cogs) + "</td><td class='num'>" + money(T.exp) + "</td>" +
      "<td class='num'>" + esc(signed(T.net)) + "</td><td></td><td></td></tr>");
    table("t-rep-months", MON_HEAD, rows, "");
  }

  /* ---------- تحليل الحساسية ---------- */
  /* كل نسبة بتضرب في البند اللي بتخصّه:
       السعر  → الإيراد بس
       التكلفة → تكلفة البضاعة بس
       الحجم  → الإيراد والتكلفة والشحن والمصاريف المتغيّرة مع بعض
       الثابت → المصاريف الثابتة بس
     وبعدين نعيد بناء هامش المساهمة وصافي الربح ونقطة التعادل. */
  function sensVal(id){
    var el = document.getElementById(id);
    return 1 + (Number(toEn(el ? el.value : "")) || 0) / 100;
  }
  function renderSens(){
    var r = periodRange(), c = periodStats(r);
    var kp = sensVal("sn-price"), kc = sensVal("sn-cost"),
        kv = sensVal("sn-vol"),   kf = sensVal("sn-fixed");

    var rev  = c.revenue * kp * kv;
    var cogs = c.cogs * kc * kv;
    var ship = c.netShip * kv;
    var vexp = c.varExp * kv;
    var fx   = c.fixedExp * kf;
    var cm   = rev - cogs + ship - vexp;
    var pct  = rev ? cm / rev : 0;
    var net  = cm - fx;
    var be   = pct > 0 ? fx / pct : null;
    var be0  = c.cmPct > 0 ? c.fixedExp / c.cmPct : null;

    var line = function(name, now, then, cls){
      var d = then - now;
      return "<tr><td class='wide'>" + esc(name) + "</td>" +
        "<td class='num'>" + money(now) + "</td>" +
        "<td class='num " + (cls || "") + "' style='font-weight:600'>" + money(then) + "</td>" +
        "<td class='num " + (Math.abs(d)<0.009 ? "" : (d>0?"v-gain":"v-due")) + "'>" +
          (Math.abs(d)<0.009 ? "—" : esc(signed(d))) + "</td></tr>";
    };
    var rows = [
      line("الإيرادات", c.revenue, rev),
      line("تكلفة البضاعة", c.cogs, cogs),
      line("المصاريف الثابتة", c.fixedExp, fx),
      "<tr><td class='wide'>نسبة هامش المساهمة</td>" +
        "<td class='num'>" + pctTxt(c.cmPct) + "</td>" +
        "<td class='num' style='font-weight:600'>" + pctTxt(pct) + "</td>" +
        "<td class='num " + (pct>=c.cmPct?"v-gain":"v-due") + "'>" +
          ((pct-c.cmPct)*100).toFixed(1) + " نقطة</td></tr>",
      "<tr class='sumrow'><td class='wide'>صافي الربح</td>" +
        "<td class='num'>" + money(c.net) + "</td>" +
        "<td class='num " + (net>=0?"v-gain":"v-due") + "'>" + esc(signed(net)) + "</td>" +
        "<td class='num " + ((net-c.net)>=0?"v-gain":"v-due") + "'>" + esc(signed(net-c.net)) + "</td></tr>",
      "<tr class='sumrow'><td class='wide'>مبيعات التعادل</td>" +
        "<td class='num'>" + (be0 === null ? "—" : money(be0)) + "</td>" +
        "<td class='num'>" + (be === null ? "—" : money(be)) + "</td>" +
        "<td class='num " + ((be !== null && be0 !== null && be <= be0) ? "v-gain" : "v-due") + "'>" +
          (be === null || be0 === null ? "—" : esc(signed(be - be0))) + "</td></tr>"
    ];
    table("t-rep-sens", ["البند","دلوقتي","بعد التغيير","الفرق"], rows, "");
  }

  /* ---------- تعادل الأصناف ---------- */
  var IBE_HEAD = ["الصنف","اتباع","هامش القطعة","نسبة الهامش","إجمالي المساهمة",
                  "% من الثابت","قطع لتغطية الثابت","الحكم"];

  function renderItemBE(){
    var r = periodRange(), c = periodStats(r);
    var m = {};
    c.deliv.forEach(function(s){
      SL(s).forEach(function(l){
        var n = lineSold(l, s); if(!l.itemId || !n) return;
        if(!m[l.itemId]) m[l.itemId] = { q:0, rev:0, cost:0 };
        m[l.itemId].q += n;
        m[l.itemId].rev += n * (Number(l.price)||0);
        m[l.itemId].cost += n * lineCost(l);
      });
    });
    var totalCM = Object.keys(m).reduce(function(a,k){ return a + (m[k].rev - m[k].cost); }, 0);
    var rows = Object.keys(m).map(function(id){
      var x = m[id], cm = x.rev - x.cost, unit = x.q ? cm / x.q : 0;
      var pct = x.rev ? cm / x.rev : 0;
      var cover = c.fixedExp > 0 ? cm / c.fixedExp : 0;
      var need = unit > 0.009 && c.fixedExp > 0 ? Math.ceil(c.fixedExp / unit) : null;
      var verdict = unit < -0.009
        ? "<span class='v-due'>بتخسر في كل قطعة — راجع السعر أو التكلفة</span>"
        : (pct > 0 && pct < 0.15
            ? "<span class='v-due'>هامش ضعيف</span>"
            : (unit > 0.009 ? "<span class='v-gain'>بيساهم</span>" : "—"));
      return { v: cm, h:
        "<tr><td class='wide'>" + thumbHTML(id) + esc(itemName(id)) + "</td>" +
        "<td class='num'>" + qty(x.q) + "</td>" +
        "<td class='num " + (unit>=0?"v-gain":"v-due") + "'>" + money(unit) + "</td>" +
        "<td class='num'>" + pctTxt(pct) + "</td>" +
        "<td class='num " + (cm>=0?"v-gain":"v-due") + "' style='font-weight:600'>" + money(cm) + "</td>" +
        "<td class='num'>" + (c.fixedExp > 0 ? pctTxt(cover) : "—") + "</td>" +
        "<td class='num'>" + (need === null ? "—" : qty(need)) + "</td>" +
        "<td>" + verdict + "</td></tr>" };
    }).sort(function(a,b){ return b.v - a.v; }).map(function(x){ return x.h; });

    if(rows.length){
      rows.push("<tr class='sumrow'><td class='wide'>إجمالي المساهمة</td><td></td><td></td><td></td>" +
        "<td class='num'>" + money(totalCM) + "</td>" +
        "<td class='num'>" + (c.fixedExp > 0 ? pctTxt(totalCM / c.fixedExp) : "—") + "</td>" +
        "<td></td><td>" + (totalCM >= c.fixedExp
          ? "<span class='v-gain'>بتغطّي الثابت</span>"
          : "<span class='v-due'>ناقص " + esc(money(c.fixedExp - totalCM)) + "</span>") + "</td></tr>");
    }
    table("t-rep-itembe", IBE_HEAD, rows, "مفيش مبيعات مسلّمة في الفترة دي.");
  }

  /* ---------- أعمار الديون ---------- */
  var AGE_BUCKETS = [[0,30,"لحد ٣٠ يوم"],[31,60,"٣١–٦٠"],[61,90,"٦١–٩٠"],[91,1e9,"أكتر من ٩٠"]];

  function renderAging(){
    var t = today(), rows = {}, tot = [0,0,0,0], grand = 0;
    live("sales").forEach(function(s){
      if(!isDelivered(s)) return;
      var due = saleTotal(s) + shipIn(s) - (Number(s.paid)||0);
      if(due <= 0.009) return;
      var age = daysBetween(revDate(s) || s.date, t);
      var bi = 0;
      AGE_BUCKETS.forEach(function(bk, i){ if(age >= bk[0] && age <= bk[1]) bi = i; });
      var k = s.partyId || "_";
      if(!rows[k]) rows[k] = { b:[0,0,0,0], tot:0, ship:0, oldest:age };
      rows[k].b[bi] += due; rows[k].tot += due;
      if(viaShip(s)) rows[k].ship += due;
      if(age > rows[k].oldest) rows[k].oldest = age;
      tot[bi] += due; grand += due;
    });

    document.getElementById("age-stats").innerHTML = AGE_BUCKETS.map(function(bk, i){
      return "<div><span>" + esc(bk[2]) + "</span><strong class='num " +
        (i >= 2 && tot[i] > 0.009 ? "v-due" : "") + "'>" + esc(money(tot[i])) + "</strong>" +
        "<small>" + (grand ? pctTxt(tot[i]/grand) + " من المستحق" : "—") + "</small></div>";
    }).join("") + "<div><span>الإجمالي المستحق</span><strong class='num'>" +
      esc(money(grand)) + "</strong><small>على أوردرات مسلّمة</small></div>";

    var list = Object.keys(rows).map(function(k){
      var x = rows[k];
      return { v:x.tot, h: "<tr><td class='wide'>" + esc(partyName(k)) +
        (x.ship > 0.009 ? "<span class='sub'>منه " + esc(money(x.ship)) + " مع شركة الشحن</span>" : "") +
        "</td>" +
        x.b.map(function(v, i){
          return "<td class='num " + (i >= 2 && v > 0.009 ? "v-due" : "") + "'>" +
            (v > 0.009 ? money(v) : "—") + "</td>"; }).join("") +
        "<td class='num' style='font-weight:600'>" + money(x.tot) + "</td>" +
        "<td class='num'>" + qty(x.oldest) + " يوم</td></tr>" };
    }).sort(function(a,b){ return b.v - a.v; }).map(function(x){ return x.h; });

    if(list.length){
      list.push("<tr class='sumrow'><td class='wide'>الإجمالي</td>" +
        tot.map(function(v){ return "<td class='num'>" + money(v) + "</td>"; }).join("") +
        "<td class='num'>" + money(grand) + "</td><td></td></tr>");
    }
    table("t-fs-age", ["العميل"].concat(AGE_BUCKETS.map(function(b){ return b[2]; }))
      .concat(["الإجمالي","أقدم دين"]), list, "مفيش مديونيات على العملاء دلوقتي.");
  }

  /* v122 — قايمة الدخل: عمود واحد بزرارين — «لو كله اتسلّم» (الفعلي + الماشي بالمتوقع)
     و«اتسلّم فعلاً» (نفس periodStats) — وجنبه «على الأوردر» و«من المبيعات».
     المصاريف بأنواعها (expByCat): المتغيّر فوق «ربح الأوردر بعد مصاريف البيع»
     والثابت تحته. الأرقام من projStats — نفس اللي في الرئيسية و«ماشي إزاي؟». */
  var pisMode = "exp";
  // نسبة الرفض من كل الأوردرات اللي خلصت — بتتحسب من ٥ أوردرات على الأقل
  function refusalRate(){
    var d = 0, x = 0;
    live("sales").forEach(function(s){ if(isDelivered(s)) d++; else if(isCancelled(s)){ d++; x++; } });
    return d >= 5 ? { p:x / d, n:d, x:x } : null;
  }
  function renderProjIS(){
    var t = document.getElementById("t-pis"); if(!t) return;
    // v131: «من غير إعلانات» = نفس القايمة بالظبط (نفس البنود والأعمدة) والإعلانات صفر،
    // على «لو كله اتسلّم» أو «اتسلّم فعلاً» حسب الاختيار اللي تحت الكروت
    var PR = periodRange(), P = projStats(PR), noAds = pisMode === "noads";
    var base = (pisMode === "act" || (noAds && pisNaBase === "act")) ? P.act : P.exp;
    var v = noAds ? pisNoAds(base) : base;
    Array.prototype.forEach.call(document.querySelectorAll("#pis-mode [data-pism]"), function(b){
      b.classList.toggle("on", b.dataset.pism === pisMode);
      b.textContent = b.dataset.pism === "act" ? "اتسلّم فعلاً (" + qty(P.nDone) + ")"
        : b.dataset.pism === "noads" ? "من غير إعلانات" : "لو كله اتسلّم (" + qty(P.n) + " أوردر)";
    });
    var na = document.getElementById("pis-na");
    if(na) na.hidden = pisMode !== "noads";
    if(noAds) renderPisNoAds(P);
    var n = v.n, g = v.goods;
    var tag = function(k){ return k ? " <span class='pis-tag " + k + "'>" + (k === "var" ? "متغيّر" : "ثابت") + "</span>" : ""; };
    // kind "" = بند بيتطرح (أحمر لو فيه مبلغ) · "sum" = إجمالي بلون إشارته
    // dd = البند بيتفتح بالدوس ويوريك الأوردرات أو المصاريف اللي جواه (v126)
    var row = function(label, val, kind, cls, sub, dd){
      var c = kind === "sum" ? (val >= 0 ? "v-gain" : "v-due") : kind === "base" ? "" : (val > 0.009 ? "v-due" : "");
      if(dd) cls = (cls ? cls + " " : "") + "pis-click" + (pisOpen === dd ? " on" : "");
      return "<tr" + (cls ? " class='" + cls + "'" : "") +
        (dd ? " data-pisdd='" + dd + "' tabindex='0' role='button' aria-expanded='" + (pisOpen === dd) + "'" : "") +
        "><td class='wide'>" + (dd ? "<span class='pis-l'>" + label + "</span>" : label) + (sub ? "<span class='sub'>" + sub + "</span>" : "") + "</td>" +
        "<td class='num " + c + "'>" + money(val) + "</td>" +
        "<td class='num " + c + "'>" + (n ? money(val / n) : "—") + "</td>" +
        "<td class='num' style='color:var(--ink-soft)'>" + (g > 0.009 ? "<span dir='ltr'>" + (val / g * 100).toFixed(1) + "%</span>" : "—") + "</td></tr>" +
        (dd && pisOpen === dd ? "<tr class='pis-dd'><td colspan='4'>" + pisDrill(dd, P) + "</td></tr>" : "");
    };
    var rows = [];
    rows.push(row("<b>المبيعات</b>", g, "base", "", "", "goods"));
    rows.push(row("− تكلفة البضاعة", v.cost, "", "", trIdx().total > 0.009 ? "فيها نصيب القطع من انتقالات شراء البضاعة" : "", "cost"));
    rows.push(row("= ربح البضاعة", v.gross, "sum", "pis-tot"));
    rows.push(v.ship >= 0
      ? row("+ ربح الشحن", v.ship, "sum", "", "العميل دفع " + esc(money(v.sin)) + " · الشركة " + esc(money(v.sout)), "ship")
      : row("− فرق الشحن", -v.ship, "", "", "العميل دفع " + esc(money(v.sin)) + " · الشركة " + esc(money(v.sout)), "ship"));
    rows.push(noAds
      ? row("− إعلانات" + tag("var"), 0, "", "", v.adsOff > 0.009 ? "متشالة من الحسبة — اتصرف فعلاً " + esc(money(v.adsOff)) : "")
      : row("− إعلانات" + tag("var"), v.ads, "", "", "", v.ads > 0.009 ? "ads" : ""));
    if(v.pack > 0.009) rows.push(row("− تغليف" + tag("var"), v.pack, "", "", "", "pack"));
    if(Math.abs(v.xloss) > 0.009) rows.push(row((costTrueUps().some(function(x){ return inRange(x.d, PR); }) ? "− خسارة استبدال وفرق تكلفة" : "− خسارة استبدال مع المورد") + tag("var"), v.xloss, "", "", "", "xloss"));
    if(Math.abs(v.othervar) > 0.009) rows.push(row("− مصاريف متغيّرة تانية" + tag("var"), v.othervar, "", "", "", "othervar"));
    rows.push(row("= ربح الأوردر بعد مصاريف البيع", v.contrib, "sum", "pis-tot"));
    [["subs","اشتراكات"],["salary","مرتبات"],["once","مرة واحدة"],["trans","انتقالات من غير فاتورة"],["other","مصاريف تانية"]].forEach(function(x){
      if(Math.abs(v[x[0]]) > 0.009) rows.push(row("− " + x[1] + tag("fixed"), v[x[0]], "", "", "", x[0]));
    });
    rows.push(row("= صافي الربح", v.net, "sum", "pis-net"));
    table("t-pis", ["البند", "المبلغ", "على الأوردر" + (n ? " (÷" + qty(n) + ")" : ""), "من المبيعات"], rows, "");

    var sm = document.getElementById("pis-sum");
    if(sm) sm.innerHTML = "لو كله اتسلّم: <b class='num " + (P.exp.net >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(P.exp.net)) + "</b>" +
      " · اتسلّم فعلاً: <b class='num " + (P.act.net >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(P.act.net)) + "</b>";
    var rf = refusalRate(), adj = null;
    if(rf && P.nOpen){
      adj = P.c.net;
      P.open.forEach(function(s){ var e = expProfit(s); adj += (1 - rf.p) * e.net - rf.p * e.sout; });
    }
    var un = unclassifiedExpenses(), T = trIdx();
    var nt = document.getElementById("pis-note");
    if(nt) nt.innerHTML = (noAds
        ? "<b>«من غير إعلانات»</b> = نفس قايمة <b>«" + (pisNaBase === "act" ? "اتسلّم فعلاً" : "لو كله اتسلّم") + "»</b> بالظبط بس الإعلانات صفر — بيوريك البضاعة والشحن والمصاريف التانية بيكسبوا لوحدهم ولا لأ. <b>مش معناه</b> إن الأوردرات كانت هتيجي من غير إعلان."
        : pisMode === "act"
        ? "<b>«اتسلّم فعلاً»</b> = الأوردرات اللي اتسلّمت أو اتلغت في الفترة بس، ومقابلها كل مصاريف الفترة."
        : "<b>«لو كله اتسلّم»</b> = اللي اتسلّم فعلاً + الـ" + qty(P.nOpen) + " أوردر اللي لسه ماشيين لو العملاء خدوهم كلهم — <b>قبل أي رفض</b>.") +
      (adj !== null && pisMode !== "act" ? " لو الرفض فضل " + Math.round(rf.p * 100) + "% زي ما هو (" + qty(rf.x) + " من " + qty(rf.n) + "): <b class='num " + (adj >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(adj)) + "</b>." : "") +
      " «على الأوردر» = المبلغ ÷ عدد الأوردرات. الإعلان والتغليف <b>متغيّر</b> (بيزيد مع كل أوردر)، والباقي <b>ثابت</b>." +
      (T.total > 0.009 ? " انتقالات شراء البضاعة (" + esc(money(T.total)) + ") اتحطت على تكلفة القطع اللي اتشرت في المشوار — اللي اتباع منها في التكلفة فوق، والباقي في قيمة المخزون." : "") +
      (T.unlinked.length ? " <span class='v-due'>" + qty(T.unlinked.length) + " مشوار شراء مالوش فاتورة في نفس الأيام — اتحسب مصروف ثابت.</span>" : "") +
      (un ? " <span style='color:var(--ink-soft)'>" + qty(un) + " مصروف نوعه اتعرف من البيان — لو فيه غلط عدّله من الخزنة.</span>" : "") +
      (prepaidTotal() > 0.009 ? " المصاريف محسوبة على أيامها: <b class='num'>" + esc(money(prepaidTotal())) + "</b> اتدفعت مقدّم (رصيد فيسبوك واشتراكات) ولسه ما دخلتش — في «المدفوع مقدّماً»." : "") +
      (P.noCost ? " <span class='v-due'>" + esc(qty(P.noCost)) + " أوردر فيهم صنف لسه ما اتشراش — بره الحسبة.</span>" : "");
  }
  /* v130: «من غير إعلانات» — نفس القايمة بالوضعين جنب بعض («لو كله اتسلّم» و«اتسلّم فعلاً»)
     والإعلانات صفر. نسخة من الأرقام، الأصل ما بيتغيّرش. */
  function pisNoAds(v){
    var o = {}; Object.keys(v).forEach(function(k){ o[k] = v[k]; });
    o.adsOff = v.ads; o.ads = 0;
    o.varExp = v.varExp - v.ads; o.contrib = v.contrib + v.ads; o.net = v.net + v.ads;
    return o;
  }
  // الكروت فوق القايمة: صافي الربح من غير إعلانات في الحالتين، وتحتها القايمة على أنهي واحدة
  var pisNaBase = "exp";
  function renderPisNoAds(P){
    var E = pisNoAds(P.exp), A = pisNoAds(P.act), off = E.adsOff;
    var b = function(v){ return "<b class='num " + (v >= 0 ? "v-gain" : "v-due") + "'>" + esc(signed(v)) + "</b>"; };
    var on = function(k){ return pisNaBase === k ? " class='on'" : ""; };
    document.getElementById("pis-na").innerHTML =
      "<div class='hi'><span>من غير إعلانات — لو كله اتسلّم</span>" + b(E.net) + "<small>بالإعلانات: " + esc(signed(P.exp.net)) + "</small></div>" +
      "<div class='hi'><span>من غير إعلانات — اتسلّم فعلاً</span>" + b(A.net) + "<small>بالإعلانات: " + esc(signed(P.act.net)) + "</small></div>" +
      "<div><span>الإعلان خد منك</span><b class='num'>" + esc(money(off)) + "</b>" +
        (P.n ? "<small>" + esc(money(off / P.n)) + " على الأوردر (÷" + qty(P.n) + ")</small>" : "") + "</div>" +
      "<div class='pis-nab'><span>القايمة تحت على:</span><span class='quick' role='group' aria-label='القايمة على'>" +
        "<button type='button' data-pisnab='exp'" + on("exp") + ">لو كله اتسلّم (" + qty(P.n) + ")</button>" +
        "<button type='button' data-pisnab='act'" + on("act") + ">اتسلّم فعلاً (" + qty(P.nDone) + ")</button></span></div>";
  }
  document.getElementById("pis-na").addEventListener("click", function(e){
    var x = e.target.closest("[data-pisnab]"); if(!x) return;
    pisNaBase = x.dataset.pisnab; pisOpen = null; renderProjIS();
  });
  document.getElementById("pis-mode").addEventListener("click", function(e){
    var b = e.target.closest("[data-pism]"); if(!b) return;
    pisMode = b.dataset.pism; renderProjIS(); renderItemProfit();
  });
  /* v126: كل بند في قايمة الدخل بيتفتح ويوريك جاي منين — نفس الحساب بالظبط،
     والإجمالي تحت = رقم البند. الأوردرات: المسلّم بإيراده الفعلي، واللي لسه ماشي
     (في «لو كله اتسلّم» بس) بـ expProfit زي projStats. */
  var pisOpen = null;
  var PIS_DD_MAX = 12, pisAll = false;   // pisAll: البند المفتوح معروض كله
  function pisDrill(key, P){
    var r = periodRange(), L = [], go = "", goTxt = "", tot = 0;
    var act = pisMode === "act" || (pisMode === "noads" && pisNaBase === "act");
    var who = function(s){ return "#" + esc(s.no || "—") + " · " + esc(partyName(s.partyId)); };
    if(key === "goods" || key === "cost" || key === "ship"){
      P.c.list.forEach(function(s){
        var del = isDelivered(s), canc = isCancelled(s), open = !del && !canc, val = 0, t = "";
        if(open && act) return;
        var e = open ? expProfit(s) : null;
        if(key === "goods") val = del ? saleTotal(s) : (e ? e.goods : 0);
        else if(key === "cost") val = del ? SL(s).reduce(function(b, l){ return b + lineCost(l) * lineSold(l, s); }, 0) : (e ? e.cost : 0);
        else if(open || shipCounts(s)){
          var si = shipIn(s), so = shipOut(s); val = si - so;
          if(Math.abs(si) < 0.009 && Math.abs(so) < 0.009) return;
          t = "العميل " + esc(money(si)) + " · الشركة " + esc(money(so));
        }
        if(Math.abs(val) < 0.009 && key !== "ship") return;
        if(open) t = (t ? t + " · " : "") + "لسه ماشي";
        else if(canc) t = (t ? t + " · " : "") + "ملغي";
        tot += val;
        L.push({ d:revDate(s) || s.date, t:who(s) + (t ? " <small>(" + t + ")</small>" : ""), v:val });
      });
      go = "sales"; goTxt = "افتح الأوردرات";
    } else if(key === "xloss"){
      live("purchases").forEach(function(p){
        if(!p.xloss || !inRange(p.date, r)) return;
        var a = Number(p.xloss)||0; tot += a;
        L.push({ d:p.date, t:(a > 0 ? "خسارة " : "مكسب ") + (p.xchg ? "استبدال" : "مرتجع") + (p.pno ? " #" + esc(p.pno) : "") + " · " + esc(itemName(p.itemId)), v:a });
      });
      costTrueUps().forEach(function(x){
        if(!inRange(x.d, r)) return; tot += x.v;
        var kk = x.k.split("|");
        L.push({ d:x.d, t:"فرق تكلفة · " + esc(itemName(x.itemId)) + (vLabel(kk[1], kk[2]) ? " · " + esc(vLabel(kk[1], kk[2])) : "") + " <small>(خلص من المخزن وفضل عليه تكلفة)</small>", v:x.v });
      });
      go = "purch"; goTxt = "افتح المشتريات";
    } else {
      live("cash").forEach(function(c){
        if(c.type !== "expense" || trLinked(c)) return;
        if(!(expCat(c) === key || (key === "ads" && isMetaTop(c)))) return;
        var a = expAmtIn(c, r); if(Math.abs(a) < 0.005) return; tot += a;
        L.push({ d:c.date, t:(isMetaTop(c) ? "رسوم فوري · " : "") + esc(c.note || "—"), v:a });
      });
      if(key === "ads") metaSpans().forEach(function(s){
        var a = shareIn(s.from, s.days, s.spent, r); if(Math.abs(a) < 0.005) return; tot += a;
        L.push({ d:s.to, t:"فيسبوك صرف من " + esc(dShort(s.from)) + " لـ " + esc(dShort(s.to)), v:a });
      });
      go = "cash"; goTxt = "افتحهم في الخزنة";
    }
    L.sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    if(!L.length) return "<p class='hint' style='margin:0'>مفيش حاجة في الفترة دي.</p>";
    var more = L.length - PIS_DD_MAX;
    return "<div class='pis-dl'>" + L.slice(0, pisAll ? L.length : PIS_DD_MAX).map(function(x){
        return "<div><span class='num'>" + esc(dShort(x.d)) + "</span><span class='t'>" + x.t + "</span><b class='num'>" + esc(money(x.v)) + "</b></div>";
      }).join("") +
      (more > 0 ? "<div style='border:0'><span></span><span class='t'><button type='button' class='go' data-pisall aria-expanded='" + pisAll + "'>" +
        (pisAll ? "اعرض أول " + qty(PIS_DD_MAX) + " بس ▴" : "اعرض الـ " + qty(more) + " الباقيين ▾") + "</button></span><b></b></div>" : "") +
      "<div class='tot'><span></span><span class='t'>الإجمالي (" + qty(L.length) + ")</span><b class='num'>" + esc(money(tot)) + "</b></div>" +
      (canTab(go) ? "<div style='border:0'><button type='button' class='go' data-pisgo='" + go + "'>" + goTxt + " ←</button></div>" : "") +
      "</div>";
  }
  (function(){
    var t = document.getElementById("t-pis");
    var tog = function(tr){ pisOpen = pisOpen === tr.dataset.pisdd ? null : tr.dataset.pisdd; pisAll = false; renderProjIS();
      var n = t.querySelector("tr[data-pisdd='" + tr.dataset.pisdd + "']"); if(n) n.focus(); };
    t.addEventListener("click", function(e){
      if(e.target.closest("[data-pisall]")){ pisAll = !pisAll; renderProjIS();
        var b = t.querySelector("[data-pisall]"); if(b) b.focus(); return; }
      var g = e.target.closest("[data-pisgo]");
      if(g){ goTab(g.dataset.pisgo); if(g.dataset.pisgo === "sales") setSView("all"); return; }
      var tr = e.target.closest("tr[data-pisdd]"); if(tr) tog(tr);
    });
    t.addEventListener("keydown", function(e){
      if(e.key !== "Enter" && e.key !== " ") return;
      var tr = e.target.closest("tr[data-pisdd]"); if(!tr || e.target !== tr) return;
      e.preventDefault(); tog(tr);
    });
  })();
  /* v126: ربح كل صنف بعد الإعلان والشحن — نفس قايمة الدخل بنفس الوضع («لو كله اتسلّم» أو «اتسلّم فعلاً»):
     البضاعة والتكلفة سطر سطر زي periodStats/expProfit بالظبط، فرق شحن كل أوردر بيتقسم على أصنافه
     على قد بضاعة كل صنف فيه (ولو الأوردر مالوش بضاعة — ملغي — بالتساوي)، والمصاريف المتغيّرة
     (إعلان وتغليف واستبدال…) على الأصناف على قد مبيعاتها. مجموع «صافي الصنف» = «ربح الأوردر بعد
     مصاريف البيع» في القايمة بالظبط. */
  function itemProfit(P, act){
    var v = act ? P.act : P.exp, M = {}, G = 0;
    var bucket = function(id){ return M[id] = M[id] || { q:0, g:0, c:0, sh:0, ads:0, ov:0 }; };
    P.c.list.forEach(function(s){
      var del = isDelivered(s), canc = isCancelled(s), open = !del && !canc;
      if(open && act) return;
      var rows = [], tot = 0;
      SL(s).forEach(function(l){
        var price = Number(l.price)||0, uc = lineCost(l), q = 0;
        if(del) q = lineSold(l, s);
        else if(open){
          q = Number(l.qty)||0;
          var pinned = l.unitCost != null && l.unitCost !== "";
          if(!l.itemId || q <= 0 || !(uc > 0 || pinned)) q = 0;          // زي expProfit: صنف ما اتشراش بره الحسبة
        }
        rows.push({ id:l.itemId || "", q:q, g:q * price, c:q * uc });
        tot += q * price;
      });
      var ship = shipIn(s) - shipOut(s);                                 // المفتوح والمسلّم والملغي كلهم بيتحسبوا هنا
      rows.forEach(function(x){
        var m = bucket(x.id);
        m.q += x.q; m.g += x.g; m.c += x.c;
        m.sh += tot > 0.009 ? ship * x.g / tot : ship / rows.length;
        G += x.g;
      });
      if(!rows.length && Math.abs(ship) > 0.009) bucket("").sh += ship;
    });
    var ov = v.varExp - v.ads;                                           // تغليف + استبدال + متغيّر تاني
    // v143: على عدد القطع — كل قطعة بتشيل نفس النصيب (زي «تكلفة التشغيل على القطعة»)
    var Q = 0; Object.keys(M).forEach(function(id){ Q += M[id].q; });
    if(Q > 0.009) Object.keys(M).forEach(function(id){ M[id].ads = v.ads * M[id].q / Q; M[id].ov = ov * M[id].q / Q; });
    else if(Math.abs(v.varExp) > 0.009){ var b0 = bucket(""); b0.ads = v.ads; b0.ov = ov; }
    Object.keys(M).forEach(function(id){ var m = M[id]; m.net = m.g - m.c + m.sh - m.ads - m.ov; });
    return { M:M, G:G, v:v };
  }
  // القطع اللي اتطلبت في آخر ١٤ يوم (من غير الملغي) ÷ عدد الأيام — زي «أكتر الأصناف طلباً»
  function itemPace(){
    var from14 = addDays(today(), -13), cnt = {}, first = null;
    live("sales").forEach(function(x){
      if(isCancelled(x) || !x.date) return;
      if(!first || x.date < first) first = x.date;
      if(!inRange(x.date, { from:from14, to:today() })) return;
      SL(x).forEach(function(l){ if(l.itemId) cnt[l.itemId] = (cnt[l.itemId] || 0) + Math.max(0, Number(l.qty)||0); });
    });
    var days = first ? Math.min(14, Math.max(1, daysBetween(first, today()) + 1)) : 14;
    var o = {}; Object.keys(cnt).forEach(function(k){ o[k] = cnt[k] / days; });
    return o;
  }
  var ITP_ST = { go:"أعلن عليه", pair:"بيعه مع قطعة تانية", bad:"راجع سعره", idle:"واقف" };
  function itemStatus(m, stock){
    if(m.q <= 0) return stock > 0 ? "idle" : "";
    var gross = m.g - m.c, mg = m.g > 0.009 ? gross / m.g : 0;
    if(gross <= 0.009 || (m.net <= 0.009 && mg < 0.30)) return "bad";
    return m.net > 0.009 ? "go" : "pair";
  }
  function renderItemProfit(){
    var t = document.getElementById("t-rep-itp"); if(!t) return;
    var P = projStats(periodRange()), act = pisMode === "act", R = itemProfit(P, act), M = R.M;
    var pace = itemPace();
    var ids = Object.keys(M).filter(function(id){ return id; });
    live("items").forEach(function(it){ if(!M[it.id] && freeSplit(it.id).pos > 0){ M[it.id] = { q:0, g:0, c:0, sh:0, ads:0, ov:0, net:0 }; ids.push(it.id); } });
    // v143: الحالة والترتيب والشريط على الصافي بعد تكلفة التشغيل — نفس الرقم اللي في السطر
    var OPi = opPlan(periodRange(), act, P, M), fq = OPi.perFix;          // الثابت على القطعة — الإعلان والتغليف جوّه m بالفعل
    var X = ids.map(function(id){ var st = freeSplit(id).pos, mm = Object.assign({}, M[id]); mm.net = M[id].net - M[id].q * fq;
      return { id:id, m:M[id], n:mm.net, stock:st, st:itemStatus(mm, st) }; });
    X.sort(function(a, b){ return (a.st === "idle") - (b.st === "idle") || b.n - a.n || a.stock - b.stock; });
    var maxN = X.reduce(function(a, x){ return Math.max(a, Math.abs(x.n)); }, 0);
    var pctTxt = function(g, c){ return g > 0.009 ? "<span dir='ltr'>" + ((g - c) / g * 100).toFixed(1) + "%</span>" : "—"; };
    var daysTxt = function(x){
      if(x.stock <= 0) return "<span class='v-due'>خلص</span>";
      var r = pace[x.id] || 0;
      if(r <= 0) return "عندك " + plural(x.stock, "قطعة", "قطعتين", "قطع") + " · مفيش طلب";
      var d = Math.floor(x.stock / r);
      if(d > 90) return "يكفي أكتر من 3 شهور";
      return "<span" + (d < 7 ? " class='v-due'" : "") + ">يكفي " + (d < 1 ? "أقل من يوم" : nDays(d).replace(/^يوم$/, "يوم واحد")) + "</span>";
    };
    var rows = X.map(function(x){
      var m = x.m, z = m.q <= 0 && Math.abs(m.sh) < 0.009 && Math.abs(m.net) < 0.009,   // واقف ومالوش أي رقم
          op = m.ads + m.ov + m.q * fq, net = m.net - m.q * fq,
          nc = net > 0.009 ? "v-gain" : net < -0.009 ? "v-due" : "";
      var pp = m.q > 0 ? net / m.q : null;
      return "<tr><td class='wide'><b>" + esc(itemName(x.id)) + "</b>" +
          (z ? "" : "<span class='sub itp-m'>هامش " + pctTxt(m.g, m.c) + " · تشغيل " + sgNum(Math.round(op)) + " · شحن " + sgNum(Math.round(m.sh)) + " · المخزون: " + daysTxt(x) + "</span>") + "</td>" +
        "<td class='num'>" + qty(m.q) + "</td>" +
        "<td class='num itp-x'>" + (z ? "—" : money(m.g)) + "</td>" +
        "<td class='num itp-x'>" + (z ? "—" : pctTxt(m.g, m.c)) + "</td>" +
        "<td class='num itp-x' style='color:var(--ink-soft)'>" + (z ? "—" : money(op)) + "</td>" +
        "<td class='num itp-x' style='color:var(--ink-soft)'>" + (z ? "—" : money(m.sh)) + "</td>" +
        "<td class='num " + nc + "'>" + (pp === null ? "—" : signed(pp)) + "</td>" +
        "<td class='num " + nc + "' style='font-weight:700'>" + (z ? "—" : signed(net)) + "</td>" +
        "<td class='barcell itp-x'>" + (z ? "" : miniBar(net, maxN)) + "</td>" +
        "<td class='itp-x'>" + daysTxt(x) + "</td>" +
        "<td>" + (x.st ? "<span class='itp-st " + x.st + "'>" + ITP_ST[x.st] + "</span>" : "") + "</td></tr>";
    });
    var T = { q:0, g:0, c:0, sh:0, ads:0, net:0 };
    Object.keys(M).forEach(function(id){ var m = M[id]; ["q","g","c","sh","net"].forEach(function(k){ T[k] += m[k]; });
      T.ads += m.ads + m.ov + m.q * fq; T.net -= m.q * fq; });
    if(rows.length) rows.push("<tr class='itp-tot'><td class='wide'>الإجمالي" +
        (M[""] ? "<span class='sub'>فيه " + esc(money(M[""].net)) + " من غير صنف</span>" : "") + "</td>" +
      "<td class='num'>" + qty(T.q) + "</td><td class='num itp-x'>" + money(T.g) + "</td><td class='num itp-x'>" + pctTxt(T.g, T.c) + "</td>" +
      "<td class='num itp-x'>" + money(T.ads) + "</td><td class='num itp-x'>" + money(T.sh) + "</td>" +
      "<td class='num'>" + (T.q > 0 ? signed(T.net / T.q) : "—") + "</td>" +
      "<td class='num " + (T.net >= 0 ? "v-gain" : "v-due") + "'>" + signed(T.net) + "</td><td class='itp-x'></td><td class='itp-x'></td><td></td></tr>");
    table("t-rep-itp", ["الصنف", act ? "اتباع" : "اتباع + ماشي", "المبيعات", "هامش البضاعة", "تكلفة التشغيل", "فرق الشحن",
      "صافي القطعة", "صافي الصنف", "", "المخزون", "الحالة"], rows, "مفيش مبيعات ولا مخزون في الفترة دي.");
    var nt = document.getElementById("rep-itp-note");
    // المطابقة مع قايمة الدخل: الفرق الوحيد = التأسيس (هنا على ٣ شهور، في القايمة مرة واحدة)
    var isNet = R.v.net, mg = T.net, gap = OPi.setupStmt - OPi.setup;
    if(nt && !(OPi.pcs > 0.009)) nt.innerHTML = "مفيش قطع " + (act ? "اتسلّمت" : "اتباعت") + " في الفترة دي — تكلفة التشغيل ما اتقسمتش على الأصناف. المصاريف كلها في قايمة الدخل (" + esc(money(isNet)) + ").";
    else if(nt) nt.innerHTML = "كل قطعة بتشيل نفس <b>تكلفة التشغيل</b>: <b class='num'>" + esc(money(OPi.per)) + "</b> = " + esc(money(OPi.total)) + " ÷ " + qty(OPi.pcs) + " قطعة " +
      "(إعلانات · تغليف · اشتراكات · تأسيس على ٣ شهور). فرق الشحن من الأوردرات اللي الصنف فيها. " +
      "المجموع <b class='num " + (mg >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(mg)) + "</b> = صافي الربح في قايمة الدخل (" + esc(money(isNet)) + ")" +
      (Math.abs(gap) > 0.009 ? " + باقي التأسيس اللي لسه هيتوزّع (" + esc(money(gap)) + ")" : "") + " — " +
      (act ? "<b>«اتسلّم فعلاً»</b>." : "<b>«لو كله اتسلّم»</b>: الأوردرات اللي لسه ماشية داخلة كأنها اتسلّمت.") +
      " «المخزون يكفي» على قد طلبات آخر ١٤ يوم.";
  }

  /* v126: التقارير تبويبات بدل صفحة طويلة. آخر تبويب بيتفتكر على الجهاز ده بس (naya:rtab) */
  var REP_TABS = ["sum", "fin", "cfo", "items", "cust", "team"], repTab = "sum", repTabInit = false;
  try{ var rt0 = LS && LS.getItem("naya:rtab"); if(REP_TABS.indexOf(rt0) >= 0) repTab = rt0; }catch(e){}
  function applyRepTab(swap){
    var sec = document.getElementById("tab-rep"); if(!sec) return;
    if((repTab === "fin" || repTab === "cfo") && !canMoney()) repTab = "sum";   // أرقام ربح وتكلفة
    Array.prototype.forEach.call(sec.querySelectorAll("[data-rtab]"), function(b){
      var on = b.dataset.rtab === repTab;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1;
    });
    var main = sec.querySelector(".panel[data-rt='" + repTab + "']");
    Array.prototype.forEach.call(sec.querySelectorAll("[data-rt]"), function(el){
      var on = el.dataset.rt === repTab;
      el.classList.toggle("rt-off", !on);
      // تبويب كله أقسام مطوية بيفتحها لوحده أول ما تدخله. لو فيه لوحة أساسية، المطوي يفضل مطوي
      if(on && swap && el.tagName === "DETAILS" && !main) el.open = true;
      if(on && swap){ el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); }
    });
    var rs = sec.querySelector(".rsecs");
    if(rs) rs.classList.toggle("rt-off", !rs.querySelector("[data-rt]:not(.rt-off)"));
  }
  var REP_TITLE = { sum:"قايمة الدخل", fin:"الميزانية", cfo:"ماشي إزاي؟", items:"الأداء", cust:"الأداء", team:"الأداء" };
  function repTitle(){
    var h = document.querySelector("#tab-rep > h2");
    if(h && h.firstChild && h.firstChild.nodeType === 3) h.firstChild.nodeValue = REP_TITLE[repTab] || "تقارير";
  }
  function setRepTab(t){
    if(REP_TABS.indexOf(t) < 0) return;
    if((t === "fin" || t === "cfo") && !canMoney()) t = "sum";
    repTab = t;
    try{ if(LS) LS.setItem("naya:rtab", t); }catch(e){}
    applyRepTab(true); repTitle();
    if(repTab === "fin") renderFin();
    if(repTab === "cfo"){ renderCfo(); cfoListIn(); }
    if(activeTab === "rep"){ navMark(); countIn(document.getElementById("tab-rep")); }
  }
  (function(){
    var bar = document.getElementById("rep-tabs");
    bar.addEventListener("click", function(e){
      var b = e.target.closest("[data-rtab]"); if(b && b.dataset.rtab !== repTab) setRepTab(b.dataset.rtab);
    });
    // الأسهم بتنقل بين التبويبات (RTL: السهم الشمال = اللي بعده)
    bar.addEventListener("keydown", function(e){
      var d = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0; if(!d) return;
      var i = (REP_TABS.indexOf(repTab) + d + REP_TABS.length) % REP_TABS.length;
      e.preventDefault(); setRepTab(REP_TABS[i]);
      var nb = bar.querySelector("[data-rtab='" + REP_TABS[i] + "']"); if(nb) nb.focus();
    });
  })();

  /* v132: القوايم المالية — على أساس التسليم: الإيراد بيتسجّل لما العميل يستلم (IFRS 15)،
     والأوردرات اللي لسه ماشية بضاعتها لسه مخزون. ده نفس أساس «اتسلّم فعلاً» و«الأرباح المحتجزة».
     الميزانية «كما في النهارده» (كل الحركات)، وقايمة الدخل للفترة اللي فوق ومن البداية.
     الأصول = الالتزامات + حقوق الملكية لازم تطلع بالقرش — الفرق بيبان لو فيه. */
  function finIS(r){
    var c = periodStats(r), X = expByCat(r), xl = xLossIn(r), sin = 0, sout = 0;
    c.list.forEach(function(s){ if(shipCounts(s)){ sin += shipIn(s); sout += shipOut(s); } });
    var o = { rev:c.revenue, sin:sin, cogs:c.cogs, sout:sout, ads:X.ads, pack:X.pack, xloss:xl, othervar:X.othervar,
              subs:X.subs, salary:X.salary, once:X.once, trans:X.trans, other:X.other, n:c.deliv.length };
    o.totRev = o.rev + o.sin; o.gross = o.totRev - o.cogs;
    o.sell = o.ads + o.sout + o.pack + o.xloss + o.othervar;
    o.admin = o.subs + o.salary + o.once + o.trans + o.other;
    o.net = o.gross - o.sell - o.admin;
    o.check = c.net;                       // لازم يساوي o.net — نفس أرقام السيستم
    return o;
  }
  function finBS(){
    var D = partyDues(), cr = D.recv, ca = D.custAdv, sa = D.supAdv, sp = D.pay;
    var inOrders = 0;
    live("sales").forEach(function(s){
      if(isDelivered(s) || isCancelled(s)) return;
      SL(s).forEach(function(l){ inOrders += (Number(l.qty)||0) * lineCost(l); });
    });
    var o = { cash:cashBox(), wallets:walletsTotal(), recv:cr, supAdv:sa, stock:stockBookValue(), inOrders:inOrders,
              pay:sp, custAdv:ca, partners:partners().map(function(p){ return { n:p.name, cap:capitalOf(p.id), cur:currentOf(p.id) }; }),
              re:retainedEarnings(), dist:distributedTotal(), opening:openingEquity() };
    o.prepaid = prepaidTotal(); o.prepMeta = metaBook().bal; o.owed = owedTotal();
    o.assets = o.cash + o.wallets + o.recv + o.supAdv + o.stock + o.prepaid;
    o.liab = o.pay + o.custAdv + o.owed;
    o.cap = o.partners.reduce(function(a, x){ return a + x.cap; }, 0);
    o.cur = o.partners.reduce(function(a, x){ return a + x.cur; }, 0);
    o.equity = o.cap + o.cur + o.re + o.opening;
    o.diff = o.assets - (o.liab + o.equity);
    o.recon = netAssets() - totalEquity();            // نفس «توفيق الميزانية» في الشركاء — لازم الاتنين يتفقوا
    return o;
  }
  /* ═══ v135: المدير المالي ═══
     تقييم الأداء وخطة زيادة الربح من نفس أرقام «قايمة الدخل» (لو كله اتسلّم) للفترة المختارة.
     الأثر محسوب على نفس عدد الأوردرات — مش بيفترض زيادة في البيع. المعايير هنا في مكان واحد: */
  var CFO_T = {
    margin:0.55,     // هامش البضاعة الكويس لمحل أحذية أونلاين
    itemMin:0.40,    // صنف هامشه أقل من كده = سعره محتاج يتراجع
    raiseCap:0.10,   // أقصى زيادة سعر بنقترحها مرة واحدة (١٠٪) عشان البيع ما يقعش
    adShare:0.40,    // الإعلان ما يزيدش عن ٤٠٪ من ربح الأوردر قبل الإعلان
    discMax:0.03,    // الخصومات ما تزيدش عن ٣٪ من المبيعات
    weakNet:15,      // صنف القطعة منه بتكسب أقل من كده بعد كل حاجة
    refuse:[0.10, 0.20]
  };
  /* تقييم الأداء: كل مؤشر ليه ٣ حدود — ممتاز / كويس / محتاج شغل، واللي بعدهم ضعيف.
     hi = كل ما يزيد أحسن. الدرجة: ممتاز ١٠ · كويس ٧٫٥ · محتاج شغل ٥ · ضعيف ٢٫٥ — والتقييم العام متوسطهم */
  var CFO_G = {
    margin: { hi:true,  c:[0.55, 0.45, 0.35] },   // هامش البضاعة
    cu:     { hi:true,  c:[0.20, 0.12, 0.05] },   // ربح الأوردر ÷ اللي العميل بيدفعه
    ads:    { hi:false, c:[0.30, 0.40, 0.55] },   // الإعلان ÷ ربح الأوردر قبل الإعلان
    ship:   { hi:false, c:[0, 0.03, 0.08] },      // الشحن من جيبك ÷ متوسط الأوردر
    disc:   { hi:false, c:[0.02, 0.03, 0.06] },   // الخصم ÷ المبيعات
    pace:   { hi:true,  c:[5, 3, 1] },            // أوردر في اليوم
    pcs:    { hi:true,  c:[1.8, 1.4, 1.1] },      // قطع في الأوردر
    refuse: { hi:false, c:[0.08, 0.15, 0.25] },   // الرفض والإلغاء
    cash:   { hi:true,  c:[2, 1, 0.5] },          // الكاش ÷ مصروف شهر (مشتريات وإعلانات)
    stock:  { hi:false, c:[45, 75, 120] },        // المخزون يكفي كام يوم
    fixed:  { hi:true,  c:[3, 1.5, 1] }           // ربح الأوردرات ÷ المصاريف الثابتة المتكررة
  };
  var CFO_GL = [["ممتاز", "go", 10], ["كويس", "go", 7.5], ["محتاج شغل", "pair", 5], ["ضعيف", "bad", 2.5]];
  function cfoGrade(k, x){
    var g = CFO_G[k], i = 0;
    while(i < 3 && (g.hi ? x < g.c[i] - 1e-9 : x > g.c[i] + 1e-9)) i++;
    return i;
  }
  // زيادة السعر لصنف هامشه بسعره الكامل أقل من ٤٠٪: لحد ٤٠٪ مقرّبة لفوق لأقرب ٥، بس ما تعدّيش ١٠٪ (مقرّبة لتحت)
  function cfoRaise(p, c){
    if(!(p > 0) || (p - c) / p >= CFO_T.itemMin) return 0;
    var r = Math.min(Math.ceil((c / (1 - CFO_T.itemMin) - p) / 5 - 1e-9) * 5, Math.floor(p * CFO_T.raiseCap / 5) * 5);
    return r >= 5 ? r : 0;
  }
  function cfoData(r){
    var P = projStats(r), v = P.exp, n = v.n, R = itemProfit(P, false), M = R.M;
    var up5 = function(x){ return Math.ceil(x / 5 - 1e-9) * 5; };
    var o = { P:P, v:v, n:n, M:M, acts:[], pcs:0 };
    if(!n) return o;
    Object.keys(M).forEach(function(id){ o.pcs += M[id].q; });
    var pre = (v.gross + v.ship - (v.varExp - v.ads)) / n;            // ربح الأوردر قبل الإعلان
    o.u = { aov:v.goods / n, gross:v.gross / n, ship:v.ship / n, ads:v.ads / n, oth:(v.varExp - v.ads) / n, pre:pre, cu:v.contrib / n,
            margin:v.goods > 0.009 ? v.gross / v.goods : 0 };
    // ١) أصناف هامشها ضعيف حتى بسعرها الكامل: نرفع السعر لحد ٤٠٪ هامش، بحد أقصى ١٠٪.
    //    بنقيس على سعر الصنف مش السعر اللي اتباع بيه — البيع تحت السعر بيتحسب في الخصم (٤) بس، فمفيش حاجة بتتعد مرتين
    var weak = [], a1 = 0, price = {};
    live("items").forEach(function(it){ price[it.id] = Number(it.price)||0; });
    Object.keys(M).forEach(function(id){
      var m = M[id]; if(!id || m.q < 1 || m.g < 0.009) return;
      var p = price[id] || m.g / m.q, c = m.c / m.q, mg = (p - c) / p, raise = cfoRaise(p, c);
      if(!raise) return;
      weak.push({ id:id, q:m.q, p:p, avg:m.g / m.q, mg:mg, raise:raise }); a1 += raise * m.q;
    });
    weak.sort(function(a, b){ return b.raise * b.q - a.raise * a.q; });
    o.acts.push({ k:"price", imp:a1, w:weak,
      t:"زوّد سعر الأصناف اللي هامشها ضعيف",
      d:(weak.length ? weak.map(function(x){ return esc(itemName(x.id)) + " +" + x.raise + " على سعره " + Math.round(x.p) + " (هامشه بالسعر الكامل " + Math.round(x.mg * 100) + "% · " + qty(x.q) + " قطعة · بيتباع بمتوسط " + Math.round(x.avg) + ")"; }).join(" · ")
        : "كل الأصناف اللي اتباعت هامشها بسعرها الكامل " + Math.round(CFO_T.itemMin * 100) + "% أو أكتر") });
    // ٢) الشحن من جيبنا: يدخل في سعر القطعة والشحن قدام العميل زي ما هو
    var sub = Math.max(0, -v.ship), per = o.pcs > 0 ? up5(sub / o.pcs) : 0;
    o.acts.push({ k:"ship", imp:sub,
      t:"دخّل فرق الشحن في سعر القطعة",
      d:sub > 0.009 ? "الشحن طالع من جيبك " + money(sub) + " (" + Math.round(sub / n) + " على الأوردر). زوّد كل قطعة " + per + " والشحن قدام العميل يفضل زي ما هو."
        : "العميل بيغطّي الشحن كله" });
    // ٣) الإعلان على الأوردر
    var adT = Math.max(0, Math.floor(pre * CFO_T.adShare / 5) * 5), a3 = o.u.ads > adT ? (o.u.ads - adT) * n : 0;
    var best = Object.keys(M).filter(function(id){ return id && M[id].q >= 2; })
      .sort(function(a, b){ return M[b].net / M[b].q - M[a].net / M[a].q; }).slice(0, 3);
    o.adT = adT;
    o.acts.push({ k:"ads", imp:a3,
      t:"نزّل الإعلان على الأوردر لـ" + adT + " أو أقل",
      d:"دلوقتي " + Math.round(o.u.ads) + " على الأوردر — بياكل " + Math.round(o.u.ads / Math.max(1, pre) * 100) + "% من ربح الأوردر قبل الإعلان (" + Math.round(pre) + ")." +
        (best.length ? " ركّز الإعلان على: " + best.map(function(id){ return esc(itemName(id)) + " (" + Math.round(M[id].net / M[id].q) + " في القطعة)"; }).join(" · ") : "") });
    // ٤) الخصومات: الفرق بين سعر الصنف والسعر اللي اتباع بيه
    // الخصم = سعر الصنف الحالي − السعر اللي اتباع بيه، على القطع اللي اتباعت فعلاً (من غير المرتجع)
    var disc = 0;
    P.c.list.forEach(function(sl){ if(isCancelled(sl)) return;
      var del = isDelivered(sl);
      SL(sl).forEach(function(l){ var lp = price[l.itemId] || 0, q = del ? lineSold(l, sl) : Number(l.qty)||0;
        if(lp > 0 && q > 0) disc += Math.max(0, lp - (Number(l.price)||0)) * q; }); });
    var a4 = Math.max(0, disc - v.goods * CFO_T.discMax);
    o.disc = disc;
    o.acts.push({ k:"disc", imp:a4,
      t:"الخصم بسبب بس — حد أقصى " + Math.round(CFO_T.discMax * 100) + "% من المبيعات",
      d:"اتخصم " + money(disc) + " = " + (v.goods > 0.009 ? (disc / v.goods * 100).toFixed(1) : "0") + "% من المبيعات (بالمقارنة بسعر الصنف الحالي)." });
    // ٥) أصناف القطعة منها بتكسب قليل جداً بعد كل حاجة (للعلم — مش داخلة في الإجمالي عشان ما تتحسبش مرتين)
    o.thin = Object.keys(M).filter(function(id){ var m = M[id]; return id && m.q >= 3 && m.net / m.q < CFO_T.weakNet; })
      .map(function(id){ return { id:id, q:M[id].q, per:M[id].net / M[id].q }; });
    o.gain = o.acts.reduce(function(a, x){ return a + x.imp; }, 0);
    /* أسعار البيع الجديدة: سعر الصنف + زيادة الهامش الضعيف (قرار ٣) + فرق الشحن على القطعة (قرار ٢)، مقرّب لفوق لأقرب ٥.
       «بيفضل لك من القطعة» بعد السعر الجديد = السعر − التكلفة − نصيبها من الإعلان (على الحد المقترح) − نصيبها من الشحن والتغليف.
       صنف ما اتباعش في الفترة: تكلفته من المخزون، ونصيبه من الإعلان والشحن = متوسط القطعة. */
    o.shipPer = per; o.op = opPlan(r, false, P, M);
    var raiseOf = {}; weak.forEach(function(x){ raiseOf[x.id] = x.raise; });
    var adK = o.u.ads > adT && o.u.ads > 0.009 ? adT / o.u.ads : 1;
    var avgAd = o.pcs ? v.ads / o.pcs : 0, avgSh = o.pcs ? v.ship / o.pcs : 0, avgOv = o.pcs ? (v.varExp - v.ads) / o.pcs : 0;
    o.prices = []; o.unsoldRaise = 0;
    live("items").forEach(function(it){
      var m = M[it.id], sold = m && m.q > 0, c, ad, sh, ov, now = null, dsc = 0;
      var lp = Number(it.price)||0 || (sold ? m.g / m.q : 0);                // من غير سعر أساسي: متوسط اللي اتباع بيه (زي قرار ٣)
      if(sold){ c = m.c / m.q; ad = m.ads / m.q; sh = m.sh / m.q; ov = m.ov / m.q; now = m.net / m.q - o.op.perFix; dsc = Math.max(0, lp - m.g / m.q); }
      else {
        // ما اتباعش في الفترة: تكلفته من المخزون (شاملة نقل المشتريات زي stockAtAvg) — القطع الموجبة بس
        var sq = 0, sv = 0;
        variantsOf(it.id).forEach(function(x){ var k = stockOfVi(it.id, x.color, x.size); if(k > 0){ sq += k; sv += k * avgCostV(it.id, x.color, x.size); } });
        if(sq <= 0) return;                                                  // مش في المخزون ومش متباع: مالوش لازمة هنا
        c = sv / sq; ad = avgAd; sh = avgSh; ov = avgOv;
        if(!raiseOf[it.id]){ raiseOf[it.id] = cfoRaise(lp, c); if(raiseOf[it.id]) o.unsoldRaise++; }
      }
      if(!(lp > 0) || !(c > 0)) return;
      var add = (raiseOf[it.id] || 0) + per, np = lp + add;                  // الزيادات مضاعفات ٥ — السعر نفسه ما بيتقرّبش
      // بعد السعر الجديد بنفس الخصم اللي بتعمله دلوقتي على الصنف، والإعلان على الحد المقترح
      var after = np - dsc - c + sh - ad * adK - ov - o.op.perFix;       // وبعد نصيبها من الثابت (اشتراكات وتأسيس)
      o.prices.push({ id:it.id, n:it.name || "", lp:lp, np:np, add:add, c:c, now:now, after:after, q:sold ? m.q : 0, dsc:dsc,
        why:[raiseOf[it.id] ? "+" + raiseOf[it.id] + " هامش" : "", per ? "+" + per + " شحن" : ""].filter(Boolean).join(" · ") });
    });
    o.prices.sort(function(a, b){ return b.q - a.q || a.n.localeCompare(b.n, "ar"); });
    // بعد الخطة
    o.after = { gross:o.u.gross + (a1 + a4) / n, ship:o.u.ship + sub / n, ads:o.u.ads - a3 / n, oth:o.u.oth };
    o.after.cu = o.after.gross + o.after.ship - o.after.ads - o.after.oth;
    o.after.aov = o.u.aov + (a1 + a4 + sub) / n;
    // الوتيرة
    var ds = P.c.list.map(function(x){ return x.date; }).filter(Boolean).sort();
    o.first = ds[0]; o.last = ds[ds.length - 1];
    var end = r && r.to && r.to < today() ? r.to : today();               // فترة فاتت: لآخرها مش للنهارده
    o.days = o.first ? Math.max(1, daysBetween(o.first, end) + 1) : 1;
    // تقييم الأداء
    var B = finBS(), X = expByCat(r), fin = 0, cx = 0;
    P.c.list.forEach(function(sl){ if(isDelivered(sl)) fin++; else if(isCancelled(sl)){ fin++; cx++; } });
    var rr = fin >= 5 ? { p:cx / fin, n:fin, x:cx } : null;                 // نفس refusalRate بس على الفترة
    o.rr = rr;
    var day = (v.cost + v.ads) / o.days;
    o.B = B; o.need = day * 60; o.free = Math.max(0, B.stock - B.inOrders);   // المخزون من غير اللي في أوردرات ماشية
    var pc = function(x){ return (x * 100).toFixed(1) + "%"; }, nn0 = function(x){ return (Math.round(x)||0).toLocaleString("en-US"); };
    var sc = [];
    var add = function(grp, k, lbl, x, val, bm, cm){ sc.push({ grp:grp, k:k, l:lbl, x:x, val:val, bm:bm, cm:cm, g:x === null ? null : cfoGrade(k, x) }); };
    var u = o.u;
    add("الربحية", "margin", "هامش البضاعة", u.margin, pc(u.margin), "55%+",
      u.margin >= CFO_T.margin ? "تسعير البضاعة سليم." : "البضاعة متسعّرة أقل من اللازم — أول حاجة بتاكل الربح.");
    add("الربحية", "cu", "الأوردر بيكسب من كل جنيه", u.cu / Math.max(1, u.aov), pc(u.cu / Math.max(1, u.aov)), "20%+",
      "من كل 100 جنيه العميل بيدفعها بيفضل " + Math.round(u.cu / Math.max(1, u.aov) * 100) + " بعد البضاعة والشحن والإعلان.");
    add("الربحية", "ads", "الإعلان من ربح الأوردر", u.ads / Math.max(1, u.pre), pc(u.ads / Math.max(1, u.pre)), "40% أو أقل",
      "الإعلان " + nn0(u.ads) + " على الأوردر من " + nn0(u.pre) + " ربح قبل الإعلان" + (u.ads > o.adT + 0.5 ? " — أكبر بند محتاج يتظبط." : "."));
    add("الربحية", "ship", "الشحن من جيبك", Math.max(0, -u.ship) / Math.max(1, u.aov), u.ship < -0.5 ? nn0(-u.ship) + " على الأوردر" : "0", "0",
      u.ship < -0.5 ? "العميل بيدفع أقل من تكلفة الشركة — الفرق يدخل في سعر القطعة." : "العميل بيغطّي الشحن.");
    add("الربحية", "disc", "الخصومات", v.goods > 0.009 ? o.disc / v.goods : 0, v.goods > 0.009 ? pc(o.disc / v.goods) : "0%", "3% أو أقل",
      "اتخصم " + nn0(o.disc) + (o.disc / Math.max(1, v.goods) > CFO_T.discMax ? " — خصم من غير سبب بيروح من الصافي على طول." : "."));
    add("البيع والعملاء", "pace", "الطلب", n / o.days, (n / o.days).toFixed(1) + " أوردر/يوم", "3+",
      qty(n) + " أوردر في " + qty(o.days) + " يوم" + (o.days < 30 ? " — لسه بدري نحكم على الاستمرار." : "."));
    add("البيع والعملاء", "pcs", "القطع في الأوردر", o.pcs / n, (o.pcs / n).toFixed(1) + " قطعة", "1.4+",
      o.pcs / n >= 1.8 ? "العميل بياخد أكتر من قطعة — نقطة قوة." : "اعرض قطعة تانية مع كل أوردر.");
    add("البيع والعملاء", "refuse", "الرفض والإلغاء", rr ? rr.p : null, rr ? pc(rr.p) : "لسه بدري", "8% أو أقل",
      rr ? rr.x + " من " + rr.n + " أوردر خلصوا — " + qty(P.nOpen) + " لسه ماشيين، ودول اللي هيحددوا الرقم الحقيقي." : "محتاج ٥ أوردرات خلصوا على الأقل.");
    add("الفلوس والمخزون", "cash", "السيولة", day > 0.009 ? B.cash / (day * 30) : null, day > 0.009 ? (B.cash / (day * 30)).toFixed(1) + " شهر" : "—", "شهرين+",
      "الخزنة " + nn0(B.cash) + " تكفي " + (day > 0.009 ? (B.cash / (day * 30)).toFixed(1) : "—") + " شهر مشتريات وإعلانات على الوتيرة الحالية.");
    var cogsDay = v.cost / o.days;
    add("الفلوس والمخزون", "stock", "المخزون يكفي", cogsDay > 0.009 ? o.free / cogsDay : null, cogsDay > 0.009 ? qty(Math.round(o.free / cogsDay)) + " يوم" : "—", "45 يوم أو أقل",
      "بضاعة بـ" + nn0(o.free) + " بالتكلفة من غير اللي في أوردرات ماشية" + (cogsDay > 0.009 && o.free / cogsDay > 75 ? " — فلوس واقفة على الرف." : " — على قد البيع."));
    /* التعادل: كام قطعة في الشهر بتغطي الثابت الشهري — ربح القطعة من الفترة اللي فوق، والثابت والوتيرة بتوع دلوقتي
       (زي «نصيب القطعة» في الإعدادات). من غير بيع في آخر ١٤ يوم مفيش وتيرة نقارن بيها — مش «ضعيف». */
    // v143: التعادل في نفس الفترة — الثابت (اشتراكات ومرتبات وتأسيس على ٣ شهور) ÷ اللي القطعة بتكسبه بعد الإعلان والتغليف
    var OPs = o.op, cpp = o.pcs ? v.contrib / o.pcs : 0, be = cpp > 0.009 ? OPs.fixed / cpp : null;
    var cov = !(OPs.fixed > 0.009) ? [null, "مفيش ثابت", "مفيش مصاريف ثابتة في الفترة."]
      : be === null ? [0, "مش متغطّي", "القطعة مش بتكسب بعد الإعلان والتغليف — مفيش عدد يغطي الثابت."]
      : [o.pcs / be, (o.pcs / be).toFixed(1) + " مرة", "محتاج " + nn0(Math.ceil(be)) + " قطعة تغطي الثابت (" + nn0(OPs.fixed) + ") — بعت " + nn0(o.pcs) + " في الفترة."];
    add("الفلوس والمخزون", "fixed", "تغطية المصاريف الثابتة", cov[0], cov[1], "1.5+ مرة", cov[2]);
    o.sc = sc;
    var gs = sc.filter(function(x){ return x.g !== null; });
    o.score = gs.length ? gs.reduce(function(a, x){ return a + CFO_GL[x.g][2]; }, 0) / gs.length : null;
    return o;
  }
  /* v139: الإعلان حسب المصدر — كل مصدر جاب كام أوردر، اتلغى منهم كام، وصرفنا عليه كام إعلان.
     ربح الأوردر قبل الإعلان: المسلّم فعلاً، والماشي «لو اتسلّم»، والملغي خسارة الشحن بس — وبعدين
     التغليف والمتغيّر التاني بيتوزّعوا على المصادر بنسبة مبيعاتها (زي «المدير المالي» فوق بالظبط).
     مصروف إعلان من غير مصدر بيتعرض في سطر لوحده، والإجمالي تحت بيقفل على إجمالي الإعلانات. */
  function cfoSrcData(r, P, v){
    var by = {}, row = function(k){ return by[k] = by[k] || { k:k, n:0, x:0, d:0, goods:0, pre:0, ads:0 }; };
    P.c.list.forEach(function(s){
      var b = row(s.src || ""), canc = isCancelled(s);
      b.n++; if(canc) b.x++;
      if(isDelivered(s)){ b.d++; b.goods += saleTotal(s); b.pre += saleProfit(s); }
      else if(canc) b.pre += saleProfit(s);
      else { var e = expProfit(s); b.goods += e.goods; b.pre += e.net; }
    });
    // v142: الإعلان من نفس قايمة الدخل — المتعلّم بمصدر لمصدره، والباقي (رصيد فيسبوك ورسومه) «مش متحدد»
    var adsAll = expByCat(r).ads, tagd = 0;
    live("cash").forEach(function(c){
      if(c.type !== "expense" || trLinked(c) || expCat(c) !== "ads" || !SRC_AD[c.src]) return;
      var a = expAmtIn(c, r); tagd += a; row(c.src).ads += a;
    });
    if(adsAll - tagd > 0.004) row("").ads += adsAll - tagd;
    var rows = Object.keys(by).map(function(k){ return by[k]; });
    var G = rows.reduce(function(a, x){ return a + x.goods; }, 0), ov = v.varExp - v.ads;   // تغليف + متغيّر تاني
    rows.forEach(function(x){ x.ov = G > 0.009 ? ov * x.goods / G : 0; x.net = x.pre - x.ov - x.ads; });
    rows.sort(function(a, b){ return (a.k === "") - (b.k === "") || b.n - a.n; });
    var tagged = rows.filter(function(x){ return x.k; }).reduce(function(a, x){ return a + x.n; }, 0);
    var adsNa = by[""] ? by[""].ads : 0;
    var tot = rows.reduce(function(a, x){ a.n += x.n; a.x += x.x; a.d += x.d; a.ads += x.ads; a.net += x.net; return a; }, { n:0, x:0, d:0, ads:0, net:0 });
    return { rows:rows, adsAll:adsAll, adsNa:adsNa, tot:tot, tagged:tagged, n:P.c.list.length };
  }
  function renderCfoSrc(o){
    var t = document.getElementById("t-cfo-src"); if(!t) return;
    var nn = function(x){ return (Math.round(x)||0).toLocaleString("en-US"); };
    var sg = function(x){ return x < -0.5 ? "(" + nn(-x) + ")" : nn(x); };
    if(!o.n){ t.innerHTML = ""; document.getElementById("cfo-src-h").textContent = ""; document.getElementById("cfo-src-s").textContent = ""; return; }
    var D = cfoSrcData(periodRange(), o.P, o.v);
    document.getElementById("cfo-src-s").textContent = "— " + qty(D.tagged) + " من " + qty(D.n) + " أوردر متحدد مصدره";
    var hint = [];
    if(D.tagged < D.n) hint.push("اختار «جه منين؟» في كل أوردر جديد — والجدول ده هيقولك أنهي إعلان بيكسب وأنهي بيخسر.");
    if(D.adsNa > 0.5) hint.push(nn(D.adsNa) + " من الإعلانات (" + Math.round(D.adsNa / Math.max(1, D.adsAll) * 100) + "%) من غير مصدر — اختار «الإعلان على» في مصروف الإعلانات.");
    document.getElementById("cfo-src-h").textContent = hint.join(" ") || "كل الأوردرات والإعلانات متحدد مصدرها.";
    var cl = function(v){ return v < -0.5 ? "v-due" : v > 0.5 ? "v-gain" : ""; };
    t.innerHTML = "<thead><tr><th>المصدر</th><th class='num'>أوردرات</th><th class='num'>اتلغى</th><th class='num'>الإعلان</th>" +
      "<th class='num'>إعلان على الأوردر</th><th class='num'>ربح الأوردر بعد الإعلان</th></tr></thead><tbody>" +
      // اتلغى: النسبة من اللي خلصوا (اتسلّم أو اتلغى) زي «الرفض والإلغاء» فوق — مش من الماشيين لسه
      D.rows.concat([Object.assign({ k:"_tot" }, D.tot)]).map(function(x){
        var tot = x.k === "_tot", fin = x.d + x.x, isAd = SRC_AD[x.k];
        var per = x.n ? "<b class='" + cl(x.net / x.n) + "'>" + sg(x.net / x.n) + "</b>"
          : (x.ads ? "<b class='v-due' title='صرف إعلان من غير ولا أوردر'>(" + nn(x.ads) + ") إجمالي</b>" : "—");
        return "<tr class='" + (tot ? "fs-tot" : x.k ? "" : "cfo-src-na") + "'><td class='wide'><b>" + (tot ? "الإجمالي" : esc(srcName(x.k))) + "</b></td>" +
          "<td class='num' data-l='أوردرات'>" + qty(x.n) + "</td>" +
          "<td class='num' data-l='اتلغى'>" + (x.x ? qty(x.x) + " <small>(" + Math.round(x.x / Math.max(1, fin) * 100) + "% من " + qty(fin) + " خلصوا)</small>" : "—") + "</td>" +
          "<td class='num' data-l='الإعلان'>" + (x.ads ? nn(x.ads) : (isAd ? "0" : "—")) + "</td>" +
          "<td class='num' data-l='إعلان على الأوردر'>" + (x.ads && x.n ? nn(x.ads / x.n) : "—") + "</td>" +
          "<td class='num' data-l='ربح الأوردر بعد الإعلان'>" + per + "</td></tr>";
      }).join("") + "</tbody>";
  }
  function renderCfo(){
    var vd = document.getElementById("cfo-verdict"); if(!vd) return;
    var o = cfoData(periodRange()), v = o.v, n = o.n;
    var nn = function(x){ return (Math.round(x)||0).toLocaleString("en-US"); };
    var sg = function(x){ return x < -0.5 ? "(" + nn(-x) + ")" : nn(x); };
    var ids = ["t-cfo-score", "t-cfo-unit", "cfo-acts", "t-cfo-prices", "cfo-prices-h", "cfo-risk", "cfo-stock", "cfo-notes"];
    if(!n){
      vd.innerHTML = "<div class='cfo-vd'><div><h3>لسه مفيش أوردرات في الفترة دي</h3><p>اختار فترة فيها بيع، أو «كل الفترات».</p></div></div>";
      ids.forEach(function(id){ var e = document.getElementById(id); if(e) e.innerHTML = ""; });
      document.getElementById("cfo-basis").textContent = ""; document.getElementById("cfo-acts-sum").textContent = ""; document.getElementById("cfo-score-s").textContent = ""; document.getElementById("cfo-prices-s").textContent = ""; renderCfoSrc(o);
      return;
    }
    var u = o.u, A = o.after;
    // الحكم
    var weakU = u.margin < CFO_T.margin || u.ads > o.adT + 0.5;
    var cls = u.cu <= 0 ? "bad" : weakU ? "" : "good";
    var head = u.cu <= 0 ? "الأوردر بيخسر — لازم السعر أو الإعلان يتظبط"
      : weakU ? "البيع ماشي — بس ربح الأوردر ضعيف" : "ماشي صح — الأوردر بيكسب كويس";
    var why = [];
    if(u.margin < CFO_T.margin) why.push("هامش البضاعة " + (u.margin * 100).toFixed(1) + "% والكويس " + Math.round(CFO_T.margin * 100) + "% أو أكتر");
    if(u.ads > o.adT + 0.5) why.push("الإعلان " + nn(u.ads) + " على الأوردر والحد " + o.adT);
    if(u.ship < -0.5) why.push("الشحن من جيبك " + nn(-u.ship) + " على الأوردر");
    vd.innerHTML = "<div class='cfo-vd " + cls + "'><div>" +
      (o.score !== null ? "<span class='cfo-sc'><span>تقييم المدير المالي</span><b class='num'>" + o.score.toFixed(1) + "</b><span>من 10</span></span>" : "") +
      "<h3 style='margin-top:var(--sp-2)'>" + head + "</h3><p>" + (why.join(" · ") || "كل المؤشرات في الحدود") + "</p></div>" +
      "<div class='cfo-hero'><b class='num " + (u.cu < 0 ? "v-due" : "") + "'>" + sg(u.cu) + "</b><span class='ar'>←</span><b class='num " + (A.cu < -0.5 ? "v-due" : A.cu > 0.5 ? "v-gain" : "") + "'>" + sg(A.cu) + "</b>" +
      "<small>الأوردر بيكسب دلوقتي ← بعد الخطة</small></div></div>";
    // تقييم الأداء
    var sh = "<thead><tr><th>المؤشر</th><th class='num'>القيمة</th><th class='bm'>المعيار</th><th>التقييم</th><th>رأي المدير المالي</th></tr></thead><tbody>", lg = "";
    o.sc.forEach(function(x){
      if(x.grp !== lg){ sh += "<tr class='grp'><td colspan='5'>" + x.grp + "</td></tr>"; lg = x.grp; }
      var G = x.g === null ? null : CFO_GL[x.g];
      sh += "<tr><td class='wide'>" + x.l + "</td><td class='num'>" + x.val + "</td><td class='bm'>" + x.bm + "</td>" +
        "<td>" + (G ? "<span class='itp-st " + G[1] + "'>" + G[0] + "</span>" : "<span class='itp-st idle'>لسه بدري</span>") + "</td>" +
        "<td class='cm'>" + x.cm + "</td></tr>";
    });
    document.getElementById("t-cfo-score").innerHTML = sh + "</tbody>";
    var cnt = [0, 0, 0, 0]; o.sc.forEach(function(x){ if(x.g !== null) cnt[x.g]++; });
    document.getElementById("cfo-score-s").textContent = "— " + [cnt[0] + cnt[1] ? (cnt[0] + cnt[1]) + " كويس" : "", cnt[2] ? cnt[2] + " محتاج شغل" : "", cnt[3] ? cnt[3] + " ضعيف" : ""].filter(Boolean).join(" · ");
    // جدول الأوردر الواحد
    var row = function(lbl, a, b, tg, kind){
      return "<tr" + (kind ? " class='" + kind + "'" : "") + "><td class='wide'>" + lbl + "</td><td class='num" + (a < -0.5 ? " v-due" : "") + "'>" + sg(a) + "</td>" +
        "<td class='num" + (b < -0.5 ? " v-due" : "") + "'>" + sg(b) + "</td><td class='tg'>" + (tg || "") + "</td></tr>";
    };
    document.getElementById("t-cfo-unit").innerHTML =
      "<thead><tr><th>البند</th><th class='num'>دلوقتي</th><th class='num'>بعد الخطة</th><th>المعيار</th></tr></thead><tbody>" +
      row("العميل بيدفع (متوسط الأوردر)", u.aov, A.aov, (o.pcs / n).toFixed(1) + " قطعة في الأوردر") +
      row("ربح البضاعة", u.gross, A.gross, "الهامش " + (u.margin * 100).toFixed(1) + "% · الكويس " + Math.round(CFO_T.margin * 100) + "%+") +
      row("الشحن", u.ship, A.ship, u.ship < -0.5 ? "طالع من جيبك" : "العميل بيغطيه") +
      row("الإعلان", -u.ads, -A.ads, "الحد " + o.adT + " (" + Math.round(CFO_T.adShare * 100) + "% من ربح الأوردر قبل الإعلان)") +
      row("تغليف ومتغيّر تاني", -u.oth, -A.oth, "") +
      row("الأوردر بيكسب", u.cu, A.cu, "قبل المصاريف الثابتة", "fs-tot") +
      (o.op.perFix > 0.009 ? row(opFixLabel(o.op), -o.op.fixed / n, -o.op.fixed / n, o.op.perFix.toFixed(2) + " للقطعة" + (o.op.setup > 0.004 ? " · التأسيس على ٣ شهور" : "")) +
        row("صافي الأوردر بعد تكلفة التشغيل", u.cu - o.op.fixed / n, A.cu - o.op.fixed / n, "تكلفة التشغيل " + o.op.per.toFixed(2) + " للقطعة", "fs-tot") : "") + "</tbody>";
    document.getElementById("cfo-basis").textContent = "محسوب على «لو كله اتسلّم» — " + qty(n) + " أوردر" +
      (o.first ? " من " + o.first + " لـ " + o.last : "") + ". «بعد الخطة» على نفس عدد الأوردرات، من غير ما نفترض زيادة في البيع. بيتحدّث لوحده بعد كل حركة.";
    // القرارات
    var acts = o.acts.slice().sort(function(a, b){ return b.imp - a.imp; });
    document.getElementById("cfo-acts-sum").textContent = o.gain > 0.5 ? "— الإجمالي +" + nn(o.gain) + " على نفس الأوردرات" : "";
    var h = acts.map(function(x, i){
      var done = x.imp < 0.5;
      return "<div class='cfo-act" + (done ? " done" : "") + "' style='--k:" + Math.min(i, 6) + "'><span class='no'>" + (done ? "✓" : i + 1) + "</span>" +
        "<div><h4>" + esc(x.t) + "</h4><p>" + x.d + "</p></div>" +
        "<div class='imp'>" + (done ? "<small>تمام</small>" : "<b class='num'>+" + nn(x.imp) + "</b><small>+" + nn(x.imp / n) + " على الأوردر</small>") + "</div></div>";
    }).join("");
    if(o.thin.length) h += "<div class='cfo-act' style='--k:" + Math.min(acts.length, 6) + "'><span class='no'>!</span><div><h4>أصناف بتتباع بس مش بتكسب</h4><p>" +
      o.thin.map(function(x){ return esc(itemName(x.id)) + (x.per < -0.5 ? ": بيخسّرك " + nn(-x.per) + " جنيه في القطعة" : ": بيفضل لك " + nn(x.per) + " جنيه من القطعة") + " بعد البضاعة والإعلان والتغليف والشحن (" + nPcs(x.q) + ")"; }).join("<br>") +
      "<br>← ارفع سعرها، أو بيع اللي عندك منها وما تشتريش تاني.</p></div><div class='imp'><small>تنبيه بس — مش داخل في الإجمالي<br>عشان ما يتحسبش مرتين</small></div></div>";
    document.getElementById("cfo-acts").innerHTML = h;
    // أسعار البيع الجديدة
    var pr = o.prices, pt = document.getElementById("t-cfo-prices");
    document.getElementById("cfo-prices-s").textContent = pr.length ? qty(pr.length) + " صنف" : "";
    document.getElementById("cfo-prices-h").innerHTML = pr.length ?
      "حط السعر الجديد على كل صنف عشان قرارات الهامش والشحن تتنفذ. الزيادة = " +
      (o.shipPer ? o.shipPer + " فرق شحن على كل قطعة" : "مفيش فرق شحن") + " + زيادة الهامش للأصناف الضعيفة. " +
      "«بيفضل لك» بعد السعر الجديد محسوب بنفس الخصم اللي بتعمله دلوقتي على كل صنف، والإعلان على الحد المقترح (" + o.adT + " على الأوردر)" +
      (o.op.perFix > 0.009 ? "، وبعد نصيب القطعة من الثابت — " + opFixLabel(o.op) + " (" + o.op.perFix.toFixed(2) + ")" : "") + "." +
      (o.unsoldRaise ? " وفيه " + qty(o.unsoldRaise) + " صنف ما اتباعش في الفترة هامشه ضعيف — زيادته هنا بس، مش في إجمالي القرارات لأنه مالوش بيع يتحسب عليه." : "") : "";
    pt.innerHTML = pr.length ? "<thead><tr><th>الصنف</th><th class='num'>سعره دلوقتي</th><th class='num'>السعر الجديد</th><th class='cst num'>التكلفة</th>" +
      "<th class='num'>بيفضل لك من القطعة</th><th class='why'>الزيادة</th></tr></thead><tbody>" +
      pr.map(function(x){
        var cl = function(v){ return v < -0.5 ? " v-due" : v > 0.5 ? " v-gain" : ""; };
        // data-l = اسم الخانة في كروت الموبايل
        return "<tr><td class='wide'><b>" + esc(x.n) + "</b>" + (x.q ? "" : " <span class='itp-st idle'>ما اتباعش في الفترة</span>") + "</td>" +
          "<td class='num' data-l='سعره دلوقتي'>" + nn(x.lp) + "</td><td class='num np' data-l='السعر الجديد'>" + nn(x.np) + "</td><td class='cst num' data-l='التكلفة'>" + nn(x.c) + "</td>" +
          "<td class='num' data-l='بيفضل لك من القطعة'><span>" + (x.now === null ? "—" : "<span class='" + cl(x.now).trim() + "'>" + sg(x.now) + "</span>") +
          "<span class='arr'>←</span><b class='" + cl(x.after).trim() + "'>" + sg(x.after) + "</b></span></td>" +
          "<td class='why' data-l='الزيادة'>+" + nn(x.add) + (x.why ? " (" + x.why + ")" : "") + "</td></tr>";
      }).join("") + "</tbody>" : "";
    // المخاطر
    var P = o.P, rr = o.rr, lossOpen = 0, rk = [];
    P.open.forEach(function(sl){ var e = expProfit(sl); lossOpen += e.goods - e.cost + e.sin; });
    var lossPer = P.nOpen ? lossOpen / P.nOpen : 0;
    rk.push("<div class='cfo-ln'><b>" + qty(P.nOpen) + " أوردر لسه ما اتسلّمش</b> — الحسبة فوق مفترضة إنهم كلهم هيتسلّموا." +
      "<small>كل أوردر بيرجع بيضيّع حوالي " + nn(lossPer) + " (ربح البضاعة + الشحن اللي العميل كان هيدفعه)، والإعلان والشحن بيكونوا اتصرفوا.</small></div>");
    if(P.nOpen) CFO_T.refuse.forEach(function(p){
      var k = P.nOpen * p;
      rk.push("<div class='cfo-ln'>لو رجع " + Math.round(p * 100) + "% منهم" + (k >= 1 ? " (حوالي " + qty(Math.round(k)) + " أوردر)" : "") +
        ": الربح ينزل حوالي <b class='v-due num'>" + nn(k * lossPer) + "</b></div>");
    });
    rk.push("<div class='cfo-ln'>الرفض والإلغاء في الفترة: <b>" + (rr ? Math.round(rr.p * 100) + "%" : "لسه بدري") + "</b>" +
      "<small>" + (rr ? rr.x + " من " + rr.n + " أوردر خلصوا" : "محتاج ٥ أوردرات خلصوا على الأقل") + " · أكّد كل أوردر بمكالمة أو واتساب قبل الشحن</small></div>");
    // v139: التأكيد قبل الشحن وأسباب الإلغاء في الفترة
    var pend = P.c.list.filter(cfPending), rs = {}, rsN = 0, cx2 = 0;
    P.c.list.forEach(function(sl){ if(!isCancelled(sl)) return; cx2++; if(sl.rsn){ rs[sl.rsn] = (rs[sl.rsn] || 0) + 1; rsN++; } });
    if(pend.length) rk.push("<div class='cfo-ln'><b>" + qty(pend.length) + " أوردر لسه ما اتأكدش قبل الشحن</b>" +
      "<small>كلّم العميل أو ابعتله واتساب من «ناقصه شحن» — الأوردر اللي اتأكد بيرجع أقل</small></div>");
    if(cx2) rk.push("<div class='cfo-ln'><b>أسباب الإلغاء</b> " + (rsN ? Object.keys(rs).sort(function(a, b){ return rs[b] - rs[a]; })
      .map(function(k){ return esc(RSN_LABEL[k]) + " " + qty(rs[k]); }).join(" · ") : "") +
      (cx2 > rsN ? "<small>" + qty(cx2 - rsN) + " من " + qty(cx2) + " من غير سبب — اختار السبب لما الأوردر يتلغي</small>" : "") + "</div>");
    document.getElementById("cfo-risk").innerHTML = rk.join("");
    // المخزون والكاش
    var st = [], sold = {}, B = o.B;
    live("sales").forEach(function(sl){ if(isCancelled(sl)) return; SL(sl).forEach(function(l){ if(l.itemId) sold[l.itemId] = (sold[l.itemId] || 0) + (Number(l.qty)||0); }); });
    var val = function(id){ var t = 0; variantsOf(id).forEach(function(x){ var k = stockOfV(id, x.color, x.size); if(k > 0) t += k * avgCostVB(id, x.color, x.size); }); return t; };
    var wk = o.acts[0].w || [];
    if(wk.length){
      var wv = wk.reduce(function(a, x){ return a + val(x.id); }, 0);
      st.push("<div class='cfo-ln'><b>ما تعيدش شرا:</b> " + wk.map(function(x){ return esc(itemName(x.id)); }).join(" · ") + " قبل ما سعرهم يتظبط" +
        "<small>عندك منهم بضاعة بـ" + nn(wv) + " بالتكلفة" + (o.free > 0.009 ? " (" + Math.round(Math.min(1, wv / o.free) * 100) + "% من المخزون)" : "") + "</small></div>");
    }
    var idle = live("items").filter(function(it){ return !sold[it.id] && stockOf(it.id) > 0; })
      .map(function(it){ return { n:it.name, q:stockOf(it.id), v:val(it.id) }; }).sort(function(a, b){ return b.v - a.v; });
    if(idle.length){
      var iv = idle.reduce(function(a, x){ return a + x.v; }, 0);
      st.push("<div class='cfo-ln'><b>لسه ما اتباعش منها حاجة:</b> " + idle.slice(0, 5).map(function(x){ return esc(x.n) + " (" + qty(x.q) + ")"; }).join(" · ") +
        (idle.length > 5 ? " و" + qty(idle.length - 5) + " تانيين" : "") +
        "<small>بضاعة بـ" + nn(iv) + " بالتكلفة — اعمل إعلان تجريبي صغير قبل ما تشتري منها تاني</small></div>");
    }
    var need = o.need;
    if(B.cap > 0.009) st.push("<div class='cfo-ln'><b>الكاش في الخزنة " + nn(B.cash) + "</b> = " + Math.round(B.cash / B.cap * 100) + "% من رأس المال" +
      "<small>احتياطي شهرين مشتريات وإعلانات على الوتيرة الحالية ≈ " + nn(need) +
      (B.cash > need * 1.5 ? " — الباقي (" + nn(B.cash - need) + ") ممكن يتصرف على الأصناف اللي هامشها عالي لما تثبت إنها بتتباع" : "") + "</small></div>");
    document.getElementById("cfo-stock").innerHTML = st.join("") || "<p class='hint' style='margin:0'>مفيش ملاحظات على المخزون.</p>";
    // ملاحظات محاسبية
    var X = expByCat(null), nt = [];
    if(P.noCost) nt.push("<b>" + qty(P.noCost) + " أوردر ماشي فيه أصناف لسه ما اتشرتش</b> — تكلفتها مش معروفة فهي بره الحسبة. سجّل فاتورة المشتريات عشان الأرقام تكمل.");
    if(!(X.salary > 0.009)) nt.push("الربح ده <b>قبل أي مرتبات</b> — مفيش مرتبات متسجّلة. لو حد بيشتغل من غير مرتب، الربح الحقيقي أقل لما تحسب تمن شغله.");
    if(X.subs > 0.009){
      var mon = today().slice(0, 7), last = "";
      live("cash").forEach(function(c){ if(c.type === "expense" && !trLinked(c) && expCat(c) === "subs" && c.date > last) last = c.date; });
      if(last && last.slice(0, 7) < mon) nt.push("آخر اشتراكات اتسجّلت " + esc(last) + ". لو شهرية، سجّل الشهر ده عشان قايمة الدخل تبقى مظبوطة.");
    }
    if(P.nOpen) nt.push("«اتسلّم فعلاً» بيبان أقل من «لو كله اتسلّم» لحد ما الأوردرات تتسلّم: الإيراد بيتحسب عند التسليم <small>(IFRS 15.38)</small> والإعلان بيتحسب أول ما يتدفع <small>(IAS 38.69(c))</small>.");
    nt.push("المعايير اللي الشاشة بتقيس عليها: هامش البضاعة " + Math.round(CFO_T.margin * 100) + "% · صنف أقل من " + Math.round(CFO_T.itemMin * 100) + "% سعره يتراجع (بحد أقصى +" + Math.round(CFO_T.raiseCap * 100) + "%) · الإعلان ≤ " + Math.round(CFO_T.adShare * 100) + "% من ربح الأوردر قبل الإعلان · الخصم ≤ " + Math.round(CFO_T.discMax * 100) + "% من المبيعات.");
    document.getElementById("cfo-notes").innerHTML = nt.map(function(x){ return "<li>" + x + "</li>"; }).join("");
    renderCfoSrc(o);
  }
  function renderFin(){
    var tb = document.getElementById("t-fin-bs"); if(!tb) return;
    var B = finBS(), r = periodRange(), A = finIS(null), Pd = r ? finIS(r) : null;
    var m = function(v){ return v < -0.004 ? "(" + money(-v) + ")" : money(v); };
    var cls = function(v){ return v < -0.004 ? " v-due" : ""; };
    var R = function(label, v, kind, sub){
      var c = kind === "sec" ? "fs-sec" : kind === "sub" ? "fs-sub" : kind === "tot" ? "fs-tot" : kind === "grand" ? "fs-grand" : "";
      return "<tr" + (c ? " class='" + c + "'" : "") + "><td class='wide" + (kind === "ind" ? " ind" : "") + "'>" + label +
        (sub ? "<span class='sub'>" + sub + "</span>" : "") + "</td><td class='num" + (v === null ? "" : cls(v)) + "'>" + (v === null ? "" : m(v)) + "</td></tr>";
    };
    var bs = [];
    // كل البنود متداولة (IAS 1.66 و1.69) — مفيش أصول ثابتة متسجّلة
    bs.push(R("الأصول المتداولة", null, "sec"));
    bs.push(R("النقدية في الخزنة", B.cash, "ind"));
    bs.push(R("مستحقات عند شركات الشحن", B.wallets, "ind", "فلوس العملاء اللي المندوب حصّلها ولسه ما وصلتكش"));
    if(B.recv > 0.009) bs.push(R("مديونيات العملاء", B.recv, "ind"));
    if(B.supAdv > 0.009) bs.push(R("دفعات مقدّمة للموردين", B.supAdv, "ind"));
    bs.push(R("المخزون (بالتكلفة)", B.stock, "ind", B.inOrders > 0.009 ? "منه حوالي " + esc(money(B.inOrders)) + " في أوردرات لسه ما اتسلّمتش" : ""));
    if(B.prepaid > 0.009) bs.push(R("مصروفات مدفوعة مقدّماً", B.prepaid, "ind",
      "رصيد فيسبوك " + esc(money(B.prepMeta)) + (B.prepaid - B.prepMeta > 0.009 ? " · اشتراكات لسه أيامها ما جتش " + esc(money(B.prepaid - B.prepMeta)) : "")));
    bs.push(R("إجمالي الأصول", B.assets, "tot"));
    bs.push(R("الالتزامات المتداولة", null, "sec"));
    bs.push(R("مستحق للموردين", B.pay, "ind"));
    bs.push(R("عرابين عملاء — التزامات عقود (IFRS 15.106)", B.custAdv, "ind", "فلوس دفعها عملاء على أوردرات لسه ما اتسلّمتش"));
    if(B.owed > 0.009) bs.push(R("مستحق للشركاء", B.owed, "ind", "مصاريف دفعوها من جيبهم ولسه ما رجعتلهمش"));
    bs.push(R("إجمالي الالتزامات", B.liab, "tot"));
    bs.push(R("حقوق الملكية", null, "sec"));
    B.partners.forEach(function(x){ if(Math.abs(x.cap) > 0.009) bs.push(R("رأس مال " + esc(x.n), x.cap, "ind")); });
    bs.push(R("إجمالي رأس المال", B.cap, "sub"));
    if(Math.abs(B.cur) > 0.009) bs.push(R("أرباح اتوزّعت على الشركاء ولسه ما اتصرفتش", B.cur, "ind"));
    if(Math.abs(B.opening) > 0.009) bs.push(R("صافي الأرصدة الافتتاحية", B.opening, "ind"));
    bs.push(R("الأرباح المحتجزة", B.re, "ind", "صافي الربح من البداية " + esc(m(A.net)) + (B.dist > 0.009 ? " − اللي اتوزّع " + esc(money(B.dist)) : "")));
    bs.push(R("إجمالي حقوق الملكية", B.equity, "tot"));
    bs.push(R("إجمالي الالتزامات وحقوق الملكية", B.liab + B.equity, "grand"));
    table("t-fin-bs", ["البند", "المبلغ"], bs, "");
    var ok = Math.abs(B.diff) < 0.01 && Math.abs(B.recon) < 0.01;
    var okEl = document.getElementById("fin-ok");
    okEl.className = "fin-ok " + (ok ? "ok" : "bad");
    okEl.textContent = ok ? "✓ متوازنة: الأصول = الالتزامات + حقوق الملكية" : "⚠ فيه فرق " + money(Math.abs(B.diff)) + " — راجع «توفيق الميزانية» في رأس المال";
    document.getElementById("fin-asof").textContent = "كما في " + today();

    var cols = Pd ? [Pd, A] : [A];
    var I = function(label, k, kind, sub){
      var c = kind === "sec" ? "fs-sec" : kind === "sub" ? "fs-sub" : kind === "tot" ? "fs-tot" : kind === "grand" ? "fs-grand" : "";
      return "<tr" + (c ? " class='" + c + "'" : "") + "><td class='wide" + (kind === "ind" ? " ind" : "") + "'>" + label +
        (sub ? "<span class='sub'>" + sub + "</span>" : "") + "</td>" +
        cols.map(function(o){ var v = k ? o[k] : null; if(v === null) return "<td class='num'></td>";
          // «neg» = مصروف بيتطرح: موجب → بين قوسين · سالب (مكسب استبدال مثلاً) → مكسب عادي
          var shown = kind === "neg" ? -v : v;
          return "<td class='num" + cls(shown) + "'>" + m(shown) + "</td>"; }).join("") + "</tr>";
    };
    var any = function(k){ return cols.some(function(o){ return Math.abs(o[k]) > 0.009; }); };
    var is = [];
    is.push(I("الإيرادات", null, "sec"));
    is.push(I("مبيعات البضاعة (المسلّمة)", "rev", "ind"));
    is.push(I("رسوم شحن محصّلة من العملاء", "sin", "ind"));
    is.push(I("إجمالي الإيرادات", "totRev", "sub"));
    is.push(I("تكلفة البضاعة المباعة", "cogs", "neg"));
    is.push(I("مجمل الربح", "gross", "tot"));
    is.push(I("مصروفات البيع والتسويق", null, "sec"));
    is.push(I("إعلانات", "ads", "neg"));
    is.push(I("شحن مدفوع لشركات الشحن", "sout", "neg"));
    if(any("pack")) is.push(I("تغليف", "pack", "neg"));
    if(any("xloss")) is.push(I("خسارة استبدال مع الموردين", "xloss", "neg"));
    if(any("othervar")) is.push(I("مصاريف بيع تانية", "othervar", "neg"));
    is.push(I("إجمالي مصروفات البيع والتسويق", "sell", "sub"));
    is.push(I("مصروفات إدارية وعمومية", null, "sec"));
    if(any("subs")) is.push(I("اشتراكات", "subs", "neg"));
    if(any("salary")) is.push(I("مرتبات", "salary", "neg"));
    if(any("once")) is.push(I("مصاريف مرة واحدة / تأسيس", "once", "neg"));
    if(any("trans")) is.push(I("انتقالات من غير فاتورة", "trans", "neg"));
    if(any("other")) is.push(I("مصاريف تانية", "other", "neg"));
    is.push(I("إجمالي المصروفات الإدارية", "admin", "sub"));
    is.push(I("صافي الربح (الخسارة)", "net", "grand"));
    table("t-fin-is", ["البند"].concat(Pd ? ["الفترة", "من البداية"] : ["من البداية"]), is, "");
    var rf = r && r.from !== "0000-01-01" ? r.from : "", rtt = r && r.to !== "9999-12-31" ? r.to : "";
    document.getElementById("fin-per").textContent = Pd ? "(" + (rf && rtt ? rf + " لـ " + rtt : rf ? "من " + rf : "لحد " + rtt) + " · ومن البداية)" : "(من البداية)";
    var bad = cols.some(function(o){ return Math.abs(o.net - o.check) > 0.01; });
    document.getElementById("fin-note").innerHTML = "على <b>أساس التسليم</b> (IFRS 15.38 — السيطرة على البضاعة بتنتقل للعميل وقت الاستلام): الإيراد بيتسجّل لما العميل يستلم، والأوردرات اللي لسه ماشية (" +
      qty(projStats(null).nOpen) + " أوردر) بضاعتها لسه في المخزون بالتكلفة — زي «اتسلّم فعلاً». الأرقام اللي بين قوسين بالسالب. " +
      "صافي الربح من البداية = اللي في «الأرباح المحتجزة» + اللي اتوزّع. المخزون بمتوسط التكلفة شامل نقل الشراء (IAS 2.10 و2.25)، وشحن العملاء مصروف بيع مش تكلفة مخزون (IAS 2.16)." +
      (bad ? " <span class='v-due'>⚠ فيه فرق بين القايمة وحسابات السيستم — بلّغ عنه.</span>" : "");
  }

  /* v133: تقرير الشهر للشركاء — نفس دوال القوايم (finIS · finBS · projStats · itemProfit) لشهر واحد،
     ٣ صفحات A4: الخلاصة والأوردر · القوايم · الشركاء والأصناف والفريق والملاحظات */
  var MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  function prtMonthName(ym){ var p = ym.split("-"); return MONTHS_AR[Number(p[1]) - 1] + " " + p[0]; }
  function prtMonths(){
    var first = live("sales").concat(live("purchases"), live("cash")).reduce(function(a, x){ return x.date && (!a || x.date < a) ? x.date : a; }, "");
    var out = [], cur = today().slice(0, 7), m = (first || today()).slice(0, 7);
    while(m <= cur && out.length < 120){ out.push(m); var y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)) + 1; if(mo > 12){ mo = 1; y++; } m = y + "-" + ("0" + mo).slice(-2); }
    return out.reverse();
  }
  function partnerReport(ym){
    var last = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
    var r = { from:ym + "-01", to:ym + "-" + ("0" + last).slice(-2) };
    var P = projStats(r), v = P.exp, ue = unitEcon(v), M = finIS(r), A = finIS(null), B = finBS();
    // أرقام صحيحة من غير «ج.م» في كل خانة — العملة مكتوبة مرة في الرأس
    var nm = function(x){ return (Math.round(x) || 0).toLocaleString("en-US"); };      // || 0: من غير «-0»
    var sg = function(x){ return x < -0.5 ? "(" + nm(-x) + ")" : nm(x); };
    var cl = function(x){ return x < -0.5 ? " r" : x > 0.5 ? " g" : ""; };
    var toDay = r.to > today() ? today() : r.to, partial = r.to > today();
    var setup = v.once || 0, netNoSetup = v.net + setup;
    var foot = function(pg){ return "<div class='prt-ft'><span>Lora Collection · تقرير الشركاء · " + esc(prtMonthName(ym)) + "</span><span>صفحة " + pg + " · اتطبع " + esc(today()) + "</span></div>"; };
    var head = function(t, sub){ return "<div class='prt-hd'><small>LORA COLLECTION</small><h1>" + t + "</h1><p>" + sub + "</p></div>"; };
    var per = "من " + esc(r.from) + " لـ " + esc(toDay) + (partial ? " (الشهر لسه ماخلصش)" : "") + " · المبالغ بالجنيه المصري";
    // ١ الخلاصة
    var p1 = "<section class='prt-pg'>" + head("تقرير الشركاء — " + esc(prtMonthName(ym)), per) + "<div class='prt-in'>" +
      "<h2>الخلاصة</h2><div class='prt-kp'>" +
        "<div><span>أوردرات الشهر</span><b>" + qty(P.n) + "</b><small>" + qty(P.nDone) + " اتسلّموا أو اتلغوا · " + qty(P.nOpen) + " لسه ماشيين</small></div>" +
        "<div><span>صافي الربح المتوقع (لو كل أوردرات الشهر اتسلّمت)</span><b class='" + (v.net < 0 ? "r" : "") + "'>" + sg(v.net) + "</b><small>" +
          (setup > 0.5 ? "منه " + nm(setup) + " مصاريف مرة واحدة — من غيرها " + sg(netNoSetup) + " · " : "") + "المسلّم فعلاً " + sg(M.net) + " (صفحة 2)</small></div>" +
        "<div class='hi'><span>الأوردر بيكسب بعد الإعلان</span><b>" + (ue ? sg(ue.cu) : "—") + "</b><small>" + (ue ? "الإعلان " + nm(ue.ad) + " على الأوردر" : "") + "</small></div></div>" +
      "<h2>الأوردر الواحد بيكسب كام؟</h2>" +
      (ue ? "<table class='prt-t'><tr><th>البند</th><th class='n'>على الأوردر</th></tr>" +
        "<tr><td>متوسط الأوردر</td><td class='n'>" + nm(v.goods / v.n) + "</td></tr>" +
        "<tr><td>تكلفة البضاعة</td><td class='n r'>(" + nm(v.cost / v.n) + ")</td></tr>" +
        "<tr><td>" + (v.ship < 0 ? "شحن من جيبنا" : "مكسب الشحن") + "</td><td class='n" + cl(v.ship) + "'>" + sg(v.ship / v.n) + "</td></tr>" +
        "<tr><td>تغليف ومصاريف بيع تانية</td><td class='n r'>(" + nm((v.varExp - v.ads) / v.n) + ")</td></tr>" +
        "<tr class='tot'><td>الأوردر بيكسب قبل الإعلان</td><td class='n'>" + sg(ue.pre) + "</td></tr>" +
        "<tr><td>إعلان على الأوردر</td><td class='n r'>(" + nm(ue.ad) + ")</td></tr>" +
        "<tr class='tot'><td>الأوردر بيكسب بعد الإعلان</td><td class='n" + cl(ue.cu) + "'>" + sg(ue.cu) + "</td></tr></table>" : "<p>مفيش أوردرات في الشهر ده.</p>") +
      "</div>" + foot(1) + "</section>";
    // ٢ القوايم
    var isr = function(t, k, neg, c){ var a = M[k], b = A[k]; var f = function(x){ return neg ? (x > 0.5 ? "(" + nm(x) + ")" : nm(-x)) : sg(x); };
      return "<tr" + (c ? " class='" + c + "'" : "") + "><td>" + t + "</td><td class='n" + (neg ? (a > 0.5 ? " r" : "") : cl(a)) + "'>" + f(a) + "</td><td class='n" + (neg ? (b > 0.5 ? " r" : "") : cl(b)) + "'>" + f(b) + "</td></tr>"; };
    var ok = Math.abs(B.diff) < 0.01 && Math.abs(B.recon) < 0.01;
    var p2 = "<section class='prt-pg'>" + head("القوايم المالية", "على أساس التسليم — الإيراد بيتسجّل لما العميل يستلم (IFRS 15)") + "<div class='prt-in'>" +
      "<h2>قايمة الدخل</h2><table class='prt-t'><tr><th>البند</th><th class='n'>" + esc(prtMonthName(ym)) + "</th><th class='n'>من البداية</th></tr>" +
        isr("مبيعات البضاعة المسلّمة", "rev") + isr("رسوم شحن من العملاء", "sin") + isr("إجمالي الإيرادات", "totRev", false, "tot") +
        isr("تكلفة البضاعة المباعة", "cogs", true) + isr("مجمل الربح", "gross", false, "tot") +
        isr("إعلانات", "ads", true) + isr("شحن مدفوع لشركات الشحن", "sout", true) + isr("تغليف", "pack", true) +
        (M.xloss || A.xloss ? isr("خسارة استبدال", "xloss", true) : "") +
        (M.othervar || A.othervar ? isr("مصروفات متغيّرة تانية", "othervar", true) : "") +
        isr("إجمالي مصروفات البيع والتسويق", "sell", true, "tot") +
        isr("مصروفات إدارية وعمومية", "admin", true) + isr("صافي الربح (الخسارة)", "net", false, "tot") + "</table>" +
      "<h2>الميزانية العمومية <span style='font-weight:400;font-size:13px;color:var(--lp-soft)'>— كما في " + esc(today()) + "</span></h2>" +
      "<div class='prt-2'><table class='prt-t'><tr class='sec'><td>الأصول المتداولة</td><td class='n'></td></tr>" +
        "<tr><td>الخزنة</td><td class='n'>" + nm(B.cash) + "</td></tr><tr><td>عند شركات الشحن</td><td class='n'>" + nm(B.wallets) + "</td></tr>" +
        (B.recv > 0.5 ? "<tr><td>مديونيات العملاء</td><td class='n'>" + nm(B.recv) + "</td></tr>" : "") +
        (B.supAdv > 0.5 ? "<tr><td>دفعات مقدّمة للموردين</td><td class='n'>" + nm(B.supAdv) + "</td></tr>" : "") +
        "<tr><td>المخزون بالتكلفة</td><td class='n'>" + nm(B.stock) + "</td></tr>" +
        (B.prepaid > 0.5 ? "<tr><td>مصروفات مدفوعة مقدّماً</td><td class='n'>" + nm(B.prepaid) + "</td></tr>" : "") +
        "<tr class='tot'><td>إجمالي الأصول</td><td class='n'>" + nm(B.assets) + "</td></tr></table>" +
      "<table class='prt-t'><tr class='sec'><td>الالتزامات وحقوق الملكية</td><td class='n'></td></tr>" +
        "<tr><td>مستحق للموردين</td><td class='n'>" + nm(B.pay) + "</td></tr><tr><td>عرابين عملاء</td><td class='n'>" + nm(B.custAdv) + "</td></tr>" +
        (B.owed > 0.5 ? "<tr><td>مستحق للشركاء</td><td class='n'>" + nm(B.owed) + "</td></tr>" : "") +
        "<tr><td>رأس مال الشركاء</td><td class='n'>" + nm(B.cap) + "</td></tr>" +
        (Math.abs(B.cur) > 0.5 ? "<tr><td>أرباح ليهم لسه ما اتصرفتش</td><td class='n'>" + nm(B.cur) + "</td></tr>" : "") +
        (Math.abs(B.opening) > 0.5 ? "<tr><td>صافي الأرصدة الافتتاحية</td><td class='n" + cl(B.opening) + "'>" + sg(B.opening) + "</td></tr>" : "") +
        "<tr><td>الأرباح المحتجزة</td><td class='n" + cl(B.re) + "'>" + sg(B.re) + "</td></tr>" +
        "<tr class='tot'><td>الإجمالي</td><td class='n'>" + nm(B.liab + B.equity) + "</td></tr></table></div>" +
      "<p class='prt-ok" + (ok ? "" : " bad") + "'>" + (ok ? "✓ الميزانية متوازنة: الأصول = الالتزامات + حقوق الملكية" : "⚠ فيه فرق في الميزانية — راجع «توفيق الميزانية»") + "</p>" +
      "</div>" + foot(2) + "</section>";
    // ٣ الشركاء والأصناف والفريق والملاحظات
    var ps = partners(), tot = ps.reduce(function(a, x){ return a + capitalOf(x.id); }, 0);
    var prow = ps.map(function(x){ var c = capitalOf(x.id), k = tot > 0 ? c / tot : 0, sh = (B.re + B.opening) * k;
      return "<tr><td>" + esc(x.name) + "</td><td class='n'>" + nm(c) + "</td><td class='n'>" + (k * 100).toFixed(1) + "%</td><td class='n" + cl(sh) + "'>" + sg(sh) + "</td><td class='n'>" + nm(c + currentOf(x.id) + sh) + "</td></tr>"; }).join("");
    var IP = itemProfit(P, false).M, its = Object.keys(IP).filter(function(id){ return id && IP[id].q > 0; })
      .map(function(id){ var m = IP[id]; return { n:itemName(id), q:m.q, net:m.net, pp:m.net / m.q }; }).sort(function(a, b){ return b.pp - a.pp; });
    var irow = function(x){ return "<tr><td>" + esc(x.n) + "</td><td class='n'>" + qty(x.q) + "</td><td class='n" + cl(x.net) + "'>" + sg(x.net) + "</td><td class='n" + cl(x.pp) + "'>" + sg(x.pp) + "</td></tr>"; };
    var om = ownerStats(salesIn(r));
    var trow = Object.keys(om).sort(function(a, b){ return om[b].rev - om[a].rev; }).slice(0, 6).map(function(o){ var m = om[o];
      return "<tr><td>" + esc(o) + "</td><td class='n'>" + qty(m.n) + "</td><td class='n'>" + qty(m.d) + "</td><td class='n'>" + nm(m.rev) + "</td><td class='n" + cl(m.net) + "'>" + sg(m.net) + "</td></tr>"; }).join("");
    // ملاحظات بتطلع لوحدها من الأرقام — نفس حدود «عشان تبدأ تكسب»
    var notes = [];
    if(ue){
      notes.push(ue.cu > 0 ? ["", "الأوردر بيكسب " + nm(ue.cu) + " بعد الإعلان" + (ue.need ? " — محتاجين " + qty(ue.need) + " أوردر يغطّوا الثابت" : "")] : ["b", "الأوردر بيخسر " + nm(-ue.cu) + " بعد الإعلان — الإعلان على الأوردر (" + nm(ue.ad) + ") أكبر من ربحه قبل الإعلان (" + nm(ue.pre) + ")"]);
      if(ue.ad > 100) notes.push(["w", "الإعلان " + nm(ue.ad) + " على الأوردر — الهدف تحت 100"]);
      if(v.ship < 0 && -v.ship / v.n > 25) notes.push(["w", "بندفع " + nm(-v.ship / v.n) + " شحن من جيبنا على الأوردر (" + nm(-v.ship) + " في الشهر)"]);
    }
    its.filter(function(x){ return x.q >= 5 && x.pp < 15; }).forEach(function(x){ notes.push(["w", esc(x.n) + ": اتباع " + nPcs(x.q) + " وصافي القطعة " + sg(x.pp) + " بس — راجع سعره"]); });
    if(setup > 0.5) notes.push(["", "مصاريف مرة واحدة " + nm(setup) + " مش هتتكرر"]);
    var fin = P.c.list.filter(function(s){ return isDelivered(s) || isCancelled(s); }), rx = fin.filter(isCancelled).length;
    if(fin.length) notes.push([rx / fin.length > 0.15 ? "b" : "", "نسبة الرفض في الشهر " + Math.round(rx / fin.length * 100) + "% (" + qty(rx) + " من " + qty(fin.length) + " خلصوا)"]);
    var p3 = "<section class='prt-pg'>" + head("الشركاء والأصناف والفريق", esc(prtMonthName(ym))) + "<div class='prt-in'>" +
      "<h2>حق كل شريك</h2><table class='prt-t'><tr><th>الشريك</th><th class='n'>رأس ماله</th><th class='n'>نسبته</th><th class='n'>نصيبه من الأرباح المحتجزة</th><th class='n'>حقه النهارده</th></tr>" + prow + "</table>" +
      "<p style='margin:-8px 0 0;font-size:11.5px;color:var(--lp-soft)'>الأرباح المحتجزة من البداية (مش الشهر بس) بنسبة رأس المال للتوضيح — مش توزيع أرباح.</p>" +
      "<div class='prt-2'><div><h2>الأصناف — صافي القطعة</h2><table class='prt-t'><tr><th>الصنف</th><th class='n'>اتباع</th><th class='n'>صافي</th><th class='n'>للقطعة</th></tr>" +
        (its.length ? its.slice(0, 8).map(irow).join("") : "<tr><td colspan='4'>مفيش مبيعات</td></tr>") + "</table></div>" +
      "<div><h2>الفريق</h2><table class='prt-t'><tr><th>المسؤول</th><th class='n'>أوردرات</th><th class='n'>مسلّم</th><th class='n'>مبيعات</th><th class='n'>صافي</th></tr>" +
        (trow || "<tr><td colspan='5'>مفيش أوردرات</td></tr>") + "</table></div></div>" +
      "<h2>ملاحظات</h2><ul class='prt-nt'>" + notes.slice(0, 6).map(function(n){ return "<li class='" + n[0] + "'>" + n[1] + "</li>"; }).join("") + "</ul>" +
      "</div>" + foot(3) + "</section>";
    return p1 + p2 + p3;
  }
  function openPrt(ym){
    var sel = document.getElementById("prt-month"), ms = prtMonths();
    ym = ym || ms[0];
    sel.innerHTML = ms.map(function(m){ return "<option value='" + m + "'" + (m === ym ? " selected" : "") + ">" + esc(prtMonthName(m)) + "</option>"; }).join("");
    document.getElementById("prt-body").innerHTML = partnerReport(ym);
    document.getElementById("prt").hidden = false;
    document.body.classList.add("prt-open");
    document.getElementById("b-prt-close").focus();
  }
  function closePrt(){
    var el = document.getElementById("prt"); if(!el || el.hidden) return;
    el.hidden = true; document.body.classList.remove("prt-open");
    var b = document.getElementById("b-prt"); if(b && b.offsetParent) b.focus();
  }
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") closePrt(); });
  document.getElementById("b-prt").addEventListener("click", function(){ openPrt(); });
  document.getElementById("prt-month").addEventListener("change", function(){ openPrt(this.value); });
  document.getElementById("b-prt-close").addEventListener("click", closePrt);
  document.getElementById("b-prt-print").addEventListener("click", function(){ window.print(); });

  // أداء المسؤولين — نفس الحسبة في «الفريق» وفي تقرير الشركاء
  function ownerStats(list){
    var om = {};
    list.forEach(function(s){
      var o = (s.owner||"").trim() || "غير محدد";
      if(!om[o]) om[o] = { n:0, d:0, c:0, rev:0, net:0 };
      var m = om[o]; m.n++;
      if(isDelivered(s)){ m.d++; m.rev += saleTotal(s); }
      if(isCancelled(s)) m.c++;
      m.net += saleProfit(s);
    });
    return om;
  }
  function renderReports(){
    clearMonthly();
    renderProjIS();
    if(repTab === "cfo" && canMoney()) renderCfo();
    if(repTab === "fin" && canMoney()) renderFin();
    renderItemProfit();
    applyRepTab(!repTabInit); repTabInit = true; repTitle();
    renderAging();
    renderPerf();
    renderBreakEven();
    renderMonths();
    renderSens();
    renderItemBE();
    var r = periodRange();
    var list = salesIn(r);

    // أفضل الأصناف
    var im = {};
    list.forEach(function(s){
      var seen = {};
      SL(s).forEach(function(l){
        if(!l.itemId) return;
        if(!im[l.itemId]) im[l.itemId] = { q:0, rev:0, pr:0, ret:0, n:0, c:0 };
        var m = im[l.itemId];
        if(!seen[l.itemId]){                     // الأوردر بيتعدّ مرة واحدة للصنف
          seen[l.itemId] = 1; m.n++;
          if(isCancelled(s)) m.c++;
        }
        if(isDelivered(s)){
          var sold = lineSold(l,s);
          m.q += sold; m.rev += sold*(Number(l.price)||0);
          m.pr += ((Number(l.price)||0) - lineCost(l)) * sold;
          m.ret += lineRet(l);
        }
      });
    });
    var irows = Object.keys(im).map(function(id){ return [id, im[id]]; })
      .sort(function(a,b){ return b[1].pr - a[1].pr; })
      .map(function(x){
        var m = x[1], marg = m.rev ? (m.pr/m.rev*100) : 0;
        return "<tr><td class='wide'>"+esc(itemName(x[0]))+"</td>"+
          "<td class='num'>"+qty(m.q)+"</td><td class='num'>"+money(m.rev)+"</td>"+
          "<td class='num "+(m.pr>=0?"v-gain":"v-due")+"'>"+money(m.pr)+"</td>"+
          "<td class='num'>"+marg.toFixed(0)+"%</td>"+
          "<td class='num "+(m.ret?"v-due":"")+"'>"+qty(m.ret)+"</td>"+
          "<td class='num "+(m.c?"v-due":"")+"'>"+qty(m.c)+"</td></tr>";
      });
    table("t-rep-items", ["الصنف","المباع","المبيعات","الربح","الهامش","مرتجع","ملغي"], irows,
      "مفيش مبيعات في الفترة دي.");

    // المحافظات
    var gm = {};
    list.forEach(function(s){
      var p = db.parties.find(function(x){ return x.id===s.partyId; }) || {};
      var g = (p.gov||"").trim() || "غير محددة";
      if(!gm[g]) gm[g] = { n:0, d:0, c:0, rev:0, net:0 };
      var m = gm[g]; m.n++;
      if(isDelivered(s)){ m.d++; m.rev += saleTotal(s); }
      if(isCancelled(s)) m.c++;
      m.net += saleProfit(s);
    });
    var grows = Object.keys(gm).map(function(g){ return [g, gm[g]]; })
      .sort(function(a,b){ return b[1].rev - a[1].rev; })
      .map(function(x){
        var m = x[1], rate = m.n ? m.c/m.n*100 : 0;
        return "<tr><td class='wide'>"+esc(x[0])+"</td><td class='num'>"+qty(m.n)+"</td>"+
          "<td class='num'>"+qty(m.d)+"</td><td class='num "+(m.c?"v-due":"")+"'>"+qty(m.c)+"</td>"+
          "<td class='num "+(rate>15?"v-due":"")+"'>"+rate.toFixed(0)+"%</td>"+
          "<td class='num'>"+money(m.rev)+"</td>"+
          "<td class='num "+(m.net>=0?"v-gain":"v-due")+"'>"+money(m.net)+"</td></tr>";
      });
    table("t-rep-gov", ["المحافظة","أوردرات","مسلّم","ملغي","نسبة الإلغاء","المبيعات","صافي الربح"], grows,
      "مفيش أوردرات في الفترة دي.");

    // العملاء
    var cm = {};
    list.forEach(function(s){
      if(!cm[s.partyId]) cm[s.partyId] = { n:0, d:0, c:0, rev:0, net:0 };
      var m = cm[s.partyId]; m.n++;
      if(isDelivered(s)){ m.d++; m.rev += saleTotal(s); }
      if(isCancelled(s)) m.c++;
      m.net += saleProfit(s);
    });
    var crows = Object.keys(cm).map(function(id){ return [id, cm[id]]; })
      .sort(function(a,b){ return b[1].rev - a[1].rev; })
      .map(function(x){
        var m = x[1], p = db.parties.find(function(y){ return y.id===x[0]; }) || {};
        var bal = partyBalance(x[0]);
        return "<tr><td class='wide'>"+esc(partyName(x[0]))+
          (p.gov?"<span class='sub'>"+esc(p.gov)+"</span>":"")+"</td>"+
          "<td class='num'>"+qty(m.n)+"</td><td class='num'>"+qty(m.d)+"</td>"+
          "<td class='num "+(m.c?"v-due":"")+"'>"+qty(m.c)+"</td>"+
          "<td class='num'>"+money(m.rev)+"</td>"+
          "<td class='num "+(m.net>=0?"v-gain":"v-due")+"'>"+money(m.net)+"</td>"+
          "<td class='num "+(bal>0.009?"v-due":"")+"'>"+(bal>0.009?money(bal):"—")+"</td></tr>";
      });
    table("t-rep-cust", ["العميل","أوردرات","مسلّم","ملغي","المبيعات","صافي الربح","عليه"], crows,
      "مفيش عملاء في الفترة دي.");

    // المسؤولين
    var om = ownerStats(list);
    var orows = Object.keys(om).map(function(o){ return [o, om[o]]; })
      .sort(function(a,b){ return b[1].rev - a[1].rev; })
      .map(function(x){
        var m = x[1], rate = m.n ? m.c/m.n*100 : 0;
        return "<tr><td class='wide'>"+esc(x[0])+"</td><td class='num'>"+qty(m.n)+"</td>"+
          "<td class='num'>"+qty(m.d)+"</td><td class='num "+(m.c?"v-due":"")+"'>"+qty(m.c)+"</td>"+
          "<td class='num "+(rate>15?"v-due":"")+"'>"+rate.toFixed(0)+"%</td>"+
          "<td class='num'>"+money(m.rev)+"</td>"+
          "<td class='num "+(m.net>=0?"v-gain":"v-due")+"'>"+money(m.net)+"</td></tr>";
      });
    table("t-rep-owner", ["المسؤول","أوردرات","مسلّم","ملغي","نسبة الإلغاء","المبيعات","صافي الربح"], orows,
      "مفيش أوردرات في الفترة دي.");
  }

  // ---------- شاشة المخزون ----------
  var moveFor = null;

  function invRows(){
    var r = periodRange();
    var out = [];
    live("items").forEach(function(i){
      variantsOf(i.id).forEach(function(v){
        var k = vKey(i.id, v.color, v.size);
        var bought=0, sold=0, ret=0, cancQ=0, pret=0;
        live("purchases").forEach(function(p){
          if(keyOf(p)!==k || !inRange(p.date,r)) return;
          var q = Number(p.qty)||0;
          if(q < 0) pret += -q; else bought += q;      // المرتجع للمورد في عمود لوحده
        });
        live("sales").forEach(function(x){
          if(!inRange(revDate(x),r)) return;
          SL(x).forEach(function(l){
            if(keyOf(l) !== k) return;
            if(isDelivered(x)){ sold += lineSold(l,x); ret += lineRet(l); }
            if(isCancelled(x)) cancQ += Number(l.qty)||0;
          });
        });
        // اتباع منه أي حاجة قبل كده؟ ده اللي بيفرّق بين «قرب يخلص»
        // و«لسه مشتريه كمية صغيرة»
        var soldEver = live("sales").some(function(x){
          return isDelivered(x) && SL(x).some(function(l){
            return keyOf(l) === k && lineSold(l,x) > 0; });
        });
        out.push({ item:i, color:v.color, size:v.size, key:k, soldEver:soldEver,
          bought:bought, sold:sold, ret:ret, canc:cancQ, pret:pret,
          stock:stockOfV(i.id,v.color,v.size),
          rsv:reservedOfV(i.id,v.color,v.size),
          cost:avgCostV(i.id,v.color,v.size) });
      });
    });
    return out;
  }

