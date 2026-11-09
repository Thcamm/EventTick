export const SECTION_PALETTE = ["#ec4899", "#06b6d4", "#a855f7", "#eab308", "#f97316", "#3b82f6", "#84cc16", "#14b8a6"];

/** Màu mỗi khu: màu của hạng vé; nếu chưa đặt thì lấy theo thứ tự hạng vé (cùng hạng vé = cùng màu). */
export function colorSections(sections) {
  const order = [];
  return sections.map((s) => {
    if (!order.includes(s.tierName)) order.push(s.tierName);
    return { ...s, color: s.color || SECTION_PALETTE[order.indexOf(s.tierName) % SECTION_PALETTE.length] };
  });
}
