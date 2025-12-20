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
    layers: TreeLayer[];
    star_label: string;
    style: 'engineering' | 'creative' | 'growth';
}

interface TreeRendererProps {
    data: TreeData;
    width?: number;
    height?: number;
    showDecorations?: boolean;
}

// Word Cloud Palette
const PALETTE = [
    '#fcd34d', // Gold
    '#fca5a5', // Soft Red
    '#86efac', // Soft Green
    '#93c5fd', // Soft Blue
    '#e2e8f0', // White/Slate
    '#f0abfc', // Pink
];

const FONTS = [
    'Great Vibes, cursive',
    'Cinzel, serif',
    'Rubik, sans-serif',
    'Orbitron, sans-serif',
    'Nunito, sans-serif',
    'Microsoft YaHei, sans-serif' // Fallback for Chinese
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
                "Growth", "Success", "Passion", "Dream", "Future", 
                "Skills", "Innovation", "Creativity", "Teamwork", 
                "Leadership", "Vision", "Goal", "Action", "Focus",
                "Learning", "Courage", "Wisdom", "Talent", "Energy"
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

    // Generate Layout: Point-Grid Scan (Robust & Dense)
    const treeItems = useMemo(() => {
        if (typeof window === 'undefined') return [];

        const items: any[] = [];
        const centerX = width / 2;
        
        // Tree Boundaries
        const topY = 140; 
        const bottomY = height - 120;
        const treeHeight = bottomY - topY;
        const maxTreeWidth = width * 0.9;
        
        // 1. Generate a Fine-Grained Grid
        // Decreased step size for higher resolution placement
        const points: {x: number, y: number}[] = [];
        const stepY = 5; // Finer vertical steps (was 15)
        const stepX = 5; // Finer horizontal steps (was 15)
        
        for (let y = topY; y < bottomY; y += stepY) {
            const progress = (y - topY) / treeHeight;
            // Conical shape width at this Y
            const currentLineWidth = 60 + (maxTreeWidth - 60) * Math.pow(progress, 0.9);
            const halfW = currentLineWidth / 2;
            
            // Scan X row
            for (let x = centerX - halfW; x <= centerX + halfW; x += stepX) {
                // Slight jitter for organic feel
                points.push({
                    x: x + (Math.random() - 0.5) * 2, 
                    y: y + (Math.random() - 0.5) * 2
                });
            }
        }
        
        // Shuffle points randomly to fill space more organically, 
        // instead of top-down which causes clumping
        points.sort(() => Math.random() - 0.5);

        // Helper: Check collision
        const checkCollision = (rect: any) => {
            const pad = 4; // Increased padding for cleaner separation (was 2)
            for (const item of items) {
                if (rect.x < item.x + item.width + pad &&
                    rect.x + rect.width + pad > item.x &&
                    rect.y < item.y + item.height + pad &&
                    rect.y + rect.height + pad > item.y) {
                    return true;
                }
            }
            return false;
        };

        // Canvas for measuring
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        let workingKeywords = [...allKeywords];
        
        // Add decorations
        const DECORATIONS = ['★', '✦', '❄', '♥', '•', '✨', '✴', '✶'];
        for(let i=0; i<40; i++) {
             workingKeywords.push({
                 text: DECORATIONS[Math.floor(Math.random() * DECORATIONS.length)],
                 weight: 1, 
                 isDecoration: true
             } as any);
        }

        // Sort: Big words first
        workingKeywords.sort((a, b) => {
             const wa = (a as any).isDecoration ? 0 : a.weight;
             const wb = (b as any).isDecoration ? 0 : b.weight;
             return wb - wa;
        });

        // Loop through all words
        for (const kw of workingKeywords) {
            const isDeco = (kw as any).isDecoration;
            
            const font = isDeco ? 'Arial' : FONTS[Math.floor(Math.random() * FONTS.length)];
            const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            
            // Size
            let fontSize = 12;
            if (!isDeco) {
                 fontSize = 14 + Math.pow(kw.weight, 1.2) * 2.5;
            } else {
                 fontSize = 8 + Math.random() * 8;
            }

            // Measure
            ctx.font = `${fontSize}px ${font}`;
            const metrics = ctx.measureText(kw.text);
            const textWidth = metrics.width;
            const textHeight = fontSize * 0.8; 

            // Find first point that fits
            let placed = false;
            
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                
                const rect = {
                    x: p.x - textWidth / 2,
                    y: p.y - textHeight / 2,
                    width: textWidth,
                    height: textHeight
                };
                
                // Boundary check
                const progress = (p.y - topY) / treeHeight;
                const currentHalfW = (60 + (maxTreeWidth - 60) * Math.pow(progress, 0.9)) / 2;
                if (p.x - textWidth/2 < centerX - currentHalfW || p.x + textWidth/2 > centerX + currentHalfW) {
                    continue; 
                }

                if (!checkCollision(rect)) {
                    // Place it!
                    items.push({
                        text: kw.text,
                        x: p.x,
                        y: p.y,
                        width: textWidth,
                        height: textHeight,
                        fontSize,
                        font,
                        color,
                        // Reduced rotation: Mostly horizontal, slight random tilt
                        rotation: isDeco ? Math.random() * 360 : (Math.random() - 0.5) * 10, 
                        delay: items.length * 0.005
                    });
                    
                    points.splice(i, 1); 
                    placed = true;
                    break;
                }
            }
        }

        return items;
    }, [allKeywords, width, height]);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto shadow-2xl rounded-sm" style={{ backgroundColor: '#1a1a1a' }}>
            <defs>
                <filter id="glow-text">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#1e1b4b" />
                </linearGradient>
                <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* 1. Background */}
            <rect width={width} height={height} fill="url(#bgGradient)" />
            
            {/* 2. Stars (Background) */}
            {[...Array(60)].map((_, i) => (
                <circle
                    key={`bg-star-${i}`}
                    cx={Math.random() * width}
                    cy={Math.random() * height}
                    r={Math.random() * 1.5}
                    fill="#fff"
                    opacity={Math.random() * 0.5 + 0.2}
                />
            ))}

            {/* 3. The Word Cloud Tree */}
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

            {/* 4. Top Star */}
            <g transform={`translate(${width / 2}, 110)`}>
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
                <text 
                    y={50} 
                    textAnchor="middle" 
                    fill="#fcd34d" 
                    fontSize="16" 
                    fontFamily="Cinzel, serif" 
                    fontWeight="bold"
                    style={{ maxWidth: '200px' }} // Constraint logic below
                >
                    {/* Simple truncation for star label if too long */}
                    {data.star_label.length > 15 ? data.star_label.substring(0, 15) + '...' : data.star_label}
                </text>
            </g>

            {/* 5. Trunk */}
            <rect 
                x={width/2 - 20} 
                y={height - 130} 
                width={40} 
                height={60} 
                fill="#573a25" 
                rx="4"
            />
            
            {/* 6. Base/Label */}
            <text 
                x={width/2} 
                y={height - 50} 
                textAnchor="middle" 
                fill="#e2e8f0" 
                fontSize="18" 
                fontFamily="Great Vibes, cursive"
            >
                {data.trunk_core_role}
            </text>

        </svg>
    );
};
