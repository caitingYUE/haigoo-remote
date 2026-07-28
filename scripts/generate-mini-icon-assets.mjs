import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import lucide from 'lucide-react'
import sharp from 'sharp'

const {
  Bell,
  Briefcase,
  Building2,
  ChevronRight,
  Crown,
  Heart,
  Link,
  Mail,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Target,
  UserRound
} = lucide

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(rootDir, 'miniprogram', 'assets', 'icons')

const icons = {
  application: Briefcase,
  building: Building2,
  chevronRight: ChevronRight,
  club: Crown,
  favorite: Heart,
  link: Link,
  mail: Mail,
  search: Search,
  settings: Settings,
  share: Share2,
  shield: ShieldCheck,
  subscription: Bell,
  target: Target,
  user: UserRound
}

await fs.mkdir(outputDir, { recursive: true })

for (const [name, Icon] of Object.entries(icons)) {
  const svg = renderToStaticMarkup(
    createElement(Icon, {
      color: '#5146e5',
      fill: 'none',
      size: 48,
      strokeWidth: 2.2,
      absoluteStrokeWidth: true,
      'aria-hidden': true
    })
  )
  await sharp(Buffer.from(svg))
    .resize(96, 96)
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, `${name}.png`))
}

console.log(`Generated ${Object.keys(icons).length} Mini Program icon assets in ${outputDir}`)
