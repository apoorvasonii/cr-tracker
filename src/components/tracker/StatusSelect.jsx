import { tintOf, titleOf } from '../../lib/colors'

/**
 * Select that wears its status colour: tinted fill, matching border and label, so a
 * row's status is readable at a glance down the column rather than being a sliver.
 */
export default function StatusSelect({ value, options, color, disabled, onChange }) {
  return (
    <select
      className="field-select h-8 w-full border-2 px-2.5 pr-7 text-[12px] font-semibold"
      style={{ backgroundColor: tintOf(color), borderColor: color, color: titleOf(color) }}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ backgroundColor: '#fff', color: '#2b2b2b' }}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
