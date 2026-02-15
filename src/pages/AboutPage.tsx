
import { Users, Globe, Briefcase, Heart, Share2, Target, Rocket, ArrowRight, Zap } from 'lucide-react'
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
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl mb-8">
                我们的使命：<br/>重新定义工作与生活
              </h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-white/90">超越传统界限</h3>
                  <p className="text-white/80 leading-relaxed">
                    Haigoo Remote Club 的创立源于一个简单的信念：工作应该提升生活品质，而不是限制生活。我们成立于 2025 年 8 月 20 日，创建了一个致力于远程办公和数字化生活方式创新的开放社区。
                  </p>
                </div>
                
                <p className="text-white/80 leading-relaxed">
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

      {/* Vision & Values Section (Fig 2) */}
      <div className="py-24 sm:py-32 bg-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Image Side */}
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-4 bg-blue-100 rounded-3xl transform -rotate-3"></div>
              <img
                src={pic4}
                alt="Vision"
                className="relative w-full rounded-2xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500 object-cover aspect-[4/3]"
              />
            </div>
            
            {/* Content Side */}
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-6">
                我们的愿景：<br/>构建未来的工作方式
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                我们不仅是在寻找工作，更是在创造一种全新的生活方式。通过技术与社区的连接，让每个人都能找到属于自己的自由。我们相信，未来的工作不再被地点定义，而是由价值和热情驱动。
              </p>
              
              <div className="space-y-8">
                {/* Value 1 */}
                <div className="flex gap-4">
                   <div className="flex-none w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                     <Share2 className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 text-lg">开放与分享</h3>
                     <p className="text-slate-500 mt-1">我们坚持透明与开源，每一份经验的分享都是社区共同的财富。</p>
                   </div>
                </div>

                {/* Value 2 */}
                <div className="flex gap-4">
                   <div className="flex-none w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                     <Globe className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 text-lg">自由与探索</h3>
                     <p className="text-slate-500 mt-1">打破地域限制，探索无限可能，让工作适应生活，而非生活迁就工作。</p>
                   </div>
                </div>

                {/* Value 3 */}
                <div className="flex gap-4">
                   <div className="flex-none w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                     <Heart className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 text-lg">互助与利他</h3>
                     <p className="text-slate-500 mt-1">真诚互助，彼此成就。在Haigoo，没有人是一座孤岛。</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Growth Ecosystem Section (Fig 3) */}
      <div className="relative py-24 sm:py-32 bg-slate-50 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-4">
            不断成长的生态系统
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-16">
            自2025年成立以来，我们正在构建一个连接全球远程工作者的活力网络
          </p>

          <div className="relative max-w-5xl mx-auto">
            {/* Connecting Lines (Decorative) */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-blue-100 -translate-y-1/2 hidden lg:block"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
              {/* Stat 1 */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 flex flex-col items-center hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6 text-white shadow-blue-200 shadow-xl">
                  <Users className="w-8 h-8" />
                </div>
                <dd className="text-4xl font-bold text-slate-900 mb-2">5K+</dd>
                <dt className="text-slate-600 font-medium">关注者</dt>
                <p className="text-sm text-slate-400 mt-4">跨平台的忠实读者与支持者</p>
              </div>

              {/* Stat 2 (Center) */}
              <div className="bg-white rounded-2xl p-8 shadow-xl border-t-4 border-blue-600 flex flex-col items-center transform md:scale-110">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 text-white shadow-blue-200 shadow-xl">
                  <Target className="w-10 h-10" />
                </div>
                <dd className="text-5xl font-bold text-slate-900 mb-2">2K+</dd>
                <dt className="text-slate-600 font-medium">活跃会员</dt>
                <p className="text-sm text-slate-400 mt-4">深度参与共建的核心力量</p>
              </div>

              {/* Stat 3 */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 flex flex-col items-center hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6 text-white shadow-blue-200 shadow-xl">
                  <Briefcase className="w-8 h-8" />
                </div>
                <dd className="text-4xl font-bold text-slate-900 mb-2">5K+</dd>
                <dt className="text-slate-600 font-medium">精选岗位</dt>
                <p className="text-sm text-slate-400 mt-4">经过严格人工审核的远程机会</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Join Revolution Section (Fig 4) */}
      <div className="py-24 sm:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-4">
              加入这场远程变革
            </h2>
            <p className="text-lg text-slate-600">
              无论你是寻找机会、分享经验，还是寻找伙伴，这里都有你的位置
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="group relative bg-slate-50 rounded-2xl p-8 hover:bg-blue-600 transition-colors duration-300">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:bg-white/20">
                <Rocket className="w-6 h-6 text-blue-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-white">发现机会</h3>
              <p className="text-slate-600 mb-6 group-hover:text-blue-100">
                浏览我们精选的全球远程工作机会，找到最适合你的职业发展路径。
              </p>
              <Link to="/jobs" className="inline-flex items-center text-blue-600 font-semibold group-hover:text-white">
                浏览岗位 <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>

            {/* Card 2 */}
            <div className="group relative bg-slate-50 rounded-2xl p-8 hover:bg-blue-600 transition-colors duration-300">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:bg-white/20">
                <Users className="w-6 h-6 text-blue-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-white">加入社区</h3>
              <p className="text-slate-600 mb-6 group-hover:text-blue-100">
                连接数千名远程工作者，参与线上线下活动，拓展你的人脉网络。
              </p>
              <Link to="/community" className="inline-flex items-center text-blue-600 font-semibold group-hover:text-white">
                加入我们 <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>

            {/* Card 3 */}
            <div className="group relative bg-slate-50 rounded-2xl p-8 hover:bg-blue-600 transition-colors duration-300">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:bg-white/20">
                <Share2 className="w-6 h-6 text-blue-600 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-white">贡献价值</h3>
              <p className="text-slate-600 mb-6 group-hover:text-blue-100">
                分享你的经验和见解，成为社区的建设者，帮助更多人实现远程梦想。
              </p>
              <a href="https://github.com/Haigoo-Remote-Club" target="_blank" rel="noreferrer" className="inline-flex items-center text-blue-600 font-semibold group-hover:text-white">
                参与贡献 <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Team/Creators Section (Modified Background) */}
      <div className="relative py-24 sm:py-32 bg-slate-900">
         {/* Simple Gradient Background */}
         <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900"></div>

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
