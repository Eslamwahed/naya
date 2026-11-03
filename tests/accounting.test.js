// الحسابات: كل سيناريو اتصلح قبل كده — الرقم الصح لازم يفضل صح
const { open, tab, R } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const run = async (db, fn, time) => { const p = await open(browser, { db, time }); const r = await p.evaluate(fn); ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";")); await p.close(); return r; };

  // متوسط متحرّك: 5×100 → بيع 5 → 5×200 → بيع 5 = تكلفة 1,500 ومخزون صفر
  let r = await run(F.blank(), () => { const T = window.__T, db = T.db();
    const P = (id, d, q, c) => ({ id, date:d, itemId:"i1", color:"اسود", size:"40", qty:q, cost:c, paid:q * c, packs:q, packQty:1, packCost:c, packName:"قطعة", freight:0, partyId:"", at:1 });
    const S = (id, d, q) => ({ id, no:id, date:d, status:"progress", partyId:"c1", payVia:"direct", paid:q * 300, lines:[{ itemId:"i1", color:"اسود", size:"40", qty:q, price:300, ret:0 }], shipIn:0, shipOut:0, at:1 });
    const dl = (s, d) => { s.status = "delivered"; s.deliveredAt = d; T.clearStockIdx(); T.stampDelivery(s); T.clearStockIdx(); };
    db.purchases.push(P("p1", "2026-09-01", 5, 100)); const a = S("s1", "2026-09-04", 5); db.sales.push(a); dl(a, "2026-09-05");
    db.purchases.push(P("p2", "2026-09-10", 5, 200)); const b = S("s2", "2026-09-14", 5); db.sales.push(b); dl(b, "2026-09-15");
    const st = T.periodStats(null); return { cogs:st.cogs, book:T.stockBookValue() }; });
  ok(r.cogs === 1500 && Math.abs(r.book) < 0.01, "متوسط متحرّك: تكلفة 1500 ومخزون 0 — " + JSON.stringify(r));

  // مشوار نقل اتسجّل بعد ما البضاعة كلها اتباعت = فرق تكلفة في آخر حركة والمخزون صفر
  r = await run(F.blank(), () => { const T = window.__T, db = T.db();
    db.purchases.push({ id:"p1", date:"2026-09-01", itemId:"i1", color:"اسود", size:"40", qty:5, cost:100, paid:500, packs:5, packQty:1, packCost:100, packName:"قطعة", freight:0, partyId:"", at:1 });
    const s = { id:"s1", no:1, date:"2026-09-03", status:"delivered", deliveredAt:"2026-09-05", partyId:"c1", payVia:"direct", paid:1500, lines:[{ itemId:"i1", color:"اسود", size:"40", qty:5, price:300, ret:0 }], shipIn:0, shipOut:0, at:1 };
    db.sales.push(s); T.clearStockIdx(); T.stampDelivery(s); T.clearStockIdx();
    const n0 = T.periodStats(null).net;
    db.cash.push({ id:"t1", date:"2026-09-02", type:"expense", cat:"trans", amount:100, note:"مشوار بضاعة", at:2 }); T.clearStockIdx();
    const tu = T.costTrueUps(); return { d:T.periodStats(null).net - n0, book:T.stockBookValue(), tu:tu.map(x => x.d + ":" + x.v).join(), diff:T.finBS().diff }; });
  ok(r.d === -100 && Math.abs(r.book) < 0.01 && r.tu === "2026-09-05:100" && Math.abs(r.diff) < 0.01, "مشوار بعد البيع = فرق تكلفة 100 — " + JSON.stringify(r));

  // الرفض بيتحسب في شهر الرفض
  r = await run(F.blank(), () => { const T = window.__T;
    T.db().sales.push({ id:"s1", no:1, date:"2026-09-28", status:"cancelled", cancelledAt:"2026-10-02", rsn:"refused", partyId:"c1", payVia:"ship", shipCo:"QP", shipCode:"1", shippedAt:"2026-09-28", paid:0, lines:[{ itemId:"i1", color:"اسود", size:"40", qty:1, price:300, ret:0 }], shipIn:0, shipOut:80, at:1 });
    T.clearStockIdx(); return { sep:T.periodStats({ from:"2026-09-01", to:"2026-09-30" }).netShip, oct:T.periodStats({ from:"2026-10-01", to:"2026-10-31" }).netShip }; });
  ok(r.sep === 0 && r.oct === -80, "خسارة الرفض في أكتوبر — " + JSON.stringify(r));

  // عربون على أوردر اتلغى: دخل يوم الدفع ورجع يوم الإلغاء والخزنة صفر
  const dbE = F.blank(); dbE.sales.push({ id:"s1", no:1, date:"2026-10-01", status:"cancelled", cancelledAt:"2026-10-05", partyId:"c1", payVia:"direct", selfDel:true, paid:100, lines:[{ itemId:"i1", color:"اسود", size:"40", qty:1, price:300, ret:0 }], shipIn:0, shipOut:0, at:1 });
  r = await run(dbE, () => ({ L:window.__T.cashLedger().map(x => x.d + ":" + (x.inn - x.out)).join(), cash:window.__T.cashBox() }));
  ok(r.L === "2026-10-01:100,2026-10-05:-100" && r.cash === 0, "عربون الإلغاء — " + JSON.stringify(r));

  // دفعتين في يومين: كل دفعة بيومها
  const dbF = F.blank(); dbF.sales.push({ id:"s1", no:1, date:"2026-10-01", status:"delivered", deliveredAt:"2026-10-01", partyId:"c1", payVia:"direct", paid:0, lines:[{ itemId:"i1", color:"اسود", size:"40", qty:1, price:300, ret:0, unitCost:0, trCost:0 }], shipIn:0, shipOut:0, at:1 });
  const p = await open(browser, { db:dbF, time:"2026-10-02T12:00:00" });
  await p.evaluate(() => window.__T.addPay(window.__T.db().sales[0], 100));
  await p.clock.setSystemTime(new Date("2026-10-03T12:00:00"));
  await p.evaluate(() => window.__T.addPay(window.__T.db().sales[0], 100));
  ok((await p.evaluate(() => window.__T.cashLedger().map(x => x.d + ":" + (x.inn - x.out)).join())) === "2026-10-02:100,2026-10-03:100", "كل دفعة بيومها");
  await p.close();

  // مرتجع للمورد بأقل من التكلفة: القطع بتخرج بتكلفتها والفرق خسارة
  const dbD = F.blank(); dbD.purchases.push(F.buy("p1", "2026-10-01", "i1", "اسود", "40", 5, 200));
  const q = await open(browser, { db:dbD, time:"2026-10-10T12:00:00" });
  const c0 = await q.evaluate(() => window.__T.cashBox());
  await tab(q, "purch"); await q.evaluate(() => window.__T.openPRet("p1")); await q.waitForTimeout(300);
  await q.fill("#pr-qty", "5"); await q.fill("#pr-unit", "160"); await q.selectOption("#pr-mode", "cash"); await q.click("#b-pret"); await q.waitForTimeout(300);
  r = await q.evaluate(() => { const T = window.__T; T.clearStockIdx(); return { book:T.stockBookValue(), net:T.periodStats(null).net, cash:T.cashBox(), sup:T.partyBalance("sp"), diff:T.finBS().diff }; });
  ok(R(r.book) === 0 && R(r.net) === -200 && R(r.cash - c0) === 800 && R(r.sup) === 0 && Math.abs(r.diff) < 0.01, "مرتجع المورد — " + JSON.stringify(r));
  await q.close();

  // توزيع الشركاء: الأيام اللي مفيهاش رأس مال مش داخلة
  r = await run(F.shop(), () => { const T = window.__T; return T.computeShares(300, "2026-08-01", "2026-09-30").map(x => x.share).join(); });
  ok(r === "150,150", "شريكين متساويين = 150 و150 — " + r);

  // الميزانية متوازنة والتقرير المطبوع سطوره = الإجمالي
  const P2 = await open(browser, { db:F.shop() });
  const bs = await P2.evaluate(() => window.__T.finBS());
  ok(Math.abs(bs.diff) < 0.01 && Math.abs(bs.recon) < 0.01, "الميزانية متوازنة");
  await P2.close();
};
