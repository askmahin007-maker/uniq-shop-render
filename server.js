const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json({limit:'20mb'}));
app.use(express.static('public'));

let DB_FILE = path.join(__dirname, 'data.json');
let db = { products:[], orders:[], feedbacks:[], faqs:[], settings:{chatNumber:"01816314494", contactTime:"প্রতিদিন সকাল ৯টা - রাত ৯টা", adminKey:"admin123", bkashNumber:"01816314494"}, users:[], reviews:[], stockAlerts:[] };

if(fs.existsSync(DB_FILE)){ try{ db = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }catch(e){} }
if(!db.users) db.users=[];
if(!db.reviews) db.reviews=[];
if(!db.stockAlerts) db.stockAlerts=[];
if(!db.settings.bkashNumber) db.settings.bkashNumber="01816314494";
if(!db.settings.coupons) db.settings.coupons=[{code:'UNIQ10',off:10,active:true}];

function normalizeVariants(input, fallbackPrice){
  if(!Array.isArray(input)) return [];
  return input.map(v=>{
    if(v.name && !v.color){
      let parts = String(v.name).split(' - ');
      let size = parts[0]?.trim() || 'M';
      let color = parts[1]?.trim() || v.name;
      if(parts.length===1){ color = parts[0]; size='One Size'; }
      return {color, name:color, size, stock:parseInt(v.stock)||0, price:parseInt(v.price)||fallbackPrice||0};
    }
    return {color:v.color||v.name||'Default', name:v.color||v.name||'Default', size:v.size||'M', stock:parseInt(v.stock)||0, price:parseInt(v.price)||fallbackPrice||0};
  }).filter(v=>v.color);
}
function calcTotalStock(p){
  if(p.variants && p.variants.length) return p.variants.reduce((s,v)=>s+(parseInt(v.stock)||0),0);
  return parseInt(p.stock)||0;
}
function save(){ fs.writeFileSync(DB_FILE, JSON.stringify(db)); }
function checkAdmin(req,res,next){ if(req.headers['x-admin-key'] !== db.settings.adminKey) return res.status(401).json({error:"Admin Key vul"}); next(); }
function cleanPh(p){ return (p||'').replace(/[^0-9]/g,'').slice(-11); }

app.get('/api/products', (req,res)=>res.json(db.products));
app.get('/api/settings', (req,res)=>res.json({chatNumber:db.settings.chatNumber, contactTime:db.settings.contactTime, bkashNumber:db.settings.bkashNumber||"01816314494", shopName:db.settings.shopName||'UNIQ SHOP', deliveryDhaka:db.settings.deliveryDhaka||60, deliveryOutside:db.settings.deliveryOutside||130, freeAbove:db.settings.freeAbove||2000, deliveryTime:db.settings.deliveryTime||'Dhaka te 24h, Baire 2-3 din', coupons:db.settings.coupons||[{code:'UNIQ10',off:10,active:true}]}));
app.get('/api/faqs', (req,res)=>res.json(db.faqs));

app.post('/api/signup', (req,res)=>{
  let {name, phone, password, address} = req.body;
  if(!name || !phone || !password) return res.json({ok:false, msg:'Nam, Phone, Password dao'});
  let ph = cleanPh(phone);
  if(db.users.find(u=>cleanPh(u.phone)===ph)) return res.json({ok:false, msg:'Ei number diye age account ase - Login koro'});
  let u = {id:Date.now(), name, phone:ph, password, address:address||'', date:new Date().toLocaleString('en-GB')};
  db.users.push(u); save();
  res.json({ok:true, user:{name:u.name, phone:u.phone, address:u.address}});
});
app.post('/api/login', (req,res)=>{
  let {phone, password} = req.body;
  let ph = cleanPh(phone);
  let u = db.users.find(x=>cleanPh(x.phone)===ph && x.password===password);
  if(!u) return res.json({ok:false, msg:'Phone / Password vul'});
  res.json({ok:true, user:{name:u.name, phone:u.phone, address:u.address}});
});
app.get('/api/my-orders', (req,res)=>{
  let ph = cleanPh(req.query.phone||'');
  if(!ph) return res.json([]);
  res.json(db.orders.filter(o=>cleanPh(o.phone)===ph));
});
app.get('/api/track-order', (req,res)=>{
  let ph = cleanPh(req.query.phone||'');
  let oid = (req.query.orderId||'').trim().toUpperCase();
  let o = db.orders.find(x=>cleanPh(x.phone)===ph && x.orderId.toUpperCase()===oid);
  if(!o) return res.json({ok:false, msg:'Order pawa jai nai - Phone / Order ID check koro'});
  res.json({ok:true, order:o});
});
app.get('/api/reviews', (req,res)=>{
  let pid = req.query.productId;
  let list = pid ? db.reviews.filter(r=>String(r.productId)===String(pid)) : db.reviews;
  res.json(list);
});
app.post('/api/reviews', (req,res)=>{
  let {name, phone, productId, product, rating, text, img} = req.body;
  if(!name || !text) return res.json({ok:false, msg:'Nam + Review dao'});
  let ph = cleanPh(phone||'');
  let verified = ph ? db.orders.some(o=>cleanPh(o.phone)===ph && (o.status==='Delivered'||o.status==='Approved'||o.status==='Confirm')) : false;
  let r = {id:Date.now(), name, phone:ph, productId:productId||'', product:product||'', rating:parseInt(rating)||5, text, img:img||'', verified, date:new Date().toLocaleString('en-GB')};
  db.reviews.unshift(r); save();
  res.json({ok:true, review:r});
});
app.post('/api/stock-alert', (req,res)=>{
  let {phone, productId, product} = req.body;
  if(!phone) return res.json({ok:false, msg:'Phone dao'});
  db.stockAlerts.unshift({id:Date.now(), phone:cleanPh(phone), productId, product:product||'', date:new Date().toLocaleString('en-GB')});
  save(); res.json({ok:true});
});
app.post('/api/orders', (req,res)=>{
  let ph = cleanPh(req.body.phone||'');
  let today = new Date().toDateString();
  let pendingToday = db.orders.filter(o=>cleanPh(o.phone)===ph && (o.status==='Pending'||o.status==='pending') && new Date(o.date).toDateString()===today).length;
  if(pendingToday>=3) return res.json({ok:false, msg:'Ei number theke ajke 3 ta Pending order ase - Age ager gula confirm koro / WhatsApp koro'});
  let o={...req.body, phone:ph, payment:req.body.payment||'COD', trxId:req.body.trxId||'', id:Date.now(), orderId:'UNIQ-'+Date.now().toString().slice(-6), status:'Pending', date:new Date().toLocaleString('en-GB')};
  db.orders.unshift(o); save(); res.json({ok:true, order:o});
});
app.post('/api/feedback', (req,res)=>{ db.feedbacks.unshift({...req.body, id:Date.now(), date:new Date().toLocaleString('en-GB')}); save(); res.json({ok:true}); });
app.post('/api/check-admin', (req,res)=>{ res.json({ok: req.body.key === db.settings.adminKey}); });

app.get('/api/admin/orders', checkAdmin, (req,res)=>res.json(db.orders));
app.get('/api/admin/feedbacks', checkAdmin, (req,res)=>res.json(db.feedbacks));
app.get('/api/admin/users', checkAdmin, (req,res)=>res.json(db.users));
app.get('/api/admin/reviews', checkAdmin, (req,res)=>res.json(db.reviews));
app.get('/api/admin/stock-alerts', checkAdmin, (req,res)=>res.json(db.stockAlerts));
app.delete('/api/admin/reviews/:id', checkAdmin, (req,res)=>{ db.reviews=db.reviews.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.delete('/api/admin/stock-alerts/:id', checkAdmin, (req,res)=>{ db.stockAlerts=db.stockAlerts.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.delete('/api/admin/users/:id', checkAdmin, (req,res)=>{ db.users=db.users.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.post('/api/admin/products', checkAdmin, (req,res)=>{
  let body = {...req.body};
  body.variants = normalizeVariants(body.variants, body.price);
  if(body.variants.length) body.stock = calcTotalStock(body);
  else body.stock = parseInt(req.body.stock)||50;
  let p={...body, id:Date.now()};
  db.products.unshift(p); save(); res.json({ok:true, product:p});
});
app.put('/api/admin/products/:id', checkAdmin, (req,res)=>{
  let i=db.products.findIndex(x=>x.id==req.params.id);
  if(i>=0){
    let updated = {...db.products[i], ...req.body};
    if(req.body.variants) updated.variants = normalizeVariants(req.body.variants, updated.price);
    updated.stock = calcTotalStock(updated);
    db.products[i]=updated; save();
  }
  res.json({ok:true});
});
app.delete('/api/admin/products/:id', checkAdmin, (req,res)=>{ db.products=db.products.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.put('/api/admin/orders/:id', checkAdmin, (req,res)=>{ let o=db.orders.find(x=>x.id==req.params.id); if(o) o.status=req.body.status; save(); res.json({ok:true}); });
app.delete('/api/admin/orders/:id', checkAdmin, (req,res)=>{ db.orders=db.orders.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.post('/api/admin/faqs', checkAdmin, (req,res)=>{ db.faqs.push(req.body); save(); res.json({ok:true}); });
app.delete('/api/admin/faqs/:idx', checkAdmin, (req,res)=>{ db.faqs.splice(req.params.idx,1); save(); res.json({ok:true}); });
app.delete('/api/admin/feedbacks/:id', checkAdmin, (req,res)=>{ db.feedbacks=db.feedbacks.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.post('/api/admin/settings', checkAdmin, (req,res)=>{ db.settings={...db.settings, ...req.body}; save(); res.json({ok:true, settings:db.settings}); });

app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public/shop.html')));
app.get('/admin', (req,res)=>res.sendFile(path.join(__dirname,'public/admin.html')));
app.get('/admin.html', (req,res)=>res.sendFile(path.join(__dirname,'public/admin.html')));
app.get('/index.html', (req,res)=>res.sendFile(path.join(__dirname,'public/shop.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log("UNIQ Running on "+PORT));
