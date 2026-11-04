// الميزانية (v188): عمودين · الأصول = الالتزامات + حقوق الملكية على الشاشة · مفيش قايمة دخل مكررة · الفترة مستخبية
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
const N = t => Number(String(t).replace(/[^\d.−-]/g, "").replace("−", "-"));
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "rep");
  await p.evaluate(() => document.querySelector("#nav-sub button[data-tab='rep'][data-sub='fin']").click()); await p.waitForTimeout(400);
  const v = await p.evaluate(() => {
    const vis = el => el && el.checkVisibility();
    const tots = [...document.querySelectorAll("#fin-panel .fin-tot b")].map(b => b.textContent);
    const B = window.__T.finBS();
    return { tots, assets:B.assets, pis:vis(document.getElementById("pis-panel")), per:vis(document.querySelector("#rep-per")),
             cols:document.querySelectorAll("#fin-panel .fin-c").length, isOpen:document.querySelector("#fin-panel details.fin-fold").open };
  });
  ok(v.cols === 2, "عمودين");
  ok(v.tots.length === 2 && N(v.tots[0]) === N(v.tots[1]) && N(v.tots[0]) === Math.round(v.assets), "إجمالي الأصول = الإجمالي التاني: " + v.tots);
  ok(!v.pis, "قايمة الدخل مش متكررة في الميزانية");
  ok(!v.per, "تبويبات الفترة مستخبية في الميزانية");
  ok(!v.isOpen, "قايمة الدخل بشكل المحاسبين مطوية");
  // الرجوع لقايمة الدخل: بتظهر تاني
  await p.evaluate(() => document.querySelector("#nav-sub button[data-tab='rep'][data-sub='sum']").click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById("pis-panel").checkVisibility() && !document.getElementById("fin-panel").checkVisibility()), "قايمة الدخل في شاشتها بس");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "rep");
  await m.evaluate(() => document.querySelector("#nav-sub button[data-tab='rep'][data-sub='fin']").click()); await m.waitForTimeout(300);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
