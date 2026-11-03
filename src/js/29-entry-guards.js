  /* ---------- إدخال ---------- */
  // الربط على ضغط الزرار وعلى Enter — من غير الاعتماد على إرسال الفورم
  function bind(formId, btnId, fn){
    var form = document.getElementById(formId);
    var btn  = document.getElementById(btnId);
    btn.addEventListener("click", function(e){ e.preventDefault(); fn(form); });
    form.addEventListener("submit", function(e){ e.preventDefault(); fn(form); });
    form.addEventListener("keydown", function(e){
      if(e.key === "Enter" && e.target.tagName !== "TEXTAREA"){ e.preventDefault(); fn(form); }
    });
  }

  // ---------- التعديل على الحركات ----------
  var editing = { items:null, parties:null, sales:null, purchases:null, cash:null };

  /* ---------- حاجز التعديل المتزامن ----------
     المزامنة بتفضّل الأحدث بالوقت. لو إنت فاتح أوردر وموظف عدّله من
     جهازه في نفس الوقت، تعديله بيوصلك في الخلفية — وأول ما تحفظ إنت،
     نسختك بتدهس نسخته من غير ما حد ياخد باله.
     الحل: بنفتكر الـat اللي فتحت عليه السجل، ولو اتغيّر وقت الحفظ
     بنوقف ونقول اتغيّر من مين. تاني ضغطة على حفظ = «أنا متأكد». */
  var editBase = {};        // list → الـat وقت الفتح
  var overwriteArm = {};    // list → وقت آخر تحذير

  function markEditBase(list, rec){ editBase[list] = rec ? (Number(rec.at)||0) : 0; }
  function clearEditBase(list){ delete editBase[list]; delete overwriteArm[list]; }

  function whoTxt(rec){ return squish(rec && rec.editedBy) || "جهاز تاني"; }
  function agoTxt(ts){
    var m = Math.round((Date.now() - (Number(ts)||0)) / 60000);
    if(m < 1) return "دلوقتي";
    if(m < 60) return "من " + plural(m, "دقيقة", "دقيقتين", "دقايق");
    var h = Math.round(m/60);
    if(h < 24) return "من " + plural(h, "ساعة", "ساعتين", "ساعات");
    return "من " + plural(Math.round(h/24), "يوم", "يومين", "أيام");
  }

  // بترجّع true يعني كمّل الحفظ
  function staleCheck(list, rec){
    if(!rec) return true;
    var base = editBase[list];
    if(base == null) return true;                 // مش في وضع تعديل متتبّع
    if((Number(rec.at)||0) <= base) return true;  // ما اتغيّرش من ساعة ما فتحته
    if(overwriteArm[list] && Date.now() - overwriteArm[list] < 12000){
      overwriteArm[list] = 0;                     // أكّد إنه عايز نسخته
      return true;
    }
    overwriteArm[list] = Date.now();
    var msg = "«" + whoTxt(rec) + "» عدّل ده " + agoTxt(rec.at) +
      " وإنت فاتحه. اضغط حفظ تاني لو نسختك هي الصح، أو اقفل وافتحه من جديد.";
    toast(msg, 9000);
    var line = (list === "sales") ? document.getElementById("e-conflict") : null;
    if(line){ line.textContent = msg; line.hidden = false; }
    return false;
  }

  /* الأفضل إنك تعرف وإنت لسه بتكتب مش وقت الحفظ: لو المزامنة جابت
     نسخة أحدث للسجل اللي إنت فاتحه، بنقول على طول. */
  function warnIfOpenChanged(){
    if(!editing.sales || editBase.sales == null) return;
    var rec = db.sales.find(function(x){ return x.id === editing.sales; });
    if(!rec || (Number(rec.at)||0) <= editBase.sales) return;
    var line = document.getElementById("e-conflict");
    var msg = "«" + whoTxt(rec) + "» عدّل الأوردر ده " + agoTxt(rec.at) +
      " من جهاز تاني وإنت فاتحه. لو حفظت هتدهس تعديله.";
    if(line && line.hidden){ line.textContent = msg; line.hidden = false; toast(msg, 9000); }
  }

  var EDIT_UI = {
    items:   { btn:"b-item",  cancel:"x-item",  add:"إضافة صنف",  save:"حفظ التعديل", tab:"items",   form:"f-item"  },
    // v129: كان "x-party" — نفس id قايمة الموردين في الاستبدال، فإخفاء زرار الإلغاء كان بيخفي القايمة
    parties: { btn:"b-party", cancel:"x-pty", add:"إضافة",      save:"حفظ التعديل", tab:"parties", form:"f-party" },
    purchases:{btn:"b-purch", cancel:"x-purch", add:"حفظ الشراء", save:"حفظ التعديل", tab:"purch",   form:"f-purch" },
    cash:    { btn:"b-cash",  cancel:"x-cash",  add:"حفظ الحركة", save:"حفظ التعديل", tab:"cash",    form:"f-cash"  }
  };

  function setEditUI(list){
    var ui = EDIT_UI[list], on = !!editing[list];
    document.getElementById(ui.btn).textContent = on ? ui.save : ui.add;
    document.getElementById(ui.cancel).hidden = !on;
    var f = document.getElementById(ui.form);
    var inDrawer = !!f.closest(".panel.as-drawer");
    f.style.outline = (on && !inDrawer) ? "2px solid var(--teal)" : "";
    f.style.outlineOffset = (on && !inDrawer) ? "8px" : "";
  }

  function cancelEdit(list){
    editing[list] = null; clearEditBase(list);
    if(list === "items") showImgPreview("");
    document.getElementById(EDIT_UI[list].form).reset();
    if(list==="purchases"){ pdraft = newPDraft(); clearPOver(); syncPHead(); renderPLines(); }
    if(list==="cash"){ document.getElementById("c-date").value = today(); document.getElementById("c-cat").value = ""; syncCatChips(); fillSelects(); }
    setEditUI(list);
  }

  function goTab(tab){
    var btn = navGoBtn(tab);
    if(btn) btn.click();
  }
  // الإعدادات وسجل الحركات من قايمة الاسم · مفتاح الأصناف/التسعير
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-navgo]"); if(!b) return;
    if(b.closest("#me-menu")) meMenu(false);
    goTab(b.dataset.navgo);
  });

  function startEdit(list, id){
    if(list === "sales"){ startEditSale(id); return; }
    var rec = db[list].find(function(x){ return x.id===id; });
    if(!rec) return;
    // الاستبدال ليه درجه — مش فورم الشراء
    if(list === "purchases" && rec.xchg){ openXchg({ editId:rec.xchg }); return; }
    editing[list] = id;
    markEditBase(list, rec);
    var g = function(i){ return document.getElementById(i); };
    if(list==="items"){ g("i-name").value=rec.name||""; g("i-unit").value=rec.unit||"";
      g("i-price").value=rec.price||0; g("i-min").value=rec.min||0;
      g("i-colors").value=rec.colors||""; g("i-sizes").value=rec.sizes||"";
      g("i-img").value=rec.img||""; showImgPreview(rec.img||""); }
    if(list==="parties"){ g("pt-name").value=rec.name||""; g("pt-type").value=rec.type||"customer";
      g("pt-phone").value=rec.phone||""; g("pt-gov").value=rec.gov||"";
      g("pt-address").value=rec.address||""; g("pt-fb").value=rec.fb||""; g("pt-note").value=rec.note||""; }
    if(list==="purchases"){
      // الفاتورة كلها بترجع للدرج، مش السطر اللي دوست عليه بس
      var grp = rec.batchId
        ? live("purchases").filter(function(x){ return x.batchId === rec.batchId; })
                           .sort(function(a,b){ return (a.at||0) - (b.at||0); })
        : [rec];
      // السجلات بترجع أسطر: اللي بنفس lineId سطر واحد بتفصيل مقاساته
      var byLine = {}, order = [];
      grp.forEach(function(x){
        var k = x.lineId || ("solo:" + x.id);
        if(!byLine[k]){
          byLine[k] = { itemId:x.itemId||"",
                        byPack: x.byPack != null ? !!x.byPack : (pPackQty(x) > 1),
                        packs:pPacks(x), packQty:pPackQty(x), packCost:pPackCost(x),
                        lineId: x.lineId || "", mix:[] };
          order.push(k);
        }
        byLine[k].mix.push({ color:x.color||"", size:x.size||"", qty:Number(x.qty)||0 });
      });
      pdraft = {
        date: rec.date || today(), partyId: rec.partyId || "", inv: rec.inv || "",
        freight: grp.reduce(function(a,x){ return a + pFreight(x); }, 0),
        paid:    grp.reduce(function(a,x){ return a + (Number(x.paid)||0); }, 0),
        note: rec.note || "", batchId: rec.batchId || "",
        lines: order.map(function(k){
          var l = byLine[k];
          if(!l.mix.length) l.mix = [newMix()];
          return l;
        })
      };
      // كانت مدفوعة كلها؟ المدفوع يفضل ماشي ورا البضاعة لو غيّرت الكميات أو الأسعار.
      // مدفوع جزء بس؟ يفضل الرقم اللي كان مكتوب زي ما هو.
      var eg = pdGoods();
      pdraft.paidAuto = eg > 0.009 && Math.abs(pdraft.paid - eg) < 0.01;
      // فاتورة قديمة من غير batchId: نديها واحد عشان التعديل يفضل وحدة واحدة
      if(!pdraft.batchId){ pdraft.batchId = rec.batchId = uid(); }
      clearPOver(); syncPHead(); renderPLines();
    }
    if(list==="cash"){
      g("c-date").value=rec.date||today(); g("c-type").value=rec.type||"in"; fillSelects();
      g("c-party").value=rec.partyId||""; g("c-amount").value=rec.amount||""; g("c-note").value=rec.note||"";
      g("c-cat").value = rec.type === "expense" ? expCat(rec) : ""; syncCatChips(); catPicked = rec.type === "expense";
      g("c-src").value = rec.src || ""; g("c-camp").value = rec.camp || "";
      syncExpExtra(); g("c-paidby").value = rec.paidBy || "";
      creditPicked = rec.credit !== "" && rec.credit != null; g("c-credit").value = creditPicked ? rec.credit : "";
      svcPicked = !!rec.svcDays; g("c-svc").value = String(Number(rec.svcDays) || svcDefault(expCat(rec), rec.date)); syncExpExtra();
      fillSelects(); g("c-shipco").value=rec.shipCo||"";
    }
    setEditUI(list);
    goTab(EDIT_UI[list].tab);
    if(ENTRY[list]) openEntry(list);
    else document.getElementById(EDIT_UI[list].form).scrollIntoView({block:"center"});
    toast("بتعدّل حركة موجودة");
  }

  // بيحفظ جديد أو بيعدّل القديم حسب الحالة
  var freshId = null;        // آخر سجل اتحفظ — بيتلوّن لحظة في الجدول
  var freshBatch = null;     // وآخر فاتورة شراء
  var savedId = null;

  function commit(list, fields, form, addMsg){
    var id = editing[list];
    // حاجز الإقفال — مركزي لكل القوايم اللي بتعدي من هنا (مشتريات، خزنة، أصناف، جهات)
    if(fields.date && !guardLock(fields.date, "الحركة")) return;
    if(id){
      var prev = db[list].find(function(x){ return x.id===id; });
      if(prev && prev.date && isLocked(prev.date)){
        toast("السجل ده في فترة مقفولة — مينفعش يتعدّل"); return;
      }
    }
    if(id){
      var rec = db[list].find(function(x){ return x.id===id; });
      if(!staleCheck(list, rec)) return;
      if(rec){
        Object.keys(fields).forEach(function(k){ rec[k] = fields[k]; });
        rec.editedBy = me || "غير محدد";
        rec.at = Date.now();
      }
      savedId = id;
      editing[list] = null; clearEditBase(list);
      setEditUI(list);
      toast("اتعدّلت الحركة");
    } else {
      var rec2 = stamp(fields);
      db[list].push(rec2);
      savedId = rec2.id;
      toast(addMsg);
    }
    form.reset();
    saveSoon(list);
    if(openEntryKey === list) closeEntry();
  }

  /* ---------- حاجز الحذف اللي بيكسر الميزانية ----------
     الصنف أو الجهة بيتشالوا من live() فبيختفوا من صافي الأصول، بس
     الفلوس اللي اتصرفت عليهم والأوردرات بتاعتهم بتفضل مسجّلة.
     النتيجة: صافي الأصول ≠ حقوق الملكية من غير ما حد ياخد باله. */
  // «٩ حركة» غلط — العربي بيفرّق بين المفرد والمثنى والجمع
  function plural(n, one, two, few){
    n = Math.abs(Number(n)||0);
    if(n === 1) return one;
    if(n === 2) return two;
    if(n >= 3 && n <= 10) return qty(n) + " " + few;
    return qty(n) + " " + one;
  }
  function nMoves(n){ return plural(n, "حركة", "حركتين", "حركات"); }

  function itemMoves(id){
    var n = live("purchases").filter(function(x){ return x.itemId === id; }).length;
    live("sales").forEach(function(sx){
      if(SL(sx).some(function(l){ return l.itemId === id; })) n++;
    });
    return n;
  }
  function partyMoves(id){
    var n = 0;
    live("sales").forEach(function(x){ if(x.partyId === id) n++; });
    live("purchases").forEach(function(x){ if(x.partyId === id) n++; });
    live("cash").forEach(function(x){ if(x.partyId === id) n++; });
    return n;
  }
  function deleteBlock(list, rec){
    if(list === "items"){
      var n = itemMoves(rec.id);
      if(n) return "«" + (rec.name||"الصنف") + "» عليه " + nMoves(n) +
        " — حذفه هيبوّظ أرقام المخزون والأرباح. سيبه، رصيده صفر مش هيزعجك.";
    }
    if(list === "parties"){
      var m = partyMoves(rec.id);
      if(m) return "«" + (rec.name||"الجهة") + "» عليها " + nMoves(m) +
        " — حذفها هيضيّع رصيدها من الميزانية. سيبها في الكشف.";
    }
    return "";
  }

  function stamp(o){ o.id = uid(); o.by = me || "غير محدد"; o.at = Date.now(); return o; }

  bind("f-item","b-item", function(form){
    var name = squish(document.getElementById("i-name").value);
    if(!name){ toast("اكتب اسم الصنف"); return; }
    // صنفين بنفس الاسم بيخلّوا كل القوايم ملخبطة ومحدش يعرف يختار الصح
    var dupI = live("items").find(function(x){
      return x.id !== editing.items && squish(x.name) === name; });
    if(dupI){ toast("فيه صنف بنفس الاسم — اختاره من القايمة أو غيّر الاسم"); return; }
    commit("items", { name:name, unit:document.getElementById("i-unit").value.trim(),
      price:Number(document.getElementById("i-price").value)||0,
      min:Number(document.getElementById("i-min").value)||0,
      colors:document.getElementById("i-colors").value.trim(),
      sizes:document.getElementById("i-sizes").value.trim(),
      img:document.getElementById("i-img").value.trim() }, form, "اتضاف الصنف");
    showImgPreview("");
    renderAll();
  });

  function offerQty(){ return Number(document.getElementById("o-qty").value)||0; }
  document.getElementById("o-unit").addEventListener("input", function(){
    var q = offerQty(), u = Number(this.value);
    document.getElementById("o-total").value = (q && this.value !== "") ? +(u*q).toFixed(2) : "";
  });
  document.getElementById("o-total").addEventListener("input", function(){
    var q = offerQty(), t = Number(this.value);
    document.getElementById("o-unit").value = (q && this.value !== "") ? +(t/q).toFixed(2) : "";
  });
  document.getElementById("o-qty").addEventListener("input", function(){
    var q = offerQty(), t = Number(document.getElementById("o-total").value);
    if(q && document.getElementById("o-total").value !== "")
      document.getElementById("o-unit").value = +(t/q).toFixed(2);
  });

  document.getElementById("b-savevars").addEventListener("click", function(){
    var it = db.items.find(function(x){ return x.id===varsFor; });
    if(!it) return;
    it.colors = document.getElementById("v-colors").value.trim();
    it.sizes  = document.getElementById("v-sizes").value.trim();
    it.at = Date.now(); it.editedBy = me || "غير محدد";
    renderAll();
    lineRows().forEach(function(row){ fillRowVariants(row); });
    if(pdraft && openEntryKey === "purchases") renderPLines();
    if(editing.items === it.id){
      document.getElementById("i-colors").value = it.colors || "";
      document.getElementById("i-sizes").value  = it.sizes  || "";
    }
    toast("اتحفظت الألوان والمقاسات"); saveSoon("items");
  });

  document.getElementById("b-offer").addEventListener("click", function(){
    var it = db.items.find(function(x){ return x.id===offersFor; });
    if(!it) return;
    var q = offerQty(), u = Number(document.getElementById("o-unit").value);
    if(q < 2){ toast("العرض يبدأ من قطعتين على الأقل"); return; }
    if(!u && u !== 0){ toast("اكتب سعر القطعة أو إجمالي العرض"); return; }
    it.tiers = (it.tiers||[]).filter(function(t){ return Number(t.q) !== q; });
    it.tiers.push({ q:q, u:u });
    it.at = Date.now();
    document.getElementById("o-unit").value = "";
    document.getElementById("o-total").value = "";
    document.getElementById("o-qty").value = q + 1;
    renderAll(); toast("اتضاف العرض"); saveSoon("items");
  });

  bind("f-party","b-party", function(form){
    var name = squish(document.getElementById("pt-name").value);
    if(!name){ toast("اكتب الاسم"); return; }
    var phone = document.getElementById("pt-phone").value.trim();
    if(phone && !editing.parties){
      var dup = live("parties").find(function(x){ return (x.phone||"").trim() === phone; });
      if(dup){ toast("التليفون ده مسجّل بالفعل باسم: " + dup.name); return; }
    }
    commit("parties", { name:name, type:document.getElementById("pt-type").value,
      phone:phone,
      gov:document.getElementById("pt-gov").value,
      address:document.getElementById("pt-address").value.trim(),
      fb:document.getElementById("pt-fb").value.trim(),
      note:document.getElementById("pt-note").value.trim() }, form, "اتضاف الاسم");
    renderAll();
  });

  /* ================= تشغيل سطر الإدخال ================= */
  var TSALES = document.getElementById("t-sales");

  function availOfKey(k){
    var parts = k.split("|");
    var av = freeOfV(parts[0], parts[1], parts[2]);
    if(editing.sales){
      var rec = db.sales.find(function(x){ return x.id === editing.sales; });
      if(rec) SL(rec).forEach(function(l){ if(keyOf(l) === k) av += lineNeed(l, rec); });
    }
    return av;
  }

  // الصنف اللي ليه ألوان أو مقاسات لازم يتحدد قبل الحفظ
  function variantMissing(itemId, color, size){
    var it = db.items.find(function(x){ return x.id===itemId; });
    if(!it) return "";
    var c = (color||"").trim(), z = (size||"").trim();
    var needC = listOf(it,"colors").length && !c;
    var needZ = listOf(it,"sizes").length  && !z;
    if(!needC && !needZ) return "";
    if(!c && !z && stockOfV(itemId,"","") > 0) return "";
    return needC ? "اختر اللون الأول" : "اختر المقاس الأول";
  }

  // أي كتابة في الدرج بتروح للمسوّدة على طول
  SD.addEventListener("input", onEntryEdit);
  SD.addEventListener("change", onEntryEdit);
  SD.addEventListener("click", function(e){
    var b = e.target.closest("[data-cf],[data-rsn],#e-wa"); if(!b) return;
    if(b.id === "e-wa"){
      var p = db.parties.find(function(x){ return x.id === draft.partyId; }) || {};
      var tot = draft.lines.reduce(function(a, l){ return a + (Number(l.qty)||0) * (Number(l.price)||0); }, 0) + (Number(draft.shipIn)||0);
      b.href = "https://wa.me/" + waNum(p.phone) + "?text=" + encodeURIComponent(waConfirmText({ partyId:draft.partyId, lines:draft.lines }, tot));
      return;                                                        // الرابط بيفتح في تاب جديد
    }
    if(b.dataset.cf !== undefined){ draft.cf = b.dataset.cf; draft.cfAt = b.dataset.cf ? today() : ""; }
    else draft.rsn = draft.rsn === b.dataset.rsn ? "" : b.dataset.rsn;
    syncSrcUI();
  });

  function onEntryEdit(e){
    var el = e.target;
    if(!el.dataset || !el.dataset.f) return;
    var f = el.dataset.f, v = el.value;
    if(el.dataset.li !== undefined && el.dataset.li !== ""){
      var l = draft.lines[Number(el.dataset.li)];
      if(!l) return;
      if(f === "price") l.manual = true;
      l[f] = v;
      if(f === "itemId" || f === "color" || f === "size"){ l.unitCost = null; l.trCost = null; }
      if(f === "itemId"){ l.color = ""; l.size = ""; l.manual = false; }
      // أول ما تختار صنف، الكمية الغالبة ١ — بدل ما تكتبها في كل سطر
      if(f === "itemId" && v && !String(l.qty||"").trim()) l.qty = 1;
      // اللون كمان: اللون اللي ليه سعر خاص بيتكتب سعره أول ما تختاره
      if(f === "itemId" || f === "qty" || f === "color") applyDraftTier(l);
      // الصنف بيغيّر قوايم اللون والمقاس، فسطور الأصناف بس هي اللي بتتبني تاني
      if(f === "itemId"){ renderDrawerLines(); return; }
      if(f === "color" || f === "size") refreshVariantOpts(Number(el.dataset.li));
    } else {
      var prev = draft[f];
      draft[f] = v;
      if(f === "src" || f === "status" || f === "partyId") syncSrcUI();
      if(f === "status"){ renderDrawerLines(); return; }  // المرتجع بيظهر ويختفي مع الحالة
      // أول ما اسم شركة الشحن يتكتب في خانة فاضية → التحصيل عن طريقها
      if(f === "shipCo" && !squish(prev || "") && squish(v)) autoPayViaShip();
      if(f === "partyId"){ suggestShipping(); shipHint(); }
      if(f === "shipIn" || f === "shipOut") shipHint();
      if(f === "payVia" || f === "paid" || f === "note") syncMore();
    }
    updateEntryCalc();
  }
  function applyDraftTier(l){
    var it = db.items.find(function(x){ return x.id === l.itemId; });
    if(!it || l.manual) return;
    var t = priceFor(it, l.color, Number(l.qty)||1);
    l.price = t.u || "";
    var el = document.querySelector("#e-lines [data-f='price'][data-li='"+draft.lines.indexOf(l)+"']");
    if(el) el.value = l.price;
  }
