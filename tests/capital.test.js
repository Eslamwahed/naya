// «فلوسكم فين؟» (v184): من الربح للخزنة — صافي الربح ± التغيّر في الأصول والالتزامات = الشغل · + رأس المال = الخزنة بالظبط
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
const N = t => { const m = String(t).replace(/,/g, "").replace(/−/g, "-").match(/[+-]?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "capital");
  const v = await p.evaluate(() => {
    const c = document.querySelector("#cap-story .ms-card");
    const lns = [...c.querySelectorAll(".ms-ln")].map(x => ({ b:x.querySelector("b").textContent, tag:(x.querySelector(".ms-tag") || {}).textContent || "", top:x.classList.contains("top") }));
    const T = window.__T;
    return { lns, sub:c.querySelector(".ms-sub b").textContent, end:c.querySelector(".ms-end b").textContent,
             cash:T.cashBox(), net:T.periodStats(null).net, mainHidden:document.getElementById("cap-main").hidden };
  });
  const sum = a => a.reduce((x, y) => x + N(y.b), 0);
  const subIdx = v.lns.findIndex(x => /رأس مال/.test(x.tag));
  const opL = v.lns.slice(0, subIdx), finL = v.lns.slice(subIdx);
  ok(v.lns[0].top && Math.abs(N(v.lns[0].b) - v.net) <= 1, "أول سطر = صافي الربح من قايمة الدخل: " + v.lns[0].b + " / " + v.net);
  ok(sum(opL) === N(v.sub), "الربح ± الأصول والالتزامات = الشغل نفسه: " + JSON.stringify([opL.map(x => x.b), v.sub]));
  ok(N(v.sub) + sum(finL) === N(v.end) && N(v.end) === Math.round(v.cash), "الشغل + رأس المال = الخزنة بالظبط: " + v.end + " / " + v.cash);
  ok(opL.slice(1).every(x => /^(أصل|التزام) (زاد|قلّ)$/.test(x.tag)), "كل بند مكتوب عليه أصل/التزام زاد/قلّ: " + opL.map(x => x.tag));
  ok(opL.slice(1).every(x => (/^أصل زاد|^التزام قلّ/.test(x.tag)) === (N(x.b) < 0)), "أصل زاد = بنطرح · التزام زاد = بنزوّد");
  ok(v.mainHidden, "«الشركاء» مستخبي لحد ما تدوس عليه");
  await p.click("#cap-seg [data-capseg='main']"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById("cap-story").hidden && !document.getElementById("cap-main").hidden), "المفتاح بيبدّل الجزئين");
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
