import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ChristmasErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Christmas Campaign Error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <span className="text-2xl">🎄</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">
                        有点小状况...
                    </h2>
                    <p className="text-slate-500 mb-6 max-w-sm">
                        圣诞树似乎被风吹歪了。不用担心，刷新页面或者重新栽种即可。
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        刷新页面
                    </button>
                    {this.state.error && (
                        <p className="mt-8 text-xs text-slate-300 font-mono">
                            Error: {this.state.error.message}
                        </p>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
