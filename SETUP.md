# Donate Pastel — Donate dài + mã DN + SePay + Google Sheets + Vercel + OBS

## Luồng
Người xem nhập lời nhắn dài trên trang Donate
→ Vercel tạo mã DN + 6 ký tự
→ Google Apps Script lưu PENDING
→ QR tự điền TPBank + số tiền + mã DN
→ người xem chuyển khoản
→ SePay gửi webhook
→ Apps Script ghép mã DN với lời nhắn dài
→ PENDING thành PAID
→ OBS lấy donate mới
→ popup + TTS tiếng Việt.

## 1) Google Sheet
Giữ các sheet:
- `DONATE - GIAO DỊCH`
- `DONATE - CHỜ THANH TOÁN`

Trong Apps Script, dán `apps-script/Code.gs`.
Đổi `PASTE_SHEETS_SECRET_HERE` thành đúng giá trị của Vercel `SHEETS_SECRET`.
Deploy lại Web app: Execute as Me / Who has access: Anyone.

Không cần tạo spreadsheet mới.

## 2) Vercel
Giữ 3 Production variables:
- `SEPAY_API_KEY`
- `SHEETS_WEBAPP_URL`
- `SHEETS_SECRET`

Không commit secret/API key vào GitHub.

## 3) SePay
Webhook:
- Event: Tiền vào
- URL: `https://donate-pastel.vercel.app/api/sepay`
- Authentication: API Key
- TPBank account: tài khoản bạn đã liên kết
- Payment code structure: `DN` + 6 ký tự, số và chữ.

SePay trích `code` từ nội dung theo cấu hình payment-code structure.

## 4) Trang Donate
URL: `https://donate-pastel.vercel.app/`

Người xem nhập:
- Tên
- Số tiền
- Lời nhắn tối đa 2.000 ký tự

Trang tạo mã DNXXXXXX và QR có sẵn số tiền + mã.

## 5) OBS
Browser Source:
`https://donate-pastel.vercel.app/overlay.html`

Khuyến nghị 1920 x 1080.

Properties:
- Tick `Control audio via OBS`.
- Audio Mixer → Browser → `Monitoring and Output` nếu muốn vừa nghe vừa đưa vào stream.

## 6) TTS tiếng Việt
Overlay chỉ đọc nếu tìm thấy voice `vi-*`; nó KHÔNG fallback sang tiếng Anh.

Windows hiện liệt kê voice tiếng Việt `An` trong các TTS voice được hỗ trợ. Có thể cài thêm voice tiếng Việt từ phần quản lý giọng nói của Windows. Sau khi cài, khởi động lại OBS.

Test voice:
`https://donate-pastel.vercel.app/tts-test.html`

Nếu trang test không liệt kê voice tiếng Việt, hãy cài Vietnamese TTS voice trước.

## 7) Test overlay
`https://donate-pastel.vercel.app/overlay.html?test=1`

## 8) Test webhook
SePay → Webhooks → Gửi thử. Payload test có thể có `id=0`; code xử lý `0` hợp lệ.

## 9) Thử giao dịch thật
Sau khi webhook test đã thành công, tạo một lượt donate trên trang, quét QR và chuyển khoản thật một khoản nhỏ.

Khi SePay nhận giao dịch:
- `DONATE - GIAO DỊCH` ghi log ngân hàng.
- `DONATE - CHỜ THANH TOÁN` đổi PENDING → PAID.
- Trang Donate cập nhật trạng thái.
- OBS lấy lời nhắn dài từ bản ghi PAID và hiển thị/đọc.

## Thông tin ngân hàng
TPBank
STK: 10005680585
Chủ tài khoản: TA THI LE NA


## 10) TTS server-side (giọng Việt cố định)
- Endpoint: `/api/tts`
- Voice: `vi-VN-HoaiMyNeural` (nữ)
- Không cần thêm API key TTS.
- Gói `node-edge-tts` tạo MP3 bằng dịch vụ TTS online của Microsoft Edge.
- Overlay không dùng `speechSynthesis` của Chrome/OBS nữa.
- Endpoint giới hạn 2.000 ký tự và có rate limit nhẹ theo IP để tránh lạm dụng.
- TTS test: `https://donate-pastel.vercel.app/tts-test.html`

Lưu ý: đây là dịch vụ online của Edge TTS thông qua thư viện Node, không phải Azure Speech API có SLA. Dịch vụ upstream có thể thay đổi hoặc giới hạn lưu lượng.


## OBS TTS audio unlock
The overlay uses server-generated Vietnamese MP3 audio. The first time you use the OBS Browser Source, open the Browser Source context menu -> Interact and click the purple/white “Bấm một lần để bật âm thanh donate” button once. After that, the overlay stores the unlocked state locally and future TTS alerts can play automatically. Keep Browser Source -> Control audio via OBS enabled. For cleaner audio routing, Browser can stay Monitor Off because the Browser channel itself is sent to the stream.
