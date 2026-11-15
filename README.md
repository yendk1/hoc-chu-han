# Học Chữ Hán

App web học chữ Hán phồn thể **và tiếng Anh** theo văn bản, dành cho người Việt: bộ thủ, chiết tự, thứ tự nét viết, ngữ pháp từng câu, ôn tập lặp lại ngắt quãng; tiếng Anh có phiên âm IPA, nghe, ngữ pháp, từ vựng, luyện đọc (máy chấm phát âm) và luyện viết.

Hai bài: **Luận ngữ** (20 câu) và **Chuyển Pháp Luân – Bài giảng thứ nhất** (672 câu, ~1000 chữ). Đổi bài bằng nút 📚 trên thanh trên cùng.
Là **PWA**: dùng như website, cài được lên điện thoại/máy tính như app, chạy offline.

## Cấu trúc
| Đường dẫn | Nội dung |
|---|---|
| `index.html`, `css/style.css`, `js/app.js` | Giao diện & logic |
| `js/data-chars.js` | 250 chữ: pinyin \| Hán Việt \| giản thể \| nghĩa \| bộ thủ \| thành phần \| loại chữ \| giải thích |
| `js/data-components.js` | Bộ thủ & thành phần |
| `js/data-words.js` | Từ ghép + 20 câu (bài học) kèm bản dịch |
| `js/data-grammar.js` | Ngữ pháp từng câu: phân tích `chữ[VAI:nghĩa]` + điểm ngữ pháp |
| `data/strokes/*.json` | Dữ liệu nét viết của 250 chữ (tên file = mã Unicode hex) |
| `audio/*.mp3`, `js/data-audio.js` | Âm thanh đọc sẵn cho chữ, từ, 20 câu (tạo bằng `tools/gen_audio.py`) |
| `js/boot.js` | Danh sách bài (sách) và nạp dữ liệu của bài đang chọn |
| `js/data-chars2.js` | ~780 chữ bổ sung cho Bài giảng thứ nhất |
| `js/books/zfl1/` | Bài giảng thứ nhất: câu + pinyin + từ ghép, ngữ pháp, tiếng Việt, tiếng Anh |
| `js/books/lunyu/en.js`, `js/english.js` | Tiếng Anh: câu, phân tích ngữ pháp, từ vựng, IPA · giao diện tab 🇬🇧 Tiếng Anh |
| `audio/zfl1/`, `audio/en/` | Âm thanh câu tiếng Trung của Bài giảng 1; câu & từ tiếng Anh |
| `tools/zfl1/` | Công cụ tạo dữ liệu Bài giảng 1 (tách đoạn, gióng câu, kiểm tra, build) |
| `js/vendor/hanzi-writer.min.js` | Thư viện vẽ & chấm nét viết |
| `manifest.webmanifest`, `sw.js`, `icons/` | Phần PWA (cài app, offline) |

## Chạy thử trên máy
Nhấp đúp `chay-thu.bat` (cần Python) → mở http://localhost:8000.
(Mở thẳng `index.html` cũng được, nhưng khi đó không có chế độ offline/cài app.)

## Đưa lên mạng bằng GitHub Pages (miễn phí)
Lần đầu:
1. Tạo tài khoản tại https://github.com, bấm **New repository**, đặt tên ví dụ `hoc-chu-han`, chọn **Public**, bấm **Create**.
2. Trong thư mục này chạy:
   ```
   git init
   git add .
   git commit -m "Học Chữ Hán – bản đầu tiên"
   git branch -M main
   git remote add origin https://github.com/<tên-tài-khoản>/hoc-chu-han.git
   git push -u origin main
   ```
3. Trên GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. Sau 1–2 phút, app có tại `https://<tên-tài-khoản>.github.io/hoc-chu-han/` – gửi link này cho mọi người.

## Nâng cấp app
1. Sửa code/dữ liệu.
2. Mở `sw.js`, tăng `VERSION` (vd `v1.0.0` → `v1.1.0`).
3. ```
   git add .
   git commit -m "Mô tả thay đổi"
   git push
   ```
Người dùng mở app sẽ thấy thông báo **“Đã có phiên bản mới – Cập nhật ngay”**.

## Cài lên điện thoại
- **Android (Chrome):** mở link → menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính**.
- **iPhone (Safari):** mở link → nút Chia sẻ → **Thêm vào MH chính**.
- **Máy tính (Chrome/Edge):** nút **📲 Cài app** trên thanh trên cùng, hoặc biểu tượng cài đặt trên thanh địa chỉ.

## Đưa lên CH Play / App Store (tùy chọn)
- **CH Play:** vào https://www.pwabuilder.com, nhập link GitHub Pages → tải gói Android (TWA) → đăng lên Google Play Console (phí một lần 25 USD). App trên Play tự cập nhật theo website.
- **App Store:** cần máy Mac + tài khoản Apple Developer (99 USD/năm), đóng gói bằng PWABuilder (iOS) hoặc Capacitor.

## Âm thanh
App đọc bằng file MP3 có sẵn (giọng Microsoft Xiaoxiao), nên người dùng **không cần cài giọng đọc**. Văn bản tự nhập thì dùng giọng tiếng Trung của máy nếu có, không có thì đọc ghép từng chữ.
Khi thêm chữ/từ/câu mới, tạo thêm âm thanh:
```
pip install edge-tts
python tools/gen_audio.py
```
(chỉ tạo file còn thiếu; nhớ tăng `VERSION` trong `sw.js` rồi push).

## Lưu ý
- Tiến độ học lưu trong trình duyệt từng máy; dùng “Sao lưu tiến độ / Khôi phục” ở chân trang để chuyển máy.
- Thêm chữ/từ/ngữ pháp: thêm dòng theo đúng định dạng trong `js/data-*.js`. Chữ mới chưa có file `data/strokes/<mã hex>.json` thì app tự lấy nét từ CDN (cần mạng lần đầu). Muốn chạy offline hoàn toàn, tải file đó từ `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/<chữ>.json`.
