// المخزون (v181): سطر ملخّص · تبويبات · لكل صنف دواير ألوانه والمتاح منها = مجموع خانات جدول اللون × المقاس
const { open, tab, MOB } = require("./lib"), F = require("./fixtures");
module.exports = async ({ browser, ok }) => {
  const p = await open(browser, { db:F.shop() });
  await tab(p, "inv");
  const top = await p.innerText("#inv-top");
  ok(/قطعة في المخزن/.test(top) && await p.evaluate(() => !document.querySelector("#inv-top > div")), "سطر ملخّص بدل الكروت: " + top);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector("#inv-quick [data-invonly='instock']")).display === "none"), "«فيه رصيد» مستخبي");
  // كل صنف: مجموع أرقام الألوان = «متاح»
  const rows = await p.evaluate(() => [...document.querySelectorAll("#inv-cards .iv")].map(iv => ({
    av:Number(iv.querySelector(".iv-av").textContent.replace(/[^\d-]/g, "")),
    sum:[...iv.querySelectorAll(".ivc b")].reduce((a, b) => a + Number(b.textContent.replace(/[^\d-]/g, "")), 0),
    sw:iv.querySelectorAll(".ivc i[style]").length })));
  ok(rows.length && rows.every(r => r.av === r.sum), "مجموع الألوان = المتاح: " + JSON.stringify(rows));
  ok(rows.some(r => r.sw > 0), "دواير الألوان ظاهرة");
  // افتح أول صنف: مجموع خانات الجدول = متاح
  await p.click("#inv-cards .iv-h >> nth=0"); await p.waitForTimeout(300);
  const g = await p.evaluate(() => { const iv = document.querySelector("#inv-cards .iv.open");
    return { av:Number(iv.querySelector(".iv-av").textContent.replace(/[^\d-]/g, "")),
             cells:[...iv.querySelectorAll("table.iv-mx td b")].reduce((a, b) => a + Number(b.textContent.replace(/[^\d-]/g, "")), 0) }; });
  ok(g.av === g.cells, "خانات الجدول = المتاح: " + JSON.stringify(g));
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
  const m = await open(browser, { db:F.shop(), viewport:MOB, theme:"dark" });
  await tab(m, "inv");
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "موبايل ليلي من غير سكرول بالعرض");
  await m.close();
};
