import React, { useState } from 'react';
import { Play, AlertCircle, CheckCircle, Loader, XCircle, Terminal } from 'lucide-react';

interface StepResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  details?: any;
  timestamp?: string;
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

  const runPipeline = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    // Reset results
    setResults(PIPELINE_STEPS.map(s => ({ step: s.name, status: 'pending' })));

    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      const step = PIPELINE_STEPS[i];
      
      // Update current step to running
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'running', timestamp: new Date().toLocaleTimeString() } : r
      ));

      try {
        // Use POST to ensure execution and bypass diagnostic checks (especially for translate-jobs)
        const response = await fetch(step.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.error || data.message || 'Unknown error');
        }

        // Update success
        setResults(prev => prev.map((r, idx) => 
            idx === i ? { 
                ...r, 
                status: 'success', 
                message: 'Task completed successfully',
                details: data 
            } : r
        ));

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

                  {/* Details/Error Message */}
                  {(result.message || result.details) && (result.status === 'success' || result.status === 'error') && (
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
