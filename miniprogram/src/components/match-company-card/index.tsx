import { Image, RootPortal, Text, View } from '@tarojs/components'
import { useMemo, useRef, useState } from 'react'
import CompanyFollowAction from '../company-follow-action'
import MiniIcon from '../mini-icon'
import type { WatchFeedItem } from '../../services/career-match-service'
import { buildMatchCardPresentation } from '../../utils/match-card-presentation'
import './index.scss'

interface MatchCompanyCardProps {
  company: WatchFeedItem
  active: boolean
  onFollowChanged: (companyId: string, followed: boolean) => void
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

export default function MatchCompanyCard({ company, active, onFollowChanged, onOpenCompany, onOpenJob, onScoreOpened }: MatchCompanyCardProps) {
  const [scoreOpen, setScoreOpen] = useState(false)
  const touch = useRef({ x: 0, y: 0, moved: false })
  const presentation = useMemo(() => buildMatchCardPresentation(company), [company])
  const numericScore = presentation.showNumericScore ? Math.round(company.score) : null
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
      onClick={openCompany}
    >
      <View className='match-company-card__identity'>
        <View className='match-company-card__logo'>
          {company.logoUrl ? <Image src={company.logoUrl} mode='aspectFit' lazyLoad /> : <Text>{companyInitial(company.companyName)}</Text>}
        </View>
        <View
          className={`match-company-card__score ${numericScore === null ? 'is-qualitative' : 'is-numeric'}`}
          aria-role='button'
          aria-label={`${presentation.scoreLabel}，查看匹配度说明`}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={openScore}
        >
          <Text>{numericScore === null ? presentation.scoreLabel : numericScore}</Text>
          <Text>{numericScore === null ? '匹配度' : '匹配'}</Text>
        </View>
      </View>

      <View className='match-company-card__title-row'>
        <Text className='match-company-card__name'>{company.companyName}</Text>
        {presentation.meta ? <Text className='match-company-card__meta'>{presentation.meta}</Text> : null}
      </View>

      {(presentation.headquarters || presentation.ratingLabel) ? <View className='match-company-card__facts'>
        {presentation.headquarters ? <View><MiniIcon name='location' size={14} /><Text>{presentation.headquarters}</Text></View> : null}
        {presentation.ratingLabel ? <View aria-label={`${presentation.ratingSource || '公开来源'}评分 ${presentation.ratingLabel}`}><MiniIcon name='star' size={14} /><Text>{presentation.ratingLabel}</Text></View> : null}
      </View> : null}

      <View className='match-company-card__fit'>
        <Text className='match-company-card__label'>为什么推荐给你</Text>
        {presentation.descriptionSnippet ? <Text className='match-company-card__description'>{presentation.descriptionSnippet}</Text> : null}
        <View className='match-company-card__evidence'>
          {presentation.evidenceReasons.slice(0, 3).map((reason) => <Text key={reason}>{reason}</Text>)}
        </View>
      </View>

      <View
        className='match-company-card__opportunity'
        aria-role={company.jobId ? 'button' : undefined}
        onTouchStart={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); if (company.jobId) onOpenJob(company) }}
      >
        <View className='match-company-card__opportunity-icon'><MiniIcon name='briefcase' size={17} /></View>
        <View className='match-company-card__opportunity-copy'>
          <Text>{presentation.jobTitle}</Text>
          <Text>{presentation.roleSummary}</Text>
        </View>
        <MiniIcon name='chevronRight' size={17} />
      </View>

      <View className='match-company-card__footer'>
        <View className='match-company-card__verified'>
          <MiniIcon name='clock' size={14} />
          <Text>{presentation.verifiedLabel ? `核验于 ${presentation.verifiedLabel}` : '核验日期待更新'}</Text>
        </View>
        {active ? <CompanyFollowAction
          companyId={company.companyId}
          companyName={company.companyName}
          followed={company.isFollowed}
          reminderEnabled={company.isSubscribed}
          compact
          onChanged={(followed) => onFollowChanged(company.companyId, followed)}
        /> : null}
        <View
          className='match-company-card__open'
          aria-role='button'
          aria-label={`查看 ${company.companyName} 企业详情`}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onOpenCompany(company) }}
        ><Text>查看企业详情</Text><MiniIcon name='chevronRight' size={15} /></View>
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
