// كل الشاشات بتفتح من غير أخطاء · الموبايل من غير سكرول بالعرض · ليلي ونهاري
const { open, DESK, MOB } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  for(const [vp, theme] of [[DESK, "dark"], [DESK, "light"], [MOB, "dark"], [MOB, "light"]]){
    const p = await open(browser, { db:F.shop(), viewport:vp, theme });
    const btns = await p.$$eval("#nav-sub button[data-tab]", bs => bs.map(b => [b.dataset.tab, b.dataset.sub || ""]));
    const bad = [];
    for(const [t, s] of btns){
      await p.evaluate(([t, s]) => { const b = [...document.querySelectorAll("#nav-sub button[data-tab]")].find(x => x.dataset.tab === t && (x.dataset.sub || "") === s); b && b.click(); }, [t, s]);
      await p.waitForTimeout(150);
      const r = await p.evaluate(() => ({ id:(document.querySelector("main > section:not([hidden])") || {}).id, w:document.documentElement.scrollWidth, iw:innerWidth,
        len:((document.querySelector("main > section:not([hidden])") || {}).innerText || "").length }));
      if(r.len < 20) bad.push(t + s + ":فاضية");
      if(vp === MOB && r.w > r.iw + 1) bad.push(t + s + ":سكرول بالعرض " + r.w);
    }
    const tag = (vp === MOB ? "موبايل" : "كمبيوتر") + " " + theme;
    ok(!bad.length, tag + ": " + (bad.join(" ") || "كل الشاشات سليمة"));
    ok(!p.errs.length, tag + " أخطاء الصفحة: " + p.errs.join(";"));
    await p.close();
  }
};
