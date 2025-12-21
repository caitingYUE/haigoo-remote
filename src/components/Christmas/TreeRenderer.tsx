import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Tree Renderer Component - Word Cloud Edition
 * Renders a Christmas Tree formed entirely by keywords.
 */

interface Keyword {
    text: string;
    weight: number;
}

interface TreeLayer {
    category: string;
    keywords: Keyword[];
}

interface TreeData {
    trunk_core_role: string;
    top_title?: string;
    layers: TreeLayer[];
    star_label: string;
    style: 'engineering' | 'creative' | 'growth';
    growth_stages?: { label: string; keyword: string }[];
}

interface TreeRendererProps {
    data: TreeData;
    width?: number;
    height?: number;
    showDecorations?: boolean;
}

// Word Cloud Palette - Warmer, Christmas Theme (Day/Warm Mode)
const PALETTE = [
    '#dc2626', // Santa Red
    '#15803d', // Cedar Green
    '#b45309', // Deep Gold/Bronze
    '#f59e0b', // Bright Gold
    '#1e293b', // Dark Slate (Contrast)
    '#7f1d1d', // Deep Burgundy
];

const FONTS = [
    'Great Vibes, cursive',
    'Cinzel, serif',
    'Rubik, sans-serif',
    'Nunito, sans-serif',
    'Microsoft YaHei, sans-serif'
];

export const TreeRenderer: React.FC<TreeRendererProps> = ({ data, width = 600, height = 800 }) => {
    
    // Flatten and Sort Keywords
    const allKeywords = useMemo(() => {
        // Boost quantity if low by duplicating nicely (fallback)
        let kw = data.layers?.flatMap(l => l.keywords || []) || [];
        
        // Safety: Filter out empty text
        kw = kw.filter(k => k && k.text && k.text.trim().length > 0);

        // Fallback if AI returned no keywords
        if (kw.length === 0) {
            const defaults = [
                "Love", "Hope", "Warmth", "Joy", "Peace", 
                "Family", "Friends", "Kindness", "Giving", 
                "Dream", "Magic", "Believe", "Light", "Home",
                "Faith", "Wonder", "Spirit", "Wish", "Heart"
            ];
            kw = defaults.map(text => ({ text, weight: Math.floor(Math.random() * 5) + 5 }));
        }

        if (kw.length < 20) {
            kw = [...kw, ...kw]; // Double up if too few to form a tree
        }
        
        // Triple up if still small (e.g. only 5-10 items)
        if (kw.length < 40) {
             kw = [...kw, ...kw];
        }

        return kw.sort((a, b) => (b.weight || 5) - (a.weight || 5));
    }, [data]);

        // Generate Layout: Organic Cone Packing (Improved Density)
        const treeItems = useMemo(() => {
            if (typeof window === 'undefined') return [];
    
            const items: any[] = [];
            const centerX = width / 2;
            const topY = 160; 
            const bottomY = height - 160; 
            const treeHeight = bottomY - topY;
            
            // Canvas for measuring text
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return [];
    
            let workingKeywords = [...allKeywords];
            
            // Add extra decorations to fill gaps - Increased for density
            const DECORATIONS = ['❄', '❅', '❆', '★', '✦', '✨', '•', '·', '◦'];
            for(let i=0; i<80; i++) {
                 workingKeywords.push({
                     text: DECORATIONS[Math.floor(Math.random() * DECORATIONS.length)],
                     weight: 0.5, // Tiny weight
                     isDecoration: true
                 } as any);
            }
    
            // Sort: Heaviest first (to place core words centrally)
            workingKeywords.sort((a, b) => {
                 const wa = (a as any).isDecoration ? 0 : a.weight;
                 const wb = (b as any).isDecoration ? 0 : b.weight;
                 return wb - wa;
            });
    
            // Spatial Grid
            const gridSize = 10; // Finer grid for tighter packing
            const gridWidth = Math.ceil(width / gridSize);
            const gridHeight = Math.ceil(height / gridSize);
            const grid = new Array(gridWidth * gridHeight).fill(false);

            const checkCollision = (rect: any) => {
                // ... same collision logic ...
                const startX = Math.floor(rect.x / gridSize);
                const endX = Math.floor((rect.x + rect.width) / gridSize);
                const startY = Math.floor(rect.y / gridSize);
                const endY = Math.floor((rect.y + rect.height) / gridSize);

                if (startX < 0 || endX >= gridWidth || startY < 0 || endY >= gridHeight) return true;

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        if (grid[y * gridWidth + x]) return true;
                    }
                }
                return false;
            };

            const markOccupied = (rect: any) => {
                const startX = Math.floor(rect.x / gridSize);
                const endX = Math.floor((rect.x + rect.width) / gridSize);
                const startY = Math.floor(rect.y / gridSize);
                const endY = Math.floor((rect.y + rect.height) / gridSize);

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                         if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
                             grid[y * gridWidth + x] = true;
                         }
                    }
                }
            };
    
            // Placement Strategy: Try to place words in a cone shape
            // Heavier words -> Closer to center line, random Y
            // Lighter words -> Further out or filling gaps
            
            for (const kw of workingKeywords) {
                const isDeco = (kw as any).isDecoration;
                const font = isDeco ? 'Arial' : FONTS[Math.floor(Math.random() * FONTS.length)];
                const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                
                let fontSize = 12;
                if (!isDeco) {
                     fontSize = 14 + Math.pow(kw.weight, 1.5) * 1.5; // Exponential sizing for impact
                     if (fontSize > 48) fontSize = 48; 
                } else {
                     fontSize = 8 + Math.random() * 8;
                }
    
                ctx.font = `${fontSize}px ${font}`;
                const metrics = ctx.measureText(kw.text);
                const textWidth = metrics.width;
                const textHeight = fontSize * 0.7; // Tighter vertical bounding
    
                let placed = false;
                
                // Attempt placement
                // Try random positions within the cone
                // Cone defined by: x = center +/- (radius at y)
                
                const attempts = 50;
                for (let i = 0; i < attempts; i++) {
                    // Random Y (biased slightly towards bottom for stability, or uniform?)
                    // Let's use uniform Y distribution for now
                    const yPos = topY + Math.random() * treeHeight;
                    
                    // Cone width at this Y
                    const progress = (yPos - topY) / treeHeight;
                    const maxRadius = 20 + (width * 0.4) * progress; // Cone gets wider
                    
                    // Random X within cone, biased towards center for heavy words
                    const bias = isDeco ? 1 : Math.max(0.2, 1 - (kw.weight / 10)); // Heavy words stick to center (0.2), light words spread (1)
                    const xOffset = (Math.random() - 0.5) * 2 * maxRadius * bias;
                    const xPos = centerX + xOffset;

                    const rect = {
                        x: xPos - textWidth / 2,
                        y: yPos - textHeight / 2,
                        width: textWidth,
                        height: textHeight
                    };
    
                    if (!checkCollision(rect)) {
                        items.push({
                            text: kw.text,
                            x: xPos,
                            y: yPos,
                            width: textWidth,
                            height: textHeight,
                            fontSize,
                            font,
                            color,
                            rotation: (Math.random() - 0.5) * 10, // Slight tilt
                            delay: items.length * 0.005
                        });
                        markOccupied(rect);
                        placed = true;
                        break;
                    }
                }
            }
    
            return items;
        }, [allKeywords, width, height]);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto shadow-2xl rounded-sm" style={{ backgroundColor: '#fff7ed' }}>
            <defs>
                <filter id="glow-text">
                    <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <linearGradient id="daySkyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fff7ed" /> {/* Warm Cream */}
                    <stop offset="100%" stopColor="#eff6ff" /> {/* Ice Blue */}
                </linearGradient>
                <radialGradient id="sunGlow" cx="50%" cy="0%" r="70%">
                    <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#fef08a" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* 1. Background: Warm Day Sky */}
            <rect width={width} height={height} fill="url(#daySkyGradient)" />
            <rect width={width} height={height} fill="url(#sunGlow)" />
            
            {/* 2. Stars (Background) - Golden/Subtle */}
            {[...Array(60)].map((_, i) => (
                <circle
                    key={`bg-star-${i}`}
                    cx={Math.random() * width}
                    cy={Math.random() * (height - 100)}
                    r={Math.random() * 1.5}
                    fill="#fcd34d"
                    opacity={Math.random() * 0.5 + 0.1}
                />
            ))}

            {/* 3. Snow Ground */}
            <path 
                d={`M0 ${height} L0 ${height-80} Q ${width/2} ${height-120} ${width} ${height-80} L ${width} ${height} Z`} 
                fill="#f1f5f9"
                opacity="0.9"
            />
            <path 
                d={`M0 ${height} L0 ${height-60} Q ${width/2} ${height-100} ${width} ${height-60} L ${width} ${height} Z`} 
                fill="#e2e8f0" 
                opacity="0.8"
            />

            {/* 3.5 Elk Silhouette (Left Side) */}
            <g transform={`translate(${width * 0.15}, ${height - 90}) scale(0.6)`}>
                <path 
                    d="M50,10 C55,5 60,5 65,10 L60,20 L65,15 L70,20 L65,30 C75,30 80,40 80,50 L80,70 L75,70 L75,55 L65,55 L65,70 L60,70 L60,50 C50,50 40,45 40,35 L40,25 Z" 
                    fill="#1e293b" 
                    opacity="0.2"
                />
                <path 
                    d="M20,20 L30,30 M30,20 L20,30" 
                    stroke="#1e293b" 
                    strokeWidth="2" 
                    opacity="0.2"
                />
            </g>
            
            {/* 3.6 Sleigh Silhouette (Sky) */}
             <g transform={`translate(${width * 0.8}, 80) scale(0.4)`}>
                <path 
                    d="M10,20 L50,20 L60,10 L50,10 L10,20 Z M15,20 L20,30 L40,30 L45,20" 
                    fill="#1e293b" 
                    opacity="0.1"
                />
            </g>

            {/* --- Growth Highlights (Vertical Axis) --- */}
            {data.growth_stages && data.growth_stages.length > 0 && (
                <g>
                    {data.growth_stages.map((stage, index) => {
                        // Distribute vertically along the tree center
                        // Bottom (Oldest) -> Top (Newest)
                        const total = data.growth_stages!.length;
                        const stepY = (height - 300) / (total + 1); 
                        const y = (height - 180) - (index + 1) * stepY; // Start from bottom
                        const x = width / 2;
                        
                        // Alternating side offset for readability
                        const xOffset = (index % 2 === 0 ? -1 : 1) * (40 + Math.random() * 20);

                        return (
                            <g key={`stage-${index}`} className="animate-in fade-in zoom-in duration-1000 delay-500">
                                {/* Connecting Line to Center */}
                                <path 
                                    d={`M${x} ${y} Q ${x + xOffset * 0.5} ${y + 10} ${x + xOffset} ${y}`} 
                                    fill="none" 
                                    stroke="#b45309" 
                                    strokeWidth="1" 
                                    strokeDasharray="4 4" 
                                    opacity="0.4"
                                />
                                
                                {/* Stage Node - Gift Box / Glowing Orb */}
                                <g transform={`translate(${x + xOffset}, ${y})`}>
                                    {/* Halo Effect */}
                                    <circle r="12" fill="url(#starGlow)" opacity="0.6">
                                        <animate attributeName="opacity" values="0.6;0.3;0.6" dur="3s" repeatCount="indefinite" />
                                        <animate attributeName="r" values="12;15;12" dur="3s" repeatCount="indefinite" />
                                    </circle>
                                    
                                    {/* Gift Box Icon */}
                                    <rect x="-6" y="-6" width="12" height="12" rx="1" fill="#dc2626" />
                                    <rect x="-2" y="-6" width="4" height="12" fill="#fcd34d" />
                                    <rect x="-6" y="-2" width="12" height="4" fill="#fcd34d" />
                                </g>

                                {/* Label (Stage) */}
                                <text 
                                    x={x + xOffset + (index % 2 === 0 ? -15 : 15)} 
                                    y={y - 8} 
                                    textAnchor={index % 2 === 0 ? "end" : "start"}
                                    fontSize="11" 
                                    fontFamily="Cinzel, serif" 
                                    fill="#b45309"
                                    fontStyle="italic"
                                    fontWeight="bold"
                                >
                                    {stage.label}
                                </text>

                                {/* Keyword Label (Highlight) */}
                                <text 
                                    x={x + xOffset + (index % 2 === 0 ? -15 : 15)} 
                                    y={y + 12} 
                                    textAnchor={index % 2 === 0 ? "end" : "start"}
                                    fontSize="16" 
                                    fontFamily="Cinzel, serif" 
                                    fontWeight="black"
                                    fill="#15803d"
                                    style={{ filter: 'url(#glow-text)' }}
                                >
                                    {stage.keyword}
                                </text>
                            </g>
                        );
                    })}
                </g>
            )}

            {/* 4. Trunk (Planted in snow) */}
            <rect 
                x={width/2 - 15} 
                y={height - 140} 
                width={30} 
                height={80} 
                fill="#3f2e26" 
                rx="4"
            />

            {/* 5. The Word Cloud Tree */}
            {treeItems.map((item, i) => (
                <motion.text
                    key={`word-${i}`}
                    x={item.x}
                    y={item.y}
                    textAnchor="middle"
                    fill={item.color}
                    fontSize={item.fontSize}
                    fontFamily={item.font}
                    transform={`rotate(${item.rotation}, ${item.x}, ${item.y})`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: item.delay, type: 'spring', stiffness: 200 }}
                    style={{ 
                        filter: 'url(#glow-text)',
                        cursor: 'default'
                    }}
                >
                    {item.text}
                </motion.text>
            ))}

            {/* 6. Top Star */}
            <g transform={`translate(${width / 2}, 110)`}>
                {/* Arc Path for Title */}
                <path id="titleArc" d="M -100,20 Q 0,-30 100,20" fill="none" />
                
                {/* Top Title (Curved) */}
                {data.top_title && (
                    <text textAnchor="middle" fontSize="16" fontFamily="Cinzel, serif" fontWeight="bold" fill="#b45309" dy="-5">
                         <textPath href="#titleArc" startOffset="50%" textAnchor="middle">
                            {data.top_title}
                         </textPath>
                    </text>
                )}

                <circle r="40" fill="url(#starGlow)" opacity="0.5" />
                <motion.path
                    d="M0,-35 L10,-12 L35,-12 L15,5 L22,30 L0,18 L-22,30 L-15,5 L-35,-12 L-10,-12 Z"
                    fill="#fcd34d"
                    stroke="#fff"
                    strokeWidth="2"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 2, type: 'spring' }}
                />
            </g>
            
            {/* 7. Base/Label (Trunk) */}
            <g transform={`translate(${width/2}, ${height - 100})`}>
                {/* Vertical Text on Trunk */}
                 <text 
                    x="0" 
                    y="20" 
                    textAnchor="middle" 
                    fill="rgba(255,255,255,0.9)" 
                    fontSize="14" 
                    fontWeight="bold"
                    fontFamily="Cinzel, serif"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '2px' }}
                >
                    {data.trunk_core_role}
                </text>
            </g>

            {/* 8. Footer Watermark - Left & Right */}
            <text 
                x={20} 
                y={height - 15} 
                textAnchor="start" 
                fill="#b45309" 
                fontSize="12" 
                fontFamily="Cinzel, serif" 
                opacity="0.6"
                letterSpacing="1"
            >
                haigooremote.com
            </text>

            <text 
                x={width - 20} 
                y={height - 15} 
                textAnchor="end" 
                fill="#b45309" 
                fontSize="12" 
                fontFamily="Cinzel, serif" 
                opacity="0.6"
                letterSpacing="1"
            >
                Haigoo Remote Club
            </text>

        </svg>
    );
};
