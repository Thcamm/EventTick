import { useCallback, useEffect, useState } from "react";

/** Kéo để di chuyển, lăn chuột / nút để phóng to – thu nhỏ. Gắn `attach` làm ref của khung chứa. */
export default function usePanZoom({ min = 0.5, max = 5 } = {}) {
  const [container, setContainer] = useState(null);
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const [drag, setDrag] = useState(null); // { x, y, tx, ty } khi đang giữ chuột
  const [moved, setMoved] = useState(false);

  const zoomBy = useCallback(
    (f) => setT((p) => ({ ...p, k: Math.min(max, Math.max(min, +(p.k * f).toFixed(3))) })),
    [min, max],
  );
  const reset = useCallback(() => setT({ x: 0, y: 0, k: 1 }), []);

  useEffect(() => {
    if (!container) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [zoomBy, container]);

  const end = () => setDrag(null);
  const handlers = {
    onMouseDown: (e) => {
      if (e.button !== 0 || e.target.closest("button, input")) return;
      setDrag({ x: e.clientX, y: e.clientY, tx: t.x, ty: t.y });
      setMoved(false);
    },
    onMouseMove: (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) setMoved(true);
      setT((p) => ({ ...p, x: drag.tx + dx, y: drag.ty + dy }));
    },
    onMouseUp: end,
    onMouseLeave: end,
  };

  return {
    attach: setContainer,
    handlers,
    dragging: Boolean(drag),
    /** true nếu thao tác vừa rồi là kéo (để bỏ qua sự kiện click) */
    wasDragged: () => moved,
    style: { transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transformOrigin: "center center" },
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    reset,
  };
}
