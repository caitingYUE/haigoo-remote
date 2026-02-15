
import { Users, Globe, Briefcase, Heart, Zap, Share2, Target, Rocket, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import pic1 from '../assets/images/pic1.webp'
import pic2 from '../assets/images/pic2.webp'
import pic3 from '../assets/images/pic3.webp'
import pic4 from '../assets/images/pic4.webp'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative bg-white pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="max-w-2xl">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl mb-6">
                Haigoo Remote Club<br/>海狗远程俱乐部
              </h1>
              <p className="text-lg leading-8 text-slate-600 mb-8">
                远程办公，无限可能。我们成立于2025年，致力于构建一个面向中国人的远程工作平台，帮助国人直达可信的海内外远程岗，告别求职焦虑，让梦想中的生活更进一步。
              </p>
              <div className="flex items-center gap-x-6">
                <Link
                  to="/register"
                  className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all"
                >
                  加入我们
                </Link>
              </div>
            </div>
            
            {/* Right Image */}
            <div className="relative lg:ml-auto">
              <img
                src={pic1}
                alt="Remote Work Workspace"
                className="w-full max-w-lg rounded-2xl shadow-xl object-cover aspect-[4/3] ml-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <div className="bg-[#1d4ed8] py-24 sm:py-32 text-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-8">
                我们的使命：<br/>重新定义工作与生活
              </h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold mb-3">超越传统界限</h3>
                  <p className="text-blue-100 leading-relaxed">
                    Haigoo Remote Club 的创立源于一个简单的信念：工作应该提升生活品质，而不是限制生活。我们成立于 2025 年 8 月 20 日，创建了一个致力于远程办公和数字化生活方式创新的开放社区。
                  </p>
                </div>
                
                <p className="text-blue-100 leading-relaxed">
                  我们汇聚来自世界各地的远程爱好者，分享知识，互相支持，携手重新定义现代工作和生活。我们的目标是让每个人都能拥有更自由、更快乐、更有意义的生活方式。
                </p>
              </div>
            </div>

            <div className="relative">
              <img
                src={pic2}
                alt="Window View"
                className="w-full rounded-2xl shadow-2xl object-cover aspect-[3/4] lg:aspect-square"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="bg-[#1d4ed8] py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="bg-white rounded-3xl p-8 sm:p-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-16 text-center sm:text-left">
              驱动我们前进的核心价值观
            </h2>
            
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
              {/* Value 1 */}
              <div className="bg-blue-50 rounded-2xl p-8 transition-transform hover:scale-105">
                <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center mb-6">
                  <Share2 className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-4">开放与分享</h3>
                <p className="text-slate-600 leading-relaxed">
                  我们秉持透明和知识共享的原则。我们的社区以开源思维为基石，每个人的经验都成为集体成长和学习的宝贵资源。
                </p>
              </div>

              {/* Value 2 */}
              <div className="bg-blue-50 rounded-2xl p-8 transition-transform hover:scale-105">
                <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center mb-6">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-4">自由与探索</h3>
                <p className="text-slate-600 leading-relaxed">
                  我们鼓励打破传统界限，探索工作和生活中各种可能性。创新源于我们敢于突破传统路径，并不断尝试。
                </p>
              </div>

              {/* Value 3 */}
              <div className="bg-blue-50 rounded-2xl p-8 transition-transform hover:scale-105">
                <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center mb-6">
                  <Heart className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-4">互助与利他主义</h3>
                <p className="text-slate-600 leading-relaxed">
                  我们构建一个协作生态系统，让每个人都能共同成长。通过真诚的支持和无私的行动，我们创建了一个网络，助力每个人实现远程办公的梦想。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="relative py-24 sm:py-32 overflow-hidden">
        {/* Abstract Background Image */}
        <div className="absolute inset-0">
          <img 
            src={pic3} 
            alt="Abstract Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-blue-900/10 backdrop-blur-[2px]"></div>
        </div>

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 sm:p-16 shadow-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 text-center mb-16">
              不断发展的全球社区
            </h2>
            
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 text-center">
              <div>
                <dd className="text-5xl font-bold tracking-tight text-slate-900 mb-4">5K+</dd>
                <dt className="text-lg font-semibold text-slate-600 mb-2">Followers</dt>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  活跃的社区成员关注着我们的故事，并在多个平台和渠道上分享见解。
                </p>
              </div>
              
              <div>
                <dd className="text-5xl font-bold tracking-tight text-slate-900 mb-4">2K+</dd>
                <dt className="text-lg font-semibold text-slate-600 mb-2">Active Members</dt>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  积极参与社区成员，为讨论、活动和合作项目做出贡献。
                </p>
              </div>
              
              <div>
                <dd className="text-5xl font-bold tracking-tight text-slate-900 mb-4">5K+</dd>
                <dt className="text-lg font-semibold text-slate-600 mb-2">Jobs</dt>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  资源库内已有5k+远程岗位，所有岗位开放前都会经过人工审核。
                </p>
              </div>
            </div>
            
            <p className="text-center text-slate-500 mt-12 max-w-3xl mx-auto">
              自2025年8月上线以来，我们见证了令人瞩目的增长和用户参与度。我们的社区代表着全球范围内日益兴起的灵活、不受地域限制的工作模式。
            </p>
          </div>
        </div>
      </div>

      {/* Team/Creators Section */}
      <div className="relative py-24 sm:py-32 bg-slate-900">
         {/* Background Image Overlay */}
         <div className="absolute inset-0">
          <img 
            src={pic4} 
            alt="Team Background" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 to-slate-900/70"></div>
        </div>

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-6">
              我们才华横溢的核心创作者
            </h2>
            <p className="text-lg text-slate-300">
              Haigoo 的优势在于我们多元化的专业人士社群，他们来自不同的行业和背景，带来了独特的视角和专业知识。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-2">
            {/* Creator 1 */}
            <div className="flex gap-6">
              <div className="flex-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Zap className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-8 text-white">人工智能产品创新者</h3>
                <p className="mt-2 text-base leading-7 text-slate-400">
                  专注于自动化的产品经理，他们致力于为全球远程团队开发智能系统并简化工作流程。
                </p>
              </div>
            </div>

            {/* Creator 2 */}
            <div className="flex gap-6">
              <div className="flex-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Globe className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-8 text-white">全球品牌专家</h3>
                <p className="mt-2 text-base leading-7 text-slate-400">
                  拥有若干个国际市场丰富经验的营销专业人士，为跨文化商业战略带来宝贵见解。
                </p>
              </div>
            </div>

            {/* Creator 3 */}
            <div className="flex gap-6">
              <div className="flex-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Target className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-8 text-white">创意总监</h3>
                <p className="mt-2 text-base leading-7 text-slate-400">
                  才华横溢的电影编剧、创意总监和内容策略师，将讲故事的专业知识带入我们的社区活动。
                </p>
              </div>
            </div>

            {/* Creator 4 */}
            <div className="flex gap-6">
              <div className="flex-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Rocket className="h-6 w-6 text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-8 text-white">技术创新者</h3>
                <p className="mt-2 text-base leading-7 text-slate-400">
                  工程师、后端开发人员和技术专家正在探索自助媒体、内容创作和远程协作工具的新领域。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vision & CTA Section */}
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-8">
            我们对未来的愿景
          </h2>
          <div className="max-w-2xl mx-auto space-y-6 text-lg text-slate-600 mb-16">
            <p>
              我们认为远程办公不仅仅是一种趋势，更是一种在职业和个人生活中追求更大自主性、灵活性和意义的趋势。
            </p>
            <p>
              我们正在开创一种全新的模式，在这种模式下，成功的衡量标准不仅在于工作效率，更在于成就感和幸福感。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              to="/register"
              className="rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg hover:bg-blue-500 hover:shadow-xl transition-all flex items-center gap-2"
            >
              加入远程革命 <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/jobs"
              className="rounded-lg px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-50 transition-all border border-slate-200"
            >
              探索工作机会
            </Link>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-100">
            <p className="text-slate-500">
              联系我们: <a href="mailto:hi@haigooremote.com" className="text-blue-600 hover:text-blue-500 font-medium">hi@haigooremote.com</a>
              <span className="mx-4 text-slate-300">|</span>
              Founder Wechat: caitlinyct
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
