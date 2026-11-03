  /* ================= رأس المال والشركاء ================= */
  // حركات رأس المال بتتخزّن في قايمة cash بأنواع cap_* — فبتاخد المزامنة
  // وحواجز الإقفال والحذف جاهزة. اللي بيأثّر على الخزنة منها متعلّم تحت.
  var CAP = {
    cap_in:       { label:"دفع رأس مال",         cash:+1, capital:+1, current: 0 },
    cap_out:      { label:"سحب من رأس ماله",     cash:-1, capital:-1, current: 0 },
    cap_share:    { label:"أرباح مستحقة له",     cash: 0, capital: 0, current:+1 },
    cap_payout:   { label:"صرف أرباح",           cash:-1, capital: 0, current:-1 },
    cap_reinvest: { label:"ساب أرباحه رأس مال",  cash: 0, capital:+1, current:-1 },
    cap_repay:    { label:"رجّعناله مصروف دفعه",   cash:-1, capital: 0, current: 0 }   // v142
  };
  function isCapType(t){ return Object.prototype.hasOwnProperty.call(CAP, t); }

  function isPartner(p){ return !!p && p.type === "partner"; }
  function partners(){ return live("parties").filter(isPartner); }

  function capRows(partnerId, asOf){
    return live("cash").filter(function(c){
      if(!isCapType(c.type)) return false;
      if(partnerId && c.partyId !== partnerId) return false;
      if(asOf && (c.date||"") > asOf) return false;
      return true;
    });
  }
  function capSum(partnerId, asOf, field){
    return capRows(partnerId, asOf).reduce(function(a,c){
      return a + (CAP[c.type][field] * (Number(c.amount)||0));
    }, 0);
  }
  // رأس مال الشريك: اللي ضخّه − اللي سحبه + اللي أعاد استثماره
  function capitalOf(id, asOf){ return capSum(id, asOf, "capital"); }
  // الأرباح المستحقة للشريك: استحقها ولسه ما أخدهاش ولا حوّلها لرأس مال
  function currentOf(id, asOf){ return capSum(id, asOf, "current"); }

  function totalCapital(asOf){
    return partners().reduce(function(a,p){ return a + capitalOf(p.id, asOf); }, 0);
  }
  function ratioOf(id, asOf){
    var t = totalCapital(asOf);
    return t > 0 ? capitalOf(id, asOf) / t : 0;
  }

  // كل تاريخ اتغيّر فيه رأس مال أي شريك — حدود شرائح الترجيح
  function capChangeDates(){
    var seen = {};
    live("cash").forEach(function(c){
      if(isCapType(c.type) && CAP[c.type].capital !== 0 && c.date) seen[c.date] = 1;
    });
    return Object.keys(seen).sort();
  }

  /* أول يوم دخل فيه الشريك فلوس. لازم يبان في الجدول، لأن شريكين بنفس
     المبلغ بنسبتين مختلفتين بيبانوا غلط من غير ما تعرف إن واحد دفع
     متأخّر — وده السبب الوحيد للفرق. */
  function capStartOf(id){
    var d = "";
    live("cash").forEach(function(c){
      if(c.partyId !== id || !c.date) return;
      if(!isCapType(c.type) || CAP[c.type].capital <= 0) return;
      if(!d || c.date < d) d = c.date;
    });
    return d;
  }

  // كام يوم من الفترة فلوسه كانت شغّالة فيها
  function capDaysIn(id, from, to){
    var st = capStartOf(id);
    if(!st || !from || !to) return null;
    var a = st > from ? st : from;
    if(a > to) return 0;
    return daysBetween(a, to) + 1;
  }

  // النسبة المرجّحة بالزمن — الأساس المعتمد في محاسبة شركات الأشخاص.
  // الشريك اللي ضخّ فلوس في يونيو مياخدش نسبته الجديدة على أرباح يناير.
  /* v168: الأيام اللي مفيهاش رأس مال خالص مش داخلة في القسمة — وإلا النسب مجموعها أقل من 100%
     والفرق كان بيروح كله لأكبر نصيب. */
  function weightedRatio(id, from, to){
    if(!from || !to || from > to) return ratioOf(id, to || today());
    var total = 0;
    var bounds = [from];
    capChangeDates().forEach(function(d){
      if(d > from && d <= to && bounds.indexOf(d) < 0) bounds.push(d);
    });
    bounds.sort();
    var acc = 0;
    for(var i = 0; i < bounds.length; i++){
      var a = bounds[i];
      var b = (i + 1 < bounds.length) ? addDays(bounds[i+1], -1) : to;
      if(!(totalCapital(a) > 0)) continue;
      var n = daysBetween(a, b) + 1;
      acc += ratioOf(id, a) * n; total += n;
    }
    return total > 0 ? acc / total : ratioOf(id, to);
  }

  /* ---------- الأرباح المحتجزة ---------- */
  function netProfitAll(){ return periodStats(null).net; }
  function distributedTotal(){
    return live("cash").filter(function(c){ return c.type === "cap_share"; })
      .reduce(function(a,c){ return a + (Number(c.amount)||0); }, 0);
  }
  // اللي لسه متاح للتوزيع: كل الأرباح من البداية ناقص اللي اتوزّع
  function retainedEarnings(){ return netProfitAll() - distributedTotal(); }

  /* ---------- توفيق الميزانية ---------- */
  /* قيمة المخزون في الدفاتر = كل اللي اشتريته − كل اللي خرج تكلفة مع البيع.
     مش «الكمية × المتوسط الحالي»: التكلفة بتتثبّت على السطر وقت التسليم
     (عشان أرباح الشهور اللي فاتت ما تتغيّرش)، فلو اشتريت تاني بسعر مختلف
     المتوسط بيتحرّك والرقمين ما يبقوش متساويين — والميزانية تختل بالفرق.
     الطرح ده كمان بيمسك حالتين تانيين لوحده:
       · البيع من غير فاتورة شراء: القيمة بتطلع بالسالب بدل ما تتقصّ لصفر
       · صنف اتشال: مشترياته لسه محسوبة لأننا مش بنلف على live("items")
     (IAS 2.27 — المتوسط المتحرّك) */
  function stockBookValue(){
    // + الانتقالات اللي اتحطت على البضاعة — نصيب المباع منها بيطلع مع lineCost تحت
    var v = live("purchases").reduce(function(a,p){ return a + purchTotal(p); }, 0) + trIdx().total -
      costTrueUps().reduce(function(a, x){ return a + x.v; }, 0);          // فرق التكلفة طلع مصروف
    live("sales").forEach(function(s){
      if(!isDelivered(s)) return;
      SL(s).forEach(function(l){ v -= lineCost(l) * lineSold(l, s); });
    });
    return v;
  }
  // قيمة المخزون زي ما شاشة المخزون بتعرضها: الكمية × المتوسط الحالي
  function stockAtAvg(){
    return live("items").reduce(function(a,i){
      return a + variantsOf(i.id).reduce(function(b,v){
        return b + stockOfV(i.id,v.color,v.size) * avgCostV(i.id,v.color,v.size);
      }, 0);
    }, 0);
  }
  /* الجهة المحذوفة اللي لسه عليها أو ليها فلوس بتفضل في الميزانية.
     الحذف بيخفيها من الكشوف، بس المديونية بتاعتها فلوس حقيقية. */
  // v132: أرصدة الجهات متقسّمة للميزانية — نفس اللفة اللي duesNet بيجمعها
  function partyDues(){
    var seen = {}, o = { recv:0, custAdv:0, supAdv:0, pay:0, net:0 };
    db.parties.forEach(function(p){
      if(!p || seen[p.id] || isPartner(p)) return;
      seen[p.id] = 1;
      var b = partyBalance(p.id);
      if(p.deleted && Math.abs(b) < 0.009) return;
      o.net += b;
      if(p.type === "supplier"){ if(b > 0) o.supAdv += b; else o.pay -= b; }
      else { if(b > 0) o.recv += b; else o.custAdv -= b; }      // عميل: موجب عليه · سالب عربون عندك
    });
    return o;
  }
  function duesNet(){ return partyDues().net; }
  // صافي الأصول لازم يساوي حقوق الملكية. الفرق معناه حاجة مش مسجّلة.
  function netAssets(){
    return cashBox() + walletsTotal() + stockBookValue() + duesNet() + prepaidTotal() - owedTotal();
  }
  function totalEquity(){
    return partners().reduce(function(a,p){
      return a + capitalOf(p.id) + currentOf(p.id);
    }, 0) + retainedEarnings() + openingEquity();
  }

  /* ---------- حساب التوزيع ---------- */
  // بترجّع نصيب كل شريك مع تسوية فرق التقريب على أكبر نصيب
  function computeShares(amount, from, to){
    var ps = partners();
    if(!ps.length) return [];
    var rows = ps.map(function(p){
      var w = weightedRatio(p.id, from, to);
      return { id:p.id, name:p.name, ratio:w, share:Math.round(amount * w * 100) / 100 };
    });
    var sum = rows.reduce(function(a,r){ return a + r.share; }, 0);
    var diff = Math.round((amount - sum) * 100) / 100;
    if(diff !== 0){
      var big = rows.reduce(function(a,r){ return r.share > a.share ? r : a; }, rows[0]);
      big.share = Math.round((big.share + diff) * 100) / 100;
    }
    return rows;
  }

  /* ---------- الأرصدة الافتتاحية ---------- */
  // opening        : رصيد الخزنة يوم ما بدأت تستخدم السيستم
  // opening_party  : موجب = ليك عنده · سالب = عليك له
  // المخزون الافتتاحي بيتسجّل كفاتورة شراء عليها opening:true ومدفوع صفر،
  // فبتدخل في متوسط التكلفة من غير ما تأثّر على الخزنة أو على مديونية مورد.
  function openingCash(){
    return live("cash").filter(function(c){ return c.type === "opening"; })
      .reduce(function(a,c){ return a + (Number(c.amount)||0); }, 0);
  }
  /* الأرصدة الافتتاحية هي صافي ثروة الشغل يوم ما بدأت تستخدم السيستم.
     محاسبيًا كل واحد فيهم قيده: مدين الأصل / دائن حقوق الملكية.
     الطرف الدائن ده مكانش بيتسجّل خالص، فالميزانية كانت بتختل بمقدار
     الأرصدة الافتتاحية كلها. (IAS 1.54 — الأصول = الالتزامات + حقوق الملكية) */
  function openingStock(){
    return live("purchases").reduce(function(a,x){
      return x.opening ? a + (Number(x.qty)||0) * (Number(x.cost)||0) : a; }, 0);
  }
  function openingParties(){
    return live("cash").reduce(function(a,c){
      return c.type === "opening_party" ? a + (Number(c.amount)||0) : a; }, 0);
  }
  // إجمالي الطرف الدائن للأرصدة الافتتاحية
  function openingEquity(){
    return openingCash() + openingStock() + openingParties();
  }

  function hasOpening(){
    return live("cash").some(function(c){ return c.type==="opening" || c.type==="opening_party"; })
        || live("purchases").some(function(p){ return p.opening; });
  }

  /* ---------- إقفال الفترة ---------- */
  // أي حركة تاريخها قبل أو يساوي lockedUntil مقفولة — مينفعش تتعدّل ولا تتحذف.
  // ده اللي بيخلي الرقم اللي وزّعت عليه أرباح الشركاء يفضل هو هو.
  function lockDate(){ return (settings && settings.lockedUntil) || ""; }
  function isLocked(dateStr){
    var L = lockDate();
    return !!(L && dateStr && String(dateStr) <= L);
  }
  // بترجّع true لو الحركة مسموح بيها، وبتنبّه لو مقفولة
  function guardLock(dateStr, what){
    if(!isLocked(dateStr)) return true;
    toast((what || "الحركة") + " في فترة مقفولة (لحد " + lockDate() + ") — افتح الفترة الأول من تبويب النسخة الاحتياطية");
    return false;
  }
  // الأوردر مقفول لو تاريخ طلبه أو تاريخ تسليمه في الفترة المقفولة
  // أول تاريخ مسموح تسجّل فيه — عشان السجل الجديد ما يقعش في فترة مقفولة
  function firstOpenDate(){
    var L = lockDate(), t = today();
    if(!L || L < t) return t;
    return addDays(L, 1);
  }
  function saleLocked(rec){
    return isLocked(rec && rec.date) || isLocked(rec && rec.deliveredAt);
  }

  /* ---------- عرض ---------- */
  // ---------- الفترة ----------
  var period = { mode:"all", from:"", to:"" };

  function isoOf(d){
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") +
           "-" + String(d.getDate()).padStart(2,"0");
  }
  // كانت بتقرا بالتوقيت المحلي وبتكتب بـUTC، فكانت بتغلط يوم في أي توقيت شرق جرينتش
  function addDays(iso, n){
    var d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return isoOf(d);
  }
  function daysBetween(a, b){
    return Math.round((new Date(b+"T00:00:00") - new Date(a+"T00:00:00")) / 86400000);
  }
  function monthRange(offset){
    var t = new Date(today() + "T00:00:00");
    var y = t.getFullYear(), m = t.getMonth() + (offset||0);
    var a = new Date(y, m, 1), b = new Date(y, m+1, 0);
    var f = function(x){ return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); };
    return { from:f(a), to:f(b) };
  }
  function periodRange(){
    if(period.mode === "all") return null;
    if(period.mode === "month") return monthRange(0);
    if(period.mode === "prev")  return monthRange(-1);
    if(period.mode === "d30")   return { from: addDays(today(), -29), to: today() };
    if(period.mode === "custom" && (period.from || period.to))
      return { from: period.from || "0000-01-01", to: period.to || "9999-12-31" };
    return null;
  }
  function prevRange(){
    var r = periodRange();
    if(!r) return null;
    if(period.mode === "month") return monthRange(-1);
    if(period.mode === "prev")  return monthRange(-2);
    var a = new Date(r.from + "T00:00:00"), b = new Date(r.to + "T00:00:00");
    var days = Math.round((b-a)/86400000) + 1;
    return { from: addDays(r.from, -days), to: addDays(r.from, -1) };
  }
  function inRange(dateStr, r){
    if(!r) return true;
    var d = dateStr || "";
    return d >= r.from && d <= r.to;
  }
  // الأوردر بيدخل الفترة بتاريخ تسليمه مش تاريخ طلبه — أوردر اتعمل آخر الشهر
  // واتسلّم أول الشهر اللي بعده إيراده بيتسجّل في شهر التسليم (IFRS 15.31)
  function salesIn(r){ return live("sales").filter(function(s){ return inRange(revDate(s), r); }); }
  /* v122 — نوع المصروف (c.cat). النوع هو اللي بيحدد ثابت ولا متغيّر:
     الإعلان والتغليف بيزيدوا مع كل أوردر (متغيّر)، والباقي ثابت.
     «انتقالات شراء بضاعة» مش مصروف أصلاً: بتتحط على تكلفة القطع اللي
     اتشرت في المشوار ده (IAS 2.11 — زي النقل بالظبط) — شوف trIdx تحت.
     السجلات القديمة مالهاش نوع، فبنعرفه من البيان (expCatGuess)، ولو
     ما اتعرفش بنرجع للتصنيف القديم ثابت/متغيّر (costKind). */
  var EXP_CATS = [
    ["ads",    "إعلانات",            "var"],
    ["pack",   "تغليف",              "var"],
    ["trans",  "انتقالات شراء بضاعة", "goods"],
    ["subs",   "اشتراكات",           "fixed"],
    ["salary", "مرتبات",             "fixed"],
    ["once",   "مرة واحدة",          "fixed"],
    ["other",  "تاني",               "fixed"],
    // مش زرار: مصروف قديم متعلّم «متغيّر» وبيانه ما بيقولش نوعه (أو عمولة) — بيفضل متغيّر
    ["othervar", "مصاريف متغيّرة تانية", "var"],
    // v142: شحن رصيد فيسبوك — أصل (مدفوع مقدّماً) مش مصروف؛ رسومه وصرفه بيتحسبوا على «إعلانات»
    ["metatop", "شحن رصيد فيسبوك", "var"]
  ];
  var EXP_CAT = {}; EXP_CATS.forEach(function(x){ EXP_CAT[x[0]] = { label:x[1], kind:x[2] }; });
  function expCatGuess(note){
    var n = String(note || "");
    if(/[اإأ]علان|ممول|sponsor/i.test(n)) return "ads";
    if(/بابلز|لزق|تغليف|[اأ]كياس|شنط|كرتون|كراتين/.test(n)) return "pack";
    if(/انتقال|مواصلات|مشوار|مشاوير|تو?كتوك|تكاتك|[اأ]وبر|بنزين|نقل/.test(n) && /بضا[عئ]|شراء|مورد|مصنع/.test(n)) return "trans";
    if(/مرتب|راتب/.test(n)) return "salary";
    if(/عمول|كوميشن/.test(n)) return "othervar";
    if(/اشتراك/.test(n)) return "subs";
    if(/معدات|فلاير|تفاعل|طابع|لوجو|ختم|رينج|ديكور|تصوير|(^|\s)خط(\s|$)/.test(n)) return "once";
    return "";
  }
  // النوع اللي اتسجّل بإيدك، وإلا المستنتج من البيان، وإلا «تاني»
  function expCat(c){
    if(c && EXP_CAT[c.cat]) return c.cat;
    // قديم: «متغيّر» اللي اخترته بإيدك زمان بيكسب على التخمين لو التخمين ثابت
    var g = expCatGuess(c && c.note);
    if(c && c.costKind === "var" && (!g || EXP_CAT[g].kind !== "var")) return "othervar";
    return g || "other";
  }
  function expCatSet(c){ return !!(c && EXP_CAT[c.cat]); }
  function costKindOf(c){ return EXP_CAT[expCat(c)].kind === "var" ? "var" : "fixed"; }
  function isVarCost(c){ return costKindOf(c) === "var"; }
  // المصاريف اللي نوعها مستنتج من البيان — الشاشة بتقولك تراجعها
  function unclassifiedExpenses(){
    return live("cash").filter(function(c){
      return c.type === "expense" && !expCatSet(c); }).length;
  }
