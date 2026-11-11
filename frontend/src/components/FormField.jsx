export const inputCls =
  'w-full px-3.5 py-2.5 bg-[#f4f4f6] border border-transparent rounded-lg text-sm text-[#09090b] outline-none focus:bg-white focus:border-[#09090b] transition-all';

/** Một câu hỏi trong form của nhà tổ chức (custom_form_schema): text | textarea | select | checkbox | number. */
export default function FormField({ field, value, onChange }) {
  const id = `f-${field.key}`;
  if (field.type === 'textarea')
    return <textarea id={id} rows={3} className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  if (field.type === 'select')
    return (
      <select id={id} className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value=''>-- Chọn --</option>
        {(field.options || []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  if (field.type === 'checkbox')
    return (
      <input id={id} type='checkbox' className='w-4 h-4 accent-[#09090b]' checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
    );
  return (
    <input
      id={id}
      type={field.type === 'number' ? 'number' : 'text'}
      className={inputCls}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Trả về nhãn của câu hỏi bắt buộc đầu tiên chưa được trả lời, hoặc null nếu đủ. */
export function firstMissingRequired(schema, answers) {
  for (const f of schema || []) {
    const v = answers?.[f.key];
    const empty = f.type === 'checkbox' ? v !== true : !String(v ?? '').trim();
    if (f.required && empty) return f.label;
  }
  return null;
}
