import React from 'react'

export default function AbstractTechBackground({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} aria-hidden>
      <svg className="w-full h-full" viewBox="0 0 1440 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a6e3ff" stopOpacity="0.6" />
            <stop offset="1" stopColor="#fde5c7" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0ea5a3" stopOpacity="0.25" />
            <stop offset="1" stopColor="#f59f0b" stopOpacity="0.25" />
          </linearGradient>
          <filter id="blurSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="40" />
          </filter>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#6ee7ff" floodOpacity="0.35" />
          </filter>
        </defs>

        <rect x="0" y="0" width="1440" height="800" fill="url(#g1)" />

        <g filter="url(#blurSoft)">
          <circle cx="220" cy="140" r="160" fill="#a6e3ff" opacity="0.35" />
          <circle cx="1240" cy="180" r="200" fill="#fde5c7" opacity="0.35" />
          <circle cx="900" cy="620" r="180" fill="#c8fff1" opacity="0.25" />
        </g>

        <g stroke="url(#g2)" strokeWidth="2" fill="none" filter="url(#glow)" opacity="0.6">
          <path d="M 100 520 C 360 420 680 420 1340 520" />
          <path d="M 80 580 C 340 480 700 480 1360 580" />
          <path d="M 60 640 C 300 540 720 540 1380 640" />
        </g>

        <g opacity="0.35">
          <rect x="180" y="260" rx="26" ry="26" width="180" height="110" fill="#dff6ff" />
          <rect x="1100" y="420" rx="26" ry="26" width="160" height="90" fill="#fff1df" />
          <rect x="760" y="140" rx="26" ry="26" width="200" height="120" fill="#eaf8f3" />
        </g>
      </svg>
    </div>
  )
}