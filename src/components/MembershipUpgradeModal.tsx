import React from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface MembershipUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  triggerSource: 'referral' | 'ai_resume' | 'general'
}

interface ModalBenefit {
  title: string
  detail: string
}

export const MembershipUpgradeModal: React.FC<MembershipUpgradeModalProps> = ({
  isOpen,
  onClose,
  triggerSource
}) => {
  const navigate = useNavigate()

  if (!isOpen) return null

  const content: {
    title: string
    description: string
    benefits: ModalBenefit[]
  } = {
    referral: {
      title: '解锁完整企业人脉',
      description: '把岗位相关联系人、邮箱直申和关键投递入口一起解锁。',
      benefits: [
        { title: '关键联系人', detail: '完整查看岗位相关 HR 与业务负责人' },
        { title: '邮箱直申', detail: '打开更高价值的直达投递入口' },
        { title: '不限次数', detail: '会员期内持续使用人脉能力' }
      ]
    },
    ai_resume: {
      title: '继续深度打磨简历与面试',
      description: '在已有框架基础上，把简历表达和面试准备继续往前推进。',
      benefits: [
        { title: '简历打磨', detail: '继续优化重点经历与表达结构' },
        { title: '英文面试', detail: '补充更完整的英文练习框架' },
        { title: '模拟回答', detail: '生成更贴近场景的练习参考' }
      ]
    },
    general: {
      title: '解锁更多求职权益',
      description: '把简历优化、关键人脉和投递入口一起解锁，让求职推进更顺畅。',
      benefits: [
        { title: '核心岗位权益', detail: '解锁更完整的求职工具箱' },
        { title: 'AI 助手', detail: '继续使用简历与求职辅助能力' },
        { title: '关键人脉', detail: '查看联系人并打开更高价值入口' }
      ]
    }
  }[triggerSource]

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 cursor-pointer bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[32px] border border-indigo-100 bg-white shadow-[0_36px_120px_-52px_rgba(15,23,42,0.45)] animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 p-2 text-white/80 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#312e81_0%,#4338ca_72%,#6366f1_100%)] px-6 pb-7 pt-7 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.22),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(125,211,252,0.22),_transparent_28%)]" />
          <div className="relative z-10 pr-10">
            <h3 className="text-[30px] font-black leading-tight tracking-tight text-white">
              {content.title}
            </h3>
            <p className="mt-3 max-w-[360px] text-sm leading-6 text-indigo-50/92">
              {content.description}
            </p>
          </div>
        </div>

        <div className="bg-white px-6 pb-6 pt-5">
          <div className="rounded-[26px] border border-slate-100 bg-slate-50/70 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              {content.benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-[22px] border border-white bg-white px-4 py-4 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.28)]">
                  <div className="text-sm font-black text-slate-900">{benefit.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{benefit.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            <button
              onClick={() => {
                onClose()
                navigate('/membership#pricing-plans')
              }}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#312e81_0%,#4f46e5_100%)] px-5 py-3.5 text-sm font-bold text-white shadow-[0_20px_40px_-22px_rgba(79,70,229,0.72)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-22px_rgba(79,70,229,0.8)]"
            >
              查看会员权益
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              稍后再看
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
