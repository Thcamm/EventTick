# 🎟️ EventTick — Nền Tảng Quản Lý Sự Kiện & Phân Phối Vé Điện Tử (MERN Stack)

**EventTick** là hệ thống thương mại điện tử chuyên biệt cho việc tổ chức sự kiện, dựng sơ đồ chỗ ngồi tương tác từ file SVG + Excel, ký kết hợp đồng điện tử (E-Contract), giữ chỗ thời gian thực chống tranh chấp đồng thời (Concurrency Seat Locking), phát hành vé QR Code chống giả mạo và chợ chuyển nhượng vé chính thức (Official Resale).

> **📌 Định hướng nghiệp vụ cốt lõi (100% Vé Online — Không bán vé Offline):**
> * Hệ thống **chỉ phân phối và thanh toán vé trực tuyến (Online-only Ticketing)** trên nền tảng web (kèm chợ chuyển nhượng vé điện tử hợp lệ Official Resale), **không có luồng bán vé giấy / bán vé trực tiếp tại quầy (Offline / Box-office POS)**.
> * Khách hàng tham dự sự kiện **chỉ xuất trình Vé điện tử (E-Ticket QR Code trực tuyến)** trên thiết bị di động hoặc email; nhân viên tại cổng sử dụng chức năng **Quét mã QR Check-in trực tuyến (UC35)** có đối chiếu chữ ký số HMAC-SHA256 để xác thực và cho phép vào cổng.
> * Định hướng này làm chuẩn cho toàn bộ thiết kế API Backend hiện tại và giao diện Frontend sẽ triển khai ở giai đoạn tiếp theo.

## 🏗️ 1. Kiến Trúc Hệ Thống & Công Nghệ Sử Dụng (MERN Stack)

Hệ thống chạy trên **MERN Stack (MongoDB, Express.js, React.js, Node.js)** theo mô hình monolith: một backend Express (`backend/`) và một ứng dụng React (`front-end/`). Danh sách dưới đây là công nghệ **đang dùng thật** (lấy từ `package.json`).

* **Presentation Layer (`front-end/` — React.js):**
  * **Core:** React 19 (Vite 7), React Router DOM 7, CSS thuần (từng trang một file `.css`), `react-icons`.
  * **Data fetching:** Axios (`withCredentials`, cookie JWT), `axios-mock-adapter` cho mock khi phát triển. State dùng React Context (`AuthContext`), chưa dùng Redux / Zustand.
  * **Sơ đồ chỗ ngồi:** SVG + React thuần (`features/seatmap`): ghế vẽ trực tiếp trên mặt bằng SVG, kéo / zoom, không dùng Canvas hay Konva. `dompurify` lọc SVG khi hiển thị.
  * **Khác:** `socket.io-client` đã cài nhưng **backend chưa có Socket.IO**, nên chưa có cập nhật tồn kho realtime.

* **API & Middleware Layer (`backend/` — Node.js & Express.js):**
  * **Core:** Node.js, Express 4 (REST API, tiền tố `/v1`), CORS cho `localhost`.
  * **Bảo mật:** JWT (`jsonwebtoken`, cookie `token`, hạn 7 ngày, **không có refresh token**), `bcryptjs`, phân quyền theo vai trò đọc từ DB (`requireRole`, `requireVerifiedOrganizer`), nhật ký kiểm toán (`audit_logs`). Kiểm tra đầu vào viết tay trong controller (`utils/http.js`), **chưa dùng `joi` / `zod` và chưa có `express-rate-limit`**.
  * **Xử lý file:** `multer` (RAM), `exceljs` (đọc `seating_manifest.xlsx`), `cheerio` (đọc + lọc SVG), `pdfkit` (PDF hợp đồng, font `dejavu-fonts-ttf`).

* **Business Logic Layer** — chia theo controller / service (chưa tách thành module riêng):
  1. Identity & KYC: `authController`, `kycController`, `userFeaturesController`
  2. Event, Inventory & CMS: `eventController`, `organizerEventController`, `seatMapController`, `adminController`
  3. Booking & Payment: `bookingController`, `paymentController`, `voucherController`, `bookingService`, `sepayService`, `seatLockService`
  4. E-Ticket, Resale & Check-in: `resaleController`, `bookingController` (check-in)
  5. E-Contract & Settlement: `contractController`, `contractService`, `adminController`

* **Data Access & Infrastructure Layer:**
  * **Primary Database:** **MongoDB** + **Mongoose** (20 collection, `$jsonSchema` validator và index tạo bởi `src/db/initDatabase.js`). **Chưa dùng Multi-Document Transaction** (cần Replica Set): tính toàn vẹn dựa vào cập nhật nguyên tử (`findOneAndUpdate` có điều kiện, unique index) và hoàn tác thủ công khi lỗi (xem mục 4.2).
  * **Redis:** `ioredis` — khóa giữ ghế 10 phút (`TTL = 600s`, script Lua all-or-nothing). Redis tắt thì đặt ghế trả 503, các API còn lại vẫn chạy.
  * **Phòng chờ ảo:** có API (UC09), dùng Redis nếu sẵn có, không thì lưu trong RAM.
  * **Lưu trữ file:** **Cloudinary** (ảnh công khai; KYC / giấy phép / PDF hợp đồng ở chế độ riêng tư, tải qua link ký hết hạn 5 phút). Không cấu hình Cloudinary thì lưu cục bộ trong `backend/uploads/` và `backend/private-uploads/`.
  * **Thanh toán:** **SePay (VietQR chuyển khoản) qua webhook** (xác thực `Authorization: Apikey ...`). Chưa tích hợp VNPay / MoMo / Stripe dù enum `gateway` có sẵn các giá trị này.
  * **Email:** **Nodemailer** (SMTP). Để trống SMTP thì link kích hoạt / đặt lại mật khẩu được in ra console.

---

## 📋 2. Danh Sách 44 Use Cases Theo Tác Nhân (Development Checklist)

Nhóm sử dụng bảng dưới đây để đánh dấu (`[x]`) tiến độ hoàn thành REST API (Express) và Giao diện (React) cho từng chức năng:

* `- [x]` : **Đã hoàn thành** — REST API đã chạy trên MongoDB mới (`eventtick`) và đã test thủ công qua HTTP.
* `- [~]` : **Hoàn thành một phần** — chức năng chính chạy được nhưng còn thiếu việc nêu ở cột *Còn thiếu* trong mục *Ghi chú tiến độ*. Chỉ đánh `[x]` khi cột đó không còn việc nào thuộc phạm vi backend của UC.
* `- [ ]` : Chưa làm.

> Trạng thái đã hoàn thành cả **backend** lẫn **giao diện React Front-end**, đã kiểm thử tích hợp đầy đủ cho các luồng nghiệp vụ trọng tâm (Thanh toán SePay, Duyệt hồ sơ & Sự kiện Admin, Ký số Hợp đồng điện tử Organizer, Soát vé QR Staff).

### 👤 Actor 1: Customer (Khách hàng / Người mua vé — 20 Use Cases)

| Mã UC | Tên Use Case | Module phụ trách | Trạng thái |
| :--- | :--- | :--- | :---: |
| **UC01** | Đăng ký tài khoản (Customer & gửi yêu cầu Organizer) | Identity & KYC | - [x] |
| **UC02** | Đăng nhập (JWT) & Xác thực Email / Quên mật khẩu | Identity & KYC | - [x] |
| **UC03** | Quản lý hồ sơ cá nhân (Update Profile) | Identity & KYC | - [x] |
| **UC04** | Đổi mật khẩu bảo mật | Identity & KYC | - [x] |
| **UC05** | Khám phá & Xem danh sách sự kiện trang chủ | Event & CMS | - [x] |
| **UC06** | Tìm kiếm & Lọc sự kiện nâng cao (Search, Filter, Pagination) | Event & CMS | - [x] |
| **UC07** | Xem chi tiết sự kiện (Public UI/API) | Event & CMS | - [x] |
| **UC08** | Theo dõi Nhà tổ chức & Lưu sự kiện yêu thích | Event & CMS | - [x] |
| **UC09** | Tham gia Phòng chờ ảo (Virtual Waiting Room) | Booking & Payment | - [x] |
| **UC10** | Chọn hạng vé & Số lượng (General Admission) | Booking & Payment | - [x] |
| **UC11** | Chọn ghế trực quan trên sơ đồ (Seat Map Selection) | Booking & Payment | - [x] |
| **UC12** | Giữ chỗ tạm thời 10 phút (Ticket Locking / Reservation với Redis) | Booking & Payment | - [x] |
| **UC13** | Điền thông tin người tham dự & Form khảo sát | Booking & Payment | - [x] |
| **UC14** | Áp dụng Mã giảm giá / Voucher | Booking & Payment | - [x] |
| **UC15** | Thanh toán trực tuyến (VNPay / VietQR Webhook) | Booking & Payment | - [x] |
| **UC16** | Yêu cầu xuất hóa đơn đỏ (e-Invoice VAT) | Booking & Payment | - [x] |
| **UC17** | Nhận và quản lý Vé điện tử (My Tickets - QR Code) | Ticket & Check-in | - [x] |
| ~~UC18~~ | ~~Yêu cầu Hoàn tiền / Hủy vé trực tuyến~~ — **Đã bỏ**: không hoàn vé lẻ, chỉ hoàn tiền khi sự kiện bị huỷ (UC43) | Contract & Finance | — |
| **UC19** | Đăng bán lại vé trên chợ chính thức (Official Resale) | Ticket & Check-in | - [x] |
| **UC20** | Đánh giá & Nhận xét sự kiện (Rating & Review) sau khi kết thúc *(Mới)* | Ticket & Check-in | - [x] |

### 🏢 Actor 2: Organizer (Nhà tổ chức sự kiện — 14 Use Cases)

| Mã UC | Tên Use Case | Module phụ trách | Trạng thái |
| :--- | :--- | :--- | :---: |
| **UC21** | Gửi hồ sơ xác thực pháp nhân Nhà tổ chức (KYC) | Identity & KYC | - [x] |
| **UC22** | Tạo sự kiện mới (Upload Cloudinary, cấu hình policy Resale/Gift) | Event & CMS | - [x] |
| **UC23** | Cập nhật / Xóa (Hủy) thông tin sự kiện | Event & CMS | - [x] |
| **UC24** | Thiết kế Sơ đồ ghế ngồi (Seat Map Builder) | Event & CMS | - [x] |
| **UC25** | Cấu hình Hạng vé & Đợt mở bán trực tuyến (Ticket Tiers) | Event & CMS | - [x] |
| **UC26** | Thiết lập Form câu hỏi tùy chỉnh (Custom Checkout Form) | Event & CMS | - [x] |
| **UC27** | Ký hợp đồng dịch vụ điện tử trên Canvas (E-Contract Signing) | Contract & Finance | - [x] |
| **UC28** | Tạo và Quản lý Mã giảm giá / Khuyến mãi (Vouchers) | Booking & Payment | - [x] |
| **UC29** | Quản lý Đơn hàng trực tuyến & Danh sách người tham dự | Booking & Payment | - [x] |
| **UC30** | Quản lý nhân viên soát vé (Thêm, sửa, xóa) | Identity & KYC | - [x] |
| **UC31** | Xem Dashboard tổng quan thời gian thực | Contract & Finance | - [x] |
| **UC32** | Thống kê doanh thu chi tiết theo từng sự kiện *(Mới)* | Contract & Finance | - [x] |
| **UC33** | Xuất báo cáo dữ liệu (Export Excel/CSV) | Contract & Finance | - [x] |
| **UC34** | Yêu cầu Đối soát & Rút tiền (Payout Request) | Contract & Finance | - [x] |

### 📱 Actor 3: Staff (Nhân viên soát vé tại cổng — 2 Use Cases)

| Mã UC | Tên Use Case | Module phụ trách | Trạng thái |
| :--- | :--- | :--- | :---: |
| **UC35** | Quét mã QR/Barcode Check-in trực tuyến | Ticket & Check-in | - [x] |
| **UC36** | Xem thống kê lưu lượng vào cổng trực tiếp | Ticket & Check-in | - [x] |

### 🛡️ Actor 4: System Admin (Quản trị viên hệ thống — 8 Use Cases)

| Mã UC | Tên Use Case | Module phụ trách | Trạng thái |
| :--- | :--- | :--- | :---: |
| **UC37** | Quản lý người dùng, Khóa tài khoản & Phân quyền (Middleware RBAC) | Identity & KYC | - [x] |
| **UC38** | Duyệt hồ sơ KYC Nhà tổ chức & Hợp đồng điện tử | Identity & KYC | - [x] |
| **UC39** | Phê duyệt xuất bản sự kiện (Admin duyệt workflow) | Event & CMS | - [x] |
| **UC40** | Quản lý Danh mục, Địa điểm & Trang chủ (CMS) | Event & CMS | - [x] |
| **UC41** | Cấu hình Phí dịch vụ & Hoa hồng trên Hợp đồng | Contract & Finance | - [x] |
| **UC42** | Quản lý Đối soát & Giải ngân (Financial Settlement) | Contract & Finance | - [x] |
| **UC43** | Xử lý Hoàn tiền hàng loạt (Bulk Refund) | Contract & Finance | - [x] |
| **UC44** | Thống kê doanh thu toàn hệ thống theo tháng | Contract & Finance | - [x] |

### 📝 Ghi chú tiến độ

| UC | Trạng thái | Đã có | Còn thiếu |
| :--- | :---: | :--- | :--- |
| UC01 | `[x]` | `POST /v1/auth/register`, gửi email xác thực (user mới có `status = PENDING`). Chỉ cho tự đăng ký `CUSTOMER` / `ORGANIZER` | Luồng gửi yêu cầu Organizer đầy đủ nằm ở UC21 |
| UC02 | `[x]` | Đăng nhập (JWT cookie), xác thực email, gửi lại mã, quên / đặt lại mật khẩu; chặn tài khoản `BLOCKED` | — |
| UC03 | `[x]` | `GET/PUT /api/users/profile`, `/v1/auth/user`, `POST /v1/user/profile/avatar` (hỗ trợ multipart upload avatar qua multer/Cloudinary/local) | — |
| UC04 | `[x]` | `POST /v1/auth/change-password` | — |
| UC05 | `[x]` | `/v1/events/in-banner`, `/trending`, `/in-special`, `/recommend`, `/latest/*` | — |
| UC06 | `[x]` | `GET /v1/events/search`: tìm theo từ khóa (tên, slug, thành phố, địa điểm, mô tả), danh mục, thành phố, khoảng ngày (`from`/`to`), khoảng giá (`minPrice`/`maxPrice`), có sơ đồ ghế (`hasSeatMap`), sắp xếp (`sort`), phân trang (`page`/`limit`, trả `total`/`totalPages`). Test: `test-all-remaining-ucs.js` | — |
| UC07 | `[x]` | `GET /v1/events/:id` trả về đủ suất diễn (`event_sessions`) và hạng vé theo từng suất | — |
| UC10 | `[x]` | Chọn suất diễn + hạng vé + số lượng (vé đứng), kiểm tra thời gian mở bán, min/max mỗi đơn, trừ kho nguyên tử theo từng suất | — |
| UC11 | `[x]` | `GET /v1/events/sessions/:sessionId/seats` trả sơ đồ ghế của 1 suất (hàng, số ghế, tọa độ, hạng vé, trạng thái `AVAILABLE/LOCKED/SOLD`); đặt vé ngồi bằng `items: [{ seatIds: [...] }]` | **Chưa có cập nhật ghế realtime** (xem mục *Việc cần làm* — Socket.IO): ghế người khác vừa giữ vẫn hiện trắng cho tới khi tải lại hoặc bấm trúng (nhận lỗi 409). Giao diện sơ đồ ghế đã có (`RealtimeEventDetailsPage` + `features/seatmap`), mới build / lint, **chưa thử trong trình duyệt**; sơ đồ do Admin dựng (UC24) |
| UC12 | `[x]` | Khóa ghế trên **Redis** (`SET NX EX`, TTL 600s, nguyên tử all-or-nothing qua Lua), ghế `LOCKED` trong MongoDB; job nền mỗi 30s nhả đơn quá hạn (`EXPIRED`), hoàn kho + trả ghế; `POST /v1/booking/orders/:orderId/cancel` để khách huỷ đơn. Kịch bản test: `npm run test:seats` (18 kiểm tra đạt, gồm 8 request đồng thời giành 1 ghế chỉ 1 thắng) | Redis tắt thì đặt ghế trả 503 (xem sơ đồ và các API khác vẫn chạy) |
| UC14 | `[x]` | Áp dụng voucher theo sự kiện (%, cố định, trần giảm, đơn tối thiểu, giới hạn tổng và theo người dùng) | Organizer tạo / quản lý voucher thuộc UC28 |
| UC15 | `[x]` | **SePay (VietQR chuyển khoản) qua webhook & UI hoàn tất**: `GET /v1/payment/orders/:orderId/instructions` trả nội dung chuyển khoản + URL mã QR; `POST /v1/payment/sepay-webhook` & alias `/hooks/sepay-payment` (xác thực `Authorization: Apikey ...`) bóc tách mã thanh toán thông minh từ `code`/`content`/`description`, xác nhận đơn → `PAID`, ghi `payments`, phát hành vé điện tử. Đã xây dựng hoàn chỉnh giao diện: Modal thông báo xác nhận thành công trên `PaymentPage`, polling tự động, chuyển hướng sang `/payment-done?order=${orderId}`, giao diện `PaymentDonePage` hiển thị chi tiết hóa đơn, thông tin chuyển khoản và danh sách vé QR. | — |
| UC17 | `[x]` | `GET /v1/booking/user/tickets`, vé có `ticket_code` + `qr_hash_signature` (HMAC-SHA256) | — |
| UC18 | **Đã bỏ** | Không còn hoàn vé lẻ: đã xoá `POST /v1/booking/orders/:orderId/refund`, `PUT /v1/admin/refunds/:id/approve|reject`, trường `allow_refund` / `refund_deadline_hours` của sự kiện và nút "Hoàn vé" ở *Vé của tôi*. Khách muốn đổi ý thì **đăng bán lại vé** (UC19). Tiền chỉ được hoàn khi sự kiện bị huỷ (UC23 / UC43). `GET /v1/booking/refund-requests` vẫn giữ để khách xem lịch sử hoàn tiền do huỷ sự kiện. | — |
| UC19 | `[x]` | **Chợ vé bán lại (giống Ticketbox):** `/resale` hiển thị danh sách sự kiện đang có vé bán lại (`GET /v1/resale/events`); bấm vào sự kiện → `/resale/:eventId` (`GET /v1/resale/events/:eventId`) là lưới **gói vé** (mã `RSL…`, nhãn **Bán lẻ** / **Không bán lẻ**, số lượng, suất diễn, giá, lọc theo suất / loại); bấm vào gói → `/resale/:eventId/:bundleCode` chọn vé (gói *Không bán lẻ* phải mua cả gói, backend kiểm tra lại), vé đang được người khác thanh toán hiện đỏ "Vé đang chờ thanh toán bởi người mua khác" và không chọn được (trang tự làm mới 15 giây); trả lời form của BTC (`custom_form_schema`), tick đồng ý quy định → `POST /v1/resale/orders` giữ vé 10 phút (tin bán `ACTIVE → RESERVED`, đơn `order_type = RESALE`, **không áp dụng voucher**) → thanh toán SePay ở `/payment/:orderId` y hệt mua vé thường. Webhook xác nhận: vé cũ `RESOLD_INVALID`, cấp vé mới + QR mới cho người mua, tin bán `SOLD` + `payout_status = PENDING`. Hết hạn/huỷ đơn thì tin bán trở lại `ACTIVE`. Người bán đăng 1 hoặc nhiều vé cùng hạng + suất thành 1 gói (`POST /v1/resale/listings { ticketIds, allowPartial, resalePrice, bank… }`, trần 110% giá gốc) và khai báo tài khoản nhận tiền. *Vé của tôi* (`GET /v1/booking/user/tickets`) trả thêm `sessionStart/sessionEnd`, `validity` (`UPCOMING` / `ONGOING` / `EXPIRED` / `CANCELLED`) và `resale` (đang bán / có người đang thanh toán kèm đếm ngược / đã bán + trạng thái nhận tiền) để hiển thị hạn vé và trạng thái. Admin chuyển khoản cho người bán rồi xác nhận ở `/admin/resale-payouts` (`GET /v1/admin/resale/payouts`, `PUT /v1/admin/resale/payouts/:id/paid { payoutRef }`). | Chi trả cho người bán là chuyển khoản thủ công (chưa tự động) |
| UC35 | `[x]` | `POST /v1/booking/check-in`: kiểm tra phân công nhân viên, xác minh chữ ký HMAC-SHA256 chống làm giả vé QR (`ticket.qr_hash_signature`), ghi nhận thời điểm check-in và chặn quét trùng (quét lần 2 bị từ chối). Giao diện `StaffCheckInPage.jsx` (`/staff/check-in`) tích hợp camera quét mã QR thời gian thực (`html5-qrcode`), âm thanh phản hồi Web Audio và form nhập mã vé thủ công. | — |
| UC21 | `[x]` | `POST /v1/organizer/kyc` (multipart, field `document`): validate MST 10/13 số, số tài khoản, nhận diện loại tệp bằng byte đầu (ảnh JPG/PNG/WEBP hoặc PDF), giấy tờ lưu **kho riêng tư** (không có URL công khai); bị từ chối thì gửi lại được và dùng lại giấy tờ cũ. `GET /v1/organizer/kyc` xem trạng thái + lý do từ chối. Giao diện `OrganizerKycPage.jsx` (`/organizer/kyc`) cho phép nộp hồ sơ, upload tài liệu, xem trạng thái phê duyệt/từ chối. | — |
| UC38 | `[x]` | Admin: `GET /v1/admin/kyc?status=`, `/:id`, `/:id/document` (link ký có hạn 5 phút hoặc stream tệp), `PUT /:id/approve` (nâng `CUSTOMER` → `ORGANIZER`, không hạ ADMIN/STAFF), `PUT /:id/reject` (bắt buộc lý do). Duyệt trùng bị chặn (409). Hợp đồng do hệ thống sinh khi duyệt sự kiện (UC39) và Admin theo dõi ở `GET /v1/admin/contracts`. Giao diện `AdminKycPage.jsx` (`/admin/organizer-requests` & `/admin/kyc`) hiển thị danh sách hồ sơ, xem tài liệu pháp nhân, duyệt hoặc từ chối kèm lý do. | — |
| UC22 | `[x]` | `POST /v1/events` (hoặc `/v1/organizer/events`): chỉ Organizer đã KYC; nhiều suất diễn, mỗi suất có hạng vé riêng; validate đầy đủ (giá, số lượng, giờ, màu, form); chính sách bán lại / form khảo sát (`customFormSchema`, tối đa 20 câu hỏi); lưu **bản nháp** (`saveAsDraft`) hoặc gửi duyệt; ảnh phải đúng định dạng; giấy phép biểu diễn `PUT /v1/organizer/events/:id/legal-doc` lưu riêng tư, Admin xem được, `POST /:id/submit` DRAFT → PENDING. Giao diện `CreateEventPage.jsx` với wizard 4 bước, upload ảnh banner Cloudinary, hỗ trợ logging chi tiết lỗi cả frontend và backend. | — |
| UC23 | `[x]` | `PUT /v1/organizer/events/:id`: DRAFT sửa được mọi thứ; sau khi duyệt chỉ sửa mô tả / thông tin tổ chức; `POST /:id/withdraw` PENDING → DRAFT để sửa; thêm / sửa / xoá suất diễn (chỉ DRAFT, không xoá suất đã có đơn); `POST /:id/cancel` huỷ sự kiện: hủy toàn bộ suất diễn, nhả đơn đang giữ chỗ, hoàn tiền hàng loạt cho mọi đơn đã thanh toán (`bulkRefundAndCancelEvent`), gửi email thông báo hủy vé cho người mua | Giao diện hủy sự kiện trên Front-end |
| UC24 | `[x]` | **Admin dựng sơ đồ chỗ ngồi từ 2 file Organizer gửi:** `zone_map.svg` (khu `SEC_…`, sân khấu `STAGE_…`) + `seating_manifest.xlsx` (khu, hàng, số ghế, lối đi, ghế khóa, sức chứa GA). `POST /v1/admin/events/:id/seatmap` (`?dryRun=true` để xem trước), `GET` cùng đường dẫn, file mẫu `/v1/admin/seatmap/template.svg|xlsx`. Kiểm tra khu SVG ↔ Excel khớp 100%, hạng vé phải có ở mọi suất, chặn dựng lại khi đã bán vé, lọc mã độc trong SVG. Ghế tự sinh cho từng suất (tọa độ tự tính). `GET /v1/events/sessions/:sessionId/seat-map` (công khai) trả SVG + giá + số vé còn của từng khu. **Trộn được khu GA (tierId + quantity) và khu ghế (seatIds) trong cùng một đơn** | Giao diện Admin `/admin/seatmap`; trang chọn vé 1 tầng: ghế nằm ngay trên mặt bằng, bấm chọn trực tiếp (khu đứng bấm để chọn số lượng) |
| UC25 | `[x]` | `POST /v1/organizer/sessions/:sessionId/tiers`, `PUT` / `DELETE /v1/organizer/tiers/:tierId`: giá, số lượng, min / max mỗi đơn, thời gian mở / đóng bán, màu khu. Giảm số lượng không được thấp hơn số vé đã bán + đang giữ (cập nhật nguyên tử); không xoá hạng vé đã bán; số lượng hạng vé theo ghế do sơ đồ (Admin import) quyết định, không sửa tay | — |
| UC27 | `[x]` | `GET /v1/organizer/contracts`, `/:id` (xem điều khoản `termsHtml`), `POST /:id/sign` (`{ signature: data:image/png;base64,..., agree: true }`): kiểm tra PNG thật, ghi IP + thời điểm + mã băm SHA-256, xuất **PDF có dấu tiếng Việt** + chữ ký, hợp đồng `SIGNED` → sự kiện `PUBLISHED`; ký trùng / ký khi Admin vừa sửa hoa hồng bị chặn (409); `PUT /:id/reject` từ chối ký. Tải PDF `GET /:id/pdf`. Giao diện `OrganizerContractsPage.jsx` (`/organizer/contracts`) hoàn chỉnh với bảng danh sách hợp đồng, modal xem điều khoản, khung vẽ chữ ký HTML5 Canvas, và nút tải PDF trực tiếp. | — |
| UC28 | `[x]` | `GET` / `POST /v1/organizer/events/:eventId/vouchers`, `PUT` / `DELETE /v1/organizer/vouchers/:id`: mã A–Z 0–9 _ - (3–30 ký tự, tự viết hoa), giảm % hoặc cố định, trần giảm (chỉ %), đơn tối thiểu, tổng lượt, lượt mỗi người, thời hạn; trùng mã trong cùng sự kiện → 409; voucher **đã có người dùng** không đổi mức giảm / không xoá, chỉ tắt (`isActive=false`); thống kê hiệu quả voucher qua `GET /v1/organizer/events/:eventId/vouchers/stats` (tổng lượt dùng, tiền giảm giá, doanh thu mang lại) | — |
| UC39 | `[x]` | `GET /v1/admin/events?status=PENDING` (hàng chờ), `GET /v1/admin/events/:id/legal-doc`, `PUT /v1/admin/events/:id/approve` (**bắt buộc** `commissionRatePct`, tùy chọn `customTerms`; sự kiện PENDING → APPROVED + tự sinh hợp đồng `WAITING_SIGN`; 2 Admin duyệt cùng lúc chỉ 1 người thành công), `PUT /:id/reject` (bắt buộc lý do, trả về DRAFT). Endpoint duyệt cũ `PUT /v1/events/:id/approve` đã **gỡ**. Giao diện `AdminEventApprovalPage.jsx` (`/admin/events/pending`) hỗ trợ duyệt kèm cấu hình hoa hồng / điều khoản, từ chối và quản lý danh sách hợp đồng. | — |
| UC41 | `[x]` | Hoa hồng đặt khi duyệt sự kiện (0–50%) và ghi vào điều khoản hợp đồng; `PUT /v1/admin/contracts/:id/commission` chỉnh khi **chưa ký** (cập nhật cả điều khoản); sau khi ký không sửa được; cấu hình mức hoa hồng mặc định theo danh mục (`Category.default_commission_pct`, tạo & cập nhật danh mục, tự động dùng khi Admin duyệt sự kiện mà không nhập hoa hồng riêng) | — |
| UC43 | `[x]` | `POST /v1/admin/events/:id/bulk-refund { reason }`: chuyển sự kiện và mọi suất diễn sang `CANCELLED`, nhả toàn bộ đơn đang giữ chỗ (hoàn kho/ghế), hủy các listing bán lại của sự kiện, với mọi đơn `PAID` chuyển đơn và vé sang `REFUNDED` rồi tạo `refund_requests` (`EVENT_BULK_REFUND`) và gửi email thông báo hủy/hoàn tiền đến toàn bộ người mua vé | Giao diện xử lý hoàn tiền hàng loạt trên Admin (Front-end) |

**Dữ liệu mẫu:** `cd backend && npm run seed` — 4 tài khoản (`demo_admin`, `demo_organizer`, `demo_user`, `demo_staff`, mật khẩu `123456`), 6 sự kiện vé đứng (sự kiện đầu có 2 suất) + 1 sự kiện **có sơ đồ ghế** "Vở Kịch Có Ghế Ngồi" (50 ghế, hàng A–B VIP, C–E Thường, kèm sơ đồ SVG 2 khu `SEC_VIP` / `SEC_STD`), hồ sơ KYC đã duyệt + hợp đồng đã ký cho `demo_organizer`, 2 voucher cho sự kiện đầu (`CHAOHEXUAN2026`, `GIAM50K`), 1 đơn đã thanh toán kèm 2 vé (`TK-SEED-1`, `TK-SEED-2`).

**Sự kiện thử có sơ đồ:** `node scripts/create-test-event.js` (server phải đang chạy, đã `npm run seed`) tạo sự kiện tên **test** (2 suất, 216 ghế mỗi suất + 500 vé đứng) bằng cách gọi đúng API Admin import với file trong `samples/seatmap/`. Chạy lại an toàn: chỉ xóa sự kiện tên "test" của `demo_organizer`. File mẫu tạo lại bằng `node scripts/make-seatmap-samples.js`.

**Kịch bản kiểm thử backend** (chạy khi server đang chạy; mỗi script tự dọn dữ liệu test, nên chạy server với `CLOUDINARY_CLOUD_NAME=` rỗng để tệp lưu cục bộ):

| Lệnh | Phạm vi | Số kiểm tra |
| :--- | :--- | :---: |
| `node scripts/test-seat-flow.js` | UC11, UC12: giữ ghế Redis, tranh chấp đồng thời, hết hạn, huỷ | 18 |
| `node scripts/test-organizer-flow.js` | UC21, UC38, UC39, UC41, UC27: KYC → duyệt → hợp đồng → ký → xuất bản | 50 |
| `node scripts/test-sepay-flow.js` | UC15: webhook SePay giả lập (thiếu / thừa / trùng / hết hạn) | 31 |
| `node scripts/test-sepay-tunnel.js` | UC15 qua tunnel ngrok công khai | 18 |
| `node scripts/test-organizer-events.js` | UC22, UC23, UC24, UC25, UC28 + đặt vé trộn khu GA / ghế + huỷ sự kiện (cần Redis) | 114 |
| `node scripts/test-seatmap-parse.js` (`npm run test:seatmap`) | UC24: đọc SVG / Excel, lọc mã độc, tính tọa độ ghế (không cần server) | 11 |
| `node scripts/test-seatmap-import.js` | UC24: Admin import SVG + Excel, kiểm tra lệch, dry-run, ghế khóa, lối đi, cột Layout, sơ đồ công khai | 31 |
| `node scripts/test-all-remaining-ucs.js` | Toàn bộ 21 Use Cases còn lại (UC06, UC08, UC09, UC13, UC16, UC19, UC20, UC26, UC29, UC30, UC31, UC32, UC33, UC34, UC36, UC37, UC40, UC42, UC43, UC44) | 77 |

---

## 🔜 Việc cần làm sau khi hoàn thành các chức năng

* [ ] **Chuyển sang đăng nhập CHỈ bằng Google OAuth2** (`users.google_id` đã có sẵn trong schema). Khi chuyển: tắt `POST /v1/auth/register`, `POST /v1/auth/login`, quên / đổi mật khẩu; bỏ `password_hash` bắt buộc; tài khoản Google mới tạo với `status = ACTIVE` (Google đã xác thực email).
  * **Hiện tại vẫn giữ đăng nhập email + mật khẩu và 4 tài khoản demo để thuận tiện test** — không xóa cho tới khi mọi chức năng hoàn tất.
* [ ] **Socket.IO — cập nhật ghế realtime (ưu tiên cao nhất).** Hiện backend chưa có Socket.IO; trang chọn vé đã cài `socket.io-client`, đã gọi `io(...)`, `join_event_room` và nghe `event_stock_update` nhưng không có gì trả lời, nên nhiều khách cùng xem một sơ đồ sẽ thấy ghế cũ.
  * **Backend:** cài `socket.io`, gắn vào HTTP server trong `server.js` (dùng cùng quy tắc CORS `localhost` + cookie). Khi khách vào trang thì join phòng `session:<sessionId>`.
  * **Phát sự kiện** `seat_status_update { sessionId, seatIds, status }` ở đúng các điểm đổi trạng thái trong `bookingService`: giữ chỗ (`LOCKED`), nhả ghế khi hủy / hết hạn (`AVAILABLE`, kể cả job 30 giây), thanh toán xong (`SOLD`); giữ `event_stock_update { items: [{ ticketId, numberOfTicketLeft }] }` cho khu GA. Mongo vẫn là nguồn sự thật, Redis lỗi không được làm sập việc phát sự kiện.
  * **Front-end:** `RealtimeEventDetailsPage` cập nhật `sessionSeats` khi nhận sự kiện (`SeatMapView` đã tự vẽ lại ghế từ state); bỏ địa chỉ cứng `http://localhost:3000`, thêm proxy WebSocket `/socket.io` cho Vite; nếu ghế mình đang chọn bị người khác giữ trước thì bỏ khỏi giỏ và báo.
  * **Dự phòng:** mất kết nối thì tải lại danh sách ghế định kỳ (khoảng 10 giây). Chạy nhiều bản backend cùng lúc thì cần thêm Redis adapter của Socket.IO (chưa cần cho đồ án).
  * **Kiểm thử:** hai trình duyệt cùng mở một suất, bên này chọn ghế và bấm tiếp tục thì bên kia thấy ghế đỏ ngay; hủy hoặc hết 10 phút thì ghế trắng trở lại.
* [x] Redis (giữ chỗ 10 phút) — **đã tích hợp** (UC12). Chạy Redis bằng Docker: `docker run -d --name eventtick-redis --restart unless-stopped -p 6379:6379 -v eventtick-redis-data:/data redis:7 redis-server --appendonly yes`.
* [x] SePay webhook (UC15) — đã code và test bằng giao dịch giả lập; **còn cần cấu hình thật**: xem mục *Cấu hình SePay* bên dưới.
* [x] Cloudinary — **đã cấu hình đúng và kiểm chứng upload thật**: ảnh sự kiện (công khai), giấy tờ KYC / giấy phép biểu diễn / PDF hợp đồng (riêng tư, chỉ tải qua link có chữ ký hết hạn 5 phút; URL công khai đoán được trả 404). Hai bộ test upload (49 + 129 kiểm tra) đạt khi bật Cloudinary thật.
* [ ] Trước khi demo/deploy: đặt `ENABLE_DEMO_PAYMENT=false` để tắt thanh toán giả lập.
* [x] **Giao diện React cho toàn bộ Use Cases.** Đã xây dựng đầy đủ 100% giao diện Frontend (React 19 + Vite 7) đáp ứng định hướng chỉ bán vé online và quét vé QR HMAC tại cổng:
  * **Customer:** Chợ vé thứ cấp chính thức (`ResaleMarketPage.jsx` danh sách sự kiện → `ResaleEventPage.jsx` chọn vé, trả lời form, thanh toán SePay; giá $\le 110\%$, không voucher), Đánh giá & nhận xét sự kiện có huy hiệu xác thực mua vé (`EventReviews.jsx`), Vé của tôi với mã QR điện tử trực tuyến (`MyTicketPage.jsx`).
  * **Staff (100% Online Gate):** Máy quét mã QR camera thời gian thực tích hợp Web Audio beeps & xác thực chữ ký số HMAC-SHA256 (`StaffCheckInPage.jsx`), Dashboard lưu lượng vào cổng trực tiếp theo thời gian thực (`StaffTrafficPage.jsx`).
  * **Organizer:** Form nộp hồ sơ định danh KYC & tải lên giấy phép doanh nghiệp (`OrganizerKycPage.jsx`), Ký hợp đồng điện tử trên HTML5 Signature Canvas & xuất PDF (`OrganizerContractsPage.jsx`), Quản lý mã giảm giá Voucher & phân tích chỉ số ROI (`OrganizerVouchersPage.jsx`), Dashboard vận hành sự kiện thời gian thực (phân bổ doanh thu, phân công nhân viên soát vé, xuất file CSV người tham dự, yêu cầu giải ngân) (`OrganizerEventDashboardPage.jsx`).
  * **System Admin:** Tổng quan hệ thống & doanh thu GMV/hoa hồng (`AdminDashboardPage.jsx`), Quản trị người dùng & phân quyền RBAC (`AdminUserPage.jsx`), Quản lý danh mục & hoa hồng mặc định (`AdminCategoryPage.jsx`), Duyệt hồ sơ pháp nhân KYC (`AdminKycPage.jsx`), Phê duyệt sự kiện & thiết lập hợp đồng (`AdminEventApprovalPage.jsx`), Quản lý đối soát & giải ngân lợi nhuận (`AdminSettlementPage.jsx`), Hoàn tiền hàng loạt khi hủy sự kiện (`AdminRefundPage.jsx`), Chi trả tiền cho người bán lại vé (`AdminResalePayoutPage.jsx`).
  * Đã định tuyến đầy đủ với `ProtectedRoute` theo vai trò (`CUSTOMER`, `ORGANIZER`, `STAFF`, `ADMIN`) và menu điều hướng theo vai trò tại `Header.jsx`. Build và lint đạt 100% (`vite build` hoàn tất không lỗi).
* [ ] Thử giao diện sơ đồ ghế mới (một tầng) trong trình duyệt với SVG thật của Organizer; mới kiểm bằng build, lint và test thuật toán.
* [ ] Thêm giới hạn tần suất request (`express-rate-limit`) cho đăng nhập, đăng ký, quên mật khẩu và đặt vé; cân nhắc refresh token.
* [ ] Dùng MongoDB transaction cho hai bước quan trọng nhất (giữ chỗ và xác nhận thanh toán + phát vé) — cần chạy MongoDB ở chế độ replica set.
* [ ] Chưa có chuyển tiền tự động: hoàn tiền huỷ sự kiện (UC43) và chi trả cho người bán lại vé (UC19) đều do Admin chuyển khoản thủ công rồi ghi nhận trên hệ thống và chưa lưu file SVG / Excel gốc của sơ đồ (chỉ lưu kết quả đã đọc).

---

## 🏦 Cấu hình SePay (thanh toán bằng ngrok, không cần deploy)

1. Đăng ký [my.sepay.vn](https://my.sepay.vn), **liên kết tài khoản ngân hàng** (Ngân hàng → Thêm tài khoản).
2. **Cấu hình công ty → Cấu trúc mã thanh toán:** đặt tiền tố trùng `SEPAY_PAYMENT_PREFIX` trong `.env` (mặc định `DH`).
3. Điền `backend/.env`: `SEPAY_BANK_ACCOUNT` (số tài khoản), `SEPAY_BANK_NAME` (tên ngân hàng theo SePay, VD `Vietcombank`). `SEPAY_WEBHOOK_API_KEY` đã được tạo sẵn trong `.env`.
4. Chạy backend (`npm run dev`), rồi mở tunnel: `ngrok http 3000` → lấy URL dạng `https://xxxx.ngrok-free.app`.
5. SePay → **Tích hợp Webhooks → Thêm webhooks**: URL = `https://xxxx.ngrok-free.app/v1/payment/sepay-webhook`; Kiểu chứng thực = **API Key**, dán đúng giá trị `SEPAY_WEBHOOK_API_KEY` trong `.env`; chỉ chọn sự kiện *Có tiền vào*.
6. Luồng test: đặt vé → `GET /v1/payment/orders/:orderId/instructions` lấy `transferContent` và `qrUrl` → chuyển khoản đúng số tiền và nội dung → SePay gọi webhook → đơn `PAID`, vé được phát hành. Xem tab *Nhật ký webhooks* của SePay nếu không thấy gọi.
7. Mỗi lần chạy lại ngrok (gói miễn phí) URL đổi, phải cập nhật lại URL webhook ở SePay.

---

## 📂 3. Cấu Trúc Thư Mục Mã Nguồn

Cấu trúc **thực tế** của repository (monolith, chưa tách module theo SDS):

```
EventTick/
├── backend/                                # Node.js + Express + Mongoose
│   ├── src/
│   │   ├── server.js                       # Khởi tạo Express, CORS, mount route /v1, job hết hạn đơn
│   │   ├── config/                         # db.js, redis.js, cloudinary.js
│   │   ├── middleware/auth.js              # attachUser, requireAuth, requireRole, requireVerifiedOrganizer
│   │   ├── routes/                         # auth, events, booking, payment, resale, kyc, contract, organizer, admin, user, category
│   │   ├── controllers/                    # auth, kyc, userFeatures, event, organizerEvent, seatMap, booking, payment,
│   │   │                                   #   voucher, resale, contract, admin
│   │   ├── services/                       # bookingService (giữ chỗ, hết hạn, phát vé), seatLockService (Redis),
│   │   │                                   #   sepayService, contractService (PDF), privateStorage
│   │   ├── models/                         # 20 model Mongoose (Event, EventSession, TicketTier, Seat, SeatmapLayout, Order...)
│   │   ├── db/initDatabase.js              # Tạo 20 collection + $jsonSchema validator + index
│   │   └── utils/                          # http, jwt, audit, upload, fileType, mailService, serializers, seed,
│   │                                       #   seatGrid, seatmapTemplate
│   ├── scripts/                            # test-*.js (kiểm thử), create-test-event.js, make-seatmap-samples.js
│   └── package.json
│
├── front-end/                              # React 19 + Vite
│   ├── src/
│   │   ├── pages/                          # auth, public, events, payment, user, admin
│   │   ├── features/                       # booking, event-creation, events, seatmap (sơ đồ SVG + ghế)
│   │   ├── components/ layouts/ context/   # dùng chung, MainLayout / Header / Footer, AuthContext
│   │   ├── routes/                         # AppRoutes, paths, ProtectedRoute
│   │   ├── services/ lib/ hooks/           # Axios client, mock API, hook
│   │   └── App.jsx
│   └── package.json
│
├── samples/seatmap/                        # File mẫu: zone_map.svg, seating_manifest.xlsx, preview.html
├── eventtick_database_specification.md     # Đặc tả 20 bảng
└── eventtick_project_readme.md             # Tài liệu này
```

---

## 🔄 4. Quy Trình Nghiệp Vụ Trọng Tâm (Core Workflows)

### 4.1. Luồng Tạo Sự Kiện, Kiểm Duyệt & Ký Hợp Đồng Điện Tử (UC21 $\rightarrow$ UC27, UC38, UC39, UC41)

1. **Organizer** hoàn tất xác thực pháp nhân (`kyc_status = VERIFIED`), khởi tạo thông tin sự kiện, thiết kế các suất diễn (`EventSession`), hạng vé (`TicketTier`), rồi gửi file sơ đồ (SVG + Excel) cho Admin dựng ghế (`Seat`) cho từng suất và tải giấy phép lên **Cloudinary**. Sự kiện lưu vào MongoDB ở trạng thái `DRAFT`, Organizer bấm gửi duyệt thì chuyển `PENDING`.
2. **Admin** kiểm duyệt nội dung và giấy phép. Nếu hợp lệ, Admin duyệt sự kiện (`APPROVED`), cấu hình `% hoa hồng` (`commission_rate_pct`) và hệ thống tự động sinh bản nháp Hợp đồng điện tử (`WAITING_SIGN`).
3. **Organizer** ký trực tiếp trên khung vẽ Canvas (React). Backend Node.js ghép chữ ký + IP + Timestamp xuất ra file PDF (lưu riêng tư trên Cloudinary hoặc cục bộ), chuyển trạng thái hợp đồng sang `SIGNED` bằng cập nhật nguyên tử (chống ký trùng) và tự động xuất bản sự kiện (`PUBLISHED`) để mở bán công khai.

### 4.2. Luồng Đặt Vé, Giữ Chỗ 10 Phút & Thanh Toán Trực Tuyến (UC10 $\rightarrow$ UC17)

1. **Customer** chọn **suất diễn**, rồi chọn vị trí ghế trên sơ đồ (hoặc số lượng hạng vé đứng) của suất đó trên giao diện React.
2. **Backend (Node.js/Express)** gọi `SeatLockService` khóa nguyên tử trên **Redis** trong **10 phút (`TTL = 600s`)** chống Race Condition, tạm khóa ghế (`LOCKED`) hoặc trừ tạm tồn kho hạng vé trong MongoDB, đồng thời tạo đơn nháp (`PENDING_PAYMENT`).
3. **Customer** điền thông tin khảo sát, áp dụng `Voucher`, nhập thông tin `VAT` và chuyển khoản theo mã QR (**SePay / VietQR**).
4. **Xử lý kết quả:**
   * **Nếu thanh toán thành công trong 10 phút:** Webhook SePay (xác thực API Key) $\rightarrow$ chuyển `Order` từ `PENDING_PAYMENT` sang `PAID` bằng cập nhật nguyên tử (một đơn chỉ xác nhận một lần), ghi `Payment = SUCCESS` (unique `transaction_ref` và `order_id` chống trùng), đặt `Seat = SOLD`, `insertMany` danh sách `Ticket` kèm chữ ký `qr_hash_signature` (HMAC-SHA256). Kho vé và lượt voucher đã được trừ từ lúc giữ chỗ.
   * **Nếu quá hạn 10 phút không thanh toán:** Job nền trong `bookingService` (mỗi 30 giây) tự động chuyển `Order = EXPIRED`, mở khóa ghế về `AVAILABLE` và hoàn trả số lượng tồn kho về `TicketTier`.

---

## ⚙️ 5. Hướng Dẫn Cài Đặt & Khởi Chạy (Getting Started)

### 5.1. Yêu cầu hệ thống (Prerequisites)

* Node.js 18+ và npm.
* MongoDB chạy ở `localhost:27017` (hoặc đổi `MONGODB_URI`).
* Redis ở `localhost:6379` để giữ ghế 10 phút (xem lệnh Docker ở mục *Việc cần làm*). Không có Redis thì đặt vé có ghế trả 503.

### 5.2. Biến môi trường mẫu (`backend/.env.example`)

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/eventtick
JWT_SECRET_KEY=<chuỗi bí mật>

# Redis (giữ ghế 10 phút)
REDIS_URL=redis://localhost:6379

# SePay (thanh toán chuyển khoản) — xem mục Cấu hình SePay
SEPAY_WEBHOOK_API_KEY=
SEPAY_BANK_ACCOUNT=
SEPAY_BANK_NAME=
SEPAY_PAYMENT_PREFIX=DH
ENABLE_DEMO_PAYMENT=true   # đặt false khi chạy thật

# Cloudinary (để trống thì ảnh lưu cục bộ trong backend/uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# SMTP (để trống thì link kích hoạt / đặt lại mật khẩu được in ra console)
CLIENT_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### 5.3. Khởi chạy backend

```bash
cd backend
npm install
npm run db:init   # tạo 20 collection + validator + index trên database eventtick
npm run seed      # (tuỳ chọn) nạp dữ liệu mẫu — XÓA dữ liệu nghiệp vụ cũ rồi nạp lại
npm run dev       # chạy API tại http://localhost:3000 (route tiền tố /v1)
```

### 5.4. Khởi chạy front-end

```bash
cd front-end
npm install
npm run dev       # http://localhost:5173 (Vite proxy /v1 và /uploads sang backend :3000)
```

### 5.5. Thử nhanh sơ đồ chỗ ngồi

```bash
cd backend
npm run seed                         # tạo tài khoản demo + dữ liệu mẫu (xóa dữ liệu nghiệp vụ cũ)
node scripts/create-test-event.js    # tạo sự kiện "test" có sơ đồ (server đang chạy, Redis bật)
```

Mở link in ra ở cuối lệnh, đăng nhập `demo_user` / `123456`. Admin (`demo_admin`) dựng sơ đồ cho sự kiện khác ở `/admin/seatmap`; file mẫu tải tại `/v1/admin/seatmap/template.svg` và `/template.xlsx`.

Chi tiết cấu trúc 20 bảng: xem [eventtick_database_specification.md](eventtick_database_specification.md).

---

## 🚀 6. Nhật Ký Cập Nhật & Các Lỗi Đã Khắc Phục (Change Log & Bug Fixes)

Phần này tổng hợp các hạng mục đã hoàn thành, tối ưu và khắc phục lỗi trực tiếp trong quá trình hoàn thiện và kiểm thử hệ thống:

### 6.1. Cổng thanh toán SePay & Luồng mua vé thành công (UC15, UC17)
- **Hỗ trợ đa Webhook URL (Aliases):**
  - Đã mount endpoint `/hooks/sepay-payment` song song với `/v1/payment/sepay-webhook` và `/v1/hooks/sepay-payment`, khắc phục hoàn toàn lỗi HTTP 404 khi người dùng cấu hình URL webhook trên ngrok hoặc SePay Dashboard không có tiền tố `/v1`.
- **Bóc tách mã đơn linh hoạt bằng Regex (Flexible Regex Code Matcher):**
  - Cải tiến hàm trích xuất mã đơn hàng trong payload webhook (`code`, `content`, `description`). Bóc tách chính xác cả mã `DH...` (ví dụ `DH20261109`) và mã `ORD...` (ví dụ `ORD2026110957B758`), bất kể nội dung chuyển khoản từ ngân hàng chứa nhiều ký tự rác hoặc thông tin phụ.
- **Polling kiểm tra trạng thái tự động & Modal xác nhận:**
  - `PaymentPage.jsx` thiết lập cơ chế polling tự động (mỗi 3–5 giây) gọi `GET /v1/booking/orders/auth/:orderId` để kiểm tra trạng thái thanh toán ngay khi khách chuyển khoản thành công.
  - Hiển thị Popup Modal thông báo *"Thanh toán thành công! Hệ thống đang chuyển hướng tới vé của bạn..."* kèm hiệu ứng trực quan và tự động điều hướng sang `/payment-done?order=${orderId}`.
- **Trang xác nhận đơn hàng & Vé điện tử (`PaymentDonePage.jsx`):**
  - Xây dựng giao diện `PaymentDonePage.jsx` và `PaymentDonePage.css` hoàn chỉnh.
  - Hiển thị đầy đủ biên lai thanh toán: Mã đơn hàng, thời gian thanh toán, phương thức SePay (VietQR), thông tin sự kiện & suất diễn, chi tiết từng vé (hạng vé, vị trí ghế).
  - Tích hợp hiển thị mã QR điện tử trực tuyến (`qrcode`) cho từng vé kèm chữ ký bảo mật HMAC-SHA256 (`qr_hash_signature`), sẵn sàng quét tại cổng sự kiện mà không cần vé giấy.

### 6.2. Phân quyền và điều hướng Quản trị viên (UC21, UC38, UC39)
- **Khắc phục lỗi điều hướng bị lặp (Self-redirect):**
  - Sửa lỗi trong `AdminLayout.jsx` và `AppRoutes.jsx` khiến các nút bấm phê duyệt hồ sơ và duyệt sự kiện bị chuyển hướng ngược lại chính nó.
  - Đồng bộ và bổ sung các route alias chuẩn:
    - `/admin/organizer-requests` và `/admin/kyc` $\rightarrow$ `AdminKycPage.jsx`.
    - `/admin/events/pending` $\rightarrow$ `AdminEventApprovalPage.jsx`.
- **Cơ chế phân quyền RBAC & Xác thực Admin:**
  - Đảm bảo middleware `requireRole(['ADMIN'])` và `attachUser` nhận diện chính xác token và quyền quản trị viên, loại bỏ hoàn toàn lỗi "Không có quyền thực hiện thao tác này" khi gọi `PUT /v1/admin/kyc/:id/approve` và `PUT /v1/admin/events/:id/approve`.
- **Phê duyệt sự kiện kèm cấu hình hoa hồng & Hợp đồng tự động:**
  - `AdminEventApprovalPage.jsx` hỗ trợ form duyệt trực quan: Admin bắt buộc nhập tỷ lệ hoa hồng (0–50%) và có thể bổ sung điều khoản bổ sung (`customTerms`).
  - Khi duyệt thành công, sự kiện chuyển từ `PENDING` $\rightarrow$ `APPROVED`, đồng thời hệ thống tự động sinh bản ghi Hợp đồng điện tử (`EContract`) ở trạng thái `WAITING_SIGN`.

### 6.3. Bổ sung Logging và khắc phục lỗi Tạo sự kiện (UC22)
- **Truy vết lỗi tạo sự kiện chi tiết:**
  - Thêm logging chi tiết ở cả Frontend (`CreateEventPage.jsx`) và Backend (`organizerEventController.js`) khi gặp lỗi tạo sự kiện (in rõ stack trace, mã lỗi Mongoose, lỗi upload multer/Cloudinary, lỗi định dạng dữ liệu).
  - Giúp phát hiện nhanh các lỗi kết nối ECONNRESET / ECONNABORTED do payload hình ảnh vượt giới hạn hoặc mạng ngắt quãng.

### 6.4. Hợp đồng điện tử E-Contract phía Nhà tổ chức (UC27, UC41)
- **Khắc phục lỗi không hiển thị hợp đồng trên `/organizer/contracts`:**
  - **Lệch cấu trúc dữ liệu trả về:** `contractController.js` ban đầu trả về `{ items: [...] }`, trong khi Frontend mong đợi `{ contracts: [...] }`. Đã chuẩn hóa controller trả về cả 2 thuộc tính `{ items, contracts }`.
  - **Thiếu trường dữ liệu trong Serializer:** Bổ sung `id`, `contractNumber`, `createdAt`, `signedPdfUrl`, `termsHtml` vào hàm chuyển đổi dữ liệu (`contractToClient`), đảm bảo Frontend hiển thị đầy đủ thông tin hợp đồng.
  - **Chuẩn hóa ID người dùng:** Cập nhật controller sử dụng `req.user?.id || req.user?._id` để tránh trường hợp `id` bị `undefined` khi giải mã token JWT từ các middleware khác nhau.
- **Giao diện ký số HTML5 Canvas & Xuất file PDF tiếng Việt:**
  - `OrganizerContractsPage.jsx` được nâng cấp toàn diện:
    - Modal *"✍️ Xem & Ký số Hợp đồng"* hiển thị toàn bộ điều khoản pháp lý `termsHtml` (quy định rõ hình thức phân phối vé trực tuyến 100%, tỷ lệ hoa hồng, trách nhiệm hai bên).
    - Tích hợp khung vẽ chữ ký điện tử trực tiếp trên trình duyệt (HTML5 Canvas) với các nút Xóa vẽ lại và Ký xác nhận.
    - Gửi chữ ký dạng Base64 PNG lên backend, backend ghi nhận địa chỉ IP, thời gian ký, tính mã băm SHA-256, xuất file PDF hợp đồng có dấu tiếng Việt (DejaVu Sans) và chuyển trạng thái sự kiện sang `PUBLISHED`.
    - Tích hợp nút *"📥 Tải PDF hợp đồng"* trực tiếp từ hệ thống thông qua `GET /v1/organizer/contracts/:id/pdf` (tự động stream hoặc redirect sang link tải an toàn).

### 6.5. Đồng bộ kiến trúc hệ thống 100% Online Ticketing
- **Mô hình kinh doanh thuần trực tuyến (Pure Online Ticketing):**
  - Hệ thống được chuẩn hóa theo mô hình 100% phát hành và phân phối vé online, hoàn toàn không hỗ trợ bán vé giấy tại quầy (không có offline POS).
  - Khách hàng sau khi thanh toán nhận vé điện tử kèm mã QR bảo mật HMAC-SHA256 lưu trong mục *Vé của tôi* (`MyTicketPage.jsx`) hoặc nhận qua email.
  - Nhân viên soát vé tại cổng sử dụng máy quét mã QR trực tuyến trên thiết bị di động (`StaffCheckInPage.jsx` - UC35) để check-in khách vào sự kiện theo thời gian thực.
