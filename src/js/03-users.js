  /* ---------- المستخدمين والصلاحيات ----------
     قفل على مستوى الواجهة: بيمنع الفضول والغلط، مش بيمنع حد بيفهم
     في التقنية من إنه يفتح أدوات المتصفح ويشوف الداتا. الأمان الحقيقي
     محتاج سيرفر بيتحقق قبل ما يبعت. مكتوب ده للمستخدم في الإعدادات.
     لو مفيش مستخدمين مسجّلين، البرنامج بيشتغل من غير قفل زي الأول. */
  var TABS = [
    ["dash","الرئيسية"],
    ["sales","الأوردرات"],["ship","شركات الشحن"],["parties","العملاء والموردين"],
    ["inv","المخزون"],["items","الأصناف والتسعير"],["price","التسعير"],["purch","المشتريات"],
    ["cash","الخزنة"],["capital","الشركاء"],["prepaid","المدفوع مقدّماً"],
    ["rep","قايمة الدخل والتقارير"],["viz","رسومات"],["coach","ماشي إزاي؟"],["audit","مراجع الحسابات"],
    ["log","سجل الحركات"],["backup","الإعدادات"]
  ];
  var TAB_NAME = {}; TABS.forEach(function(t){ TAB_NAME[t[0]] = t[1]; });
  /* v167: خانات الصلاحيات بنفس أقسام القايمة. «التسعير» جوّه «الأصناف والتسعير» فمالهاش خانة —
     بتتحفظ مع الأصناف. */
  var PERM_GROUPS = [
    ["الرئيسية", ["dash"]], ["الأوردرات", ["sales", "ship", "parties"]], ["البضاعة", ["inv", "items", "purch"]],
    ["الفلوس", ["cash", "capital", "prepaid"]], ["التقارير", ["rep", "viz", "coach", "audit"]], ["من قايمة اسمك", ["log", "backup"]]
  ];
  var PERM_KEYS = TABS.map(function(t){ return t[0]; }).filter(function(k){ return k !== "price"; });
  function permCount(u){ return (u.tabs || []).filter(function(t){ return PERM_KEYS.indexOf(t) > -1; }).length; }
  var authUser = null;                  // المستخدم الداخل دلوقتي

  function users(){ return (settings.users || []).filter(function(u){ return !u.deleted; }); }
  function lockOn(){ return users().length > 0; }
  function curUser(){
    if(!lockOn()) return null;
    if(!authUser) return null;
    return users().find(function(u){ return u.id === authUser; }) || null;
  }
  /* شاشة جديدة اتضافت بعد ما المستخدمين اتعملوا: صلاحياتهم المتخزّنة
     مافيهاش اسمها، فكانوا هيلاقوها مختفية من غير سبب. بنورّثها من
     الشاشة اللي هي جزء منها. */
  var TAB_FROM = { price:"items", coach:"rep", viz:"rep", prepaid:"cash", audit:"rep" };
  /* شاشات كلها تكلفة وربح من أول سطر لآخر سطر — مينفعش تتفتح لحد
     الأرباح مخفية عنه، حتى لو التبويب متعلّم له. إخفاء أعمدة واحد
     واحد بيسيب تسريب أول ما يتضاف عمود جديد. */
  var TAB_MONEY = { price:1, coach:1, viz:1, prepaid:1, audit:1 };
  function canTab(t){
    if(!lockOn()) return true;
    var u = curUser();
    if(!u) return false;
    if(TAB_MONEY[t] && !canMoney()) return false;
    return tabIn(u, t);
  }
  /* اللي اتحفظ من v167 (permV) كل خانة فيه لوحدها — القديم بيورّث الشاشة من اللي هي جزء منها لحد ما يتحفظ.
     التسعير جزء من شاشة الأصناف فبيمشي معاها دايماً. */
  function tabIn(u, t){
    var list = u.tabs || [];
    if(list.indexOf(t) > -1) return true;
    return !!TAB_FROM[t] && list.indexOf(TAB_FROM[t]) > -1 && (!u.permV || t === "price");
  }
  // الأرباح والتكاليف — بتتخفي من جوّه الشاشات المسموحة كمان
  function canMoney(){
    if(!lockOn()) return true;
    var u = curUser(); return !!u && u.money !== false;
  }
  function canEdit(){
    if(!lockOn()) return true;
    var u = curUser(); return !!u && u.edit !== false;
  }

  // تشفير الرقم السري — عشان ما يتخزّنش مكشوف
  async function sha(txt){
    try{
      var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("naya:" + txt));
      return Array.prototype.map.call(new Uint8Array(buf), function(b){
        return b.toString(16).padStart(2,"0"); }).join("");
    }catch(e){
      // متصفح قديم أو صفحة مش آمنة: تجزئة بسيطة — أضعف بس أحسن من نص مكشوف
      var h = 5381; txt = "naya:" + txt;
      for(var i=0;i<txt.length;i++) h = ((h<<5) + h + txt.charCodeAt(i)) >>> 0;
      return "x" + h.toString(16);
    }
  }
  var statementFor = null;

