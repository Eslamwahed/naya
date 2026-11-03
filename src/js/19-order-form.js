  /* ================= الدرج: فورم الأوردر ================= */
  // الفورم بقى بره الجدول، فالكتابة فيه ما بتهدّش الـ DOM وما بيحتاجش إنقاذ الفوكس.
  var SD = document.getElementById("sale-drawer");
  var SD_OPEN = false;

  // سطر صنف واحد — كارت مستقل بدل خلية في جدول متداخل
  function lineRowHTML(l, i){
    var it = db.items.find(function(x){ return x.id===l.itemId; });
    var cs = listOf(it,"colors"), zs = listOf(it,"sizes");
    /* اللون والمقاس بيبانوا بالمتاح جنبهم — أكتر غلطة في الإدخال إنك
       تختار تركيبة مش موجودة عندك أصلاً وتكتشف ده عند الحفظ. */
    var pick = function(list, sel, f){
      return "<select data-li='"+i+"' data-f='"+f+"'>" +
        optsHTML(list.map(function(v){
          return { v:v, t: l.itemId
            ? vOptLabel(l.itemId, f, v, f === "color" ? l.size : l.color)
            : v };
        }), sel, "اختر") + "</select>";
    };
    var dash = "<select disabled><option>—</option></select>";
    var showRet = draft.status === "delivered";

    return "<div class='lrow' data-li='"+i+"'>" +
      "<div class='lrow-top'>" +
        "<div class='grow'><label for='l-item-"+i+"'>الصنف</label>" +
          "<select id='l-item-"+i+"' data-li='"+i+"' data-f='itemId'>"+itemOptionsHTML(l.itemId)+"</select></div>" +
        "<div><label for='l-color-"+i+"'>اللون</label>" +
          (cs.length ? pick(cs, l.color, "color") : dash) + "</div>" +
        "<div><label for='l-size-"+i+"'>المقاس</label>" +
          (zs.length ? pick(zs, l.size, "size") : dash) + "</div>" +
      "</div>" +
      "<div class='lrow-top'>" +
        "<div><label for='l-qty-"+i+"'>الكمية</label>" +
          "<input id='l-qty-"+i+"' type='number' step='any' min='0' data-li='"+i+"' data-f='qty' value='"+esc(l.qty)+"'></div>" +
        "<div><label for='l-price-"+i+"'>سعر بيع القطعة</label>" +
          "<input id='l-price-"+i+"' type='number' step='any' min='0' data-li='"+i+"' data-f='price' value='"+esc(l.price)+"'></div>" +
        (showRet
          ? "<div><label for='l-ret-"+i+"'>مرتجع</label>" +
            "<input id='l-ret-"+i+"' type='number' step='any' min='0' data-li='"+i+"' data-f='ret' value='"+esc(l.ret)+"'></div>"
          : "") +
      "</div>" +
      (l.itemId && (cs.length || zs.length) && stockLine(l.itemId)
        ? "<p class='hintline stockline'>" + esc(stockLine(l.itemId)) + "</p>" : "") +
      "<div class='lrow-foot'>" +
        "<span class='ltot num' data-li='"+i+"'>—</span>" +
        (draft.lines.length > 1 ? "<button type='button' class='rm' data-rmline='"+i+"'>شيل السطر</button>" : "") +
      "</div></div>";
  }

  /* بعد ما تختار لون، أرقام المقاسات بتتغيّر. بنحدّث نص الخيارات في مكانه
     بدل ما نعيد بناء السطر — إعادة البناء جوّه change بتكسر الـDOM اللي المتصفح
     واقف عليه (نفس مشكلة درج الشراء). */
  function refreshVariantOpts(i){
    var l = draft.lines[i];
    if(!l || !l.itemId) return;
    ["color","size"].forEach(function(f){
      var sel = document.querySelector("#e-lines select[data-li='"+i+"'][data-f='"+f+"']");
      if(!sel) return;
      Array.prototype.forEach.call(sel.options, function(o){
        if(!o.value) return;
        o.textContent = vOptLabel(l.itemId, f, o.value,
          f === "color" ? l.size : l.color);
      });
    });
  }

  function renderDrawerLines(){
    var box = document.getElementById("e-lines");
    box.innerHTML = draft.lines.map(function(l,i){ return lineRowHTML(l,i); }).join("");
    numify(box);
    updateEntryCalc();
  }

  // بيملا الدرج كله من المسوّدة — بيتنادى مرة عند الفتح بس
  function renderDrawer(){
    var editingNow = !!editing.sales;
    var rec = editingNow ? db.sales.find(function(x){ return x.id===editing.sales; }) : null;

    document.getElementById("sd-title").textContent = editingNow ? "تعديل أوردر" : "أوردر جديد";
    document.getElementById("sd-no").textContent =
      editingNow ? (rec && rec.no ? "#"+rec.no : "—") : "#" + nextSaleNo();
    document.getElementById("b-canceldraft").textContent = editingNow ? "إلغاء التعديل" : "تفريغ";
    document.getElementById("b-savedraft").textContent   = editingNow ? "حفظ التعديل" : "حفظ الأوردر";

    document.getElementById("e-status").innerHTML =
      stChoices(draft.status).map(function(k){
        return "<option value='"+k+"'>"+ST_LABEL[k]+"</option>"; }).join("");

    var custs = live("parties").filter(function(p){ return p.type==="customer"; })
      .map(function(p){ return { v:p.id, t:p.name + (p.gov ? " · " + p.gov : "") }; });
    document.getElementById("e-party").innerHTML = optsHTML(custs, draft.partyId, "اختر عميل");

    [["e-date","date"],["e-status","status"],["e-owner","owner"],["e-shipco","shipCo"],
     ["e-shipcode","shipCode"],["e-shipin","shipIn"],["e-shipout","shipOut"],
     ["e-payvia","payVia"],["e-paid","paid"],["e-note","note"],["e-courier","courier"]].forEach(function(pair){
      document.getElementById(pair[0]).value = draft[pair[1]] == null ? "" : draft[pair[1]];
    });
    syncDelMode(); syncSrcUI(true);

    document.getElementById("newcust-box").hidden = true;
    var sn = document.getElementById("e-shipnote");
    if(sn){ sn.textContent = ""; sn.hidden = true; }
    if(!draft.partyId) suggestFor = null;
    shipHint(); syncMore(true);
    var cf = document.getElementById("e-conflict");
    if(cf){ cf.textContent = ""; cf.hidden = true; }
    var rp = document.getElementById("e-repeat");
    if(rp){
      var diffs = draft.fromNo ? repeatPriceDiffs(draft) : [];
      if(draft.fromNo && diffs.length){
        rp.textContent = "متكرّر من أوردر #" + draft.fromNo +
          " — الأسعار دي اتغيّرت في قايمة الأصناف: " + diffs.join(" · ") +
          ". سايبينها زي الأوردر القديم، غيّرها لو عايز.";
        rp.hidden = false;
      } else if(draft.fromNo){
        rp.textContent = "متكرّر من أوردر #" + draft.fromNo +
          " — راجع الكميات والمتاح قبل ما تحفظ.";
        rp.hidden = false;
      } else { rp.textContent = ""; rp.hidden = true; }
    }
    renderDrawerLines();
  }

  function openDrawer(){
    // لازم يبان الأول: updateEntryCalc بيخرج بدري لو الدرج لسه hidden
    SD.hidden = false;
    var scrim = document.getElementById("sale-scrim");
    scrim.hidden = false;
    renderDrawer();
    // الإطار ده بيخلي الانتقال يشتغل بدل ما العنصر يظهر فجأة
    requestAnimationFrame(function(){ SD.classList.add("on"); scrim.classList.add("on"); });
    SD_OPEN = true;
    var first = document.getElementById("e-party");
    if(first) first.focus();
  }

  function closeDrawer(){
    var scrim = document.getElementById("sale-scrim");
    SD.classList.remove("on"); scrim.classList.remove("on");
    SD_OPEN = false;
    setTimeout(function(){
      if(!SD_OPEN){ SD.hidden = true; scrim.hidden = true; }
    }, 240);
    var b = document.getElementById("b-newsale");
    if(b && !document.getElementById("tab-sales").hidden) b.focus();
  }

  // الأرقام الحية — بتتحدّث من غير ما نعيد بناء أي حقل
  function updateEntryCalc(){
    if(SD.hidden) return;
    var st = draft.status, goods = 0, needs = {}, problems = [], cost = 0;
    /* الربح المتوقع وانت بتجهّز الأوردر (جاري/مقترح): نفس حسبة التسليم بالظبط
       بس بمتوسط التكلفة النهارده. صنف لسه ما اتشراش تكلفته مش معروفة —
       بيطلع بره الحسبة بدل ما سعره كله يتحسب ربح. */
    var est = (st === "progress" || st === "proposed"), pgoods = 0, noCost = [], xtra = 0, ucMemo = {};
    draft.lines.forEach(function(l, i){
      var q = Number(l.qty)||0, pr = Number(l.price)||0;
      var ret = st === "delivered" ? Math.min(Number(l.ret)||0, q) : 0;
      var sold = st === "cancelled" ? 0 : Math.max(q - ret, 0);
      goods += sold * pr;
      if(st === "delivered"){ cost += lineCost(l) * sold; pgoods += sold * pr; }
      else if(est && l.itemId && sold > 0){
        var pinned = l.unitCost != null && l.unitCost !== "", ck = vKey(l.itemId, l.color, l.size);
        var uc = pinned ? lineCost(l) : (ck in ucMemo ? ucMemo[ck] : (ucMemo[ck] = lineCost(l)));
        if(uc > 0 || pinned){ cost += uc * sold; pgoods += sold * pr; xtra += prcExtra(pcItem(l.itemId)) * sold; }
        else if(noCost.indexOf(itemName(l.itemId)) < 0) noCost.push(itemName(l.itemId));
      }
      var tot = document.querySelector("#e-lines .ltot[data-li='"+i+"']");
      if(tot){
        var free = l.itemId ? comboAvail(l.itemId, l.color, l.size) : null;
        tot.innerHTML = (l.itemId ? esc(money(sold*pr)) : "—") +
          (free === null ? "" : " <em>· متاح " + esc(qty(free)) + "</em>");
      }
      if(!l.itemId) return;
      if((Number(l.ret)||0) > q) problems.push(itemName(l.itemId)+": المرتجع أكبر من المشحون");
      var m = variantMissing(l.itemId, l.color, l.size);
      if(m) problems.push(itemName(l.itemId)+": "+m);
      var k = vKey(l.itemId, l.color, l.size);
      needs[k] = (needs[k]||0) + (st==="cancelled"||st==="proposed" ? 0 : (st==="delivered" ? Math.max(q-ret,0) : q));
    });
    Object.keys(needs).forEach(function(k){
      if(needs[k] <= 0) return;
      var av = availOfKey(k), parts = k.split("|");
      if(needs[k] > av) problems.push(itemName(parts[0]) +
        (vLabel(parts[1],parts[2]) ? " ("+vLabel(parts[1],parts[2])+")" : "") +
        ": المتاح " + qty(av) + " وأنت بتبيع " + qty(needs[k]));
    });

    var sin = Number(draft.shipIn)||0, sout = Number(draft.shipOut)||0, paid = Number(draft.paid)||0;
    if(draftPreShip(st)){ sin = 0; sout = 0; }                     // v141: ملغي قبل الشحن — الشحن مش متحسب
    var hasItem = draft.lines.some(function(l){ return !!l.itemId; });
    if(st === "cancelled"){ sin = 0; }             // الملغي: مفيش بضاعة ولا شحن على العميل
    var owed = goods + sin;                        // المطلوب من العميل
    // أوردر الشركة: العميل استلم = دفع للمندوب (شوف syncShipPaid)
    if(viaShip(draft)){ paid = st === "delivered" ? Math.round(owed * 100) / 100 : 0; draft.paid = paid; }
    var due  = owed - paid;

    var g = document.getElementById("e-goods");
    if(g) g.textContent = money(owed);
    var dw = document.getElementById("e-due-wrap"), dv = document.getElementById("e-due");
    if(dw && dv){
      dw.hidden = !(st === "delivered" && hasItem) || viaShip(draft);
      dv.textContent = money(due);
      dv.className = "num " + (due > 0.009 ? "v-due" : "v-gain");
    }

    var net = null;
    if(!hasItem) net = null;                       // لسه ما دخلش بضاعة — مفيش ربح يتقال
    else if(est && !(pgoods > 0)) net = null;        // ولا صنف تكلفته معروفة — الشحن لوحده مش ربح
    else if(st === "delivered" || est) net = (pgoods - cost) + sin - sout;
    else if(st === "cancelled") net = sin - sout;
    var pw = document.getElementById("e-profit-wrap"), pf = document.getElementById("e-profit");
    var plab = document.getElementById("e-profit-lab");
    var plabel = est ? "صافي الربح المتوقع" : "صافي ربح الأوردر";
    if(plab) plab.textContent = plabel;
    if(pw && pf){
      pw.hidden = (net === null);
      if(net !== null){
        pf.textContent = money(net);
        pf.className = "num " + (net >= 0 ? "v-gain" : "v-due");
      }
    }

    /* الشرح الحيّ: نفس قصة الشاشة بس وإنت بتكتب. الخانتين اسمهم
       «بتحصّله» و«بتدفعه» بس الفرق بينهم هو اللي بيطلع من جيبك — ودي
       الحتة اللي كانت ضايعة في رقم «صافي الشحن» بالسالب. */
    /* التحصيل طريق واحد: يا العميل بيدفعلك مباشرة، يا الشركة بتحصّل بدالك.
       الاسم لازم يقول مين اللي ماسك الفلوس دلوقتي، وإلا الأرقام بتتقري غلط. */
    var via = viaShip(draft), co = squish(draft.shipCo);
    var lab = document.getElementById("e-paid-lab");
    if(lab) lab.textContent = via ? "العميل دفع لـ " + (co || "شركة الشحن") + " (بيتحسب لوحده)"
      : (draft.selfDel ? "عربون (لو دفع قبل التسليم)" : "المحصّل من العميل");
    /* أوردر الشركة: العميل بيدفع للمندوب تمن اللي خده وقت الاستلام —
       الرقم ده نتيجة، مش خانة تتكتب. لو اتساب يتكتب، أول مرتجع بعده
       بيسيب المحفظة على رقم قديم. */
    var pin = document.getElementById("e-paid");
    if(pin){ pin.disabled = via; if(via) pin.value = paid ? String(paid) : ""; }

    var pb = document.getElementById("e-paybox");
    if(pb){
      if(!hasItem && !sin && !sout && !paid){ pb.hidden = true; pb.innerHTML = ""; }
      else {
        var L = function(a, b, cls){
          return "<div class='pl" + (cls ? " " + cls : "") + "'><span>" + esc(a) +
                 "</span><b class='num'>" + esc(money(b)) + "</b></div>";
        };
        var pocket = sout - sin, html = L("البضاعة", goods);
        if(sin) html += L("شحن محمّل على العميل", sin);
        html += L("المطلوب من العميل", owed, "tot");
        if(paid) html += L(via ? "العميل دفع لـ " + (co || "شركة الشحن") : "محصّل منه", paid);
        if(st === "delivered" && !via)
          html += L(due > 0.009 ? "باقي عليه" : (due < -0.009 ? "ترجّعله" : "خالص"),
                    Math.abs(due) < 0.009 ? 0 : Math.abs(due), "tot");
        if(sout) html += L("شحن بتدفعه للشركة", sout);
        if(via && st === "delivered")
          html += "<p class='pn'>العميل خالص ✓ — دفع للمندوب وخرج من القصة. الفلوس دلوقتي عند " +
            esc(co || "شركة الشحن") + " (بعد ما تخصم شحنها)، وبتستلمها من شاشة «شركات الشحن».</p>";
        else if(via && st !== "cancelled")
          html += "<p class='pn'>أول ما العميل يستلم ويدفع للمندوب، السيستم بيسجّل المبلغ لوحده.</p>";
        if(!via && st === "delivered" && paid > 0.009)
          html += "<p class='pn'>الفلوس دي دخلت الخزنة على طول.</p>";
        if(Math.abs(pocket) > 0.009)
          html += "<p class='pn " + (pocket > 0 ? "v-due" : "v-gain") + "'>" +
            (pocket > 0
              ? "شحن من جيبك " + esc(money(pocket)) + " — حمّلت العميل " + esc(money(sin)) +
                " وهتدفع للشركة " + esc(money(sout))
              : "كسبت من الشحن " + esc(money(-pocket))) + "</p>";
        // حسبة الربح — للي شايف الفلوس بس
        var ph = "";
        if(net !== null && st !== "cancelled"){
          ph = L("تكلفة البضاعة" + (est ? " (بمتوسط الشراء)" : ""), cost) +
            "<div class='pl tot'><span>" + plabel +
            "</span><b class='num " + (net >= 0 ? "v-gain" : "v-due") + "'>" + esc(money(net)) + "</b></div>";
          if(est && pgoods > 0.009)
            ph += "<p class='pn'>هامش " + esc(String(Math.round(net / pgoods * 1000) / 10)) +
              "% — البضاعة − التكلفة + شحن على العميل − شحن للشركة.</p>";
          if(xtra > 0.009)
            ph += "<p class='pn'>ولو خصمت المصاريف الإضافية اللي في التسعير (" + esc(money(xtra)) +
              ") يبقى " + esc(money(net - xtra)) + " — دي للتخطيط بس ومش بتتسجّل.</p>";
        }
        if(noCost.length)
          ph += "<p class='pn v-due'>⚠ " + esc(noCost.join(" · ")) + ": لسه ما اتشراش — تكلفته مش معروفة فهو بره حسبة الربح.</p>";
        if(ph) html += "<div class='money-only pprof'>" + ph + "</div>";
        pb.innerHTML = html; pb.hidden = false;
      }
    }

    var cu = document.getElementById("e-cust");
    if(cu) cu.textContent = customerNote(draft.partyId);

    var note = document.getElementById("s-note-msg");
    var wrap = document.getElementById("s-allow-wrap");
    if(problems.length){
      note.textContent = problems.join(" · "); note.hidden = false;
      wrap.hidden = (st === "proposed" || st === "cancelled");
    } else {
      note.textContent = ""; note.hidden = true;
      wrap.hidden = true; document.getElementById("s-allow").checked = false;
    }
  }

  function customerNote(id){
    var p = db.parties.find(function(x){ return x.id===id; });
    if(!p) return "";
    var orders = live("sales").filter(function(x){ return x.partyId===id && x.id !== editing.sales; });
    if(!orders.length) return "عميل جديد" + (p.phone ? " · " + p.phone : "");
    var c = orders.filter(isCancelled).length, bal = partyBalance(id);
    var parts = [qty(orders.length)+" أوردر قبل كده"];
    if(c) parts.push(qty(c)+" ملغي");
    if(p.phone) parts.push(p.phone);
    if(bal > 0.009) parts.push("عليه "+money(bal));
    return parts.join(" · ");
  }

