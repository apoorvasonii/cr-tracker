/** Bordered select with the status colour as a bar down its left edge. */
export default function StatusSelect({ value, options, color, disabled, onChange }) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-1.5 left-1.5 w-[3px] rounded-full"
        style={{ backgroundColor: color }}
      />
      <select
        className="field-select w-full pl-4 font-semibold"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
