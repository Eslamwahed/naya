  /* ================= مراحل الأوردر =================
     الشاشة الرئيسية للمبيعات: خمس بانلات، كل بانل فيها الأوردرات اللي
     مستنية حاجة في المرحلة دي بس، وزراير المرحلة دي بس:
       ١ جديد (ناقصه الشركة أو الكود) · ٢ مع المندوب (العميل استلم؟)
       ٣ فلوسك عند الشركة · ٤ مرتجع عند الشركة · ٥ خلص
     المرحلة مش متخزّنة — بتتحسب من orderStep زي الخطوات بالظبط، فمستحيل
     الأوردر يبان في بانل والداتا تقول حاجة تانية. ٣ و٤ مش بالترتيب،
     فالأوردر ممكن يبان في الاتنين (فلوسه والمرتجع لسه عند الشركة).
     «الكل» = الجدول القديم بكل حاجة فيه (الفلاتر والتفاصيل والتعديل). */
  var sView = null;                     // "1".."5" أو "all"
  try{ if(LS) sView = LS.getItem("naya:sview"); }catch(e){}
  var sgSel = {};                       // المختار في بانل ٢
  var sgPart = null;                    // الأوردر اللي مفتوح فيه «خد جزء»
  var SG_STALE = 5;                     // بعد كام يوم مع المندوب يطلع تنبيه
  var sgNote = null;                    // نتيجة الإجراء الجماعي — بتفضل ظاهرة لحد الحركة الجاية

  function setSView(v, keep){
    var changed = sView !== v;
    sView = v;
    if(!keep){ try{ if(LS) LS.setItem("naya:sview", v); }catch(e){} }
    sgPart = null; sgNote = null;
    renderSales();
    if(changed){ swapAnim("s-stage-panel"); swapAnim("s-allview"); }
  }
  function daysSince(d){
    if(!d) return 0;
    var t = Date.parse(d + "T00:00:00"), n = Date.parse(today() + "T00:00:00");
    return isNaN(t) ? 0 : Math.max(0, Math.round((n - t) / 86400000));
  }
  function sgNum(v){ return (Number(v)||0).toLocaleString("en-US", { maximumFractionDigits:2 }); }

  function stageLists(){
    var st = { 1:[], 2:[], 3:[], 4:[], 5:[] }, direct = [];
    var month = today().slice(0, 7);
    live("sales").forEach(function(s){
      var sp = orderStep(s);
      if(sp.k === "ship") st[1].push(s);
      else if(sp.k === "inspect" || sp.k === "custpaid") st[2].push(s);
      if(viaShip(s) && shipCounts(s) && !(isDelivered(s) && shipPaidGap(s)) && shipPend(s).left > 0.009) st[3].push(s);
      if(!viaShip(s) && (sp.k === "collect" || sp.k === "refund")) direct.push(s);
      if(heldShipped(s) && heldLeft(s) > 0) st[4].push(s);
      if(sp.done && doneDate(s).slice(0, 7) === month) st[5].push(s);
    });
    var asc = function(a, b){ return -byDate(a, b); };     // الأقدم فوق: ده اللي مستني من زمان
    st[1].sort(asc); st[2].sort(asc); st[3].sort(asc); st[4].sort(asc); direct.sort(asc);
    st[5].sort(function(a, b){ var x = doneDate(a), y = doneDate(b); return x !== y ? (x < y ? 1 : -1) : byDate(a, b); });
    return { st:st, direct:direct };
  }
  function sgPickDefault(g){
    if(!live("sales").length) return "all";
    var k = ["1","2","3","4"].find(function(x){
      return g.st[x].length || (x === "3" && g.direct.length); });
    return k || "5";
  }

  function renderStages(){
    var bar = document.getElementById("s-stages"), pnl = document.getElementById("s-stage-panel");
    if(!bar || !pnl) return;
    var g = stageLists();
    if(!sView || (sView !== "all" && !g.st[sView])) sView = sgPickDefault(g);
    var all = sView === "all";

    document.getElementById("s-allview").hidden = !all;
    var bf = document.getElementById("b-filters");
    if(bf) bf.hidden = !all;
    var ba = document.getElementById("b-sall");
    if(ba){ ba.classList.toggle("on", all); ba.setAttribute("aria-pressed", all ? "true" : "false"); }
    var an = document.getElementById("sall-n"); if(an) an.textContent = qty(live("sales").length);

    var left3 = g.st[3].reduce(function(a, s){ return a + shipPend(s).left; }, 0);
    var due3 = g.direct.reduce(function(a, s){ return a + Math.max(0, sDue(s)); }, 0);
    var held = g.st[4].reduce(function(a, s){ return a + heldLeft(s); }, 0);
    var stale = g.st[2].filter(function(s){ return daysSince(s.date) >= SG_STALE; }).length;
    var cards = [
      ["1", "جديد", qty(g.st[1].length), "ناقصه شحن أو كود", ""],
      ["2", "مع المندوب", qty(g.st[2].length),
        stale ? qty(stale) + " بقالهم " + SG_STALE + " أيام أو أكتر" : "مستني نتيجة التسليم", stale ? "bad" : ""],
      ["3", "فلوسك عند الشركة", sgNum(left3),
        "من " + qty(g.st[3].length) + " أوردرات" + (due3 > 0.009 ? " · و" + sgNum(due3) + " عند عملاء" : ""), ""],
      ["4", "مرتجع عند الشركة", qty(held) + " قطع", "من " + qty(g.st[4].length) + " أوردر", ""],
      ["5", "خلص", qty(g.st[5].length), "الشهر ده", ""]
    ];
    bar.innerHTML = cards.map(function(c){
      return "<button type='button' class='sg-card" + (sView === c[0] ? " on" : "") +
        (c[0] === "4" && held ? " alert" : "") + "' data-sgview='" + c[0] + "' aria-pressed='" +
        (sView === c[0] ? "true" : "false") + "'>" +
        "<span class='n'>" + "١٢٣٤٥"[Number(c[0]) - 1] + "</span><span class='t'>" + esc(c[1]) + "</span>" +
        "<span class='c num'>" + esc(c[2]) + "</span>" +
        "<span class='s" + (c[4] ? " " + c[4] : "") + "'>" + esc(c[3]) + "</span></button>";
    }).join("");

    pnl.hidden = all;
    if(expStage) renderExp();      // شاشة التحليل مفتوحة؟ تتحدّث مع أي تغيير (مزامنة من جهاز تاني مثلاً)
    if(all) return;
    pnl.innerHTML = rsnAskHTML() + SG_PANEL[sView](g);
  }

  // رقم الأوردر في أي بانل بيفتح تفاصيله الكاملة في «الكل»
  function sgNo(s){
    return "<a href='#' class='ono' data-sgopen='" + esc(s.id) + "'>#" + esc(s.no || "—") + "</a>";
  }
  function sgCust(s){
    var p = db.parties.find(function(x){ return x.id === s.partyId; }) || {};
    return esc(partyName(s.partyId)) +
      (p.gov || p.phone ? "<span class='sg-sub'>" + esc([p.gov, p.phone].filter(Boolean).join(" · ")) + "</span>" : "");
  }
  function sgItems(s){
    var n = SL(s).reduce(function(a, l){ return a + (Number(l.qty)||0); }, 0);
    return "<span class='items'>" + esc(itemsLabel(s)) +
      "<span class='sg-sub'>" + nPcs(n) + (shipIn(s) ? " · شحن " + sgNum(shipIn(s)) : "") + "</span></span>";
  }
  // اللي العميل هيدفعه لو خد كله
  function sgFull(s){
    return SL(s).reduce(function(a, l){ return a + (Number(l.qty)||0) * (Number(l.price)||0); }, 0) + shipIn(s);
  }
  function sgHead(t, p){ return "<div class='sg-ph'><h3>" + esc(t) + "</h3>" + (p ? "<p>" + esc(p) + "</p>" : "") + "</div>"; }
  function sgEmpty(t){ return "<p class='sg-empty'>" + esc(t) + "</p>"; }
  function sgCan(s){ return canEdit() && !saleLocked(s); }

  var SG_PANEL = {
    "1": function(g){
      var rows = g.st[1].map(function(s){
        var ed = sgCan(s);
        return "<div class='sg-row' data-sgrow='" + esc(s.id) + "'>" +
          "<span>" + sgNo(s) + "<span class='sg-sub num'>" + esc(s.date || "—") + "</span></span>" +
          // عميل رفض قبل كده؟ تشوفها قبل ما تشحن
          "<span>" + sgCust(s) + refusalFlag(s.partyId) + cfTag(s) + cfBtns(s) + "</span>" + sgItems(s) +
          "<span class='sg-amt num'>" + sgNum(sgFull(s)) + "</span>" +
          (ed && s.selfDel ? "<span class='sg-inl'><span class='sg-pill self'>🛵 توصيل بنفسك</span>" +
                "<input list='courier-list' data-sgcour='" + esc(s.id) + "' placeholder='مين هيوصّله' value='" + esc(squish(s.courier)) + "' aria-label='مين هيوصّله'>" +
                "<button class='tbtn primary' type='button' data-sgout='" + esc(s.id) + "'>خرج للتوصيل</button></span>"
          : ed ? "<span class='sg-inl'>" +
                "<input list='ship-list' data-sgco='" + esc(s.id) + "' placeholder='الشركة' value='" + esc(squish(s.shipCo)) + "' aria-label='شركة الشحن'>" +
                "<input data-sgcode='" + esc(s.id) + "' placeholder='كود البوليصة' value='" + esc(squish(s.shipCode)) + "' aria-label='كود البوليصة'>" +
                "<button class='tbtn primary' type='button' data-sgship='" + esc(s.id) + "'>اتبعت</button></span>"
              : "<span class='sg-sub'>" + (canEdit() ? "في فترة مقفولة" : "مالكش صلاحية تعدّل") + "</span>") +
          "</div>";
      });
      return sgHead("١ · جديد — ابعته مع شركة الشحن",
               "اكتب الشركة وكود البوليصة هنا على طول، والأوردر بينقل لوحده لـ«مع المندوب». والأوردر اللي بتوصّله بنفسك: «خرج للتوصيل» بس.") +
        (rows.length ? "<div class='sg-rows'>" + rows.join("") + "</div>" : sgEmpty("مفيش أوردرات مستنية شحن."));
    },

    "2": function(g){
      Object.keys(sgSel).forEach(function(id){
        if(!g.st[2].some(function(s){ return s.id === id; })) delete sgSel[id]; });
      var nSel = Object.keys(sgSel).length;
      var rows = g.st[2].map(function(s){
        var ed = sgCan(s), sp = orderStep(s), co = squish(s.shipCo) || "الشركة";
        var d = daysSince(s.date), acts;
        if(!ed) acts = "<span class='sg-sub'>" + (canEdit() ? "في فترة مقفولة" : "مالكش صلاحية تعدّل") + "</span>";
        else if(sp.k === "custpaid")
          acts = "<span class='sg-acts'><button class='tbtn primary' type='button' data-sgfix='" + esc(s.id) + "'>العميل دفع " +
                 esc(sgNum(shipPaidOf(s))) + " لـ " + esc(co) + "</button></span>";
        else
          acts = "<span class='sg-acts'>" +
            "<button class='tbtn primary' type='button' data-sggo='" + esc(s.id) + "|all'>" +
              (s.selfDel ? "✓ استلم ودفع " + esc(sgNum(sgFull(s))) : "خد كله") + "</button>" +
            "<button class='tbtn' type='button' data-sggo='" + esc(s.id) + "|part'>خد جزء</button>" +
            "<button class='tbtn' type='button' data-sggo='" + esc(s.id) + "|none'>رفض</button></span>";
        var part = "";
        if(sgPart === s.id && ed){
          part = "<div class='sg-part'><b>العميل رجّع إيه؟ اكتب عدد اللي رجع من كل صنف</b>" +
            SL(s).map(function(l, i){
              var vl = vLabel(vColor(l), vSize(l));
              return "<div class='pl'><span>" + esc(itemName(l.itemId)) + (vl ? " (" + esc(vl) + ")" : "") +
                " — اتبعت " + qty(Number(l.qty)||0) + "</span>" +
                "<label>رجّع <input inputmode='decimal' data-sgret='" + esc(s.id) + "|" + i + "' placeholder='0'></label></div>";
            }).join("") +
            "<div class='sg-acts' style='justify-content:flex-start'>" +
              "<button class='tbtn primary' type='button' data-sgpartok='" + esc(s.id) + "'>سجّل — والباقي العميل خده ودفعه</button>" +
              "<button class='tbtn' type='button' data-sgpartno='1'>إلغاء</button></div></div>";
        }
        return "<div class='sg-row' data-sgrow='" + esc(s.id) + "'>" +
          "<span>" + (ed && sp.k === "inspect"
              ? "<label class='sg-ck'><input type='checkbox' data-sgsel='" + esc(s.id) + "'" + (sgSel[s.id] ? " checked" : "") +
                " aria-label='اختار أوردر " + esc(s.no || "") + "'>" + sgNo(s) + "</label>"
              : sgNo(s)) +
            "<span class='sg-sub num'>" + (s.selfDel ? "🛵 مع " + esc(squish(s.courier) || "المندوب")
              : esc(co) + (squish(s.shipCode) ? " · " + esc(squish(s.shipCode)) : "")) + "</span></span>" +
          "<span>" + sgCust(s) + (d >= SG_STALE ? " <span class='sg-pill bad'>بقاله " + nDays(d) + "</span>" : "") + "</span>" +
          sgItems(s) +
          "<span class='sg-amt num'>" + sgNum(sgFull(s)) + "</span>" + acts + part + "</div>";
      });
      /* v112 — إجمالي الفلوس اللي مع المندوب: نفس المبلغ اللي جنب كل أوردر (sgFull =
         تمن البضاعة + الشحن على العميل) — يعني اللي العملاء هيدفعوه لو كلهم خدوا كله */
      var tot = 0, exp = 0, nc = [];
      g.st[2].forEach(function(s){
        tot += sgFull(s);
        var e = expProfit(s); exp += e.net;
        e.noCost.forEach(function(n){ if(nc.indexOf(n) < 0) nc.push(n); });
      });
      var sum = g.st[2].length
        ? "<div class='sg-sum'><span>إجمالي الأوردرات اللي مع المندوب <b class='num'>" + esc(money(tot)) + "</b></span>" +
          "<button type='button' class='sg-exp money-only' data-expopen='2' title='تفاصيل ربح كل أوردر'>صافي الربح المتوقع <b class='num " + (exp >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(exp)) + "</b>" +
          "<small> لو كلهم استلموا · التفاصيل ‹</small></button>" +
          (nc.length ? "<small class='money-only v-due'>⚠ " + esc(nc.join(" · ")) + ": لسه ما اتشراش — بره حسبة الربح</small>" : "") +
          "</div>" : "";
      var bulk = nSel
        ? "<div class='sg-bulk'><b>" + qty(nSel) + " مختارين</b>" +
          "<button class='tbtn primary' type='button' data-sgbulk='all'>كلهم خدوا كله ودفعوا</button>" +
          "<button class='tbtn' type='button' data-sgbulk='none'>كلهم رفضوا</button>" +
          "<button class='tbtn' type='button' data-sgbulk='clear'>شيل الاختيار</button></div>"
        : (g.st[2].length > 1 ? "<p class='sg-sub' style='margin:0 0 var(--sp-2)'>المندوب رجع بكذا أوردر؟ علّم عليهم وسجّلهم مرة واحدة.</p>" : "");
      var note = sgNote ? "<p class='note " + (sgNote.bad ? "bad" : "ok") + "'>" + esc(sgNote.t) + "</p>" : "";
      return sgHead("٢ · مع المندوب — العميل استلم؟",
               "اللي العميل بيخده بيدفع تمنه للمندوب على الباب وخلاص — بعدها العميل مش عليه حاجة.") +
        sum + note + bulk + (rows.length ? "<div class='sg-rows'>" + rows.join("") + "</div>" : sgEmpty("مفيش أوردرات مع المندوب دلوقتي."));
    },

    "3": function(g){
      var by = {};
      g.st[3].forEach(function(s){ var c = squish(s.shipCo); (by[c] = by[c] || []).push(s); });
      var cos = Object.keys(by).sort(function(a, b){
        var sa = by[a].reduce(function(x, s){ return x + shipPend(s).left; }, 0);
        var sb = by[b].reduce(function(x, s){ return x + shipPend(s).left; }, 0);
        return sb - sa; });
      var html = cos.map(function(co){
        var L = by[co], tot = L.reduce(function(a, s){ return a + shipPend(s).left; }, 0);
        var can = canEdit() && !!co;
        var rows = L.map(function(s){
          var got = isCancelled(s) ? shipIn(s) : (Number(s.paid)||0);
          return "<div class='sg-row'>" + "<span>" + sgNo(s) + "</span>" +
            "<span>" + esc(partyName(s.partyId)) + "<span class='sg-sub num'>" + esc(s.date || "—") + "</span></span>" +
            "<span class='sg-sub'>" + (isCancelled(s) ? "رفض · دفع الشحن " : "العميل دفع ") + sgNum(got) + "</span>" +
            "<span class='sg-sub'>" + (shipOut(s) ? "شحنها " + sgNum(shipOut(s)) : "") + "</span>" +
            "<span class='sg-amt num'>" + sgNum(shipPend(s).left) + "</span></div>";
        }).join("");
        return "<div class='sg-co'>" +
          "<div class='sg-co-h'><span class='nm'>" + (co ? esc(co) : "⚠ من غير اسم شركة") + "</span>" +
            "<span>لك عندها <span class='big num'>" + esc(sgNum(tot)) + "</span></span></div>" +
          "<div class='sg-co-b'>" + rows + "</div>" +
          (can
            ? "<div class='sg-co-f'>" +
                "<button class='tbtn primary' type='button' data-sgdraw='" + esc(co) + "|all'>استلمت " + esc(sgNum(tot)) + " كلهم</button>" +
                "<span>أو جزء:</span><input inputmode='decimal' class='num' data-sgamt='" + esc(co) + "' placeholder='المبلغ'>" +
                "<button class='tbtn' type='button' data-sgdraw='" + esc(co) + "|part'>سجّل</button>" +
                "<span class='sg-sub'>الجزء بيقفل الأوردرات الأقدم الأول · بيدخل الخزنة على طول</span></div>"
            : (co ? "" : "<div class='sg-co-f'><span class='sg-sub'>افتح الأوردر واكتب اسم شركة الشحن — من غيره الفلوس مالهاش مكان.</span></div>")) +
          "</div>";
      }).join("");
      if(g.direct.length){
        html += "<div class='sg-co'><div class='sg-co-h'><span class='nm'>تحصيل مباشر — عند العملاء</span>" +
          "<span>لك عندهم <span class='big num'>" + esc(sgNum(g.direct.reduce(function(a, s){ return a + Math.max(0, sDue(s)); }, 0))) +
          "</span></span></div><div class='sg-co-b'>" +
          g.direct.map(function(s){
            var d = sDue(s), ed = sgCan(s);
            return "<div class='sg-row'><span>" + sgNo(s) + "</span><span>" + sgCust(s) + "</span>" +
              "<span class='sg-sub'>دفع " + sgNum(Number(s.paid)||0) + " من " + sgNum(saleTotal(s) + shipIn(s)) + "</span>" +
              "<span class='sg-amt num'>" + (d < 0 ? "ترجّعله " + sgNum(-d) : sgNum(d)) + "</span>" +
              "<span class='sg-acts'>" + (!ed ? "" : (d > 0
                ? "<button class='tbtn primary' type='button' data-sgqpay='" + esc(s.id) + "'>العميل دفع الكل</button>"
                : "<button class='tbtn' type='button' data-edit='sales|" + esc(s.id) + "'>تعديل</button>")) + "</span></div>";
          }).join("") + "</div></div>";
      }
      return sgHead("٣ · فلوسك عند شركة الشحن",
               "العملاء دفعوا للمندوب — الشركة خصمت شحنها وماسكة الباقي. كل شركة لوحدها زي كشفها بالظبط.") +
        (html || sgEmpty("كل فلوسك وصلتك — مفيش حاجة عند شركات الشحن."));
    },

    "4": function(g){
      var by = {};
      heldOpen().forEach(function(x){ var c = squish(x.s.shipCo); (by[c] = by[c] || []).push(x); });
      var html = Object.keys(by).map(function(co){
        var L = by[co].sort(function(a, b){ return -byDate(a.s, b.s); });
        var n = L.reduce(function(a, x){ return a + x.n; }, 0);
        var rows = L.map(function(x){
          var vl = vLabel(vColor(x.l), vSize(x.l)), ed = sgCan(x.s);
          return "<div class='sg-row ret'><span>" + sgNo(x.s) + "</span>" +
            "<span>" + esc(partyName(x.s.partyId)) + "<span class='sg-sub'>" + (isCancelled(x.s) ? "رفض كله" : "خد جزء") + "</span></span>" +
            "<span class='items'>" + esc(itemName(x.l.itemId)) + (vl ? " (" + esc(vl) + ")" : "") + "</span>" +
            "<span class='num'>" + qty(x.n) + "</span>" +
            "<span class='sg-acts'>" + (ed ? "<button class='tbtn primary' type='button' data-heldback='" +
              esc(x.s.id) + "|" + x.i + "'>وصلني</button>" : "") + "</span></div>";
        }).join("");
        return "<div class='sg-co'><div class='sg-co-h'><span class='nm'>" + (co ? esc(co) : "⚠ من غير اسم شركة") + "</span>" +
          "<span>" + qty(n) + " قطعة</span></div><div class='sg-co-b'>" + rows + "</div>" +
          (canEdit() && L.length > 1 ? "<div class='sg-co-f'><button class='tbtn' type='button' data-sgbackall='" + esc(co) + "'>كل مرتجع " +
            esc(co || "الأوردرات دي") + " وصلني</button></div>" : "") + "</div>";
      }).join("");
      return sgHead("٤ · مرتجع عند شركة الشحن",
               "قطع العميل رجّعها ولسه ما وصلتكش. لسه محسوبة في مخزونك — دوس «وصلني» أول ما تستلمها.") +
        (html || sgEmpty("مفيش مرتجع عند شركات الشحن."));
    },

    "5": function(g){
      var rows = g.st[5].map(function(s){
        return "<div class='sg-row done'><span>" + sgNo(s) + "<span class='sg-sub num'>خلص " + esc(dShort(doneDate(s)) || "—") + "</span></span>" +
          "<span>" + esc(partyName(s.partyId)) + "</span>" +
          "<span class='items'>" + esc(itemsLabel(s)) + (retQty(s) ? "<span class='sg-sub'>رجّع " + qty(retQty(s)) + "</span>" : "") + "</span>" +
          "<span class='sg-amt num'>" + sgNum(saleTotal(s) + (isCancelled(s) ? 0 : shipIn(s))) + "</span>" +
          "<span class='sg-acts'><span class='sg-pill'>" + (isCancelled(s) ? "رفض · خلص" : "✓ خلص") + "</span></span></div>";
      });
      return sgHead("٥ · خلص — الشهر ده",
               "العميل دفع، وفلوسك وصلتك، والمرتجع رجع المخزن. الأقدم تلاقيه في «الكل».") +
        (rows.length ? "<div class='sg-rows'>" + rows.join("") + "</div>" : sgEmpty("لسه مفيش أوردرات خلصت الشهر ده."));
    }
  };

  /* ---------- أحداث البانلات ---------- */
  // «خد جزء»: المرتجع بيتكتب في البانل نفسها، وبعدين نفس setSaleStatus
  function sgPartSave(id){
    var rec = db.sales.find(function(x){ return x.id === id; });
    if(!rec) return;
    var rets = [], bad = null, any = false;
    SL(rec).forEach(function(l, i){
      var box = document.querySelector("[data-sgret='" + id + "|" + i + "']");
      var v = Number(toEn(box ? box.value : ""))||0;
      if(v < 0) v = 0;
      if(v > (Number(l.qty)||0)) bad = itemName(l.itemId) + ": المرتجع أكبر من المشحون (" + qty(Number(l.qty)||0) + ")";
      if(v > 0) any = true;
      rets.push(v);
    });
    if(bad){ toast(bad); return; }
    if(!any){ toast("اكتب عدد اللي رجع — أو دوس «خد كله» لو ما رجّعش حاجة"); return; }
    var old = SL(rec).map(function(l){ return l.ret; });
    SL(rec).forEach(function(l, i){ l.ret = rets[i]; });
    sgPart = null;
    if(!setSaleStatus(rec, "delivered")){
      SL(rec).forEach(function(l, i){ l.ret = old[i]; });
      return;
    }
  }
  // استلام فلوس من الشركة — نفس حركة «سجّل الاستلام» في شاشة الشركات
  function settleCo(co, amt, ids){
    var name = squish(co), bal = walletOf(name);
    if(!name){ toast("الأوردرات دي من غير اسم شركة — افتحها واكتب الاسم الأول"); return false; }
    if(!(amt > 0)){ toast("اكتب المبلغ اللي استلمته"); return false; }
    if(amt > bal + 0.009){ toast("المبلغ أكبر من رصيدك عندها (" + money(bal) + ")"); return false; }
    var d = today();
    if(!guardLock(d, "الاستلام")) return false;
    var rec = { date:d, type:"settle", partyId:"", amount:Math.round(amt * 100) / 100,
      shipCo:name, note:"استلام من " + name };
    if(ids && ids.length){
      rec.orders = ids.slice();
      rec.note = "استلام أوردرات " + ids.map(function(id){ var x = db.sales.find(function(y){ return y.id === id; }); return "#" + ((x && x.no) || "—"); }).join(" و") + " من " + name;
    }
    db.cash.push(stamp(rec));
    saveSoon("cash"); renderAll();
    var left = bal - amt;
    toast("اتسجّل استلام " + money(amt) + " من " + name + (ids && ids.length ? " (" + plural(ids.length, "أوردر واحد", "أوردرين", "أوردرات") + ")" : "") + " — دخل الخزنة" +
          (left > 0.009 ? " · باقي لك " + money(left) : " · خلص رصيدك عندها"), 4200);
    return true;
  }
  function sgOpenRow(id){
    sView = "all";                                   // تنقّل بس — مش اختيار يتفتكر
    openRows = {}; openRows[id] = 1;
    renderSales();
    var tr = document.querySelector("#t-sales tr[data-row='" + id + "']");
    if(tr) tr.scrollIntoView({ block:"center" });
  }

  document.getElementById("s-stages").addEventListener("click", function(e){
    var c = e.target.closest("[data-sgview]"); if(!c) return;
    setSView(c.dataset.sgview);
  });
  document.getElementById("b-sall").addEventListener("click", function(){ setSView("all"); });
  // البحث بيدوّر في كل المراحل — فبيفتح «الكل»
  document.getElementById("flt-text").addEventListener("input", function(){
    if(this.value.trim() && sView !== "all"){ sView = "all"; renderSales(); }
  });

  var SGP = document.getElementById("s-stage-panel");
  SGP.addEventListener("click", function(e){
    var t;
    if(e.target.closest("button")) sgNote = null;     // الرسالة القديمة ما تفضلش بعد حركة جديدة
    if((t = e.target.closest("[data-sgopen]"))){ e.preventDefault(); sgOpenRow(t.dataset.sgopen); return; }

    // ١) اتبعت
    if((t = e.target.closest("[data-sgship]"))){
      var id = t.dataset.sgship, rec = db.sales.find(function(x){ return x.id === id; });
      if(!rec) return;
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      if(saleLocked(rec)){ toast("الأوردر ده في فترة مقفولة — مينفعش يتعدّل"); return; }
      var coEl = SGP.querySelector("[data-sgco='" + id + "']"), cdEl = SGP.querySelector("[data-sgcode='" + id + "']");
      var co = squish(coEl ? coEl.value : ""), cd = squish(cdEl ? cdEl.value : "");
      if(!co){ toast("اكتب اسم شركة الشحن"); if(coEl) coEl.focus(); return; }
      if(!cd){ toast("اكتب كود البوليصة"); if(cdEl) cdEl.focus(); return; }
      rec.shipCo = co; rec.shipCode = cd; stampShipped(rec);
      rec.editedBy = me || "غير محدد"; rec.at = Date.now();
      saveSoon("sales"); renderAll();
      toast("#" + (rec.no || "") + " اتبعت مع " + co + " — بقى في «مع المندوب»");
      return;
    }

    if((t = e.target.closest("[data-sgout]"))){
      var oid = t.dataset.sgout, ro = db.sales.find(function(x){ return x.id === oid; });
      if(!ro) return;
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      if(saleLocked(ro)){ toast("الأوردر ده في فترة مقفولة — مينفعش يتعدّل"); return; }
      var cEl = SGP.querySelector("[data-sgcour='" + oid + "']");
      ro.courier = squish(cEl ? cEl.value : "") || ro.courier || "";
      ro.shippedAt = today();
      ro.editedBy = me || "غير محدد"; ro.at = Date.now();
      saveSoon("sales"); renderAll();
      toast("#" + (ro.no || "") + " خرج للتوصيل" + (ro.courier ? " مع " + ro.courier : "") + " — بقى في «مع المندوب»");
      return;
    }

    // ٢) نتيجة التسليم
    if((t = e.target.closest("[data-sggo]"))){
      var pr = t.dataset.sggo.split("|");
      var r2 = db.sales.find(function(x){ return x.id === pr[0]; });
      if(!r2) return;
      if(pr[1] === "part"){ sgPart = (sgPart === r2.id ? null : r2.id); renderStages();
        var f = SGP.querySelector("[data-sgret='" + r2.id + "|0']"); if(f) f.focus(); return; }
      delete sgSel[r2.id];
      setSaleStatus(r2, pr[1] === "none" ? "cancelled" : "delivered");
      return;
    }
    if((t = e.target.closest("[data-sgpartok]"))){ sgPartSave(t.dataset.sgpartok); return; }
    if(e.target.closest("[data-sgpartno]")){ sgPart = null; renderStages(); return; }
    if((t = e.target.closest("[data-sgfix]"))){
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      var r3 = db.sales.find(function(x){ return x.id === t.dataset.sgfix; });
      if(!r3 || saleLocked(r3)) return;
      if(!syncShipPaid(r3)){ toast("مفيش حاجة تتصحّح"); return; }
      r3.editedBy = me || "غير محدد"; r3.at = Date.now();
      saveSoon("sales"); renderAll();
      toast("اتسجّل: العميل دفع " + money(Number(r3.paid)||0) + " لـ " + (squish(r3.shipCo) || "الشركة") +
            " — مش عليه حاجة خلاص", 4200);
      return;
    }
    if((t = e.target.closest("[data-sgbulk]"))){
      var k = t.dataset.sgbulk;
      if(k === "clear"){ sgSel = {}; renderStages(); return; }
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      // نفس الإجراء الجماعي بتاع الجدول — نفس الحواجز بالظبط
      selSales = {}; Object.keys(sgSel).forEach(function(id){ selSales[id] = 1; });
      sgSel = {};
      if(k === "all") bulkRun("deliverpay"); else bulkRun(null, "cancelled");
      // النتيجة بتتكتب في الجدول (مستخبّي هنا) — بنعرضها في البانل
      var res = document.getElementById("s-bulk-res");
      sgNote = res && !res.hidden ? { t:res.textContent, bad:/bad/.test(res.className) } : null;
      renderStages();
      return;
    }

    // ٣) الفلوس
    if((t = e.target.closest("[data-sgdraw]"))){
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      var q = t.dataset.sgdraw.split("|"), cname = q[0];
      if(q[1] === "all"){
        var g = stageLists();
        var tot = g.st[3].filter(function(s){ return squish(s.shipCo) === cname; })
          .reduce(function(a, s){ return a + shipPend(s).left; }, 0);
        settleCo(cname, Math.min(tot, walletOf(cname)));
      } else {
        var box = SGP.querySelector("[data-sgamt='" + cname + "']");
        var v = Number(toEn(box ? box.value : ""))||0;
        if(!settleCo(cname, v) && box) box.focus();
      }
      return;
    }
    if((t = e.target.closest("[data-sgqpay]"))){ quickPay(t.dataset.sgqpay, true); return; }

    // ٤) كل مرتجع الشركة وصل
    if((t = e.target.closest("[data-sgbackall]"))){
      if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
      var cn = t.dataset.sgbackall, n = 0;
      heldOpen().forEach(function(x){
        if(squish(x.s.shipCo) !== cn || saleLocked(x.s)) return;
        if(markLineBack(x.s.id, x.i, false)) n += x.n;
      });
      renderAll();
      toast(n ? "اتسجّل إن " + qty(n) + " قطعة رجعت المخزن" : "مفيش حاجة معلّقة");
      return;
    }
  });
  SGP.addEventListener("change", function(e){
    var c = e.target.closest("[data-sgsel]"); if(!c) return;
    if(c.checked) sgSel[c.dataset.sgsel] = 1; else delete sgSel[c.dataset.sgsel];
    renderStages();
  });
  SGP.addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    var t = e.target.closest("[data-sgcode],[data-sgco]");
    if(t){ e.preventDefault(); var b = t.parentNode.querySelector("[data-sgship]"); if(b) b.click(); return; }
    var a = e.target.closest("[data-sgamt]");
    if(a){ e.preventDefault(); var b2 = a.parentNode.querySelector("[data-sgdraw$='|part']"); if(b2) b2.click(); return; }
    var r = e.target.closest("[data-sgret]");
    if(r){ e.preventDefault(); sgPartSave(r.dataset.sgret.split("|")[0]); }
  });

  function renderBulkBar(){
    var n = selIds().length, bar = document.getElementById("s-bulk");
    // الموبايل: مربعات الاختيار بتبان بس وإنت بتختار (بعد دوسة طويلة)
    var tb = document.getElementById("t-sales"); if(tb) tb.classList.toggle("sel-mode", n > 0);
    if(!bar) return;
    bar.hidden = !n;
    document.getElementById("s-bcount").textContent = qty(n);
    if(!n){ var r = document.getElementById("s-bulk-res"); if(r) r.hidden = true; }
  }


