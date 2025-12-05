import React from 'react'
import { X, MapPin, Clock } from 'lucide-react'
import { findLocation } from '../data/locations'
import { WorldMap } from './WorldMap'

interface LocationTooltipProps {
    location: string
    onClose: () => void
}

export function LocationTooltip({ location, onClose }: LocationTooltipProps) {
    const data = findLocation(location)

    if (!data) {
        return (
            <div className="absolute z-50 bg-white rounded-lg shadow-xl p-4 border border-slate-200 w-64 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start">
                    <p className="text-sm text-slate-600">暂无该地点的详细信息</p>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="absolute z-50 bg-white rounded-lg shadow-xl border border-slate-200 w-80 animate-in fade-in zoom-in-95 duration-200 overflow-hidden left-0 mt-2">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    {data.name}, {data.country}
                </h3>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                    }}
                    className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Map */}
            <div className="h-32 bg-slate-100 relative border-b border-slate-100">
                <WorldMap lat={data.lat} lng={data.lng} className="h-full w-full" />
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span className="text-slate-500">时区:</span>
                    <span className="font-medium text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-xs">{data.timezone}</span>
                </div>

                {/* Description */}
                <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {data.description}
                </div>
            </div>
        </div>
    )
}
