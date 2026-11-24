// الخزنة (رجعت لشكل ما قبل 185 في 191): 3 كروت (الرصيد · داخل · خارج) · تعديل وحذف ظاهرين جنب كل حركة وشغالين
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "cash");
  const v = await p.evaluate(() => { const c = [...document.querySelectorAll("#cash-stats > div")];
    return { n:c.length, labels:c.map(x => x.querySelector("span").textContent), bal:c[0] && c[0].querySelector("strong").textContent, cash:window.__T.cashBox(),
      more:!!document.querySelector("#cash-days .cd-more"),
      vis:[...document.querySelectorAll("#cash-days .cd-mv")].some(r => [...r.querySelectorAll("button")].some(b => b.checkVisibility() && /تعديل/.test(b.textContent))) }; });
  ok(v.n === 3 && v.labels.join() === "رصيد الخزنة,داخل,خارج", "3 كروت فوق: " + v.labels.join(" · "));
  ok(Number(v.bal.replace(/[^\d.]/g, "").replace(/\.$/, "")) === v.cash, "كارت الرصيد = رصيد الخزنة: " + v.bal + " / " + v.cash);
  ok(v.vis && !v.more, "تعديل وحذف ظاهرين جنب الحركة (من غير «⋯»)");
  await p.click("#cash-days [data-edit], #cash-days [data-editcap] >> nth=0"); await p.waitForTimeout(350);
  ok(await p.evaluate(() => [...document.querySelectorAll("#entry-cash, #entry-capital")].some(x => !x.hidden)), "تعديل بيفتح الحركة");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "cash");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
