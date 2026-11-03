// بيشغّل كل الاختبارات: node tests/run.js  (أو اختبار واحد: node tests/run.js accounting)
const fs = require("fs"), path = require("path");
const { pw } = require("./lib");
(async () => {
  const only = process.argv[2];
  const files = fs.readdirSync(__dirname).filter(f => /\.test\.js$/.test(f) && (!only || f.includes(only))).sort();
  const browser = await pw.chromium.launch();
  let total = 0, failed = 0;
  for(const f of files){
    let pass = 0; const fails = [];
    const ok = (c, m) => { if(c) pass++; else fails.push(m); };
    const t0 = Date.now();
    try{ await require(path.join(__dirname, f))({ browser, ok }); }
    catch(e){ fails.push("استثناء: " + (e && e.stack || e)); }
    total += pass + fails.length; failed += fails.length;
    console.log((fails.length ? "✗ " : "✓ ") + f.padEnd(24) + " " + pass + "/" + (pass + fails.length) + "  (" + ((Date.now() - t0) / 1000).toFixed(1) + "s)");
    fails.forEach(m => console.log("    ✗ " + m));
  }
  await browser.close();
  console.log("\n" + (failed ? "✗ " + failed + " فشل من " + total : "✓ كله عدّى — " + total + " فحص"));
  process.exit(failed ? 1 : 0);
})();
