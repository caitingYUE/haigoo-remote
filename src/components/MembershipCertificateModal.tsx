import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, X } from 'lucide-react'
import { User } from '../types/auth-types'
import { deriveMembershipCapabilities } from '../utils/membership'

interface MembershipCertificateModalProps {
  isOpen: boolean
  onClose: () => void
  user: User
}

function formatCertificateName(name: string) {
  return name.replace(/\s*\((Old Quarter|New Quarter|Quarter|VIP|Starter|Member|Partner)\)\s*/gi, '').trim() || name
}

export const MembershipCertificateModal: React.FC<MembershipCertificateModalProps> = ({ isOpen, onClose, user }) => {
  const certificateRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  if (!isOpen || typeof document === 'undefined') return null

  const handleDownload = async () => {
    if (!certificateRef.current) return

    try {
      setDownloading(true)
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fffdf8',
        logging: false,
      })
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `Haigoo_Club_Certificate_${user.memberDisplayId || '000000'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to generate certificate:', error)
      alert('证书生成失败，请稍后重试')
    } finally {
      setDownloading(false)
    }
  }

  const displayId = (user.memberDisplayId || 0).toString().padStart(6, '0')
  const memberName = formatCertificateName(user.username || user.email.split('@')[0])
  const joinDate = user.memberSince ? new Date(user.memberSince).toLocaleDateString() : new Date().toLocaleDateString()
  const capabilities = deriveMembershipCapabilities(user)
  const memberLevelLabel = capabilities.isTrialMember
    ? 'Trail'
    : ['annual', 'year'].includes(capabilities.memberType)
      ? 'Partner'
      : capabilities.memberType === 'half_year'
        ? 'Member'
        : capabilities.memberType === 'starter'
          ? 'Starter'
          : capabilities.memberType === 'quarter' || capabilities.memberType === 'quarter_pro'
            ? 'VIP'
            : 'Club'

  return createPortal(
    <div className="hg-certificate-modal fixed inset-0 z-[10000] isolate flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="membership-certificate-title">
      <button type="button" aria-label="关闭会员证书弹窗" className="hg-certificate-modal__backdrop fixed inset-0 z-0" onClick={onClose} />

      <div className="hg-certificate-modal__panel relative z-10 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200">
        <header className="hg-certificate-modal__toolbar">
          <div>
            <p className="haigoo-editorial-label">CLUB RECORD · MEMBER EDITION</p>
            <h3 id="membership-certificate-title">您的会员证书</h3>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleDownload} disabled={downloading} className="hg-certificate-modal__save">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? '正在生成' : '保存证书'}
            </button>
            <button type="button" onClick={onClose} className="hg-certificate-modal__close" aria-label="关闭">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="hg-certificate-modal__stage">
          <div ref={certificateRef} className="hg-membership-certificate" style={{ fontFamily: "'Inter', 'Noto Sans SC', sans-serif" }}>
            <div className="hg-membership-certificate__topline">
              <span>HAIGOO REMOTE</span>
              <span>MEMBERSHIP RECORD · {new Date().getFullYear()}</span>
            </div>
            <div className="hg-membership-certificate__main">
              <div>
                <p className="hg-membership-certificate__eyebrow">REMOTE WORK CLUB</p>
                <h1>Haigoo<br />Remote Club</h1>
                <p className="hg-membership-certificate__intro">感谢你为工作和生活，保留更多选择。</p>
              </div>
              <div className="hg-membership-certificate__seal" aria-label={`${memberLevelLabel} member`}>
                <span>CLUB</span>
                <strong>{memberLevelLabel}</strong>
                <i />
              </div>
            </div>
            <div className="hg-membership-certificate__member">
              <p>MEMBER NAME</p>
              <h2>{memberName}</h2>
            </div>
            <div className="hg-membership-certificate__facts">
              <div><span>MEMBER ID</span><strong>NO. {displayId}</strong></div>
              <div><span>MEMBER SINCE</span><strong>{joinDate}</strong></div>
              <div><span>MEMBERSHIP</span><strong>{memberLevelLabel}</strong></div>
            </div>
            <footer className="hg-membership-certificate__footer">
              <span>用你喜欢的方式过一生。</span>
              <span>Be free. Work anywhere. Live fully.</span>
            </footer>
          </div>
        </div>

        <p className="hg-certificate-modal__hint">保存为图片后，可随时留存或分享。</p>
      </div>
    </div>,
    document.body
  )
}
