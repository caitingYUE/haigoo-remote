import { Text, View } from '@tarojs/components'
import Taro, { navigateBack, showModal, showToast, switchTab, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import { deleteCareerData, fetchCareerMatchState, syncCareerResumeFile } from '../../services/career-match-service'
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
  const [deletingResume, setDeletingResume] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setError('')
    try { setState(await fetchCareerMatchState()) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '职业资料加载失败') }
  }
  useDidShow(() => { void load() })

  const remove = async () => {
    const confirmation = await showModal({
      title: '删除求职资料？',
      content: '已保存的求职方向和职业分析将被删除。简历和已有匹配结果不受影响。',
      confirmText: '永久删除',
      confirmColor: '#A13D32'
    })
    if (!confirmation.confirm) return
    setDeleting(true)
    try {
      const result = await deleteCareerData('profile')
      clearLocalMatchDraft()
      showToast({ title: result.message, icon: 'success' })
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败，请稍后重试')
    } finally {
      setDeleting(false)
    }
  }

  const removeResume = async () => {
    const resumeId = state?.importedResume?.resumeId
    if (!resumeId || deletingResume) return
    const confirmation = await showModal({
      title: '删除已保存简历？',
      content: '删除后无法恢复，不会影响已有匹配结果。',
      confirmText: '删除简历',
      confirmColor: '#A13D32'
    })
    if (!confirmation.confirm) return
    setDeletingResume(true); setError('')
    try {
      const result = await deleteCareerData('resume', resumeId)
      showToast({ title: result.message, icon: 'success' })
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '简历删除失败，请稍后重试')
    } finally { setDeletingResume(false) }
  }

  const uploadResume = async () => {
    if (uploading) return
    setUploading(true); setError('')
    try {
      const selected = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf', 'docx', 'txt'] })
      const file = selected.tempFiles[0]
      if (!file) return
      if (Number(file.size || 0) > 2 * 1024 * 1024) throw new Error('简历不能超过 2MB')
      await syncCareerResumeFile(file.name || 'resume.pdf', file.path)
      showToast({ title: '简历已保存', icon: 'success' })
      await load()
    } catch (uploadError: any) {
      if (!/cancel/i.test(String(uploadError?.errMsg || uploadError?.message || ''))) setError(uploadError instanceof Error ? uploadError.message : '简历上传失败')
    } finally { setUploading(false) }
  }

  return (
    <View className='page-shell career-data-page'>
      <View className='career-data-heading'><Text>职业资料</Text><Text>管理用于匹配的职业资料与简历。</Text></View>
      {error ? <View className='empty-state'><Text className='empty-state__title'>暂时无法读取</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' onClick={load}>重新加载</View></View> : null}
      {!error && !state ? <Text className='career-data-loading'>正在读取资料…</Text> : null}
      {state && !state.profile ? (
        <View className='career-data-empty'><View className='career-data-empty__icon'><MiniIcon name='application' size={30} /></View><Text className='career-data-empty__title'>{state.importedResume ? '简历已保存' : '还没有职业资料'}</Text><Text className='career-data-empty__copy'>{state.importedResume?.filename || '上传简历，或手动设置求职方向。'}</Text><View className={`primary-button ${uploading ? 'primary-button--disabled' : ''}`} onClick={uploading ? undefined : () => void uploadResume()}>{uploading ? '正在上传…' : state.importedResume ? '更新简历' : '上传简历'}</View><View className='career-data-secondary' onClick={() => switchTab({ url: '/pages/index/index' })}>设置求职方向</View>{state.importedResume?.resumeId ? <View className={`career-data-delete ${deletingResume ? 'is-disabled' : ''}`} onClick={deletingResume ? undefined : () => void removeResume()}>{deletingResume ? '正在删除…' : '删除已保存简历'}</View> : null}</View>
      ) : null}
      {state?.profile ? (
        <>
          <View className='career-data-summary'>
            {state.importedResume?.filename ? <View><Text>简历</Text><Text>{state.importedResume.filename}</Text></View> : null}
            <View><Text>资料来源</Text><Text>{state.profile.source_type === 'resume' ? '简历导入' : '手动填写'}</Text></View>
            <View><Text>保存期限</Text><Text>{retentionLabels[state.profile.retention_policy]}</Text></View>
            <View><Text>自动删除时间</Text><Text>{formatDate(state.profile.expires_at)}</Text></View>
            <View><Text>分析状态</Text><Text>{state.latestRun?.status === 'ready' ? '已完成' : state.latestRun ? '等待补充信息' : '尚未分析'}</Text></View>
          </View>
          {state.retentionReviewDue ? <View className='career-data-review'><Text>请确认是否继续保留</Text><Text>如不再需要，可以在下方删除求职资料。</Text></View> : null}
          <View className='career-data-actions'><View className={`primary-button ${uploading ? 'primary-button--disabled' : ''}`} onClick={uploading ? undefined : () => void uploadResume()}>{uploading ? '正在上传…' : '上传或更新简历'}</View><View className='career-data-secondary' onClick={() => switchTab({ url: '/pages/index/index' })}>更新求职方向</View>{state.importedResume?.resumeId ? <View className={`career-data-delete ${deletingResume ? 'is-disabled' : ''}`} onClick={deletingResume ? undefined : () => void removeResume()}>{deletingResume ? '正在删除…' : '删除已保存简历'}</View> : null}<View className={`career-data-delete ${deleting ? 'is-disabled' : ''}`} onClick={deleting ? undefined : remove}>{deleting ? '正在删除…' : '删除求职资料'}</View></View>
        </>
      ) : null}
      <Text className='career-data-back' onClick={() => navigateBack()}>返回我的</Text>
    </View>
  )
}
