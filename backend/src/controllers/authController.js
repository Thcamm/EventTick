const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const { userToClient } = require("../utils/serializers");
const mailService = require("../utils/mailService");
const { saveUploadedFile } = require("../utils/upload");

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: false, // đặt true khi deploy thật với HTTPS
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
};

/**
 * Xác thực Google ID Token với Google OAuth API
 */
async function verifyGoogleIdToken(token) {
  if (!token) throw new Error("Mã Google token không được để trống");

  // Hỗ trợ chế độ DEV Mock Token nếu cần kiểm thử khi không có kết nối Google API thực
  if (process.env.NODE_ENV !== "production" && String(token).startsWith("mock_google_")) {
    const parts = String(token).split(":");
    const mockEmail = parts[1] || "mock_google_user@gmail.com";
    const mockName = parts[2] || "Google Mock User";
    return {
      sub: "google_mock_" + crypto.createHash("md5").update(mockEmail).digest("hex"),
      email: mockEmail,
      email_verified: "true",
      name: mockName,
      picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    };
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google xác thực token thất bại: ${errText || resp.statusText}`);
  }
  const payload = await resp.json();
  if (!payload.email || !payload.sub) {
    throw new Error("Thông tin tài khoản Google không hợp lệ hoặc thiếu email");
  }

  if (process.env.GOOGLE_CLIENT_ID && payload.aud && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    console.warn(`⚠️ Google token aud (${payload.aud}) khác GOOGLE_CLIENT_ID cấu hình trong .env`);
  }

  return payload;
}

// UC 1.1: POST /auth/register
exports.register = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      role,
      name,
      firstName,
      lastName,
      phone,
      isOrganizerRequest,
      is_organizer_requested,
      accountType,
      organizationName,
      organizerRequestNote,
    } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ tên đăng nhập, email và mật khẩu" });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedUsername = String(username).trim();

    // Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: "Địa chỉ email không đúng định dạng" });
    }

    // Kiểm tra độ dài mật khẩu
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    // Kiểm tra tên đăng nhập
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ success: false, message: "Tên đăng nhập phải có ít nhất 3 ký tự" });
    }

    const existed = await User.findOne({
      $or: [{ username: trimmedUsername }, { email: trimmedEmail }],
    });
    if (existed) {
      return res.status(409).json({ success: false, message: "Tên đăng nhập hoặc email đã tồn tại" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = name || [lastName, firstName].filter(Boolean).join(" ") || trimmedUsername;

    // Nhận diện lựa chọn đăng ký Nhà tổ chức (Organizer Request)
    const wantsOrganizer =
      String(role || accountType).toUpperCase() === "ORGANIZER" ||
      Boolean(isOrganizerRequest || is_organizer_requested);

    const finalRole = wantsOrganizer ? "ORGANIZER" : "CUSTOMER";

    // Sinh token kích hoạt email ngẫu nhiên (hạn 24h)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      password_hash: passwordHash,
      role: finalRole,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      phone: phone ? String(phone).trim() : undefined,
      status: "PENDING",
      auth_provider: "LOCAL",
      is_organizer_requested: wantsOrganizer,
      organizer_request_at: wantsOrganizer ? new Date() : undefined,
      organizer_request_note: organizerRequestNote || organizationName || undefined,
      email_verification_token: verificationToken,
      email_verification_expires: verificationExpires,
    });

    // Gửi email xác thực
    await mailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.first_name || user.full_name || user.username,
    );

    res.json({
      success: true,
      message: wantsOrganizer
        ? "Đăng ký tài khoản Nhà tổ chức thành công! Vui lòng kiểm tra email để kích hoạt tài khoản."
        : "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.",
      userId: user._id,
      email: user.email,
      role: user.role,
      isOrganizerRequested: user.is_organizer_requested,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.1b: POST /auth/google — Đăng ký & Đăng nhập bằng Google OAuth
exports.googleAuth = async (req, res) => {
  try {
    const {
      credential,
      idToken,
      accessToken,
      role,
      isOrganizerRequest,
      is_organizer_requested,
      accountType,
      organizerRequestNote,
      organizationName,
      // Thông tin profile gửi kèm khi dùng access token flow
      email: bodyEmail,
      name: bodyName,
      picture: bodyPicture,
      googleId: bodyGoogleId,
    } = req.body || {};

    let payload;

    if (accessToken) {
      // --- Luồng Access Token (từ google.accounts.oauth2.initTokenClient) ---
      // Xác thực access token bằng cách gọi Google userinfo API
      const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!infoRes.ok) {
        return res.status(401).json({ success: false, message: "Access token Google không hợp lệ hoặc đã hết hạn" });
      }
      payload = await infoRes.json();
      if (!payload.email || !payload.sub) {
        return res.status(400).json({ success: false, message: "Không lấy được email từ tài khoản Google" });
      }
    } else {
      // --- Luồng ID Token (từ GSI One Tap / credential) ---
      const token = credential || idToken || req.body?.token;
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Thiếu mã xác thực Google (credential, idToken hoặc accessToken)",
        });
      }
      payload = await verifyGoogleIdToken(token);
    }

    const googleEmail = String(payload.email).trim().toLowerCase();
    const googleId = payload.sub;
    const name = payload.name || googleEmail.split("@")[0];
    const picture = payload.picture || null;
    const givenName = payload.given_name || "";
    const familyName = payload.family_name || "";

    const wantsOrganizer =
      String(role || accountType).toUpperCase() === "ORGANIZER" ||
      Boolean(isOrganizerRequest || is_organizer_requested);

    let user = await User.findOne({
      $or: [{ google_id: googleId }, { email: googleEmail }],
    });

    let isNewUser = false;

    if (user) {
      if (user.status === "BLOCKED" || user.isActive === false) {
        return res.status(403).json({ success: false, message: "Tài khoản của bạn đã bị khóa" });
      }

      // Kích hoạt ngay nếu đang PENDING vì email đã được Google chứng thực
      user.status = "ACTIVE";
      user.isEmailVerified = true;
      user.email_verification_token = undefined;
      user.email_verification_expires = undefined;

      if (!user.full_name) {
        user.full_name = user.fullName || name;
      }
      if (!user.google_id) user.google_id = googleId;
      if (!user.avatar_url && picture) user.avatar_url = picture;

      // Nâng cấp vai trò nếu người dùng tích chọn Nhà tổ chức
      if (wantsOrganizer && user.role === "CUSTOMER") {
        user.role = "ORGANIZER";
        user.is_organizer_requested = true;
        user.organizer_request_at = new Date();
        if (organizerRequestNote || organizationName) {
          user.organizer_request_note = organizerRequestNote || organizationName;
        }
      }

      if (!user.password_hash && !user.passwordHash) {
        user.auth_provider = "GOOGLE";
      }
      await user.save();
    } else {
      isNewUser = true;

      // Sinh username duy nhất từ email Google
      let baseUsername = (googleEmail.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
      if (baseUsername.length < 3) baseUsername = "user_" + crypto.randomBytes(3).toString("hex");
      let candidateUsername = baseUsername;
      let counter = 1;
      while (await User.exists({ username: candidateUsername })) {
        candidateUsername = `${baseUsername}${counter++}`;
      }

      // Sinh mật khẩu ngẫu nhiên đã hash bảo mật
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await User.create({
        username: candidateUsername,
        email: googleEmail,
        password_hash: passwordHash,
        full_name: name,
        first_name: givenName,
        last_name: familyName,
        avatar_url: picture,
        google_id: googleId,
        auth_provider: "GOOGLE",
        role: wantsOrganizer ? "ORGANIZER" : "CUSTOMER",
        status: "ACTIVE", // Google đã xác minh email
        is_organizer_requested: wantsOrganizer,
        organizer_request_at: wantsOrganizer ? new Date() : undefined,
        organizer_request_note: organizerRequestNote || organizationName || undefined,
      });
    }

    const jwtToken = signToken({ id: user._id.toString(), username: user.username, role: user.role });
    res.cookie("token", jwtToken, COOKIE_OPTS);

    res.json({
      success: true,
      message: isNewUser
        ? (wantsOrganizer
            ? "Đăng ký tài khoản Nhà tổ chức qua Google thành công!"
            : "Đăng ký tài khoản qua Google thành công!")
        : "Đăng nhập bằng Google thành công!",
      token: jwtToken,
      user: userToClient(user),
      isNewUser,
    });
  } catch (err) {
    console.error("Google Auth error:", err);
    res.status(400).json({ success: false, message: err.message || "Xác thực Google thất bại" });
  }
};

// GET /auth/google — Chuyển hướng tới trang xác thực Google OAuth2 (Browser Redirect flow)
exports.googleRedirect = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({
      success: false,
      message: "Chưa cấu hình GOOGLE_CLIENT_ID trong file .env hệ thống",
    });
  }

  const backendHost = req.protocol + "://" + req.get("host");
  const redirectUri = `${backendHost}/v1/auth/google/callback`;
  const role = req.query?.role === "ORGANIZER" ? "ORGANIZER" : "CUSTOMER";
  const state = Buffer.from(
    JSON.stringify({ role, clientUrl: req.query?.redirect || process.env.CLIENT_URL || "http://localhost:5173" }),
  ).toString("base64");

  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid profile email",
      access_type: "offline",
      prompt: "select_account",
      state,
    }).toString();

  res.redirect(googleAuthUrl);
};

// GET /auth/google/callback — Nhận mã callback từ Google OAuth2
exports.googleCallback = async (req, res) => {
  const clientBase = process.env.CLIENT_URL || "http://localhost:5173";
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`${clientBase}/login?error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.redirect(`${clientBase}/login?error=missing_code`);
    }

    let role = "CUSTOMER";
    let clientRedirectUrl = clientBase;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
        if (decoded.role === "ORGANIZER") role = "ORGANIZER";
        if (decoded.clientUrl) clientRedirectUrl = decoded.clientUrl;
      } catch (e) {
        // bỏ qua lỗi parse state
      }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const backendHost = req.protocol + "://" + req.get("host");
    const redirectUri = `${backendHost}/v1/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Lỗi đổi authorization code từ Google:", errBody);
      return res.redirect(`${clientBase}/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;
    const payload = await verifyGoogleIdToken(idToken);

    const googleEmail = String(payload.email).trim().toLowerCase();
    const googleId = payload.sub;
    const name = payload.name || googleEmail.split("@")[0];
    const picture = payload.picture || null;
    const wantsOrganizer = role === "ORGANIZER";

    let user = await User.findOne({
      $or: [{ google_id: googleId }, { email: googleEmail }],
    });

    if (user) {
      if (user.status === "BLOCKED" || user.isActive === false) {
        return res.redirect(`${clientBase}/login?error=account_blocked`);
      }
      user.status = "ACTIVE";
      user.isEmailVerified = true;
      user.email_verification_token = undefined;
      user.email_verification_expires = undefined;
      if (!user.full_name) {
        user.full_name = user.fullName || name;
      }
      if (!user.google_id) user.google_id = googleId;
      if (!user.avatar_url && picture) user.avatar_url = picture;
      if (wantsOrganizer && user.role === "CUSTOMER") {
        user.role = "ORGANIZER";
        user.is_organizer_requested = true;
        user.organizer_request_at = new Date();
      }
      if (!user.password_hash && !user.passwordHash) {
        user.auth_provider = "GOOGLE";
      }
      await user.save();
    } else {
      let baseUsername = (googleEmail.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
      if (baseUsername.length < 3) baseUsername = "user_" + crypto.randomBytes(3).toString("hex");
      let candidateUsername = baseUsername;
      let counter = 1;
      while (await User.exists({ username: candidateUsername })) {
        candidateUsername = `${baseUsername}${counter++}`;
      }

      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await User.create({
        username: candidateUsername,
        email: googleEmail,
        password_hash: passwordHash,
        full_name: name,
        avatar_url: picture,
        google_id: googleId,
        auth_provider: "GOOGLE",
        role: wantsOrganizer ? "ORGANIZER" : "CUSTOMER",
        status: "ACTIVE",
        is_organizer_requested: wantsOrganizer,
        organizer_request_at: wantsOrganizer ? new Date() : undefined,
      });
    }

    const jwtToken = signToken({ id: user._id.toString(), username: user.username, role: user.role });
    res.cookie("token", jwtToken, COOKIE_OPTS);

    res.redirect(`${clientRedirectUrl}/?login_success=true`);
  } catch (err) {
    console.error("Google Callback error:", err);
    res.redirect(`${clientBase}/login?error=google_auth_failed`);
  }
};

// UC 1.1c: POST /auth/request-organizer — Người dùng Customer gửi yêu cầu nâng cấp tài khoản lên Nhà tổ chức
exports.requestOrganizer = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    if (user.status === "BLOCKED") {
      return res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
    }

    if (user.role === "ORGANIZER" || user.role === "ADMIN") {
      return res.json({
        success: true,
        message: "Tài khoản của bạn đã là Nhà tổ chức hoặc Quản trị viên.",
        user: userToClient(user),
      });
    }

    const { note, organizationName, phone } = req.body || {};

    user.role = "ORGANIZER";
    user.is_organizer_requested = true;
    user.organizer_request_at = new Date();
    if (note || organizationName) {
      user.organizer_request_note = String(note || organizationName).trim();
    }
    if (phone && !user.phone) {
      user.phone = String(phone).trim();
    }
    await user.save();

    // Cấp lại token JWT mới chứa role ORGANIZER
    const token = signToken({ id: user._id.toString(), username: user.username, role: user.role });
    res.cookie("token", token, COOKIE_OPTS);

    res.json({
      success: true,
      message: "Gửi yêu cầu nâng cấp lên Nhà tổ chức thành công! Vui lòng nộp hồ sơ KYC để được phê duyệt quyền tạo sự kiện.",
      user: userToClient(user),
    });
  } catch (err) {
    console.error("Request organizer error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.2: GET /auth/verify-email?token=...
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: "Thiếu mã xác thực (token)" });
    }

    const user = await User.findOne({
      email_verification_token: token,
      email_verification_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không hợp lệ hoặc đã hết hạn.",
      });
    }

    if (user.status === "PENDING") user.status = "ACTIVE";
    user.email_verification_token = undefined;
    user.email_verification_expires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Tài khoản của bạn đã được kích hoạt thành công! Bạn có thể đăng nhập ngay bây giờ.",
    });
  } catch (err) {
    console.error("Verify email error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /auth/resend-verification
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Vui lòng cung cấp email" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản với email này" });
    }

    if (user.status !== "PENDING") {
      return res.json({ success: true, message: "Tài khoản này đã được kích hoạt trước đó." });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.email_verification_token = verificationToken;
    user.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await mailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.first_name || user.full_name || user.username,
    );

    res.json({
      success: true,
      message: "Đã gửi lại email kích hoạt. Vui lòng kiểm tra hòm thư của bạn.",
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.3: POST /auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ tài khoản và mật khẩu" });
    }

    const identifier = String(username).trim();
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });
    if (!user) {
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    const hash = user.password_hash || user.passwordHash;
    // Tài khoản chỉ dùng Google OAuth không có password_hash → không cho đăng nhập bằng mật khẩu
    if (!hash) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản này đăng nhập bằng Google. Vui lòng sử dụng nút \"Đăng nhập với Google\".",
      });
    }

    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    // Kiểm tra kích hoạt email (nếu chưa kích hoạt -> cảnh báo kèm cờ unverified để front-end hiển thị nút resend)
    if (user.status === "BLOCKED" || user.isActive === false) {
      return res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
    }
    if (user.status === "PENDING" && user.isEmailVerified !== true) {
      return res.status(403).json({
        success: false,
        unverified: true,
        email: user.email,
        message: "Tài khoản chưa được kích hoạt qua email. Vui lòng kiểm tra hộp thư hoặc gửi lại mã kích hoạt.",
      });
    }

    const token = signToken({ id: user._id.toString(), username: user.username, role: user.role });
    res.cookie("token", token, COOKIE_OPTS);
    res.json({
      success: true,
      message: "Đăng nhập thành công",
      user: userToClient(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /auth/logout
exports.logout = (req, res) => {
  res.clearCookie("token", COOKIE_OPTS);
  res.json({ success: true, message: "Đã đăng xuất" });
};

// GET /auth  -> Header.jsx gọi cái này để biết đã đăng nhập chưa
exports.me = async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user.id);
  const blocked = !user || user.status === "BLOCKED" || user.isActive === false;
  res.json({ user: !blocked ? userToClient(user) : null });
};

// GET /api/users/top-stars -> Lấy danh sách 8 user có lượt followersCount cao nhất
exports.getTopStars = async (req, res) => {
  try {
    const stars = await User.find({})
      .sort({ followersCount: -1, createdAt: -1 }) // ưu tiên follower, sau đó đến mới tạo
      .limit(8)
      .select("username name fullName avatarUrl followersCount isEmailVerified");
    
    // Format data
    const formattedStars = stars.map(user => ({
      _id: user._id,
      name: user.fullName || user.name || user.username,
      image: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username)}&background=random`,
      followers: user.followersCount || 0,
      isVerified: user.isEmailVerified
    }));

    res.json({ success: true, data: formattedStars });
  } catch (err) {
    console.error("getTopStars error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /auth/user  -> AccountPage.jsx dùng để lấy thông tin chi tiết (yêu cầu đăng nhập)
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user" });
  res.json({
    success: true,
    user: {
      userName: user.username,
      name: user.full_name || user.fullName || user.username,
      firstName: user.first_name || user.firstName,
      lastName: user.last_name || user.lastName,
      email: user.email,
      phone: user.phone,
      dob: user.dob,
      gender: user.gender,
      role: user.role,
      isEmailVerified: user.status === "ACTIVE" || user.isEmailVerified === true,
      avatarUrl: user.avatar_url || user.avatarUrl,
    },
  });
};

// POST /auth/user/my-account, PUT /user/profile, POST /user/profile/avatar -> cập nhật hồ sơ & ảnh đại diện
exports.updateProfile = async (req, res) => {
  try {
    const { name, firstName, lastName, phone, dob, gender, avatarUrl, avatar_url } = req.body || {};
    const updateData = {};
    if (phone !== undefined) updateData.phone = phone;
    if (dob) updateData.dob = dob;
    if (gender !== undefined) updateData.gender = gender;
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (name) {
      updateData.full_name = name;
    } else if (firstName !== undefined || lastName !== undefined) {
      const full = [lastName, firstName].filter(Boolean).join(" ");
      if (full) updateData.full_name = full;
    }
    if (req.file) {
      updateData.avatar_url = await saveUploadedFile(req, req.file);
    } else if (avatarUrl !== undefined || avatar_url !== undefined) {
      updateData.avatar_url = String(avatarUrl ?? avatar_url).trim() || null;
    }
    const updated = await User.findByIdAndUpdate(req.user.id, updateData, { new: true, runValidators: true });
    res.json({
      success: true,
      message: "Cập nhật hồ sơ thành công",
      avatarUrl: updated?.avatar_url || null,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// UC 1.4: POST /auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập địa chỉ email" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      // Để bảo mật, không báo lộ rằng email không tồn tại
      return res.json({
        success: true,
        message: "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến bạn.",
      });
    }

    // Sinh token reset ngẫu nhiên (hạn 15 phút)
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.password_reset_token = resetToken;
    user.password_reset_expires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await user.save();

    // Gửi email đặt lại mật khẩu
    await mailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.first_name || user.full_name || user.username,
    );

    res.json({
      success: true,
      message: "Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.5: POST /auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const user = await User.findOne({
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
      });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UC 1.6: POST /auth/change-password  (yêu cầu đăng nhập)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const hash = user.password_hash || user.passwordHash;
    // Tài khoản Google không có password_hash
    if (!hash) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản Google không có mật khẩu. Hãy đặt mật khẩu mới qua chức năng \"Quên mật khẩu\".",
      });
    }

    const ok = await bcrypt.compare(currentPassword, hash);
    if (!ok) {
      return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không chính xác" });
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = user.password_hash;
    await user.save();

    res.json({
      success: true,
      message: "Đổi mật khẩu thành công!",
    });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
