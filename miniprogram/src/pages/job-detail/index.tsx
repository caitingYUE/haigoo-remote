import { Button, Image, Text, View } from '@tarojs/components'
import {
  Heart,
  Internation,
  Loading,
  Share2,
  Store
} from '@nutui/icons-react-taro'
import {
  setClipboardData,
  navigateTo,
  showActionSheet,
  showModal,
  showToast,
  useRouter,
  useShareAppMessage
} from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  confirmApplicationCompleted,
  unlockEmailApplication,
  unlockReferralApplication,
  unlockWebsiteApplication
} from '../../services/application-service'
import { ApiRequestError } from '../../services/api-client'
import { fetchJobById } from '../../services/jobs-service'
import { fetchFavorites, setJobFavorite } from '../../services/user-activity-service'
import { hasAuthenticatedSession } from '../../services/session'
import type { MiniJob } from '../../types'
import { buildJobDetailSections } from '../../utils/job-content'
import './index.scss'

function getApplicationSummary(job: MiniJob): string {
  if (job.memberOnly) return 'Club 会员岗位'
  if (job.application.hasWebsiteApply) return '企业官网申请'
  if (job.application.hasEmailApply) return job.application.emailType || '邮箱直申'
  if (job.application.hasReferral) return '企业内推'
  return '暂无申请入口'
}

function getApplicationError(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return '申请入口暂时无法打开，请稍后重试'
  if (error.statusCode === 401) return '登录状态已失效，请重新登录'
  if (error.payload.emailVerificationRequired) return '请先绑定并验证邮箱后再申请岗位'
  if (error.payload.code === 'ACCOUNT_BIND_REQUIRED') return '请先绑定 Haigoo 网站账号后再申请岗位'
  if (error.statusCode === 403) return '当前免费申请次数已用完，可在网站了解更多服务'
  return error.message || '申请入口暂时无法打开，请稍后重试'
}

export default function JobDetailPage() {
  const router = useRouter()
  const jobId = String(router.params.id || '').trim()
  const [job, setJob] = useState<MiniJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [applying, setApplying] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [favoritePending, setFavoritePending] = useState(false)
  const [activeTab, setActiveTab] = useState<'job' | 'company'>('job')

  const loadJob = useCallback(async () => {
    if (!jobId) {
      setError('岗位信息不存在')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const nextJob = await fetchJobById(jobId)
      if (!nextJob) throw new Error('岗位不存在或已下线')
      setJob(nextJob)
      if (hasAuthenticatedSession()) {
        const favorites = await fetchFavorites().catch(() => null)
        if (favorites) setFavorited(favorites.favoriteJobIds.includes(jobId))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '岗位详情加载失败')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    loadJob()
  }, [loadJob])

  useShareAppMessage(() => ({
    title: job ? `${job.title}｜${job.company}` : 'Haigoo Remote 远程岗位',
    path: `/pages/job-detail/index?id=${encodeURIComponent(jobId)}`
  }))

  const visibleJob = useMemo(() => {
    if (!job || !showOriginal) return job
    return {
      ...job,
      title: job.originalTitle || job.title,
      description: job.originalDescription || job.description
    }
  }, [job, showOriginal])

  const sections = useMemo(
    () => visibleJob ? buildJobDetailSections(visibleJob) : [],
    [visibleJob]
  )

  const promptLogin = (purpose = '申请') => {
    showModal({
      title: `绑定账号后${purpose}`,
      content: `请先使用微信登录并绑定 Haigoo 网站账号，以同步${purpose}数据和网站账号权益。`,
      confirmText: '前往绑定',
      success: ({ confirm }) => {
        if (confirm) navigateTo({ url: '/pages/account-bind/index' })
      }
    })
  }

  const confirmApplied = (type: 'website' | 'email' | 'referral', content: string) => {
    if (!job) return
    showModal({
      title: '申请入口已准备好',
      content: `${content}\n\n当前仅记录为「已打开申请入口」。完成外部申请后，可在这里确认同步为「已申请」。`,
      cancelText: '稍后再说',
      confirmText: '我已申请',
      success: async ({ confirm }) => {
        if (!confirm) return
        try {
          await confirmApplicationCompleted(job, type)
          showToast({ title: '已同步为已申请', icon: 'success' })
        } catch (statusError) {
          showToast({ title: statusError instanceof Error ? statusError.message : '状态同步失败', icon: 'none' })
        }
      }
    })
  }

  const copyWebsiteApplication = async () => {
    if (!job) return
    const application = await unlockWebsiteApplication(job)
    if (!application.websiteUrl) throw new Error('该岗位暂无官网申请链接')
    await setClipboardData({ data: application.websiteUrl })
    confirmApplied('website', '官网申请链接已复制，请粘贴到手机浏览器访问。')
  }

  const copyEmailApplication = async () => {
    if (!job) return
    const application = await unlockEmailApplication(job)
    if (!application.hiringEmail) throw new Error('该岗位暂无招聘邮箱')
    const content = [
      `收件人：${application.hiringEmail}`,
      `主题：Application for ${job.originalTitle || job.title}`,
      '',
      `Hi ${job.company} team,`,
      `I am writing to apply for the ${job.originalTitle || job.title} position. Please find my resume attached.`
    ].join('\n')
    await setClipboardData({ data: content })
    confirmApplied('email', '招聘邮箱和申请文案已复制，请在邮箱客户端完成发送。')
  }

  const copyWebsiteJobPage = async () => {
    if (!job) return
    const application = await unlockReferralApplication(job)
    if (!application.websiteUrl) throw new Error('该岗位暂无内推说明')
    await setClipboardData({
      data: application.websiteUrl
    })
    confirmApplied('referral', '网站岗位链接已复制，请在浏览器查看内推说明。')
  }

  const runApplicationAction = async (type: 'website' | 'email' | 'referral') => {
    setApplying(true)
    try {
      if (type === 'website') await copyWebsiteApplication()
      if (type === 'email') await copyEmailApplication()
      if (type === 'referral') await copyWebsiteJobPage()
    } catch (applicationError) {
      showModal({
        title: '暂时无法继续申请',
        content: getApplicationError(applicationError),
        showCancel: false
      })
    } finally {
      setApplying(false)
    }
  }

  const handleApply = () => {
    if (!job || applying) return
    if (!hasAuthenticatedSession()) {
      promptLogin('申请')
      return
    }

    const options: Array<{ label: string; type: 'website' | 'email' | 'referral' }> = []
    if (job.application.hasWebsiteApply) options.push({ label: '复制官网申请链接', type: 'website' })
    if (job.application.hasEmailApply) {
      options.push({
        label: `复制${job.application.emailType || '招聘邮箱'}与申请文案`,
        type: 'email'
      })
    }
    if (job.application.hasReferral) options.push({ label: '复制网站链接，查看内推方式', type: 'referral' })

    if (options.length === 0) {
      showToast({ title: '该岗位暂无可用申请入口', icon: 'none' })
      return
    }

    if (options.length === 1) {
      runApplicationAction(options[0].type)
      return
    }

    showActionSheet({
      itemList: options.map((option) => option.label),
      success: ({ tapIndex }) => {
        const selected = options[tapIndex]
        if (selected) runApplicationAction(selected.type)
      }
    })
  }

  const copyCompanyWebsite = async () => {
    if (!visibleJob?.companyWebsite) return
    await setClipboardData({ data: visibleJob.companyWebsite })
    showToast({ title: '企业官网地址已复制', icon: 'success' })
  }

  const handleToggleFavorite = async () => {
    if (!job || favoritePending) return
    if (!hasAuthenticatedSession()) {
      promptLogin('收藏')
      return
    }
    const nextFavorite = !favorited
    setFavoritePending(true)
    setFavorited(nextFavorite)
    try {
      await setJobFavorite(job.id, nextFavorite)
      showToast({ title: nextFavorite ? '已同步收藏' : '已取消收藏', icon: 'success' })
    } catch (favoriteError) {
      setFavorited(!nextFavorite)
      showToast({ title: favoriteError instanceof Error ? favoriteError.message : '收藏操作失败', icon: 'none' })
    } finally {
      setFavoritePending(false)
    }
  }

  if (loading) {
    return (
      <View className='job-detail-page job-detail-state'>
        <View className='job-detail-state__loading'>
          <Loading size={34} color='#5146e5' />
        </View>
        <Text className='job-detail-state__title'>岗位详情加载中</Text>
        <Text className='job-detail-state__copy'>正在同步网站岗位信息</Text>
      </View>
    )
  }

  if (error || !visibleJob) {
    return (
      <View className='job-detail-page job-detail-state'>
        <Text className='job-detail-state__title'>无法加载岗位</Text>
        <Text className='job-detail-state__copy'>{error || '岗位可能已下线'}</Text>
        <View className='job-detail-state__retry' onClick={loadJob}>
          <Text>重新加载</Text>
        </View>
      </View>
    )
  }

  const detailTags = [
    visibleJob.type,
    visibleJob.category,
    visibleJob.experienceLevel
  ].filter(Boolean) as string[]

  return (
    <View className='job-detail-page'>
      <View className='job-detail-page__content'>
        <View className='job-detail-actions'>
          <Button
            className={`job-detail-actions__button ${favorited ? 'job-detail-actions__button--active' : ''}`}
            disabled={favoritePending}
            onClick={handleToggleFavorite}
          >
            <Heart size={23} color={favorited ? '#ffffff' : '#11182b'} />
          </Button>
          <Button className='job-detail-actions__button' openType='share'>
            <Share2 size={23} color='#11182b' />
          </Button>
        </View>

        <View className='job-detail-hero'>
          <View className='job-detail-hero__logo'>
            {visibleJob.logoUrl && !logoFailed ? (
              <Image
                className='job-detail-hero__logo-image'
                mode='aspectFit'
                src={visibleJob.logoUrl}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Store size={36} color='#65728a' />
            )}
          </View>
          <Text className='job-detail-hero__title'>{visibleJob.title}</Text>
          <Text className='job-detail-hero__company'>{visibleJob.company} · {visibleJob.location}</Text>
          {visibleJob.originalDescription ? (
            <View className='job-detail-translation'>
              <View
                className={`job-detail-translation__item ${!showOriginal ? 'job-detail-translation__item--active' : ''}`}
                onClick={() => setShowOriginal(false)}
              >
                <Text>译</Text>
              </View>
              <View
                className={`job-detail-translation__item ${showOriginal ? 'job-detail-translation__item--active' : ''}`}
                onClick={() => setShowOriginal(true)}
              >
                <Text>原</Text>
              </View>
            </View>
          ) : null}
          <View className='job-detail-hero__tags'>
            {detailTags.map((tag) => <Text key={tag}>{tag}</Text>)}
          </View>
        </View>

        <View className='job-detail-stats'>
          <View>
            <Text className='job-detail-stats__label'>薪资范围</Text>
            <Text className='job-detail-stats__value'>{visibleJob.salary}</Text>
          </View>
          <View>
            <Text className='job-detail-stats__label'>发布时间</Text>
            <Text className='job-detail-stats__value'>{visibleJob.publishedLabel}</Text>
          </View>
          <View>
            <Text className='job-detail-stats__label'>远程范围</Text>
            <Text className='job-detail-stats__value'>{visibleJob.location}</Text>
          </View>
          <View>
            <Text className='job-detail-stats__label'>行业类型</Text>
            <Text className='job-detail-stats__value'>{visibleJob.companyIndustry || '待确认'}</Text>
          </View>
        </View>

        <View className='job-detail-tabs'>
          <View
            className={'job-detail-tabs__item ' + (activeTab === 'job' ? 'job-detail-tabs__item--active' : '')}
            onClick={() => setActiveTab('job')}
          ><Text>职位详情</Text></View>
          <View
            className={'job-detail-tabs__item ' + (activeTab === 'company' ? 'job-detail-tabs__item--active' : '')}
            onClick={() => setActiveTab('company')}
          ><Text>企业信息</Text></View>
        </View>

        {activeTab === 'job' ? (
          <>
            {sections.map((section) => (
              <View className='job-detail-section' key={section.id}>
                <Text className='job-detail-section__title'>{section.title}</Text>
                {section.paragraphs.map((paragraph, index) => (
                  <Text className='job-detail-section__paragraph' key={section.id + '-p-' + index}>{paragraph}</Text>
                ))}
                {section.items.length > 0 ? (
                  <View className='job-detail-section__list'>
                    {section.items.map((item, index) => (
                      <View className='job-detail-section__list-item' key={section.id + '-i-' + index}>
                        <Text className='job-detail-section__bullet'>•</Text>
                        <Text>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}

            {visibleJob.matchScore ? (
              <View className='job-detail-match surface-card'>
                <View className='job-detail-match__title'>
                  <Internation size={21} color='#5146e5' />
                  <Text>{visibleJob.matchLabel || '岗位匹配'} · {visibleJob.matchScore}%</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View className='job-detail-company surface-card'>
            <View className='job-detail-company__heading'>
              <View>
                <Text className='job-detail-company__eyebrow'>COMPANY PROFILE</Text>
                <Text className='job-detail-company__name'>{visibleJob.company}</Text>
              </View>
              <View className='job-detail-company__logo'>
                {visibleJob.logoUrl && !logoFailed ? (
                  <Image className='job-detail-company__logo-image' mode='aspectFit' src={visibleJob.logoUrl} />
                ) : <Store size={30} color='#65728a' />}
              </View>
            </View>
            <Text className='job-detail-company__description'>
              {visibleJob.companyDescription || '企业介绍正在持续补充中；岗位来源与基础信息已与网站同步。'}
            </Text>
            {visibleJob.companyTags?.length ? (
              <View className='job-detail-company__tags'>
                {visibleJob.companyTags.map((tag) => <Text key={tag}>{tag}</Text>)}
              </View>
            ) : null}
            <View className='job-detail-company__facts'>
              <View>
                <Text>行业</Text>
                <Text>{visibleJob.companyIndustry || '待补充'}</Text>
              </View>
              <View>
                <Text>所在地</Text>
                <Text>{visibleJob.companyAddress || '全球远程'}</Text>
              </View>
              {visibleJob.companyRating ? (
                <View>
                  <Text>{visibleJob.ratingSource || '企业评分'}</Text>
                  <Text>{visibleJob.companyRating + ' 分'}</Text>
                </View>
              ) : null}
            </View>
            {visibleJob.companyWebsite ? (
              <View className='job-detail-company__website' onClick={copyCompanyWebsite}>
                <Text>复制企业官网地址</Text>
                <Text>›</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View className='job-detail-footer'>
        <View className='job-detail-footer__mode'>
          <Text className='job-detail-footer__mode-label'>申请方式</Text>
          <Text className='job-detail-footer__mode-value'>{getApplicationSummary(visibleJob)}</Text>
        </View>
        <Button
          className={`job-detail-footer__apply ${applying ? 'job-detail-footer__apply--done' : ''}`}
          disabled={applying || visibleJob.application.mode === 'unavailable'}
          loading={applying}
          onClick={handleApply}
        >
          {visibleJob.application.mode === 'unavailable'
            ? '暂无申请入口'
            : !hasAuthenticatedSession()
              ? '前往申请（需登录）'
              : applying
                ? '正在打开'
                : '前往申请'}
        </Button>
      </View>
    </View>
  )
}
