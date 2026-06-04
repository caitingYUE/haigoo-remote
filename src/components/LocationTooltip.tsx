import React, { useState, useEffect } from 'react'
import { X, MapPin, Clock } from 'lucide-react'
import { findLocation } from '../data/locations'
import { WorldMap } from './WorldMap'

interface LocationTooltipProps {
    location: string
    onClose: () => void
    floating?: boolean
}

export function LocationTooltip({ location, onClose, floating = false }: LocationTooltipProps) {
    const data = findLocation(location)
    const [time, setTime] = useState<string>('')
    const [beijingTime, setBeijingTime] = useState<string>('')

    useEffect(() => {
        if (!data?.ianaTimezone) return

        const formatTime = (timeZone: string) => new Date().toLocaleTimeString('zh-CN', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })

        const updateTime = () => {
            try {
                setTime(formatTime(data.ianaTimezone))
                setBeijingTime(formatTime('Asia/Shanghai'))
            } catch (e) {
                console.error('Error formatting time:', e)
                setTime('')
                setBeijingTime('')
            }
        }

        updateTime()
        const interval = setInterval(updateTime, 1000)

        return () => clearInterval(interval)
    }, [data?.ianaTimezone])

    if (!data) {
        return (
            <div className={`${floating ? 'relative' : 'absolute left-0'} z-50 bg-white rounded-lg shadow-xl p-4 border border-slate-200 w-80 animate-in fade-in zoom-in-95 duration-200`}>
                <div className="flex justify-between items-start gap-3">
                    <div>
                        <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-indigo-500" />
                            总部地址
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
        <div className={`${floating ? 'relative' : 'absolute left-0 mt-2'} z-50 bg-white rounded-lg shadow-xl border border-slate-200 w-80 animate-in fade-in zoom-in-95 duration-200 overflow-hidden`}>
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
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <span className="text-slate-500">时区:</span>
                        <span className="font-medium text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-xs">{data.timezone}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {time && (
                            <div className="rounded-lg bg-indigo-50 px-2 py-1.5">
                                <div className="text-[10px] font-semibold text-slate-500">当地时间</div>
                                <div className="font-mono text-xs font-semibold text-indigo-600">{time}</div>
                            </div>
                        )}
                        {beijingTime && (
                            <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                                <div className="text-[10px] font-semibold text-slate-500">北京时间</div>
                                <div className="font-mono text-xs font-semibold text-amber-700">{beijingTime}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Description */}
                <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {data.description}
                </div>
            </div>
        </div>
    )
}
