# ROLE & CONTEXT
Bạn là một Senior Full-stack Software Engineer chuyên về Node.js (Express, MongoDB/Mongoose) và ReactJS. Tôi đang xây dựng hệ thống bán vé sự kiện (Event Ticketing Platform) hỗ trợ nhiều suất diễn (Multi-session) và nhiều hạng vé (Ticket Tiers).

Tôi muốn triển khai tính năng **Thiết kế và Hiển thị Sơ đồ chỗ ngồi động (Dynamic Seatmap)** theo kiến trúc **2-Level Drill-Down (Hybrid Input: SVG Zone Map + Excel Seating Manifest)**.

# YÊU CẦU NGHIỆP VỤ & KỸ THUẬT CHI TIẾT

## 1. Quy chuẩn 2 File đầu vào (Organizer Upload)
Khi tạo hoặc cấu hình sơ đồ cho sự kiện, Organizer sẽ upload 2 file:
1. **File `zone_map.svg` (Sơ đồ phân khu tổng quan):**
   - Chứa các thẻ vector (`<polygon>`, `<rect>`, `<path>`) đại diện cho Sân khấu và các Khu vực (Sections).
   - Quy ước thuộc tính `id` bắt buộc trong SVG:
     - Sân khấu: `id` bắt đầu bằng `STAGE_` (VD: `STAGE_MAIN`, `STAGE_CATWALK`).
     - Khu vực bán vé: `id` bắt đầu bằng `SEC_` (VD: `SEC_VIPA`, `SEC_VIPB`, `SEC_GA1`).
2. **File `seating_manifest.xlsx` (Khai báo cấu hình ghế & sức chứa):**
   - Các cột chuẩn: `Section_ID`, `Section_Name`, `Type` (`SEATED` | `GA`), `Tier_Code`, `Capacity` (dành cho GA), `Row_Label` (A, B, C...), `Seat_From` (Số ghế bắt đầu), `Seat_To` (Số ghế kết thúc), `Aisles_After` (Các số ghế có lối đi phía sau, ngăn cách bởi dấu phẩy, VD: "5,15"), `Blocked_Seats` (Các ghế khóa/vướng cột không bán, VD: "1,20").

## 2. Yêu cầu ở Backend (Node.js + Express + Mongoose)
Hãy viết cho tôi:
1. **Mongoose Schema (`SeatmapLayout` và `SessionSeatInventory`):**
   - Tách biệt dữ liệu Tĩnh (Layout: lưu nội dung SVG gốc, danh sách `sections`, và mảng tọa độ `seats` `(x, y)` đã sinh tự động) và dữ liệu Động (Trạng thái ghế theo từng `sessionId`: `AVAILABLE`, `LOCKED`, `SOLD`, `BLOCKED`).
2. **API Import & Parse (`POST /api/events/:eventId/seatmap/import`):**
   - Dùng `multer` nhận 2 file (`svgFile` và `excelFile`).
   - Dùng `cheerio` đọc file SVG, trích xuất toàn bộ danh sách `id` bắt đầu bằng `SEC_`.
   - Dùng `xlsx` đọc file Excel, validate đối chiếu xem toàn bộ `Section_ID` trong Excel có khớp 100% với các `id="SEC_..."` trong file SVG không. Nếu lệch, trả về lỗi 400 kèm danh sách ID bị lệch.
   - Viết thuật toán `generateSeatCoordinates`: Với các khu vực có `Type === 'SEATED'`, tự động tính toán tọa độ `(x, y)` cho từng ghế dựa trên `Row_Label`, `Seat_From`, `Seat_To`, cộng thêm khoảng trống `AISLE_GAP` nếu ghế nằm trong `Aisles_After`, và đánh dấu trạng thái `BLOCKED` cho các ghế trong `Blocked_Seats`.
   - Lưu cấu trúc vào MongoDB và khởi tạo trạng thái ghế cho các `Session` thuộc `Event`.

## 3. Yêu cầu ở Frontend (ReactJS)
Hãy viết cho tôi các Component theo luồng **2-Level Drill-Down**:
1. **Màn hình 1 - `<VenueOverviewMap />` (Tầng 1 - Xem mặt bằng tổng thể):**
   - Render nội dung `svgContent` từ Backend.
   - Tự động tô màu (fill) các thẻ có `id^="SEC_"` dựa theo màu của Hạng vé (`TicketTier`) tương ứng, làm mờ các khu vực đã hết vé (`SOLD_OUT`).
   - Bắt sự kiện `onClick` và `onMouseOver` vào từng khối `SEC_...` để hiển thị Tooltip (Tên khu, Giá vé, Số vé còn lại) và chuyển sang Tầng 2 khi click.
2. **Màn hình 2 - `<SectionDrillDownModal />` (Tầng 2 - Chọn ghế / số lượng vé):**
   - Nếu `section.type === 'GA'` (General Admission): Hiển thị bộ chọn số lượng vé `[ - ] [ Số lượng ] [ + ]` (giới hạn theo số vé còn lại).
   - Nếu `section.type === 'SEATED'`: Hiển thị thanh định hướng `"HƯỚNG SÂN KHẤU (STAGE DIRECTION)"` ở trên cùng và render ma trận ghế dựa trên tọa độ `(x, y)` đã sinh từ Backend (hỗ trợ Zoom/Pan mượt mà, phân biệt màu sắc giữa ghế `AVAILABLE`, `SELECTED`, `LOCKED`, `SOLD`, `BLOCKED`).

# OUTPUT FORMAT
Hãy cung cấp code đầy đủ, rõ ràng, chia theo từng file (Models, Controllers/Services, Routes ở Backend và các Components ở Frontend), kèm theo file JSON/Excel mẫu để test. Không viết code giả (pseudo-code) ở các hàm xử lý chính.