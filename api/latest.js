export default async function handler(req,res){
  try{const r=await fetch(process.env.SHEETS_WEBAPP_URL+'?token='+encodeURIComponent(process.env.SHEETS_SECRET)+'&action=latest',{cache:'no-store'});const text=await r.text();res.setHeader('Cache-Control','no-store');return res.status(r.status).send(text)}catch(e){return res.status(500).json({ok:false,message:e.message})}}
