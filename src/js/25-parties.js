  /* ================= العملاء والموردين: كارت لكل واحد =================
     كشف الحساب جوه الكارت بيتبني بنفس قواعد partyBalance سطر سطر —
     فرصيد آخر سطر = رصيد الجهة في كل مكان تاني بالظبط. أوردر الشركة
     بيبان سطرين: الأوردر، وتحته «دفع للمندوب» — والرصيد بيرجع صفر. */
  var ptTab = "customer", ptOnly = "all", ptOpen = null;
  var PT_FLAG = 2;                        // من كام رفضة تظهر العلامة الحمرا
  function refusalsOf(partyId){
    return live("sales").filter(function(x){ return x.partyId === partyId && isCancelled(x); }).length;
  }
  function refusalFlag(partyId){
    var n = refusalsOf(partyId);
    if(n < PT_FLAG) return "";
    var all = live("sales").filter(function(x){ return x.partyId === partyId; }).length;
    return "<span class='pt-flag' title='العميل ده رفض أوردرات قبل كده'>رفض " + qty(n) + " من " + qty(all) + "</span>";
  }
  function partyLines(p){
    var L = [];
    live("sales").forEach(function(x){
      if(x.partyId !== p.id) return;
      var pd = Number(x.paid)||0, no = x.no ? "#" + x.no : "";
      if(isDelivered(x)){
        L.push({ d:x.date, at:x.at||0, o:x.id, no:no, t:itemsLabel(x) + (shipIn(x) ? " + شحن" : ""), v:saleTotal(x) + shipIn(x) });
        // الدفع عمره ما يسبق الأوردر نفسه في الكشف (حتى لو تاريخ التسليم متسجّل قبله)
        var pdD = (x.deliveredAt && x.deliveredAt > (x.date || "")) ? x.deliveredAt : x.date;
        if(pd > 0.009) L.push({ d:pdD, at:(x.at||0) + 0.5, o:x.id, no:no,
          t: viaShip(x) ? "دفع للمندوب (" + (squish(x.shipCo) || "شركة الشحن") + ")" : "دفع (تحصيل مباشر)", v:-pd });
      } else if(!isCancelled(x) && pd > 0.009){
        L.push({ d:x.date, at:x.at||0, o:x.id, no:no, t:"عربون على أوردر لسه ما اتسلّمش", v:-pd });
      }
    });
    var inv = {}, order = [];
    live("purchases").forEach(function(x){
      if(x.opening || x.partyId !== p.id) return;
      var k = x.batchId || ("solo:" + x.id);
      if(!inv[k]){ inv[k] = { d:x.date, at:x.at||0, pno:x.pno, goods:0, paid:0, items:{}, x:false, ret:0, take:0 }; order.push(k); }
      var g = inv[k];
      g.goods += goodsTotal(x); g.paid += Number(x.paid)||0; g.items[itemName(x.itemId)] = 1;
      if(x.xchg){
        g.x = true;
        if(isPRet(x)) g.ret += -goodsTotal(x) - (Number(x.xloss)||0);   // اللي المورد حسبه فعلاً
        else g.take += goodsTotal(x);
      }
      if((x.date||"") < (g.d||"")) g.d = x.date;
    });
    order.forEach(function(k){
      var g = inv[k], what = Object.keys(g.items).slice(0, 2).join(" · ");
      if(g.x){
        // الاستبدال: رجّعت (ليك) · خدت (عليك) · ودفعت أو استرديت الفرق
        var xl = "استبدال" + (g.pno ? " #" + g.pno : "");
        if(g.ret > 0.009)  L.push({ d:g.d, at:g.at,       t:"رجّعت في " + xl, v:g.ret });
        if(g.take > 0.009) L.push({ d:g.d, at:g.at + 0.2, t:"خدت في " + xl + " · " + what, v:-g.take });
        if(Math.abs(g.paid) > 0.009) L.push({ d:g.d, at:g.at + 0.5, t:(g.paid < 0 ? "استرديت فرق " : "دفعت فرق ") + xl, v:g.paid });
        return;
      }
      var lbl = (g.pno ? "فاتورة #" + g.pno : "فاتورة") + " · " + what;
      if(Math.abs(g.goods) > 0.009) L.push({ d:g.d, at:g.at, t:(g.goods < 0 ? "مرتجع · " : "") + lbl, v:-g.goods });
      if(Math.abs(g.paid) > 0.009) L.push({ d:g.d, at:g.at + 0.5, t:(g.paid < 0 ? "استرداد على " : "دفعت على ") + lbl, v:g.paid });
    });
    live("cash").forEach(function(c){
      if(c.partyId !== p.id || isCapType(c.type)) return;
      var a = Number(c.amount)||0, note = squish(c.note || "");
      if(c.type === "opening_party") L.push({ d:c.date, at:c.at||0, t:"رصيد افتتاحي", v:a });
      if(c.type === "in")  L.push({ d:c.date, at:c.at||0, t:"تحصيل نقدي" + (note ? " · " + note : ""), v:-a });
      if(c.type === "out") L.push({ d:c.date, at:c.at||0, t:"دفع نقدي" + (note ? " · " + note : ""), v:a });
    });
    L.sort(function(a, b){ return (a.d||"") !== (b.d||"") ? ((a.d||"") < (b.d||"") ? -1 : 1) : a.at - b.at; });
    var run = 0;
    L.forEach(function(l){ run += l.v; l.run = run; });
    return L;
  }
  function balTxt(b){
    return Math.abs(b) < 0.009 ? "متسوّي" : (b > 0 ? "ليك " : "عليك ") + money(Math.abs(b));
  }
  function partyStats(p){
    var S = live("sales").filter(function(x){ return x.partyId === p.id; });
    var dl = S.filter(isDelivered);
    var P = live("purchases").filter(function(x){ return !x.opening && x.partyId === p.id; });
    var inv = {}; P.forEach(function(x){ inv[x.batchId || x.id] = 1; });
    var last = function(arr){ return arr.map(function(x){ return x.date || ""; }).sort().pop() || ""; };
    return {
      orders:S.length, deliv:dl.length, canc:S.filter(isCancelled).length,
      bought:dl.reduce(function(a, x){ return a + saleTotal(x); }, 0), lastSale:last(S),
      invoices:Object.keys(inv).length,
      goods:P.reduce(function(a, x){ return a + goodsTotal(x); }, 0),
      paid:P.reduce(function(a, x){ return a + (Number(x.paid)||0); }, 0), lastBuy:last(P)
    };
  }
  function renderPartyCards(){
    var box = document.getElementById("pt-cards");
    if(!box) return;
    var all = live("parties").filter(function(p){ return !isPartner(p); });
    var nC = all.filter(function(p){ return p.type !== "supplier"; }).length, nS = all.length - nC;
    var ptt = document.getElementById("pt-title"); if(ptt) ptt.textContent = ptTab === "supplier" ? "المشتريات والموردين" : "العملاء";
    document.getElementById("pt-tabs").innerHTML =
      [["customer", "العملاء", nC], ["supplier", "الموردين", nS]].map(function(t){
        return "<button type='button' role='tab' data-pttab='" + t[0] + "' aria-selected='" + (ptTab === t[0]) + "'" +
          (ptTab === t[0] ? " class='on'" : "") + ">" + t[1] + " <b>" + qty(t[2]) + "</b></button>";
      }).join("");
    var mine = all.filter(function(p){ return ptTab === "supplier" ? p.type === "supplier" : p.type !== "supplier"; });
    var bal = {}; mine.forEach(function(p){ bal[p.id] = partyBalance(p.id); });
    var CH = ptTab === "supplier"
      ? [["all", "الكل"], ["owe", "عليك له"], ["even", "متسوّي"]]
      : [["all", "الكل"], ["due", "ليك عنده"], ["owe", "عليك له"], ["flag", "بيرفض كتير"]];
    var test = {
      all:function(){ return true; }, due:function(p){ return bal[p.id] > 0.009; },
      owe:function(p){ return bal[p.id] < -0.009; }, even:function(p){ return Math.abs(bal[p.id]) < 0.009; },
      flag:function(p){ return refusalsOf(p.id) >= PT_FLAG; }
    };
    if(!CH.some(function(c){ return c[0] === ptOnly; })) ptOnly = "all";
    document.getElementById("pt-chips").innerHTML = CH.map(function(c){
      return "<button type='button' data-ptonly='" + c[0] + "'" + (ptOnly === c[0] ? " class='on'" : "") + ">" +
        c[1] + " <b>" + qty(mine.filter(test[c[0]]).length) + "</b></button>";
    }).join("");
    var q = (document.getElementById("pt-q").value || "").trim().toLowerCase();
    var list = mine.filter(test[ptOnly]).filter(function(p){
      if(!q) return true;
      return [p.name, p.phone, p.gov, p.address, p.fb].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    // اللي فيه فلوس معلّقة فوق، وبعده الأحدث تعامل
    list.sort(function(a, b){
      var da = Math.abs(bal[a.id]) > 0.009 ? 1 : 0, dbb = Math.abs(bal[b.id]) > 0.009 ? 1 : 0;
      if(da !== dbb) return dbb - da;
      return (a.name || "").localeCompare(b.name || "", "ar");
    });
    if(!list.length){
      box.innerHTML = "<p class='cd-empty'>" + (mine.length ? "مفيش حد بالمواصفات دي." :
        (ptTab === "supplier" ? "مفيش موردين لسه — ضيفهم من الزرار فوق أو وإنت بتسجّل فاتورة شراء."
                              : "مفيش عملاء لسه — ضيفهم من الزرار فوق أو وإنت بتسجّل الأوردر.")) + "</p>";
      return;
    }
    var ed = canEdit();
    box.innerHTML = list.map(function(p){
      var b = bal[p.id], st = partyStats(p), sup = p.type === "supplier", open = ptOpen === p.id;
      var stats = sup
        ? [["فواتير", qty(st.invoices)], ["اشتريت بـ", qty(Math.round(st.goods))], ["دفعت", qty(Math.round(st.paid))],
           ["آخر فاتورة", dShort(st.lastBuy) || "—"]]
        : [["أوردرات", qty(st.orders)], ["اتسلّم", qty(st.deliv)], ["رفض", qty(st.canc), st.canc >= PT_FLAG ? "r" : ""],
           ["اشترى بـ", st.bought ? qty(Math.round(st.bought)) : "—"]];
      var balLbl = Math.abs(b) < 0.009 ? "الحساب" : (b > 0 ? (sup ? "دفعتله زيادة" : "ليك عنده") : "عليك له");
      var wa = !sup && waLink(p.phone);
      var html = "<div class='pc" + (open ? " open" : "") + "'>" +
        "<div class='pc-h'><span class='av' aria-hidden='true'>" + esc(String(p.name || "?").charAt(0)) + "</span>" +
          "<span class='pc-n'><b>" + esc(p.name) + "</b>" + (sup ? "" : refusalFlag(p.id)) +
            "<span class='sub'>" + esc([p.gov, p.address, p.phone].filter(Boolean).join(" · ") || (sup ? "مورد" : "—")) + "</span></span>" +
          "<span class='pc-st'>" + stats.map(function(x){
            return "<span><small>" + esc(x[0]) + "</small><b class='num" + (x[2] ? " " + x[2] : "") + "'>" + esc(x[1]) + "</b></span>"; }).join("") + "</span>" +
          "<span class='pc-bal'><small>" + esc(balLbl) + "</small><b class='num" + (Math.abs(b) < 0.009 ? " muted" : (b > 0 && !sup ? " v-due" : (b < 0 ? " v-due" : " v-gain"))) + "'>" +
            (Math.abs(b) < 0.009 ? "متسوّي" : esc(money(Math.abs(b)))) + "</b></span></div>" +
        "<div class='pc-a'>" +
          (wa ? "<a class='tbtn' href='" + esc(wa) + "' target='_blank' rel='noopener'>واتساب</a>" : "") +
          (sup && b < -0.009 && ed ? "<button class='tbtn primary' type='button' data-ptpay='" + esc(p.id) + "'>ادفع له</button>" : "") +
          "<span class='sp'></span>" +
          "<button class='tbtn" + (open ? " primary" : "") + "' type='button' data-ptstmt='" + esc(p.id) + "' aria-expanded='" + open + "'>كشف الحساب " + (open ? "▴" : "▾") + "</button>" +
          (ed ? "<button class='tbtn' type='button' data-edit='parties|" + esc(p.id) + "'>تعديل</button>" +
                "<details class='dd-more'><summary class='tbtn' aria-label='حاجات تانية'>⋯</summary>" +
                "<div><button class='tbtn' type='button' data-del='parties' data-id='" + esc(p.id) + "'>حذف</button></div></details>" : "") +
        "</div>";
      if(open){
        var L = partyLines(p);
        html += "<div class='pc-stmt'><h4><span>كشف الحساب</span><span class='muted'>" +
          (L.length ? plural(L.length, "حركة واحدة", "حركتين", "حركات") : "") + "</span></h4>" +
          (L.length ? L.slice().reverse().map(function(l){
            return "<div class='sr'><span class='d num'>" + esc(dShort(l.d) || "—") + "</span>" +
              "<span>" + (l.o ? "<a href='#' class='ono' data-ptorder='" + esc(l.o) + "'>أوردر " + esc(l.no || "") + "</a> · " : "") + esc(l.t) + "</span>" +
              "<span class='n num" + (l.v < 0 ? " v-gain" : "") + "'>" + (l.v < 0 ? "−" : "+") + esc(money(Math.abs(l.v))) + "</span>" +
              "<span class='run num'>" + esc(balTxt(l.run)) + "</span></div>";
          }).join("") : "<p class='muted' style='margin:0'>مفيش حركات على الحساب ده لسه.</p>") +
          "<p class='pc-note'>الأحدث فوق · «+» = اتسجّل عليه · «−» = دفع أو اتحسب له</p></div>";
      }
      return html + "</div>";
    }).join("");
  }
  document.getElementById("pt-tabs").addEventListener("click", function(e){
    var b = e.target.closest("[data-pttab]"); if(!b) return;
    ptTab = b.dataset.pttab; ptOnly = "all"; ptOpen = null; renderPartyCards();
    if(activeTab === "parties"){ navSync("parties"); navMark(); }     // عملاء ↔ موردين = قسم تاني
  });
  document.getElementById("pt-chips").addEventListener("click", function(e){
    var b = e.target.closest("[data-ptonly]"); if(!b) return;
    ptOnly = b.dataset.ptonly; renderPartyCards();
  });
  document.getElementById("pt-q").addEventListener("input", renderPartyCards);
  document.getElementById("pt-cards").addEventListener("click", function(e){
    var t;
    if((t = e.target.closest("[data-ptstmt]"))){ ptOpen = ptOpen === t.dataset.ptstmt ? null : t.dataset.ptstmt; renderPartyCards(); return; }
    if((t = e.target.closest("[data-ptorder]"))){
      // رقم الأوردر في الكشف بيوديك على الأوردر نفسه مفتوح
      e.preventDefault(); goTab("sales"); sgOpenRow(t.dataset.ptorder); return;
    }
    if((t = e.target.closest("[data-ptpay]"))){ payParty(t.dataset.ptpay); return; }
  });
  // «ادفع له» = نفس «دفع لمورد» في الخزنة والمورد متحدّد والمبلغ = اللي عليك له
  function payParty(pid){
    goTab("cash"); openEntry("cash");
    var ty = document.getElementById("c-type");
    if(ty){ ty.value = "out"; ty.dispatchEvent(new Event("change", { bubbles:true })); }
    var ps = document.getElementById("c-party"); if(ps) ps.value = pid;
    var am = document.getElementById("c-amount");
    if(am){ am.value = String(Math.round(-partyBalance(pid) * 100) / 100); setTimeout(function(){ try{ am.focus(); am.select(); }catch(err){} }, 60); }
  }
  // يفتح كارت جهة من مكان تاني (الرئيسية مثلًا)
  function openPartyCard(id){
    var p = db.parties.find(function(x){ return x.id === id; });
    if(!p) return;
    ptTab = p.type === "supplier" ? "supplier" : "customer"; ptOnly = "all"; ptOpen = id;
    var q = document.getElementById("pt-q"); if(q) q.value = "";
    goTab("parties"); renderPartyCards();
    var btn = document.querySelector("#pt-cards [data-ptstmt='" + id + "']");
    if(btn) btn.scrollIntoView({ block:"center" });
  }

  function renderParties(){
    renderPartyCards();
    // الشركاء ليهم شاشتهم في «رأس المال» — مبيظهروش هنا عشان الجدول ده
    // للعملاء والموردين بس، ورصيد الشريك حاجة تانية خالص (حقوق ملكية)
    var rows = live("parties").filter(function(p){ return !isPartner(p); }).map(function(p){
      var b = partyBalance(p.id);
      var txt = Math.abs(b)<0.009 ? "<span class='pill'>متسوي</span>"
        : (b>0 ? "<span class='pill due'>ليك "+money(b)+"</span>" : "<span class='pill due'>عليك "+money(-b)+"</span>");
      var orders = live("sales").filter(function(x){ return x.partyId===p.id; });
      var cancelled = orders.filter(isCancelled).length;
      var isOpen = statementFor === p.id;
      return "<tr" + (isOpen ? " class='on'" : "") + "><td class='wide'>" +
        "<button class='del' style='color:var(--teal)' data-stmt='"+p.id+"'" +
        " title='" + (isOpen ? "اقفل الكشف" : "افتح كشف الحساب") + "'>" +
        esc(p.name) + (isOpen ? " ▾" : "") + "</button></td>"+
        "<td>"+(p.type==="supplier"?"مورد":"عميل")+"</td><td>"+esc(p.phone||"—")+"</td>"+
        "<td>"+esc(p.gov||"—")+"</td>"+
        "<td class='num'>"+(orders.length ? qty(orders.length) + (cancelled ? " ("+qty(cancelled)+" ملغي)" : "") : "—")+"</td>"+
        "<td>"+txt+"</td>"+
        "<td><button class='del' style='color:var(--teal)' data-edit='parties|"+p.id+"'>تعديل</button></td>"+
        "<td><button class='del' data-del='parties' data-id='"+p.id+"'>حذف</button></td></tr>";
    });
    table("t-parties", ["الاسم","النوع","التليفون","المحافظة","أوردراته","الرصيد","",""], rows, "ضيف عملاءك ومورّدينك هنا، أو ضيف العميل وأنت بتسجّل الأوردر.");
  }

  function renderStatement(){
    var panel = document.getElementById("statement-panel");
    if(!statementFor){ panel.hidden = true; return; }
    panel.hidden = false;
    var p = db.parties.find(function(x){return x.id===statementFor;});
    if(!p){ panel.hidden = true; return; }
    document.getElementById("statement-title").textContent = "كشف حساب: " + p.name;
    var lines = [];
    live("sales").forEach(function(s){
      if(s.partyId!==p.id || !isDelivered(s)) return;
      lines.push({d:s.date, t:(s.no?"أوردر #"+s.no+" — ":"")+itemsLabel(s)+(shipIn(s)?" + شحن":""),
        dr:saleTotal(s)+shipIn(s), cr:Number(s.paid)||0});
    });
    live("purchases").forEach(function(x){ if(x.partyId===p.id) lines.push({d:x.date,t:"شراء "+itemName(x.itemId),dr:Number(x.paid)||0,cr:goodsTotal(x)}); });
    live("purchases").forEach(function(x){ if(x.partyId===p.id && x.xloss) lines.push({d:x.date,t:(x.xloss > 0 ? "خسارة استبدال " : "مكسب استبدال ")+itemName(x.itemId),dr:0,cr:Number(x.xloss)||0}); });
    live("cash").forEach(function(c){
      if(c.partyId!==p.id) return;
      if(c.type==="in") lines.push({d:c.date,t:"تحصيل نقدي",dr:0,cr:Number(c.amount)||0});
      if(c.type==="out") lines.push({d:c.date,t:"دفع نقدي",dr:Number(c.amount)||0,cr:0});
    });
    lines.sort(function(a,b){ return a.d < b.d ? -1 : 1; });
    var run = 0, tdr = 0, tcr = 0;
    var rows = lines.map(function(l){
      run += l.dr - l.cr; tdr += l.dr; tcr += l.cr;
      return "<tr><td class='num'>"+esc(l.d)+"</td><td class='wide'>"+esc(l.t)+"</td>"+
        "<td class='num'>"+money(l.dr)+"</td><td class='num'>"+money(l.cr)+"</td>"+
        "<td class='num'>"+money(run)+"</td></tr>";
    });
    if(rows.length){
      rows.push("<tr class='sumrow'><td></td><td class='wide'>الإجمالي</td>" +
        "<td class='num'>"+money(tdr)+"</td><td class='num'>"+money(tcr)+"</td>" +
        "<td class='num'>"+money(run)+"</td></tr>");
    }
    table("t-statement", ["التاريخ","البيان","مدين","دائن","الرصيد"], rows, "مفيش حركات على الحساب ده.");

    /* «مدين ودائن» مصطلح محاسبي — السطر ده بيترجمه لجملة تفهمها
       على طول، وبيختلف حسب المورد ولا العميل لأن اتجاه الفلوس مقلوب. */
    var sum = document.getElementById("statement-sum");
    if(!sum) return;
    if(!rows.length){ sum.textContent = ""; return; }
    var sup = p.type === "supplier";
    var bought = sup ? tcr : tdr;          // قيمة اللي اتعامل عليه
    var paid   = sup ? tdr : tcr;          // اللي اتدفع أو اتحصّل
    var txt = sup
      ? "اشتريت منه بـ <strong>" + esc(money(bought)) + "</strong> · دفعتله <strong>" +
        esc(money(paid)) + "</strong>"
      : "باعت له بـ <strong>" + esc(money(bought)) + "</strong> · حصّلت منه <strong>" +
        esc(money(paid)) + "</strong>";
    var bal = bought - paid;               // موجب = لسه في فلوس معلّقة
    txt += " · " + (Math.abs(bal) < 0.009
      ? "<span class='v-gain'>الحساب مقفول</span>"
      : (bal > 0
          ? (sup ? "<span class='v-due'>لسه عليك <strong>" + esc(money(bal)) + "</strong></span>"
                 : "<span class='v-due'>لسه ليك <strong>" + esc(money(bal)) + "</strong></span>")
          : (sup ? "<span class='v-gain'>دفعتله زيادة <strong>" + esc(money(-bal)) + "</strong></span>"
                 : "<span class='v-gain'>حصّلت منه زيادة <strong>" + esc(money(-bal)) + "</strong></span>")));
    sum.innerHTML = txt;
  }

  function renderLog(){
    var all = [];
    live("sales").forEach(function(s){ all.push({at:s.at,by:s.by,edited:s.editedBy,
      t:"أوردر "+saleStateTxt(s)+(s.no?" #"+s.no:""),
      d:partyName(s.partyId)+" · "+itemsLabel(s),v:saleTotal(s)}); });
    /* الفاتورة الواحدة كذا سجل — واحد لكل لون ومقاس. السجل بيتكلم عن
       «مين عمل إيه وإمتى»، وإنت سجّلت فاتورة واحدة مش ٤٧ حركة. */
    var pg = [], pSeen = {};
    live("purchases").forEach(function(p){
      var k = p.batchId || ("solo:" + p.id);
      if(!pSeen[k]){ pSeen[k] = { head:p, v:0, items:{} }; pg.push(pSeen[k]); }
      var g = pSeen[k];
      g.v += purchTotal(p);
      g.items[itemName(p.itemId)] = 1;
      if((p.at||0) > (g.head.at||0)) g.head = p;   // آخر تعديل هو اللي يبان
    });
    pg.forEach(function(g){
      var h = g.head, names = Object.keys(g.items);
      var isRet = isPRet(h);
      all.push({ at:h.at, by:h.by, edited:h.editedBy,
        t:(h.xchg ? "استبدال مع مورد" : (isRet ? "مرتجع للمورد" : "شراء")) + (h.pno ? " #" + h.pno : ""),
        d: partyName(h.partyId) + " · " + names.slice(0,2).join(" · ") +
           (names.length > 2 ? " وغيرهم" : ""),
        v: Math.abs(g.v) });
    });
    live("cash").forEach(function(c){ all.push({at:c.at,by:c.by,edited:c.editedBy,t:cashLabel(c.type),d:(c.partyId?partyName(c.partyId):(c.note||"—")),v:Number(c.amount)||0}); });
    all.sort(function(a,b){ return (b.at||0) - (a.at||0); });
    var rows = all.slice(0,100).map(function(r){
      var when = r.at ? new Date(r.at).toLocaleString("en-GB",{hour12:false}) : "—";
      var who = r.edited ? (r.edited + " (عدّلها)") : (r.by || "—");
      return "<tr><td class='num'>"+esc(when)+"</td><td>"+esc(who)+"</td><td>"+esc(r.t)+"</td>"+
        "<td class='wide'>"+esc(r.d)+"</td><td class='num'>"+money(r.v)+"</td></tr>";
    });
    table("t-log", ["الوقت","المستخدم","الحركة","التفاصيل","المبلغ"], rows, "السجل هيمتلي أول ما تبدأوا تسجّلوا حركات.");
  }

  function byDate(a,b){ return a.date < b.date ? 1 : (a.date > b.date ? -1 : (b.at||0)-(a.at||0)); }

  /* ---------- الجداول الكبيرة بتتعرض على دفعات ----------
     رسم ٣ آلاف صف مرة واحدة كان بياخد ثواني على الموبايل، وإنت أصلاً
     مش بتبص غير على آخر حركات. بنعرض دفعة وتحتها «وريني كمان». */
  var PAGE = 100;
  var shownRows = { sales:PAGE, purch:PAGE, cash:PAGE };

  // fromEnd: الخزنة مرتّبة من الأقدم للأحدث، فالمهم آخر الصفوف
  function pageRows(key, rows, fromEnd){
    var n = shownRows[key] || PAGE, total = rows.length;
    var out = total <= n ? rows : (fromEnd ? rows.slice(total - n) : rows.slice(0, n));
    var btn = document.querySelector('[data-more="' + key + '"]');
    if(btn){
      var rest = total - out.length;
      btn.hidden = rest <= 0;
      if(rest > 0) btn.textContent = "وريني " + qty(Math.min(PAGE, rest)) +
        " كمان · باقي " + qty(rest) + " من " + qty(total);
      var wrap = btn.parentNode;
      if(wrap) wrap.hidden = rest <= 0;
    }
    return out;
  }
  function resetPage(key){ shownRows[key] = PAGE; }

  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-more]");
    if(!b) return;
    var k = b.dataset.more;
    shownRows[k] = (shownRows[k] || PAGE) + PAGE;
    renderTab(k === "sales" ? "sales" : k === "purch" ? "purch" : "cash");
  });

  function fillSelects(){
    campList();                                                       // الحملات بتتقترح في الأوردر ومصروف الإعلان
    function opts(list, sel, placeholder, withStock){
      var el = document.getElementById(sel);
      var cur = el.value;
      el.innerHTML = '<option value="">'+placeholder+'</option>' + list.map(function(o){
        var label = o.name;
        if(withStock){
          var st = stockOf(o.id);
          label += st > 0
            ? " — متاح " + qty(st) + (o.unit ? " " + o.unit : "")
            : " — خلصان";
        }
        return '<option value="'+o.id+'">'+esc(label)+'</option>';
      }).join("");
      if(cur) el.value = cur;
    }
    var customers = live("parties").filter(function(p){return p.type==="customer";});
    var suppliers = live("parties").filter(function(p){return p.type==="supplier";});
    opts(suppliers, "p-party", "اختر مورد");
    // المحافظات
    var gv = document.getElementById("pt-gov");
    if(gv && !gv.options.length){
      gv.innerHTML = '<option value="">—</option>' + GOVS.map(function(g){
        return '<option value="'+esc(g)+'">'+esc(g)+'</option>'; }).join("");
    }
    // شركات الشحن المستخدمة قبل كده
    var seen = {};
    live("sales").forEach(function(x){ var c=(x.shipCo||"").trim(); if(c) seen[c]=1; });
    document.getElementById("ship-list").innerHTML =
      Object.keys(seen).map(function(c){ return '<option value="'+esc(c)+'">'; }).join("");
    var owners = {};
    live("sales").forEach(function(x){ var o=(x.owner||"").trim(); if(o) owners[o]=1; });
    document.getElementById("owner-list").innerHTML =
      Object.keys(owners).map(function(o){ return '<option value="'+esc(o)+'">'; }).join("");

    // قوائم الفلاتر
    function fopts(sel, list, label){
      var el = document.getElementById(sel), cur = el.value;
      el.innerHTML = '<option value="">الكل</option>' + list.map(function(o){
        return '<option value="'+esc(o.v)+'">'+esc(o.t)+'</option>'; }).join("");
      el.value = cur;
    }
    fopts("flt-party", live("parties").filter(function(x){return x.type==="customer";})
      .map(function(x){ return {v:x.id,t:x.name}; }));
    fopts("flt-item", live("items").map(function(x){ return {v:x.id,t:x.name}; }));
    fopts("flt-ship", Object.keys(seen).map(function(c){ return {v:c,t:c}; }));
    fopts("flt-owner", Object.keys(owners).map(function(o){ return {v:o,t:o}; }));
    fopts("inv-item", live("items").map(function(x){ return {v:x.id,t:x.name}; }));

    var ct = document.getElementById("c-type").value;
    opts(ct==="out"?suppliers:(ct==="in"?customers:[]), "c-party",
      (ct==="expense"||ct==="settle") ? "بدون جهة" : "اختر الجهة");
    // قايمة شركات الشحن لحركة السحب
    var cs = document.getElementById("c-shipco");
    var curCo = cs.value;
    cs.innerHTML = '<option value="">اختر شركة الشحن</option>' + shipCompanies().map(function(c){
      return '<option value="'+esc(c)+'">'+esc(c)+' — '+esc(money(walletOf(c)))+'</option>'; }).join("");
    if(curCo) cs.value = curCo;
    Array.prototype.forEach.call(document.querySelectorAll(".cash-ship"), function(w){
      w.hidden = ct !== "settle";
    });
    Array.prototype.forEach.call(document.querySelectorAll(".cash-kind"), function(w){
      w.hidden = ct !== "expense";
    });
    document.getElementById("c-party").disabled = (ct === "settle" || ct === "expense");

    opts(partners(), "cp-partner", "اختر شريك");

    // قوايم الأرصدة الافتتاحية
    opts(live("items"), "ob-item", "اختر صنف");
    opts(live("parties"), "ob-party", "اختر جهة");
    var obd = document.getElementById("ob-date");
    if(obd && !obd.value) obd.value = today();
  }

  // بيملّي قوائم اللون والمقاس حسب الصنف المختار
  function fillVariantSelects(prefix, itemId, keep){
    var it = db.items.find(function(x){ return x.id===itemId; });
    var cs = listOf(it,"colors"), zs = listOf(it,"sizes");
    var cSel = document.getElementById(prefix+"-color");
    var zSel = document.getElementById(prefix+"-size");
    if(!cSel || !zSel) return;
    var wraps = prefix === "ob" ? [] : document.querySelectorAll(prefix === "s" ? ".vfield" : ".pvfield");
    var notes = prefix === "ob" ? [] : document.querySelectorAll(prefix === "s" ? ".vnote" : ".pvnote");
    var show = cs.length > 0 || zs.length > 0;
    Array.prototype.forEach.call(wraps, function(w){ w.hidden = !show; });
    // التنبيه بيظهر بس لما يكون في صنف مختار ومالوش تركيبات
    Array.prototype.forEach.call(notes, function(w){ w.hidden = !(itemId && !show); });
    var oldC = keep ? keep.color : cSel.value, oldZ = keep ? keep.size : zSel.value;
    var legacy = itemId ? stockOfV(itemId,"","") : 0;
    var noteC = cs.length ? (legacy > 0 ? "بدون لون — رصيد قديم ("+qty(legacy)+")" : "اختر اللون") : "—";
    var noteZ = zs.length ? (legacy > 0 ? "بدون مقاس — رصيد قديم" : "اختر المقاس") : "—";
    cSel.innerHTML = '<option value="">'+esc(noteC)+'</option>' + cs.map(function(c){
      return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join("");
    zSel.innerHTML = '<option value="">'+esc(noteZ)+'</option>' + zs.map(function(z){
      return '<option value="'+esc(z)+'">'+esc(z)+'</option>'; }).join("");
    cSel.disabled = !cs.length; zSel.disabled = !zs.length;
    if(oldC) cSel.value = oldC;
    if(oldZ) zSel.value = oldZ;
  }

