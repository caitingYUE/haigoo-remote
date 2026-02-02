import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Mail, MessageCircle, Upload, FileText, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { trackingService } from '../services/tracking-service'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'

export interface JobPreferences {
    jobTypes: string[]
    industries: string[]
    locations: string[]
    levels: string[]
    contactEmail?: string
    contactWechat?: string
    notes?: string
    resumeName?: string
}

interface JobTrackingModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (preferences: JobPreferences) => void
    initialPreferences?: JobPreferences
    jobTypeOptions: string[]
    industryOptions: string[]
}

export const DEFAULT_PREFERENCES: JobPreferences = {
    jobTypes: [],
    industries: [],
    locations: [],
    levels: [],
    contactEmail: '',
    contactWechat: '',
    notes: '',
    resumeName: ''
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
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { token } = useAuth()

    useEffect(() => {
        if (initialPreferences) {
            setPreferences(initialPreferences)
        }
    }, [initialPreferences])

    const handleSave = () => {
        onSave(preferences)
        onClose()
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setUploadError(null)

        try {
            // Track upload
            trackingService.track('upload_resume', { 
                source: 'job_tracking', 
                file_type: file.type,
                file_size: file.size
            })

            // 1. Upload to server to track source
            if (token) {
                const formData = new FormData()
                formData.append('resume', file)
                formData.append('metadata', JSON.stringify({ source: 'job_tracking' }))

                const resp = await fetch('/api/resumes', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: formData
                })
                
                if (!resp.ok) {
                    console.warn('Background upload failed, but proceeding with local parse')
                }
            }

            // 2. Local parse for immediate UI feedback (optional but good for UX)
            // 调用统一的简历解析/上传服务
            await parseResumeFileEnhanced(file)
            
            setPreferences(prev => ({ ...prev, resumeName: file.name }))
            
        } catch (error) {
            console.error('Upload failed', error)
            setUploadError('上传失败，请稍后重试')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    if (!isOpen) return null

    // Check if resume already exists (from initialPreferences or uploaded)
    // The requirement says: "If the user has already uploaded a resume, this place does not need to show upload resume"
    // We assume that if `initialPreferences.resumeName` is present, it means the user has a resume.
    // However, `initialPreferences` comes from `userPreferences` in JobsPage, which is fetched from `/api/user-profile`.
    // If the backend syncs resume status to preferences, this logic holds.
    // Based on previous code, `resumeName` is part of preferences.
    const hasResume = !!preferences.resumeName

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1050] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header - More Compact */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                            岗位订阅
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            找不到满意的岗位？提交您的需求，有合适岗位时系统将通知您
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content - 2 Column Layout for Compactness */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column: Core Preferences */}
                        <div className="space-y-5">
                             <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                    <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                    基本偏好 <span className="text-red-500 text-xs">*</span>
                                </h3>
                                
                                <div className="space-y-4">
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
                                        placeholder="例如：产品经理"
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
                                        placeholder="例如：互联网"
                                    />
                                </div>
                            </div>

                            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-4">
                                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                    <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                                    详细要求
                                </h3>
                                
                                <div className="space-y-4">
                                    <AutocompleteField
                                        label="地点偏好"
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
                                        placeholder="例如：中国、远程"
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
                                        placeholder="例如：高级/Senior"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Contact & Resume */}
                        <div className="space-y-5">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                    <div className="w-1 h-4 bg-slate-500 rounded-full"></div>
                                    联系方式
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                            邮箱 <span className="text-slate-400 font-normal">(用于接收通知)</span>
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="email"
                                                value={preferences.contactEmail || ''}
                                                onChange={(e) => setPreferences(prev => ({ ...prev, contactEmail: e.target.value }))}
                                                placeholder="your@email.com"
                                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                            微信号 <span className="text-slate-400 font-normal">(方便沟通)</span>
                                        </label>
                                        <div className="relative">
                                            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={preferences.contactWechat || ''}
                                                onChange={(e) => setPreferences(prev => ({ ...prev, contactWechat: e.target.value }))}
                                                placeholder="WeChat ID"
                                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resume Upload - Conditionally Rendered */}
                            {!hasResume && (
                                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                                    <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                        <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                        简历上传 <span className="text-xs font-normal text-slate-500 ml-1">(同步至个人中心)</span>
                                    </h3>
                                    
                                    <div 
                                        onClick={() => !isUploading && fileInputRef.current?.click()}
                                        className={`border-2 border-dashed border-indigo-200 rounded-lg p-4 flex flex-col items-center justify-center transition-colors bg-white/50 ${isUploading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-indigo-50'}`}
                                    >
                                        {isUploading ? (
                                            <div className="flex items-center gap-2 py-1">
                                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                                <span className="text-xs text-indigo-600 font-medium">正在上传...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 py-1">
                                                <Upload className="w-5 h-5 text-indigo-400" />
                                                <span className="text-sm text-indigo-600 font-medium">点击上传文件</span>
                                                <span className="text-xs text-slate-400">(PDF, DOC, DOCX)</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {uploadError && (
                                        <div className="flex items-center gap-2 text-xs text-red-500">
                                            <AlertCircle className="w-3 h-3" />
                                            {uploadError}
                                        </div>
                                    )}
                                    
                                    <input 
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx,.txt"
                                        onChange={handleUpload}
                                        className="hidden"
                                    />
                                </div>
                            )}

                            {/* Supplementary Notes */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    补充说明
                                </label>
                                <textarea
                                    value={preferences.notes || ''}
                                    onChange={(e) => setPreferences(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="其他需求，如：期望薪资、签证需求等..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[80px] resize-y bg-slate-50 focus:bg-white transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - Compact */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <button
                        onClick={() => setPreferences(DEFAULT_PREFERENCES)}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                        清空所有
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-200/50 rounded-lg transition-colors text-sm"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all transform hover:scale-105 shadow-lg hover:shadow-slate-900/20 text-sm flex items-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" />
                            保存追踪
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
