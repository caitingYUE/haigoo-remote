import { Text, View } from '@tarojs/components'
import Taro, { setClipboardData, showToast, useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import ContentSkeleton from '../../components/content-skeleton'
import MiniIcon from '../../components/mini-icon'
import CompanyLogo from '../../components/company-logo'
import useMiniShare from '../../hooks/use-mini-share'
import { resourceRevision } from '../../services/retained-resource-cache'
import useRetainedResource, { miniContentScope } from '../../hooks/use-retained-resource'
import { fetchCompanyJob, fetchFavoriteJobIds, setJobFavorite } from '../../services/content-service'
import { hasAuthenticatedSession } from '../../services/session'
import { formatCalendarDate } from '../../utils/runtime-compat'
import { formatJobApplicationCopy } from '../../utils/job-application-copy'
import './index.scss'

async function copyValue(value: string, successTitle: string) {
  try { await setClipboardData({ data: value }); showToast({ title: successTitle, icon: 'success' }) }
  catch { showToast({ title: '复制失败，请稍后重试', icon: 'none' }) }
}

function decodeRouteParam(value: string) {
  try { return decodeURIComponent(value) } catch { return value }
}

export default function JobDetailPage() {
  const router = useRouter()
  const companyId = decodeRouteParam(String(router.params.companyId || ''))
  const jobId = decodeRouteParam(String(router.params.jobId || ''))
  const accessSearch = String(router.params.search || '').trim()
  const resourceKey = `job-detail:${companyId}:${jobId}:${accessSearch}`
  const { data, refreshing, error, load: loadResource } = useRetainedResource<Awaited<ReturnType<typeof fetchCompanyJob>>>(resourceKey)
  const job = data?.job || null
  const company = data?.company || null
  const companyName = company?.name || ''
  const [language, setLanguage] = useState<'zh' | 'original'>('zh')
  const [favorite, setFavorite] = useState<boolean | null>(null)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const loadSequence = useRef(0)
  const favoriteRevision = useRef(-1)
  const favoriteScope = useRef(miniContentScope())
  useMiniShare(job ? `${job.title}｜${companyName || job.company}` : 'HaigooRemote 公开岗位信息', `/pages/job-detail/index?companyId=${encodeURIComponent(companyId)}&jobId=${encodeURIComponent(jobId)}${accessSearch ? `&search=${encodeURIComponent(accessSearch)}` : ''}`)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    const scope = miniContentScope()
    const sameScope = favoriteScope.current === scope
    if (!sameScope) {
      favoriteScope.current = scope
      setFavorite(null)
    }
    const detailRequest = loadResource(resourceKey, () => fetchCompanyJob(companyId, jobId, accessSearch))
    const revision = resourceRevision('favorite-state')
    if (sameScope && favorite !== null && favoriteRevision.current === revision) { await detailRequest; return }
    setFavoriteBusy(true)
    try {
      if (hasAuthenticatedSession()) {
        try {
          const favorites = await fetchFavoriteJobIds()
          if (sequence === loadSequence.current && scope === miniContentScope() && revision === resourceRevision('favorite-state')) {
            favoriteRevision.current = revision
            setFavorite(favorites.has(jobId))
          }
        }
        catch {
          if (sequence === loadSequence.current && scope === miniContentScope()) setFavorite(null)
        }
      } else if (sequence === loadSequence.current && scope === miniContentScope()) {
        favoriteRevision.current = revision
        setFavorite(false)
      }
    } finally {
      await detailRequest
      if (sequence === loadSequence.current && scope === miniContentScope()) setFavoriteBusy(false)
    }
  }, [accessSearch, companyId, favorite, jobId, loadResource, resourceKey])

  useDidShow(() => { void load() })
  useEffect(() => () => { loadSequence.current++ }, [])
  useEffect(() => {
    if (job) setLanguage(job.descriptionZh ? 'zh' : 'original')
  }, [job?.descriptionZh, job?.id])

  const toggleFavorite = async () => {
    if (favoriteBusy) return
    if (!hasAuthenticatedSession()) {
      const result = await Taro.showModal({ title: '登录后收藏岗位', content: '收藏会同步到 Haigoo 官网。', confirmText: '去登录' })
      if (result.confirm) Taro.navigateTo({ url: '/pages/profile/index' })
      return
    }
    setFavoriteBusy(true)
    try {
      if (favorite === null) {
        setFavorite((await fetchFavoriteJobIds()).has(jobId))
        showToast({ title: '收藏状态已更新', icon: 'none' })
        return
      }
      const next = !favorite
      await setJobFavorite(jobId, next, companyId)
      favoriteRevision.current = resourceRevision('favorite-state')
      setFavorite(next)
      showToast({ title: next ? '已收藏，同步至官网' : '已取消收藏', icon: 'success' })
    } catch (favoriteError) {
      showToast({ title: favoriteError instanceof Error ? favoriteError.message : '收藏操作没有完成', icon: 'none' })
    } finally { setFavoriteBusy(false) }
  }

  if (error) return <View className='page-shell'><View className='empty-state' aria-live='polite'><Text className='empty-state__title'>无法查看岗位信息</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' aria-role='button' aria-label='重新加载岗位信息' hoverClass='mini-action--pressed' onClick={() => void load()}>重新加载</View></View></View>
  if (!job) return <View className='page-shell job-detail-loading'><ContentSkeleton rows={4} /></View>

  const hasTranslation = Boolean(job.descriptionZh && job.descriptionOriginal && job.descriptionZh !== job.descriptionOriginal)
  const useChinese = language === 'zh' && hasTranslation
  const description = useChinese ? job.descriptionZh || job.description : job.descriptionOriginal || job.description
  const requirements = useChinese ? job.requirementsZh || job.requirements : job.requirementsOriginal || job.requirements
  const benefits = useChinese ? job.benefitsZh || job.benefits : job.benefitsOriginal || job.benefits
  const updatedAt = formatCalendarDate(job.updatedAt)
  const applicationMethod = job.officialApplyUrl
    ? { kind: 'url' as const, value: job.officialApplyUrl, action: '复制申请链接' }
    : job.publicApplicationEmail
      ? { kind: 'email' as const, value: job.publicApplicationEmail, action: '复制申请邮箱' }
      : null
  const facts = [
    { label: '工作地点', value: job.location || '远程范围以官网为准' },
    { label: '岗位类型', value: job.jobType || job.category || '以官网为准' },
    { label: '薪资范围', value: job.salary || '未公开' },
    { label: '更新时间', value: updatedAt || '未提供' }
  ]

  return <View className='page-shell job-detail' aria-busy={refreshing}>
    <View className='job-detail__hero'>
      <View className='job-detail__mark'><CompanyLogo name={companyName || job.company} logoFileId={company?.logoFileId} logoUrl={company?.logoUrl} /></View>
      <Text className='job-detail__company'>{companyName || job.company}</Text>
      <Text className='job-detail__title'>{job.titleZh || job.title}</Text>
      {job.titleOriginal && job.titleOriginal !== (job.titleZh || job.title) ? <Text className='job-detail__original-title'>{job.titleOriginal}</Text> : null}
      <View className={`job-detail__favorite ${favorite ? 'is-favorite' : ''} ${favoriteBusy ? 'is-busy' : ''}`} aria-role='button' aria-label={favorite === null && hasAuthenticatedSession() ? '重新获取收藏状态' : favorite ? '取消收藏岗位' : '收藏岗位'} onClick={() => void toggleFavorite()}><MiniIcon name='favorite' size={24} /><Text>{favoriteBusy ? '处理中' : favorite === null && hasAuthenticatedSession() ? '重试' : favorite ? '已收藏' : '收藏'}</Text></View>
    </View>

    <View className='job-detail__facts'>{facts.map((item) => <View key={item.label}><Text>{item.label}</Text><Text>{item.value}</Text></View>)}</View>

    <View className='job-detail__content'>
      <View className='job-detail__content-head'><Text>职位详情</Text>{hasTranslation ? <View className='job-detail__language' aria-role='tablist'><Text aria-role='tab' aria-selected={language === 'zh'} className={language === 'zh' ? 'is-active' : ''} onClick={() => setLanguage('zh')}>中文</Text><Text aria-role='tab' aria-selected={language === 'original'} className={language === 'original' ? 'is-active' : ''} onClick={() => setLanguage('original')}>原文</Text></View> : null}</View>
      {description ? <Text className='job-detail__body' selectable>{description}</Text> : <Text className='job-detail__empty'>暂未收录更多岗位说明，请以企业公开页面为准。</Text>}
      {requirements.length ? <View className='job-detail__section'><Text>岗位要求</Text><View className='job-detail__list'>{requirements.map((item) => <View key={item}><MiniIcon name='check' size={16} /><Text>{item}</Text></View>)}</View></View> : null}
      {benefits.length ? <View className='job-detail__section'><Text>其他公开信息</Text><View className='job-detail__list'>{benefits.map((item) => <View key={item}><MiniIcon name='check' size={16} /><Text>{item}</Text></View>)}</View></View> : null}
      <Text className='job-detail__source'>{job.sourceLabel}</Text>
    </View>

    <View className='job-detail__action-bar'><View className={`primary-button ${applicationMethod ? '' : 'primary-button--disabled'}`} aria-role='button' aria-disabled={!applicationMethod} aria-label={applicationMethod?.action || '暂未收录公开申请方式'} hoverClass={applicationMethod ? 'mini-action--pressed' : undefined} onClick={applicationMethod ? () => void copyValue(formatJobApplicationCopy(job, companyName, applicationMethod.kind, applicationMethod.value), applicationMethod.kind === 'email' ? '申请邮箱已复制' : '申请链接已复制') : undefined}><MiniIcon name={applicationMethod?.kind === 'email' ? 'mail' : 'link'} size={20} />{applicationMethod?.action || '暂无申请方式'}</View></View>
  </View>
}
