import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Zap, Award, Target, Briefcase, Building2, User } from 'lucide-react'
import HomeJobCard from '../components/HomeJobCard'
import HomeCompanyCard from '../components/HomeCompanyCard'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { Job } from '../types'

interface Member {
    title: string
}

export default function AboutPage() {
    const navigate = useNavigate()
    const [featuredJobs, setFeaturedJobs] = useState<Job[]>([])
    const [featuredCompanies, setFeaturedCompanies] = useState<TrustedCompany[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [companyJobStats, setCompanyJobStats] = useState<Record<string, { total: number, categories: Record<string, number> }>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)
                
                // Fetch Data in Parallel
                const [jobsResp, companies, membersResp] = await Promise.all([
                    processedJobsService.getProcessedJobs(1, 6, { isFeatured: true }),
                    trustedCompaniesService.getAllCompanies(),
                    fetch('/api/public-members').then(res => res.json())
                ])

                // Set Featured Jobs
                if (jobsResp && jobsResp.jobs) {
                    setFeaturedJobs(jobsResp.jobs.slice(0, 6))
                }

                // Process Companies stats (similar to LandingPage)
                // We need job stats for company cards
                // For efficiency, we might need to fetch all jobs or just rely on what we have.
                // Since LandingPage fetches 100 jobs to calculate stats, we can do similar or skip stats if performance is key.
                // Let's fetch some jobs to get stats, or just reuse the featured jobs if that's enough (probably not).
                // Let's try to fetch a batch of jobs for stats calculation.
                const allJobsResp = await processedJobsService.getAllProcessedJobsFull(100, 1);
                const allJobs = allJobsResp; // getAllProcessedJobsFull returns Job[] directly
                
                const statsMap: Record<string, { total: number, categories: Record<string, number> }> = {}
                const normalize = (name: string) => name?.toLowerCase().replace(/[,.]/g, '').replace(/\s+/g, ' ').trim() || ''

                allJobs.forEach(job => {
                    if (!job.company) return
                    const jobCompanyNorm = normalize(job.company)
                    
                    const company = companies.find(c => {
                        const cName = normalize(c.name)
                        return cName === jobCompanyNorm || cName.includes(jobCompanyNorm) || jobCompanyNorm.includes(cName)
                    })

                    if (company) {
                        if (!statsMap[company.name]) {
                            statsMap[company.name] = { total: 0, categories: {} }
                        }
                        statsMap[company.name].total++
                        const cat = job.category || '其他'
                        statsMap[company.name].categories[cat] = (statsMap[company.name].categories[cat] || 0) + 1
                    }
                })
                setCompanyJobStats(statsMap)

                // Sort companies by job count and take top 6
                const sortedCompanies = [...companies].sort((a, b) => {
                    const countA = statsMap[a.name]?.total || 0
                    const countB = statsMap[b.name]?.total || 0
                    return countB - countA
                })
                setFeaturedCompanies(sortedCompanies.slice(0, 6))

                // Set Members
                if (membersResp.success && membersResp.members) {
                    setMembers(membersResp.members)
                }

            } catch (error) {
                console.error('Failed to load about page data:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [])

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-slate-50 pt-16 pb-24 lg:pt-32 lg:pb-40">
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
                        <div className="lg:col-span-6 text-left">
                            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
                                <span className="block">先成为朋友</span>
                                <span className="block text-indigo-600">再成为伙伴</span>
                            </h1>
                            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                                我们不仅仅是连接人才与企业，更是通过深度沟通，为你匹配价值观一致的<span className="font-semibold text-indigo-600">顶尖远程团队</span>。
                            </p>
                            <div className="mt-8 flex gap-4">
                                <button 
                                    onClick={() => document.getElementById('featured-companies')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    探索精选企业
                                </button>
                                <button 
                                    onClick={() => document.getElementById('club-benefits')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="px-8 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                                >
                                    加入俱乐部
                                </button>
                            </div>
                        </div>
                        <div className="mt-16 lg:mt-0 lg:col-span-6">
                            {/* Image Grid / Mosaic */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-4 mt-8">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="h-32 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                                             {/* Placeholder for CEO/Culture Image */}
                                             <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">Figma CEO</div>
                                        </div>
                                        <p className="font-medium text-slate-900">"设计是在协作的语境下"</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                         <div className="h-32 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                                             <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">Notion CEO</div>
                                        </div>
                                        <p className="font-medium text-slate-900">"赋予每个人构建工具的能力"</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                         <div className="h-32 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                                             <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">Zapier CEO</div>
                                        </div>
                                        <p className="font-medium text-slate-900">"自动化让工作更人性化"</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                         <div className="h-32 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                                             <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">Slack CEO</div>
                                        </div>
                                        <p className="font-medium text-slate-900">"让工作生活更简单、愉快、高效"</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Core Highlights */}
            <div className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900">俱乐部的核心亮点</h2>
                        <p className="mt-4 text-lg text-slate-500">我们不仅仅是一个招聘平台，更是一个基于共同价值观的专业社群。</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-lg transition-shadow">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                                <Users className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">先交朋友，后合作</h3>
                            <p className="text-slate-600 leading-relaxed">我们创造一个业余轻松的交流环境，让合作在相互了解和信任的基础上自然发生。</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-lg transition-shadow">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                                <Target className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">价值观与能力双重匹配</h3>
                            <p className="text-slate-600 leading-relaxed">我们深入了解企业文化和CEO价值观，确保为你推荐的不仅仅是工作机会，更是事业归属。</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:shadow-lg transition-shadow">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                                <Award className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">深度连结，共同成长</h3>
                            <p className="text-slate-600 leading-relaxed">通过专属社群和活动，与行业精英、企业创始人直接对话，拓展你的人脉与视野。</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Featured Companies */}
            <div id="featured-companies" className="py-24 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900">精选合作企业</h2>
                        <p className="mt-4 text-lg text-slate-500">我们甄选崇尚优秀文化、重视人才发展的远程企业深度合作。</p>
                    </div>
                    
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {featuredCompanies.map(company => (
                                <HomeCompanyCard 
                                    key={company.id} 
                                    company={company} 
                                    jobStats={companyJobStats[company.name]}
                                    onClick={() => navigate(`/company/${company.id}`)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Featured Jobs */}
            <div className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900">精选远程岗位</h2>
                        <p className="mt-4 text-lg text-slate-500">挖掘各个细分领域的顶尖远程工作机会。</p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {featuredJobs.map(job => (
                                <HomeJobCard 
                                    key={job.id} 
                                    job={job}
                                    onClick={() => navigate(`/jobs?region=domestic`)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Job Alert Subscription */}
                    <div className="mt-16 max-w-3xl mx-auto">
                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900">订阅以获取更多精选岗位推送</h3>
                            </div>
                            <JobAlertSubscribe variant="card" theme="light" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Members Ticker / Grid */}
            {members.length > 0 && (
                <div className="py-24 bg-slate-900 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 text-center">
                        <h2 className="text-3xl font-bold text-white">我们的会员</h2>
                        <p className="mt-4 text-slate-400">汇聚各行业精英，与优秀者同行</p>
                    </div>
                    
                    {/* Marquee effect or simple grid */}
                    <div className="relative">
                        <div className="flex flex-wrap justify-center gap-4 max-w-7xl mx-auto px-4">
                            {members.map((member, index) => (
                                <div key={index} className="bg-slate-800/50 backdrop-blur px-6 py-3 rounded-full border border-slate-700 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                        {/* First letter or random char? */}
                                        <User className="w-4 h-4" />
                                    </div>
                                    <span className="text-slate-200 font-medium text-sm">{member.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Club Benefits */}
            <div id="club-benefits" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900">加入俱乐部，您将获得</h2>
                        <p className="mt-4 text-lg text-slate-500">我们为您提供超越求职的价值，助力你的职业成长。</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                         <div className="text-center">
                            <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                                <Target className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">价值匹配</h3>
                            <p className="text-sm text-slate-500">深入企业文化，为您匹配价值观契合的团队。</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                                <Zap className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">直连CEO</h3>
                            <p className="text-sm text-slate-500">优秀会员有机会参与企业创始人深度交流。</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                                <Users className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">合作交流</h3>
                            <p className="text-sm text-slate-500">保持行业敏感，在互动社群中分享洞见，共同成长。</p>
                        </div>
                         <div className="text-center">
                            <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                                <Briefcase className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">岗位内推</h3>
                            <p className="text-sm text-slate-500">优先获得未公开的高质量远程岗位内推机会。</p>
                        </div>
                    </div>

                    {/* Call to Action */}
                    <div className="mt-24 bg-indigo-50 rounded-3xl p-12 text-center">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">准备好开启新的职业篇章了吗？</h2>
                        <p className="text-lg text-slate-600 mb-8">加入远程俱乐部，与宽阔的世界伙伴一起，探索远程工作的无限可能。</p>
                        <button 
                            onClick={() => navigate('/register')}
                            className="px-10 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 hover:shadow-2xl hover:-translate-y-1"
                        >
                            免费注册，发现机会
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
