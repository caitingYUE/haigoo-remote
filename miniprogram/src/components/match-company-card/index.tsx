import { Image, RootPortal, Text, View } from '@tarojs/components'
import { useMemo, useRef, useState } from 'react'
import CompanyFollowAction from '../company-follow-action'
import MiniIcon from '../mini-icon'
import WechatReminderAction from '../wechat-reminder-action'
import type { WatchFeedItem } from '../../services/career-match-service'
import { buildMatchCardPresentation } from '../../utils/match-card-presentation'
import './index.scss'

interface MatchCompanyCardProps {
  company: WatchFeedItem
  active: boolean
  reminderAvailable: boolean
  reminderTemplateId: string
  onFollowChanged: (companyId: string, followed: boolean) => void
  onReminderChanged: (companyId: string, enabled: boolean) => void
  onOpenCompany: (company: WatchFeedItem) => void
  onOpenJob: (company: WatchFeedItem) => void
  onScoreOpened: (company: WatchFeedItem) => void
}

function companyInitial(name: string) {
  const value = String(name || '').trim()
  const latin = value.match(/[A-Za-z0-9]+/g)
  if (latin?.length) return latin.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return value.slice(0, 2) || '企'
}

export default function MatchCompanyCard({ company, active, reminderAvailable, reminderTemplateId, onFollowChanged, onReminderChanged, onOpenCompany, onOpenJob, onScoreOpened }: MatchCompanyCardProps) {
  const [scoreOpen, setScoreOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const touch = useRef({ x: 0, y: 0, moved: false })
  const presentation = useMemo(() => buildMatchCardPresentation(company), [company])
  const numericScore = presentation.showNumericScore ? Math.round(company.score) : null
  const hasRating = company.rating !== null && Boolean(company.ratingSource)
  const hasJudgments = Boolean(presentation.directionMatch || presentation.remoteCulture.length || hasRating)
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
    if (!active || touch.current.moved) return
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
        touch.current.moved ||= Math.abs(point.clientX - touch.current.x) > 8 || Math.abs(point.clientY - touch.current.y) > 8
      }}
      onTouchCancel={() => { touch.current.moved = true }}
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
                ? <Image src={company.logoUrl} mode='aspectFit' lazyLoad={false} onError={() => setLogoFailed(true)} />
                : <Text>{companyInitial(company.companyName)}</Text>}
            </View>
            <Text className='match-company-card__name'>{company.companyName}</Text>
            {(company.industry || company.headquarters) ? <View className='match-company-card__meta'>
              {company.industry ? <Text>{company.industry}</Text> : null}
              {company.industry && company.headquarters ? <Text className='match-company-card__meta-separator'>·</Text> : null}
              {company.headquarters ? <Text>{company.headquarters}</Text> : null}
            </View> : null}
          </View>
          {numericScore !== null ? <View
            className='match-company-card__score'
            aria-role='button'
            aria-label={`${numericScore}%匹配度，查看匹配度说明`}
            onClick={openScore}
          >
            <Text>{numericScore}%</Text>
            <Text>MATCH</Text>
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
          {hasRating ? <View className='match-company-card__judgment'>
              <Text className='match-company-card__judgment-label'>企业综合评分</Text>
              <View className='match-company-card__rating-result' aria-label={`${presentation.ratingSource}评分 ${company.rating?.toFixed(1)}`}><MiniIcon name='starFilled' size={14} /><Text>{company.rating?.toFixed(1)}</Text></View>
            </View> : null}
        </View> : null}
        {hasOpportunity ? <View
          className='match-company-card__opportunity'
          aria-role='button'
          onClick={(event) => { event.stopPropagation(); if (active && !touch.current.moved && company.jobId) onOpenJob(company) }}
        >
          <View className='match-company-card__opportunity-copy'>
            <Text>{presentation.jobTitle}</Text>
            {presentation.jobLocation ? <View className='match-company-card__opportunity-location'><MiniIcon name='location' size={13} /><Text>{presentation.jobLocation}</Text></View> : null}
          </View>
          <View className='match-company-card__opportunity-action'><Text>去申请</Text><MiniIcon name='chevronRight' size={15} /></View>
        </View> : null}
      </View>

      <View className={`match-company-card__footer ${active ? '' : 'match-company-card__footer--inactive'}`}>
        <CompanyFollowAction
          companyId={company.companyId}
          companyName={company.companyName}
          followed={company.isFollowed}
          reminderEnabled={company.isSubscribed}
          compact
          unfollowedLabel='关注企业'
          unfollowedIcon='plus'
          onChanged={(followed) => onFollowChanged(company.companyId, followed)}
        />
        {company.isFollowed ? <View className='match-company-card__reminder'><WechatReminderAction
            companyId={company.companyId}
            available={reminderAvailable}
            templateId={reminderTemplateId}
            enabled={Boolean(company.isSubscribed)}
            onChanged={(enabled) => onReminderChanged(company.companyId, enabled)}
          /></View> : null}
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
