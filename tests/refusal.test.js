// الرفض مع شركة شحن: «العميل دفع كام من الشحن؟» — جزء · ما دفعش · السؤال بيفضل لحد ما تجاوب
const { open, tab, data, R, MOB } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop(), sview:"all" });
  const wal = () => p.evaluate(() => window.__T.walletOf("QP"));
  const w0 = await wal();
  await tab(p, "sales"); await p.click("#t-sales tr[data-row='s4'] td:nth-child(2)"); await p.waitForTimeout(300);
  await p.click("[data-stepgo='s4|none']"); await p.waitForTimeout(300);
  let d = await data(p), r = d.db.sales.find(s => s.id === "s4");
  ok(r.status === "cancelled" && r.shipQ === 70, "اترفض والسؤال مستني (70)");
  await p.fill("[data-shipqv='s4'] >> nth=0", "200"); await p.click("[data-shipq='s4|part'] >> nth=0"); await p.waitForTimeout(200);
  ok((await data(p)).db.sales.find(s => s.id === "s4").shipIn === 70, "مبلغ أكبر من اللي عليه بيترفض");
  await p.fill("[data-shipqv='s4'] >> nth=0", "30"); await p.press("[data-shipqv='s4'] >> nth=0", "Enter"); await p.waitForTimeout(300);
  r = (await data(p)).db.sales.find(s => s.id === "s4");
  ok(!r.shipQ && r.shipIn === 30, "دفع جزء 30");
  ok(R(await wal() - w0) === -70, "QP اتخصم منها 70 (30 − 100)");
  // #7 يترفض وبعد refresh السؤال لسه موجود في الرئيسية وفوق المراحل
  await p.click("#t-sales tr[data-row='s7'] td:nth-child(2)"); await p.waitForTimeout(300);
  await p.click("[data-stepgo='s7|none']"); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(900);
  ok((await p.innerText("main")).includes("#7 اترفض — العميل دفع كام من الشحن؟"), "السؤال في الرئيسية بعد refresh");
  await tab(p, "sales"); await p.evaluate(() => { const x = document.querySelector("[data-sgview='3']"); x && x.click(); }); await p.waitForTimeout(300);
  await p.click("#s-stage-panel [data-shipq='s7|0']"); await p.waitForTimeout(300);
  r = (await data(p)).db.sales.find(s => s.id === "s7");
  ok(!r.shipQ && r.shipIn === 0, "ما دفعش = 0");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), sview:"all", viewport:MOB });
  await tab(m, "sales"); await m.click("#t-sales tr[data-row='s4'] td:nth-child(2)"); await m.waitForTimeout(300); await m.click("[data-stepgo='s4|none']"); await m.waitForTimeout(300);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل من غير سكرول بالعرض");
  await m.close();
};
