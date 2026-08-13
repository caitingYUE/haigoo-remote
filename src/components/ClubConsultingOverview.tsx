import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, KeyRound, Mail, MessageSquare, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

interface ClubConsultingOverviewProps {
  onRedeemConsultingCard?: () => void
}

interface ConsultingTrustFooterProps {
  onContact: () => void
}

export function ConsultingTrustFooter({ onContact }: ConsultingTrustFooterProps) {
  const { text } = useLanguage()
  const items = [
    {
      title: text('信息安全', 'Private by design'),
      body: text('我们不使用您的任何个人信息，注册邮箱仅用于活跃数据统计和数据隔离。', 'We do not use your personal information. Your registration email is used only for activity statistics and data separation.'),
      icon: ShieldCheck,
    },
    {
      title: text('服务边界清晰', 'Clear scope'),
      body: text('咨询提供职业分析、表达反馈和行动支持，不包含岗位信息售卖、岗位推荐、内推或招聘撮合，也不承诺面试或录用结果。', 'Consulting provides career analysis, communication feedback, and action support. It does not sell job information, recommend roles, arrange referrals or recruitment, or promise interviews or hiring outcomes.'),
      icon: Check,
    },
    {
      title: text('持续整理资源', 'Curated resources'),
      body: text('持续整理远程岗位、企业资料和职业成长内容。', 'We continually curate remote roles, company insight, and career content.'),
      icon: Sparkles,
    },
  ]

  return (
    <section className="hg-consulting-trust-footer" aria-label={text('服务承诺与帮助', 'Service promise and help')}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <article key={item.title}>
            <Icon aria-hidden="true" />
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        )
      })}
      <article className="hg-consulting-trust-footer__help">
        <h3>{text('需要帮助？', 'Need help?')}</h3>
        <p>{text('服务安排、咨询卡或账户问题，均可通过微信或邮件联系我们。', 'Contact us by WeChat or email for service, consultation-card, or account questions.')}</p>
        <button type="button" onClick={onContact}>
          {text('联系顾问', 'Contact an advisor')}
          <ArrowRight aria-hidden="true" />
        </button>
      </article>
    </section>
  )
}

export default function ClubConsultingOverview({ onRedeemConsultingCard }: ClubConsultingOverviewProps) {
  const { text } = useLanguage()
  const [contactOpen, setContactOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!contactOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContactOpen(false)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'))
        .filter((item) => !item.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus()
    }
  }, [contactOpen])

  const stories = [
    {
      number: '01',
      title: text('“申请很多，却迟迟没有回复。”', '“I apply often, but rarely hear back.”'),
      body: text('我们会检查目标方向、经历表达和行动节奏，找出影响结果的关键环节。', 'We review direction, positioning, and execution to identify what is affecting results.'),
    },
    {
      number: '02',
      title: text('“做过很多项目，但不知道怎么说清楚。”', '“I have done a lot, but cannot explain it clearly.”'),
      body: text('经历需要有清晰的表达。我们会梳理成果、难点和可迁移能力。', 'Experience needs a clear narrative. We identify outcomes, complexity, and transferable strengths.'),
    },
    {
      number: '03',
      title: text('“想转型，又判断不准从哪里开始。”', '“I want to transition, but cannot judge where to begin.”'),
      body: text('我们会评估可迁移能力、需要补充的证明，以及眼下更值得投入的方向。', 'We assess transferable strengths, missing evidence, and where your effort matters most now.'),
    },
    {
      number: '04',
      title: text('“每个选择都好像有代价。”', '“Every choice seems to come with a cost.”'),
      body: text('限制、目标和优先级会影响选择。理清取舍后，决定会更稳妥。', 'Constraints, goals, and priorities shape each choice. Clear trade-offs support better decisions.'),
    },
  ]

  const outcomes = [
    {
      number: '01',
      title: text('明确关键问题', 'Clarify the question'),
      body: text('确认当前最需要处理的是方向、经历表达、能力缺口，还是现实约束。', 'Identify whether direction, experience communication, a capability gap, or a practical constraint needs attention.'),
    },
    {
      number: '02',
      title: text('建立判断', 'Build judgment'),
      body: text('梳理目标、优势、限制和行动空间，形成清晰的选择标准与优先级。', 'Organise goals, strengths, limits, and room to act into clear criteria and priorities.'),
    },
    {
      number: '03',
      title: text('获得可继续使用的材料', 'Receive reusable materials'),
      body: text('根据实际问题提供简历建议、行动清单、表达框架或阶段性准备材料。', 'Receive resume guidance, an action list, a communication framework, or staged preparation material based on the real question.'),
    },
  ]

  const capabilities = [
    text('职业方向与申请建议', 'Career direction and application guidance'),
    text('简历诊断及职业发展评估', 'Resume diagnosis and career development assessment'),
    text('中 / 英文简历优化', 'Chinese / English resume improvement'),
    text('一对一专业语音咨询', 'One-to-one professional voice consultation'),
    text('定制远程求职准备材料', 'Custom remote job-search preparation materials'),
    text('定制简历、Cover Letter与指导', 'Custom resume, cover letter, and guidance'),
    text('数百个远程企业人脉和资源', 'Hundreds of remote-company contacts and resources'),
  ]

  return (
    <div data-testid="club-consulting-overview" className="hg-consulting-page bg-[#fffdf8] px-4 pb-16 pt-5 sm:px-7 sm:pt-8 lg:px-10 lg:pb-24">
      <section className="mx-auto grid max-w-[1320px] gap-10 border-b border-[#deddd7] pb-12 pt-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.55fr)] lg:items-end lg:pb-16 lg:pt-12">
        <div className="min-w-0">
          <div className="hg-product-kicker">HAIGOO CAREER CONSULTING</div>
          <h1 className="mt-5 max-w-[780px] font-[var(--font-display)] text-[clamp(2.6rem,4.5vw,5rem)] font-medium leading-[0.98] tracking-[-0.055em] text-[#101829] [overflow-wrap:anywhere] [word-break:break-word]">
            {text('职业咨询，从具体问题开始', 'Career consulting starts with a specific question')}
          </h1>
          <p className="mt-7 max-w-[760px] text-[15px] leading-8 text-slate-600 sm:text-[17px]">
            {text('围绕经历、现实限制和长期目标梳理现状，明确现在需要解决的问题和下一步重点。', 'Review experience, practical constraints, and long-term goals to clarify what needs attention now and what to pursue next.')}
          </p>
        </div>
        <div className="min-w-0 border-l border-[#deddd7] pl-0 lg:pl-7">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-600">
            {[text('方向判断', 'Direction'), text('转型梳理', 'Transition'), text('简历表达', 'Resume'), text('成长规划', 'Growth')].map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <button ref={triggerRef} type="button" onClick={() => setContactOpen(true)} className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 bg-[#b7791f] px-7 text-base font-bold text-white shadow-[0_18px_38px_-22px_rgba(183,121,31,0.65)] transition-colors hover:bg-[#8f5e19] sm:w-auto">
            {text('预约顾问咨询', 'Book a consultation')}
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-500">{text('添加顾问后说明你的情况，我们会确认服务范围和安排。', 'Tell the advisor about your situation and we will confirm the scope and arrangement.')}</p>
          {onRedeemConsultingCard ? <button type="button" onClick={onRedeemConsultingCard} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#8f5e19] hover:text-[#6f4711]"><KeyRound className="h-4 w-4" />{text('咨询卡兑换', 'Redeem a consultation card')}</button> : null}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] py-14 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <div className="hg-product-kicker">REAL MOMENTS</div>
            <h2 className="mt-4 max-w-md font-[var(--font-display)] text-[clamp(2rem,3.7vw,4.25rem)] font-medium leading-[1.02] tracking-[-0.045em] text-[#101829]">{text('你可能正遇到这些时刻', 'You may be in one of these moments')}</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-500">{text('职业问题往往涉及多个因素。我们会将模糊的焦虑整理成可以判断的事实。', 'Career questions often involve several factors. We turn vague worry into facts you can examine.')}</p>
          </div>
          <div className="grid md:grid-cols-2">
            {stories.map((story) => (
              <article key={story.number} className="hg-consulting-story md:px-7 md:first:pl-0 md:nth-[2]:pr-0 md:nth-[4]:pr-0">
                <div className="font-[var(--font-display)] text-3xl text-[#718d80]">{story.number}</div>
                <h3 className="mt-8 text-lg font-bold leading-7 text-[#101829]">{story.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{story.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#deddd7] bg-[#f4f6f4]">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-0 py-14 lg:grid-cols-[0.82fr_1.18fr] lg:py-20">
          <div className="px-4 sm:px-7 lg:px-10 xl:px-0">
            <div className="hg-product-kicker">WHAT REMAINS</div>
          <h2 className="mt-4 max-w-lg font-[var(--font-display)] text-[clamp(2.2rem,4vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.045em] text-[#101829]">{text('咨询结论与后续材料', 'Consulting outcomes and follow-up material')}</h2>
          </div>
          <div className="px-4 sm:px-7 lg:px-10 xl:px-0">
            {outcomes.map((outcome) => (
              <article key={outcome.number} className="hg-consulting-outcome">
                <div className="font-[var(--font-display)] text-2xl text-[#718d80]">{outcome.number}</div>
                <div><h3 className="text-lg font-bold text-[#101829]">{outcome.title}</h3><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{outcome.body}</p></div>
              </article>
            ))}
            <p className="mt-5 border-l-2 border-[#718d80] pl-4 text-sm leading-7 text-slate-600">{text('交付内容会结合你的问题调整，服务安排也会据此确认。', 'Deliverables and service arrangements are adjusted to your actual question.')}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-10 py-14 lg:grid-cols-[0.72fr_1.28fr] lg:py-20">
        <div>
          <div className="hg-product-kicker">SERVICE CAPABILITIES</div>
          <h2 className="mt-4 font-[var(--font-display)] text-[clamp(2rem,3.4vw,3.8rem)] font-medium leading-[1.03] tracking-[-0.04em] text-[#101829]">{text('根据问题，选择需要的支持', 'Support shaped around the question')}</h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-500">{text('以下为可提供的服务能力，具体范围会在沟通后确认。', 'These are available capabilities. The scope is confirmed after a conversation.')}</p>
        </div>
        <div>
          {capabilities.map((item, index) => (
            <div key={item} className="hg-consulting-capability">
              <span className="flex items-center gap-4 text-sm font-bold text-[#101829]"><span className="text-xs font-semibold text-slate-400">0{index + 1}</span>{item}</span>
              <Check className="h-4 w-4 shrink-0 text-[#31594e]" />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-10 border-t border-[#deddd7] py-12 lg:grid-cols-[0.72fr_1.28fr] lg:py-16">
        <div>
          <div className="hg-product-kicker">BEFORE YOU START</div>
          <h2 className="mt-4 font-[var(--font-display)] text-[clamp(2rem,3.2vw,3.5rem)] font-medium leading-[1.03] tracking-[-0.04em] text-[#101829]">{text('开始前，你可能还想知道', 'A few things before you start')}</h2>
        </div>
        <div className="divide-y divide-[#deddd7] border-t border-[#deddd7]">
          {[
            {
              question: text('咨询只适合远程求职吗？', 'Is consulting only for remote job searches?'),
              answer: text('可以讨论整体职业规划、转型判断、当前岗位成长、简历表达和求职准备。远程工作是其中一个常见场景。', 'You can discuss career planning, transitions, growth in your current role, resume communication, and job-search preparation. Remote work is one common context.'),
            },
            {
              question: text('方向还不清楚时，咨询会如何展开？', 'How does consulting work when my direction is unclear?'),
              answer: text('顾问会从经历、限制和目标入手，梳理判断维度。选择仍由你做出，过程会有更明确的依据。', 'The advisor starts with your experience, constraints, and goals, then helps define decision criteria. You keep ownership of the choice with clearer evidence behind it.'),
            },
            {
              question: text('咨询前需要准备什么？', 'What should I prepare?'),
              answer: text('建议准备现有简历、目标或困惑，以及最希望解决的一个问题。材料暂不完整时，请直接说明情况。', 'Bring your current resume, goals or concerns, and the one question you most want to solve. If materials are incomplete, simply let us know.'),
            },
          ].map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-[#101829] marker:content-none"><span>{item.question}</span><span className="text-xl font-normal text-[#31594e] transition-transform group-open:rotate-45">＋</span></summary>
              <p className="max-w-3xl pr-10 pt-3 text-sm leading-7 text-slate-500">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <ConsultingTrustFooter onContact={() => setContactOpen(true)} />

      {contactOpen ? (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label={text('关闭联系顾问窗口', 'Close contact dialog')} className="hg-contact-dialog-backdrop absolute inset-0 cursor-default" onClick={() => setContactOpen(false)} />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="haigoo-contact-title" className="hg-contact-dialog relative z-10 p-5 sm:p-7">
            <button ref={closeButtonRef} type="button" aria-label={text('关闭', 'Close')} onClick={() => setContactOpen(false)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center border border-[#deddd7] text-slate-500 hover:bg-[#f4f6f4]"><X className="h-5 w-5" /></button>
            <div className="hg-product-kicker">CONTACT</div>
            <h2 id="haigoo-contact-title" className="mt-3 pr-12 font-[var(--font-display)] text-3xl font-medium tracking-[-0.035em] text-[#101829]">{text('联系 Haigoo 顾问', 'Contact a Haigoo advisor')}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">{text('扫码添加企业微信，简单说明你的职业阶段、目标，以及现在最困扰的一个问题。', 'Scan the QR code and briefly share your career stage, goal, and the one issue that is most difficult right now.')}</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
              <div className="mx-auto w-[180px] border border-[#deddd7] bg-white p-2"><img src="/series_assistant.png" alt={text('Haigoo 顾问企业微信二维码', 'Haigoo advisor WeChat QR code')} className="aspect-square w-full object-contain" /></div>
              <div>
                <div className="flex items-start gap-3 border-t border-[#deddd7] py-4"><MessageSquare className="mt-0.5 h-4 w-4 text-[#31594e]" /><span className="text-sm leading-6 text-slate-600">{text('添加后直接留言即可，顾问会与你确认问题与服务范围。', 'Leave a message after adding the advisor. They will confirm the question and scope with you.')}</span></div>
                <a href="mailto:hi@haigooremote.com" className="flex min-h-12 items-center gap-3 border-y border-[#deddd7] text-sm font-bold text-[#101829] no-underline hover:text-[#31594e] hover:no-underline"><Mail className="h-4 w-4 text-[#31594e]" />hi@haigooremote.com</a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
