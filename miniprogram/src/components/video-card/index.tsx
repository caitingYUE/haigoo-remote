import { Text, View } from '@tarojs/components'
import { PlayStart, ShieldCheck } from '@nutui/icons-react-taro'
import { showToast } from '@tarojs/taro'
import type { LearningVideo } from '../../types'
import './index.scss'

interface VideoCardProps {
  video: LearningVideo
  horizontal?: boolean
}

export default function VideoCard({ video, horizontal = false }: VideoCardProps) {
  const handleOpen = () => {
    showToast({
      title: video.locked ? '绑定账号或开通 Club 后观看' : '视频暂时无法播放，请稍后再试',
      icon: 'none'
    })
  }

  return (
    <View className={`video-card ${horizontal ? 'video-card--horizontal' : ''}`} onClick={handleOpen}>
      <View className='video-card__cover' style={{ background: video.accent }}>
        <Text className='video-card__category'>{video.category}</Text>
        <View className='video-card__play'>
          {video.locked
            ? <ShieldCheck size={25} color='#5146e5' />
            : <PlayStart size={25} color='#5146e5' />}
        </View>
        <Text className='video-card__duration'>{video.duration}</Text>
      </View>
      <View className='video-card__content'>
        <View className='video-card__meta'>
          <Text>{video.level}</Text>
          {video.locked ? <Text className='video-card__locked'>Club</Text> : <Text>可观看</Text>}
        </View>
        <Text className='video-card__title'>{video.title}</Text>
        <Text className='video-card__description'>{video.description}</Text>
      </View>
    </View>
  )
}
