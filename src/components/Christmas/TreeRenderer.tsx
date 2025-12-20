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

    // Generate Layout: Spiral Layout (Word Cloud Style)
    const treeItems = useMemo(() => {
        if (typeof window === 'undefined') return []; // Client-side only

        const items: any[] = [];
        const centerX = width / 2;
        
        // Tree Boundaries
        const topY = 150;
        const bottomY = height - 120;
        const treeHeight = bottomY - topY;
        const maxTreeWidth = width * 0.9;
        
        // Helper: Check if a rect is inside the tree triangle
        const isInsideTree = (x: number, y: number, w: number, h: number) => {
            // Check 4 corners? Or just center? 
            // Better: Check if the whole box is roughly inside.
            // Simplified: Check center + spread
            
            if (y - h/2 < topY || y + h/2 > bottomY) return false;
            
            const progress = (y - topY) / treeHeight;
            const currentHalfWidth = ((maxTreeWidth / 2) * progress) - 20; // -20 padding
            
            const minX = centerX - currentHalfWidth;
            const maxX = centerX + currentHalfWidth;
            
            return (x - w/2 > minX && x + w/2 < maxX);
        };

        // Helper: Check collision with existing items
        const checkCollision = (rect: any, existing: any[]) => {
            for (const item of existing) {
                // Simple AABB collision
                // Expand slightly for spacing
                const pad = 4;
                if (rect.x < item.x + item.width + pad &&
                    rect.x + rect.width + pad > item.x &&
                    rect.y < item.y + item.height + pad &&
                    rect.y + rect.height + pad > item.y) {
                    return true;
                }
            }
            return false;
        };

        // Canvas for measuring text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        const workingKeywords = [...allKeywords];
        // Add some decorations to the list
        const DECORATIONS = ['★', '✦', '❄', '♥', '•', '✨'];
        for(let i=0; i<15; i++) {
             workingKeywords.push({
                 text: DECORATIONS[Math.floor(Math.random() * DECORATIONS.length)],
                 weight: 1 + Math.random() * 2,
                 isDecoration: true
             } as any);
        }

        // Sort by weight desc (place big words first)
        workingKeywords.sort((a, b) => b.weight - a.weight);

        // Place each word
        for (const kw of workingKeywords) {
            // Determine styling
            const isDeco = (kw as any).isDecoration;
            const font = isDeco ? 'Arial' : FONTS[Math.floor(Math.random() * FONTS.length)];
            const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            
            // Size calculation
            let fontSize = 12 + Math.pow(kw.weight, 0.8) * 4;
            if (isDeco) fontSize = 10 + Math.random() * 10;
            
            // Measure
            ctx.font = `${fontSize}px ${font}`;
            const metrics = ctx.measureText(kw.text);
            const textWidth = metrics.width;
            const textHeight = fontSize; // Approx

            // Spiral Search
            let angle = 0;
            let radius = 0;
            const step = 0.5; // Angle step
            const maxRadius = width / 2;
            
            // Random start angle
            angle = Math.random() * 6.28;

            while (radius < maxRadius) {
                // Calculate position
                // Start spiral from center-ish of the tree mass
                const startX = centerX;
                const startY = topY + treeHeight * 0.6; // 60% down

                const x = startX + radius * Math.cos(angle);
                const y = startY + radius * Math.sin(angle) * 0.8; // Flatten spiral slightly

                // Rotation (small random)
                const rotation = isDeco ? Math.random() * 360 : (Math.random() - 0.5) * 30;

                // Candidate Rect (unrotated AABB for simplicity)
                const rect = {
                    x: x - textWidth / 2,
                    y: y - textHeight / 2,
                    width: textWidth,
                    height: textHeight
                };

                if (isInsideTree(x, y, textWidth, textHeight)) {
                    if (!checkCollision(rect, items)) {
                        // Placed!
                        items.push({
                            text: kw.text,
                            x,
                            y,
                            width: textWidth,
                            height: textHeight, // Stored for collision
                            fontSize,
                            font,
                            color,
                            rotation,
                            delay: items.length * 0.01
                        });
                        break; // Move to next word
                    }
                }

                // Increment spiral
                angle += step;
                radius += 2; // Radius step
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
                <text y={50} textAnchor="middle" fill="#fcd34d" fontSize="16" fontFamily="Cinzel, serif" fontWeight="bold">
                    {data.star_label}
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
