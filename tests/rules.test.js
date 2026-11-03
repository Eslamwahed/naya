// قواعد المشروع اللي ما ينفعش تتكسر: رقم الإصدار · مفاتيح التخزين · مفيش مفاتيح سرية
const { SRC } = require("./lib"), cp = require("child_process"), path = require("path");
module.exports = async ({ ok }) => {
  const v = (SRC.match(/var VERSION = "(\d+)"/) || [])[1];
  const c = (SRC.match(/var CHANGELOG = \[\s*\{ v:"(\d+)"/) || [])[1];
  let built = true; try{ cp.execSync("node " + path.join(__dirname, "..", "build.js") + " --check", { stdio:"pipe" }); }catch(e){ built = false; }
  ok(built, "index.html متجمّع من src/ (التعديل في src/ وبعدين node build.js)");
  ok(v && v === c, "رقم الإصدار (" + v + ") = أول سطر في سجل التغييرات (" + c + ")");
  ["naya:data", "naya:me", "naya:sync", "naya:theme", "naya:pushed", "naya:auth", "naya:sview", "naya:calc", "naya:rtab", "trade:items", "trade:sales", "trade:cash"]
    .forEach(k => ok(SRC.includes('"' + k + '"'), "مفتاح التخزين " + k + " موجود زي ما هو"));
  ok(!/sb_secret_[A-Za-z0-9]{8,}/.test(SRC), "مفيش مفتاح sb_secret حقيقي في الملف");
  ok(!/fix1[4-6]\d(Pending|Run)\b/.test(SRC), "كروت التصحيح القديمة مش راجعة");
  const scripts = [...SRC.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  ok(scripts.every(u => /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//.test(u)), "سكريبتات خارجية من مصادر معروفة بس: " + scripts.join(" "));
};
