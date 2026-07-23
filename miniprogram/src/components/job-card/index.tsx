import { Image, Text, View } from '@tarojs/components'
import { Heart, Internation, Store } from '@nutui/icons-react-taro'
import { navigateTo } from '@tarojs/taro'
import { useState } from 'react'
import type { MiniJob } from '../../types'
import './index.scss'

interface JobCardProps {
  job: MiniJob
  compact?: boolean
  favorited?: boolean
  favoritePending?: boolean
  onToggleFavorite?: (job: MiniJob) => void
}

function getApplicationLabel(job: MiniJob): string {
  const methods: string[] = []
  if (job.application.hasWebsiteApply) methods.push('官网申请')
  if (job.application.hasEmailApply) methods.push(job.application.emailType || '邮箱直申')
  if (job.application.hasReferral) methods.push('内推机会')
  return methods[0] || '申请方式待确认'
}

export default function JobCard({
  job,
  compact = false,
  favorited = false,
  favoritePending = false,
  onToggleFavorite
}: JobCardProps) {
  const [logoFailed, setLogoFailed] = useState(false)
  const showEyebrow = Boolean(job.featured || job.matchScore)

  const openDetail = () => {
    navigateTo({ url: `/pages/job-detail/index?id=${encodeURIComponent(job.id)}` })
  }

  return (
    <View className={`job-card ${compact ? 'job-card--compact' : ''}`} onClick={openDetail}>
      {showEyebrow ? (
        <View className='job-card__eyebrow-row'>
          <Text className='job-card__recommended'>{job.featured ? '热门岗位' : job.matchLabel || '岗位匹配'}</Text>
          {job.matchScore ? (
            <View className='job-card__match'>
              <Internation size={16} color='#5146e5' />
              <Text>{job.matchScore}% 匹配</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View className={`job-card__main ${showEyebrow ? '' : 'job-card__main--no-eyebrow'}`}>
        <View className='job-card__content'>
          <Text className='job-card__title'>{job.title}</Text>
          <Text className='job-card__company'>{job.company}</Text>
          <View className='job-card__meta-row'>
            <Text>{job.location}</Text>
            <Text className='job-card__dot'>·</Text>
            <Text>{job.type}</Text>
          </View>
        </View>

        <View className='job-card__logo'>
          {job.logoUrl && !logoFailed ? (
            <Image
              className='job-card__logo-image'
              mode='aspectFit'
              src={job.logoUrl}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Store size={27} color='#65728a' />
          )}
        </View>
      </View>

      <View className='job-card__tags'>
        {job.tags.slice(0, compact ? 2 : 4).map((tag) => (
          <Text className='job-card__tag' key={tag}>{tag}</Text>
        ))}
        {job.memberOnly ? <Text className='job-card__tag job-card__tag--club'>Club 岗位</Text> : null}
      </View>

      <View className='job-card__application-row'>
        <Text className='job-card__application-method'>{getApplicationLabel(job)}</Text>
        <Text className='job-card__published'>{job.publishedLabel}</Text>
      </View>

      <View className='job-card__actions'>
        <View className='job-card__apply'>
          <Text>查看详情</Text>
        </View>
        {onToggleFavorite ? (
          <View
            className={`job-card__favorite ${favorited ? 'job-card__favorite--active' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              if (!favoritePending) onToggleFavorite(job)
            }}
          >
            <Heart size={23} color={favorited ? '#ffffff' : '#5146e5'} />
            <Text>{favoritePending ? '处理中' : favorited ? '已收藏' : '收藏'}</Text>
          </View>
        ) : null}
        <Text className='job-card__salary'>{job.salary}</Text>
      </View>
    </View>
  )
}
