const multer = require("multer");
const cheerio = require("cheerio");
const ExcelJS = require("exceljs");
const { Event, EventSession, TicketTier, Seat, SeatmapLayout } = require("../models");
const { httpError, validId, ah } = require("../utils/http");
const { audit } = require("../utils/audit");
const { _helpers: H } = require("./organizerEventController");
const { SAMPLE_SVG, buildSampleWorkbookBuffer } = require("../utils/seatmapTemplate");
const { seatsOfSection, previewSeats } = require("../utils/seatGrid");

/**
 * Sơ đồ chỗ ngồi — đầu vào gồm 2 file do Organizer gửi, Admin tải lên:
 *   1. zone_map.svg          : mặt bằng; khu bán vé có id "SEC_...", sân khấu có id "STAGE_..."
 *   2. seating_manifest.xlsx : mỗi khu bao nhiêu ghế / hàng / lối đi / ghế khóa, hoặc sức chứa nếu là khu đứng (GA)
 * Hạng vé (ticket_tiers) do Organizer tạo sẵn; Excel nối khu với hạng vé qua cột Tier_Name.
 *   events (1) -> (1) seatmap_layouts (SVG + cấu hình khu)
 *   khu SEATED -> seats (mỗi suất diễn một bản)        khu GA -> bán theo số lượng của hạng vé
 */
const MAX_FILE = 5 * 1024 * 1024;
const MAX_SEATS_PER_SESSION = 10000;
const MAX_SEATS_TOTAL = 60000;
const IMPORTABLE = ["DRAFT", "PENDING", "APPROVED", "PUBLISHED"];

exports.importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE } }).fields([
  { name: "svgFile", maxCount: 1 },
  { name: "excelFile", maxCount: 1 },
]);

const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const fail = (message, details, code = 400) => {
  const e = httpError(message, code);
  if (details) e.details = details;
  return e;
};

// ------------------------------------------------------------------ SVG
function parseSvg(buffer) {
  const raw = buffer.toString("utf8").replace(/^﻿/, "");
  const $ = cheerio.load(raw, { xmlMode: true });
  const root = $("svg").first();
  if (!root.length) throw fail("File SVG không hợp lệ: không có thẻ <svg>");

  // Chống XSS: bỏ thẻ chạy được mã, thuộc tính on*, liên kết ngoài
  $("script, foreignObject, iframe, object, embed, audio, video, image[href^='http'], image[xlink\\:href^='http']").remove();
  $("*").each((_, el) => {
    for (const name of Object.keys(el.attribs || {})) {
      const v = String(el.attribs[name]);
      const isHref = name === "href" || name === "xlink:href";
      if (/^on/i.test(name) || (isHref && !v.startsWith("#"))) $(el).removeAttr(name);
    }
  });
  $("style").each((_, el) => {
    const css = $(el).text().replace(/@import[^;]*;?/gi, "");
    $(el).text(css);
  });

  if (!root.attr("viewBox")) {
    const w = parseFloat(root.attr("width")), h = parseFloat(root.attr("height"));
    if (w > 0 && h > 0) root.attr("viewBox", `0 0 ${w} ${h}`);
    else throw fail("SVG cần có thuộc tính viewBox (hoặc width + height)");
  }
  root.removeAttr("width");
  root.removeAttr("height");

  const ids = { SEC_: [], STAGE_: [] };
  const seen = new Set();
  $("[id]").each((_, el) => {
    const id = String(el.attribs.id).trim();
    for (const p of Object.keys(ids)) {
      if (!id.startsWith(p)) continue;
      if (seen.has(id)) throw fail(`SVG có id trùng: ${id}`);
      seen.add(id);
      ids[p].push(id);
    }
  });
  if (!ids.SEC_.length) throw fail('SVG không có khu nào có id bắt đầu bằng "SEC_"');
  return { svg: $.xml(root), sectionIds: ids.SEC_, stageIds: ids.STAGE_ };
}

// ------------------------------------------------------------------ Excel
const cellText = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((r) => r.text).join("").trim();
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).trim();
};
const numList = (s) => cellText(s).split(/[\s,;]+/).filter(Boolean).map(Number);

async function parseManifest(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw fail("File Excel phải là .xlsx");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw fail("Không đọc được file Excel (.xlsx)");
  }
  const ws = wb.getWorksheet("seating_manifest") || wb.worksheets[0];
  if (!ws) throw fail("File Excel không có sheet nào");

  const col = {};
  ws.getRow(1).eachCell((c, i) => (col[norm(cellText(c.value)).replace(/ /g, "_")] = i));
  const need = ["section_id", "type", "tier_name"];
  const miss = need.filter((k) => !col[k]);
  if (miss.length) throw fail(`Thiếu cột bắt buộc: ${miss.join(", ")}`);
  const get = (row, key) => (col[key] ? cellText(row.getCell(col[key]).value) : "");

  const sections = new Map();
  const errors = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const id = get(row, "section_id");
    if (!id) return; // bỏ dòng trống
    const type = get(row, "type").toUpperCase();
    const at = (msg) => errors.push(`Dòng ${n} (${id}): ${msg}`);
    let sec = sections.get(id);
    if (!sec) {
      sec = { section_id: id, name: get(row, "section_name") || id, type, tier_name: get(row, "tier_name"), layout: "STRAIGHT", layoutSet: false, capacity: 0, rows: [] };
      sections.set(id, sec);
    }
    if (type !== sec.type) return at(`Type phải nhất quán trong cùng một khu (${sec.type})`);
    if (norm(get(row, "tier_name")) !== norm(sec.tier_name)) return at("Tier_Name phải nhất quán trong cùng một khu");
    const lay = get(row, "layout").toUpperCase();
    if (lay) {
      if (!["STRAIGHT", "ARC"].includes(lay)) return at("Layout phải là STRAIGHT (hàng thẳng) hoặc ARC (hàng cong quanh sân khấu)");
      if (sec.layoutSet && sec.layout !== lay) return at("Layout phải nhất quán trong cùng một khu");
      sec.layout = lay;
      sec.layoutSet = true;
    }
    if (!["SEATED", "GA"].includes(type)) return at("Type phải là SEATED hoặc GA");
    if (!sec.tier_name) return at("Thiếu Tier_Name");

    if (type === "GA") {
      const cap = Number(get(row, "capacity"));
      if (sec.rows.length || sec.capacity) return at("Khu GA chỉ được có 1 dòng");
      if (!Number.isInteger(cap) || cap < 1 || cap > 100000) return at("Capacity phải là số nguyên từ 1 đến 100000");
      sec.capacity = cap;
      sec.rows.push(null);
      return;
    }
    const label = get(row, "row_label");
    const from = Number(get(row, "seat_from")), to = Number(get(row, "seat_to"));
    if (!/^[A-Za-z0-9]{1,5}$/.test(label)) return at("Row_Label phải là 1–5 chữ/số");
    if (sec.rows.some((r) => r.label === label)) return at(`Hàng ${label} bị trùng`);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > 200) return at("Seat_From / Seat_To phải là số nguyên, 1 ≤ From ≤ To ≤ 200");
    const aisles = numList(get(row, "aisles_after")), blocked = numList(get(row, "blocked_seats"));
    if (aisles.some((a) => !Number.isInteger(a) || a < from || a >= to)) return at(`Aisles_After phải nằm trong ${from}…${to - 1}`);
    if (blocked.some((b) => !Number.isInteger(b) || b < from || b > to)) return at(`Blocked_Seats phải nằm trong ${from}…${to}`);
    sec.rows.push({ label, from, to, aisles: [...new Set(aisles)].sort((a, b) => a - b), blocked: [...new Set(blocked)].sort((a, b) => a - b) });
  });
  if (errors.length) throw fail("File Excel có dòng không hợp lệ", { errors: errors.slice(0, 50) });
  if (!sections.size) throw fail("File Excel không có dòng dữ liệu nào");

  for (const s of sections.values()) {
    if (s.type === "SEATED") {
      s.capacity = s.rows.reduce((n, r) => n + (r.to - r.from + 1 - r.blocked.length), 0);
      if (s.capacity < 1) throw fail(`Khu ${s.section_id} không có ghế bán được`);
    } else s.rows = [];
  }
  return [...sections.values()];
}

const publicSection = (s) => ({ sectionId: s.section_id, name: s.name, type: s.type, tierName: s.tier_name, layout: s.layout || "STRAIGHT", capacity: s.capacity, rows: s.rows.length });

// ------------------------------------------------------------------ Admin: dựng sơ đồ
// POST /v1/admin/events/:id/seatmap   (multipart: svgFile + excelFile; ?dryRun=true chỉ kiểm tra, không ghi)
async function runImport(req, res, { ownerOnly = false } = {}) {
  const event = await Event.findOne({
    _id: validId(req.params.id, "ID sự kiện"),
    ...(ownerOnly ? { organizer_id: req.user.id } : {}),
  });
  if (!event) throw httpError("Không tìm thấy sự kiện", 404);
  // Organizer tự dựng được khi DRAFT / PENDING / APPROVED. Khi PUBLISHED chỉ được nếu chưa có vé nào đã bán hoặc đang giữ
  // (kiểm tra chi tiết theo từng hạng vé ở bước 4 bên dưới và ở đây theo toàn sự kiện).
  if (ownerOnly && !["DRAFT", "PENDING", "APPROVED", "PUBLISHED"].includes(event.status)) {
    throw fail(`Không dựng sơ đồ được khi sự kiện ở trạng thái ${event.status}`, null, 409);
  }
  if (ownerOnly && event.status === "PUBLISHED") {
    const sold = await TicketTier.countDocuments({ event_id: event._id, $expr: { $lt: ["$available_quantity", "$total_quantity"] } });
    if (sold > 0) throw fail("Sự kiện đã bán hoặc đang giữ vé nên không tự dựng lại sơ đồ được. Hãy liên hệ Admin.", null, 409);
  }
  if (!IMPORTABLE.includes(event.status)) throw fail(`Không dựng sơ đồ được khi sự kiện ở trạng thái ${event.status}`, null, 409);

  const svgFile = req.files?.svgFile?.[0], xlsFile = req.files?.excelFile?.[0];
  if (!svgFile || !xlsFile) throw fail("Cần tải lên đủ 2 file: svgFile (zone_map.svg) và excelFile (seating_manifest.xlsx)");

  const { svg, sectionIds, stageIds } = parseSvg(svgFile.buffer);
  const sections = await parseManifest(xlsFile.buffer);

  // 1. Khu trong SVG và Excel phải khớp 100%
  const inExcel = new Set(sections.map((s) => s.section_id)), inSvg = new Set(sectionIds);
  const onlyInSvg = sectionIds.filter((id) => !inExcel.has(id)), onlyInExcel = [...inExcel].filter((id) => !inSvg.has(id));
  if (onlyInSvg.length || onlyInExcel.length) {
    throw fail("Danh sách khu trong SVG và Excel không khớp", { onlyInSvg, onlyInExcel });
  }

  // 2. Khu GA: mỗi khu một hạng vé riêng (GA bán theo số lượng của hạng vé); không trộn GA với SEATED trong 1 hạng vé
  const tierUse = new Map();
  for (const s of sections) {
    const k = norm(s.tier_name);
    const u = tierUse.get(k) || { name: s.tier_name, types: new Set(), count: 0 };
    u.types.add(s.type);
    u.count++;
    tierUse.set(k, u);
  }
  const bad = [...tierUse.values()].filter((u) => u.types.size > 1 || (u.types.has("GA") && u.count > 1));
  if (bad.length) throw fail("Hạng vé không dùng chung được giữa khu GA và khu khác (mỗi khu GA cần một hạng vé riêng)", { tiers: bad.map((u) => u.name) });

  // 3. Hạng vé phải tồn tại ở MỌI suất diễn
  const sessions = await EventSession.find({ event_id: event._id }).sort({ start_time: 1 });
  const tiers = await TicketTier.find({ event_id: event._id });
  const tiersBySession = new Map();
  for (const t of tiers) {
    const m = tiersBySession.get(String(t.session_id)) || new Map();
    m.set(norm(t.name), t);
    tiersBySession.set(String(t.session_id), m);
  }
  const missing = [];
  for (const ses of sessions) {
    const names = tiersBySession.get(String(ses._id)) || new Map();
    const lack = [...tierUse.entries()].filter(([k]) => !names.has(k)).map(([, u]) => u.name);
    if (lack.length) missing.push({ session: ses.name, tiers: lack });
  }
  if (missing.length) throw fail("Có hạng vé trong Excel chưa được Organizer tạo ở một số suất diễn", { missingTiers: missing });

  const seatedTotal = sections.filter((s) => s.type === "SEATED").reduce((n, s) => n + s.capacity, 0);
  if (seatedTotal > MAX_SEATS_PER_SESSION || seatedTotal * sessions.length > MAX_SEATS_TOTAL) {
    throw fail(`Quá nhiều ghế (tối đa ${MAX_SEATS_PER_SESSION} ghế mỗi suất, ${MAX_SEATS_TOTAL} ghế mỗi sự kiện)`);
  }

  const summary = {
    sections: sections.map(publicSection),
    stageIds,
    sessions: sessions.length,
    seatedPerSession: seatedTotal,
    gaCapacity: sections.filter((s) => s.type === "GA").reduce((n, s) => n + s.capacity, 0),
  };
  if (String(req.query.dryRun) === "true") return res.json({ success: true, dryRun: true, message: "File hợp lệ (chưa lưu)", summary, svgContent: svg, seats: previewSeats(sections.map((x) => ({ ...x, section_id: x.section_id }))) });

  // 4. Đã có vé bán / đang giữ ở các hạng vé bị ảnh hưởng -> không dựng lại
  const touched = new Set(tiers.filter((t) => t.zone_type === "SEATED").map((t) => String(t._id)));
  for (const ses of sessions) for (const k of tierUse.keys()) touched.add(String(tiersBySession.get(String(ses._id)).get(k)._id));
  const busy = tiers.filter((t) => touched.has(String(t._id)) && H.usedOf(t) > 0);
  if (busy.length) {
    throw fail("Đã có vé được bán / đang giữ ở các hạng vé này nên không thể dựng lại sơ đồ", { tiers: [...new Set(busy.map((t) => t.name))] }, 409);
  }

  // 5. Ghi: xoá ghế cũ -> cập nhật hạng vé -> sinh ghế từng suất -> lưu layout
  await Seat.deleteMany({ event_id: event._id });
  const used = new Set();
  const docs = [];
  for (const ses of sessions) {
    const byName = tiersBySession.get(String(ses._id));
    const perTier = new Map();
    for (const s of sections) {
      const tier = byName.get(norm(s.tier_name));
      used.add(String(tier._id));
      perTier.set(String(tier._id), (perTier.get(String(tier._id)) || 0) + s.capacity);
      if (s.type === "SEATED") {
        for (const p of seatsOfSection(s)) {
          docs.push({ event_id: event._id, session_id: ses._id, tier_id: tier._id, section_name: s.section_id, row_label: p.row, seat_number: p.number, coord_x: p.x, coord_y: p.y, status: "AVAILABLE" });
        }
      }
    }
    for (const s of sections) {
      const tier = byName.get(norm(s.tier_name));
      await TicketTier.updateOne({ _id: tier._id }, { $set: { zone_type: s.type, total_quantity: perTier.get(String(tier._id)), available_quantity: perTier.get(String(tier._id)) } });
    }
  }
  // hạng vé trước đây là SEATED mà sơ đồ mới không còn dùng -> về GA, giữ nguyên số lượng
  const stale = tiers.filter((t) => t.zone_type === "SEATED" && !used.has(String(t._id))).map((t) => t._id);
  if (stale.length) await TicketTier.updateMany({ _id: { $in: stale } }, { $set: { zone_type: "GA" } });
  for (let i = 0; i < docs.length; i += 5000) await Seat.insertMany(docs.slice(i, i + 5000), { ordered: false });

  await SeatmapLayout.findOneAndUpdate(
    { event_id: event._id },
    { $set: { svg_content: svg, stage_ids: stageIds, sections: sections.map((s) => ({ section_id: s.section_id, name: s.name, type: s.type, tier_name: s.tier_name, layout: s.layout, capacity: s.capacity, rows: s.rows })), updated_by: req.user?.id, updated_at: new Date() } },
    { upsert: true },
  );
  await H.recalcEvent(event._id);
  await audit(req, "SEATMAP_IMPORT", "events", event._id, { sections: sections.length, seatsPerSession: seatedTotal, sessions: sessions.length });
  res.status(201).json({ success: true, message: "Đã dựng sơ đồ chỗ ngồi", summary });
}
const importWith = (opts) =>
  ah(async (req, res) => {
    try {
      await runImport(req, res, opts);
    } catch (err) {
      if (!err.details) throw err; // ah() trả đúng mã lỗi
      res.status(err.statusCode || 400).json({ success: false, message: err.message, details: err.details });
    }
  });
exports.importSeatmap = importWith({});
// POST /v1/organizer/events/:id/seatmap — Organizer tự dựng sơ đồ cho sự kiện của mình
exports.organizerImportSeatmap = importWith({ ownerOnly: true });

// GET /v1/admin/events/:id/seatmap — sơ đồ hiện tại của sự kiện (Admin: mọi sự kiện; Organizer: sự kiện của mình)
exports.adminGet = ah(async (req, res) => {
  const id = validId(req.params.id, "ID sự kiện");
  if (req.user?.role !== "ADMIN" && !(await Event.exists({ _id: id, organizer_id: req.user?.id }))) throw httpError("Không tìm thấy sự kiện", 404);
  const layout = await SeatmapLayout.findOne({ event_id: id });
  if (!layout) return res.json({ success: true, hasMap: false });
  res.json({ success: true, hasMap: true, svgContent: layout.svg_content, updatedAt: layout.updated_at, summary: { sections: layout.sections.map(publicSection), stageIds: layout.stage_ids }, seats: previewSeats(layout.toObject().sections) });
});

// GET /v1/admin/seatmap/template.xlsx | template.svg — file mẫu
exports.templateXlsx = ah(async (req, res) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="seating_manifest.xlsx"');
  res.send(await buildSampleWorkbookBuffer());
});
exports.templateSvg = (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="zone_map.svg"');
  res.send(SAMPLE_SVG);
};

// ------------------------------------------------------------------ Công khai
// GET /v1/events/sessions/:sessionId/seat-map — SVG + từng khu (hạng vé, giá, còn bao nhiêu)
exports.publicMap = ah(async (req, res) => {
  const session = await EventSession.findById(validId(req.params.sessionId, "ID suất diễn"));
  const event = session && (await Event.findById(session.event_id).select("status"));
  if (!session || !event || event.status !== "PUBLISHED") throw httpError("Không tìm thấy suất diễn", 404);

  const layout = await SeatmapLayout.findOne({ event_id: event._id });
  if (!layout) return res.json({ success: true, hasMap: false });

  const now = new Date();
  const [tiers, counts] = await Promise.all([
    TicketTier.find({ session_id: session._id }),
    Seat.aggregate([
      { $match: { session_id: session._id } },
      { $group: {
        _id: "$section_name",
        total: { $sum: 1 },
        available: { $sum: { $cond: [{ $or: [{ $eq: ["$status", "AVAILABLE"] }, { $and: [{ $eq: ["$status", "LOCKED"] }, { $lt: ["$lock_expires_at", now] }] }] }, 1, 0] } },
      } },
    ]),
  ]);
  const byName = new Map(tiers.map((t) => [norm(t.name), t]));
  const cnt = new Map(counts.map((c) => [c._id, c]));

  res.json({
    success: true,
    hasMap: true,
    svgContent: layout.svg_content,
    stageIds: layout.stage_ids,
    sections: layout.sections.map((s) => {
      const tier = byName.get(norm(s.tier_name));
      const c = cnt.get(s.section_id);
      const total = s.type === "GA" ? tier?.total_quantity ?? s.capacity : c?.total ?? 0;
      const available = !tier ? 0 : s.type === "GA" ? tier.available_quantity : c?.available ?? 0;
      return {
        sectionId: s.section_id, name: s.name, type: s.type, layout: s.layout || "STRAIGHT",
        tierId: tier?._id || null, tierName: tier?.name || s.tier_name, color: tier?.zone_color || null, price: tier?.price ?? 0,
        total, available,
        status: !tier ? "UNAVAILABLE" : available <= 0 ? "SOLD_OUT" : "AVAILABLE",
        minPerOrder: tier?.min_per_order, maxPerOrder: tier?.max_per_order,
        saleStartTime: tier?.sale_start_time, saleEndTime: tier?.sale_end_time,
      };
    }),
  });
});

exports._internals = { parseSvg, parseManifest, seatsOfSection };
