import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Share2, X } from 'lucide-react'
import { trackingService } from '../services/tracking-service'
import { getShareLink } from '../utils/share-link-helper'

interface ShareJobModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  companyName: string
}

export const ShareJobModal: React.FC<ShareJobModalProps> = ({ isOpen, onClose, jobId, jobTitle, companyName }) => {
  const [copied, setCopied] = useState(false)
  if (!isOpen) return null

  const shareUrl = getShareLink(jobId)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      trackingService.track('share_job_copy', { jobId, from: 'modal' })
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy the job link:', error)
    }
  }

  return createPortal(
    <div className="hg-share-dialog fixed inset-0 z-[10000] isolate flex items-center justify-center p-4" onClick={onClose}>
      <div className="hg-share-dialog__scrim fixed inset-0 z-0" aria-hidden="true" />
      <section className="hg-share-dialog__panel relative z-10 w-full max-w-[40rem] animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="share-job-title" onClick={(event) => event.stopPropagation()}>
        <header className="hg-share-dialog__header">
          <div className="flex items-center gap-3">
            <span className="hg-share-dialog__mark" aria-hidden="true"><Share2 className="h-4 w-4" /></span>
            <div>
              <p className="haigoo-editorial-label">SHARE A ROLE</p>
              <h3 id="share-job-title">分享职位</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="hg-share-dialog__close" aria-label="关闭分享窗口"><X className="h-5 w-5" /></button>
        </header>

        <div className="hg-share-dialog__body">
          <div className="hg-share-dialog__role">
            <span>正在分享</span>
            <strong>{jobTitle}</strong>
            <p>{companyName}</p>
          </div>
          <label className="hg-share-dialog__link-label" htmlFor="share-job-link">职位链接</label>
          <div className="hg-share-dialog__link">
            <input id="share-job-link" type="text" readOnly value={shareUrl} onClick={(event) => event.currentTarget.select()} />
            <button type="button" onClick={handleCopy} aria-live="polite">
              {copied ? <><Check className="h-4 w-4" />已复制</> : <><Copy className="h-4 w-4" />复制链接</>}
            </button>
          </div>
          <p className="hg-share-dialog__hint">复制后发送给朋友，对方可直接查看该职位详情。</p>
        </div>
      </section>
    </div>
    , document.body
  )
}
