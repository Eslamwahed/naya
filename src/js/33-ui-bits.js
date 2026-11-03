  /* ---------- قايمة «اسمك ▾» ---------- */
  function meMenu(on){
    var m = document.getElementById("me-menu"), b = document.getElementById("b-me");
    if(!m || !b) return;
    m.hidden = !on; b.setAttribute("aria-expanded", on ? "true" : "false");
  }
  document.getElementById("b-me").addEventListener("click", function(){
    meMenu(document.getElementById("me-menu").hidden);
  });
  document.addEventListener("click", function(e){
    var m = document.getElementById("me-menu");
    if(m && !m.hidden && !e.target.closest(".me-wrap")) meMenu(false);
  });
  document.addEventListener("keydown", function(e){
    var m = document.getElementById("me-menu");
    if(e.key === "Escape" && m && !m.hidden){ meMenu(false); document.getElementById("b-me").focus(); }
  });

  /* ---------- «ⓘ» و«⋯ أكتر» والحاجات المطوية ---------- */
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-info]");
    if(b){
      var h = b.closest("h2"), t = h && h.nextElementSibling;
      if(t && t.hasAttribute("data-infotxt")){
        t.hidden = !t.hidden; b.setAttribute("aria-expanded", t.hidden ? "false" : "true");
      }
      return;
    }
    b = e.target.closest("[data-foldbtn]");
    if(b){
      var box = document.getElementById(b.dataset.foldbtn);
      if(box){ box.hidden = !box.hidden; b.setAttribute("aria-expanded", box.hidden ? "false" : "true"); }
      return;
    }
    // دوسة على زرار جوه «⋯ أكتر» بتقفله — اتنفّذ اللي عايزه
    var row = e.target.closest(".tmore-row");
    if(row && e.target.closest("button")){
      row.hidden = true;
      var opener = document.querySelector('[data-foldbtn="' + row.id + '"]');
      if(opener) opener.setAttribute("aria-expanded", "false");
    }
  });

  /* v109 — المبالغ: «160,225.00 ج.م» بتتقسم لـ رقم بارز + قروش وعملة هادية.
     بنلف النص اللي اترسم بس (الـtextContent فاضل هو هو بالحرف)، فأي كود
     بيقرا الرقم أو بيحسب منه شغال زي ما هو. بنراقب الإضافات بس مش الصفحة كلها. */
  (function(){
    var TAGS = { STRONG:1, B:1, TD:1, SPAN:1 };
    function reEsc(x){ return String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function wrapEl(el){
      if(!TAGS[el.tagName] || el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;
      if(el.closest("option, select, textarea, svg")) return;
      var t = el.firstChild.nodeValue, cur = settings.currency || "ج.م";
      if(t.length > 40 || t.indexOf(cur) < 0) return;
      var m = new RegExp("^(\\s*)([−\\-+]?[\\d,]+)(\\.\\d+)?(\\s*)(" + reEsc(cur) + ")(\\s*)$").exec(t);
      if(!m) return;
      /* كله جوه span واحد (.m): الخانات اللي بتتحوّل كروت على الموبايل td بتاعها
         flex، فلو الأجزاء أولاد مباشرين كانت بتتفرّق على عرض الكارت (v114) */
      var f = document.createElement("span"), add = function(txt, cls){
        if(!txt) return;
        if(!cls){ f.appendChild(document.createTextNode(txt)); return; }
        var sp = document.createElement("span"); sp.className = cls; sp.textContent = txt; f.appendChild(sp);
      };
      f.className = "m";
      // الرقم (بالسالب والقروش) في حتة اتجاهها شمال→يمين: من غيرها «-10.00» كانت بتتعرض «10.00-»
      var num = document.createElement("span"); num.className = "m-n";
      add(m[1]);
      f.appendChild(num); var g = f; f = num; add(m[2], "m-i"); add(m[3], "m-d"); f = g;
      add(m[4]); add(m[5], "m-c"); add(m[6]);
      el.textContent = ""; el.appendChild(f);
    }
    function scan(root){
      if(root.nodeType !== 1) return;
      wrapEl(root);
      var all = root.getElementsByTagName("*");
      for(var i = 0; i < all.length; i++) wrapEl(all[i]);
    }
    if(window.MutationObserver){
      new MutationObserver(function(recs){
        recs.forEach(function(r){
          if(r.type === "childList"){
            if(r.target.nodeType === 1) wrapEl(r.target);
            r.addedNodes.forEach(function(n){ scan(n); });
          }
        });
      }).observe(document.body, { childList:true, subtree:true });
    }
    scan(document.body);
  })();

  /* ═══ v137 — من React Bits (منقولة لـJavaScript عادي، من غير React) ═══
     CountUp: الأرقام الكبيرة بتعدّ لحد قيمتها لما الشاشة أو قسم التحليل يتفتح — مش مع كل حفظ.
     بتحافظ على شكل الرقم: الفاصلة والكسور، ولو الرقم مقسوم (m-i / m-d) الجزء الصحيح بس هو اللي بيعدّ.
     ease-out أسّي في ٧٠٠ms — قريب من الـspring بتاع React Bits. مع «تقليل الحركة» الرقم بيبان على طول.
     بتشتغل في أول frame: بعد ما مراقب العملة (v109) يقسّم الرقم لأجزاء، ومرة واحدة لو اتطلبت مرتين ورا بعض. */
  var COUNT_SEL = ".kpi strong,.hm-k strong,.hm-hmain strong,.vz-st b,.cfo-hero b,.cfo-sc b,.co-t b,.mbig";
  function countIn(sec){
    if(!sec || sec.hidden || sec._cuPend) return;
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    sec._cuPend = true;
    requestAnimationFrame(function(){ sec._cuPend = false; countRun(sec); });
  }
  function countRun(sec){
    if(sec.hidden) return;
    var items = [], boxes = [];
    Array.prototype.forEach.call(sec.querySelectorAll(COUNT_SEL), function(el){
      if(!el.offsetParent) return;
      var parts = el.querySelectorAll(".m-i");
      var list = parts.length ? Array.prototype.slice.call(parts) : (el.children.length ? [] : [el]);
      var any = false;
      list.forEach(function(t){
        // عدّ قديم لسه شغال ومحدش غيّر الرقم من بره: نبدأ من الرقم الأصلي مش من نص العدّ
        var prev = t._cu, txt = prev && t.textContent === prev.last ? prev.t : t.textContent;
        if(prev) prev.stop = true;
        var m = /\d[\d,]*(?:\.\d+)?/.exec(txt); if(!m) return;
        var v = Number(m[0].replace(/,/g, "")); if(!(v > 0) || !isFinite(v)) return;
        var it = { el:t, t:txt, n:m[0], v:v, dec:(m[0].split(".")[1] || "").length, comma:m[0].indexOf(",") >= 0, last:txt };
        t._cu = it; items.push(it); any = true;
      });
      // العرض بيفضل على قد الرقم النهائي وهو بيعدّ — اللي جنبه ما يتزحزحش
      if(any && !el.style.minWidth){ el.style.minWidth = Math.ceil(el.getBoundingClientRect().width) + "px"; boxes.push(el); }
    });
    if(!items.length) return;
    var t0 = 0, D = 700;
    function fmt(it, x){
      it.nf = it.nf || new Intl.NumberFormat("en-US", { minimumFractionDigits:it.dec, maximumFractionDigits:it.dec, useGrouping:it.comma });
      return it.nf.format(x);
    }
    function step(now){
      if(!t0) t0 = now;
      var k = Math.min(1, (now - t0) / D), e = k >= 1 ? 1 : 1 - Math.pow(2, -10 * k), live = 0;
      items.forEach(function(it){
        if(it.stop || !it.el.isConnected) return;
        if(it.el.textContent !== it.last){ it.stop = true; it.el._cu = null; return; }   // اترسم من بره: سيبه
        live++;
        it.last = k >= 1 ? it.t : it.t.replace(it.n, fmt(it, it.v * e));
        it.el.textContent = it.last;
        if(k >= 1) it.el._cu = null;
      });
      if(k < 1 && live) requestAnimationFrame(step);
      else boxes.forEach(function(el){ el.style.minWidth = ""; });
    }
    requestAnimationFrame(step);
  }
  // AnimatedList: قرارات «المدير المالي» بتدخل واحدة ورا التانية لما القسم يتفتح (class لحظة وبتتشال)
  function cfoListIn(){
    var el = document.getElementById("cfo-acts"); if(!el) return;
    el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    clearTimeout(el._inT); el._inT = setTimeout(function(){ el.classList.remove("in"); }, 1000);
  }
  // SpotlightCard: مستمع واحد للصفحة كلها. على الكروت اللي بتتداس بس — النور معناه «ده بيتداس»
  (function(){
    if(!window.matchMedia || !window.matchMedia("(hover:hover)").matches) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var SEL = ".hm-k,.hm-hmain,.iv,.pv,.sg-card", cur = null, last = null;
    function off(){ if(cur){ cur.classList.remove("spot-on"); cur = null; } }
    document.addEventListener("pointermove", function(e){
      var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if(el !== cur){ off(); if(el){ cur = el; el.classList.add("spot-on"); } }
      if(!el) return;
      last = e;
      if(el._spRaf) return;
      el._spRaf = requestAnimationFrame(function(){
        el._spRaf = 0; var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", (last.clientX - r.left) + "px"); el.style.setProperty("--my", (last.clientY - r.top) + "px");
      });
    }, { passive:true });
    document.documentElement.addEventListener("pointerleave", off);   // الماوس خرج من الصفحة
    window.addEventListener("blur", off);
  })();

  /* الكروت اللي فوق كل شاشة: السطر الصغير بيبان لما تقف على الكارت (title).
     بنراقب بدل ما نعدّل كل دالة بترسم كروت — أي كارت جديد بياخدها لوحده. */
  (function(){
    var pend = false;
    function tips(){
      pend = false;
      Array.prototype.forEach.call(document.querySelectorAll(".stats > div"), function(d){
        var sm = d.querySelector(":scope > small");
        var t = sm ? squish(sm.textContent) : "";
        // بنلمس بس الـtitle اللي إحنا حاطّينه — في كروت ليها title من الرسم نفسه
        if(t){ if(d.title !== t) d.title = t; d.dataset.tip = "1"; }
        else if(d.dataset.tip){ d.removeAttribute("title"); delete d.dataset.tip; }
      });
    }
    var main = document.querySelector("main");
    if(main && window.MutationObserver){
      new MutationObserver(function(){
        if(pend) return; pend = true;
        (window.requestAnimationFrame || setTimeout)(tips);
      }).observe(main, { childList:true, subtree:true });
    }
  })();

  document.getElementById("b-refresh").addEventListener("click", async function(){
    meMenu(false);
    this.disabled = true;
    if(fileHandle){
      try{ var f = await fileHandle.getFile(); absorb(JSON.parse(await f.text())); }catch(e){}
    }
    await loadAll();
    renderStorageState();
    document.getElementById("cur").value = settings.currency;
    renderAll();
    this.disabled = false; toast("البيانات اتحدّثت");
  });

  bind("f-settings","b-settings", function(form){
    settings.currency = document.getElementById("cur").value.trim() || "ج.م";
    renderAll(); toast("اتحفظت الإعدادات"); saveSettings();
  });

  /* ---------- صور الأصناف ---------- */
  var IMG_MAX = 700;          // أقصى بُعد بعد التصغير
  var IMG_LIMIT = 300 * 1024; // أقصى حجم نخزّنه محليًا لو مفيش سحابة

  function showImgPreview(src){
    var p = document.getElementById("i-img-prev");
    var b = document.getElementById("b-img-clear");
    if(src){
      p.src = src; p.hidden = false; b.hidden = false;
      p.setAttribute("data-zoom", src);        // الضغط عليها يفتحها كبيرة
      p.style.cursor = "zoom-in";
      p.title = "اضغط للتكبير";
    } else {
      p.removeAttribute("src"); p.removeAttribute("data-zoom");
      p.hidden = true; b.hidden = true;
    }
  }

  // بيصغّر الصورة في المتصفح قبل أي رفع عشان ما نحملش الشبكة
  function shrinkImage(file){
    return new Promise(function(resolve, reject){
      try{
        var reader = new FileReader();
        reader.onerror = function(){ reject(new Error("read")); };
        reader.onload = function(){
          var img = new Image();
          img.onerror = function(){ reject(new Error("decode")); };
          img.onload = function(){
            try{
              var w = img.width, h = img.height, sc = Math.min(1, IMG_MAX/Math.max(w,h));
              var c = document.createElement("canvas");
              c.width = Math.round(w*sc); c.height = Math.round(h*sc);
              c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
              c.toBlob(function(blob){
                if(!blob) return reject(new Error("blob"));
                resolve({ blob:blob, dataUrl:c.toDataURL("image/jpeg", .8) });
              }, "image/jpeg", .8);
            }catch(e){ reject(e); }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      }catch(e){ reject(e); }
    });
  }

  // الرفع على تخزين Supabase لو المزامنة متظبطة
  async function uploadImage(blob, name){
    if(!sync.url || !sync.key) return "";
    var path = "items/" + name;
    var res = await withTimeout(fetch(sync.url + "/storage/v1/object/naya/" + path, {
      method:"POST",
      headers:{ "apikey":sync.key, "Authorization":"Bearer "+sync.key,
                "Content-Type":"image/jpeg", "x-upsert":"true" },
      body: blob
    }), 30000);
    if(!res.ok) throw new Error("HTTP " + res.status);
    return sync.url + "/storage/v1/object/public/naya/" + path;
  }

  document.getElementById("i-img-file").addEventListener("change", async function(){
    var f = this.files && this.files[0];
    if(!f) return;
    this.value = "";
    toast("بنجهّز الصورة…");
    var out;
    try{ out = await shrinkImage(f); }
    catch(e){ toast("متعذّر قراءة الصورة"); return; }
    if(sync.url && sync.key){
      try{
        var url = await uploadImage(out.blob, uid() + ".jpg");
        document.getElementById("i-img").value = url;
        showImgPreview(url);
        toast("الصورة اترفعت");
        return;
      }catch(e){ /* لو الرفع فشل بنكمّل تخزين محلي */ }
    }
    if(out.dataUrl.length > IMG_LIMIT){
      toast("الصورة كبيرة — ظبّط المزامنة الأول أو استخدم رابط");
      return;
    }
    document.getElementById("i-img").value = out.dataUrl;
    showImgPreview(out.dataUrl);
    toast(sync.url ? "اتخزّنت محليًا (الرفع فشل)" : "اتخزّنت مع الصنف");
  });

  document.getElementById("i-img").addEventListener("input", function(){
    showImgPreview(this.value.trim());
  });
  document.getElementById("b-img-clear").addEventListener("click", function(){
    document.getElementById("i-img").value = "";
    showImgPreview("");
  });

  function imgOf(itemId){
    var it = db.items.find(function(x){ return x.id===itemId; });
    return (it && it.img) ? it.img : "";
  }
  function thumbHTML(itemId, big){
    var src = imgOf(itemId);
    if(!src) return "";
    return "<img class='thumb"+(big?" thumb-lg":"")+"' data-zoom='"+esc(src)+"' src='"+esc(src)+"' alt='' loading='lazy'>";
  }

  /* v179 — دايرة بلون الحتة الحقيقي جنب الصنف: الفريق يشوف ألوان الأوردر من غير ما يفتحه.
     اسم اللون بيتكتب بإيد (جملى/جملي · بنى/بني · نبيتى) — بنوحّده الأول، واللي مش معروف ما بيترسمش. */
  var SW_HEX = { "اسود":"#1D1A1C", "ابيض":"#F7F7F4", "اوف وايت":"#EEE8DC", "كريمي":"#EADFC8", "بيج":"#D8C2A4",
    "جملي":"#B07A47", "كاميل":"#B07A47", "عسلي":"#B5843A", "هافان":"#7A4A2A", "كافيه":"#8A6A4F", "بني":"#6B4429",
    "نبيتي":"#6E1F2F", "احمر":"#C0262D", "بينك":"#E8A6B8", "روز":"#D9A0A8", "موف":"#8E6BA8",
    "رصاصي":"#8E9399", "رصاصي فاتح":"#C3C7CB", "رصاصي غامق":"#5E6369", "فضي":"#B8BCC2", "سيلفر":"#B8BCC2",
    "ذهبي":"#C9A14A", "دهبي":"#C9A14A", "جولد":"#C9A14A", "نحاسي":"#B0683A",
    "اصفر":"#E3B832", "زيتي":"#5E6B3A", "اخضر":"#2F7D4F", "مينت جرين":"#A8DCC5", "مينت":"#A8DCC5",
    "لبني":"#A9CBE6", "ازرق":"#2F5DA8", "كحلي":"#1F2A44", "تايجر":"#C08A3E" };
  function swNorm(c){
    return squish(c).replace(/[ىي]/g, "ي").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+(سادة|ساده|lv|LV)$/i, "");
  }
  function swHex(c){
    var k = swNorm(c); if(!k) return "";
    return SW_HEX[k] || SW_HEX[k.split(" ")[0]] || "";
  }
  // لحد ٣ دواير — الباقي مش بيضيف معلومة في السطر
  function swatchHTML(colors){
    var seen = {}, out = [];
    (colors || []).forEach(function(c){ var h = swHex(c); if(h && !seen[h]){ seen[h] = 1; out.push([h, squish(c)]); } });
    if(!out.length) return "";
    return "<span class='sw' aria-hidden='true'>" + out.slice(0, 3).map(function(x){
      return "<i style='background:" + x[0] + "' title='" + esc(x[1]) + "'></i>"; }).join("") + "</span>";
  }

  // تكبير الصورة بالضغط
  document.body.addEventListener("click", function(e){
    var t = e.target.closest("[data-zoom]");
    if(t){
      document.getElementById("img-zoom-src").src = t.dataset.zoom;
      document.getElementById("img-zoom").hidden = false;
      return;
    }
    if(e.target.closest("#img-zoom")) document.getElementById("img-zoom").hidden = true;
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape") document.getElementById("img-zoom").hidden = true;
  });

  var SQL_IMG = [
    "insert into storage.buckets (id, name, public)",
    "values ('naya','naya',true)",
    "on conflict (id) do update set public = true;",
    "",
    "drop policy if exists naya_img_read on storage.objects;",
    "create policy naya_img_read on storage.objects",
    "for select to anon using (bucket_id = 'naya');",
    "",
    "drop policy if exists naya_img_write on storage.objects;",
    "create policy naya_img_write on storage.objects",
    "for insert to anon with check (bucket_id = 'naya');",
    "",
    "drop policy if exists naya_img_update on storage.objects;",
    "create policy naya_img_update on storage.objects",
    "for update to anon using (bucket_id = 'naya') with check (bucket_id = 'naya');"
  ].join("\n");

  /* ---------- بوليصة الشحن ---------- */
  function labelHTML(saleId){
    var s = db.sales.find(function(x){ return x.id===saleId; });
    if(!s) return "";
    var p = db.parties.find(function(x){ return x.id===s.partyId; }) || {};
    var cod = isDelivered(s) ? (saleTotal(s) + shipIn(s) - (Number(s.paid)||0))
                             : (saleTotal(s) + shipIn(s));
    var goods = SL(s).map(function(l){
      return itemName(l.itemId) + (vLabel(vColor(l),vSize(l)) ? " (" + vLabel(vColor(l),vSize(l)) + ")" : "") +
        " × " + qty(Number(l.qty)||0);
    }).join("<br>");
    var rowsHTML = [
      ["رقم الأوردر", s.no ? "#"+s.no : "—"],
      ["الاسم", p.name||"—"],
      ["التليفون", p.phone||"—"],
      ["المحافظة", p.gov||"—"],
      ["العنوان", p.address||"—"],
      ["الأصناف", goods || "—", true],
      ["قيمة البضاعة", money(saleTotal(s))],
      ["الشحن على العميل", money(shipIn(s))],
      ["شركة الشحن", s.shipCo||"—"],
      ["كود شركة الشحن", s.shipCode||"—"],
      ["المسؤول", s.owner||"—"],
      ["التاريخ", s.date||"—"]
    ].map(function(x){
      return "<tr><th>"+esc(x[0])+"</th><td>"+(x[2] ? x[1] : esc(x[1]))+"</td></tr>";
    }).join("");
    return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
      '<title>بوليصة ' + esc(p.name||"") + '</title><style>' +
      'body{font-family:"Segoe UI",Tahoma,sans-serif;padding:20px;color:#16211E}' +
      'h1{font-size:1.1rem;margin:0 0 4px}.sub{color:#5B6B66;font-size:.8rem;margin-bottom:14px}' +
      'table{width:100%;border-collapse:collapse;font-size:.95rem}' +
      'th,td{border:1px solid #999;padding:7px 10px;text-align:right}' +
      'th{width:34%;background:#F2F4F3;font-weight:600}' +
      '.cod{margin-top:14px;font-size:1.15rem;font-weight:700;border:2px solid #16211E;padding:10px;text-align:center}' +
      '@media print{body{padding:0}}</style></head><body>' +
      '<h1>Lora Collection — بوليصة شحن</h1><div class="sub">' + esc(s.note||"") + '</div>' +
      '<table>' + rowsHTML + '</table>' +
      '<div class="cod">المطلوب تحصيله: ' + esc(money(cod)) + '</div>' +
      '<scr'+'ipt>window.onload=function(){window.print()}</scr'+'ipt></body></html>';
  }

  function printLabel(saleId){
    var html = labelHTML(saleId);
    if(!html) return;
    var w = window.open("", "_blank");
    if(!w){ toast("المتصفح منع فتح نافذة الطباعة"); return; }
    w.document.write(html); w.document.close();
  }

