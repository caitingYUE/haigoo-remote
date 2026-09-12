import { Text, View } from '@tarojs/components'
import { navigateTo, stopPullDownRefresh, switchTab, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import CompanyLogo from '../../components/company-logo'
import CompanyFollowAction from '../../components/company-follow-action'
import ContentSkeleton from '../../components/content-skeleton'
import EditorialState from '../../components/editorial-state'
import MiniIcon from '../../components/mini-icon'
import WechatReminderAction from '../../components/wechat-reminder-action'
import { fetchCareerWatch, fetchCompanyFollows } from '../../services/career-match-service'
import type { CompanyFollowSummary } from '../../services/career-match-service'
import { onCompanyFollowChange } from '../../services/company-follow-state'
import { miniContentScope } from '../../hooks/use-retained-resource'
import './index.scss'

export default function FollowedCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyFollowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reminderConfig, setReminderConfig] = useState({ available: false, templateId: '' })
  const lastScope = useRef('')
  const hasLoaded = useRef(false)
  const loadSequence = useRef(0)
  useEffect(() => () => { loadSequence.current++ }, [])
  useEffect(() => onCompanyFollowChange(({ companyId, followed, reminderEnabled }) => {
    setCompanies((current) => followed
      ? current.map((company) => company.company_id === companyId
          ? { ...company, wechat_enabled: reminderEnabled, wechat_template_status: reminderEnabled ? 'accepted' : company.wechat_template_status }
          : company)
      : current.filter((company) => company.company_id !== companyId))
  }), [])

  const load = useCallback(async ({ preserve = false } = {}) => {
    const scope = miniContentScope()
    const sequence = ++loadSequence.current
    if (lastScope.current !== scope) {
      lastScope.current = scope
      setCompanies([])
      setReminderConfig({ available: false, templateId: '' })
      hasLoaded.current = false
      setLoading(true)
    }
    if (!preserve) setLoading(true)
    setError('')
    try {
      const [follows, watch] = await Promise.all([
        fetchCompanyFollows(),
        fetchCareerWatch().catch(() => null)
      ])
      if (sequence !== loadSequence.current) return
      if (scope !== miniContentScope()) throw new Error('账号状态已变化，请重新加载')
      setCompanies(follows.follows)
      setReminderConfig({
        available: Boolean(watch?.entitlements.wechatSubscriptionAvailable),
        templateId: String(watch?.entitlements.wechatTemplateId || '')
      })
      hasLoaded.current = true
    } catch (loadError) {
      if (sequence !== loadSequence.current) return
      if (scope !== miniContentScope()) setCompanies([])
      setError(loadError instanceof Error ? loadError.message : '关注企业加载失败')
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [])

  useDidShow(() => {
    const sameScope = lastScope.current === miniContentScope()
    if (sameScope && hasLoaded.current) return
    void load({ preserve: sameScope && hasLoaded.current })
  })
  usePullDownRefresh(async () => {
    await load({ preserve: true })
    stopPullDownRefresh()
  })

  const updateReminder = (companyId: string, enabled: boolean) => {
    setCompanies((current) => current.map((company) => company.company_id === companyId
      ? { ...company, wechat_enabled: enabled, wechat_template_status: enabled ? 'accepted' : 'not_requested' }
      : company))
  }

  const removeCompany = (companyId: string, followed: boolean) => {
    if (!followed) setCompanies((current) => current.filter((company) => company.company_id !== companyId))
  }

  return <View className='page-shell followed-companies-page'>
    <View className='followed-companies__heading'>
      <Text className='page-heading'>关注企业</Text>
      <Text className='page-subtitle'>集中管理关注状态与微信岗位提醒</Text>
    </View>

    {loading ? <ContentSkeleton rows={4} /> : null}

    {!loading && error && companies.length === 0 ? <EditorialState
      title='关注企业暂时无法加载'
      copy={error}
      actionLabel='重新加载'
      onAction={() => void load()}
    /> : null}

    {!loading && error && companies.length > 0 ? <View className='followed-companies__inline-error' aria-live='polite'>
      <Text>{error}</Text>
      <Text aria-role='button' aria-label='重新加载关注企业' onClick={() => void load({ preserve: true })}>重新加载</Text>
    </View> : null}

    {!loading && !error && companies.length === 0 ? <EditorialState
      title='还没有关注企业'
      copy='关注企业后，可在这里集中管理岗位更新。'
      actionLabel='浏览企业'
      onAction={() => switchTab({ url: '/pages/companies/index' })}
    /> : null}

    {!loading && companies.length > 0 ? <View className='followed-company-list'>
      {companies.map((company) => {
        const roles = (company.openRoleCategories || []).slice(0, 2)
        const roleSummary = roles.length ? roles.join('、') : company.openJobCount > 0 ? `${company.openJobCount} 个开放岗位` : '查看当前开放岗位'
        const reminderEnabled = company.wechat_enabled && company.wechat_template_status === 'accepted'
        return <View className='followed-company' key={company.company_id}>
          <View
            className='followed-company__main'
            aria-role='button'
            aria-label={`查看 ${company.name} 企业详情`}
            hoverClass='mini-action--pressed'
            onClick={() => navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(company.company_id)}` })}
          >
            <View className='followed-company__logo'>
              <CompanyLogo name={company.name} logoUrl={company.logoUrl} logoFileId={company.logoFileId} lazyLoad />
            </View>
            <View className='followed-company__identity'>
              <Text className='followed-company__name'>{company.name}</Text>
              <Text className='followed-company__industry'>{company.industry || '企业信息待补充'}</Text>
              <Text className={`followed-company__roles ${roles.length ? '' : 'is-empty'}`}>{roleSummary}</Text>
            </View>
            <MiniIcon name='chevronRight' size={19} />
          </View>

          <View className='followed-company__actions'>
            <View className='followed-company__reminder'>
              <WechatReminderAction
                companyId={company.company_id}
                available={reminderConfig.available}
                templateId={reminderConfig.templateId}
                enabled={reminderEnabled}
                onChanged={(enabled) => updateReminder(company.company_id, enabled)}
              />
            </View>
            <View className='followed-company__unfollow'>
              <CompanyFollowAction
                companyId={company.company_id}
                companyName={company.name}
                followed
                reminderEnabled={reminderEnabled}
                onChanged={(followed) => removeCompany(company.company_id, followed)}
              />
            </View>
          </View>
        </View>
      })}
    </View> : null}
  </View>
}
