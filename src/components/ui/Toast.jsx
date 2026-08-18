import { useEffect, useState } from 'react'
import { useApp } from '../../state/AppContext'

export default function Toast() {
  const { toast } = useApp()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), toast.isError ? 6000 : 2200)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div
      className={`pointer-events-none fixed bottom-6 right-6 z-[999] max-w-[380px] rounded-xl px-4 py-3 text-[12.5px]
                  font-medium text-white shadow-pop transition-opacity duration-200
                  ${toast?.isError ? 'bg-red-600' : 'bg-ink'}
                  ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {toast?.message || ''}
    </div>
  )
}
