  /* ---------- إدارة المستخدمين والصلاحيات ---------- */
  var editUser = null;

  function renderUsers(){
    var st = document.getElementById("users-state");
    var lo = document.getElementById("b-logout");
    if(lo) lo.hidden = !lockOn();
    if(st) st.innerHTML = !lockOn()
      ? "مفيش قفل دلوقتي — أي حد يفتح اللينك يشوف كل حاجة. اعمل حسابك عشان تبدأ."
      : "داخل باسم <strong>" + esc((curUser()||{}).name || "—") + "</strong>.";

    var rows = users().map(function(u){
      var n = permCount(u), meNow = curUser() && curUser().id === u.id;
      var tags = [];
      if(u.money === false) tags.push("من غير أرباح");
      if(u.edit === false) tags.push("قراءة بس");
      return "<tr><td class='wide'>" + esc(u.name) +
          (meNow ? " <span class='pill'>إنت</span>" : "") +
          (tags.length ? "<span class='sub'>" + esc(tags.join(" · ")) + "</span>" : "") + "</td>" +
        "<td>" + (n >= PERM_KEYS.length ? "كل الشاشات"
          : (n ? esc(PERM_KEYS.filter(function(t){ return tabIn(u, t); }).map(function(t){ return TAB_NAME[t]; }).join(" · ")) : "مفيش")) + "</td>" +
        "<td class='rowacts'>" +
          "<button class='rowact' type='button' data-uedit='" + esc(u.id) + "'>تعديل</button>" +
          (meNow ? "" : "<button class='del' type='button' data-udel='" + esc(u.id) + "'>حذف</button>") +
        "</td></tr>";
    });
    table("t-users", ["الاسم","الشاشات",""], rows, "مفيش مستخدمين لسه.");
  }

  function openUser(id){
    editUser = id || null;
    var u = id ? users().find(function(x){ return x.id === id; }) : null;
    document.getElementById("user-title").textContent = u ? ("تعديل: " + u.name) : "مستخدم جديد";
    var fst = document.getElementById("us-first");
    if(fst) fst.hidden = !(!u && !users().length);
    document.getElementById("us-name").value = u ? u.name : "";
    document.getElementById("us-pin").value = "";
    document.getElementById("us-pinnote").hidden = !u;
    document.getElementById("us-money").checked = u ? (u.money !== false) : true;
    document.getElementById("us-edit").checked  = u ? (u.edit !== false)  : true;
    var tabsBox = document.getElementById("us-tabs");
    tabsBox.innerHTML = PERM_GROUPS.map(function(g){
      return "<div class='perm-g'><b>" + esc(g[0]) + "</b><div class='permgrid'>" + g[1].map(function(k){
        var on = u ? tabIn(u, k) : true;
        return "<label" + (TAB_MONEY[k] ? " class='perm-m'" : "") + "><input type='checkbox' data-ut='" + k + "'" + (on ? " checked" : "") + "> " +
          esc(TAB_NAME[k]) + (TAB_MONEY[k] ? "<sup title='محتاجة «يشوف الأرباح والتكاليف»'>¹</sup>" : k === "rep" ? "<sup>²</sup>" : "") + "</label>";
      }).join("") + "</div></div>";
    }).join("");
    tabsBox.classList.toggle("no-money", !document.getElementById("us-money").checked);
    document.getElementById("us-err").hidden = true;
    var box = document.getElementById("user-box");
    box.hidden = false; box.scrollIntoView({ block:"nearest" });
    document.getElementById("us-name").focus();
  }

  document.getElementById("b-user-new").addEventListener("click", function(){ openUser(null); });
  document.getElementById("b-user-cancel").addEventListener("click", function(){
    document.getElementById("user-box").hidden = true; editUser = null;
  });
  document.getElementById("t-users").addEventListener("click", function(e){
    var ed = e.target.closest("[data-uedit]");
    if(ed){ openUser(ed.dataset.uedit); return; }
    var dl = e.target.closest("[data-udel]");
    if(dl){
      var u = users().find(function(x){ return x.id === dl.dataset.udel; });
      if(!u) return;
      if(dl.dataset.armed !== "1"){
        dl.dataset.armed = "1"; dl.textContent = "متأكد؟";
        setTimeout(function(){ if(dl.dataset.armed === "1"){ dl.dataset.armed = ""; dl.textContent = "حذف"; } }, 4000);
        return;
      }
      u.deleted = true; u.at = Date.now();
      saveSoon("cash"); renderUsers(); applyPerms();
      toast("اتشال " + u.name);
    }
  });
  document.getElementById("user-box").addEventListener("click", function(e){
    var b = e.target.closest("[data-permset]"); if(!b) return;
    var mode = b.dataset.permset;
    var keep = { sales:["sales","ship","parties","inv","items"] }[mode];
    Array.prototype.forEach.call(document.querySelectorAll("#us-tabs [data-ut]"), function(c){
      c.checked = mode === "all" ? true : (mode === "none" ? false : keep.indexOf(c.dataset.ut) > -1);
    });
  });

  document.getElementById("us-money").addEventListener("change", function(){
    document.getElementById("us-tabs").classList.toggle("no-money", !this.checked);
  });
  document.getElementById("b-user-save").addEventListener("click", async function(){
    var err = document.getElementById("us-err");
    var name = squish(document.getElementById("us-name").value);
    var pin  = toEn(document.getElementById("us-pin").value).trim();
    var tabs = Array.prototype.filter.call(
      document.querySelectorAll("#us-tabs [data-ut]"), function(c){ return c.checked; })
      .map(function(c){ return c.dataset.ut; });
    if(tabs.indexOf("items") > -1) tabs.push("price");   // التسعير جوّه شاشة الأصناف
    var money = document.getElementById("us-money").checked;
    var edit  = document.getElementById("us-edit").checked;
    var u = editUser ? users().find(function(x){ return x.id === editUser; }) : null;

    if(!name){ err.textContent = "اكتب الاسم."; err.hidden = false; return; }
    if(!u && pin.length < 4){ err.textContent = "الرقم السري لازم ٤ أرقام على الأقل."; err.hidden = false; return; }
    if(pin && pin.length < 4){ err.textContent = "الرقم السري لازم ٤ أرقام على الأقل."; err.hidden = false; return; }
    if(!tabs.length){ err.textContent = "اختار شاشة واحدة على الأقل."; err.hidden = false; return; }
    /* ما ينفعش تقفل على نفسك بره: لازم يفضل حد واحد على الأقل يقدر
       يفتح الإعدادات، وإلا مفيش طريقة ترجّع الصلاحيات تاني. */
    var others = users().filter(function(x){ return !u || x.id !== u.id; });
    var stillAdmin = others.some(function(x){ return (x.tabs||[]).indexOf("backup") > -1; }) ||
                     tabs.indexOf("backup") > -1;
    if(!stillAdmin){
      /* الحالة الأولى مختلفة تمامًا: لسه مفيش ولا حساب، فاللي بيتعمل
         دلوقتي هو صاحب السيستم. الرسالة العامة مكانتش بتقول ده. */
      err.innerHTML = others.length === 0
        ? "<strong>ده أول حساب في السيستم — لازم يكون بتاعك إنت.</strong><br>" +
          "شاشة «الإعدادات» هي المكان الوحيد اللي بتتحكّم منه في المستخدمين والصلاحيات. " +
          "اعمل حسابك إنت الأول وسيب كل الشاشات متعلّمة، وبعد ما تدخل ضيف " +
          esc(name || "الموظف") + " بالصلاحيات اللي إنت عايزها."
        : "لازم يفضل حد واحد على الأقل يشوف «الإعدادات» — وإلا مش هتقدر ترجّع الصلاحيات تاني.";
      err.hidden = false; return;
    }

    if(!settings.users) settings.users = [];
    if(u){
      u.name = name; u.tabs = tabs; u.money = money; u.edit = edit; u.permV = 1; u.at = Date.now();
      if(pin) u.pin = await sha(pin);
    } else {
      var nu = { id: uid(), name: name, pin: await sha(pin),
                 tabs: tabs, money: money, edit: edit, permV: 1, at: Date.now() };
      settings.users.push(nu);
      // أول حساب يتعمل = اللي قاعد على الجهاز دلوقتي، يدخل على طول
      // وإلا القفل بيشتغل وهو بره وميقدرش يرجع
      if(!curUser()){
        authUser = nu.id;
        try{ if(LS) LS.setItem("naya:auth", nu.id); }catch(e){}
        me = nu.name;
        var mi2 = document.getElementById("me"); if(mi2) mi2.value = me;
        saveMe();
      }
    }
    saveSoon("cash");
    document.getElementById("user-box").hidden = true; editUser = null;
    renderUsers(); applyPerms(); renderAll();
    toast(u ? "اتعدّلت صلاحيات " + name : "اتضاف " + name);
  });
  document.getElementById("b-logout").addEventListener("click", lockOut);

