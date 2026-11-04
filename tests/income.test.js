// قايمة الدخل (v187): بتفتح على «اللي خلص» = صافي الربح الفعلي · عمودين بس · الفترة تبويبات وبتغيّر الأرقام
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
const N = t => Number(String(t).replace(/[^\d.−-]/g, "").replace("−", "-"));
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "rep");
  const v = await p.evaluate(() => {
    const t = document.getElementById("t-pis"), last = [...t.querySelectorAll("tr.pis-net td")];
    return { cols:t.querySelectorAll("thead th").length, net:last[1] && last[1].textContent, act:window.__T.periodStats(null).net,
             on:document.querySelector("#pis-mode .on").dataset.pism, per:document.querySelector("#rep-per .on") && document.querySelector("#rep-per .on").dataset.repper,
             mode:document.getElementById("per-rep").value };
  });
  ok(v.on === "act", "بتفتح على «اللي خلص»");
  ok(v.cols === 3, "عمودين أرقام بس (البند · المبلغ · من المبيعات): " + v.cols);
  ok(Math.abs(N(v.net) - Math.round(v.act)) <= 0, "صافي الربح = الفعلي: " + v.net + " / " + v.act);
  ok(v.per === v.mode, "التبويب المختار = الفترة: " + v.per);
  await p.click("#rep-per [data-repper='month']"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById("per-rep").value === "month" && document.querySelector("#rep-per .on").dataset.repper === "month"), "تبويب «الشهر ده» بيغيّر الفترة");
  await p.click("#pis-mode [data-pism='exp']"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector("#pis-mode .on").dataset.pism === "exp"), "«لو كله اتسلّم» شغال");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "rep");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
