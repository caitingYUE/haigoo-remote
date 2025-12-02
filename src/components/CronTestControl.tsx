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
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2"
          title="Cron Pipeline Test"
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
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Terminal className="text-indigo-600" />
                  Cron Pipeline Simulator
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Manually trigger the scheduled task pipeline for testing.
                </p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
                    'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center
                            ${result.status === 'pending' ? 'bg-gray-100 text-gray-400' : ''}
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
                                result.status === 'pending' ? 'text-gray-500' : 'text-gray-900'
                            }`}>
                                {result.step}
                            </h4>
                            {result.timestamp && (
                                <span className="text-xs text-gray-400">{result.timestamp}</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="text-sm">
                        {result.status === 'pending' && <span className="text-gray-400">Waiting...</span>}
                        {result.status === 'running' && <span className="text-indigo-600 font-medium">Executing...</span>}
                        {result.status === 'success' && <span className="text-green-600 font-medium">Completed</span>}
                        {result.status === 'error' && <span className="text-red-600 font-medium">Failed</span>}
                    </div>
                  </div>

                  {/* Details/Error Message */}
                  {(result.message || result.details) && (result.status === 'success' || result.status === 'error') && (
                    <div className="mt-2 pl-11">
                        <div className={`text-sm p-3 rounded ${
                            result.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-white/50 text-gray-600 border border-gray-200'
                        }`}>
                            {result.message}
                            {result.details && (
                                <pre className="mt-2 text-xs overflow-x-auto p-2 bg-black/5 rounded text-gray-800">
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
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
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
