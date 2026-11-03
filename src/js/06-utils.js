  /* ---------- أدوات ---------- */
  // أيقونة من الـsprite اللي فوق في الصفحة
  function ico(id){ return "<svg class='i' aria-hidden='true'><use href='#i-" + id + "'/></svg>"; }
  function money(n){
    var v = Number(n)||0;
    return v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}) + " " + settings.currency;
  }
  function qty(n){
    var v = Number(n)||0;
    return v.toLocaleString("en-US",{maximumFractionDigits:3});
  }
  function today(){ return new Date().toISOString().slice(0,10); }
  /* ---------- ١) الأرقام العربية ----------
     كيبورد الموبايل العربي بيكتب ٠١٢٣. خانة type=number بترفضها
     وبتفضى من غير أي رسالة — الموظف بيكتب المبلغ ويلاقيه اختفى.
     بنحوّل الخانات لنص بكيبورد رقمي ونعرّب الأرقام وهو بيكتب. */
  function toEn(str){
    return String(str == null ? "" : str).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function(d){
      var c = d.charCodeAt(0);
      return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660);
    }).replace(/\u066B/g, ".").replace(/\u066C/g, "");   // الفاصلة العشرية والألفية العربية
  }
  // بتشيل المسافات الزيادة: «صنف  تجريبي» = «صنف تجريبي»
  function squish(s){ return String(s == null ? "" : s).trim().replace(/\s+/g, " "); }

  function numify(root){
    var list = (root || document).querySelectorAll('input[type="number"]');
    Array.prototype.forEach.call(list, function(el){
      el.type = "text";
      el.setAttribute("inputmode", "decimal");
      el.setAttribute("autocomplete", "off");
    });
  }
  // أي خانة رقمية — حتى لو اتولدت دلوقتي — بتتعرّب وهو بيكتب
  document.addEventListener("input", function(e){
    var el = e.target;
    if(!el || el.tagName !== "INPUT" || el.getAttribute("inputmode") !== "decimal") return;
    var raw = el.value;
    var fixed = toEn(raw).replace(/[^\d.\-]/g, "");
    if(fixed === raw) return;
    var pos = el.selectionStart;
    var cut = raw.length - fixed.length;
    el.value = fixed;
    try{ el.setSelectionRange(pos - cut, pos - cut); }catch(err){}
  }, true);

  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  var toastTimer;
  function toast(msg, ms){
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove("show"); }, ms || 2200);
  }
  function itemName(id){
    var it = db.items.find(function(x){ return x.id===id; });
    return it ? it.name : "—";
  }
  function partyName(id){
    var p = db.parties.find(function(x){ return x.id===id; });
    return p ? p.name : "—";
  }

