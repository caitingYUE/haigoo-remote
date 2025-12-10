import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Mail, MessageCircle } from 'lucide-react'

export interface JobPreferences {
    jobTypes: string[]
    industries: string[]
    locations: string[]
    levels: string[]
    contactEmail?: string
    contactWechat?: string
}

interface JobTrackingModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (preferences: JobPreferences) => void
    initialPreferences?: JobPreferences
    jobTypeOptions: string[]
    industryOptions: string[]
}

const DEFAULT_PREFERENCES: JobPreferences = {
    jobTypes: [],
    industries: [],
    locations: [],
    levels: [],
    contactEmail: '',
    contactWechat: ''
}

const LOCATION_OPTIONS = [
    '中国', '美国', '新加坡', '日本', '韩国', '英国', '德国', '法国',
    '加拿大', '澳大利亚', '荷兰', '瑞士', '瑞典', '挪威', '丹麦',
    '不限地点', '远程', 'Anywhere', 'Remote'
]

const LEVEL_OPTIONS = [
    '实习生/Intern',
    '初级/Junior',
    '中级/Mid-Level',
    '高级/Senior',
    '专家/Expert',
    '经理/Manager',
    '总监/Director',
    'VP及以上/VP+'
]

function fuzzyMatch(input: string, options: string[]): string[] {
    if (!input.trim()) return []
    const lowerInput = input.toLowerCase()
    return options
        .filter(option => option.toLowerCase().includes(lowerInput))
        .slice(0, 10)
}

interface AutocompleteFieldProps {
    label: string
    required?: boolean
    selectedTags: string[]
    onAddTag: (tag: string) => void
    onRemoveTag: (tag: string) => void
    options: string[]
    placeholder: string
}

function AutocompleteField({
    label,
    required = false,
    selectedTags,
    onAddTag,
    onRemoveTag,
    options,
    placeholder
}: AutocompleteFieldProps) {
    const [inputValue, setInputValue] = useState('')
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [showDropdown, setShowDropdown] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleInputChange = (value: string) => {
        setInputValue(value)
        if (value.trim()) {
            const matches = fuzzyMatch(value, options.filter(opt => !selectedTags.includes(opt)))
            setSuggestions(matches)
            setShowDropdown(matches.length > 0)
        } else {
            setShowDropdown(false)
        }
    }

    const handleSelectSuggestion = (suggestion: string) => {
        if (!selectedTags.includes(suggestion)) {
            onAddTag(suggestion)
        }
        setInputValue('')
        setShowDropdown(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const trimmed = inputValue.trim()
            if (trimmed && !selectedTags.includes(trimmed)) {
                onAddTag(trimmed)
                setInputValue('')
                setShowDropdown(false)
            }
        }
    }

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-slate-900 mb-2">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded-full"
                        >
                            {tag}
                            <button
                                onClick={() => onRemoveTag(tag)}
                                className="hover:bg-green-700 rounded-full p-0.5"
                                type="button"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Input Field */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (inputValue.trim()) {
                            const matches = fuzzyMatch(inputValue, options.filter(opt => !selectedTags.includes(opt)))
                            setSuggestions(matches)
                            setShowDropdown(matches.length > 0)
                        }
                    }}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />

                {/* Dropdown Suggestions */}
                {showDropdown && suggestions.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    >
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => handleSelectSuggestion(suggestion)}
                                className="w-full text-left px-4 py-2 hover:bg-slate-100 text-sm transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-xs text-slate-500 mt-1">
                输入关键词搜索或直接输入自定义内容，按 Enter 添加
            </p>
        </div>
    )
}

export function JobTrackingModal({
    isOpen,
    onClose,
    onSave,
    initialPreferences,
    jobTypeOptions,
    industryOptions
}: JobTrackingModalProps) {
    const [preferences, setPreferences] = useState<JobPreferences>(
        initialPreferences || DEFAULT_PREFERENCES
    )

    useEffect(() => {
        if (initialPreferences) {
            setPreferences(initialPreferences)
        }
    }, [initialPreferences])

    const handleSave = () => {
        onSave(preferences)
        onClose()
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1050] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">职位追踪</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            当找不到满意的岗位时，提交您的需求，系统有合适岗位时将通知您
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <p className="text-sm text-slate-600">
                        <span className="text-red-500">*</span> 必填
                    </p>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                        <h3 className="font-semibold text-slate-900">联系方式</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">
                                    <span className="flex items-center gap-2">
                                        <Mail className="w-4 h-4" /> 邮箱
                                    </span>
                                </label>
                                <input
                                    type="email"
                                    value={preferences.contactEmail || ''}
                                    onChange={(e) => setPreferences(prev => ({ ...prev, contactEmail: e.target.value }))}
                                    placeholder="your@email.com"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">
                                    <span className="flex items-center gap-2">
                                        <MessageCircle className="w-4 h-4" /> 微信号
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={preferences.contactWechat || ''}
                                    onChange={(e) => setPreferences(prev => ({ ...prev, contactWechat: e.target.value }))}
                                    placeholder="WeChat ID"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <AutocompleteField
                        label="职位类型"
                        required
                        selectedTags={preferences.jobTypes}
                        onAddTag={(tag) => setPreferences(prev => ({
                            ...prev,
                            jobTypes: [...prev.jobTypes, tag]
                        }))}
                        onRemoveTag={(tag) => setPreferences(prev => ({
                            ...prev,
                            jobTypes: prev.jobTypes.filter(t => t !== tag)
                        }))}
                        options={jobTypeOptions}
                        placeholder="例如：产品经理、软件工程师"
                    />

                    <AutocompleteField
                        label="行业类型"
                        selectedTags={preferences.industries}
                        onAddTag={(tag) => setPreferences(prev => ({
                            ...prev,
                            industries: [...prev.industries, tag]
                        }))}
                        onRemoveTag={(tag) => setPreferences(prev => ({
                            ...prev,
                            industries: prev.industries.filter(t => t !== tag)
                        }))}
                        options={industryOptions}
                        placeholder="例如：互联网、人工智能"
                    />

                    <AutocompleteField
                        label="地点偏好（国家/地区）"
                        selectedTags={preferences.locations}
                        onAddTag={(tag) => setPreferences(prev => ({
                            ...prev,
                            locations: [...prev.locations, tag]
                        }))}
                        onRemoveTag={(tag) => setPreferences(prev => ({
                            ...prev,
                            locations: prev.locations.filter(t => t !== tag)
                        }))}
                        options={LOCATION_OPTIONS}
                        placeholder="例如：中国、美国、新加坡"
                    />

                    <AutocompleteField
                        label="级别偏好"
                        selectedTags={preferences.levels}
                        onAddTag={(tag) => setPreferences(prev => ({
                            ...prev,
                            levels: [...prev.levels, tag]
                        }))}
                        onRemoveTag={(tag) => setPreferences(prev => ({
                            ...prev,
                            levels: prev.levels.filter(t => t !== tag)
                        }))}
                        options={LEVEL_OPTIONS}
                        placeholder="例如：高级/Senior、经理/Manager"
                    />
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setPreferences(DEFAULT_PREFERENCES)}
                            className="px-6 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors"
                        >
                            清空
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all transform hover:scale-105 shadow-lg hover:shadow-slate-900/20"
                        >
                            保存
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
