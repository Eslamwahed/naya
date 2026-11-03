// بيانات تجريبية بأسامي وأرقام وهمية — ممنوع أي بيانات عملاء حقيقية هنا (المشروع على GitHub)
const sale = (o) => Object.assign({ status:"progress", partyId:"c1", payVia:"ship", shipCo:"QP", paid:0, shipIn:0, shipOut:0, at:1, lines:[] }, o);
const line = (itemId, color, size, qty, price, extra) => Object.assign({ itemId, color, size, qty, price, ret:0 }, extra || {});
const buy = (id, date, itemId, color, size, qty, cost, extra) => Object.assign({ id, date, partyId:"sp", itemId, color, size, qty, cost, paid:qty * cost,
  packs:qty, packQty:1, packCost:cost, packName:"قطعة", freight:0, at:1, batchId:"b-" + id }, extra || {});

// محل صغير: صنفين · مورد · 8 عملاء · شريكين · أوردرات في كل المراحل
function shop(){
  const parties = [
    { id:"sp", name:"مورد تجريبي", type:"supplier", at:1 },
    { id:"pa", name:"شريك أ", type:"partner", at:1 }, { id:"pb", name:"شريك ب", type:"partner", at:1 }
  ];
  for(let i = 1; i <= 8; i++) parties.push({ id:"c" + i, name:"عميل " + i, type:"customer", phone:"0100000000" + i, gov:"القاهرة", at:1 });
  return {
    items:[ { id:"i1", name:"صنف أ", price:300, sizes:"38، 39، 40", colors:"اسود، بيج", at:1 },
            { id:"i2", name:"صنف ب", price:320, sizes:"40", colors:"اسود", at:1 } ],
    parties,
    purchases:[ buy("p1", "2026-09-01", "i1", "اسود", "38", 5, 150), buy("p2", "2026-09-01", "i1", "بيج", "39", 5, 150), buy("p3", "2026-09-01", "i2", "اسود", "40", 5, 180) ],
    sales:[
      sale({ id:"s1", no:1, date:"2026-09-05", partyId:"c1", status:"delivered", deliveredAt:"2026-09-07", shipCode:"1001", shippedAt:"2026-09-05",
             shipIn:60, shipOut:80, paid:360, lines:[line("i1", "اسود", "38", 1, 300, { unitCost:150, trCost:0 })] }),
      sale({ id:"s2", no:2, date:"2026-09-05", partyId:"c2", status:"delivered", deliveredAt:"2026-09-08", shipCode:"1002", shippedAt:"2026-09-05",
             shipIn:75, shipOut:100, paid:675, lines:[line("i1", "بيج", "39", 2, 300, { unitCost:150, trCost:0 })] }),
      sale({ id:"s3", no:3, date:"2026-09-06", partyId:"c3", status:"cancelled", rsn:"refused", cancelledAt:"2026-09-10", shipCode:"1003", shippedAt:"2026-09-06",
             shipIn:0, shipOut:100, lines:[line("i2", "اسود", "40", 1, 320, { backAt:"2026-09-12" })] }),
      sale({ id:"s4", no:4, date:"2026-10-10", partyId:"c4", shipCode:"1004", shippedAt:"2026-10-10", cf:"ok",
             shipIn:70, shipOut:100, lines:[line("i2", "اسود", "40", 1, 320)] }),
      sale({ id:"s5", no:5, date:"2026-10-19", partyId:"c5", lines:[line("i1", "اسود", "38", 1, 300)], shipIn:60, shipOut:80 }),
      sale({ id:"s6", no:6, date:"2026-10-01", partyId:"c6", shipCo:"SONIC", status:"delivered", deliveredAt:"2026-10-03", shipCode:"S1", shippedAt:"2026-10-01",
             shipIn:50, shipOut:80, paid:370, lines:[line("i2", "اسود", "40", 1, 320, { unitCost:180, trCost:0 })] }),
      sale({ id:"s7", no:7, date:"2026-10-12", partyId:"c7", shipCode:"1007", shippedAt:"2026-10-12", cf:"ok",
             shipIn:75, shipOut:80, lines:[line("i1", "بيج", "39", 1, 300)] }),
      sale({ id:"s8", no:8, date:"2026-10-12", partyId:"c8", shipCode:"1999", shippedAt:"2026-10-12", cf:"ok",
             shipIn:60, shipOut:80, lines:[line("i1", "اسود", "38", 1, 300)] })
    ],
    cash:[
      { id:"k1", date:"2026-09-01", type:"cap_in", partyId:"pa", amount:10000, at:1 },
      { id:"k2", date:"2026-09-01", type:"cap_in", partyId:"pb", amount:10000, at:1 },
      { id:"k3", date:"2026-09-10", type:"expense", cat:"ads", costKind:"var", amount:500, note:"إعلان تجريبي", partyId:"", at:1 },
      { id:"k4", date:"2026-09-12", type:"settle", shipCo:"QP", amount:755, orders:["s1", "s2", "s3"], partyId:"", note:"استلام تجريبي", at:1 }
    ]
  };
}
// قاعدة فاضية فيها صنف وعميل ومورد — لسيناريوهات الحسابات
function blank(){
  return { items:[{ id:"i1", name:"صنف", price:300, sizes:"40", colors:"اسود", at:1 }],
    parties:[{ id:"c1", name:"عميل", type:"customer", at:1 }, { id:"sp", name:"مورد", type:"supplier", at:1 }],
    purchases:[], sales:[], cash:[] };
}
module.exports = { shop, blank, sale, line, buy };
