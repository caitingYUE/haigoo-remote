import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary to handle ChunkLoadErrors (deployment updates)
 * and other uncaught runtime errors.
 */
class ChunkLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError = 
      error.message.includes('Loading chunk') || 
      error.message.includes('Loading CSS chunk') ||
      error.message.includes('text/html') || // MIME type error
      error.name === 'ChunkLoadError';
      
    return { hasError: true, isChunkError, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ChunkLoadErrorBoundary] Caught error:', error, errorInfo);
    
    // Auto-reload once if it's a chunk error (to fetch new assets)
    if (this.state.isChunkError) {
      const lastReload = sessionStorage.getItem('haigoo_chunk_reload');
      const now = Date.now();
      
      // Prevent infinite reload loops (limit to 1 reload per 10 seconds)
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        console.log('[ChunkLoadErrorBoundary] Detected chunk error, reloading page...');
        sessionStorage.setItem('haigoo_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">正在更新版本...</h2>
              <p className="text-slate-500 mb-6">我们发布了新版本，正在为您刷新页面以加载最新功能。</p>
              <button
                onClick={this.handleReload}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                立即刷新
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-lg w-full text-center border border-slate-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">出现了一些问题</h2>
            <p className="text-slate-500 mb-6">抱歉，页面遇到了意外错误。</p>
            
            <div className="bg-slate-50 p-4 rounded-lg text-left mb-6 overflow-auto max-h-40">
              <p className="text-xs font-mono text-slate-600 break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                刷新页面
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkLoadErrorBoundary;
