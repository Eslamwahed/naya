// الخزنة (v185): الرصيد رقم واحد كبير = cashBox · سطر الشهر ده · تعديل/حذف جوه «⋯» وشغالين
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "cash");
  const v = await p.evaluate(() => ({ big:document.querySelector("#cash-stats .cb-big").textContent, cash:window.__T.cashBox(),
    cards:document.querySelectorAll("#cash-stats > div:not(.cb-big)").length, sub:document.querySelector("#cash-stats .cb-sub").textContent,
    loose:[...document.querySelectorAll("#cash-days .cd-mv")].some(r => [...r.querySelectorAll("button")].some(b => b.checkVisibility() && /تعديل|حذف/.test(b.textContent))) }));
  ok(Number(v.big.replace(/[^\d.-]/g, "")) === Math.round(v.cash * 100) / 100 || v.big.includes(String(Math.round(v.cash)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")), "الرصيد الكبير = رصيد الخزنة: " + v.big + " / " + v.cash);
  ok(!v.cards && /داخل/.test(v.sub) && /خارج/.test(v.sub), "سطر واحد للشهر بدل الكروت: " + v.sub);
  ok(!v.loose, "تعديل وحذف مش ظاهرين جنب كل حركة");
  // ⋯ ← تعديل بيفتح درج الحركة
  const has = await p.evaluate(() => !!document.querySelector("#cash-days .cd-more"));
  if(has){
    await p.click("#cash-days .cd-more summary >> nth=0"); await p.waitForTimeout(150);
    await p.click("#cash-days .cd-more[open] [data-edit], #cash-days .cd-more[open] [data-editcap]"); await p.waitForTimeout(350);
    ok(await p.evaluate(() => [...document.querySelectorAll("#entry-cash, #entry-capital")].some(x => !x.hidden)), "⋯ ← تعديل بيفتح الحركة");
  } else ok(true, "مفيش حركات يدوي في البيانات");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "cash");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
