const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json({limit:'20mb'}));
app.use(express.static('public'));

let DB_FILE = path.join(__dirname, 'data.json');
let db = { products:[], orders:[], feedbacks:[], faqs:[], settings:{chatNumber:"01816314494", contactTime:"প্রতিদিন সকাল ৯টা - রাত ৯টা", adminKey:"admin123"} };

// Load / Save - Render e file e thakbe
if(fs.existsSync(DB_FILE)){ try{ db = JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }catch(e){} }
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

// Public APIs - Shop
app.get('/api/products', (req,res)=>res.json(db.products));
app.get('/api/settings', (req,res)=>res.json({chatNumber:db.settings.chatNumber, contactTime:db.settings.contactTime}));
app.get('/api/faqs', (req,res)=>res.json(db.faqs));
app.post('/api/orders', (req,res)=>{ let o={...req.body, id:Date.now(), orderId:'UNIQ-'+Date.now().toString().slice(-6), status:'Pending', date:new Date().toLocaleString('en-GB')}; db.orders.unshift(o); save(); res.json({ok:true, order:o}); });
app.post('/api/feedback', (req,res)=>{ db.feedbacks.unshift({...req.body, id:Date.now(), date:new Date().toLocaleString('en-GB')}); save(); res.json({ok:true}); });
app.post('/api/check-admin', (req,res)=>{ res.json({ok: req.body.key === db.settings.adminKey}); });

// Admin APIs - Key lagbe
app.get('/api/admin/orders', checkAdmin, (req,res)=>res.json(db.orders));
app.get('/api/admin/feedbacks', checkAdmin, (req,res)=>res.json(db.feedbacks));
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