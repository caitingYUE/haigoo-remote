import { useState, useEffect } from 'react'
import { Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

interface RSSStatusIndicatorProps {
  className?: string
}

interface RSSStatus {
  isConnected: boolean
  failedSources: string[]
  successfulSources: string[]
  isLoading: boolean
}

export default function RSSStatusIndicator({ className = '' }: RSSStatusIndicatorProps) {
  const [status, setStatus] = useState<RSSStatus>({
    isConnected: true,
    failedSources: [],
    successfulSources: [],
    isLoading: false
  })
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // 监听RSS获取状态
    const handleRSSError = (event: CustomEvent) => {
      const { source, error } = event.detail
      setStatus(prev => ({
        ...prev,
        failedSources: [...prev.failedSources.filter(s => s !== source), source],
        isConnected: false
      }))
    }

    const handleRSSSuccess = (event: CustomEvent) => {
      const { source } = event.detail
      setStatus(prev => ({
        ...prev,
        successfulSources: [...prev.successfulSources.filter(s => s !== source), source],
        failedSources: prev.failedSources.filter(s => s !== source)
      }))
    }

    const handleRSSLoading = (event: CustomEvent) => {
      const { isLoading } = event.detail
      setStatus(prev => ({ ...prev, isLoading }))
    }

    // 添加事件监听器
    window.addEventListener('rss-error', handleRSSError as EventListener)
    window.addEventListener('rss-success', handleRSSSuccess as EventListener)
    window.addEventListener('rss-loading', handleRSSLoading as EventListener)

    return () => {
      window.removeEventListener('rss-error', handleRSSError as EventListener)
      window.removeEventListener('rss-success', handleRSSSuccess as EventListener)
      window.removeEventListener('rss-loading', handleRSSLoading as EventListener)
    }
  }, [])

  const handleRetryRSS = () => {
    setStatus(prev => ({ ...prev, isLoading: true, failedSources: [] }))
    // 触发RSS重新获取
    window.dispatchEvent(new CustomEvent('retry-rss'))
  }

  if (status.failedSources.length === 0 && !status.isLoading) {
    return null
  }

  return (
    <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* 主状态指示器 */}
        <div 
          className="flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            {status.isLoading ? (
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            ) : status.failedSources.length > 0 ? (
              <WifiOff className="w-4 h-4 text-orange-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            
            <div className="text-sm">
              {status.isLoading ? (
                <span className="text-gray-600">正在获取职位数据...</span>
              ) : status.failedSources.length > 0 ? (
                <span className="text-orange-600">
                  {status.failedSources.length} 个数据源连接失败
                </span>
              ) : (
                <span className="text-green-600">所有数据源连接正常</span>
              )}
            </div>
          </div>
          
          <button className="ml-2 text-gray-400 hover:text-gray-600">
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* 展开的详细信息 */}
        {isExpanded && (
          <div className="border-t border-gray-100 p-3 bg-gray-50">
            {status.failedSources.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-2">连接失败的数据源：</div>
                <div className="space-y-1">
                  {status.failedSources.map((source, index) => (
                    <div key={index} className="flex items-center text-xs text-orange-600">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {source}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status.successfulSources.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-2">连接成功的数据源：</div>
                <div className="space-y-1">
                  {status.successfulSources.map((source, index) => (
                    <div key={index} className="flex items-center text-xs text-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {source}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                数据源状态监控
              </div>
              <button
                onClick={handleRetryRSS}
                disabled={status.isLoading}
                className="text-xs text-haigoo-primary hover:text-haigoo-primary/80 disabled:text-gray-400 transition-colors duration-200"
              >
                {status.isLoading ? '重试中...' : '重试连接'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}