import React from 'react'

export default function HeroIllustration({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-full h-full ${className}`} viewBox="0 0 800 360" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a6e3ff"/>
          <stop offset="1" stopColor="#fde5c7"/>
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#79e2d0"/>
          <stop offset="1" stopColor="#27c3b4"/>
        </linearGradient>
        <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0ea5a3"/>
          <stop offset="1" stopColor="#f59f0b"/>
        </linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.08"/></filter>
      </defs>

      {/* background soft gradient */}
      <rect x="0" y="0" width="800" height="360" fill="url(#bg)" opacity="0.35"/>

      {/* abstract cloud with headphones */}
      <g transform="translate(120,90)" filter="url(#shadow)">
        <rect x="-40" y="-20" width="220" height="120" rx="60" fill="#fff" opacity="0.9"/>
        <circle cx="10" cy="40" r="16" fill="#333"/>
        <circle cx="90" cy="40" r="16" fill="#333"/>
        <g>
          <rect x="-60" y="10" width="24" height="40" rx="12" fill="#0ea5a3"/>
          <rect x="184" y="10" width="24" height="40" rx="12" fill="#f59f0b"/>
          <path d="M -36 30 C 0 -20, 160 -20, 208 30" stroke="#8bbefc" strokeWidth="8" fill="none" opacity="0.35"/>
        </g>
      </g>

      {/* circuit style lines */}
      <g stroke="url(#line)" strokeWidth="2" fill="none" opacity="0.7">
        <path d="M 60 220 C 180 160, 300 160, 420 220"/>
        <path d="M 120 250 L 120 200"/>
        <circle cx="120" cy="200" r="4" fill="#0ea5a3"/>
        <path d="M 220 250 L 220 180"/>
        <circle cx="220" cy="180" r="4" fill="#f59f0b"/>
        <path d="M 320 250 L 320 190"/>
        <circle cx="320" cy="190" r="4" fill="#0ea5a3"/>
      </g>

      {/* island silhouette */}
      <g transform="translate(470,190)">
        <ellipse cx="80" cy="40" rx="120" ry="30" fill="url(#sea)" opacity="0.8"/>
        <rect x="40" y="-20" width="12" height="60" rx="6" fill="#6cc05a"/>
        <rect x="100" y="-12" width="12" height="50" rx="6" fill="#6cc05a"/>
        <path d="M 46 -18 C 10 -40, 20 -60, 48 -26" stroke="#6cc05a" strokeWidth="6" fill="none"/>
        <path d="M 106 -10 C 70 -30, 80 -50, 108 -16" stroke="#6cc05a" strokeWidth="6" fill="none"/>
        <rect x="35" y="10" width="24" height="14" rx="3" fill="#c27f48"/>
        <rect x="96" y="12" width="24" height="14" rx="3" fill="#c27f48"/>
      </g>
    </svg>
  )
}