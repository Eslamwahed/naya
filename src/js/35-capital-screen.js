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

  /* ═══ v184 — «فلوسكم فين؟» = من الربح للخزنة (Cash Flow — الطريقة غير المباشرة) ═══
     الشركاء كانوا بيقارنوا رأس المال بالخزنة ويفتكروا الفرق ربح. هنا حسبة واحدة بتبدأ بصافي الربح
     (قايمة الدخل · اللي اتسلّم فعلاً) وتخلص برصيد الخزنة:
       صافي الربح − أي أصل زاد (بضاعة · فلوس عند الشحن والعملاء · مدفوع مقدّم) + أي التزام زاد
       = اللي الشغل نفسه طلّعه/دخّله الخزنة  + رأس المال − اللي اتسحب  = الخزنة.
     السيستم بدأ والخزنة والمخزون صفر، فالزيادة = الرصيد كله. الأرقام من finBS وcashLedger،
     والتقريب لجنيه بيتظبط على أكبر بند عشان الجمع يطلع صح قدامهم. */
  function balRound(parts, total){
    var r = parts.map(function(x){ return Math.round(x); });
    var diff = Math.round(total) - r.reduce(function(a, b){ return a + b; }, 0);
    if(diff && parts.length){
      var k = 0; parts.forEach(function(x, i){ if(Math.abs(x) > Math.abs(parts[k])) k = i; });
      r[k] += diff;
    }
    return r;
  }
  function moneyStory(){
    var B = finBS(), NI = netProfitAll(), cash = cashBox();
    var repay = CAP.cap_repay.label, f = { cap:0, out:0 };
    cashLedger().forEach(function(x){
      if(x.kind !== "رأس مال" || x.t === repay) return;      // رجوع مصروف لشريك = تشغيل مش تمويل
      var n = (Number(x.inn)||0) - (Number(x.out)||0);
      if(n >= 0) f.cap += n; else f.out -= n;
    });
    var not = [];
    if(B.pay > 0.005) not.push("لموردين " + qty(Math.round(B.pay)));
    if(B.custAdv > 0.005) not.push("عربون عملاء " + qty(Math.round(B.custAdv)));
    if(B.owed > 0.005) not.push("مصاريف دفعها شريك من جيبه " + qty(Math.round(B.owed)));
    var op = [];       // [الاسم · الشرح · المبلغ بإشارته]
    // x[4] = نوع البند واتجاهه (أصل/التزام · زاد/قلّ) — السيستم بدأ من صفر، فالرصيد الموجب = زاد
    var aTag = function(v){ return v > 0 ? "أصل زاد" : "أصل قلّ"; };
    if(Math.abs(B.stock) > 0.005) op.push(["اتحوّل بضاعة على الرف", "بضاعة لسه ما اتباعتش — على الرف ومع المندوب (بسعر الشرا)", -B.stock, 0, aTag(B.stock)]);
    if(Math.abs(B.wallets) > 0.005) op.push(B.wallets > 0 ? ["لسه عند شركات الشحن", "العملاء دفعوها والشركة ما سلّمتهاش لسه", -B.wallets, 0, "أصل زاد"]
                                                          : ["علينا لشركات الشحن", "مصاريف مرتجع هتتخصم من الاستلام الجاي", -B.wallets, 0, "التزام زاد"]);
    if(Math.abs(B.recv) > 0.005) op.push(["لسه عند عملاء", "استلموا ولسه ما دفعوش", -B.recv, 0, aTag(B.recv)]);
    if(Math.abs(B.supAdv) > 0.005) op.push(["دافعين مقدّم لموردين", "", -B.supAdv, 0, aTag(B.supAdv)]);
    if(Math.abs(B.prepaid) > 0.005) op.push(["مدفوع مقدّم", "رصيد إعلانات واشتراكات لسه ما اتصرفش", -B.prepaid, 0, aTag(B.prepaid)]);
    if(B.liab > 0.005) op.push(["فلوس عندنا مش بتاعتنا", not.join(" + "), B.liab, 0, "التزام زاد"]);
    var opSum = NI + op.reduce(function(a, x){ return a + x[2]; }, 0);
    var fin = [["رأس المال اللي حطّيتوه", "", f.cap, 0, "رأس مال زاد"]];
    if(f.out > 0.005) fin.push(["خدتوا", "رأس مال أو أرباح اتصرفت", -f.out, 0, "رأس مال قلّ"]);
    var res = cash - opSum - fin.reduce(function(a, x){ return a + x[2]; }, 0);
    if(Math.abs(res) > 0.5) fin.push(["أرصدة أول المدة وحركات تانية في رأس المال", "", res, 0, ""]);
    // تقريب: كل البنود بتتجمع لرصيد الخزنة بالظبط
    var all = [NI].concat(op.map(function(x){ return x[2]; }), fin.map(function(x){ return x[2]; }));
    var r = balRound(all, cash), i = 1;
    var ni = r[0];
    op.forEach(function(x){ x[3] = r[i++]; });
    fin.forEach(function(x){ x[3] = r[i++]; });
    var opR = ni + op.reduce(function(a, x){ return a + x[3]; }, 0);
    var base = Math.round(B.cap + B.opening);
    return { ni:ni, op:op, opR:opR, fin:fin, cash:Math.round(cash), base:base, stock:Math.round(B.stock),
             bad:Math.abs(B.diff) >= 0.01 };
  }
  function storyNum(v, sign){
    var t = qty(Math.abs(v));
    return sign ? (v < 0 ? "−" : (v > 0 ? "+" : "")) + t : (v < 0 ? "−" + t : t);
  }
  function storyLn(x){
    return "<div class='ms-ln'><i>" + (x[3] < 0 ? "−" : "+") + "</i><span>" + esc(x[0]) +
      (x[4] ? " <em class='ms-tag" + (/التزام/.test(x[4]) ? " l" : (/رأس مال/.test(x[4]) ? " c" : "")) + "'>" + esc(x[4]) + "</em>" : "") +
      (x[1] ? "<small>" + esc(x[1]) + "</small>" : "") + "</span>" +
      "<b class='num" + (x[3] > 0 ? " v-gain" : "") + "'>" + storyNum(x[3], true) + "</b></div>";
  }
  function storyNote(m){
    var gap = m.base - m.cash;
    if(gap <= 0.5 || m.ni < 0 || m.stock <= 0) return "";
    return "يعني: الـ<b class='num'>" + qty(gap) + "</b> اللي ناقصين من رأس المال <b>مش خسارة</b> — الربح <b class='num'>" + qty(m.ni) +
      "</b> وزيادة عليه اتحوّلوا بضاعة على الرف (<b class='num'>" + qty(m.stock) + "</b>). أول ما تتباع بترجع الخزنة.";
  }
  function renderCapStory(){
    var el = document.getElementById("cap-story");
    if(!el) return;
    if(!partners().length){ el.innerHTML = ""; return; }
    var m = moneyStory(), note = storyNote(m);
    el.innerHTML = "<div class='ms-card'>" +
        "<div class='ms-hd'><div><h3>من الربح للخزنة</h3><p class='ms-lead'>ليه الخزنة فيها <span class='num'>" + qty(m.cash) +
          "</span> والربح <span class='num'>" + qty(m.ni) + "</span>؟ — كل رقم هنا بيتجمع لحد اللي في الخزنة.</p></div>" +
          "<button class='tbtn' type='button' id='b-story-img'>⇩ صورة للشركاء</button></div>" +
        "<div class='ms-ln top'><i></i><span>صافي الربح<small>من قايمة الدخل — الأوردرات اللي خلصت</small></span>" +
          "<b class='num " + (m.ni < 0 ? "v-due" : "v-gain") + "'>" + storyNum(m.ni, true) + "</b></div>" +
        m.op.map(storyLn).join("") +
        "<div class='ms-sub'><i>=</i><span>الشغل نفسه " + (m.opR < 0 ? "طلّع من الخزنة" : "دخّل الخزنة") +
          (m.opR < 0 && m.stock > 0 ? "<small>عشان اشترينا بضاعة أكتر من اللي اتباع</small>" : "") + "</span>" +
          "<b class='num'>" + storyNum(m.opR, true) + "</b></div>" +
        m.fin.map(storyLn).join("") +
        "<div class='ms-end'><i>=</i><span>في الخزنة دلوقتي</span><b class='num'>" + storyNum(m.cash) + "</b></div>" +
        (note ? "<p class='ms-note'>" + note + "</p>" : "") +
      "</div>" +
      "<p class='ms-foot'>من قايمة الدخل والميزانية · <a href='#' data-gorep='sum'>شوف الحسبة كاملة في قايمة الدخل</a>" +
        (m.bad ? " · <span class='v-due'>⚠ الميزانية فيها فرق — الأرقام ممكن تكون مش دقيقة</span>" : "") + "</p>";
  }
  // صورة للشركاء — بنفس رسم صورة الخزنة (canvas بعرض تليفون وخط كبير، فاتحة دايماً)
  function drawStoryImage(){
    var m = moneyStory(), W = CI.W, P = CI.PAD, R = W - P, L = P + 8;
    var H = 260 + (m.op.length + m.fin.length) * 52 + 300;
    var cv = document.createElement("canvas"); cv.width = W * CI.S; cv.height = H * CI.S;
    var c = cv.getContext("2d"); c.scale(CI.S, CI.S);
    c.fillStyle = CI_C.bg; c.fillRect(0, 0, W, H);
    c.fillStyle = CI_C.brand; c.fillRect(0, 0, W, 8);
    var y = 58;
    ciR(c, "من الربح للخزنة", R, y, ciFont(700, 30), CI_C.ink);
    ciL(c, "Lora Collection · " + today(), P, y, ciFont(400, 16), CI_C.soft); y += 34;
    ciR(c, "ليه الخزنة فيها " + qty(m.cash) + " والربح " + qty(m.ni) + "؟", R, y, ciFont(500, 18), CI_C.soft); y += 18;
    var line = function(t, v, color, font, bold){
      y += 38;
      ciR(c, t, R, y, font || ciFont(500, 20), CI_C.ink);
      ciL(c, v, L, y, ciFont(bold ? 700 : 600, bold ? 24 : 21), color || CI_C.ink);
      y += 14; c.fillStyle = CI_C.line; c.fillRect(P, y, W - 2 * P, 1);
    };
    line("صافي الربح (من قايمة الدخل)", storyNum(m.ni, true), m.ni < 0 ? CI_C.due : CI_C.gain);
    m.op.forEach(function(x){ line((x[3] < 0 ? "−  " : "+  ") + x[0] + (x[4] ? "  (" + x[4] + ")" : ""), storyNum(x[3], true), x[3] > 0 ? CI_C.gain : CI_C.ink); });
    y += 8; c.fillStyle = CI_C.chip; c.fillRect(P, y + 6, W - 2 * P, 50);
    y += 2; line("=  الشغل نفسه " + (m.opR < 0 ? "طلّع من الخزنة" : "دخّل الخزنة"), storyNum(m.opR, true), CI_C.ink, ciFont(700, 20), true);
    m.fin.forEach(function(x){ line((x[3] < 0 ? "−  " : "+  ") + x[0] + (x[4] ? "  (" + x[4] + ")" : ""), storyNum(x[3], true), x[3] > 0 ? CI_C.gain : CI_C.ink); });
    y += 10; c.fillStyle = CI_C.ink; c.fillRect(P, y, W - 2 * P, 2); y += 42;
    ciR(c, "=  في الخزنة دلوقتي", R, y, ciFont(700, 24), CI_C.ink); ciL(c, storyNum(m.cash), L, y, ciFont(700, 32), CI_C.ink); y += 46;
    if(storyNote(m)){
      var gap = m.base - m.cash;
      ciR(c, "الـ" + qty(gap) + " اللي ناقصين من رأس المال مش خسارة —", R, y, ciFont(600, 18), CI_C.gain); y += 30;
      ciR(c, "الربح وزيادة عليه اتحوّلوا بضاعة على الرف (" + qty(m.stock) + ").", R, y, ciFont(500, 18), CI_C.soft); y += 10;
    }
    // الارتفاع اتحسب بالتقريب — بنقصّ الفاضي اللي تحت
    var h = Math.min(H, Math.ceil(y + 32));
    if(h >= H) return cv;
    var out = document.createElement("canvas"); out.width = W * CI.S; out.height = h * CI.S;
    out.getContext("2d").drawImage(cv, 0, 0);
    return out;
  }
  /* v183: «فلوسكم فين؟» و«الشركاء» جزئين بمفتاح — الاختيار في الذاكرة بس (مفيش مفتاح تخزين جديد) */
  var capSeg = "story";
  function setCapSeg(v){
    capSeg = v === "main" ? "main" : "story";
    var st = document.getElementById("cap-story");
    if(st) st.hidden = capSeg !== "story";
    Array.prototype.forEach.call(document.querySelectorAll("#tab-capital .cap-m"), function(x){ x.hidden = capSeg !== "main"; });
    Array.prototype.forEach.call(document.querySelectorAll("#cap-seg [data-capseg]"), function(b){
      b.setAttribute("aria-pressed", b.dataset.capseg === capSeg ? "true" : "false"); });
  }
  document.getElementById("cap-seg").addEventListener("click", function(e){
    var b = e.target.closest("[data-capseg]"); if(b) setCapSeg(b.dataset.capseg);
  });
  // أي حاجة بتودّي لحاجة جوه «الشركاء» (لينك من شاشة تانية أو تعديل حركة) بتفتح الجزء ده لوحدها
  document.addEventListener("focusin", function(e){
    var mn = e.target && e.target.closest ? e.target.closest("#tab-capital .cap-m") : null;
    if(mn && mn.hidden) setCapSeg("main");
  });
  document.getElementById("cap-story").addEventListener("click", function(e){
    var g = e.target.closest("[data-gorep]");
    if(g){ e.preventDefault(); goTab("rep"); return; }
    var b = e.target.closest("#b-story-img"); if(!b) return;
    var old = b.textContent; b.disabled = true; b.textContent = "بيحضّر…";
    var go = function(){
      try{
        drawStoryImage().toBlob(function(blob){
          b.disabled = false; b.textContent = old;
          if(!blob){ toast("المتصفح ما قدرش يعمل الصورة"); return; }
          downloadBlob("lora-flosna-fein-" + today() + ".png", blob); toast("الصورة نزلت");
        }, "image/png");
      } catch(err){ b.disabled = false; b.textContent = old; toast("الصورة ما اتعملتش: " + (err && err.message || err)); }
    };
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(go, go); else go();
  });

  /* ---------- شارة الميزانية وكارت لكل شريك ----------
     الجدول القديم والسجل والشرح لسه موجودين تحت في «جدول الشركاء وسجل كل
     الحركات». الكروت بتقرا من نفس الدوال (capitalOf/currentOf/ratioOf)،
     فالأرقام هي هي. */
  var CAP_CLR = ["#7A2637","#B07A47","#7FA68F","#C8963E","#5B7DB1","#9A1333"];
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
    el.hidden = ok; if(det) det.hidden = ok;   // v183: لو مظبوطة «فلوسكم فين؟» فوق بتقول نفس الكلام — بتبان بس لو فيه فرق
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

  /* v186 — جزء «الشركاء»: جدول واحد بدل كارت لكل شريك + شريط النسب + جدول «نصيب الشركاء» لوحده.
     السطر: الاسم · نسبته (بشريط) · رأس ماله · [أرباح ليه — لو فيه] · نصيبه من ربح الفترة · «⋯» فيها أزراره.
     النصيب بنفس حساب «نصيب الشركاء» القديم بالظبط (weightedRatio + فرق التقريب على أكبر نصيب). */
  function capShareRows(ps){
    var r = csPer === "all" ? null : distPerRange(csPer);
    var from = r ? r.from : earliestDate(), to = r ? r.to : today();
    var net = periodStats(r).net;
    var fc = ps.map(function(x){ return capStartOf(x.id); }).filter(Boolean).sort()[0];
    var capFrom = fc && fc > from ? fc : from;
    var allDays = capFrom > to ? 0 : daysBetween(capFrom, to) + 1;
    var sh = ps.map(function(x){ return Math.round(net * weightedRatio(x.id, from, to) * 100) / 100; });
    var diff = Math.round((net - sh.reduce(function(a, b){ return a + b; }, 0)) * 100) / 100;
    if(diff !== 0 && sh.length){
      var big = 0; sh.forEach(function(v, i){ if(Math.abs(v) > Math.abs(sh[big])) big = i; });
      sh[big] = Math.round((sh[big] + diff) * 100) / 100;
    }
    return { net:net, share:sh, days:ps.map(function(x){ return capDaysIn(x.id, from, to); }), allDays:allDays };
  }
  function renderCapCards(){
    var box = document.getElementById("cap-cards"), al = document.getElementById("cap-alert");
    if(!box) return;
    var ps = partners(), tot = totalCapital();
    Array.prototype.forEach.call(document.querySelectorAll("#cs-per [data-csper]"), function(x){
      x.classList.toggle("on", x.dataset.csper === csPer);
      x.setAttribute("aria-pressed", x.dataset.csper === csPer ? "true" : "false");
    });
    // تنبيه بس لو الشركة عليها لشريك (مصاريف دفعها من جيبه)
    if(al) al.innerHTML = ps.filter(function(p){ return owedOf(p.id) > 0.009; }).map(function(p){
      return "<div class='cap-owe'><p><b>الشركة عليها لـ" + esc(p.name) + " <span class='num'>" + esc(qty(Math.round(owedOf(p.id)))) + "</span></b>" +
        "<small>مصاريف دفعها من جيبه — مش جزء من رأس ماله ولا أرباحه</small></p>" +
        "<button class='tbtn primary' type='button' data-capdo='cap_repay|" + p.id + "'>رجّعله من الخزنة</button></div>";
    }).join("");
    if(!ps.length){
      box.innerHTML = "<div class='cd-empty'>مفيش شركاء لسه — اضغط «+ حركة رأس مال» فوق، وجوه الدرج هتلاقي «+ شريك».</div>";
      return;
    }
    if(capOpen && !ps.some(function(p){ return p.id === capOpen; })) capOpen = null;
    var S = tot > 0.009 ? capShareRows(ps) : null;
    var anyCur = ps.some(function(p){ return Math.abs(currentOf(p.id)) > 0.009; });
    var cols = "cap-t" + (anyCur ? " cur" : "");
    var head = "<div class='cap-r th'><span>الشريك</span><span>نسبته</span><span class='n'>رأس ماله</span>" +
      (anyCur ? "<span class='n'>أرباح ليه لسه ما خدهاش</span>" : "") + "<span class='n'>نصيبه من الربح</span><span></span></div>";
    var rows = ps.map(function(p, i){
      var cap = capitalOf(p.id), cur = currentOf(p.id), r = ratioOf(p.id);
      var mv = capMoves(p.id).slice().sort(function(a, b){
        if((a.date||"") !== (b.date||"")) return (a.date||"") < (b.date||"") ? 1 : -1;
        return (b.at||0) - (a.at||0);
      });
      var st = capStartOf(p.id), open = capOpen === p.id && mv.length;
      var sh = S ? S.share[i] : 0, dz = S ? S.days[i] : null;
      var late = S && dz !== null && dz < S.allDays;
      var menu = "<details class='cap-more'><summary aria-label='حاجات " + esc(p.name) + "' title='حاجات تانية'>⋯</summary><div>" +
        "<button class='tbtn' type='button' data-capdo='cap_in|" + p.id + "'>+ دفع رأس مال</button>" +
        (cap > 0.009 ? "<button class='tbtn' type='button' data-capdo='cap_out|" + p.id + "'>سحب من رأس ماله</button>" : "") +
        (cur > 0.009 ? "<button class='tbtn' type='button' data-capdo='cap_payout|" + p.id + "'>صرف أرباحه</button>" : "") +
        "<button class='tbtn' type='button' data-editpartner='" + p.id + "'>تعديل الاسم</button>" +
        (mv.length ? "<button class='tbtn' type='button' data-capopen='" + p.id + "'>" + (open ? "اقفل حركاته" : "حركاته (" + qty(mv.length) + ")") + "</button>"
                   : "<button class='tbtn cap-del' type='button' data-delpartner='" + p.id + "'>حذف</button>") +
        "</div></details>";
      return "<div class='cap-r'>" +
        "<span class='nm'><i style='background:" + capClr(i) + "'></i><span><b>" + esc(p.name) + "</b>" +
          "<small>" + esc(st ? "من " + dShort(st) : "لسه ما دفعش رأس مال") + "</small></span></span>" +
        "<span class='cpct'><b class='num'>" + capPct(r) + "</b><span class='pbar'><i style='width:" + (r * 100) + "%;background:" + capClr(i) + "'></i></span></span>" +
        "<span class='n num'>" + esc(qty(Math.round(cap))) + "</span>" +
        (anyCur ? "<span class='n num" + (cur > 0.009 ? " v-gain" : "") + "'>" + esc(qty(Math.round(cur))) + "</span>" : "") +
        "<span class='n sh'><b class='num " + (sh < 0 ? "v-due" : "v-gain") + "'>" + (sh > 0 ? "+" : sh < 0 ? "−" : "") + esc(qty(Math.abs(Math.round(sh)))) + "</b>" +
          (late ? "<small>فلوسه اشتغلت " + qty(dz) + " من " + qty(S.allDays) + " يوم</small>" : "") + "</span>" +
        "<span class='mo'>" + menu + "</span></div>" +
        (open ? "<div class='cpc-tl'><h4>حركات " + esc(p.name) + "</h4>" + mv.map(capMoveRow).join("") + "</div>" : "");
    }).join("");
    var totCur = ps.reduce(function(a, p){ return a + currentOf(p.id); }, 0);
    var total = "<div class='cap-r tot'><span>الإجمالي</span><span class='num'>100%</span><span class='n num'>" + esc(qty(Math.round(tot))) + "</span>" +
      (anyCur ? "<span class='n num'>" + esc(qty(Math.round(totCur))) + "</span>" : "") +
      "<span class='n'><b class='num " + (S && S.net < 0 ? "v-due" : "v-gain") + "'>" + (S ? (S.net > 0 ? "+" : S.net < 0 ? "−" : "") + esc(qty(Math.abs(Math.round(S.net)))) : "—") + "</b></span><span></span></div>";
    box.className = cols;
    box.innerHTML = head + rows + total;
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
    renderCapStory(); renderCapRecon(); renderCapCards(); renderCapShare();
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

  function capCardsClick(e){
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
  }
  document.getElementById("cap-cards").addEventListener("click", capCardsClick);
  document.getElementById("cap-alert").addEventListener("click", capCardsClick);
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
    csPer = cs.dataset.csper; renderCapShare(); renderCapCards();
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

