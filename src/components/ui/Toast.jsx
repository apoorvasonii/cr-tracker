import { useEffect, useState } from 'react'
import { useApp } from '../../state/AppContext'

export default function Toast() {
  const { toast } = useApp()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    // Long enough to notice a mistake and reach the Undo button.
    const t = setTimeout(() => setVisible(false), toast.undo ? 8000 : toast.isError ? 6000 : 2200)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div
      className={`fixed bottom-6 right-6 z-[999] max-w-[380px] rounded-xl px-4 py-3 text-[12.5px]
                  font-medium text-white shadow-pop transition-opacity duration-200
                  ${toast?.isError ? 'bg-red-600' : 'bg-ink'}
                  ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="flex items-center gap-3">
        <span>{toast?.message || ''}</span>
        {toast?.undo && (
          <button
            className="shrink-0 rounded-md px-2 py-0.5 font-semibold text-sky-300 hover:bg-white/10"
            onClick={() => {
              setVisible(false)
              toast.undo()
            }}
            title="Undo (Ctrl/Cmd+Z)"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  )
}
