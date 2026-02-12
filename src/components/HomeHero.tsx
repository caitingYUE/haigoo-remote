import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { Search, Sparkles, Gift } from 'lucide-react'
import happinessCards from '../data/happiness-cards.json'
import { HappinessCard } from './Christmas/HappinessCard'

interface HomeHeroProps {
    stats?: {
        totalJobs: number | null
        companiesCount: number | null
        dailyJobs: number | null
    }
}

export default function HomeHero({ stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [isChristmas, setIsChristmas] = useState(false)
    const [showHappinessCard, setShowHappinessCard] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [hotTags, setHotTags] = useState(['前端开发', '后端开发', '全栈', '产品经理', '设计师', '运营'])

    useEffect(() => {
        // Listen for custom event from Header to open Happiness Card
        const handleOpenCard = () => setShowHappinessCard(true);
        window.addEventListener('open-happiness-card', handleOpenCard);

        // Force New Year Mode
        setIsChristmas(true)

        // Fetch Top 6 Hot Tags
        const fetchHotTags = async () => {
            try {
                // Use pageSize=0 to only get aggregations
                const res = await fetch('/api/data/processed-jobs?pageSize=0')
                if (res.ok) {
                    const data = await res.json()
                    if (data.aggregations && data.aggregations.category) {
                        // Sort by count desc and take top 6
                        const topCategories = data.aggregations.category
                            .sort((a: any, b: any) => b.count - a.count)
                            .slice(0, 5)
                            .map((c: any) => c.value)
                        
                        if (topCategories.length > 0) {
                    setHotTags(topCategories)
                }
            }
        }
    } catch (error) {
        console.error('Failed to fetch hot tags', error)
    }
}

fetchHotTags()

return () => {
    window.removeEventListener('open-happiness-card', handleOpenCard);
}
}, [])

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/jobs?search=${encodeURIComponent(searchQuery)}`)
        }
    }

    return (
        <div className="relative min-h-[800px] flex items-center justify-center overflow-hidden">
            {/* Background Image & Overlay */}
            <div className="absolute inset-0 z-0 bg-neutral-900">
                <img 
                    src="/background.webp" 
                    alt="Background" 
                    className={`w-full h-full object-cover object-[10%_15%] transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                    loading="eager"
                    decoding="async"
                />
                {/* Gradient Overlay for better text readability while keeping image visible */}
                {/* Updated to warmer neutral tones for a more positive feel - Brightened per user request */}
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/60 via-neutral-900/20 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/40 via-transparent to-transparent"></div>
                
                {/* Ambient Atmosphere - Golden Glows */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[100px] animate-pulse"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-red-500/10 rounded-full blur-[80px] animate-pulse delay-1000"></div>
                </div>

                {/* Subtle Floating Particles (Golden Dust) */}
                <div className="absolute inset-0 pointer-events-none">
                    <style>{`
                        @keyframes float-particle {
                            0% { transform: translateY(0) translateX(0); opacity: 0; }
                            10% { opacity: 0.5; }
                            90% { opacity: 0.5; }
                            100% { transform: translateY(-100px) translateX(20px); opacity: 0; }
                        }
                    `}</style>
                    {[...Array(6)].map((_, i) => (
                        <div 
                            key={i}
                            className="absolute rounded-full bg-amber-200/40 blur-[1px]"
                            style={{
                                width: Math.random() * 4 + 2 + 'px',
                                height: Math.random() * 4 + 2 + 'px',
                                top: Math.random() * 100 + '%',
                                left: Math.random() * 100 + '%',
                                animation: `float-particle ${Math.random() * 10 + 10}s linear infinite ${Math.random() * 5}s`
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-16">
                <div className="flex flex-col md:flex-row items-end justify-between gap-8 lg:gap-12 min-h-[400px]">

                    {/* Left Column: Content - Aligned with left desk space */}
                    <div className="flex-1 text-left max-w-2xl z-10 mb-12 relative">
                        {/* English Tagline - Elegant Script */}
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <p className="text-2xl md:text-3xl font-serif italic text-white/95 tracking-wide font-light drop-shadow-md">
                                "You deserve a better life."
                            </p>
                        </div>

                        {/* Main Heading */}
                        <div className="relative">
                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 drop-shadow-xl">
                                <span className="block text-white mb-3 tracking-wide drop-shadow-lg relative">
                                    理想生活，
                                </span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-50 via-white to-amber-100 inline-block pb-2 filter drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
                                    从远程工作开始
                                </span>
                            </h1>
                        </div>

                        {/* Subtitle */}
                        <p className="text-lg md:text-xl text-white/90 mb-10 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-150 leading-relaxed font-light max-w-xl drop-shadow-md">
                            全球精选 <span className="text-white/60 mx-3">|</span> 国内可申 <span className="text-white/60 mx-3">|</span> 真实可投 <span className="text-white/60 mx-3">|</span> 优质远程文化
                        </p>

                        {/* Search Bar - Clean & Floating */}
                        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 relative group z-30">
                            {/* Glow effect */}
                            <div className="absolute -inset-1 bg-amber-100/10 rounded-2xl blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
                            <div className="relative flex flex-col gap-3">
                                <div className="relative flex">
                                    <input
                                        type="text"
                                        placeholder="搜索公司 / 职位 / 技能"
                                        className="w-full pl-4 pr-36 py-4 bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all shadow-xl text-lg placeholder:text-slate-500 text-slate-900"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                    <button
                                        onClick={handleSearch}
                                        className={`absolute right-2 top-2 bottom-2 px-6 bg-slate-900 text-white text-base font-bold rounded-xl transition-all duration-200 hover:bg-slate-800 shadow-lg flex items-center gap-2`}
                                    >
                                        <Search className="w-4 h-4" />
                                        搜索
                                    </button>
                                </div>
                                {/* Quick Search Tags */}
                                <div className="flex flex-wrap gap-2 px-2">
                                    {hotTags.map((tag, index) => (
                                        <button
                                            key={tag}
                                            onClick={() => {
                                                setSearchQuery(tag)
                                                navigate(`/jobs?search=${encodeURIComponent(tag)}`)
                                            }}
                                            className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-xs text-white/80 hover:bg-white/20 hover:text-white transition-all duration-200 flex items-center gap-1"
                                        >
                                            {index < 3 && <span className="text-[10px]">🔥</span>} {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {showHappinessCard && (
                <HappinessCard onClose={() => setShowHappinessCard(false)} />
            )}
        </div>
    )
}

