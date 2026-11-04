  /* ================= شركات الشحن ================= */
  /* الشركة بتحصّل من العميل بدالك، فالفلوس اللي جمّعتها بتبقى «عندها ليك».
     عمولتها بتتخصم من نفس الفلوس دي مش من خزنتك، واللي يفضل بتوصّهولك
     وساعتها بتتسجّل «سحب من شركة شحن» فتدخل الخزنة.
     كل الحسابات هنا بتقرا من walletOf/shipBuckets اللي الخزنة شغالة بيهم
     عشان الأرقام ما تختلفش من شاشة لشاشة. */
  var shipFor = null;            // الشركة المفتوح كشفها

  function shipCoStats(co){
    var name = squish(co), o = { n:0, open:0, collected:0, fees:0, feesAll:0, drawn:0,
                                 chargedIn:0, pocket:0, due:0 };
    live("sales").forEach(function(s){
      if(squish(s.shipCo) !== name) return;
      if(!viaShip(s) && !shipIn(s) && !shipOut(s)) { o.n++; return; }
      o.n++;
      if(viaShip(s)){
        if(!isCancelled(s)) o.collected += Number(s.paid)||0;
        else o.collected += shipIn(s);
        if(isDelivered(s)) o.due += saleTotal(s) + shipIn(s) - (Number(s.paid)||0);
        else if(!isCancelled(s)) o.open++;
      }
      if(shipCounts(s)){
        o.feesAll += shipOut(s); o.chargedIn += shipIn(s);
        // الأوردر المباشر شحنه بيتدفع من الخزنة — مش بيتخصم من محفظتها
        if(viaShip(s)) o.fees += shipOut(s);
      }
    });
    live("cash").forEach(function(c){
      if(c.type === "settle" && squish(c.shipCo) === name) o.drawn += Number(c.amount)||0;
    });
    o.pocket = o.feesAll - o.chargedIn;         // موجب = من جيبك
    /* لك في محفظتها = حصّلت − عمولتها − استلمته = walletOf بالظبط.
       قبل كده كان بيخصم شحن أوردرات التحصيل المباشر كمان، مع إن ده
       بيتدفع من الخزنة، فالرصيد كان بيطلع أقل من الحقيقي لو الشركة
       عندها النوعين. */
    o.bal = walletOf(name);
    return o;
  }
  function shipCoLabel(co){
    return squish(co) || "⚠ من غير اسم شركة";
  }

  var SHIP_HEAD = ["شركة الشحن","أوردرات","حصّلت من العملاء","عمولتها","استلمته منها",
                   "لك عندها","شحن من جيبك","قطع راجعة عندها",""];


  /* ---------- بضاعة راجعة عند شركة الشحن ----------
     المعاينة: العميل بيشوف المنتج قبل ما يستلم. رفضه؟ يرجّعه لمندوب
     شركة الشحن ويدفع الشحن بس. فالبضاعة بتقعد عند الشركة لحد ما
     تستلمها — هي لسه ملكك ومحسوبة في المخزون (ما اتباعتش)، بس
     مكانها مش مخزنك، وده اللي الشاشة دي بتتابعه.

     backAt = تاريخ ما رجعت مخزنك. فاضي = لسه عندهم.
     مافيش أي أثر محاسبي هنا — الكميات دي أصلاً ما اتشالتش من المخزون،
     فالميزانية ما بتتحركش. ده تتبّع مكان بس. */
  /* الأوردر الواحد ممكن العميل ياخد منه صنف ويرجّع صنف. فالحالة
     على مستوى **السطر** مش الفاتورة: كل سطر بيعرف كام رجع منه وكام
     رجع مخزنك. الحالة دي مستنتجة من الأرقام مش محفوظة كحالة لوحدها،
     فمفيش حالة ممكن تتعارض مع الأرقام. */
  function lineBack(l, s){
    // الشكل القديم كان تاريخ واحد على الفاتورة كلها
    return l.backAt || (s && s.backAt) || "";
  }
  function lineHeld(l, s){
    if(isCancelled(s)) return Number(l.qty)||0;   // اترفض كله
    if(isDelivered(s)) return lineRet(l);         // رجّع جزء
    return 0;                                     // لسه جاري — ما رجعش حاجة
  }
  // حالة السطر بالعربي: خدها · راجعة عند الشركة · رجعت المخزن
  function lineState(l, s){
    var q = Number(l.qty)||0, h = lineHeld(l, s), kept = q - h;
    if(!isDelivered(s) && !isCancelled(s))
      return squish(s.shipCode)
        ? { k:"way", t:"مع شركة الشحن", sub:"لسه ما اتسلّمتش", cls:"progress" }
        : { k:"prep", t:"لسه ما اتبعتش", sub:"عندك في المخزن", cls:"proposed" };
    if(h <= 0) return { k:"kept", t:"العميل خدها", sub:"", cls:"delivered" };
    var back = !!lineBack(l, s);
    return { k: back ? "back" : "held",
             t: back ? "رجعت المخزن" : "راجعة عند شركة الشحن",
             sub: (kept > 0 ? "خد " + qty(kept) + " ورجّع " + qty(h) : "رجّع " + qty(h)) +
                  (back ? " · " + lineBack(l, s) : ""),
             cls: back ? "delivered" : "cancelled" };
  }
  function heldPieces(s){
    return SL(s).reduce(function(a, l){ return a + lineHeld(l, s); }, 0);
  }
  // شحنت فعلاً؟ من غير شركة شحن البضاعة ما راحتش لحد
  function heldShipped(s){
    if(s.selfDel || s.preCancel) return false;                       // اتلغى قبل الشحن: مفيش حاجة عند الشركة
    return !!(squish(s.shipCo) || shipOut(s) || shipIn(s) || viaShip(s));
  }
  // سطر لكل صنف راجع — مش سطر لكل فاتورة، عشان الصنف بيرجع لوحده
  function heldList(){
    var out = [];
    live("sales").forEach(function(s){
      if(!heldShipped(s)) return;
      SL(s).forEach(function(l, i){
        var n = lineHeld(l, s);
        if(n > 0) out.push({ s:s, l:l, i:i, n:n, back:lineBack(l, s) });
      });
    });
    return out.sort(function(a, b){ return byDate(a.s, b.s); });
  }
  function heldOpen(){ return heldList().filter(function(x){ return !x.back; }); }
  function heldOpenQty(){
    return heldOpen().reduce(function(a, x){ return a + x.n; }, 0);
  }
  // القطع المعلّقة عند شركة معيّنة
  function heldQtyFor(co){
    var nm = squish(co);
    return heldOpen().reduce(function(a, x){
      return a + (squish(x.s.shipCo) === nm ? x.n : 0); }, 0);
  }
  function heldWhat(x){
    var l = x.l;
    return qty(x.n) + " × " + itemName(l.itemId) +
           (vLabel(vColor(l), vSize(l)) ? " · " + vLabel(vColor(l), vSize(l)) : "");
  }

  var heldFilt = "open";
  var HELD_HEAD = ["الأوردر","التاريخ","العميل","شركة الشحن","الصنف الراجع","قطع","الحالة",""];

  function renderHeld(){
    var all = heldList();
    var list = all.filter(function(x){
      if(heldFilt === "open") return !x.back;
      if(heldFilt === "back") return !!x.back;
      return true;
    });
    var ed = canEdit();
    var rows = list.map(function(x){
      var s = x.s, key = esc(s.id) + "|" + x.i;
      return "<tr>" +
        "<td class='num'>" + (s.no ? "#" + esc(s.no) : "—") + "</td>" +
        "<td class='num'>" + esc(s.date || "—") + "</td>" +
        "<td class='wide'>" + esc(partyName(s.partyId)) + "</td>" +
        "<td>" + esc(shipCoLabel(s.shipCo)) + "</td>" +
        "<td class='wide'>" + esc(heldWhat(x)) +
          "<span class='sub'>" + (isCancelled(s) ? "الأوردر اترفض كله" : "العميل خد باقي الأوردر") + "</span></td>" +
        "<td class='num'>" + esc(qty(x.n)) + "</td>" +
        "<td>" + (x.back
          ? "<span class='st st-delivered'>رجعت المخزن</span><span class='sub'>" + esc(x.back) + "</span>"
          : "<span class='st st-cancelled'>عند الشركة</span>") + "</td>" +
        "<td>" + (ed
          ? (x.back
              ? "<button class='del' data-heldback='" + key + "' data-undo='1'>تراجع</button>"
              : "<button class='del' style='color:var(--teal)' data-heldback='" + key + "'>رجعت المخزن</button>")
          : "") + "</td></tr>";
    });
    table("t-held", HELD_HEAD, rows,
      heldFilt === "back" ? "لسه ما استلمتش حاجة راجعة."
        : (all.length ? "مفيش بضاعة معلّقة — كله رجع المخزن."
                      : "مفيش بضاعة راجعة. أول ما عميلة ترفض صنف هتلاقيه هنا."));
  }

  document.getElementById("held-quick").addEventListener("click", function(e){
    var b = e.target.closest("[data-heldonly]"); if(!b) return;
    heldFilt = b.dataset.heldonly;
    Array.prototype.forEach.call(this.querySelectorAll("button"), function(x){
      x.classList.toggle("on", x === b); });
    renderHeld();
  });
  function markLineBack(saleId, li, undo){
    var s = db.sales.find(function(x){ return x.id === saleId; });
    if(!s) return false;
    var l = SL(s)[li]; if(!l) return false;
    /* التاريخ القديم كان على الفاتورة. أول ما نلمس سطر واحد، بنوزّعه
       على كل السطور الراجعة الأول عشان الباقي ما يرجعش «عند الشركة». */
    if(s.backAt){
      SL(s).forEach(function(x){ if(lineHeld(x, s) > 0 && !x.backAt) x.backAt = s.backAt; });
      delete s.backAt;
    }
    if(undo) delete l.backAt; else l.backAt = today();
    s.at = Date.now(); s.editedBy = me || "غير محدد";
    saveSoon("sales");
    return true;
  }
  // الزرار موجود في مكانين: جدول شركات الشحن وتفاصيل الأوردر
  document.body.addEventListener("click", function(e){
    var btn = e.target.closest("[data-heldback]"); if(!btn) return;
    e.stopPropagation();
    if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
    var parts = String(btn.dataset.heldback).split("|");
    if(!markLineBack(parts[0], Number(parts[1]), !!btn.dataset.undo)) return;
    toast(btn.dataset.undo ? "رجعت لـ«عند الشركة»" : "اتسجّل إنها رجعت المخزن");
    if(activeTab === "sales") renderSales(); else { renderShipCards(); renderHeld(); renderShipCos(); }
    ["inv","log","ship","sales"].forEach(function(t){ dirtyTabs[t] = 1; });
    delete dirtyTabs[activeTab];
  });


  /* ---------- كروت شركات الشحن: كل كارت بيتفتح على تفاصيله ----------
     نفس سلوك كروت لوحة المتابعة والمخزون. كل تفصيلة بتتحسب من نفس
     الدوال اللي الكارت بيستعملها، فالإجمالي تحت = الرقم فوق بالظبط. */
  var shKpiOpen = null;
  var SH_TITLE = { cos:"شركات شغالة", wallet:"لك في المحافظ — الفلوس جت منين",
                   pocket:"شحن من جيبك — أوردر أوردر", open:"أوردرات مع شركات الشحن",
                   held:"قطع راجعة عند شركات الشحن" };
  var SH_DETAIL = {
    cos: function(){
      var rows = shipBuckets().map(function(co){
        var o = shipCoStats(co), last = live("sales").filter(function(s){
          return squish(s.shipCo) === squish(co); }).sort(byDate)[0];   // byDate = الأحدث الأول
        return "<tr><td class='wide'>" + esc(shipCoLabel(co)) + "</td>" +
          "<td class='num'>" + qty(o.n) + "</td>" +
          "<td class='num'>" + qty(o.open) + "</td>" +
          "<td class='num " + (o.bal > 0.009 ? "v-gain" : "") + "'>" + money(o.bal) + "</td>" +
          "<td class='num'>" + (heldQtyFor(co) ? qty(heldQtyFor(co)) : "—") + "</td>" +
          "<td class='num'>" + (last ? esc(last.date || "—") : "—") + "</td></tr>";
      });
      return { note:"كل شركة شحن ليها حركة مسجّلة. دوس على الشركة في الجدول تحت عشان تشوف كشفها بالتفصيل.",
               head:["الشركة","أوردرات","لسه عندهم","لك عندها","قطع راجعة","آخر أوردر"], rows:rows };
    },
    wallet: function(){
      var list = live("sales").filter(function(s){
        return viaShip(s) && (Number(s.paid)||0) + shipIn(s) + shipOut(s) > 0.009 &&
               (isCancelled(s) ? shipIn(s) : (Number(s.paid)||0)) + (shipCounts(s) ? shipOut(s) : 0) > 0.009;
      }).sort(byDate);
      var tIn = 0, tFee = 0, tLeft = 0;
      var rows = list.map(function(s){
        var got = isCancelled(s) ? shipIn(s) : (Number(s.paid)||0);
        var fee = shipCounts(s) ? shipOut(s) : 0;
        var left = shipPend(s).left;
        tIn += got; tFee += fee; tLeft += left;
        return "<tr><td class='num'>" + oLink(s) + "</td><td class='num'>" + esc(s.date || "—") + "</td>" +
          "<td class='wide'>" + esc(partyName(s.partyId)) + "</td><td>" + esc(shipCoLabel(s.shipCo)) + "</td>" +
          "<td class='num v-gain'>" + money(got) + "</td><td class='num v-due'>" + money(fee) + "</td>" +
          "<td class='num'>" + money(got - fee) + "</td>" +
          "<td class='num" + (left > 0.009 ? " v-gain" : "") + "'>" + (left > 0.009 ? money(left) : "وصلك") + "</td></tr>";
      });
      var drawn = live("cash").reduce(function(a, c){
        return a + (c.type === "settle" ? (Number(c.amount)||0) : 0); }, 0);
      if(rows.length) rows.push(sumRow(["الإجمالي","","","",
        "<b>"+money(tIn)+"</b>","<b>"+money(tFee)+"</b>","<b>"+money(tIn - tFee)+"</b>","<b>"+money(tLeft)+"</b>"]));
      return { note:"العميل بيدفع للمندوب، والشركة بتخصم عمولتها وتمسك الباقي لحد ما تستلمه. " +
                 (drawn > 0.009 ? "استلمت منهم لحد دلوقتي " + money(drawn) + " — بيتحسب على الأوردرات الأقدم الأول، " : "") +
                 "فاللي لك عندهم = " + money(tIn - tFee) +
                 (drawn > 0.009 ? " − " + money(drawn) + " = " + money(walletsTotal()) : "") + ".",
               head:["الأوردر","التاريخ","العميل","الشركة","العميل دفع","عمولتها","الصافي","لسه عندها"], rows:rows };
    },
    pocket: function(){
      var list = live("sales").filter(function(s){
        return shipCounts(s) && Math.abs(shipOut(s) - shipIn(s)) > 0.009; })
        .sort(function(a, b){ return (shipOut(b)-shipIn(b)) - (shipOut(a)-shipIn(a)); });
      var ti = 0, to = 0;
      var rows = list.map(function(s){
        var g = shipOut(s) - shipIn(s); ti += shipIn(s); to += shipOut(s);
        return "<tr><td class='num'>" + oLink(s) + "</td><td class='wide'>" + esc(partyName(s.partyId)) + "</td>" +
          "<td>" + esc(shipCoLabel(s.shipCo)) + "</td>" +
          "<td class='num'>" + money(shipIn(s)) + "</td><td class='num'>" + money(shipOut(s)) + "</td>" +
          "<td class='num " + (g > 0 ? "v-due" : "v-gain") + "'>" + (g > 0 ? "" : "+") + money(Math.abs(g)) +
          "<span class='sub'>" + (g > 0 ? "من جيبك" : "ليك") + "</span></td></tr>";
      });
      if(rows.length) rows.push(sumRow(["الإجمالي","","","<b>"+money(ti)+"</b>","<b>"+money(to)+"</b>",
        "<b>"+money(Math.abs(to - ti))+"</b>"]));
      return { note:"الأوردرات اللي اللي حمّلته للعميل فيها مختلف عن اللي دفعته لشركة الشحن. الأكبر من جيبك فوق.",
               head:["الأوردر","العميل","الشركة","حمّلت العميل","دفعت للشركة","الفرق"], rows:rows };
    },
    open: function(){
      var list = live("sales").filter(function(s){
        return viaShip(s) && !isDelivered(s) && !isCancelled(s); }).sort(byDate);
      var rows = list.map(function(s){
        var sp = orderStep(s);
        return "<tr><td class='num'>" + oLink(s) + "</td><td class='num'>" + esc(s.date || "—") + "</td>" +
          "<td class='wide'>" + esc(partyName(s.partyId)) + "</td><td>" + esc(shipCoLabel(s.shipCo)) + "</td>" +
          "<td class='num'>" + (esc(squish(s.shipCode)) || "<span class='v-due'>ناقص</span>") + "</td>" +
          "<td class='num'>" + money(saleTotal(s) + shipIn(s)) + "</td>" +
          "<td>" + esc(stepTxt(sp)) + "</td></tr>";
      });
      return { note:"أوردرات مع شركة الشحن والعميل لسه ما استلمش. دوس على رقم الأوردر تفتحه.",
               head:["الأوردر","التاريخ","العميل","الشركة","كود البوليصة","المطلوب","الخطوة"], rows:rows };
    },
    held: function(){
      var rows = heldOpen().map(function(x){
        return "<tr><td class='num'>" + oLink(x.s) + "</td><td class='num'>" + esc(x.s.date || "—") + "</td>" +
          "<td class='wide'>" + esc(partyName(x.s.partyId)) + "</td><td>" + esc(shipCoLabel(x.s.shipCo)) + "</td>" +
          "<td class='wide'>" + esc(heldWhat(x)) + "</td><td class='num'>" + qty(x.n) + "</td></tr>";
      });
      if(rows.length) rows.push(sumRow(["الإجمالي","","","","","<b>"+qty(heldOpenQty())+"</b>"]));
      return { note:"العميل عاين ورفض والبضاعة لسه عند شركة الشحن. لسه في مخزونك — سجّل «رجعت المخزن» أول ما تستلمها.",
               head:["الأوردر","التاريخ","العميل","الشركة","الصنف الراجع","قطع"], rows:rows };
    }
  };
  function renderShKpiDetail(){
    var pnl = document.getElementById("sh-kpi-panel");
    if(!pnl) return;
    if(!shKpiOpen || !SH_DETAIL[shKpiOpen]){ pnl.hidden = true; return; }
    var d = SH_DETAIL[shKpiOpen]();
    pnl.hidden = false;
    document.getElementById("sh-kpi-title").textContent = SH_TITLE[shKpiOpen];
    document.getElementById("sh-kpi-note").textContent = d.note || "";
    table("t-shkpi", d.head, d.rows, "مفيش حاجة هنا دلوقتي.");
  }
  document.getElementById("sh-stats").addEventListener("click", function(e){
    var c = e.target.closest("[data-shkpi]"); if(!c) return;
    shKpiOpen = (shKpiOpen === c.dataset.shkpi) ? null : c.dataset.shkpi;
    renderShipCos();
    if(shKpiOpen) document.getElementById("sh-kpi-panel").scrollIntoView({ block:"nearest" });
  });
  document.getElementById("sh-stats").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var c = e.target.closest("[data-shkpi]"); if(!c) return;
    e.preventDefault(); c.click();
  });
  document.getElementById("b-shkpi-close").addEventListener("click", function(){
    shKpiOpen = null; renderShipCos();
  });
  document.getElementById("t-shkpi").addEventListener("click", function(e){
    var a = e.target.closest("[data-goorder]"); if(!a) return;
    e.preventDefault(); startEditSale(a.dataset.goorder);
  });

  function renderShipCos(){
    var cos = shipBuckets().map(function(co){
      var o = shipCoStats(co); o.co = co; o.held = heldQtyFor(co); return o;
    }).filter(function(x){ return x.n || x.collected || x.fees || x.drawn || x.held; })
      .sort(function(a,b){ return b.bal - a.bal; });

    var tot = cos.reduce(function(a,x){
      a.bal += x.bal; a.pocket += x.pocket; a.open += x.open; a.due += x.due; return a;
    }, { bal:0, pocket:0, open:0, due:0 });

    document.getElementById("sh-stats").innerHTML = [
      ["cos", "شركات شغالة", qty(cos.length), "", "ليها حركة مسجّلة"],
      ["wallet", "لك في المحافظ", money(tot.bal), tot.bal > 0.009 ? "v-gain" : "",
       "فلوس حصّلوها ولسه ما وصلتكش"],
      ["pocket", tot.pocket >= 0 ? "شحن من جيبك" : "كسبت من الشحن", money(Math.abs(tot.pocket)),
       tot.pocket > 0.009 ? "v-due" : "v-gain",
       tot.pocket >= 0 ? "دفعت للشركات أكتر مما حمّلته للعملاء"
                       : "حمّلت العملاء أكتر مما دفعته للشركات"],
      ["open", "أوردرات عندهم", qty(tot.open), "", "مشحونة ولسه ما اتسلّمتش"],
      ["held", "قطع راجعة عندهم", qty(heldOpenQty()), heldOpenQty() ? "v-due" : "",
       heldOpenQty() ? "عميل عاين ورفض — لسه ما استلمتهاش" : "مفيش بضاعة معلّقة"]
    ].map(function(c){
      return "<div class='kpi" + (shKpiOpen === c[0] ? " on" : "") + "' data-shkpi='" + c[0] + "'" +
        " tabindex='0' role='button'><span>" + esc(c[1]) + "</span>" +
        "<strong class='num " + c[3] + "'>" + esc(c[2]) + "</strong>" +
        "<span class='sub'>" + esc(c[4]) + "</span>" +
        "<span class='kpi-go' aria-hidden='true'>التفاصيل ›</span></div>";
    }).join("");
    renderShKpiDetail();

    var rows = cos.map(function(x){
      return "<tr class='pick' data-shco='"+esc(x.co)+"' tabindex='0'>" +
        "<td class='wide'>" + (squish(x.co) ? esc(x.co)
          : "<span class='v-due'>⚠ من غير اسم شركة</span><span class='sub'>افتح الأوردر واكتب اسم شركة الشحن</span>") + "</td>" +
        "<td class='num'>" + qty(x.n) + "</td>" +
        "<td class='num v-gain'>" + money(x.collected) + "</td>" +
        "<td class='num v-due'>" + money(x.fees) + "</td>" +
        "<td class='num'>" + money(x.drawn) + "</td>" +
        "<td class='num " + (x.bal > 0.009 ? "v-gain" : (x.bal < -0.009 ? "v-due" : "")) + "'>" +
          money(x.bal) + "</td>" +
        "<td class='num " + (x.pocket > 0.009 ? "v-due" : "v-gain") + "'>" +
          money(Math.abs(x.pocket)) + "</td>" +
        "<td class='num " + (x.held ? "v-due" : "") + "'>" +
          (x.held ? qty(x.held) : "—") + "</td>" +
        /* الاستلام كان مستخبّي: لازم تفتح كشف الشركة الأول عشان تلاقيه.
           دلوقتي زرار على السطر نفسه — بيفتح الكشف والمبلغ مكتوب،
           وإنت بتأكّد أو بتغيّر الرقم لو استلمت جزء. */
        "<td>" + (x.bal > 0.009 && squish(x.co) && canEdit()
          ? "<button class='tbtn primary' type='button' data-shdraw='" + esc(x.co) + "'>استلم " +
            esc(money(x.bal)) + "</button>" : "") + "</td></tr>";
    });
    table("t-shipco", SHIP_HEAD, rows,
      "لما تكتب اسم شركة الشحن في الأوردرات، هتلاقي هنا حساب كل شركة بالتفصيل.");
    Array.prototype.forEach.call(
      document.querySelectorAll("#t-shipco tbody tr.pick"), function(tr){
        Array.prototype.forEach.call(tr.children, function(td, i){
          if(SHIP_HEAD[i]) td.setAttribute("data-l", SHIP_HEAD[i]);
        });
      });
    markShipRow();
    renderShipStmt();
  }

  var SHSTMT_HEAD = ["التاريخ","الحركة","البيان","داخل المحفظة","خارج منها","الرصيد"];

  /* حركات محفظة شركة شحن — مصدر واحد للكشف القديم وكارت الشركة */
  function shipStmtEvents(name){
    var ev = [];
    live("sales").forEach(function(s){
      var t = revDate(s) || s.date || "";
      if(viaShip(s) && squish(s.shipCo) === name){
        var got = isCancelled(s) ? shipIn(s) : (Number(s.paid)||0);
        if(Math.abs(got) > 0.009)
          ev.push({ d:t, at:s.at||0, k:"تحصيل",
                    t:"من " + partyName(s.partyId) + " · أوردر #" + (s.no||"—") +
                      (isCancelled(s) ? " (ملغي — شحن بس)" : ""),
                    in:got, out:0, id:s.id });
      }
      if(viaShip(s) && squish(s.shipCo) === name && shipCounts(s) && shipOut(s) > 0.009)
        ev.push({ d:t, at:(s.at||0)+0.5, k:"عمولة",
                  t:"شحن أوردر #" + (s.no||"—") + " · " + partyName(s.partyId),
                  in:0, out:shipOut(s), id:s.id });
    });
    live("cash").forEach(function(c){
      if(c.type !== "settle" || squish(c.shipCo) !== name) return;
      ev.push({ d:c.date||"", at:c.at||0, k:"استلام",
                t:squish(c.note) || "استلمت من الشركة ودخلت الخزنة",
                in:0, out:Number(c.amount)||0, cash:c.id });
    });
    ev.sort(function(a,b){ return a.d !== b.d ? (a.d < b.d ? -1 : 1) : (a.at - b.at); });
    return ev;
  }
  function renderShipStmt(){
    var pnl = document.getElementById("shstmt-panel");
    if(shipFor === null){ pnl.hidden = true; return; }
    var name = squish(shipFor), o = shipCoStats(shipFor);
    pnl.hidden = false;
    document.getElementById("shstmt-title").textContent =
      "كشف حساب: " + shipCoLabel(shipFor);

    /* نفس لغة الأوردر: ٣ أسئلة */
    document.getElementById("shstmt-money").innerHTML =
      "<div class='mbox'><h4>حصّلت كام بدالك؟</h4>" +
        mRow("محصّل من العملاء", o.collected) +
        (o.due > 0.009 ? mRow("لسه هتحصّل", o.due, "", "") : "") +
        "<p class='mnote'>فلوس أوردراتك اللي بتتحصّل عن طريقها.</p></div>" +
      "<div class='mbox'><h4>ليها كام عندك؟</h4>" +
        mRow("عمولة الشحن", o.fees) +
        mRow("حمّلته للعملاء", o.chargedIn, "", "− ") +
        mRow(o.pocket >= 0 ? "من جيبك" : "كسبت من الشحن", Math.abs(o.pocket),
             "tot " + (o.pocket > 0.009 ? "v-due" : "v-gain")) +
        "<p class='mnote'>العمولة بتتخصم من الفلوس اللي عندها مش من خزنتك.</p></div>" +
      "<div class='mbox big'><h4>لك عندها كام؟</h4>" +
        "<div class='mbig num " + (o.bal > 0.009 ? "v-gain" : (o.bal < -0.009 ? "v-due" : "")) + "'>" +
          esc(money(o.bal)) + "</div>" +
        "<p class='mnote'>" + esc(money(o.collected)) + " − " + esc(money(o.fees)) +
          " − " + esc(money(o.drawn)) + " (استلمته)</p></div>";

    var dn = document.getElementById("sh-draw-note");
    var box = document.getElementById("shstmt-draw");
    box.hidden = !(o.bal > 0.009);
    if(dn) dn.textContent = o.bal > 0.009
      ? "لك عندها " + money(o.bal) + " — لما تستلمها بتدخل الخزنة على طول."
      : "";
    var dd = document.getElementById("sh-draw-date");
    if(dd && !dd.value) dd.value = firstOpenDate();
    var da = document.getElementById("sh-draw-amt");
    if(da) da.placeholder = money(Math.max(o.bal, 0));

    /* الحركات: كل أوردر بيضيف تحصيل ويخصم عمولة، وكل استلام بيخصم */
    var ev = shipStmtEvents(name);

    var run = 0;
    var rows = ev.map(function(x){
      run += x.in - x.out;
      return "<tr" + (x.id ? " class='pick' data-shorder='"+esc(x.id)+"'" : "") + ">" +
        "<td class='num'>" + esc(x.d || "—") + "</td>" +
        "<td><span class='st st-" + (x.k === "عمولة" ? "cancelled" :
             (x.k === "استلام" ? "progress" : "delivered")) + "'>" + esc(x.k) + "</span></td>" +
        "<td class='wide'>" + esc(x.t) + "</td>" +
        "<td class='num " + (x.in ? "v-gain" : "") + "'>" + (x.in ? money(x.in) : "—") + "</td>" +
        "<td class='num " + (x.out ? "v-due" : "") + "'>" + (x.out ? money(x.out) : "—") + "</td>" +
        "<td class='num' style='font-weight:600'>" + money(run) + "</td></tr>";
    });
    table("t-shstmt", SHSTMT_HEAD, rows, "مفيش حركات للشركة دي لسه.");
    Array.prototype.forEach.call(
      document.querySelectorAll("#t-shstmt tbody tr"), function(tr){
        Array.prototype.forEach.call(tr.children, function(td, i){
          if(SHSTMT_HEAD[i]) td.setAttribute("data-l", SHSTMT_HEAD[i]);
        });
      });
  }

  // السطر المفتوح كشفه بيتعلّم عشان تعرف إنت واقف فين
  function markShipRow(){
    Array.prototype.forEach.call(
      document.querySelectorAll("#t-shipco tbody tr[data-shco]"), function(tr){
        tr.classList.toggle("on", shipFor !== null && tr.dataset.shco === shipFor);
      });
  }

  /* المناطق اتشالت: كانت جدول تمن أعمدة بيتزحلق أفقياً عشان رقم
     بيتغيّر مرة في السنة. الملء التلقائي بقى من آخر أوردر لنفس
     المحافظة (suggestShipping) — بيتعلّم من شغلك من غير أي إعداد. */
  /* ================= شركات الشحن: كارت لكل شركة =================
     كل رقم من نفس مصادر الشاشة القديمة: walletOf للرصيد، shipPend
     للأوردرات اللي فلوسها عندها، heldOpen للمرتجع، shipStmtEvents
     للكشف — فمجموع الكروت = الجدول القديم بالظبط. */
  var shcOpen = {};                      // {co: "orders"|"held"|"stmt"}
  var shcPart = null;                    // الشركة اللي مفتوح فيها «استلم جزء»
  var shcSel = {};                       // v146: {co: {saleId:1}} — الأوردرات اللي هتستلم فلوسها
  /* ═══ v175 — «ارفع كشف QP» ═══
     الملف زي ما بيجي من QP (Revenue Report). كل سطر بيتطابق بالأوردر برقم البوليصة (أو التليفون لو الكود
     مختلف)، وبيتحسب المفروض يكون إيه على السيستم: المسلّم = المحصّل − مصاريف QP، والمرتجع = − المصاريف.
     الفروق (شحن الشركة · اللي العميل دفعه · اتسلّم/اترفض) بتتعرض قبل التسجيل. الكشف بيتسجّل استلام واحد
     بأوردراته (المرتجع جواه بيتخصم)، والسطر اللي مالوش أوردر (شحنة باسمك مثلًا) مصروف — فاللي بيدخل الخزنة
     = صافي الكشف بالظبط. الاستلامات اللي اتسجّلت باليد لأوردرات الكشف بتتشال. ملف مكرر ما بيتسجّلش تاني. */
  var STM = null;
  async function xlsxRead(buf){
    var u8 = new Uint8Array(buf), dv = new DataView(buf), out = {}, e = -1, td = new TextDecoder();
    for(var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--){ if(dv.getUint32(i, true) === 0x06054b50){ e = i; break; } }
    if(e < 0) throw new Error("مش ملف إكسل");
    var n = dv.getUint16(e + 10, true), off = dv.getUint32(e + 16, true);
    for(var k = 0; k < n; k++){
      var meth = dv.getUint16(off + 10, true), csz = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true),
          xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
      var name = td.decode(u8.subarray(off + 46, off + 46 + nl));
      if(/^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(name)){
        var st = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = u8.slice(st, st + csz);
        out[name] = meth === 0 ? td.decode(data)
          : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      }
      off += 46 + nl + xl + cl;
    }
    var P = new DOMParser(), ss = [], key = Object.keys(out).filter(function(x){ return /worksheets/.test(x); }).sort()[0];
    if(!key) throw new Error("الملف مافيهوش شيت");
    if(out["xl/sharedStrings.xml"]) ss = [].map.call(P.parseFromString(out["xl/sharedStrings.xml"], "application/xml").getElementsByTagName("si"),
      function(si){ return [].map.call(si.getElementsByTagName("t"), function(t){ return t.textContent; }).join(""); });
    return [].map.call(P.parseFromString(out[key], "application/xml").getElementsByTagName("row"), function(r){
      var o = {};
      [].forEach.call(r.getElementsByTagName("c"), function(c){
        var col = (c.getAttribute("r") || "").replace(/\d+/g, ""), t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0], ts = c.getElementsByTagName("t");
        o[col] = t === "s" && v ? (ss[+v.textContent] || "") : (!v && ts.length) ? [].map.call(ts, function(x){ return x.textContent; }).join("") : v ? v.textContent : "";
      });
      return o;
    });
  }
  function stmDate(v){
    v = String(v || "").trim(); if(!v) return "";
    if(/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    if(/^\d+(\.\d+)?$/.test(v)){ var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 864e5); return d.toISOString().slice(0, 10); }
    return "";
  }
  function stmParse(name, rows){
    var hi = rows.findIndex(function(r){ return Object.keys(r).some(function(k){ return String(r[k]).trim() === "Serial"; }); });
    if(hi < 0){
      if(rows.some(function(r){ return Object.keys(r).some(function(k){ return String(r[k]).trim() === "Day date"; }); }))
        return { name:name, err:"ده ملخص الأيام — ارفع الكشف التفصيلي (Revenue Report) اللي فيه الأوردرات" };
      return { name:name, err:"مش كشف QP — مالقيتش عمود «Serial»" };
    }
    var H = {}; Object.keys(rows[hi]).forEach(function(k){ H[String(rows[hi][k]).trim()] = k; });
    var g = function(r, h){ return H[h] ? String(r[H[h]] == null ? "" : r[H[h]]).trim() : ""; }, num = function(r, h){ return Number(g(r, h)) || 0; };
    var L = rows.slice(hi + 1).filter(function(r){ return g(r, "Serial"); }).map(function(r){
      return { ser:g(r, "Serial").replace(/\D/g, ""), st:g(r, "Order delivery status"), note:g(r, "Statusnote"), name:g(r, "Full name"),
               phone:g(r, "Phone"), type:g(r, "Type"), amt:num(r, "Total amount"), fee:num(r, "Total fees"), cod:num(r, "Cod"),
               odate:stmDate(g(r, "Order date")), cdate:stmDate(g(r, "Collect date")), rdate:stmDate(g(r, "Return date")) };
    });
    if(!L.length) return { name:name, err:"الكشف فاضي" };
    var cd = L.map(function(x){ return x.cdate; }).filter(Boolean).sort(), rd = L.map(function(x){ return x.rdate; }).filter(Boolean).sort();
    var date = cd.length ? cd[cd.length - 1] : rd.length ? rd[rd.length - 1] : today();
    return { name:name, date:date, lines:L, total:Math.round(L.reduce(function(a, x){ return a + x.cod; }, 0) * 100) / 100,
             key:"QP|" + date + "|" + L.map(function(x){ return x.ser + ":" + x.cod; }).sort().join(",") };
  }
  function stmPhones(t){ return (String(t || "").match(/[\d٠-٩]{10,}/g) || []).map(function(x){ return toEn(x).slice(-10); }); }
  function stmPicked(){ var m = {}; live("cash").forEach(function(c){ if(c.type === "settle") (c.orders || []).forEach(function(o){ (m[o] = m[o] || []).push(c); }); }); return m; }
  // سطر الكشف → الأوردر والتعديلات اللي محتاجها
  function stmMatch(F){
    var QP = live("sales").filter(function(x){ return viaShip(x) && squish(x.shipCo) === "QP"; }), PK = stmPicked();
    var used = {}, out = [];
    F.lines.forEach(function(L){
      var it = { L:L, fx:[], kind:"ok", why:"" };
      out.push(it);
      if(!L.amt && !L.fee && !L.cod){ it.kind = "info"; it.why = L.note || "سطر من غير فلوس"; return; }
      var c = QP.filter(function(x){ return squish(x.shipCode).replace(/\D/g, "") === L.ser && !used[x.id]; });
      if(!c.length){
        var ph = stmPhones(L.phone);
        c = ph.length ? QP.filter(function(x){
          var pp = stmPhones((db.parties.find(function(p){ return p.id === x.partyId; }) || {}).phone);
          return !used[x.id] && !PK[x.id] && pp.some(function(a){ return ph.indexOf(a) >= 0; });
        }) : [];
        if(c.length > 1) c = c.filter(function(x){ return !L.odate || x.date <= L.odate; }).sort(function(a, b){ return a.date < b.date ? 1 : -1; }).slice(0, 1);
        if(c.length){ it.how = "phone"; it.fx.push({ f:"shipCode", now:L.ser, t:"البوليصة " + (squish(c[0].shipCode) || "—") + " ← " + L.ser }); }
      }
      if(!c.length){
        if(L.cod < 0 && !L.amt){ it.kind = "exp"; it.why = "مالوش أوردر — QP خصمت " + qty(-L.cod) + " (بوليصة " + L.ser + "). هيتسجّل مصروف"; }
        else { it.kind = "stop"; it.why = "مالقيتش الأوردر (بوليصة " + L.ser + ") — سجّله الأول وارفع الكشف تاني"; }
        return;
      }
      var r = it.r = c[0]; used[r.id] = 1;
      var deliv = /^deliver/i.test(L.st) && L.type !== "return", ret = !deliv && !L.amt;
      if(deliv){
        if(isCancelled(r)){ it.kind = "stop"; it.why = "متسجّل ملغي والكشف بيقول اتسلّم — افتح الأوردر وراجعه"; return; }
        var tot = saleTotal(r), sin = L.amt - tot;
        if(sin < -0.009){ it.kind = "stop"; it.why = "العميل دفع " + qty(L.amt) + " وبضاعته على السيستم " + qty(tot) + " — لو خد جزء سجّل المرتجع الأول"; return; }
        if(!isDelivered(r)) it.fx.push({ st:"delivered", t:"اتسلّم" });
        if(Math.abs(shipIn(r) - sin) > 0.009) it.fx.push({ f:"shipIn", now:Math.round(sin * 100) / 100, t:"دفع " + qty(L.amt) + " (شحن " + qty(sin) + " بدل " + qty(shipIn(r)) + ")" });
        if(Math.abs(shipOut(r) - L.fee) > 0.009) it.fx.push({ f:"shipOut", now:L.fee, t:"شحن QP " + qty(L.fee) + " بدل " + qty(shipOut(r)) });
      } else if(ret){
        if(isDelivered(r)){ it.kind = "stop"; it.why = "متسجّل اتسلّم والكشف بيقول مرتجع — افتح الأوردر وراجعه"; return; }
        if(!isCancelled(r)) it.fx.push({ st:"cancelled", t:"اترفض" });
        var so = shipOut(r), si = so - L.fee, so2 = so;
        if(si < -0.009){ si = 0; so2 = L.fee; }
        if(Math.abs(so2 - so) > 0.009) it.fx.push({ f:"shipOut", now:so2, t:"شحن QP " + qty(so2) + " بدل " + qty(so) });
        if(Math.abs((Number(r.shipIn) || 0) - si) > 0.009 || r.shipQ) it.fx.push({ f:"shipIn", now:Math.round(si * 100) / 100, t:si > 0.009 ? "دفع " + qty(si) + " من الشحن" : "ما دفعش شحن" });
        if(L.rdate && SL(r).some(function(l){ return !l.backAt; })) it.fx.push({ back:L.rdate, t:"المرتجع رجع " + dShort(L.rdate) });
      } else { it.kind = "stop"; it.why = "سطر مش واضح (" + (L.st || "—") + ") — راجعه مع QP"; return; }
      // استلامات قديمة للأوردر ده: باليد (هتتشال) ولا الكشف ده نفسه (متسجّل)
      (PK[r.id] || []).forEach(function(cc){
        if(cc.stm === F.key) it.done = true;
        else it.old = (it.old || []).concat([cc]);
      });
      if(it.fx.length) it.kind = "fix";
    });
    return out;
  }
  function stmPlan(){
    if(!STM) return null;
    var PK = stmPicked();
    return STM.files.map(function(F){
      if(F.err) return { F:F, err:F.err };
      if(live("cash").some(function(c){ return c.stm === F.key; })) return { F:F, done:true };
      var items = stmMatch(F), mine = {}, kill = {}, why = [];
      items.forEach(function(it){ if(it.r) mine[it.r.id] = 1; });
      items.forEach(function(it){ (it.old || []).forEach(function(cc){
        if((cc.orders || []).every(function(o){ return mine[o]; })) kill[cc.id] = cc;
        else why.push("#" + (it.r.no || "") + " متسجّل في استلام فيه أوردرات تانية (" + dShort(cc.date) + " · " + qty(cc.amount) + ")");
      }); });
      var stops = items.filter(function(it){ return it.kind === "stop"; });
      var lump = live("cash").filter(function(c){ return c.type === "settle" && squish(c.shipCo) === "QP" && c.date === F.date && !(c.orders || []).length; });
      return { F:F, items:items, kill:Object.keys(kill).map(function(k){ return kill[k]; }), lump:lump, why:why,
               ok:!stops.length && !why.length && !isLocked(F.date), locked:isLocked(F.date) };
    });
  }
  function stmApply(plan, dry){
    var touched = [], snap = [], n0 = db.cash.length, out;
    var keep = function(o){ if(touched.indexOf(o) < 0){ touched.push(o); snap.push(JSON.stringify(o)); } };
    var mark = function(o){ if(!dry){ o.editedBy = me || "غير محدد"; o.at = Date.now(); } };
    try{
      plan.forEach(function(P){
        if(!P.ok || P.skip) return;
        var ids = [], amt = 0;
        P.items.forEach(function(it){
          if(it.kind === "exp"){
            db.cash.push(stamp({ date:P.F.date, type:"expense", partyId:"", amount:-it.L.cod, cat:"othervar", costKind:"var", paidBy:"", svcDays:"", credit:"",
              note:"QP: " + (it.L.name || "شحنة") + " — بوليصة " + it.L.ser + " (اتخصمت من كشف " + dShort(P.F.date) + ")" }));
            return;
          }
          if(!it.r || it.kind === "info" && !it.r) return;
          if(it.kind === "info") return;
          var r = it.r; keep(r);
          it.fx.forEach(function(x){
            if(x.st){ r.status = x.st; r.rsn = x.st === "cancelled" ? "refused" : ""; if(r.cf === "nr"){ r.cf = ""; r.cfAt = ""; }
              if(x.st === "delivered") r.deliveredAt = it.L.cdate || P.F.date; else r.cancelledAt = it.L.rdate || P.F.date;
              preCancelFix(r); stampDelivery(r); }
            if(x.f) r[x.f] = x.now;
            if(x.back) SL(r).forEach(function(l){ if(!l.backAt) l.backAt = x.back; });
          });
          if(isCancelled(r)) delete r.shipQ;
          syncShipPaid(r); if(it.fx.length) mark(r);
          ids.push(r.id); amt += it.L.cod;
        });
        P.kill.concat(P.lump.filter(function(c){ return !P.keepLump; })).forEach(function(c){ keep(c); c.deleted = true; mark(c); });
        if(ids.length) db.cash.push(stamp({ date:P.F.date, type:"settle", partyId:"", shipCo:"QP", amount:Math.round(amt * 100) / 100, orders:ids, stm:P.F.key,
          note:"كشف QP " + dShort(P.F.date) + " — " + qty(ids.length) + " أوردر" }));
      });
      pendCache = null; clearStockIdx();
      out = { qp:walletOf("QP"), cash:cashBox() };
    } finally {
      if(dry){ touched.forEach(function(o, i){ Object.keys(o).forEach(function(k){ delete o[k]; }); Object.assign(o, JSON.parse(snap[i])); }); db.cash.length = n0; pendCache = null; clearStockIdx(); }
    }
    return out;
  }
  function stmRender(){
    var box = document.getElementById("stm-box"); if(!box) return;
    if(!STM){ box.innerHTML = ""; return; }
    var plan = stmPlan(), bf = { qp:walletOf("QP"), cash:cashBox() }, go = plan.some(function(P){ return P.ok; }), af = go ? stmApply(plan, true) : bf;
    var n = function(x){ return "<span class='num'>" + esc(qty(x)) + "</span>"; };
    var K = { ok:["✓", "ok", "مطابق"], fix:["✎", "fix", ""], stop:["✗", "stop", ""], info:["·", "info", ""], exp:["＋", "fix", ""] };
    var html = "<div class='panel fx-card stm' id='stm-card'><h3>كشوف QP — قبل ما تتسجّل</h3>";
    var row = function(it){
        var k = K[it.kind], r = it.r;
        var txt = it.kind === "ok" ? "مطابق" + (it.old ? " · استلام باليد هيتشال" : "") : it.kind === "fix" ? it.fx.map(function(x){ return x.t; }).join(" · ") + (it.old ? " · استلام باليد هيتشال" : "") : it.why;
        return "<tr><td class='k " + k[1] + "'>" + k[0] + "</td><td>" + (r ? "<b>#" + esc(r.no || "") + "</b> " + esc(partyName(r.partyId)) : "<b>" + esc(it.L.name || "—") + "</b>") +
          "<small>" + esc(it.L.ser) + (it.how === "phone" ? " · اتعرف بالتليفون" : "") + "</small></td><td>" + esc(txt) + "</td><td class='n'>" + n(it.L.cod) + "</td></tr>";
    };
    plan.forEach(function(P){
      if(P.err){ html += "<div class='stm-f'><b>" + esc(P.F.name) + "</b><p class='hint v-due'>" + esc(P.err) + "</p></div>"; return; }
      html += "<div class='stm-f'><b>كشف " + esc(dShort(P.F.date)) + " · صافي " + n(P.F.total) + "</b> <small class='sub'>" + esc(P.F.name) + "</small>";
      if(P.done){ html += "<p class='hint v-gain'>✓ الكشف ده متسجّل قبل كده — مش هيتسجّل تاني</p></div>"; return; }
      // المطابق مطوي — اللي بيظهر هو اللي محتاج تبصّله بس
      var hot = P.items.filter(function(it){ return it.kind !== "ok" && it.kind !== "info"; }), calm = P.items.filter(function(it){ return it.kind === "ok" || it.kind === "info"; });
      html += "<p class='hint' style='margin:4px 0 0'>" + n(P.F.lines.length) + " سطر · " + n(calm.length) + " مطابق" +
        (hot.length ? " · " + n(hot.length) + " محتاج تبصّله" : " ✓") + "</p>";
      if(hot.length) html += "<table class='stm-t'>" + hot.map(row).join("") + "</table>";
      if(calm.length) html += "<details class='stm-d'><summary>اعرض المطابق (" + qty(calm.length) + ")</summary><table class='stm-t'>" + calm.map(row).join("") + "</table></details>";
      if(P.lump.length) html += "<p class='hint'>استلام بالإجمالي يوم " + esc(dShort(P.F.date)) + " (" + P.lump.map(function(c){ return qty(c.amount); }).join(" + ") + ") — هيتشال ويتسجّل الكشف مكانه</p>";
      if(P.why.length) html += "<p class='hint v-due'>" + esc(P.why.join(" · ")) + "</p>";
      if(P.locked) html += "<p class='hint v-due'>فترة " + esc(dShort(P.F.date)) + " مقفولة — مش هيتسجّل</p>";
      else if(!P.ok) html += "<p class='hint v-due'>الكشف ده مش هيتسجّل لحد ما تصلّح السطور اللي عليها ✗</p>";
      html += "</div>";
    });
    html += "<div class='fx-eff'><div><small>الخزنة</small><b class='num'>" + esc(money(bf.cash)) + " ← " + esc(money(af.cash)) + "</b></div>" +
      "<div><small>QP</small><b class='num'>" + esc(money(bf.qp)) + " ← " + esc(money(af.qp)) + "</b></div></div>" +
      "<div class='fx-a'>" + (go ? "<button class='act' type='button' id='b-stm-ok'>سجّل الكشوف</button>" : "") +
      "<button class='tbtn' type='button' id='b-stm-x'>" + (go ? "إلغاء" : "قفل") + "</button></div></div>";
    box.innerHTML = html;
  }
  document.getElementById("b-stm").addEventListener("click", function(){
    if(!canEdit() || !canMoney()){ toast("مالكش صلاحية تسجّل استلامات"); return; }
    if(typeof DecompressionStream === "undefined"){ toast("المتصفح ده قديم ومش بيفتح ملفات الإكسل — حدّثه أو جرّب كروم"); return; }
    document.getElementById("stm-file").click();
  });
  document.getElementById("stm-file").addEventListener("change", async function(){
    var fs = [].slice.call(this.files || []); this.value = "";
    if(!fs.length) return;
    var files = [];
    for(var i = 0; i < fs.length; i++){
      try{ files.push(stmParse(fs[i].name, await xlsxRead(await fs[i].arrayBuffer()))); }
      catch(err){ files.push({ name:fs[i].name, err:"مش قادر أفتح الملف — " + (err && err.message || "اتأكد إنه .xlsx") }); }
    }
    files.sort(function(a, b){ return (a.date || "") < (b.date || "") ? -1 : 1; });
    STM = { files:files }; stmRender();
    var c = document.getElementById("stm-card"); if(c) c.scrollIntoView({ block:"start" });
  });
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    if(e.target.closest("#b-stm-x")){ STM = null; stmRender(); return; }
    if(!e.target.closest("#b-stm-ok")) return;
    if(!canEdit() || !canMoney()){ toast("مالكش صلاحية تسجّل استلامات"); return; }
    var plan = stmPlan(), n = plan.filter(function(P){ return P.ok; }).length;
    if(!n){ stmRender(); return; }
    var r = stmApply(plan, false);
    STM = null; saveSoon("cash"); saveSoon("sales"); renderAll();
    toast("اتسجّل " + qty(n) + (n === 1 ? " كشف" : " كشوف") + " · رصيد QP " + money(r.qp), 4200);
  });
  function renderShipCards(){
    var top = document.getElementById("shc-top"), box = document.getElementById("shc-cards");
    if(!top || !box) return;
    stmRender();
    var cos = shipBuckets();
    var S = live("sales");
    var withCourier = S.filter(function(x){ return orderStep(x).k === "inspect"; });
    var wal = walletsTotal(), held = heldOpenQty();
    /* v180: سطر واحد تحت العنوان بدل ٤ كروت — «شحن من جيبك» في «كل الأرقام» تحت وفي التقارير */
    var sumTxt = wal > 0.009 ? "ليك عندهم <b class='num v-gain'>" + esc(money(wal)) + "</b>"
               : (wal < -0.009 ? "عليك ليهم <b class='num v-due'>" + esc(money(-wal)) + "</b>" : "كل فلوسك وصلتك ✓");
    top.innerHTML = sumTxt + (withCourier.length ? " · مع المندوب " + esc(plural(withCourier.length, "أوردر واحد", "أوردرين", "أوردرات")) : "") +
      (held ? " · مرتجع عندهم " + qty(held) + " قطعة" : "");
    if(!cos.length){
      box.innerHTML = "<p class='cd-empty'>لما تكتب اسم شركة الشحن في الأوردرات، هتلاقي هنا حساب كل شركة.</p>";
      return;
    }
    var ed = canEdit();
    cos.sort(function(a, b){ return walletOf(b) - walletOf(a); });
    box.innerHTML = cos.map(function(co){
      var name = squish(co), bal = walletOf(name);
      var L = S.filter(function(x){ return squish(x.shipCo) === name; });
      var cc = L.filter(isCancelled).length;
      var withC = L.filter(function(x){ return orderStep(x).k === "inspect"; }).length;
      var pend = L.filter(function(x){ return viaShip(x) && Math.abs(shipPend(x).left) > 0.009; })
        .sort(function(a, b){ return -byDate(a, b); });
      var hl = heldOpen().filter(function(h){ return squish(h.s.shipCo) === name; });
      var hq = hl.reduce(function(a, h){ return a + h.n; }, 0);
      var sec = shcOpen[name] || (pend.length ? "orders" : "");
      /* v180: الرقم بيتقري زي ما هو — «ليك عندها 760» أو «عليك ليها 50» (مش «لك عندها −50») */
      var head = "<div class='shc-h'><span class='nm'>" + (name ? esc(name) : "⚠ من غير اسم شركة") + "</span>" +
        "<span class='big'><small>" + (bal < -0.009 ? "عليك ليها" : "ليك عندها") + "</small><b class='num" +
          (bal > 0.009 ? " v-gain" : (bal < -0.009 ? " v-due" : " muted")) + "'>" + esc(money(Math.abs(bal))) + "</b></span>" +
        "<span class='acts'>" + (bal > 0.009 && name && ed
          ? "<button class='tbtn primary' type='button' data-shcall='" + esc(name) + "'>استلم " + esc(money(bal)) + "</button>" +
            "<button class='tbtn' type='button' data-shcpart='" + esc(name) + "'>استلم جزء</button>"
          : (bal > 0.009 && !name ? "<span class='sub'>افتح الأوردرات واكتب اسم الشركة</span>"
             : (bal < -0.009 ? "" : "<span class='sub'>✓ كل فلوسك وصلتك</span>"))) +
        "</span>" +
        (bal < -0.009 ? "<p class='shc-note'>مصاريف مرتجع — هتتخصم من أول استلام جاي، مش محتاج تعمل حاجة.</p>" : "") + "</div>";
      var part = (shcPart === name && ed)
        ? "<div class='shc-part'><label>استلمت كام؟ <input inputmode='decimal' class='num' data-shcamt='" + esc(name) + "' placeholder='" + esc(money(bal)) + "'></label>" +
          "<button class='tbtn primary' type='button' data-shcok='" + esc(name) + "'>سجّل</button>" +
          "<span class='sub'>بيدخل الخزنة ويتحسب على الأوردرات الأقدم الأول</span></div>" : "";
      /* v180: سطر واحد بالحاجات اللي بتتابعها — العدد الكلي ومتوسط الشحن في «كل الأرقام» تحت */
      var st = "<div class='shc-st'>" +
        "<span>مع المندوب <b class='num" + (withC ? " w" : "") + "'>" + qty(withC) + "</b></span>" +
        "<span>مرتجع عندها <b class='num'>" + (hq ? qty(hq) + "</b> قطعة" : "مفيش</b>") + "</span>" +
        "<span>اترفض <b class='num'><bdi>" + (L.length ? Math.round(cc / L.length * 100) : 0) + "%</bdi></b></span></div>";
      var secHead = function(k, t, sm){
        return "<button type='button' class='shc-sec" + (sec === k ? " on" : "") + "' data-shcsec='" + esc(name) + "|" + k + "'>" +
          "<b>" + esc(t) + "</b><small>" + esc(sm) + "</small><span aria-hidden='true'>" + (sec === k ? "▴" : "▾") + "</span></button>";
      };
      var body = "";
      if(sec === "orders"){
        var sel = shcSel[name] || {}, ids = pend.filter(function(x){ return sel[x.id]; });
        var sum = ids.reduce(function(a, x){ return a + shipPend(x).left; }, 0);
        var pick = !ed || !pend.length ? "" : "<div class='shc-pick" + (ids.length ? " on" : "") + "'>" +
          (ids.length
            ? "<b>اخترت " + esc(plural(ids.length, "أوردر واحد", "أوردرين", "أوردرات")) + " · <span class='num'>" + esc(money(sum)) + "</span>" +
                (sum <= 0.009 ? "<span class='sub'>المجموع مش موجب — علّم معاه الأوردرات اللي الشركة حاسبتك عليها</span>" : "") + "</b>" +
              (sum > 0.009 ? "<button class='tbtn primary' type='button' data-shcpick='" + esc(name) + "'>استلمت فلوسهم</button>" : "") +
              "<button class='tbtn' type='button' data-shcclr='" + esc(name) + "'>إلغاء</button>"
            : "<span class='sub'>علّم اللي الشركة حاسبتك عليه</span>" +
              "<button class='shc-all' type='button' data-shcselall='" + esc(name) + "'>اختار الكل</button>") + "</div>";
        body = pick + (pend.length ? pend.map(function(x){
          var got = isCancelled(x) ? shipIn(x) : (Number(x.paid)||0), fee = shipCounts(x) ? shipOut(x) : 0;
          var net = got - fee, pd = shipPend(x).left, neg = pd < -0.009;
          return "<div class='shc-row" + (ed ? " pk" : "") + (sel[x.id] ? " on" : "") + "'>" +
            (ed ? "<input type='checkbox' data-shcsel='" + esc(name) + "|" + esc(x.id) + "'" + (sel[x.id] ? " checked" : "") +
                  " aria-label='استلمت فلوس أوردر " + esc(x.no || "") + "'>" : "") +
            "<a href='#' class='ono' data-shcorder='" + esc(x.id) + "'>#" + esc(x.no || "—") + "</a>" +
            "<span>" + esc(partyName(x.partyId)) + "<span class='sub'>" +
              (neg ? "رفض" + (got ? " · دفع الشحن " + esc(qty(got)) : " · ما دفعش الشحن") + " − مرتجع " + esc(qty(fee))
                   : (isCancelled(x) ? "رفض · دفع الشحن " : "دفع ") + esc(qty(got)) + (fee ? " − شحن " + esc(qty(fee)) : "") +
                     (net - pd > 0.009 ? " − " + esc(qty(Math.round((net - pd) * 100) / 100)) + " اتحسبوا قبل كده" : "")) + "</span></span>" +
            "<span class='sub num'>" + esc(dShort(x.deliveredAt || x.cancelledAt || x.date)) + "</span>" +
            "<b class='num" + (neg ? " v-due" : "") + "'>" + esc(money(pd)) + "</b>" +
            (ed && !neg ? "<button class='tbtn shc-one' type='button' data-shcone='" + esc(name) + "|" + esc(x.id) + "' title='الشركة حاسبتك على الأوردر ده — " + esc(money(pd)) + " تدخل الخزنة'>استلمتها</button>" : (ed ? "<span></span>" : "")) + "</div>";
        }).join("") : "<p class='sub' style='margin:0'>مفيش أوردرات فلوسها لسه عندها.</p>");
      } else if(sec === "held"){
        body = hl.length ? hl.map(function(h){
          var vl = vLabel(vColor(h.l), vSize(h.l));
          return "<div class='shc-row'><a href='#' class='ono' data-shcorder='" + esc(h.s.id) + "'>#" + esc(h.s.no || "—") + "</a>" +
            "<span>" + esc(itemName(h.l.itemId)) + (vl ? " (" + esc(vl) + ")" : "") + " × " + qty(h.n) +
              "<span class='sub'>" + esc(partyName(h.s.partyId)) + " · " + (isCancelled(h.s) ? "رفض كله" : "خد جزء") + "</span></span>" +
            "<span></span>" +
            (ed && !saleLocked(h.s) ? "<button class='tbtn' type='button' data-heldback='" + esc(h.s.id) + "|" + h.i + "'>وصلني</button>" : "<span></span>") + "</div>";
        }).join("") : "<p class='sub' style='margin:0'>مفيش مرتجع عندها.</p>";
      } else if(sec === "stmt"){
        var ev = shipStmtEvents(name), run = 0;
        var rows = ev.map(function(x){ run += x.in - x.out; return { x:x, run:run }; }).reverse();
        body = rows.length ? rows.map(function(r){
          var x = r.x;
          return "<div class='shc-row st'><span class='sub num'>" + esc(dShort(x.d) || "—") + "</span>" +
            "<span>" + (x.id ? "<a href='#' class='ono' data-shcorder='" + esc(x.id) + "'>" + esc(x.k) + "</a>" : esc(x.k)) +
              "<span class='sub'>" + esc(x.t) + "</span></span>" +
            "<b class='num " + (x.in ? "v-gain" : "v-due") + "'>" + (x.in ? "+" + esc(money(x.in)) : "−" + esc(money(x.out))) + "</b>" +
            "<span class='sub num'>الرصيد " + esc(money(r.run)) + "</span></div>";
        }).join("") : "<p class='sub' style='margin:0'>مفيش حركات للشركة دي لسه.</p>";
      }
      return "<div class='shc'>" + head + part + st +
        (function(){
          var ps = pend.reduce(function(a, x){ return a + shipPend(x).left; }, 0), pn = pend.length ? plural(pend.length, "أوردر واحد", "أوردرين", "أوردرات") : "";
          // لو الأوردرات دي هي الرصيد كله: «الـ760 دي من أوردرين» — بتجاوب على «الفلوس دي جاية منين؟»
          return pend.length && bal > 0.009 && Math.abs(ps - bal) < 0.01
            ? secHead("orders", "الـ" + qty(Math.round(bal * 100) / 100) + " دي من " + pn, "")
            : secHead("orders", "الأوردرات اللي فلوسها عندها", pend.length ? pn + " · " + money(ps) : "مفيش");
        })() +
        (sec === "orders" ? "<div class='shc-b'>" + body + "</div>" : "") +
        secHead("held", "مرتجع عندها", hq ? qty(hq) + " قطعة" : "مفيش") +
        (sec === "held" ? "<div class='shc-b'>" + body + "</div>" : "") +
        secHead("stmt", "كشف الحساب", "كل حركة داخلة وخارجة من محفظتها") +
        (sec === "stmt" ? "<div class='shc-b'>" + body + "</div>" : "") +
        "</div>";
    }).join("");
  }
  document.getElementById("shc-cards").addEventListener("click", function(e){
    var t;
    if((t = e.target.closest("[data-shcsec]"))){
      var q = t.dataset.shcsec.split("|");
      var cur = shcOpen[q[0]];
      // القسم المفتوح لوحده أول مرة (الأوردرات) لازم يتقفل برضه من أول دوسة
      if(cur === undefined && q[1] === "orders" && t.classList.contains("on")) shcOpen[q[0]] = "none";
      else shcOpen[q[0]] = cur === q[1] ? "none" : q[1];
      renderShipCards(); return;
    }
    if((t = e.target.closest("[data-shcorder]"))){ e.preventDefault(); goTab("sales"); sgOpenRow(t.dataset.shcorder); return; }
    if((t = e.target.closest("[data-shcclr]"))){ delete shcSel[t.dataset.shcclr]; renderShipCards(); return; }
    if((t = e.target.closest("[data-shcselall]"))){
      var an = t.dataset.shcselall, m = shcSel[an] = {};
      live("sales").forEach(function(x){ if(viaShip(x) && squish(x.shipCo) === an && Math.abs(shipPend(x).left) > 0.009) m[x.id] = 1; });
      renderShipCards(); return;
    }
    if((t = e.target.closest("[data-shcone]"))){
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      var oq = t.dataset.shcone.split("|"), ox = live("sales").find(function(x){ return x.id === oq[1]; });
      var ol = ox ? shipPend(ox).left : 0;
      if(!(ol > 0.009)){ renderShipCards(); return; }
      if(settleCo(oq[0], Math.min(Math.round(ol * 100) / 100, walletOf(oq[0])), [oq[1]]) && shcSel[oq[0]]){ delete shcSel[oq[0]][oq[1]]; renderShipCards(); }
      return;
    }
    if((t = e.target.closest("[data-shcpick]"))){
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      var pn = t.dataset.shcpick, pm = shcSel[pn] || {};
      var pl = live("sales").filter(function(x){ return pm[x.id] && squish(x.shipCo) === pn && Math.abs(shipPend(x).left) > 0.009; })
        .sort(function(a, b){ return -byDate(a, b); });
      if(!pl.length){ delete shcSel[pn]; renderShipCards(); return; }
      var pa = Math.round(pl.reduce(function(a, x){ return a + shipPend(x).left; }, 0) * 100) / 100;
      if(!(pa > 0.009)){ toast("المجموع مش موجب — علّم معاه الأوردرات اللي الشركة حاسبتك عليها"); return; }
      if(settleCo(pn, Math.min(pa, walletOf(pn)), pl.map(function(x){ return x.id; }))){ delete shcSel[pn]; shcPart = null; renderShipCards(); }
      return;
    }
    if((t = e.target.closest("[data-shcall]"))){
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      shcPart = null; settleCo(t.dataset.shcall, walletOf(t.dataset.shcall)); return;
    }
    if((t = e.target.closest("[data-shcpart]"))){
      shcPart = shcPart === t.dataset.shcpart ? null : t.dataset.shcpart; renderShipCards();
      var inp = document.querySelector("[data-shcamt='" + t.dataset.shcpart + "']");
      if(inp) inp.focus();
      return;
    }
    if((t = e.target.closest("[data-shcok]"))){
      var nm = t.dataset.shcok, box = document.querySelector("[data-shcamt='" + nm + "']");
      var v = Number(toEn(box ? box.value : ""))||0;
      if(settleCo(nm, v)) shcPart = null; else if(box) box.focus();
      return;
    }
  });
  document.getElementById("shc-cards").addEventListener("change", function(e){
    var c = e.target.closest("[data-shcsel]"); if(!c) return;
    var q = c.dataset.shcsel.split("|"), m = shcSel[q[0]] = shcSel[q[0]] || {};
    if(c.checked) m[q[1]] = 1; else delete m[q[1]];
    renderShipCards();
  });
  document.getElementById("shc-cards").addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    var a = e.target.closest("[data-shcamt]"); if(!a) return;
    e.preventDefault();
    var b = document.querySelector("[data-shcok='" + a.dataset.shcamt + "']"); if(b) b.click();
  });

  function renderShip(){
    // الترقية بتتحفظ مرة واحدة بدل ما تتعاد مع كل فتحة، وعشان
    // الأسعار توصل باقي الأجهزة بالمزامنة
    renderShipCards(); renderShipCos(); renderHeld();
  }

