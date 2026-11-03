// الرئيسية الهادية: 4 أرقام · المهام في مجموعات مترتبة بالأهم · كل سطر بيودّي مكانه
const { open } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  const tiles = await p.$$eval("#hm-big .hm-k > span", s => s.map(x => x.textContent.split(" · ")[0]).join("|"));
  ok(tiles === "صافي الربح|الخزنة|عند شركات الشحن|المخزون", "4 أرقام: " + tiles);
  const G = await p.$$eval(".hm-grp", g => g.map(x => x.querySelector("h4").textContent));
  const order = ["الأوردرات", "الفلوس والمرتجع", "المخزون", "الحسابات"];
  ok(G.length && G.every((g, i) => i === 0 || order.indexOf(g) > order.indexOf(G[i - 1])), "المجموعات بالترتيب: " + G.join("|"));
  const ranks = await p.$$eval(".hm-grp", g => g.map(x => [...x.querySelectorAll(".hm-tr")].map(r => r.classList.contains("bad") ? 0 : r.classList.contains("warn") ? 1 : r.classList.contains("money") ? 2 : 3)));
  ok(ranks.every(r => r.every((v, i) => !i || v >= r[i - 1])), "جوه كل مجموعة الأهم الأول");
  ok(!(await p.$("#hm-month .hm-srow")) && (await p.innerText("#hm-month")).includes("الملخص"), "«الأوردرات فين؟» اتشال ومكانه الملخص");
  const rows = await p.$$eval(".hm-tr", r => r.map(x => x.dataset.hgo));
  for(const g of rows.slice(0, 4)){
    await p.evaluate(() => document.querySelector("[data-tab='dash']").click()); await p.waitForTimeout(250);
    await p.click(".hm-tr[data-hgo='" + g + "']"); await p.waitForTimeout(300);
    ok(await p.$eval("main > section:not([hidden])", s => s.id) !== "tab-dash", "السطر " + g + " بيودّي مكانه");
  }
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
};
