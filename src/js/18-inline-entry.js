  /* ================= الإدخال جوه الجدول ================= */
  // مسوّدة الأوردر اللي بتتكتب دلوقتي — بتتحدّث مع كل ضغطة زرار
  var draft = null;
  function blankLine(){ return { itemId:"", color:"", size:"", qty:"", price:"", ret:"", manual:false }; }
  function newDraft(keep){
    return { date: firstOpenDate(), status:"progress", partyId:"", owner: me || "",
             shipCo: keep ? keep.shipCo : "", shipCode:"",
             // توصيل بنفسك: الاختيار والاسم بيفضلوا للأوردر اللي بعده زي شركة الشحن
             selfDel: keep ? !!keep.selfDel : false, courier: keep ? (keep.courier || "") : "",
             shipIn:"", shipOut:"", payVia: keep ? keep.payVia : "ship",
             paid:"", note:"", src:"", camp:"", cf:"", cfAt:"", rsn:"", lines:[ blankLine() ] };
  }
  /* «كرّر الأوردر»: نفس العميل ونفس الأصناف، بس الحاجات اللي بتخص
     المرة اللي فاتت بتتشال — التاريخ والحالة وكود البوليصة والمحصّل
     والمرتجع والتكلفة المثبّتة. السعر بيتنقل زي ما هو عشان العميل
     مستنّي نفس السعر، ولو اتغيّر في قايمة الأصناف بيظهر سطر بيقول كده. */
  function draftRepeat(rec){
    var d = draftFrom(rec);
    d.date     = firstOpenDate();
    d.status   = "progress";
    d.shipCode = "";
    d.paid     = "";
    d.note     = "";
    d.src = "old"; d.camp = ""; d.cf = ""; d.cfAt = ""; d.rsn = "";   // تكرار الأوردر = عميل قديم
    d.lines = d.lines.map(function(l){
      return { itemId:l.itemId, color:l.color, size:l.size,
               qty:l.qty, price:l.price, ret:"", manual:true };
    });
    d.fromNo = rec.no || "";
    return d;
  }
  // الأسعار اللي اتغيّرت في قايمة الأصناف من ساعة الأوردر ده
  function repeatPriceDiffs(d){
    var out = [];
    (d.lines||[]).forEach(function(l){
      var it = db.items.find(function(x){ return x.id === l.itemId; });
      if(!it) return;
      var now = Number(priceFor(it, l.color, Number(l.qty)||1).u)||0, was = Number(l.price)||0;
      if(now > 0 && was > 0 && Math.abs(now - was) > 0.009)
        out.push(itemName(l.itemId) + " " + money(was) + " ← " + money(now));
    });
    return out;
  }
  function draftFrom(rec){
    return { date: rec.date || today(), status: stOf(rec), partyId: rec.partyId || "",
             owner: rec.owner || "", shipCo: rec.shipCo || "", shipCode: rec.shipCode || "",
             selfDel: !!rec.selfDel, courier: rec.courier || "",
             shipIn: rec.shipIn || "", shipOut: rec.shipOut || "", payVia: payVia(rec),
             paid: rec.paid || "", note: rec.note || "",
             src: rec.src || "", camp: rec.camp || "", cf: rec.cf || "", cfAt: rec.cfAt || "", rsn: rec.rsn || "",
             lines: SL(rec).map(function(l){
               return { itemId:l.itemId||"", color:vColor(l), size:vSize(l),
                        qty:Number(l.qty)||"", price:Number(l.price)||"",
                        ret:Number(l.ret)||"", manual:true,
                        unitCost: l.unitCost, trCost: l.trCost };      // التكلفة المثبّتة (ونصيب الانتقالات) بتعدّي مع التعديل
             }) };
  }
  draft = newDraft();

  function optsHTML(list, sel, ph){
    return '<option value="">'+esc(ph)+'</option>' + list.map(function(o){
      return '<option value="'+esc(o.v)+'"'+(String(o.v)===String(sel)?' selected':'')+'>'+esc(o.t)+'</option>';
    }).join("");
  }
  /* المتاح لتركيبة — لو سبت اللون أو المقاس فاضي بيجمع كل اللي بيطابق.
     بيستعمل availOfKey عشان الأوردر اللي بتعدّله ما يحسبش على نفسه. */
  function comboAvail(itemId, color, size){
    var c = squish(color), z = squish(size), seen = {}, out = 0;
    variantsOf(itemId).forEach(function(v){
      if(c && squish(v.color) !== c) return;
      if(z && squish(v.size)  !== z) return;
      var k = vKey(itemId, v.color, v.size);
      if(seen[k]) return;
      seen[k] = 1; out += availOfKey(k);
    });
    return out;
  }
  function availTag(n){ return n > 0 ? " — متاح " + qty(n) : " — خلصان"; }

  /* اللون والمقاس بيتفلتروا على بعض. لو إنت واقف على «بني» والمقاس ٣٩
     عندك في «أسود» بس، كلمة «خلصان» بتبقى كذبة — عندك ٣٩ فعلاً.
     دي بترجّع الاتجاه التاني اللي المقاس (أو اللون) ده موجود فيه. */
  function whereElse(itemId, f, v){
    var out = [];
    variantsOf(itemId).forEach(function(x){
      var mine  = f === "size" ? x.size  : x.color;
      var other = f === "size" ? x.color : x.size;
      if(squish(mine) !== squish(v) || !other) return;
      if(comboAvail(itemId, x.color, x.size) <= 0) return;
      if(out.indexOf(other) < 0) out.push(other);
    });
    return out;
  }
  // نص خيار واحد في قايمة اللون أو المقاس، وهو عارف اللي متحدد في القايمة التانية
  function vOptLabel(itemId, f, v, other){
    var n = f === "color" ? comboAvail(itemId, v, other) : comboAvail(itemId, other, v);
    if(n > 0) return v + " — متاح " + qty(n);
    if(!squish(other)) return v + " — خلصان";
    var els = whereElse(itemId, f, v);
    if(!els.length) return v + " — خلصان";
    // الخانة ضيقة والنص بيتقص، فالمختصر أوضح: «٤٠ — في أسود»
    return v + " — في " + els.slice(0,2).join(" و") + (els.length > 2 ? " وغيرهم" : "");
  }
  // «عندك دلوقتي» — التركيبات اللي فيها رصيد فعلاً، بتجاوب على السؤال قبل ما يتسأل
  function stockLine(itemId){
    var parts = [];
    variantsOf(itemId).forEach(function(x){
      var n = comboAvail(itemId, x.color, x.size);
      if(n <= 0) return;
      var lb = [squish(x.color), squish(x.size)].filter(Boolean).join(" ");
      parts.push((lb || "من غير لون ولا مقاس") + " ×" + qty(n));
    });
    if(!parts.length) return "";
    return "عندك: " + parts.slice(0,6).join(" · ") +
           (parts.length > 6 ? " · و" + qty(parts.length - 6) + " غيرهم" : "");
  }

  // في البيع مهم تعرف المتاح. في الشراء الرقم ده مالوش لازمة وبيلخبط.
  function itemOptionsHTML(sel, plain){
    return optsHTML(live("items").map(function(o){
      if(plain) return { v:o.id, t:o.name };
      return { v:o.id, t:o.name + availTag(comboAvail(o.id,"","")) };
    }), sel, "اختر صنف");
  }

  // سطر صنف واحد جوه جدول البضاعة
