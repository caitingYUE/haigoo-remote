import React from 'react'

interface WorldMapProps {
    lat: number
    lng: number
    className?: string
}

export function WorldMap({ lat, lng, className = '' }: WorldMapProps) {
    // Convert lat/lng to SVG coordinates (Equirectangular projection)
    // Map dimensions: 100x50
    // Longitude: -180 to 180 -> 0 to 100
    const x = ((lng + 180) / 360) * 100

    // Latitude: 90 to -90 -> 0 to 50
    // Note: This is a simple linear projection. For better accuracy with standard maps, 
    // we might need Mercator, but for a simple visual indicator, linear is often sufficient 
    // and matches many simple SVG maps.
    const y = ((90 - lat) / 180) * 50

    return (
        <div className={`relative bg-slate-50 rounded-lg overflow-hidden ${className}`}>
            <svg viewBox="0 0 100 50" className="w-full h-full text-slate-200 fill-current">
                {/* Simplified World Map Path */}
                <path d="M96.6,12.3c-0.8-0.6-1.8-0.6-2.6-0.2c-0.5,0.3-0.9,0.7-1.3,1.2c-0.4,0.5-0.7,1.1-1.1,1.6c-0.5,0.7-1.1,1.3-1.8,1.8 c-0.8,0.5-1.7,0.8-2.6,0.9c-0.9,0.1-1.8-0.1-2.6-0.5c-0.6-0.3-1.1-0.8-1.5-1.4c-0.4-0.6-0.7-1.2-0.9-1.9c-0.2-0.7-0.3-1.4-0.3-2.1 c0-0.7,0.1-1.4,0.3-2.1c0.2-0.7,0.5-1.3,0.9-1.9c0.4-0.5,0.9-1,1.5-1.3c0.6-0.3,1.2-0.5,1.9-0.5c0.7,0,1.3,0.2,1.9,0.5 c0.6,0.3,1.1,0.8,1.5,1.3c0.4,0.6,0.7,1.2,0.9,1.9c0.2,0.7,0.3,1.4,0.3,2.1C97,11.2,96.9,11.8,96.6,12.3z M82.6,11.8 c-0.2-0.6-0.6-1.1-1.1-1.5c-0.5-0.4-1.1-0.6-1.7-0.7c-0.6-0.1-1.2,0-1.8,0.2c-0.6,0.2-1.1,0.6-1.5,1.1c-0.4,0.5-0.7,1.1-0.8,1.7 c-0.1,0.6-0.1,1.3,0.1,1.9c0.2,0.6,0.5,1.1,1,1.5c0.5,0.4,1,0.7,1.6,0.8c0.6,0.1,1.2,0,1.8-0.2c0.6-0.2,1.1-0.6,1.5-1.1 C82.5,14.8,82.7,13.4,82.6,11.8z M71.4,12.5c-0.4-0.5-0.9-0.9-1.5-1.2c-0.6-0.3-1.2-0.4-1.9-0.4c-0.7,0.1-1.3,0.3-1.9,0.7 c-0.5,0.4-1,0.9-1.3,1.5c-0.3,0.6-0.5,1.2-0.5,1.9c0,0.7,0.1,1.3,0.4,1.9c0.3,0.6,0.7,1.1,1.2,1.5c0.5,0.4,1.1,0.6,1.8,0.7 c0.7,0.1,1.3,0,1.9-0.2c0.6-0.3,1.1-0.7,1.5-1.2c0.4-0.5,0.7-1.1,0.8-1.8C72.1,14.8,71.9,13.6,71.4,12.5z M61.6,16.8 c-0.4-0.5-0.9-0.9-1.5-1.1c-0.6-0.2-1.2-0.3-1.8-0.2c-0.6,0.1-1.2,0.4-1.7,0.8c-0.5,0.4-0.9,0.9-1.2,1.5c-0.3,0.6-0.4,1.2-0.4,1.9 c0.1,0.7,0.3,1.3,0.6,1.8c0.3,0.5,0.8,1,1.3,1.3c0.5,0.3,1.1,0.5,1.7,0.5c0.6,0,1.2-0.2,1.8-0.5c0.5-0.3,1-0.8,1.3-1.3 c0.3-0.6,0.5-1.2,0.5-1.9C62.1,18.6,61.9,17.7,61.6,16.8z M51.5,12.8c-0.3-0.6-0.7-1.1-1.2-1.5c-0.5-0.4-1.1-0.6-1.7-0.7 c-0.6-0.1-1.3,0-1.9,0.2c-0.6,0.3-1.1,0.7-1.5,1.2c-0.4,0.5-0.7,1.1-0.8,1.8c-0.1,0.7,0,1.3,0.2,1.9c0.2,0.6,0.6,1.1,1.1,1.5 c0.5,0.4,1,0.6,1.6,0.7c0.6,0.1,1.2,0,1.8-0.2c0.6-0.3,1.1-0.7,1.5-1.2c0.4-0.5,0.7-1.1,0.8-1.8C51.6,14.1,51.6,13.4,51.5,12.8z M26.8,14.5c-0.4-0.5-0.9-0.9-1.5-1.2c-0.6-0.3-1.2-0.4-1.8-0.4c-0.7,0.1-1.3,0.3-1.8,0.7c-0.5,0.4-1,0.9-1.3,1.5 c-0.3,0.6-0.5,1.2-0.5,1.9c0,0.7,0.2,1.3,0.5,1.9c0.3,0.6,0.7,1.1,1.2,1.5c0.5,0.4,1.1,0.6,1.7,0.7c0.7,0.1,1.3,0,1.9-0.2 c0.6-0.3,1.1-0.7,1.5-1.2c0.4-0.5,0.7-1.1,0.8-1.8C27.5,16.8,27.3,15.6,26.8,14.5z M14.2,16.8c-0.4-0.5-0.9-0.9-1.5-1.1 c-0.6-0.2-1.2-0.3-1.8-0.2c-0.6,0.1-1.2,0.4-1.7,0.8c-0.5,0.4-0.9,0.9-1.2,1.5c-0.3,0.6-0.4,1.2-0.4,1.9c0.1,0.7,0.3,1.3,0.6,1.8 c0.3,0.5,0.8,1,1.3,1.3c0.5,0.3,1.1,0.5,1.7,0.5c0.6,0,1.2-0.2,1.8-0.5c0.5-0.3,1-0.8,1.3-1.3c0.3-0.6,0.5-1.2,0.5-1.9 C14.7,18.6,14.5,17.7,14.2,16.8z" />
                {/* Note: The above path is a placeholder. For a real app, we'd use a proper world map SVG path. 
            Since we can't easily paste a huge SVG path here, I'll use a simple rectangle for "Global" 
            and maybe some simple shapes if I had them. 
            
            Actually, let's use a very simplified abstract map representation using circles/ellipses 
            or just a placeholder background if a real path is too complex.
            
            Better yet, let's use a simple "grid" or "dots" representation if we don't have the path.
            Or just render the marker on a blank map with a border for now, as the user asked for "roughly show location".
        */}
                <rect x="0" y="0" width="100" height="50" fill="#f1f5f9" />
                <path d="M22,15 Q30,5 40,15 T60,15 T80,15" fill="none" stroke="#cbd5e1" strokeWidth="0.5" />
                <path d="M15,35 Q35,45 55,35 T95,35" fill="none" stroke="#cbd5e1" strokeWidth="0.5" />

                {/* Continents approximation (Very rough for visual context) */}
                {/* North America */}
                <path d="M10,10 L30,10 L25,25 L15,20 Z" fill="#e2e8f0" />
                {/* South America */}
                <path d="M20,25 L30,25 L25,45 L20,35 Z" fill="#e2e8f0" />
                {/* Europe/Asia */}
                <path d="M45,10 L90,10 L85,30 L50,25 Z" fill="#e2e8f0" />
                {/* Africa */}
                <path d="M45,25 L60,25 L55,40 L45,35 Z" fill="#e2e8f0" />
                {/* Australia */}
                <path d="M80,35 L95,35 L90,45 L80,40 Z" fill="#e2e8f0" />

                {/* Location Marker */}
                <circle cx={x} cy={y} r="2" className="fill-red-500 animate-pulse" />
                <circle cx={x} cy={y} r="1" className="fill-white" />
            </svg>
        </div>
    )
}
