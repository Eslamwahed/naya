// القايمة: 14 شاشة · مفتاح الأجزاء تحت العنوان · الصلاحيات
const { open, tab } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const grp = async (p, g) => { await p.click("#nav-groups [data-group='" + g + "']"); await p.waitForTimeout(200);
    return p.$$eval("#nav-sub button[data-tab]", bs => bs.filter(b => !b.hidden && !b.classList.contains("nav-alias") && !b.classList.contains("grp-off")).map(b => b.textContent.trim()).join("|")); };
  const cur = p => p.$eval("#nav-sub button[aria-current='true']", b => b.textContent.trim()).catch(() => null);
  const vis = p => p.$eval("main > section:not([hidden])", s => s.id);
  const seg = p => p.$$eval("main > section:not([hidden]) .pseg:not([hidden]) button", bs => bs.map(b => (b.getAttribute("aria-pressed") === "true" ? "*" : "") + b.textContent).join("|"));
  const go = async (p, t) => { await p.evaluate(t => [...document.querySelectorAll("main > section:not([hidden]) .pseg button")].find(b => b.textContent === t).click(), t); await p.waitForTimeout(300); };
  const p = await open(browser, { db:F.shop() });
  ok(await grp(p, "orders") === "الأوردرات|شركات الشحن|العملاء", "الأوردرات 3");
  ok(await grp(p, "goods") === "المخزون|الأصناف والتسعير|المشتريات والموردين", "البضاعة 3");
  ok(await grp(p, "money") === "الخزنة|الشركاء|المدفوع مقدّماً", "الفلوس 3");
  ok(await grp(p, "more") === "قايمة الدخل|الميزانية|الأداء|ماشي إزاي؟", "التقارير 4");
  await p.click("#nav-sub button[data-tab='rep'][data-sub='sum']"); await p.waitForTimeout(300);
  ok(await seg(p) === "*جدول|رسمة", "قايمة الدخل: جدول ↔ رسمة");
  await go(p, "رسمة"); ok(await vis(p) === "tab-viz" && await cur(p) === "قايمة الدخل", "الرسمة جوه قايمة الدخل");
  await p.click("#nav-sub button[data-tab='coach']"); await p.waitForTimeout(300);
  await go(p, "الحسابات سليمة؟"); ok(await vis(p) === "tab-audit" && await cur(p) === "ماشي إزاي؟", "مراجع الحسابات جوه ماشي إزاي؟");
  await grp(p, "goods"); await p.click("#nav-sub button[data-tab='purch']"); await p.waitForTimeout(300);
  await go(p, "الموردين"); ok(await vis(p) === "tab-parties" && await cur(p) === "المشتريات والموردين", "الموردين جوه المشتريات");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  // الصلاحيات
  const U = (tabs, extra) => Object.assign({ id:"u2", name:"موظف", pin:"x", tabs, money:true, edit:true, at:1 }, extra || {});
  const owner = { id:"u1", name:"اسلام", pin:"x", tabs:["dash", "backup"], money:true, edit:true, permV:1, at:1 };
  const visTab = (q, t) => q.evaluate(t => [...document.querySelectorAll("#nav-sub button[data-tab='" + t + "']")].some(x => !x.hidden), t);
  let q = await open(browser, { db:F.shop(), settings:{ users:[owner, U(["sales", "rep"])] }, auth:"u2" });
  ok(await visTab(q, "viz") && await visTab(q, "coach") && !(await visTab(q, "inv")), "مستخدم قديم بيورّث الرسمة وماشي إزاي؟ من التقارير");
  await q.close();
  q = await open(browser, { db:F.shop(), settings:{ users:[owner, U(["sales", "rep", "coach"], { permV:1 })] }, auth:"u2" });
  ok(!(await visTab(q, "viz")) && !(await visTab(q, "audit")) && await visTab(q, "coach"), "بعد الحفظ كل خانة لوحدها");
  await q.close();
  q = await open(browser, { db:F.shop(), settings:{ users:[owner, U(["sales", "rep", "audit"], { permV:1 })] }, auth:"u2" });
  ok(await grp(q, "more") === "قايمة الدخل|الميزانية|الأداء|ماشي إزاي؟", "اللي مسموحله بجزء بيلاقي الشاشة باسمها");
  await q.close();
};
