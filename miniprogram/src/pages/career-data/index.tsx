import { Text, View } from '@tarojs/components'
import { navigateBack, showModal, showToast, switchTab, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import { deleteCareerData, fetchCareerMatchState } from '../../services/career-match-service'
import type { CareerMatchState, CareerRetentionPolicy } from '../../types'
import { clearLocalMatchDraft } from '../../utils/match-draft'
import './index.scss'

const retentionLabels: Record<CareerRetentionPolicy, string> = {
  session: '仅本次',
  '30_days': '30 天',
  '90_days': '90 天',
  long_term: '长期保留'
}

function formatDate(value?: string | null) {
  if (!value) return '由你主动删除'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未设置' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function CareerDataPage() {
  const [state, setState] = useState<CareerMatchState | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setError('')
    try { setState(await fetchCareerMatchState()) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '职业资料加载失败') }
  }
  useDidShow(() => { void load() })

  const remove = async () => {
    const confirmation = await showModal({
      title: '删除全部职业资料？',
      content: '职业经历、补充回答、分析结果和推荐企业都会永久删除，且无法恢复。',
      confirmText: '永久删除',
      confirmColor: '#A13D32'
    })
    if (!confirmation.confirm) return
    setDeleting(true)
    try {
      const result = await deleteCareerData()
      clearLocalMatchDraft()
      showToast({ title: result.message, icon: 'success' })
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败，请稍后重试')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View className='page-shell career-data-page'>
      <View className='career-data-heading'><Text>你的职业资料</Text><Text>这里只保存移除个人信息后的职业经历，原始简历不会保留。</Text></View>
      {error ? <View className='empty-state'><Text className='empty-state__title'>暂时无法读取</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' onClick={load}>重新加载</View></View> : null}
      {!error && !state ? <Text className='career-data-loading'>正在读取资料…</Text> : null}
      {state && !state.profile ? (
        <View className='career-data-empty'><View className='career-data-empty__icon'><MiniIcon name='target' size={30} /></View><Text className='career-data-empty__title'>还没有职业资料</Text><Text className='career-data-empty__copy'>完成 Match 后，可以在这里查看资料和保存期限。</Text><View className='primary-button' onClick={() => switchTab({ url: '/pages/index/index' })}>开始 Match</View></View>
      ) : null}
      {state?.profile ? (
        <>
          <View className='career-data-summary'>
            <View><Text>资料来源</Text><Text>{state.profile.source_type === 'resume' ? '简历导入' : '手动填写'}</Text></View>
            <View><Text>保存期限</Text><Text>{retentionLabels[state.profile.retention_policy]}</Text></View>
            <View><Text>自动删除时间</Text><Text>{formatDate(state.profile.expires_at)}</Text></View>
            <View><Text>分析状态</Text><Text>{state.latestRun?.status === 'ready' ? '已完成' : state.latestRun ? '等待补充信息' : '尚未分析'}</Text></View>
          </View>
          <View className='career-data-note'><MiniIcon name='shield' size={22} /><View><Text>隐私处理</Text><Text>原文件读取后立即删除，姓名和联系方式不会保留。</Text></View></View>
          {state.retentionReviewDue ? <View className='career-data-review'><Text>请确认是否继续保留</Text><Text>这份资料已保存一年。你可以重新选择期限，或现在删除。</Text></View> : null}
          <View className='career-data-actions'><View className='primary-button' onClick={() => switchTab({ url: '/pages/index/index' })}>查看或更新资料</View><View className={`career-data-delete ${deleting ? 'is-disabled' : ''}`} onClick={deleting ? undefined : remove}>{deleting ? '正在删除…' : '永久删除职业资料'}</View></View>
        </>
      ) : null}
      <Text className='career-data-back' onClick={() => navigateBack()}>返回我的</Text>
    </View>
  )
}
