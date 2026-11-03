  /* ================= شاشة رأس المال ================= */

  function renderCapStats(){
    var el = document.getElementById("cap-stats");
    if(!el) return;
    var cap = totalCapital(), cur = partners().reduce(function(a,p){ return a + currentOf(p.id); },0);
    var ret = retainedEarnings();
    var cells = [
      ["رأس المال الكلي", money(cap), "", qty(partners().length) + " شريك"],
      ["أرباح محتجزة", money(ret), ret>0.009?"v-gain":(ret<-0.009?"v-due":""),
        ret>0.009 ? "متاحة للتوزيع" : (ret<-0.009 ? "خسارة لازم تتغطّى الأول" : "لسه مفيش ربح يتوزّع")],
      ["أرباح مستحقة للشركاء", money(cur), cur>0?"v-due":"", "استحقوها ولسه ما أخدوهاش"],
      ["رصيد الخزنة", money(cashBox()), cashBox()>=0?"":"v-due", "سقف الصرف النقدي"]
    ];
    el.innerHTML = cells.map(function(c){
      return "<div><span>"+esc(c[0])+"</span><strong class='num "+c[2]+"'>"+esc(c[1])+"</strong>" +
        "<small>"+esc(c[3])+"</small></div>";
    }).join("");
  }

  /* ---------- شارة الميزانية وكارت لكل شريك ----------
     الجدول القديم والسجل والشرح لسه موجودين تحت في «جدول الشركاء وسجل كل
     الحركات». الكروت بتقرا من نفس الدوال (capitalOf/currentOf/ratioOf)،
     فالأرقام هي هي. */
  var CAP_CLR = ["#4A2545","#B07AA1","#7FA68F","#C8963E","#5B7DB1","#9A1333"];
  function capClr(i){ return CAP_CLR[i % CAP_CLR.length]; }
  var capOpen = null;       // الشريك المفتوح حركاته في الكارت
  function capPct(r){ return (r*100).toFixed(2).replace(/\.?0+$/, "") + "%"; }
  // أثر كل نوع حركة: علامة ولون والرصيد اللي اتأثّر
  var CAP_FX = {
    cap_in:       ["+", "v-gain", "رأس ماله"],
    cap_out:      ["−", "v-due",  "رأس ماله"],
    cap_share:    ["+", "v-gain", "أرباح ليه"],
    cap_payout:   ["−", "v-due",  "أرباحه · خدها كاش"],
    cap_reinvest: ["+", "v-gain", "رأس ماله · من أرباحه"],
    cap_repay:    ["−", "v-due",  "رجّعناله مصروف دفعه من جيبه"]
  };

  function renderCapRecon(){
    var el = document.getElementById("cap-recon");
    if(!el) return;
    var det = document.getElementById("cap-recon-more");
    var a = netAssets(), e = totalEquity(), d = a - e, ok = Math.abs(d) < 0.01;
    el.className = "cap-recon " + (ok ? "ok" : "bad");
    el.innerHTML = "<span class='ic' aria-hidden='true'>" + (ok ? "✓" : "⚠") + "</span><span class='t'>" +
      (ok ? "<b>الميزانية مظبوطة</b><small>كل اللي عندك (خزنة + بضاعة + فلوس عند شركات الشحن والعملاء) = " +
              "<span class='num'>" + esc(money(a)) + "</span> = فلوس الشركاء + الأرباح</small>"
          : "<b>في فرق <span class='num'>" + esc(money(Math.abs(d))) + "</span></b>" +
            "<small>في حاجة مش متسجّلة صح — غالباً رصيد افتتاحي أو حركة نوعها غلط. افتح التفاصيل وشوف البنود.</small>") +
      "</span><button type='button' data-capreconx>" +
      (det && det.open ? "اقفل التفاصيل ▴" : "وريني التفاصيل ▾") + "</button>";
  }

  function capMoveRow(c){
    var fx = CAP_FX[c.type], a = Number(c.amount)||0;
    var note = c.note && c.note !== CAP[c.type].label ? c.note : "";
    return "<div class='cpc-r'><span class='d num'>" + esc(dShort(c.date)) + "</span>" +
      "<span>" + esc(CAP[c.type].label) + "<span class='sub'>" + esc(fx[2]) + (note ? " · " + esc(note) : "") + "</span></span>" +
      "<b class='num " + fx[1] + "'>" + fx[0] + esc(money(a)) + "</b>" +
      "<span class='x'>" + (c.distId
        ? "<span class='sub'>من توزيع</span>"
        : "<button class='del' type='button' style='color:var(--teal)' data-editcap='" + c.id + "'>تعديل</button>") +
        "<button class='del' type='button' data-del='cash' data-id='" + c.id + "'>حذف</button></span></div>";
  }

  function renderCapCards(){
    var box = document.getElementById("cap-cards"), own = document.getElementById("cap-own");
    if(!box || !own) return;
    var ps = partners(), tot = totalCapital();
    if(!ps.length){
      own.innerHTML = "";
      box.innerHTML = "<div class='cd-empty' style='grid-column:1 / -1'>مفيش شركاء لسه — اضغط «+ حركة رأس مال» فوق، وجوه الدرج هتلاقي «+ شريك».</div>";
      return;
    }
    own.innerHTML = tot > 0.009
      ? "<div class='cap-bar'>" + ps.map(function(p, i){
          var r = ratioOf(p.id);
          return r > 0 ? "<i style='width:" + (r*100) + "%;background:" + capClr(i) + "'></i>" : "";
        }).join("") + "</div><div class='cap-lg'>" + ps.map(function(p, i){
          return "<span><em style='background:" + capClr(i) + "'></em>" + esc(p.name) + " " + capPct(ratioOf(p.id)) + "</span>";
        }).join("") + "</div>"
      : "";
    if(capOpen && !ps.some(function(p){ return p.id === capOpen; })) capOpen = null;
    box.innerHTML = ps.map(function(p, i){
      var cap = capitalOf(p.id), cur = currentOf(p.id), r = ratioOf(p.id);
      var mv = capMoves(p.id).slice().sort(function(a, b){
        if((a.date||"") !== (b.date||"")) return (a.date||"") < (b.date||"") ? 1 : -1;
        return (b.at||0) - (a.at||0);
      });
      var st = capStartOf(p.id), open = capOpen === p.id && mv.length;
      var sub = (st ? "شريك من " + dShort(st) : "لسه ما دفعش رأس مال") +
        (mv.length ? " · " + nMoves(mv.length) : "") + (p.phone ? " · " + p.phone : "");
      return "<div class='cpc' data-cpc='" + p.id + "'>" +
        "<div class='cpc-h'><span class='av' style='background:" + capClr(i) + "'>" + esc((p.name||"؟").charAt(0)) + "</span>" +
          "<span class='nm'><b>" + esc(p.name) + "</b><span class='sub'>" + esc(sub) + "</span></span>" +
          "<span class='pcnt'><b class='num'>" + capPct(r) + "</b><small>نسبته دلوقتي</small></span></div>" +
        "<div class='cpc-st'>" +
          "<div><small>رأس ماله</small><b class='num'>" + esc(money(cap)) + "</b></div>" +
          "<div><small>أرباح ليه لسه ما أخدهاش</small><b class='num" + (cur > 0.009 ? " v-gain" : "") + "'>" + esc(money(cur)) + "</b></div>" +
          "<div><small>إجمالي حقه</small><b class='num'>" + esc(money(cap + cur)) + "</b></div></div>" +
        (owedOf(p.id) > 0.009 ? "<div class='cpc-owe'><span>الشركة عليها له <b class='num'>" + esc(money(owedOf(p.id))) + "</b><small>مصاريف دفعها من جيبه — مش جزء من رأس ماله ولا أرباحه</small></span>" +
          "<button class='tbtn primary' type='button' data-capdo='cap_repay|" + p.id + "'>رجّعله من الخزنة</button></div>" : "") +
        "<div class='cpc-a'>" +
          "<button class='tbtn' type='button' data-capdo='cap_in|" + p.id + "'>+ دفع رأس مال</button>" +
          "<button class='tbtn' type='button' data-capdo='cap_out|" + p.id + "'" + (cap > 0.009 ? "" : " disabled") + ">سحب من رأس ماله</button>" +
          "<button class='tbtn' type='button' data-capdo='cap_payout|" + p.id + "'" + (cur > 0.009 ? "" : " disabled title='مفيش أرباح ليه لسه ما أخدهاش'") + ">صرف أرباحه</button>" +
          "<button class='tbtn lnk' type='button' data-editpartner='" + p.id + "'>الاسم</button>" +
          (mv.length
            ? "<button class='tbtn lnk' type='button' data-capopen='" + p.id + "' aria-expanded='" + (open ? "true" : "false") + "'>حركاته " + (open ? "▴" : "▾") + "</button>"
            : "<button class='tbtn lnk' type='button' style='color:var(--due)' data-delpartner='" + p.id + "'>حذف</button>") +
        "</div>" +
        (open ? "<div class='cpc-tl'><h4>حركات " + esc(p.name) + "</h4>" + mv.map(capMoveRow).join("") + "</div>" : "") +
      "</div>";
    }).join("");
  }

  /* ---------- خطوات التوزيع ---------- */
  function setDistStep(n){
    var sp = document.querySelectorAll("#dist-steps span");
    sp.forEach(function(x, i){
      x.className = (n >= 3 || i < n - 1) ? "done" : (i === n - 1 ? "on" : "");
    });
    if(n < 3){ var dn = document.getElementById("dist-done"); if(dn) dn.hidden = true; }
  }
  function distPerRange(k){
    if(k === "month") return monthRange(0);
    if(k === "prev")  return monthRange(-1);
    return { from: earliestDate(), to: today() };
  }
  // الزرار يبان متعلّم لو التاريخين مطابقين له بالظبط
  function distPerSync(){
    var f = document.getElementById("dist-from").value, t = document.getElementById("dist-to").value;
    var hit = false;
    document.querySelectorAll("#dist-per [data-distper]").forEach(function(b){
      var r = distPerRange(b.dataset.distper);
      var on = !hit && r.from === f && r.to === t;   // أول زرار مطابق بس
      if(on) hit = true;
      b.classList.toggle("on", on);
    });
  }

  function capMoves(pid){
    return live("cash").filter(function(c){ return isCapType(c.type) && c.partyId === pid; });
  }
  function renderPartners(){
    var ps = partners();
    var rows = ps.map(function(p){
      var cap = capitalOf(p.id), cur = currentOf(p.id), r = ratioOf(p.id);
      var n = capMoves(p.id).length;
      return "<tr data-caplog='"+p.id+"' title='وريني حركاته'>" +
          "<td class='wide' style='cursor:pointer'>"+esc(p.name)+
          (p.phone ? "<span class='sub'>"+esc(p.phone)+"</span>" : "")+"</td>"+
        "<td class='num'>"+money(cap)+"</td>"+
        "<td class='num'>"+(r*100).toFixed(2)+"%</td>"+
        "<td class='num "+(cur>0?"v-gain":"")+"'>"+money(cur)+"</td>"+
        "<td class='num' style='font-weight:600'>"+money(cap+cur)+"</td>"+
        "<td class='acts'><button class='del' style='color:var(--teal)' data-editpartner='"+p.id+"'>الاسم</button>"+
          (n ? "<button class='del' style='color:var(--teal)' data-editamt='"+p.id+"'>المبالغ</button>"
             : "<button class='del' data-delpartner='"+p.id+"'>حذف</button>")+"</td></tr>";
    });
    table("t-partners", ["الشريك","رأس ماله","نسبته","أرباح مستحقة له","إجمالي حقه","تعديل"], rows,
      "مفيش شركاء لسه — اضغط «+ حركة رأس مال» فوق، وجوه الدرج هتلاقي «+ شريك».");
  }

  function renderRecon(){
    var a = netAssets(), e = totalEquity(), d = a - e;
    /* شاشة المخزون بتعرض «الكمية × المتوسط الحالي»، والدفاتر بتعرض
       «اللي اشتريته − اللي خرج تكلفة». الاتنين بيختلفوا لما تشتري نفس
       الصنف تاني بسعر مختلف بعد ما بعت منه — فبنكتب الفرق بند صريح
       بدل ما الرقمين يتعارضوا من غير تفسير. */
    var gap = stockBookValue() - stockAtAvg();
    var rows = [
      ["الخزنة", cashBox(), ""],
      ["محافظ شركات الشحن", walletsTotal(), ""],
      ["المخزون (بالمتوسط الحالي)", stockAtAvg(), ""]
    ];
    if(Math.abs(gap) >= 0.01)
      rows.push(["فرق تكلفة مثبّتة وقت البيع", gap, ""]);
    rows = rows.concat([
      ["صافي أرصدة العملاء والموردين", reconDues(), ""],
      ["صافي الأصول", a, "tot"],
      ["رأس المال", totalCapital(), ""],
      ["أرباح مستحقة للشركاء", partners().reduce(function(x,p){ return x + currentOf(p.id); },0), ""],
      ["الأرباح المحتجزة", retainedEarnings(), ""],
      ["صافي الأصول الافتتاحية", openingEquity(), ""],
      ["حقوق الملكية", e, "tot"],
      ["الفرق", d, "diff"]
    ]).map(function(x){
      var cls = x[2]==="diff" ? (Math.abs(x[1])<0.01 ? "v-gain" : "v-due") : "";
      var w = x[2]==="tot" || x[2]==="diff" ? "font-weight:600" : "";
      return "<tr"+(x[2]==="tot"?" style='background:var(--teal-soft)'":"")+
        "><td class='wide' style='"+w+"'>"+esc(x[0])+"</td>"+
        "<td class='num "+cls+"' style='"+w+"'>"+money(x[1])+
        (x[2]==="diff" ? (Math.abs(x[1])<0.01 ? " ✓" : " ⚠") : "")+"</td></tr>";
    });
    table("t-recon", ["البند","القيمة"], rows, "");
  }
  function reconDues(){ return duesNet(); }

  var capLogFor = null;      // فلتر السجل على شريك واحد

  function renderCapLog(){
    var rows = live("cash").filter(function(c){
        return isCapType(c.type) && (!capLogFor || c.partyId === capLogFor); })
      .slice().sort(function(a,b){
        if((a.date||"") !== (b.date||"")) return (a.date||"") < (b.date||"") ? 1 : -1;
        return (b.at||0) - (a.at||0);
      })
      .map(function(c){
        var d = CAP[c.type], a = Number(c.amount)||0;
        return "<tr><td class='num'>"+esc(c.date||"—")+"</td>"+
          "<td class='wide'>"+esc(partyName(c.partyId))+"</td>"+
          "<td>"+esc(d.label)+(c.note?"<span class='sub'>"+esc(c.note)+"</span>":"")+"</td>"+
          "<td class='num "+(d.capital>0?"v-gain":(d.capital<0?"v-due":""))+"'>"+
            (d.capital ? (d.capital>0?"+":"−")+money(a) : "—")+"</td>"+
          "<td class='num "+(d.current>0?"v-gain":(d.current<0?"v-due":""))+"'>"+
            (d.current ? (d.current>0?"+":"−")+money(a) : "—")+"</td>"+
          "<td>"+(c.distId
            ? "<span style='font-size:var(--fs-1);color:var(--ink-soft)'>من توزيع</span>"
            : "<button class='del' style='color:var(--teal)' data-editcap='"+c.id+"'>تعديل</button>")+"</td>"+
          "<td><button class='del' data-del='cash' data-id='"+c.id+"'>حذف</button></td></tr>";
      });
    table("t-cap-log", ["التاريخ","الشريك","الحركة","رأس المال","أرباح مستحقة","",""], rows,
      capLogFor ? "مفيش حركات للشريك ده." : "مفيش حركات رأس مال لسه.");
    var ttl = document.getElementById("caplog-title");
    if(ttl) ttl.innerHTML = capLogFor
      ? "حركات <strong>" + esc(partyName(capLogFor)) + "</strong> " +
        "<button class='rowact' type='button' id='b-caplog-all'>وريني الكل</button>"
      : "سجل حركات رأس المال";
  }

  function renderCapHint(){
    var el = document.getElementById("cap-hint");
    if(!el) return;
    var pid = document.getElementById("cp-partner").value;
    var t = document.getElementById("cp-type").value;
    if(!pid){ el.textContent = ""; el.className = "hintline"; return; }
    if(t === "cap_payout" || t === "cap_reinvest"){
      var c = currentOf(pid);
      el.textContent = "أرباح مستحقة لـ" + partyName(pid) + ": " + money(c) +
        (c <= 0 ? " — مفيش رصيد يتصرف منه" : "");
      el.className = c > 0 ? "hintline" : "hintline bad";
    } else if(t === "cap_repay"){
      var ow = owedOf(pid);
      el.textContent = "الشركة عليها لـ" + partyName(pid) + ": " + money(ow) + (ow <= 0 ? " — مفيش حاجة تترد" : " — مصاريف دفعها من جيبه");
      el.className = ow > 0 ? "hintline" : "hintline bad";
    } else if(t === "cap_out"){
      var k = capitalOf(pid);
      el.textContent = "رأس مال " + partyName(pid) + ": " + money(k);
      el.className = "hintline";
    } else {
      el.textContent = "";
      el.className = "hintline";
    }
  }

  function renderCapital(){
    renderPayback();
    renderCapStats(); renderPartners(); renderRecon(); renderCapLog(); renderCapHint();
    renderCapRecon(); renderCapCards(); renderCapShare();
    var df = document.getElementById("dist-from"), dt = document.getElementById("dist-to");
    if(df && !df.value){ var m = monthRange(0); df.value = m.from; dt.value = m.to; }
    distPerSync();
    var cd = document.getElementById("cp-date");
    if(cd && !cd.value) cd.value = firstOpenDate();
  }

  /* ---------- حفظ حركة رأس مال ---------- */
  /* ---------- تعديل حركة رأس مال ---------- */
  var editingCap = null;

  // بيحسب الحدود كأن الحركة اللي بنعدّلها مش موجودة. من غير كده الشريك
  // اللي ضخّ ٥٠ ألف مش هيقدر يعدّلهم لـ٤٠، لأن السيستم بيقارن برصيد
  // الحركة نفسها جوّاه.
  function withoutCap(id, fn){
    var rec = id && db.cash.find(function(x){ return x.id === id; });
    if(!rec || rec.deleted) return fn();
    rec.deleted = true;
    try { return fn(); } finally { delete rec.deleted; }
  }

  function setCapEditUI(){
    var on = !!editingCap;
    document.getElementById("b-cap").textContent = on ? "حفظ التعديل" : "حفظ الحركة";
    document.getElementById("x-cap").hidden = !on;
    var t = document.getElementById("title-capital");
    if(t) t.textContent = on ? "تعديل حركة رأس مال" : "حركة رأس مال";
  }
  function startEditCap(id){
    var rec = db.cash.find(function(x){ return x.id===id; });
    if(!rec || rec.deleted || !isCapType(rec.type)) return;
    if(rec.distId){
      toast("الحركة دي جزء من توزيع أرباح — احذف التوزيع كله وأعد توزيعه"); return;
    }
    if(isLocked(rec.date)){ toast("السجل ده في فترة مقفولة — مينفعش يتعدّل"); return; }
    editingCap = id;
    document.getElementById("cp-date").value    = rec.date || today();
    document.getElementById("cp-partner").value = rec.partyId || "";
    document.getElementById("cp-type").value    = rec.type;
    document.getElementById("cp-amount").value  = rec.amount || "";
    document.getElementById("cp-note").value    =
      (rec.note === CAP[rec.type].label) ? "" : (rec.note || "");
    setCapEditUI();
    goTab("capital"); openEntry("capital");
    renderCapHint(); updateImpact("capital");
    toast("بتعدّل حركة موجودة");
  }
  function cancelEditCap(){
    editingCap = null;
    ["cp-amount","cp-note"].forEach(function(x){ document.getElementById(x).value = ""; });
    setCapEditUI(); renderCapHint(); updateImpact("capital");
  }
  document.getElementById("x-cap").addEventListener("click", function(){
    cancelEditCap();
    if(openEntryKey === "capital") closeEntry();
  });
  document.getElementById("t-cash").addEventListener("click", function(e){
    var b = e.target.closest("[data-editcap]");
    if(b) startEditCap(b.dataset.editcap);
  });

  document.getElementById("t-cap-log").addEventListener("click", function(e){
    var b = e.target.closest("[data-editcap]");
    if(b) startEditCap(b.dataset.editcap);
  });

  document.getElementById("b-cap").addEventListener("click", function(){
    var d   = document.getElementById("cp-date").value || firstOpenDate();
    var pid = document.getElementById("cp-partner").value;
    var t   = document.getElementById("cp-type").value;
    var a   = Number(document.getElementById("cp-amount").value)||0;
    if(!pid){ toast("اختر الشريك"); return; }
    if(!a){ toast("اكتب المبلغ"); return; }
    if(!guardLock(d, "حركة رأس المال")) return;

    var prev = editingCap ? db.cash.find(function(x){ return x.id===editingCap; }) : null;
    if(prev && prev.date && isLocked(prev.date)){
      toast("السجل ده في فترة مقفولة — مينفعش يتعدّل"); return;
    }

    var bad = withoutCap(editingCap, function(){
      if(t === "cap_out" && a > capitalOf(pid) + 0.009)
        return "رأس مال " + partyName(pid) + " " + money(capitalOf(pid)) + " بس";
      if(t === "cap_repay" && a > owedOf(pid) + 0.009)
        return "الشركة عليها لـ" + partyName(pid) + " " + money(owedOf(pid)) + " بس";
      if((t === "cap_payout" || t === "cap_reinvest") && a > currentOf(pid) + 0.009)
        return "الأرباح المستحقة لـ" + partyName(pid) + " " + money(currentOf(pid)) + " بس";
      if(CAP[t].cash < 0 && a > cashBox() + 0.009)
        return "الخزنة فيها " + money(cashBox()) + " بس";
      return "";
    });
    if(bad){ toast(bad); return; }

    var note = document.getElementById("cp-note").value.trim() || CAP[t].label;
    if(prev){
      prev.date = d; prev.type = t; prev.partyId = pid; prev.amount = a; prev.note = note;
      prev.editedBy = me || "غير محدد"; prev.at = Date.now();
      editingCap = null; setCapEditUI();
      ["cp-amount","cp-note"].forEach(function(x){ document.getElementById(x).value = ""; });
      saveSoon("cash"); renderAll();
      if(openEntryKey === "capital") closeEntry();
      toast("اتعدّلت الحركة");
      return;
    }

    db.cash.push(stamp({ date:d, type:t, partyId:pid, amount:a, shipCo:"", note:note }));
    document.getElementById("cp-amount").value = "";
    document.getElementById("cp-note").value = "";
    saveSoon("cash"); renderAll();
    if(openEntryKey === "capital") closeEntry();
    toast(CAP[t].label + " اتسجّل");
  });

  document.body.addEventListener("click", function(e){
    if(e.target.id === "b-caplog-all"){ capLogFor = null; renderCapLog(); }
  });

  document.getElementById("b-newpartner").addEventListener("click", function(){ openPartnerBox(null); });
  document.getElementById("b-cancelpartner").addEventListener("click", closePartnerBox);
  var editingPartner = null;

  function openPartnerBox(id){
    editingPartner = id || null;
    var box = document.getElementById("newpartner-box");
    var rec = id ? db.parties.find(function(x){ return x.id===id; }) : null;
    document.getElementById("np-title").textContent = rec ? "تعديل بيانات الشريك" : "شريك جديد";
    document.getElementById("b-savepartner").textContent = rec ? "حفظ التعديل" : "حفظ الشريك";
    document.getElementById("np-name").value  = rec ? (rec.name || "")  : "";
    document.getElementById("np-phone").value = rec ? (rec.phone || "") : "";
    box.hidden = false;
    document.getElementById("np-name").focus();
    box.scrollIntoView({block:"nearest"});
  }
  function closePartnerBox(){
    editingPartner = null;
    document.getElementById("newpartner-box").hidden = true;
    ["np-name","np-phone"].forEach(function(x){ document.getElementById(x).value = ""; });
  }

  document.getElementById("b-savepartner").addEventListener("click", function(){
    var name = squish(document.getElementById("np-name").value);
    var phone = document.getElementById("np-phone").value.trim();
    if(!name){ toast("اكتب اسم الشريك"); return; }
    var dup = live("parties").find(function(x){
      return isPartner(x) && x.id !== editingPartner && squish(x.name) === name; });
    if(dup){ toast("فيه شريك تاني بنفس الاسم"); return; }

    if(editingPartner){
      // تغيير الاسم بس — الحركات مربوطة بالـ id مش بالاسم، فالأرقام ما بتتأثرش
      var rec = db.parties.find(function(x){ return x.id===editingPartner; });
      if(rec){
        rec.name = name; rec.phone = phone;
        rec.editedBy = me || "غير محدد"; rec.at = Date.now();
      }
      closePartnerBox();
      saveSoon("parties"); renderAll();
      // كان بيعدّل اسم مش بيسجّل حركة — نقفل الدرج بدل ما نسيبه مفتوح
      if(openEntryKey === "capital" && !editingCap) closeEntry();
      toast("اتعدّل اسم الشريك");
      return;
    }

    var rec2 = stamp({ name:name, type:"partner", phone:phone,
      gov:"", address:"", fb:"", note:"" });
    db.parties.push(rec2);
    closePartnerBox();
    saveSoon("parties");
    renderAll();
    var sel = document.getElementById("cp-partner");
    if(sel) sel.value = rec2.id;   // يتختار على طول
    updateImpact("capital"); renderCapHint();
    toast("اتضاف الشريك واتختار");
  });

  document.getElementById("t-partners").addEventListener("click", function(e){
    var ed = e.target.closest("[data-editpartner]");
    if(ed){ openPartnerBox(ed.dataset.editpartner); openEntry("capital"); return; }
    var am = e.target.closest("[data-editamt]");
    if(am){
      // فيه حركة واحدة بس؟ نفتحها للتعديل على طول. أكتر من واحدة؟
      // نفلتر السجل على الشريك ده عشان يختار اللي عايز يعدّله
      var mv = capMoves(am.dataset.editamt).filter(function(c){ return !c.distId; });
      capLogFor = am.dataset.editamt;
      renderCapLog();
      if(mv.length === 1){ startEditCap(mv[0].id); return; }
      document.getElementById("t-cap-log").scrollIntoView({block:"nearest"});
      toast(mv.length ? "اختار الحركة اللي عايز تعدّلها" : "مفيش حركات تتعدّل");
      return;
    }
    var dl = e.target.closest("[data-delpartner]");
    if(dl){ delPartnerClick(dl); return; }
    // الضغط على أي مكان تاني في السطر بيفتح سجل حركات الشريك
    var tr = e.target.closest("[data-caplog]");
    if(!tr) return;
    capLogFor = (capLogFor === tr.dataset.caplog) ? null : tr.dataset.caplog;
    renderCapLog();
    document.getElementById("t-cap-log").scrollIntoView({block:"nearest"});
  });

  // حذف شريك مالوش حركات — بتأكيد من خطوتين. مشترك بين الجدول والكارت
  function delPartnerClick(dl){
    var id = dl.dataset.delpartner;
    if(capMoves(id).length){
      toast("الشريك ده عليه " + nMoves(capMoves(id).length) + " — احذفها الأول"); return; }
    if(dl.dataset.armed !== "1"){
      dl.dataset.armed = "1"; dl.textContent = "متأكد؟";
      setTimeout(function(){
        if(dl.dataset.armed === "1"){ dl.dataset.armed = ""; dl.textContent = "حذف"; }
      }, 4000);
      return;
    }
    var rec = db.parties.find(function(x){ return x.id===id; });
    if(rec){ rec.deleted = true; rec.at = Date.now(); }
    saveSoon("parties"); renderAll(); toast("اتحذف الشريك");
    return;
  }

  document.getElementById("cap-cards").addEventListener("click", function(e){
    var t;
    if((t = e.target.closest("[data-capdo]"))){
      // «دفع رأس مال» / «سحب» / «صرف أرباحه» = نفس درج «حركة رأس مال» والشريك والنوع متحدّدين
      var q = t.dataset.capdo.split("|");
      if(editingCap) cancelEditCap();
      closePartnerBox();
      openEntry("capital");
      document.getElementById("cp-partner").value = q[1];
      document.getElementById("cp-type").value = q[0];
      var am = document.getElementById("cp-amount");
      am.value = q[0] === "cap_payout" ? String(Math.round(currentOf(q[1]) * 100) / 100) : q[0] === "cap_repay" ? String(owedOf(q[1])) : "";
      renderCapHint(); updateImpact("capital");
      setTimeout(function(){ try{ am.focus(); am.select(); }catch(err){} }, 90);
      return;
    }
    if((t = e.target.closest("[data-capopen]"))){
      capOpen = capOpen === t.dataset.capopen ? null : t.dataset.capopen;
      renderCapCards(); return;
    }
    if((t = e.target.closest("[data-editcap]"))){ startEditCap(t.dataset.editcap); return; }
    if((t = e.target.closest("[data-editpartner]"))){ openPartnerBox(t.dataset.editpartner); openEntry("capital"); return; }
    if((t = e.target.closest("[data-delpartner]"))){ delPartnerClick(t); return; }
  });
  document.getElementById("cap-recon").addEventListener("click", function(e){
    if(!e.target.closest("[data-capreconx]")) return;
    var det = document.getElementById("cap-recon-more");
    det.open = !det.open;
    renderCapRecon();
    if(det.open) det.scrollIntoView({ block:"nearest" });
  });

  ["cp-partner","cp-type"].forEach(function(id){
    document.getElementById(id).addEventListener("change", renderCapHint);
  });

  /* ---------- توزيع الأرباح ---------- */
  var distDraft = null;

  // الرسالة دي هي اللي بتفهّم اللي مش محاسب الفرق بين فلوس رأس المال وفلوس الربح
  function renderDistLimits(err){
    var el = document.getElementById("dist-limits");
    if(!el) return;
    var ret = retainedEarnings(), cash = cashBox(), cap = totalCapital();
    if(err){ el.innerHTML = err; el.className = "note bad"; return; }
    if(ret > 0.009){
      var t = "<strong>متاح للتوزيع " + money(ret) + "</strong> — ده صافي الربح اللي اتحقق ولسه ما اتوزّعش.";
      if(cash < ret) t += " بس الخزنة فيها " + money(cash) + " دلوقتي، فالصرف النقدي سقفه الرقم ده " +
        "والباقي محبوس في مخزون أو عند العملاء — الشريك ينفع ياخد نصيبه على الورق ويستلمه بعدين.";
      el.innerHTML = t; el.className = "note ok"; return;
    }
    el.innerHTML = "<strong>لسه مفيش أرباح تتوزّع.</strong> اللي في الخزنة (" + money(cash) + ") ده " +
      "<u>فلوس رأس المال</u> مش ربح — دي فلوس الشركاء اللي بتشتري بيها بضاعة. " +
      "الربح بيتولد لما تبيع، ووقتها الرقم ده بيكبر لوحده." +
      (cap > 0 ? " ولو شريك عايز يسترجع جزء من فلوسه دلوقتي، ده مش توزيع أرباح — " +
        "استخدمه من «حركة رأس مال» ← «سحب من رأس ماله»." : "");
    el.className = "note";
  }

  document.getElementById("cs-per").addEventListener("click", function(e){
    var cs = e.target.closest("[data-csper]"); if(!cs) return;
    csPer = cs.dataset.csper; renderCapShare();
  });
  document.getElementById("dist-per").addEventListener("click", function(e){
    var b = e.target.closest("[data-distper]"); if(!b) return;
    var r = distPerRange(b.dataset.distper);
    document.getElementById("dist-from").value = r.from;
    document.getElementById("dist-to").value = r.to;
    distPerSync(); distReset();
  });
  document.getElementById("dist-panel").addEventListener("click", function(e){
    var b = e.target.closest("[data-distfill]"); if(!b) return;
    var ret = retainedEarnings();
    if(ret <= 0.009){ renderDistLimits(); toast("لسه مفيش أرباح تتوزّع"); return; }
    // لتحت لأقرب قرش — عشان المبلغ مايعدّيش المتاح بكسر
    var v = b.dataset.distfill === "half" ? Math.floor(ret * 50) / 100 : Math.floor(ret * 100) / 100;
    document.getElementById("dist-amount").value = String(v);
    distReset();
  });
  // أي تغيير في الفترة أو المبلغ بعد الحساب بيرجّعك للخطوة الأولى
  function distReset(){
    if(distDraft){ distDraft = null; document.getElementById("dist-box").hidden = true; }
    setDistStep(1);
  }
  ["dist-from","dist-to"].forEach(function(id){
    document.getElementById(id).addEventListener("change", function(){ distPerSync(); distReset(); });
  });
  document.getElementById("dist-amount").addEventListener("input", distReset);

  document.getElementById("b-dist-calc").addEventListener("click", function(){
    var from = document.getElementById("dist-from").value;
    var to   = document.getElementById("dist-to").value;
    var amt  = Number(document.getElementById("dist-amount").value)||0;
    if(!partners().length){ toast("سجّل الشركاء الأول"); return; }
    if(!totalCapital()){ toast("سجّل رأس مال الشركاء الأول"); return; }
    if(!from || !to || from > to){ toast("اختار فترة صحيحة"); return; }
    if(!amt){ toast("اكتب المبلغ اللي هيتوزّع"); return; }
    if(amt > retainedEarnings() + 0.009){
      var ret = retainedEarnings();
      document.getElementById("dist-box").hidden = true;
      if(ret <= 0.009){
        renderDistLimits("<strong>مينفعش توزّع " + money(amt) + ".</strong> المشروع لسه ما حققش أرباح. " +
          "اللي في الخزنة (" + money(cashBox()) + ") ده فلوس رأس مال الشركاء نفسهم، " +
          "ولو وزّعتها كأرباح تبقى بتوزّع فلوس مش ربح وتضيّع نسب رأس المال. " +
          "لو المقصود إن شريك يسترجع من فلوسه: من «حركة رأس مال» اختار «سحب من رأس ماله».");
        toast("دي فلوس رأس مال مش أرباح");
      } else {
        renderDistLimits("<strong>مينفعش توزّع " + money(amt) + ".</strong> " +
          "الأرباح المتاحة للتوزيع " + money(ret) + " بس — نزّل المبلغ.");
        toast("أكبر مبلغ ينفع يتوزّع " + money(ret));
      }
      return;
    }
    distDraft = { from:from, to:to, amount:amt, rows:computeShares(amt, from, to), mode:{} };
    distDraft.rows.forEach(function(r){ distDraft.mode[r.id] = "cash"; });
    renderDistLimits();
    renderDist();
    document.getElementById("dist-box").hidden = false;
    setDistStep(2);
  });

  // بتقسّم الفترة لشرائح عند كل تغيير في رأس المال — نفس اللي weightedRatio بتعمله
  function ratioSegments(from, to){
    var bounds = [from];
    capChangeDates().forEach(function(d){
      if(d > from && d <= to && bounds.indexOf(d) < 0) bounds.push(d);
    });
    bounds.sort();
    return bounds.map(function(a, i){
      var b = (i + 1 < bounds.length) ? addDays(bounds[i+1], -1) : to;
      return { from:a, to:b, days: daysBetween(a,b) + 1, empty: !(totalCapital(a) > 0),
               ratios: partners().map(function(p){ return ratioOf(p.id, a); }) };
    });
  }

  function renderWhy(from, to){
    var ps = partners();
    var segs = ratioSegments(from, to);
    var total = segs.reduce(function(a, sg){ return a + (sg.empty ? 0 : sg.days); }, 0);
    var head = ["الشريحة","أيامها"].concat(ps.map(function(p){ return p.name; }));
    var rows = segs.map(function(sg){
      return "<tr><td class='wide'>" + esc(sg.from) + " → " + esc(sg.to) + "</td>" +
        "<td class='num'>" + qty(sg.days) + "</td>" +
        (sg.empty ? "<td colspan='" + ps.length + "' class='sub'>مفيش رأس مال لسه — مش داخلة في القسمة</td>"
          : sg.ratios.map(function(r){
          return "<td class='num'>" + (r*100).toFixed(2) + "%</td>"; }).join("")) + "</tr>";
    });
    rows.push("<tr style='background:var(--teal-soft)'>" +
      "<td class='wide' style='font-weight:600'>المرجّح بالزمن</td>" +
      "<td class='num' style='font-weight:600'>" + qty(total) + "</td>" +
      ps.map(function(p){
        return "<td class='num' style='font-weight:600'>" +
          (weightedRatio(p.id, from, to)*100).toFixed(2) + "%</td>";
      }).join("") + "</tr>");
    table("t-why", head, rows, "");
  }

  function renderDist(){
    if(!distDraft) return;
    renderWhy(distDraft.from, distDraft.to);
    var changed = capChangeDates().some(function(d){
      return d > distDraft.from && d <= distDraft.to;
    });
    var rows = distDraft.rows.map(function(r){
      var m = distDraft.mode[r.id];
      return "<tr><td class='wide'>"+esc(r.name)+"</td>"+
        "<td class='num'>"+money(capitalOf(r.id))+"</td>"+
        "<td class='num'>"+(r.ratio*100).toFixed(2)+"%</td>"+
        "<td class='num' style='font-weight:600'>"+money(r.share)+"</td>"+
        "<td><select data-distmode='"+r.id+"'>"+
          "<option value='cash'"+(m==="cash"?" selected":"")+">نقدي</option>"+
          "<option value='capital'"+(m==="capital"?" selected":"")+">يتضاف لرأس ماله</option>"+
        "</select></td></tr>";
    });
    table("t-dist", ["الشريك","رأس ماله","النسبة المرجّحة","نصيبه","ياخده إزاي"], rows, "");

    var cash = 0, capAdd = 0;
    distDraft.rows.forEach(function(r){
      if(distDraft.mode[r.id] === "cash") cash += r.share; else capAdd += r.share;
    });
    // النسب بعد التوزيع — الشريك يشوف أثر قراره قبل ما يأكّد
    var after = distDraft.rows.map(function(r){
      return { name:r.name, v: capitalOf(r.id) + (distDraft.mode[r.id]==="capital" ? r.share : 0) };
    });
    var tot = after.reduce(function(a,x){ return a + x.v; }, 0);
    var newRatios = after.map(function(x){
      return esc(x.name) + " " + (tot > 0 ? (x.v/tot*100).toFixed(1) : "0.0") + "%";
    }).join(" · ");

    var el = document.getElementById("dist-check");
    var over = cash > cashBox() + 0.009;
    el.innerHTML = "نقدي " + esc(money(cash)) + (over ? " ⚠ أكبر من الخزنة (" + esc(money(cashBox())) + ")" : " ✓") +
      " · لرأس المال " + esc(money(capAdd)) +
      "<br>النسب بعد التوزيع: " + newRatios +
      (changed ? "<br>⚠ رأس المال اتغيّر جوّه الفترة — النسب محسوبة مرجّحة بالزمن" : "");
    el.className = over ? "note bad" : "note ok";
    document.getElementById("b-dist-do").disabled = over;
  }

  document.getElementById("t-dist").addEventListener("change", function(e){
    var sel = e.target.closest("[data-distmode]");
    if(!sel || !distDraft) return;
    distDraft.mode[sel.dataset.distmode] = sel.value;
    renderDist();
  });

  document.getElementById("b-dist-cancel").addEventListener("click", function(){
    distDraft = null;
    document.getElementById("dist-box").hidden = true;
    setDistStep(1);
  });

  document.getElementById("b-dist-do").addEventListener("click", function(){
    if(!distDraft) return;
    var d = distDraft.to;
    if(!guardLock(d, "التوزيع")) return;
    var cash = distDraft.rows.reduce(function(a,r){
      return a + (distDraft.mode[r.id]==="cash" ? r.share : 0); }, 0);
    if(cash > cashBox() + 0.009){ toast("الصرف النقدي أكبر من الخزنة"); return; }

    var distId = uid();
    var note = "توزيع أرباح " + distDraft.from + " → " + distDraft.to;
    distDraft.rows.forEach(function(r){
      if(r.share <= 0) return;
      // الاستحقاق دايماً بيتسجّل — الصرف أو التحويل حركة منفصلة بعده
      db.cash.push(stamp({ date:d, type:"cap_share", partyId:r.id, amount:r.share,
        shipCo:"", note:note, distId:distId }));
      db.cash.push(stamp({ date:d,
        type: distDraft.mode[r.id]==="cash" ? "cap_payout" : "cap_reinvest",
        partyId:r.id, amount:r.share, shipCo:"", note:note, distId:distId }));
    });
    // ملخص اللي اتعمل يفضل ظاهر تحت الخطوات لحد ما تبدأ توزيع جديد
    var doneTxt = distDraft.rows.filter(function(r){ return r.share > 0; }).map(function(r){
      return esc(r.name) + " " + esc(money(r.share)) + " (" +
        (distDraft.mode[r.id] === "cash" ? "خدها كاش" : "اتضافت لرأس ماله") + ")";
    }).join(" · ");
    distDraft = null;
    document.getElementById("dist-box").hidden = true;
    document.getElementById("dist-amount").value = "";
    saveSoon("cash"); renderAll();
    setDistStep(3);
    var dn = document.getElementById("dist-done");
    if(dn){ dn.innerHTML = "✓ التوزيع اتسجّل: " + doneTxt; dn.hidden = false; }
    toast("التوزيع اتسجّل");
  });

