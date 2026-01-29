import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900/20 border border-red-500 rounded m-4">
          <h2 className="text-red-500 font-bold text-lg mb-2">Something went wrong</h2>
          <pre className="text-xs text-red-300 whitespace-pre-wrap overflow-auto max-h-[200px] mb-2">
            {this.state.error?.message}
          </pre>
          <pre className="text-xs text-red-300/70 whitespace-pre-wrap overflow-auto max-h-[300px]">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="mt-4 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
