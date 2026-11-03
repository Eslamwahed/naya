  /* ================= التسعير =================
     شاشة قرار مش شاشة تسجيل: بتقارن تكلفة القطعة الواصلة بسعر البيع
     وتوريك الربح قبل ما تبيع. الحاجة الوحيدة اللي بتتغيّر منها هي
     it.price — مفيش حركة بتتكتب في الدفاتر.

     بنعرض النسبة بشكلين عشان ما يحصلش لبس:
       زيادة على التكلفة (markup) = (السعر − التكلفة) ÷ التكلفة
       الهامش (margin)            = (السعر − التكلفة) ÷ السعر
     التاني هو اللي التقارير بتحسب بيه التعادل. اشتريت بـ100 وبعت بـ150:
     زيادة 50% وهامش 33% — نفس الجنيه برقمين.

     ملحوظة على الأسماء: «pr-» محجوزة لدرج مرتجع المشتريات،
     فالشاشة دي كلها «prc-». */
  var prcFilt = { q:"", only:"all" };

  function prcMarkup(price, cost){ return cost > 0 ? (price - cost) / cost : null; }
  function prcMargin(price, cost){ return price > 0 ? (price - cost) / price : null; }
  function prcRound(v, step){
    var st = Number(step)||0;
    if(st <= 0) return Math.round(v * 100) / 100;
    return Math.round(v / st) * st;
  }
  function prcPct(v){ return (v === null || !isFinite(v)) ? "—" : (v*100).toFixed(1) + "%"; }

  /* مصاريف القطعة اللي بتكتبها بإيدك (تغليف، إعلانات، …) ومصاريف الشحن للقطعة —
     أرقام تخطيط على الصنف بس، زي سعر البيع: مش بتتسجّل في الدفاتر، لأن الشحن
     الفعلي بيتسجّل في الأوردر والمصاريف الفعلية في الخزنة. */
  function prcExtra(it){ return Math.max(0, Number(it && it.xCost)||0); }
  function prcShip(it){ return Math.max(0, Number(it && it.shipCost)||0); }
  // كل الأصناف بتكلفتها وسعرها ورصيدها — مصدر الجدول والكروت مع بعض
  function prcAll(){
    return live("items").map(function(it){
      var buy   = avgCost(it.id);
      var x = prcExtra(it), sh = prcShip(it);
      var cost  = buy > 0 ? buy + x + sh : 0;        // التكلفة الكلية للقطعة
      var price = Number(it.price)||0;
      var stock = Math.max(0, stockOf(it.id));
      var r = { it:it, buy:buy, x:x, sh:sh, cost:cost, price:price, stock:stock,
               unit: (price > 0 && cost > 0) ? price - cost : null, cols:null };
      r.noPrice = price <= 0; r.loss = price > 0 && cost > 0 && price <= cost;
      // صنف بأكتر من لون: كل لون بتكلفته وسعره، وأرقام المخزون بتتجمع من الألوان
      var ic = itemColors(it.id);
      if(ic.filter(Boolean).length > 1){
        r.cols = ic.map(function(c){ return prcColRow(it, c, x, sh); });
        r.sbuy = 0; r.sx = 0; r.sval = 0; r.sprof = 0;
        r.cols.forEach(function(k){
          r.sbuy += k.stock * k.buy; r.sx += k.stock * (k.buy > 0 ? x + sh : 0);
          r.sval += k.stock * (k.price > 0 ? k.price : k.cost);   // من غير سعر = من غير ربح
          if(k.unit !== null) r.sprof += k.stock * k.unit;
        });
        r.noPrice = r.cols.some(function(k){ return k.price <= 0; });
        r.loss = r.cols.some(function(k){ return k.price > 0 && k.cost > 0 && k.price <= k.cost; });
      }
      return r;
    });
  }
  function prcColRow(it, c, x, sh){
    var cc = costOfColor(it.id, c), cost = cc.c > 0 ? cc.c + x + sh : 0;
    var cp = colorPrice(it, c), price = vPrice(it, c);
    return { color:c, stock:Math.max(0, colorQty(it.id, c, stockOfVi)), buy:cc.c, own:cc.own, cost:cost,
             cp:cp, price:price, unit:(price > 0 && cost > 0) ? price - cost : null };
  }
  function prcList(){
    var q = squish(prcFilt.q).toLowerCase();
    return prcAll().filter(function(r){
      if(q && squish(r.it.name).toLowerCase().indexOf(q) < 0) return false;
      if(prcFilt.only === "noprice") return r.noPrice;
      if(prcFilt.only === "loss")    return r.loss;
      if(prcFilt.only === "instock") return r.stock > 0;
      return true;
    });
  }
  // ربح كل المخزون بالأسعار الحالية
  function prcStockProfit(all){
    return all.reduce(function(a, r){
      if(r.cols) return a + r.sprof;
      return a + (r.stock && r.unit !== null ? r.stock * r.unit : 0);
    }, 0);
  }

  function renderPrcKpis(){
    var all = prcAll();
    var cost = 0, extra = 0, val = 0, noPrice = 0, loss = 0, noCost = 0;
    all.forEach(function(r){
      if(r.noPrice) noPrice++;
      if(r.cost  <= 0) noCost++;
      if(r.loss) loss++;
      if(r.cols){ cost += r.sbuy; extra += r.sx; val += r.sval; return; }
      if(!r.stock) return;
      cost += r.stock * r.buy;
      extra += r.stock * (r.buy > 0 ? r.x + r.sh : 0);
      val  += r.stock * (r.price > 0 ? r.price : r.cost);   // من غير سعر = من غير ربح
    });
    var prof = val - cost - extra;
    var cells = [
      ["تكلفة اللي في مخزنك", money(cost), "", extra > 0.009 ? "بسعر الشراء الواصل · + " + money(extra) + " مصاريف وشحن" : "بسعر الشراء الواصل"],
      ["هتبيعها بكام", money(val), "", "بأسعارك المسجّلة"],
      ["ربحك لو بعتها كلها", money(prof), prof > 0 ? "v-gain" : (prof < 0 ? "v-due" : ""),
        "هامش " + prcPct(val > 0 ? prof/val : null)],
      ["أصناف لسه من غير سعر", qty(noPrice), noPrice ? "v-due" : "v-gain",
        noPrice ? "دي بتتباع من غير ربح محسوب" : "كلها متسعّرة"],
      ["سعرها أقل من تكلفتها", qty(loss), loss ? "v-due" : "v-gain",
        loss ? "كل قطعة منها خسارة" : "مفيش صنف بيتباع بخسارة"]
    ];
    document.getElementById("prc-kpis").innerHTML = cells.map(function(c){
      return "<div class='money-only'><span>" + esc(c[0]) + "</span>" +
        "<strong class='num " + c[2] + "'>" + esc(c[1]) + "</strong>" +
        "<span class='sub'>" + esc(c[3]) + "</span></div>";
    }).join("");

    /* الربح ده بضاعة بس. الثابت (إيجار، نت، مرتبات) بيتاكل منه —
       وده اللي بيخلّي «أبيع بكام» في التقارير مفهوم. */
    var el = document.getElementById("prc-note");
    if(!el) return;
    if(all.length && noCost === all.length){
      el.innerHTML = "<span class='v-due'>مفيش تكلفة شراء مسجّلة لأي صنف — سجّل فاتورة شراء الأول عشان نعرف بتشتري بكام.</span>";
      return;
    }
    var fx = expensesIn(null, "fixed");      // من غير الانتقالات اللي اتحطت على البضاعة
    var sp = prcStockProfit(all);
    var anyX = all.some(function(r){ return r.x > 0 || r.sh > 0; });
    el.innerHTML = (anyX
        ? "الربح اللي فوق بعد تكلفة البضاعة والمصاريف الإضافية والشحن اللي كتبتهم لكل صنف — لسه هيتاكل منه مصاريفك الثابتة"
        : "الربح اللي فوق ربح <strong>بضاعة</strong> بس — لسه هيتاكل منه الشحن اللي بتدفعه من جيبك ومصاريفك الثابتة") +
      (fx > 0
        ? " (<strong>" + esc(money(fx)) + "</strong> مسجّلة من البداية لحد دلوقتي). " +
          (sp >= fx ? "بضاعة مخزنك بتغطّيها وفاضل <strong>" + esc(money(sp - fx)) + "</strong>."
                    : "<span class='v-due'>بضاعة مخزنك مش بتغطّيها — ناقص <strong>" + esc(money(fx - sp)) + "</strong>.</span>")
        : ".");
  }

  var PRC_HEAD = ["الصنف","في المخزن","تكلفة القطعة","مصاريف إضافية","مصاريف شحن","التكلفة الكلية","سعر البيع",
                  "زيادة على التكلفة %","ربح القطعة","الهامش %","ربح كل المخزون"];

  function renderPricing(){
    if(pcTab === "calc") renderPcalc();     // القوايم كمان — صنف اتضاف أو اتغيّر اسمه من مكان تاني
    renderPrcKpis();
    var ed = canEdit();
    var rows = prcList().map(function(r){
      // صنف من غير سعر: الخانة تفضل فاضية — «−100%» رقم صح ومالوش أي معنى هنا
      var mk = r.price > 0 ? prcMarkup(r.price, r.cost) : null;
      var bad = r.price > 0 && r.cost > 0 && r.price <= r.cost;
      var dis = ed ? "" : " disabled";
      var open = !!(r.cols && prcOpen[r.it.id]), nc = r.cols ? r.cols.filter(function(k){ return k.color; }).length : 0;
      return "<tr data-prcrow='" + esc(r.it.id) + "' data-cost='" + r.cost + "' data-buy='" + r.buy + "' data-stock='" + r.stock + "'" + (r.cols ? " data-cols='1'" : "") + ">" +
        "<td class='wide'>" + esc(r.it.name) + (r.cols ? " <button type='button' class='prc-tog' data-prctog='" + esc(r.it.id) + "' aria-expanded='" + open + "'>" +
           (open ? "▴" : "▾") + " " + plural(nc, "لون واحد", "لونين", "ألوان") + "</button>" : "") +
           (r.cols && r.loss ? "<small class='prc-avg'>فيه لون سعره أقل من تكلفته — افتح الألوان</small>" : "") +
           (r.cols ? "<small class='prc-avg prc-avgn'>الأرقام هنا متوسط كل الألوان</small>" : "") + "</td>" +
        "<td class='num'>" + esc(qty(r.stock)) + "</td>" +
        "<td class='num'>" + (r.buy > 0 ? money(r.buy)
           : "<span class='v-due'>لسه ما اشتريتش</span>") + "</td>" +
        "<td><input class='prin prx' inputmode='decimal' data-prcx='" + esc(r.it.id) + "' value='" + (r.x > 0 ? r.x : "") +
           "' placeholder='0' aria-label='مصاريف إضافية للقطعة'" + dis + "></td>" +
        "<td><input class='prin prx' inputmode='decimal' data-prcs='" + esc(r.it.id) + "' value='" + (r.sh > 0 ? r.sh : "") +
           "' placeholder='0' aria-label='مصاريف شحن للقطعة'" + dis + "></td>" +
        "<td class='num prc-cost'><b>" + (r.cost > 0 ? money(r.cost) : "—") + "</b></td>" +
        "<td><input class='prin' inputmode='decimal' data-prcprice='" + esc(r.it.id) + "'" +
           " value='" + (r.price > 0 ? r.price : "") + "' placeholder='0' aria-label='سعر البيع'" + dis + "></td>" +
        "<td>" + (r.buy > 0
           ? "<input class='prin' inputmode='decimal' data-prcmk='" + esc(r.it.id) + "'" +
             " value='" + (mk === null ? "" : (mk*100).toFixed(1)) + "' placeholder='0'" +
             " aria-label='زيادة على التكلفة بالمية'" + dis + ">"
           : "<span class='num'>—</span>") + "</td>" +
        "<td class='num prc-unit " + (bad ? "v-due" : (r.unit ? "v-gain" : "")) + "'>" +
           (r.unit === null ? "—" : money(r.unit)) + "</td>" +
        "<td class='num prc-mg'>" + esc(prcPct(r.price > 0 ? prcMargin(r.price, r.cost) : null)) + "</td>" +
        "<td class='num prc-tot'>" + (r.cols ? (r.cols.some(function(k){ return k.stock > 0; }) ? money(r.sprof) : "—") : (r.unit === null || !r.stock) ? "—" : money(r.unit * r.stock)) + "</td>" +
      "</tr>" + (r.cols ? r.cols.map(function(k){ return prcSubRow(r, k, open, dis); }).join("") : "");
    });
    table("t-price", PRC_HEAD, rows,
      (prcFilt.q || prcFilt.only !== "all") ? "مفيش صنف بالمواصفات دي."
                                            : "سجّل أصنافك الأول من تبويب «الأصناف».");
  }

  /* سطر لون تحت الصنف: تكلفة اللون ده بس + سعره. خانة السعر فاضية = السعر الأساسي
     (باين كـplaceholder)، وأول ما تكتب فيها بيبقى للون ده سعر لوحده. */
  var prcOpen = {};
  function prcSubRow(r, k, open, dis){
    var mk = k.price > 0 && k.cost > 0 ? prcMarkup(k.price, k.cost) : null;
    var bad = k.price > 0 && k.cost > 0 && k.price <= k.cost;
    return "<tr class='prc-sub' data-prcsub='" + esc(r.it.id) + "' data-color='" + esc(k.color) + "' data-cost='" + k.cost + "' data-buy='" + k.buy + "' data-stock='" + k.stock + "'" + (open ? "" : " hidden") + ">" +
      "<td class='wide'><span class='prc-cn'>" + esc(k.color || "من غير لون") + "</span></td>" +
      "<td class='num'>" + esc(qty(k.stock)) + "</td>" +
      "<td class='num'>" + (k.buy > 0 ? esc(money(k.buy)) + (k.own ? "" : "<small class='prc-avg'>متوسط الصنف — اللون ده ما اتشراش</small>")
                                      : "<span class='v-due'>لسه ما اشتريتش</span>") + "</td>" +
      "<td class='num prc-dim'>" + (r.x > 0 ? esc(qty(r.x)) : "—") + "</td>" +
      "<td class='num prc-dim'>" + (r.sh > 0 ? esc(qty(r.sh)) : "—") + "</td>" +
      "<td class='num prc-cost'><b>" + (k.cost > 0 ? esc(money(k.cost)) : "—") + "</b></td>" +
      "<td>" + (k.color ? "<input class='prin' inputmode='decimal' data-prccp='" + esc(r.it.id) + "' value='" + (k.cp > 0 ? k.cp : "") +
         "' placeholder='" + (r.price > 0 ? r.price : "0") + "' aria-label='سعر بيع " + esc(k.color) + "'" + dis + ">"
         : "<span class='num prc-dim'>" + (r.price > 0 ? esc(money(r.price)) : "—") + "</span>") + "</td>" +
      "<td class='num prc-mk'>" + esc(mk === null ? "—" : (mk*100).toFixed(1) + "%") + "</td>" +
      "<td class='num prc-unit " + (bad ? "v-due" : (k.unit ? "v-gain" : "")) + "'>" + (k.unit === null ? "—" : esc(money(k.unit))) + "</td>" +
      "<td class='num prc-mg'>" + esc(prcPct(k.price > 0 ? prcMargin(k.price, k.cost) : null)) + "</td>" +
      "<td class='num prc-tot'>" + ((k.unit === null || !k.stock) ? "—" : esc(money(k.unit * k.stock))) + "</td>" +
    "</tr>";
  }
  // سعر لون أو السعر الأساسي اتغيّر: سطور الألوان وإجمالي الصنف بيتحدّثوا من غير إعادة رسم
  function prcPaintSubs(id){
    var t = document.getElementById("t-price"), itr = t.querySelector("tr[data-prcrow='" + CSS.escape(id) + "']");
    if(!itr || !itr.dataset.cols) return;
    var base = Number(toEn((itr.querySelector("[data-prcprice]") || {}).value || ""))||0, sum = 0;
    Array.prototype.forEach.call(t.querySelectorAll("tr[data-prcsub='" + CSS.escape(id) + "']"), function(tr){
      var inp = tr.querySelector("[data-prccp]"), own = inp && inp.value.trim() !== "" ? Number(toEn(inp.value))||0 : 0;
      if(inp) inp.placeholder = base > 0 ? String(base) : "0";
      var price = own > 0 ? own : base, cost = Number(tr.dataset.cost)||0;
      var mk = tr.querySelector(".prc-mk"); if(mk) mk.textContent = price > 0 && cost > 0 ? (prcMarkup(price, cost)*100).toFixed(1) + "%" : "—";
      prcPaint(tr, price);
      var unit = (price > 0 && cost > 0) ? price - cost : null;
      if(unit !== null) sum += unit * (Number(tr.dataset.stock)||0);
    });
    var tot = itr.querySelector(".prc-tot"), anyS = Array.prototype.some.call(t.querySelectorAll("tr[data-prcsub='" + CSS.escape(id) + "']"), function(tr){ return Number(tr.dataset.stock) > 0; });
    if(tot) tot.textContent = anyS ? money(sum) : "—";
  }
  var prcCPend = {}, prcCTimer = null;
  function prcQueueC(id, color, v){
    (prcCPend[id] = prcCPend[id] || {})[color] = Math.round(v * 100) / 100;
    clearTimeout(prcCTimer); prcCTimer = setTimeout(prcFlushC, 600);
  }
  function prcFlushC(){
    clearTimeout(prcCTimer); prcCTimer = null;
    var ids = Object.keys(prcCPend); if(!ids.length) return;
    ids.forEach(function(id){
      var it = db.items.find(function(x){ return x.id === id; }), ch = prcCPend[id];
      if(!it) return;
      var cp = Object.assign({}, it.cprice || {}), any = false;
      Object.keys(ch).forEach(function(c){
        var was = Number(cp[c])||0;
        if(was === ch[c]) return;
        if(ch[c] > 0) cp[c] = ch[c]; else delete cp[c];   // فاضي أو صفر = يرجع للسعر الأساسي
        any = true;
      });
      if(any){ it.cprice = cp; it.at = Date.now(); it.editedBy = me || "غير محدد"; }
    });
    prcCPend = {};
    saveSoon("items"); renderPrcKpis();
    dirtyTabs.dash = 1; dirtyTabs.rep = 1; dirtyTabs.inv = 1; dirtyTabs.items = 1;
  }

  // بيحدّث خانات السطر من غير ما يعيد رسم الجدول — عشان المؤشر ما يقفزش
  function prcPaint(tr, price){
    var cost = Number(tr.dataset.cost)||0, st = Number(tr.dataset.stock)||0;
    var unit = (price > 0 && cost > 0) ? price - cost : null;
    var u = tr.querySelector(".prc-unit"), g = tr.querySelector(".prc-mg"), t = tr.querySelector(".prc-tot");
    if(u){
      u.textContent = unit === null ? "—" : money(unit);
      u.className = "num prc-unit " + (unit === null ? "" : (unit <= 0 ? "v-due" : "v-gain"));
    }
    if(g) g.textContent = prcPct(price > 0 ? prcMargin(price, cost) : null);
    if(t) t.textContent = (unit === null || !st) ? "—" : money(unit * st);
  }
  function prcCommit(id, price){
    var it = db.items.find(function(x){ return x.id === id; });
    if(!it) return;
    var v = Math.round((Number(price)||0) * 100) / 100;
    if((Number(it.price)||0) === v) return;             // ما اتغيّرش = ما نلخبطش وقت السجل
    it.price = v; it.at = Date.now(); it.editedBy = me || "غير محدد";
    saveSoon("items");
  }

  /* الحفظ بيتعمل وإنت بتكتب (بتأخير بسيط) مش على blur بس. السبب:
     لما تكتب في خانة النسبة، خانة السعر بتتملى بالكود — والمتصفح
     مابيبعتش change لخانة اتغيّرت بالكود، فالسعر كان هيضيع لو سبت
     الشاشة من غير ما تلمس خانة السعر نفسها. */
  var prcTimer = null, prcPend = null;
  var prcXTimer = null, prcXPend = {};
  function prcQueueX(id, field, v){
    (prcXPend[id] = prcXPend[id] || {})[field] = Math.round(v * 100) / 100;
    clearTimeout(prcXTimer); prcXTimer = setTimeout(prcFlushX, 600);
  }
  function prcFlushX(){
    clearTimeout(prcXTimer); prcXTimer = null;
    var ids = Object.keys(prcXPend); if(!ids.length) return;
    ids.forEach(function(id){
      var it = db.items.find(function(x){ return x.id === id; }), ch = prcXPend[id];
      if(!it) return;
      var any = false;
      Object.keys(ch).forEach(function(k){ if((Number(it[k])||0) !== ch[k]){ it[k] = ch[k]; any = true; } });
      if(any){ it.at = Date.now(); it.editedBy = me || "غير محدد"; }
    });
    prcXPend = {};
    saveSoon("items"); renderPrcKpis();
  }
  function prcQueue(id, price){
    prcPend = { id:id, price:price };
    clearTimeout(prcTimer); prcTimer = setTimeout(prcFlush, 600);
  }
  function prcFlush(){
    clearTimeout(prcTimer); prcTimer = null;
    if(!prcPend) return;
    var q = prcPend; prcPend = null;
    prcCommit(q.id, q.price);
    renderPrcKpis();
    dirtyTabs.dash = 1; dirtyTabs.rep = 1; dirtyTabs.inv = 1; dirtyTabs.items = 1;
  }

  document.getElementById("t-price").addEventListener("input", function(e){
    var sub = e.target.closest("tr[data-prcsub]");
    if(sub){
      if(!e.target.matches("[data-prccp]")) return;
      prcPaintSubs(sub.dataset.prcsub);
      if(canEdit()) prcQueueC(sub.dataset.prcsub, sub.dataset.color, e.target.value.trim() === "" ? 0 : Math.max(0, Number(toEn(e.target.value))||0));
      return;
    }
    var tr = e.target.closest("tr[data-prcrow]"); if(!tr) return;
    var pIn  = tr.querySelector("[data-prcprice]"), mIn = tr.querySelector("[data-prcmk]");
    var xIn = tr.querySelector("[data-prcx]"), sIn = tr.querySelector("[data-prcs]");
    if(e.target === xIn || e.target === sIn){
      // المصاريف اتغيّرت: التكلفة الكلية بتتحسب تاني، والسعر ثابت والنسبة بتمشي وراه
      var buy = Number(tr.dataset.buy)||0;
      var xv = Math.max(0, Number(toEn(xIn.value))||0), sv = Math.max(0, Number(toEn(sIn.value))||0);
      var c2 = buy > 0 ? buy + xv + sv : 0;
      tr.dataset.cost = c2;
      var ce = tr.querySelector(".prc-cost"); if(ce) ce.innerHTML = "<b>" + (c2 > 0 ? esc(money(c2)) : "—") + "</b>";
      var pr0 = Number(toEn(pIn.value))||0;
      if(mIn) mIn.value = (pIn.value.trim() === "" || !(c2 > 0)) ? "" : (prcMarkup(pr0, c2)*100).toFixed(1);
      prcPaint(tr, pr0);
      // تكلفة كل لون فيها نفس المصاريف
      Array.prototype.forEach.call(this.querySelectorAll("tr[data-prcsub='" + CSS.escape(tr.dataset.prcrow) + "']"), function(st){
        var b = Number(st.dataset.buy)||0, cc = b > 0 ? b + xv + sv : 0;
        st.dataset.cost = cc;
        var ce2 = st.querySelector(".prc-cost"); if(ce2) ce2.innerHTML = "<b>" + (cc > 0 ? esc(money(cc)) : "—") + "</b>";
        var d = st.querySelectorAll(".prc-dim"); if(d[0]) d[0].textContent = xv > 0 ? qty(xv) : "—"; if(d[1]) d[1].textContent = sv > 0 ? qty(sv) : "—";
      });
      prcPaintSubs(tr.dataset.prcrow);
      if(canEdit()) prcQueueX(tr.dataset.prcrow, e.target === xIn ? "xCost" : "shipCost", e.target === xIn ? xv : sv);
      return;
    }
    var cost = Number(tr.dataset.cost)||0;
    if(e.target === mIn && cost > 0){
      var mk = Number(toEn(mIn.value));
      // خانة فاضية = مش بتصفّر السعر، بتستنى لحد ما يكتب
      if(mIn.value.trim() === "" || !isFinite(mk)) return;
      pIn.value = (cost * (1 + mk/100)).toFixed(2);
    } else if(e.target === pIn && mIn){
      var pr = Number(toEn(pIn.value));
      mIn.value = (pIn.value.trim() === "" || !isFinite(pr)) ? "" : (prcMarkup(pr, cost)*100).toFixed(1);
    } else if(e.target !== pIn) return;
    var val = Number(toEn(pIn.value))||0;
    prcPaint(tr, val);
    prcPaintSubs(tr.dataset.prcrow);
    if(canEdit()) prcQueue(tr.dataset.prcrow, val);
  });
  document.getElementById("t-price").addEventListener("click", function(e){
    var b = e.target.closest("[data-prctog]"); if(!b) return;
    var id = b.dataset.prctog, open = !prcOpen[id];
    prcOpen[id] = open;
    b.setAttribute("aria-expanded", open);
    b.textContent = (open ? "▴" : "▾") + b.textContent.slice(1);
    Array.prototype.forEach.call(this.querySelectorAll("tr[data-prcsub='" + CSS.escape(id) + "']"), function(tr){ tr.hidden = !open; });
  });
  document.getElementById("t-price").addEventListener("change", function(e){
    if(e.target.matches("[data-prccp]")){
      if(!canEdit()){ toast("مالكش صلاحية التعديل"); return; }
      prcFlushC(); return;
    }
    var tr = e.target.closest("tr[data-prcrow]"); if(!tr) return;
    if(!canEdit()){ toast("مالكش صلاحية التعديل"); return; }
    // من غير إعادة رسم: السطر بيتحدّث وانت بتكتب، والرسم من جديد كان بيضيّع الخانة اللي نقلت لها
    if(e.target.matches("[data-prcx],[data-prcs]")){ prcFlushX(); return; }
    prcQueue(tr.dataset.prcrow, Number(toEn(tr.querySelector("[data-prcprice]").value))||0);
    prcFlush();
  });
  // سبت الشاشة والتأخير لسه شغال؟ يتكتب قبل ما تمشي
  window.addEventListener("beforeunload", function(){ prcFlush(); prcFlushX(); prcFlushC(); });
  document.getElementById("nav").addEventListener("click", function(){ prcFlush(); prcFlushX(); prcFlushC(); }, true);

  document.getElementById("prc-q").addEventListener("input", function(){
    prcFilt.q = this.value; renderPricing();
  });
  document.getElementById("prc-quick").addEventListener("click", function(e){
    var b = e.target.closest("[data-prconly]"); if(!b) return;
    prcFilt.only = b.dataset.prconly;
    Array.prototype.forEach.call(this.querySelectorAll("button"), function(x){
      x.classList.toggle("on", x === b); });
    renderPricing();
  });
  // التسعير بالجملة: بيمشي على اللي ظاهر قدامك بس — مش على كل الداتا
  document.getElementById("b-prc-apply").addEventListener("click", function(){
    if(!canEdit()){ toast("مالكش صلاحية التعديل"); return; }
    var box = document.getElementById("prc-bulk-pct");
    var pct = Number(toEn(box.value));
    if(box.value.trim() === "" || !isFinite(pct)){ toast("اكتب نسبة الزيادة الأول"); return; }
    var step = Number(document.getElementById("prc-bulk-round").value)||0;
    var hit = 0, skip = 0;
    prcList().forEach(function(r){
      if(r.cost <= 0){ skip++; return; }
      var base = prcRound(r.cost * (1 + pct/100), step);
      prcCommit(r.it.id, base);
      // صنف بأكتر من لون: كل لون اشتريته بيتسعّر على تكلفته هو، عشان اللون الغالي ما يتباعش تحت تكلفته
      if(r.cols){
        var cp = Object.assign({}, r.it.cprice || {}), was = JSON.stringify(cp);
        r.cols.forEach(function(k){
          if(!k.color || !k.own || !(k.cost > 0)) return;
          var v = prcRound(k.cost * (1 + pct/100), step);
          if(Math.abs(v - base) < 0.005) delete cp[k.color]; else cp[k.color] = v;
        });
        if(JSON.stringify(cp) !== was){ r.it.cprice = cp; r.it.at = Date.now(); r.it.editedBy = me || "غير محدد"; saveSoon("items"); }
      }
      hit++;
    });
    renderPricing();
    dirtyTabs.dash = 1; dirtyTabs.rep = 1; dirtyTabs.inv = 1; dirtyTabs.items = 1;
    toast(hit ? ("اتسعّر " + qty(hit) + " صنف" +
                 (skip ? " · " + qty(skip) + " من غير تكلفة اتساب زي ما هو" : ""))
              : "مفيش صنف له تكلفة شراء في اللي ظاهر");
  });

  /* ---------- 🧮 احسب أوردر ----------
     حسبة بس — مفيش حاجة بتتسجّل في الدفاتر. بتاخد من كل صنف تكلفة القطعة الواصلة
     (avgCost) + «المصاريف الإضافية» اللي في جدول الأسعار، والشحن مرة على الأوردر.
     آخر حسبة بتتفتكر على الجهاز ده بس (naya:calc). */
  var pcTab = "list";
  var pc = (function(){
    try{ var o = JSON.parse(LS && LS.getItem("naya:calc") || "null"); if(o && Array.isArray(o.lines)) return o; }catch(e){}
    return null;
  })() || { lines:[{ itemId:"", qty:1, price:"", manual:false }], disc:"", sin:"", sout:"" };
  function pcSave(){ try{ if(LS) LS.setItem("naya:calc", JSON.stringify(pc)); }catch(e){} }
  function pcItem(id){ return db.items.find(function(x){ return x.id === id && !x.deleted; }); }
  function pcCalc(){
    var goods = 0, cogs = 0, extra = 0, pcs = 0, rows = [];
    pc.lines.forEach(function(l){
      var it = pcItem(l.itemId), q = Math.max(0, Number(toEn(l.qty))||0);
      // لون متحدد = تكلفة اللون ده بس، من غير لون = متوسط الصنف كله
      var cols = it ? pcCols(it.id) : [], col = cols.length > 1 && cols.indexOf(squish(l.color)) >= 0 ? squish(l.color) : "";
      var buy = it ? (col ? costOfColor(it.id, col).c : avgCost(it.id)) : 0, x = it ? prcExtra(it) : 0;
      // السعر من نفس اللون اللي التكلفة اتحسبت عليه — مش من لون قديم متخزّن
      var price = l.manual ? (Number(toEn(l.price))||0) : it ? priceFor(it, col, Math.max(1, Number(l.qty)||1)).u : 0;
      var r = { it:it, q:q, price:price, buy:buy, x:x, unit:price - buy - x, cols:cols, col:col };
      r.profit = q * r.unit; r.mg = price > 0 ? r.unit / price : null;
      r.noCost = !!it && q > 0 && !(buy > 0);
      rows.push(r);
      // صنف لسه ما اشتريتهوش: تكلفته مش معروفة — بره الحسبة بدل ما يطلع كله ربح
      if(!it || !q || r.noCost) return;
      goods += q * price; cogs += q * buy; extra += q * x; pcs += q;
    });
    var noCost = rows.filter(function(r){ return r.noCost; });
    var disc = Math.max(0, Number(toEn(pc.disc))||0), sin = Math.max(0, Number(toEn(pc.sin))||0), sout = Math.max(0, Number(toEn(pc.sout))||0);
    var pays = goods - disc + sin, profit = goods - disc - cogs - extra + sin - sout;
    return { rows:rows, noCost:noCost, goods:goods, cogs:cogs, extra:extra, pcs:pcs, disc:disc, sin:sin, sout:sout, pays:pays, profit:profit,
             mg: goods - disc > 0 ? profit / (goods - disc) : null, floor: profit + disc };
  }
  function renderPcLines(){
    var box = document.getElementById("pc-lines"); if(!box) return;
    pc.lines.forEach(function(l){ if(l.itemId && !pcItem(l.itemId)){ l.itemId = ""; l.color = ""; l.manual = false; l.price = ""; } });
    var items = live("items").slice().sort(function(a, b){ return (a.name||"") < (b.name||"") ? -1 : 1; });
    box.innerHTML = "<div class='pc-ln hd'><span>الصنف</span><span style='text-align:center'>التكلفة</span><span>العدد</span><span>سعر القطعة</span><span style='text-align:end'>ربح السطر</span><span></span></div>" +
      pc.lines.map(function(l, i){
        return "<div class='pc-ln' data-pci='" + i + "'>" +
          "<div class='pc-sel'><select data-pcf='itemId' aria-label='الصنف'><option value=''>اختار صنف…</option>" +
            items.map(function(x){ return "<option value='" + esc(x.id) + "'" + (x.id === l.itemId ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") +
          "</select>" + pcColorSel(l) + "</div>" +
          "<span class='pc-c num' data-pcc='" + i + "'></span>" +
          "<input data-pcf='qty' inputmode='decimal' value='" + esc(l.qty) + "' aria-label='العدد'>" +
          "<div><input data-pcf='price' inputmode='decimal' value='" + esc(l.manual ? l.price : "") + "' aria-label='سعر القطعة'><span class='pc-tier' data-pct='" + i + "'></span></div>" +
          "<span class='pc-p num' data-pcp='" + i + "'></span>" +
          "<button type='button' class='rm' data-pcrm='" + i + "' aria-label='شيل السطر'" + (pc.lines.length > 1 ? "" : " hidden") + ">&times;</button>" +
        "</div>";
      }).join("");
    ["pc-disc","pc-sin","pc-sout"].forEach(function(id){
      var el = document.getElementById(id), k = id.slice(3);
      if(el && document.activeElement !== el) el.value = pc[k] || "";
    });
  }
  // خانة اللون بتظهر بس للصنف اللي ليه أكتر من لون، وجنب كل لون فاضل منه كام
  function pcCols(itemId){ return itemColors(itemId).filter(Boolean); }
  function pcColorSel(l){
    var cols = l.itemId ? pcCols(l.itemId) : [];
    if(cols.length < 2) return "";
    var cur = squish(l.color);
    return "<select data-pcf='color' class='pc-col' aria-label='اللون'><option value=''>كل الألوان (متوسط)</option>" +
      cols.map(function(c){
        var n = Math.max(0, colorQty(l.itemId, c, freeOfV));
        return "<option value='" + esc(c) + "'" + (c === cur ? " selected" : "") + ">" + esc(c) + " — " + (n > 0 ? "فاضل " + qty(n) : "خلصان") + "</option>";
      }).join("") + "</select>";
  }
  function renderPcRes(){
    var c = pcCalc();
    c.rows.forEach(function(r, i){
      var ce = document.querySelector("[data-pcc='" + i + "']"), pe = document.querySelector("[data-pcp='" + i + "']");
      var te = document.querySelector("[data-pct='" + i + "']"), pin = document.querySelector("[data-pci='" + i + "'] [data-pcf='price']");
      var cnote = r.cols.length > 1 ? (r.col ? (costOfColor(r.it.id, r.col).own ? "تكلفة " + r.col : "متوسط الصنف — اللون ده ما اتشراش")
                                             : "متوسط كل الألوان") : "";
      if(ce) ce.innerHTML = r.it ? (r.buy > 0 ? esc(money(r.buy + r.x)) + (r.x > 0 ? "<small>" + esc(qty(r.buy)) + " + " + esc(qty(r.x)) + " مصاريف</small>" : "") +
                                                (cnote ? "<small" + (r.col ? "" : " class='pc-avg'") + ">" + esc(cnote) + "</small>" : "")
                                              : "<span class='v-due'>لسه ما اشتريتش</span>") : "—";
      if(pin && !pc.lines[i].manual) pin.placeholder = r.it ? String(Math.round(r.price * 100) / 100) : "0";
      if(te){ var it = r.it, base = it ? Number(it.price)||0 : 0, ln = pc.lines[i];
        te.textContent = (ln.manual || !it) ? "" : colorPrice(it, r.col) > 0 ? "سعر " + r.col
          : r.price < base - 0.009 ? "سعر جملة" : ""; }
      if(pe) pe.innerHTML = r.noCost ? "<small class='v-due'>التكلفة مش معروفة — بره الحسبة</small>" : r.it && r.q ? "<b class='" + (r.profit >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(r.profit)) + "</b>" +
        (r.mg !== null ? "<small>" + (r.mg * 100).toFixed(1) + "% هامش</small>" : "") : "—";
    });
    var el = document.getElementById("pc-res"); if(!el) return;
    var ncw = c.noCost.length ? "<p class='hintline bad' style='margin:0 0 8px'>⚠ " + c.noCost.map(function(r){ return esc(r.it.name); }).join(" · ") +
      " لسه ما اشتريتهوش — تكلفته مش معروفة فمش داخل في الحسبة.</p>" : "";
    if(!c.pcs){ el.innerHTML = ncw + "<p class='hint' style='margin:0'>اختار صنف واكتب العدد — والربح هيظهر هنا.</p>"; return; }
    var pos = Math.max(0, c.profit), tot = c.cogs + c.extra + c.sout + pos;
    var seg = function(v, col){ return tot > 0 && v > 0 ? "<i style='width:" + (v / tot * 100).toFixed(2) + "%;background:" + col + "'></i>" : ""; };
    var OP = opNow();
    var R = function(t, v, cls, sign){ return "<div class='pc-row" + (cls === "t" ? " t" : "") + "'><span>" + esc(t) + "</span><b class='num" + (cls && cls !== "t" ? " " + cls : "") + "'>" + (sign || "") + esc(money(v)) + "</b></div>"; };
    el.innerHTML = ncw + "<div class='hint' style='margin:0'>صافي ربح الأوردر</div>" +
      "<div class='big'><span class='hint' style='margin:0'>" + (c.mg !== null ? "هامش " + (c.mg * 100).toFixed(1) + "%" : "") + "</span>" +
        "<b class='num " + (c.profit >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(c.profit)) + "</b></div>" +
      "<div class='pc-bar'>" + seg(c.cogs, "var(--s-goods)") + seg(c.extra, "var(--ink-soft)") + seg(c.sout, "var(--s-ship)") + seg(pos, "var(--gain)") + "</div>" +
      "<div class='pc-lg'><span><em style='background:var(--s-goods)'></em>البضاعة</span><span><em style='background:var(--ink-soft)'></em>مصاريف</span>" +
        "<span><em style='background:var(--s-ship)'></em>شحن</span><span><em style='background:var(--gain)'></em>ربحك</span></div>" +
      "<div style='margin-top:10px'>" +
        R("البضاعة (" + qty(c.pcs) + " قطعة)", c.goods) +
        (c.disc ? R("− خصم", c.disc, "v-due") : "") +
        (c.sin ? R("+ شحن على العميل", c.sin) : "") +
        R("العميل هيدفع", c.pays, "t") +
        R("− تكلفة البضاعة", c.cogs, "v-due") +
        (c.extra ? R("− مصاريف إضافية", c.extra, "v-due") : "") +
        (c.sout ? R("− شحن للشركة", c.sout, "v-due") : "") +
        "<div class='pc-row t'><span>صافي ربحك</span><b class='num " + (c.profit >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(c.profit)) + "</b></div>" +
        (OP.per > 0.009 ? "<details class='pc-op'" + (pcOpOpen ? " open" : "") + "><summary>" + R("− تكلفة التشغيل (" + OP.per.toFixed(2) + " للقطعة)", c.pcs * OP.per, "v-due") + "</summary>" +
            "<div class='pc-opd'>" + opParts(OP).map(function(x){ return "<span>" + esc(x[0]) + "</span><b class='num'>" + esc(money(x[1])) + "</b>"; }).join("") +
            "<small>من " + esc(dShort(OP.r.from)) + " لحد النهارده: " + esc(money(OP.total)) + " ÷ " + qty(OP.pcs) + " قطعة اتباعت</small></div></details>" +
          "<div class='pc-row t'><span>صافي بعد تكلفة التشغيل</span><b class='num " + (c.profit - c.pcs * OP.per >= 0 ? "v-gain" : "v-due") + "'>" +
          esc(money(c.profit - c.pcs * OP.per)) + "</b></div>"
          : OP.pcs <= 0.009 && OP.total > 0.009 ? "<p class='hintline' style='margin:4px 0 0'>تكلفة التشغيل مش محسوبة — مفيش بيع من أول الشهر اللي فات نقسم عليه.</p>" : "") +
      "</div>" +
      "<div class='pc-floor'>" + (c.floor - c.pcs * OP.per > 0.009
        ? "أقصى خصم من غير خسارة" + (OP.per > 0.009 ? " (بعد تكلفة التشغيل)" : "") + ": <b class='num'>" + esc(money(c.floor - c.pcs * OP.per)) + "</b> — يعني العميل يدفع <b class='num'>" + esc(money(c.pays + c.disc - c.floor + c.pcs * OP.per)) + "</b> بس."
        : c.floor > 0.009 ? "<span class='v-due'>الأوردر ده ما بيغطيش تكلفة التشغيل (" + esc(money(c.pcs * OP.per)) + ") حتى من غير خصم — ارفع السعر أو قلّل الشحن اللي بتدفعه.</span>"
        : "<span class='v-due'>الأوردر ده خسران حتى من غير خصم — ارفع السعر أو قلّل الشحن اللي بتدفعه.</span>") + "</div>" +
      "<div class='pc-btns'><button class='tbtn' type='button' id='b-pc-clear'>فضّي الحاسبة</button>" +
        "<button class='tbtn primary' type='button' id='b-pc-order'>اعمل منه أوردر ←</button></div>" +
      "<p class='hintline' style='margin:6px 0 0'>«اعمل منه أوردر» بيفتح درج أوردر جديد بالأصناف والأسعار دي — ومش بيتسجّل غير لما تدوس حفظ هناك.</p>";
  }
  function renderPcalc(){ renderPcLines(); renderPcRes(); }
  function setPrcTab(t){
    pcTab = t;
    document.querySelectorAll("#prc-tabs [data-prctab]").forEach(function(b){ b.classList.toggle("on", b.dataset.prctab === t); });
    document.getElementById("prc-calc").hidden = t !== "calc";
    document.getElementById("prc-listview").hidden = t === "calc";
    if(t === "calc") renderPcalc();
  }
  document.getElementById("prc-tabs").addEventListener("click", function(e){
    var b = e.target.closest("[data-prctab]"); if(b) setPrcTab(b.dataset.prctab);
  });
  var pcEdit = function(e){
    var row = e.target.closest("[data-pci]"), f = e.target.dataset.pcf;
    if(!row || !f) return;
    var l = pc.lines[Number(row.dataset.pci)]; if(!l) return;
    if(f === "price"){ l.price = e.target.value; l.manual = e.target.value.trim() !== ""; }
    else l[f] = e.target.value;
    if(f === "itemId"){ l.manual = false; l.price = ""; l.color = ""; if(!(Number(l.qty) > 0)) l.qty = 1; pcSave(); renderPcalc(); return; }
    // لون جديد = سعره هو، حتى لو كنت كاتب سعر بإيدك للون اللي قبله
    if(f === "color"){ l.manual = false; l.price = ""; var pin = row.querySelector("[data-pcf='price']"); if(pin) pin.value = ""; }
    pcSave(); renderPcRes();
  };
  document.getElementById("pc-lines").addEventListener("input", pcEdit);
  document.getElementById("pc-lines").addEventListener("change", pcEdit);
  document.getElementById("pc-lines").addEventListener("click", function(e){
    var b = e.target.closest("[data-pcrm]"); if(!b) return;
    pc.lines.splice(Number(b.dataset.pcrm), 1);
    if(!pc.lines.length) pc.lines = [{ itemId:"", qty:1, price:"", manual:false }];
    pcSave(); renderPcalc();
  });
  document.getElementById("b-pc-add").addEventListener("click", function(){
    pc.lines.push({ itemId:"", qty:1, price:"", manual:false }); pcSave(); renderPcalc();
    var s2 = document.querySelectorAll("#pc-lines [data-pcf='itemId']"); if(s2.length) s2[s2.length - 1].focus();
  });
  ["pc-disc","pc-sin","pc-sout"].forEach(function(id){
    document.getElementById(id).addEventListener("input", function(){ pc[id.slice(3)] = this.value; pcSave(); renderPcRes(); });
  });
  document.getElementById("pc-res").addEventListener("click", function(e){
    if(e.target.id === "b-pc-clear"){
      pc = { lines:[{ itemId:"", qty:1, price:"", manual:false }], disc:"", sin:"", sout:"" };
      pcSave(); renderPcalc(); return;
    }
    if(e.target.id === "b-pc-order"){
      var c = pcCalc(), lines = [];
      // السعر اللي اتكتب بإيدك بيفضل ثابت؛ غير كده الدرج بيحسب السعر تاني لو اخترت لون أو غيّرت العدد
      c.rows.forEach(function(r, i){ if(r.it && r.q) lines.push({ itemId:r.it.id, color:r.col || "", size:"", qty:r.q,
        price:Math.round(r.price * 100) / 100, ret:"", manual:!!pc.lines[i].manual }); });
      if(!lines.length){ toast("اختار صنف الأول"); return; }
      if(!canEdit()){ toast("مالكش صلاحية تضيف أوردرات"); return; }
      editing.sales = null; clearEditBase("sales");
      draft = newDraft(draft);
      draft.lines = lines; draft.shipIn = c.sin || ""; draft.shipOut = c.sout || "";
      goTab("sales"); openDrawer();
      toast(c.disc ? "الأوردر اتفتح — الأوردر مالوش خانة خصم، فنزّل الـ" + money(c.disc) + " من أسعار القطع، واختار اللون والمقاس واحفظ"
                   : "الأوردر اتفتح بالأصناف دي — اختار العميل واللون والمقاس واحفظ", 5200);
    }
  });

