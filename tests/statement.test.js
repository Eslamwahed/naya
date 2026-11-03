// «ارفع كشف QP»: مطابقة بالبوليصة والتليفون · فروق الشحن · المرتجع · سطر من غير أوردر · ما يتسجّلش مرتين
const fs = require("fs"), os = require("os"), path = require("path");
const { open, tab, data, R } = require("./lib"), F = require("./fixtures"), X = require("./xlsx");
module.exports = async ({ browser, ok }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stm-"));
  const f1 = path.join(dir, "Revenue_Report_A.xlsx"), f2 = path.join(dir, "summary.xlsx");
  fs.writeFileSync(f1, X.qpReport([
    { ser:"1004", st:"Delivered", type:"collect", amt:390, fee:100, cod:290, cdate:"2026-10-18", name:"عميل 4" },        // مطابق ويتسلّم
    { ser:"1007", st:"Delivered", type:"collect", amt:360, fee:90, cod:270, cdate:"2026-10-18", name:"عميل 7" },         // دفع 360 (شحن 60) وQP خدت 90
    { ser:"5555", st:"Undelivered", type:"return", amt:0, fee:100, cod:-100, rdate:"2026-10-17", phone:"01000000008", odate:"2026-10-12", name:"عميل 8" }, // بالتليفون
    { ser:"7777", st:"Delivered", type:"collect", amt:0, fee:200, cod:-200, cdate:"2026-10-18", name:"Test Shop" }        // مالوش أوردر = مصروف
  ]));
  fs.writeFileSync(f2, X.sheet([["Company name", "Day date", "Cod"], ["Test", "2026-10-18", 260]]));
  const p = await open(browser, { db:F.shop(), time:"2026-10-20T12:00:00" });
  await tab(p, "ship");
  const c0 = await p.evaluate(() => window.__T.cashBox());
  await p.setInputFiles("#stm-file", [f1, f2]); await p.waitForTimeout(800);
  const txt = (await p.innerText("#stm-card")).replace(/\s+/g, " ");
  ok(txt.includes("ملخص الأيام"), "ملف الملخص بيتقال عليه");
  ok(txt.includes("#7") && txt.includes("دفع 360 (شحن 60 بدل 75)") && txt.includes("شحن QP 90 بدل 80"), "#7 فروق الشحن");
  ok(txt.includes("#8") && txt.includes("اتعرف بالتليفون") && txt.includes("1999 ← 5555") && txt.includes("اترفض"), "#8 بالتليفون وبيترفض");
  ok(txt.includes("هيتسجّل مصروف"), "السطر اللي مالوش أوردر = مصروف");
  ok(!txt.includes("✗"), "مفيش سطر واقف");
  await p.click("#b-stm-ok"); await p.waitForTimeout(500);
  const d = await data(p), O = id => d.db.sales.find(s => s.id === id);
  const c1 = await p.evaluate(() => window.__T.cashBox());
  ok(R(c1 - c0) === 260, "الخزنة زادت صافي الكشف 260: " + R(c1 - c0));
  ok(O("s4").status === "delivered" && O("s4").deliveredAt === "2026-10-18", "#4 اتسلّم بتاريخ الكشف");
  ok(O("s7").shipIn === 60 && O("s7").shipOut === 90 && O("s7").paid === 360, "#7 اتصلّح");
  ok(O("s8").status === "cancelled" && O("s8").shipCode === "5555" && O("s8").shipIn - O("s8").shipOut === -100 && O("s8").lines[0].backAt === "2026-10-17", "#8 اترفض والمرتجع رجع");
  const st = d.db.cash.filter(c => c.type === "settle" && c.stm && !c.deleted), ex = d.db.cash.filter(c => c.type === "expense" && /7777/.test(c.note || ""));
  ok(st.length === 1 && st[0].amount === 460 && st[0].orders.length === 3 && ex.length === 1 && ex[0].amount === 200, "استلام 460 بـ3 أوردرات + مصروف 200");
  ok(R(await p.evaluate(() => window.__T.walletOf("QP"))) === 0, "QP صفر بعد الكشف");
  // نفس الملف تاني
  await p.setInputFiles("#stm-file", [f1]); await p.waitForTimeout(600);
  ok((await p.innerText("#stm-card")).includes("متسجّل قبل كده") && !(await p.$("#b-stm-ok")), "الكشف ما بيتسجّلش مرتين");
  ok((await p.evaluate(() => window.__T.finBS().diff)) < 0.01, "الميزانية متوازنة بعد الكشف");
  ok(!p.errs.length, "أخطاء الصفحة: " + p.errs.join(";"));
  await p.close();
};
