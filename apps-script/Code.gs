const SHEET_NAME = 'Transactions';
const SECRET = 'CHANGE_THIS_SECRET';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.token !== SECRET) return json({ok:false, error:'unauthorized'});
    const t = body.transaction || {};
    const sheet = getSheet();
    ensureHeader(sheet);
    const id = String(t.id || '');
    if (!id) return json({ok:false,error:'missing id'});
    const lastRow = sheet.getLastRow();
    const ids = lastRow >= 2 ? sheet.getRange(2,1,lastRow-1,1).getValues().flat().map(String) : [];
    if (ids.includes(id)) return json({ok:true,duplicate:true});
    sheet.appendRow([
      id,
      new Date(),
      t.transactionDate || '',
      t.gateway || '',
      t.accountNumber || '',
      Number(t.amountIn || t.amount || 0),
      t.code || '',
      t.content || '',
      t.referenceNumber || '',
      JSON.stringify(t)
    ]);
    return json({ok:true});
  } catch(err) { return json({ok:false,error:String(err)}); }
}

function doGet(e) {
  if ((e.parameter.token || '') !== SECRET) return json({ok:false,error:'unauthorized'});
  const sheet=getSheet(); ensureHeader(sheet);
  const lastRow=sheet.getLastRow();
  if(lastRow<2) return json({ok:true,items:[],latest:null});
  const rows=sheet.getRange(Math.max(2,lastRow-30),1,Math.min(30,lastRow-1),10).getValues();
  const items=rows.reverse().map(r=>({id:String(r[0]),receivedAt:r[1],transactionDate:r[2],gateway:r[3],account:r[4],amount:Number(r[5]||0),code:r[6],content:String(r[7]||''),reference:r[8],name:extractName(String(r[7]||''))}));
  return json({ok:true,items,latest:items[0]||null});
}
function extractName(content){const m=content.match(/^\s*([A-Za-zÀ-ỹĐđ0-9_.-]{1,30})\b/);return m?m[1]:'Một người bạn'}
function getSheet(){const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(SHEET_NAME);if(!sh)sh=ss.insertSheet(SHEET_NAME);return sh}
function ensureHeader(sh){if(sh.getLastRow()===0)sh.appendRow(['transaction_id','received_at','transaction_date','gateway','account_number','amount_in','code','content','reference_number','raw_json'])}
function json(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
