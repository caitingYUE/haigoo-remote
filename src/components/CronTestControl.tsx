import React, { useState } from 'react';
import { Play, AlertCircle, CheckCircle, Loader, XCircle, Terminal } from 'lucide-react';

interface StepResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  details?: any;
  timestamp?: string;
  progress?: {
    current?: number;
    total?: number;
    page?: number;
    totalPages?: number;
    translated?: number;
    failed?: number;
    skipped?: number;
  };
  streamMessages?: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

const CronTestControl: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<StepResult[]>([
    { step: 'Fetch RSS', status: 'pending' },
    { step: 'Process RSS', status: 'pending' },
    { step: 'Translate Jobs', status: 'pending' },
    { step: 'Enrich Companies', status: 'pending' },
    { step: 'Crawl Trusted Jobs', status: 'pending' },
  ]);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const hasMovedRef = React.useRef(false);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({ x: dx, y: dy });
      hasMovedRef.current = true;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    };
    hasMovedRef.current = false;
  };

  const handleClick = () => {
    if (!hasMovedRef.current) {
      setIsOpen(!isOpen);
    }
  };

  const PIPELINE_STEPS = [
    { name: 'Fetch RSS', endpoint: '/api/cron/fetch-rss' },
    { name: 'Process RSS', endpoint: '/api/cron/process-rss' },
    { name: 'Translate Jobs', endpoint: '/api/cron/translate-jobs' },
    { name: 'Enrich Companies', endpoint: '/api/cron/enrich-companies' },
    { name: 'Crawl Trusted Jobs', endpoint: '/api/cron/crawl-trusted-jobs' },
  ];

  // 根据流数据生成用户友好的消息
  const getStreamMessage = (data: any): string => {
    switch (data.type) {
      // Translate Jobs 消息类型
      case 'start':
        return '任务开始执行';
      case 'total':
        return `共 ${data.totalJobs} 个岗位，分 ${data.totalPages} 页处理`;
      case 'page_start':
        return `开始处理第 ${data.page}/${data.totalPages} 页`;
      case 'page_stats':
        return `第 ${data.page} 页：${data.untranslated} 个待翻译，${data.alreadyTranslated} 个已翻译`;
      case 'page_translated':
        return `第 ${data.page} 页翻译完成：成功 ${data.successCount}，失败 ${data.failCount}`;
      case 'page_saved':
        return `第 ${data.page} 页保存完成：${data.savedCount} 个记录`;
      case 'page_error':
        return `第 ${data.page} 页处理失败：${data.error}`;
      case 'page_complete':
        return `第 ${data.page} 页处理完成`;
      case 'complete':
        return `任务完成：翻译 ${data.stats?.translatedJobs || 0}，跳过 ${data.stats?.skippedJobs || 0}，失败 ${data.stats?.failedJobs || 0}`;
      
      // Fetch RSS 消息类型
      case 'fetch_start':
        return '开始抓取RSS源';
      case 'fetch_complete':
        return `RSS抓取完成，共获取 ${data.fetchedCount} 个项目`;
      case 'save_start':
        return '开始保存项目到数据库';
      case 'save_complete':
        return `保存完成，共保存 ${data.savedCount} 个唯一项目`;
      
      // Process RSS 消息类型
      case 'batch_start':
        return `开始处理第 ${data.batchNumber} 批次`;
      case 'read_complete':
        return `读取到 ${data.itemCount} 个待处理项目`;
      case 'no_data':
        return '没有更多待处理的数据';
      case 'item_processing':
        return `${data.message} (${data.itemIndex}/${data.totalItems})`;
      case 'item_enriched':
        return `项目丰富化完成: ${data.descriptionLength} 字符`;
      case 'item_enrich_failed':
        return `项目丰富化失败: ${data.error}`;
      case 'save_start':
        return '开始保存处理后的岗位数据';
      case 'save_complete':
        return `保存完成: ${data.savedCount} 个岗位数据`;
      case 'status_update_start':
        return '开始更新原始数据状态';
      case 'status_update_complete':
        return `状态更新完成: ${data.updatedCount} 个项目`;
      case 'batch_complete':
        return `第 ${data.batchNumber} 批次完成: 处理 ${data.processedCount} 个，丰富化 ${data.enrichedCount} 个`;
      
      case 'error':
        return `任务失败：${data.error}`;
      default:
        return `处理中：${data.type}`;
    }
  };

  // 从流数据提取进度信息
  const getProgressFromData = (data: any) => {
    switch (data.type) {
      // Translate Jobs 进度信息
      case 'total':
        return { total: data.totalJobs, totalPages: data.totalPages };
      case 'page_start':
        return { page: data.page, totalPages: data.totalPages };
      case 'page_translated':
        return { translated: data.successCount, failed: data.failCount };
      case 'complete':
        return {
          translated: data.stats?.translatedJobs,
          skipped: data.stats?.skippedJobs,
          failed: data.stats?.failedJobs
        };
      
      // Process RSS 进度信息
      case 'batch_start':
        return { batch: data.batchNumber };
      case 'read_complete':
        return { items: data.itemCount };
      case 'batch_complete':
        return {
          processed: data.totalProcessed,
          enriched: data.totalEnriched,
          batches: data.batchNumber
        };
      case 'complete':
        return {
          processed: data.stats?.totalProcessed,
          enriched: data.stats?.totalEnriched,
          batches: data.stats?.totalBatches,
          enrichedPercentage: data.stats?.enrichedPercentage
        };
      
      default:
        return undefined;
    }
  };

  // 通用的流式响应处理函数
  const handleStreamResponse = async (response: Response, stepIndex: number) => {
    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const streamMessages: Array<{type: string, message: string, timestamp: string}> = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // 保留最后一行（可能不完整）
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              // 根据消息类型更新进度
              const message = {
                type: data.type,
                message: getStreamMessage(data),
                timestamp: new Date().toLocaleTimeString()
              };
              
              streamMessages.push(message);
              
              // 更新UI进度
              setResults(prev => prev.map((r, idx) => 
                idx === stepIndex ? {
                  ...r,
                  message: message.message,
                  progress: getProgressFromData(data),
                  streamMessages: [...streamMessages]
                } : r
              ));
              
            } catch (parseError) {
              console.warn('Failed to parse stream data:', parseError, line);
            }
          }
        }
      }
      
      // 处理剩余数据
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          const message = {
            type: data.type,
            message: getStreamMessage(data),
            timestamp: new Date().toLocaleTimeString()
          };
          streamMessages.push(message);
        } catch (parseError) {
          console.warn('Failed to parse final stream data:', parseError, buffer);
        }
      }
      
      // 检查最终结果
      const lastMessage = streamMessages[streamMessages.length - 1];
      if (lastMessage?.type === 'error') {
        throw new Error(lastMessage.message);
      }

      // 根据任务类型设置成功消息
      const stepName = PIPELINE_STEPS[stepIndex].name;
      const successMessage = stepName === 'Translate Jobs' ? '翻译任务完成' : 
                           stepName === 'Fetch RSS' ? 'RSS抓取任务完成' : 
                           stepName === 'Process RSS' ? 'RSS数据处理完成' : 
                           '任务完成';

      // 更新成功状态
      setResults(prev => prev.map((r, idx) => 
        idx === stepIndex ? { 
          ...r, 
          status: 'success', 
          message: successMessage,
          details: { streamMessages },
          streamMessages
        } : r
      ));
      
    } finally {
      reader.releaseLock();
    }
  };

  const runPipeline = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    // Reset results
    setResults(PIPELINE_STEPS.map(s => ({ step: s.name, status: 'pending' })));

    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      const step = PIPELINE_STEPS[i];
      
      // Update current step to running
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { 
          ...r, 
          status: 'running', 
          timestamp: new Date().toLocaleTimeString(),
          streamMessages: [],
          progress: undefined
        } : r
      ));

      try {
        // 发送请求
        const response = await fetch(step.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 检查是否为流式响应（通过Content-Type判断）
        const contentType = response.headers.get('content-type');
        const isStreaming = contentType && contentType.includes('application/json') && 
                           response.headers.get('transfer-encoding') === 'chunked';

        if (isStreaming) {
          // 处理流式响应
          await handleStreamResponse(response, i);
        } else {
          // 处理普通响应
          const data = await response.json();

          if (!response.ok || data.success === false) {
            throw new Error(data.error || data.message || 'Unknown error');
          }

          // 更新成功状态
          setResults(prev => prev.map((r, idx) => 
            idx === i ? { 
              ...r, 
              status: 'success', 
              message: 'Task completed successfully',
              details: data 
            } : r
          ));
        }

      } catch (error: any) {
        console.error(`Error in step ${step.name}:`, error);
        // Update error
        setResults(prev => prev.map((r, idx) => 
          idx === i ? { 
            ...r, 
            status: 'error', 
            message: error.message || 'Request failed',
            details: error
          } : r
        ));
        // Stop pipeline on error
        setIsRunning(false);
        return; 
      }
    }

    setIsRunning(false);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div 
        className="fixed bottom-8 right-8 z-[9999]"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none'
        }}
      >
        <button
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          className={`bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-colors duration-200 flex items-center gap-2 ${isDragging ? 'scale-105 shadow-xl' : ''}`}
          title="Cron Pipeline Test (Drag to move)"
        >
          <Terminal size={24} />
          <span className="font-medium">Cron Test</span>
        </button>
      </div>

      {/* Test Interface Modal/Panel */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Terminal className="text-indigo-600" />
                  Cron Pipeline Simulator
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Manually trigger the scheduled task pipeline for testing.
                </p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className={`border rounded-lg p-4 transition-all duration-200 ${
                    result.status === 'running' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' :
                    result.status === 'success' ? 'border-green-200 bg-green-50' :
                    result.status === 'error' ? 'border-red-200 bg-red-50' :
                    'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center
                            ${result.status === 'pending' ? 'bg-slate-100 text-slate-400' : ''}
                            ${result.status === 'running' ? 'bg-indigo-100 text-indigo-600' : ''}
                            ${result.status === 'success' ? 'bg-green-100 text-green-600' : ''}
                            ${result.status === 'error' ? 'bg-red-100 text-red-600' : ''}
                        `}>
                            {result.status === 'pending' && <span className="text-sm font-mono">{index + 1}</span>}
                            {result.status === 'running' && <Loader className="animate-spin" size={16} />}
                            {result.status === 'success' && <CheckCircle size={16} />}
                            {result.status === 'error' && <AlertCircle size={16} />}
                        </div>
                        <div>
                            <h4 className={`font-medium ${
                                result.status === 'pending' ? 'text-slate-500' : 'text-slate-900'
                            }`}>
                                {result.step}
                            </h4>
                            {result.timestamp && (
                                <span className="text-xs text-slate-400">{result.timestamp}</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="text-sm">
                        {result.status === 'pending' && <span className="text-slate-400">Waiting...</span>}
                        {result.status === 'running' && <span className="text-indigo-600 font-medium">Executing...</span>}
                        {result.status === 'success' && <span className="text-green-600 font-medium">Completed</span>}
                        {result.status === 'error' && <span className="text-red-600 font-medium">Failed</span>}
                    </div>
                  </div>

                  {/* Progress Information */}
                  {result.progress && (
                    <div className="mt-2 pl-11">
                      <div className="text-xs text-slate-500 space-y-1">
                        {result.progress.page && (
                          <div>当前页面: {result.progress.page}/{result.progress.totalPages}</div>
                        )}
                        {result.progress.translated !== undefined && (
                          <div>已翻译: {result.progress.translated}</div>
                        )}
                        {result.progress.failed !== undefined && (
                          <div>失败: {result.progress.failed}</div>
                        )}
                        {result.progress.skipped !== undefined && (
                          <div>跳过: {result.progress.skipped}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stream Messages */}
                  {result.streamMessages && result.streamMessages.length > 0 && (
                    <div className="mt-2 pl-11">
                      <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
                        {result.streamMessages.slice(-5).map((msg, idx) => (
                          <div key={idx} className={`px-2 py-1 rounded ${
                            msg.type === 'error' ? 'bg-red-100 text-red-800' : 
                            msg.type === 'complete' ? 'bg-green-100 text-green-800' : 
                            'bg-slate-100 text-slate-600'
                          }`}>
                            <span className="font-mono text-[10px] opacity-70">{msg.timestamp}</span>
                            <span className="ml-2">{msg.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Details/Error Message */}
                  {(result.message || result.details) && (result.status === 'success' || result.status === 'error') && !result.streamMessages && (
                    <div className="mt-2 pl-11">
                        <div className={`text-sm p-3 rounded ${
                            result.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-white/50 text-slate-600 border border-slate-200'
                        }`}>
                            {result.message}
                            {result.details && (
                                <pre className="mt-2 text-xs overflow-x-auto p-2 bg-black/5 rounded text-slate-800">
                                    {JSON.stringify(result.details, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer / Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={isRunning}
              >
                Close
              </button>
              <button
                onClick={runPipeline}
                disabled={isRunning}
                className={`
                    px-6 py-2 rounded-lg font-medium text-white flex items-center gap-2 transition-all
                    ${isRunning 
                        ? 'bg-indigo-400 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
                    }
                `}
              >
                {isRunning ? (
                    <>
                        <Loader className="animate-spin" size={18} />
                        Running Pipeline...
                    </>
                ) : (
                    <>
                        <Play size={18} />
                        Start Pipeline Test
                    </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CronTestControl;
