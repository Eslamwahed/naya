  /* ================= رسومات (v123) =================
     تلات رسومات من نفس أرقام قايمة الدخل (projStats) — مفيش رقم بيتحسب هنا لوحده:
       ١ فلوسك راحت فين؟ — شلال من المبيعات لصافي الربح بنفس ترتيب القايمة
       ٢ الأوردر الواحد — اللي بيدخل جنب اللي بيتصرف (عمود «على الأوردر»)
       ٣ الإعلان بيجيب أوردرات؟ — رسمتين على نفس الأيام (مش رسمة بمقياسين)
     SVG مرسوم بإيدينا من غير مكتبة — بيشتغل من غير نت. الألوان classes بتاخد من
     الـCSS، فالوضع الليلي بيتظبط لوحده. الأيام والترتيب من اليمين للشمال. */
  var vizMode = "exp", vizDays = 30, vzTips = [];
  var VZ_NS = "http://www.w3.org/2000/svg";
  function vzEl(p, t, a, txt){
    var e = document.createElementNS(VZ_NS, t);
    for(var k in a) e.setAttribute(k, a[k]);
    if(txt != null) e.textContent = txt;
    p.appendChild(e); return e;
  }
  // رقم جوّه الرسمة: معزول LTR عشان السالب ما يتقلبش (−2,644.50 مش 2,644.50−)
  function vzN(v, d){
    var a = Math.abs(v), dd = d == null ? (Math.abs(a - Math.round(a)) > 0.004 ? 2 : 0) : d;
    return "\u2066" + (v < -0.004 ? "−" : "") + a.toLocaleString("en-US", { minimumFractionDigits:dd, maximumFractionDigits:dd }) + "\u2069";
  }
  // نفس الرقم للـHTML: العزل هناك بالـCSS (direction:ltr) أو <bdi>
  function vzH(v, d){ return vzN(v, d).replace(/[\u2066\u2069]/g, ""); }
  // كلام: dir بيحدد start/end — «ltr» للأرقام، «rtl» للعربي
  function vzT(p, x, y, txt, o){
    o = o || {};
    return vzEl(p, "text", { x:x, y:y, "font-size":o.fs || 11.5, "font-weight":o.fw || 400, "class":o.c || "vz-tx",
      "text-anchor":o.a || "middle", direction:o.d || "rtl" }, txt);
  }
  // عمود بطرف مدوّر ٤px ناحية القيمة بس، ومربّع عند خط الأساس
  function vzCol(p, x, w, y1, y2, cls, upward){
    var h = Math.max(1.5, y2 - y1), r = Math.min(4, h / 2, w / 2), d;
    if(upward) d = "M" + x + "," + (y1 + h) + "V" + (y1 + r) + "Q" + x + "," + y1 + " " + (x + r) + "," + y1 + "H" + (x + w - r) +
                   "Q" + (x + w) + "," + y1 + " " + (x + w) + "," + (y1 + r) + "V" + (y1 + h) + "Z";
    else d = "M" + x + "," + y1 + "V" + (y1 + h - r) + "Q" + x + "," + (y1 + h) + " " + (x + r) + "," + (y1 + h) + "H" + (x + w - r) +
             "Q" + (x + w) + "," + (y1 + h) + " " + (x + w) + "," + (y1 + h - r) + "V" + y1 + "Z";
    return vzEl(p, "path", { d:d, "class":cls });
  }
  // خطوة مقياس «حلوة»: 1 · 2 · 2.5 · 5 × 10ⁿ — حوالي ٥ خطوط
  function vzStep(span){
    if(!(span > 0)) return 1;
    var raw = span / 5, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), m = raw / p;
    return p * (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10);
  }
  function vzTick(v){
    var a = Math.abs(v), k = a >= 1000, x = k ? a / 1000 : a;
    return "\u2066" + (v < -0.004 ? "−" : "") + x.toLocaleString("en-US", { maximumFractionDigits:2 }) + (k ? "k" : "") + "\u2069";
  }
  // tooltip: كل علامة ليها data-vt = رقمها في vzTips
  function vzTip(i, cls, rows){
    vzTips[i] = "<b>" + (cls ? "<i class='" + cls + "'></i>" : "") + esc(rows[0]) + "</b>" +
      rows.slice(1).map(function(r){ return "<div class='r'><span>" + esc(r[0]) + "</span><span>" + esc(r[1]) + "</span></div>"; }).join("");
  }
  // v125: العمود بيطلع من خط الأساس (الـCSS تحت) — dir: vz-gu لفوق · vz-gd لتحت · vz-gx من اليمين
  function vzGrow(m, dir, i){ m.setAttribute("class", (m.getAttribute("class") || "") + " " + dir); m.style.setProperty("--i", i); }
  function vzSvg(host, w, h, label){
    host.innerHTML = "";
    return vzEl(host, "svg", { width:w, height:h, viewBox:"0 0 " + w + " " + h, role:"img", "aria-label":label });
  }
  function vzW(host, min){ return Math.max(min, Math.floor(host.clientWidth || 700)); }
  function vzStats(id, L){
    var el = document.getElementById(id); if(!el) return;
    el.innerHTML = L.map(function(x){
      return "<div class='vz-st'><small>" + esc(x[0]) + "</small><b class='" + (x[2] || "") + "'>" + esc(x[1]) + "</b><em>" + (x[3] || "&nbsp;") + "</em></div>";
    }).join("");
  }
  var VZ_FILL = { goods:"vz-goods", ship:"vz-ship", ads:"vz-ads", pack:"vz-pack", fixed:"vz-fixed", oth:"vz-oth" };
  var VZ_SW = { goods:"--s-goods", ship:"--s-ship", ads:"--s-ads", pack:"--s-pack", fixed:"--s-fixed", oth:"--ink-soft" };
  function vzSw(k){ return "background:var(" + VZ_SW[k] + ")"; }

  function renderViz(){
    var sec = document.getElementById("tab-viz"); if(!sec) return;
    vzTips = []; vzHideTip();
    var hw = document.getElementById("vz-wf"); if(hw && hw.clientWidth) vzLastW = hw.clientWidth;
    Array.prototype.forEach.call(document.querySelectorAll("#vz-mode [data-vzm]"), function(b){ b.classList.toggle("on", b.dataset.vzm === vizMode); });
    Array.prototype.forEach.call(document.querySelectorAll("#vz-days [data-vzd]"), function(b){ b.classList.toggle("on", Number(b.dataset.vzd) === vizDays); });
    var P = projStats(periodRange()), v = vizMode === "act" ? P.act : P.exp;
    renderVzFlow(P, v);
    renderVzOrder(P, P.exp);
    renderVzAds(P);
  }

  // ١ — الشلال
  function renderVzFlow(P, v){
    var host = document.getElementById("vz-wf"), n = v.n, g = v.goods;
    var lead = document.getElementById("vz1-lead");
    if(!n && !(v.fixedExp + v.varExp > 0.009)){
      host.innerHTML = "<p class='vz-empty'>مفيش أوردرات ولا مصاريف في الفترة دي — اختار فترة تانية من فوق.</p>";
      vzStats("vz1-stats", []); if(lead) lead.textContent = ""; return;
    }
    var per = function(x){ return n ? vzH(x / n, 2) : "—"; }, pc = function(x){ return g > 0.009 ? vzH(x / g * 100, 1) + "%" : "—"; };
    vzStats("vz1-stats", [
      ["المبيعات", vzH(g), "", qty(n) + " أوردر" + (vizMode === "act" ? " خلصوا" : "")],
      ["ربح البضاعة", vzH(v.gross), v.gross < 0 ? "v-due" : "", v.margin === null ? "" : "<bdi>" + vzH(v.margin * 100, 1) + "%</bdi> من المبيعات"],
      ["قبل المصاريف الثابتة", vzH(v.contrib), v.contrib < 0 ? "v-due" : "v-gain", n ? "<bdi>" + per(v.contrib) + "</bdi> على الأوردر" : ""],
      ["صافي الربح", vzH(v.net), v.net < 0 ? "v-due" : "v-gain", v.net < 0 ? "▼ خسارة" : "▲ مكسب"]
    ]);
    // الخطوات بنفس ترتيب قايمة الدخل — البنود الصفر ما بتترسمش
    var S = [{ l:"المبيعات", t:"tot", v:g }, { l:"بضاعة", v:-v.cost, k:"goods" }, { l:"ربح البضاعة", t:"sub" }];
    if(Math.abs(v.ship) > 0.009) S.push({ l:v.ship >= 0 ? "ربح الشحن" : "فرق الشحن", v:v.ship, k:"ship", grp:v.ship < 0 ? "v" : "" });
    if(v.ads > 0.009) S.push({ l:"إعلانات", v:-v.ads, k:"ads", grp:"v" });
    if(v.pack > 0.009) S.push({ l:"تغليف", v:-v.pack, k:"pack", grp:"v" });
    if(Math.abs(v.xloss + v.othervar) > 0.009) S.push({ l:"متغيّر تاني", v:-(v.xloss + v.othervar), k:"oth", grp:"v" });
    S.push({ l:"قبل الثابت", t:"sub" });
    EXP_CATS.forEach(function(x){
      if(x[2] !== "var" && Math.abs(v[x[0]]) > 0.009) S.push({ l:x[0] === "trans" ? "انتقالات من غير فاتورة" : x[1], v:-v[x[0]], k:"fixed", grp:"f" });
    });
    S.push({ l:"صافي الربح", t:"net" });
    // المدى
    var run = 0, hi = 0, lo = 0;
    S.forEach(function(st){ if(st.t === "tot") run = st.v; else if(!st.t) run += st.v; hi = Math.max(hi, run); lo = Math.min(lo, run); });
    var stp = vzStep(hi - lo), max = Math.ceil(hi * 1.08 / stp) * stp, min = Math.floor(Math.min(0, lo * 1.15) / stp) * stp;
    if(max <= 0) max = stp;
    var W = vzW(host, 600), H = 330, top = 28, bot = 250, axW = 48, x0 = W - axW;
    var y = function(val){ return top + (max - val) / (max - min) * (bot - top); };
    var svg = vzSvg(host, W, H, "فلوسك راحت فين: من المبيعات لصافي الربح");
    for(var t = min; t <= max + stp / 2; t += stp){
      vzEl(svg, "line", { x1:6, x2:x0, y1:y(t), y2:y(t), "class":Math.abs(t) < stp / 2 ? "vz-bl" : "vz-gl" });
      vzT(svg, W - 2, y(t) + 4, vzTick(t), { a:"end", d:"ltr", c:"vz-ts", fs:10.5 });
    }
    var N = S.length, slot = (x0 - 8) / N, bw = Math.min(40, slot * 0.52), cx = function(i){ return x0 - slot * (i + 0.5); };
    run = 0;
    S.forEach(function(st, i){
      var a, b, cls, isT = !!st.t;
      if(st.t === "tot"){ a = 0; b = st.v; run = b; cls = "vz-tot"; }
      else if(isT){ a = 0; b = run; cls = run < 0 ? "vz-neg" : (st.t === "sub" ? "vz-sub" : "vz-tot"); }
      else { a = run; b = run + st.v; run = b; cls = VZ_FILL[st.k]; }
      var top1 = Math.max(a, b), bot1 = Math.min(a, b), X = cx(i) - bw / 2, m;
      if(isT) m = vzCol(svg, X, bw, y(Math.max(0, top1)), y(Math.min(0, bot1)), cls, b >= 0);
      else m = vzEl(svg, "rect", { x:X, y:y(top1), width:bw, height:Math.max(1.5, y(bot1) - y(top1)), rx:3, "class":cls });
      m.setAttribute("data-vt", vzTips.length);
      vzGrow(m, (isT ? b >= 0 : st.v >= 0) ? "vz-gu" : "vz-gd", i);
      var amt = isT ? run : st.v, sz = isT ? amt : Math.abs(amt);     // البند: قد إيه بياخد · الإجمالي: بإشارته
      vzTip(vzTips.length, isT ? "" : VZ_FILL[st.k], [st.l, ["المبلغ", vzH(amt, 2)], ["على الأوردر", per(sz)], ["من المبيعات", pc(sz)],
        ["النوع", isT ? "إجمالي" : st.grp === "f" ? "ثابت" : st.k === "goods" ? "تكلفة البضاعة" : "متغيّر"]]);
      if(i < N - 1) vzEl(svg, "line", { x1:X, x2:cx(i + 1) + bw / 2, y1:y(run), y2:y(run), "class":"vz-cn" });
      var up = isT ? run >= 0 : (st.v >= 0);
      vzT(svg, cx(i), up ? y(top1) - 7 : y(bot1) + 15, vzN(amt), { fw:isT ? 700 : 600, c:isT && run < 0 ? "vz-td" : "vz-tx", d:"ltr" });
      vzT(svg, cx(i), bot + 22, st.l, { fw:isT ? 700 : 400, c:isT ? "vz-tx" : "vz-ts", fs:slot < 70 ? 10.5 : 11.5 });
    });
    // أقواس المتغيّر والثابت تحت المحور
    var brace = function(grp, label){
      var ix = []; S.forEach(function(st, i){ if(st.grp === grp) ix.push(i); });
      if(!ix.length) return;
      var xa = cx(ix[0]) + bw / 2 + 3, xb = cx(ix[ix.length - 1]) - bw / 2 - 3, yb = bot + 36, sum = 0;
      ix.forEach(function(i){ sum += -S[i].v; });
      vzEl(svg, "path", { d:"M" + xa + "," + (yb - 5) + "V" + yb + "H" + xb + "V" + (yb - 5), fill:"none", "class":"vz-gl" });
      vzT(svg, (xa + xb) / 2, yb + 16, label + " · " + vzN(sum), { c:"vz-ts", fs:11 });
    };
    brace("v", "مصاريف البيع — متغيّرة"); brace("f", "ثابتة");
    if(lead){
      var big = S.filter(function(st){ return !st.t && st.k !== "goods" && st.v < 0; }).sort(function(p, q){ return p.v - q.v; })[0];
      var cross = null; run = 0;
      S.forEach(function(st){ if(st.t === "tot") run = st.v; else if(!st.t){ var was = run; run += st.v; if(was >= 0 && run < 0 && !cross) cross = st.l; } });
      lead.textContent = "من " + money(g) + " مبيعات: البضاعة واخدة " + pc(v.cost) +
        (big ? "، وأكبر بند بعدها " + big.l + " (" + money(-big.v) + ")" : "") +
        (cross ? ". الرقم نزل تحت الصفر عند «" + cross + "»." : v.net >= 0 ? ". وفاضل لك " + money(v.net) + " صافي." : ".");
    }
  }

  // ٢ — الأوردر الواحد
  function renderVzOrder(P, v){
    var host = document.getElementById("vz-po"), n = v.n, lead = document.getElementById("vz2-lead"), leg = document.getElementById("vz2-leg");
    if(!n){ host.innerHTML = "<p class='vz-empty'>مفيش أوردرات في الفترة دي.</p>"; if(lead) lead.textContent = ""; if(leg) leg.innerHTML = ""; return; }
    var d = function(x){ return x / n; };
    var inn = [{ l:"مبيعات", v:d(v.goods), c:"vz-tot" }];
    if(v.ship > 0.009) inn.push({ l:"ربح الشحن", v:d(v.ship), c:"vz-ship", k:"ship" });
    var out = [{ l:"بضاعة", v:d(v.cost), k:"goods" }];
    if(v.ship < -0.009) out.push({ l:"شحن", v:d(-v.ship), k:"ship" });
    if(v.ads > 0.009) out.push({ l:"إعلان", v:d(v.ads), k:"ads" });
    if(v.pack > 0.009) out.push({ l:"تغليف", v:d(v.pack), k:"pack" });
    if(v.xloss + v.othervar > 0.009) out.push({ l:"متغيّر تاني", v:d(v.xloss + v.othervar), k:"oth" });
    if(v.fixedExp > 0.009) out.push({ l:"ثابت", v:d(v.fixedExp), k:"fixed" });
    var tIn = inn.reduce(function(a, x){ return a + x.v; }, 0), tOut = out.reduce(function(a, x){ return a + x.v; }, 0), diff = tIn - tOut;
    var W = vzW(host, 340), H = 176, lab = W < 520 ? 96 : 140, x0 = W - lab, plotW = x0 - 64, bh = 24;
    var stp = vzStep(Math.max(tIn, tOut)), max = Math.max(stp, Math.ceil(Math.max(tIn, tOut) * 1.02 / stp) * stp);
    var x = function(val){ return x0 - val / max * plotW; };
    var svg = vzSvg(host, W, H, "الأوردر الواحد: بيدخل كام وبيكلّف كام");
    for(var t = 0; t <= max + stp / 2; t += stp){
      vzEl(svg, "line", { x1:x(t), x2:x(t), y1:24, y2:132, "class":t ? "vz-gl" : "vz-bl" });
      vzT(svg, x(t), 15, vzN(t, 0), { c:"vz-ts", fs:10.5, d:"ltr" });
    }
    var rowY = [40, 96];
    [["العميل بيدفع", "متوسط الأوردر"], ["الأوردر بيكلّف", "بعد كل المصاريف"]].forEach(function(r, i){
      vzT(svg, W - 2, rowY[i] + 11, r[0], { a:"start", fw:700, fs:12.5 });
      vzT(svg, W - 2, rowY[i] + 26, r[1], { a:"start", c:"vz-ts", fs:10.5 });
    });
    var stack = function(list, Y, total){
      var a = 0;
      list.forEach(function(sg, i){
        var b = a + sg.v, xr = x(a) - (i ? 1 : 0), xl = x(b) + (i < list.length - 1 ? 1 : 0), w = Math.max(1, xr - xl), last = i === list.length - 1, m;
        if(last) m = vzEl(svg, "path", { d:"M" + xr + "," + Y + "H" + (xl + 4) + "Q" + xl + "," + Y + " " + xl + "," + (Y + 4) + "V" + (Y + bh - 4) +
          "Q" + xl + "," + (Y + bh) + " " + (xl + 4) + "," + (Y + bh) + "H" + xr + "Z", "class":sg.c || VZ_FILL[sg.k] });
        else m = vzEl(svg, "rect", { x:xl, y:Y, width:w, height:bh, "class":sg.c || VZ_FILL[sg.k] });
        m.setAttribute("data-vt", vzTips.length);
        vzGrow(m, "vz-gx", i + (Y > 60 ? 2 : 0));
        vzTip(vzTips.length, sg.c ? "" : VZ_FILL[sg.k], [sg.l, ["على الأوردر", vzH(sg.v, 2)], ["من اللي العميل بيدفعه", tIn > 0.009 ? vzH(sg.v / tIn * 100, 1) + "%" : "—"], ["على الـ" + qty(n) + " أوردر", vzH(sg.v * n, 2)]]);
        var lbl = sg.l.split(" ")[0] + " " + Math.round(sg.v);
        if(w > lbl.length * 7 + 14) vzT(svg, (xl + xr) / 2, Y + bh / 2 + 4.5, lbl, { fw:700, fs:11, c:sg.c === "vz-tot" ? "vz-tt" : VZ_SW[sg.k] && sg.k !== "oth" ? "vz-tl-" + sg.k : "vz-tk" });
        a = b;
      });
      vzT(svg, x(total) - 8, Y + bh / 2 + 5, vzN(total, 2), { a:"end", d:"ltr", fw:700, fs:12.5 });
    };
    stack(inn, rowY[0], tIn); stack(out, rowY[1], tOut);
    // الفرق
    var xa = x(Math.min(tIn, tOut)), xb = x(Math.max(tIn, tOut)), lossy = diff < -0.009, yb = rowY[1] + bh + 8;
    if(Math.abs(diff) > 0.009){
      vzEl(svg, "line", { x1:xa, x2:xa, y1:rowY[0] + bh, y2:yb + 2, "class":lossy ? "vz-dl" : "vz-gn", "stroke-width":1.5 });
      vzEl(svg, "rect", { x:xb, y:yb, width:xa - xb, height:4, rx:2, "class":lossy ? "vz-dlf" : "vz-gnf" });
      vzT(svg, (xa + xb) / 2, yb + 20, (lossy ? "خسارة " : "مكسب ") + vzN(Math.abs(diff), 2) + " في كل أوردر", { fw:700, fs:12, c:lossy ? "vz-td" : "vz-tg" });
    }
    if(lead){
      var top2 = out.slice(1).sort(function(p, q){ return q.v - p.v; })[0];
      lead.textContent = "المتوسط على " + qty(n) + " أوردر. العميل بيدفع " + money(tIn) + " والأوردر بيكلّف " + money(tOut) +
        (lossy ? " — الفرق خسارة في كل أوردر." : " — الفرق مكسب في كل أوردر.") + (top2 ? " أكبر بند بعد البضاعة: " + top2.l + "." : "");
    }
    if(leg) leg.innerHTML = out.map(function(sg){
      return "<span><i style='" + vzSw(sg.k) + "'></i>" + esc(sg.l) + " <b>" + esc(money(sg.v)) + "</b>" +
        (sg.k === "fixed" ? " <span style='color:var(--ink-soft)'>(بيقل كل ما الأوردرات تزيد)</span>" : "") + "</span>";
    }).join("");
  }

  // ٣ — الإعلان والأوردرات يوم بيوم
  // P = قايمة الدخل للفترة المختارة فوق — منها «الحد» اللي الإعلان على الأوردر لازم ينزل تحته
  function renderVzAds(P){
    var host = document.getElementById("vz-ad"), N = vizDays, to = today(), from = addDays(to, -(N - 1));
    var days = [], ix = {};
    for(var i = 0; i < N; i++){ var dd = addDays(from, i); ix[dd] = days.length; days.push({ d:dd, ads:0, n:0 }); }
    days.forEach(function(x){ x.ads = expByCat({ from:x.d, to:x.d }).ads; });          // v142: اللي فيسبوك صرفه في اليوم ده
    live("sales").forEach(function(s){ if(ix[s.date] != null) days[ix[s.date]].n++; });
    var tAds = days.reduce(function(a, x){ return a + x.ads; }, 0), tN = days.reduce(function(a, x){ return a + x.n; }, 0);
    var adDays = days.filter(function(x){ return x.ads > 0.009; }).length;
    var best = days.reduce(function(a, x){ return x.n > (a ? a.n : 0) ? x : a; }, null);
    var u = unitEcon((P || projStats(periodRange())).exp);
    vzStats("vz3-stats", [
      ["صرف إعلان", vzH(tAds), "", qty(adDays) + " يوم إعلان"],
      ["أوردرات", qty(tN), "", "<bdi>" + vzH(tN / N, 1) + "</bdi> في اليوم"],
      ["الإعلان على الأوردر", tN ? vzH(tAds / tN, 2) : "—", u && tN && tAds / tN > u.pre ? "v-due" : "",
        u && u.pre > 0.009 ? "الحد في قايمة الدخل <bdi>" + vzH(u.pre, 2) + "</bdi>" : ""],
      ["أحسن يوم", best ? qty(best.n) : "—", "", best ? "أوردر يوم " + dShort(best.d) : ""]
    ]);
    if(!tAds && !tN){ host.innerHTML = "<p class='vz-empty'>مفيش إعلانات ولا أوردرات في آخر " + qty(N) + " يوم.</p>"; return; }
    var W = vzW(host, 340), H = 300, axW = 44, x0 = W - axW, slot = (x0 - 6) / N, bw = Math.min(24, slot * 0.6);
    var cx = function(k){ return x0 - slot * (k + 0.5); };          // الأقدم يمين
    var svg = vzSvg(host, W, H, "الإعلان والأوردرات يوم بيوم");
    days.forEach(function(x, k){ if(x.ads > 0.009) vzEl(svg, "rect", { x:cx(k) - slot / 2 + 1, y:6, width:slot - 2, height:262, rx:Math.min(6, slot / 3), "class":"vz-band" }); });
    var panel = function(top, h, key, title, cls, fmtv){
      var mx = days.reduce(function(a, x){ return Math.max(a, x[key]); }, 0), stp = vzStep(mx || 1), max = Math.max(stp, Math.ceil(mx / stp) * stp);
      var y = function(val){ return top + h - val / max * h; };
      vzT(svg, W - 2, top - 14, title, { a:"start", fw:700, fs:12 });
      for(var t = 0; t <= max + stp / 2; t += stp){
        vzEl(svg, "line", { x1:6, x2:x0, y1:y(t), y2:y(t), "class":t ? "vz-gl" : "vz-bl" });
        if(t) vzT(svg, W - 2, y(t) + 4, vzTick(t), { a:"end", d:"ltr", c:"vz-ts", fs:10.5 });
      }
      days.forEach(function(x, k){
        if(!(x[key] > 0)) return;
        var m = vzCol(svg, cx(k) - bw / 2, bw, y(x[key]), y(0), cls, true);
        m.setAttribute("data-vt", vzTips.length);
        vzGrow(m, "vz-gu", Math.min(k, 30) / 2);
        vzTip(vzTips.length, cls, [dShort(x.d), ["إعلان", vzH(x.ads, 2)], ["أوردرات", qty(x.n)]]);
        if(slot >= 22) vzT(svg, cx(k), y(x[key]) - 6, fmtv(x[key]), { fw:600, fs:10.5, d:"ltr" });
      });
    };
    panel(30, 92, "ads", "فلوس الإعلان", "vz-ads", function(val){ return vzN(val); });
    panel(170, 84, "n", "الأوردرات", "vz-tot", function(val){ return qty(val); });
    var every = N <= 10 ? 1 : 5;
    days.forEach(function(x, k){ if(k % every === 0 || k === N - 1) vzT(svg, cx(k), 288, dShort(x.d), { c:"vz-ts", fs:10.5, d:"ltr" }); });
  }

  // tooltip — ماوس، وفي الموبايل دوسة
  function vzHideTip(){ var t = document.getElementById("vz-tip"); if(t) t.hidden = true; }
  function vzShowTip(m, ev){
    var t = document.getElementById("vz-tip"), i = Number(m.getAttribute("data-vt"));
    if(!t || !vzTips[i]) return;
    t.innerHTML = vzTips[i]; t.hidden = false;
    var r = m.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
    var x = r.left - tw - 10; if(x < 8) x = Math.min(window.innerWidth - tw - 8, r.right + 10);
    var yy = (ev && ev.clientY ? ev.clientY : r.top + r.height / 2) - th / 2;
    t.style.left = Math.max(8, x) + "px"; t.style.top = Math.max(8, Math.min(window.innerHeight - th - 8, yy)) + "px";
  }
  (function(){
    var sec = document.getElementById("tab-viz"); if(!sec) return;
    sec.addEventListener("pointermove", function(e){
      var m = e.target.closest && e.target.closest("[data-vt]");
      if(m) vzShowTip(m, e); else vzHideTip();
    });
    sec.addEventListener("pointerleave", vzHideTip);
    sec.addEventListener("click", function(e){
      var m = e.target.closest("[data-vt]");
      if(m){ vzShowTip(m, e); return; }
      var b = e.target.closest("[data-vzm]");
      if(b){
        vizMode = b.dataset.vzm;
        Array.prototype.forEach.call(document.querySelectorAll("#vz-mode [data-vzm]"), function(x){ x.classList.toggle("on", x === b); });
        var P = projStats(periodRange()); renderVzFlow(P, vizMode === "act" ? P.act : P.exp); return;
      }
      b = e.target.closest("[data-vzd]");
      if(b){
        vizDays = Number(b.dataset.vzd);
        Array.prototype.forEach.call(document.querySelectorAll("#vz-days [data-vzd]"), function(x){ x.classList.toggle("on", x === b); });
        renderVzAds(); return;
      }
      b = e.target.closest("[data-vzgo]");
      if(b){
        if(!canTab(b.dataset.vzgo)){ toast("مالكش صلاحية الشاشة دي"); return; }
        if(b.dataset.vzgo === "rep") repTab = "sum";      // الزرار اسمه «قايمة الدخل»
        goTab(b.dataset.vzgo);
      }
    });
    window.addEventListener("scroll", vzHideTip, { passive:true });
  })();

  var TAB_RENDER = {
    dash:    function(){ syncPeriodUI(); renderHome(); renderKPIs(); renderStock();
                         renderLowStock(); renderShipping(); renderBalances(); },
    capital: function(){ renderCapital(); renderDistLimits(); },
    cash:    function(){ renderWallets(); renderCash(); },
    prepaid: function(){ renderPrepaid(); },
    audit:   function(){ renderAudit(); },
    purch:   function(){ renderPurch(); },
    items:   function(){ renderItems(); renderVars(); renderOffers(); },
    price:   function(){ renderPricing(); },
    inv:     function(){ renderInventory(); },
    sales:   function(){ renderSales(); },
    ship:    function(){ renderShip(); },
    parties: function(){ renderParties(); renderStatement(); },
    rep:     function(){ renderReports(); },
    log:     function(){ renderLog(); },
    coach:   function(){ renderCoach(); },
    viz:     function(){ syncPeriodUI(); renderViz(); },
    backup:  function(){ foldSettings(); renderOpening(); renderLock(); renderSnoState(); renderUsers(); }
  };
  var dirtyTabs = {};          // تبويبات محتاجة رسم لما تتفتح
  var activeTab = "dash";

  function renderTab(tab){
    var fn = TAB_RENDER[tab];
    if(!fn) return;
    fn();
    delete dirtyTabs[tab];
  }
  // بتتنادى بعد أي تغيير في البيانات
  /* ═══ v143 — تكلفة التشغيل على القطعة ═══
     اللي اتفقنا عليه مع إسلام: تكلفة التشغيل في الفترة ÷ القطع اللي اتباعت في نفس الفترة (من غير الملغي، والمخزون ما يدخلش).
     تكلفة التشغيل = نفس مصاريف قايمة الدخل (الإعلان اللي فيسبوك صرفه، التغليف، الاشتراك على أيامه، المتغيّر والثابت التاني)
     — بس التأسيس («مرة واحدة») بيتوزّع هنا على ٣ شهور من يوم الدفع (أو على مدته لو متكتبة) بدل ما يتحسب مرة.
     القطع = نفس اللي «تقرير الأصناف» و«المدير المالي» بيعدّوها (itemProfit) — عشان الرقم يقفل على الجدولين. */
  var SETUP_DAYS = 90;
  function setupSpreadIn(r){
    var v = 0;
    live("cash").forEach(function(c){
      if(c.type !== "expense" || trLinked(c) || expCat(c) !== "once") return;
      var d = Number(c.svcDays) > 1 ? Number(c.svcDays) : SETUP_DAYS;           // مدة متكتبة على المصروف = نفس قايمة الدخل
      v += shareIn(c.svcFrom || c.date, d, Number(c.amount)||0, r);
    });
    return v;
  }
  // P = projStats(r) و M = itemProfit(P, act).M لو المتصل حسبهم — ما نحسبهمش تاني
  function opPlan(r, act, P, M){
    P = P || projStats(r); M = M || itemProfit(P, act).M;
    var v = act ? P.act : P.exp, pcs = 0;
    Object.keys(M).forEach(function(id){ pcs += M[id].q; });
    var o = { ads:v.ads, pack:v.pack + v.othervar + v.xloss, subs:v.subs, salary:v.salary, other:v.other + v.trans,
              setup:setupSpreadIn(r), setupStmt:v.once, pcs:pcs, r:r };
    o.fixed = o.subs + o.salary + o.other + o.setup;                    // اللي بيتدفع مهما بعت
    o.total = o.ads + o.pack + o.fixed;
    o.per = pcs > 0.009 ? o.total / pcs : 0;
    o.perFix = pcs > 0.009 ? o.fixed / pcs : 0;
    return o;
  }
  /* للتسعير: من أول الشهر اللي فات لحد النهارده — المصاريف والقطع في نفس الأيام، وكل مرتب شهري بيتحسب
     على قد الشهور اللي في الفترة (آخر ٣٠ يوم بالظبط كانت ممكن تمسك مرتبين أو ولا واحد على حدود الشهر). */
  var _opNow = null;                                                         // بيتصفّر في renderAll
  function opNowRange(){ var t = today(), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)) - 1; if(m < 1){ m = 12; y--; }
    return { from:y + "-" + (m < 10 ? "0" : "") + m + "-01", to:t }; }
  function opNow(){ return _opNow || (_opNow = opPlan(opNowRange(), false)); }
  // تفصيل تكلفة التشغيل على القطعة — نفس الأسطر في الحاسبة
  function opParts(o){
    if(!(o.pcs > 0.009)) return [];
    return [["إعلانات", o.ads], ["تغليف ومتغيّر تاني", o.pack], ["اشتراكات", o.subs], ["مرتبات", o.salary], ["تاني", o.other],
            ["تأسيس — على ٣ شهور", o.setup]].filter(function(x){ return Math.abs(x[1]) > 0.004; })
      .map(function(x){ return [x[0], x[1] / o.pcs, x[1]]; });
  }
  // اسم الجزء الثابت من اللي فيه فعلاً («اشتراكات وتأسيس» · «اشتراكات ومرتبات وتأسيس» …)
  function opFixLabel(o){
    var L = [["اشتراكات", o.subs], ["مرتبات", o.salary], ["مصاريف تانية", o.other], ["تأسيس", o.setup]]
      .filter(function(x){ return Math.abs(x[1]) > 0.004; }).map(function(x){ return x[0]; });
    return L.length ? (L.length > 1 ? L.slice(0, -1).join(" و") + " و" + L[L.length - 1] : L[0]) : "مصاريف ثابتة";
  }
  var pcOpOpen = false;                                                      // تفصيل الحاسبة يفضل مفتوح وانت بتكتب
  document.addEventListener("toggle", function(e){ if(e.target && e.target.classList && e.target.classList.contains("pc-op")) pcOpOpen = e.target.open; }, true);
  /* ═══ v155 — مراجع الحسابات: فحص تلقائي لكل الحسابات كل ما السيستم يتفتح ═══
     كل فحص: مجموعة · شدة (bad = لازم يتصلح · warn = راجعه · info = خلي بالك) · عنوان · ليه مهم · السطور اللي فيها المشكلة.
     الفحوصات بتقرا بس — مش بتغيّر أي حاجة. */
  var AUD_G = [["exp", "المصاريف الثابتة والمعالجة"], ["ord", "الأوردرات وشركات الشحن"], ["stk", "المخزون والمشتريات"], ["bal", "الميزان العام"]];
  var _aud = null;                                                         // بيتصفّر في renderAll
  function audRun(){
    if(_aud) return _aud;
    var R = [], t = today();
    var chk = function(g, sev, t1, why, rows){ R.push({ g:g, sev:sev, t:t1, why:why, rows:rows || [] }); };
    var sRow = function(s, l){ return { l:"#" + (s.no || "—") + " " + partyName(s.partyId) + (l ? " — " + l : ""), go:"sale|" + s.id }; };
    var cRow = function(c, l){ return { l:(squish(c.note) || EXP_CAT[expCat(c)].label) + " · " + money(Number(c.amount)||0) + " · " + dShort(c.date) + (l ? " — " + l : ""), go:"cash|" + c.id }; };
    var ago = function(d){ return d ? daysBetween(d, t) : 0; };
    var ex = live("cash").filter(function(c){ return c.type === "expense"; });
    var S = live("sales");

    // ── ١) المصاريف ──
    chk("exp", "warn", "مصاريف نوعها متخمّن", "النوع بيحدد المصروف ثابت ولا متغيّر وبيدخل تكلفة القطعة إزاي — لو التخمين غلط الحسبة كلها بتتلخبط.",
      ex.filter(function(c){ return !expCatSet(c) && !trLinked(c); }).map(function(c){ return cRow(c, "اتحسب «" + EXP_CAT[expCat(c)].label + "»"); }));
    chk("exp", "warn", "اشتراكات متحسبة يوم الدفع بس", "الاشتراك بيخدم شهر — لو اتحسب كله يوم الدفع، ربح اليوم ده بيقع والأيام اللي بعده بتبان أحسن من الحقيقة.",
      ex.filter(function(c){ return expCat(c) === "subs" && c.date >= SVC_FROM && svcOf(c).days <= 1; }).map(function(c){ return cRow(c); }));
    chk("exp", "bad", "شحن فيسبوك أرقامه مش منطقية", "«دخل رصيد فيسبوك» لازم يبقى أقل من أو يساوي اللي دفعته — الفرق رسوم فوري.",
      metaTops().filter(function(c){ return metaCredit(c) > (Number(c.amount)||0) + 0.009 || metaCredit(c) <= 0; }).map(function(c){ return cRow(c, "دخل " + money(metaCredit(c))); }));
    var sp = metaSpans().filter(function(x){ return x.days > 0; }), per = sp.map(function(x){ return x.spent / x.days; }).sort(function(a, b){ return a - b; });
    var med = per.length ? per[Math.floor(per.length / 2)] : 0;
    chk("exp", "info", "يوم صرف إعلانات غريب", "صرف أكبر من 3 أضعاف المعتاد — يا إما حملة كبيرة، يا إما رقم مطابقة غلط.",
      med > 0 ? sp.filter(function(x){ return x.spent / x.days > med * 3; }).map(function(x){ return { l:dShort(x.from) + " ← " + dShort(x.to) + ": " + money(x.spent) + " (المعتاد " + money(med) + " في اليوم)", go:"tab|prepaid" }; }) : []);
    var dup = [], seen = {};                                                  // شحن فيسبوك بيتكرر بنفس المبلغ عادي — برّه الفحص
    ex.filter(function(c){ return !isMetaTop(c); }).sort(function(a, b){ return (a.date || "") < (b.date || "") ? -1 : 1; }).forEach(function(c){
      var k = expCat(c) + "|" + (Number(c.amount)||0);
      (seen[k] || []).forEach(function(o){ if(Math.abs(daysBetween(o.date, c.date)) <= 3) dup.push(cRow(c, "ومعاه واحد زيه " + dShort(o.date))); });
      (seen[k] = seen[k] || []).push(c);
    });
    chk("exp", "warn", "مصروف ممكن يكون متسجّل مرتين", "نفس النوع ونفس المبلغ في خلال 3 أيام — اتأكد إنهم مصروفين فعلاً.", dup);
    var first = S.filter(isDelivered).map(function(s){ return s.deliveredAt || s.date; }).sort()[0];
    chk("exp", "info", "«مرة واحدة» بعد فترة التأسيس", "مصاريف التأسيس بتتوزع على 3 شهور — لو المصروف ده بيتكرر يبقى نوعه «اشتراكات» أو «تاني».",
      first ? ex.filter(function(c){ return expCat(c) === "once" && daysBetween(first, c.date) > 30; }).map(function(c){ return cRow(c); }) : []);
    chk("exp", "bad", "مصروف تاريخه لسه ما جاش", "مصروف بتاريخ بعد النهارده بيخصم من الخزنة قبل معاده.",
      ex.filter(function(c){ return (c.date || "") > t; }).map(function(c){ return cRow(c); }));
    chk("exp", "bad", "مصروف بمبلغ صفر أو سالب", "مالوش معنى في الحسابات.", ex.filter(function(c){ return !((Number(c.amount)||0) > 0); }).map(function(c){ return cRow(c); }));

    // ── ٢) الأوردرات وشركات الشحن ──
    chk("ord", "bad", "أوردر متسلّم والمحصّل مش مظبوط", "مع شركة الشحن: المحصّل لازم = سعر القطع + الشحن على العميل. غير كده رصيد الشركة بيطلع غلط.",
      S.filter(function(s){ return isDelivered(s) && shipPaidGap(s); }).map(function(s){ return sRow(s, "المحصّل " + money(Number(s.paid)||0) + " والمفروض " + money(shipPaidOf(s))); }));
    chk("ord", "warn", "عميل دافع أكتر من المطلوب", "تحصيل مباشر أكبر من الأوردر — يا إما رقم غلط، يا إما ليه فلوس عندك.",
      S.filter(function(s){ return isDelivered(s) && !viaShip(s) && sDue(s) < -0.009; }).map(function(s){ return sRow(s, "زيادة " + money(-sDue(s))); }));
    chk("ord", "warn", "أوردر ملغي وعليه فلوس محصّلة", "لو العميل رجعله فلوسه سجّل ده، ولو لأ يبقى الأوردر مش ملغي.",
      S.filter(function(s){ return isCancelled(s) && !viaShip(s) && (Number(s.paid)||0) > 0.009; }).map(function(s){ return sRow(s, "محصّل " + money(Number(s.paid)||0)); }));
    var noCost = [], below = [];
    S.filter(isDelivered).forEach(function(s){
      SL(s).forEach(function(l){
        if(lineSold(l, s) <= 0) return;
        if(l.unitCost == null || l.unitCost === "") noCost.push(sRow(s, itemName(l.itemId)));
        else if((Number(l.price)||0) > 0 && (Number(l.price)||0) < Number(l.unitCost)) below.push(sRow(s, itemName(l.itemId) + " اتباع " + money(Number(l.price)||0) + " وتكلفته " + money(Number(l.unitCost))));
      });
    });
    chk("ord", "warn", "قطعة اتباعت من غير تكلفة", "التكلفة بتتحفظ يوم التسليم — من غيرها ربح الأوردر بيطلع أكبر من الحقيقة.", noCost);
    chk("ord", "warn", "قطعة اتباعت بأقل من تكلفتها", "خسارة في البضاعة نفسها قبل الشحن والإعلان.", below);
    var badSettle = [];
    live("cash").forEach(function(c){
      if(c.type !== "settle" || !Array.isArray(c.orders)) return;
      c.orders.forEach(function(id){
        var s = db.sales.find(function(y){ return y.id === id; });
        if(!s || s.deleted) badSettle.push({ l:"استلام " + dShort(c.date) + " من " + c.shipCo + " — أوردر اتمسح بعد ما اتحاسب عليه", go:"cash|" + c.id });
        else if(!(isDelivered(s) || isCancelled(s))) badSettle.push(sRow(s, "اتحاسب عليه في استلام " + dShort(c.date) + " وهو لسه مش متسلّم"));
      });
    });
    chk("ord", "bad", "استلام مربوط بأوردر مش مظبوط", "الفلوس اتحسبت على أوردر اتمسح أو لسه ما اتسلّمش — رصيد الشركة هيطلع غلط.", badSettle);
    chk("ord", "bad", "رصيد شركة بالسالب من غير مرتجعات", "الشركة مش ممكن تكون خصمت أكتر ما حصّلت إلا لو فيه مرتجع عليك.",
      shipBuckets().filter(function(co){
        var w = walletOf(co); if(w >= -0.009) return false;
        var neg = S.filter(function(s){ return squish(s.shipCo) === squish(co) && shipPend(s).left < -0.009; }).reduce(function(a, s){ return a + shipPend(s).left; }, 0);
        return w < neg - 0.009;
      }).map(function(co){ return { l:co + " · " + money(walletOf(co)), go:"tab|ship" }; }));
    var feeOut = [];
    shipBuckets().forEach(function(co){
      var L = S.filter(function(s){ return squish(s.shipCo) === squish(co) && shipCounts(s) && shipOut(s) > 0; });
      var fs = L.map(shipOut).sort(function(a, b){ return a - b; }), m = fs.length ? fs[Math.floor(fs.length / 2)] : 0;
      L.forEach(function(s){ if(m && shipOut(s) > m * 1.5) feeOut.push(sRow(s, co + " خدت " + money(shipOut(s)) + " والمعتاد " + money(m))); });
    });
    chk("ord", "info", "شحن بعيد عن المعتاد", "مصاريف شحن أعلى من المعتاد بكتير — اتأكد إن الرقم زي كشف الشركة.", feeOut);
    chk("ord", "warn", "أوردر خلص مع شركة والشحن عليه صفر", "الشركة بتاخد شحن على كل أوردر — صفر يعني الرقم ما اتكتبش.",
      S.filter(function(s){ return viaShip(s) && shipCounts(s) && !s.preCancel && !(shipOut(s) > 0); }).map(function(s){ return sRow(s); }));

    // ── ٣) المخزون والمشتريات ──
    var X = stockIdx(), neg = [];
    Object.keys(X.vars).forEach(function(id){
      Object.keys(X.vars[id]).forEach(function(k){
        var v = X.vars[id][k], lb = itemName(id) + (vLabel(v.color, v.size) ? " (" + vLabel(v.color, v.size) + ")" : "");
        if(X.stock[k] < 0) neg.push({ l:lb + " · الرصيد " + qty(X.stock[k]), go:"tab|inv" });
      });
    });
    chk("stk", "bad", "رصيد بالسالب", "اتباع أكتر من اللي اشتريته — يا إما فاتورة شراء ناقصة، يا إما أوردر متسجّل على لون أو مقاس غلط.", neg);
    var P = live("purchases").filter(function(p){ return !p.isReturn && (Number(p.qty)||0) > 0; });
    chk("stk", "warn", "مشتريات بتكلفة صفر", "القطع دي هتتباع وربحها هيطلع 100% — غلط في الحسابات.",
      P.filter(function(p){ return !((Number(p.cost)||0) > 0); }).map(function(p){ return { l:itemName(p.itemId) + " " + vLabel(vColor(p), vSize(p)) + " · " + dShort(p.date), go:"purchases|" + p.id }; }));
    chk("stk", "warn", "تكلفة أعلى من سعر البيع", "الصنف ده هيتباع بخسارة — راجع السعر أو التكلفة.",
      live("items").filter(function(i){ var c = avgCostB(i.id); return (Number(i.price)||0) > 0 && c > (Number(i.price)||0); }).map(function(i){ return { l:i.name + " · التكلفة " + money(avgCostB(i.id)) + " والسعر " + money(Number(i.price)||0), go:"tab|items" }; }));

    // ── ٤) الميزان العام ──
    var d = netAssets() - totalEquity();
    chk("bal", "bad", "الميزانية مش مقفولة", "كل اللي عندك (خزنة + بضاعة + فلوس بره) لازم = رأس المال ± الربح. الفرق ده فلوس مش عارفين راحت فين.",
      Math.abs(d) >= 0.01 ? [{ l:"الفرق " + money(d), go:"tab|capital" }] : []);
    chk("bal", "bad", "الخزنة بالسالب", "صرفت فلوس مش موجودة — يا إما حركة دخول ناقصة، يا إما مصروف متسجّل غلط.",
      cashBox() < -0.009 ? [{ l:"الخزنة " + money(cashBox()), go:"tab|cash" }] : []);
    _aud = R;
    return R;
  }
  function audCount(){ var a = { bad:0, warn:0, info:0 }; audRun().forEach(function(x){ if(x.rows.length) a[x.sev] += x.rows.length; }); return a; }
  var audOpen = {};
  function renderAudit(){
    var box = document.getElementById("aud-body"); if(!box) return;
    var R = audRun(), n = audCount(), ok = R.filter(function(x){ return !x.rows.length; }).length;
    var ic = { bad:"✗", warn:"⚠", info:"ⓘ" }, lb = { bad:"لازم يتصلح", warn:"راجعه", info:"خلي بالك" };
    var wy = document.getElementById("aud-why");
    if(wy) wy.innerHTML = "";      // v173: «مؤشراتك» في المفتاح فوق — نفس الشاشة
    document.getElementById("aud-sum").innerHTML =
      "<div class='aud-s bad'><b class='num'>" + qty(n.bad) + "</b><span>لازم يتصلح</span></div>" +
      "<div class='aud-s warn'><b class='num'>" + qty(n.warn) + "</b><span>راجعه</span></div>" +
      "<div class='aud-s info'><b class='num'>" + qty(n.info) + "</b><span>خلي بالك</span></div>" +
      "<div class='aud-s ok'><b class='num'>" + qty(ok) + "/" + qty(R.length) + "</b><span>فحص سليم ✓</span></div>";
    box.innerHTML = AUD_G.map(function(g){
      var L = R.filter(function(x){ return x.g === g[0]; });
      var bad = L.filter(function(x){ return x.rows.length; }).sort(function(a, b){ return "bad warn info".indexOf(a.sev) - "bad warn info".indexOf(b.sev); });
      var good = L.filter(function(x){ return !x.rows.length; });
      return "<div class='panel aud-g'><h3>" + esc(g[1]) + (bad.length ? "" : " <span class='aud-allok'>✓ كله سليم</span>") + "</h3>" +
        bad.map(function(x){
          var k = g[0] + "|" + x.t, op = !!audOpen[k];
          return "<div class='aud-i " + x.sev + "'><button type='button' class='aud-h' data-audk='" + esc(k) + "' aria-expanded='" + op + "'>" +
            "<span class='aud-ic'>" + ic[x.sev] + "</span><span class='aud-t'><b>" + esc(x.t) + "</b><small>" + esc(lb[x.sev]) + " · " + esc(x.why) + "</small></span>" +
            "<span class='aud-n num'>" + qty(x.rows.length) + "</span></button>" +
            (op ? "<ul class='aud-rows'>" + x.rows.map(function(r){ return "<li><a href='#' data-audgo='" + esc(r.go) + "'>" + esc(r.l) + "</a></li>"; }).join("") + "</ul>" : "") + "</div>";
        }).join("") +
        (good.length ? "<details class='aud-ok'><summary>" + qty(good.length) + " فحص سليم</summary><ul>" + good.map(function(x){ return "<li>✓ " + esc(x.t) + "</li>"; }).join("") + "</ul></details>" : "") +
        "</div>";
    }).join("");
  }
  document.addEventListener("click", function(e){
    if(!e.target.closest) return;
    var h = e.target.closest("[data-audk]");
    if(h){ audOpen[h.dataset.audk] = !audOpen[h.dataset.audk]; renderAudit(); return; }
    var a = e.target.closest("[data-audgo]"); if(!a) return;
    e.preventDefault();
    var q = a.dataset.audgo.split("|");
    if(q[0] === "sale"){ goTab("sales"); sgOpenRow(q[1]); }
    else if(q[0] === "tab") goTab(q[1]);
    else { goTab(q[0] === "cash" ? "cash" : "purch"); startEdit(q[0], q[1]); }
  });
  function renderPrepaid(){
    var box = document.getElementById("pp-body"); if(!box) return;
    var nn = function(x){ return esc(money(x)); }, t = today();
    var M = metaBook(), L = prepaidList(), spans = metaSpans(), tops = metaTops();
    var subsTot = L.reduce(function(a, x){ return a + x.left; }, 0), tot = M.bal + subsTot;
    var last = M.last, gap = last ? daysBetween(last.d, t) : null;
    document.getElementById("pp-total").textContent = money(tot);
    // ١) فيسبوك: رصيد الدفاتر وآخر مطابقة
    var st = !tops.length ? "<span class='pp-st'>لسه ما شحنتش رصيد</span>"
      : !last ? "<span class='pp-st warn'>لسه ما طابقتش ولا مرة</span>"
      : gap === 0 ? "<span class='pp-st ok'>✓ مطابق النهارده</span>"
      : gap < META_MAX_GAP ? "<span class='pp-st ok'>✓ آخر مطابقة " + esc(dShort(last.d)) + "</span>"
      : "<span class='pp-st warn'>آخر مطابقة من " + qty(gap) + " يوم</span>";
    var lastSpan = spans.length ? spans[spans.length - 1] : null;
    var meta = "<div class='pp-meta'>" +
      "<div class='pp-mh'><div><h3>رصيد فيسبوك</h3><p class='hint'>حساب الإعلانات اللي بتشحنه بفوري — الرصيد ده فلوسك لحد ما الإعلانات تصرفه.</p></div>" +
        "<div class='pp-mv'><b class='num'>" + nn(M.bal) + "</b>" + st + "</div></div>" +
      (M.after > 0.009 ? "<p class='hintline'>منه " + nn(M.after) + " شحنته بعد آخر مطابقة — طابق عشان يتخصم اللي اتصرف منه.</p>" : "") +
      "<form class='pp-rec' id='f-metarec' onsubmit='return false'>" +
        "<div><label for='mr-bal'>الرصيد في فيسبوك دلوقتي</label><input id='mr-bal' type='number' step='any' min='0' placeholder='Prepaid balance'></div>" +
        "<div><label for='mr-date'>في يوم</label><input id='mr-date' type='date' value='" + t + "'></div>" +
        "<div><button class='act' type='button' id='b-metarec'>طابق</button></div>" +
        "<p class='hintline pp-prev' id='mr-prev'>تلاقيه في فيسبوك: Billing &amp; payments ← Payment activity ← <b>Prepaid balance</b></p>" +
      "</form>" +
      (spans.length ? "<details class='pp-hist'" + (spans.length <= 3 ? " open" : "") + "><summary>المطابقات اللي فاتت (" + qty(spans.length) + ")</summary>" +
        "<div class='tbl-wrap'><table class='pp-t'><thead><tr><th>من</th><th>لحد</th><th class='num'>رصيد أول المدة</th><th class='num'>+ شحنت</th><th class='num'>− اتصرف على الإعلانات</th><th class='num'>= الرصيد</th></tr></thead><tbody>" +
        spans.slice().reverse().map(function(s){
          return "<tr><td data-l='من'>" + esc(dShort(s.from)) + "</td><td data-l='لحد'>" + esc(dShort(s.to)) + "</td>" +
            "<td class='num' data-l='رصيد أول المدة'>" + nn(s.start) + "</td><td class='num' data-l='شحنت'>" + (s.credit ? nn(s.credit) : "—") + "</td>" +
            "<td class='num v-due' data-l='اتصرف'>" + nn(s.spent) + "</td><td class='num' data-l='الرصيد'><b>" + nn(s.bal) + "</b></td></tr>";
        }).join("") + "</tbody></table></div>" +
        "<p class='hintline'>«اتصرف» فيه ضريبة القيمة المضافة 14% اللي فيسبوك بيخصمها — ده اللي بيدخل قايمة الدخل «إعلانات»، ورسوم فوري بتدخل يوم الشحن.</p></details>" : "") +
    "</div>";
    // ٢) مصاريف ليها مدة (اشتراكات وغيرها)
    var rows = L.slice().sort(function(a, b){ return a.to < b.to ? -1 : 1; }).map(function(x){
      var used = 1 - x.left / (Number(x.c.amount)||1), who = x.c.paidBy ? " · دفعه " + esc(partyName(x.c.paidBy)) : "";
      return "<tr><td class='wide' data-l='البيان'><b>" + esc(squish(x.c.note) || EXP_CAT[expCat(x.c)].label) + "</b><span class='sub'>" + esc(EXP_CAT[expCat(x.c)].label) + who + "</span></td>" +
        "<td class='num' data-l='اتدفع'>" + nn(Number(x.c.amount)||0) + "<span class='sub'>" + esc(dShort(x.c.date)) + "</span></td>" +
        "<td data-l='بيغطي'>" + esc(dShort(x.from)) + " ← " + esc(dShort(x.to)) + "<span class='pp-bar' style='--u:" + Math.round(used * 100) + "%'><i></i></span></td>" +
        "<td class='num' data-l='فاضل'><b>" + nn(x.left) + "</b><span class='sub'>" + qty(daysBetween(t, x.to)) + " يوم</span></td></tr>";
    });
    var subs = "<div class='pp-sub'><h3>اشتراكات ومصاريف ليها مدة</h3>" +
      (rows.length ? "<div class='tbl-wrap'><table class='pp-t'><thead><tr><th>البيان</th><th class='num'>اتدفع</th><th>بيغطي</th><th class='num'>فاضل</th></tr></thead><tbody>" + rows.join("") + "</tbody></table></div>"
                   : "<p class='hint'>مفيش — كل المصاريف اتحسبت يوم دفعها.</p>") +
      "<p class='hintline'>كل يوم بيعدّي بيتحول جزء منها مصروف في قايمة الدخل. التغليف ومصاريف المرة الواحدة بتتحسب يوم الدفع — مش بتظهر هنا.</p></div>";
    box.innerHTML = meta + subs;
  }
  function metaRecPreview(){
    var el = document.getElementById("mr-prev"), v = document.getElementById("mr-bal").value;
    if(!el) return;
    if(v === ""){ el.innerHTML = "تلاقيه في فيسبوك: Billing &amp; payments ← Payment activity ← <b>Prepaid balance</b>"; return; }
    var d = document.getElementById("mr-date").value || today(), R = metaRecs().filter(function(x){ return x.d < d; });
    var prev = R.length ? R[R.length - 1] : null, cr = 0;
    metaTops().forEach(function(c){ if((!prev || afterRec(c, prev)) && c.date <= d) cr += metaCredit(c); });
    var sp = (prev ? Number(prev.bal)||0 : 0) + cr - (Number(v)||0);
    el.innerHTML = sp < -0.009
      ? "<span class='v-due'>الرصيد ده أكتر من اللي شحنته — راجع الرقم، أو فيه شحنة فوري ما اتسجّلتش في الخزنة.</span>"
      : "الإعلانات صرفت <b class='num'>" + esc(money(sp)) + "</b> من " + (prev ? esc(dShort(prev.d)) : "أول شحنة") + " — هيدخل قايمة الدخل «إعلانات».";
  }
  document.addEventListener("input", function(e){ if(e.target && (e.target.id === "mr-bal" || e.target.id === "mr-date")) metaRecPreview(); });
  document.addEventListener("change", function(e){ if(e.target && e.target.id === "mr-date") metaRecPreview(); });
  document.addEventListener("click", function(e){
    if(!e.target.closest || !e.target.closest("#b-metarec")) return;
    if(!canEdit()){ toast("مالكش صلاحية تعدّل"); return; }
    var v = document.getElementById("mr-bal").value, d = document.getElementById("mr-date").value || today();
    if(v === "" || !(Number(v) >= 0)){ toast("اكتب الرصيد اللي في فيسبوك"); return; }
    if(d > today()){ toast("التاريخ لسه ما جاش"); return; }
    if(!guardLock(d, "مطابقة فيسبوك")) return;
    var L = (settings.metaRec || []).filter(function(x){ return x.d !== d; });
    L.push({ d:d, bal:Math.round(Number(v) * 100) / 100, by:me || "", at:Date.now() });
    var bad = metaRecsOk(L);
    if(bad){ toast("الرصيد ده أكتر من اللي شحنته لحد " + dShort(bad.to) + " — سجّل شحنة فوري الناقصة في الخزنة الأول", 5200); return; }
    settings.metaRec = L; saveSettings(); renderAll();
    toast("اتطابق — رصيد فيسبوك " + money(Number(v)));
  });

  /* المصروف: دفعه مين؟ · بيتحسب على كام يوم · شحن فيسبوك دخل كام */
  var svcPicked = false, creditPicked = false;
  function metaRatio(){
    var L = metaTops().filter(function(c){ return c.credit !== "" && c.credit != null && Number(c.amount) > 0; })
      .sort(function(a, b){ return (a.date||"") < (b.date||"") ? 1 : -1; });
    return L.length ? metaCredit(L[0]) / Number(L[0].amount) : 1000 / 1030;
  }
  function syncExpExtra(){
    var cat = document.getElementById("c-cat").value || expCatGuess(document.getElementById("c-note").value) || "other";
    var isExp = document.getElementById("c-type").value === "expense";
    var mw = document.getElementById("c-meta-wrap"), sw = document.getElementById("c-svc-wrap"), pw = document.getElementById("c-payer-wrap");
    if(!mw) return;
    var pb = document.getElementById("c-paidby"), cur = pb.value;
    pb.innerHTML = "<option value=''>الخزنة</option>" + partners().map(function(p){ return "<option value='" + esc(p.id) + "'>" + esc(p.name) + " — من جيبه</option>"; }).join("");
    pb.value = cur && partners().some(function(p){ return p.id === cur; }) ? cur : "";
    pw.hidden = !isExp;
    mw.hidden = !isExp || cat !== "metatop";
    sw.hidden = !isExp || cat === "metatop" || cat === "trans";
    var am = Number(document.getElementById("c-amount").value)||0, cr = document.getElementById("c-credit");
    if(!mw.hidden && !creditPicked) cr.value = am ? (Math.round(am * metaRatio() * 100) / 100) : "";
    var crv = Number(cr.value)||0;
    document.getElementById("c-credit-hint").innerHTML = mw.hidden ? "" : (crv > am + 0.009
      ? "<span class='v-due'>اللي دخل فيسبوك أكتر من اللي دفعته؟ راجع الرقم.</span>"
      : "رسوم فوري <b class='num'>" + esc(money(Math.max(0, am - crv))) + "</b> مصروف على طول · والـ<b class='num'>" + esc(money(crv)) + "</b> رصيد في «المدفوع مقدّماً» لحد ما الإعلانات تصرفه.");
    var sv = document.getElementById("c-svc");
    var d = document.getElementById("c-date").value || today();
    if(!svcPicked) sv.value = String(svcDefault(cat, d));
    var days = Number(sv.value)||1;
    document.getElementById("c-svc-hint").innerHTML = days <= 1 ? "بيدخل قايمة الدخل يوم الدفع."
      : "من " + esc(dShort(d)) + " لـ " + esc(dShort(addDays(d, days - 1))) + " — كل يوم بيتحسب <b class='num'>" + esc(money(am / days)) + "</b>، والباقي في «المدفوع مقدّماً».";
    document.getElementById("c-payer-hint").innerHTML = pb.value
      ? "الخزنة مش هتتأثر — والشركة هيبقى عليها لـ" + esc(partyName(pb.value)) + " " + esc(money(am)) + " لحد ما ترجّعهوله من «الشركاء»."
      : "";
  }
  ["c-amount","c-date","c-note","c-type"].forEach(function(id){
    var el = document.getElementById(id); if(!el) return;
    el.addEventListener("input", syncExpExtra); el.addEventListener("change", syncExpExtra);
  });
  document.addEventListener("change", function(e){
    var id = e.target && e.target.id;
    if(id === "c-svc"){ svcPicked = true; syncExpExtra(); }
    if(id === "c-paidby"){ syncExpExtra(); updateImpact("cash"); }
  });
  document.addEventListener("input", function(e){ if(e.target && e.target.id === "c-credit"){ creditPicked = true; syncExpExtra(); } });
  function renderAll(){
    clearStockIdx();                     // أضمن حتة: أي رسم كامل بيبدأ بفهرس جديد
    clearMonthly();                      // نفس السبب: أرباح الشهور مش تفضل قديمة
    pendCache = null;                    // فلوسك عند الشركة بالأوردر
    _mspan = null; _opNow = null; _aud = null;        // v142: فترات مطابقة فيسبوك · v143: تكلفة التشغيل للتسعير
    fillSelects();                       // القوايم بتتغذّى في كل الأدراج
    Object.keys(TAB_RENDER).forEach(function(t){ dirtyTabs[t] = 1; });
    renderTab(activeTab);
    navBadge();
  }
  // بتتنادى عند تغيير التبويب
  function showTab(tab){
    activeTab = tab;
    if(dirtyTabs[tab]) renderTab(tab);
  }
  /* v125 — الكروت بتظهر واحد ورا التاني لما الشاشة تتفتح. class enter لحظة وبعدها بتتشال،
     فأي رسم تاني بعد كده (بعد حفظ مثلاً) ما بيتحركش. --i = ترتيب الكارت (لحد ١٢). */
  var ENTER_SEL = ".hm-hero,.hm-k,.hm-row2 > .hm-todo,.hm-side > section,.sg-card,.sg-panel,.co-vd,.co-t,.vz-card,.kpi,.iv,.pv,.stats > div";
  function tabEnter(sec){
    if(!sec) return;
    var n = 0;
    Array.prototype.forEach.call(sec.querySelectorAll(ENTER_SEL + ",:scope > .panel"), function(el){
      if(el.hidden || el.classList.contains("as-drawer")) return;
      el.style.setProperty("--i", Math.min(n++, 12));
    });
    sec.classList.remove("enter"); void sec.offsetWidth; sec.classList.add("enter");
    countIn(sec);
    clearTimeout(sec._enterT);
    sec._enterT = setTimeout(function(){ sec.classList.remove("enter"); }, 800);
  }
  // اللوحة بتبدّل بنعومة لما تختار مرحلة تانية في الأوردرات
  function swapAnim(id){
    var el = document.getElementById(id); if(!el) return;
    el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap");
  }

