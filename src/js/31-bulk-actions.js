  /* ================= الإجراء الجماعي ================= */
  /* المندوب بيرجع بعشرين أوردر مرة واحدة. من غير ده كل أوردر ٣ خطوات.
     كل حاجة هنا بتعدّي على نفس حواجز الإجراء الفردي، واللي بيتخطّى
     بيتقال ليه — مفيش حاجة بتتعمل في الضلمة. */
  function canDeliver(rec){
    var short = null, needs = {};
    SL(rec).forEach(function(l){
      var k = keyOf(l);
      needs[k] = (needs[k]||0) + ((Number(l.qty)||0) - lineRet(l));
    });
    Object.keys(needs).forEach(function(k){
      if(short || needs[k] <= 0) return;
      var parts = k.split("|"), av = freeOfV(parts[0], parts[1], parts[2]);
      // اللي محجوز للأوردر ده نفسه مش نقص
      if(isReserved(rec)) SL(rec).forEach(function(l){ if(keyOf(l) === k) av += Number(l.qty)||0; });
      if(needs[k] > av) short = itemName(parts[0]) + ": المتاح " + qty(av) + " بس";
    });
    return short;
  }

  function bulkRun(kind, newStatus){
    var ids = selIds();
    if(!ids.length) return;
    /* الأوردر ممكن جزء منه ينفع وجزء لأ: يتسلّم بس تحصيله يتوقف لأن
       مفيش اسم شركة شحن. فالعدّ لازم يفصل بين الحركتين، والرسالة تقول
       بالظبط أنهي حركة اتخطّت على أنهي أوردر — مش رقم مبهم. */
    var nDeliv = 0, nPay = 0, money_ = 0, nShip = 0, shipMoney = 0, skip = {}, nLost = [];
    // أوردر الشركة: «استلم» = دفع للمندوب — بيتعدّ لوحده عشان الرسالة تقول الفلوس فين
    var shipPaid = function(rec, before){
      var inc = (Number(rec.paid)||0) - before;
      if(viaShip(rec) && inc > 0.009){ nShip++; shipMoney += inc; }
    };
    var no = function(rec, why){
      skip[why] = (skip[why] || []); skip[why].push("#" + (rec.no || "?"));
    };
    ids.forEach(function(id){
      var rec = db.sales.find(function(x){ return x.id === id; });
      if(!rec || rec.deleted) return;
      if(saleLocked(rec)){ no(rec, "في فترة مقفولة"); return; }
      var touched = false;

      // ١) الحالة
      var want = newStatus || ((kind === "deliver" || kind === "deliverpay") ? "delivered" : null);
      if(want && stOf(rec) !== want){
        // نفس قاعدة الخطوات — الإجراء الجماعي مش باب خلفي
        var why = stepBlock(rec, want);
        if(why){ no(rec, why.replace(/ — .*/, "")); return; }
        if(want === "delivered" || want === "progress"){
          var short = canDeliver(rec);
          if(short){ no(rec, short); return; }      // ما ينفعش يتسلّم = مش هيتحصّل كمان
        }
        var b0 = Number(rec.paid)||0;
        rec.rsn = ""; if(want !== "progress" && rec.cf === "nr"){ rec.cf = ""; rec.cfAt = ""; }
        rec.status = want; if(preCancelFix(rec)) nLost.push("#" + (rec.no || "")); stampDelivery(rec); markShipQ(rec); syncShipPaid(rec); touched = true; nDeliv++;
        shipPaid(rec, b0);
      }

      // ٢) التحصيل
      if(kind === "deliverpay" || kind === "collect"){
        if(!isDelivered(rec)){
          if(kind === "collect") no(rec, "تحصيل: لسه ما اتسلّمش");
        } else {
          var due = saleTotal(rec) + shipIn(rec) - (Number(rec.paid)||0);
          // أوردر الشركة: العميل دفع للمندوب وقت الاستلام — بيتسجّل لوحده
          if(viaShip(rec)){ var b1 = Number(rec.paid)||0; if(syncShipPaid(rec)){ touched = true; shipPaid(rec, b1); } }
          else if(due > 0.009){ addPay(rec, due); money_ += due; nPay++; touched = true; }
        }
      }
      if(touched){ rec.editedBy = me || "غير محدد"; rec.at = Date.now(); }
    });

    var any = nDeliv || nPay || nShip;
    if(any) saveSoon("sales");
    selSales = {};
    renderAll();

    var parts = [];
    if(nDeliv) parts.push((newStatus ? "اتغيّرت حالة " : "اتسلّم ") + qty(nDeliv) + " أوردر");
    if(nPay)   parts.push("اتحصّل " + qty(nPay) + " أوردر بـ" + money(money_));
    if(nShip)  parts.push("عملاء " + qty(nShip) + " أوردر دفعوا للمندوب " + money(shipMoney) +
                          " — الفلوس عند شركة الشحن");
    if(nLost.length) parts.push(nLost.join(" و") + " رجع من إلغاء قديم — " + SHIP_WIPED);
    var skips = Object.keys(skip);
    skips.forEach(function(w){ parts.push(skip[w].join(" و") + " اتخطّى — " + w); });

    var res = document.getElementById("s-bulk-res");
    if(res){
      res.innerHTML = esc(parts.join(" · ")) || "مفيش حاجة محتاجة تتغيّر.";
      res.className = "note " + (skips.length ? "bad" : "ok");
      res.hidden = false;
    }
    toast(any ? parts[0] + (skips.length ? " · في أوردرات اتخطّت، شوف فوق" : "")
              : (skips.length ? "مفيش حاجة اتعملت — شوف السبب فوق" : "مفيش حاجة محتاجة تتغيّر"));
  }

  function cancelDraft(){
    var wasEditing = !!editing.sales;
    editing.sales = null; clearEditBase("sales");
    draft = newDraft(draft);
      closeDrawer();
    renderSales();
    if(wasEditing) toast("اتلغى التعديل");
  }
  function focusFirst(){
    var el = document.getElementById("e-party");
    if(el && SD_OPEN) el.focus();
  }

  function saveDraft(){
    var status = draft.status;
    var lines = draft.lines.map(function(l){
      return { itemId:l.itemId, color:l.color, size:l.size,
               qty:Number(l.qty)||0, price:Number(l.price)||0,
               ret: status === "delivered" ? (Number(l.ret)||0) : 0,
               unitCost: l.unitCost, trCost: l.trCost };
    }).filter(function(l){ return l.itemId && l.qty > 0; });

    // الفترة المقفولة: لا السجل القديم يتعدّل، ولا سجل جديد يتحط جواها
    if(editing.sales){
      var oldRec = db.sales.find(function(x){ return x.id === editing.sales; });
      if(oldRec && saleLocked(oldRec)){ toast("الأوردر ده في فترة مقفولة — مينفعش يتعدّل"); return; }
      if(!staleCheck("sales", oldRec)) return;
    }
    if(!guardLock(draft.date, "الأوردر")) return;

    if(!draft.partyId){ toast("اختر العميل"); focusFirst(); return; }
    if(!lines.length){ toast("اختر صنف واكتب الكمية"); return; }
    // تحصيل «عن طريق شركة الشحن» من غير اسم الشركة = فلوس مالهاش مكان:
    // مش في الخزنة (لأنها عند الشركة) ولا في محفظة (لأن مفيش شركة).
    if(viaShip(draft) && !squish(draft.shipCo) &&
       ((Number(draft.paid)||0) || shipIn(draft) || shipOut(draft))){
      toast("اكتب اسم شركة الشحن — الفلوس دي عندها مش عندك");
      var sc = document.getElementById("e-shipco");
      if(sc){ sc.focus(); sc.scrollIntoView({block:"center"}); }
      return;
    }
    var why = stepBlock({ shipCo:draft.shipCo, shipCode:draft.shipCode, payVia:draft.payVia,
                          paid:draft.paid, status:status, selfDel:draft.selfDel }, status);
    if(why){
      toast(why, 4200);
      var fid = !squish(draft.shipCo) ? "e-shipco" : (!squish(draft.shipCode) ? "e-shipcode" : "e-status");
      var fe = document.getElementById(fid);
      if(fe){ fe.focus(); fe.scrollIntoView({block:"center"}); }
      return;
    }
    for(var i=0;i<lines.length;i++){
      var miss = variantMissing(lines[i].itemId, lines[i].color, lines[i].size);
      if(miss){ toast(itemName(lines[i].itemId)+": "+miss); return; }
      if(lines[i].ret > lines[i].qty){ toast(itemName(lines[i].itemId)+": المرتجع أكبر من المشحون"); return; }
    }
    if(status === "delivered" || status === "progress"){
      var needs = {}, short = null;
      lines.forEach(function(l){
        var k = vKey(l.itemId, l.color, l.size);
        needs[k] = (needs[k]||0) + (status === "delivered" ? (l.qty - l.ret) : l.qty);
      });
      Object.keys(needs).forEach(function(k){
        if(short || needs[k] <= 0) return;
        var av = availOfKey(k), parts = k.split("|");
        if(needs[k] > av) short = itemName(parts[0]) +
          (vLabel(parts[1],parts[2]) ? " ("+vLabel(parts[1],parts[2])+")" : "") +
          (av <= 0 ? " خلصان — سجّل شراء الأول" : ": المتاح " + qty(av) + " بس");
      });
      if(short && !document.getElementById("s-allow").checked){
        document.getElementById("s-allow-wrap").hidden = false;
        updateEntryCalc(); toast(short); return;
      }
    }

    /* أوردر الشركة: المحصّل مش بيتكتب — العميل استلم = دفع للمندوب
       تمن اللي خده + الشحن، لسه ما استلمش أو رفض = صفر. */
    var paidV = status === "cancelled" ? 0 : (Number(draft.paid)||0);
    if(viaShip(draft))
      paidV = status === "delivered"
        ? Math.round((lines.reduce(function(a, l){ return a + (l.qty - l.ret) * l.price; }, 0) +
                      (Number(draft.shipIn)||0)) * 100) / 100
        : 0;
    var cfV = status === "progress" ? (draft.cf || "") : (draft.cf === "ok" ? "ok" : "");   // «ما ردّش» بيخص الجاري بس
    var fields = {
      date: draft.date || today(), partyId: draft.partyId, lines: lines, status: status,
      paid: paidV,
      owner: (draft.owner||"").trim(),
      // توصيل بنفسك: مفيش شركة ولا بوليصة، والتحصيل مباشر ليك
      shipCo: draft.selfDel ? "" : (draft.shipCo||"").trim(),
      shipCode: draft.selfDel ? "" : (draft.shipCode||"").trim(),
      payVia: draft.selfDel ? "direct" : draft.payVia,
      selfDel: !!draft.selfDel, courier: draft.selfDel ? squish(draft.courier || "") : "",
      shipIn: Number(draft.shipIn)||0, shipOut: Number(draft.shipOut)||0,
      note: (draft.note||"").trim(),
      src: draft.src || "", camp: SRC_AD[draft.src] ? squish(draft.camp || "") : "",
      cf: cfV, cfAt: cfV ? (draft.cfAt || today()) : "",
      rsn: status === "cancelled" ? (draft.rsn || "") : "",
      preCancel: false,
      itemId:"", color:"", size:"", qty:0, price:0, ret:0
    };

    var old = editing.sales ? (db.sales.find(function(x){ return x.id === editing.sales; }) || null) : null;
    var wasPre = !!(old && old.preCancel), shipLost = false;
    if(status === "cancelled" && draftPreShip(status)){
      fields.preCancel = true; fields.shipKept = wasPre ? !!old.shipKept : true;
    } else if(wasPre) shipLost = shipWiped(fields, !!old.shipKept);
    if(editing.sales){
      var rec = db.sales.find(function(x){ return x.id === editing.sales; });
      if(rec){
        var paid0 = Number(rec.paid)||0;
        Object.keys(fields).forEach(function(k){ rec[k] = fields[k]; });
        if(!fields.preCancel) delete rec.shipKept;                      // v141: العلامة على الملغي قبل الشحن بس
        rec.editedBy = me || "غير محدد"; rec.at = Date.now();
        stampDelivery(rec);
        syncSelfPaid(rec, paid0);
      }
      freshId = editing.sales; editing.sales = null; clearEditBase("sales");
      toast(shipLost ? "اتعدّل الأوردر — " + SHIP_WIPED : "اتعدّل الأوردر", shipLost ? 5200 : undefined);
    } else {
      fields.no = nextSaleNo();
      var rec2 = stamp(fields);
      stampDelivery(rec2);
      syncSelfPaid(rec2, 0);
      db.sales.push(rec2);
      freshId = rec2.id;
      toast("اتسجّل أوردر #" + rec2.no);
    }
    saveSoon("sales");
    document.getElementById("s-allow").checked = false;
    draft = newDraft(draft);           // شركة الشحن وطريقة التحصيل بيفضلوا زي ما هم
      closeDrawer();
    renderAll();
  }

  function startRepeatSale(id){
    var rec = db.sales.find(function(x){ return x.id===id; });
    if(!rec) return;
    editing.sales = null;                 // ده أوردر جديد مش تعديل
    clearEditBase("sales");
    draft = draftRepeat(rec);
      goTab("sales");
    openDrawer();
    toast("أوردر جديد بنفس أصناف #" + (rec.no || "") + " — راجعه واحفظه");
  }

  function startEditSale(id){
    var rec = db.sales.find(function(x){ return x.id===id; });
    if(!rec) return;
    editing.sales = id;
    markEditBase("sales", rec);
    draft = draftFrom(rec);
      goTab("sales");
    openDrawer();
    toast("بتعدّل أوردر #" + (rec.no || ""));
  }

  function fillNcGov(){
    var g = document.getElementById("nc-gov");
    if(g.options.length) return;
    g.innerHTML = '<option value="">—</option>' + GOVS.map(function(x){
      return '<option value="'+esc(x)+'">'+esc(x)+'</option>'; }).join("");
  }
  document.getElementById("b-cancelcust").addEventListener("click", function(){
    document.getElementById("newcust-box").hidden = true;
  });
  document.getElementById("b-savecust").addEventListener("click", function(){
    var name = squish(document.getElementById("nc-name").value);
    if(!name){ toast("اكتب اسم العميل"); return; }
    var phone = document.getElementById("nc-phone").value.trim();
    if(phone){
      var dup = live("parties").find(function(x){ return (x.phone||"").trim() === phone; });
      if(dup){ toast("التليفون ده مسجّل باسم: " + dup.name); return; }
    }
    var rec = stamp({ name:name, type:"customer", phone:phone,
      gov:document.getElementById("nc-gov").value,
      address:document.getElementById("nc-address").value.trim(),
      fb:document.getElementById("nc-fb").value.trim(), note:"" });
    db.parties.push(rec);
    ["nc-name","nc-phone","nc-address","nc-fb"].forEach(function(id){ document.getElementById(id).value=""; });
    document.getElementById("nc-gov").value = "";
    document.getElementById("newcust-box").hidden = true;
    draft.partyId = rec.id;            // يتختار في سطر الإدخال على طول
    renderAll(); syncSrcUI();
    suggestShipping();
    toast("اتضاف العميل واتختار");
    saveSoon("parties");
  });

