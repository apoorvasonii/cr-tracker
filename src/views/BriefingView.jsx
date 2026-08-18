import { useApp } from '../state/AppContext'
import { buildEmailHtml } from '../lib/emailHtml'
import BriefingPreview from '../components/briefing/BriefingPreview'

/** Puts both HTML and plain text on the clipboard so any mail client gets something usable. */
function copyHtml(html, onDone, onFail) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const plain = tmp.innerText

  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard
      .write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      .then(onDone)
      .catch(() => fallbackCopy(html, onDone, onFail))
    return
  }
  fallbackCopy(html, onDone, onFail)
}

/** execCommand path for browsers without async clipboard write. */
function fallbackCopy(html, onDone, onFail) {
  const container = document.createElement('div')
  container.contentEditable = 'true'
  container.innerHTML = html
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  document.body.appendChild(container)

  const range = document.createRange()
  range.selectNodeContents(container)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  try {
    document.execCommand('copy')
    onDone()
  } catch {
    onFail()
  }
  sel.removeAllRanges()
  document.body.removeChild(container)
}

export default function BriefingView() {
  const { state, showToast } = useApp()

  const copyForEmail = () =>
    copyHtml(
      buildEmailHtml(state),
      () => showToast('Copied — paste directly into your email'),
      () => showToast('Copy failed — please try again', true)
    )

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-[12.5px] text-ink-muted">
          Exactly what gets pasted into the email — styled to match the outgoing message, not the app.
        </p>
        <button className="btn-primary" onClick={copyForEmail}>
          📋 Copy for email
        </button>
      </div>
      <BriefingPreview />
    </div>
  )
}
