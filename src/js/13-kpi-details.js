  /* ================= تفاصيل كروت لوحة المتابعة ================= */
  /* كل رقم في اللوحة لازم يكون ليه «من فين جه». كل مفتاح بيرجّع
     {note, head, rows, foot} والجدول بيتبني منهم. الأرقام بتتحسب بنفس
     الدوال اللي الكارت نفسه بيستعملها عشان الإجمالي يطابق التفاصيل. */
  var kpiOpen = null;

  function oLink(s){
    return "<a href='#' data-goorder='" + esc(s.id) + "'>#" + esc(s.no || "—") + "</a>";
  }
  function sumRow(cells){
    return "<tr class='sumrow'>" + cells.map(function(c, i){
      return "<td" + (i ? " class='num'" : " class='wide'") + ">" + c + "</td>"; }).join("") + "</tr>";
  }

  var KPI_DETAIL = {
    rev: function(cur){
      var rows = cur.deliv.slice().sort(byDate).map(function(s){
        return "<tr><td class='wide'>" + oLink(s) + " · " + esc(partyName(s.partyId)) + "</td>" +
          "<td class='num'>" + esc(revDate(s)) + "</td>" +
          "<td class='wide'>" + esc(itemsLabel(s)) + "</td>" +
          "<td class='num'>" + qty(soldQty(s)) + "</td>" +
          "<td class='num' style='font-weight:600'>" + money(saleTotal(s)) + "</td></tr>";
      });
      rows.push(sumRow(["الإجمالي","","", qty(cur.deliv.reduce(function(a,s){ return a+soldQty(s); },0)),
                        "<b>"+money(cur.revenue)+"</b>"]));
      return { note:"الإيراد بيتسجّل بتاريخ التسليم مش تاريخ الأوردر (IFRS 15). المرتجع مخصوم.",
               head:["الأوردر","تاريخ التسليم","الأصناف","القطع","الإيراد"], rows:rows };
    },
    cogs: function(cur){
      var per = {};
      cur.deliv.forEach(function(s){
        SL(s).forEach(function(l){
          var k = vKey(l.itemId, vColor(l), vSize(l)), n = lineSold(l,s);
          if(!n) return;
          if(!per[k]) per[k] = { itemId:l.itemId, color:vColor(l), size:vSize(l), q:0, c:0, r:0 };
          per[k].q += n; per[k].c += lineCost(l) * n; per[k].r += n * (Number(l.price)||0);
        });
      });
      var rows = Object.keys(per).map(function(k){ return per[k]; })
        .sort(function(a,b){ return b.c - a.c; }).map(function(x){
        return "<tr><td class='wide'>" + thumbHTML(x.itemId) + esc(itemName(x.itemId)) +
            (vLabel(x.color,x.size) ? " <span class='pill'>"+esc(vLabel(x.color,x.size))+"</span>" : "") + "</td>" +
          "<td class='num'>" + qty(x.q) + "</td>" +
          "<td class='num'>" + money(x.q ? x.c/x.q : 0) + "</td>" +
          "<td class='num'>" + money(x.c) + "</td>" +
          "<td class='num'>" + money(x.r) + "</td>" +
          "<td class='num " + ((x.r-x.c)>=0?"v-gain":"v-due") + "'>" + money(x.r - x.c) + "</td></tr>";
      });
      rows.push(sumRow(["الإجمالي","","","<b>"+money(cur.cogs)+"</b>",
                        "<b>"+money(cur.revenue)+"</b>","<b>"+money(cur.revenue-cur.cogs)+"</b>"]));
      return { note:"التكلفة بتتثبّت وقت التسليم بمتوسط سعر الشراء وقتها (IAS 2.27)، فمش بتتغيّر لو اشتريت بعدها بسعر تاني.",
               head:["الصنف","اتباع","متوسط تكلفة القطعة","إجمالي التكلفة","الإيراد","مجمل الربح"], rows:rows };
    },
    gross: function(cur){
      var rows = cur.deliv.slice().sort(byDate).map(function(s){
        var c = SL(s).reduce(function(a,l){ return a + lineCost(l)*lineSold(l,s); },0);
        var g = saleTotal(s) - c;
        return "<tr><td class='wide'>" + oLink(s) + " · " + esc(partyName(s.partyId)) + "</td>" +
          "<td class='num'>" + esc(revDate(s)) + "</td>" +
          "<td class='num'>" + money(saleTotal(s)) + "</td>" +
          "<td class='num'>" + money(c) + "</td>" +
          "<td class='num " + (g>=0?"v-gain":"v-due") + "' style='font-weight:600'>" + money(g) + "</td></tr>";
      });
      rows.push(sumRow(["الإجمالي","","<b>"+money(cur.revenue)+"</b>",
                        "<b>"+money(cur.cogs)+"</b>","<b>"+money(cur.profit)+"</b>"]));
      return { note:"مجمل ربح البضاعة = الإيراد − تكلفة البضاعة المباعة. الشحن والمصاريف مش داخلين هنا.",
               head:["الأوردر","التاريخ","الإيراد","التكلفة","مجمل الربح"], rows:rows };
    },
    ship: function(cur){
      var rows = cur.list.filter(function(s){ return shipCounts(s) && (shipIn(s) || shipOut(s)); })
        .sort(byDate).map(function(s){
        var n = shipIn(s) - shipOut(s);
        return "<tr><td class='wide'>" + oLink(s) + " · " + esc(partyName(s.partyId)) + "</td>" +
          "<td>" + (esc(squish(s.shipCo)) || "—") + "</td>" +
          "<td class='num'>" + money(shipIn(s)) + "</td>" +
          "<td class='num'>" + money(shipOut(s)) + "</td>" +
          "<td class='num " + (n>=0?"v-gain":"v-due") + "'>" + money(n) + "</td></tr>";
      });
      var ti = cur.list.reduce(function(a,s){ return a + (shipCounts(s)?shipIn(s):0); },0);
      var to = cur.list.reduce(function(a,s){ return a + (shipCounts(s)?shipOut(s):0); },0);
      rows.push(sumRow(["الإجمالي","","<b>"+money(ti)+"</b>","<b>"+money(to)+"</b>",
                        "<b>"+money(ti-to)+"</b>"]));
      return { note:"بالسالب يعني دفعت لشركات الشحن أكتر مما حمّلته للعملاء — الفرق ده طلع من جيبك.",
               head:["الأوردر","شركة الشحن","حمّلته للعميل","دفعته للشركة","الصافي"], rows:rows };
    },
    exp: function(cur, r){
      var rows = live("cash").filter(function(c){ return c.type==="expense" && !trLinked(c) && Math.abs(expAmtIn(c, r)) > 0.004; })
        .map(function(c){ var v = expAmtIn(c, r), a = Number(c.amount)||0;
          return { date:c.date, at:c.at, partyId:c.paidBy || c.partyId, type:"expense", cat:c.cat, costKind:c.costKind,
                   note:(isMetaTop(c) ? "رسوم فوري · " : "") + (squish(c.note) || "") + (Math.abs(v - a) > 0.009 && !isMetaTop(c) ? " (اتدفع " + money(a) + ")" : ""), amount:v }; })
        .concat(metaSpans().map(function(s){ return { date:s.to, at:0, partyId:"", type:"expense", cat:"ads", amount:shareIn(s.from, s.days, s.spent, r),
          note:"فيسبوك صرف من " + dShort(s.from) + " لـ " + dShort(s.to) + " (مطابقة)" }; }).filter(function(x){ return Math.abs(x.amount) > 0.004; }))
        .concat(live("purchases").filter(function(p){ return p.xloss && inRange(p.date, r); })
          .map(function(p){ return { date:p.date, at:p.at, partyId:p.partyId, amount:p.xloss,
            note:(p.xloss > 0 ? "خسارة " : "مكسب ") + (p.xchg ? "استبدال" : "مرتجع") + (p.pno ? " #" + p.pno : "") + " · " + itemName(p.itemId) }; }))
        .sort(byDate).map(function(c){
        return "<tr><td class='num'>" + esc(c.date||"—") + "</td>" +
          "<td class='wide'>" + (esc(squish(c.note)) || "بدون بيان") + (c.type === "expense" ? "<span class='sub'>" + esc(EXP_CAT[expCat(c)].label) + "</span>" : "") + "</td>" +
          "<td>" + (c.partyId ? esc(partyName(c.partyId)) : "—") + "</td>" +
          "<td class='num v-due'>" + money(c.amount) + "</td></tr>";
      });
      rows.push(sumRow(["الإجمالي","","","<b>"+money(cur.expenses)+"</b>"]));
      return { note:"مصاريف التشغيل — نصيب الفترة من كل مصروف (الاشتراك على أيامه، والإعلانات اللي فيسبوك صرفها فعلاً). مصاريف نقل المشتريات وانتقالات شراء البضاعة اللي ليها فاتورة مش هنا — دي بتتحط على تكلفة البضاعة.",
               head:["التاريخ","البيان","الجهة","المبلغ"], rows:rows };
    },
    be: function(cur, r){
      var L = function(a, v, cls){
        return "<tr" + (cls ? " class='" + cls + "'" : "") + "><td class='wide'>" + esc(a) +
          "</td><td class='num'>" + money(v) + "</td></tr>"; };
      // كل بند لوحده عشان تعرف الرقم جه منين
      var sup = 0, fr = 0, shp = 0, exp = 0, out = 0;
      live("purchases").forEach(function(p){
        var pd = Number(p.paid)||0; if(pd > 0) sup += pd; fr += pFreight(p); });
      live("sales").forEach(function(s){ if(shipCounts(s)) shp += shipOut(s); });
      live("cash").forEach(function(c){
        if(c.type === "expense" && !c.paidBy) exp += Number(c.amount)||0;
        if(c.type === "out")     out += Number(c.amount)||0; });
      var fromCust = 0, fromSup = 0, manIn = 0;
      live("sales").forEach(function(s){
        if(isCancelled(s)) fromCust += shipIn(s); else fromCust += Number(s.paid)||0; });
      live("purchases").forEach(function(p){
        var pd = Number(p.paid)||0; if(pd < 0) fromSup += -pd; });
      live("cash").forEach(function(c){ if(c.type === "in") manIn += Number(c.amount)||0; });

      var spent = cashOutlay(), back = cashBack(), left = spent - back;
      var rows = [];
      if(sup) rows.push(L("مدفوع للموردين", sup));
      if(fr)  rows.push(L("نقل البضاعة", fr));
      if(shp) rows.push(L("مدفوع لشركات الشحن", shp));
      if(exp) rows.push(L("مصاريف", exp));
      if(out) rows.push(L("مدفوع لجهات", out));
      rows.push(L("إجمالي اللي خرج من جيبك", spent, "sumrow"));
      if(fromCust) rows.push(L("محصّل من العملاء", fromCust));
      if(fromSup)  rows.push(L("استرداد من موردين", fromSup));
      if(manIn)    rows.push(L("تحصيل يدوي", manIn));
      rows.push(L("إجمالي اللي رجع", back, "sumrow"));
      rows.push(L(left > 0.009 ? "لسه ما رجعش" : "رجّعت فلوسك وزيادة",
                  Math.abs(left), "sumrow"));
      var bs = cashBeSplit();
      if(left > 0.009 && bs.stock > 0.009) rows.push(L("منه بضاعة على الرف (بالتكلفة)", bs.stock));
      if(left > 0.009 && bs.rest > 0.009) rows.push(L(bs.isLoss ? "ومنه خسارة لحد النهارده" : "والباقي", bs.rest));
      return { note: left > 0.009
          ? "كل اللي خرج من جيبك على الشغل ناقص كل اللي رجع من البيع. رقم كاش تراكمي من البداية — بيقل مع كل تحصيل. المحصّل عن طريق شركة الشحن محسوب هنا حتى لو لسه ما سحبتوش. البضاعة اللي على الرف مش خسارة: هترجع لما تتباع."
          : "رجّعت كل اللي دفعته، واللي بعد كده مكسب. الرقم تراكمي من البداية.",
        head:["البند","المبلغ"], rows:rows };
    },

    net: function(cur, r){
      var L = function(a,b,cls){
        return "<tr><td class='wide'>"+esc(a)+"</td><td class='num "+(cls||"")+"'>"+money(b)+"</td></tr>"; };
      // v122: نفس قايمة الدخل في التقارير («لو كله اتسلّم») — نفس رقم الكارت
      var P = projStats(r), v = P.exp, rows = [
        L("المبيعات" + (P.nOpen ? " (منها " + qty(P.nOpen) + " أوردر لسه ماشي)" : ""), v.goods, "v-gain"),
        L("− تكلفة البضاعة", -v.cost, "v-due"),
        sumRow(["ربح البضاعة","<b>"+money(v.gross)+"</b>"]),
        L((v.ship>=0?"+ ربح الشحن":"− فرق الشحن"), v.ship, v.ship>=0?"v-gain":"v-due"),
        L("− إعلانات وتغليف (متغيّر)", -v.varExp, "v-due"),
        sumRow(["ربح الأوردرات بعد مصاريف البيع","<b>"+money(v.contrib)+"</b>"]),
        L("− مصاريف ثابتة", -v.fixedExp, "v-due"),
        sumRow(["صافي الربح لو كله اتسلّم","<b>"+money(v.net)+"</b>"]),
        L("منه اتسلّم فعلاً", P.act.net, P.act.net>=0?"v-gain":"v-due")
      ];
      return { note:"نفس «قايمة الدخل» في التقارير. «لو كله اتسلّم» = قبل أي رفض. رصيد الخزنة رقم تاني خالص — فيه رأس المال والمشتريات والتحصيل.",
               head:["البند","المبلغ"], rows:rows };
    },
    stock: function(){
      var rows = [], tot = 0;
      live("items").forEach(function(i){
        variantsOf(i.id).forEach(function(v){
          var q = stockOfV(i.id,v.color,v.size); if(Math.abs(q) < 0.0001) return;
          var c = avgCostV(i.id,v.color,v.size), val = q*c; tot += val;
          rows.push({ v:val, h:"<tr><td class='wide'>" + thumbHTML(i.id) + esc(i.name) +
            (vLabel(v.color,v.size) ? " <span class='pill'>"+esc(vLabel(v.color,v.size))+"</span>" : "") + "</td>" +
            "<td class='num'>" + qty(q) + "</td><td class='num'>" + money(c) + "</td>" +
            "<td class='num' style='font-weight:600'>" + money(val) + "</td></tr>" });
        });
      });
      rows.sort(function(a,b){ return b.v - a.v; });
      var out = rows.map(function(x){ return x.h; });
      out.push(sumRow(["الإجمالي","","","<b>"+money(tot)+"</b>"]));
      return { note:"القيمة بمتوسط سعر الشراء واصل المخزن (شامل النقل). مش بسعر البيع.",
               head:["الصنف","الرصيد","متوسط التكلفة","القيمة"], rows:out };
    },
    cash: function(){
      var m = {};
      live("cash").forEach(function(c){
        var k = cashLabel(c.type) || c.type;
        if(!m[k]) m[k] = 0;
        var a = Number(c.amount)||0;
        if(isCapType(c.type)) m[k] += CAP[c.type].cash * a;
        else if(c.type==="opening_party") m[k] += 0;
        else if(c.type==="in" || c.type==="settle" || c.type==="opening") m[k] += a;
        else if(!(c.type === "expense" && c.paidBy)) m[k] -= a;           // v142: من جيب الشريك — الخزنة ما اتأثرتش
      });
      var rows = [];
      // المبيعات والمشتريات مش حركات خزنة، فبنحسبهم من مصدرهم
      rows.push("<tr><td class='wide'>تحصيل مباشر من العملاء</td><td class='num v-gain'>" +
        money(live("sales").reduce(function(a,s){
          if(viaShip(s)) return a;
          return a + (isCancelled(s) ? shipIn(s) : (Number(s.paid)||0)); },0)) + "</td></tr>");
      rows.push("<tr><td class='wide'>مدفوع للموردين ومصاريف النقل</td><td class='num v-due'>" +
        money(-live("purchases").reduce(function(a,x){
          return a + (Number(x.paid)||0) + pFreight(x); },0)) + "</td></tr>");
      Object.keys(m).forEach(function(k){
        if(Math.abs(m[k]) < 0.009) return;
        rows.push("<tr><td class='wide'>" + esc(k) + "</td><td class='num " +
          (m[k]>=0?"v-gain":"v-due") + "'>" + money(m[k]) + "</td></tr>");
      });
      rows.push(sumRow(["رصيد الخزنة","<b>"+money(cashBox())+"</b>"]));
      return { note:"الخزنة بتتأثر بكل حاجة: رأس المال، المشتريات، التحصيل المباشر، والاستلام من شركات الشحن.",
               head:["المصدر","المبلغ"], rows:rows };
    },
    wallet: function(){
      var rows = shipBuckets().map(function(co){
        var o = shipCoStats(co);
        return { v:o.bal, h:"<tr><td class='wide'>" + (squish(co) ? esc(co) :
            "<span class='v-due'>⚠ من غير اسم شركة</span>") + "</td>" +
          "<td class='num v-gain'>" + money(o.collected) + "</td>" +
          "<td class='num v-due'>" + money(o.fees) + "</td>" +
          "<td class='num'>" + money(o.drawn) + "</td>" +
          "<td class='num' style='font-weight:600'>" + money(o.bal) + "</td></tr>" };
      }).filter(function(x){ return Math.abs(x.v) > 0.009 || true; });
      var out = rows.map(function(x){ return x.h; });
      out.push(sumRow(["الإجمالي","","","<b>"+money(walletsTotal())+"</b>"]));
      return { note:"فلوس حصّلتها شركات الشحن من عملائك ولسه ما وصلتكش. تستلمها من شاشة «شركات الشحن».",
               head:["الشركة","حصّلت","عمولتها","استلمته","لك عندها"], rows:out };
    },
    recv: function(){
      var rows = [], t1=0, t2=0;
      live("parties").forEach(function(p){
        if(p.type !== "customer") return;
        var b = partyBalance(p.id); if(b <= 0.009) return;
        var vs = dueViaShip(p.id), mine = b - vs; t1 += Math.max(mine,0); t2 += vs;
        rows.push({ v:b, h:"<tr><td class='wide'>" + esc(p.name) +
          (p.phone ? " <span class='sub'>"+esc(p.phone)+"</span>" : "") + "</td>" +
          "<td class='num " + (mine>0.009?"v-due":"") + "'>" + money(Math.max(mine,0)) + "</td>" +
          "<td class='num'>" + (vs>0.009 ? money(vs) : "—") + "</td>" +
          "<td class='num' style='font-weight:600'>" + money(b) + "</td></tr>" });
      });
      rows.sort(function(a,b){ return b.v - a.v; });
      var out = rows.map(function(x){ return x.h; });
      out.push(sumRow(["الإجمالي","<b>"+money(t1)+"</b>","<b>"+money(t2)+"</b>",
                       "<b>"+money(t1+t2)+"</b>"]));
      return { note:"«تجريه إنت» هو اللي لازم تكلّم العميل عشانه. «مع شركة الشحن» الشركة هي اللي بتحصّله.",
               head:["العميل","تجريه إنت","مع شركة الشحن","الإجمالي"], rows:out };
    },
    pay: function(){
      var rows = [], tot = 0;
      live("parties").forEach(function(p){
        if(p.type !== "supplier") return;
        var b = partyBalance(p.id); if(b >= -0.009) return;
        tot += -b;
        rows.push({ v:-b, h:"<tr><td class='wide'>" + esc(p.name) + "</td>" +
          "<td class='num v-due' style='font-weight:600'>" + money(-b) + "</td></tr>" });
      });
      rows.sort(function(a,b){ return b.v - a.v; });
      var out = rows.map(function(x){ return x.h; });
      out.push(sumRow(["الإجمالي","<b>"+money(tot)+"</b>"]));
      return { note:"قيمة البضاعة اللي استلمتها وما دفعتهاش. مصاريف النقل مش عليهم — بتتدفع للناقل.",
               head:["المورد","المستحق له"], rows:out };
    },
    deliv: function(cur){ return ordersDetail(cur.deliv, "أوردرات اتسلّمت في الفترة دي."); },
    open:  function(cur){ return ordersDetail(cur.list.filter(isReserved),
      "أوردرات مشحونة أو محجوزة ولسه ما اتسلّمتش — بضاعتها محجوزة من المخزون."); },
    canc:  function(cur){ return ordersDetail(cur.list.filter(isCancelled),
      "أوردرات اتلغت. خسارتها هي مصاريف الشحن اللي دفعتها ومارجعتش."); }
  };

  function ordersDetail(list, note){
    var rows = list.slice().sort(byDate).map(function(s){
      var m = saleMoney(s);
      return "<tr><td class='wide'>" + oLink(s) + " · " + esc(partyName(s.partyId)) + "</td>" +
        "<td class='num'>" + esc(s.date||"—") + "</td>" +
        "<td class='wide'>" + esc(itemsLabel(s)) + "</td>" +
        "<td class='num'>" + money(m.goods) + "</td>" +
        "<td>" + (esc(squish(s.shipCo)) || "—") + "</td>" +
        "<td class='num " + (m.known ? (m.profit>=0?"v-gain":"v-due") : "") + "'>" +
          (m.known ? money(m.profit) : "—") + "</td></tr>";
    });
    return { note:note, head:["الأوردر","التاريخ","الأصناف","البضاعة","شركة الشحن","صافي الربح"],
             rows:rows };
  }

  var KPI_TITLE = { be:"فلوس لسه ما رجعتش", rev:"الإيرادات", cogs:"تكلفة البضاعة المباعة", gross:"مجمل ربح البضاعة",
    ship:"صافي الشحن", exp:"المصاريف", net:"صافي الربح", stock:"قيمة المخزون",
    cash:"رصيد الخزنة", wallet:"لك عند شركات الشحن", recv:"لك عند العملاء",
    pay:"عليك للموردين", deliv:"أوردرات مسلّمة", open:"أوردرات جارية", canc:"أوردرات ملغية" };

  function renderKpiDetail(){
    var pnl = document.getElementById("kpi-panel");
    if(!pnl) return;
    if(!kpiOpen || !KPI_DETAIL[kpiOpen]){ pnl.hidden = true; return; }
    var r = periodRange(), cur = periodStats(r);
    var d = KPI_DETAIL[kpiOpen](cur, r);
    pnl.hidden = false;
    var rr = periodRange();
    /* «فلوس لسه ما رجعتش» رقم تراكمي من البداية — مش تابع للفترة المختارة،
       فما ينفعش نكتب تحته تواريخ الفترة. */
    var CUMULATIVE = { be:1, stock:1, cash:1, wallet:1, recv:1, pay:1 };
    document.getElementById("kpi-title").textContent = KPI_TITLE[kpiOpen] +
      (CUMULATIVE[kpiOpen] ? " · تراكمي من البداية"
        : (rr ? " · من " + rr.from + " لـ " + rr.to : " · كل الفترات"));
    document.getElementById("kpi-note").textContent = d.note || "";
    table("t-kpi", d.head, d.rows, "مفيش حركات في الفترة دي.");
  }

  function table(el, head, rows, emptyMsg){
    var t = document.getElementById(el);
    if(!rows.length){
      t.innerHTML = '<tbody><tr><td class="empty">'+esc(emptyMsg)+'</td></tr></tbody>';
      return;
    }
    t.innerHTML = '<thead><tr>' + head.map(function(h){return '<th>'+esc(h)+'</th>';}).join("") +
      '</tr></thead><tbody>' + rows.join("") + '</tbody>';
    // على الموبايل كل خانة بتعرض اسم عمودها جنبها
    Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function(tr){
      Array.prototype.forEach.call(tr.children, function(td, i){
        if(head[i]) td.setAttribute("data-l", head[i]);
      });
    });
  }

  // مبيعات وربح صنف واحد من كل الأوردرات المسلّمة
  function itemStats(itemId, list){
    var q=0, rev=0, pr=0, ret=0;
    (list || live("sales")).forEach(function(s){
      if(!isDelivered(s)) return;
      SL(s).forEach(function(l){
        if(l.itemId !== itemId) return;
        var sold = lineSold(l,s);
        q += sold; rev += sold*(Number(l.price)||0);
        pr += ((Number(l.price)||0) - lineCost(l)) * sold;
        ret += lineRet(l);
      });
    });
    return { q:q, rev:rev, pr:pr, ret:ret };
  }

  /* نصيب كل شريك من ربح الفترة — في شاشة رأس المال (كان في الرئيسية لحد v105).
     للفرجة بس: مفيش حاجة بتتسجّل — التوزيع الفعلي من «وزّع أرباح» تحته. */
  var csPer = "all";
  function renderCapShare(){
    var box = document.getElementById("cap-share-panel");
    if(!box) return;
    var ps = partners();
    box.hidden = false;
    // بدل ما اللوحة تختفي خالص والمستخدم يدوّر عليها، بتفضل باينة وبتقول المطلوب
    if(!ps.length){
      document.getElementById("cs-note").innerHTML =
        "لسه مفيش شركاء مسجّلين. سجّلهم من تبويب <strong>العملاء والموردين</strong> بنوع «شريك»، " +
        "وبعدين سجّل رأس مال كل واحد من تبويب <strong>رأس المال</strong> — " +
        "وساعتها اللوحة دي هتوريك نصيب كل واحد من الربح لحظة بلحظة.";
      document.getElementById("cs-note").className = "hint";
      table("t-cap-share", ["الشريك"], [], "");
      return;
    }

    var r = csPer === "all" ? null : distPerRange(csPer);
    Array.prototype.forEach.call(document.querySelectorAll("#cs-per [data-csper]"), function(x){
      x.classList.toggle("on", x.dataset.csper === csPer);
      x.setAttribute("aria-pressed", x.dataset.csper === csPer ? "true" : "false");
    });
    // «كل الفترات» مالهاش حدود، فبنبدأ من أول حركة مسجّلة لحد النهاردة
    var from = r ? r.from : earliestDate();
    var to   = r ? r.to   : today();
    var net  = periodStats(r).net;
    var cap  = totalCapital();

    var note = document.getElementById("cs-note");
    if(!cap){
      note.innerHTML = "الشركاء مسجّلين بس مفيش رأس مال متسجّل ليهم. " +
        "سجّل رأس مال كل واحد من تبويب <strong>رأس المال</strong> عشان النسب تتحسب.";
      note.className = "hint";
      table("t-cap-share", ["الشريك"], [], "");
      return;
    }
    // اللي اتوزّع بالفعل من ربح الفترة دي — من غيره الرقم بيوهم إن كله لسه متاح
    var paidOut = live("cash").filter(function(c){
      return c.type === "cap_share" && inRange(c.date, r);
    }).reduce(function(a,c){ return a + (Number(c.amount)||0); }, 0);
    var left = net - paidOut;
    // أيام الفترة اللي كان فيها رأس مال — اللي قبل أول فلوس دخلت مش محسوبة (v168)
    var fc = ps.map(function(x){ return capStartOf(x.id); }).filter(Boolean).sort()[0];
    var capFrom = fc && fc > from ? fc : from;
    var allDays = capFrom > to ? 0 : daysBetween(capFrom, to) + 1;

    note.innerHTML = "نصيب كل شريك من ربح الفترة، بنسبة مرجّحة بالزمن من " +
      esc(from) + " لـ" + esc(to) + ". " +
      (paidOut > 0.009
        ? "<strong>اتوزّع منه " + esc(money(paidOut)) + " بالفعل، فاضل " + esc(money(left)) + ".</strong> "
        : "") +
      "التوزيع الفعلي من «وزّع أرباح» تحت." +
      (ps.some(function(x){
          var d = capDaysIn(x.id, from, to);
          return d !== null && d < allDays;
        })
        ? "<br><strong>ليه شريكين بنفس المبلغ ليهم نسبتين مختلفتين؟</strong> " +
          "لأن النسبة بتتحسب بعدد أيام ما فلوسه شغّالة، مش بالمبلغ لوحده. " +
          "اللي دفع متأخّر فلوسه اشتغلت أيام أقل، فنصيبه أقل. التاريخ وعدد " +
          "الأيام مكتوبين جنب كل شريك."
        : "");
    note.className = paidOut > 0.009 ? "hint" : "hint";

    var rows = ps.map(function(x){
      var w = weightedRatio(x.id, from, to);
      return { p:x, w:w, share:net * w };
    });
    // فرق التقريب بيتسوّى على أكبر نصيب زي التوزيع الفعلي بالظبط
    var rounded = rows.map(function(x){ return Math.round(x.share*100)/100; });
    var diff = Math.round((net - rounded.reduce(function(a,b){ return a+b; },0))*100)/100;
    if(diff !== 0 && rounded.length){
      var big = 0;
      rounded.forEach(function(v,i){ if(Math.abs(v) > Math.abs(rounded[big])) big = i; });
      rounded[big] = Math.round((rounded[big]+diff)*100)/100;
    }

    var body = rows.map(function(x, i){
      var cur = currentOf(x.p.id), capi = capitalOf(x.p.id);
      var st = capStartOf(x.p.id), dz = capDaysIn(x.p.id, from, to);
      // الشريك اللي فلوسه ما كملتش الفترة: قول له من إمتى وكام يوم
      var when = (st && dz !== null && dz < allDays)
        ? " · من " + esc(st) + " (" + qty(dz) + " من " + qty(allDays) + " يوم)"
        : "";
      return "<tr><td class='wide'>" + esc(x.p.name) +
          "<span class='sub'>رأس ماله " + money(capi) + when + "</span></td>" +
        "<td class='num'>" + (x.w*100).toFixed(2) + "%</td>" +
        "<td class='num " + (rounded[i] >= 0 ? "v-gain" : "v-due") + "' style='font-weight:600'>" +
          money(rounded[i]) + "</td>" +
        "<td class='num" + (cur > 0.009 ? " v-gain" : "") + "'>" + money(cur) + "</td>" +
        "<td class='num'>" + money(capi + cur) + "</td></tr>";
    }).join("");
    body += "<tr style='background:var(--teal-soft)'><td style='font-weight:600'>الإجمالي</td>" +
      "<td class='num' style='font-weight:600'>" +
        (rows.reduce(function(a,x){ return a+x.w; },0)*100).toFixed(2) + "%</td>" +
      "<td class='num' style='font-weight:600'>" + money(net) + "</td>" +
      "<td class='num' style='font-weight:600'>" +
        money(ps.reduce(function(a,x){ return a + currentOf(x.id); },0)) + "</td>" +
      "<td class='num' style='font-weight:600'>" +
        money(ps.reduce(function(a,x){ return a + capitalOf(x.id) + currentOf(x.id); },0)) + "</td></tr>";

    if(paidOut > 0.009){
      body += "<tr><td class='wide' style='color:var(--ink-soft)'>اتوزّع منه بالفعل</td>" +
        "<td></td><td class='num v-due'>−" + money(paidOut) + "</td><td></td><td></td></tr>" +
        "<tr><td class='wide' style='font-weight:600'>الباقي غير موزّع</td>" +
        "<td></td><td class='num' style='font-weight:600'>" + money(left) + "</td>" +
        "<td></td><td></td></tr>";
    }

    var t = document.getElementById("t-cap-share");
    t.innerHTML = "<thead><tr>" +
      ["الشريك","نسبته المرجّحة","نصيبه من ربح الفترة","أرباح مستحقة له","إجمالي حقه"]
        .map(function(h){ return "<th>"+esc(h)+"</th>"; }).join("") +
      "</tr></thead><tbody>" + body + "</tbody>";
    Array.prototype.forEach.call(t.querySelectorAll("tbody tr"), function(tr){
      Array.prototype.forEach.call(tr.children, function(td, i){
        var H = ["الشريك","نسبته المرجّحة","نصيبه من ربح الفترة","أرباح مستحقة له","إجمالي حقه"];
        if(H[i]) td.setAttribute("data-l", H[i]);
      });
    });
  }

  // أقدم تاريخ مسجّل — بداية «كل الفترات»
  function earliestDate(){
    var min = "";
    ["sales","purchases","cash"].forEach(function(n){
      live(n).forEach(function(x){
        if(x.date && (!min || x.date < min)) min = x.date;
      });
    });
    return min || today();
  }

  function renderStock(){
    var rows = live("items").map(function(i){
      var st = stockOf(i.id), rsv = reservedOf(i.id), ac = avgCost(i.id);
      var st2 = itemStats(i.id);
      var rev = st2.rev, pr = st2.pr;
      return "<tr><td class='wide'>"+thumbHTML(i.id)+esc(i.name)+"</td><td class='num'>"+qty(st)+" "+esc(i.unit||"")+"</td>"+
        "<td class='num'>"+(rsv ? "<span class='pill due'>"+qty(rsv)+"</span>" : "—")+"</td>"+
        "<td class='num'>"+(function(){ var fs = freeSplit(i.id);
          return qty(fs.pos) + (fs.neg ? "<span class='sub v-due'>ناقص " + qty(fs.neg) + "</span>" : ""); })()+"</td>"+
        "<td class='num'>"+money(ac)+"</td><td class='num'>"+money(i.price)+"</td>"+
        "<td class='num'>"+money(rev)+"</td><td class='num "+(pr>=0?"v-gain":"v-due")+"'>"+money(pr)+"</td></tr>";
    });
    table("t-stock", ["الصنف","الرصيد","محجوز","متاح للبيع","متوسط التكلفة","سعر بيع القطعة","المبيعات المسلّمة","الربح"], rows,
      "مفيش أصناف لسه. ضيف أصنافك من تبويب الأصناف الأول.");
  }

  /* الأصناف اللي خلصت أو قرّبت تخلص — من صفوف المخزون نفسها وبنفس شروط فلاتره
     (isOut / isLow)، فلما تدوس عليها في الرئيسية تلاقي نفس الأصناف بالظبط.
     قبل v108 كانت بتعدّ «المتاح صفر» = خلصان، فالقطع المحجوزة لأوردرات ماشية
     كانت بتطلع «خلصت» في الرئيسية وفي المخزون مش لاقيها. */
  function lowStockList(){
    var out = [];
    invRows().forEach(function(x){
      var o = isOut(x), l = !o && isLow(x);
      if(!o && !l) return;
      out.push({ itemId:x.item.id, name:x.item.name, unit:x.item.unit||"", color:x.color, size:x.size,
                 free:x.stock - x.rsv, stock:x.stock, rsv:x.rsv, min:Number(x.item.min)||0, out:o });
    });
    return out;
  }
  function renderLowStock(){
    var rows = lowStockList().map(function(x){
      var lbl = vLabel(x.color, x.size), free = x.free, min = x.min;
      return "<tr><td class='wide'>"+esc(x.name)+
          (lbl ? " <span class='pill'>"+esc(lbl)+"</span>" : "")+"</td>"+
          "<td class='num "+(free<=0?"v-due":"")+"'>"+qty(free)+" "+esc(x.unit)+"</td>"+
          "<td class='num'>"+(min?qty(min):"—")+"</td>"+
          "<td>"+(x.out?"<span class='pill due'>خلصان</span>":"<span class='pill due'>قرب يخلص</span>")+"</td></tr>";
    });
    document.getElementById("low-panel").hidden = !rows.length;
    if(rows.length) table("t-low", ["الصنف","المتاح","حد التنبيه",""], rows, "");
  }

  // ---------- التقارير ----------
