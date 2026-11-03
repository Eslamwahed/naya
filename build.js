// بيجمّع src/ في index.html واحد (اللي بيتنشر على GitHub Pages وبيشتغل من غير نت).
//   node build.js          → يكتب index.html
//   node build.js --check  → يتأكد إن index.html متجمّع من src/ (الفحص التلقائي بيستخدمه)
// التعديل بيتعمل في src/ دايمًا، مش في index.html.
const fs = require("fs"), path = require("path");
const SRC = path.join(__dirname, "src"), OUT = path.join(__dirname, "index.html");
function build(){
  const shell = fs.readFileSync(path.join(SRC, "app.html"), "utf8");
  const used = new Set();
  const html = shell.replace(/^<!--@include ([\w./-]+) -->\n/gm, (m, f) => {
    const p = path.join(SRC, f);
    if(!fs.existsSync(p)) throw new Error("مش لاقي " + f);
    used.add(f.replace(/\\/g, "/"));
    return fs.readFileSync(p, "utf8");
  });
  // ملف في src/ مش داخل في app.html = غالبًا اتنسى
  const all = []; (function walk(d){ fs.readdirSync(d).forEach(n => { const p = path.join(d, n);
    if(fs.statSync(p).isDirectory()) walk(p); else if(n !== "app.html") all.push(path.relative(SRC, p).replace(/\\/g, "/")); }); })(SRC);
  const orphan = all.filter(f => !used.has(f));
  if(orphan.length) throw new Error("ملفات في src/ مش داخلة في app.html: " + orphan.join(" "));
  return html;
}
const html = build();
if(process.argv.includes("--check")){
  const cur = fs.readFileSync(OUT, "utf8");
  if(cur !== html){ console.error("✗ index.html مش متجمّع من src/ — شغّل: node build.js"); process.exit(1); }
  console.log("✓ index.html = src/ (" + html.length + " حرف)");
} else {
  fs.writeFileSync(OUT, html);
  console.log("✓ اتكتب index.html (" + html.length + " حرف)");
}
