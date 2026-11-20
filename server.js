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
async function getTable(t){ const {data} = await supabase.from(t).select('*'); return data||[]; }
async function getSettings(){
  const {data} = await supabase.from('settings').select('*').eq('id',1).single();
  return data?.data || {};
}

// Frontend er jonno sob data eksathe - SHOP er jonno
app.get('/api/data', async (req,res)=>{
  try{
    const [products, orders, users, reviews, feedbacks, faqs, stock_alerts] = await Promise.all([
      getTable('products'), getTable('orders'), getTable('users'),
      getTable('reviews'), getTable('feedbacks'), getTable('faqs'), getTable('stock_alerts')
    ]);
    const settings = await getSettings();
    const p2 = products.map(p=>({
      id: p.id, name: p.name || 'Product', cat: p.cat || 'Fashion', price: p.price || 0, old: p.old || 0, stock: p.stock || 0,
      rating: p.rating || 4.8, badge: p.badge || '', emoji: p.emoji || '📦',
      desc: p.description || p.desc || '', images: p.images || [], variants: p.variants || []
    }));
    res.json({products:p2, orders, users, reviews, feedbacks, faqs, stock_alerts, settings});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Product Save / Update
app.post('/api/products', async (req,res)=>{
  const b = req.body;
  const row = {
    name:b.name, cat:b.cat||'Fashion', price:b.price||0, old:b.old||0,
    stock:b.stock||0, rating:b.rating||4.8, badge:b.badge||'', emoji:b.emoji||'📦',
    description:b.desc||b.description||'', images:b.images||[], variants:b.variants||[]
  };
  let r;
  if(b.id){ r = await supabase.from('products').update(row).eq('id',b.id).select().single(); }
  else{ r = await supabase.from('products').insert(row).select().single(); }
  res.json(r.data||{error:r.error});
});
app.delete('/api/products/:id', async (req,res)=>{
  await supabase.from('products').delete().eq('id',req.params.id);
  res.json({ok:true});
});

// Generic Save - orders, users, reviews, feedbacks, faqs, stock_alerts
app.post('/api/:table', async (req,res)=>{
  const t = req.params.table;
  if(['products','settings'].includes(t)) return res.status(400).json({error:'use specific'});
  const {data, error} = await supabase.from(t).insert(req.body).select().single();
  res.json(data||{error});
});
app.delete('/api/:table/:id', async (req,res)=>{
  await supabase.from(req.params.table).delete().eq('id',req.params.id);
  res.json({ok:true});
});
app.post('/api/settings', async (req,res)=>{
  const {data} = await supabase.from('settings').upsert({id:1, data:req.body}).select().single();
  res.json(data);
});

// --- Admin.html er jonno missing API ---

// 1. Admin Login Check
app.post('/api/check-admin', async (req,res)=>{
  const s = await getSettings();
  const key = s.adminKey || 'admin123';
  res.json({ok: req.body.key === key});
});

// 2. Admin ja chay - alada alada data
app.get('/api/products', async (req,res)=>{
  const products = await getTable('products');
  res.json(products.map(p=>({
    id:p.id, name:p.name, cat:p.cat||'Fashion', price:p.price||0, old:p.old||0, stock:p.stock||0,
    rating:p.rating||4.8, badge:p.badge||'', emoji:p.emoji||'📦',
    desc:p.description||'', images:p.images||[], variants:p.variants||[]
  })));
});
app.get('/api/faqs', async (req,res)=> res.json(await getTable('faqs')));
app.get('/api/settings', async (req,res)=> res.json(await getSettings()));

// 3. Admin Orders - Shop er format e
app.get('/api/admin/orders', async (req,res)=>{
  const orders = await getTable('orders');
  res.json(orders.map(o=>({
    id:o.id, orderId:o.orderid||('ORD-'+o.id), name:o.customer_name||o.name, phone:o.customer_phone||o.phone,
    address:o.shipping_address||o.address, items:o.items, total:o.total_amount||o.total||0,
    status:o.status||'Pending', date:o.created_at||o.date, payment:o.payment_method||o.payment, trxid:o.trxid
  })));
});
app.get('/api/admin/feedbacks', async (req,res)=> res.json(await getTable('feedbacks')));

// 4. Admin Product Save / Update / Delete
app.post('/api/admin/products', async (req,res)=>{
  const b=req.body;
  const row={name:b.name, cat:b.cat||'Fashion', price:b.price||0, old:b.old||0, stock:b.stock||0, rating:b.rating||4.8, badge:b.badge||'', emoji:b.emoji||'📦', description:b.desc||'', images:b.images||[], variants:b.variants||[]};
  const {data}=await supabase.from('products').insert(row).select().single();
  res.json(data||{ok:true});
});
app.put('/api/admin/products/:id', async (req,res)=>{
  const b=req.body; const row={};
  if(b.name) row.name=b.name; if(b.price!==undefined) row.price=b.price; if(b.stock!==undefined) row.stock=b.stock;
  if(b.cat) row.cat=b.cat; if(b.desc!==undefined) row.description=b.desc;
  await supabase.from('products').update(row).eq('id',req.params.id);
  res.json({ok:true});
});
app.delete('/api/admin/products/:id', async (req,res)=>{
  await supabase.from('products').delete().eq('id',req.params.id); res.json({ok:true});
});

// 5. Admin Order Update / Delete
app.put('/api/admin/orders/:id', async (req,res)=>{
  await supabase.from('orders').update({status:req.body.status}).eq('id',req.params.id);
  res.json({ok:true});
});
app.delete('/api/admin/orders/:id', async (req,res)=>{
  await supabase.from('orders').delete().eq('id',req.params.id); res.json({ok:true});
});
app.delete('/api/admin/feedbacks/:id', async (req,res)=>{
  await supabase.from('feedbacks').delete().eq('id',req.params.id); res.json({ok:true});
});

// 6. Admin Settings Save - ager settings er sathe merge
app.post('/api/admin/settings', async (req,res)=>{
  const old = await getSettings();
  const merged = {...old, ...req.body};
  const {data} = await supabase.from('settings').upsert({id:1, data:merged}).select().single();
  res.json(data);
});

// --- Website Serve - Shop Alada, Admin Alada --- 
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

app.get('/debug', (req,res)=> {
  res.json({ 
    files: fs.readdirSync(__dirname), 
    has_index_root: fs.existsSync(path.join(__dirname,'index.html')),
    has_admin: fs.existsSync(path.join(__dirname,'admin.html'))
  });
});

app.get('/admin', (req,res)=> res.sendFile(getAdminPath()));
app.get('/admin.html', (req,res)=> res.sendFile(getAdminPath()));
app.get('/', (req,res)=> res.sendFile(getIndexPath()));
app.get('*', (req,res)=> {
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'Not Found'});
  res.sendFile(getIndexPath());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Running on '+PORT));
