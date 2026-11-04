// المشتريات (v182): سطر ملخّص بدل الكروت · «خالصة» مش في التبويبات · سطر لكل فاتورة من غير «✓ خالصة» · الباقي بيبان
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const db = F.shop();
  // فاتورة عليها باقي: 2 × 150 ودفعت 100
  db.purchases.push(Object.assign(F.buy("pz", "2026-10-20", "i1", "اسود", "39", 2, 150), { paid:100, pno:99 }));
  const p = await open(browser, { db });
  await tab(p, "purch");
  const top = await p.innerText("#pu-top");
  ok(/عليك للموردين/.test(top) && await p.evaluate(() => !document.querySelector("#pu-top > div")), "سطر ملخّص: " + top);
  ok(await p.evaluate(() => !document.querySelector("#pu-only [data-puonly='paid']")), "مفيش تبويب «خالصة»");
  const rows = await p.evaluate(() => [...document.querySelectorAll("#pu-cards .pv-h")].map(h => h.innerText));
  ok(rows.length && rows.every(t => !/خالصة/.test(t)), "مفيش «خالصة» في السطور");
  ok(rows.some(t => /#99/.test(t) && /باقي/.test(t)), "الفاتورة اللي عليها فلوس مكتوب عليها باقي");
  ok(await p.evaluate(() => document.querySelectorAll("#pu-cards .pv-h .sw i").length > 0), "دواير الألوان في السطور");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "purch");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
