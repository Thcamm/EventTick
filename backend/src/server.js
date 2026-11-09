const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const { attachUser } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const bookingRoutes = require("./routes/bookingRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

// Cho phép front-end (chạy ở localhost / 127.0.0.1 trên mọi cổng) gọi API kèm cookie
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS: " + origin));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Phục vụ ảnh sự kiện đã upload tại /uploads/<filename>
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Gắn req.user cho MỌI request (null nếu chưa đăng nhập)
app.use(attachUser);

// Toàn bộ route đặt dưới tiền tố /v1 để KHỚP với front-end/src/lib/axios.js
// (baseURL: http://localhost:3000/v1) — không cần sửa gì bên front-end.
const eventCtrl = require("./controllers/eventController");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const resaleRoutes = require("./routes/resaleRoutes");
const categoryRoutes = require("./routes/categoryRoutes");

app.use("/v1/auth", authRoutes);
app.use("/v1/events", eventRoutes);
app.use("/v1/categories", categoryRoutes);
app.use("/v1/booking", bookingRoutes);
app.use("/v1/payment", require("./routes/paymentRoutes"));
app.use("/v1/resale", resaleRoutes);
const kycRoutes = require("./routes/kycRoutes");
app.use("/v1/organizer/kyc", kycRoutes.organizer);
app.use("/v1/admin/kyc", kycRoutes.admin);
const contractRoutes = require("./routes/contractRoutes");
app.use("/v1/organizer/contracts", contractRoutes.organizer);
app.use("/v1/admin", adminRoutes);
app.use("/v1/organizer", require("./routes/organizerRoutes"));
app.use("/v1/user", userRoutes);
app.get("/v1/seats/:id", eventCtrl.getById);

// Thêm API mới theo yêu cầu
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Không tìm thấy endpoint này" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Tệp quá lớn (tối đa 10MB)" : "Tệp tải lên không hợp lệ";
    return res.status(400).json({ success: false, message: msg });
  }
  console.error(err);
  res.status(500).json({ success: false, message: "Lỗi server nội bộ" });
});

require("./config/redis");
require("./services/bookingService").startExpirationJob();

app.listen(PORT, () => {
  console.log(`✅ Backend đang chạy tại http://localhost:${PORT}`);
});
