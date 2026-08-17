import { Checkbox, CheckboxGroup, Image, Input, Radio, RadioGroup, Text, Textarea, View } from '@tarojs/components'
import { navigateTo, showModal, useDidShow, useRouter, vibrateShort } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { MINI_PRIVACY_VERSION } from '../../config/legal'
import { createRequestKey } from '../../services/api-client'
import { trackMiniEvent } from '../../services/analytics-service'
import { fetchConsultations, submitConsultation } from '../../services/content-service'
import { loginWithWechat } from '../../services/mini-auth-service'
import { hasAuthenticatedSession } from '../../services/session'
import type { ConsultationRequest } from '../../types'
import './index.scss'

const TOPICS = [
  { value: 'career_direction', label: '职业方向' },
  { value: 'resume', label: '简历与个人表达' },
  { value: 'remote_search', label: '远程职业准备' },
  { value: 'interview', label: '面试准备' },
  { value: 'membership', label: '会员方案咨询' },
  { value: 'other', label: '其他问题' }
]

export default function ConsultationPage() {
  const router = useRouter()
  const [topicIndex, setTopicIndex] = useState(0)
  const [wechatId, setWechatId] = useState('')
  const [question, setQuestion] = useState('')
  const [consented, setConsented] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)
  const [history, setHistory] = useState<ConsultationRequest[]>([])

  const refresh = useCallback(async () => {
    if (!hasAuthenticatedSession()) return
    const result = await fetchConsultations().catch(() => null)
    if (result) setHistory(result.consultations)
  }, [])
  useDidShow(() => { void refresh() })

  const ensureBound = async () => {
    if (hasAuthenticatedSession()) return true
    const result = await showModal({ title: '请先登录', content: '登录后可以提交咨询并查看记录。', confirmText: '去登录' })
    if (result.confirm) {
      const session = await loginWithWechat().catch(() => null)
      navigateTo({ url: session?.bound ? '/pages/consultation/index' : '/pages/account-bind/index' })
    }
    return false
  }

  const handleSubmit = async () => {
    setFormError('')
    if (!await ensureBound()) return
    if (!/^[A-Za-z0-9_@+.-]{2,64}$/.test(wechatId.trim())) {
      setFormError('请检查微信号，只能包含字母、数字和 _ @ + . -')
      return
    }
    if (!consented) {
      setFormError('提交前请阅读并同意隐私政策。')
      return
    }
    setSubmitting(true)
    try {
      await submitConsultation({
        topic: TOPICS[topicIndex].value,
        wechatId: wechatId.trim(),
        question: question.trim(),
        sourcePage: String(router.params.sourcePage || 'mini_consultation'),
        sourceContentId: String(router.params.sourceContentId || '') || undefined,
        sourceCompanyId: String(router.params.sourceCompanyId || '') || undefined,
        idempotencyKey: createRequestKey('consultation'),
        privacyVersion: MINI_PRIVACY_VERSION,
        acceptedAt: new Date().toISOString()
      })
      setSuccess(true)
      void vibrateShort({ type: 'light' }).catch(() => undefined)
      void trackMiniEvent('mini_consultation_submitted', { topic: TOPICS[topicIndex].value, source_page: String(router.params.sourcePage || 'mini_consultation') })
      await refresh()
    } catch (error) {
      showModal({ title: '提交未完成', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false })
    } finally { setSubmitting(false) }
  }

  if (success) return (
    <View className='page-shell consultation-success'>
      <View className='consultation-success__mark' />
      <Text className='consultation-success__eyebrow'>提交成功</Text><Text className='consultation-success__title'>我们已经收到你的问题</Text><Text className='consultation-success__copy'>顾问会通过微信联系你。也可以长按二维码主动添加。</Text>
      <View className='consultation-success__qr surface-card'><Image src='/assets/haigoo-advisor.png' mode='aspectFit' /></View>
      <Text className='consultation-success__note'>请在添加好友时备注“Haigoo 小程序咨询”</Text>
      <View className='primary-button consultation-success__action' aria-role='button' onClick={() => setSuccess(false)}>查看咨询记录</View>
    </View>
  )

  return (
    <View className='page-shell consultation-page'>
      <View className='consultation-heading'><Text className='page-heading'>职业咨询</Text><Text className='page-subtitle'>说说你现在遇到的问题，不用提前准备完整答案。</Text></View>
      <View className='consultation-prompts'><Text className='consultation-prompts__title'>你可以聊这些</Text><Text>· 换方向时，怎样用好过去的经验</Text><Text>· 远程求职准备了很久，问题出在哪里</Text><Text>· 怎样把自己的经历和价值讲清楚</Text></View>
      <View className='consultation-form'>
        <View className='consultation-field'><Text className='consultation-field__label'>咨询方向</Text><RadioGroup className='consultation-topics' onChange={(event) => setTopicIndex(Math.max(0, TOPICS.findIndex((item) => item.value === event.detail.value)))}>{TOPICS.map((item, index) => <View className='consultation-topic' key={item.value}><Radio value={item.value} checked={topicIndex === index} color='#182033' /><Text>{item.label}</Text></View>)}</RadioGroup></View>
        <View className='consultation-field'><Text className='consultation-field__label'>微信号</Text><Input className='consultation-field__input' value={wechatId} onInput={(event) => { setWechatId(event.detail.value); setFormError('') }} placeholder='方便顾问联系你' maxlength={64} /><Text className='consultation-field__helper'>仅用于联系，不会公开。</Text></View>
        <View className='consultation-field'><Text className='consultation-field__label'>希望讨论的问题（选填）</Text><Textarea className='consultation-field__textarea' value={question} onInput={(event) => setQuestion(event.detail.value)} placeholder='可以写下你的背景、当前困惑或目标' maxlength={1000} /><Text className='consultation-field__count'>{question.length} / 1000</Text></View>
        <CheckboxGroup onChange={(event) => setConsented(event.detail.value.includes('privacy'))}>
          <View className='consultation-consent'><Checkbox value='privacy' checked={consented} color='#C94F22' /><Text>我同意按照<Text className='consultation-consent__link' onClick={() => navigateTo({ url: '/pages/legal/index?type=privacy' })}>隐私政策</Text>处理本次咨询所需信息</Text></View>
        </CheckboxGroup>
        {formError ? <Text className='consultation-error'>{formError}</Text> : null}
        <View className={`primary-button consultation-submit ${submitting ? 'primary-button--disabled' : ''}`} onClick={submitting ? undefined : handleSubmit}>{submitting ? '正在提交…' : '提交咨询'}</View>
      </View>
      {history.length > 0 ? <View className='consultation-history'><Text className='consultation-history__title'>最近咨询记录</Text>{history.slice(0, 3).map((item) => <View className='consultation-history__item' key={item.id}><Text>{TOPICS.find((topic) => topic.value === item.consultation_topic)?.label || '职业咨询'}</Text><Text>{item.status === 'pending' ? '待联系' : item.status === 'contacted' ? '已联系' : '处理中'}</Text></View>)}</View> : null}
    </View>
  )
}
