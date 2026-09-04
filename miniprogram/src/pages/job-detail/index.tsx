import { Text, View } from '@tarojs/components'
import Taro, { setClipboardData, showToast, useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import useMiniShare from '../../hooks/use-mini-share'
import { fetchCompanyJob, fetchFavoriteJobIds, setJobFavorite } from '../../services/content-service'
import { hasAuthenticatedSession } from '../../services/session'
import type { MiniCompanyJobDetail } from '../../types'
import { formatCalendarDate } from '../../utils/runtime-compat'
import './index.scss'

async function copyValue(value: string) {
  try { await setClipboardData({ data: value }); showToast({ title: '申请链接已复制', icon: 'success' }) }
  catch { showToast({ title: '复制失败，请稍后重试', icon: 'none' }) }
}

function companyInitial(name: string) {
  const value = String(name || '').trim()
  const latin = value.match(/[A-Za-z0-9]+/g)
  if (latin?.length) return latin.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return value.slice(0, 2) || '企'
}

function decodeRouteParam(value: string) {
  try { return decodeURIComponent(value) } catch { return value }
}

export default function JobDetailPage() {
  const router = useRouter()
  const companyId = decodeRouteParam(String(router.params.companyId || ''))
  const jobId = decodeRouteParam(String(router.params.jobId || ''))
  const accessSearch = String(router.params.search || '').trim()
  const [job, setJob] = useState<MiniCompanyJobDetail | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [language, setLanguage] = useState<'zh' | 'original'>('zh')
  const [favorite, setFavorite] = useState(false)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [error, setError] = useState('')
  useMiniShare(job ? `${job.title}｜${companyName || job.company}` : 'HaigooRemote 公开岗位信息', `/pages/job-detail/index?companyId=${encodeURIComponent(companyId)}&jobId=${encodeURIComponent(jobId)}${accessSearch ? `&search=${encodeURIComponent(accessSearch)}` : ''}`)

  const load = useCallback(async () => {
    setError('')
    try {
      const result = await fetchCompanyJob(companyId, jobId, accessSearch)
      setJob(result.job)
      setCompanyName(result.company.name)
      setLanguage(result.job.descriptionZh ? 'zh' : 'original')
      if (hasAuthenticatedSession()) {
        const favorites = await fetchFavoriteJobIds().catch(() => new Set<string>())
        setFavorite(favorites.has(jobId))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '岗位信息加载失败')
    }
  }, [companyId, jobId])

  useDidShow(() => { void load() })

  const toggleFavorite = async () => {
    if (favoriteBusy) return
    if (!hasAuthenticatedSession()) {
      const result = await Taro.showModal({ title: '登录后收藏岗位', content: '收藏会同步到 Haigoo 官网。', confirmText: '去登录' })
      if (result.confirm) Taro.navigateTo({ url: '/pages/profile/index' })
      return
    }
    const next = !favorite
    setFavoriteBusy(true)
    try {
      await setJobFavorite(jobId, next)
      setFavorite(next)
      showToast({ title: next ? '已收藏，同步至官网' : '已取消收藏', icon: 'success' })
    } catch (favoriteError) {
      showToast({ title: favoriteError instanceof Error ? favoriteError.message : '收藏操作没有完成', icon: 'none' })
    } finally { setFavoriteBusy(false) }
  }

  if (error) return <View className='page-shell'><View className='empty-state' aria-live='polite'><Text className='empty-state__title'>无法查看岗位信息</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' aria-role='button' aria-label='重新加载岗位信息' hoverClass='mini-action--pressed' onClick={() => void load()}>重新加载</View></View></View>
  if (!job) return <View className='page-shell job-detail-loading'>正在加载岗位信息…</View>

  const hasTranslation = Boolean(job.descriptionZh && job.descriptionOriginal && job.descriptionZh !== job.descriptionOriginal)
  const useChinese = language === 'zh' && hasTranslation
  const description = useChinese ? job.descriptionZh || job.description : job.descriptionOriginal || job.description
  const requirements = useChinese ? job.requirementsZh || job.requirements : job.requirementsOriginal || job.requirements
  const benefits = useChinese ? job.benefitsZh || job.benefits : job.benefitsOriginal || job.benefits
  const updatedAt = formatCalendarDate(job.updatedAt)
  const facts = [
    { label: '工作地点', value: job.location || '远程范围以官网为准' },
    { label: '岗位类型', value: job.jobType || job.category || '以官网为准' },
    { label: '薪资范围', value: job.salary || '未公开' },
    { label: '更新时间', value: updatedAt || '持续更新' }
  ]

  return <View className='page-shell job-detail'>
    <View className='job-detail__hero'>
      <View className='job-detail__mark'>{companyInitial(companyName || job.company)}</View>
      <Text className='job-detail__company'>{companyName || job.company}</Text>
      <Text className='job-detail__title'>{job.titleZh || job.title}</Text>
      {job.titleOriginal && job.titleOriginal !== (job.titleZh || job.title) ? <Text className='job-detail__original-title'>{job.titleOriginal}</Text> : null}
      <View className={`job-detail__favorite ${favorite ? 'is-favorite' : ''} ${favoriteBusy ? 'is-busy' : ''}`} aria-role='button' aria-label={favorite ? '取消收藏岗位' : '收藏岗位'} onClick={() => void toggleFavorite()}><MiniIcon name='favorite' size={24} /><Text>{favorite ? '已收藏' : '收藏'}</Text></View>
    </View>

    <View className='job-detail__facts'>{facts.map((item) => <View key={item.label}><Text>{item.label}</Text><Text>{item.value}</Text></View>)}</View>

    <View className='job-detail__content'>
      <View className='job-detail__content-head'><Text>职位详情</Text>{hasTranslation ? <View className='job-detail__language' aria-role='tablist'><Text aria-role='tab' aria-selected={language === 'zh'} className={language === 'zh' ? 'is-active' : ''} onClick={() => setLanguage('zh')}>中文</Text><Text aria-role='tab' aria-selected={language === 'original'} className={language === 'original' ? 'is-active' : ''} onClick={() => setLanguage('original')}>原文</Text></View> : null}</View>
      {description ? <Text className='job-detail__body' selectable>{description}</Text> : <Text className='job-detail__empty'>暂未收录更多岗位说明，请以企业公开页面为准。</Text>}
      {requirements.length ? <View className='job-detail__section'><Text>岗位要求</Text><View className='job-detail__list'>{requirements.map((item) => <View key={item}><MiniIcon name='check' size={16} /><Text>{item}</Text></View>)}</View></View> : null}
      {benefits.length ? <View className='job-detail__section'><Text>其他公开信息</Text><View className='job-detail__list'>{benefits.map((item) => <View key={item}><MiniIcon name='check' size={16} /><Text>{item}</Text></View>)}</View></View> : null}
      <Text className='job-detail__source'>{job.sourceLabel}</Text>
    </View>

    <View className='job-detail__action-bar'><View className={`primary-button ${job.officialApplyUrl ? '' : 'primary-button--disabled'}`} aria-role='button' aria-label={job.officialApplyUrl ? '复制官方申请链接' : '暂无官方申请链接'} hoverClass={job.officialApplyUrl ? 'mini-action--pressed' : undefined} onClick={job.officialApplyUrl ? () => void copyValue(job.officialApplyUrl) : undefined}><MiniIcon name='link' size={20} />{job.officialApplyUrl ? '复制申请链接' : '暂无申请链接'}</View></View>
  </View>
}
