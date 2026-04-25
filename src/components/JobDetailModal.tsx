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
  variant?: 'side' | 'center'
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
  onNavigateJob,
  variant = 'side'
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
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-stretch cursor-pointer ${
        variant === 'center' ? 'justify-center items-stretch p-0 sm:items-center sm:p-4 md:p-8' : 'justify-end'
      }`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`relative ${
          variant === 'center'
            ? 'h-full w-full sm:h-auto sm:max-h-[90vh] sm:max-w-[1000px]'
            : 'h-full w-full max-w-full md:max-w-[75vw] lg:max-w-[65vw] xl:max-w-[60vw]'
        }`}
      >
        <div
          ref={modalRef}
          className={`bg-white dark:bg-zinc-900 shadow-xl flex flex-col relative transform transition-all duration-300 overflow-hidden ${
            variant === 'center'
              ? `h-full w-full rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-[1000px] sm:rounded-2xl ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`
              : `h-full w-full max-w-full md:max-w-[75vw] lg:max-w-[65vw] xl:max-w-[60vw] ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <JobDetailPanel
              job={job}
              onSave={onSave}
              isSaved={isSaved}
              onApply={onApply}
              onClose={onClose}
              showCloseButton={true}
              onNavigateJob={onNavigateJob}
              canNavigatePrev={canNavigatePrev}
              canNavigateNext={canNavigateNext}
              showInlineNavigation={variant !== 'center'}
            />
          </div>
        </div>
        {variant === 'center' && jobs.length > 1 && (
          <>
            <div className="pointer-events-none absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 sm:block">
              <button
                type="button"
                onClick={() => handleNavigate('prev')}
                disabled={!canNavigatePrev}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-white/42 text-slate-700 shadow-[0_12px_22px_-22px_rgba(15,23,42,0.24)] backdrop-blur-[6px] transition-all hover:bg-white/68 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="上一个岗位"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="pointer-events-none absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 sm:block">
              <button
                type="button"
                onClick={() => handleNavigate('next')}
                disabled={!canNavigateNext}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-white/42 text-slate-700 shadow-[0_12px_22px_-22px_rgba(15,23,42,0.24)] backdrop-blur-[6px] transition-all hover:bg-white/68 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="下一个岗位"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

export default JobDetailModal
