// v189: كارت شحنات فيسبوك الناقصة — بيانات وهمية بنفس المجاميع اللي الكارت متأمّن بيها (7 شحنات = 6,186.40 · مطابقة 17/10 = 1,326.40)
const { open, tab, data, R } = require("./lib"), F = require("./fixtures");
function db(extra){
  const d = F.shop();
  [["2026-09-20", 1000], ["2026-09-25", 1000], ["2026-09-28", 1000], ["2026-10-01", 1000], ["2026-10-05", 1000], ["2026-10-09", 1000], ["2026-10-15", 186.4]]
    .forEach(([date, cr], i) => d.cash.push({ id:"m" + i, date, type:"expense", cat:"metatop", costKind:"var", amount:cr + 30, credit:cr, partyId:"", note:"شحن تجريبي", at:1, made:1 }));
  if(extra) d.cash.push(extra);
  return d;
}
const settings = { metaRec:[{ d:"2026-10-17", bal:1326.4, by:"تجربة", at:1 }] };
const nums = p => p.evaluate(() => { const T = window.__T, L = T.cashLedger(); return { cash:T.cashBox(), meta:T.metaBook().bal, diff:T.finBS().diff,
  led:L.reduce((a, x) => a + x.inn - x.out, 0), net:T.periodStats(null).net, n:T.db().cash.length }; });
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:db(), settings, time:"2026-11-04T12:00:00" });
  ok(await p.evaluate(() => /شحنات فيسبوك الناقصة/.test(document.getElementById("tab-dash").textContent)), "الرئيسية فيها سطر «سجّل شحنات فيسبوك الناقصة»");
  const b = await nums(p);
  await tab(p, "prepaid");
  ok(await p.evaluate(() => !!document.getElementById("fx189")), "الكارت ظاهر في المدفوع مقدّماً");
  const b2 = await nums(p);
  ok(b2.n === b.n && R(b2.cash) === R(b.cash) && R(b2.meta) === R(b.meta), "المعاينة ما غيّرتش حاجة");
  await p.click("#b-fx189"); await p.waitForTimeout(300);
  const a = await nums(p);
  ok(R(b.cash - a.cash) === 2037, "الخزنة نقصت 2,037: " + R(b.cash - a.cash));
  ok(R(a.meta) === 771.99, "رصيد فيسبوك = 771.99: " + a.meta);
  ok(Math.abs(a.diff) < 0.01, "الميزانية متوازنة: " + a.diff);
  ok(R(a.led) === R(a.cash), "الخزنة = دفتر الخزنة");
  ok(R(b.net - a.net) === 2591.41, "الربح نقص 2,530.41 صرف فيسبوك + 61 رسوم: " + R(b.net - a.net));
  ok(!(await p.$("#fx189")), "الكارت اختفى بعد التسجيل");
  const d = await data(p);
  ok(d.db.cash.filter(c => c.fx === "189").length === 5 && !!d.settings.fix189 && d.settings.metaRec.some(x => x.d === "2026-11-03" && x.bal === 771.99), "اتحفظ: 5 شحنات + مطابقة 3/11");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  // شحنة زيادة اتسجّلت باليد → الكارت ما يظهرش (مايسجّلش مرتين)
  const q = await open(browser, { db:db({ id:"mx", date:"2026-10-20", type:"expense", cat:"metatop", costKind:"var", amount:515, credit:500, partyId:"", at:1 }), settings, time:"2026-11-04T12:00:00" });
  await tab(q, "prepaid");
  ok(!(await q.$("#fx189")), "لو فيه شحنة اتسجّلت باليد الكارت ما بيظهرش");
  await q.close();
};
