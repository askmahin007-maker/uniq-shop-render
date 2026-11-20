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

// Frontend er jonno sob data eksathe
app.get('/api/data', async (req,res)=>{
  try{
    const [products, orders, users, reviews, feedbacks, faqs, stock_alerts] = await Promise.all([
      getTable('products'), getTable('orders'), getTable('users'),
      getTable('reviews'), getTable('feedbacks'), getTable('faqs'), getTable('stock_alerts')
    ]);
    const settings = await getSettings();
    // products ke ager format e firano
    const p2 = products.map(p=>({
      id: p.id, name: p.name, cat: p.cat, price: p.price, old: p.old, stock: p.stock,
      rating: p.rating, badge: p.badge, emoji: p.emoji,
      desc: p.description||'', images: p.images||[], variants: p.variants||[]
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

// --- Website Serve --- 
// index.html koi ase khuje ber korbe
function getIndexPath(){
  if(fs.existsSync(path.join(__dirname,'index.html'))) return path.join(__dirname,'index.html');
  if(fs.existsSync(path.join(__dirname,'public','index.html'))) return path.join(__dirname,'public','index.html');
  return path.join(__dirname,'index.html');
}

app.get('/debug', (req,res)=> {
  res.json({ 
    files: fs.readdirSync(__dirname), 
    has_index_root: fs.existsSync(path.join(__dirname,'index.html')),
    has_index_public: fs.existsSync(path.join(__dirname,'public','index.html'))
  });
});

app.get('/admin', (req,res)=> res.sendFile(getIndexPath()));
app.get('/', (req,res)=> res.sendFile(getIndexPath()));
app.get('*', (req,res)=> {
  // api hole 404, baki sob website e pathao
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'Not Found'});
  res.sendFile(getIndexPath());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Running on '+PORT));
