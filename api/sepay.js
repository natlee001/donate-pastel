export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false});
  const expected=process.env.SEPAY_API_KEY;
  const auth=req.headers.authorization||'';
  if(!expected || auth!==`Apikey ${expected}`) return res.status(401).json({ok:false});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    const r=await fetch(process.env.SHEETS_WEBAPP_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:process.env.SHEETS_SECRET,transaction:body})});
    if(!r.ok) throw new Error('Sheets gateway failed');
    return res.status(200).json({success:true});
  }catch(e){console.error(e);return res.status(500).json({success:false,message:e.message});}
}
