import { Component } from 'react'

/**
 * Without this, a single render error blanks the page and the user has no idea
 * their data is still safely in localStorage. Keeps the message actionable and
 * offers a reload rather than a dead white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('CR Tracker crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="card p-6">
          <h1 className="text-[17px] font-semibold text-ink">Something went wrong on this screen.</h1>
          <p className="mt-2 text-[13px] text-ink-soft">
            Your projects and CR rows are still saved in this browser — nothing has been lost. Reloading usually clears
            it.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-[11.5px] text-ink-muted">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <div className="mt-5 flex gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
}
