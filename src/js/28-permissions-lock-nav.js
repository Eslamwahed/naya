  /* ---------- تطبيق الصلاحيات على الواجهة ---------- */
  function firstAllowedTab(){
    var t = TABS.find(function(x){ return canTab(x[0]); });
    return t ? t[0] : "sales";
  }
  function applyPerms(){
    // القفل اتفعّل ومحدش داخل: شاشة الدخول هي اللي تظهر، مش شاشة فاضية
    if(lockOn() && !curUser()){ lockShow(); return; }
    document.body.classList.toggle("no-money", !canMoney());
    Array.prototype.forEach.call(document.querySelectorAll("#nav button[data-tab], [data-navgo]"), function(b){
      b.hidden = !canTab(b.dataset.tab || b.dataset.navgo) || (b.classList.contains("money-only") && !canMoney());
    });
    // التسعير صلاحية لوحدها: لو الأصناف مقفولة والتسعير مسموح، زرار التسعير بيظهر لوحده
    var pa = document.querySelector('#nav-sub button.nav-alias[data-tab="price"], #nav-sub button[data-tab="price"][data-wasalias]');
    if(pa){ var solo = !canTab("items") && canTab("price"); pa.classList.toggle("nav-alias", !solo); if(solo) pa.setAttribute("data-wasalias", "1"); }
    /* v173: جزء مسموح وشاشته الأصلية مقفولة (مثلاً «مراجع الحسابات» من غير «ماشي إزاي؟») — زراره يبان لوحده */
    var all = Array.prototype.slice.call(document.querySelectorAll("#nav-sub button[data-mark]"));
    all.forEach(function(x){ if(x.hasAttribute("data-wasmark")){ x.classList.add("nav-alias"); x.removeAttribute("data-wasmark"); if(x.dataset.lbl){ x.textContent = x.dataset.lbl; delete x.dataset.lbl; } } });
    all.forEach(function(x){
      if(x.hidden) return;
      var m = x.dataset.mark.split("|"), main = Array.prototype.slice.call(document.querySelectorAll("#nav-sub button[data-tab]")).find(function(y){
        return y.dataset.tab === m[0] && (y.dataset.sub || "") === (m[1] || "") && !y.classList.contains("nav-alias"); });
      if(main && main.hidden && !all.some(function(z){ return z !== x && z.dataset.mark === x.dataset.mark && z.hasAttribute("data-wasmark"); })){
        x.classList.remove("nav-alias"); x.setAttribute("data-wasmark", "1"); x.dataset.lbl = x.textContent; x.textContent = main.textContent; }
    });
    navPerms();
    // لو إنت واقف على شاشة مش من حقك، ارجع لأول شاشة مسموحة
    if(!canTab(activeTab)){
      var t = firstAllowedTab();
      var btn = document.querySelector('#nav button[data-tab="'+t+'"]');
      if(btn) btn.click();
    }
    var w = document.getElementById("me");
    if(w){ w.readOnly = lockOn(); w.title = lockOn() ? "الاسم بيتحدد من حسابك" : ""; }
    meLab();
  }

  /* ---------- شاشة القفل ---------- */
  function lockShow(){
    var box = document.getElementById("lock");
    if(!box) return;
    if(!lockOn()){ box.hidden = true; document.body.classList.remove("no-money"); return; }
    if(curUser()){ box.hidden = true; return; }
    if(typeof closePrt === "function") closePrt();          // تقرير الشركاء ما يفضلش مفتوح ورا القفل
    box.hidden = false;
    document.getElementById("lock-first").hidden = true;
    document.getElementById("lock-pin").hidden = true;
    var pick = document.getElementById("lock-pick");
    pick.hidden = false;
    pick.innerHTML = users().map(function(u){
      var n = permCount(u);
      return "<button class='pickbtn' type='button' data-lu='" + esc(u.id) + "'>" + esc(u.name) +
        "<small>" + (n >= PERM_KEYS.length ? "كل الشاشات" : qty(n) + " شاشة") +
        (u.money === false ? " · من غير أرباح" : "") + "</small></button>";
    }).join("");
  }
  function lockFirstRun(){
    var box = document.getElementById("lock");
    if(!box) return;
    box.hidden = false;
    document.getElementById("lock-pick").hidden = true;
    document.getElementById("lock-pin").hidden = true;
    document.getElementById("lock-first").hidden = false;
    document.getElementById("lock-hint").textContent = "أول مرة — اعمل حسابك.";
    var f = document.getElementById("lf-name"); if(f) f.focus();
  }
  var lockPicked = null;
  document.getElementById("lock-pick").addEventListener("click", function(e){
    var b = e.target.closest("[data-lu]"); if(!b) return;
    lockPicked = b.dataset.lu;
    var u = users().find(function(x){ return x.id === lockPicked; });
    document.getElementById("lock-pick").hidden = true;
    document.getElementById("lock-pin").hidden = false;
    document.getElementById("lock-who").textContent = u ? u.name : "";
    document.getElementById("lock-err").hidden = true;
    var c = document.getElementById("lock-code"); c.value = ""; c.focus();
  });
  document.getElementById("b-lock-back").addEventListener("click", lockShow);
  async function lockTry(){
    var u = users().find(function(x){ return x.id === lockPicked; });
    var err = document.getElementById("lock-err");
    if(!u){ lockShow(); return; }
    var code = toEn(document.getElementById("lock-code").value).trim();
    var h = await sha(code);
    if(h !== u.pin){
      err.textContent = "الرقم السري غلط."; err.hidden = false;
      var c = document.getElementById("lock-code"); c.value = ""; c.focus();
      return;
    }
    authUser = u.id;
    try{ if(LS) LS.setItem("naya:auth", u.id); }catch(e){}
    me = u.name;
    var mi = document.getElementById("me"); if(mi) mi.value = me;
    saveMe();
    document.getElementById("lock").hidden = true;
    applyPerms(); renderAll(); renderUsers();
    toast("أهلاً " + u.name);
  }
  document.getElementById("b-lock-in").addEventListener("click", lockTry);
  document.getElementById("lock-code").addEventListener("keydown", function(e){
    if(e.key === "Enter"){ e.preventDefault(); lockTry(); }
  });
  document.getElementById("b-lock-create").addEventListener("click", async function(){
    var n = squish(document.getElementById("lf-name").value);
    var pin = toEn(document.getElementById("lf-pin").value).trim();
    var err = document.getElementById("lf-err");
    if(!n){ err.textContent = "اكتب اسمك."; err.hidden = false; return; }
    if(pin.length < 4){ err.textContent = "الرقم السري لازم ٤ أرقام على الأقل."; err.hidden = false; return; }
    if(!settings.users) settings.users = [];
    settings.users.push({ id: uid(), name: n, pin: await sha(pin),
      tabs: TABS.map(function(t){ return t[0]; }), money:true, edit:true, permV:1, at: Date.now() });
    authUser = settings.users[settings.users.length-1].id;
    try{ if(LS) LS.setItem("naya:auth", authUser); }catch(e){}
    me = n;
    var mi = document.getElementById("me"); if(mi) mi.value = me;
    saveMe(); saveSoon("cash");
    document.getElementById("lock").hidden = true;
    applyPerms(); renderAll(); renderUsers();
    toast("اتعمل حسابك — دلوقتي تقدر تضيف باقي الفريق من الإعدادات");
  });
  function lockOut(){
    authUser = null;
    try{ if(LS) LS.removeItem("naya:auth"); }catch(e){}
    lockShow();
  }


  /* ---------- البحث عن أوردر ---------- */
  /* ---------- تنقّل ---------- */
  document.getElementById("nav").addEventListener("click", function(e){
    var b = e.target.closest("button[data-tab]");
    if(!b) return;
    if(openEntryKey) closeEntry(true);      // درج مفتوح؟ يتقفل مع تغيير التبويب
    if(SD_OPEN) closeDrawer();
    // جزء من شاشة (عملاء/موردين · قسم تحليل): بيتحدد قبل ما الشاشة تترسم وقبل القسم
    // نفس الجزء المفتوح (openPartyCard مثلاً) → الكارت المفتوح يفضل مفتوح
    var ptChanged = false;
    if(b.dataset.sub && b.dataset.tab === "parties" && ptTab !== b.dataset.sub){ ptTab = b.dataset.sub; ptOnly = "all"; ptOpen = null; ptChanged = true; }
    if(b.dataset.sub && b.dataset.tab === "rep" && REP_TABS.indexOf(b.dataset.sub) >= 0) repTab = b.dataset.sub;
    activeTab = b.dataset.tab;
    navSync(b.dataset.tab);
    // بتتقرا من الـDOM بدل قايمة ثابتة بتتنسى مع كل تبويب جديد
    Array.prototype.forEach.call(document.querySelectorAll("main > section[id^='tab-']"), function(sec){
      sec.hidden = (sec.id !== "tab-" + b.dataset.tab);
    });
    showTab(b.dataset.tab);          // يترسم دلوقتي لو كان محتاج
    if(ptChanged && !dirtyTabs.parties) renderPartyCards();
    if(b.dataset.sub && b.dataset.tab === "rep") setRepTab(b.dataset.sub);
    navMark();
    tabEnter(document.getElementById("tab-" + b.dataset.tab));
    window.scrollTo(0,0);
  });

  /* ---------- الأقسام الخمسة ----------
     كل شاشة ليها قسم (data-grp على زرارها). القسم المفتوح بيوري شاشاته
     بس، والقسم اللي فيه شاشة واحدة (الرئيسية · الأوردرات) مالوش شريط
     فرعي. دوسة على قسم بترجّعك لآخر شاشة كنت فيها جوّاه. */
  var navLast = {};
  /* v132: زرار الشاشة في الشريط — نفس الشاشة ممكن يبقى ليها أكتر من زرار (العملاء والموردين
     نفس الشاشة · أقسام التحليل)، فبنختار حسب الجزء المفتوح دلوقتي. */
  function navSubOf(tab){ return tab === "rep" ? repTab : tab === "parties" ? ptTab : ""; }
  function navBtnFor(tab){
    var bs = Array.prototype.slice.call(document.querySelectorAll("#nav-sub button[data-tab]")), sub = navSubOf(tab);
    return navMarkOf(bs.find(function(b){ return b.dataset.tab === tab && b.dataset.sub && b.dataset.sub === sub; })
        || bs.find(function(b){ return b.dataset.tab === tab && !b.dataset.sub && !b.classList.contains("nav-alias"); })
        || bs.find(function(b){ return b.dataset.also === tab; })
        || bs.find(function(b){ return b.dataset.tab === tab; }), bs);
  }
  /* v173: جزء من شاشة (الرسمة · العملاء والمحافظات · المدير المالي · الموردين…) زراره مخفي،
     والزرار اللي بيتعلّم في الشريط هو بتاع الشاشة اللي هو جزء منها (data-mark = "tab|sub") */
  function navMarkOf(b, bs){
    if(!b || !b.dataset.mark || !b.classList.contains("nav-alias")) return b;
    var m = b.dataset.mark.split("|");
    var main = bs.find(function(x){ return x.dataset.tab === m[0] && (x.dataset.sub || "") === (m[1] || "") && !x.classList.contains("nav-alias"); });
    // الشاشة الأصلية مقفولة على المستخدم ده؟ الزرار اللي بيقوم مقامها (بنفس الاسم) هو اللي يتعلّم
    if(main && main.hidden) return bs.find(function(x){ return x.dataset.mark === b.dataset.mark && x.hasAttribute("data-wasmark"); }) || b;
    return main || b;
  }
  // المفتاح تحت العنوان: أجزاء الشاشة الواحدة — كل جزء = زرار في الشريط (ظاهر أو مخفي)
  var SEGS = {
    inc:[["rep", "sum", "جدول"], ["viz", "", "رسمة"]],
    perf:[["rep", "items", "الأصناف"], ["rep", "cust", "العملاء والمحافظات"], ["rep", "team", "الفريق"]],
    coach:[["coach", "", "مؤشراتك"], ["rep", "cfo", "القرارات والمخاطر"], ["audit", "", "الحسابات سليمة؟"]],
    buy:[["purch", "", "الفواتير"], ["parties", "supplier", "الموردين"]]
  };
  function segOf(tab){
    if(tab === "rep") return { sum:"inc", items:"perf", cust:"perf", team:"perf", cfo:"coach" }[repTab] || "";
    if(tab === "viz") return "inc";
    if(tab === "coach" || tab === "audit") return "coach";
    if(tab === "purch") return "buy";
    if(tab === "parties") return ptTab === "supplier" ? "buy" : "";
    return "";
  }
  function segBtn(x){
    return Array.prototype.slice.call(document.querySelectorAll("#nav-sub button[data-tab]")).find(function(b){
      return b.dataset.tab === x[0] && (b.dataset.sub || "") === x[1]; });
  }
  function renderSeg(tab){
    var box = document.querySelector("#tab-" + tab + " .pseg"); if(!box) return;
    var cur = tab === "rep" ? repTab : tab === "parties" ? ptTab : "";
    var L = (SEGS[segOf(tab)] || []).filter(function(x){ var b = segBtn(x); return b && !b.hidden; });
    box.hidden = L.length < 2;
    box.innerHTML = box.hidden ? "" : L.map(function(x){
      var on = x[0] === tab && (!x[1] || x[1] === cur);
      return "<button type='button' data-seggo='" + x[0] + "|" + x[1] + "' aria-pressed='" + on + "'>" + esc(x[2]) + "</button>";
    }).join("");
  }
  document.addEventListener("click", function(e){
    var t = e.target.closest ? e.target.closest("[data-seggo]") : null; if(!t || t.getAttribute("aria-pressed") === "true") return;
    var b = segBtn(t.dataset.seggo.split("|")); if(b) b.click();
    var n = document.querySelector("#tab-" + activeTab + " .pseg [aria-pressed='true']"); if(n) n.focus();
  });
  // الزرار اللي بيفتح الشاشة نفسها (حتى لو مخفي زي التسعير والإعدادات) — للـgoTab وللرجوع لآخر شاشة
  function navGoBtn(tab){
    var bs = Array.prototype.slice.call(document.querySelectorAll("#nav-sub button[data-tab]")), sub = navSubOf(tab);
    return bs.find(function(b){ return b.dataset.tab === tab && b.dataset.sub && b.dataset.sub === sub; })
        || bs.find(function(b){ return b.dataset.tab === tab && !b.dataset.sub; })
        || bs.find(function(b){ return b.dataset.tab === tab; });
  }
  function navMark(){
    var cur = navBtnFor(activeTab);
    renderSeg(activeTab);
    Array.prototype.forEach.call(document.querySelectorAll("#nav button[data-tab]"), function(x){
      x.setAttribute("aria-current", x === cur ? "true" : "false");
    });
    // الموبايل: الشريط الفرعي بيتسحب بالعرض — الزرار المختار يبان في النص لو كان بره الشاشة
    var sub = document.getElementById("nav-sub");
    if(cur && sub && sub.scrollWidth > sub.clientWidth + 1 && sub.scrollBy){
      var r = cur.getBoundingClientRect(), sr = sub.getBoundingClientRect();
      if(r.width && (r.left < sr.left || r.right > sr.right))
        sub.scrollBy({ left:(r.left + r.width / 2) - (sr.left + sr.width / 2) });
    }
  }
  function grpOf(tab){
    var b = navBtnFor(tab);
    return b ? b.dataset.grp : "home";
  }
  function navSync(tab){
    tab = tab || activeTab;
    var g = grpOf(tab);
    navLast[g] = navGoBtn(tab);
    Array.prototype.forEach.call(document.querySelectorAll("#nav-groups button[data-group]"), function(x){
      x.classList.toggle("on", x.dataset.group === g);
      x.setAttribute("aria-selected", x.dataset.group === g ? "true" : "false");
    });
    var shown = 0;
    Array.prototype.forEach.call(document.querySelectorAll("#nav-sub button[data-tab]"), function(x){
      var mine = x.dataset.grp === g;
      x.classList.toggle("grp-off", !mine);
      if(mine && !x.hidden && !x.classList.contains("nav-alias")) shown++;
    });
    var sub = document.getElementById("nav-sub");
    if(sub) sub.classList.toggle("solo", shown <= 1);
  }
  // القسم بيختفي لو ولا شاشة فيه من حقك
  function navPerms(){
    Array.prototype.forEach.call(document.querySelectorAll("#nav-groups button[data-group]"), function(x){
      x.hidden = !document.querySelector('#nav-sub button[data-grp="' + x.dataset.group + '"]:not([hidden]):not(.nav-alias)');
    });
    navSync(activeTab);
  }
  // الرقم الأحمر على «الأوردرات» = نفس عدّاد «محتاج مني حاجة» في شاشة المبيعات
  function navBadge(){
    var el = document.getElementById("nav-badge");
    if(!el) return;
    var n = canTab("sales") ? live("sales").filter(function(x){ return !orderStep(x).done; }).length : 0;
    el.hidden = !n;
    el.textContent = n > 99 ? "99+" : String(n);
  }
  document.getElementById("nav-groups").addEventListener("click", function(e){
    var gb = e.target.closest("button[data-group]"); if(!gb) return;
    var g = gb.dataset.group, want = navLast[g];
    var btn = want && !want.hidden && want.dataset.grp === g ? want : null;
    if(!btn) btn = document.querySelector('#nav-sub button[data-grp="' + g + '"]:not([hidden]):not(.nav-alias)');
    // أول مرة تفتح «التحليل» بعد ما تفتح السيستم: آخر قسم كنت فيه (naya:rtab) مش أول قسم
    if(btn && btn.dataset.sub && btn.dataset.tab === "rep"){ var rb = navBtnFor("rep"); if(rb && !rb.hidden) btn = rb; }
    if(btn) btn.click();
  });

