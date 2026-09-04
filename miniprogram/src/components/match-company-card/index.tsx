import { Image, RootPortal, Text, View } from '@tarojs/components'
import { useMemo, useRef, useState } from 'react'
import CompanyFollowAction from '../company-follow-action'
import MiniIcon from '../mini-icon'
import type { WatchFeedItem } from '../../services/career-match-service'
import { buildMatchCardPresentation } from '../../utils/match-card-presentation'
import { formatCalendarDate } from '../../utils/runtime-compat'
import './index.scss'

interface MatchCompanyCardProps {
  company: WatchFeedItem
  active: boolean
  onFollowChanged: (companyId: string, followed: boolean) => void
  onOpenCompany: (company: WatchFeedItem) => void
  onOpenJob: (company: WatchFeedItem) => void
  onScoreOpened: (company: WatchFeedItem) => void
  isMember?: boolean
}

function companyInitial(name: string) {
  const value = String(name || '').trim()
  const latin = value.match(/[A-Za-z0-9]+/g)
  if (latin?.length) return latin.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return value.slice(0, 2) || '企'
}

export default function MatchCompanyCard({ company, active, onFollowChanged, onOpenCompany, onOpenJob, onScoreOpened, isMember = false }: MatchCompanyCardProps) {
  const [scoreOpen, setScoreOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const touch = useRef({ x: 0, y: 0, moved: false })
  const presentation = useMemo(() => buildMatchCardPresentation(company), [company])
  const freshnessDate = formatCalendarDate(company.updatedAt) || formatCalendarDate(company.publishedAt || company.verifiedAt)
  const numericScore = presentation.showNumericScore ? Math.round(company.score) : null
  const hasJudgments = Boolean(presentation.directionMatch || presentation.remoteCulture.length || presentation.ratingLabel)
  const hasOpportunity = Boolean(company.jobId && presentation.jobTitle)
  const scoreRows = presentation.scoreBreakdown
    ? [
        { title: '职业方向', ...presentation.scoreBreakdown.direction },
        { title: '偏好条件', ...presentation.scoreBreakdown.preferences },
        { title: '机会信号', ...presentation.scoreBreakdown.opportunity }
      ]
    : []

  const openScore = (event) => {
    event.stopPropagation()
    if (!active) return
    setScoreOpen(true)
    onScoreOpened(company)
  }

  const openCompany = () => {
    if (active && !touch.current.moved) onOpenCompany(company)
  }

  return <>
    <View
      className='match-company-card'
      aria-label={`${company.companyName} 企业匹配卡片`}
      aria-role={active ? 'button' : undefined}
      onTouchStart={(event) => {
        const point = (event as any).touches?.[0]
        touch.current = { x: point?.clientX || 0, y: point?.clientY || 0, moved: false }
      }}
      onTouchMove={(event) => {
        const point = (event as any).touches?.[0]
        if (!point) return
        touch.current.moved = Math.abs(point.clientX - touch.current.x) > 12 || Math.abs(point.clientY - touch.current.y) > 12
      }}
      onClick={(event) => {
        if (touch.current.moved) {
          event.stopPropagation()
          return
        }
        openCompany()
      }}
    >
      <View className='match-company-card__overview'>
        <View className='match-company-card__identity'>
          <View className='match-company-card__identity-main'>
            <View className='match-company-card__logo'>
              {company.logoUrl && !logoFailed
                ? <Image src={company.logoUrl} mode='aspectFit' lazyLoad onError={() => setLogoFailed(true)} />
                : <Text>{companyInitial(company.companyName)}</Text>}
            </View>
            <Text className='match-company-card__name'>{company.companyName}</Text>
            {presentation.meta ? <Text className='match-company-card__meta'>{presentation.meta}</Text> : null}
          </View>
          {numericScore !== null ? <View
            className='match-company-card__score'
            aria-role='button'
            aria-label={`${numericScore}%匹配度，查看匹配度说明`}
            onTouchStart={(event) => event.stopPropagation()}
            onClick={openScore}
          >
            <Text>{numericScore}%</Text>
            <Text>匹配度</Text>
          </View> : null}
        </View>
      </View>

      <View className='match-company-card__fit'>
        {presentation.descriptionSnippet ? <Text className='match-company-card__description'>
          “{presentation.descriptionSnippet}”
        </Text> : null}
        {hasJudgments ? <View className={`match-company-card__judgments ${presentation.descriptionSnippet ? 'has-divider' : ''}`}>
          {presentation.directionMatch ? <View className='match-company-card__judgment'>
              <Text className='match-company-card__judgment-label'>岗位方向匹配</Text>
              <Text className='match-company-card__judgment-result'>{presentation.directionMatch}</Text>
            </View> : null}
          {presentation.remoteCulture.length ? <View className='match-company-card__judgment'>
              <Text className='match-company-card__judgment-label'>远程协作文化</Text>
              <Text className='match-company-card__judgment-result'>{presentation.remoteCulture.join(' · ')}</Text>
            </View> : null}
          {presentation.ratingLabel ? <View className='match-company-card__judgment'>
              <Text className='match-company-card__judgment-label'>企业综合评分</Text>
              <View className='match-company-card__rating-result' aria-label={`${presentation.ratingSource || '公开来源'}评分 ${presentation.ratingLabel}`}><MiniIcon name='starFilled' size={14} /><Text>{presentation.ratingLabel}</Text></View>
            </View> : null}
        </View> : null}
        {hasOpportunity ? <View
          className='match-company-card__opportunity'
          aria-role='button'
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); if (company.jobId) onOpenJob(company) }}
        >
          <View className='match-company-card__opportunity-copy'>
            <Text>{presentation.jobTitle}</Text>
            {presentation.jobLocation ? <Text className='match-company-card__opportunity-location'>{presentation.jobLocation}</Text> : null}
          </View>
          <Text className='match-company-card__opportunity-apply'>去申请</Text>
        </View> : null}
      </View>

      <View className='match-company-card__footer'>
        {active ? <CompanyFollowAction
          companyId={company.companyId}
          companyName={company.companyName}
          followed={company.isFollowed}
          reminderEnabled={company.isSubscribed}
          compact
          unfollowedLabel='关注企业'
          unfollowedIcon='plus'
          onChanged={(followed) => onFollowChanged(company.companyId, followed)}
        /> : null}
        <View
          className='match-company-card__open'
          aria-role='button'
          aria-label={`查看 ${company.companyName} 企业详情`}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onOpenCompany(company) }}
        ><Text>查看企业详情</Text><MiniIcon name='chevronRight' size={15} /></View>
        <Text className='match-company-card__freshness'>更新于{freshnessDate || '日期待确认'} · {isMember ? '会员日更中' : '非会员仅一次'}</Text>
      </View>
    </View>

    {scoreOpen ? <RootPortal>
      <View className='match-score-overlay' catchMove onClick={() => setScoreOpen(false)}>
        <View className='match-score-sheet' onClick={(event) => event.stopPropagation()}>
          <View className='match-score-sheet__handle' />
          <View className='match-score-sheet__heading'>
            <View><Text>匹配度说明</Text><Text>{company.companyName}</Text></View>
            <View aria-role='button' aria-label='关闭匹配度说明' onClick={() => setScoreOpen(false)}><MiniIcon name='close' size={20} /></View>
          </View>
          {scoreRows.length ? <View className='match-score-sheet__rows'>
            {scoreRows.map((row) => <View className='match-score-sheet__row' key={row.title}>
              <View><Text>{row.title}</Text><Text>{row.label}</Text></View>
              <Text>{row.max > 0 ? `${row.score}/${row.max}` : row.label.includes('未设置') ? '未设置' : '待补充'}</Text>
            </View>)}
          </View> : <View className='match-score-sheet__limited'><Text>当前信息适合用于方向比较</Text><Text>公开数据覆盖有限，因此只展示相关度区间，不提供精确分数。</Text></View>}
          <View className='match-score-sheet__note'>
            <MiniIcon name='shield' size={17} />
            <Text>匹配度依据你的方向设置、偏好条件和公开岗位信号计算，仅用于辅助比较，不代表录用概率。</Text>
          </View>
        </View>
      </View>
    </RootPortal> : null}
  </>
}
