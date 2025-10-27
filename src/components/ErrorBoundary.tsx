import { Component, ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // 安全地处理错误信息，避免 RangeError
    try {
      this.setState({ error, errorInfo })
    } catch (stateError) {
      console.error('Error setting state in ErrorBoundary:', stateError)
      // 如果设置状态失败，至少保持错误状态
      this.setState({ hasError: true, error: new Error('组件渲染错误'), errorInfo: undefined })
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                出现了一些问题
              </h1>
              
              <p className="text-gray-600 mb-6">
                抱歉，页面遇到了意外错误。请尝试刷新页面或返回首页。
              </p>

              {/* Development mode error details */}
              {this.state.error && (
                <div className="mb-6 p-4 bg-gray-100 rounded-lg text-left">
                  <h3 className="font-semibold text-gray-900 mb-2">错误详情：</h3>
                  <pre className="text-xs text-gray-700 overflow-auto max-h-32">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack && 
                      this.state.errorInfo.componentStack.length > 0 && 
                      this.state.errorInfo.componentStack.substring(0, 500)
                    }
                  </pre>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleRetry}
                  className="btn-primary px-6 py-3 flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重试
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="btn-secondary px-6 py-3 flex items-center justify-center"
                >
                  <Home className="w-4 h-4 mr-2" />
                  返回首页
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

// Hook for functional components to handle errors
export function useErrorHandler() {
  const handleError = (error: Error, errorInfo?: string) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo)
    
    // You can integrate with error reporting services here
    // For example: Sentry, LogRocket, etc.
    
    // For now, we'll just log to console
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      info: errorInfo
    })
  }

  return { handleError }
}

// Simple error display component
export function ErrorMessage({ 
  error, 
  onRetry, 
  className = '' 
}: { 
  error: string | Error
  onRetry?: () => void
  className?: string 
}) {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <div className={`card p-6 border-red-200 bg-red-50 ${className}`}>
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">错误</h3>
          <p className="text-red-700 text-sm mb-3">{errorMessage}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn-secondary px-4 py-2 text-sm"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  )
}