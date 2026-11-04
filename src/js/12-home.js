  /* ================= الرئيسية =================
     سؤال واحد: «إيه اللي مستنيني النهارده؟» — وتحته الأرقام الأساسية.
     مفيش ولا رقم هنا بيتحسب لوحده: كله من نفس الدوال اللي بتحسب
     المبيعات والخزنة والمخزون واللوحة التفصيلية (stageLists · shipPend ·
     heldOpen · lowStockList · partyBalance · periodStats · cashBox ·
     stockBookValue · walletsTotal · cashBe*) — فالرقم هنا = الرقم هناك. */
  function renderHome(){
    var now = new Date(), h = now.getHours();
    var hi = document.getElementById("hm-hi");
    if(hi) hi.textContent = (h < 12 ? "صباح الخير" : "مساء الخير") + (squish(me) ? " يا " + squish(me) : "");
    var dt = document.getElementById("hm-date");
    if(dt){ try{ dt.textContent = now.toLocaleDateString("ar-EG-u-nu-latn", { weekday:"long", day:"numeric", month:"long" }); }
            catch(e){ dt.textContent = today(); } }

    /* ---- محتاج منك النهارده ---- */
    var L = [];
    var line = function(o){ L.push(o); };
    if(canTab("sales")){
      var g = stageLists();
      var ncf = g.st[1].filter(cfPending).length, n1 = g.st[1].length;
      // v176: «أكّد» و«اشحن» سطر واحد — نفس المرحلة ونفس الشاشة
      if(n1)
        line({ grp:"orders", cls: ncf ? "warn" : "", t: n1 === 1 ? "أوردر جديد مستني يتشحن" : qty(n1) + " أوردرات جديدة مستنية تتشحن",
               s:(ncf ? qty(ncf) + " لسه ما اتأكدش — كلّم العميل قبل الشحن · " : "") + "اكتب الشركة والكود", v:qty(n1), go:"sales|1", btn: ncf ? "أكّد واشحن" : "اشحنهم" });
      if(g.st[2].length){
        var stale = g.st[2].filter(function(x){ return daysSince(x.date) >= SG_STALE; }).length;
        line({ grp:"orders", ic:"truck", cls: stale ? "bad" : "", t:"أوردرات مع المندوب",
               s: stale ? qty(stale) + " بقالهم " + SG_STALE + " أيام أو أكتر — كلّم الشركة" : "مستني العميل يستلم",
               red: !!stale, v:qty(g.st[2].length), go:"sales|2" });
      }
      var byCo = {};
      g.st[3].forEach(function(x){ var c = squish(x.shipCo); (byCo[c] = byCo[c] || []).push(x); });
      Object.keys(byCo).forEach(function(c){
        var sum = byCo[c].reduce(function(a, x){ return a + shipPend(x).left; }, 0);
        line({ grp:"money", ic:"cash", cls:"money", t:"فلوسك عند " + (c || "شركة من غير اسم"),
               s:"من " + qty(byCo[c].length) + " أوردر — استلمها", v:money(sum), go:"sales|3" });
      });
      if(g.direct.length){
        var due = g.direct.reduce(function(a, x){ return a + Math.max(0, sDue(x)); }, 0);
        if(due > 0.009)
          line({ grp:"money", ic:"hand", cls:"money", t:"لك عند عملاء (تحصيل مباشر)",
                 s:qty(g.direct.length) + " أوردر", v:money(due), go:"sales|3" });
      }
      var held = {};
      heldOpen().forEach(function(x){ var c = squish(x.s.shipCo); (held[c] = held[c] || []).push(x); });
      Object.keys(held).forEach(function(c){
        var n = held[c].reduce(function(a, x){ return a + x.n; }, 0);
        var names = held[c].map(function(x){ return itemName(x.l.itemId); })
          .filter(function(v, i, a){ return a.indexOf(v) === i; });
        line({ grp:"money", ic:"return", t:"مرتجع عند " + (c || "شركة من غير اسم"),
               s:names.slice(0, 2).join(" · ") + (names.length > 2 ? " و" + qty(names.length - 2) + " تاني" : ""),
               v:qty(n) + " قطعة", go:"sales|4" });
      });
    }
    if(canTab("purch") || canTab("inv")){
      // v122 — قطع اتباعت أو اتحجزت لأوردرات ولسه ما اتشرتش من المورد
      var SH = shortList();
      if(SH.length){
        var shn = SH.reduce(function(a, x){ return a + x.n; }, 0);
        line({ grp:"stock", ic:"receipt", cls:"bad", t:"اشتري للأوردرات",
               s:SH.slice(0, 2).map(function(x){ var lb = vLabel(x.color, x.size); return x.name + (lb ? " " + lb : "") + " × " + qty(x.n); }).join(" · ") +
                 (SH.length > 2 ? " و" + qty(SH.length - 2) + " تاني" : ""),
               v:qty(shn) + " قطعة", go: canTab("purch") ? "purch" : "inv|out" });
      }
    }
    if(canTab("inv")){
      /* صنف واحد: سطره بتفاصيله زي ما هو. أكتر من صنف: كارت واحد بالعدد
         وأسماء أول اتنين — كانوا سطر لكل لون ومقاس وبيزقّوا الباقي تحت. */
      var lows = lowStockList(), lowG = { out:[], low:[] };
      lows.forEach(function(x){ lowG[x.out ? "out" : "low"].push(x); });
      var uniq = function(xs){ return xs.map(function(x){ return x.itemId; }).filter(function(v, i, a){ return a.indexOf(v) === i; }); };
      // v176: الاتنين موجودين؟ سطر واحد — «خلصت» و«قرّبت تخلص» نفس الشاشة ونفس القرار
      if(lowG.out.length && lowG.low.length){
        var io = uniq(lowG.out), il = uniq(lowG.low), all = uniq(lowG.out.concat(lowG.low));
        line({ grp:"stock", cls:"bad", t:qty(io.length) + " صنف خلص · " + qty(il.length) + " قرّب يخلص",
               s:all.slice(0, 2).map(itemName).join(" · ") + (all.length > 2 ? " و" + qty(all.length - 2) + " تاني" : ""),
               v:qty(all.length), go:"inv|out", n:lowG.out.length, btn:"المخزون" });
        lowG = { out:[], low:[] };
      }
      ["out", "low"].forEach(function(k){
        var xs = lowG[k]; if(!xs.length) return;
        var nm = function(x){ var lb = vLabel(x.color, x.size); return x.name + (lb ? " " + lb : ""); };
        // العدد بالأصناف زي زرار «خلصان»/«قرب يخلص» في المخزون — مش بكل لون ومقاس
        var items = xs.map(function(x){ return x.itemId; }).filter(function(v, i, a){ return a.indexOf(v) === i; });
        // الأسماء بالصنف برضه: صنف بلون/مقاس واحد بيتكتب بيه، وأكتر بيتكتب عددهم
        var inm = function(id){
          var vs = xs.filter(function(x){ return x.itemId === id; });
          return vs.length === 1 ? nm(vs[0]) : vs[0].name + " (" + qty(vs.length) + " لون/مقاس)";
        };
        if(xs.length === 1){
          var x = xs[0];
          line({ grp:"stock", ic:"alert", cls: k === "out" ? "bad" : "warn",
                 t:nm(x) + (k === "out" ? " خلصت" : " قرّبت تخلص"),
                 s: k === "out"
                   ? "رصيده في المخزن صفر" + (x.rsv ? " — وعليه " + qty(x.rsv) + " لأوردرات ماشية" : "")
                   : "متاح " + qty(x.free) + (x.min ? " — حد التنبيه " + qty(x.min) : ""),
                 v:qty(k === "out" ? x.stock : x.free), go:"inv|" + k, n:1 });
        } else {
          line({ grp:"stock", ic:"alert", cls: k === "out" ? "bad" : "warn",
                 t: k === "out" ? "أصناف خلصت" : "أصناف قرّبت تخلص",
                 s:items.slice(0, 2).map(inm).join(" · ") + (items.length > 2 ? " و" + qty(items.length - 2) + " تاني" : ""),
                 // n = عدد صفوف اللون/المقاس (زي جدول التفصيلية) — الرقم الظاهر بالأصناف
                 v:qty(items.length), go:"inv|" + k, n:xs.length });
        }
      });
    }
    if(canTab("parties") && canMoney()){
      live("parties").forEach(function(p){
        if(p.type !== "supplier") return;
        var b = partyBalance(p.id);
        if(b < -0.009) line({ grp:"money", btn:"الحساب", ic:"receipt", cls:"bad", t:"عليك لـ " + p.name, s:"من المشتريات",
                              v:money(-b), go:"party|" + p.id });
      });
    }
    if(canTab("audit")){
      var AC = audCount();
      if(AC.bad + AC.warn)
        line({ grp:"acct", btn:"راجعها", ic:"book", cls: AC.bad ? "bad" : "warn", t:"مراجع الحسابات لقى حاجات محتاجة تبصّلها",
               s:(AC.bad ? qty(AC.bad) + " لازم تتصلح" : "") + (AC.bad && AC.warn ? " · " : "") + (AC.warn ? qty(AC.warn) + " محتاجة مراجعة" : ""), v:qty(AC.bad + AC.warn), go:"audit" });
    }
    var sq = canEdit() ? shipQList() : [];
    if(canTab("sales") && sq.length)
      line({ grp:"orders", btn:"جاوب", ic:"truck", cls:"warn", t:sq.length === 1 ? "#" + (sq[0].no || "") + " اترفض — العميل دفع كام من الشحن؟" : sq.length + " أوردرات اترفضت — العملاء دفعوا كام من الشحن؟",
             s:sq.map(function(x){ return "#" + (x.no || ""); }).join(" · ") + " · دوسة على كل واحد", v:"", go:"sales" });
    if(canTab("prepaid") && canMoney()){
      var MB = metaBook(), gp = MB.last ? daysBetween(MB.last.d, today()) : null;
      if(fix189Pending())
        line({ grp:"acct", btn:"سجّل", ic:"wallet", cls:"bad", t:"سجّل شحنات فيسبوك الناقصة", s:"5 شحنات من 20/10 لحد 3/11 · 2,037 من الخزنة — دوسة واحدة", v:"", go:"prepaid" });
      else if(metaTops().length && (gp === null || gp >= META_MAX_GAP))
        line({ grp:"acct", btn:"طابق", ic:"wallet", cls:"warn", t:"طابق رصيد فيسبوك", s: gp === null ? "لسه ما طابقتش ولا مرة" : "آخر مطابقة من " + qty(gp) + " يوم", v:money(MB.bal), go:"prepaid" });
      prepaidList().forEach(function(x){
        var dl = daysBetween(today(), x.to);
        if(dl <= 3 && expCat(x.c) === "subs") line({ grp:"acct", ic:"receipt", cls:"warn", t:"اشتراك بيتجدد " + (dl <= 0 ? "النهارده" : "بعد " + qty(dl) + " يوم"), s:squish(x.c.note) || "اشتراك", v:dShort(addDays(x.to, 1)), go:"cash" });
      });
    }
    if(canTab("capital") && canMoney()) partners().forEach(function(p){
      var ow = owedOf(p.id);
      if(ow > 0.009) line({ grp:"acct", btn:"رجّعله", ic:"hand", cls:"warn", t:"الشركة عليها لـ " + p.name, s:"مصاريف دفعها من جيبه", v:money(ow), go:"capital" });
    });
    /* v124 — كل سطر في «محتاج منك» جنبه اسم الحاجة اللي هيعملها (زي «استلمها»).
       جوّه نفس الزرار — زرار جوّه زرار مش مسموح، والسطر كله بيودّي نفس المكان. */
    var ctaOf = function(go){
      var k = String(go).split("|"), m = { "sales|1":"كمّلهم", "sales|2":"تابعهم", "sales|3":"استلمها", "sales|4":"استلمه" };
      return m[k[0] + "|" + k[1]] || (k[0] === "party" ? "الحساب" : k[0] === "inv" ? "المخزون" : k[0] === "purch" ? "فاتورة شراء" : "افتح");
    };
    /* v176 — مجموعات بالترتيب ده، وجوّه كل مجموعة الأهم الأول. النقطة بتقول الأهمية:
       أحمر لازم النهارده · أصفر مهم · أخضر فلوس مستنياك · رمادي لما تفضى */
    var GRP = [["orders", "الأوردرات"], ["money", "الفلوس والمرتجع"], ["stock", "المخزون"], ["acct", "الحسابات"]];
    var RANK = { bad:0, warn:1, money:2 };
    var row = function(o){
      return "<button type='button' class='hm-tr" + (o.cls ? " " + o.cls : "") + "' data-hgo='" + esc(o.go) + "'" +
        (o.n ? " data-hn='" + o.n + "'" : "") + " title='" + esc(o.t + " — " + o.s) + "'>" +
        "<i class='dot' aria-hidden='true'></i>" +
        "<span class='tx'><b>" + esc(o.t) + "</b><span class='s" + (o.red ? " red" : "") + "'>" + esc(o.s) + "</span></span>" +
        "<span class='v num'>" + esc(o.v) + "</span><span class='cta' aria-hidden='true'>" + esc(o.btn || ctaOf(o.go)) + "</span></button>";
    };
    var todo = document.getElementById("hm-todo");
    if(todo) todo.innerHTML = "<h3>المطلوب منك النهارده " + (L.length ? "<small>" + plural(L.length, "حاجة واحدة", "حاجتين", "حاجات") + " · مترتبة بالأهم</small>" : "") + "</h3>" +
      (L.length ? GRP.map(function(gp){
        var xs = L.filter(function(o){ return (o.grp || "acct") === gp[0]; })
          .sort(function(a, b){ return (a.cls in RANK ? RANK[a.cls] : 3) - (b.cls in RANK ? RANK[b.cls] : 3); });
        return xs.length ? "<div class='hm-grp'><h4>" + esc(gp[1]) + "</h4>" + xs.map(row).join("") + "</div>" : "";
      }).join("") : "<p class='hm-ok'>✓ مفيش حاجة مستنياك دلوقتي</p>");
    var dt2 = document.getElementById("hm-date");
    if(dt2 && L.length) dt2.textContent += " · عندك " + plural(L.length, "حاجة واحدة", "حاجتين", "حاجات") + " محتاجاك النهارده";
    var nb = document.getElementById("hm-new");
    if(nb) nb.hidden = !(canTab("sales") && canEdit());

    /* ---- الأرقام الأساسية — نفس أرقام «كل الأرقام بالتفصيل» تحت ---- */
    var cur = periodStats(periodRange());
    var sel = document.getElementById("per-home");
    var perTxt = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "";
    // v122: صافي الربح = نفس قايمة الدخل «لو كله اتسلّم»، واللي اتسلّم فعلاً تحته
    var PS = projStats(periodRange()), xv = PS.exp, xn = xv.net;
    /* v124 — صافي الربح كارت كبير لوحده (الرقم الأهم)، وتحته 3 أرقام بتشرحه.
       الباقي 4 كروت بنفس الحجم جنبه. data-hkpi زي ما هي: الدوسة بتفتح نفس التفاصيل. */
    /* v176 — 4 أرقام بنفس الحجم. الدوسة بتفتح نفس التفاصيل تحت (data-hkpi) */
    var K = [
      ["net", "صافي الربح · " + perTxt, money(xn), xn >= 0 ? "v-gain" : "v-due",
        PS.nOpen ? "اتسلّم فعلاً " + money(PS.act.net) : (xv.margin === null ? "" : "هامش البضاعة " + (xv.margin * 100).toFixed(1) + "%"), 1],
      ["cash", "الخزنة", money(cashBox()), cashBox() >= 0 ? "" : "v-due", "الفلوس اللي في إيدك", 0],
      ["wallet", "عند شركات الشحن", money(walletsTotal()), "", walletsTotal() > 0.009 ? "لسه ما استلمتهاش" : "مفيش فلوس مستنياك", 0],
      ["stock", "المخزون", money(stockBookValue()), "", "بالتكلفة", 1]
    ];
    var big = document.getElementById("hm-big");
    if(big) big.innerHTML = "<div class='hm-k4'>" + K.map(function(k){
      return "<button type='button' class='hm-k" + (k[5] ? " money-only" : "") + (k[0] === "net" ? " main" : "") + "' data-hkpi='" + k[0] + "'>" +
        "<span>" + esc(k[1]) + "</span><strong class='num " + k[3] + "'>" + esc(k[2]) + "</strong><small>" + esc(k[4]) + "</small></button>";
    }).join("") + "</div>";

    /* ---- v176 — ملخص الفترة (المراحل نفسها في «المطلوب منك» وفي شاشة الأوردرات) ---- */
    var n = cur.list.length;
    var mo = document.getElementById("hm-month");
    if(mo) mo.innerHTML = "<h3><span>الملخص <small>" + esc(perTxt) + "</small></span></h3>" +
      "<div class='hm-sum'><span>أوردرات</span><b class='num'>" + qty(n) + "</b></div>" +
      "<div class='hm-sum'><span>مبيعات مسلّمة</span><b class='num'>" + esc(money(cur.revenue)) + "</b></div>" +
      "<div class='hm-sum money-only'><span>ربح البضاعة</span><b class='num'>" + esc(money(xv.gross)) + "</b></div>" +
      (canTab("rep") ? "<button type='button' class='hm-link' data-hgo='rep'>قايمة الدخل ←</button>" : "");

    /* ---- أكتر الأصناف طلباً: آخر ١٤ يوم بعدد القطع، من الأوردرات اللي مش ملغية ---- */
    var tp = document.getElementById("hm-topit");
    if(tp){
      var from14 = addDays(today(), -13), cnt = {};
      live("sales").forEach(function(x){
        if(isCancelled(x) || !inRange(x.date, { from:from14, to:today() })) return;
        SL(x).forEach(function(l){ if(l.itemId) cnt[l.itemId] = (cnt[l.itemId] || 0) + Math.max(0, Number(l.qty)||0); });
      });
      var top = Object.keys(cnt).filter(function(k){ return cnt[k] > 0; }).sort(function(a, b2){ return cnt[b2] - cnt[a]; }).slice(0, 3);
      tp.hidden = !top.length || !canTab("inv");
      if(top.length) tp.innerHTML = "<h3><span>أكتر الأصناف طلباً <small>آخر 14 يوم</small></span></h3>" + top.map(function(k){
        return "<div class='hm-it'><span>" + esc(itemName(k)) + "</span><i aria-hidden='true'><i style='width:" + Math.round(cnt[k] / cnt[top[0]] * 100) + "%'></i></i>" +
          "<b class='num'>" + plural(cnt[k], "قطعة", "قطعتين", "قطع") + "</b></div>";
      }).join("");
    }
  }

  // دوسة على سطر في «محتاج منك» بتوديك مكانه على طول
  document.getElementById("tab-dash").addEventListener("click", function(e){
    var k = e.target.closest("[data-hkpi]");
    if(k){
      // نفس تفاصيل الكارت في «كل الأرقام بالتفصيل» — نفس الحساب بالظبط
      var more = document.getElementById("dash-more");
      if(more) more.open = true;
      kpiOpen = k.dataset.hkpi; renderKPIs();
      var pnl = document.getElementById("kpi-panel");
      if(pnl) pnl.scrollIntoView({ block:"start" });
      return;
    }
    var t = e.target.closest("[data-hgo]"); if(!t) return;
    var q = t.dataset.hgo.split("|");
    // «+ أوردر جديد» من الرئيسية: نفس زرار شاشة الأوردرات بالظبط
    if(q[0] === "newsale"){ goTab("sales"); document.getElementById("b-newsale").click(); return; }
    if(q[0] === "sales"){ goTab("sales"); setSView(q[1]); window.scrollTo(0, 0); return; }
    if(q[0] === "party"){ openPartyCard(q[1]); return; }
    if(q[0] === "prepaid" || q[0] === "capital" || q[0] === "cash"){ goTab(q[0]); window.scrollTo(0, 0); return; }
    if(q[0] === "inv"){
      goTab("inv");
      var low = document.querySelector("#tab-inv [data-invonly='" + (q[1] || "low") + "']");
      if(low) low.click();
      return;
    }
    goTab(q[0]);
  });

