import React, { useState, useEffect } from 'react'
import { X, MapPin, Clock } from 'lucide-react'
import { findLocation } from '../data/locations'
import { WorldMap } from './WorldMap'

interface LocationTooltipProps {
    location: string
    onClose: () => void
}

export function LocationTooltip({ location, onClose }: LocationTooltipProps) {
    const data = findLocation(location)
    const [time, setTime] = useState<string>('')

    useEffect(() => {
        if (!data?.ianaTimezone) return

        const updateTime = () => {
            try {
                const now = new Date()
                const timeString = now.toLocaleTimeString('en-US', {
                    timeZone: data.ianaTimezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                })
                setTime(timeString)
            } catch (e) {
                console.error('Error formatting time:', e)
                setTime('')
            }
        }

        updateTime()
        const interval = setInterval(updateTime, 1000)

        return () => clearInterval(interval)
    }, [data?.ianaTimezone])

    if (!data) {
        return (
            <div className="absolute z-50 bg-white rounded-lg shadow-xl p-4 border border-slate-200 w-80 animate-in fade-in zoom-in-95 duration-200 left-0">
                <div className="flex justify-between items-start gap-3">
                    <div>
                        <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-indigo-500" />
                            地点详情
                        </h3>
                        <p className="text-sm text-slate-600 break-words">{location}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 flex-shrink-0">
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
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <span className="text-slate-500">时区:</span>
                        <span className="font-medium text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-xs">{data.timezone}</span>
                    </div>
                    {time && (
                        <div className="font-mono text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded text-xs">
                            {time}
                        </div>
                    )}
                </div>

                {/* Description */}
                <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {data.description}
                </div>
            </div>
        </div>
    )
}
