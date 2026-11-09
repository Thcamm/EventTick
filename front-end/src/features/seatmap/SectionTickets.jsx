import React from "react";
import "./SeatMap.css";

const money = (v) => `${Number(v || 0).toLocaleString("vi-VN")} đ`;

/** Khu vé đứng (GA): chọn số lượng bằng [ − ] n [ + ], giới hạn theo số vé còn lại và tối đa mỗi đơn. */
export default function SectionTickets({ section, quantity, onChange, onBack }) {
  const max = Math.min(Number(section.available) || 0, Number(section.maxPerOrder) || 10);
  return (
    <div className="sm-stage sm-ga">
      <div className="sm-seats-head">
        <button type="button" className="sm-back" onClick={onBack}>← Về sơ đồ tổng</button>
      </div>
      <div className="sm-ga-card">
        <div className="sm-ga-name">
          <i style={{ background: section.color }} />
          {section.name}
        </div>
        <div className="sm-ga-meta">{section.tierName} · {money(section.price)}</div>
        <div className="sm-ga-meta">Còn {section.available} vé · tối đa {section.maxPerOrder || 10} vé / đơn</div>
        <div className="sm-ga-stepper">
          <button type="button" disabled={quantity <= 0} onClick={() => onChange(-1)}>−</button>
          <span>{quantity}</span>
          <button type="button" disabled={quantity >= max} onClick={() => onChange(1)}>+</button>
        </div>
      </div>
    </div>
  );
}
