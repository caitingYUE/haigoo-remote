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
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-stretch ${
        variant === 'center' ? 'justify-center items-center p-4 md:p-8' : 'justify-end'
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
        ref={modalRef}
        className={`bg-white dark:bg-zinc-900 shadow-xl flex flex-col relative transform transition-all duration-300 overflow-y-auto ${
          variant === 'center'
            ? `rounded-2xl w-full max-w-[1000px] h-auto max-h-[90vh] ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`
            : `h-full w-full max-w-full md:max-w-[75vw] lg:max-w-[65vw] xl:max-w-[60vw] ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`
        }`}
        onClick={(e) => e.stopPropagation()}
      >

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
        />
      </div>
    </div>,
    document.body
  )
}

export default JobDetailModal
