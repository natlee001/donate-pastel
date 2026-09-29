# Donate pastel tím + SePay + Google Sheets + Vercel

Kiến trúc:
SePay -> Vercel /api/sepay -> Google Apps Script -> Google Sheets
OBS Browser Source -> /overlay.html -> Vercel /api/latest -> Google Apps Script -> Google Sheets

## 1. Google Sheet
Tạo 1 Google Sheet mới. Vào Extensions > Apps Script. Dán nội dung apps-script/Code.gs.
Đổi `CHANGE_THIS_SECRET` thành một chuỗi bí mật dài.
Deploy > New deployment > Web app > Execute as Me > Who has access: Anyone.
Copy URL `/exec`.

## 2. Vercel
Upload project này lên GitHub rồi Import vào Vercel.
Tạo Environment Variables:
- SEPAY_API_KEY = API key bạn tạo trong SePay webhook
- SHEETS_WEBAPP_URL = URL Apps Script /exec
- SHEETS_SECRET = giống SECRET trong Code.gs

Redeploy.

## 3. SePay
Tạo webhook, event `Tiền vào`, URL:
https://TEN-MIEN-VERCEL-CUA-BAN.vercel.app/api/sepay
Chọn API Key và nhập đúng key. SePay yêu cầu endpoint production HTTPS; webhook hỗ trợ test-send. Nên bật retry và chống trùng theo transaction id.

## 4. Thông tin ngân hàng + QR SePay
Trang đã được cấu hình sẵn cho:
- Ngân hàng: TPBank
- Số tài khoản: 10005680585
- Chủ tài khoản: TA THI LE NA

QR được tạo động bằng VietQR/SePay (`vietqr.app/img`), nên không cần tải ảnh QR lên repo. Khi người xem quét, ứng dụng ngân hàng sẽ tự điền ngân hàng + số tài khoản; người xem tự nhập số tiền và nội dung. SePay tài liệu hóa cách nhúng QR động tại: https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code

## 5. OBS
Thêm Browser Source:
https://TEN-MIEN-VERCEL-CUA-BAN.vercel.app/overlay.html
Gợi ý 500x300 hoặc 600x350, nền transparent.
Overlay sẽ poll giao dịch mới mỗi 3 giây, hiện popup 10 giây và dùng SpeechSynthesis tiếng Việt để đọc nguyên văn content.

Lưu ý: TTS trình duyệt/OBS phụ thuộc voice có sẵn trên máy. Nếu giọng không đọc được tiếng Việt, cài/đổi Vietnamese voice trong Windows hoặc dùng TTS dịch vụ ngoài.
