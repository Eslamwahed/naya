  /* ---------- فلاتر الخزنة ---------- */
  var cfilt = { dir:"", kind:"", src:"", from:"", to:"", text:"" };
  var CF_LABEL = { dir:"الاتجاه", kind:"النوع", src:"المصدر", from:"من", to:"لـ", text:"بحث" };
  var CF_ID = { dir:"cf-dir", kind:"cf-kind", src:"cf-src", from:"cf-from", to:"cf-to", text:"cf-text" };

  function readCashFilters(){
    Object.keys(CF_ID).forEach(function(k){
      var el = document.getElementById(CF_ID[k]);
      cfilt[k] = el ? (el.value||"").trim() : "";
    });
  }
  function cfChipText(k){
    if(k === "dir") return cfilt.dir === "in" ? "داخل بس" : "خارج بس";
    if(k === "src") return cfilt.src === "يدوي" ? "يدوي" : "تلقائي";
    return cfilt[k];
  }
  function renderCashChips(){
    var keys = Object.keys(CF_LABEL).filter(function(k){ return cfilt[k]; });
    var c = document.getElementById("cf-count");
    if(c){ c.textContent = keys.length; c.hidden = !keys.length; }
    var box = document.getElementById("cf-chips");
    if(!box) return;
    box.innerHTML = !keys.length ? "" :
      keys.map(function(k){
        return "<span class='chip'>" + esc(CF_LABEL[k]) + ": <b>" + esc(cfChipText(k)) + "</b>" +
          "<button type='button' data-rmcf='" + k + "' aria-label='شيل فلتر " + esc(CF_LABEL[k]) + "'>&times;</button></span>";
      }).join("") + "<button class='clearall' type='button' id='b-clearcf'>مسح الكل</button>";
  }
  // بتتطبّق على العرض بس — الرصيد التراكمي بيتحسب على الدفتر كامل قبلها
  function cashMatch(x){
    if(cfilt.dir === "in"  && !x.inn) return false;
    if(cfilt.dir === "out" && !x.out) return false;
    if(cfilt.kind && x.kind !== cfilt.kind) return false;
    if(cfilt.src === "يدوي"   && !x.id) return false;
    if(cfilt.src === "تلقائي" &&  x.id) return false;
    if(cfilt.from && (x.d||"") < cfilt.from) return false;
    if(cfilt.to   && (x.d||"") > cfilt.to)   return false;
    if(cfilt.text){
      var q = cfilt.text.toLowerCase();
      if(((x.who||"")+" "+(x.note||"")+" "+(x.t||"")).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  }

  function renderCashStats(shown, tin, tout){
    var el = document.getElementById("cash-stats");
    if(!el) return;
    var bal = cashBox(), wal = walletsTotal();
    var filtered = Object.keys(CF_LABEL).some(function(k){ return cfilt[k]; });
    var scope = filtered ? "في الحركات المعروضة" : "من أول يوم";
    var cells = [
      ["رصيد الخزنة", money(bal), bal >= 0 ? "" : "v-due",
        bal >= 0 ? "الفلوس اللي في إيدك دلوقتي" : "بالسالب — في حركة ناقصة أو صرف زيادة"],
      ["داخل", money(tin), tin ? "v-gain" : "", scope],
      ["خارج", money(tout), tout ? "v-due" : "", scope]
    ];
    // «في محافظ الشحن» اتشالت من هنا: موجودة في الرئيسية وشاشة شركات الشحن
    void wal;
    el.innerHTML = cells.map(function(c){
      return "<div><span>"+esc(c[0])+"</span><strong class='num "+c[2]+"'>"+esc(c[1])+"</strong>" +
        "<small>"+esc(c[3])+"</small></div>";
    }).join("");
  }

  function renderCash(){
    var L = cashLedger(), run = 0;
    var tin = 0, tout = 0, shown = 0;
    var rows = [];
    L.forEach(function(x){
      run += x.inn - x.out;               // الرصيد الحقيقي — بيعدّ كل حركة حتى المخفية بالفلتر
      if(!cashMatch(x)) return;
      shown++; tin += x.inn; tout += x.out;
      rows.push("<tr><td class='num'>"+esc(x.d)+"</td>"+
        "<td>"+esc(x.t)+"<span class='sub'>"+esc(x.src)+"</span></td>"+
        "<td class='wide'>"+esc(x.who)+(x.note?"<span class='sub'>"+esc(x.note)+"</span>":"")+"</td>"+
        "<td class='num "+(x.inn?"v-gain":"")+"'>"+(x.inn?money(x.inn):"—")+"</td>"+
        "<td class='num "+(x.out?"v-due":"")+"'>"+(x.out?money(x.out):"—")+"</td>"+
        "<td class='num "+(run<0?"v-due":"")+"'>"+money(run)+"</td>"+
        // حركة رأس المال ليها درجها الخاص. درج الخزنة مافيهوش نوعها،
        // فلو اتفتحت منه ممكن تتحوّل بالغلط لتحصيل عادي وتضيع من رأس المال.
        "<td>"+(x.id
          ? (x.cap
              ? "<button class='del' style='color:var(--teal)' data-editcap='"+x.id+"'>تعديل</button>"
              : "<button class='del' style='color:var(--teal)' data-edit='cash|"+x.id+"'>تعديل</button>") +
            "<button class='del' data-del='cash' data-id='"+x.id+"'>حذف</button>"
          : "<span style='font-size:var(--fs-1);color:var(--ink-soft)' title='الحركة دي جاية من أوردر أو شراء — عدّلها من شاشتها'>تلقائي</span>")+"</td></tr>");
    });
    renderCashChips();
    // الرصيد التراكمي اتحسب فوق على الدفتر كامل، فالتقسيم ما بيأثّرش عليه
    rows = pageRows("cash", rows, true);
    table("t-cash", ["التاريخ","الحركة","الجهة","داخل","خارج","الرصيد بعدها",""], rows,
      L.length ? "مفيش حركات مطابقة للفلتر. امسح الفلاتر عشان تشوف الدفتر كامل."
               : "الخزنة فاضية. أول حركة في السيستم هي تسجيل رأس المال من تبويب «رأس المال» — وهو اللي بتشتري بيه بضاعة وتدفع منه المصاريف.");
    renderCashStats(shown, tin, tout);
    renderCashKinds(L);
    renderCashDays(L);
  }

  /* ---------- الخزنة بالأيام ----------
     نفس الدفتر ونفس الفلتر، بس الأحدث فوق ومتجمّع بالأيام. رصيد آخر
     اليوم بيتحسب على الدفتر كامل (حتى الحركات المخفية بالفلتر) —
     نفس «الرصيد بعدها» في الجدول، فرصيد آخر يوم = رصيد الخزنة. */
  var CASH_KINDS = [["", "الكل"], ["مصروف", "مصاريف"], ["دفع", "موردين"], ["شحن", "شركات شحن"],
                    ["تحصيل", "تحصيل"], ["رأس مال", "رأس مال"], ["افتتاحي", "افتتاحي"]];
  var CASH_IC = { "تحصيل":"hand", "دفع":"factory", "مصروف":"receipt", "شحن":"truck", "رأس مال":"user", "افتتاحي":"book" };
  function renderCashKinds(L){
    var box = document.getElementById("cash-kinds");
    if(!box) return;
    var n = {}; L.forEach(function(x){ n[x.kind] = (n[x.kind] || 0) + 1; });
    box.innerHTML = CASH_KINDS.filter(function(k){ return !k[0] || n[k[0]] || cfilt.kind === k[0]; })
      .map(function(k){
        var c = k[0] ? (n[k[0]] || 0) : L.length, on = (cfilt.kind || "") === k[0];
        return "<button type='button' data-cashkind='" + esc(k[0]) + "'" + (on ? " class='on' aria-pressed='true'" : " aria-pressed='false'") +
               ">" + esc(k[1]) + " <b>" + qty(c) + "</b></button>";
      }).join("");
  }
  function dayLabel(d){
    try{
      var t = new Date(d + "T00:00:00");
      if(!isNaN(t)) return t.toLocaleDateString("ar-EG-u-nu-latn", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    }catch(e){}
    return d || "—";
  }
  function renderCashDays(L){
    var box = document.getElementById("cash-days");
    if(!box) return;
    var run = 0, dayEnd = {}, items = [];
    L.forEach(function(x){
      run += x.inn - x.out;
      dayEnd[x.d] = run;
      if(cashMatch(x)) items.push(x);
    });
    items.reverse();                                   // الأحدث فوق
    var page = pageRows("cash", items);
    var filtered = Object.keys(CF_LABEL).some(function(k){ return cfilt[k]; });
    var days = [], cur = null;
    page.forEach(function(x){
      if(!cur || cur.d !== x.d){ cur = { d:x.d, list:[], net:0 }; days.push(cur); }
      cur.list.push(x); cur.net += x.inn - x.out;
    });
    if(!days.length){
      box.innerHTML = "<p class='cd-empty'>" + esc(L.length ? "مفيش حركات مطابقة للفلتر — امسح الفلاتر عشان تشوف الدفتر كامل."
        : "الخزنة فاضية. أول حركة هي تسجيل رأس المال من «رأس المال».") + "</p>";
      return;
    }
    box.innerHTML = days.map(function(dy){
      var bal = dayEnd[dy.d];
      return "<div class='cd-day'><div class='cd-h'><b>" + esc(dayLabel(dy.d)) + "</b>" +
        "<span>" + (filtered ? "صافي المعروض " : "صافي اليوم ") +
          "<b class='num " + (dy.net >= 0 ? "v-gain" : "v-due") + "'>" + (dy.net >= 0 ? "+" : "−") + esc(money(Math.abs(dy.net))) + "</b>" +
          " · الرصيد <b class='num" + (bal < 0 ? " v-due" : "") + "'>" + esc(money(bal)) + "</b></span></div>" +
        dy.list.map(function(x){
          var inn = x.inn > 0.009, who = (x.who && x.who !== "—") ? x.who : "";
          var acts = x.id
            ? (x.cap ? "<button class='del' style='color:var(--teal)' data-editcap='" + x.id + "'>تعديل</button>"
                     : "<button class='del' style='color:var(--teal)' data-edit='cash|" + x.id + "'>تعديل</button>") +
              "<button class='del' data-del='cash' data-id='" + x.id + "'>حذف</button>"
            : "";
          return "<div class='cd-mv " + (inn ? "in" : "out") + "'>" +
            "<span class='ic' aria-hidden='true'>" + (CASH_IC[x.kind] ? ico(CASH_IC[x.kind]) : "•") + "</span>" +
            "<span class='cd-t'><b>" + esc(x.t) + (who ? " · " + esc(who) : "") +
              (x.id ? "<span class='cd-tag'>" + esc(x.src) + "</span>" : "") + "</b>" +
              (x.note ? "<span class='sub'>" + esc(x.note) + "</span>" : "") + "</span>" +
            "<span class='cd-a num'>" + (inn ? "+" + esc(money(x.inn)) : "−" + esc(money(x.out))) + "</span>" +
            "<span class='cd-x'>" + acts + "</span></div>";
        }).join("") + "</div>";
    }).join("");
  }
  document.getElementById("cash-kinds").addEventListener("click", function(e){
    var b = e.target.closest("[data-cashkind]"); if(!b) return;
    var sel = document.getElementById("cf-kind");
    if(sel) sel.value = b.dataset.cashkind;
    readCashFilters(); resetPage("cash"); renderCash();
  });
  // الزراير السريعة: نفس درج «حركة نقدية» بس النوع متحدّد
  document.getElementById("cash-quick").addEventListener("click", function(e){
    var b = e.target.closest("[data-cashq]"); if(!b) return;
    openEntry("cash");
    var t = document.getElementById("c-type");
    if(t){ t.value = b.dataset.cashq; t.dispatchEvent(new Event("change", { bubbles:true })); }
    var a = document.getElementById("c-amount");
    if(a) setTimeout(function(){ try{ a.focus(); }catch(err){} }, 60);
  });


  /* ---------- صورة الخزنة للموبايل ----------
     مش لقطة شاشة: الشاشة عرضها لابتوب، ولو صوّرناها الخط بيطلع
     صغير على التليفون. بنرسم كارت لكل حركة على canvas بعرض تليفون
     وخط كبير، فالصورة بتتقرا وهي متبعوتة على واتساب من غير تكبير.
     وبنرسمها فاتحة دايمًا حتى لو السيستم ليلي — الصورة بتتشارك. */
  var CI = { W:760, PAD:28, S:3 };          // العرض بالنقط · الهامش · درجة الوضوح
  var CI_C = {
    bg:"#FFFFFF", card:"#F7F8F9", line:"#DCDFE2", ink:"#1D1A1C", soft:"#5D6166",
    brand:"#4E1B27", gain:"#1E6F50", due:"#A32846", chip:"#F1F2F4"
  };
  function ciFont(w, px){ return w + " " + px + "px Alexandria, system-ui, sans-serif"; }
  function ciRound(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
  }
  // نص عربي من اليمين ورقم من الشمال — كل واحد برسمة لوحده
  function ciR(ctx, t, x, y, font, color){
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = "right"; ctx.direction = "rtl";
    ctx.fillText(String(t), x, y);
  }
  function ciL(ctx, t, x, y, font, color){
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = "left"; ctx.direction = "ltr";
    ctx.fillText(String(t), x, y);
  }
  function ciCut(ctx, t, font, max){
    ctx.font = font;
    var v = String(t == null ? "" : t);
    if(ctx.measureText(v).width <= max) return v;
    while(v.length > 1 && ctx.measureText(v + "…").width > max) v = v.slice(0, -1);
    return v + "…";
  }

  // اللي هيتصوّر: نفس اللي قدامك بالفلتر، بس من غير تقسيم صفحات
  function cashImgData(){
    var L = cashLedger(), run = 0, out = [], tin = 0, tout = 0;
    L.forEach(function(x){
      run += x.inn - x.out;                 // الرصيد الحقيقي بيعدّ كل حركة حتى المخفية
      if(!cashMatch(x)) return;
      tin += x.inn; tout += x.out;
      out.push({ d:x.d, t:x.t, src:x.src, who:x.who, note:x.note,
                 inn:x.inn, out:x.out, run:run });
    });
    return { rows:out, tin:tin, tout:tout };
  }
  function cashImgFilterTxt(){
    var on = Object.keys(CF_LABEL).filter(function(k){ return cfilt[k]; })
      .map(function(k){ return CF_LABEL[k] + ": " + cfilt[k]; });
    return on.length ? on.join("  ·  ") : "كل الحركات من أول يوم";
  }

  function drawCashImage(){
    var d = cashImgData();
    var CAP = 200;
    var rows = d.rows.slice(-CAP);            // الأحدث لو الدفتر طويل
    var cut = d.rows.length - rows.length;

    var W = CI.W, P = CI.PAD, inner = W - P*2;
    var HEAD = 150, STAT = 116, GAP = 12, ROW = 128, FOOT = cut ? 92 : 56;
    var statH = STAT*2 + GAP;
    var bodyTop = HEAD + statH + 26;
    var H = bodyTop + (rows.length ? rows.length*(ROW+GAP) : 110) + FOOT + P;

    var cv = document.createElement("canvas");
    cv.width = W*CI.S; cv.height = H*CI.S;
    var ctx = cv.getContext("2d");
    ctx.scale(CI.S, CI.S);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = CI_C.bg; ctx.fillRect(0, 0, W, H);

    // ترويسة
    ctx.fillStyle = CI_C.brand; ctx.fillRect(0, 0, W, 6);
    var R = W - P;                                     // حرف اليمين
    ciR(ctx, "الخزنة", R, 70, ciFont(700, 40), CI_C.brand);
    ciR(ctx, "Lora Collection", R, 104, ciFont(500, 20), CI_C.soft);
    ciR(ctx, ciCut(ctx, cashImgFilterTxt(), ciFont(400, 18), inner), R, 132, ciFont(400, 18), CI_C.soft);
    ciL(ctx, today(), P, 70, ciFont(500, 20), CI_C.soft);

    // أربع كروت
    var bal = cashBox(), wal = walletsTotal();
    var cells = [
      ["رصيد الخزنة", money(bal), bal >= 0 ? CI_C.brand : CI_C.due],
      ["في محافظ الشحن", money(wal), wal > 0.009 ? CI_C.due : CI_C.soft],
      ["داخل", money(d.tin),  d.tin  ? CI_C.gain : CI_C.soft],
      ["خارج", money(d.tout), d.tout ? CI_C.due  : CI_C.soft]
    ];
    var cw = (inner - GAP) / 2;
    cells.forEach(function(c, i){
      var col = i % 2, rowi = (i / 2) | 0;
      // العمود الأول على اليمين — الشاشة كلها من اليمين للشمال
      var x = P + (col === 0 ? cw + GAP : 0);
      var y = HEAD + rowi * (STAT + GAP);
      ctx.fillStyle = CI_C.card; ciRound(ctx, x, y, cw, STAT, 14); ctx.fill();
      ctx.strokeStyle = CI_C.line; ctx.lineWidth = 1; ctx.stroke();
      ciR(ctx, c[0], x + cw - 18, y + 36, ciFont(500, 19), CI_C.soft);
      ciR(ctx, c[1], x + cw - 18, y + 80, ciFont(700, 30), c[2]);
    });

    // كارت لكل حركة
    if(!rows.length){
      ciR(ctx, "مفيش حركات في الفلتر ده.", R, bodyTop + 50, ciFont(500, 22), CI_C.soft);
    }
    rows.forEach(function(x, i){
      var y = bodyTop + i * (ROW + GAP);
      ctx.fillStyle = CI_C.bg; ciRound(ctx, P, y, inner, ROW, 14); ctx.fill();
      ctx.strokeStyle = CI_C.line; ctx.lineWidth = 1; ctx.stroke();
      // شريط جانبي بلون الاتجاه — بيخلّي الداخل والخارج يتفرزوا بالعين
      ctx.fillStyle = x.inn ? CI_C.gain : CI_C.due;
      ciRound(ctx, P + inner - 5, y, 5, ROW, 3); ctx.fill();

      ciR(ctx, ciCut(ctx, x.t, ciFont(600, 24), inner*0.55), P + inner - 20, y + 36,
          ciFont(600, 24), CI_C.ink);
      ciL(ctx, x.d, P + 18, y + 36, ciFont(500, 19), CI_C.soft);

      // المصروف مالوش جهة، فـ«—» كانت بتطلع قبل البيان من غير لزمة
      var nm = (x.who && x.who !== "—") ? x.who : "";
      var who = [nm, x.note].filter(Boolean).join(" · ") || "—";
      ciR(ctx, ciCut(ctx, who, ciFont(400, 20), inner - 40), P + inner - 20, y + 68,
          ciFont(400, 20), CI_C.soft);

      var amt = x.inn ? money(x.inn) : money(x.out);
      ciR(ctx, (x.inn ? "داخل " : "خارج ") + amt, P + inner - 20, y + 106,
          ciFont(700, 24), x.inn ? CI_C.gain : CI_C.due);
      ciL(ctx, "الرصيد " + money(x.run), P + 18, y + 106, ciFont(600, 21),
          x.run < 0 ? CI_C.due : CI_C.soft);
    });

    var fy = bodyTop + (rows.length ? rows.length*(ROW+GAP) : 110) + 16;
    ctx.strokeStyle = CI_C.line; ctx.beginPath();
    ctx.moveTo(P, fy); ctx.lineTo(W - P, fy); ctx.stroke();
    if(cut){
      ciR(ctx, "الصورة فيها آخر " + qty(rows.length) + " حركة من " + qty(d.rows.length) +
               " — فلتر بالتاريخ عشان تاخد الباقي.", R, fy + 34, ciFont(500, 18), CI_C.due);
    }
    ciR(ctx, qty(d.rows.length) + " حركة · إصدار " + VERSION, R, fy + (cut ? 64 : 34),
        ciFont(400, 17), CI_C.soft);
    return cv;
  }

  function downloadBlob(name, blob){
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }
  document.getElementById("b-stmt-close").addEventListener("click", function(){
    statementFor = null; renderStatement(); renderParties();
  });
  document.getElementById("b-cash-img").addEventListener("click", function(){
    var btn = this, old = btn.textContent;
    btn.disabled = true; btn.textContent = "بيحضّر…";
    var go = function(){
      try{
        drawCashImage().toBlob(function(blob){
          btn.disabled = false; btn.textContent = old;
          if(!blob){ toast("المتصفح ما قدرش يعمل الصورة"); return; }
          downloadBlob("lora-khazna-" + today() + ".png", blob);
          toast("الصورة نزلت");
        }, "image/png");
      } catch(e){
        btn.disabled = false; btn.textContent = old;
        toast("الصورة ما اتعملتش: " + (e && e.message || e));
      }
    };
    // الخط لازم يبقى محمّل قبل الرسم وإلا بيترسم بخط افتراضي
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
    else go();
  });

  function renderItems(){
    var rows = live("items").map(function(i){
      var n = (i.tiers||[]).length;
      var nv = variantsOf(i.id).length;
      return "<tr><td class='wide'>"+thumbHTML(i.id)+esc(i.name)+"</td><td>"+esc(i.unit||"—")+"</td>"+
        "<td class='num'>"+money(i.price)+"</td><td class='num'>"+qty(stockOf(i.id))+"</td>"+
        "<td><button class='del' style='color:var(--teal)' data-vars='"+i.id+"'>"+
        (nv > 1 ? qty(nv)+" لون/مقاس" : "ألوان ومقاسات")+"</button></td>"+
        "<td><button class='del' style='color:var(--teal)' data-offers='"+i.id+"'>"+
        (n ? n+" عروض" : "إضافة عرض")+"</button></td>"+
        "<td><button class='del' style='color:var(--teal)' data-edit='items|"+i.id+"'>تعديل</button></td>"+
        "<td><button class='del' data-del='items' data-id='"+i.id+"'>حذف</button></td></tr>";
    });
    table("t-items", ["الصنف","الوحدة","سعر بيع القطعة","الرصيد","ألوان ومقاسات","عروض الكمية","",""], rows, "ابدأ بإضافة صنف: اسمه، سعر بيعه، وألوانه ومقاساته لو ليه.");
  }

  var varsFor = null;
  function renderVars(){
    var panel = document.getElementById("vars-panel");
    if(!varsFor){ panel.hidden = true; return; }
    var it = db.items.find(function(x){ return x.id===varsFor; });
    if(!it || it.deleted){ panel.hidden = true; varsFor = null; return; }
    panel.hidden = false;
    document.getElementById("vars-title").textContent = "ألوان ومقاسات: " + it.name;
    document.getElementById("v-colors").value = it.colors || "";
    document.getElementById("v-sizes").value = it.sizes || "";
    var rowFor = function(v){
      var st = stockOfV(it.id,v.color,v.size), rs = reservedOfV(it.id,v.color,v.size);
      var label = vLabel(v.color, v.size) || "بدون لون/مقاس";
      var ck = esc(codeKey(v.color, v.size));
      return "<tr><td class='wide'>"+esc(label)+"</td>"+
        "<td><input class='vcode' data-vcode=\""+ck+"\" value=\""+esc(vCode(it.id,v.color,v.size))+"\" "+
          "placeholder='—' autocomplete='off' dir='ltr'></td>"+
        "<td class='num "+(st<=0?"v-due":"")+"'>"+qty(st)+"</td>"+
        "<td class='num'>"+(rs?"<span class='pill due'>"+qty(rs)+"</span>":"—")+"</td>"+
        "<td class='num'>"+qty(st-rs)+"</td>"+
        "<td class='num'>"+money(avgCostV(it.id,v.color,v.size))+"</td></tr>";
    };
    var HEAD = ["اللون / المقاس","الكود","الرصيد","محجوز","متاح","متوسط التكلفة"];

    var have = variantsOf(it.id).filter(function(v){
      return stockOfV(it.id,v.color,v.size) !== 0 || avgCostV(it.id,v.color,v.size) > 0;
    });
    var haveKeys = {};
    have.forEach(function(v){ haveKeys[vKey(it.id,v.color,v.size)] = 1; });
    table("t-vars", HEAD, have.map(rowFor),
      "لسه ما اشتريتش حاجة من الصنف ده. أول فاتورة شراء والألوان والمقاسات هتظهر هنا لوحدها.");

    // الباقي مطوي: تركيبات معرّفة بس لسه ما اشتريتش منها
    var rest = variantsAll(it.id).filter(function(v){ return !haveKeys[vKey(it.id,v.color,v.size)]; });
    var box = document.getElementById("vars-rest");
    if(box){
      box.hidden = !rest.length;
      if(rest.length){
        document.getElementById("vars-rest-n").textContent = qty(rest.length);
        table("t-vars-rest", HEAD, rest.map(rowFor), "");
      }
    }
  }

  var offersFor = null;
  function renderOffers(){
    var panel = document.getElementById("offers-panel");
    if(!offersFor){ panel.hidden = true; return; }
    var it = db.items.find(function(x){ return x.id===offersFor; });
    if(!it || it.deleted){ panel.hidden = true; offersFor = null; return; }
    panel.hidden = false;
    document.getElementById("offers-title").textContent = "عروض الكمية: " + it.name;
    var rows = tiersOf(it).map(function(t){
      var base = t.q === 1;
      return "<tr><td class='num'>"+(base ? "قطعة واحدة" : "من "+qty(t.q)+" قطع")+"</td>"+
        "<td class='num'>"+money(t.u)+"</td>"+
        "<td class='num'>"+money(t.u*t.q)+"</td>"+
        "<td class='num'>"+(base ? "—" : "وفّر "+money(((Number(it.price)||0)-t.u)*t.q))+"</td>"+
        "<td>"+(base ? "<span class='pill'>السعر الأساسي</span>"
          : "<button class='del' data-tier='"+it.id+"|"+t.q+"'>حذف</button>")+"</td></tr>";
    });
    table("t-offers", ["الكمية","سعر القطعة","إجمالي العرض","مكسب العميل",""], rows, "");
    var cn = document.getElementById("offers-cnote"), cps = Object.keys(it.cprice || {}).filter(function(c){ return colorPrice(it, c) > 0; });
    cn.hidden = !cps.length;
    cn.textContent = cps.length ? "العروض دي ما بتتطبّقش على " + cps.join(" · ") + " — ليهم سعر خاص في «الأسعار»." : "";
  }

