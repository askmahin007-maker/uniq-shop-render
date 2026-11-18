const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json({limit:'20mb'}));
app.use(express.static('public'));

let DB_FILE = path.join(__dirname, 'data.json');
let db = { products:[], orders:[], feedbacks:[], faqs:[], settings:{chatNumber:"01816314494", contactTime:"প্রতিদিন সকাল ৯টা - রাত ৯টা", adminKey:"admin123", bkashNumber:"01816314494"}, users:[], reviews:[], stockAlerts:[] };

// Load / Save - Render e file e thakbe
if(fs.existsSync(DB_FILE)){ try{ db = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }catch(e){} }
if(!db.users) db.users=[];
if(!db.reviews) db.reviews=[];
if(!db.stockAlerts) db.stockAlerts=[];
if(!db.settings.bkashNumber) db.settings.bkashNumber="01816314494";
if(!db.products.length){
  db.products=[
    {id:1,name:"Panjabi - Premium Cotton",cat:"Fashion",price:1300,old:1500,stock:50,rating:4.8,badge:"Best Seller",isNew:false,emoji:"👕",desc:"Premium cotton panjabi. Aramdayok, original.",highlights:["100% অরিজিনাল পণ্য","৭ দিনের রিটার্ন সুবিধা"],images:["https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800"],variants:[]},
    {id:2,name:"Summer Cotton T-Shirt",cat:"Summer",price:488,old:650,stock:45,rating:4.8,badge:"",isNew:false,emoji:"👕",desc:"Summer er jonno best cotton t-shirt.",highlights:["100% Cotton"],images:["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800"],variants:[{name:"L - Red",price:488,stock:10},{name:"XL - Black",price:520,stock:8}]},
    {id:3,name:"Winter Hoodie Premium",cat:"Winter",price:1150,old:1450,stock:25,rating:4.8,badge:"",isNew:false,emoji:"🧥",desc:"Warm premium hoodie.",highlights:["Warm & Soft"],images:["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800"],variants:[]},
    {id:4,name:"Wireless Earbuds Pro",cat:"Electronics",price:1450,old:1850,stock:20,rating:4.9,badge:"Best Seller",isNew:false,emoji:"🎧",desc:"Original earbuds.",highlights:["Bluetooth 5.3"],images:["https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800"],variants:[]},
    {id:5,name:"নোটবুক ও পেন সেট",cat:"Books",price:349,old:449,stock:90,rating:4.8,badge:"",isNew:false,emoji:"📓",desc:"Boi o stationery set.",highlights:["Premium Quality"],images:["https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800"],variants:[]},
    {id:6,name:"বেস্ট সেলার নভেল সেট",cat:"Books",price:699,old:899,stock:34,rating:4.7,badge:"New",isNew:true,emoji:"📚",desc:"Bestseller novel.",highlights:["Bestseller"],images:["https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800"],variants:[]}
  ];
  db.faqs=[{q:"Delivery koto din e pabo?",a:"Dhaka te 1-2 din, Dhaka-r baire 2-4 din."},{q:"Cash on Delivery ase?",a:"Ha! Pura Bangladesh e Cash on Delivery."},{q:"Return kora jabe?",a:"Ha, 7 diner vitore problem thakle return kora jabe."},{q:"bKash e payment kora jabe?",a:"Ha, bKash / Nagad / Cash - 3 tai hobe."}];
  save();
}
function save(){ fs.writeFileSync(DB_FILE, JSON.stringify(db)); }
function checkAdmin(req,res,next){ if(req.headers['x-admin-key'] !== db.settings.adminKey) return res.status(401).json({error:"Admin Key vul"}); next(); }
function cleanPh(p){ return (p||'').replace(/[^0-9]/g,'').slice(-11); }

// Public APIs - Shop
app.get('/api/products', (req,res)=>res.json(db.products));
app.get('/api/settings', (req,res)=>res.json({chatNumber:db.settings.chatNumber, contactTime:db.settings.contactTime, bkashNumber:db.settings.bkashNumber||"01816314494"}));
app.get('/api/faqs', (req,res)=>res.json(db.faqs));

// --- USER: Sign Up / Login (Phone + Password) ---
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

// --- USER: My Orders History + Track Order (No Login needed for track) ---
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

// --- USER: Reviews (Verified Buyer = Delivered order ase) ---
app.get('/api/reviews', (req,res)=>{
  let pid = req.query.productId;
  let list = pid ? db.reviews.filter(r=>String(r.productId)===String(pid)) : db.reviews;
  res.json(list);
});
app.post('/api/reviews', (req,res)=>{
  let {name, phone, productId, product, rating, text, img} = req.body;
  if(!name || !text) return res.json({ok:false, msg:'Nam + Review dao'});
  let ph = cleanPh(phone||'');
  // Verified = oi phone e kono Delivered / Approved order ase
  let verified = ph ? db.orders.some(o=>cleanPh(o.phone)===ph && (o.status==='Delivered'||o.status==='Approved'||o.status==='Confirm')) : false;
  let r = {id:Date.now(), name, phone:ph, productId:productId||'', product:product||'', rating:parseInt(rating)||5, text, img:img||'', verified, date:new Date().toLocaleString('en-GB')};
  db.reviews.unshift(r); save();
  res.json({ok:true, review:r});
});

// --- USER: Stock Alert ---
app.post('/api/stock-alert', (req,res)=>{
  let {phone, productId, product} = req.body;
  if(!phone) return res.json({ok:false, msg:'Phone dao'});
  db.stockAlerts.unshift({id:Date.now(), phone:cleanPh(phone), productId, product:product||'', date:new Date().toLocaleString('en-GB')});
  save(); res.json({ok:true});
});

// --- USER: Order (Fake Block + bKash save) ---
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

// Admin APIs - Key lagbe
app.get('/api/admin/orders', checkAdmin, (req,res)=>res.json(db.orders));
app.get('/api/admin/feedbacks', checkAdmin, (req,res)=>res.json(db.feedbacks));
app.get('/api/admin/users', checkAdmin, (req,res)=>res.json(db.users));
app.get('/api/admin/reviews', checkAdmin, (req,res)=>res.json(db.reviews));
app.get('/api/admin/stock-alerts', checkAdmin, (req,res)=>res.json(db.stockAlerts));
app.delete('/api/admin/reviews/:id', checkAdmin, (req,res)=>{ db.reviews=db.reviews.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.delete('/api/admin/stock-alerts/:id', checkAdmin, (req,res)=>{ db.stockAlerts=db.stockAlerts.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.delete('/api/admin/users/:id', checkAdmin, (req,res)=>{ db.users=db.users.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.post('/api/admin/products', checkAdmin, (req,res)=>{ let p={...req.body, id:Date.now()}; db.products.unshift(p); save(); res.json({ok:true, product:p}); });
app.put('/api/admin/products/:id', checkAdmin, (req,res)=>{ let i=db.products.findIndex(x=>x.id==req.params.id); if(i>=0){ db.products[i]={...db.products[i], ...req.body}; save(); } res.json({ok:true}); });
app.delete('/api/admin/products/:id', checkAdmin, (req,res)=>{ db.products=db.products.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.put('/api/admin/orders/:id', checkAdmin, (req,res)=>{ let o=db.orders.find(x=>x.id==req.params.id); if(o) o.status=req.body.status; save(); res.json({ok:true}); });
app.delete('/api/admin/orders/:id', checkAdmin, (req,res)=>{ db.orders=db.orders.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.post('/api/admin/faqs', checkAdmin, (req,res)=>{ db.faqs.push(req.body); save(); res.json({ok:true}); });
app.delete('/api/admin/faqs/:idx', checkAdmin, (req,res)=>{ db.faqs.splice(req.params.idx,1); save(); res.json({ok:true}); });
app.delete('/api/admin/feedbacks/:id', checkAdmin, (req,res)=>{ db.feedbacks=db.feedbacks.filter(x=>x.id!=req.params.id); save(); res.json({ok:true}); });
app.post('/api/admin/settings', checkAdmin, (req,res)=>{ db.settings={...db.settings, ...req.body}; save(); res.json({ok:true, settings:db.settings}); });

// 2 ta Site
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public/shop.html')));
app.get('/admin', (req,res)=>res.sendFile(path.join(__dirname,'public/admin.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log("UNIQ Running on "+PORT));
