import { Image, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { invalidateCloudFileUrl, isRenderableImageSource } from '../../services/cloud-asset-service'

// The native cloud source is tried once if a temporary URL fails. A missing
// asset is represented by the real company initial, never a substitute logo.
export default function CompanyLogo({ name, logoUrl, logoFileId, lazyLoad = false }: {
  name: string
  logoUrl?: string
  logoFileId?: string
  lazyLoad?: boolean
}) {
  const [failed, setFailed] = useState<string[]>([])
  useEffect(() => { setFailed([]) }, [logoUrl, logoFileId])
  const source = [logoUrl, logoFileId].find((value): value is string => isRenderableImageSource(value) && !failed.includes(value))
  return source ? <Image
    src={source}
    mode='aspectFit'
    lazyLoad={lazyLoad}
    aria-label={`${name} 企业标志`}
    onError={() => {
      if (logoFileId) invalidateCloudFileUrl(logoFileId)
      setFailed((current) => [...current, source])
    }}
  /> : <Text aria-label={`${name} 暂无可用标志`}>{String(name || '企').trim().slice(0, 1).toUpperCase()}</Text>
}
