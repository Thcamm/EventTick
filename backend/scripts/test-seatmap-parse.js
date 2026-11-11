const assert = require("assert");
const { _internals: I } = require("../src/controllers/seatMapController");
const { SAMPLE_SVG, buildSampleWorkbookBuffer } = require("../src/utils/seatmapTemplate");

(async () => {
  const svg = I.parseSvg(Buffer.from(SAMPLE_SVG));
  assert.deepStrictEqual(svg.sectionIds.sort(), ["SEC_CAT1_L", "SEC_CAT1_R", "SEC_GA", "SEC_VIP_L", "SEC_VIP_R"]);
  assert.deepStrictEqual(svg.stageIds, ["STAGE_MAIN"]);

  const evil = I.parseSvg(Buffer.from('<svg viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><a href="javascript:x()"><rect id="SEC_X" onclick="x()"/></a></svg>'));
  assert(!/script|onload|onclick|javascript/i.test(evil.svg), evil.svg);

  const secs = await I.parseManifest(await buildSampleWorkbookBuffer());
  const by = Object.fromEntries(secs.map((s) => [s.section_id, s]));
  assert.strictEqual(by.SEC_GA.type, "GA");
  assert.strictEqual(by.SEC_GA.capacity, 500);
  assert.strictEqual(by.SEC_VIP_L.capacity, 4 * 10 - 2); // hàng A khóa ghế 1 và 10
  assert.strictEqual(by.SEC_VIP_L.layout, "ARC");
  assert.strictEqual(by.SEC_GA.layout, "STRAIGHT");
  const seats = I.seatsOfSection(by.SEC_CAT1_L);
  const x = (r, n) => seats.find((s) => s.row === r && s.number === String(n)).x;
  assert.strictEqual(x("B", 8) - x("B", 7), 30 + 22, "lối đi sau ghế 7");
  assert.strictEqual(x("B", 7), x("C", 7), "các hàng thẳng cột");
  const vip = I.seatsOfSection(by.SEC_VIP_L);
  assert(!vip.find((s) => s.row === "A" && (s.number === "1" || s.number === "10")), "ghế khóa không được sinh");
  console.log("OK:", secs.length, "khu,", seats.length, "ghế CAT 1 trái");
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.details || e); process.exit(1); });
