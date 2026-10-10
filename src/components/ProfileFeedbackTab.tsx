import {top100FeedbackSourceUrl} from '../utils/company-top100-navigation'
import {useLanguage} from '../contexts/LanguageContext'
import {useState,useEffect,useRef,useCallback} from 'react'
import {useLocation} from 'react-router-dom'
import {useAuth} from '../contexts/AuthContext'
import {useNotificationHelpers} from './NotificationSystem'
import {trackingService} from '../services/tracking-service'

export default function ProfileFeedbackTab() {
    const {text} = useLanguage()
    const {token} = useAuth()
    const location = useLocation()
    const {showError,showSuccess} = useNotificationHelpers()
    const [accuracy, setAccuracy] = useState<'accurate' | 'inaccurate' | 'unknown'>('unknown')
    const [content, setContent] = useState('')
    const [contact, setContact] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [myFeedbacks, setMyFeedbacks] = useState<any[]>([])
    const query = new URLSearchParams(location.search)
    const feedbackSource = query.get('source') || 'profile_feedback'
    const companyName = feedbackSource==='company_top100' ? query.get('companyName')?.slice(0,120) : null
    const rankingVersion = feedbackSource==='company_top100' ? query.get('rankingVersion')?.slice(0,64) : null
    const [historyStatus,setHistoryStatus] = useState<'loading'|'ready'|'error'>('loading')
    const mounted = useRef(true)
    const submission = useRef<AbortController | null>(null)
    useEffect(() => {mounted.current=true; return () => {mounted.current=false; submission.current?.abort()} }, [])

    const fetchMyFeedbacks = useCallback(async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(),15000)
      try {
        setHistoryStatus('loading')
        const res = await fetch('/api/user-profile?action=my_feedbacks', {
          headers: { Authorization: `Bearer ${token}` }, signal:controller.signal
        })
        const data = await res.json()
        if (!mounted.current) return
        if (res.ok && data.success && Array.isArray(data.feedbacks)) {
          setHistoryStatus('ready')
          setMyFeedbacks(data.feedbacks || [])
        } else {setHistoryStatus('error')}
      } catch (e) {
        if(mounted.current)setHistoryStatus('error')
        console.error('Failed to fetch feedbacks', e)
      } finally {clearTimeout(timer)}
    }, [token])

    useEffect(() => {
      fetchMyFeedbacks()
    }, [fetchMyFeedbacks])

    const submit = async () => {
      if(submission.current)return
      if (!content.trim()) { showError(text('请填写反馈内容','Enter your feedback.')); return }
      const controller = new AbortController()
      submission.current = controller
      const timer = setTimeout(() => controller.abort(),20000)
      try {
        setSubmitting(true)
        const r = await fetch('/api/user-profile?action=submit_feedback', {
          method: 'POST', signal:controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            accuracy,
            content,
            contact,
            source: feedbackSource,
            sourceUrl: feedbackSource==='company_top100' ? top100FeedbackSourceUrl(location.pathname,location.search) : `${location.pathname}${location.search || ''}`
          })
        })
        const j = await r.json()
        if(!mounted.current)return
        if (r.ok && j.success) {
          trackingService.track('feedback_submit', {
            page_key: 'profile',
            module: 'feedback_tab',
            feature_key: 'platform_feedback',
            source_key: feedbackSource
          })
          if(!mounted.current)return
          showSuccess(text('反馈已提交','Feedback sent'));
          setAccuracy('unknown');
          setContent('');
          setContact('');
          fetchMyFeedbacks(); // Refresh list
        }
        else { showError(text('提交失败','Feedback could not be sent'),j.error || text('请稍后重试','Please retry shortly.')) }
      } catch (e) {
        if(mounted.current)showError(text('提交状态未确认','Submission status unconfirmed'), controller.signal.aborted ? text('请求超时，草稿已保留。请先重新载入历史记录，确认未收到后再提交。','The request timed out. Your draft is preserved. Reload feedback history before submitting again.') : text('网络异常，草稿已保留。请先核对历史记录，再决定是否重试。','Your draft is preserved. Check feedback history before retrying.'))
      } finally { clearTimeout(timer); submission.current=null; if(mounted.current)setSubmitting(false) }
    }

    return (
      <div className="hg-profile-document hg-feedback space-y-6">
        <div className="hg-profile-document__header flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{text('我要反馈','Send feedback')}</h2>
            <p className="text-slate-500 mt-1">{text('反馈岗位或平台信息问题与建议。','Report a role, research or platform issue.')}</p>
          </div>
        </div>

        {feedbackSource==='company_top100' && <p className="hg-profile-document__sheet p-4">{text('Top 100 研究纠错','Top 100 research update')}{companyName ? ` · ${companyName}` : ''}{rankingVersion ? ` · ${rankingVersion}` : ''}。{text('企业与研究版本会随反馈一并记录。','The company and research edition will be included with your feedback.')}</p>}
        <div className="hg-profile-document__sheet p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-3">{text('信息准确度','Information accuracy')}</label>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="profile-feedback-accuracy"
                    checked={accuracy === 'accurate'}
                    onChange={() => setAccuracy('accurate')}
                    className="text-[#466f9d] focus:ring-[#466f9d]"
                  />
                  <span className="text-sm text-slate-700">{text('准确','Accurate')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="profile-feedback-accuracy"
                    checked={accuracy === 'inaccurate'}
                    onChange={() => setAccuracy('inaccurate')}
                    className="text-[#466f9d] focus:ring-[#466f9d]"
                  />
                  <span className="text-sm text-slate-700">{text('不准确','Inaccurate')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="profile-feedback-accuracy"
                    checked={accuracy === 'unknown'}
                    onChange={() => setAccuracy('unknown')}
                    className="text-[#466f9d] focus:ring-[#466f9d]"
                  />
                  <span className="text-sm text-slate-700">{text('不确定','Unsure')}</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2" htmlFor="profile-feedback-content">{text('反馈内容','Feedback')}</label>
              <textarea id="profile-feedback-content"
                rows={5}
                value={content}
                onChange={e => setContent(e.target.value)}
                className="hg-profile-document__field w-full border p-3 outline-none transition-all"
                placeholder={text('请描述遇到的问题，或希望我们改进的地方','Describe the issue or what you would like improved.')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2" htmlFor="profile-feedback-contact">{text('联系方式（可选）','Contact details (optional)')}</label>
              <input id="profile-feedback-contact"
                value={contact}
                onChange={e => setContact(e.target.value)}
                className="hg-profile-document__field w-full border p-3 outline-none transition-all"
                placeholder={text('邮箱或微信','Email or WeChat')}
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button" onClick={submit}
                disabled={submitting}
                className="hg-profile-document__primary-action px-6 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? text('提交中…','Sending…') : text('提交反馈','Send feedback')}
              </button>
            </div>
          </div>
        </div>

        {/* Feedback History */}
        <div className="hg-profile-document__sheet overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <h3 className="font-bold text-slate-900">{text('历史反馈记录','Feedback history')}</h3>
            <button type="button" className="hg-profile-document__primary-action px-4" disabled={historyStatus==='loading'} onClick={fetchMyFeedbacks}>{text('重新载入记录','Reload history')}</button>
          </div>
          <div className="divide-y divide-slate-100">
            {historyStatus==='loading' ? <p className="p-6" role="status">{text('正在载入反馈记录…','Loading feedback history…')}</p> : historyStatus==='error' ? <div className="p-6"><p>{text('反馈记录暂不可用。','Feedback history is temporarily unavailable.')}</p><button type="button" className="hg-profile-document__primary-action min-h-11 px-4" onClick={fetchMyFeedbacks}>{text('重新载入','Retry')}</button></div> : myFeedbacks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">{text('暂无反馈记录','No feedback yet')}</div>
            ) : (
              myFeedbacks.map(item => (
                <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-medium px-2 py-1 border ${item.accuracy === 'accurate' ? 'bg-green-100 text-green-700' :
                      item.accuracy === 'inaccurate' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                      {item.accuracy === 'accurate' ? text('准确','Accurate') : item.accuracy === 'inaccurate' ? text('不准确','Inaccurate') : text('平台建议/未知','Suggestion / unsure')}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-800 text-sm mb-3 whitespace-pre-wrap">{item.content}</p>
                  {item.replyContent && (
                    <div className="mt-3 border border-[#dce9f5] bg-[#eff5fb] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-[#345d88]">{text('管理员回复','Admin reply')}</span>
                        <span className="text-xs text-[#7f9fbc]">{new Date(item.repliedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-[#243f5c]">{item.replyContent}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

