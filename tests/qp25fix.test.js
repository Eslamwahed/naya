// v190: كارت «فرق الشحن في كشف QP 4/11» — بيانات وهمية بنفس الأرقام اللي الكارت متأمّن بيها
const { open, tab, data, R } = require("./lib"), F = require("./fixtures");
const O126 = "mvu1h92fmma5m", O79 = "mvcr6wihmdi32";
function db(alt){
  const d = F.shop(), D = (o) => F.sale(Object.assign({ status:"delivered", shipCo:"QP", partyId:"c1", shippedAt:"2026-10-30", deliveredAt:"2026-11-01", date:"2026-10-29", cf:"ok" }, o));
  d.purchases.push(F.buy("p9", "2026-09-01", "i1", "اسود", "38", 30, 150));
  d.sales.push(D({ id:O79, no:79, date:"2026-10-17", deliveredAt:"2026-10-22", shipCode:"Q79", shipIn:85, shipOut:110, paid:365, lines:[F.line("i1", "اسود", "38", 1, 280, { unitCost:150, trCost:0 })] }));
  d.sales.push(D({ id:O126, no:126, shipCode:"23766604", shipIn:alt ? 85 : 60, shipOut:110, paid:alt ? 385 : 360, lines:[F.line("i1", "اسود", "38", 1, 300, { unitCost:150, trCost:0 })] }));
  const ids = [];
  for(let k = 0; k < 13; k++){ const id = "q" + k; ids.push(id);
    d.sales.push(D({ id, no:200 + k, shipCode:"Q" + k, paid:k === 12 ? 300 : 400, lines:[F.line("i1", "اسود", "38", 1, k === 12 ? 300 : 400, { unitCost:150, trCost:0 })] })); }
  ids.splice(2, 0, O126);                                                        // #126 في نص الاستلام زي الحقيقي
  d.cash.push({ id:"lump", date:"2026-10-25", type:"settle", shipCo:"QP", amount:230, partyId:"", at:1 });
  d.cash.push({ id:"mvzhyutedvgpx", date:"2026-11-02", type:"settle", shipCo:"QP", amount:5350, orders:ids, partyId:"", at:2 });
  d.cash.push({ id:"mw28qf3l9sur8", date:"2026-11-04", type:"settle", shipCo:"QP", amount:25, orders:[O79], partyId:"", at:3 });
  return d;
}
const nums = p => p.evaluate(([a, b]) => { const T = window.__T, m = T.shipPendMap(), L = T.cashLedger();
  const open = T.db().sales.filter(x => !x.deleted && m[x.id] && Math.abs(m[x.id].left) > 0.009 && x.shipCo === "QP").map(x => x.no);
  return { cash:T.cashBox(), led:L.reduce((s, x) => s + x.inn - x.out, 0), qp:T.walletOf("QP"), diff:T.finBS().diff, net:T.periodStats(null).net,
           l79:(m[b] || {}).left || 0, l126:(m[a] || {}).left || 0, open }; }, [O126, O79]);
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:db(), time:"2026-11-05T12:00:00" });
  ok(await p.evaluate(() => /فرق الشحن في كشف QP/.test(document.getElementById("tab-dash").textContent)), "الرئيسية فيها سطر التصحيح");
  const b = await nums(p);
  ok(!b.l79 && !b.open.length, "قبل: QP مش ليها حاجة على الأوردرات دي");
  await tab(p, "ship");
  ok(await p.evaluate(() => !!document.getElementById("fx190")), "الكارت ظاهر في شركات الشحن");
  const b2 = await nums(p);
  ok(R(b2.qp) === R(b.qp) && R(b2.net) === R(b.net), "المعاينة ما غيّرتش حاجة");
  await p.click("#b-fx190"); await p.waitForTimeout(300);
  const a = await nums(p);
  ok(R(a.cash) === R(b.cash) && R(a.led) === R(a.cash), "الخزنة ما اتغيّرتش و= دفتر الخزنة");
  ok(R(a.qp - b.qp) === 25 && R(a.l79) === 25 && !a.l126 && a.open.join() === "79", "الـ25 رجعت مستحقة على #79 بس: " + a.open.join());
  ok(R(a.net - b.net) === 25, "الربح زاد 25 (شحن #126 85 بدل 60)");
  ok(Math.abs(a.diff) < 0.01, "الميزانية متوازنة: " + a.diff);
  ok(!(await p.$("#fx190")), "الكارت اختفى");
  const d = await data(p), s = d.db.sales.find(x => x.id === O126), c = d.db.cash.find(x => x.id === "mw28qf3l9sur8");
  ok(s.shipIn === 85 && s.paid === 385 && c.orders.join() === O126 && !!d.settings.fix190, "اتحفظ");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const q = await open(browser, { db:db(true), time:"2026-11-05T12:00:00" });
  await tab(q, "ship");
  ok(!(await q.$("#fx190")), "لو #126 اتصلّح باليد الكارت ما بيظهرش");
  await q.close();
};
