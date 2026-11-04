// «فلوسكم فين؟» (v183): الخطوات التلاتة بتتجمع صح قدام الشركاء · الربح = الميزانية = قايمة الدخل · المفتاح بيفصل الجزئين
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
const N = t => { const m = String(t).replace(/,/g, "").match(/[−-]?\d+(\.\d+)?/); return m ? Number(m[0].replace("−", "-")) : NaN; };
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "capital");
  const v = await p.evaluate(() => {
    const st = [...document.querySelectorAll("#cap-story .ms-st")];
    const lines = el => [...el.querySelectorAll(".ms-ln b")].map(b => b.textContent);
    const tot = el => el.querySelector(".ms-tot b").textContent;
    const T = window.__T, B = T.finBS();
    return { s1:lines(st[0]), t1:tot(st[0]), s2:lines(st[1]), t2:tot(st[1]), big:st[2].querySelector(".ms-big").textContent,
             cash:T.cashBox(), worth:B.assets - B.liab, cap:B.cap + B.opening, net:T.periodStats(null).net,
             mainHidden:document.getElementById("cap-main").hidden, bar:[...st[2].querySelectorAll(".ms-bar i")].map(i => Number(i.textContent)) };
  });
  const sum = a => a.reduce((x, y) => x + N(y), 0);
  ok(sum(v.s1) === N(v.t1) && N(v.t1) === Math.round(v.cash), "خطوة 1 بتتجمع = الخزنة: " + JSON.stringify([v.s1, v.t1, v.cash]));
  ok(sum(v.s2) === N(v.t2) && N(v.t2) === Math.round(v.worth), "خطوة 2 بتتجمع = الشركة تسوى: " + JSON.stringify([v.s2, v.t2]));
  ok(N(v.big) === Math.round(v.worth) - Math.round(v.cap), "خطوة 3 = تسوى − رأس المال: " + v.big);
  ok(Math.abs(N(v.big) - v.net) <= 1, "الربح = صافي قايمة الدخل (" + v.net + ")");
  ok(!v.bar.length || v.bar.reduce((a, b) => a + b, 0) === 100, "شريط الـ100 جنيه مجموعه 100: " + v.bar);
  ok(v.mainHidden, "«الشركاء» مستخبي لحد ما تدوس عليه");
  await p.click("#cap-seg [data-capseg='main']"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById("cap-story").hidden && !document.getElementById("cap-main").hidden), "المفتاح بيبدّل الجزئين");
  // الصورة بتتعمل من غير أخطاء
  await p.click("#cap-seg [data-capseg='story']"); await p.waitForTimeout(150);
  const dl = p.waitForEvent("download", { timeout:5000 }).catch(() => null);
  await p.click("#b-story-img"); const d = await dl;
  ok(d && /flosna-fein/.test(d.suggestedFilename()), "صورة للشركاء نزلت");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "capital");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
