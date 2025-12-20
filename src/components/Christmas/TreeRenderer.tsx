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

    // Generate Layout: Word Cloud Tree
    const treeItems = useMemo(() => {
        const items: any[] = [];
        const centerX = width / 2;
        
        // Tree Dimensions
        const topY = 160; 
        const bottomY = height - 120;
        const treeHeight = bottomY - topY;
        const maxTreeWidth = width * 0.9; // Slightly wider

        let currentY = topY;
        let keywordIndex = 0;
        
        // Shuffle for randomness on re-renders if needed, but keep stable for now
        // We want a tighter packing. 
        
        const workingKeywords = [...allKeywords];
        
        // Loop until we reach the bottom
        while (currentY < bottomY) {
            const progress = (currentY - topY) / treeHeight;
            
            // Triangle Shape: Bell curve-ish or wider triangle
            // width = minWidth + (maxWidth - minWidth) * progress^0.8
            // Using power < 1 makes it get wider faster (fat tree)
            const currentLineWidth = 80 + (maxTreeWidth - 80) * Math.pow(progress, 0.9);
            
            const lineItems: any[] = [];
            let usedWidth = 0;
            let maxFontSizeInLine = 0;
            
            // Try to fill this line
            let attempts = 0;
            // Allow more items per line
            while (usedWidth < currentLineWidth && attempts < 15) {
                // Recycle keywords if we run out
                if (keywordIndex >= workingKeywords.length) {
                    keywordIndex = 0; 
                    // Optional: Shuffle slightly or offset to avoid identical repeating patterns?
                    // For now, simple cycle is safer.
                }

                const kw = workingKeywords[keywordIndex];
                
                // Dynamic Font Size based on weight
                // Reduce base size for denser look
                const baseSize = 10;
                // Weight is 1-10. 
                // weightBonus: 1->2, 10->15
                const weightBonus = Math.pow(kw.weight || 1, 0.7) * 4; 
                let fontSize = baseSize + weightBonus;
                
                // Top of tree should have slightly smaller words to fit
                if (progress < 0.2) fontSize *= 0.8;

                // Random variation
                fontSize *= (0.85 + Math.random() * 0.3);

                // Estimate text width: char width ~ 0.5em + padding
                const textWidth = kw.text.length * fontSize * 0.5 + 10;

                // Check if fits (allow slight overflow 10%)
                if (usedWidth + textWidth <= currentLineWidth * 1.1) { 
                    const font = FONTS[Math.floor(Math.random() * FONTS.length)];
                    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                    const rotation = (Math.random() - 0.5) * 20; 

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
                    // Line is full
                    break; 
                }
                attempts++;
            }

            // Layout the line (Center align)
            let currentX = centerX - (usedWidth / 2);
            lineItems.forEach((item) => {
                items.push({
                    text: item.text,
                    x: currentX + (item.width / 2), 
                    y: currentY,
                    fontSize: item.fontSize,
                    font: item.font,
                    color: item.color,
                    rotation: item.rotation,
                    delay: items.length * 0.01 // Faster animation
                });
                currentX += item.width;
            });

            // Advance Y
            // Tighter vertical spacing: 0.75 of font height
            const lineHeight = Math.max(16, maxFontSizeInLine * 0.75);
            currentY += lineHeight;
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
