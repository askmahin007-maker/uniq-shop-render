const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({limit:'10mb'}));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// --- Helpers ---
async function getTable(t){ const {data} = await supabase.from(t).select('*').order('id',{ascending:false}); return data||[]; }
async function getSettings(){
  const {data} = await supabase.from('settings').select('*').eq('id',1).single();
  return data?.data || {};
}
async function saveSettings(newData){
  const old = await getSettings();
  const merged = {...old, ...newData};
  // === PASSWORD FIX - je kono nam e aslei adminKey te save hobe ===
  if(newData.adminKey) merged.adminKey = newData.adminKey;
  if(newData.adminPass) merged.adminKey = newData.adminPass;
  if(newData.password) merged.adminKey = newData.password;
  if(newData.adminPassword) merged.adminKey = newData.adminPassword;
  // sob nam e same rakhi jate pore konotai miss na hoy
  if(merged.adminKey){ merged.adminPass = merged.adminKey; merged.password = merged.adminKey; }
  const {data} = await supabase.from('settings').upsert({id:1, data:merged}).select().single();
  return merged;
}
function cleanPhone(p){ let c=String(p||'').replace(/[^0-9]/g,''); return c; }
function mapProduct(p){ return { id:p.id, name:p.name||'Product', cat:p.cat||'Fashion', price:p.price||0, old:p.old||0, stock:p.stock||0, rating:p.rating||4.8, badge:p.badge||'', emoji:p.emoji||'📦', desc:p.description||p.desc||'', description:p.description||p.desc||'', images:p.images||[], variants:p.variants||[], loc:p.loc||p.location||'Dhaka', location:p.loc||p.location||'Dhaka', cond:p.cond||p.condition||'New', condition:p.cond||p.condition||'New' }; }
function mapOrder(o){ return { id:o.id, orderId:o.orderid||o.orderId||('ORD-'+o.id), name:o.customer_name||o.name||'', phone:o.customer_phone||o.phone||'', address:o.shipping_address||o.address||'', items:o.items||'', total:o.total_amount||o.total||0, status:o.status||'Pending', date:o.created_at||o.date||'', payment:o.payment_method||o.payment||'COD', trxid:o.trxid||o.trxId||'', trxId:o.trxid||o.trxId||'' }; }

// --- SHOP DATA ---
app.get('/api/data', async (req,res)=>{
  try{
    const [products, orders, users, reviews, feedbacks, faqs, stock_alerts] = await Promise.all([
      getTable('products'), getTable('orders'), getTable('users'),
      getTable('reviews'), getTable('feedbacks'), getTable('faqs'), getTable('stock_alerts')
    ]);
    const settings = await getSettings();
    res.json({products:products.map(mapProduct), orders:orders.map(mapOrder), users, reviews, feedbacks, faqs, stock_alerts, settings});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// --- SHOP: Products ---
app.get('/api/products', async (req,res)=>{ const p=await getTable('products'); res.json(p.map(mapProduct)); });
app.post('/api/products', async (req,res)=>{
  const b = req.body;
  const row = { name:b.name, cat:b.cat||'Fashion', price:b.price||0, old:b.old||0, stock:b.stock||0, rating:b.rating||4.8, badge:b.badge||'', emoji:b.emoji||'📦', description:b.desc||b.description||'', images:b.images||[], variants:b.variants||[], loc:b.loc||b.location||'Dhaka', cond:b.cond||b.condition||'New' };
  let r;
  if(b.id){ r = await supabase.from('products').update(row).eq('id',b.id).select().single(); }
  else{ r = await supabase.from('products').insert(row).select().single(); }
  res.json(r.data||{error:r.error});
});
app.delete('/api/products/:id', async (req,res)=>{ await supabase.from('products').delete().eq('id',req.params.id); res.json({ok:true}); });

// --- SHOP: FAQs / Settings / Reviews GET ---
app.get('/api/faqs', async (req,res)=> res.json(await getTable('faqs')));
app.get('/api/settings', async (req,res)=> res.json(await getSettings()));
app.get('/api/reviews', async (req,res)=> res.json(await getTable('reviews')));

// --- SHOP: ORDERS ---
app.post('/api/orders', async (req,res)=>{
  try{
    const b=req.body;
    const orderId='UNIQ-'+Math.random().toString(36).slice(2,8).toUpperCase();
    const row={ orderid:orderId, customer_name:b.name, customer_phone:cleanPhone(b.phone), shipping_address:b.address, items:b.items, total_amount:Number(b.total)||0, total:Number(b.total)||0, status:'Pending', payment_method:b.payment||'COD', payment:b.payment||'COD', trxid:b.trxId||b.trxid||'', name:b.name, phone:cleanPhone(b.phone), address:b.address };
    const {data,error}=await supabase.from('orders').insert(row).select().single();
    if(error) return res.json({ok:false,msg:error.message});
    res.json({ok:true, order:mapOrder(data)});
  }catch(e){ res.json({ok:false,msg:e.message}); }
});

// --- SHOP: Reviews POST ---
app.post('/api/reviews', async (req,res)=>{
  try{
    const b=req.body;
    const row={ name:b.name, phone:b.phone||'', productId:b.productId||'', product_id:b.productId||'', product:b.product||'', rating:Number(b.rating)||5, text:b.text||b.comment||'', img:b.img||'', created_at:new Date().toISOString() };
    const {data,error}=await supabase.from('reviews').insert(row).select().single();
    if(error) return res.json({ok:false,msg:error.message});
    res.json({ok:true, review:data});
  }catch(e){ res.json({ok:false,msg:e.message}); }
});

// --- SHOP: Signup / Login / My Orders / Track ---
app.post('/api/signup', async (req,res)=>{
  try{
    const b=req.body;
    const {data:ex}=await supabase.from('users').select('*').eq('phone',cleanPhone(b.phone)).single();
    if(ex) return res.json({ok:false,msg:'Ei number diye account ase! Login koro'});
    const row={ name:b.name, phone:cleanPhone(b.phone), password:b.password, address:b.address||'' };
    const {data,error}=await supabase.from('users').insert(row).select().single();
    if(error) return res.json({ok:false,msg:error.message});
    res.json({ok:true, user:{id:data.id,name:data.name,phone:data.phone,address:data.address}});
  }catch(e){ res.json({ok:false,msg:e.message}); }
});
app.post('/api/login', async (req,res)=>{
  try{
    const {data}=await supabase.from('users').select('*').eq('phone',cleanPhone(req.body.phone)).eq('password',req.body.password).single();
    if(!data) return res.json({ok:false,msg:'Phone / Password vul!'});
    res.json({ok:true, user:{id:data.id,name:data.name,phone:data.phone,address:data.address}});
  }catch(e){ res.json({ok:false,msg:'Phone / Password vul!'}); }
});
app.get('/api/my-orders', async (req,res)=>{
  const phone=cleanPhone(req.query.phone||'');
  const orders=await getTable('orders');
  const mine=orders.filter(o=>cleanPhone(o.customer_phone||o.phone||'')===phone || (o.customer_phone||o.phone||'').includes(phone.slice(-10)));
  res.json(mine.map(mapOrder));
});
app.get('/api/track-order', async (req,res)=>{
  const phone=cleanPhone(req.query.phone||''); const oid=String(req.query.orderId||'').toUpperCase();
  const orders=await getTable('orders');
  const o=orders.find(x=>(x.orderid||'').toUpperCase()===oid && cleanPhone(x.customer_phone||x.phone||'').includes(phone.slice(-10)));
  if(!o) return res.json({ok:false,msg:'Order pawa jay nai! Phone + Order ID thik dao'});
  res.json({ok:true, order:mapOrder(o)});
});

// --- SHOP: Feedback / Stock Alert ---
app.post('/api/feedback', async (req,res)=>{
  const b=req.body;
  const {data}=await supabase.from('feedbacks').insert({name:b.name||'Guest', text:b.text||'', rating:5}).select().single();
  res.json({ok:true, feedback:data});
});
app.post('/api/feedbacks', async (req,res)=>{
  const {data}=await supabase.from('feedbacks').insert(req.body).select().single();
  res.json({ok:true, feedback:data});
});
app.post('/api/stock-alert', async (req,res)=>{
  const b=req.body;
  const {data}=await supabase.from('stock_alerts').insert({phone:cleanPhone(b.phone), productId:b.productId||'', product:b.product||''}).select().single();
  res.json({ok:true, alert:data});
});

// --- Generic ---
app.post('/api/:table', async (req,res)=>{
  const t = req.params.table;
  if(['products','settings','orders','reviews','feedback','feedbacks','signup','login'].includes(t)) return res.status(400).json({error:'use specific'});
  const {data, error} = await supabase.from(t).insert(req.body).select().single();
  res.json(data||{error});
});
app.delete('/api/:table/:id', async (req,res)=>{
  await supabase.from(req.params.table).delete().eq('id',req.params.id);
  res.json({ok:true});
});
app.post('/api/settings', async (req,res)=>{
  const merged = await saveSettings(req.body);
  res.json(merged);
});

// --- ADMIN - FIXED ---
app.post('/api/check-admin', async (req,res)=>{
  const s = await getSettings();
  // FIX: sob nam theke password khujbe
  const saved = s.adminKey || s.adminPass || s.password || s.adminPassword || 'admin123';
  const incoming = req.body.key || req.body.adminKey || req.body.adminPass || req.body.password || '';
  res.json({ok: String(incoming).trim() === String(saved).trim()});
});
app.get('/api/admin/orders', async (req,res)=>{ const o=await getTable('orders'); res.json(o.map(mapOrder)); });
app.get('/api/admin/feedbacks', async (req,res)=> res.json(await getTable('feedbacks')));
app.post('/api/admin/products', async (req,res)=>{
  const b=req.body;
  const row={name:b.name, cat:b.cat||'Fashion', price:b.price||0, old:b.old||0, stock:b.stock||0, rating:b.rating||4.8, badge:b.badge||'', emoji:b.emoji||'📦', description:b.desc||b.description||'', images:b.images||[], variants:b.variants||[], loc:b.loc||b.location||'Dhaka', cond:b.cond||b.condition||'New'};
  const {data}=await supabase.from('products').insert(row).select().single();
  res.json(data||{ok:true});
});
// FIXED: Product Edit e sob field update hobe - Variant / Image / Badge harabe na!
app.put('/api/admin/products/:id', async (req,res)=>{
  const b=req.body; const row={};
  if(b.name!==undefined) row.name=b.name;
  if(b.price!==undefined) row.price=b.price;
  if(b.old!==undefined) row.old=b.old;
  if(b.stock!==undefined) row.stock=b.stock;
  if(b.cat!==undefined) row.cat=b.cat;
  if(b.badge!==undefined) row.badge=b.badge;
  if(b.emoji!==undefined) row.emoji=b.emoji;
  if(b.desc!==undefined || b.description!==undefined) row.description=b.desc||b.description;
  if(b.images!==undefined) row.images=b.images;
  if(b.variants!==undefined) row.variants=b.variants;
  if(b.loc!==undefined || b.location!==undefined) row.loc=b.loc||b.location;
  if(b.cond!==undefined || b.condition!==undefined) row.cond=b.cond||b.condition;
  if(b.rating!==undefined) row.rating=b.rating;
  const {data,error}=await supabase.from('products').update(row).eq('id',req.params.id).select().single();
  if(error) return res.json({ok:false,msg:error.message});
  res.json({ok:true, data});
});
app.delete('/api/admin/products/:id', async (req,res)=>{ await supabase.from('products').delete().eq('id',req.params.id); res.json({ok:true}); });
app.put('/api/admin/orders/:id', async (req,res)=>{ await supabase.from('orders').update({status:req.body.status}).eq('id',req.params.id); res.json({ok:true}); });
app.delete('/api/admin/orders/:id', async (req,res)=>{ await supabase.from('orders').delete().eq('id',req.params.id); res.json({ok:true}); });
app.delete('/api/admin/feedbacks/:id', async (req,res)=>{ await supabase.from('feedbacks').delete().eq('id',req.params.id); res.json({ok:true}); });
// FIXED: Settings e Password + sob kichu thik moto merge hobe
app.post('/api/admin/settings', async (req,res)=>{
  const merged = await saveSettings(req.body);
  res.json({ok:true, data:merged});
});

// --- Website Serve ---
function getIndexPath(){
  if(fs.existsSync(path.join(__dirname,'index.html'))) return path.join(__dirname,'index.html');
  if(fs.existsSync(path.join(__dirname,'public','index.html'))) return path.join(__dirname,'public','index.html');
  return path.join(__dirname,'index.html');
}
function getAdminPath(){
  if(fs.existsSync(path.join(__dirname,'admin.html'))) return path.join(__dirname,'admin.html');
  if(fs.existsSync(path.join(__dirname,'public','admin.html'))) return path.join(__dirname,'public','admin.html');
  return path.join(__dirname,'admin.html');
}
app.get('/debug', (req,res)=> res.json({ files: fs.readdirSync(__dirname), has_index_root: fs.existsSync(path.join(__dirname,'index.html')), has_admin: fs.existsSync(path.join(__dirname,'admin.html')) }));
app.get('/admin', (req,res)=> res.sendFile(getAdminPath()));
app.get('/admin.html', (req,res)=> res.sendFile(getAdminPath()));
app.get('/', (req,res)=> res.sendFile(getIndexPath()));
app.get('*', (req,res)=> {
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'Not Found'});
  res.sendFile(getIndexPath());
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Running on '+PORT));
