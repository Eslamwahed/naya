from pathlib import Path
from datetime import datetime, timezone
import tempfile
import sys
import json
from playwright.sync_api import sync_playwright

ROOT = Path(tempfile.mkdtemp(prefix="naya-finance-"))
SOURCE = Path(__file__).resolve().parents[1] / "index.html"
RESULTS = []
DATE = '2026-10-22'

def base():
    return {'db': {'items': [{'id':'i','name':'Test item','price':150}],
        'parties': [{'id':'c','name':'Customer','type':'customer'},
                    {'id':'s','name':'Supplier','type':'supplier'},
                    {'id':'a','name':'Partner A','type':'partner'}],
        'purchases':[], 'sales':[],
        'cash':[{'id':'capital','date':'2026-09-01','type':'cap_in','partyId':'a','amount':5000}]},
        'settings':{'currency':'ج.م'}}

def purchase(id='p1', date='2026-10-01', qty=10, cost=100, paid=1000, freight=0, **kw):
    return dict(id=id,date=date,partyId='s',itemId='i',color='',size='',qty=qty,cost=cost,paid=paid,freight=freight,**kw)

def sale(id='o1', date='2026-10-02', qty=2, price=150, paid=300, status='delivered', cost=100, **kw):
    result=dict(id=id,no=1,date=date,partyId='c',status=status,payVia='direct',paid=paid,
        lines=[{'itemId':'i','color':'','size':'','qty':qty,'price':price,'ret':0,'unitCost':cost,'trCost':0}])
    result.update(kw)
    return result

EXPORT = r'''
  window.__audit = {
    reset: function(f){
      db = JSON.parse(JSON.stringify(f.db)); settings = JSON.parse(JSON.stringify(f.settings || {currency:'ج.م'}));
      clearStockIdx(); _mspan=null; pendCache=null;
      editing = {items:null,parties:null,purchases:null,sales:null,cash:null};
      renderAll();
    },
    get db(){return db;}, get settings(){return settings;},
    invalidate: function(){clearStockIdx(); _mspan=null; pendCache=null;},
    addPurchase: function(p){db.purchases.push(p);clearStockIdx();},
    deliver: function(s){stampDelivery(s);db.sales.push(s);clearStockIdx();return s;},
    setSaleStatus:setSaleStatus, saveRet:saveRet, computeShares:computeShares,
    periodStats:periodStats, projStats:projStats, finIS:finIS, finBS:finBS,
    avgCostV:avgCostV, stockOf:stockOf, freeOfV:freeOfV, stockAtAvg:stockAtAvg,
    stockBookValue:stockBookValue, cashBox:cashBox, partyBalance:partyBalance,
    walletOf:walletOf, shipPend:shipPend, heldLeft:heldLeft,
    expByCat:expByCat, prepaidTotal:prepaidTotal, owedOf:owedOf,
    weightedRatio:weightedRatio, itemProfit:itemProfit,
    renderHome:renderHome, renderInventory:renderInventory,
    goTab:goTab, openPRet:openPRet, partnerReport:partnerReport,
    quickPay:quickPay, cashLedger:cashLedger, inventoryCosts:inventoryCosts,
    get pretSrc(){return pretSrc;}, set pretSrc(v){pretSrc=v;},
    get draft(){return draft;}, set draft(v){draft=v;}, saveDraft:saveDraft,
    get pdraft(){return pdraft;}, set pdraft(v){pdraft=v;}, syncPHead:syncPHead,
    get distDraft(){return distDraft;}, set distDraft(v){distDraft=v;},
    snapshot: function(){return {cash:cashBox(), stock:stockBookValue(), stockScreen:stockAtAvg(),
      units:stockOf('i'), free:freeOfV('i','',''), net:periodStats(null).net,
      cogs:periodStats(null).cogs, revenue:periodStats(null).revenue,
      projected:projStats(null).exp.net, supplier:partyBalance('s'), customer:partyBalance('c'),
      wallet:walletOf('Co'), prepaid:prepaidTotal(), owed:owedOf('a'), balance:finBS().diff};}
  };
'''

def check(name, actual, expected, note=''):
    def equal(a,e):
        if isinstance(e,dict): return all(k in a and equal(a[k],v) for k,v in e.items())
        if isinstance(e,(float,int)) and not isinstance(e,bool): return abs(a-e)<0.005
        return a == e
    RESULTS.append(dict(name=name, passed=equal(actual,expected), actual=actual, expected=expected, note=note))
    print(json.dumps(RESULTS[-1],ensure_ascii=False),flush=True)

def reset(page,f): page.evaluate('(f)=>__audit.reset(f)',f)
def snap(page): return page.evaluate('__audit.snapshot()')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context = browser.new_context(timezone_id='Africa/Cairo',accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(10000)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    context.route('https://fonts.googleapis.com/**',lambda route:route.abort())
    source=SOURCE.read_text()
    marker='  /* ---------- بدء ---------- */'
    assert source.count(marker)==1
    # Instrument only the HTTP response in this isolated browser; leave the source file unchanged.
    context.route('http://127.0.0.1:8000/',lambda route:route.fulfill(status=200,content_type='text/html',body=source.replace(marker,EXPORT+'\n'+marker)))
    page.clock.install(time=datetime(2026,10,22,12,tzinfo=timezone.utc))
    page.goto('http://127.0.0.1:8000/',wait_until='domcontentloaded')
    page.wait_for_function('window.__audit && document.querySelector("#hm-big").innerHTML.length > 0')

    f=base(); f['db']['purchases']=[purchase()]; f['db']['sales']=[sale()]
    reset(page,f)
    check('Basic paid purchase and delivered cash sale',snap(page),{'cash':4300,'stock':800,'units':8,'net':100,'cogs':200,'revenue':300,'supplier':0,'customer':0,'balance':0})
    f=base();f['db']['purchases']=[purchase(cost=110,paid=400,freight=100)]
    reset(page,f)
    check('Supplier credit and inward freight',snap(page),{'cash':4500,'stock':1100,'supplier':-600,'net':0,'balance':0})
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(paid=320,payVia='ship',shipCo='Co',shipCode='T',shipIn=20,shipOut=30)]
    reset(page,f)
    check('Shipping collection is a receivable from carrier',snap(page),{'cash':4000,'wallet':290,'net':90,'customer':0,'balance':0})
    f['db']['cash'].append({'id':'settle','type':'settle','shipCo':'Co','amount':200,'date':'2026-10-03'})
    reset(page,f)
    check('Carrier settlement transfers cash without new profit',snap(page),{'cash':4200,'wallet':90,'net':90,'balance':0})
    f['db']['sales'][0]['lines'][0]['ret']=1;f['db']['sales'][0]['paid']=170
    reset(page,f)
    check('Partial return with carrier',snap(page),{'cash':4200,'stock':900,'wallet':-60,'net':40,'units':9,'balance':0})
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(status='progress',paid=100)]
    reset(page,f)
    check('Customer advance before delivery',snap(page),{'cash':4100,'stock':1000,'net':0,'customer':-100,'balance':0})
    page.evaluate('__audit.setSaleStatus(__audit.db.sales[0],"cancelled")')
    check('Cancellation must retain advance until actual refund',snap(page),{'cash':4100,'customer':-100,'net':0,'balance':0},'No refund was recorded; only the order status changed.')
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(date='2026-10-20',paid=0,deliveredAt='2026-10-21')]
    reset(page,f)
    def collect(amount):
        page.evaluate('''(amount)=>{
          document.querySelectorAll('[data-qp]').forEach(e=>e.remove());
          var input=document.createElement('input');input.dataset.qp='o1';input.value=amount;document.body.appendChild(input);
          __audit.quickPay('o1',false);input.remove();
        }''',str(amount))
    collect(100)
    page.clock.set_system_time(datetime(2026,10,23,12,tzinfo=timezone.utc))
    collect(100)
    check('Daily cash ledger preserves separate installment dates',page.evaluate('''()=>{
      var totals={};__audit.cashLedger().filter(x=>x.src==='أوردر'&&x.inn).forEach(x=>totals[x.d]=(totals[x.d]||0)+x.inn);return totals;
    }'''),{'2026-10-22':100,'2026-10-23':100})
    check('Installments still produce the right current cash total',snap(page),{'cash':4200,'customer':100})
    page.clock.set_system_time(datetime(2026,10,22,12,tzinfo=timezone.utc))
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(id='old',qty=10,price=150,paid=1500)]
    reset(page,f)
    check('Stock sold out before restock',snap(page),{'cash':5500,'stock':0,'stockScreen':0,'units':0,'net':500,'balance':0})
    page.evaluate('(p)=>__audit.addPurchase(p)',purchase(id='p2',date='2026-10-03',qty=10,cost=200,paid=2000))
    check('Inventory report after restocking at a new price',snap(page),{'stock':2000,'stockScreen':2000,'units':10,'net':500,'balance':0},'Old batch was fully sold before buying the new batch.')
    new=sale(id='new',date='2026-10-04',qty=10,price=250,paid=2500)
    del new['lines'][0]['unitCost'];del new['lines'][0]['trCost']
    stamped=page.evaluate('(s)=>__audit.deliver(s)',new)
    check('Cost assigned to sale after restock',stamped['lines'][0]['unitCost'],200)
    check('All stock sold: no residual inventory value',snap(page),{'cash':6000,'stock':0,'units':0,'net':1000,'cogs':3000,'balance':0})
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(status='cancelled',date='2026-09-30',paid=0,payVia='ship',shipCo='Co',shipCode='T',shipIn=0,shipOut=30,cancelledAt='2026-10-02')]
    reset(page,f)
    check('Refusal shipping loss belongs to refusal month',page.evaluate('({sep:__audit.periodStats({from:"2026-09-01",to:"2026-09-30"}).net,oct:__audit.periodStats({from:"2026-10-01",to:"2026-10-31"}).net})'),{'sep':0,'oct':-30})
    f=base();f['db']['cash'].append({'id':'sub','type':'expense','date':'2026-10-10','cat':'subs','svcDays':30,'amount':300})
    reset(page,f)
    check('Subscription expense recognized over its service period',snap(page),{'cash':4700,'net':-130,'prepaid':170,'balance':0})
    f['db']['cash'][-1]['paidBy']='a';reset(page,f)
    check('Partner paid expense creates payable, not cash outflow',snap(page),{'cash':5000,'net':-130,'prepaid':170,'owed':300,'balance':0})
    report=page.evaluate('''()=>{
      var root=document.createElement('div');root.innerHTML=__audit.partnerReport('2026-10');
      var tables=root.querySelectorAll('.prt-pg')[1].querySelectorAll('.prt-2 table');
      return Array.from(tables).map(t=>{
        var num=s=>{s=s.replace(/,/g,'').trim();return s.startsWith('(')?-Number(s.slice(1,-1)):Number(s)||0;};
        var rows=Array.from(t.querySelectorAll('tr:not(.tot)')).map(r=>({name:r.cells[0].textContent,value:num(r.cells[1].textContent)}));
        return {rows:rows,sum:rows.reduce((a,r)=>a+r.value,0),total:num(t.querySelector('tr.tot').cells[1].textContent)};
      });
    }''')
    check('Printed balance sheet lists all assets in its total',report[0]['sum'],report[0]['total'],json.dumps(report[0],ensure_ascii=False))
    check('Printed balance sheet lists all liabilities in its total',report[1]['sum'],report[1]['total'],json.dumps(report[1],ensure_ascii=False))
    f['db']['cash'].append({'id':'repay','type':'cap_repay','date':DATE,'partyId':'a','amount':100});reset(page,f)
    check('Reimbursement reduces partner payable without new expense',snap(page),{'cash':4900,'net':-130,'prepaid':170,'owed':200,'balance':0})
    f=base();f['db']['cash'].append({'id':'fb','type':'expense','date':'2026-10-01','cat':'metatop','amount':1030,'credit':1000});f['settings']['metaRec']=[{'d':'2026-10-10','bal':600}]
    reset(page,f)
    check('Facebook top-up is asset; spend and fees are expenses',snap(page),{'cash':3970,'net':-430,'prepaid':600,'balance':0})
    f=base();f['db']['purchases']=[purchase()];f['db']['cash'].append({'id':'transport','type':'expense','date':'2026-10-01','cat':'trans','amount':100});f['db']['sales']=[sale()];f['db']['sales'][0]['lines'][0]['trCost']=10
    reset(page,f)
    check('Inward transport capitalized once with sold portion expensed',snap(page),{'cash':4200,'stock':880,'net':80,'cogs':220,'balance':0})
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(qty=10,price=150,paid=1500)]
    reset(page,f)
    page.evaluate('''()=>{__audit.db.cash.push({id:'late-transport',type:'expense',date:'2026-10-01',cat:'trans',amount:100});__audit.invalidate();}''')
    check('Late entry of pre-sale freight must reach cost of sold goods',snap(page),{'stock':0,'net':400,'cogs':1100,'units':0,'balance':0},'Expense was entered after delivery; all ten units were already sold with pinned trCost=0.')
    f=base();f['db']['purchases']=[purchase()]
    reset(page,f)
    page.evaluate('''()=>{
      __audit.openPRet('p1');
      document.getElementById('pr-date').value='2026-10-03';
      document.getElementById('pr-qty').value='10';
      document.getElementById('pr-unit').value='80';
      document.getElementById('pr-mode').value='cash';
      document.getElementById('b-pret').click();
    }''')
    check('Full supplier return below cost must recognize loss',snap(page),{'cash':4800,'stock':0,'units':0,'net':-200,'supplier':0,'balance':0})
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(status='progress',paid=0)]
    reset(page,f)
    check('Delivered-only statement excludes pending profit',{'actual':page.evaluate('__audit.finIS(null).net'),'projected':page.evaluate('__audit.projStats(null).exp.net')},{'actual':0,'projected':100})
    page.evaluate('__audit.renderHome()')
    hero=page.locator('[data-hkpi="net"]').inner_text()
    check('Home includes the actual result beneath its forecast', 'اتسلّم فعلاً 0.00' in hero,True,hero)
    f=base();f['db']['parties'].append({'id':'b','name':'Partner B','type':'partner'});f['db']['cash']=[{'id':'ca','type':'cap_in','partyId':'a','date':'2026-10-01','amount':1000},{'id':'cb','type':'cap_in','partyId':'b','date':'2026-10-11','amount':1000}]
    f['db']['purchases']=[purchase(date='2026-10-11',qty=2,cost=100,paid=200)]
    f['db']['sales']=[sale(date='2026-10-12',qty=2,price=250,paid=500)]
    reset(page,f)
    check('Partner distribution with capital present all days',page.evaluate('__audit.computeShares(300,"2026-10-01","2026-10-20").map(r=>({id:r.id,share:r.share}))'),[{'id':'a','share':225},{'id':'b','share':75}])
    f['db']['cash'][0]['date']='2026-10-11';reset(page,f)
    check('Partner distribution when first capital starts inside period',page.evaluate('''()=>{
      document.getElementById('dist-from').value='2026-10-01';
      document.getElementById('dist-to').value='2026-10-20';
      document.getElementById('dist-amount').value='300';
      document.getElementById('b-dist-calc').click();
      return __audit.distDraft.rows.map(r=>({id:r.id,share:r.share}));
    }'''),[{'id':'a','share':150},{'id':'b','share':150}])
    f=base(); f['db']['purchases']=[purchase(),purchase(id='p2',date='2026-10-03',cost=200,paid=2000)]
    f['db']['sales']=[sale(id='first',qty=10,paid=1500),sale(id='second',date='2026-10-04',qty=10,price=250,paid=2500,cost=150)]
    reset(page,f)
    check('Legacy incorrect unlocked cost stamps are recalculated without rewriting data',snap(page),{'net':1000,'stock':0,'stockScreen':0,'balance':0})
    check('Cost recalculation leaves stored records intact',page.evaluate('__audit.db.sales[1].lines[0].unitCost'),150)
    f=base();f['db']['purchases']=[purchase()];s=sale();line=s.pop('lines')[0]
    s.update({k:v for k,v in line.items() if k!='trCost'});f['db']['sales']=[s]
    reset(page,f)
    check('Legacy single-item sale records share the same cost ledger',snap(page),{'net':100,'cogs':200,'stock':800,'balance':0})
    f=base();f['db']['purchases']=[purchase(cost=110,freight=100)]
    f['db']['purchases'].append(purchase(id='ret',date='2026-10-03',qty=-10,cost=100,paid=-1000,isReturn=True))
    reset(page,f)
    check('Freight not refunded on full return is a loss, not phantom stock',snap(page),{'cash':4900,'stock':0,'net':-100,'units':0,'balance':0})
    f['db']['purchases'][0]=purchase()
    f['db']['purchases'][1]=purchase(id='exchange',date='2026-10-03',qty=-10,cost=100,paid=-800,isReturn=True,xchg='x',xloss=200,credit=80)
    reset(page,f)
    check('Exchange loss already recorded in old data is not counted twice',snap(page),{'stock':0,'net':-200,'supplier':0,'cash':4800,'balance':0})
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(status='progress',paid=100)]
    reset(page,f);page.evaluate('__audit.setSaleStatus(__audit.db.sales[0],"cancelled")')
    page.evaluate('''()=>{__audit.db.cash.push({id:'refund',date:'2026-10-22',type:'out',partyId:'c',amount:100});__audit.invalidate();}''')
    check('Actual refund clears advance exactly once',snap(page),{'cash':4000,'customer':0,'stock':1000,'net':0,'balance':0})
    f=base();f['db']['purchases']=[purchase(date='2026-09-01')]
    f['db']['sales']=[sale(date='2026-09-02',cost=90)];f['settings']['lockedUntil']='2026-09-30'
    reset(page,f)
    check('Closed-period cost stamps remain unchanged',snap(page),{'cogs':180,'net':120,'stock':820,'balance':0})
    f=base();f['db']['purchases']=[purchase(),purchase(id='future',date='2026-10-20',cost=200,paid=2000)]
    f['db']['sales']=[sale(date='2026-10-02',cost=150)]
    reset(page,f)
    check('Later purchases cannot change cost of an earlier sale',snap(page),{'net':100,'cogs':200,'stock':2800,'balance':0})
    f=base();f['db']['parties'].append({'id':'b','name':'Partner B','type':'partner'})
    f['db']['cash']=[{'id':'a','type':'cap_in','partyId':'a','date':'2026-10-11','amount':1000},{'id':'b','type':'cap_in','partyId':'b','date':'2026-10-11','amount':1000}]
    reset(page,f)
    check('No capital in selected period cannot award everything to first partner',page.evaluate('__audit.computeShares(300,"2026-10-01","2026-10-10")'),[])
    f=base();f['db']['purchases']=[purchase(qty=3,cost=100+1/3,paid=300,freight=1)]
    f['db']['sales']=[sale(qty=3,paid=450)]
    reset(page,f)
    check('Fractional unit freight conserves total cost when stock sells out',snap(page),{'stock':0,'stockScreen':0,'net':149,'cogs':301,'balance':0})
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(qty=10,paid=1500,cost=150)]
    reset(page,f)
    before=snap(page)
    page.evaluate('''()=>{document.getElementById('lock-until').value='2026-10-21';document.getElementById('b-lock').click();}''')
    check('Closing an open period freezes its corrected cost instead of reviving old stamps',snap(page),{'net':500,'stock':0,'cogs':1000,'balance':0})
    check('Closing records the corrected cost for future restores',page.evaluate('__audit.db.sales[0].lines[0].unitCost'),100)
    f=base();f['db']['purchases']=[purchase(cost=110,freight=100),purchase(id='ret',date='2026-10-03',qty=-10,cost=100,paid=-1000,isReturn=True)]
    reset(page,f)
    page.evaluate('''()=>{document.getElementById('lock-until').value='2026-10-21';document.getElementById('b-lock').click();}''')
    check('Closing also preserves corrected return losses and freight',snap(page),{'net':-100,'stock':0,'cogs':0,'balance':0})
    # Receipt history must survive JSON persistence, not merely an open browser session.
    f=base();f['db']['purchases']=[purchase()];f['db']['sales']=[sale(paid=0)]
    reset(page,f);collect(100)
    page.clock.set_system_time(datetime(2026,10,23,12,tzinfo=timezone.utc));collect(100)
    saved=page.evaluate('JSON.parse(JSON.stringify({db:__audit.db,settings:__audit.settings}))')
    reset(page,saved)
    check('Payment history survives export and restore',page.evaluate('''()=>{
      var totals={};__audit.cashLedger().filter(x=>x.src==='أوردر'&&x.inn).forEach(x=>totals[x.d]=(totals[x.d]||0)+x.inn);return totals;
    }'''),{'2026-10-22':100,'2026-10-23':100})
    page.clock.set_system_time(datetime(2026,10,22,12,tzinfo=timezone.utc))
    f=base();reset(page,f)
    page.evaluate('''()=>{
      __audit.pdraft={date:'2026-10-01',partyId:'s',freight:100,paid:1000,paidAuto:false,note:'',inv:'',
        lines:[{itemId:'i',byPack:false,packs:10,packQty:1,packCost:100,mix:[{color:'',size:'',qty:10}]}]};
      __audit.syncPHead();document.getElementById('b-purch').click();
    }''')
    check('Purchase save handler allocates inward freight and cash correctly',snap(page),{'cash':3900,'stock':1100,'units':10,'supplier':0,'balance':0})
    page.evaluate('''()=>{
      __audit.draft={date:'2026-10-02',partyId:'c',status:'delivered',selfDel:true,payVia:'direct',shipIn:20,shipOut:30,paid:0,
        lines:[{itemId:'i',color:'',size:'',qty:2,price:150,ret:0}]};
      document.getElementById('b-savedraft').click();
    }''')
    check('Sale save handler collects self-delivery payment and charges actual cost',snap(page),{'cash':4190,'stock':880,'revenue':300,'cogs':220,'net':70,'balance':0})
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function('window.__audit && document.querySelector("#hm-big").innerHTML.length>0')
    check('Saved business workflow survives a full page reload',snap(page),{'cash':4190,'stock':880,'revenue':300,'cogs':220,'net':70,'balance':0})
    check('Browser runtime errors during financial checks',errors,[])
    browser.close()

ROOT.joinpath('results.json').write_text(json.dumps(RESULTS,indent=2,ensure_ascii=False))
print(json.dumps({'checks':len(RESULTS),'passed':sum(r['passed'] for r in RESULTS),'failed':sum(not r['passed'] for r in RESULTS)},ensure_ascii=False))

sys.exit(1 if any(not r["passed"] for r in RESULTS) else 0)
