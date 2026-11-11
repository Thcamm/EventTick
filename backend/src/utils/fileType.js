/** Nhận diện loại tệp theo "magic bytes" (không tin mimetype/đuôi tệp do client gửi). */
function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.slice(1, 4).toString() === "PNG") return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "webp";
  if (buf.slice(0, 4).toString() === "%PDF") return "pdf";
  return null;
}

const resourceTypeOf = (kind) => (kind === "pdf" ? "raw" : "image");

module.exports = { sniff, resourceTypeOf };
