
import { Users, Globe, Briefcase, Heart, Zap, Share2, Target, Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero Section */}
      <div className="relative isolate overflow-hidden bg-gradient-to-b from-indigo-100/20 pt-14">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
              Haigoo Remote Club
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              远程办公，无限可能。我们成立于2025年，致力于构建一个面向中国人的远程工作平台，帮助国人直达可信的海内外远程岗，告别求职焦虑，让梦想中的生活更进一步。
            </p>
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">我们的使命</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            重新定义工作与生活，超越传统界限
          </p>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Haigoo Remote Club 的创立源于一个简单的信念：工作应该提升生活品质，而不是限制生活。我们汇聚来自世界各地的远程爱好者，分享知识，互相支持，携手重新定义现代工作和生活。
          </p>
        </div>
      </div>

      {/* Values Section */}
      <div className="bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">核心价值观</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              驱动我们前进的力量
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                  <Share2 className="h-5 w-5 flex-none text-indigo-600" aria-hidden="true" />
                  开放与分享
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">我们秉持透明和知识共享的原则。我们的社区以开源思维为基石，每个人的经验都成为集体成长和学习的宝贵资源。</p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                  <Globe className="h-5 w-5 flex-none text-indigo-600" aria-hidden="true" />
                  自由与探索
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">我们鼓励打破传统界限，探索工作和生活中各种可能性。创新源于我们敢于突破传统路径，并不断尝试。</p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                  <Heart className="h-5 w-5 flex-none text-indigo-600" aria-hidden="true" />
                  互助与利他主义
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                  <p className="flex-auto">我们构建一个协作生态系统，让每个人都能共同成长。通过真诚的支持和无私的行动，我们助力每个人实现远程办公的梦想。</p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:max-w-none">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">不断发展的全球社区</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                自2025年8月上线以来，我们见证了令人瞩目的增长和用户参与度。
              </p>
            </div>
            <dl className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-3">
              <div className="flex flex-col bg-slate-50/50 p-8">
                <dt className="text-sm font-semibold leading-6 text-slate-600">Followers</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900">5K+</dd>
              </div>
              <div className="flex flex-col bg-slate-50/50 p-8">
                <dt className="text-sm font-semibold leading-6 text-slate-600">Active Members</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900">2K+</dd>
              </div>
              <div className="flex flex-col bg-slate-50/50 p-8">
                <dt className="text-sm font-semibold leading-6 text-slate-600">Jobs</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900">5K+</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Team/Creators Section */}
      <div className="bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">核心创作者</h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Haigoo 的优势在于我们多元化的专业人士社群，他们来自不同的行业和背景。
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-slate-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                    <Zap className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  人工智能产品创新者
                </dt>
                <dd className="mt-2 text-base leading-7 text-slate-600">
                  专注于自动化的产品经理，致力于为全球远程团队开发智能系统并简化工作流程。
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-slate-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                    <Globe className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  全球品牌专家
                </dt>
                <dd className="mt-2 text-base leading-7 text-slate-600">
                  拥有若干个国际市场丰富经验的营销专业人士，为跨文化商业战略带来宝贵见解。
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-slate-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                    <Target className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  创意总监
                </dt>
                <dd className="mt-2 text-base leading-7 text-slate-600">
                  才华横溢的电影编剧、创意总监和内容策略师，将讲故事的专业知识带入我们的社区活动。
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-slate-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                    <Rocket className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  技术创新者
                </dt>
                <dd className="mt-2 text-base leading-7 text-slate-600">
                  工程师、后端开发人员和技术专家正在探索自助媒体、内容创作和远程协作工具的新领域。
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-white">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              准备好改变您的工作和生活体验了吗？
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-600">
              加入致力于重新定义工作和生活的全球社区所带来的自由、灵活和成就感。您的远程办公之旅从这里开始。
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/register"
                className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                立即加入
              </Link>
              <Link to="/jobs" className="text-sm font-semibold leading-6 text-slate-900">
                探索岗位 <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="mt-8 text-sm text-slate-500">
              <p>联系我们: <a href="mailto:hi@haigooremote.com" className="text-indigo-600 hover:text-indigo-500">hi@haigooremote.com</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
