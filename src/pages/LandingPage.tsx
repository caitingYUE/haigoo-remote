import { useNavigate } from 'react-router-dom'
 
import '../styles/landing-upgrade.css'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import homeBgSvg from '../assets/home_bg.svg'
import ChinaSvg from '../assets/China.svg'
import OverseasSvg from '../assets/Overseas.svg'
import { ArrowRight } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()

  // Removed forced smooth scroll for better native feel

  return (
    <div className="landing-page-wrapper">
      {/* CSS-based Mesh Gradient Background */}
      <div className="mesh-background"></div>

      <div className="hero-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="hero-title">
            WORK YOUR BRAIN,<br />
            LEAVE YOUR BODY TO BE HAPPY
          </h1>
          <p className="hero-subtitle">
            连接全球优质远程机会，让工作回归生活。<br />
            无论是身在国内还是海外，都能找到属于你的自由工作方式。
          </p>

          <div className="hero-illustration-container">
            <img src={homeBgSvg} alt="Remote Work Illustration" className="hero-illustration mx-auto" />
          </div>

          <div className="entry-cards-grid">
            {/* Domestic Card */}
            <div
              className="entry-card-modern"
              onClick={() => navigate('/jobs?region=domestic')}
              role="button"
              tabIndex={0}
            >
              <div className="card-icon-wrapper">
                <img src={ChinaSvg} alt="China" className="card-icon" />
              </div>
              <h3 className="card-title">
                我在国内
                <ArrowRight className="card-arrow" size={24} />
              </h3>
              <p className="card-desc">
                探索适合中国时区的全球远程机会
              </p>
              <div className="card-tags">
                <span className="card-tag">China</span>
                <span className="card-tag">APAC</span>
                <span className="card-tag">UTC+8</span>
              </div>
            </div>

            {/* Overseas Card */}
            <div
              className="entry-card-modern"
              onClick={() => navigate('/jobs?region=overseas')}
              role="button"
              tabIndex={0}
            >
              <div className="card-icon-wrapper">
                <img src={OverseasSvg} alt="Overseas" className="card-icon" />
              </div>
              <h3 className="card-title">
                我在海外
                <ArrowRight className="card-arrow" size={24} />
              </h3>
              <p className="card-desc">
                连接欧美及全球各地的远程岗位
              </p>
              <div className="card-tags">
                <span className="card-tag">USA</span>
                <span className="card-tag">Europe</span>
                <span className="card-tag">Global</span>
              </div>
            </div>
          </div>

          <div className="mt-16 max-w-2xl mx-auto">
            <JobAlertSubscribe variant="card" />
          </div>
        </div>
      </div>
    </div>
  )
}
