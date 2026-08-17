import { Image, Input, Text, Textarea, View } from '@tarojs/components'
import Taro, { navigateTo, showToast, switchTab, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import EditorialTopBar from '../../components/editorial-top-bar'
import MiniIcon from '../../components/mini-icon'
import {
  analyzeCareerProfile,
  createMatchApplyTicket,
  fetchMatchFeed,
  fetchCareerMatchState,
  followCompany,
  parseCareerResume,
  saveCareerProfile,
  sendMatchFeedback,
  setMatchNotifications,
  unfollowCompany
} from '../../services/career-match-service'
import type { MatchFeedResponse, MatchRecommendation } from '../../services/career-match-service'
import { trackMiniEvent } from '../../services/analytics-service'
import { loginWithWechat } from '../../services/mini-auth-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import type { CareerCompleteness, CareerIntake, CareerMatchResult, CareerRetentionPolicy } from '../../types'
import { clearLocalMatchDraft, readLocalMatchDraft, saveLocalMatchDraft } from '../../utils/match-draft'
import './index.scss'

type MatchStep = 'intro' | 'profile' | 'questions' | 'analyzing' | 'result' | 'feed'
type PathTier = 'now' | 'bridge' | 'later'

const emptyIntake: CareerIntake = {
  location: '', timezone: '', workMode: '', weeklyHours: 0, availability: '',
  eveningOverlap: '', languages: '', targetRoles: '', careerGoal: '', constraints: ''
}

const retentionOptions: Array<{ value: CareerRetentionPolicy; label: string; detail: string }> = [
  { value: 'session', label: '仅本次', detail: '分析完成后自动删除' },
  { value: '30_days', label: '30 天', detail: '30 天后自动删除，也可随时删除' },
  { value: '90_days', label: '90 天', detail: '90 天后自动删除，方便继续完善' },
  { value: 'long_term', label: '长期', detail: '保留到你主动删除' }
]

const pathLabels: Record<PathTier, string> = { now: '现在适合', bridge: '过渡方向', later: '长期探索' }

function readFileBase64(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (response) => resolve(String(response.data || '')),
      fail: reject
    })
  })
}

export default function MatchPage() {
  const [step, setStep] = useState<MatchStep>('intro')
  const [introMode, setIntroMode] = useState<'resume' | 'manual'>('resume')
  const [sourceType, setSourceType] = useState<'manual' | 'resume'>('manual')
  const [careerText, setCareerText] = useState('')
  const [intake, setIntake] = useState<CareerIntake>(emptyIntake)
  const [retention, setRetention] = useState<CareerRetentionPolicy>('30_days')
  const [consented, setConsented] = useState(false)
  const [completeness, setCompleteness] = useState<CareerCompleteness | null>(null)
  const [questions, setQuestions] = useState<CareerMatchResult['clarificationQuestions']>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [result, setResult] = useState<CareerMatchResult | null>(null)
  const [feed, setFeed] = useState<MatchFeedResponse | null>(null)
  const [expandedCompanyId, setExpandedCompanyId] = useState('')
  const [pathTier, setPathTier] = useState<PathTier>('now')
  const [freeAvailable, setFreeAvailable] = useState(true)
  const [canAssess, setCanAssess] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stateNotice, setStateNotice] = useState('')
  const [profileStage, setProfileStage] = useState<1 | 2>(1)
  const [trustExpanded, setTrustExpanded] = useState(false)
  const user = getMiniUser()
  const authenticated = hasAuthenticatedSession()

  const load = useCallback(async () => {
    if (!hasAuthenticatedSession()) return
    try {
      const state = await fetchCareerMatchState()
      setStateNotice('')
      setFreeAvailable(state.freeAssessmentAvailable)
      setCanAssess(state.canAssess)
      if (state.profile) {
        clearLocalMatchDraft()
        setSourceType(state.profile.source_type)
        setCareerText(state.profile.career_text)
        setIntake({ ...emptyIntake, ...(state.profile.intake || {}) })
        setRetention(state.profile.retention_policy)
        setConsented(true)
        const nextFeed = await fetchMatchFeed()
        setFeed(nextFeed)
        setStep('feed')
      }
      if (!state.profile && state.latestRun?.result) {
        setResult(state.latestRun.result)
        setStep(state.latestRun.status === 'ready' ? 'result' : 'questions')
        if (state.latestRun.status === 'needs_clarification') {
          setQuestions(state.latestRun.clarification_questions || [])
          setAnswers((state.latestRun.clarification_questions || []).map(() => ''))
        }
      }
    } catch (loadError) {
      setStateNotice(loadError instanceof Error && loadError.message
        ? '上次进度没有加载出来，请稍后重试。'
        : 'Match 暂时不可用，你可以先查看结果示例。')
    }
  }, [])

  useDidShow(() => { void load() })

  useEffect(() => {
    const value = readLocalMatchDraft()
    if (!value) return
    if (value.sourceType === 'manual' || value.sourceType === 'resume') {
      setSourceType(value.sourceType)
      setIntroMode(value.sourceType)
    }
    if (typeof value.careerText === 'string') setCareerText(value.careerText)
    if (value.intake && typeof value.intake === 'object') setIntake({ ...emptyIntake, ...value.intake })
    if (retentionOptions.some((item) => item.value === value.retention)) setRetention(value.retention as CareerRetentionPolicy)
    if (typeof value.consented === 'boolean') setConsented(value.consented)
    if (String(value.careerText || '').trim()) setStateNotice('已恢复上次未完成的职业资料。')
  }, [])

  useEffect(() => {
    if (step !== 'profile') return undefined
    const timer = setTimeout(() => {
      saveLocalMatchDraft({ sourceType, careerText, intake, retention, consented })
    }, 400)
    return () => clearTimeout(timer)
  }, [careerText, consented, intake, retention, sourceType, step])

  const updateIntake = (key: keyof CareerIntake, value: string | number) => {
    setIntake((current) => ({ ...current, [key]: value }))
  }

  const ensureAccount = async () => {
    if (hasAuthenticatedSession()) return true
    try {
      const session = await loginWithWechat()
      if (!session.bound) {
        navigateTo({ url: '/pages/account-bind/index' })
        return false
      }
      await load()
      return true
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '微信登录失败，请重试')
      return false
    }
  }

  const startManual = async () => {
    if (!await ensureAccount()) return
    setSourceType('manual')
    setProfileStage(1)
    setStep('profile')
    void trackMiniEvent('mini_match_start', { source: 'manual' })
  }

  const uploadResume = async () => {
    if (!await ensureAccount()) return
    setError('')
    try {
      const selected = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf', 'docx', 'txt'] })
      const file = selected.tempFiles[0]
      if (!file) return
      if (Number(file.size || 0) > 2 * 1024 * 1024) throw new Error('简历不能超过 2MB，请压缩后重试')
      setLoading(true)
      const parsed = await parseCareerResume(file.name || 'resume.pdf', await readFileBase64(file.path))
      setSourceType('resume')
      setCareerText(parsed.careerText)
      setCompleteness(parsed.completeness)
      setProfileStage(1)
      setStep('profile')
      showToast({ title: '简历已读取，联系方式已移除', icon: 'success' })
      void trackMiniEvent('mini_match_resume_parsed', { file_type: (file.name || '').split('.').pop() || 'unknown' })
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : '简历解析失败，请改用手动填写'
      if (!message.includes('cancel')) setError(message)
    } finally {
      setLoading(false)
    }
  }

  const runAnalysis = async (clarificationAnswers: Array<{ question: string; answer: string }> = []) => {
    setError('')
    if (!consented) return setError('请先确认职业资料用途和保存期限')
    if (careerText.trim().length < 80) return setError('请补充至少一段工作或项目经历')
    const updatingExistingProfile = Boolean(feed?.profile.exists)
    if (!canAssess && !updatingExistingProfile) return navigateTo({ url: '/pages/membership/index' })
    setLoading(true)
    setStep('analyzing')
    try {
      const saved = await saveCareerProfile({
        sourceType,
        careerText,
        intake,
        retentionPolicy: retention,
        consentedAt: new Date().toISOString()
      })
      setCompleteness(saved.completeness)
      if (!canAssess && updatingExistingProfile && retention !== 'session') {
        const nextFeed = await fetchMatchFeed()
        setFeed(nextFeed)
        clearLocalMatchDraft()
        setStep('feed')
        void trackMiniEvent('mini_match_profile_updated', { retention })
        return
      }
      const response = await analyzeCareerProfile({
        retentionPolicy: retention,
        ...(retention === 'session' ? { careerText, intake } : {}),
        answers: clarificationAnswers
      })
      setResult(response.result)
      if (response.status === 'needs_clarification') {
        setQuestions(response.result.clarificationQuestions)
        setAnswers(response.result.clarificationQuestions.map(() => ''))
        setStep('questions')
        void trackMiniEvent('mini_match_clarification_view', { count: response.result.clarificationQuestions.length })
      } else {
        clearLocalMatchDraft()
        if (retention === 'session') {
          setStep('result')
          void trackMiniEvent('mini_match_completed', { retention, company_count: response.result.companies.length })
        } else {
          const nextFeed = await fetchMatchFeed()
          setFeed(nextFeed)
          setStep('feed')
          void trackMiniEvent('mini_match_completed', { retention, company_count: nextFeed.recommendations.length })
        }
        setFreeAvailable(false)
      }
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : '分析暂时失败，请稍后重试')
      setProfileStage(2)
      setStep('profile')
    } finally {
      setLoading(false)
    }
  }

  const submitAnswers = () => {
    const payload = questions.map((question, index) => ({ question: question.question, answer: answers[index] || '' })).filter((item) => item.answer.trim())
    if (!payload.length) return setError('至少回答一个问题，或返回完善职业资料')
    void runAnalysis(payload)
  }

  const continueProfile = () => {
    setError('')
    if (careerText.trim().length < 80) {
      setError('请补充至少一段工作或项目经历，建议写清职责、行动和结果。')
      return
    }
    setProfileStage(2)
  }

  const saveDraftAndExit = () => {
    const stored = saveLocalMatchDraft({ sourceType, careerText, intake, retention, consented })
    showToast({ title: stored ? '草稿已保存 24 小时' : '本次资料未保存', icon: stored ? 'success' : 'none' })
    setTimeout(() => { void switchTab({ url: '/pages/companies/index' }) }, 350)
  }

  const activePaths = result?.careerPaths[pathTier] || []
  const readinessCount = result?.remoteReadiness.filter((item) => item.confirmed).length || 0
  const progressLabel = useMemo(() => `${completeness?.completeCount || 0}/${completeness?.total || 4}`, [completeness])

  const updateRecommendation = (companyId: string, updates: Partial<MatchRecommendation>) => {
    setFeed((current) => current ? {
      ...current,
      recommendations: current.recommendations.map((item) => item.companyId === companyId ? { ...item, ...updates } : item)
    } : current)
  }

  const toggleFollow = async (company: MatchRecommendation) => {
    setError('')
    try {
      if (company.isFollowed) await unfollowCompany(company.companyId)
      else await followCompany(company.companyId)
      updateRecommendation(company.companyId, { isFollowed: !company.isFollowed })
      showToast({ title: company.isFollowed ? '已取消关注' : '已关注', icon: 'success' })
      void trackMiniEvent('mini_match_company_follow', { company_id: company.companyId, followed: !company.isFollowed })
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : '操作没有完成，请稍后重试')
    }
  }

  const dismissCompany = async (companyId: string) => {
    await sendMatchFeedback(companyId, 'dismissed')
    setFeed((current) => current ? { ...current, recommendations: current.recommendations.filter((item) => item.companyId !== companyId) } : current)
    void trackMiniEvent('mini_match_company_dismiss', { company_id: companyId })
  }

  const openCompany = (companyId: string) => {
    void sendMatchFeedback(companyId, 'opened')
    navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(companyId)}` })
  }

  const openApplyOpportunity = async (companyId: string) => {
    setError('')
    try {
      const ticket = await createMatchApplyTicket(companyId)
      await navigateTo({ url: `/pages/web-view/index?url=${encodeURIComponent(ticket.url)}` })
      void trackMiniEvent('mini_match_apply_open', { company_id: companyId })
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : '申请入口暂不可用，请稍后重试')
    }
  }

  const enableWechatReminder = async (companyId: string) => {
    const templateId = feed?.capabilities.wechatTemplateId || ''
    if (!templateId) {
      showToast({ title: '站内提醒已开启', icon: 'none' })
      return
    }
    try {
      const authorization = await Taro.requestSubscribeMessage({ tmplIds: [templateId], entityIds: [] })
      const accepted = authorization[templateId] === 'accept'
      await setMatchNotifications(companyId, accepted, accepted ? 'accepted' : 'rejected')
      showToast({ title: accepted ? '微信提醒已开启' : '已保留站内提醒', icon: 'none' })
    } catch {
      await setMatchNotifications(companyId, false, 'unavailable')
      showToast({ title: '已保留站内提醒', icon: 'none' })
    }
  }

  const fitBandLabels: Record<MatchRecommendation['fitBand'], string> = {
    high: '高度匹配', notable: '值得关注', explore: '可以探索'
  }

  return (
    <View className='page-shell match-page'>
      <EditorialTopBar authenticated={authenticated} avatar={user?.avatar} />

      {step === 'intro' ? (
        <>
          <View className='match-hero'>
            <Text className='match-hero__label'>Haigoo Match</Text>
            <Text className='match-hero__title'>找到更适合你的远程方向</Text>
            <Text className='match-hero__copy'>根据你的经历，梳理职业方向并推荐值得了解的远程企业。</Text>
            <View className='match-mode-tabs' aria-role='tablist'>
              <View className={introMode === 'resume' ? 'is-active' : ''} aria-role='tab' aria-selected={introMode === 'resume'} onClick={() => setIntroMode('resume')}>简历匹配</View>
              <View className={introMode === 'manual' ? 'is-active' : ''} aria-role='tab' aria-selected={introMode === 'manual'} onClick={() => setIntroMode('manual')}>手动记录</View>
            </View>
            <View className='match-orbit-wrap'>
              <View
                className={`match-orbit ${loading ? 'match-orbit--disabled' : ''}`}
                aria-role='button'
                aria-label={introMode === 'resume' ? '上传简历开始匹配' : '手动填写职业经历'}
                aria-disabled={loading}
                onClick={loading ? undefined : introMode === 'resume' ? uploadResume : startManual}
              >
                <View className='match-orbit__inner'>
                  <MiniIcon name={introMode === 'resume' ? 'application' : 'edit'} size={38} />
                  <Text className='match-orbit__title'>{loading ? '正在读取' : introMode === 'resume' ? '上传简历' : '开始记录'}</Text>
                  <Text className='match-orbit__meta'>{introMode === 'resume' ? 'PDF / DOCX / TXT · 2MB 内' : '从一段真实经历开始'}</Text>
                </View>
              </View>
            </View>
            <Text className='match-hero__free'>{freeAvailable ? '本次 Match 免费' : user?.isMember ? '可再次 Match' : '本次免费机会已使用'}</Text>
          </View>

          <View className='match-preview'>
            <View className='match-preview__heading'><Text>你会得到</Text><Text>结果示例</Text></View>
            <View className='match-preview__window'>
              <View className='match-preview__sheet'>
                <Text className='match-preview__eyebrow'>你的远程定位</Text>
                <Text className='match-preview__title'>看清优势，再选择远程方向</Text>
                <Text className='match-preview__copy'>从经历中整理优势、短板和还需要确认的信息。</Text>
                <View className='match-preview__metric'><Text>01</Text><View><Text>现在适合</Text><Text>可以优先探索的方向</Text></View></View>
                <View className='match-preview__metric'><Text>02</Text><View><Text>过渡方向</Text><Text>需要继续补充的能力</Text></View></View>
                <View className='match-preview__metric'><Text>03</Text><View><Text>推荐企业</Text><Text>值得进一步了解的远程企业</Text></View></View>
              </View>
            </View>
          </View>

          <View className='match-trust'>
            <View className='match-trust__summary' aria-role='button' aria-expanded={trustExpanded} onClick={() => setTrustExpanded((value) => !value)}>
              <MiniIcon name='shield' size={20} />
              <View><Text>原文件不留存，联系方式会移除</Text><Text>保存多久由你决定</Text></View>
              <Text className='match-trust__toggle'>{trustExpanded ? '收起' : '了解隐私处理'}</Text>
            </View>
            {trustExpanded ? <View className='match-trust__details'>简历读取后会立即删除原文件，并移除姓名、手机号等信息。未完成草稿最多在本机保留 24 小时；选择“仅本次”不会保留草稿。职业资料之后仍可随时删除。</View> : null}
          </View>
          <View className='match-access'>
            <Text className='match-access__title'>推荐仅供参考</Text>
            <Text className='match-access__copy'>企业是否招聘及具体要求，请以官方信息为准。</Text>
            {stateNotice ? <Text className='match-access__notice'>{stateNotice}</Text> : null}
          </View>
        </>
      ) : null}

      {step === 'profile' ? (
        <View className='match-form'>
          <View className='match-stepbar'>
            <View><Text>{profileStage}/3</Text><Text>{profileStage === 1 ? '职业经历' : '工作偏好与保存期限'}</Text></View>
            <Text className='match-stepbar__exit' aria-role='button' onClick={saveDraftAndExit}>{retention === 'session' ? '退出' : '保存并退出'}</Text>
          </View>
          {profileStage === 1 ? <>
            <View className='match-page-heading'><Text>先说说你的工作经历</Text><Text>写下做过的工作、项目和结果。信息不够时，我们会再问几个问题。</Text></View>
            {sourceType === 'resume' ? <View className='match-file-note'><MiniIcon name='shield' size={20} /><Text>已移除姓名和联系方式，请检查职业内容是否准确。</Text></View> : null}
            <View className='match-field'>
              <Text className='match-field__label'>工作、项目与成果</Text>
              <Textarea className='match-textarea match-textarea--career' value={careerText} maxlength={20000} placeholder='例如：过去三年负责 SaaS 产品运营，独立推进用户研究和上线复盘……' onInput={(event) => setCareerText(event.detail.value)} />
            </View>
            {error ? <Text className='match-error'>{error}</Text> : null}
            <View className='match-primary match-submit' aria-role='button' onClick={continueProfile}>继续填写偏好</View>
            <Text className='match-form__back' aria-role='button' onClick={() => setStep('intro')}>返回开始页</Text>
          </> : <>
            <View className='match-page-heading'><Text>说说你想要的工作方式</Text><Text>这些信息只用于 Match，不会公开展示。</Text></View>
            <View className='match-form-grid'>
              <View className='match-field'><Text className='match-field__label'>当前所在地</Text><Input className='match-input' value={intake.location} placeholder='例如：上海' onInput={(event) => updateIntake('location', event.detail.value)} /></View>
              <View className='match-field'><Text className='match-field__label'>所在时区</Text><Input className='match-input' value={intake.timezone} placeholder='例如：UTC+8' onInput={(event) => updateIntake('timezone', event.detail.value)} /></View>
            </View>
            <View className='match-field'><Text className='match-field__label'>希望的工作方式</Text><View className='match-options'>{['全职', '兼职', '合同制', '自由职业'].map((item) => <View className={`match-option ${intake.workMode === item ? 'match-option--active' : ''}`} key={item} aria-role='radio' aria-checked={intake.workMode === item} onClick={() => updateIntake('workMode', item)}>{item}</View>)}</View></View>
            <View className='match-field'><Text className='match-field__label'>目标方向</Text><Input className='match-input' value={intake.targetRoles} placeholder='可以填写多个方向' onInput={(event) => updateIntake('targetRoles', event.detail.value)} /></View>
            <View className='match-field'><Text className='match-field__label'>你现在最想解决的问题</Text><Textarea className='match-textarea' value={intake.careerGoal} maxlength={800} placeholder='例如：希望从线下市场转向可异步协作的远程岗位' onInput={(event) => updateIntake('careerGoal', event.detail.value)} /></View>
            <View className='match-field'><Text className='match-field__label'>现实限制（可选）</Text><Textarea className='match-textarea' value={intake.constraints} maxlength={800} placeholder='可工作时间、语言、家庭安排或不能接受的条件' onInput={(event) => updateIntake('constraints', event.detail.value)} /></View>
            {completeness ? <View className='match-completeness'><View><Text>信息完整度</Text><Text>{progressLabel}</Text></View>{completeness.checks.map((item) => <Text className={item.complete ? 'is-complete' : ''} key={item.key}>{item.complete ? '已填写' : '待补充'} · {item.label}</Text>)}</View> : null}
            <View className='match-retention'>
              <Text className='match-retention__title'>选择保存期限</Text>
              {retentionOptions.map((item) => <View className={`match-retention__item ${retention === item.value ? 'match-retention__item--active' : ''}`} key={item.value} aria-role='radio' aria-checked={retention === item.value} onClick={() => setRetention(item.value)}><View className='match-radio' /><View><Text>{item.label}</Text><Text>{item.detail}</Text></View></View>)}
            </View>
            <View className={`match-consent ${consented ? 'match-consent--active' : ''}`} aria-role='checkbox' aria-checked={consented} onClick={() => setConsented((value) => !value)}><View className='match-check'>{consented ? '✓' : ''}</View><Text>我同意资料仅用于 Match，并按所选期限保存。</Text></View>
            {error ? <Text className='match-error'>{error}</Text> : null}
            <View className='match-primary match-submit' aria-role='button' onClick={() => void runAnalysis()}>{canAssess ? '保存并开始 Match' : '查看会员方案'}</View>
            <Text className='match-form__back' aria-role='button' onClick={() => setProfileStage(1)}>返回职业经历</Text>
          </>}
        </View>
      ) : null}

      {step === 'analyzing' ? (
        <View className='match-analyzing'>
          <View className='match-analyzing__mark'><MiniIcon name='target' size={36} /></View>
          <Text className='match-analyzing__title'>正在整理你的职业方向</Text>
          <Text className='match-analyzing__copy'>资料已保存。你可以先离开，稍后回来查看结果。</Text>
          <View className='match-analyzing__line' />
        </View>
      ) : null}

      {step === 'questions' ? (
        <View className='match-questions'>
          <View className='match-stepbar'><View><Text>3/3</Text><Text>补充与确认</Text></View><Text className='match-stepbar__exit' aria-role='button' onClick={saveDraftAndExit}>{retention === 'session' ? '退出' : '保存并退出'}</Text></View>
          <View className='match-page-heading'><Text>还想了解几件事</Text><Text>只需回答你确定的部分，其他内容可以稍后再补。</Text></View>
          {questions.map((question, index) => <View className='match-question' key={question.question}><Text className='match-question__number'>0{index + 1}</Text><Text className='match-question__title'>{question.question}</Text><Text className='match-question__reason'>{question.reason}</Text><Textarea className='match-textarea' value={answers[index]} maxlength={1000} placeholder='写下你确定的事实' onInput={(event) => setAnswers((current) => current.map((value, itemIndex) => itemIndex === index ? event.detail.value : value))} /></View>)}
          {error ? <Text className='match-error'>{error}</Text> : null}
          <View className='match-primary match-submit' onClick={submitAnswers}>继续分析</View>
          <Text className='match-form__back' onClick={() => setStep('profile')}>返回完善资料</Text>
        </View>
      ) : null}

      {step === 'feed' && feed ? (
        <View className='match-feed'>
          <View className='match-feed__summary'>
            <View>
              <Text className='match-feed__kicker'>今日 Match</Text>
              <Text className='match-feed__title'>今天为你筛了 {feed.recommendations.length} 家</Text>
              <Text className='match-feed__meta'>资料完整度 {Math.round((feed.profile.completeness || 0) * 100)}% · {feed.meta.hasNewData ? '有新的企业动态' : '根据你的最新资料整理'}</Text>
            </View>
            <Text className='match-feed__edit' aria-role='button' onClick={() => { setProfileStage(1); setStep('profile') }}>补充资料</Text>
          </View>

          {feed.followedUpdates.length ? (
            <View className='match-feed__updates'>
              <View className='match-feed__section-title'><Text>关注动态</Text><Text>{feed.followedUpdates.length} 条未读</Text></View>
              {feed.followedUpdates.slice(0, 3).map((update, index) => (
                <View className='match-update-row' key={String(update.inbox_id || index)} onClick={() => openCompany(String(update.company_id || ''))}>
                  <View><Text>{String(update.company_name || '关注的企业')}</Text><Text>{update.has_public_opportunity ? '有新的公开申请机会' : '企业资料有更新'}</Text></View>
                  <MiniIcon name='chevronRight' size={18} />
                </View>
              ))}
            </View>
          ) : null}

          <View className='match-feed__list'>
            <View className='match-feed__section-title'><Text>适合你的企业</Text><Text>{feed.capabilities.isMember ? '会员每轮最多 5 家' : '每轮 3 家'}</Text></View>
            {feed.recommendations.map((company) => {
              const expanded = expandedCompanyId === company.companyId
              return (
                <View className='match-feed-company' key={company.companyId}>
                  <View className='match-feed-company__head' onClick={() => openCompany(company.companyId)}>
                    <View className='match-feed-company__logo'>
                      {company.logoFileId || company.logoUrl
                        ? <Image src={company.logoFileId || company.logoUrl || ''} mode='aspectFit' />
                        : <Text>{company.name.slice(0, 1).toUpperCase()}</Text>}
                    </View>
                    <View className='match-feed-company__identity'><Text>{company.name}</Text><Text>{company.industry}</Text></View>
                    <MiniIcon name='chevronRight' size={19} />
                  </View>
                  <View className='match-feed-company__band'><Text>{fitBandLabels[company.fitBand]}</Text>{company.hasUpdate ? <Text>有更新</Text> : null}</View>
                  {company.reasons.map((reason) => <Text className='match-feed-company__reason' key={reason}>{reason}</Text>)}
                  {expanded ? <Text className='match-feed-company__evidence'>{company.evidenceSummary}</Text> : null}
                  <View className='match-feed-company__actions'>
                    <Text aria-role='button' onClick={() => setExpandedCompanyId(expanded ? '' : company.companyId)}>{expanded ? '收起依据' : '为什么推荐'}</Text>
                    <Text aria-role='button' onClick={() => void toggleFollow(company)}>{company.isFollowed ? '已关注' : '关注'}</Text>
                    {company.isFollowed && feed.capabilities.isMember ? <Text aria-role='button' onClick={() => void enableWechatReminder(company.companyId)}>微信提醒</Text> : null}
                    <Text aria-role='button' onClick={() => void dismissCompany(company.companyId)}>不感兴趣</Text>
                  </View>
                  {company.hasPublicOpportunity ? <View className='match-feed-company__apply' aria-role='button' onClick={() => void openApplyOpportunity(company.companyId)}>查看申请机会</View> : null}
                </View>
              )
            })}
            {!feed.recommendations.length ? (
              <View className='match-feed__empty'><Text>这一轮已经看完了</Text><Text>有新的企业信息或你补充资料后，我们会再为你更新。</Text><View className='match-secondary' onClick={() => { setProfileStage(1); setStep('profile') }}>补充职业资料</View></View>
            ) : null}
          </View>
        </View>
      ) : null}

      {step === 'result' && result ? (
        <View className='match-result'>
          <View className='match-result__hero'>
            <Text className='match-result__label'>适合你的职业方向</Text>
            <Text className='match-result__title'>{result.summary.headline}</Text>
            <Text className='match-result__copy'>{result.summary.positioning}</Text>
            <Text className='match-result__readiness'>已确认 {readinessCount}/{result.remoteReadiness.length} 项远程工作条件</Text>
          </View>

          <View className='match-result__section'>
            <Text className='match-result__heading'>你的优势</Text>
            {result.strengths.slice(0, 4).map((strength) => <View className='match-strength' key={strength.title}><Text>{strength.title}</Text><Text>{strength.explanation}</Text></View>)}
          </View>

          <View className='match-result__section'>
            <Text className='match-result__heading'>职业路径</Text>
            <View className='match-path-tabs'>{(Object.keys(pathLabels) as PathTier[]).map((tier) => <View className={pathTier === tier ? 'is-active' : ''} key={tier} onClick={() => setPathTier(tier)}>{pathLabels[tier]}</View>)}</View>
            {activePaths.length ? activePaths.map((path) => <View className='match-path' key={path.roleName}><Text className='match-path__title'>{path.roleName}</Text><Text className='match-path__why'>{path.whyFit}</Text>{path.mainGaps?.length ? <Text className='match-path__gap'>还需补充：{path.mainGaps.slice(0, 2).join('；')}</Text> : null}</View>) : <Text className='match-result__empty'>信息还不够，完善资料后再看看这个方向。</Text>}
          </View>

          <View className='match-result__section'>
            <Text className='match-result__heading'>值得进一步了解的企业</Text>
            <Text className='match-result__subheading'>企业是否招聘，请以官方信息为准。</Text>
            {result.companies.map((company) => <View className='match-company' key={company.id} onClick={() => navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(company.id)}` })}><View className='match-company__top'><View><Text>{company.name}</Text><Text>{company.industry}</Text></View><MiniIcon name='chevronRight' size={19} /></View><Text className='match-company__reason'>{company.reasons.join(' · ')}</Text></View>)}
          </View>
          <View className='match-result__actions'><View className='match-primary' onClick={() => navigateTo({ url: '/pages/consultation/index?sourcePage=match' })}>咨询职业顾问</View><View className='match-secondary' onClick={() => setStep('profile')}>更新职业资料</View></View>
        </View>
      ) : null}

      {step !== 'profile' && step !== 'questions' && error ? <View className='match-global-error'><Text>{error}</Text><Text onClick={() => setError('')}>关闭</Text></View> : null}
    </View>
  )
}
