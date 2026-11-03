  /* ================= جدول الأوردرات ================= */
  // ٥ أعمدة بتتقري بنظرة. الشحن والربح والتحصيل نزلوا سطر التفاصيل.
  var SALE_HEAD = ["","الأوردر","العميل","الأصناف","الإجمالي","الحالة",""];
  var openRows = {};        // الأوردرات المفتوح سطر تفاصيلها
  var selSales = {};        // الأوردرات المختارة للإجراء الجماعي
  function selIds(){ return Object.keys(selSales); }

  function saleRowHTML(s){
    var st = stOf(s);
    var p  = db.parties.find(function(x){ return x.id===s.partyId; }) || {};
    var lines = SL(s), canc = isCancelled(s);
    var due = isDelivered(s) ? (saleTotal(s) + shipIn(s) - (Number(s.paid)||0)) : 0;
    var isOpen = !!openRows[s.id];

    /* الأصناف في سطر واحد: كل صنف باسمه وعدد قطعه، والألوان والمقاسات تحت —
       كده ارتفاع السطر ثابت مهما كان عدد الأصناف. التفصيل الكامل بسعره في اللوحة. */
    var grp = [], byI = {}, backN = 0, pcs = 0;
    lines.forEach(function(l){
      var q = Number(l.qty)||0, k = l.itemId || "?";
      if(!byI[k]){ byI[k] = { id:l.itemId, q:0, v:[] }; grp.push(byI[k]); }
      byI[k].q += q; pcs += q;
      var vl = vLabel(vColor(l), vSize(l)); if(vl && byI[k].v.indexOf(vl) < 0) byI[k].v.push(vl);
      backN += canc ? q : lineRet(l);
    });
    var goods = grp.length ? "<div class='goods'>" + thumbHTML(grp[0].id) +
      "<span class='g1'><span class='nm'>" + grp.slice(0, 2).map(function(g){
          return esc(itemName(g.id)) + " <b class='num'>×" + qty(g.q) + "</b>"; }).join(" · ") +
        (grp.length > 2 ? " <span class='more'>و" + qty(grp.length - 2) + " صنف تاني</span>" : "") + "</span>" +
      "<span class='secondary'>" + (grp.length === 1 && grp[0].v.length ? esc(grp[0].v.join(" · ")) : nPcs(pcs)) +
        (shipIn(s) ? " · شحن " + qty(shipIn(s)) : "") +
        (backN ? " · <span class='v-due'>مرتجع " + qty(backN) + "</span>" : "") + "</span></span></div>" : "";

    var collected = canc ? shipIn(s) : (Number(s.paid)||0);
    // الملغي إجماليه صفر فعلاً، بس عرض 0.00 لوحده بيضلّل —
    // بنوري قيمته الأصلية مشطوبة عشان تعرف الأوردر ده كان بكام.
    var rawGoods = lines.reduce(function(a,l){
      return a + (Number(l.qty)||0) * (Number(l.price)||0); },0);
    var totalCell = "<span class='primary num'>" +
        (canc ? "<s style='opacity:.5;font-weight:500'>" + money(rawGoods) + "</s>"
              : money(saleTotal(s))) + "</span>" +
      "<span class='secondary num'>" +
        (viaShip(s)
          /* أوردر الشركة: العميل دفع للمندوب وخرج — اللي يهمّك هنا
             هل الفلوس لسه عند الشركة ولا وصلتك */
          ? (shipPaidGap(s) && isDelivered(s)
              ? "<span class='pill due'>سجّل دفع العميل</span>"
              : (isDelivered(s)
                  ? (shipPend(s).left > 0.009
                      ? "العميل دفع · <span class='pill due'>عند " + esc(squish(s.shipCo) || "الشحن") + " " +
                        money(shipPend(s).left) + "</span>"
                      : "العميل دفع · وصلك")
                  : (canc ? "ملغي · شحن " + money(shipOut(s)) : "لسه ما استلمش")))
          : (isDelivered(s)
              ? (due > 0.009
                  ? "محصّل " + money(collected) + " <span class='pill due'>باقي " + money(due) + "</span>"
                  // حصّل أكتر من المطلوب (العميل رجّع بعد ما دفع) — دي مش «خالص»
                  : (due < -0.009 ? "<span class='pill due'>ترجّعله " + money(-due) + "</span>" : "خالص"))
              : (canc ? "ملغي · شحن " + money(shipOut(s)) : "لسه ما اتحصّلش"))) +
      "</span>";

    var row = "<tr class='order" + (isOpen ? " open" : "") + (s.id === freshId ? " fresh" : "") +
        (selSales[s.id] ? " sel" : "") +
        "' data-st='" + st + "' data-row='" + s.id + "' tabindex='0'>" +
      "<td class='selcell'><input type='checkbox' data-sel='" + s.id + "'" +
        (selSales[s.id] ? " checked" : "") + " aria-label='اختار أوردر " + esc(s.no||"") + "'></td>" +
      "<td class='lead'><span class='ono'>" + (s.no ? "#"+esc(s.no) : "—") + "</span>" +
        "<span class='secondary num' title='" + esc(s.date||"") + "'>" + esc(dShort(s.date) || "—") + "</span></td>" +
      "<td class='cust'><span class='primary' style='font-size:var(--fs-3)'>" + esc(partyName(s.partyId)) + "</span>" +
        (p.gov||p.phone ? "<span class='secondary'>" + esc([p.gov,p.phone].filter(Boolean).join(" · ")) + "</span>" : "") + "</td>" +
      "<td class='items'>" + (goods || "—") + "</td>" +
      "<td class='total'>" + totalCell + "</td>" +
      /* الحالة بتتغيّر من السطر على طول — كانت محتاجة تفتح التفاصيل
         أو درج التعديل. المعالج والحواجز (المخزون والفترة المقفولة)
         هم هم اللي شغّالين من التفاصيل. */
      "<td class='stat'><select class='rowst st st-" + st + "' data-status='" + s.id + "'" +
        (canEdit() ? "" : " disabled") + " aria-label='حالة الأوردر'>" +
        stChoices(st).map(function(k){
          return "<option value='" + k + "'" + (k === st ? " selected" : "") + ">" +
                 esc(stOptTxt(s, k)) + "</option>"; }).join("") +
      "</select>" + (function(){
        var sp = orderStep(s);
        return "<span class='stepline" + (sp.done ? " done" : "") + "'>" + esc(stepTxt(sp)) + "</span>";
      })() + delTag(s) + cfTag(s) + "</td>" +
      "<td class='rowacts'>" + rowNextBtn(s) +
        "<button class='rowact' type='button' data-edit='sales|" + s.id + "' title='تعديل' aria-label='تعديل'>✎</button>" +
        "<span class='chev' aria-hidden='true'>▾</span></td></tr>";

    if(!isOpen) return row;
    return row + detailRowHTML(s);
  }

  // مين بيوصّل الأوردر — بيبان في السطر جنب الحالة
  function delTag(s){
    if(s.selfDel) return "<span class='dtag'>🛵 " + esc(squish(s.courier) || "توصيل بنفسك") + "</span>";
    var co = squish(s.shipCo), cd = squish(s.shipCode);
    return co || cd ? "<span class='dtag'>" + esc([co, cd].filter(Boolean).join(" · ")) + "</span>" : "";
  }
  /* زرار الخطوة الجاية في السطر نفسه — الخطوات اللي بدوسة واحدة بس.
     اللي محتاجة كتابة (الكود، الاستلام الجزئي…) بتتعمل من اللوحة أو الدرج. */
  function rowNextBtn(s){
    if(!canEdit() || saleLocked(s)) return "";
    var sp = orderStep(s), co = squish(s.shipCo) || "الشركة", b = function(a, t, cls){
      return "<button class='tbtn rownext" + (cls ? " " + cls : "") + "' type='button' " + a + ">" + esc(t) + "</button>"; };
    if(sp.k === "ship")
      return s.selfDel ? b("data-rowout='" + s.id + "'", "خرج للتوصيل", "primary")
                       : b("data-stepship='" + s.id + "'", squish(s.shipCo) ? "اكتب الكود" : "اكتب الشركة والكود");
    if(sp.k === "inspect")
      return b("data-stepgo='" + s.id + "|all'", s.selfDel ? "✓ استلم ودفع " + qty(sgFull(s)) : "خد كله", "primary");
    if(sp.k === "collect") return b("data-qpayall='" + s.id + "'", "حصّل " + qty(saleMoney(s).due), "primary");
    if(sp.k === "custpaid") return b("data-fixpaid='" + s.id + "'", "العميل دفع لـ" + co, "primary");
    if(sp.k === "draw") return b("data-stepdraw='" + s.id + "'", "استلم من " + co);
    if(sp.k === "back") return b("data-allback='" + s.id + "'", "المرتجع وصل");
    return "";
  }
  // «خرج للتوصيل» من السطر أو اللوحة — نفس اللي في بانل «جديد»
  function markOut(id){
    var r = db.sales.find(function(x){ return x.id === id; });
    if(!r) return;
    if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
    if(saleLocked(r)){ toast("الأوردر ده في فترة مقفولة — مينفعش يتعدّل"); return; }
    r.shippedAt = today(); r.editedBy = me || "غير محدد"; r.at = Date.now();
    saveSoon("sales"); renderAll();
    toast("#" + (r.no || "") + " خرج للتوصيل" + (r.courier ? " مع " + r.courier : ""));
  }

  // بلوك واحد في جدول الفلوس: اسم · رقم · (علامة)
  function mRow(label, val, cls, sign){
    return "<div class='mrow" + (cls ? " " + cls : "") + "'>" +
      "<span>" + esc(label) + "</span>" +
      "<b class='num'>" + (sign || "") + esc(money(val)) + "</b></div>";
  }

  /* تليفون مصري → رابط واتساب: 010… بيبقى 2010… */
  function waLink(phone){
    var d = String(phone || "").replace(/[^\d]/g, "");
    if(!d) return "";
    if(d.indexOf("00") === 0) d = d.slice(2);
    else if(d.charAt(0) === "0") d = "2" + d;
    return "https://wa.me/" + d;
  }
  // تاريخ قصير للمشوار: 2026-09-28 → 28/9
  function dShort(d){
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
    return m ? Number(m[3]) + "/" + Number(m[2]) : "";
  }

  /* تفاصيل الأوردر — من فوق لتحت بالأهمية:
       ١ الرأس: الأوردر ده مين (الرقم · الحالة · الشركة · الكود) وأزراره
       ٢ الخطوة الجاية وزرارها
       ٣ تلات كروت: العميل (تكلّمه إزاي) · الفلوس (حساب واحد بيتقري
         من فوق لتحت) · مشوار الأوردر (حصل إيه وإمتى، وإيه اللي مستني)
       ٤ الأصناف: صنف في سطر، وحالته ومرتجعه جنبه
     التاريخ والحالة اتشالوا من هنا: التاريخ في «تعديل»، والحالة في
     السطر وزراير الخطوة — مكانين يغيّروا نفس الحاجة كانوا بيلخبطوا.
     و«حذف» جوه «⋯» عشان ما يتداسش بالغلط جنب «تعديل». */
  function detailRowHTML(s){
    var st = stOf(s), m = saleMoney(s), canc = isCancelled(s), deliv = isDelivered(s);
    var via = viaShip(s), co = squish(s.shipCo), coN = co || "شركة الشحن";
    var p = db.parties.find(function(x){ return x.id === s.partyId; }) || {};
    var ed = canEdit() && !saleLocked(s);

    /* ---- ١ الرأس ---- */
    var head = "<div class='dd-head'><div class='dd-id'>" +
        "<span class='dd-no'>#" + esc(s.no || "—") + "</span>" +
        "<span class='st st-" + st + "'>" + esc(saleStateTxt(s)) + "</span>" +
        (co ? "<span>" + esc(co) + "</span>" : "") +
        (squish(s.shipCode)
          ? "<button type='button' class='dd-code num' data-copy='" + esc(squish(s.shipCode)) +
            "' title='دوس تنسخ الكود'>" + esc(squish(s.shipCode)) + " ⧉</button>" : "") +
      "</div><div class='dd-acts'>" +
        "<span class='dd-nav'><button class='tbtn' type='button' data-snav='prev' title='الأوردر اللي فوقه' aria-label='اللي فوقه'>→</button>" +
        "<button class='tbtn' type='button' data-snav='next' title='الأوردر اللي تحته' aria-label='اللي تحته'>←</button></span>" +
        "<button class='tbtn' type='button' data-edit='sales|" + s.id + "'>✎ تعديل</button>" +
        "<button class='tbtn' type='button' data-repeat='" + s.id + "'>كرّر</button>" +
        "<button class='tbtn' type='button' data-label='" + s.id + "'>بوليصة</button>" +
        "<details class='dd-more'><summary class='tbtn' aria-label='حاجات تانية'>⋯</summary>" +
          "<div><button class='tbtn' type='button' data-del='sales' data-id='" + s.id + "'>حذف الأوردر</button></div></details>" +
        "<button class='tbtn dd-x' type='button' data-sclose='1' aria-label='اقفل التفاصيل'>✕</button>" +
      "</div></div>";

    /* ---- ٢ الخطوة الجاية ---- */
    var sp = orderStep(s), btns = "";
    if(ed && sp.k === "ship")
      btns = s.selfDel
        ? "<button class='tbtn primary' type='button' data-rowout='" + s.id + "'>خرج للتوصيل" + (s.courier ? " مع " + esc(s.courier) : "") + "</button>"
        : "<button class='tbtn primary' type='button' data-stepship='" + s.id + "'>اكتب الشركة والكود</button>";
    if(ed && sp.k === "inspect")
      btns = "<button class='tbtn primary' type='button' data-stepgo='" + s.id + "|all'>خد كله</button>" +
             "<button class='tbtn' type='button' data-stepgo='" + s.id + "|part'>خد جزء ورجّع جزء</button>" +
             "<button class='tbtn' type='button' data-stepgo='" + s.id + "|none'>رفض كله</button>";
    if(ed && sp.k === "collect")
      btns = "<button class='tbtn primary' type='button' data-qpayall='" + s.id + "'>العميل دفع الكل</button>";
    if(ed && sp.k === "custpaid")
      btns = "<button class='tbtn primary' type='button' data-fixpaid='" + s.id + "'>العميل دفع " +
             esc(money(shipPaidOf(s))) + " لـ " + esc(coN) + "</button>";
    if(sp.k === "draw" && canEdit())
      btns = "<button class='tbtn primary' type='button' data-stepdraw='" + s.id + "'>استلم " +
             esc(money(sp.upto)) + " من " + esc(coN) + "</button>";
    if(ed && sp.k === "refund")
      btns = "<button class='tbtn' type='button' data-edit='sales|" + s.id + "'>تعديل الأوردر</button>";
    if(ed && sp.k === "back")
      btns = "<button class='tbtn primary' type='button' data-allback='" + s.id + "'>استلمتها كلها</button>";
    // ٤ و٥ مش بالترتيب: المرتجع ممكن يوصل قبل الفلوس — زرّاره جنب زرار الفلوس
    if(ed && sp.k !== "back" && !sp.done && sp.n >= 4 && heldLeft(s))
      btns += "<button class='tbtn' type='button' data-allback='" + s.id + "'>المرتجع وصلني (" +
              qty(heldLeft(s)) + " قطعة)</button>";
    var DOTS = ["اتسجّل", s.selfDel ? "خرج للتوصيل" : "اتبعت", via || s.selfDel ? "استلم ودفع" : "العميل استلم",
                via ? "فلوسك" : "فلوسك من العميل", "المرتجع"];
    var dot = function(i){
      return "<li class='" + (sp.done || i < sp.n ? "ok" : (i === sp.n ? "now" : "")) + "'><i></i>" +
             "<span>" + esc(DOTS[i - 1]) + "</span></li>";
    };
    var step = "<div class='ostep dd-step" + (sp.done ? " done" : "") + "'>" +
      "<div class='dd-step-t'>" + (sp.done ? "<b>✓ الأوردر خلص</b>"
          : "<span class='dd-k'>الخطوة الجاية · " + sp.n + " من " + STEP_N + "</span><b>" + esc(sp.t) + "</b>") +
        (sp.hint ? "<p>" + esc(sp.hint) + "</p>" : "") +
        (sp.also ? "<p>" + esc(sp.also) + "</p>" : "") + "</div>" +
      (btns ? "<div class='ostep-b dd-step-b'>" + btns + "</div>" : "") +
      "<div class='ostep-ph' aria-hidden='true'>" +
        "<div><em>مع العميل</em><ol class='ostep-dots'>" + [1,2,3].map(dot).join("") + "</ol></div>" +
        "<div><em>" + (via ? "مع شركة الشحن" : "بعد الاستلام") + "</em><ol class='ostep-dots'>" +
          [4,5].map(dot).join("") + "</ol></div>" +
      "</div></div>";

    /* ---- ٣أ العميل ---- */
    var ph = squish(p.phone || "");
    var cust = "<div class='dd-card dd-cust'><h5>العميل</h5>" +
      "<div class='dd-nm'>" + esc(partyName(s.partyId)) + "</div>" +
      (ph ? "<div class='dd-ph'><span class='num'>" + esc(ph) + "</span>" +
            "<a class='tbtn' href='tel:" + esc(ph.replace(/[^\d+]/g, "")) + "'>📞 اتصال</a>" +
            (waLink(ph) ? "<a class='tbtn' href='" + esc(waLink(ph)) + "' target='_blank' rel='noopener'>واتساب</a>" : "") +
          "</div>" : "") +
      (p.gov || p.address ? "<div class='dd-addr'>" + esc([p.gov, p.address].filter(Boolean).join(" · ")) + "</div>" : "") +
      (s.note ? "<div class='dd-memo'>📝 " + esc(s.note) + "</div>" : "") +
      (squish(s.owner) ? "<span class='sub'>المسؤول: " + esc(squish(s.owner)) + "</span>" : "") +
      "</div>";

    /* ---- ٣ب الفلوس: حساب واحد بيتقري من فوق لتحت ---- */
    var ML = function(a, b, cls){
      return "<div class='dd-ml" + (cls ? " " + cls : "") + "'><span>" + a + "</span><span class='num'>" + b + "</span></div>";
    };
    var left = via ? shipPend(s).left : 0, gap = via ? shipPaidGap(s) : 0, fin = "";
    if(canc){
      fin += ML("الأوردر ملغي", "مفيش مطلوب من العميل", "sub2");
      if(shipIn(s)) fin += ML(via ? "العميل دفع الشحن لـ " + esc(coN) : "الشحن اللي دفعه العميل", esc(money(shipIn(s))), "tot");
      if(shipOut(s)) fin += ML("− شحن " + esc(coN), esc(money(shipOut(s))), "sub2");
    } else if(!deliv){
      fin += ML("المطلوب من العميل", esc(money(sgFull(s))), "tot");
      fin += ML("الحساب", "بعد التسليم", "sub2");
      fin += "<p class='dd-fn'>" + (via ? "أول ما العميل يستلم ويدفع للمندوب، السيستم بيسجّل المبلغ لوحده."
                                        : "بيتحسب لما العميل يستلم.") + "</p>";
      if(!via && (Number(s.paid)||0) > 0.009) fin += ML("دفع مقدّم", esc(money(Number(s.paid)||0)));
    } else if(via && !gap){
      fin += ML("البضاعة اللي خدها", esc(money(m.goods)));
      if(m.shipIn) fin += ML("+ الشحن على العميل", esc(money(m.shipIn)), "sub2");
      fin += ML("العميل دفع لـ " + esc(coN), esc(money(m.paid)) + " <span class='v-gain'>العميل: خالص ✓</span>", "tot");
      if(m.shipOut) fin += ML("− شحن " + esc(coN), esc(money(m.shipOut)), "sub2");
      fin += ML("لسه عند " + esc(coN), left > 0.009 ? esc(money(left)) : "<span class='v-gain'>وصلك ✓</span>", "tot big");
    } else if(via){
      // أوردر قديم: المسجّل مش مطابق للي العميل خده
      fin += ML("المطلوب من العميل", esc(money(m.owed)), "tot");
      fin += ML("العميل دفع لـ " + esc(coN) + " (المسجّل)", esc(money(m.paid)));
      fin += ML(m.due > 0 ? "لسه ما اتسجّلش" : "مسجّل زيادة", "<span class='v-due'>" + esc(money(Math.abs(m.due))) + "</span>");
    } else {
      fin += ML("البضاعة اللي خدها", esc(money(m.goods)));
      if(m.shipIn) fin += ML("+ الشحن على العميل", esc(money(m.shipIn)), "sub2");
      fin += ML("المطلوب من العميل", esc(money(m.owed)), "tot");
      fin += ML("المحصّل", esc(money(m.paid)));
      fin += ML(m.due > 0.009 ? "باقي عليه" : (m.due < -0.009 ? "ترجّعله" : "الحساب"),
                Math.abs(m.due) < 0.009 ? "<span class='v-gain'>خالص ✓</span>"
                                        : "<span class='v-due'>" + esc(money(Math.abs(m.due))) + "</span>", "tot big");
    }
    /* تحصيل مباشر: العميل دفع الباقي — من غير ما تفتح الدرج */
    if(!via && deliv && m.due > 0.009 && ed)
      fin += "<div class='quickpay'>" +
        "<label for='qp-" + s.id + "'>تحصيل من العميل</label>" +
        "<input id='qp-" + s.id + "' inputmode='decimal' data-qp='" + s.id + "' placeholder='" + esc(money(m.due)) + "'>" +
        "<button class='tbtn primary' type='button' data-qpay='" + s.id + "'>سجّل</button>" +
        "<button class='tbtn' type='button' data-qpayall='" + s.id + "'>حصّلت الكل</button>" +
        "<p class='hintline'>الباقي " + esc(money(m.due)) + " — بيدخل الخزنة على طول</p></div>";
    var warns = [];
    if(m.due < -0.009 && !via)
      warns.push("حصّلت منه أكتر من المطلوب — ترجّعله " + money(-m.due) + ".");
    /* الأوردر الملغي بيتفك بالكامل: السيستم بيفترض إن العربون رجع للعميل.
       لو إنت ماسكه (مصاريف إلغاء مثلًا) لازم تسجّله دخل في الخزنة. */
    if(canc && (Number(s.paid)||0) > 0.009)
      warns.push("العميل كان دافع " + money(Number(s.paid)||0) +
        " — السيستم بيعتبرها رجعتله مع الإلغاء. لو ماسكها، سجّلها «دخل» في الخزنة.");
    var money_ = "<div class='dd-card dd-money'><h5>الفلوس</h5>" + fin +
      (warns.length ? "<div class='owarn'>" + warns.map(function(w){
          return "<p class='v-due'>" + esc(w) + "</p>"; }).join("") + "</div>" : "") +
      (m.known
        ? "<div class='dd-profit money-only'><span>صافي ربح الأوردر" +
            (m.pocket > 0.009 ? " <small class='v-due'>(شحن من جيبك " + esc(money(m.pocket)) + ")</small>" : "") +
            "<small>" + esc(money(m.owed)) + " − " + esc(money(m.outlay)) + "</small></span>" +
            "<b class='num " + (m.profit >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(m.profit)) + "</b></div>"
        : ddExpProfit(s)) +
      "</div>";

    /* ---- ٣ج مشوار الأوردر ---- */
    var TL = [], add = function(ok, t, d){ TL.push([ok, t, d || ""]); };
    add(true, "اتسجّل", dShort(s.date));
    if(s.selfDel){
      if(s.shippedAt) add(true, "خرج للتوصيل" + (s.courier ? " مع " + esc(s.courier) : ""), dShort(s.shippedAt));
      else add(false, "لسه ما خرجش للتوصيل", "مستني");
    }
    else if(co && squish(s.shipCode)) add(true, "اتبعت مع " + esc(co), dShort(s.shippedAt || s.date));
    else add(false, "لسه ما اتبعتش", "مستني");
    var retN = retQty(s);
    if(deliv)
      add(true, (via ? "العميل استلم ودفع " + esc(money(m.paid)) : "العميل استلم") +
                (retN ? " — رجّع " + nPcs(retN) : ""), dShort(s.deliveredAt));
    else if(canc) add(true, "العميل رفض الأوردر", dShort(s.cancelledAt));
    else if((co && squish(s.shipCode)) || (s.selfDel && s.shippedAt)) add(false, "العميل لسه ما استلمش", "مستني");
    if(deliv || canc){
      if(via){
        var net = (canc ? shipIn(s) : (Number(s.paid)||0)) - shipOut(s);
        if(left > 0.009) add(false, "فلوسك لسه عند " + esc(coN) + " (" + esc(money(left)) + ")", "مستني");
        else if(net > 0.009) add(true, "فلوسك وصلتك من " + esc(coN), "");
      } else if(deliv){
        if(m.due > 0.009) add(false, "لسه " + esc(money(m.due)) + " على العميل", "مستني");
        else add(true, "العميل دفعلك", "");
      }
      var held = heldLeft(s), backs = SL(s).map(function(l){ return l.backAt || s.backAt || ""; })
        .filter(Boolean).sort();
      if(held) add(false, qty(held) + " قطعة راجعة لسه عند " + esc(coN), "مستني");
      else if(heldPieces(s) && backs.length) add(true, "المرتجع رجع المخزن", dShort(backs[backs.length - 1]));
    }
    var tl = "<div class='dd-card'><h5>مشوار الأوردر</h5><ul class='dd-tl'>" +
      TL.map(function(x){
        return "<li class='" + (x[0] ? "ok" : "wait") + "'><i></i><span>" + x[1] + "</span>" +
               "<span class='d num'>" + esc(x[2]) + "</span></li>"; }).join("") + "</ul></div>";

    /* ---- ٤ الأصناف: صنف في سطر ---- */
    var items = SL(s).map(function(l, i){
      var vl = vLabel(vColor(l), vSize(l)), sold = lineSold(l, s), q0 = Number(l.qty)||0;
      var gp = m.known ? ((Number(l.price)||0) - lineCost(l)) * sold : null;
      var allBack = deliv && lineRet(l) >= q0 && q0 > 0;
      var stt = lineState(l, s);
      var canRet = deliv && !saleLocked(s) && canEdit();
      var acts = "";
      if(canRet)
        acts += "<label class='dd-ret'>مرتجع <input class='retin' inputmode='decimal' data-ret='" + s.id + "|" + i + "' " +
          "value='" + (lineRet(l) ? esc(qty(lineRet(l))) : "") + "' placeholder='0' " +
          "aria-label='مرتجع من " + esc(itemName(l.itemId)) + "'></label>";
      else if(lineRet(l)) acts += "<span class='sub'>مرتجع " + qty(lineRet(l)) + "</span>";
      if(stt.k === "held" && ed)
        acts += "<button class='tbtn' type='button' data-heldback='" + esc(s.id) + "|" + i + "'>وصلتني</button>";
      if(stt.k === "back" && ed)
        acts += "<button class='tbtn ghostx' type='button' data-heldback='" + esc(s.id) + "|" + i + "' data-undo='1'>تراجع</button>";
      return "<div class='dd-it'>" +
        (thumbHTML(l.itemId) || "<span class='dd-noimg' aria-hidden='true'>" + esc(itemName(l.itemId).charAt(0)) + "</span>") +
        "<span><span class='dd-in'>" + esc(itemName(l.itemId)) + "</span>" +
          (vl ? "<span class='sub'>" + esc(vl) + "</span>" : "") + "</span>" +
        "<span class='num'><span" + (allBack ? " class='dd-dim'" : "") + ">" + qty(q0) + " × " + esc(money(l.price)) + "</span>" +
          (allBack ? "<span class='sub'>رجّعها</span>"
                   : (gp !== null ? "<span class='sub money-only'>ربح " + esc(money(gp)) + "</span>" : "")) + "</span>" +
        "<span><span class='st st-" + stt.cls + "'>" + esc(stt.t) + "</span>" +
          (stt.sub ? "<span class='sub'>" + esc(stt.sub) + "</span>" : "") + "</span>" +
        "<span class='dd-ia'>" + acts + "</span></div>";
    }).join("");

    return "<tr class='detail' data-detail='" + s.id + "'><td colspan='" + SALE_HEAD.length + "'><div class='detail-in dd'>" +
      head + (ed ? shipAskHTML(s) : "") + step +
      "<div class='dd-cards'>" + cust + money_ + tl + "</div>" +
      "<div class='dd-items'><h5>الأصناف</h5>" + items + "</div>" +
      "</div></td></tr>";
  }

  /* ---------- الفلاتر: chips + عدّاد ---------- */
  // الحالة بقت جوه «فلاتر» — فلازم تبان chip وتتعدّ، وإلا تفضل شغالة وإنت مش شايفها
  var FLT_LABEL = { status:"الحالة", party:"العميل", item:"الصنف", ship:"شركة الشحن",
                    owner:"المسؤول", from:"من", to:"لـ", text:"بحث" };

  function chipText(k){
    var v = filt[k];
    if(k === "status"){ var t = STAB.find(function(x){ return x[0] === v; }); return t ? t[1] : (ST_LABEL[v] || v); }
    if(k === "party")  return partyName(v);
    if(k === "item")   return itemName(v);
    return v;
  }
  function activeFilterKeys(){
    return Object.keys(FLT_LABEL).filter(function(k){ return filt[k]; });
  }
  function renderChips(){
    var keys = activeFilterKeys();
    var c = document.getElementById("flt-count");
    c.textContent = keys.length; c.hidden = !keys.length;
    document.getElementById("flt-chips").innerHTML = !keys.length ? "" :
      keys.map(function(k){
        return "<span class='chip'>" + esc(FLT_LABEL[k]) + ": <b>" + esc(chipText(k)) + "</b>" +
          "<button type='button' data-rmflt='" + k + "' aria-label='شيل فلتر " + esc(FLT_LABEL[k]) + "'>&times;</button></span>";
      }).join("") + "<button class='clearall' type='button' id='b-clearf'>مسح الكل</button>";
  }

  /* ---------- شرايط الحالة: أسرع فلتر في الشاشة ---------- */
  // العدّاد بيتحسب على باقي الفلاتر الشغالة، فالرقم اللي قدامك هو اللي هتشوفه فعلاً
  // «مرتجع» مش حالة — دي صفة: أوردر فيه بضاعة رجعت. فبتتفلتر لوحدها.
  var STAB = [["","الكل"],["_todo","محتاج مني حاجة"],["progress","جاري"],["delivered","مسلّم"],
              ["_ret","مرتجع"],["cancelled","ملغي"]];
  function stabMatch(s, k){
    if(k === "_ret")  return retQty(s) > 0;
    if(k === "_todo") return !orderStep(s).done;
    return stOf(s) === k;
  }
  function renderStatusTabs(){
    var base = filteredSales(true);
    var n = {};
    base.forEach(function(s){
      var k = stOf(s); n[k] = (n[k]||0) + 1;
      if(retQty(s) > 0) n._ret = (n._ret||0) + 1;
      if(!orderStep(s).done) n._todo = (n._todo||0) + 1;
    });
    document.getElementById("s-tabs").innerHTML = STAB.map(function(t){
      var c = t[0] ? (n[t[0]]||0) : base.length;
      return "<button type='button' data-stab='" + t[0] + "'" +
        (filt.status === t[0] ? " class='on' aria-pressed='true'" : " aria-pressed='false'") +
        ">" + esc(t[1]) + " <b>" + qty(c) + "</b></button>";
    }).join("");
  }

  function renderSaleStats(list){
    var rev  = list.filter(isDelivered).reduce(function(a,s){ return a+saleTotal(s); },0);
    var net  = list.reduce(function(a,s){ return a+saleProfit(s); },0);
    // موجب = دفعت للشركات أكتر مما حمّلته للعملاء، يعني طلع من جيبك
    var pocket = list.reduce(function(a,s){
      return a + (shipCounts(s) ? shipOut(s) - shipIn(s) : 0); },0);
    var deliv = list.filter(isDelivered).length;
    /* فلوس مستنياك: التحصيل المباشر عند العميل، وأوردرات الشركة
       عند الشركة (العميل دفع للمندوب وخرج من القصة). */
    var owedN = 0, owed = 0, shipN = 0, shipOwed = 0;
    list.forEach(function(s){
      if(viaShip(s)){
        var lf = shipPend(s).left;
        if(Math.abs(lf) > 0.009){ shipN++; shipOwed += lf; }                    // v147: المرفوض اللي عليك بيتخصم
        return;
      }
      if(!isDelivered(s)) return;
      var d = saleTotal(s) + shipIn(s) - (Number(s.paid)||0);
      if(d > 0.009){ owedN++; owed += d; }
    });
    var cells = [
      ["all", "أوردرات ظاهرة", qty(list.length), "", "من إجمالي " + qty(live("sales").length)],
      ["rev", "مبيعات مسلّمة", money(rev), "", qty(deliv) + " أوردر مسلّم"],
      ["owed", "تجريه من العملاء", money(owed), owed > 0.009 ? "v-due" : "",
       owed > 0.009 ? qty(owedN) + " أوردر تحصيله مباشر ليك" : "مفيش تحصيل مباشر معلّق"],
      ["ship", "فلوسك عند الشركات", money(shipOwed), "",
       shipOwed > 0.009 ? qty(shipN) + " أوردر العميل دفعه للمندوب ولسه ما وصلكش" : "كل فلوسك وصلتك"],
      ["pocket", pocket >= 0 ? "شحن من جيبك" : "كسبت من الشحن", money(Math.abs(pocket)),
       pocket > 0.009 ? "v-due" : "v-gain",
       pocket >= 0 ? "دفعت للشركات أكتر مما حمّلته للعملاء"
                   : "حمّلت العملاء أكتر مما دفعته للشركات"],
      ["net", "صافي الربح", money(net), net>=0?"v-gain":"v-due", "بعد الشحن والمرتجع", 1]
    ];
    document.getElementById("s-stats").innerHTML = cells.map(function(c){
      return "<div class='kpi" + (sKpiOpen === c[0] ? " on" : "") + (c[5] ? " money-only" : "") +
        "' data-skpi='" + c[0] + "' tabindex='0' role='button' title='" + esc(c[4]) + " — دوس تشوف التفاصيل'><span>" + esc(c[1]) + "</span>" +
        "<strong class='num " + c[3] + "'>" + esc(c[2]) + "</strong>" +
        "<span class='sub'>" + esc(c[4]) + "</span>" +
        "<span class='kpi-go' aria-hidden='true'>التفاصيل ›</span></div>";
    }).join("");
    sKpiList = list;
    renderSKpiDetail();
  }


  /* ---------- كروت المبيعات: كل كارت بيتفتح على تفاصيله ----------
     نفس سلوك باقي الشاشات. التفاصيل بتتحسب على نفس القايمة اللي
     الكروت اتحسبت عليها (بعد الفلاتر)، فإجمالي كل جدول = رقم كارته. */
  var sKpiOpen = null, sKpiList = [];
  // رقم الأوردر هنا بيفتح سطر تفاصيله في نفس الشاشة مش الدرج
  function sRowLink(s){
    return "<a href='#' data-gorow='" + esc(s.id) + "'>#" + esc(s.no || "—") + "</a>";
  }
  function sDue(s){ return saleTotal(s) + shipIn(s) - (Number(s.paid)||0); }
  var S_TITLE = { all:"الأوردرات الظاهرة", rev:"المبيعات المسلّمة",
                  owed:"تجريه من العملاء — تحصيل مباشر ليك", ship:"فلوسك عند شركات الشحن — أوردر أوردر",
                  pocket:"الشحن — حمّلت كام ودفعت كام", net:"صافي الربح — أوردر أوردر" };
  // v145: «الإجمالي (n أوردر)» تحت كل جداول تفاصيل الأوردرات
  function sumLbl(n){ return "الإجمالي (" + qty(n) + " أوردر)"; }
  var S_DETAIL = {
    all: function(L){
      var t = 0;                                                    // v145: إجمالي القيمة
      var rows = L.slice().sort(byDate).map(function(s){          // byDate = الأحدث الأول
        t += saleTotal(s);
        return "<tr><td class='num'>" + sRowLink(s) + "</td><td class='num'>" + esc(s.date || "—") + "</td>" +
          "<td class='wide'>" + esc(partyName(s.partyId)) + "</td>" +
          "<td class='num'>" + money(saleTotal(s)) + "</td>" +
          "<td>" + esc(saleStateTxt(s)) + "</td><td>" + esc(stepTxt(orderStep(s))) + "</td></tr>";
      });
      if(rows.length) rows.push(sumRow([sumLbl(rows.length),"","","<b>"+money(t)+"</b>","",""]));
      return { note:"كل الأوردرات اللي ظاهرة بالفلتر الحالي — الأحدث فوق. دوس على رقم الأوردر يفتح تفاصيله.",
               head:["الأوردر","التاريخ","العميل","الإجمالي","الحالة","الخطوة"], rows:rows };
    },
    rev: function(L){
      var d = L.filter(isDelivered).sort(byDate), t = 0, tq = 0;
      var rows = d.map(function(s){
        var v = saleTotal(s), q = soldQty(s); t += v; tq += q;
        return "<tr><td class='num'>" + sRowLink(s) + "</td><td class='num'>" + esc(s.date || "—") + "</td>" +
          "<td class='wide'>" + esc(partyName(s.partyId)) + "</td>" +
          "<td class='num'>" + qty(q) + (retQty(s) ? "<span class='sub'>رجّع " + qty(retQty(s)) + "</span>" : "") + "</td>" +
          "<td class='num'>" + money(v) + "</td></tr>";
      });
      if(rows.length) rows.push(sumRow([sumLbl(d.length),"","","<b>"+qty(tq)+"</b>","<b>"+money(t)+"</b>"]));
      return { note:"الأوردرات اللي اتسلّمت بس — ودي بس اللي بتتحسب مبيعات. القطع اللي رجعت مش محسوبة.",
               head:["الأوردر","التاريخ","العميل","قطع اتباعت","المبيعات"], rows:rows };
    },
    owed: function(L){
      var d = L.filter(function(s){ return isDelivered(s) && !viaShip(s) && sDue(s) > 0.009; }), t = 0, tr = 0, tpd = 0;
      var rows = d.map(function(s){
        var p = db.parties.find(function(x){ return x.id === s.partyId; }) || {};
        t += sDue(s); tr += saleTotal(s) + shipIn(s); tpd += Number(s.paid)||0;
        return "<tr><td class='num'>" + sRowLink(s) + "</td><td class='wide'>" + esc(partyName(s.partyId)) + "</td>" +
          "<td class='num'>" + (esc(p.phone || "") || "—") + "</td>" +
          "<td class='num'>" + money(saleTotal(s) + shipIn(s)) + "</td>" +
          "<td class='num'>" + money(Number(s.paid)||0) + "</td>" +
          "<td class='num v-due'>" + money(sDue(s)) + "</td></tr>";
      });
      if(rows.length) rows.push(sumRow([sumLbl(d.length),"","","<b>"+money(tr)+"</b>","<b>"+money(tpd)+"</b>","<b>"+money(t)+"</b>"]));
      return { note:"أوردرات اتسلّمت والتحصيل فيها مباشر ليك — مش عن طريق شركة الشحن — ولسه فيها باقي. دي اللي محتاجة تكلّم العميل عليها.",
               head:["الأوردر","العميل","التليفون","المطلوب","المحصّل","الباقي"], rows:rows };
    },
    ship: function(L){
      var d = L.filter(function(s){ return viaShip(s) && Math.abs(shipPend(s).left) > 0.009; }).sort(byDate), t = 0, tpd = 0;
      var rows = d.map(function(s){
        var lf = shipPend(s).left, pd = isCancelled(s) ? shipIn(s) : (Number(s.paid)||0); t += lf; tpd += pd;
        return "<tr><td class='num'>" + sRowLink(s) + "</td><td class='wide'>" + esc(partyName(s.partyId)) + "</td>" +
          "<td>" + esc(shipCoLabel(s.shipCo)) + "</td><td class='num'>" + (esc(squish(s.shipCode)) || "—") + "</td>" +
          "<td class='num'>" + money(pd) + "</td>" +
          "<td class='num'>" + money(lf) + "</td></tr>";
      });
      if(rows.length) rows.push(sumRow([sumLbl(d.length),"","","","<b>"+money(tpd)+"</b>","<b>"+money(t)+"</b>"]));
      return { note:"العميل دفع للمندوب وخرج من القصة — الفلوس دي عند شركة الشحن (بعد عمولتها) ولسه ما استلمتهاش. " +
                    "الاستلام من «شركات الشحن» بيتحسب على الأوردرات الأقدم الأول.",
               head:["الأوردر","العميل","الشركة","كود البوليصة","العميل دفع","لسه عند الشركة"], rows:rows };
    },
    pocket: function(L){
      var d = L.filter(function(s){ return shipCounts(s) && Math.abs(shipOut(s) - shipIn(s)) > 0.009; })
        .sort(function(a,b){ return (shipOut(b)-shipIn(b)) - (shipOut(a)-shipIn(a)); });
      var ti = 0, to = 0;
      var rows = d.map(function(s){
        var g = shipOut(s) - shipIn(s); ti += shipIn(s); to += shipOut(s);
        return "<tr><td class='num'>" + sRowLink(s) + "</td><td class='wide'>" + esc(partyName(s.partyId)) + "</td>" +
          "<td>" + esc(shipCoLabel(s.shipCo)) + "</td>" +
          "<td class='num'>" + money(shipIn(s)) + "</td><td class='num'>" + money(shipOut(s)) + "</td>" +
          "<td class='num " + (g > 0 ? "v-due" : "v-gain") + "'>" + money(Math.abs(g)) +
          "<span class='sub'>" + (g > 0 ? "من جيبك" : "ليك") + "</span></td></tr>";
      });
      if(rows.length) rows.push(sumRow([sumLbl(d.length),"","","<b>"+money(ti)+"</b>","<b>"+money(to)+"</b>",
        "<b>"+money(Math.abs(to - ti))+"</b><span class='sub'>" + (to - ti > 0.009 ? "من جيبك" : to - ti < -0.009 ? "ليك" : "") + "</span>"]));
      return { note:"الأوردرات اللي الشحن اللي حمّلته للعميل فيها مختلف عن اللي دفعته لشركة الشحن. الأكبر من جيبك فوق.",
               head:["الأوردر","العميل","الشركة","حمّلت العميل","دفعت للشركة","الفرق"], rows:rows };
    },
    net: function(L){
      var d = L.filter(function(s){ return Math.abs(saleProfit(s)) > 0.009; })
        .sort(function(a,b){ return saleProfit(b) - saleProfit(a); });
      var t = 0, tg = 0, tc = 0, tp = 0;                                  // v144: إجمالي كل عمود
      var rows = d.map(function(s){
        var m = saleMoney(s), pr = saleProfit(s); t += pr; tg += m.goods; tc += m.cost; tp += m.pocket || 0;
        return "<tr><td class='num'>" + sRowLink(s) + "</td><td class='wide'>" + esc(partyName(s.partyId)) + "</td>" +
          "<td class='num'>" + money(m.goods) + "</td><td class='num'>" + money(m.cost) + "</td>" +
          "<td class='num'>" + (m.pocket ? (m.pocket > 0 ? "−" : "+") + money(Math.abs(m.pocket)) : "—") + "</td>" +
          "<td class='num " + (pr >= 0 ? "v-gain" : "v-due") + "'>" + money(pr) + "</td></tr>";
      });
      if(rows.length) rows.push(sumRow([sumLbl(d.length),"","<b>"+money(tg)+"</b>","<b>"+money(tc)+"</b>",
        "<b>" + (Math.abs(tp) > 0.009 ? (tp > 0 ? "−" : "+") + money(Math.abs(tp)) : "—") + "</b>","<b>"+money(t)+"</b>"]));
      return { note:"ربح كل أوردر = المبيعات − تكلفة البضاعة − اللي طلع من جيبك في الشحن. الأكبر ربح فوق، والخسران تحت بالأحمر.",
               head:["الأوردر","العميل","المبيعات","تكلفة البضاعة","الشحن","صافي الربح"], rows:rows };
    }
  };
  function renderSKpiDetail(){
    var pnl = document.getElementById("s-kpi-panel");
    if(!pnl) return;
    if(!sKpiOpen || !S_DETAIL[sKpiOpen]){ pnl.hidden = true; return; }
    var d = S_DETAIL[sKpiOpen](sKpiList);
    pnl.hidden = false;
    document.getElementById("s-kpi-title").textContent = S_TITLE[sKpiOpen];
    document.getElementById("s-kpi-note").textContent = d.note || "";
    table("t-skpi", d.head, d.rows, "مفيش حاجة هنا بالفلتر الحالي.");
  }
  document.getElementById("s-stats").addEventListener("click", function(e){
    var c = e.target.closest("[data-skpi]"); if(!c) return;
    sKpiOpen = (sKpiOpen === c.dataset.skpi) ? null : c.dataset.skpi;
    renderSales();
    if(sKpiOpen) document.getElementById("s-kpi-panel").scrollIntoView({ block:"nearest" });
  });
  document.getElementById("s-stats").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var c = e.target.closest("[data-skpi]"); if(!c) return;
    e.preventDefault(); c.click();
  });
  document.getElementById("b-skpi-close").addEventListener("click", function(){
    sKpiOpen = null; renderSales();
  });
  // من سطر في التفاصيل للأوردر نفسه في الجدول تحت — مفتوح
  document.getElementById("t-skpi").addEventListener("click", function(e){
    var a = e.target.closest("[data-gorow]"); if(!a) return;
    e.preventDefault();
    var id = a.dataset.gorow;
    openRows = {}; openRows[id] = 1;
    renderSales();
    var tr = document.querySelector("#t-sales tr[data-row='" + id + "']");
    if(tr) tr.scrollIntoView({ block:"center" });
  });

  function renderSales(){
    renderStages();
    var list = filteredSales().slice().sort(byDate);
    renderStatusTabs();
    renderChips();
    renderSaleStats(list);

    // الأوردر المفتوح سطر تفاصيله واختفى بالفلتر ما يفضلش محفوظ للأبد
    Object.keys(openRows).forEach(function(id){
      if(!list.some(function(s){ return s.id === id; })) delete openRows[id];
    });
    selIds().forEach(function(id){
      if(!list.some(function(s){ return s.id === id; })) delete selSales[id];
    });

    var page = pageRows("sales", list);   // الإحصائيات فوق على الكل، والجدول على الدفعة
    var t = document.getElementById("t-sales");
    var allOn = page.length && page.every(function(x){ return selSales[x.id]; });
    t.innerHTML = "<thead><tr>" + SALE_HEAD.map(function(h, i){
        return i === 0
          ? "<th class='selcell'><input type='checkbox' id='s-selall'" + (allOn ? " checked" : "") +
            " aria-label='اختار كل الظاهر'></th>"
          : "<th>"+esc(h)+"</th>"; }).join("") +
      "</tr></thead><tbody>" + page.map(saleRowHTML).join("") +
      (list.length ? "" : "<tr><td class='empty' colspan='"+SALE_HEAD.length+"'>" +
        esc(live("sales").length ? "مفيش أوردرات بالمواصفات دي." : "مفيش أوردرات لسه — ابدأ بزرار «أوردر جديد» فوق.") +
        "</td></tr>") + "</tbody>";

    setTimeout(placeSide, 0);
    // على الموبايل كل خانة بتعرض اسم عمودها جنبها
    Array.prototype.forEach.call(t.querySelectorAll("tbody tr.order"), function(tr){
      Array.prototype.forEach.call(tr.children, function(td, i){
        if(SALE_HEAD[i]) td.setAttribute("data-l", SALE_HEAD[i]);
      });
    });

    renderBulkBar();
    setTimeout(function(){ freshId = null; }, 1600);
    if(SD_OPEN) updateEntryCalc();
  }

