// v192: كارت «شحنة شيماء من كشف QP 19/11» — بيانات وهمية بنفس اللي الكارت متأمّن بيه
const { open, tab, data, R } = require("./lib"), F = require("./fixtures");
function db(dup){
  const d = F.shop();
  d.parties.push({ id:"mvw6vg1idekv3", name:"عميلة تجريبية", type:"customer", at:1 });
  d.sales.push(F.sale({ id:"mvw6wjmovj5xh", no:136, date:"2026-10-31", partyId:"mvw6vg1idekv3", payVia:"direct", shipCo:"", status:"delivered", selfDel:true,
    shippedAt:"2026-10-31", deliveredAt:"2026-11-01", paidAt:"2026-11-01", paid:175, lines:[F.line("i1", "اسود", "38", 1, 175, { unitCost:150, trCost:0 })] }));
  if(dup) d.sales.push(F.sale({ id:"dx", no:99, date:"2026-11-15", shipCode:"24167914", lines:[] }));
  return d;
}
const nums = p => p.evaluate(() => { const T = window.__T, L = T.cashLedger();
  return { cash:T.cashBox(), led:L.reduce((a, x) => a + x.inn - x.out, 0), qp:T.walletOf("QP"), net:T.periodStats(null).net, diff:T.finBS().diff, n:T.db().sales.length }; });
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:db(), time:"2026-11-24T12:00:00" });
  ok(await p.evaluate(() => /شحنة شيماء/.test(document.getElementById("tab-dash").textContent)), "الرئيسية فيها سطر التصحيح");
  const b = await nums(p);
  await tab(p, "ship");
  ok(await p.evaluate(() => !!document.getElementById("fx192")), "الكارت ظاهر في شركات الشحن");
  const b2 = await nums(p);
  ok(b2.n === b.n && R(b2.qp) === R(b.qp), "المعاينة ما غيّرتش حاجة");
  await p.click("#b-fx192"); await p.waitForTimeout(300);
  const a = await nums(p);
  ok(a.n === b.n + 1 && R(a.qp - b.qp) === -20, "أوردر جديد و QP −20: " + R(a.qp - b.qp));
  ok(R(a.cash) === R(b.cash) && R(a.led) === R(a.cash), "الخزنة ما اتغيّرتش و= دفتر الخزنة");
  ok(R(a.net - b.net) === -20, "الربح −20 (فرق الشحن)");
  ok(Math.abs(a.diff) < 0.01, "الميزانية متوازنة: " + a.diff);
  ok(!(await p.$("#fx192")), "الكارت اختفى");
  const d = await data(p), s = d.db.sales.find(x => x.shipCode === "24167914");
  ok(s && s.payVia === "ship" && s.shipCo === "QP" && s.shipIn === 60 && s.shipOut === 80 && s.paid === 60 && !s.lines.length && s.deliveredAt === "2026-11-19" && !!d.settings.fix192, "اتحفظ صح");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const q = await open(browser, { db:db(true), time:"2026-11-24T12:00:00" });
  await tab(q, "ship");
  ok(!(await q.$("#fx192")), "لو البوليصة متسجّلة الكارت ما بيظهرش");
  await q.close();
};
