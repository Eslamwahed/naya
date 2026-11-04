// جزء «الشركاء» (v186): جدول واحد · نصيب كل شريك = نصيب الربح (مجموعه = صافي الربح) · أزرار الشريك جوه ⋯ وشغالة
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
const N = t => Number(String(t).replace(/[^\d.−-]/g, "").replace("−", "-"));
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "capital"); await p.click("#cap-seg [data-capseg='main']"); await p.waitForTimeout(250);
  const v = await p.evaluate(() => {
    const rows = [...document.querySelectorAll("#cap-cards .cap-r:not(.th):not(.tot)")];
    return { n:rows.length, shares:rows.map(r => r.querySelector(".sh b").textContent), tot:document.querySelector("#cap-cards .cap-r.tot .n:last-of-type b, #cap-cards .cap-r.tot b").textContent,
             net:window.__T.periodStats(null).net, partners:window.__T.db().parties.filter(x => x.type === "partner" && !x.deleted).length,
             cards:document.querySelectorAll(".cpc").length, loose:[...document.querySelectorAll("#cap-cards [data-capdo]")].some(b => b.checkVisibility()) };
  });
  ok(v.n === v.partners && !v.cards, "سطر لكل شريك ومفيش كروت: " + v.n);
  const sum = v.shares.reduce((a, b) => a + N(b), 0);
  ok(Math.abs(sum - v.net) <= v.n && Math.abs(N(v.tot) - Math.round(v.net)) <= 1, "مجموع الأنصبة = صافي الربح: " + JSON.stringify([v.shares, v.tot, v.net]));
  ok(!v.loose, "أزرار الشريك مش ظاهرة لحد ما تفتح ⋯");
  await p.click("#cap-cards .cap-more summary >> nth=0"); await p.waitForTimeout(150);
  await p.click("#cap-cards .cap-more[open] [data-capdo^='cap_in']"); await p.waitForTimeout(350);
  ok(await p.evaluate(() => !document.getElementById("entry-capital").hidden && document.getElementById("cp-type").value === "cap_in"), "⋯ ← دفع رأس مال بيفتح الدرج والنوع متحدّد");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "capital"); await m.click("#cap-seg [data-capseg='main']"); await m.waitForTimeout(200);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
