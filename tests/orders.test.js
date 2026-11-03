// شاشة الأوردرات (v179): المراحل تبويبات · سطر الأرقام المالية اتشال · السطر فيه دواير الألوان وخط الخياطة
// والحالة اتنقلت من السطر لـ«⋯» في التفاصيل — وبتغيّر بنفس الحواجز
const { open, tab, data, MOB } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop(), sview:"all" });
  await tab(p, "sales");
  ok(await p.evaluate(() => document.querySelectorAll("#s-stagebox [data-sgview]").length === 5 &&
    !document.querySelector("#s-stagebox .sg-card .n")), "٥ تبويبات مراحل من غير أرقام الدواير");
  ok(await p.evaluate(() => { const b = document.getElementById("s-stats"); return b.hidden && getComputedStyle(b).display === "none"; }),
    "سطر الأرقام المالية مش ظاهر");
  ok(await p.evaluate(() => !document.querySelector("#t-sales tr.order select")), "مفيش قايمة حالة في السطر");
  // #5 جديد (لسه ما اتبعتش): غرزة خلصت وغرزة دلوقتي · دايرة لون اسود
  const r5 = await p.evaluate(() => { const tr = document.querySelector("#t-sales tr[data-row='s5']");
    return { d:tr.querySelectorAll(".seam i.d").length, n:tr.querySelectorAll(".seam i.n").length, st:tr.querySelector(".stg").textContent,
             sw:getComputedStyle(tr.querySelector(".sw i")).backgroundColor }; });
  ok(r5.d === 1 && r5.n === 1 && /^جديد/.test(r5.st), "#5 جديد — غرزة ونص: " + JSON.stringify(r5));
  ok(r5.sw === "rgb(29, 26, 28)", "دايرة الأسود بلونها: " + r5.sw);
  // #4 مع المندوب: غرزتين خلصوا والتالتة دلوقتي
  const r4 = await p.evaluate(() => { const tr = document.querySelector("#t-sales tr[data-row='s4']");
    return { d:tr.querySelectorAll(".seam i.d").length, st:tr.querySelector(".stg").textContent }; });
  ok(r4.d === 2 && /^مع المندوب/.test(r4.st), "#4 مع المندوب: " + JSON.stringify(r4));
  // الحالة من «⋯» في التفاصيل
  await p.click("#t-sales tr[data-row='s5'] td:nth-child(2)"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /#5 · /.test(document.querySelector(".dd-t").textContent)), "راس التفاصيل: الرقم والعميل");
  await p.click(".dd-more summary"); await p.selectOption(".dd-more select[data-status='s5']", "cancelled"); await p.waitForTimeout(400);
  ok((await data(p)).db.sales.find(s => s.id === "s5").status === "cancelled", "الحالة اتغيّرت من ⋯");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), sview:"all", viewport:MOB, theme:"dark" });
  await tab(m, "sales"); await m.click("#t-sales tr[data-row='s4'] td:nth-child(2)"); await m.waitForTimeout(300);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  ok(!m.errs.length, "أخطاء الموبايل: " + m.errs.join(";"));
  await m.close();
};
