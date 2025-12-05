import React, { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Job } from '../types'
import { JobDetailPanel } from './JobDetailPanel'

interface JobDetailModalProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
  onSave?: (jobId: string) => void
  isSaved?: boolean
  onApply?: (jobId: string) => void
  jobs?: Job[]
  currentJobIndex?: number
  onNavigateJob?: (direction: 'prev' | 'next') => void
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isOpen,
  onClose,
  onSave,
  isSaved = false,
  onApply,
  jobs = [],
  currentJobIndex = -1,
  onNavigateJob
}) => {
  // 可访问性相关的 refs
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // 存储焦点管理
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
    } else {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    onNavigateJob?.(direction)
  }, [onNavigateJob])

  // 键盘事件处理 - 增强版
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowUp':
        case 'ArrowLeft':
          // 直接支持箭头键导航,无需Ctrl
          e.preventDefault()
          handleNavigate('prev')
          break
        case 'ArrowDown':
        case 'ArrowRight':
          // 直接支持箭头键导航,无需Ctrl
          e.preventDefault()
          handleNavigate('next')
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handleNavigate])

  // 键盘事件处理函数
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isOpen])

  const canNavigatePrev = currentJobIndex > 0
  const canNavigateNext = currentJobIndex < jobs.length - 1

  if (!job || !isOpen) return null
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={modalRef}
        className={`bg-white dark:bg-zinc-900 shadow-xl h-full w-full max-w-[95vw] md:max-w-[75vw] lg:max-w-[65vw] xl:max-w-[60vw] flex flex-col relative transform transition-all duration-300 ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
          }`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Navigation Buttons - Enhanced */}
        {jobs.length > 1 && canNavigatePrev && (
          <button
            onClick={() => handleNavigate('prev')}
            onKeyDown={(e) => handleKeyDown(e, () => handleNavigate('prev'))}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-14 h-14 bg-white/95 backdrop-blur-sm border-2 border-indigo-200 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 group"
            title="上一个职位 (← 或 ↑)"
            aria-label="上一个职位"
          >
            <ChevronLeft className="h-7 w-7 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}

        {jobs.length > 1 && canNavigateNext && (
          <button
            onClick={() => handleNavigate('next')}
            onKeyDown={(e) => handleKeyDown(e, () => handleNavigate('next'))}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-14 h-14 bg-white/95 backdrop-blur-sm border-2 border-indigo-200 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 group"
            title="下一个职位 (→ 或 ↓)"
            aria-label="下一个职位"
          >
            <ChevronRight className="h-7 w-7 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}

        <JobDetailPanel
          job={job}
          onSave={onSave}
          isSaved={isSaved}
          onApply={onApply}
          onClose={onClose}
          showCloseButton={true}
        />
      </div>
    </div>,
    document.body
  )
}

export default JobDetailModal
