  /* ================= فاتورة الشراء ================= */
  // فاتورة واحدة = مورد + تاريخ + كذا سطر. بتتخزّن N سجلات بنفس batchId،
  // كل سجل شايل نصيبه من النقل جوّه cost — فالمخزون والربح شغالين زي ما هما.
  var pdraft = null;

  // السطر = وحدة شراء واحدة بسعر واحد (كرتونة مثلاً).
  // mix = اللي جوّه الشحنة بالمقاسات والألوان. المورد بيسعّر الكرتونة مش القطعة،
  // فالسعر بيتكتب مرة واحدة والسيستم بيقسّمه على القطع اللي جوّاها.
  function newPLine(){
    return { itemId:"", byPack:false, packs:"", packQty:1, packCost:"", mix:[newMix()] };
  }
  function newMix(){ return { color:"", size:"", qty:"" }; }
  function itemHasVars(itemId){
    return hasVariants(db.items.find(function(x){ return x.id===itemId; }));
  }
  function isByPack(l){ return !!(l && l.byPack); }
  function unitOf(l){ return isByPack(l) ? "كرتونة" : "قطعة"; }
  /* حالتين بس: بتشتري بالقطعة، أو بالكرتونة اللي جوّاها قطع.
     مفيش وحدات تانية عشان مانضيّعش اللي بيسجّل في اختيارات مالهاش لزمة. */
  function costLabel(l){ return isByPack(l) ? "سعر الكرتونة الواحدة" : "سعر القطعة الواحدة"; }
  function mixTitle(l){
    return isByPack(l) ? "اللي جوّه الكراتين — اكتب كل مقاس ولون وعدده"
                       : "القطع اللي هتشتريها — اكتب كل مقاس ولون وعدده";
  }

  function mixPieces(l){
    return (l.mix||[]).reduce(function(a,m){ return a + (Number(m.qty)||0); }, 0);
  }
  function newPDraft(){
    // paidAuto: المدفوع بيمشي ورا قيمة البضاعة لوحده لحد ما تكتب فيه بإيدك
    return { date:firstOpenDate(), partyId:"", inv:"", freight:0, paid:0, paidAuto:true, note:"",
             lines:[newPLine()], batchId:"" };
  }
  function plPackQty(l){ var n = Number(l.packQty)||0; return n > 0 ? n : 1; }
  // عدد القطع دايماً من التفصيل — ده المصدر الوحيد للكميات
  function plQty(l){ return mixPieces(l); }
  // بالكرتونة: عدد الكراتين × سعر الكرتونة. بالقطعة: عدد القطع × سعر القطعة
  function plPacks(l){ return isByPack(l) ? (Number(l.packs)||0) : plQty(l); }
  function plGoods(l){ return plPacks(l) * (Number(l.packCost)||0); }
  function plParts(l){
    return (l.mix||[]).filter(function(m){ return (Number(m.qty)||0) > 0; })
      .map(function(m){ return { color:squish(m.color), size:squish(m.size),
                                 qty:Number(m.qty)||0 }; });
  }
  function pdGoods(){ return pdraft.lines.reduce(function(a,l){ return a + plGoods(l); }, 0); }

  // توزيع مبلغ على الأسطر بنسبة قيمة كل سطر، والفرق بيروح لأكبر سطر
  function allocByValue(amount, lines){
    var vals = lines.map(plGoods);
    var tot  = vals.reduce(function(a,b){ return a+b; }, 0);
    var amt  = Number(amount)||0;
    if(!amt || tot <= 0) return lines.map(function(){ return 0; });
    var out = vals.map(function(v){ return Math.round(amt * v / tot * 100) / 100; });
    var diff = Math.round((amt - out.reduce(function(a,b){ return a+b; }, 0)) * 100) / 100;
    if(diff !== 0){
      var bi = 0;
      vals.forEach(function(v,i){ if(v > vals[bi]) bi = i; });
      out[bi] = Math.round((out[bi] + diff) * 100) / 100;
    }
    return out;
  }

  function pLineHTML(l, i){
    var it = db.items.find(function(x){ return x.id===l.itemId; });
    var cs = listOf(it,"colors"), zs = listOf(it,"sizes");
    var byPack = isByPack(l);
    var pieces = plQty(l);

    // اقتراحات اللون والمقاس من الصنف، وبرضه ينفع تكتب حاجة جديدة
    var dl = function(id, list){
      return "<datalist id='"+id+"'>" +
        list.map(function(v){ return "<option value='"+esc(v)+"'></option>"; }).join("") +
        "</datalist>";
    };

    var mixRows = (l.mix||[]).map(function(m, j){
      return "<div class='lmix-row'>" +
        "<input list='dl-c-"+i+"' placeholder='مثلاً بني' autocomplete='off' " +
          "data-pli='"+i+"' data-mi='"+j+"' data-mf='color' value='"+esc(m.color)+"'>" +
        "<input list='dl-z-"+i+"' placeholder='مثلاً 38' autocomplete='off' " +
          "data-pli='"+i+"' data-mi='"+j+"' data-mf='size' value='"+esc(m.size)+"'>" +
        "<input type='number' step='any' min='0' placeholder='كام قطعة؟' " +
          "data-pli='"+i+"' data-mi='"+j+"' data-mf='qty' value='"+esc(m.qty)+"'>" +
        "<button type='button' class='rm' data-rmmix='"+i+"|"+j+"' aria-label='شيل السطر ده'>&times;</button>" +
        "</div>";
    }).join("");

    var mixHTML = l.itemId
      ? "<div class='lmix'>" +
          dl("dl-c-"+i, cs) + dl("dl-z-"+i, zs) +
          "<div class='lmix-head'><span class='lmix-title'>"+esc(mixTitle(l))+"</span></div>" +
          "<div class='lmix-cols'><span>اللون</span><span>المقاس</span>" +
            "<span>عدد القطع</span><span></span></div>" +
          mixRows +
          /* الزرار تحت آخر سطر مش فوق: مع ١٥ لون ومقاس كنت بترجع
             لفوق كل مرة عشان تضيف سطر جديد */
          "<button type='button' class='addmix' data-addmix='"+i+"'>+ سطر</button>" +
          "<div class='lmix-sum'>إجمالي القطع <b>"+qty(pieces)+"</b></div>" +
          "<p class='lmix-empty'>سيب اللون أو المقاس فاضي لو الصنف مالوش. أي لون أو مقاس جديد بتكتبه بيتضاف للصنف تلقائي.</p>" +
        "</div>"
      : "";

    return "<div class='lrow' data-pli='"+i+"'>" +
      "<div class='lrow-top'>" +
        "<div class='grow'><label for='pl-item-"+i+"'>الصنف</label>" +
          "<select id='pl-item-"+i+"' data-pli='"+i+"' data-pf='itemId'>"+itemOptionsHTML(l.itemId, true)+"</select></div>" +
        "<div class='grow'><label>بشتري بالـ</label>" +
          "<div class='seg' role='group'>" +
            "<button type='button' data-pack='"+i+"|0'"+(byPack?"":" class='on'")+">قطعة</button>" +
            "<button type='button' data-pack='"+i+"|1'"+(byPack?" class='on'":"")+">كرتونة</button>" +
          "</div></div>" +
        (byPack
          ? "<div><label for='pl-packs-"+i+"'>عدد الكراتين</label>" +
            "<input id='pl-packs-"+i+"' type='number' step='any' min='0' data-pli='"+i+"' data-pf='packs' value='"+esc(l.packs)+"'></div>"
          : "") +
        "<div><label class='lab-cost' for='pl-pc-"+i+"'>"+esc(costLabel(l))+"</label>" +
          "<input id='pl-pc-"+i+"' type='number' step='any' min='0' data-pli='"+i+"' data-pf='packCost' value='"+esc(l.packCost)+"'></div>" +
      "</div>" +
      mixHTML +
      "<div class='lrow-foot'>" +
        "<span class='lcost' data-pli='"+i+"'>—</span>" +
        (pdraft.lines.length > 1 ? "<button type='button' class='rm' data-rmpline='"+i+"'>شيل السطر</button>" : "") +
      "</div></div>";
  }

  function renderPLines(){
    var box = document.getElementById("p-lines");
    box.innerHTML = pdraft.lines.map(function(l,i){ return pLineHTML(l,i); }).join("");
    numify(box);
    renderPCalc();
  }
  // نداء آمن من جوّه change/blur: المتصفح بيخلّص الحدث الأول
  function renderPLinesSoon(){ setTimeout(renderPLines, 0); }

  // بيحسب تكلفة القطعة واصلة المخزن لكل سطر + ملخّص الفاتورة
  function renderPCalc(){
    if(!pdraft) return;
    var fr = allocByValue(pdraft.freight, pdraft.lines);
    pdraft.lines.forEach(function(l, i){
      var el = document.querySelector("#p-lines .lcost[data-pli='"+i+"']");
      if(!el) return;
      var q = plQty(l), g = plGoods(l), packs = plPacks(l);
      if(!Number(l.packCost)){ el.textContent = "—"; return; }
      if(!q){
        el.innerHTML = "<span class='v-due'>اكتب القطع اللي في الشحنة تحت — كل مقاس ولون وعدده</span>";
        return;
      }
      var base = g / q, share = fr[i] / q, landed = (g + fr[i]) / q;
      var txt = isByPack(l)
        ? qty(packs) + " كرتونة × " + money(Number(l.packCost)||0) + " · <b>" + qty(q) + " قطعة</b>" +
          (packs > 0 && q % packs === 0 ? " (" + qty(q/packs) + " قطعة في الكرتونة)" : "")
        : "<b>" + qty(q) + " قطعة</b> × " + money(Number(l.packCost)||0);
      if(isByPack(l)) txt += " · " + money(base) + " للقطعة";
      if(fr[i]) txt += " + نقل " + money(share);
      txt += " → تكلفة القطعة <b>" + money(landed) + "</b>";
      // تحذير الفرق الكبير: على أعلى متوسط موجود في تركيبات السطر
      var worst = null;
      plParts(l).forEach(function(pt){
        if(stockOfV(l.itemId, pt.color, pt.size) <= 0) return;
        var prev = avgCostVB(l.itemId, pt.color, pt.size);   // سعر المورد، من غير الانتقالات
        if(prev > 0 && (!worst || Math.abs(Math.log(landed/prev)) > Math.abs(Math.log(landed/worst))))
          worst = prev;
      });
      if(worst && landed > 0){
        var ratio = landed / worst;
        if(ratio > 1.75 || ratio < 0.57)
          txt += "<br><span class='v-due'>⚠ متوسط تكلفتها الحالي " + money(worst) +
                 " — الفرق كبير، راجع سعر الوحدة وعدد القطع</span>";
      }
      el.innerHTML = txt;
    });
    // مجموع القطع والمسمّيات بيتحدّثوا وانت بتكتب
    pdraft.lines.forEach(function(l, i){
      var row = document.querySelector("#p-lines .lrow[data-pli='"+i+"']");
      if(!row) return;
      var sum = row.querySelector(".lmix-sum");
      if(sum) sum.innerHTML = "إجمالي القطع <b>" + qty(plQty(l)) + "</b>";
    });

    var goods = pdGoods(), freight = Number(pdraft.freight)||0;
    var pieces = pdraft.lines.reduce(function(a,l){ return a + plQty(l); }, 0);
    syncPAutoPaid(goods);
    var paid = Number(pdraft.paid)||0;
    var rest = goods - paid;
    var box = document.getElementById("p-total");
    box.innerHTML =
      "<div><span>البضاعة (للمورد)</span><b>" + esc(money(goods)) + "</b></div>" +
      (freight ? "<div><span>النقل (للناقل)</span><b>" + esc(money(freight)) + "</b></div>" : "") +
      "<div><span>عدد القطع الداخلة المخزن</span><b>" + esc(qty(pieces)) + "</b></div>" +
      "<div class='big'><span>قيمة المخزون الداخلة</span><b>" + esc(money(goods + freight)) + "</b></div>" +
      (paid ? "<div><span>مدفوع للمورد</span><b>" + esc(money(paid)) + "</b></div>" : "") +
      (Math.abs(rest) > 0.009
        ? "<div><span>" + (rest > 0 ? "باقي للمورد" : "مدفوع زيادة") + "</span><b class='v-due'>" +
          esc(money(Math.abs(rest))) + "</b></div>" : "") +
      "<div><span>هيخرج من الخزنة دلوقتي</span><b class='" +
        ((paid + freight) > cashBoxForPurch() ? "v-due" : "") + "'>" +
        esc(money(paid + freight)) + "</b></div>";
    updateImpact("purchases");
  }

  // المدفوع للمورد بيتملي لوحده بقيمة البضاعة (من غير النقل — النقل للناقل).
  // أول ما تكتب فيه بإيدك بيقف، و«ادفع الفاتورة كلها» بترجّعه.
  function syncPAutoPaid(goods){
    var inp = document.getElementById("p-paid"), hint = document.getElementById("p-paid-hint");
    if(pdraft.paidAuto){
      pdraft.paid = goods;
      if(inp) inp.value = goods ? String(Math.round(goods * 100) / 100) : 0;
    }
    if(!hint) return;
    var paid = Number(pdraft.paid)||0, html = "";
    if(pdraft.paidAuto)
      html = "✓ المدفوع = قيمة البضاعة وبيتملي لوحده — لو دفعت جزء بس، اكتب اللي دفعته.";
    else if(goods > 0.009 && Math.abs(goods - paid) > 0.009)
      html = "إنت كاتب المدفوع بإيدك. <button class='rowact' type='button' id='b-paid-all'>ادفع الفاتورة كلها (" +
        esc(money(goods)) + ")</button>";
    // من غير تغيير ما نعيدش الكتابة — لو اتكتبت وإنت دايس على الزرار، الدوسة بتضيع
    if(hint.dataset.h !== html){ hint.dataset.h = html; hint.innerHTML = html; }
  }
  document.getElementById("p-paid-hint").addEventListener("click", function(e){
    if(!e.target.closest("#b-paid-all") || !pdraft) return;
    pdraft.paidAuto = true;
    clearPOver(); renderPCalc(); renderPDraftNote();
  });

  // رصيد الخزنة من غير الفاتورة اللي بنعدّلها
  function cashBoxForPurch(){
    var bal = cashBox();
    if(!pdraft || !pdraft.batchId) return bal;
    live("purchases").forEach(function(r){
      if(r.batchId === pdraft.batchId) bal += (Number(r.paid)||0) + pFreight(r);
    });
    return bal;
  }

  function clearPOver(){
    var b = document.getElementById("p-over"), f = document.getElementById("p-force");
    if(b) b.hidden = true;
    if(f) f.checked = false;
  }
  function pOverMsg(html){
    document.getElementById("p-over-msg").innerHTML = html;
    document.getElementById("p-over").hidden = false;
  }

  /* ---------- مرتجع للمورد ---------- */
  // بيتخزّن كسجل شراء بكمية بالسالب وسعر = اللي المورد رجّعه.
  // كده الرصيد بيقل، ومتوسط تكلفة اللي فضل بيتحسب لوحده صح.
  var pretSrc = null;
  var pretDefUnit = 0;   // السعر الدقيق من غير تقريب — عشان 3 من كرتونة 800/12 يرجّعوا 200.00 بالظبط

  function openPRet(id){
    var rec = db.purchases.find(function(x){ return x.id===id; });
    if(!rec || rec.deleted) return;
    if(isPRet(rec)){ toast("ده مرتجع أصلاً"); return; }
    pretSrc = id;
    var free = freeOfV(rec.itemId, vColor(rec), vSize(rec));
    var g = function(i){ return document.getElementById(i); };
    g("pr-date").value = firstOpenDate();
    g("pr-qty").value  = "";
    pretDefUnit = pPackCost(rec) / pPackQty(rec);                  // سعر القطعة من غير النقل
    g("pr-unit").value = Math.round(pretDefUnit * 100) / 100;
    g("pr-mode").value = "cash";
    g("pr-note").value = "";
    g("pr-qty").max = Math.max(0, free);
    renderPRetSrc();
    openEntry("pret");
  }

  function pretRec(){ return pretSrc ? db.purchases.find(function(x){ return x.id===pretSrc; }) : null; }

  function renderPRetSrc(){
    var rec = pretRec(), box = document.getElementById("pr-src");
    if(!rec || !box) return;
    var c = vColor(rec), z = vSize(rec);
    var lbl = vLabel(c,z);
    var free = freeOfV(rec.itemId, c, z), st = stockOfV(rec.itemId, c, z);
    box.innerHTML =
      "<div><span>الصنف</span><b>" + esc(itemName(rec.itemId)) +
        (lbl ? " · " + esc(lbl) : "") + "</b></div>" +
      "<div><span>المورد</span><b>" + esc(partyName(rec.partyId)) + "</b></div>" +
      "<div><span>الفاتورة</span><b>" + esc(rec.date) +
        (rec.inv ? " · " + esc(rec.inv) : "") + " · " + esc(qty(Number(rec.qty)||0)) + " قطعة</b></div>" +
      "<div><span>الرصيد دلوقتي</span><b class='" + (free <= 0 ? "v-due" : "") + "'>" +
        esc(qty(st)) + " قطعة" + (free !== st ? " (متاح " + esc(qty(free)) + ")" : "") + "</b></div>";
  }

  function pretQty(){ return Number((document.getElementById("pr-qty")||{}).value)||0; }
  // لو ما غيّرش السعر المعروض، بنحسب بالسعر الدقيق مش بالمقرّب
  function pretUnit(){
    var v = Number((document.getElementById("pr-unit")||{}).value)||0;
    return Math.abs(v - Math.round(pretDefUnit * 100) / 100) < 0.005 ? pretDefUnit : v;
  }

  function renderPRetCalc(){
    var rec = pretRec(), msg = document.getElementById("pr-msg");
    if(!rec || !msg) return;
    var q = pretQty(), u = pretUnit(), mode = document.getElementById("pr-mode").value;
    var c = vColor(rec), z = vSize(rec);
    var st = stockOfV(rec.itemId, c, z), free = freeOfV(rec.itemId, c, z);
    var avg = avgCostVB(rec.itemId, c, z);
    if(!q){ msg.textContent = ""; msg.className = "note"; updateImpact("pret"); return; }
    if(q > free + 0.0001){
      msg.innerHTML = "<strong>مينفعش ترجّع " + qty(q) + " قطعة.</strong> المتاح " + qty(free) +
        " بس" + (free !== st ? " (الرصيد " + qty(st) + " بس فيه محجوز لأوردرات)" : "") +
        ". مش هتقدر ترجّع بضاعة مش موجودة عندك.";
      msg.className = "note bad"; updateImpact("pret"); return;
    }
    var total = q * u;
    var after = st - q;
    var parts = "المخزون <b>" + qty(st) + " ← " + qty(after) + "</b> قطعة · " +
      "المورد هيرجّع <b>" + money(total) + "</b> · " +
      (mode === "cash" ? "هتدخل الخزنة دلوقتي" : "هتتخصم من اللي عليك له");
    // فرق بين تكلفة القطعة في المخزن واللي المورد بيرجّعه
    if(avg > 0 && Math.abs(u - avg) > 0.009){
      var diff = (avg - u) * q;
      parts += "<br>تكلفة القطعة عندك " + money(avg) + " والمورد بيرجّع " + money(u) + " — " +
        (diff > 0 ? "فرق " + money(diff) + " هيتسجّل «خسارة مرتجع» في مصاريف الفترة."
                  : "المورد بيرجّع أكتر من تكلفتها بـ " + money(-diff) + " — هيتسجّل مكسب. اتأكد من الرقم.");
    }
    msg.innerHTML = parts;
    msg.className = "note ok";
    updateImpact("pret");
  }

  ["pr-qty","pr-unit","pr-mode"].forEach(function(id){
    var el = document.getElementById(id);
    el.addEventListener("input", renderPRetCalc);
    el.addEventListener("change", renderPRetCalc);
  });

  bind("f-pret","b-pret", function(){
    var rec = pretRec();
    if(!rec){ toast("اختار السطر اللي هترجّعه"); return; }
    var date = document.getElementById("pr-date").value || today();
    if(!guardLock(date, "المرتجع")) return;
    var q = pretQty(), u = pretUnit();
    var mode = document.getElementById("pr-mode").value;
    var c = vColor(rec), z = vSize(rec);
    if(!q){ toast("اكتب الكمية المرجّعة"); return; }
    var free = freeOfV(rec.itemId, c, z);
    if(q > free + 0.0001){ toast("المتاح " + qty(free) + " قطعة بس"); return; }
    if(!(u >= 0)){ toast("اكتب اللي المورد هيرجّعه للقطعة"); return; }

    var total = q * u;
    /* v170: القطع بتخرج بتكلفتها على الرف، والفرق عن اللي المورد رجّعه «خسارة مرتجع» (xloss) —
       زي الاستبدال بالظبط. قبل كده كانت بتخرج باللي المورد رجّعه والفرق يقعد على المخزون. */
    var avg = avgCostVB(rec.itemId, c, z), xl = Math.round((avg - u) * q * 100) / 100;
    if(!(avg > 0)){ avg = u; xl = 0; }
    db.purchases.push(stamp({
      date: date, partyId: rec.partyId, inv: rec.inv || "",
      itemId: rec.itemId, color: c, size: z,
      packName: "قطعة", packs: -q, packQty: 1, packCost: avg,
      qty: -q, cost: avg, freight: 0, credit: u, xloss: Math.abs(xl) >= 0.005 ? xl : 0,
      paid: mode === "cash" ? -total : 0,
      isReturn: true, srcId: rec.id, batchId: uid(),
      note: document.getElementById("pr-note").value.trim() || "مرتجع للمورد"
    }));
    saveSoon("purchases");
    pretSrc = null;
    closeEntry();
    renderAll();
    toast("اترجّع " + qty(q) + " قطعة · " + money(total) +
      (mode === "cash" ? " دخلت الخزنة" : " اتخصمت من حساب المورد"));
  });

  /* ---------- استبدال مع المورد ----------
     بضاعة ما اتباعتش بترجع لنفس المورد وبتاخد بدالها بضاعة تانية وبتدفع الفرق.
     بيتخزّن سجلات شراء عادية بنفس batchId وعليها xchg:
       - سجل مرتجع (qty بالسالب) بتكلفة القطعة عندك (المتوسط) — فالمخزون بيخرج
         بقيمته الحقيقية ومتوسط اللي فاضل ما بيتغيّرش.
       - credit = اللي المورد حسبه للقطعة. لو أقل من التكلفة، الفرق xloss:
         مصروف «خسارة استبدال» (من غير خزنة) وبيقلّل اللي ليك عند المورد.
       - سجلات شراء للبضاعة الجديدة، والمدفوع عليها = الفرق اللي دفعته.
     كده partyBalance والخزنة والمخزون والأرباح بيطلعوا صح من غير أي حالة خاصة. */
  var xd = null;            // مسودة الاستبدال المفتوحة
  function xNewLine(){ return { itemId:"", color:"", size:"", qty:"", price:"" }; }
  function xRecs(xid){ return live("purchases").filter(function(p){ return p.xchg === xid; }); }
  // بيحسب كأن الاستبدال اللي بنعدّله مش موجود — عشان الرصيد والمتوسط يطلعوا صح
  function withoutX(xid, fn){
    var rs = xid ? xRecs(xid) : [];
    if(!rs.length) return fn();
    rs.forEach(function(r){ r.deleted = true; }); clearStockIdx();
    try { return fn(); } finally { rs.forEach(function(r){ delete r.deleted; }); clearStockIdx(); }
  }
  function xSrcRec(){ return xd && xd.srcId ? db.purchases.find(function(p){ return p.id === xd.srcId; }) : null; }
  // آخر فاتورة من المورد ده لكل لون/مقاس (من غير المرتجعات)
  function xLatestBy(partyId){
    var byK = {};
    live("purchases").forEach(function(p){
      if(p.partyId !== partyId || p.opening || isPRet(p)) return;
      var k = keyOf(p);
      if(!byK[k] || (p.date||"") > (byK[k].date||"") || ((p.date||"") === (byK[k].date||"") && (p.at||0) > (byK[k].at||0))) byK[k] = p;
    });
    return byK;
  }
  /* v128: «الصنف كله» — srcId = "all:<itemId>" بيرجّع كل لون ومقاس لسه عندك منه من المورد ده
     مرة واحدة. موديل ما اتباعش = ١٥ لون ومقاس، وكان لازم ١٥ استبدال منفصلين. */
  var X_ALL = "all:";
  function xAllId(srcId){ return srcId && srcId.indexOf(X_ALL) === 0 ? srcId.slice(X_ALL.length) : ""; }
  function xAllVars(partyId, itemId){
    var byK = xLatestBy(partyId), out = [];
    Object.keys(byK).forEach(function(k){
      var p = byK[k]; if(p.itemId !== itemId) return;
      var c = vColor(p), z = vSize(p), free = freeOfV(itemId, c, z);
      if(free > 0) out.push({ rec:p, c:c, z:z, free:free, stock:stockOfV(itemId, c, z), cost:avgCostVB(itemId, c, z), price:pPackCost(p) / pPackQty(p) });
    });
    return out;
  }
  // الأصناف اللي اشتريتها من المورد ده ولسه عندك منها — تركيبة واحدة لكل لون/مقاس (آخر فاتورة)
  function xSrcOptions(partyId){
    if(!partyId) return [];
    return withoutX(xd && xd.editId, function(){
      var byK = xLatestBy(partyId), out = [], per = {};
      Object.keys(byK).forEach(function(k){
        var p = byK[k], c = vColor(p), z = vSize(p);
        var free = freeOfV(p.itemId, c, z);
        if(free > 0){ var g = per[p.itemId] = per[p.itemId] || { n:0, q:0 }; g.n++; g.q += free; }
        if(free <= 0 && !(xd && xd.srcId === p.id)) return;
        out.push({ id:p.id, item:itemName(p.itemId), free:free, label:itemName(p.itemId) + (vLabel(c, z) ? " · " + vLabel(c, z) : "") + " — عندك " + qty(free) });
      });
      Object.keys(per).forEach(function(id){
        if(per[id].n < 2) return;
        out.push({ id:X_ALL + id, item:itemName(id), all:true, free:per[id].q,
          label:itemName(id) + " — كل الألوان والمقاسات (" + qty(per[id].n) + ") — عندك " + qty(per[id].q) });
      });
      return out.sort(function(a, b){
        return a.item !== b.item ? (a.item < b.item ? -1 : 1) : (!!b.all - !!a.all) || (a.label < b.label ? -1 : 1); });
    });
  }
  // تكلفة القطعة عندك دلوقتي (المتوسط شامل النقل) واللي اتباع منها
  function xSrcFacts(){
    var allId = xd ? xAllId(xd.srcId) : "";
    if(allId) return withoutX(xd.editId, function(){
      var vars = xAllVars(xd.partyId, allId);
      if(!vars.length) return null;
      var free = 0, stock = 0, cv = 0, pv = 0, sold = 0, keys = {};
      vars.forEach(function(v){ free += v.free; stock += v.stock; cv += v.free * v.cost; pv += v.free * v.price; keys[keyOf(v.rec)] = 1; });
      live("sales").forEach(function(x){
        if(!isDelivered(x)) return;
        SL(x).forEach(function(l){ if(keys[keyOf(l)]) sold += lineSold(l, x); });
      });
      var pnos = {}; vars.forEach(function(v){ pnos["#" + (v.rec.pno || "—") + " · " + dShort(v.rec.date)] = 1; });
      // التكلفة والسعر متوسط مرجّح بالقطع — نفس مجموع الأسطر بالظبط
      return { all:true, itemId:allId, vars:vars, rec:vars[0].rec, pnos:Object.keys(pnos), cost:cv / free, stock:stock, free:free, sold:sold, price:pv / free };
    });
    var rec = xSrcRec();
    if(!rec) return null;
    return withoutX(xd.editId, function(){
      var c = vColor(rec), z = vSize(rec), k = keyOf(rec), sold = 0;
      live("sales").forEach(function(x){
        if(!isDelivered(x)) return;
        SL(x).forEach(function(l){ if(keyOf(l) === k) sold += lineSold(l, x); });
      });
      return { rec:rec, cost:avgCostVB(rec.itemId, c, z), stock:stockOfV(rec.itemId, c, z),
               free:freeOfV(rec.itemId, c, z), sold:sold, price:pPackCost(rec) / pPackQty(rec) };
    });
  }
  function xCalc(){
    var f = xSrcFacts(), q = f && f.all ? f.free : (Number(xd.qty)||0);
    var u = xd.uAuto && f ? f.price : (Number(xd.unit)||0);
    var cost = f ? f.cost : 0;
    var lines = xd.lines.filter(function(l){ return l.itemId && (Number(l.qty)||0) > 0; });
    var G = lines.reduce(function(a, l){ return a + (Number(l.qty)||0) * (Number(l.price)||0); }, 0);
    var credit = q * u, loss = q * (cost - u), D = G - credit;
    return { f:f, q:q, u:u, cost:cost, lines:lines, G:G, credit:credit, loss:loss, D:D };
  }

  function openXchg(opt){
    opt = opt || {};
    xd = { editId:null, date:firstOpenDate(), partyId:"", srcId:"", qty:"", unit:"", uAuto:true, note:"",
           lines:[xNewLine()], paid:0, paidAuto:true, mode:"cash" };
    if(opt.editId){
      var rs = xRecs(opt.editId);
      var rets = rs.filter(isPRet), ret = rets[0];
      if(!ret){ toast("الاستبدال ده مش كامل — احذفه وسجّله من جديد"); return; }
      if(isLocked(ret.date)){ toast("الاستبدال ده في فترة مقفولة — مينفعش يتعدّل"); return; }
      var ins = rs.filter(function(r){ return !isPRet(r); });
      var paidIn = ins.reduce(function(a, r){ return a + (Number(r.paid)||0); }, 0);
      xd.editId = opt.editId; xd.date = ret.date; xd.partyId = ret.partyId;
      xd.srcId = rets.length > 1 ? X_ALL + ret.itemId : ret.srcId;
      xd.qty = -rets.reduce(function(a, r){ return a + (Number(r.qty)||0); }, 0);
      xd.unit = ret.credit != null ? ret.credit : ret.cost; xd.uAuto = false;
      xd.note = ret.note || "";
      xd.lines = ins.map(function(r){ return { itemId:r.itemId, color:vColor(r), size:vSize(r), qty:Number(r.qty)||0, price:Number(r.cost)||0 }; });
      if(!xd.lines.length) xd.lines = [xNewLine()];
      var G0 = xd.lines.reduce(function(a, l){ return a + l.qty * l.price; }, 0);
      var D0 = G0 - xd.qty * xd.unit;
      if(D0 >= 0){ xd.paid = paidIn; xd.paidAuto = Math.abs(paidIn - D0) < 0.01; }
      else { xd.mode = rets.some(function(r){ return (Number(r.paid)||0) < -0.009; }) ? "cash" : "credit"; }
    } else if(opt.srcId){
      var src = db.purchases.find(function(p){ return p.id === opt.srcId; });
      if(src){ xd.partyId = src.partyId; xd.srcId = src.id; }
    }
    var ps = document.getElementById("x-party");
    ps.innerHTML = "<option value=''>اختار المورد…</option>" + suppliersLive().map(function(p){
      return "<option value='" + esc(p.id) + "'>" + esc(p.name) + "</option>"; }).join("");
    document.getElementById("x-date").value = xd.date;
    ps.value = xd.partyId;
    document.getElementById("x-note").value = xd.note;
    var fz = document.getElementById("x-force"); if(fz) fz.checked = false;
    document.getElementById("x-over").hidden = true;
    var sm = document.getElementById("x-sheetmsg");
    if(!sm.dataset.def) sm.dataset.def = sm.innerHTML;
    sm.className = "hintline"; sm.innerHTML = sm.dataset.def;
    goTab("purch"); openEntry("xchg");
    document.getElementById("title-xchg").textContent = xd.editId ? "⇄ تعديل استبدال" : "⇄ استبدال مع مورد";
    xFillSrc(); xRenderLines(); xRender();
    if(xd.srcId) setTimeout(function(){ try{ document.getElementById("x-qty").focus(); }catch(e){} }, 90);
  }

  function xFillSrc(){
    var el = document.getElementById("x-src");
    var opts = xSrcOptions(xd.partyId);
    if(xd.srcId && !opts.some(function(o){ return o.id === xd.srcId; })){
      // نفس اللون والمقاس من فاتورة تانية؟ نختار الموجود في القايمة
      var cur = xSrcRec(), k = cur ? keyOf(cur) : "";
      var same = opts.find(function(o){ var r = db.purchases.find(function(p){ return p.id === o.id; }); return r && keyOf(r) === k; });
      xd.srcId = same ? same.id : "";
    }
    el.innerHTML = "<option value=''>" + (xd.partyId ? (opts.length ? "اختار الصنف…" : "مفيش بضاعة من المورد ده لسه عندك") : "اختار المورد الأول") + "</option>" +
      opts.map(function(o){ return "<option value='" + esc(o.id) + "'>" + esc(o.label) + "</option>"; }).join("");
    el.value = xd.srcId || "";
    el.disabled = !xd.partyId;
    var all = opts.find(function(o){ return o.all && o.id === xd.srcId; }), qe = document.getElementById("x-qty");
    qe.disabled = !!all;
    qe.value = all ? all.free : (xd.qty === "" ? "" : xd.qty);
  }

  function xRenderLines(){
    var box = document.getElementById("x-lines");
    var items = live("items").slice().sort(function(a, b){ return (a.name||"") < (b.name||"") ? -1 : 1; });
    box.innerHTML = xd.lines.map(function(l, i){
      var it = l.itemId ? db.items.find(function(x){ return x.id === l.itemId; }) : null;
      var dl = function(id, list){ return "<datalist id='" + id + "'>" + list.map(function(v){ return "<option value='" + esc(v) + "'></option>"; }).join("") + "</datalist>"; };
      return "<div class='xl-row' data-xli='" + i + "'>" +
        "<div><label>الصنف</label><select data-xf='itemId'><option value=''>اختار…</option>" +
          items.map(function(x){ return "<option value='" + esc(x.id) + "'" + (x.id === l.itemId ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select></div>" +
        "<div><label>اللون</label><input data-xf='color' list='xdl-c-" + i + "' autocomplete='off' value='" + esc(l.color) + "'>" + dl("xdl-c-" + i, listOf(it, "colors")) + "</div>" +
        "<div><label>المقاس</label><input data-xf='size' list='xdl-z-" + i + "' autocomplete='off' value='" + esc(l.size) + "'>" + dl("xdl-z-" + i, listOf(it, "sizes")) + "</div>" +
        "<div><label>قطع</label><input type='number' step='any' min='0' data-xf='qty' value='" + esc(l.qty) + "'></div>" +
        "<div><label>سعر القطعة</label><input type='number' step='any' min='0' data-xf='price' value='" + esc(l.price) + "'></div>" +
        "<span class='tt num' data-xtt='" + i + "'></span>" +
        "<button type='button' class='rm' data-xrm='" + i + "' aria-label='شيل السطر'" + (xd.lines.length > 1 ? "" : " hidden") + ">&times;</button>" +
      "</div>";
    }).join("");
  }

  function xRender(){
    if(!xd) return;
    var k = xCalc(), f = k.f;
    // اللي هترجّعه
    var info = document.getElementById("x-srcinfo");
    if(f && f.all){
      info.hidden = false;
      info.innerHTML =
        "<div><span>من " + (f.pnos.length > 1 ? "فواتير" : "فاتورة") + "</span><b>" + esc(f.pnos.join(" · ")) + " · بـ" + esc(money(f.price)) + " للقطعة</b></div>" +
        "<div><span>هترجّع</span><b>" + esc(qty(f.free)) + " قطعة في " + esc(qty(f.vars.length)) + " لون ومقاس</b></div>" +
        "<div><span>اتباع منه</span><b class='" + (f.sold ? "" : "v-due") + "'>" + (f.sold ? esc(qty(f.sold)) + " قطعة" : "ولا قطعة") + "</b></div>" +
        "<div><span>تكلفة القطعة عندك</span><b>" + esc(money(f.cost)) + "</b></div>";
    } else if(f){
      info.hidden = false;
      info.innerHTML =
        "<div><span>من فاتورة</span><b>#" + esc(f.rec.pno || "—") + " · " + esc(dShort(f.rec.date)) + " · بـ" + esc(money(f.price)) + " للقطعة</b></div>" +
        "<div><span>عندك دلوقتي</span><b>" + esc(qty(f.stock)) + " قطعة" + (f.free !== f.stock ? " (متاح " + esc(qty(f.free)) + ")" : "") + "</b></div>" +
        "<div><span>اتباع منه</span><b class='" + (f.sold ? "" : "v-due") + "'>" + (f.sold ? esc(qty(f.sold)) + " قطعة" : "ولا قطعة") + "</b></div>" +
        "<div><span>تكلفة القطعة عندك</span><b>" + esc(money(f.cost)) + "</b></div>";
    } else info.hidden = true;
    var ue = document.getElementById("x-unit");
    if(xd.uAuto && document.activeElement !== ue) ue.value = f ? String(Math.round(f.price * 100) / 100) : "";
    var lossEl = document.getElementById("x-loss");
    if(f && k.q > 0 && Math.abs(k.loss) >= 0.01){
      lossEl.className = "hintline" + (k.loss > 0 ? " bad" : "");
      lossEl.innerHTML = k.loss > 0
        ? "⚠ تكلفة القطعة عندك " + esc(money(k.cost)) + (k.cost > f.price + 0.005 ? " (شامل نقل الشحنة)" : "") + " والمورد هيحسبها " + esc(money(k.u)) +
          " — الفرق <b>" + esc(money(k.loss)) + "</b> هيتسجّل <b>خسارة استبدال</b> (مصروف من غير خزنة)."
        : "المورد هيحسبها " + esc(money(k.u)) + " وتكلفتها عندك " + esc(money(k.cost)) + " — الفرق <b>" + esc(money(-k.loss)) + "</b> مكسب ليك وبيقلّل المصاريف.";
    } else { lossEl.className = "hintline"; lossEl.innerHTML = ""; }

    // إجمالي كل سطر
    xd.lines.forEach(function(l, i){
      var t = document.querySelector("#x-lines [data-xtt='" + i + "']");
      var v = (Number(l.qty)||0) * (Number(l.price)||0);
      if(t) t.textContent = v ? money(v) : "";
    });

    // الفرق والدفع
    var diff = document.getElementById("x-diff");
    diff.innerHTML = "<div class='eq'>اللي هتاخده <b class='num'>" + esc(money(k.G)) + "</b> − اللي رجّعته <b class='num'>" + esc(money(k.credit)) + "</b></div>" +
      "<div class='big'><span>" + (k.D > 0.009 ? "هتدفع للمورد الفرق" : (k.D < -0.009 ? "المورد هيرجّعلك الفرق" : "مفيش فرق")) +
      "</span><b class='num'>" + esc(money(Math.abs(k.D))) + "</b></div>";
    var pay = document.getElementById("x-paywrap"), mode = document.getElementById("x-modewrap");
    pay.hidden = !(k.D > 0.009); mode.hidden = !(k.D < -0.009);
    document.getElementById("x-mode").value = xd.mode;
    var pin = document.getElementById("x-paid"), ph = document.getElementById("x-paid-hint");
    if(k.D > 0.009){
      if(xd.paidAuto){ xd.paid = k.D; if(document.activeElement !== pin) pin.value = String(Math.round(k.D * 100) / 100); }
      var html = xd.paidAuto ? "✓ بيتملي لوحده بالفرق — غيّره لو هتدفع جزء بس."
        : (Math.abs(xd.paid - k.D) > 0.009 ? "إنت كاتبه بإيدك. <button class='rowact' type='button' id='b-xpaid-all'>ادفع الفرق كله (" + esc(money(k.D)) + ")</button>" : "");
      if(ph.dataset.h !== html){ ph.dataset.h = html; ph.innerHTML = html; }
    }

    // اللي هيحصل
    var P = k.D > 0.009 ? (Number(xd.paid)||0) : 0;
    var back = k.D < -0.009 && xd.mode === "cash" ? -k.D : 0;
    var bal = k.D > 0.009 ? P - k.D : (xd.mode === "cash" ? 0 : -k.D);   // موجب = ليك عنده
    var eff = [];
    if(f && f.all) eff.push(["المخزون: " + itemName(f.itemId) + " (" + qty(f.vars.length) + " لون ومقاس)", qty(f.stock) + " ← " + qty(f.stock - k.q), ""]);
    else if(f && k.q > 0) eff.push(["المخزون: " + itemName(f.rec.itemId) + (vLabel(vColor(f.rec), vSize(f.rec)) ? " " + vLabel(vColor(f.rec), vSize(f.rec)) : ""),
      qty(f.stock) + " ← " + qty(f.stock - k.q), ""]);
    // صنف جديد فيه أكتر من ٣ ألوان ومقاسات بيتلم في سطر — الشيت ممكن يبقى ٢٠ سطر
    var byIt = {}, itOrder = [];
    k.lines.forEach(function(l){ if(!byIt[l.itemId]){ byIt[l.itemId] = []; itOrder.push(l.itemId); } byIt[l.itemId].push(l); });
    itOrder.forEach(function(id){
      var ls = byIt[id];
      if(ls.length > 3){
        eff.push(["المخزون: " + itemName(id) + " (" + qty(ls.length) + " لون ومقاس)", "+" + qty(ls.reduce(function(a, l){ return a + (Number(l.qty)||0); }, 0)), "v-gain"]);
        return;
      }
      ls.forEach(function(l){
        eff.push(["المخزون: " + itemName(l.itemId) + (vLabel(squish(l.color), squish(l.size)) ? " " + vLabel(squish(l.color), squish(l.size)) : ""), "+" + qty(Number(l.qty)||0), "v-gain"]);
      });
    });
    eff.push(["الخزنة", P > 0.009 ? "− " + money(P) : (back > 0.009 ? "+ " + money(back) : "مفيش حركة"), P > 0.009 ? "v-due" : (back > 0.009 ? "v-gain" : "")]);
    if(Math.abs(k.loss) >= 0.01) eff.push([k.loss > 0 ? "خسارة استبدال (مصروف)" : "مكسب استبدال", money(Math.abs(k.loss)), k.loss > 0 ? "v-due" : "v-gain"]);
    eff.push(["حساب " + (partyName(xd.partyId) || "المورد"), Math.abs(bal) < 0.01 ? "متسوّي ✓" : (bal > 0 ? "ليك عنده " + money(bal) : "باقي للمورد " + money(-bal)), Math.abs(bal) < 0.01 ? "v-gain" : ""]);
    document.getElementById("x-eff").innerHTML = "<div><span><b>اللي هيحصل لما تحفظ</b></span><b></b></div>" + eff.map(function(e){
      return "<div><span>" + esc(e[0]) + "</span><b class='num " + e[2] + "'>" + esc(e[1]) + "</b></div>"; }).join("");
  }

  document.getElementById("b-xchg-open").addEventListener("click", function(){ openXchg(); });
  document.getElementById("x-party").addEventListener("change", function(){
    xd.partyId = this.value; xd.srcId = ""; xd.uAuto = true; xFillSrc(); xRender();
  });
  document.getElementById("x-src").addEventListener("change", function(){
    xd.srcId = this.value; xd.uAuto = true; xFillSrc(); xRender();
  });
  document.getElementById("x-date").addEventListener("change", function(){ xd.date = this.value || today(); });
  document.getElementById("x-note").addEventListener("input", function(){ xd.note = this.value; });
  document.getElementById("x-qty").addEventListener("input", function(){ xd.qty = this.value; xRender(); });
  document.getElementById("x-unit").addEventListener("input", function(){ xd.unit = this.value; xd.uAuto = false; xRender(); });
  document.getElementById("x-paid").addEventListener("input", function(){ xd.paid = Number(this.value)||0; xd.paidAuto = false; xRender(); });
  document.getElementById("x-mode").addEventListener("change", function(){ xd.mode = this.value; xRender(); });
  document.getElementById("x-paid-hint").addEventListener("click", function(e){
    if(!e.target.closest("#b-xpaid-all") || !xd) return;
    xd.paidAuto = true; xRender();
  });
  document.getElementById("b-xaddline").addEventListener("click", function(){
    xd.lines.push(xNewLine()); xRenderLines(); xRender();
  });
  /* v128: البضاعة الجديدة من «شيت الفاتورة» نفسه (puParse) — سطر لكل لون ومقاس.
     الكرتونة بتتحوّل لسعر قطعة (سعر الكراتين ÷ قطعها). المورد والتاريخ من الفورم مش من الشيت. */
  function xSheetLines(text){
    var res = puParse(text);
    if(res.errs) return res;
    var lines = [], warn = [];
    res.lines.forEach(function(g){
      var pcs = g.mix.reduce(function(a, m){ return a + (Number(m.qty)||0); }, 0);
      var unit = g.byPack ? (pcs > 0 ? (Number(g.packs)||0) * (Number(g.packCost)||0) / pcs : 0) : (Number(g.packCost)||0);
      g.mix.forEach(function(m){ lines.push({ itemId:g.itemId, color:squish(m.color), size:squish(m.size), qty:Number(m.qty)||0, price:Math.round(unit * 100) / 100 }); });
    });
    if(res.partyId && xd && xd.partyId && res.partyId !== xd.partyId)
      warn.push("المورد اللي في الشيت (" + partyName(res.partyId) + ") غير اللي في الاستبدال (" + partyName(xd.partyId) + ") — اتسجّل على اللي في الاستبدال.");
    if((Number(res.freight)||0) > 0) warn.push("مصاريف النقل اللي في الشيت مش بتتحسب في الاستبدال.");
    return { lines:lines, warn:warn };
  }
  function xSheetImport(text){
    var msg = document.getElementById("x-sheetmsg"), r = xSheetLines(text);
    if(r.errs){
      msg.className = "hintline bad";
      msg.innerHTML = "<strong>الشيت ما اترفعش:</strong><br>" + r.errs.slice(0, 8).map(esc).join("<br>");
      return false;
    }
    // السطور الفاضية بتتشال، واللي متكتب بإيدك بيفضل وبيتزوّد عليه
    xd.lines = xd.lines.filter(function(l){ return l.itemId || (Number(l.qty)||0) > 0; }).concat(r.lines);
    if(!xd.lines.length) xd.lines = [xNewLine()];
    var pcs = r.lines.reduce(function(a, l){ return a + l.qty; }, 0);
    msg.className = "hintline";
    msg.innerHTML = "اترفع الشيت: " + esc(qty(r.lines.length)) + " سطر · " + esc(nPcs(pcs)) + " — راجعهم تحت قبل ما تحفظ." +
      (r.warn.length ? "<br><span class='v-due'>" + r.warn.map(esc).join("<br>") + "</span>" : "");
    xRenderLines(); xRender();
    return true;
  }
  document.getElementById("b-xsheet").addEventListener("click", function(){ document.getElementById("x-file").click(); });
  document.getElementById("x-file").addEventListener("change", function(){
    var fl = this.files && this.files[0];
    this.value = "";
    if(!fl || !xd) return;
    var reader = new FileReader();
    reader.onload = function(){ try{ xSheetImport(String(reader.result)); }
      catch(e){ var m = document.getElementById("x-sheetmsg"); m.className = "hintline bad"; m.textContent = "الملف مش مقروء: " + String(e && e.message || e); } };
    reader.readAsText(fl, "utf-8");
  });
  var xLineEdit = function(e){
    var row = e.target.closest("[data-xli]"), fld = e.target.dataset.xf;
    if(!row || !fld || !xd) return;
    var l = xd.lines[Number(row.dataset.xli)]; if(!l) return;
    l[fld] = e.target.value;
    if(fld === "itemId"){
      // صنف جديد: نقترح سعر آخر شراء ليه، والألوان والمقاسات بتاعته
      var last = live("purchases").filter(function(p){ return p.itemId === l.itemId && !isPRet(p); })
        .sort(function(a, b){ return (a.date||"") < (b.date||"") ? 1 : -1; })[0];
      if(last && !Number(l.price)) l.price = Math.round(pPackCost(last) / pPackQty(last) * 100) / 100;
      xRenderLines();
    }
    xRender();
  };
  document.getElementById("x-lines").addEventListener("input", xLineEdit);
  document.getElementById("x-lines").addEventListener("change", xLineEdit);
  document.getElementById("x-lines").addEventListener("click", function(e){
    var b = e.target.closest("[data-xrm]"); if(!b || !xd) return;
    xd.lines.splice(Number(b.dataset.xrm), 1);
    if(!xd.lines.length) xd.lines = [xNewLine()];
    xRenderLines(); xRender();
  });

  document.getElementById("b-xchg").addEventListener("click", function(){
    if(!xd) return;
    var k = xCalc(), f = k.f;
    var date = document.getElementById("x-date").value || today();
    if(!guardLock(date, "الاستبدال")) return;
    if(!xd.partyId){ toast("اختار المورد"); return; }
    if(!f){ toast("اختار الصنف اللي هترجّعه"); return; }
    if(!(k.q > 0)){ toast("اكتب هترجّع كام قطعة"); return; }
    if(k.q > f.free + 0.0001){ toast("المتاح " + qty(f.free) + " قطعة بس"); return; }
    if(!(k.u >= 0)){ toast("اكتب المورد هيحسبلك القطعة بكام"); return; }
    var bad = xd.lines.find(function(l){ return (l.itemId && !((Number(l.qty)||0) > 0)) || (!l.itemId && (Number(l.qty)||0) > 0); });
    if(bad){ toast("كمّل سطر البضاعة الجديدة: الصنف وعدد القطع"); return; }
    if(!k.lines.length){ toast("اختار البضاعة اللي هتاخدها بداله"); return; }
    if(k.lines.some(function(l){ return !(Number(l.price) >= 0) || l.price === ""; })){ toast("اكتب سعر القطعة للبضاعة الجديدة"); return; }
    var P = k.D > 0.009 ? Math.max(0, Number(xd.paid)||0) : 0;
    if(k.D > 0.009 && P > k.D + 0.009){ toast("المدفوع أكبر من الفرق (" + money(k.D) + ")"); return; }
    var back = k.D < -0.009 && xd.mode === "cash" ? -k.D : 0;
    // الخزنة: من غير الاستبدال القديم لو بنعدّل
    var cashNow = withoutX(xd.editId, cashBox);
    var force = document.getElementById("x-force");
    if(P > cashNow + 0.009 && !(force && force.checked)){
      document.getElementById("x-over-msg").innerHTML = "الخزنة فيها " + esc(money(cashNow)) + " بس، والفرق اللي هتدفعه " + esc(money(P)) +
        ". لو دفعته من برّه الخزنة سجّل المدفوع 0 (هيفضل باقي للمورد)، أو علّم «أنا متأكد».";
      document.getElementById("x-over").hidden = false; return;
    }

    var xid = xd.editId || uid(), pno = 0;
    if(xd.editId){
      var old = xRecs(xd.editId), now = Date.now();
      pno = (old[0] && old[0].pno) || 0;
      old.forEach(function(r){ r.deleted = true; r.at = now; });
    }
    var note = squish(document.getElementById("x-note").value || "");
    var recs = [];
    // «الصنف كله»: سطر مرتجع لكل لون ومقاس بتكلفته هو — المتوسط المرجّح للفورم بس
    var outs = f.all ? f.vars.map(function(v){ return { src:v.rec, q:v.free, cost:v.cost }; })
                     : [{ src:f.rec, q:k.q, cost:k.cost }];
    outs.forEach(function(o, i){
      var xl = o.q * (o.cost - k.u);
      recs.push(stamp({ date:date, partyId:xd.partyId, inv:"", itemId:o.src.itemId, color:vColor(o.src), size:vSize(o.src),
        packName:"قطعة", packs:-o.q, packQty:1, packCost:o.cost, qty:-o.q, cost:o.cost, freight:0,
        paid: back && i === 0 ? -back : 0, isReturn:true, srcId:o.src.id, batchId:xid, xchg:xid, credit:k.u,
        xloss: Math.abs(xl) >= 0.005 ? xl : 0, note: note || "استبدال مع المورد" }));
    });
    // المدفوع بيتوزّع على البضاعة الجديدة بنسبة قيمتها، والباقي على آخر سطر
    var left = P;
    k.lines.forEach(function(l, i){
      var v = (Number(l.qty)||0) * (Number(l.price)||0);
      var share = i === k.lines.length - 1 ? left : (k.G > 0 ? Math.round(P * v / k.G * 100) / 100 : 0);
      left -= share;
      recs.push(stamp({ date:date, partyId:xd.partyId, inv:"", itemId:l.itemId, color:squish(l.color), size:squish(l.size),
        packName:"قطعة", packs:Number(l.qty)||0, packQty:1, packCost:Number(l.price)||0, qty:Number(l.qty)||0,
        cost:Number(l.price)||0, freight:0, paid:share, batchId:xid, lineId:uid(), xchg:xid, note: note || "استبدال مع المورد" }));
    });
    recs.forEach(function(r){ if(pno) r.pno = pno; db.purchases.push(r); });
    saveSoon("purchases");
    var wasEdit = !!xd.editId;
    xd = null;
    freshBatch = xid;
    closeEntry();
    renderAll();
    toast(wasEdit ? "اتعدّل الاستبدال" : "اتسجّل الاستبدال" + (P ? " · دفعت " + money(P) : (back ? " · رجعلك " + money(back) : "")));
  });

  /* ---------- المشتريات: فاتورة في سطر واحد بيتفتح ----------
     كانت كل تركيبة لون/مقاس سطر كامل في الجدول. فاتورة فيها ١٥ لون
     ومقاس = ١٥ سطر، وشاشة كاملة لفاتورة واحدة. بقت سطر واحد بالرقم
     والمورد والإجمالي، والتفاصيل بتتفتح بالدوس عليه. */
  var openPurch = {};       // الفواتير المفتوح تفاصيلها
  var pufilt = { party:"", item:"", color:"", size:"", from:"", to:"", text:"" };

  function readPuFilters(){
    var g = function(id){ var e = document.getElementById(id); return e ? e.value : ""; };
    pufilt.party = g("pu-party"); pufilt.item = g("pu-item");
    pufilt.color = g("pu-color"); pufilt.size = g("pu-size");
    pufilt.from  = g("pu-from");  pufilt.to   = g("pu-to");
    pufilt.text  = squish(g("pu-text"));
  }
  var PU_LABEL = { party:"المورد", item:"الصنف", color:"اللون", size:"المقاس",
                   from:"من", to:"لـ", text:"بحث" };
  function puChipText(k){
    if(k === "party") return partyName(pufilt.party);
    if(k === "item")  return itemName(pufilt.item);
    return pufilt[k];
  }
  function fillPuSelects(){
    var sup = live("parties").filter(function(x){ return x.type === "supplier"; })
      .map(function(x){ return { v:x.id, t:x.name }; });
    var used = {}, cols = {}, sizes = {};
    live("purchases").forEach(function(x){
      if(x.itemId) used[x.itemId] = 1;
      if(squish(x.color)) cols[squish(x.color)] = 1;
      if(squish(x.size))  sizes[squish(x.size)] = 1;
    });
    var items = live("items").filter(function(i){ return used[i.id]; })
      .map(function(i){ return { v:i.id, t:i.name }; });
    var set = function(id, list, ph, cur){
      var el = document.getElementById(id); if(!el) return;
      el.innerHTML = optsHTML(list, cur, ph);
    };
    set("pu-party", sup, "كل الموردين", pufilt.party);
    set("pu-item",  items, "كل الأصناف", pufilt.item);
    set("pu-color", Object.keys(cols).sort().map(function(c){ return {v:c,t:c}; }), "كل الألوان", pufilt.color);
    set("pu-size",  Object.keys(sizes).sort().map(function(z){ return {v:z,t:z}; }), "كل المقاسات", pufilt.size);
  }
  function renderPuChips(){
    var keys = Object.keys(pufilt).filter(function(k){ return !!pufilt[k]; });
    var c = document.getElementById("pu-count");
    if(c){ c.textContent = keys.length; c.hidden = !keys.length; }
    var box = document.getElementById("pu-chips");
    if(!box) return;
    box.innerHTML = !keys.length ? "" :
      keys.map(function(k){
        return "<span class='chip'>" + esc(PU_LABEL[k]) + ": <b>" + esc(puChipText(k)) + "</b>" +
          "<button type='button' data-rmpu='" + k + "' aria-label='شيل فلتر " + esc(PU_LABEL[k]) + "'>&times;</button></span>";
      }).join("") + "<button class='clearall' type='button' id='b-clear-pu'>مسح الكل</button>";
  }

  // رقم تسلسلي للفاتورة — نفس فكرة ترقيم الأوردرات
  function backfillPurchNos(){
    var byBatch = {}, order = [];
    db.purchases.forEach(function(p){
      if(p.deleted) return;
      var k = p.batchId || ("solo:" + p.id);
      if(!byBatch[k]){ byBatch[k] = []; order.push(k); }
      byBatch[k].push(p);
    });
    var m = 0, miss = [];
    order.forEach(function(k){
      var g = byBatch[k];
      var has = g.find(function(x){ return Number(x.pno) > 0; });
      if(has){ if(Number(has.pno) > m) m = Number(has.pno);
               g.forEach(function(x){ x.pno = Number(has.pno); }); }
      else miss.push(g);
    });
    if(!miss.length) return;
    miss.sort(function(a, b){
      var A = a[0], B = b[0];
      return (A.date||"") !== (B.date||"") ? ((A.date||"") < (B.date||"") ? -1 : 1)
                                           : (A.at||0) - (B.at||0);
    }).forEach(function(g){ m++; g.forEach(function(x){ x.pno = m; }); });
    saveSoon("purchases");
  }
  function nextPurchNo(){
    var m = 0;
    db.purchases.forEach(function(p){ var n = Number(p.pno)||0; if(n > m) m = n; });
    return m + 1;
  }

  /* ---------- المشتريات: أرقام فوق + «عليك للموردين» + كارت لكل فاتورة ----------
     الكروت بتاخد نفس الفواتير اللي الجدول القديم بياخدها (نفس الفلاتر ونفس
     الصفحة)، ونفس الحسابات: goodsTotal / pFreight / paid. */
  var puOnly = "all";
  function puSum(g){
    var o = { goods:0, fr:0, paid:0, pieces:0 };
    g.rows.forEach(function(x){
      o.goods += goodsTotal(x); o.fr += pFreight(x);
      o.paid += Number(x.paid)||0; o.pieces += Number(x.qty)||0;
    });
    o.rest = o.goods - o.paid;
    return o;
  }
  function puKind(g){
    if(g.rows.some(function(r){ return r.xchg; })) return "xchg";
    if(isPRet(g.head)) return "ret";
    return puSum(g).rest > 0.009 ? "due" : "paid";
  }
  function puGroupsAll(){
    var groups = [], byBatch = {};
    live("purchases").slice().sort(byDate).forEach(function(p){
      var k = p.batchId || ("solo:" + p.id);
      if(!byBatch[k]){ byBatch[k] = { key:k, rows:[], head:p }; groups.push(byBatch[k]); }
      byBatch[k].rows.push(p);
    });
    return groups;
  }
  function nInv(n){ return n === 1 ? "فاتورة واحدة" : plural(n, "فاتورة", "فاتورتين", "فواتير"); }
  function nDays(n){ return plural(n, "يوم", "يومين", "أيام"); }
  function nPcs(n){ return Number(n) === 1 ? "قطعة واحدة" : plural(n, "قطعة", "قطعتين", "قطع"); }
  function monthLabel(d){
    try{
      var t = new Date((d || "").slice(0,7) + "-01T00:00:00");
      if(!isNaN(t)) return t.toLocaleDateString("ar-EG-u-nu-latn", { month:"long", year:"numeric" });
    }catch(e){}
    return (d || "").slice(0,7) || "—";
  }
  function renderPuOnly(cnt){
    var el = document.getElementById("pu-only");
    if(!el) return;
    // v181+: «خالصة» اتشالت من فوق — تقريباً كل الفواتير، فمش بتفرز حاجة (لسه شغالة لو اتفتحت قبل كده)
    var kinds = [["all","الكل"],["due","عليها فلوس"],["ret","مرتجعات"]];
    if(puOnly === "paid") kinds.splice(2, 0, ["paid","خالصة"]);
    if(cnt.xchg || puOnly === "xchg") kinds.push(["xchg","استبدال"]);
    el.innerHTML = kinds.map(function(c){
      return "<button type='button' data-puonly='" + c[0] + "'" + (puOnly === c[0] ? " class='on'" : "") + ">" +
        c[1] + " <b>" + qty(cnt[c[0]] || 0) + "</b></button>";
    }).join("");
  }
  // المورد اللي عليك له = رصيده سالب في كشف حسابه (partyBalance)
  function suppliersOwed(){
    return live("parties").filter(function(p){ return p.type === "supplier"; })
      .map(function(p){ return { p:p, owe:-partyBalance(p.id) }; })
      .filter(function(x){ return x.owe > 0.009; })
      .sort(function(a, b){ return b.owe - a.owe; });
  }
  function renderPuTop(){
    var el = document.getElementById("pu-top");
    if(!el) return;
    var m = monthRange(0), buy = 0, n = 0, fr = 0, ret = 0, nr = 0;
    puGroupsAll().forEach(function(g){
      var d = g.head.date || "";
      if(d < m.from || d > m.to) return;
      if(puKind(g) === "xchg") return;      // الاستبدال مش شراء جديد ولا مرتجع
      var t = puSum(g);
      if(isPRet(g.head)){ ret += -t.goods; nr++; return; }
      buy += t.goods; fr += t.fr; n++;
    });
    var ow = suppliersOwed(), owe = ow.reduce(function(a, x){ return a + x.owe; }, 0);
    /* v182: سطر واحد تحت العنوان بدل ٤ كروت — وأول الشهر (لسه ما اشتريتش) بيقولك الشهر اللي فات بدل ٤ أصفار */
    var parts = [owe > 0.009 ? "عليك للموردين <b class='num v-due'>" + esc(money(owe)) + "</b>" : "عليك للموردين <b>ولا حاجة ✓</b>"];
    if(n) parts.push("الشهر ده <b class='num'>" + esc(money(buy)) + "</b> في " + esc(nInv(n)));
    else {
      parts.push("الشهر ده لسه ما اشتريتش");
      var pm = monthRange(-1), pb = 0, pn = 0;
      puGroupsAll().forEach(function(g){
        var d = g.head.date || "";
        if(d < pm.from || d > pm.to) return;
        pn++;                                   // نفس عدّ عنوان الشهر في القايمة (الاستبدال والمرتجع من ضمنهم)
        if(puKind(g) !== "xchg" && !isPRet(g.head)) pb += puSum(g).goods;
      });
      if(pn) parts.push(esc(monthLabel(pm.from).split(" ")[0]) + " <b class='num'>" + esc(money(pb)) + "</b> في " + esc(nInv(pn)));
    }
    if(fr > 0.009) parts.push("نقل " + esc(money(fr)));
    if(nr) parts.push("مرتجع للموردين " + esc(money(ret)));
    el.innerHTML = parts.join(" · ");

    var box = document.getElementById("pu-owe");
    if(!box) return;
    if(!ow.length){ box.innerHTML = ""; return; }
    var groups = puGroupsAll();
    box.innerHTML = "<h3>عليك للموردين</h3>" + ow.map(function(x){
      var open = groups.filter(function(g){ return g.head.partyId === x.p.id && puKind(g) === "due"; });
      var oldest = open.reduce(function(a, g){ return !a || (g.head.date||"") < a ? (g.head.date||"") : a; }, "");
      var sub = open.length
        ? plural(open.length, "فاتورة واحدة", "فاتورتين", "فواتير") + " مش خالصة" +
          (oldest ? " · أقدم واحدة " + (daysSince(oldest) > 0 ? "من " + nDays(daysSince(oldest)) : "النهارده") : "")
        : "من كشف حسابه";
      return "<div class='pu-ow'><span><b>" + esc(x.p.name) + "</b><span class='sub'>" + esc(sub) + "</span></span>" +
        "<b class='num'>" + esc(money(x.owe)) + "</b>" +
        "<span class='a'><button class='tbtn primary' type='button' data-ptpay='" + esc(x.p.id) + "'>ادفع له</button>" +
        "<button class='tbtn' type='button' data-puparty='" + esc(x.p.id) + "'>كشف حسابه</button></span></div>";
    }).join("");
  }

  // كارت الاستبدال: رجّعت ← خدت، والفرق اتدفع ولا لأ
  function xchgCard(g){
    var h = g.head, open = !!openPurch[g.key];
    var outs = g.rows.filter(isPRet), ins = g.rows.filter(function(r){ return !isPRet(r); });
    var r0 = outs[0] || h;
    var credit = outs.reduce(function(a, r){ return a + (-goodsTotal(r) - (Number(r.xloss)||0)); }, 0);
    var take = ins.reduce(function(a, r){ return a + goodsTotal(r); }, 0);
    var paid = ins.reduce(function(a, r){ return a + (Number(r.paid)||0); }, 0);
    var back = -outs.reduce(function(a, r){ return a + Math.min(0, Number(r.paid)||0); }, 0);
    var loss = outs.reduce(function(a, r){ return a + (Number(r.xloss)||0); }, 0);
    var D = take - credit, isFresh = g.rows.some(function(x){ return x.batchId && x.batchId === freshBatch; });
    var lbl = function(r){ var v = vLabel(vColor(r), vSize(r)); return itemName(r.itemId) + (v ? " · " + v : "") + " × " + qty(Math.abs(Number(r.qty)||0)); };
    // صنف فيه أكتر من ٣ ألوان ومقاسات بيتلم: «جزمه موكا × 15 (15 لون ومقاس)»
    var lbls = function(rows){
      var by = {}, order = [];
      rows.forEach(function(r){ if(!by[r.itemId]){ by[r.itemId] = []; order.push(r.itemId); } by[r.itemId].push(r); });
      return order.map(function(id){
        var rs = by[id];
        if(rs.length <= 3) return rs.map(lbl).join(" · ");
        return itemName(id) + " × " + qty(rs.reduce(function(a, r){ return a + Math.abs(Number(r.qty)||0); }, 0)) + " (" + qty(rs.length) + " لون ومقاس)";
      }).join(" · ");
    };
    var st;
    if(D > 0.009) st = paid >= D - 0.009 ? "<span class='pill ok'>✓ دفعت الفرق " + esc(money(paid)) + "</span>"
      : "<span class='pill due'>باقي للمورد " + esc(money(D - paid)) + "</span>";
    else if(D < -0.009) st = back > 0.009 ? "<span class='pill ok'>✓ رجعلك " + esc(money(back)) + " كاش</span>"
      : "<span class='pill'>ليك عنده " + esc(money(-D)) + "</span>";
    else st = "<span class='pill ok'>✓ مفيش فرق</span>";
    return "<div class='pv xg" + (isFresh ? " fresh" : "") + "' data-pv='" + esc(g.key) + "'>" +
      "<button class='pv-h' type='button' data-pvopen='" + esc(g.key) + "' aria-expanded='" + (open ? "true" : "false") + "'>" +
        "<span class='ono num'>#" + esc(h.pno || "—") + "</span>" +
        "<span class='t'><b>" + esc(partyName(h.partyId)) + "</b><span class='sub num'>" + esc(dShort(h.date)) +
          (r0.note && r0.note !== "استبدال مع المورد" ? " · " + esc(r0.note) : "") + "</span></span>" +
        "<span class='it'>" + swatchHTML(g.rows.map(vColor)) + "<span class='nm'>" + esc(lbls(outs)) + " ← " + esc(lbls(ins)) + "</span></span>" +
        "<span class='tot'><b class='num money-only'>" + (Math.abs(D) < 0.01 ? "—" : esc(money(Math.abs(D)))) + "</b></span>" +
        "<span class='pay money-only'><span class='pv-tag x'>استبدال · " + st.replace(/<[^>]+>/g, "").replace(/^✓\s*/, "") + "</span></span>" +
        "<span class='chev' aria-hidden='true'>" + (open ? "▴" : "▾") + "</span>" +
      "</button>" +
      (open ? "<div class='pv-flow'>" +
          "<div class='side'><small>↩ رجّعت</small>" + esc(lbls(outs)) + "<b class='num v-due money-only'>− " + esc(money(credit)) + "</b></div>" +
          "<div class='arr' aria-hidden='true'>⇠</div>" +
          "<div class='side'><small>↪ خدت</small>" + esc(lbls(ins)) + "<b class='num v-gain money-only'>+ " + esc(money(take)) + "</b></div>" +
        "</div><div class='pv-b'>" +
          (Math.abs(loss) >= 0.01 ? "<p class='hintline' style='margin:0 0 6px'>" + (loss > 0 ? "خسارة استبدال (مصروف): " : "مكسب استبدال: ") +
            "<b class='num money-only'>" + esc(money(Math.abs(loss))) + "</b> — المورد حسب القطعة بـ" + esc(money(Number(r0.credit)||0)) +
            " وتكلفتها عندك " + esc(money(Number(r0.cost)||0)) + "</p>" : "") +
          "<div class='pv-f'><button class='tbtn' type='button' data-edit='purchases|" + h.id + "'>تعديل الاستبدال</button>" +
          "<button class='tbtn' type='button' style='color:var(--due)' data-del='purchases' data-id='" + h.id + "'>حذف الاستبدال كله</button></div>" +
        "</div>" : "") +
    "</div>";
  }

  function renderPurchCards(groups, all){
    var box = document.getElementById("pu-cards");
    if(!box) return;
    if(!groups.length){
      box.innerHTML = "<div class='cd-empty'>" + (all
        ? "مفيش فاتورة مطابقة للفلتر — امسح الفلاتر وشوف تاني."
        : "مفيش مشتريات لسه. سجّل أول فاتورة عشان يبقى عندك مخزون تبيع منه.") + "</div>";
      return;
    }
    // عنوان الشهر: عدد الفواتير وقيمة البضاعة (من غير المرتجعات) للي ظاهر في الشهر ده
    var months = {};
    groups.forEach(function(g){
      var k = (g.head.date || "").slice(0,7);
      if(!months[k]) months[k] = { n:0, goods:0 };
      months[k].n++;
      if(!isPRet(g.head) && puKind(g) !== "xchg") months[k].goods += puSum(g).goods;
    });
    // كام قطعة اتبدّلت من كل سطر فاتورة
    var xOut = {};
    live("purchases").forEach(function(p){ if(p.xchg && isPRet(p) && p.srcId) xOut[p.srcId] = (xOut[p.srcId]||0) - (Number(p.qty)||0); });
    var lastM = null, html = "";
    groups.forEach(function(g){
      var h = g.head, k = (h.date || "").slice(0,7);
      if(k !== lastM){
        lastM = k;
        html += "<div class='pu-mo'><span>" + esc(monthLabel(h.date)) + " · <b>" + nInv(months[k].n) + "</b></span>" +
          "<span class='money-only'>بضاعة <b class='num'>" + esc(money(months[k].goods)) + "</b></span></div>";
      }
      if(puKind(g) === "xchg"){ html += xchgCard(g); return; }
      var t = puSum(g), isRet = isPRet(h), open = !!openPurch[g.key];
      var names = Object.keys(g.rows.reduce(function(a, x){ a[itemName(x.itemId)] = 1; return a; }, {}));
      var isFresh = g.rows.some(function(x){ return x.batchId && x.batchId === freshBatch; });
      /* v182: سطر واحد — الحالة بتبان بس لو فيها حاجة (باقي فلوس · مرتجع)، مش «✓ خالصة» في كل سطر */
      var pay = isRet ? "<span class='pv-tag d'>مرتجع · " + (t.paid < -0.009 ? "الفلوس رجعت كاش" : "اتخصمت من حسابه") + "</span>"
        : (t.rest > 0.009 ? "<span class='pv-tag d'>باقي " + esc(money(t.rest)) + "</span>" : "");
      var cols = g.rows.map(vColor);
      html += "<div class='pv" + (isRet ? " ret" : "") + (isFresh ? " fresh" : "") + "' data-pv='" + esc(g.key) + "'>" +
        "<button class='pv-h' type='button' data-pvopen='" + esc(g.key) + "' aria-expanded='" + (open ? "true" : "false") + "'>" +
          "<span class='ono num'>#" + esc(h.pno || "—") + "</span>" +
          "<span class='t'><b>" + esc(partyName(h.partyId)) + "</b>" +
            "<span class='sub num'>" + esc(dShort(h.date)) + (h.inv ? " · فاتورة " + esc(h.inv) : "") +
            (isRet && h.note ? " · " + esc(h.note) : "") + "</span></span>" +
          "<span class='it'>" + swatchHTML(cols) + "<span class='nm'>" + esc(names.slice(0,2).join(" · ") + (names.length > 2 ? " وغيرهم" : "")) + "</span>" +
            "<span class='sub num'>" + esc(nPcs(Math.abs(t.pieces))) + "</span></span>" +
          "<span class='tot'><b class='num money-only" + (isRet ? " v-due" : "") + "'>" + esc(money(t.goods)) + "</b></span>" +
          "<span class='pay money-only'>" + pay + "</span>" +
          "<span class='chev' aria-hidden='true'>" + (open ? "▴" : "▾") + "</span>" +
        "</button>";
      if(open){
        html += "<div class='pv-b'>" +
          "<div class='pv-ln hd'><span>الصنف · اللون · المقاس</span><span class='n'>القطع</span>" +
            "<span class='n money-only'>تكلفة القطعة</span><span class='n money-only'>قيمة البضاعة</span><span></span></div>" +
          g.rows.map(function(x){
            var v = vLabel(vColor(x), vSize(x));
            var pq = pPackQty(x), packs = pPacks(x), pn = pPackName(x) || "قطعة";
            var sub = pq > 1 ? qty(packs) + " " + esc(pn) + " × " + qty(pq) + " قطعة" : "";
            return "<div class='pv-ln'><span>" + esc(itemName(x.itemId)) +
                (v ? " <span class='pill'>" + esc(v) + "</span>" : "") +
                (sub ? "<span class='sub'>" + sub + "</span>" : "") + "</span>" +
              "<span class='n num q" + (isRet ? " v-due" : "") + "'>× " + qty(Math.abs(Number(x.qty)||0)) + "</span>" +
              "<span class='n num c money-only'>" + esc(money(x.cost)) +
                (pFreight(x) ? "<span class='sub'>شامل نقل " + esc(money(pFreight(x) / (Number(x.qty)||1))) + "</span>" : "") + "</span>" +
              "<span class='n num tt money-only'>" + esc(money(goodsTotal(x))) + "</span>" +
              "<span class='x'>" + (isRet ? "" :
                "<button class='del' type='button' style='color:var(--due)' data-pret='" + x.id + "'>رجّعه للمورد</button>" +
                "<button class='del' type='button' style='color:var(--xg)' data-xsrc='" + x.id + "'>⇄ بدّله</button>") +
                (xOut[x.id] ? "<span class='xgd'>⇄ اتبدّل منها " + qty(xOut[x.id]) + "</span>" : "") + "</span></div>";
          }).join("") +
          "<div class='pv-sum money-only'><span>بضاعة <b class='num'>" + esc(money(t.goods)) + "</b></span>" +
            (t.fr > 0.009 ? "<span>نقل <b class='num'>" + esc(money(t.fr)) + "</b> <span class='sub' style='display:inline'>(من الخزنة، مش للمورد)</span></span>" : "") +
            (isRet ? "" : "<span>دفعت للمورد <b class='num'>" + esc(money(t.paid)) + "</b></span>") + "</div>" +
          "<div class='pv-f'>" +
            (isRet ? "" : "<button class='tbtn' type='button' data-edit='purchases|" + h.id + "'>تعديل الفاتورة</button>") +
            "<button class='tbtn' type='button' style='color:var(--due)' data-del='purchases' data-id='" + h.id + "'>حذف " + (isRet ? "المرتجع" : "الفاتورة") + "</button>" +
          "</div></div>";
      }
      html += "</div>";
    });
    box.innerHTML = html;
  }

  function renderPurch(){
    backfillPurchNos();
    renderPuTop();
    readPuFilters();
    fillPuSelects();
    renderPuChips();

    // الفاتورة الواحدة كذا سجل بنفس batchId — بنعرضها مجمّعة
    var groups = [], byBatch = {};
    live("purchases").slice().sort(byDate).forEach(function(p){
      var k = p.batchId || ("solo:" + p.id);
      if(!byBatch[k]){ byBatch[k] = { key:k, rows:[], head:p }; groups.push(byBatch[k]); }
      byBatch[k].rows.push(p);
    });

    // الفلتر بيمشي على الفاتورة: تكفي تركيبة واحدة جواها تطابق
    var q = pufilt.text.toLowerCase();
    groups = groups.filter(function(g){
      var h = g.head;
      if(pufilt.party && h.partyId !== pufilt.party) return false;
      if(pufilt.from && (h.date||"") < pufilt.from) return false;
      if(pufilt.to   && (h.date||"") > pufilt.to)   return false;
      if(pufilt.item  && !g.rows.some(function(x){ return x.itemId === pufilt.item; })) return false;
      if(pufilt.color && !g.rows.some(function(x){ return squish(x.color) === pufilt.color; })) return false;
      if(pufilt.size  && !g.rows.some(function(x){ return squish(x.size)  === pufilt.size;  })) return false;
      if(q){
        var hay = [partyName(h.partyId), h.inv || "", "#" + (h.pno || ""), h.note || "", h.date || ""]
          .concat(g.rows.map(function(x){
            return [itemName(x.itemId), x.color || "", x.size || "",
                    vCode(x.itemId, vColor(x), vSize(x))].join(" ");
          })).join(" ").toLowerCase();
        if(hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var shown = groups.length, all = live("purchases").length;
    // «الكل / عليها فلوس / خالصة / مرتجعات» — بعد باقي الفلاتر، والعدّاد على اللي فاضل منها
    var cnt = { all:groups.length, due:0, paid:0, ret:0, xchg:0 };
    groups.forEach(function(g){ cnt[puKind(g)]++; });
    renderPuOnly(cnt);
    if(puOnly !== "all") groups = groups.filter(function(g){ return puKind(g) === puOnly; });
    var rows = [];
    groups = pageRows("purch", groups);
    renderPurchCards(groups, all);
    groups.forEach(function(g){
      var n = g.rows.length, h = g.head;
      var isRet = isPRet(h) && puKind(g) !== "xchg";
      var isOpen = !!openPurch[g.key];
      var nItems = Object.keys(g.rows.reduce(function(a,x){ a[x.itemId]=1; return a; }, {})).length;
      var pieces = g.rows.reduce(function(a,x){ return a + (Number(x.qty)||0); }, 0);
      var names  = Object.keys(g.rows.reduce(function(a,x){ a[itemName(x.itemId)]=1; return a; }, {}));
      var gLabel = names.slice(0,2).join(" · ") + (names.length > 2 ? " وغيرهم" : "") +
                   (n > 1 ? " — " + qty(n) + " لون ومقاس" : "");
      var goods = g.rows.reduce(function(a,x){ return a + goodsTotal(x); }, 0);
      var fr    = g.rows.reduce(function(a,x){ return a + pFreight(x); }, 0);
      var paid  = g.rows.reduce(function(a,x){ return a + (Number(x.paid)||0); }, 0);
      var rest  = goods - paid;
      var isFresh = g.rows.some(function(x){ return x.batchId && x.batchId === freshBatch; });

      rows.push("<tr class='pinv" + (isFresh ? " fresh" : "") + (isOpen ? " open" : "") +
        "' data-prow='" + esc(g.key) + "' tabindex='0'>" +
        "<td class='num'><span class='ono'>#" + esc(h.pno || "—") + "</span></td>" +
        "<td class='num'>" + esc(h.date) +
          (puKind(g) === "xchg" ? " <span class='pill xg'>⇄ استبدال</span>" : (isRet ? " <span class='pill due'>مرتجع</span>" : "")) +
          (h.inv ? "<span class='sub'>فاتورة " + esc(h.inv) + "</span>" : "") + "</td>" +
        "<td class='wide'>" + esc(partyName(h.partyId)) +
          (isRet && h.note ? "<span class='sub'>" + esc(h.note) + "</span>" : "") + "</td>" +
        "<td class='wide'>" + esc(gLabel) + "</td>" +
        "<td class='num" + (isRet ? " v-due" : "") + "'>" + qty(pieces) + "</td>" +
        "<td class='num money-only'>" + money(goods) + "</td>" +
        "<td class='num money-only'>" + (fr ? money(fr) : "—") + "</td>" +
        "<td class='num money-only'>" + money(paid) + "</td>" +
        "<td class='num'>" + (rest > 0.009 ? "<span class='pill due'>" + money(rest) + "</span>"
                                           : "<span class='pill'>خالص</span>") + "</td>" +
        "<td class='rowacts'>" + (isRet
          ? "<span style='font-size:var(--fs-1);color:var(--ink-soft)'>مرتجع</span>"
          : "<button class='rowact' type='button' data-edit='purchases|" + h.id + "'>تعديل</button>") +
          "<span class='chev' aria-hidden='true'>▾</span></td></tr>");

      if(!isOpen) return;
      var lines = g.rows.map(function(x){
        var vl = vLabel(vColor(x), vSize(x));
        var pq = pPackQty(x), packs = pPacks(x), pn = pPackName(x) || "قطعة";
        var sub = pq > 1 ? qty(packs) + " " + esc(pn) + " × " + qty(pq) + " قطعة" : "";
        return "<tr><td class='wide'>" + esc(itemName(x.itemId)) +
            (vl ? " <span class='pill'>" + esc(vl) + "</span>" : "") +
            (sub ? "<span class='sub'>" + sub + "</span>" : "") + "</td>" +
          "<td class='num" + (isRet ? " v-due" : "") + "'>" + qty(x.qty) + "</td>" +
          "<td class='num money-only'>" + money(x.cost) +
            (pFreight(x) ? "<span class='sub'>شامل نقل " + money(pFreight(x)/(Number(x.qty)||1)) + "</span>" : "") + "</td>" +
          "<td class='num money-only'>" + money(goodsTotal(x)) + "</td>" +
          "<td>" + (isRet ? "" :
            "<button class='del' style='color:var(--due)' data-pret='" + x.id + "'>رجّعه للمورد</button>") + "</td></tr>";
      }).join("");

      rows.push("<tr class='detail'><td colspan='10'><div class='detail-in'>" +
        "<div class='dlines'><table><thead><tr>" +
          "<th>الصنف · اللون · المقاس</th><th>القطع</th>" +
          "<th class='money-only'>تكلفة القطعة</th><th class='money-only'>قيمة البضاعة</th><th></th>" +
        "</tr></thead><tbody>" + lines + "</tbody></table></div>" +
        "<div class='detail-actions'>" +
          (isRet ? "" : "<button class='tbtn' type='button' data-edit='purchases|" + h.id + "'>تعديل الفاتورة</button>") +
          "<button class='tbtn' type='button' data-del='purchases' data-id='" + h.id + "'>حذف الفاتورة</button>" +
        "</div></div></td></tr>");
    });

    // الفواتير اللي اختفت بالفلتر ما تفضلش مفتوحة في الذاكرة
    Object.keys(openPurch).forEach(function(k){
      if(!groups.some(function(g){ return g.key === k; })) delete openPurch[k];
    });

    var empty = all
      ? "مفيش فاتورة مطابقة للفلتر — امسح الفلاتر وشوف تاني."
      : "مفيش مشتريات لسه. سجّل أول فاتورة عشان يبقى عندك مخزون تبيع منه.";
    table("t-purch",
      ["#","التاريخ","المورد","المحتوى","القطع","قيمة البضاعة","النقل","المدفوع","المتبقي",""],
      rows, empty);
    if(freshBatch) setTimeout(function(){ freshBatch = null; }, 1600);
  }

  function cashLabel(t){
    if(isCapType(t)) return CAP[t].label;
    return t==="in" ? "تحصيل" : t==="out" ? "دفع" :
           t==="settle" ? "سحب من شركة شحن" :
           t==="opening" ? "رصيد افتتاحي — الخزنة" :
           t==="opening_party" ? "رصيد افتتاحي — جهة" : "مصروف";
  }

  // تصنيف عام للحركة — الفلتر بيشتغل عليه
  function cashKind(t){
    if(isCapType(t)) return "رأس مال";
    return t==="in" ? "تحصيل" : t==="out" ? "دفع" :
           t==="settle" ? "شحن" :
           (t==="opening" || t==="opening_party") ? "افتتاحي" : "مصروف";
  }

  // دفتر الخزنة: كل حركة نقدية مهما كان مصدرها
  function cashLedger(){
    var L = [];
    live("sales").forEach(function(s){
      if(viaShip(s)) return;                 // ده بيروح لمحفظة شركة الشحن مش للخزنة
      var who = partyName(s.partyId);
      var what = (s.no ? "#"+s.no+" · " : "") + itemsLabel(s);
      if(isCancelled(s)){
        if(shipIn(s)) L.push({d:s.date, at:s.at, t:"شحن من عميل", who:who, kind:"شحن",
          note:"أوردر ملغي · "+what, inn:shipIn(s), out:0, src:"أوردر"});
        /* v170: العربون دخل يوم ما اتدفع ورجع للعميل يوم الإلغاء — الاتنين في التاريخ،
           والرصيد زي ما هو (الخزنة بتعتبر الملغي فلوسه رجعت) */
        var dp = Number(s.paid)||0;
        if(dp > 0.009){
          L.push({d:s.date, at:s.at, t:"تحصيل من عميل", who:who, kind:"تحصيل", note:"عربون · أوردر ملغي · "+what, inn:dp, out:0, src:"أوردر"});
          L.push({d:s.cancelledAt || s.date, at:s.at + 2, t:"ردّ عربون", who:who, kind:"تحصيل", note:"رجع للعميل مع الإلغاء · "+what, inn:0, out:dp, src:"أوردر"});
        }
      } else if(Number(s.paid)||0){
        var pd = Number(s.paid)||0;
        // v170: دفعات متسجّلة كل واحدة بيومها
        var pays = Array.isArray(s.pays) ? s.pays.filter(function(x){ return x && x.d && Number(x.a) > 0; }) : [];
        var sumP = pays.reduce(function(a, x){ return a + Number(x.a); }, 0);
        if(pays.length && sumP <= pd + 0.009){
          var via3 = s.selfDel && s.courier ? " · مع " + s.courier : "";
          if(pd - sumP > 0.009) L.push({d:s.date, at:s.at, t:"تحصيل من عميل", who:who, kind:"تحصيل",
            note:(s.selfDel ? "عربون · " : "دفعة أولى · ") + "أوردر "+saleStateTxt(s)+via3+" · "+what, inn:pd - sumP, out:0, src:"أوردر"});
          pays.forEach(function(x, i){ L.push({d:x.d, at:s.at + 1 + i, t:"تحصيل من عميل", who:who, kind:"تحصيل",
            note:"دفعة · أوردر "+saleStateTxt(s)+via3+" · "+what, inn:Number(x.a), out:0, src:"أوردر"}); });
          if(shipCounts(s) && shipOut(s))
            L.push({d:s.date, at:s.at, t:s.selfDel ? "توصيل" : "شحن مدفوع", who:(s.selfDel ? (s.courier || "مندوب") : (s.shipCo||"شركة شحن")), kind:"شحن",
              note:"أوردر "+who+" · "+what, inn:0, out:shipOut(s), src:"أوردر"});
          return;
        }
        /* توصيل بنفسك: اللي اتحصّل وقت التسليم بيتسجّل يوم ما دخل فعلاً (paidAt)،
           والعربون (لو كان فيه) بيفضل يوم الأوردر */
        var later = s.paidAt ? Math.max(0, Math.min(pd, pd - (Number(s.dep)||0))) : 0;
        var via2 = s.selfDel && s.courier ? " · مع " + s.courier : "";
        if(pd - later > 0.009) L.push({d:s.date, at:s.at, t:"تحصيل من عميل", who:who, kind:"تحصيل",
          note:(later ? (s.selfDel ? "عربون · " : "دفعة أولى · ") : "") + "أوردر "+saleStateTxt(s)+via2+" · "+what, inn:pd - later, out:0, src:"أوردر"});
        if(later > 0.009) L.push({d:s.paidAt, at:s.at + 1, t:"تحصيل من عميل", who:who, kind:"تحصيل",
          note:"أوردر "+saleStateTxt(s)+via2+" · "+what, inn:later, out:0, src:"أوردر"});
      }
      if(shipCounts(s) && shipOut(s))
        L.push({d:s.date, at:s.at, t:s.selfDel ? "توصيل" : "شحن مدفوع", who:(s.selfDel ? (s.courier || "مندوب") : (s.shipCo||"شركة شحن")), kind:"شحن",
          note:"أوردر "+who+" · "+what, inn:0, out:shipOut(s), src:"أوردر"});
    });
    /* الفاتورة الواحدة كذا سجل — سجل لكل لون ومقاس. لو عملنا سطر خزنة
       لكل سجل، فاتورة بـ٤٧ تركيبة بتطلّع ٩٤ سطر في دفتر الخزنة (دفع +
       نقل لكل تركيبة) — وده مش اللي حصل فعلاً: إنت دفعت للمورد مرة
       واحدة على الفاتورة كلها. فبنجمّع بالـbatchId.
       الموجب والسالب بيتجمّعوا كل واحد لوحده مش صافي، عشان الأرقام
       تفضل مطابقة للقديم بالظبط لو الفاتورة فيها الاتنين. */
    var pBatch = [], pSeen = {};
    live("purchases").forEach(function(p){
      var k = p.batchId || ("solo:" + p.id);
      if(!pSeen[k]){
        pSeen[k] = { head:p, out:0, back:0, fr:0, items:{}, note:"", x:false, xo:{}, xi:{} };
        pBatch.push(pSeen[k]);
      }
      var g = pSeen[k], pd = Number(p.paid)||0;
      if(pd > 0) g.out += pd; else if(pd < 0) g.back += -pd;
      g.fr += pFreight(p);
      g.items[itemName(p.itemId)] = 1;
      if(p.xchg){ g.x = true; (isPRet(p) ? g.xo : g.xi)[itemName(p.itemId)] = 1; }
      if(!g.note && p.note) g.note = p.note;
      // أقدم تاريخ ووقت في الفاتورة هو اللي بيحدّد ترتيبها في الدفتر
      if((p.date||"") < (g.head.date||"")) g.head = p;
    });
    pBatch.forEach(function(g){
      var h = g.head;
      var what = Object.keys(g.items).slice(0,2).join(" · ") +
                 (Object.keys(g.items).length > 2 ? " وغيرهم" : "");
      var inv = h.pno ? "فاتورة #" + h.pno + " · " : "";
      if(g.x){
        // الاستبدال: سطر واحد بالفرق — «جزمه ← فستان»
        var xw = "فرق استبدال" + (h.pno ? " #" + h.pno : "") + ": " +
          Object.keys(g.xo).join(" · ") + " ← " + Object.keys(g.xi).slice(0,2).join(" · ");
        if(g.out > 0.009) L.push({d:h.date, at:h.at, t:"دفع لمورد", who:partyName(h.partyId), kind:"دفع",
          note:xw, inn:0, out:g.out, src:"شراء"});
        if(g.back > 0.009) L.push({d:h.date, at:h.at, t:"استرداد من مورد", who:partyName(h.partyId), kind:"تحصيل",
          note:xw, inn:g.back, out:0, src:"مرتجع"});
        return;
      }
      if(g.out > 0.009)
        L.push({d:h.date, at:h.at, t:"دفع لمورد", who:partyName(h.partyId), kind:"دفع",
          note:inv + "شراء " + what, inn:0, out:g.out, src:"شراء"});
      if(g.back > 0.009)
        L.push({d:h.date, at:h.at, t:"استرداد من مورد", who:partyName(h.partyId), kind:"تحصيل",
          note:inv + "مرتجع " + what + (g.note ? " · " + g.note : ""),
          inn:g.back, out:0, src:"مرتجع"});
      if(g.fr > 0.009)
        L.push({d:h.date, at:h.at, t:"نقل بضاعة", who:"نقل وتوصيل", kind:"مصروف",
          note:inv + "شحنة " + partyName(h.partyId) + " · " + what,
          inn:0, out:g.fr, src:"شراء"});
    });
    live("cash").forEach(function(c){
      var a = Number(c.amount)||0;
      if(c.type === "opening_party") return;   // رصيد جهة — مش حركة خزنة
      if(isCapType(c.type) && CAP[c.type].cash === 0) return;   // حركة رأس مال من غير نقدية
      var isIn = (c.type==="in" || c.type==="settle" || c.type==="opening" ||
                  (isCapType(c.type) && CAP[c.type].cash > 0));
      // v122: المصروف بنوعه — والانتقالات بتقول راحت على البضاعة ولا لأ
      var lab = cashLabel(c.type);
      if(c.type === "expense"){
        var ck = expCat(c);
        lab += " · " + EXP_CAT[ck].label + (ck === "trans" ? (trLinked(c) ? " (على تكلفة البضاعة)" : " (من غير فاتورة)") : "");
        if(c.paidBy){ lab += " · دفعه " + partyName(c.paidBy) + " من جيبه"; a = 0; }   // v142: الخزنة ما اتأثرتش
      }
      L.push({d:c.date, at:c.at, t:lab, kind:cashKind(c.type), cap:isCapType(c.type),
        who:(c.type==="settle" ? (c.shipCo||"شركة شحن") : (c.partyId?partyName(c.partyId):"—")),
        note:((c.note||"") === cashLabel(c.type) ? "" : (c.note||"")), inn:(isIn?a:0), out:(isIn?0:a),
        src:(c.type==="opening" ? "افتتاحي" : "يدوي"), id:c.id});
    });
    L.sort(function(a,b){
      if(a.d !== b.d) return a.d < b.d ? -1 : 1;
      return (a.at||0) - (b.at||0);
    });
    return L;
  }

  function renderWallets(){
    var rows = shipBuckets().map(function(co){
      var collected = 0, fees = 0, drawn = 0;
      live("sales").forEach(function(s){
        if(squish(s.shipCo) !== co || !viaShip(s)) return;
        if(!isCancelled(s)) collected += Number(s.paid)||0;
        if(isCancelled(s))  collected += shipIn(s);
        if(shipCounts(s))   fees += shipOut(s);
      });
      live("cash").forEach(function(c){
        if(c.type==="settle" && squish(c.shipCo)===co) drawn += Number(c.amount)||0;
      });
      var bal = collected - fees - drawn;
      return { co:co, collected:collected, fees:fees, drawn:drawn, bal:bal };
    }).filter(function(x){ return x.collected || x.fees || x.drawn; });

    document.getElementById("wallet-panel").hidden = !rows.length;
    if(!rows.length) return;
    table("t-wallets", ["شركة الشحن","حصّلت من العملاء","خصمت عمولتها","سحبته منها","لك في محفظتها"],
      rows.map(function(x){
        return "<tr><td class='wide'>"+(x.co ? esc(x.co)
            : "<span class='v-due'>⚠ من غير اسم شركة</span><span class='sub'>افتح الأوردر واكتب اسم شركة الشحن</span>")+"</td>"+
          "<td class='num v-gain'>"+money(x.collected)+"</td>"+
          "<td class='num v-due'>"+money(x.fees)+"</td>"+
          "<td class='num'>"+money(x.drawn)+"</td>"+
          "<td class='num "+(x.bal>0.009?"v-gain":(x.bal<-0.009?"v-due":""))+"'>"+money(x.bal)+"</td></tr>";
      }), "");
  }

