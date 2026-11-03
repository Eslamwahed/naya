// شركات الشحن (v180): سطر ملخّص بدل الكروت · «ليك عندها/عليك ليها» بالقيمة الموجبة · سطر حقائق بدل ٥ مربعات
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "ship");
  const top = await p.innerText("#shc-top");
  ok(/ليك عندهم|عليك ليهم|كل فلوسك وصلتك/.test(top), "سطر ملخّص: " + top);
  ok(await p.evaluate(() => !document.querySelector("#shc-top > div")), "مفيش كروت فوق");
  const heads = await p.evaluate(() => [...document.querySelectorAll(".shc-h")].map(h => ({
    lbl:h.querySelector(".big small").textContent, val:h.querySelector(".big b").textContent })));
  ok(heads.length >= 2 && heads.every(h => !/−|-/.test(h.val)), "الرقم الكبير موجب دايماً: " + JSON.stringify(heads));
  // كل كارت: سطر حقائق (مع المندوب · مرتجع · اترفض) — من غير «متوسط الشحن»
  const st = await p.evaluate(() => [...document.querySelectorAll(".shc-st")].map(x => x.textContent));
  ok(st.length && st.every(t => /مع المندوب/.test(t) && /اترفض/.test(t) && !/متوسط/.test(t)), "سطر الحقائق: " + st[0]);
  // الأرقام نفسها ما اتغيّرتش: الرصيد في الكارت = walletOf
  const same = await p.evaluate(() => [...document.querySelectorAll(".shc")].every(c => {
    const nm = c.querySelector(".nm").textContent, w = window.__T.walletOf(nm);
    const v = Number((c.querySelector(".big b").textContent.match(/[\d,]+(\.\d+)?/) || ["NaN"])[0].replace(/,/g, ""));
    return Math.abs(Math.abs(w) - v) < 0.01 && (w < -0.009) === /عليك/.test(c.querySelector(".big small").textContent); }));
  ok(same, "رقم كل شركة = رصيد محفظتها");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "ship");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
