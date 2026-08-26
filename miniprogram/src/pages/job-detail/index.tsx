import { Text, View } from '@tarojs/components'
import { setClipboardData, showToast, useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import useMiniShare from '../../hooks/use-mini-share'
import { fetchCompanyJob } from '../../services/content-service'
import type { MiniCompanyJobDetail } from '../../types'
import './index.scss'

function formatDate(value?: string | null) {
  const time = new Date(value || '').getTime()
  if (!Number.isFinite(time)) return ''
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(time)
}

async function copyValue(value: string, message: string) {
  try { await setClipboardData({ data: value }); showToast({ title: message, icon: 'success' }) }
  catch { showToast({ title: '复制失败，请稍后重试', icon: 'none' }) }
}

export default function JobDetailPage() {
  const router = useRouter()
  const companyId = String(router.params.companyId || '')
  const jobId = String(router.params.jobId || '')
  const [job, setJob] = useState<MiniCompanyJobDetail | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  useMiniShare(job ? `${job.title}｜${companyName || job.company}` : 'HaigooRemote 公开岗位信息', `/pages/job-detail/index?companyId=${encodeURIComponent(companyId)}&jobId=${encodeURIComponent(jobId)}`)

  const load = useCallback(async () => {
    setError('')
    try {
      const result = await fetchCompanyJob(companyId, jobId)
      setJob(result.job)
      setCompanyName(result.company.name)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '岗位信息加载失败')
    }
  }, [companyId, jobId])

  useDidShow(() => { void load() })

  if (error) return <View className='page-shell'><View className='empty-state'><Text className='empty-state__title'>无法查看岗位信息</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' onClick={() => void load()}>重新加载</View></View></View>
  if (!job) return <View className='page-shell job-detail-loading'>正在加载岗位信息…</View>

  const facts = [job.location, job.jobType, job.salary, formatDate(job.updatedAt) ? `更新于 ${formatDate(job.updatedAt)}` : ''].filter(Boolean)
  return <View className='page-shell job-detail'>
    <View className='job-detail__hero'>
      <Text className='job-detail__company'>{companyName || job.company}</Text>
      <Text className='job-detail__title'>{job.title}</Text>
      {facts.length ? <View className='job-detail__facts'>{facts.map((item) => <Text key={item}>{item}</Text>)}</View> : null}
    </View>

    {job.description ? <View className='job-detail__section'><Text className='job-detail__section-title'>岗位介绍</Text><Text className='job-detail__body' selectable>{job.description}</Text></View> : null}
    {job.requirements.length ? <View className='job-detail__section'><Text className='job-detail__section-title'>岗位要求</Text><View className='job-detail__list'>{job.requirements.map((item) => <View key={item}><MiniIcon name='check' size={16} /><Text>{item}</Text></View>)}</View></View> : null}
    {job.benefits.length ? <View className='job-detail__section'><Text className='job-detail__section-title'>公开信息</Text><View className='job-detail__list'>{job.benefits.map((item) => <View key={item}><MiniIcon name='check' size={16} /><Text>{item}</Text></View>)}</View></View> : null}

    <View className='job-detail__section job-detail__application'>
      <Text className='job-detail__section-title'>申请方式</Text>
      {job.officialApplyUrl ? <View className='primary-button' onClick={() => void copyValue(job.officialApplyUrl, '官网申请链接已复制')}>复制官网申请链接</View> : job.publicApplicationEmail ? <View className='primary-button' onClick={() => void copyValue(job.publicApplicationEmail, '公开申请邮箱已复制')}>复制公开申请邮箱</View> : <Text className='job-detail__empty'>暂未收录公开申请方式</Text>}
      <Text className='job-detail__source'>{job.sourceLabel}</Text>
    </View>
  </View>
}
