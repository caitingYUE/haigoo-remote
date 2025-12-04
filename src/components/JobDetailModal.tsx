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

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleNavigate('prev')
          }
          break
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleNavigate('next')
          }
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
        className={`bg-white dark:bg-zinc-900 shadow-xl h-full w-full max-w-[95vw] md:max-w-[60vw] lg:max-w-[50vw] xl:max-w-[45vw] flex flex-col relative transform transition-all duration-300 ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
          }`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Navigation Buttons */}
        {jobs.length > 1 && canNavigatePrev && (
          <button
            onClick={() => handleNavigate('prev')}
            onKeyDown={(e) => handleKeyDown(e, () => handleNavigate('prev'))}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title="上一个职位 (Ctrl+←)"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {jobs.length > 1 && canNavigateNext && (
          <button
            onClick={() => handleNavigate('next')}
            onKeyDown={(e) => handleKeyDown(e, () => handleNavigate('next'))}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title="下一个职位 (Ctrl+→)"
          >
            <ChevronRight className="h-6 w-6" />
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
