// بيعمل ملف إكسل صغير بنفس شكل كشف QP (Revenue Report) — للاختبارات بس
const zlib = require("zlib");
const CRC = (() => { const t = []; for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for(const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files){
  const parts = [], cen = []; let off = 0;
  for(const [name, text] of Object.entries(files)){
    const raw = Buffer.from(text, "utf8"), def = zlib.deflateRawSync(raw), nm = Buffer.from(name), crc = crc32(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(def.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26);
    parts.push(h, nm, def);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(def.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    cen.push(c, nm); off += 30 + nm.length + def.length;
  }
  const cd = Buffer.concat(cen), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const col = i => String.fromCharCode(65 + i);
// rows: مصفوفة مصفوفات — أول صف العناوين
function sheet(rows){
  const xml = rows.map((r, i) => "<row r='" + (i + 1) + "'>" + r.map((v, j) => typeof v === "number"
      ? "<c r='" + col(j) + (i + 1) + "'><v>" + v + "</v></c>"
      : "<c r='" + col(j) + (i + 1) + "' t='inlineStr'><is><t>" + esc(v) + "</t></is></c>").join("") + "</row>").join("");
  return zip({ "[Content_Types].xml":"<?xml version='1.0'?><Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'/>",
    "xl/worksheets/sheet1.xml":"<?xml version='1.0' encoding='UTF-8'?><worksheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><sheetData>" + xml + "</sheetData></worksheet>" });
}
const QP_HEAD = ["Customer id", "Company name", "Serial", "Order delivery status", "Statusnote", "Notes", "Order date", "Full name", "Phone", "Address", "Governorate", "Type", "Total amount", "Total fees", "Cod", "Collect date", "Return date"];
// L: {ser, st, name, phone, type, amt, fee, cod, odate, cdate, rdate, note}
const qpReport = L => sheet([QP_HEAD].concat(L.map(x => ["1", "Test", x.ser, x.st, x.note || "", "", x.odate || "", x.name || "", x.phone || "", "", "", x.type, x.amt, x.fee, x.cod, x.cdate || "", x.rdate || ""])));
module.exports = { sheet, qpReport };
