  /* ---------- حفظ فاتورة الشراء ---------- */
  function readPHead(){
    if(!pdraft) return;
    pdraft.date    = document.getElementById("p-date").value || today();
    pdraft.partyId = document.getElementById("p-party").value;
    pdraft.inv     = document.getElementById("p-inv").value.trim();
    pdraft.freight = Number(document.getElementById("p-freight").value)||0;
    pdraft.paid    = pdraft.paidAuto ? pdGoods() : (Number(document.getElementById("p-paid").value)||0);
    pdraft.note    = document.getElementById("p-note").value.trim();
  }

  var keepOpenAfterSave = false;
  document.getElementById("b-purch-next").addEventListener("click", function(){
    keepOpenAfterSave = true;
    document.getElementById("b-purch").click();
  });

  bind("f-purch","b-purch", function(){
    if(!pdraft) return;
    readPHead();
    if(!guardLock(pdraft.date, "الشراء")) return;
    if(!pdraft.partyId){ toast("اختر المورد"); return; }

    // سطر ناقص التفصيل: الصنف متختار والسعر مكتوب بس مفيش مقاسات
    var half = pdraft.lines.filter(function(l){
      return l.itemId && plGoods(l) > 0 && plQty(l) <= 0;
    });
    if(half.length){
      toast(itemName(half[0].itemId) + ": اكتب المقاسات والألوان اللي جوّه الشحنة");
      return;
    }
    var live_ = pdraft.lines.filter(function(l){ return l.itemId && plQty(l) > 0; });
    if(!live_.length){ toast("اكتب صنف وكمية على الأقل"); return; }
    // أي لون أو مقاس جديد اتكتب في الفاتورة بيتسجّل على الصنف نفسه،
    // فالمستخدم مش محتاج يروح تبويب الأصناف يعرّفهم الأول
    var touched = {};
    live_.forEach(function(l){
      var it = db.items.find(function(x){ return x.id === l.itemId; });
      if(!it) return;
      plParts(l).forEach(function(pt){
        ["colors","sizes"].forEach(function(key){
          var v = key === "colors" ? pt.color : pt.size;
          if(!v) return;
          var cur = listOf(it, key);
          if(cur.indexOf(v) >= 0) return;
          cur.push(v);
          it[key] = cur.join("، ");
          touched[it.id] = 1;
        });
      });
    });
    Object.keys(touched).forEach(function(id){
      var it = db.items.find(function(x){ return x.id===id; });
      if(it){ it.at = Date.now(); it.editedBy = me || "غير محدد"; }
    });
    if(Object.keys(touched).length) saveSoon("items");
    for(var i = 0; i < live_.length; i++){
      if(!(Number(live_[i].packCost) > 0)){
        toast(itemName(live_[i].itemId) + ": اكتب سعر الوحدة"); return;
      }
      var parts0 = plParts(live_[i]);
      for(var j = 0; j < parts0.length; j++){
        var miss = variantMissing(live_[i].itemId, parts0[j].color, parts0[j].size);
        if(miss){ toast(itemName(live_[i].itemId) + ": " + miss); return; }
      }
      // نفس التركيبة مكرّرة في نفس السطر بتلخبط الجرد
      var seen = {};
      for(var k = 0; k < parts0.length; k++){
        var kk = parts0[k].color + "|" + parts0[k].size;
        if(seen[kk]){
          toast(itemName(live_[i].itemId) + ": " +
            (vLabel(parts0[k].color, parts0[k].size) || "السطر ده") + " مكرّر — اجمعه في سطر واحد");
          return;
        }
        seen[kk] = 1;
      }
    }

    var goods = live_.reduce(function(a,l){ return a + plGoods(l); }, 0);
    var forced = document.getElementById("p-force").checked;
    if(!forced){
      if(pdraft.paid > goods + 0.009){
        pOverMsg("<strong>المدفوع أكبر من قيمة البضاعة.</strong> الفاتورة بـ " + money(goods) +
          " وإنت كاتب مدفوع " + money(pdraft.paid) + ". لو ده مقصود (دفعة مقدمة لشحنة جاية) " +
          "أكّد تحت، ولو غلطة عدّل الرقم. <br>ملاحظة: مصاريف النقل ليها خانة لوحدها — " +
          "متضفهاش على المدفوع للمورد.");
        toast("المدفوع أكبر من الفاتورة"); return;
      }
      var out = pdraft.paid + pdraft.freight, bal = cashBoxForPurch();
      if(out > bal + 0.009){
        pOverMsg("<strong>الخزنة فيها " + money(bal) + " بس</strong> وهيخرج منها " + money(out) +
          (pdraft.freight ? " (" + money(pdraft.paid) + " للمورد + " + money(pdraft.freight) + " نقل)" : "") +
          ". " + (bal <= 0.009 && !totalCapital()
            ? "سجّل رأس المال الأول من تبويب «رأس المال» — هو اللي بتشتري بيه."
            : "قلّل المدفوع وسيب الباقي دَين على نفسك للمورد، أو حصّل من العملاء الأول."));
        toast("المبلغ أكبر من رصيد الخزنة"); return;
      }
    }

    var frShares   = allocByValue(pdraft.freight, live_);
    var paidShares = allocByValue(pdraft.paid,    live_);
    // التقريب بيتظبط جوّه allocByValue، فمجموع الأنصبة = المكتوب بالظبط
    var batchId = pdraft.batchId || uid();
    var old = pdraft.batchId
      ? live("purchases").filter(function(r){ return r.batchId === pdraft.batchId; })
                         .sort(function(a,b){ return (a.at||0) - (b.at||0); })
      : [];
    var now = Date.now();

    // كل سطر بيتفكّ لسجل لكل تركيبة، وكلهم بنفس تكلفة القطعة
    // (المورد بيسعّر الشحنة مش المقاس، فالتقسيم بالتساوي على القطع)
    var recs = [];
    live_.forEach(function(l, i){
      var pieces = plQty(l), g = plGoods(l);
      var unitCost = (g + frShares[i]) / pieces;
      var lineId = l.lineId || uid();
      l.lineId = lineId;
      // «قطع في الواحدة» محسوبة من التفصيل — لازم تتخزّن عشان المرتجع
      // يعرف سعر القطعة الأصلي، وعشان التعديل يرجّع نفس الأرقام
      var packsN = plPacks(l);
      var derivedPQ = packsN > 0 ? pieces / packsN : 1;
      plParts(l).forEach(function(pt){
        var w = pt.qty / pieces;                       // نصيب التركيبة من السطر
        recs.push({
          date: pdraft.date, partyId: pdraft.partyId, inv: pdraft.inv,
          itemId: l.itemId, color: pt.color, size: pt.size,
          packName: unitOf(l), byPack: isByPack(l), packs: plPacks(l),
          packQty: derivedPQ, packCost: Number(l.packCost)||0,
          linePieces: pieces, lineId: lineId,
          freight: frShares[i]   * w,
          paid:    paidShares[i] * w,
          qty: pt.qty, cost: unitCost,                 // تكلفة القطعة واصلة المخزن
          note: pdraft.note, batchId: batchId
        });
      });
    });

    recs.forEach(function(f, n){
      var rec = old[n];
      if(rec){
        Object.keys(f).forEach(function(k){ rec[k] = f[k]; });
        delete rec.deleted;
        rec.editedBy = me || "غير محدد"; rec.at = now;
      } else {
        db.purchases.push(stamp(f));
      }
    });
    // سجلات زيادة من قبل التعديل
    old.slice(recs.length).forEach(function(r){ r.deleted = true; r.at = now; });

    var wasEdit = !!pdraft.batchId;
    var again = keepOpenAfterSave && !wasEdit;
    var keepParty = pdraft.partyId, keepDate = pdraft.date;
    keepOpenAfterSave = false;
    freshBatch = batchId;
    editing.purchases = null; setEditUI("purchases");
    saveSoon("purchases");
    pdraft = newPDraft();
    // «حفظ وابدأ واحدة جديدة»: نفس المورد ونفس التاريخ عشان إدخال
    // عشر فواتير من نفس المورد ما يبقاش عشر مرات اختيار
    if(again){ pdraft.partyId = keepParty; pdraft.date = keepDate; }
    renderPLines(); syncPHead(); renderPDraftNote();
    clearPOver();
    if(!again) closeEntry();
    renderAll();
    if(again){
      renderPLines(); syncPHead();
      var f = document.getElementById("pl-item-0");
      if(f) setTimeout(function(){ try{ f.focus(); }catch(e){} }, 60);
    }
    toast(wasEdit ? "اتعدّلت الفاتورة"
                  : ("اتسجّلت الفاتورة · " + qty(recs.reduce(function(a,x){ return a + x.qty; },0)) +
                     " قطعة" + (again ? " — ابدأ اللي بعدها" : "")));
  });

  // بيكتب رأس الفاتورة في الفورم من المسوّدة
  function syncPHead(){
    document.getElementById("p-date").value    = pdraft.date || firstOpenDate();
    document.getElementById("p-party").value   = pdraft.partyId || "";
    document.getElementById("p-inv").value     = pdraft.inv || "";
    document.getElementById("p-freight").value = pdraft.freight || 0;
    document.getElementById("p-paid").value    = pdraft.paid || 0;
    document.getElementById("p-note").value    = pdraft.note || "";
  }

  /* ---------- شيت الفاتورة: تنزيل واستيراد ----------
     CSV مش xlsx: السيستم ملف واحد من غير مكتبات، وقارئ xlsx حقيقي
     معناه ٨٠٠ كيلو من الإنترنت. إكسل بيفتح ويحفظ CSV على طول،
     فالشيت ده بيتفتح ويتملى ويترفع عادي. */
  var PU_STOP = "### تحت ده للمراجعة بس — ماتكتبش فيه ###";
  var PU_COLS = ["الصنف", "اللون", "المقاس", "عدد القطع", "تكلفة القطعة",
                 "عدد الكراتين", "سعر الكرتونة"];
  var PU_HEADKEY = {
    "التاريخ":"date", "المورد":"party",
    "رقم فاتورة المورد":"inv", "رقم الفاتورة":"inv",
    "مصاريف النقل":"freight", "النقل":"freight",
    "المدفوع":"paid", "المدفوع للمورد":"paid", "ملاحظة":"note"
  };
  function csvCell(v){ return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  function csvLine(a){ return a.map(csvCell).join(","); }

  // بيقرا CSV بالفاصلة أو الفاصلة المنقوطة (إكسل العربي بيحفظ بالمنقوطة)
  // ومعاه علامات التنصيص اللي إكسل بيحطها لوحده حوالين النص اللي فيه فاصلة
  function csvSplit(text){
    text = String(text == null ? "" : text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    var sep = (text.split(";").length > text.split(",").length) ? ";" : ",";
    var rows = [], row = [], cur = "", q = false;
    for(var i = 0; i < text.length; i++){
      var c = text.charAt(i);
      if(q){
        if(c !== '"'){ cur += c; }
        else if(text.charAt(i+1) === '"'){ cur += '"'; i++; }
        else q = false;
      }
      else if(c === '"') q = true;
      else if(c === sep){ row.push(cur); cur = ""; }
      else if(c === "\n"){ row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
    row.push(cur); rows.push(row);
    return rows.map(function(r){ return r.map(squish); });
  }
  function rowEmpty(r){ return !r.join("").length; }
  // خانة فاضية معناها «مش مكتوبة» مش «صفر» — الفرق ده هو اللي
  // بيفرّق بين الشراء بالقطعة والشراء بالكرتونة
  function puNum(v){
    var t = toEn(squish(v)).replace(/[^\d.\-]/g, "");
    if(t === "") return null;
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  function suppliersLive(){
    return live("parties").filter(function(p){ return p.type === "supplier"; });
  }
  function byName(list, nm){
    var k = squish(nm).toLowerCase();
    if(!k) return null;
    for(var i = 0; i < list.length; i++){
      if(squish(list[i].name).toLowerCase() === k) return list[i];
    }
    return null;
  }
  // إكسل ساعات بيعيد تنسيق التاريخ — بنقبل سنة-شهر-يوم ويوم/شهر/سنة
  function puDate(s){
    s = toEn(squish(s));
    var p2 = function(n){ return ("0" + n).slice(-2); };
    var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if(m) return m[1] + "-" + p2(m[2]) + "-" + p2(m[3]);
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if(m) return m[3] + "-" + p2(m[2]) + "-" + p2(m[1]);
    /* إكسل بيفتح 2026-09-28 ويحفظها 28-09-26 (يوم-شهر-سنة برقمين).
       مابنقدرش نمنعه، فبنفهمها — والتاريخ بيتراجع في الفورم قبل الحفظ. */
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2})$/);
    if(m) return "20" + m[3] + "-" + p2(m[2]) + "-" + p2(m[1]);
    return "";
  }

  function puTplCSV(){
    var sup = suppliersLive(), L = [];
    L.push(csvLine(["التاريخ", firstOpenDate()]));
    L.push(csvLine(["المورد", sup.length === 1 ? sup[0].name : ""]));
    L.push(csvLine(["رقم فاتورة المورد", ""]));
    L.push(csvLine(["مصاريف النقل", 0]));
    L.push(csvLine(["المدفوع", 0]));
    L.push(csvLine(["ملاحظة", ""]));
    L.push("");
    /* السطور دي بيتخطاها القارئ (أول خانة مش من كلمات الرأس) —
       فمكانها فوق جنب اللي بيملا، مش مدفونة تحت. */
    L.push(csvLine(["اكتب سطر لكل لون ومقاس تحت. بتشتري بالقطعة؟ املا «تكلفة القطعة» بس وسيب آخر عمودين فاضيين."]));
    L.push(csvLine(["بتشتري بالكرتونة؟ سيب «تكلفة القطعة» فاضية، واملا «عدد الكراتين» و«سعر الكرتونة» — وكررهم زي ما هم في كل سطر من نفس الشحنة."]));
    L.push(csvLine(["«عدد القطع» دايمًا عدد القطع نفسها في اللون والمقاس ده، مش عدد الكراتين. ومصاريف النقل فوق بتتوزّع لوحدها على الأصناف."]));
    L.push(csvLine(["لو إكسل غيّر شكل التاريخ سيبه — السيستم بيفهمه، وهتراجعه في الفورم قبل ما تحفظ."]));
    L.push("");
    L.push(csvLine(PU_COLS));
    L.push("");
    L.push(csvLine([PU_STOP]));
    L.push("");
    L.push(csvLine(["مثال ١ — شراء بالقطعة (12 قطعة بـ145 للقطعة):"]));
    L.push(csvLine(["اسم الصنف زي ما هو تحت", "أحمر", "M", 12, 145, "", ""]));
    L.push("");
    L.push(csvLine(["مثال ٢ — شراء بالكرتونة (3 كراتين بـ1200 للكرتونة، جواهم 36 قطعة):"]));
    L.push(csvLine(["اسم الصنف زي ما هو تحت", "أسود", "38", 20, "", 3, 1200]));
    L.push(csvLine(["اسم الصنف زي ما هو تحت", "أسود", "39", 16, "", 3, 1200]));
    L.push(csvLine(["لاحظ: «3» و«1200» اتكتبوا في السطرين — دي شحنة واحدة، والسيستم بيعدّها مرة واحدة."]));
    L.push(csvLine(["واللون والمقاس الجداد بيتسجّلوا على الصنف لوحدهم."]));
    L.push("");
    L.push(csvLine(["الموردين عندك:"]));
    sup.forEach(function(p){ L.push(csvLine([p.name])); });
    if(!sup.length) L.push(csvLine(["(لسه مافيش موردين — ضيف المورد من تبويب الجهات الأول)"]));
    L.push("");
    L.push(csvLine(["أصنافك — انسخ الاسم بالظبط:"]));
    L.push(csvLine(["اسم الصنف", "الألوان المسجّلة", "المقاسات المسجّلة"]));
    live("items").forEach(function(it){
      L.push(csvLine([it.name, listOf(it, "colors").join(" / "), listOf(it, "sizes").join(" / ")]));
    });
    return L.join("\n");
  }

  // بيحوّل الشيت لمسوّدة فاتورة. مابيكتبش في الدفاتر —
  // بيسيب فورم الشراء هو اللي يتحقق ويحفظ، فمفيش منطق متكرر يفرق عن ده.
  function puParse(text){
    var rows = csvSplit(text), head = {}, li = -1;
    for(var i = 0; i < rows.length; i++){
      var c0 = rows[i][0] || "";
      if(c0 === PU_COLS[0]){ li = i; break; }
      if(c0 === PU_STOP) break;
      if(PU_HEADKEY[c0]) head[PU_HEADKEY[c0]] = rows[i][1] || "";
    }
    if(li < 0) return { errs:["الملف ده مش شيت الفاتورة — نزّل الشيت من زرار «نزّل شيت الفاتورة» واملاه."] };

    var errs = [], groups = [], gmap = {}, seen = {};
    for(i = li + 1; i < rows.length; i++){
      var r = rows[i];
      if((r[0] || "") === PU_STOP) break;
      if(rowEmpty(r)) continue;
      var ln = i + 1;                                   // رقم السطر زي ما إكسل بيوريه
      var nm = r[0] || "", color = r[1] || "", size = r[2] || "";
      var q  = Number(toEn(r[3])) || 0;
      var pc = puNum(r[4]), pk = puNum(r[5]), kc = puNum(r[6]);
      var lbl = "سطر " + ln + " (" + nm + "): ";
      if(!nm){ errs.push("سطر " + ln + ": خانة الصنف فاضية"); continue; }
      var it = byName(live("items"), nm);
      if(!it){ errs.push("سطر " + ln + ": مافيش صنف اسمه «" + nm + "»"); continue; }
      if(q <= 0){ errs.push(lbl + "عدد القطع لازم يكون أكبر من صفر"); continue; }
      /* بالقطعة ولا بالكرتونة — واحد بس. الاتنين مع بعض معناه
         إن السطر متكتب بطريقتين والتكلفة هتطلع غلط. */
      var byPack = (pk !== null || kc !== null);
      if(pc !== null && byPack){
        errs.push(lbl + "اختار حاجة واحدة: يا «تكلفة القطعة» يا «عدد الكراتين + سعر الكرتونة»"); continue;
      }
      if(byPack && (pk === null || kc === null)){
        errs.push(lbl + "الشراء بالكرتونة محتاج «عدد الكراتين» و«سعر الكرتونة» مع بعض"); continue;
      }
      if(!byPack && pc === null){
        errs.push(lbl + "اكتب «تكلفة القطعة»، أو «عدد الكراتين» و«سعر الكرتونة» لو بتشتري بالكرتونة"); continue;
      }
      if(byPack && !(pk > 0 && kc > 0)){ errs.push(lbl + "عدد الكراتين وسعرها لازم يكونوا أكبر من صفر"); continue; }
      if(!byPack && !(pc > 0)){ errs.push(lbl + "تكلفة القطعة لازم تكون أكبر من صفر"); continue; }

      // الشحنة الواحدة = نفس الصنف بنفس التسعيرة؛ أسطرها بتتجمّع في سطر واحد
      var gk = byPack ? (it.id + "|k|" + pk + "|" + kc) : (it.id + "|p|" + pc);
      var vk = gk + "|" + color + "|" + size;
      if(seen[vk]){
        errs.push("سطر " + ln + ": «" + nm + (vLabel(color, size) ? " " + vLabel(color, size) : "") +
                  "» مكرّر في نفس الشحنة — اجمعه في سطر واحد");
        continue;
      }
      seen[vk] = 1;
      if(!gmap[gk]){
        gmap[gk] = byPack
          ? { itemId:it.id, byPack:true,  packs:pk, packQty:1, packCost:kc, mix:[] }
          : { itemId:it.id, byPack:false, packs:"", packQty:1, packCost:pc, mix:[] };
        groups.push(gmap[gk]);
      }
      gmap[gk].mix.push({ color:color, size:size, qty:q });
    }
    if(errs.length) return { errs:errs };
    if(!groups.length) return { errs:["الشيت مافيهوش أسطر — اكتب الأصناف تحت صف العناوين"] };

    var out = { date:"", partyId:"", inv:squish(head.inv || ""), freight:0, paid:0,
                note:squish(head.note || ""), lines:groups, batchId:"", warn:[] };
    var d = puDate(head.date);
    if(!d){ out.date = firstOpenDate(); if(squish(head.date || "")) out.warn.push("التاريخ اللي في الشيت مش مفهوم — حطّينا " + out.date); }
    else out.date = d;
    if(squish(head.party || "")){
      var sp = byName(suppliersLive(), head.party);
      if(sp) out.partyId = sp.id;
      else return { errs:["مافيش مورد اسمه «" + squish(head.party) + "» — ضيفه من تبويب الجهات الأول، أو صلّح الاسم في الشيت"] };
    } else out.warn.push("خانة المورد فاضية — اختاره من الفورم");
    out.freight = Number(toEn(head.freight)) || 0;
    out.paid    = Number(toEn(head.paid))    || 0;
    out.paidAuto = !squish(head.paid || "");   // خانة المدفوع فاضية = كل الفاتورة
    return out;
  }

  function puMsg(html, bad){
    var el = document.getElementById("pu-msg");
    if(!el) return;
    if(!html){ el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = bad ? "<span class='v-due'>" + html + "</span>" : html;
  }

  function puImport(text){
    var res = puParse(text);
    if(res.errs){
      puMsg("<strong>الشيت ما اترفعش:</strong><br>" +
        res.errs.slice(0, 12).map(esc).join("<br>") +
        (res.errs.length > 12 ? "<br>… و" + (res.errs.length - 12) + " مشكلة تانية" : ""), true);
      toast("في مشاكل في الشيت — اقرا التفاصيل فوق", 3200);
      return false;
    }
    editing.purchases = null; clearEditBase("purchases"); setEditUI("purchases");
    pdraft = { date:res.date, partyId:res.partyId, inv:res.inv, freight:res.freight,
               paid:res.paid, paidAuto:!!res.paidAuto, note:res.note, lines:res.lines, batchId:"" };
    var pcs = res.lines.reduce(function(a, l){ return a + mixPieces(l); }, 0);
    clearPOver(); goTab("purch"); openEntry("purchases");
    syncPHead(); renderPLines(); renderPDraftNote();
    puMsg("اترفع الشيت: " + res.lines.length + " سطر · " + qty(pcs) + " قطعة" +
      (res.warn.length ? "<br>" + res.warn.map(esc).join("<br>") : "") +
      "<br>راجع الأرقام واضغط «احفظ» عشان تتسجّل.");
    toast("راجع الفاتورة واحفظها");
    return true;
  }

  document.getElementById("b-pu-tpl").addEventListener("click", function(){
    download("lora-purchase-sheet-" + today() + ".csv", puTplCSV(), "text/csv");
    puMsg("نزّل الشيت. افتحه بإكسل، املاه، واحفظه <strong>CSV</strong> (مش xlsx) عشان يترفع.");
  });
  // تأكيد من خطوتين بدل نافذة المتصفح — زي باقي السيستم
  var puArm = 0;
  document.getElementById("b-pu-up").addEventListener("click", function(){
    if(!canEdit()){ toast("مالكش صلاحية التعديل"); return; }
    if(pDraftDirty() && Date.now() - puArm > 12000){
      puArm = Date.now();
      puMsg("عندك فاتورة لسه ما اتحفظتش — الشيت هيمسحها. اضغط الزرار تاني لو ماشي.", true);
      return;
    }
    puArm = 0; puMsg("");
    document.getElementById("pu-file").click();
  });
  document.getElementById("pu-file").addEventListener("change", function(){
    var f = this.files && this.files[0];
    this.value = "";                                  // نفس الملف يترفع تاني لو اتعدّل
    if(!f) return;
    var reader = new FileReader();
    reader.onload = function(){ try{ puImport(String(reader.result)); }
                                catch(e){ puMsg("الملف مش مقروء: " + esc(String(e && e.message || e)), true); } };
    reader.onerror = function(){ puMsg("الملف مش مقروء", true); };
    reader.readAsText(f, "utf-8");
  });

  /* ---------- كروت الفواتير ---------- */
  document.getElementById("pu-only").addEventListener("click", function(e){
    var b = e.target.closest("[data-puonly]"); if(!b) return;
    puOnly = b.dataset.puonly; resetPage("purch"); renderPurch();
  });
  document.getElementById("pu-cards").addEventListener("click", function(e){
    var t;
    if((t = e.target.closest("[data-pret]"))){ e.stopPropagation(); openPRet(t.dataset.pret); return; }
    if((t = e.target.closest("[data-xsrc]"))){ openXchg({ srcId:t.dataset.xsrc }); return; }
    if((t = e.target.closest("[data-pvopen]"))){
      var k = t.dataset.pvopen;
      if(openPurch[k]) delete openPurch[k]; else openPurch[k] = 1;
      renderPurch(); return;
    }
  });
  document.getElementById("pu-owe").addEventListener("click", function(e){
    var t;
    if((t = e.target.closest("[data-ptpay]"))){ payParty(t.dataset.ptpay); return; }
    if((t = e.target.closest("[data-puparty]"))){ openPartyCard(t.dataset.puparty); return; }
  });

  /* ---------- أحداث أسطر الفاتورة ---------- */
  document.getElementById("t-purch").addEventListener("click", function(e){
    var b = e.target.closest("[data-pret]");
    if(b){ e.stopPropagation(); openPRet(b.dataset.pret); return; }
    // الأزرار جوّه السطر ليها معالجها في مكان تاني
    if(e.target.closest("button,a,select,input")) return;
    var tr = e.target.closest("tr.pinv");
    if(!tr) return;
    var k = tr.dataset.prow;
    if(openPurch[k]) delete openPurch[k]; else openPurch[k] = 1;
    renderPurch();
  });
  document.getElementById("t-purch").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var tr = e.target.closest("tr.pinv"); if(!tr) return;
    e.preventDefault(); tr.click();
  });

  /* ---------- المخزون: سطر الصنف بيتفتح ---------- */
  document.getElementById("t-inv").addEventListener("click", function(e){
    if(e.target.closest("button,a,select,input")) return;
    var tr = e.target.closest("tr.itemrow"); if(!tr) return;
    var id = tr.dataset.invrow;
    if(openInv[id]) delete openInv[id]; else openInv[id] = 1;
    renderInventory();
  });
  document.getElementById("t-inv").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var tr = e.target.closest("tr.itemrow"); if(!tr) return;
    e.preventDefault(); tr.click();
  });

  /* ---------- فلاتر المشتريات ---------- */
  document.getElementById("b-pufilters").addEventListener("click", function(){
    var pnl = document.getElementById("pu-filters");
    pnl.hidden = !pnl.hidden;
    this.setAttribute("aria-expanded", String(!pnl.hidden));
  });
  ["pu-party","pu-item","pu-color","pu-size","pu-from","pu-to"].forEach(function(id){
    document.getElementById(id).addEventListener("change", function(){
      resetPage("purch"); renderPurch();
    });
  });
  document.getElementById("pu-text").addEventListener("input", function(){
    resetPage("purch"); renderPurch();
  });
  var PU_ID = { party:"pu-party", item:"pu-item", color:"pu-color",
                size:"pu-size", from:"pu-from", to:"pu-to", text:"pu-text" };
  document.getElementById("pu-chips").addEventListener("click", function(e){
    var rm = e.target.closest("[data-rmpu]");
    var clearOne = function(k){
      var el = document.getElementById(PU_ID[k]); if(el) el.value = ""; pufilt[k] = "";
    };
    if(rm){ clearOne(rm.dataset.rmpu); resetPage("purch"); renderPurch(); return; }
    if(e.target.id === "b-clear-pu"){
      Object.keys(PU_ID).forEach(clearOne);
      resetPage("purch"); renderPurch();
    }
  });

  /* ---------- صنف جديد من جوّه درج الشراء ---------- */
  var newItemFor = 0;      // السطر اللي هيتحط فيه الصنف الجديد

  function closeNewItem(){
    document.getElementById("newitem-box").hidden = true;
    ["ni-name","ni-price","ni-unit","ni-colors","ni-sizes"].forEach(function(x){
      document.getElementById(x).value = "";
    });
  }
  document.getElementById("b-newitem").addEventListener("click", function(){
    // السطر اللي لسه فاضي أولى بالصنف الجديد، وإلا آخر سطر
    var idx = pdraft.lines.findIndex(function(l){ return !l.itemId; });
    newItemFor = idx >= 0 ? idx : pdraft.lines.length - 1;
    var box = document.getElementById("newitem-box");
    box.hidden = false;
    document.getElementById("ni-name").focus();
    box.scrollIntoView({block:"nearest"});
  });
  document.getElementById("b-cancelitem2").addEventListener("click", closeNewItem);
  document.getElementById("b-saveitem2").addEventListener("click", function(){
    var name = squish(document.getElementById("ni-name").value);
    if(!name){ toast("اكتب اسم الصنف"); return; }
    var dup = live("items").find(function(x){ return squish(x.name) === name; });
    if(dup){ toast("فيه صنف بنفس الاسم — اختاره من القايمة"); return; }
    var rec = stamp({
      name: name,
      unit: document.getElementById("ni-unit").value.trim(),
      price: Number(document.getElementById("ni-price").value)||0,
      min: 0,
      colors: document.getElementById("ni-colors").value.trim(),
      sizes:  document.getElementById("ni-sizes").value.trim(),
      img: ""
    });
    db.items.push(rec);
    saveSoon("items");
    closeNewItem();

    var l = pdraft.lines[newItemFor] || pdraft.lines[pdraft.lines.length - 1];
    if(l){
      l.itemId = rec.id;
      l.mix = [newMix()];
    }
    renderAll();
    renderPLines();
    var sel = document.getElementById("pl-item-" + newItemFor);
    if(sel) sel.scrollIntoView({block:"nearest"});
    toast("اتضاف الصنف واتختار في السطر");
  });

  document.getElementById("b-pclear").addEventListener("click", function(){
    pdraft = newPDraft();
    editing.purchases = null; setEditUI("purchases");
    clearPOver(); syncPHead(); renderPLines(); renderPDraftNote();
    toast("اتفرّغت الفاتورة");
  });

  document.getElementById("b-addpline").addEventListener("click", function(){
    pdraft.lines.push(newPLine());
    renderPLines();
    var last = document.querySelector("#p-lines .lrow:last-child select[data-pf='itemId']");
    if(last) last.focus();
  });
  document.getElementById("p-lines").addEventListener("click", function(e){
    var pk = e.target.closest("[data-pack]");
    if(pk){
      var pp = pk.dataset.pack.split("|");
      var lp = pdraft.lines[Number(pp[0])];
      if(lp){
        lp.byPack = pp[1] === "1";
        lp.packCost = "";          // السعر بيتغيّر معناه، فمنخلّيهوش رقم قديم مضلّل
        if(!lp.byPack) lp.packs = "";
        var want = lp.byPack ? "pl-packs-"+pp[0] : "pl-pc-"+pp[0];
        setTimeout(function(){
          renderPLines();
          var f = document.getElementById(want);
          if(f) f.focus();
        }, 0);
      }
      return;
    }
    var add = e.target.closest("[data-addmix]");
    if(add){
      var la = pdraft.lines[Number(add.dataset.addmix)];
      if(la){ if(!la.mix) la.mix = []; la.mix.push(newMix()); renderPLines(); }
      return;
    }
    var rmx = e.target.closest("[data-rmmix]");
    if(rmx){
      var pr = rmx.dataset.rmmix.split("|");
      var lm = pdraft.lines[Number(pr[0])];
      if(lm && lm.mix){ lm.mix.splice(Number(pr[1]), 1); renderPLines(); }
      return;
    }
    var rm = e.target.closest("[data-rmpline]");
    if(!rm) return;
    pdraft.lines.splice(Number(rm.dataset.rmpline), 1);
    if(!pdraft.lines.length) pdraft.lines.push(newPLine());
    renderPLines();
  });
  function pLineEdit(e){
    var mx = e.target.closest("[data-pli][data-mi][data-mf]");
    if(mx){
      var lx = pdraft.lines[Number(mx.dataset.pli)];
      var m = lx && lx.mix && lx.mix[Number(mx.dataset.mi)];
      if(!m) return;
      m[mx.dataset.mf] = mx.value;
      renderPCalc();
      return;
    }
    var el = e.target.closest("[data-pli][data-pf]");
    if(!el) return;
    var l = pdraft.lines[Number(el.dataset.pli)];
    if(!l) return;
    var f = el.dataset.pf;
    l[f] = el.value;
    if(f === "itemId"){
      l.mix = [newMix()];        // صنف جديد = تفصيل جديد
      renderPLinesSoon();
    }
    else renderPCalc();
  }
  // كود التركيبة بيتحفظ وانت بتكتب
  ["t-vars","t-vars-rest"].forEach(function(tid){
  document.getElementById(tid).addEventListener("change", function(e){
    var el = e.target.closest("[data-vcode]");
    if(!el || !varsFor) return;
    var parts = el.dataset.vcode.split("|");
    setVCode(varsFor, parts[0], parts[1], el.value);
    var it = db.items.find(function(x){ return x.id===varsFor; });
    if(it){ it.at = Date.now(); it.editedBy = me || "غير محدد"; }
    saveSoon("items");
    if(pdraft && openEntryKey === "purchases") renderPLines();
    renderPurch();
    toast(el.value.trim() ? "اتسجّل الكود" : "اتشال الكود");
  });
  });

  document.getElementById("p-lines").addEventListener("input", pLineEdit);
  document.getElementById("p-lines").addEventListener("change", pLineEdit);
  /* رأس الفاتورة كان بيتقرا وقت الحفظ بس، فلما الدرج يتقفل ويتفتح
     تاني syncPHead كانت بتكتب فوق اللي اتكتب بقيم قديمة فاضية —
     نص المسودة يروح ونصها يفضل. دلوقتي كل خانة بتتحدّث وانت بتكتب. */
  ["p-date","p-party","p-inv","p-freight","p-paid","p-note"].forEach(function(id){
    var el = document.getElementById(id);
    var h = function(){
      if(!pdraft) return;
      if(id === "p-paid") pdraft.paidAuto = false;   // كتبت بإيدك — نسيب رقمك
      readPHead();
      clearPOver(); renderPCalc(); renderPDraftNote();
    };
    el.addEventListener("input", h);
    el.addEventListener("change", h);
  });

  // بيقول للمستخدم إنه بيكمّل مسودة، ويديله طريقة يفرّغها
  function pDraftDirty(){
    if(!pdraft || editing.purchases || pdraft.batchId) return false;
    if(pdraft.partyId || pdraft.inv || pdraft.note) return true;
    if(Number(pdraft.freight) || (!pdraft.paidAuto && Number(pdraft.paid))) return true;
    return pdraft.lines.some(function(l){
      return l.itemId || Number(l.packCost) || Number(l.packs) || mixPieces(l) > 0;
    });
  }
  function renderPDraftNote(){
    var el = document.getElementById("p-draft-note");
    if(!el) return;
    el.hidden = !pDraftDirty();
  }

  ["be-target","be-days"].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener("input", renderTarget);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".sn"), function(el){
    el.addEventListener("input", renderSens);
  });

  document.getElementById("c-type").addEventListener("change", fillSelects);
  // نوع المصروف: زرار واحد متعلّم. لو ما دوستش، النوع بيتخمّن من البيان وإنت بتكتب
  var CAT_HINT = {
    ads:"<strong>متغيّر</strong> — بيتقسم على الأوردرات في «الإعلان على الأوردر».",
    pack:"<strong>متغيّر</strong> — بيزيد مع كل أوردر.",
    trans:"<strong>على تكلفة البضاعة</strong> — بيتوزّع على القطع اللي في فواتير الشراء بتاعة نفس اليوم (أو لحد ٣ أيام قبل أو بعد). مشاوير تانية مالهاش علاقة بالشراء اختار لها «تاني».",
    subs:"<strong>ثابت</strong> — بيتدفع كل شهر مهما بعت.", salary:"<strong>ثابت</strong> — بيتدفع مهما بعت.",
    once:"<strong>ثابت</strong> — حاجة مش بتتكرر مع كل أوردر، حتى لو اشتريتها تاني بعدين.",
    other:"<strong>ثابت</strong>.",
    othervar:"<strong>متغيّر</strong> — متسجّل كده من قبل كده. لو تحب، اختار نوعه من فوق.",
    metatop:"<strong>رصيد مش مصروف</strong> — اللي دخل فيسبوك بيفضل رصيدك لحد ما الإعلانات تصرفه، وبيتحسب «إعلانات» أول بأول لما تطابق."
  };
  var catPicked = false;
  function syncCatChips(){
    var v = document.getElementById("c-cat").value;
    if(!v) catPicked = false;
    var shown = v || expCatGuess(document.getElementById("c-note").value);
    Array.prototype.forEach.call(document.querySelectorAll("#c-cats [data-ccat]"), function(b){
      b.classList.toggle("on", b.dataset.ccat === shown);
      b.setAttribute("aria-pressed", b.dataset.ccat === shown ? "true" : "false");
    });
    var h = document.getElementById("c-cat-hint");
    var sw = document.getElementById("c-src-wrap"), ss = document.getElementById("c-src");
    if(ss && !ss.options.length) ss.innerHTML = optsHTML(SRC.filter(function(x){ return SRC_AD[x[0]]; }).map(function(x){ return { v:x[0], t:x[1] }; }), "", "مش متحدد");
    if(sw) sw.hidden = shown !== "ads";
    if(h) h.innerHTML = shown ? CAT_HINT[shown] + (v ? "" : " <span style='color:var(--ink-soft)'>(اتعرف من البيان)</span>")
                              : "اختار النوع — ده اللي بيفرّق الإعلان والتغليف (متغيّر) عن الباقي (ثابت).";
    if(typeof syncExpExtra === "function"){ svcPicked = false; syncExpExtra(); }
  }
  document.getElementById("c-cats").addEventListener("click", function(e){
    var b = e.target.closest("[data-ccat]"); if(!b) return;
    document.getElementById("c-cat").value = b.dataset.ccat; catPicked = true; syncCatChips();
  });
  document.getElementById("c-note").addEventListener("input", function(){
    if(!catPicked) { document.getElementById("c-cat").value = ""; syncCatChips(); }
  });
  syncCatChips();

  bind("f-cash","b-cash", function(form){
    var fields = {
      date: document.getElementById("c-date").value || today(),
      type: document.getElementById("c-type").value,
      partyId: document.getElementById("c-party").value,
      amount: Number(document.getElementById("c-amount").value)||0,
      shipCo: document.getElementById("c-shipco").value,
      note: document.getElementById("c-note").value.trim()
    };
    /* v122 — نوع المصروف. ما اخترتش؟ بنعرفه من البيان، وإلا «تاني».
       costKind بيتسجّل جنبه (ثابت/متغيّر) عشان النسخ القديمة على أجهزة تانية تفهمه. */
    if(fields.type === "expense"){
      fields.cat = document.getElementById("c-cat").value || expCatGuess(fields.note) || "other";
      fields.costKind = EXP_CAT[fields.cat].kind === "var" ? "var" : "fixed";
      fields.src = fields.cat === "ads" ? document.getElementById("c-src").value : "";
      fields.camp = fields.cat === "ads" ? squish(document.getElementById("c-camp").value) : "";
      // v142: دفعه مين · المدة · اللي دخل فيسبوك
      fields.paidBy = document.getElementById("c-paidby").value || "";
      if(fields.cat === "metatop"){
        var crv = document.getElementById("c-credit").value;
        fields.credit = crv === "" ? "" : Math.round((Number(crv)||0) * 100) / 100; fields.svcDays = "";
        if(fields.credit !== "" && fields.credit > fields.amount + 0.009){ toast("اللي دخل فيسبوك أكتر من اللي دفعته"); return; }
        if(!editing.cash) fields.made = Date.now();                     // ترتيبها مع مطابقة نفس اليوم — التعديل ما بيغيّروش
      } else {
        var sd = Number(document.getElementById("c-svc").value)||1;
        fields.svcDays = fields.cat !== "trans" && sd !== svcDefault(fields.cat, fields.date) ? sd : ""; fields.credit = "";
      }
    } else { fields.cat = ""; fields.costKind = ""; fields.paidBy = ""; fields.svcDays = ""; fields.credit = ""; }
    if(!fields.amount){ toast("اكتب المبلغ"); return; }
    if(fields.type==="settle"){
      if(!fields.shipCo){ toast("اختر شركة الشحن"); return; }
      fields.partyId = "";
      var bal = walletOf(fields.shipCo);
      if(editing.cash){
        var old0 = db.cash.find(function(x){ return x.id===editing.cash; });
        if(old0 && old0.type==="settle" && (old0.shipCo||"")===fields.shipCo) bal += Number(old0.amount)||0;
      }
      if(fields.amount > bal + 0.009){
        toast(fields.shipCo + " محتفظة بـ " + money(bal) + " بس — مينفعش تسحب أكتر");
        return;
      }
    } else if(fields.type!=="expense" && !fields.partyId){ toast("اختر الجهة"); return; }
    if(!cashOutOk(fields)) return;
    commit("cash", fields, form, "اتسجّلت الحركة");
    document.getElementById("c-date").value = today();
    document.getElementById("c-cat").value = ""; syncCatChips();
    document.getElementById("c-src").value = ""; document.getElementById("c-camp").value = "";
    document.getElementById("c-paidby").value = ""; document.getElementById("c-credit").value = ""; svcPicked = false; creditPicked = false;
    clearOver(); fillSelects(); renderAll(); syncExpExtra();
  });

  /* ---------- حاجز الصرف بأكتر من رصيد الخزنة ---------- */
  function clearOver(){
    var box = document.getElementById("c-over"), f = document.getElementById("c-force");
    if(box) box.hidden = true;
    if(f) f.checked = false;
  }
  // الرصيد من غير الحركة اللي بنعدّلها — عشان التعديل ما يتحاسبش مرتين
  function cashWithoutEdited(){
    var bal = cashBox();
    if(!editing.cash) return bal;
    var o = db.cash.find(function(x){ return x.id === editing.cash; });
    if(!o) return bal;
    var a = Number(o.amount)||0;
    if(isCapType(o.type)) return bal - CAP[o.type].cash * a;
    if(o.type === "opening_party" || (o.type === "expense" && o.paidBy)) return bal;
    if(o.type === "in" || o.type === "settle" || o.type === "opening") return bal - a;
    return bal + a;
  }
  function cashOutOk(fields){
    if(fields.type !== "out" && fields.type !== "expense") return true;
    if(fields.paidBy) return true;                                        // v142: من جيب الشريك مش من الخزنة
    var bal = cashWithoutEdited();
    if(fields.amount <= bal + 0.009) return true;
    var f = document.getElementById("c-force");
    if(f && f.checked) return true;           // المستخدم أصرّ — بنسجّلها وبنسيب الخزنة بالسالب
    var msg;
    if(bal <= 0.009 && !totalCapital()){
      msg = "<strong>الخزنة فاضية.</strong> مفيش فلوس تدفع منها. أول خطوة في السيستم إنك تسجّل " +
            "<strong>رأس المال</strong> من تبويب «رأس المال» — الفلوس دي بتتحوّل للخزنة تلقائي، " +
            "وبعدين تدفع منها للموردين والمصاريف.";
    } else if(bal <= 0.009){
      msg = "<strong>الخزنة فاضية</strong> (رصيدها " + money(bal) + "). حصّل من العملاء، أو اسحب من " +
            "محفظة شركة الشحن، أو سجّل ضخّ رأس مال جديد — الأول.";
    } else {
      msg = "<strong>الخزنة فيها " + money(bal) + " بس</strong> وإنت بتصرف " + money(fields.amount) + "." +
            (walletsTotal() > 0.009
              ? " في " + money(walletsTotal()) + " عند شركات الشحن — اسحبهم بـ«سحب من شركة شحن» وهيدخلوا الخزنة."
              : " حصّل من العملاء أو سجّل ضخّ رأس مال الأول.");
    }
    var box = document.getElementById("c-over"), el = document.getElementById("c-over-msg");
    if(el) el.innerHTML = msg;
    if(box) box.hidden = false;
    toast("المبلغ أكبر من رصيد الخزنة");
    return false;
  }

  // البحث عن أوردر

  // أزرار إلغاء التعديل
  Object.keys(EDIT_UI).forEach(function(list){
    document.getElementById(EDIT_UI[list].cancel).addEventListener("click", function(){
      cancelEdit(list);
      if(openEntryKey === list) closeEntry();
    });
  });

  // تغيير حالة الأوردر من الجدول على طول
  document.body.addEventListener("change", function(e){
    var sel = e.target.closest("[data-status]");
    if(!sel) return;
    var rec = db.sales.find(function(x){ return x.id === sel.dataset.status; });
    if(!rec) return;
    if(!setSaleStatus(rec, sel.value)) sel.value = stOf(rec);
  });

  /* تغيير الحالة من أي مكان (القايمة في السطر · التفاصيل · زراير
     الخطوة) بيعدّي من هنا بس، عشان الحواجز كلها تشتغل في كل الأماكن. */
  function setSaleStatus(rec, next){
    var prev = stOf(rec);
    if(next === prev) return true;
    if(saleLocked(rec)){ toast("الأوردر ده في فترة مقفولة — مينفعش تتغيّر حالته"); return false; }
    if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return false; }
    var why = stepBlock(rec, next);
    if(why){ toast(why, 4200); return false; }
    // لو هيتحوّل لحالة بتخصم مخزون، اتأكد إن في رصيد
    if((next === "delivered" || next === "progress") && (prev === "proposed" || prev === "cancelled")){
      var needs = {}, short = null;
      SL(rec).forEach(function(l){
        var k = keyOf(l);
        needs[k] = (needs[k]||0) + (next === "delivered" ? ((Number(l.qty)||0) - lineRet(l)) : (Number(l.qty)||0));
      });
      Object.keys(needs).forEach(function(k){
        if(short || needs[k] <= 0) return;
        var parts = k.split("|");
        var av = freeOfV(parts[0], parts[1], parts[2]);
        if(needs[k] > av) short = itemName(parts[0]) + ": المتاح " + qty(av) + " بس";
      });
      if(short){ toast(short + " — سجّل شراء الأول"); return false; }
    }
    var paidBefore = Number(rec.paid)||0;
    rec.rsn = "";                                                     // سبب قديم ما يتنقلش للإلغاء الجديد
    if(next === "cancelled") rsnAsk = rec.id;                         // اسأل عن السبب فوق لوحة المراحل
    if(next !== "progress" && rec.cf === "nr"){ rec.cf = ""; rec.cfAt = ""; }
    rec.status = next; rec.editedBy = me || "غير محدد"; rec.at = Date.now();
    var shipLost = preCancelFix(rec);
    stampDelivery(rec);
    markShipQ(rec);                // اترفض مع شركة: اسأل العميل دفع كام من الشحن
    syncShipPaid(rec);             // أوردر الشركة: استلم = دفع للمندوب
    syncSelfPaid(rec, paidBefore); // توصيل بنفسك: استلم = دفع والفلوس دخلت الخزنة
    renderAll(); saveSoon("sales");
    var via = viaShip(rec), co = squish(rec.shipCo) || "شركة الشحن";
    // لما الملغي يرجع مسلّم، خانة المحصّل بتكون اتصفّرت وقت الإلغاء
    if(shipLost)
      toast("#" + (rec.no || "") + " رجع «" + (ST_LABEL[next] || next) + "» — " + SHIP_WIPED, 5200);
    else if(rec.preCancel && next === "cancelled")
      toast("#" + (rec.no || "") + " اتلغى قبل الشحن — من غير مصاريف شحن" + ((Number(rec.paid)||0) ? " · كان دافع " + money(Number(rec.paid)||0) + "، رجّعهوله من الخزنة" : ""), 4200);
    else if(!via && prev === "cancelled" && next === "delivered" && !(Number(rec.paid)||0))
      toast("الحالة بقت مسلّم — راجع خانة المحصّل من زرار تعديل");
    else if(via && next === "delivered")
      toast("العميل استلم ودفع " + money(Number(rec.paid)||0) + " لـ " + co +
            " — مش عليه حاجة خلاص · الفلوس دلوقتي عند " + co, 4200);
    else if(rec.selfDel && next === "delivered")
      toast("العميل استلم ودفع " + money(Number(rec.paid)||0) + (rec.courier ? " لـ" + rec.courier : "") +
            " — الفلوس دخلت الخزنة النهارده", 4200);
    else if(rec.selfDel && next === "cancelled")
      toast("العميل رفض الأوردر" + (shipIn(rec) ? " — الشحن " + money(shipIn(rec)) + " اتحسب إنه دفعه" +
            (rec.courier ? " لـ" + rec.courier : "") + "، لو ما دفعوش عدّل «شحن على العميل» لـ0" : "") +
            " · البضاعة رجعت المخزن", 5200);
    else if(via && next === "cancelled")
      toast("العميل رفض الأوردر" + (shipIn(rec) ? " ودفع الشحن " + money(shipIn(rec)) + " لـ " + co : "") +
            " — البضاعة لسه عند " + co + " لحد ما ترجعلك", 4200);
    else
      toast("الحالة بقت: " + saleStateTxt(rec));
    return true;
  }

  TSALES.addEventListener("click", function(e){
    var q = e.target.closest("[data-qpay]");
    if(q){ e.stopPropagation(); quickPay(q.dataset.qpay, false); return; }
    var a = e.target.closest("[data-qpayall]");
    if(a){ e.stopPropagation(); quickPay(a.dataset.qpayall, true); return; }
  }, true);
  // Enter جوّه خانة التحصيل = دوس «سجّل»
  TSALES.addEventListener("keydown", function(e){
    if(e.key !== "Enter") return;
    var box = e.target.closest("[data-qp]"); if(!box) return;
    e.preventDefault(); e.stopPropagation();
    quickPay(box.dataset.qp, false);
  });

  document.body.addEventListener("click", async function(e){
    var stmt = e.target.closest("[data-stmt]");
    if(stmt){
      // نفس الاسم تاني = اقفل. من غير كده الكشف بيفضل مفتوح ومفيش طريقة تقفله
      var same = statementFor === stmt.dataset.stmt;
      statementFor = same ? null : stmt.dataset.stmt;
      renderStatement(); renderParties();
      if(!same) document.getElementById("statement-panel").scrollIntoView({block:"nearest"});
      return;
    }
    var lb = e.target.closest("[data-label]");
    if(lb){ printLabel(lb.dataset.label); return; }
    // كود البوليصة بدوسة — عشان تلصقه في موقع شركة الشحن أو للعميل
    var cp = e.target.closest("[data-copy]");
    if(cp){
      e.stopPropagation();
      var txt = cp.dataset.copy, done = function(){ toast("اتنسخ: " + txt); };
      try{
        if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function(){ toast(txt); });
        else { var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
               document.execCommand("copy"); ta.remove(); done(); }
      }catch(err){ toast(txt); }
      return;
    }
    var rp = e.target.closest("[data-repeat]");
    if(rp){
      if(!canEdit()){ toast("مالكش صلاحية تضيف أوردرات"); return; }
      e.stopPropagation(); startRepeatSale(rp.dataset.repeat); return;
    }
    var ed = e.target.closest("[data-edit]");
    if(ed){
      var q = ed.dataset.edit.split("|");
      startEdit(q[0], q[1]);
      return;
    }
    var mv = e.target.closest("[data-move]");
    if(mv){
      moveFor = (moveFor === mv.dataset.move) ? null : mv.dataset.move;
      renderMovement();
      if(moveFor) document.getElementById("move-panel").scrollIntoView({block:"nearest"});
      return;
    }
    var vr = e.target.closest("[data-vars]");
    if(vr){
      varsFor = (varsFor === vr.dataset.vars) ? null : vr.dataset.vars;
      offersFor = null;
      renderVars(); renderOffers();
      if(varsFor) document.getElementById("vars-panel").scrollIntoView({block:"nearest"});
      return;
    }
    var off = e.target.closest("[data-offers]");
    if(off){
      offersFor = (offersFor === off.dataset.offers) ? null : off.dataset.offers;
      renderOffers();
      if(offersFor) document.getElementById("offers-panel").scrollIntoView({block:"nearest"});
      return;
    }
    var tier = e.target.closest("[data-tier]");
    if(tier){
      var parts = tier.dataset.tier.split("|");
      var itm = db.items.find(function(x){ return x.id===parts[0]; });
      if(itm){
        itm.tiers = (itm.tiers||[]).filter(function(t){ return String(t.q) !== parts[1]; });
        itm.at = Date.now();
        renderAll(); toast("اتحذف العرض"); saveSoon("items");
      }
      return;
    }
    var d = e.target.closest("[data-del]");
    if(!d) return;
    if(d.dataset.armed !== "1"){          // تأكيد من خطوتين بدل نافذة المتصفح
      var label = d.textContent;
      d.dataset.armed = "1";
      d.textContent = "تأكيد؟";
      setTimeout(function(){
        if(d.dataset.armed === "1"){ d.dataset.armed = ""; d.textContent = label; }
      }, 4000);
      return;
    }
    var list = d.dataset.del, id = d.dataset.id;
    var rec = db[list].find(function(x){ return x.id===id; });
    if(!rec) return;
    var locked = (list === "sales") ? saleLocked(rec) : isLocked(rec.date);
    if(locked){ toast("السجل ده في فترة مقفولة — مينفعش يتحذف"); return; }
    var block = deleteBlock(list, rec);
    if(block){
      d.dataset.armed = ""; d.textContent = "حذف";
      toast(block); return;
    }

    // التوزيع حركتين لكل شريك (استحقاق + صرف). مسح واحدة بتسيب التانية
    // يتيمة وبتخلي الأرباح المستحقة سالبة، فبيتحذف كوحدة واحدة.
    var group = [rec];
    if(list === "cash" && rec.distId){
      group = live("cash").filter(function(x){ return x.distId === rec.distId; });
    }
    // الفاتورة كذا سجل بنفس batchId — حذف سطر لوحده بيسيب النقل والمدفوع مقسومين غلط
    if(list === "purchases" && rec.batchId){
      group = live("purchases").filter(function(x){ return x.batchId === rec.batchId; });
    }
    var now = Date.now();
    group.forEach(function(r){ r.deleted = true; r.at = now; });
    renderAll(); saveSoon(list);
    toast(group.length > 1
      ? (list === "purchases" ? "اتحذفت الفاتورة كاملة (" + qty(group.length) + " صنف)"
                              : "اتحذف التوزيع كامل (" + qty(group.length) + " حركة)")
      : "اتحذف");
  });

  document.getElementById("me").addEventListener("change", async function(){
    me = this.value.trim();
    saveMe();
  });

  // ---------- الوضع الليلي ----------
  function applyTheme(t){
    if(t === "dark") document.documentElement.setAttribute("data-theme","dark");
    else document.documentElement.removeAttribute("data-theme");
    var b = document.getElementById("b-theme");
    if(b) b.textContent = (t === "dark") ? "نهاري" : "ليلي";
    if(LS){ try{ LS.setItem("naya:theme", t); }catch(e){} }
  }
  document.getElementById("b-theme").addEventListener("click", function(){
    var now = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(now);
  });

