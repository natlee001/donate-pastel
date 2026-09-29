const TRANSACTION_SHEET = 'DONATE - GIAO DỊCH';
const PENDING_SHEET = 'DONATE - CHỜ THANH TOÁN';

// Must exactly match Vercel SHEETS_SECRET.
const SECRET = 'PASTE_SHEETS_SECRET_HERE';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'missing_body' });
    }

    const body = JSON.parse(e.postData.contents);

    if (body.token !== SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }

    if (body.action === 'create') {
      return createDonation(body.donation || {});
    }

    return processSePayTransaction(body.transaction || {});
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};

    if (!params.token) {
      return json({
        ok: true,
        service: 'Donate API',
        status: 'running'
      });
    }

    if (params.token !== SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }

    if (params.action === 'status') {
      return getDonationStatus(
        String(params.code || '').trim().toUpperCase()
      );
    }

    return getLatestDonations();
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

function createDonation(donation) {
  const code = String(donation.code || '').trim().toUpperCase();
  const name = String(donation.name || '').trim().slice(0, 40);
  const message = String(donation.message || '').trim().slice(0, 2000);
  const expectedAmount = Number(donation.expectedAmount || 0);

  if (!/^DN[A-Z0-9]{6}$/.test(code)) {
    return json({ ok: false, error: 'invalid_code' });
  }
  if (!name) return json({ ok: false, error: 'missing_name' });
  if (!message) return json({ ok: false, error: 'missing_message' });
  if (!Number.isInteger(expectedAmount) || expectedAmount < 1000) {
    return json({ ok: false, error: 'invalid_amount' });
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const sheet = getPendingSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      const codes = sheet
        .getRange(2, 1, lastRow - 1, 1)
        .getValues()
        .flat()
        .map(v => String(v).trim().toUpperCase());

      if (codes.includes(code)) {
        return json({ ok: false, error: 'duplicate_code' });
      }
    }

    sheet.appendRow([
      code,
      name,
      message,
      expectedAmount,
      new Date(),
      'PENDING',
      '',
      '',
      '',
      '',
      ''
    ]);

    return json({ ok: true, created: true, code: code });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function processSePayTransaction(t) {
  const id = (
    t.id !== undefined && t.id !== null
  ) ? String(t.id) : '';

  if (!id) {
    return json({ ok: false, error: 'missing_transaction_id' });
  }

  const sheet = getTransactionSheet();

  if (!transactionExists(sheet, id)) {
    sheet.appendRow([
      id,
      new Date(),
      t.transactionDate || '',
      t.content || '',
      Number(t.transferAmount || 0),
      t.gateway || '',
      t.code || ''
    ]);
  }

  const transferType = String(t.transferType || '').toLowerCase();
  if (transferType && transferType !== 'in') {
    return json({
      ok: true,
      saved: true,
      donationMatched: false,
      reason: 'not_incoming'
    });
  }

  const code = String(t.code || '').trim().toUpperCase();

  if (!/^DN[A-Z0-9]{6}$/.test(code)) {
    return json({
      ok: true,
      saved: true,
      donationMatched: false,
      reason: 'no_donation_code'
    });
  }

  const pending = getPendingSheet();
  const row = findPendingRow(pending, code);

  if (!row) {
    return json({
      ok: true,
      saved: true,
      donationMatched: false,
      reason: 'code_not_found',
      code: code
    });
  }

  const status = String(
    pending.getRange(row, 6).getValue() || ''
  ).trim().toUpperCase();

  if (status === 'PAID') {
    return json({
      ok: true,
      saved: true,
      donationMatched: true,
      duplicateDonation: true,
      code: code
    });
  }

  const actualAmount = Number(t.transferAmount || 0);

  pending.getRange(row, 6, 1, 6).setValues([[
    'PAID',
    id,
    actualAmount,
    new Date(),
    t.gateway || '',
    t.referenceCode || ''
  ]]);

  return json({
    ok: true,
    saved: true,
    donationMatched: true,
    code: code,
    transactionId: id
  });
}

function getDonationStatus(code) {
  if (!/^DN[A-Z0-9]{6}$/.test(code)) {
    return json({ ok: false, error: 'invalid_code' });
  }

  const sheet = getPendingSheet();
  const row = findPendingRow(sheet, code);

  if (!row) {
    return json({ ok: false, error: 'not_found' });
  }

  const values = sheet.getRange(row, 1, 1, 11).getValues()[0];
  const paid = String(values[5] || '').toUpperCase() === 'PAID';

  return json({
    ok: true,
    code: String(values[0]),
    name: String(values[1]),
    message: String(values[2]),
    expectedAmount: Number(values[3] || 0),
    status: paid ? 'PAID' : 'PENDING',
    transactionId: String(values[6] || ''),
    actualAmount: Number(values[7] || 0),
    paidAt: values[8] || '',
    gateway: String(values[9] || ''),
    referenceCode: String(values[10] || '')
  });
}

function getLatestDonations() {
  const sheet = getPendingSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return json({ ok: true, items: [], latest: null });
  }

  const rowCount = lastRow - 1;
  const startRow = Math.max(2, lastRow - 499);

  const rows = sheet
    .getRange(startRow, 1, Math.min(500, rowCount), 11)
    .getValues();

  const items = rows
    .filter(r => String(r[5] || '').toUpperCase() === 'PAID')
    .map(r => ({
      code: String(r[0]),
      id: String(r[6] || ''),
      name: String(r[1] || 'Một người bạn'),
      content: String(r[2] || ''),
      amount: Number(r[7] || r[3] || 0),
      expectedAmount: Number(r[3] || 0),
      paidAt: r[8] || '',
      gateway: String(r[9] || ''),
      reference: String(r[10] || '')
    }))
    .sort((a, b) => {
      const ad = new Date(a.paidAt).getTime() || 0;
      const bd = new Date(b.paidAt).getTime() || 0;
      return bd - ad;
    });

  return json({
    ok: true,
    items: items.slice(0, 30),
    latest: items[0] || null
  });
}

function getTransactionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRANSACTION_SHEET);

  if (!sheet) sheet = ss.insertSheet(TRANSACTION_SHEET);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'ID',
      'Thời gian nhận',
      'Thời gian giao dịch',
      'Nội dung',
      'Số tiền',
      'Ngân hàng',
      'Mã giao dịch'
    ]);
  }

  return sheet;
}

function getPendingSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PENDING_SHEET);

  if (!sheet) sheet = ss.insertSheet(PENDING_SHEET);

  const headers = [
    'Code',
    'Người gửi',
    'Lời nhắn',
    'Số tiền dự kiến',
    'Thời gian tạo',
    'Trạng thái',
    'ID giao dịch',
    'Số tiền thực tế',
    'Thời gian thanh toán',
    'Ngân hàng',
    'Mã tham chiếu'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // Older setup may already have columns A:G.
    // Fill/repair headers A:K without deleting existing data.
    const existingWidth = Math.max(sheet.getLastColumn(), headers.length);
    const current = sheet.getRange(1, 1, 1, existingWidth).getValues()[0];

    for (let i = 0; i < headers.length; i++) {
      if (!String(current[i] || '').trim()) {
        current[i] = headers[i];
      }
    }

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([current.slice(0, headers.length)]);
  }

  return sheet;
}

function findPendingRow(sheet, code) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues();

  const target = String(code).trim().toUpperCase();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toUpperCase() === target) {
      return i + 2;
    }
  }

  return null;
}

function transactionExists(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  return sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(String)
    .includes(String(id));
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
