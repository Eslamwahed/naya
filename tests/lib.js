// أدوات مشتركة للاختبارات — كل اختبار بيفتح السيستم في متصفح حقيقي (Chromium) على بيانات تجريبية
const path = require("path"), fs = require("fs"), cp = require("child_process");
function loadPw(){
  try{ return require("playwright"); }catch(e){}
  try{ return require(path.join(cp.execSync("npm root -g").toString().trim(), "playwright")); }catch(e){}
  throw new Error("playwright مش متركّب — شغّل: npm install");
}
const pw = loadPw();
const APP = "file://" + path.resolve(__dirname, "..", "index.html");
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const DESK = { width:1366, height:900 }, MOB = { width:390, height:844 };

// بيفتح السيستم ببيانات معيّنة. opts: db, settings, time, theme, viewport, sview, auth, me
async function open(browser, opts){
  opts = opts || {};
  const p = await browser.newPage({ viewport:opts.viewport || DESK, reducedMotion:"reduce" });
  p.errs = []; p.on("pageerror", e => p.errs.push(e.message));
  await p.route(/fonts\.g/, r => r.abort());
  await p.clock.install({ time:new Date(opts.time || "2026-10-20T12:00:00") });
  await p.addInitScript(() => { window.__NAYA_TEST__ = true; });
  await p.goto(APP);
  await p.evaluate(o => {
    localStorage.clear();
    localStorage.setItem("naya:data", o.data);
    localStorage.setItem("naya:me", o.me);
    localStorage.setItem("naya:theme", o.theme);
    if(o.sview) localStorage.setItem("naya:sview", o.sview);
    if(o.auth) localStorage.setItem("naya:auth", o.auth);
  }, { data:JSON.stringify({ v:2, savedAt:Date.now(), settings:Object.assign({ currency:"ج.م" }, opts.settings || {}), db:opts.db }),
       me:opts.me || "اسلام", theme:opts.theme || "dark", sview:opts.sview || "", auth:opts.auth || "" });
  await p.reload(); await p.waitForTimeout(900);
  return p;
}
const tab = async (p, t) => { await p.evaluate(t => { const b = document.querySelector("#nav-sub button[data-tab='" + t + "']"); if(b) b.click(); }, t); await p.waitForTimeout(350); };
const data = async p => JSON.parse(await p.evaluate(() => localStorage.getItem("naya:data")));
const R = x => Math.round(x * 100) / 100;
module.exports = { pw, APP, SRC, DESK, MOB, open, tab, data, R };
