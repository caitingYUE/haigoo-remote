import { View } from '@tarojs/components'

interface ContentSkeletonProps {
  rows?: number
}

export default function ContentSkeleton({ rows = 3 }: ContentSkeletonProps) {
  return (
    <View className='content-skeleton' aria-label='内容加载中'>
      {Array.from({ length: rows }, (_, index) => (
        <View className='skeleton-row' key={index}>
          <View className='skeleton-block' />
          <View className='skeleton-copy'>
            <View className='skeleton-line' />
            <View className='skeleton-line' />
          </View>
        </View>
      ))}
    </View>
  )
}
