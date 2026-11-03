  /* ---------- حسابات ---------- */
  /* v122 — التكلفة = سعر الشراء + النقل (B = اللي في الفاتورة) + نصيب القطعة من
     «انتقالات شراء البضاعة» (trIdx). الدوال اللي من غير B هي اللي بتتعرض وبتتحسب
     بيها الأرباح؛ و«B» للحاجات اللي بتخص المورد نفسه (مقارنة سعره، المرتجع له). */
  function avgCostQ(itemId){
    var q=0, v=0;
    live("purchases").forEach(function(p){
      if(p.itemId===itemId){ q += Number(p.qty)||0; v += (Number(p.qty)||0)*(Number(p.cost)||0); }
    });
    return { q:q, v:v };
  }
  function avgCostB(itemId){ var a = avgCostQ(itemId); return a.q>0 ? a.v/a.q : 0; }
  function trPerI(itemId){
    var T = trIdx(), t = T.perI[itemId]; if(!t) return 0;
    var q = T.qI[itemId] || 0; return q>0 ? t/q : 0;
  }
  function avgCost(itemId){                       // متوسط الصنف كله
    var a = avgCostQ(itemId);
    return a.q>0 ? a.v/a.q + (trIdx().perI[itemId]||0)/a.q : 0;
  }
  // متوسط تكلفة اللون/المقاس نفسه، ولو ماتشتراش قبل كده بنرجع لمتوسط الصنف
  function avgCostVQ(itemId, color, size){
    var k = vKey(itemId, color, size), q=0, v=0;
    live("purchases").forEach(function(p){
      if(keyOf(p) === k){ q += Number(p.qty)||0; v += (Number(p.qty)||0)*(Number(p.cost)||0); }
    });
    return { k:k, q:q, v:v };
  }
  /* v169: اللي لسه في المخزن من اللون/المقاس — اللي اتشرى ناقص اللي خرج بتكلفته المتثبّتة.
     skip = الأوردر اللي بنثبّت تكلفته دلوقتي (لسه ما خرجش). */
  function remCostV(itemId, color, size, skip){
    var a = avgCostVQ(itemId, color, size), q = a.q, v = a.v, tr = trIdx().perV[a.k] || 0;
    live("sales").forEach(function(s){
      if(s === skip || !isDelivered(s)) return;
      SL(s).forEach(function(l){
        if(keyOf(l) !== a.k) return;
        var n = lineSold(l, s), t = lineTr(l);
        q -= n; v -= n * (lineCost(l) - t); tr -= n * t;
      });
    });
    return { q:q, v:v, tr:tr };
  }
  /* متوسط متحرّك: تكلفة القطعة = متوسط اللي لسه على الرف، مش متوسط كل اللي اتشرى من الأول —
     وإلا شرا تاني بسعر أعلى بعد ما بعت من الأول بيطلّع ربح أكبر ويسيب قيمة على مخزون فاضي. */
  function avgCostVB(itemId, color, size, skip){
    var m = remCostV(itemId, color, size, skip);
    if(m.q > 0.0001 && m.v > -0.005) return Math.max(0, m.v) / m.q;
    var a = avgCostVQ(itemId, color, size);
    return a.q>0 ? a.v/a.q : avgCostB(itemId);
  }
  function trRemV(itemId, color, size, skip){
    var m = remCostV(itemId, color, size, skip);
    return m.q > 0.0001 && m.tr > -0.005 ? Math.max(0, m.tr) / m.q : trPerV(itemId, color, size);
  }
  function trPerV(itemId, color, size){
    var T = trIdx(); if(!(T.total > 0)) return 0;
    var k = vKey(itemId, color, size), q = T.qV[k] || 0;
    return q>0 ? (T.perV[k]||0)/q : trPerI(itemId);
  }
  function avgCostV(itemId, color, size){
    var a = avgCostVQ(itemId, color, size);
    return a.q>0 ? (a.v + (trIdx().perV[a.k]||0))/a.q : avgCost(itemId);
  }
  // ---------- أصناف الأوردر ----------
  // الأوردر الجديد بيتخزّن بـ lines[]، والقديم بصنف واحد على مستوى السجل.
  // SL بترجّع الاتنين بنفس الشكل، فكل الحسابات بتشتغل على الاتنين.
  function SL(s){
    if(s && Array.isArray(s.lines) && s.lines.length) return s.lines;
    if(!s || !s.itemId) return [];
    return [{ itemId:s.itemId, color:s.color, size:s.size,
              qty:s.qty, price:s.price, ret:s.ret }];
  }
  // التكلفة بتتثبّت على السطر وقت التسليم وما بتتغيّرش بعد كده.
  // من غير التثبيت ده، أي شراء جديد بسعر مختلف كان بيعيد كتابة أرباح الشهور اللي فاتت.
  /* v122: unitCost المتثبّت = سعر الشراء + النقل بس، ونصيب الانتقالات متثبّت لوحده
     في trCost. سطر اتسلّم قبل v122 (مالوش trCost) بياخد نصيبه بالمتوسط الحالي. */
  function lineTr(l){
    if(l && l.trCost != null && l.trCost !== "") return Number(l.trCost)||0;
    return trPerV(l.itemId, vColor(l), vSize(l));
  }
  function lineCost(l){
    if(l && l.unitCost != null && l.unitCost !== "") return (Number(l.unitCost)||0) + lineTr(l);
    return avgCostV(l.itemId, vColor(l), vSize(l));   // السجلات القديمة: نفس السلوك القديم
  }

  // تاريخ التسليم — الإيراد بيتسجّل فيه، مش في تاريخ إنشاء الأوردر (IFRS 15.31)
  // v169: الملغي يوم ما اترفض — خسارة الشحن بتاعته في شهر الرفض مش شهر الأوردر
  function revDate(s){
    if(!s) return "";
    if(s.deliveredAt) return s.deliveredAt;
    if(s.cancelledAt && isCancelled(s)) return s.cancelledAt;
    return s.date;
  }

  // بتتنادى مع كل حفظ أو تغيير حالة: بتثبّت التكلفة وتاريخ التسليم مرة واحدة
  function stampDelivery(rec){
    if(!rec) return;
    if(stOf(rec) === "delivered"){
      if(!rec.deliveredAt) rec.deliveredAt = today();
      SL(rec).forEach(function(l){
        if(l && (l.unitCost == null || l.unitCost === "")){
          l.unitCost = avgCostVB(l.itemId, vColor(l), vSize(l), rec);
          l.trCost = trRemV(l.itemId, vColor(l), vSize(l), rec);
        }
      });
    } else {
      // رجع لحالة تانية: التاريخ يتلغي عشان لو اتسلّم تاني ياخد تاريخه الصح
      delete rec.deliveredAt;
    }
    // تاريخ الرفض — لمشوار الأوردر في التفاصيل
    if(stOf(rec) === "cancelled"){ if(!rec.cancelledAt) rec.cancelledAt = today(); }
    else delete rec.cancelledAt;
    stampShipped(rec);
  }
  /* تاريخ الشحن: أول مرة الشركة والكود يتكتبوا الاتنين. الأوردرات
     القديمة ما عندهاش التاريخ ده، فالمشوار بيعرض تاريخ الأوردر مكانه. */
  function stampShipped(rec){
    if(!rec) return;
    // توصيل بنفسك: «خرج للتوصيل» هو اللي بيحط التاريخ، ولو اتسلّم من غيرها ياخد يوم التسليم
    if(rec.selfDel){
      if(!rec.shippedAt && (isDelivered(rec) || (isCancelled(rec) && !rec.preCancel))) rec.shippedAt = rec.deliveredAt || rec.cancelledAt || today();
      return;
    }
    if(squish(rec.shipCo) && squish(rec.shipCode)){ if(!rec.shippedAt) rec.shippedAt = today(); }
    else delete rec.shippedAt;
  }
  function lineRet(l){
    var r = Number(l.ret)||0, q = Number(l.qty)||0;
    return Math.min(Math.max(r,0), q);
  }
  // الكمية اللي اتباعت فعلاً من السطر ده
  function lineSold(l, s){
    var q = Number(l.qty)||0;
    if(isCancelled(s)) return 0;
    if(isDelivered(s)) return q - lineRet(l);
    return q;
  }
  function lineTotal(l, s){ return lineSold(l,s) * (Number(l.price)||0); }
  // الكمية اللي بتتحجز أو بتتخصم من المخزون
  function lineNeed(l, s){
    if(isCancelled(s) || stOf(s) === "proposed") return 0;
    return isDelivered(s) ? (Number(l.qty)||0) - lineRet(l) : (Number(l.qty)||0);
  }
  function shippedQty(s){
    return SL(s).reduce(function(a,l){ return a + (Number(l.qty)||0); },0);
  }
  // إجمالي كميات صنف واحد جوه أوردر
  function qtyOfItem(s, itemId){
    return SL(s).reduce(function(a,l){ return a + (l.itemId===itemId ? (Number(l.qty)||0) : 0); },0);
  }
  function itemsLabel(s){
    var names = SL(s).map(function(l){
      return itemName(l.itemId) + (vLabel(vColor(l),vSize(l)) ? " ("+vLabel(vColor(l),vSize(l))+")" : "");
    });
    return names.length ? names.join(" + ") : "—";
  }

  function stockOf(itemId){          // إجمالي الصنف بكل ألوانه ومقاساته
    var s=0;
    live("purchases").forEach(function(p){ if(p.itemId===itemId) s += Number(p.qty)||0; });
    live("sales").forEach(function(x){
      if(!isDelivered(x)) return;
      SL(x).forEach(function(l){ if(l.itemId===itemId) s -= lineSold(l,x); });
    });
    return s;
  }
  function reservedOf(itemId){
    var s=0;
    live("sales").forEach(function(x){
      if(!isReserved(x)) return;
      SL(x).forEach(function(l){ if(l.itemId===itemId) s += Number(l.qty)||0; });
    });
    return s;
  }
  function freeOf(itemId){ return stockOf(itemId) - reservedOf(itemId); }

  // نفس الحسابات بس للون ومقاس محددين
  function stockOfV(itemId, color, size){
    var k = vKey(itemId, color, size), s=0;
    live("purchases").forEach(function(p){ if(keyOf(p)===k) s += Number(p.qty)||0; });
    live("sales").forEach(function(x){
      if(!isDelivered(x)) return;
      SL(x).forEach(function(l){ if(keyOf(l)===k) s -= lineSold(l,x); });
    });
    return s;
  }
  function reservedOfV(itemId, color, size){
    var k = vKey(itemId, color, size), s=0;
    live("sales").forEach(function(x){
      if(!isReserved(x)) return;
      SL(x).forEach(function(l){ if(keyOf(l)===k) s += Number(l.qty)||0; });
    });
    return s;
  }
  function freeOfV(itemId, color, size){
    var n = stockIdx().free[vKey(itemId,color,size)];
    return n == null ? 0 : n;
  }
  /* v122 — المتاح بالصنف كله كان بيجمع الألوان والمقاسات: ٥ زيادة في مقاسات و٢ ناقصين
     في مقاس تاني كانوا بيطلعوا «فاضل ٣» — والعجز مستخبّي. هنا كل تركيبة لوحدها:
     pos = المتاح فعلاً، neg = اللي اتباع أو اتحجز ولسه ما اتشراش، short = التركيبات دي. */
  function freeSplit(itemId){
    var o = { pos:0, neg:0, short:[] };
    variantsOf(itemId).forEach(function(v){
      var n = freeOfV(itemId, v.color, v.size);
      if(n > 0) o.pos += n;
      else if(n < 0){ o.neg += -n; o.short.push({ color:v.color, size:v.size, n:-n }); }
    });
    return o;
  }
  // كل التركيبات الناقصة في كل الأصناف — «اشتري للأوردرات»
  function shortList(){
    var out = [];
    live("items").forEach(function(it){
      freeSplit(it.id).short.forEach(function(x){ out.push({ itemId:it.id, name:it.name, color:x.color, size:x.size, n:x.n }); });
    });
    return out;
  }
  // ---------- الألوان والمقاسات ----------
  // كل حركة ممكن يكون معاها لون ومقاس. السجلات القديمة من غيرهم = نسخة "عام"
  function vColor(r){ return r ? squish(r.color) : ""; }
  function vSize(r){ return r ? squish(r.size) : ""; }
  function vKey(itemId, color, size){
    return itemId + "|" + squish(color) + "|" + squish(size);
  }
  function keyOf(r){ return vKey(r.itemId, vColor(r), vSize(r)); }
  function vLabel(color, size){
    var a = [squish(color), squish(size)].filter(Boolean);
    return a.length ? a.join(" · ") : "";
  }
  function listOf(item, which){
    var raw = item && item[which];
    if(!raw) return [];
    // بيقبل الفاصلة العربية والإنجليزية وسطر جديد، وبيوحّد المسافات
    return String(raw).split(/[,،؛;\n]/).map(squish).filter(Boolean);
  }
  function hasVariants(item){ return listOf(item,"colors").length > 0 || listOf(item,"sizes").length > 0; }

  // كود لكل تركيبة لون/مقاس — بيتخزّن في الصنف نفسه {"أحمر|M":"LR-102"}
  function codeKey(color, size){ return squish(color) + "|" + squish(size); }
  /* الأكواد ما بقتش بتتعرض في الجداول — كانت عمود كامل بـ«—» في كل
     سطر. لسه بتتكتب من «الأصناف ← ألوان ومقاسات»، والبحث بيلاقي بيها
     في المبيعات والمشتريات والمخزون، فاللي محتاجها مش هيخسرها. */
  function vCode(itemId, color, size){
    var it = db.items.find(function(x){ return x.id===itemId; });
    if(!it || !it.codes) return "";
    return String(it.codes[codeKey(color,size)] || "").trim();
  }
  function setVCode(itemId, color, size, code){
    var it = db.items.find(function(x){ return x.id===itemId; });
    if(!it) return;
    if(!it.codes) it.codes = {};
    var k = codeKey(color,size), v = String(code||"").trim();
    if(v) it.codes[k] = v; else delete it.codes[k];
  }

  // الألوان والمقاسات اللي ليها حركة فعلية — مش كل الاحتمالات.
  // قبل كده كانت بتضرب الألوان في المقاسات: صنف بـ٤ ألوان و٤ مقاسات
  // يطلع ١٦ صف، وإنت مشتري منهم ٤ بس، فالـ١٢ الباقيين كانوا بيبانوا
  // «خلصان» وهما أصلاً معندكش ولا هتطلبهم.
  // شبكة كل الاحتمالات (ألوان × مقاسات). مالهاش لزمة في المخزون —
  // بتتستعمل في شاشة الأصناف بس، عشان تحط كود لتركيبة قبل ما تشتريها.
  function variantsAll(itemId){
    var it = db.items.find(function(x){ return x.id===itemId; }) || {};
    var out = {}, add = function(c,z){ out[vKey(itemId,c,z)] = { color:c||"", size:z||"" }; };
    var cs = listOf(it,"colors"), zs = listOf(it,"sizes");
    if(cs.length && zs.length) cs.forEach(function(c){ zs.forEach(function(z){ add(c,z); }); });
    else if(cs.length) cs.forEach(function(c){ add(c,""); });
    else if(zs.length) zs.forEach(function(z){ add("",z); });
    return Object.keys(out).map(function(k){ return out[k]; });
  }

  /* فهرس المخزون: مسحة واحدة على المشتريات والمبيعات بتطلّع
     المتاح لكل تركيبة + قايمة تركيبات كل صنف. من غيره كل سؤال عن
     تركيبة كان بيقرا الداتا كلها من الأول — وده بيبوّظ سرعة درج البيع
     لما الأصناف والتركيبات تكتر. بيتصفّر مع أي تعديل في الداتا. */
  var _sidx = null;
  function clearStockIdx(){ _sidx = null; _tidx = null; }
  function stockIdx(){
    if(_sidx) return _sidx;
    var free = {}, vars = {}, stock = {};
    var touch = function(r){
      var id = r.itemId; if(!id) return;
      var c = vColor(r), z = vSize(r), k = vKey(id,c,z);
      if(!vars[id]) vars[id] = {};
      if(!vars[id][k]) vars[id][k] = { color:c, size:z };
      if(free[k] == null){ free[k] = 0; stock[k] = 0; }
      return k;
    };
    live("purchases").forEach(function(r){
      var k = touch(r); if(k){ free[k] += Number(r.qty)||0; stock[k] += Number(r.qty)||0; }
    });
    live("sales").forEach(function(x){
      var deliv = isDelivered(x), rsv = isReserved(x);
      SL(x).forEach(function(l){
        var k = touch(l); if(!k) return;
        // المتاح = اللي دخل − اللي اتباع فعلاً − اللي محجوز لأوردر لسه ما اتسلّمش
        if(deliv){ free[k] -= lineSold(l, x); stock[k] -= lineSold(l, x); }
        else if(rsv) free[k] -= Number(l.qty)||0;
      });
    });
    _sidx = { free:free, vars:vars, stock:stock };   // stock = نفس stockOfV بالظبط من غير مسحة لكل تركيبة
    return _sidx;
  }

  function variantsOf(itemId){
    var m = stockIdx().vars[itemId];
    if(!m) return [{ color:"", size:"" }];      // صنف لسه ماتحركش: صف واحد بصفر
    return Object.keys(m).map(function(k){ return m[k]; });
  }

  // شرائح السعر: الأساس هو سعر القطعة، وكل شريحة {q: من كمية, u: سعر القطعة}
  function tiersOf(item){
    var list = [{q:1, u:Number(item.price)||0}];
    (item.tiers||[]).forEach(function(t){ list.push({q:Number(t.q)||0, u:Number(t.u)||0}); });
    return list.sort(function(a,b){ return a.q - b.q; });
  }
  function tierFor(item, q){
    var picked = null;
    tiersOf(item).forEach(function(t){ if(q >= t.q) picked = t; });
    return picked || {q:1, u:Number(item.price)||0};
  }
  /* سعر لكل لون (v116): الصنف اللي ألوانه بأسعار مختلفة بيتخزّن فيه
     cprice = {"أسود":250, "بيج":300}. لون مالوش سعر = السعر الأساسي.
     اللون اللي ليه سعر خاص ما بيتطبّقش عليه سعر الجملة — عشان شريحة
     الجملة اتحسبت على السعر الأساسي وممكن تنزل تحت تكلفة اللون الغالي. */
  function colorPrice(item, color){
    var c = squish(color);
    return c && item && item.cprice ? Math.max(0, Number(item.cprice[c])||0) : 0;
  }
  function itemHasPrice(item){
    return (Number(item && item.price)||0) > 0 || Object.keys(item && item.cprice || {}).some(function(c){ return colorPrice(item, c) > 0; });
  }
  function vPrice(item, color){ return colorPrice(item, color) || (Number(item && item.price)||0); }
  function priceFor(item, color, q){
    var cp = colorPrice(item, color);
    return cp > 0 ? { q:1, u:cp, color:true } : tierFor(item, q);
  }
  // ألوان الصنف: اللي اتحرّك فعلاً + اللي متكتب في الصنف — «» = من غير لون (لو ليه حركة)
  function itemColors(itemId){
    var it = db.items.find(function(x){ return x.id === itemId; });
    var m = stockIdx().vars[itemId] || {}, seen = {}, out = [];
    var add = function(c){ c = squish(c); if(seen[c] === 1) return; seen[c] = 1; out.push(c); };
    Object.keys(m).forEach(function(k){ add(m[k].color); });
    listOf(it, "colors").forEach(add);
    return out;
  }
  function stockOfVi(itemId, color, size){ return stockIdx().stock[vKey(itemId, color, size)] || 0; }
  function colorQty(itemId, color, fn){
    var c = squish(color), m = stockIdx().vars[itemId] || {}, n = 0;
    Object.keys(m).forEach(function(k){ if(m[k].color === c) n += fn(itemId, m[k].color, m[k].size); });
    return n;
  }
  // متوسط تكلفة اللون بكل مقاساته — لون ما اتشراش قبل كده بياخد متوسط الصنف (own:false)
  function costOfColor(itemId, color){
    var c = squish(color), q = 0, v = 0;
    live("purchases").forEach(function(p){
      if(p.itemId === itemId && vColor(p) === c){ q += Number(p.qty)||0; v += (Number(p.qty)||0)*(Number(p.cost)||0); }
    });
    return q > 0 ? { c:(v + (trIdx().perC[itemId + "\u0001" + c]||0))/q, own:true } : { c:avgCost(itemId), own:false };
  }

  // ---------- حالات الأوردر ----------
  var GOVS = ["القاهرة","الجيزة","القليوبية","الإسكندرية","البحيرة","كفر الشيخ","الدقهلية","دمياط",
    "الشرقية","الغربية","المنوفية","بورسعيد","الإسماعيلية","السويس","شمال سيناء","جنوب سيناء","الفيوم",
    "بني سويف","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح"];

  /* ═══ v139 — جه منين؟ · التأكيد قبل الشحن · سبب الإلغاء ═══
     مصدر الأوردر (src) والحملة (camp) بيتسجّلوا على الأوردر، ونفس المصدر على مصروف الإعلان —
     فنعرف كل مصدر جاب كام أوردر وصرفنا عليه كام. التأكيد (cf) بيتعمل قبل الشحن، وسبب الإلغاء (rsn)
     بيتسجّل لما الأوردر يتلغي أو العميل يرفض. كله اختياري: الأوردرات القديمة «مش متحدد». */
  var SRC = [["fb","إعلان فيسبوك"],["ig","إعلان إنستجرام"],["tt","إعلان تيك توك"],["wa","واتساب ورسايل"],
             ["old","عميل قديم"],["ref","ترشيح"],["oth","تاني"]];
  var SRC_AD = { fb:1, ig:1, tt:1 }, SRC_LABEL = {};
  SRC.forEach(function(x){ SRC_LABEL[x[0]] = x[1]; });
  var RSN = [["refused","رفض الاستلام"],["noans","مش بيرد"],["mind","غيّر رأيه"],["size","المقاس أو اللون"],
             ["price","السعر أو الشحن"],["late","اتأخر"],["dup","مكرر أو غلط"],["oth","تاني"]];
  var RSN_LABEL = {}; RSN.forEach(function(x){ RSN_LABEL[x[0]] = x[1]; });
  var ORD_CF_LABEL = { "":"لسه ما اتأكدش", ok:"اتأكد", nr:"ما ردّش" };
  // التأكيد بيفرق قبل الشحن بس: أوردر جاري لسه ما خرجش (لا بوليصة ولا «خرج للتوصيل»)
  function cfPending(s){ return stOf(s) === "progress" && !s.shippedAt && !squish(s.shipCode) && s.cf !== "ok"; }
  function cfTag(s){
    if(stOf(s) !== "progress") return "";
    if(s.cf === "ok") return " <span class='cf-tag ok'>✓ اتأكد</span>";
    if(!cfPending(s)) return "";
    return " <span class='cf-tag " + (s.cf === "nr" ? "nr" : "wait") + "'>" + ORD_CF_LABEL[s.cf || ""] + "</span>";
  }
  /* إلغاء قبل الشحن: الأوردر ما خرجش (لا بوليصة ولا «خرج للتوصيل») — مفيش مصاريف شحن ولا بضاعة عند الشركة.
     preCancel بيتسجّل على الأوردر عشان المرتجع والمحافظ ما يحسبوهوش.
     v141: الشحن ما بيتمسحش — بيفضل مكتوب على الأوردر، وshipIn()/shipOut() بيرجّعوا صفر طول ما preCancel.
     فلو الأوردر رجع من الإلغاء (اتلغى بالغلط أو العميل رجع في كلامه) الشحن بيرجع يتحسب لوحده.
     shipKept = اتلغى على v141 أو بعدها (الشحن محفوظ). preCancel من غيرها = نسخة قديمة كانت بتمسح الشحن. */
  function preShip(rec, shippedAt){ return !squish(rec.shipCode) && !(shippedAt !== undefined ? shippedAt : rec.shippedAt); }
  function preCancelFix(rec){                       // بترجّع true لو رجع من إلغاء قديم والشحن عليه كان اتمسح
    var was = !!rec.preCancel, kept = !!rec.shipKept;
    if(stOf(rec) === "cancelled" && preShip(rec)){
      if(!was) rec.shipKept = true;
      rec.preCancel = true; return false;
    }
    if(!was) return false;
    rec.preCancel = false; delete rec.shipKept;
    return shipWiped(rec, kept);
  }
  function shipWiped(rec, kept){ return !kept && !(Number(rec.shipIn)||0) && !(Number(rec.shipOut)||0); }
  var SHIP_WIPED = "الشحن عليه صفر — لو كان عليه شحن قبل الإلغاء اكتبه من زرار تعديل (النسخ القديمة كانت بتمسحه)";
  function srcName(k){ return SRC_LABEL[k] || "مش متحدد"; }
  // رقم مصري لواتساب: 01xxxxxxxxx → 201xxxxxxxxx
  function waNum(ph){
    var d = String(ph || "").replace(/\D/g, "");
    if(/^01\d{9}$/.test(d)) return "2" + d;
    if(/^201\d{9}$/.test(d)) return d;
    return "";
  }
  function waConfirmText(rec, total){
    var p = db.parties.find(function(x){ return x.id === rec.partyId; }) || {};
    var its = (rec.lines || []).filter(function(l){ return l.itemId && (Number(l.qty)||0) > 0; }).map(function(l){
      return itemName(l.itemId) + ([l.color, l.size].filter(Boolean).length ? " (" + [l.color, l.size].filter(Boolean).join(" ") + ")" : "") +
        ((Number(l.qty)||0) > 1 ? " × " + l.qty : "");
    }).join(" · ");
    return "أهلاً " + (squish(p.name) || "") + "، معاك Lora Collection. بنأكد أوردرك: " + its +
      " — الإجمالي " + (Math.round(total)||0).toLocaleString("en-US") + " جنيه شامل الشحن. نشحنه النهارده؟";
  }
  /* v171 — الرفض مع شركة شحن: العميل ساعات بيدفع الشحن كله وساعات جزء وساعات ولا حاجة.
     قبل كده السيستم كان بيفترض إنه دفع اللي عليه، فالكشف بيطلع مختلف. shipQ = الشحن اللي كان
     عليه، وبيفضل على الأوردر لحد ما تجاوب — فالسؤال ما يضيعش لو قفلت أو عملت refresh. */
  function markShipQ(rec){
    if(stOf(rec) === "cancelled" && viaShip(rec) && !rec.preCancel && (Number(rec.shipIn)||0) > 0){ if(!rec.shipQ) rec.shipQ = Number(rec.shipIn); }
    else delete rec.shipQ;
  }
  function shipQList(){ return live("sales").filter(function(x){ return x.shipQ && isCancelled(x); }); }
  function shipAskHTML(r){
    if(!r || !r.shipQ || !isCancelled(r) || !canEdit() || saleLocked(r)) return "";
    var q = Number(r.shipQ)||0, co = squish(r.shipCo) || "الشركة";
    return "<div class='rsn-ask ship-ask' role='group' aria-label='الشحن'><b>#" + esc(r.no || "") + " " + esc(partyName(r.partyId)) +
        " اترفض — العميل دفع كام من الشحن؟</b><span class='sub'>كان عليه <span class='num'>" + esc(qty(q)) + "</span> · " +
        esc(co) + " واخدة <span class='num'>" + esc(qty(shipOut(r))) + "</span></span>" +
      "<span class='quick'><button type='button' data-shipq='" + esc(r.id) + "|all'>دفع كله <span class='num'>" + esc(qty(q)) + "</span></button>" +
        "<button type='button' data-shipq='" + esc(r.id) + "|0'>ما دفعش</button></span>" +
      "<span class='sq-part'><input type='number' inputmode='decimal' min='0' max='" + q + "' step='any' data-shipqv='" + esc(r.id) +
        "' placeholder='دفع جزء…' aria-label='العميل دفع كام' autocomplete='off'><button type='button' class='tbtn' data-shipq='" + esc(r.id) + "|part'>سجّل</button></span></div>";
  }
  document.addEventListener("click", function(e){
    var t = e.target.closest ? e.target.closest("[data-shipq]") : null; if(!t) return;
    var a = t.dataset.shipq.split("|"), r = db.sales.find(function(x){ return x.id === a[0]; });
    if(!r || !r.shipQ) return;
    if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
    if(saleLocked(r)){ toast("الأوردر ده في فترة مقفولة — مينفعش يتعدّل"); return; }
    var q = Number(r.shipQ)||0, v = a[1] === "all" ? q : 0;
    if(a[1] === "part"){
      var box = t.parentNode.querySelector("[data-shipqv]"), raw = box ? toEn(box.value).trim() : "";
      v = Number(raw);
      if(raw === "" || !(v >= 0)){ toast("اكتب العميل دفع كام"); if(box) box.focus(); return; }
      if(v > q + 0.009){ toast("كان عليه " + money(q) + " بس"); if(box) box.focus(); return; }
    }
    r.shipIn = Math.round(v * 100) / 100; delete r.shipQ;
    r.editedBy = me || "غير محدد"; r.at = Date.now();
    pendCache = null; saveSoon("sales"); renderAll();
    var net = r.shipIn - shipOut(r);
    toast("#" + (r.no || "") + ": العميل دفع " + money(r.shipIn) + " من الشحن · " +
      (net < -0.009 ? "عليك " + money(-net) + " لـ " + (squish(r.shipCo) || "الشركة") : "مفيش عليك حاجة"), 4200);
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Enter" || !e.target.matches || !e.target.matches("[data-shipqv]")) return;
    e.preventDefault(); var b = e.target.parentNode.querySelector("[data-shipq]"); if(b) b.click();
  });
  // سبب الرفض: بيظهر فوق لوحة المراحل لما أوردر يترفض منها، لحد ما تختار أو تقفله
  var rsnAsk = null;
  function rsnAskHTML(){
    var r = rsnAsk && db.sales.find(function(x){ return x.id === rsnAsk; });
    if(r && r.shipQ) return shipAskHTML(r);                          // الشحن الأول وبعدين السبب
    var q1 = shipQList()[0]; if(q1) return shipAskHTML(q1);
    if(!r || !isCancelled(r) || r.rsn){ rsnAsk = null; return ""; }
    return "<div class='rsn-ask' role='group' aria-label='سبب الرفض'><b>#" + esc(r.no || "") + " اتلغى — السبب؟</b>" +
      "<span class='quick'>" + RSN.map(function(x){ return "<button type='button' data-rsnset='" + esc(r.id) + "|" + x[0] + "'>" + x[1] + "</button>"; }).join("") + "</span>" +
      "<button type='button' class='tbtn ghostx' data-rsnset='" + esc(r.id) + "|'>بعدين</button></div>";
  }
  function setOrderMeta(id, k, v){
    var rec = db.sales.find(function(x){ return x.id === id; }); if(!rec) return;
    if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
    if(saleLocked(rec)){ toast("الأوردر ده في فترة مقفولة — مينفعش يتعدّل"); return; }
    rec[k] = v; if(k === "cf") rec.cfAt = v ? today() : "";
    rec.editedBy = me || "غير محدد"; rec.at = Date.now();
    // اللي اتكتب في خانات اللوحة (الشركة · الكود · مين هيوصّله) ولسه ما اتسجّلش ما يضيعش مع إعادة الرسم
    var keep = [];
    Array.prototype.forEach.call(document.querySelectorAll("#s-stage-panel input[data-sgco],#s-stage-panel input[data-sgcode],#s-stage-panel input[data-sgcour]"), function(i){
      var a = ["data-sgco","data-sgcode","data-sgcour"].filter(function(n){ return i.hasAttribute(n); })[0];
      if(i.value) keep.push([a, i.getAttribute(a), i.value]);
    });
    saveSoon("sales"); renderAll();
    keep.forEach(function(x){ var i = document.querySelector("#s-stage-panel input[" + x[0] + "='" + x[1] + "']"); if(i && !i.value) i.value = x[2]; });
    toast("#" + (rec.no || "") + " " + (k === "cf" ? (v === "ok" ? "اتأكد ✓" : v === "nr" ? "— ما ردّش" : "رجع «لسه»") : (v ? "السبب: " + RSN_LABEL[v] : "")));
  }
  document.addEventListener("click", function(e){
    var t = e.target.closest ? e.target.closest("[data-cfset],[data-rsnset]") : null; if(!t) return;
    if(t.dataset.cfset){
      var a = t.dataset.cfset.split("|");
      if(a[1] === "x"){                                               // العميل قال لا في التأكيد: إلغاء قبل الشحن
        var rx = db.sales.find(function(x){ return x.id === a[0]; }); if(rx) setSaleStatus(rx, "cancelled"); return; }
      setOrderMeta(a[0], "cf", a[1]); return;
    }
    var b = t.dataset.rsnset.split("|");
    if(!b[1]){ rsnAsk = null; renderStages(); return; }
    rsnAsk = null; setOrderMeta(b[0], "rsn", b[1]);
  });
  // الدرج: «جه منين؟» والحملة والتأكيد وسبب الإلغاء (full = أول ما الدرج يتفتح)
  function campList(){
    var dl = document.getElementById("camp-list"); if(!dl) return;
    var seen = {};
    live("sales").concat(live("cash")).forEach(function(x){ var c = squish(x.camp); if(c) seen[c] = 1; });
    dl.innerHTML = Object.keys(seen).sort().map(function(c){ return "<option value='" + esc(c) + "'>"; }).join("");
  }
  function syncSrcUI(full){
    var sel = document.getElementById("e-src"); if(!sel) return;
    if(full){
      sel.innerHTML = optsHTML(SRC.map(function(x){ return { v:x[0], t:x[1] }; }), draft.src, "اختار");
      document.getElementById("e-camp").value = draft.camp || "";
      document.getElementById("e-rsn").innerHTML = RSN.map(function(x){ return "<button type='button' data-rsn='" + x[0] + "'>" + x[1] + "</button>"; }).join("");
      campList();
    }
    document.getElementById("e-camp-wrap").hidden = !SRC_AD[draft.src];
    var prog = draft.status === "progress", canc = draft.status === "cancelled";
    document.getElementById("e-cfbox").hidden = !prog;
    Array.prototype.forEach.call(document.querySelectorAll("#e-cf [data-cf]"), function(b){
      var on = (b.dataset.cf || "") === (draft.cf || ""); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    document.getElementById("e-rsnbox").hidden = !canc;
    Array.prototype.forEach.call(document.querySelectorAll("#e-rsn [data-rsn]"), function(b){
      var on = b.dataset.rsn === (draft.rsn || ""); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    var p = db.parties.find(function(x){ return x.id === draft.partyId; }) || {};
    document.getElementById("e-wa").hidden = !(prog && waNum(p.phone));
  }
  function cfBtns(s){
    if(!canEdit() || saleLocked(s) || !cfPending(s)) return "";
    return "<span class='cf-btns'><button type='button' class='ok' data-cfset='" + esc(s.id) + "|ok'>✓ اتأكد</button>" +
      (s.cf === "nr" ? "" : "<button type='button' data-cfset='" + esc(s.id) + "|nr'>ما ردّش</button>") +
      "<button type='button' data-cfset='" + esc(s.id) + "|x' title='العميل مش عايزه — إلغاء قبل الشحن من غير مصاريف شحن'>لغى</button></span>";
  }
  var ST_LABEL = { proposed:"مقترح", progress:"جاري", delivered:"مسلّم", cancelled:"ملغي" };
  /* «مسلّم» لوحدها مش بتقول القصة: العميل ممكن ياخد صنف ويرجّع صنف.
     الوصف مستنتج من الأرقام مش حالة متخزّنة لوحدها، فمستحيل يتعارض
     مع الكميات. الحالة المتخزّنة فاضلة أربعة زي ما هي — ودي اللي كل
     الحسابات بتشتغل عليها. */
  function saleStateTxt(s){
    if(stOf(s) !== "delivered") return ST_LABEL[stOf(s)];
    var r = retQty(s);
    if(!r) return "مسلّم بالكامل";
    return soldQty(s) > 0 ? "مسلّم جزئيًا" : "رجع بالكامل";
  }
  // نفس الكلام بس لخيار في قايمة الحالة
  function stOptTxt(s, k){ return k === "delivered" ? saleStateTxt(s) : ST_LABEL[k]; }
  /* «مقترح» اتشالت من الاختيارات لأنها مش مستخدمة. الأوردرات القديمة
     اللي حالتها «مقترح» لسه بتتعرض وتشتغل عادي — الاختيار بيظهر ليها
     هي بس، عشان ما نغيّرش حالة مخزون حد من غير ما يعرف. */
  function stChoices(cur){
    var ks = ["progress","delivered","cancelled"];
    if(cur === "proposed") ks.unshift("proposed");
    return ks;
  }

