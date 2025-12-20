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
    'Nunito, sans-serif'
];

export const TreeRenderer: React.FC<TreeRendererProps> = ({ data, width = 600, height = 800 }) => {
    
    // Flatten and Sort Keywords
    const allKeywords = useMemo(() => {
        // Boost quantity if low by duplicating nicely (fallback)
        let kw = data.layers.flatMap(l => l.keywords);
        if (kw.length < 20) {
            kw = [...kw, ...kw]; // Double up if too few to form a tree
        }
        return kw.sort((a, b) => b.weight - a.weight);
    }, [data]);

    // Generate Layout: Word Cloud Tree
    const treeItems = useMemo(() => {
        const items: any[] = [];
        const centerX = width / 2;
        
        // Tree Dimensions
        const topY = 160; 
        const bottomY = height - 120;
        const treeHeight = bottomY - topY;
        const maxTreeWidth = width * 0.85;

        let currentY = topY;
        let keywordIndex = 0;
        
        // We want a tighter packing. 
        // We will loop until we run out of space or keywords.
        // To ensure the tree shape is filled, we might reuse keywords if we run out.
        
        const workingKeywords = [...allKeywords];
        
        while (currentY < bottomY) {
            const progress = (currentY - topY) / treeHeight;
            
            // Triangle Shape Function (Bell curve or Linear)
            // Linear triangle: width = progress * maxTreeWidth
            // Let's allow a minimum width at top so it's not too pointy/empty
            const currentLineWidth = Math.max(60, progress * maxTreeWidth); 
            
            const lineItems: any[] = [];
            let usedWidth = 0;
            let maxFontSizeInLine = 0;
            
            // Try to fill this line
            let attempts = 0;
            while (usedWidth < currentLineWidth && attempts < 10) {
                // If we ran out of keywords, recycle top ones with lower weight
                if (keywordIndex >= workingKeywords.length) {
                    keywordIndex = 0; // Cycle back
                }

                const kw = workingKeywords[keywordIndex];
                
                // Dynamic Font Size based on weight and progress (lower items can be bigger)
                // Base size + Weight bonus
                const baseSize = 14;
                const weightBonus = Math.pow(kw.weight, 0.8) * 3;
                let fontSize = baseSize + weightBonus;
                
                // Randomly vary size slightly for organic look
                fontSize *= (0.9 + Math.random() * 0.2);

                // Estimate text width (approximate char width ~ 0.6em)
                // Add padding
                const textWidth = kw.text.length * fontSize * 0.55 + 15;

                if (usedWidth + textWidth <= currentLineWidth * 1.1) { // Allow slight overflow
                    // Select random font and color
                    const font = FONTS[Math.floor(Math.random() * FONTS.length)];
                    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                    const rotation = (Math.random() - 0.5) * 20; // Slight tilt -10 to 10

                    lineItems.push({ 
                        ...kw, 
                        fontSize, 
                        width: textWidth, 
                        font, 
                        color,
                        rotation 
                    });
                    
                    usedWidth += textWidth;
                    maxFontSizeInLine = Math.max(maxFontSizeInLine, fontSize);
                    keywordIndex++;
                } else {
                    // Try next keyword if this one didn't fit? 
                    // For now, just break to next line to preserve order/weight
                    break; 
                }
                attempts++;
            }

            // Layout the line
            let currentX = centerX - (usedWidth / 2);
            lineItems.forEach((item) => {
                items.push({
                    text: item.text,
                    x: currentX + (item.width / 2), // Center of word
                    y: currentY,
                    fontSize: item.fontSize,
                    font: item.font,
                    color: item.color,
                    rotation: item.rotation,
                    delay: items.length * 0.02
                });
                currentX += item.width;
            });

            // Advance Y
            // Tighter spacing: 0.8 of font size
            currentY += Math.max(20, maxFontSizeInLine * 0.85);
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
