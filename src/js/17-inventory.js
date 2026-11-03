  /* ---------- كروت المخزون: كل رقم بيتفتح ---------- */
  var invKpiOpen = null;
  var openInv = {};         // الأصناف المفتوح ألوانها ومقاساتها

  // اسم التركيبة زي ما بيتكتب في الجداول: «شبشب · بني · 38»
  function vRowName(x){
    var lbl = vLabel(x.color, x.size);
    return esc(x.item.name) + (lbl ? " · " + esc(lbl) : "");
  }
  // العمود اللي بيكشف تكلفة الشراء بيختفي عن اللي مالوش صلاحية
  function mCell(v){ return "<td class='num money-only'>" + money(v) + "</td>"; }

  var INV_TITLE = {
    units:"قطع في المخزن", value:"قيمة المخزون بالتكلفة", retail:"قيمتها لو اتباعت كلها",
    rsv:"محجوز لأوردرات جارية", bought:"قطع اتشترت", sold:"قطع اتباعت",
    pret:"قطع رجعت للمورد", ret:"قطع رجعت من العملاء",
    out:"خلص من المخزن", low:"قرب يخلص", held:"قطع عند شركات الشحن" };

  /* كل دالة بتاخد الأسطر اللي ظاهرة قدامك (بعد الفلتر) وبترجّع جدول.
     الفترة بتتقرا من periodRange زي باقي الشاشة. */
  var INV_DETAIL = {
    /* بضاعة معاينة رجعت لشركة الشحن. لسه في المخزون على الورق —
       فلازم تبان هنا وإلا الجرد اليدوي هيطلع ناقص وإنت مش عارف ليه. */
    held: function(){
      var rows = heldOpen().map(function(x){
        return "<tr><td class='num'>" + (x.s.no ? "#" + esc(x.s.no) : "—") + "</td>" +
          "<td class='num'>" + esc(x.s.date || "—") + "</td>" +
          "<td class='wide'>" + esc(heldWhat(x)) + "</td>" +
          "<td>" + esc(shipCoLabel(x.s.shipCo)) + "</td>" +
          "<td class='num'>" + qty(x.n) + "</td></tr>";
      });
      if(rows.length) rows.push(sumRow(["الإجمالي","","","","<b>"+qty(heldOpenQty())+"</b>"]));
      return { note:"العميل عاين ورفض، والبضاعة عند شركة الشحن لسه. محسوبة في المخزون لأنها ملكك — بس مش في مخزنك. سجّل استلامها من شاشة «شركات الشحن».",
        head:["الأوردر","التاريخ","الراجع","شركة الشحن","قطع"], rows:rows };
    },

    units: function(src){
      var rows = src.filter(function(x){ return Math.abs(x.stock) > 0.0001; })
        .sort(function(a,b){ return b.stock - a.stock; })
        .map(function(x){
          return "<tr><td class='wide'>" + vRowName(x) + "</td>" +
            "<td class='num" + (x.stock < 0 ? " v-due" : "") + "'>" + qty(x.stock) + "</td>" +
            "<td class='num'>" + (x.rsv ? qty(x.rsv) : "—") + "</td>" +
            "<td class='num'>" + qty(x.stock - x.rsv) + "</td>" + mCell(x.stock * x.cost) + "</tr>";
        });
      var t = src.reduce(function(a,x){ return a + x.stock; },0);
      var tr = src.reduce(function(a,x){ return a + x.rsv; },0);
      rows.push(sumRow(["الإجمالي", "<b>"+qty(t)+"</b>", qty(tr), qty(t-tr),
        "<b class='money-only'>"+money(src.reduce(function(a,x){ return a+x.stock*x.cost; },0))+"</b>"]));
      return { note:"كل لون ومقاس على حدة. «المتاح» = الرصيد ناقص المحجوز لأوردرات جارية. الرقم بالسالب معناه إنك بعت أكتر من اللي مسجّل شراؤه.",
        head:["الصنف · اللون · المقاس","الرصيد","محجوز","المتاح","قيمته"], rows:rows };
    },

    value: function(src){
      var rows = src.filter(function(x){ return Math.abs(x.stock * x.cost) > 0.009; })
        .sort(function(a,b){ return (b.stock*b.cost) - (a.stock*a.cost); })
        .map(function(x){
          return "<tr><td class='wide'>" + vRowName(x) + "</td>" +
            "<td class='num'>" + qty(x.stock) + "</td>" + mCell(x.cost) + mCell(x.stock * x.cost) + "</tr>";
        });
      rows.push(sumRow(["الإجمالي","",
        "<b class='money-only'>"+money(src.reduce(function(a,x){ return a+x.stock*x.cost; },0))+"</b>", ""]));
      return { note:"التكلفة هنا متوسط اللي اشتريت بيه اللون والمقاس ده. الرقم ده هو اللي بيدخل الميزانية.",
        head:["الصنف · اللون · المقاس","الرصيد","متوسط التكلفة","قيمته"], rows:rows };
    },

    retail: function(src){
      var rows = src.filter(function(x){ return x.stock > 0.0001; })
        .map(function(x){
          var pr = vPrice(x.item, x.color), rv = x.stock*pr, cv = x.stock*x.cost;
          return { v:rv, h:"<tr><td class='wide'>" + vRowName(x) + "</td>" +
            "<td class='num'>" + qty(x.stock) + "</td>" +
            "<td class='num'>" + money(pr) + "</td>" +
            "<td class='num' style='font-weight:600'>" + money(rv) + "</td>" +
            "<td class='num money-only " + (rv-cv >= 0 ? "v-gain" : "v-due") + "'>" + money(rv-cv) + "</td></tr>" };
        });
      rows.sort(function(a,b){ return b.v - a.v; });
      var out = rows.map(function(x){ return x.h; });
      var rv = src.reduce(function(a,x){ return a + Math.max(0,x.stock)*vPrice(x.item, x.color); },0);
      var cv = src.reduce(function(a,x){ return a + Math.max(0,x.stock)*x.cost; },0);
      out.push(sumRow(["الإجمالي","","","<b>"+money(rv)+"</b>",
        "<b class='money-only'>"+money(rv-cv)+"</b>"]));
      return { note:"لو بعت كل اللي في المخزن بسعر البيع المسجّل للصنف. ده مش إيراد متحقّق — ده سقف اللي في إيدك.",
        head:["الصنف · اللون · المقاس","الرصيد","سعر البيع","قيمته بالبيع","الربح لو اتباع"], rows:out };
    },

    /* المحجوز مش رقم مجرّد — الأهم تعرف أي أوردر ماسك بضاعتك */
    rsv: function(src){
      var keys = {}; src.forEach(function(x){ keys[x.key] = 1; });
      var rows = [], tot = 0;
      live("sales").filter(isReserved).sort(byDate).forEach(function(s){
        SL(s).forEach(function(l){
          var k = keyOf(l); if(!keys[k]) return;
          var n = Number(l.qty)||0; if(!n) return;
          tot += n;
          rows.push("<tr><td class='wide'>" + oLink(s) + " · " + esc(partyName(s.partyId)) + "</td>" +
            "<td class='num'>" + esc(s.date||"—") + "</td>" +
            "<td class='wide'>" + esc(itemName(l.itemId)) +
              (vLabel(vColor(l), vSize(l)) ? " · " + esc(vLabel(vColor(l), vSize(l))) : "") + "</td>" +
            "<td class='num'>" + qty(n) + "</td></tr>");
        });
      });
      if(rows.length) rows.push(sumRow(["الإجمالي","","", "<b>"+qty(tot)+"</b>"]));
      return { note:"البضاعة دي لسه في مخزنك بس محجوزة لأوردرات حالتها «جاري». اضغط على رقم الأوردر تفتحه.",
        head:["الأوردر","تاريخه","الصنف","محجوز"], rows:rows };
    },

    bought: function(src, r){
      var keys = {}; src.forEach(function(x){ keys[x.key] = 1; });
      var rows = [], tq = 0, tv = 0;
      live("purchases").filter(function(p){
        return keys[keyOf(p)] && inRange(p.date, r) && (Number(p.qty)||0) > 0;
      }).sort(byDate).forEach(function(p){
        var n = Number(p.qty)||0; tq += n; tv += purchTotal(p);
        rows.push("<tr><td class='num'>" + esc(p.date||"—") + "</td>" +
          "<td class='wide'>" + esc(p.partyId ? partyName(p.partyId) : (p.opening ? "رصيد افتتاحي" : "—")) + "</td>" +
          "<td class='wide'>" + esc(itemName(p.itemId)) +
            (vLabel(p.color, p.size) ? " · " + esc(vLabel(p.color, p.size)) : "") + "</td>" +
          "<td class='num'>" + qty(n) + "</td>" + mCell(Number(p.cost)||0) + mCell(purchTotal(p)) + "</tr>");
      });
      if(rows.length) rows.push(sumRow(["الإجمالي","","", "<b>"+qty(tq)+"</b>", "",
        "<b class='money-only'>"+money(tv)+"</b>"]));
      return { note:"فواتير الشراء اللي في الفترة المختارة. التكلفة واصلة المخزن — يعني مصاريف النقل داخلة فيها.",
        head:["التاريخ","المورد","الصنف","الكمية","تكلفة القطعة","الإجمالي"], rows:rows };
    },

    sold: function(src, r){
      var keys = {}; src.forEach(function(x){ keys[x.key] = 1; });
      var rows = [], tq = 0, tv = 0;
      live("sales").filter(function(x){ return isDelivered(x) && inRange(revDate(x), r); })
        .sort(byDate).forEach(function(s){
          SL(s).forEach(function(l){
            if(!keys[keyOf(l)]) return;
            var n = lineSold(l, s); if(!n) return;
            var pr = Number(l.price)||0; tq += n; tv += n*pr;
            rows.push("<tr><td class='wide'>" + oLink(s) + " · " + esc(partyName(s.partyId)) + "</td>" +
              "<td class='num'>" + esc(revDate(s)) + "</td>" +
              "<td class='wide'>" + esc(itemName(l.itemId)) +
                (vLabel(vColor(l), vSize(l)) ? " · " + esc(vLabel(vColor(l), vSize(l))) : "") + "</td>" +
              "<td class='num'>" + qty(n) + "</td>" +
              "<td class='num'>" + money(pr) + "</td>" +
              "<td class='num' style='font-weight:600'>" + money(n*pr) + "</td>" +
              "<td class='num money-only " + (pr - lineCost(l) >= 0 ? "v-gain" : "v-due") + "'>" +
                money((pr - lineCost(l)) * n) + "</td></tr>");
          });
        });
      if(rows.length) rows.push(sumRow(["الإجمالي","","", "<b>"+qty(tq)+"</b>", "",
        "<b>"+money(tv)+"</b>", ""]));
      return { note:"بتاريخ التسليم مش تاريخ الأوردر، والمرتجع مخصوم من الكمية.",
        head:["الأوردر","تاريخ التسليم","الصنف","الكمية","سعر البيع","الإجمالي","ربحه"], rows:rows };
    },

    pret: function(src, r){
      var keys = {}; src.forEach(function(x){ keys[x.key] = 1; });
      var rows = [], tq = 0;
      live("purchases").filter(function(p){
        return keys[keyOf(p)] && inRange(p.date, r) && (Number(p.qty)||0) < 0;
      }).sort(byDate).forEach(function(p){
        var n = -(Number(p.qty)||0); tq += n;
        rows.push("<tr><td class='num'>" + esc(p.date||"—") + "</td>" +
          "<td class='wide'>" + esc(p.partyId ? partyName(p.partyId) : "—") + "</td>" +
          "<td class='wide'>" + esc(itemName(p.itemId)) +
            (vLabel(p.color, p.size) ? " · " + esc(vLabel(p.color, p.size)) : "") + "</td>" +
          "<td class='num'>" + qty(n) + "</td>" + mCell(Math.abs(purchTotal(p))) + "</tr>");
      });
      if(rows.length) rows.push(sumRow(["الإجمالي","","", "<b>"+qty(tq)+"</b>", ""]));
      return { note:"البضاعة اللي رجّعتها لموردك. بتتسجّل كفاتورة شراء بكمية بالسالب، فبتقلّل الرصيد والدَّين مع بعض.",
        head:["التاريخ","المورد","الصنف","رجع","قيمته"], rows:rows };
    },

    ret: function(src, r){
      var keys = {}; src.forEach(function(x){ keys[x.key] = 1; });
      var rows = [], tq = 0, tv = 0;
      live("sales").filter(function(x){ return isDelivered(x) && inRange(revDate(x), r); })
        .sort(byDate).forEach(function(s){
          SL(s).forEach(function(l){
            if(!keys[keyOf(l)]) return;
            var n = lineRet(l); if(!n) return;
            var pr = Number(l.price)||0; tq += n; tv += n*pr;
            rows.push("<tr><td class='wide'>" + oLink(s) + " · " + esc(partyName(s.partyId)) + "</td>" +
              "<td class='num'>" + esc(revDate(s)) + "</td>" +
              "<td class='wide'>" + esc(itemName(l.itemId)) +
                (vLabel(vColor(l), vSize(l)) ? " · " + esc(vLabel(vColor(l), vSize(l))) : "") + "</td>" +
              "<td class='num'>" + qty(Number(l.qty)||0) + "</td>" +
              "<td class='num v-due'>" + qty(n) + "</td>" +
              "<td class='num'>" + money(n*pr) + "</td></tr>");
          });
        });
      if(rows.length) rows.push(sumRow(["الإجمالي","","","", "<b>"+qty(tq)+"</b>", "<b>"+money(tv)+"</b>"]));
      return { note:"القطع اللي العميل رجّعها بعد التسليم. رجعت المخزن تاني، وإيرادها وتكلفتها اتشالوا من الأوردر.",
        head:["الأوردر","التاريخ","الصنف","اتشحن","رجع","قيمة المرتجع"], rows:rows };
    },

    out: function(src){
      var rows = src.filter(function(x){ return x.stock <= 0; })
        .sort(function(a,b){ return b.sold - a.sold; })
        .map(function(x){
          return "<tr><td class='wide'>" + vRowName(x) + "</td>" +
            "<td class='num" + (x.stock < 0 ? " v-due" : "") + "'>" + qty(x.stock) + "</td>" +
            "<td class='num'>" + qty(x.sold) + "</td>" +
            "<td class='num'>" + qty(x.bought) + "</td>" + mCell(x.cost) + "</tr>";
        });
      return { note:"اللون والمقاس اللي رصيده صفر أو أقل. «اتباع» و«اتشترى» في الفترة المختارة — رتّبناهم بالأكتر مبيعًا عشان دول اللي تطلبهم الأول.",
        head:["الصنف · اللون · المقاس","الرصيد","اتباع","اتشترى","آخر متوسط تكلفة"], rows:rows };
    },

    low: function(src){
      var rows = src.filter(isLow)
        .sort(function(a,b){ return (a.stock - a.rsv) - (b.stock - b.rsv); })
        .map(function(x){
          var min = Number(x.item.min)||0;
          return "<tr><td class='wide'>" + vRowName(x) + "</td>" +
            "<td class='num v-due'>" + qty(x.stock - x.rsv) + "</td>" +
            "<td class='num'>" + (x.rsv ? qty(x.rsv) : "—") + "</td>" +
            "<td class='num'>" + (min > 0 ? qty(min) : "<span class='sub'>" + qty(LOW_DEFAULT) + " (افتراضي)</span>") + "</td>" +
            "<td class='num'>" + qty(x.sold) + "</td>" + mCell(x.cost) + "</tr>";
        });
      return { note:"المتاح وصل حد التنبيه أو أقل. تقدر تحدّد حد لكل صنف من شاشة الأصناف — من غيره بننبّهك عند " +
          qty(LOW_DEFAULT) + " قطعة أو أقل، وبس لو اتباع منه قبل كده.",
        head:["الصنف · اللون · المقاس","المتاح","محجوز","حد التنبيه","اتباع في الفترة","متوسط التكلفة"], rows:rows };
    }
  };

  function renderInvKpiDetail(src, filtered){
    var pnl = document.getElementById("inv-kpi-panel");
    if(!pnl) return;
    if(!invKpiOpen || !INV_DETAIL[invKpiOpen]){ pnl.hidden = true; return; }
    var r = periodRange();
    var d = INV_DETAIL[invKpiOpen](src, r);
    pnl.hidden = false;
    document.getElementById("inv-kpi-title").textContent = INV_TITLE[invKpiOpen] +
      (r ? " · من " + r.from + " لـ " + r.to : " · كل الفترات") +
      (filtered ? " · حسب الفلتر" : "");
    document.getElementById("inv-kpi-note").textContent = d.note || "";
    table("t-invkpi", d.head, d.rows, "مفيش حاجة هنا في الفترة دي.");
  }

  // "قرب يخلص": بحد التنبيه لو متحدد، وإلا بتنبيه افتراضي عند قطعتين أو أقل
  var LOW_DEFAULT = 2;
  /* «خلصان» = رصيده في المخزن صفر — نفس القاعدة في فلتر المخزون وعدّاده والرئيسية.
     صنف لسه ما اتحركش خالص (ما اشتريتهوش ولا اتطلب) مش «خلصان». */
  function isOut(x){ return x.stock <= 0 && !!stockIdx().vars[x.item.id]; }
  function isLow(x){
    var free = x.stock - x.rsv, min = Number(x.item.min)||0;
    if(x.stock <= 0) return false;
    // حد التنبيه اللي إنت حدّدته بنفسك بيشتغل دايماً
    if(min > 0) return free <= min;
    // من غير حد محدّد: مننبّهش على حاجة لسه ما اتباعت منها ولا قطعة.
    // لو اشتريت قطعتين بس، دي مش «قربت تخلص» — دي كمية صغيرة اشتريتها.
    return x.soldEver && free <= LOW_DEFAULT;
  }

  /* ---------- فلاتر المخزون ---------- */
  var ifilt = { item:"", color:"", size:"", only:"all", text:"" };
  var IF_LABEL = { item:"الصنف", color:"اللون", size:"المقاس", only:"اعرض", text:"بحث" };
  var IF_ID = { item:"inv-item", color:"inv-color", size:"inv-size", text:"inv-q" };
  var ONLY_LABEL = { instock:"فيه رصيد", out:"خلصان", low:"قرب يخلص", rsv:"محجوز" };

  function readInvFilters(){
    ["item","color","size","text"].forEach(function(k){
      var el = document.getElementById(IF_ID[k]);
      ifilt[k] = el ? squish(el.value) : "";
    });
  }
  // قوايم الألوان والمقاسات بتتبني من اللي موجود فعلاً في المخزون،
  // ولو اخترت صنف بتتقلّب على ألوانه ومقاساته هو بس
  function fillInvVarSelects(all){
    var cs = {}, zs = {};
    all.forEach(function(x){
      if(ifilt.item && x.item.id !== ifilt.item) return;
      if(x.color) cs[x.color] = 1;
      if(x.size)  zs[x.size]  = 1;
    });
    [["inv-color", Object.keys(cs).sort(), ifilt.color, "كل الألوان"],
     ["inv-size",  Object.keys(zs).sort(), ifilt.size,  "كل المقاسات"]].forEach(function(cfg){
      var el = document.getElementById(cfg[0]);
      if(!el) return;
      el.innerHTML = "<option value=''>" + esc(cfg[3]) + "</option>" +
        cfg[1].map(function(v){ return "<option value='"+esc(v)+"'>"+esc(v)+"</option>"; }).join("");
      el.value = cfg[1].indexOf(cfg[2]) >= 0 ? cfg[2] : "";
      if(el.value !== cfg[2]) ifilt[cfg[0] === "inv-color" ? "color" : "size"] = "";
      el.disabled = !cfg[1].length;
    });
  }
  function ifChipText(k){
    if(k === "item") return itemName(ifilt.item);
    if(k === "only") return ONLY_LABEL[ifilt.only] || ifilt.only;
    return ifilt[k];
  }
  /* ---------- المخزون: ٤ أرقام + كارت لكل صنف + جدول لون × مقاس ----------
     كل الأرقام من نفس صفوف invRows اللي الجدول الكامل مبني عليها،
     فمجموع الكروت = الجدول بالظبط. */
  function renderInvTop(src, units, value, retail, reserved, scope){
    var el = document.getElementById("inv-top");
    if(!el) return;
    var sc = scope ? "حسب الفلتر" : "";
    var held = heldOpenQty();
    var cells = [
      ["قطع في المخزن", qty(units), "", reserved ? "منهم " + qty(reserved) + " محجوزين لأوردرات" : (sc || "مفيش حاجة محجوزة"), 0],
      ["قيمتها بالتكلفة", money(value), "", sc || "اللي دفعته فيها", 1],
      ["لو اتباعت كلها", money(retail), "v-gain", "بسعر البيع", 0],
      ["عند شركات الشحن", qty(held) + " قطعة", held ? "v-due" : "", held ? "مرتجع لسه ما رجعش" : "كله في مخزنك", 0]
    ];
    el.innerHTML = cells.map(function(c){
      return "<div" + (c[4] ? " class='money-only'" : "") + "><span>" + esc(c[0]) + "</span>" +
        "<strong class='num " + c[2] + "'>" + esc(c[1]) + "</strong><small>" + esc(c[3]) + "</small></div>";
    }).join("");
  }
  // عدد الأصناف في كل زرار — بنفس شرط الفلتر بالظبط
  function renderInvQuickCounts(all){
    var test = {
      all: function(){ return true; },
      instock: function(x){ return x.stock > 0; },
      low: isLow,
      out: isOut,
      rsv: function(x){ return x.rsv > 0; }
    };
    Array.prototype.forEach.call(document.querySelectorAll("#inv-quick button[data-invonly]"), function(b){
      var k = b.dataset.invonly, f = test[k]; if(!f) return;
      var ids = {};
      all.forEach(function(x){ if(f(x)) ids[x.item.id] = 1; });
      if(!b.dataset.lbl) b.dataset.lbl = b.textContent.replace(/\s*\d+$/, "").trim();
      b.innerHTML = esc(b.dataset.lbl) + " <b>" + qty(Object.keys(ids).length) + "</b>";
    });
  }
  function invAxis(list, key, declared){
    var seen = {}, out = [];
    String(declared || "").split(/[،,]/).map(function(v){ return v.trim(); }).forEach(function(v){
      if(v && list.some(function(x){ return x[key] === v; }) && !seen[v]){ seen[v] = 1; out.push(v); }
    });
    list.forEach(function(x){ if(!seen[x[key]]){ seen[x[key]] = 1; out.push(x[key]); } });
    return out;
  }
  function renderInvCards(byItem){
    var box = document.getElementById("inv-cards");
    if(!box) return;
    if(!byItem.length){
      box.innerHTML = "<p class='cd-empty'>" + (live("items").length ? "مفيش حاجة بالمواصفات دي — جرّب تمسح الفلاتر."
        : "مفيش أصناف لسه — ضيف أصناف من «الأصناف» وسجّل شراءها.") + "</p>";
      return;
    }
    var heldBy = {};
    heldOpen().forEach(function(h){ heldBy[h.l.itemId] = (heldBy[h.l.itemId] || 0) + h.n; });
    var autoOpen = !!(ifilt.color || ifilt.size || ifilt.text || ifilt.only !== "all");
    box.innerHTML = byItem.map(function(g){
      var it = g.item, id = it.id;
      var stock = 0, rsv = 0, val = 0;
      g.vars.forEach(function(x){ stock += x.stock; rsv += x.rsv; val += x.stock * x.cost; });
      var lowN = g.vars.filter(isLow).length;
      var outN = g.vars.filter(function(x){ return x.stock <= 0 && (x.bought || x.soldEver); }).length;
      var colors = invAxis(g.vars, "color", it.colors), sizes = invAxis(g.vars, "size", it.sizes);
      var cN = colors.filter(Boolean).length, zN = sizes.filter(Boolean).length;
      var open = autoOpen || !!openInv[id];
      var held = heldBy[id] || 0;
      var sub = (cN ? plural(cN, "لون واحد", "لونين", "ألوان") : "من غير لون") + " · " +
                (zN ? plural(zN, "مقاس واحد", "مقاسين", "مقاسات") : "من غير مقاس") +
                ((Number(it.price)||0) ? " · سعره " + qty(Number(it.price)) : "");
      var head = "<button type='button' class='iv-h' data-invcard='" + esc(id) + "' aria-expanded='" + (open ? "true" : "false") + "'>" +
        (thumbHTML(id) || "<span class='dd-noimg' aria-hidden='true'>" + esc(String(it.name || "").charAt(0)) + "</span>") +
        "<span class='iv-n'><b>" + esc(it.name) + "</b>" +
          (lowN ? "<span class='iv-pill w'>" + qty(lowN) + " قرب يخلص</span>" : "") +
          (outN ? "<span class='iv-pill r'>" + qty(outN) + " خلص</span>" : "") +
          "<span class='sub'>" + esc(sub) + "</span></span>" +
        "<span class='iv-cs'>" +
          "<span><small>متاح</small><b class='num'>" + qty(stock - rsv) + "</b></span>" +
          "<span><small>محجوز</small><b class='num" + (rsv ? " w" : "") + "'>" + (rsv ? qty(rsv) : "—") + "</b></span>" +
          "<span><small>عند الشركات</small><b class='num" + (held ? " r" : "") + "'>" + (held ? qty(held) : "—") + "</b></span>" +
          "<span class='money-only'><small>قيمته</small><b class='num'>" + esc(qty(Math.round(val * 100) / 100)) + "</b></span>" +
        "</span><span class='iv-chev' aria-hidden='true'>" + (open ? "▴" : "▾") + "</span></button>";
      if(!open) return "<div class='iv'>" + head + "</div>";
      var cell = {};
      g.vars.forEach(function(x){ cell[x.color + "|" + x.size] = x; });
      var mx = "<table class='iv-mx'><thead><tr><th></th>" + sizes.map(function(z){
          return "<th>" + esc(z || "—") + "</th>"; }).join("") + "</tr></thead><tbody>" +
        colors.map(function(c){
          return "<tr><th class='rh'>" + esc(c || "—") + "</th>" + sizes.map(function(z){
            var x = cell[c + "|" + z];
            if(!x || (!x.bought && !x.stock && !x.soldEver && !x.rsv)) return "<td class='none'>—</td>";
            var free = x.stock - x.rsv;
            var cls = x.stock <= 0 ? "out" : (isLow(x) ? "low" : "ok");
            return "<td class='" + cls + "'><button type='button' data-move='" + esc(x.key) + "' title='حركة " + esc(vLabel(c, z) || it.name) + "'>" +
              "<b class='num'>" + qty(free) + "</b>" +
              (x.rsv ? "<small>+" + qty(x.rsv) + " محجوز</small>" : (cls === "low" && Number(it.min) ? "<small>حد التنبيه " + qty(Number(it.min)) + "</small>" : "")) +
              "</button></td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody></table>";
      return "<div class='iv open'>" + head + "<div class='iv-b'>" +
        "<h4>المتاح بكل لون ومقاس <small>دوس على أي خانة تشوف حركتها</small></h4>" +
        "<div class='iv-wrap'>" + mx + "</div>" +
        "<div class='iv-lg'><span><i class='ok'></i>فيه</span><span><i class='low'></i>قرب يخلص</span>" +
          "<span><i class='out'></i>خلص</span><span><i class='none'></i>ما اشتريتوش</span></div>" +
        "</div></div>";
    }).join("");
  }
  document.getElementById("inv-cards").addEventListener("click", function(e){
    var h = e.target.closest("[data-invcard]"); if(!h) return;
    var id = h.dataset.invcard;
    if(openInv[id]) delete openInv[id]; else openInv[id] = 1;
    renderInventory();
  });

  function renderInvChips(){
    var keys = Object.keys(IF_LABEL).filter(function(k){
      return k === "only" ? ifilt.only !== "all" : !!ifilt[k]; });
    var c = document.getElementById("inv-count");
    // «اعرض» ليه أزرار ظاهرة فوق، فمش بنعدّه في عدّاد الفلاتر المخفية
    var hidden = keys.filter(function(k){ return k !== "only"; }).length;
    if(c){ c.textContent = hidden; c.hidden = !hidden; }
    var box = document.getElementById("inv-chips");
    if(!box) return;
    box.innerHTML = !keys.length ? "" :
      keys.map(function(k){
        return "<span class='chip'>" + esc(IF_LABEL[k]) + ": <b>" + esc(ifChipText(k)) + "</b>" +
          "<button type='button' data-rmif='" + k + "' aria-label='شيل فلتر " + esc(IF_LABEL[k]) + "'>&times;</button></span>";
      }).join("") + "<button class='clearall' type='button' id='b-clear-inv'>مسح الكل</button>";
    Array.prototype.forEach.call(document.querySelectorAll("#inv-quick button"), function(b){
      b.classList.toggle("on", b.dataset.invonly === ifilt.only);
    });
  }

  function renderInventory(){
    var all = invRows();
    readInvFilters();
    fillInvVarSelects(all);
    var q = ifilt.text.toLowerCase();
    var list = all.filter(function(x){
      if(ifilt.item && x.item.id !== ifilt.item) return false;
      if(ifilt.color && x.color !== ifilt.color) return false;
      if(ifilt.size  && x.size  !== ifilt.size)  return false;
      if(ifilt.only === "instock" && x.stock <= 0) return false;
      if(ifilt.only === "out" && !isOut(x)) return false;
      if(ifilt.only === "low" && !isLow(x)) return false;
      if(ifilt.only === "rsv" && !(x.rsv > 0)) return false;
      if(q){
        var hay = [x.item.name, x.color, x.size,
                   vCode(x.item.id, x.color, x.size)].join(" ").toLowerCase();
        if(hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    renderInvChips();
    var fItem = ifilt.item, only = ifilt.only;
    var filtered = !!fItem || !!ifilt.color || !!ifilt.size || !!ifilt.text || only !== "all";

    // الكروت بتتحسب على اللي ظاهر قدامك — لو في فلتر، بيتقال كده صراحة
    var src      = filtered ? list : all;
    var scope    = filtered ? "<span class='sub'>حسب الفلتر</span>" : "";
    var units    = src.reduce(function(a,x){ return a + x.stock; },0);
    var value    = src.reduce(function(a,x){ return a + x.stock * x.cost; },0);
    var retail   = src.reduce(function(a,x){ return a + x.stock * vPrice(x.item, x.color); },0);
    var reserved = src.reduce(function(a,x){ return a + x.rsv; },0);
    var bought   = src.reduce(function(a,x){ return a + x.bought; },0);
    var sold     = src.reduce(function(a,x){ return a + x.sold; },0);
    var rets     = src.reduce(function(a,x){ return a + x.ret; },0);
    var prets    = src.reduce(function(a,x){ return a + (x.pret||0); },0);
    var outCount = src.filter(function(x){ return x.stock <= 0; }).length;
    var lowCount = src.filter(isLow).length;

    /* كل كارت ليه مفتاح بيفتح جدول تفاصيله من INV_DETAIL — نفس فكرة
       كروت لوحة المتابعة. والكروت اللي بتكشف التكلفة بتختفي عن اللي
       مالوش صلاحية «يشوف الأرباح والتكاليف». */
    var cells = [
      ["units",  "قطع في المخزن", qty(units), "", scope || "<span class='sub'>تراكمي</span>"],
      ["value",  "قيمة المخزون بالتكلفة", money(value), "", scope || "<span class='sub'>تراكمي</span>", 1],
      ["retail", "قيمتها لو اتباعت كلها", money(retail), "v-gain", "<span class='sub'>بسعر البيع</span>"],
      ["rsv",    "محجوز لأوردرات جارية", qty(reserved), reserved?"v-due":"", scope],
      ["bought", "قطع اتشترت", qty(bought), "", "<span class='sub'>في الفترة</span>"],
      ["sold",   "قطع اتباعت", qty(sold), "v-gain", "<span class='sub'>في الفترة</span>"],
      ["pret",   "قطع رجعت للمورد", qty(prets), prets?"v-due":"", "<span class='sub'>في الفترة</span>"],
      ["ret",    "قطع رجعت من العملاء", qty(rets), rets?"v-due":"", "<span class='sub'>في الفترة</span>"],
      ["out",    "خلص من المخزن", qty(outCount), outCount?"v-due":"", scope || "<span class='sub'>لون/مقاس رصيده صفر</span>"],
      ["low",    "قرب يخلص", qty(lowCount), lowCount?"v-due":"", scope || "<span class='sub'>محتاج تطلبه</span>"],
      ["held",   "قطع عند شركات الشحن", qty(heldOpenQty()), heldOpenQty()?"v-due":"",
       "<span class='sub'>" + (heldOpenQty() ? "محسوبة فوق بس مش في مخزنك" : "كله في مخزنك") + "</span>"]
    ];
    document.getElementById("inv-kpis").innerHTML = cells.map(function(c){
      return '<div class="kpi' + (invKpiOpen === c[0] ? ' on' : '') +
        (c[5] ? ' money-only' : '') + '" data-invkpi="' + c[0] + '"' +
        ' tabindex="0" role="button"><span>'+c[1]+'</span>' +
        '<strong class="num '+c[3]+'">'+esc(c[2])+'</strong>'+(c[4]||'') +
        '<span class="kpi-go" aria-hidden="true">التفاصيل ›</span></div>';
    }).join("");
    renderInvKpiDetail(src, filtered);

    /* الجدول: صنف في سطر واحد بيتفتح على ألوانه ومقاساته.
       صنف بـ١٠ ألوان ومقاسات كان ١٠ أسطر، وتلات أصناف = ٣٠ سطر
       وشاشة مالهاش آخر. الرصيد اللي بتدوّر عليه بيبقى في السطر،
       والتفصيل بضغطة. */
    var byItem = [], seenIt = {};
    list.forEach(function(x){
      var id = x.item.id;
      if(!seenIt[id]){ seenIt[id] = { item:x.item, vars:[] }; byItem.push(seenIt[id]); }
      seenIt[id].vars.push(x);
    });
    var sum = function(g, f){ return g.vars.reduce(function(a,x){ return a + (x[f]||0); }, 0); };
    var val = function(g){ return g.vars.reduce(function(a,x){ return a + x.stock * x.cost; }, 0); };
    byItem.sort(function(a,b){ return (sum(b,"sold") - sum(a,"sold")) || (sum(b,"stock") - sum(a,"stock")); });

    renderInvTop(src, units, value, retail, reserved, scope);
    renderInvQuickCounts(all);
    renderInvCards(byItem);

    /* فلتر على لون أو مقاس أو بحث معناه إنك بتدوّر على تركيبة —
       فبنفتح الأصناف المطابقة لوحدها بدل ما تدوس عليهم واحد واحد */
    var autoOpen = !!(ifilt.color || ifilt.size || ifilt.text || ifilt.only !== "all");

    var rows = [];
    byItem.forEach(function(g){
      var stock = sum(g,"stock"), rsv = sum(g,"rsv"), free = stock - rsv;
      var isOpen = autoOpen || !!openInv[g.item.id];
      var nv = g.vars.length;
      var lowN = g.vars.filter(isLow).length;
      var outN = g.vars.filter(function(x){ return x.stock <= 0; }).length;
      var tags = (lowN ? " <span class='pill due'>" + qty(lowN) + " قرب يخلص</span>" : "") +
                 (outN ? " <span class='pill due'>" + qty(outN) + " خلصان</span>" : "");
      rows.push("<tr class='itemrow" + (isOpen ? " open" : "") +
        "' data-invrow='" + esc(g.item.id) + "' tabindex='0'>" +
        "<td class='wide'>" + thumbHTML(g.item.id) + esc(g.item.name) +
          "<span class='sub'>" + qty(nv) + " لون ومقاس" + tags + "</span></td>" +
        "<td class='num'>" + qty(sum(g,"bought")) + "</td>" +
        "<td class='num " + (sum(g,"pret")?"v-due":"") + "'>" + (sum(g,"pret")?qty(sum(g,"pret")):"—") + "</td>" +
        "<td class='num'>" + qty(sum(g,"sold")) + "</td>" +
        "<td class='num " + (sum(g,"ret")?"v-due":"") + "'>" + (sum(g,"ret")?qty(sum(g,"ret")):"—") + "</td>" +
        "<td class='num " + (sum(g,"canc")?"v-due":"") + "'>" + (sum(g,"canc")?qty(sum(g,"canc")):"—") + "</td>" +
        "<td class='num " + (stock<=0?"v-due":"") + "'>" + qty(stock) + "</td>" +
        "<td class='num'>" + (rsv ? "<span class='pill due'>"+qty(rsv)+"</span>" : "—") + "</td>" +
        "<td class='num'>" + qty(free) + "</td>" +
        "<td class='num money-only'>—</td>" +
        "<td class='num money-only'>" + money(val(g)) + "<span class='chev' aria-hidden='true'>▾</span></td></tr>");

      if(!isOpen) return;
      g.vars.sort(function(a,b){ return (b.sold - a.sold) || (b.stock - a.stock); }).forEach(function(x){
        var f = x.stock - x.rsv, lbl = vLabel(x.color, x.size);
        rows.push("<tr class='varrow'><td class='wide'>" +
            "<button class='del' style='color:var(--teal)' data-move='"+esc(x.key)+"'>"+
            (lbl ? esc(lbl) : "من غير لون ولا مقاس")+"</button></td>"+
          "<td class='num'>"+qty(x.bought)+"</td>"+
          "<td class='num "+(x.pret?"v-due":"")+"'>"+(x.pret?qty(x.pret):"—")+"</td>"+
          "<td class='num'>"+qty(x.sold)+"</td>"+
          "<td class='num "+(x.ret?"v-due":"")+"'>"+(x.ret?qty(x.ret):"—")+"</td>"+
          "<td class='num "+(x.canc?"v-due":"")+"'>"+(x.canc?qty(x.canc):"—")+"</td>"+
          "<td class='num "+(x.stock<=0?"v-due":"")+"'>"+qty(x.stock)+"</td>"+
          "<td class='num'>"+(x.rsv?"<span class='pill due'>"+qty(x.rsv)+"</span>":"—")+"</td>"+
          "<td class='num'>"+qty(f)+"</td>"+
          "<td class='num money-only'>"+money(x.cost)+"</td>"+
          "<td class='num money-only'>"+money(x.stock*x.cost)+"</td></tr>");
      });
    });
    Object.keys(openInv).forEach(function(id){
      if(!seenIt[id]) delete openInv[id];
    });
    var emptyMsg = "مفيش أصناف لسه.";
    if(all.length){
      emptyMsg = only === "low"
        ? "مفيش حاجة قربت تخلص. لو حدّدت «حد التنبيه» للصنف، بينبّهك عنده. ومن غير حد، بينبّهك عند " + qty(LOW_DEFAULT) + " قطعة أو أقل — بس بعد ما يكون اتباع منه فعلاً."
        : only === "out" ? "مفيش حاجة خلصانة — كله لسه فيه رصيد."
        : only === "instock" ? "مفيش لون أو مقاس فيه رصيد بالمواصفات دي."
        : "مفيش حاجة بالمواصفات دي — جرّب تمسح الفلاتر.";
    }
    table("t-inv", ["الصنف / اللون · المقاس","اتشترى","رجع للمورد","اتباع","رجع من عميل","ملغي","الرصيد","محجوز","متاح","متوسط التكلفة","قيمته"],
      rows, emptyMsg);
    // آخر عمودين بيكشفوا التكلفة
    Array.prototype.forEach.call(
      document.querySelectorAll("#t-inv thead th:nth-last-child(-n+2)"), function(th){
        th.classList.add("money-only"); });

    renderMovement();
  }

  // حركة تركيبة واحدة بالتفصيل
  function renderMovement(){
    var panel = document.getElementById("move-panel");
    if(!moveFor){ panel.hidden = true; return; }
    var parts = moveFor.split("|");
    var it = db.items.find(function(x){ return x.id===parts[0]; });
    if(!it){ panel.hidden = true; moveFor = null; return; }
    panel.hidden = false;
    var lbl = vLabel(parts[1], parts[2]);
    document.getElementById("move-title").textContent =
      "حركة: " + it.name + (lbl ? " · " + lbl : "");

    var L = [];
    live("purchases").forEach(function(p){
      if(keyOf(p)!==moveFor) return;
      var xl = p.xchg ? "استبدال" + (p.pno ? " #" + p.pno : "") : "";
      L.push({d:p.date, at:p.at, t: xl || (isPRet(p) ? "مرتجع للمورد" : "شراء"), who:partyName(p.partyId),
        note: xl ? (isPRet(p) ? "رجع للمورد" : "دخل بـ" + money(p.cost)) : "بسعر "+money(p.cost),
        inn:Number(p.qty)||0, out:0});
    });
    live("sales").forEach(function(x){
      var st = stOf(x);
      SL(x).forEach(function(l){
        if(keyOf(l) !== moveFor) return;
        var tag = x.no ? "أوردر #"+x.no+" · " : "";
        if(isDelivered(x)){
          L.push({d:x.date, at:x.at, t:"بيع", who:partyName(x.partyId),
            note:tag + (lineRet(l) ? "مشحون "+qty(l.qty)+" ومرتجع "+qty(lineRet(l)) : "بسعر "+money(l.price)),
            inn:0, out:lineSold(l,x)});
        } else {
          L.push({d:x.date, at:x.at, t:saleStateTxt(x), who:partyName(x.partyId),
            note:tag + (st==="progress" ? "محجوز "+qty(l.qty) : "ما أثّرش على الرصيد"),
            inn:0, out:0, ghost:true});
        }
      });
    });
    L.sort(function(a,b){ return a.d !== b.d ? (a.d < b.d ? -1 : 1) : (a.at||0)-(b.at||0); });

    var run = 0;
    var rows = L.map(function(x){
      run += x.inn - x.out;
      return "<tr"+(x.ghost?" style='opacity:.6'":"")+">"+
        "<td class='num'>"+esc(x.d)+"</td>"+
        "<td>"+esc(x.t)+"</td>"+
        "<td class='wide'>"+esc(x.who)+"<span class='sub'>"+esc(x.note)+"</span></td>"+
        "<td class='num "+(x.inn?"v-gain":"")+"'>"+(x.inn?qty(x.inn):"—")+"</td>"+
        "<td class='num "+(x.out?"v-due":"")+"'>"+(x.out?qty(x.out):"—")+"</td>"+
        "<td class='num "+(run<0?"v-due":"")+"'>"+qty(run)+"</td></tr>";
    });
    table("t-move", ["التاريخ","الحركة","الجهة","داخل","خارج","الرصيد بعدها"], rows,
      "مفيش حركة على اللون والمقاس ده.");
  }

  function renderShipping(){
    var map = {};
    salesIn(periodRange()).forEach(function(s){
      var co = (s.shipCo||"").trim() || "بدون شركة";
      if(!map[co]) map[co] = { n:0, d:0, c:0, out:0, inn:0 };
      var m = map[co];
      m.n++;
      if(isDelivered(s)) m.d++;
      if(isCancelled(s)) m.c++;
      if(shipCounts(s)){ m.out += shipOut(s); m.inn += shipIn(s); }
    });
    var rows = Object.keys(map).map(function(co){
      var m = map[co];
      var rate = m.n ? (m.c/m.n*100) : 0;
      var avg  = m.d ? m.out/(m.d+m.c) : 0;
      var wal  = walletOf(co);
      return "<tr><td class='wide'>"+esc(co)+"</td><td class='num'>"+qty(m.n)+"</td>"+
        "<td class='num'>"+qty(m.d)+"</td>"+
        "<td class='num "+(m.c?"v-due":"")+"'>"+qty(m.c)+"</td>"+
        "<td class='num "+(rate>15?"v-due":"")+"'>"+rate.toFixed(0)+"%</td>"+
        "<td class='num'>"+money(m.out)+"</td>"+
        "<td class='num'>"+money(avg)+"</td>"+
        "<td class='num "+((m.inn-m.out)>=0?"v-gain":"v-due")+"'>"+money(m.inn-m.out)+"</td>"+
        "<td class='num "+(wal>0.009?"v-gain":"")+"'>"+money(wal)+"</td></tr>";
    });
    table("t-ship", ["شركة الشحن","أوردرات","مسلّم","ملغي","نسبة الإلغاء","شحن مدفوع","متوسط للأوردر","صافي الشحن","لك في محفظتها"],
      rows, "لما تسجّل شركة الشحن في الأوردرات، هتشوف هنا مين أوفر ومين بيجيب إلغاءات.");
  }

  function renderBalances(){
    var recv=[], pay=[];
    live("parties").forEach(function(p){
      var b = partyBalance(p.id);
      if(p.type==="customer" && b > 0.009){
        var viaS = dueViaShip(p.id), mine = b - viaS;
        recv.push("<tr><td class='wide'>"+esc(p.name)+"</td>"+
          "<td class='num "+(mine>0.009?"v-due":"")+"'>"+money(Math.max(mine,0))+"</td>"+
          "<td class='num'>"+(viaS>0.009?money(viaS):"—")+"</td>"+
          "<td class='num'>"+money(b)+"</td></tr>");
      }
      if(p.type==="supplier" && b < -0.009)
        pay.push("<tr><td class='wide'>"+esc(p.name)+"</td><td class='num v-due'>"+money(-b)+"</td></tr>");
    });
    table("t-recv", ["العميل","تجريه إنت","مع شركة الشحن","الإجمالي"], recv,
      "مفيش عميل عليه فلوس دلوقتي.");
    table("t-pay", ["المورد","المستحق له"], pay, "مفيش مورد ليه فلوس عندك دلوقتي.");
  }

  // ---------- الفلاتر ----------
  var filt = { status:"", party:"", item:"", ship:"", owner:"", from:"", to:"", text:"" };

  function readFilters(){
    filt.status = document.getElementById("flt-status").value;
    filt.party  = document.getElementById("flt-party").value;
    filt.item   = document.getElementById("flt-item").value;
    filt.ship   = document.getElementById("flt-ship").value;
    filt.owner  = document.getElementById("flt-owner").value;
    filt.from   = document.getElementById("flt-from").value;
    filt.to     = document.getElementById("flt-to").value;
    filt.text   = document.getElementById("flt-text").value.trim().toLowerCase();
  }

  // كل الفلاتر ما عدا الحالة — عشان عدّاد كل شريط يبان على نفس النطاق
  function filteredSales(skipStatus){
    return live("sales").filter(function(s){
      if(!skipStatus && filt.status && !stabMatch(s, filt.status)) return false;
      if(filt.party && s.partyId !== filt.party) return false;
      if(filt.item && !SL(s).some(function(l){ return l.itemId === filt.item; })) return false;
      if(filt.ship && (s.shipCo||"").trim() !== filt.ship) return false;
      if(filt.owner && (s.owner||"").trim() !== filt.owner) return false;
      if(filt.from && (s.date||"") < filt.from) return false;
      if(filt.to && (s.date||"") > filt.to) return false;
      if(filt.text){
        var p = db.parties.find(function(x){ return x.id===s.partyId; }) || {};
        // أكواد التركيبات والتاريخ كانوا في واجهة البحث المنفصلة — بقوا هنا
        var codes = SL(s).map(function(l){
          return vCode(l.itemId, vColor(l), vSize(l)); }).join(" ");
        var hay = [partyName(s.partyId), itemsLabel(s), s.note, s.shipCo, s.shipCode,
                   (s.no ? "#"+s.no+" "+s.no : ""), s.owner, codes, s.date,
                   p.phone, p.gov, p.address, p.fb].join(" ").toLowerCase();
        if(hay.indexOf(filt.text) < 0) return false;
      }
      return true;
    });
  }

