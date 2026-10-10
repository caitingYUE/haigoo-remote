import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

export default function MiniProgramMembershipDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { text } = useLanguage()
  const [imageFailed, setImageFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!isOpen) return
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    setImageFailed(false)
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previousOverflow }
  }, [isOpen])
  return <dialog ref={dialog} className="hg-top100-membership-dialog" aria-labelledby="top100-membership-title" aria-describedby="top100-membership-description" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
  }}>
    <section className="hg-top100-membership-dialog__body">
      <button type="button" className="hg-top100-membership-dialog__close" onClick={onClose} aria-label={text('关闭会员二维码','Close membership QR code')} autoFocus><X size={20} aria-hidden="true" /></button>
      <h2 id="top100-membership-title">{text('微信扫码开通会员','Scan in WeChat to join')}</h2>
      <p id="top100-membership-description">{text('当前仅支持小程序开通会员','Membership is currently available through the Mini Program only.')}</p>
      {imageFailed ? <div className="hg-top100-membership-dialog__failed" role="status"><p>{text('二维码暂时无法载入','The QR code could not be loaded.')}</p><button type="button" onClick={() => { setImageFailed(false); setAttempt(value => value + 1) }}>{text('重新载入','Retry')}</button></div> : <img src={`/miniprogram_qrcode.webp${attempt ? `?retry=${attempt}` : ''}`} width={240} height={240} alt={text('Haigoo Remote 微信小程序二维码','Haigoo Remote WeChat Mini Program QR code')} onError={() => setImageFailed(true)} />}
    </section>
  </dialog>
}
