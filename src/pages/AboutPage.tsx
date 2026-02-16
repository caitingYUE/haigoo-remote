import { useEffect } from 'react'
import { Users, Globe, Briefcase, Heart, Share2, Target, Rocket, ArrowRight, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import pic1 from '../assets/images/pic1.webp'
import pic2 from '../assets/images/pic2.webp'
import pic3 from '../assets/images/pic3.webp'
import pic4 from '../assets/images/pic4.webp'

export default function AboutPage() {
  const { isMember } = useAuth()

  // Scroll to top on mount for smooth transition
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative bg-white pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="max-w-2xl relative z-10">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl mb-6">
                Haigoo Remote Club<br/>
                <span className="text-indigo-600">海狗远程俱乐部</span>
              </h1>
              <p className="text-lg leading-8 text-slate-600 mb-8">
                远程办公，无限可能。我们成立于2025年，致力于构建一个面向中国人的远程工作平台，帮助国人直达可信的海内外远程岗，告别求职焦虑，让梦想中的生活更进一步。
              </p>
              <div className="flex items-center gap-x-6">
                <Link
                  to="/jobs"
                  className="rounded-full bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all flex items-center gap-2"
                >
                  探索远程机会 <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            
            {/* Right Image */}
            <div className="relative lg:ml-auto">
              <div className="absolute -inset-4 bg-indigo-50 rounded-[2rem] transform rotate-3 -z-10"></div>
              <img
                src={pic1}
                alt="Remote Work Workspace"
                className="w-full max-w-lg rounded-2xl shadow-2xl object-cover aspect-[4/3] ml-auto transform -rotate-2 hover:rotate-0 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <div className="bg-indigo-700 py-24 sm:py-32 text-white relative overflow-hidden">
        {/* Decorative Background Pattern */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
           </svg>
        </div>

        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl mb-8">
                我们的使命：<br/>重新定义工作与生活
              </h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-indigo-100">超越传统界限</h3>
                  <p className="text-white/80 leading-relaxed text-lg">
                    Haigoo Remote Club 的创立源于一个简单的信念：工作应该提升生活品质，而不是限制生活。我们成立于 2025 年 8 月 20 日，创建了一个致力于远程办公和数字化生活方式创新的开放社区。
                  </p>
                </div>
                
                <p className="text-white/80 leading-relaxed text-lg">
                  我们汇聚来自世界各地的远程爱好者，分享知识，互相支持，携手重新定义现代工作和生活。我们的目标是让每个人都能拥有更自由、更快乐、更有意义的生活方式。
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-white/10 rounded-3xl transform -rotate-3 backdrop-blur-sm"></div>
              <img
                src={pic2}
                alt="Window View"
                className="w-full rounded-2xl shadow-2xl object-cover aspect-[3/4] lg:aspect-square transform rotate-3 hover:rotate-0 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vision & Values Section */}
      <div className="py-24 sm:py-32 bg-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Image Side (Using Pic3 - Abstract for Vision) */}
            <div className="relative order-2 lg:order-1">
              <div className="absolute -inset-4 bg-indigo-50 rounded-3xl transform rotate-3"></div>
              <img
                src={pic3}
                alt="Vision"
                className="relative w-full rounded-2xl shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-500 object-cover aspect-[4/3]"
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
                <div className="flex gap-4 group">
                   <div className="flex-none w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                     <Share2 className="w-7 h-7" />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">开放与分享</h3>
                     <p className="text-slate-500 mt-1">我们坚持透明与开源，每一份经验的分享都是社区共同的财富。</p>
                   </div>
                </div>

                {/* Value 2 */}
                <div className="flex gap-4 group">
                   <div className="flex-none w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                     <Globe className="w-7 h-7" />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">自由与探索</h3>
                     <p className="text-slate-500 mt-1">打破地域限制，探索无限可能，让工作适应生活，而非生活迁就工作。</p>
                   </div>
                </div>

                {/* Value 3 */}
                <div className="flex gap-4 group">
                   <div className="flex-none w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                     <Heart className="w-7 h-7" />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">互助与利他</h3>
                     <p className="text-slate-500 mt-1">真诚互助，彼此成就。在Haigoo，没有人是一座孤岛。</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Growth Ecosystem Section */}
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
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-indigo-100 -translate-y-1/2 hidden lg:block"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
              {/* Stat 1 */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 flex flex-col items-center hover:-translate-y-2 transition-transform duration-300">
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mb-6 text-white shadow-indigo-200 shadow-xl">
                  <Users className="w-8 h-8" />
                </div>
                <dd className="text-4xl font-bold text-slate-900 mb-2">5K+</dd>
                <dt className="text-slate-600 font-medium">关注者</dt>
                <p className="text-sm text-slate-400 mt-4">跨平台的忠实读者与支持者</p>
              </div>

              {/* Stat 2 (Center) */}
              <div className="bg-white rounded-2xl p-8 shadow-xl border-t-4 border-indigo-600 flex flex-col items-center transform md:scale-110 z-20">
                <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mb-6 text-white shadow-indigo-200 shadow-xl">
                  <Target className="w-10 h-10" />
                </div>
                <dd className="text-5xl font-bold text-slate-900 mb-2">2K+</dd>
                <dt className="text-slate-600 font-medium">活跃会员</dt>
                <p className="text-sm text-slate-400 mt-4">深度参与共建的核心力量</p>
              </div>

              {/* Stat 3 */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 flex flex-col items-center hover:-translate-y-2 transition-transform duration-300">
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mb-6 text-white shadow-indigo-200 shadow-xl">
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

      {/* Creators Section (New Layout with Pic4) */}
      <div className="py-24 sm:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
             <div className="max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-6">
                  我们才华横溢的核心创作者
                </h2>
                <p className="text-lg text-slate-600 mb-12">
                  Haigoo 的优势在于我们多元化的专业人士社群，他们来自不同的行业和背景，带来了独特的视角和专业知识。
                </p>

                <div className="space-y-8">
                  <div className="flex gap-4">
                    <div className="flex-none w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">人工智能产品创新者</h3>
                      <p className="text-slate-500 mt-1">致力于为全球远程团队开发智能系统并简化工作流程。</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-none w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">全球品牌专家</h3>
                      <p className="text-slate-500 mt-1">拥有丰富国际市场经验，为跨文化商业战略带来宝贵见解。</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-none w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">创意总监与内容策略师</h3>
                      <p className="text-slate-500 mt-1">将讲故事的专业知识带入社区活动，探索远程协作新领域。</p>
                    </div>
                  </div>
                </div>
             </div>

             <div className="relative">
                <div className="absolute -inset-4 bg-indigo-100 rounded-3xl transform rotate-3"></div>
                <img 
                  src={pic4} 
                  alt="Our Team" 
                  className="w-full rounded-2xl shadow-2xl object-cover aspect-[4/5] transform -rotate-2 hover:rotate-0 transition-transform duration-500"
                />
             </div>
          </div>
        </div>
      </div>

      {/* Join Revolution Section (CTA) */}
      <div className="py-24 sm:py-32 bg-slate-900 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-slate-900"></div>
        <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl mb-6">
            加入这场远程变革
          </h2>
          <p className="text-xl text-indigo-200 max-w-2xl mx-auto mb-12">
            无论你是寻找机会、分享经验，还是寻找伙伴，这里都有你的位置。现在就开启你的远程工作之旅。
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            {!isMember ? (
              <Link
                to="/membership"
                className="rounded-full bg-white px-8 py-4 text-base font-bold text-indigo-600 shadow-lg hover:bg-indigo-50 hover:scale-105 transition-all duration-300"
              >
                加入俱乐部会员
              </Link>
            ) : (
              <Link
                to="/jobs"
                className="rounded-full bg-white px-8 py-4 text-base font-bold text-indigo-600 shadow-lg hover:bg-indigo-50 hover:scale-105 transition-all duration-300"
              >
                浏览远程岗位
              </Link>
            )}
            
            <a 
              href="mailto:hi@haigooremote.com"
              className="rounded-full px-8 py-4 text-base font-bold text-white border border-white/30 hover:bg-white/10 hover:border-white transition-all duration-300"
            >
              联系我们
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
