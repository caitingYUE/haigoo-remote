import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Tree Renderer Component
 * Renders a "Resume Christmas Tree" using SVG based on keywords and weights.
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

const THEMES = {
    engineering: {
        primary: '#10b981', // Emerald
        secondary: '#3b82f6', // Blue
        accent: '#f59e0b', // Amber
        bg: '#0f172a',    // Dark Slate
        text: '#ffffff',
        font: 'Space Mono, monospace'
    },
    creative: {
        primary: '#f472b6', // Pink
        secondary: '#a78bfa', // Violet
        accent: '#fcd34d', // Yellow
        bg: '#ffffff',
        text: '#374151',
        font: 'Outfit, sans-serif'
    },
    growth: {
        primary: '#84cc16', // Lime
        secondary: '#22c55e', // Green
        accent: '#fbbf24', // Amber
        bg: '#f0fdf4',
        text: '#166534',
        font: 'Inter, sans-serif'
    },
    // New Premium Theme
    magical: {
        primary: '#d4af37', // Gold
        secondary: '#c0c0c0', // Silver
        accent: '#ff4500', // Orange Red
        bg: '#0a0a1a', // Midnight Blue
        text: '#ffebcd', // Blanched Almond
        font: 'Cinzel, serif' // Elegant Serif
    }
};

export const TreeRenderer: React.FC<TreeRendererProps> = ({ data, width = 600, height = 800, showDecorations = true }) => {
    // Force Magical theme for the "Exquisite" look requested
    const theme = THEMES.magical;
    
    // ... keyword processing logic logic same ...
    const allKeywords = useMemo(() => {
        return data.layers.flatMap(l => l.keywords).sort((a, b) => b.weight - a.weight);
    }, [data]);

    // Generate Background Stars
    const stars = useMemo(() => {
        const s = [];
        for(let i=0; i<80; i++) {
            s.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.5,
                opacity: 0.3 + Math.random() * 0.7,
                delay: Math.random() * 2
            });
        }
        return s;
    }, [width, height]);

    // Generate Foliage Layers (The green tree body)
    const foliageLayers = useMemo(() => {
        const layers = [];
        const layerCount = 7;
        const topY = 120;
        const bottomY = height - 150;
        const treeHeight = bottomY - topY;
        const maxW = width * 0.85;

        for(let i=0; i<layerCount; i++) {
            const progress = i / (layerCount - 1);
            const layerY = topY + (progress * treeHeight * 0.9); // Slightly bunch up
            const layerW = 100 + (progress * (maxW - 100));
            
            // Path for a rough triangle/pine layer
            // We make it slightly curved and jagged
            const d = `
                M ${width/2} ${layerY - 40}
                L ${width/2 + layerW/2} ${layerY + 60}
                Q ${width/2} ${layerY + 80} ${width/2 - layerW/2} ${layerY + 60}
                Z
            `;
            layers.push({ d, y: layerY, width: layerW, index: i });
        }
        return layers;
    }, [width, height]);

    // Generate Fairy Lights (Catenary curves across layers)
    const fairyLights = useMemo(() => {
        if (!showDecorations) return [];
        const lights = [];
        const layerCount = 7;
        const topY = 140;
        const bottomY = height - 160;
        const treeHeight = bottomY - topY;
        const maxW = width * 0.8;

        for(let i=1; i<layerCount; i++) {
            const progress = i / (layerCount - 1);
            const y = topY + (progress * treeHeight);
            const w = 80 + (progress * (maxW - 80));
            
            // Curve: Start Left -> Drop Middle -> End Right
            const startX = width/2 - w/2 + 20;
            const endX = width/2 + w/2 - 20;
            const drop = 20 + (progress * 20);
            
            const path = `M ${startX} ${y} Q ${width/2} ${y + drop} ${endX} ${y}`;
            
            // Bulbs along the path
            const bulbCount = 8 + Math.floor(progress * 10);
            for(let j=0; j<bulbCount; j++) {
                const t = j / (bulbCount - 1);
                // Approximate position on Quad curve
                const bx = (1-t)*(1-t)*startX + 2*(1-t)*t*(width/2) + t*t*endX;
                const by = (1-t)*(1-t)*y + 2*(1-t)*t*(y + drop) + t*t*y;
                
                lights.push({
                    cx: bx,
                    cy: by,
                    r: 2,
                    color: ['#fcd34d', '#f87171', '#60a5fa', '#fff'][Math.floor(Math.random()*4)],
                    delay: Math.random() * 2
                });
            }
            
            lights.push({ path, isWire: true });
        }
        return lights;
    }, [width, height, showDecorations]);

    // Generate Positions (Triangle Typesetting / Word Cloud Effect)
    const treeItems = useMemo(() => {
        const items: any[] = [];
        const centerX = width / 2;
        const topY = 130; // Lower start to fit star
        const bottomY = height - 160; 
        const treeHeight = bottomY - topY;
        const maxTreeWidth = width * 0.75; 

        const sortedKeywords = [...allKeywords].sort((a, b) => b.weight - a.weight);

        let currentY = topY;
        let keywordIndex = 0;
        
        while (keywordIndex < sortedKeywords.length && currentY < bottomY) {
            const progress = (currentY - topY) / treeHeight;
            const currentLineWidth = Math.max(80, progress * maxTreeWidth); 
            
            const lineItems: any[] = [];
            let usedWidth = 0;
            let maxFontSizeInLine = 0;
            
            while (keywordIndex < sortedKeywords.length) {
                const kw = sortedKeywords[keywordIndex];
                // Slightly larger font for readability on complex background
                const fontSize = 14 + Math.pow(kw.weight, 0.75) * 3; 
                // Estimate width
                const textWidth = kw.text.length * fontSize * 0.6 + 30; // More padding for signs

                if (usedWidth + textWidth <= currentLineWidth) {
                    lineItems.push({ ...kw, fontSize, width: textWidth });
                    usedWidth += textWidth;
                    maxFontSizeInLine = Math.max(maxFontSizeInLine, fontSize);
                    keywordIndex++;
                } else {
                    break; 
                }
            }

            let currentX = centerX - (usedWidth / 2);
            lineItems.forEach((item, idx) => {
                const yJitter = (Math.random() - 0.5) * 8;
                const rotation = (Math.random() - 0.5) * 10;
                
                // Determine style based on weight
                let type = 'text'; // default
                if (item.weight > 7) type = 'plaque'; // Wooden sign
                else if (item.weight > 4) type = 'ornament'; // Round/Tag
                
                items.push({
                    text: item.text,
                    x: currentX + (item.width / 2),
                    y: currentY + yJitter,
                    fontSize: item.fontSize,
                    rotation,
                    type,
                    width: item.width,
                    delay: items.length * 0.05
                });
                
                currentX += item.width;
            });

            currentY += (maxFontSizeInLine * 1.0) + 15; // More vertical spacing
            
            if (lineItems.length === 0) {
                 currentY += 30;
                 if(keywordIndex < sortedKeywords.length) keywordIndex++;
            }
        }

        return items;
    }, [allKeywords, width, height, theme]);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto shadow-2xl rounded-sm" style={{ backgroundColor: '#0f172a' }}>
            <defs>
                <filter id="glow-strong">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="shadow">
                    <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.5"/>
                </filter>
                <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#020617" />
                    <stop offset="100%" stopColor="#1e1b4b" />
                </linearGradient>
                <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="foliageGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#064e3b" /> {/* Dark Emerald */}
                    <stop offset="50%" stopColor="#10b981" /> {/* Emerald */}
                    <stop offset="100%" stopColor="#064e3b" />
                </linearGradient>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fcd34d" />
                    <stop offset="50%" stopColor="#d97706" />
                    <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
                <linearGradient id="woodGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a16207" />
                    <stop offset="100%" stopColor="#451a03" />
                </linearGradient>
            </defs>

            {/* 1. Background Sky */}
            <rect width={width} height={height} fill="url(#skyGradient)" />
            
            {/* 2. Stars */}
            {stars.map((s, i) => (
                <motion.circle
                    key={`star-${i}`}
                    cx={s.x}
                    cy={s.y}
                    r={s.r}
                    fill="#fff"
                    opacity={s.opacity}
                    animate={{ opacity: [s.opacity, s.opacity*0.3, s.opacity] }}
                    transition={{ duration: 2 + Math.random()*2, repeat: Infinity, delay: s.delay }}
                />
            ))}

            {/* 3. Moon (Optional, top left) */}
            <circle cx="60" cy="60" r="30" fill="url(#starGlow)" opacity="0.1" />
            <circle cx="50" cy="50" r="25" fill="#e2e8f0" opacity="0.8" filter="url(#glow-strong)" />

            {/* 4. Tree Foliage (Back to Front) */}
            {foliageLayers.reverse().map((layer, i) => (
                <motion.path
                    key={`foliage-${i}`}
                    d={layer.d}
                    fill="url(#foliageGradient)"
                    filter="url(#shadow)"
                    initial={{ scale: 0, originY: 1 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 + (i * 0.1), duration: 1, type: 'spring' }}
                />
            ))}

            {/* 5. Trunk (Bottom) */}
            <motion.path
                d={`M${width/2 - 25} ${height-150} L${width/2 + 25} ${height-150} L${width/2 + 40} ${height-40} L${width/2 - 40} ${height-40} Z`}
                fill="url(#woodGradient)"
                filter="url(#shadow)"
            />

            {/* 6. Fairy Lights Wires */}
            {fairyLights.filter(l => l.isWire).map((wire: any, i) => (
                 <path key={`wire-${i}`} d={wire.path} stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
            ))}

            {/* 7. Keywords / Ornaments */}
            {treeItems.map((item, i) => (
                <motion.g
                    key={`item-${i}`}
                    initial={{ scale: 0, opacity: 0, y: item.y + 50 }}
                    animate={{ scale: 1, opacity: 1, y: item.y }}
                    transition={{ delay: 1 + item.delay, type: 'spring', stiffness: 150 }}
                    whileHover={{ scale: 1.1, zIndex: 100 }}
                    style={{ cursor: 'pointer' }}
                >
                    {/* Background Plaque/Ornament */}
                    {item.type === 'plaque' && (
                        <g filter="url(#shadow)">
                            <rect 
                                x={item.x - item.width/2 + 5} 
                                y={item.y - item.fontSize} 
                                width={item.width - 10} 
                                height={item.fontSize * 1.4} 
                                rx="4" 
                                fill="url(#woodGradient)" 
                                stroke="#fcd34d" 
                                strokeWidth="1"
                            />
                            {/* Nails */}
                            <circle cx={item.x - item.width/2 + 10} cy={item.y - item.fontSize/2} r="1.5" fill="#fcd34d" />
                            <circle cx={item.x + item.width/2 - 10} cy={item.y - item.fontSize/2} r="1.5" fill="#fcd34d" />
                        </g>
                    )}
                    
                    {item.type === 'ornament' && (
                        <g filter="url(#shadow)">
                            <ellipse 
                                cx={item.x} 
                                cy={item.y - item.fontSize*0.3} 
                                rx={item.width/2} 
                                ry={item.fontSize} 
                                fill="rgba(255,255,255,0.9)" 
                                stroke={theme.accent} 
                                strokeWidth="2"
                            />
                        </g>
                    )}

                    {/* Text */}
                    <text
                        x={item.x}
                        y={item.y}
                        textAnchor="middle"
                        fill={item.type === 'text' ? '#fef3c7' : (item.type === 'plaque' ? '#ffedd5' : '#1e293b')}
                        fontSize={item.fontSize}
                        fontWeight="bold"
                        transform={`rotate(${item.rotation}, ${item.x}, ${item.y})`}
                        style={{
                            fontFamily: theme.font,
                            textShadow: item.type === 'text' ? '0 0 5px rgba(255,215,0,0.5)' : 'none',
                            filter: item.type === 'text' ? 'url(#glow-strong)' : 'none'
                        }}
                    >
                        {item.text}
                    </text>
                </motion.g>
            ))}

            {/* 8. Fairy Lights Bulbs & Ornaments */}
            {/* Additional 3D Ornaments */}
            {treeItems.filter(item => item.weight > 6).map((item, i) => (
                 <motion.circle 
                    key={`ornament-extra-${i}`}
                    cx={item.x + (Math.random()-0.5)*40}
                    cy={item.y + (Math.random()-0.5)*30}
                    r={Math.min(item.fontSize * 0.6, 12)}
                    fill={['url(#ornamentGold)', 'url(#ornamentRed)', 'url(#ornamentBlue)'][i % 3]}
                    filter="url(#shadow)"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 2 + i*0.1 }}
                 />
            ))}

            {fairyLights.filter(l => !l.isWire).map((bulb: any, i) => (
                <motion.circle
                    key={`bulb-${i}`}
                    cx={bulb.cx}
                    cy={bulb.cy}
                    r={bulb.r * 1.5} // Larger bulbs
                    fill={bulb.color}
                    filter="url(#glow-strong)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ delay: 2 + bulb.delay, duration: 2, repeat: Infinity }}
                />
            ))}

            {/* 9. Top Star (Main Role) */}
            <g transform={`translate(${width / 2}, 90)`}>
                {/* Glow behind star */}
                <circle r="50" fill="url(#starGlow)" opacity="0.6" filter="url(#glow-strong)" />
                
                {/* 5-Pointed Star Shape */}
                <motion.path
                    d="M0,-45 L13,-15 L45,-15 L20,5 L30,35 L0,20 L-30,35 L-20,5 L-45,-15 L-13,-15 Z"
                    fill="url(#goldGradient)"
                    stroke="#fef3c7"
                    strokeWidth="2"
                    filter="url(#shadow)"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 2.5, type: 'spring' }}
                />
                
                {/* Star Text (Role) */}
                <motion.text
                    y={5}
                    textAnchor="middle"
                    fill="#78350f"
                    fontSize="12"
                    fontWeight="900"
                    style={{ fontFamily: theme.font }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 3 }}
                >
                    {data.star_label.split(' ')[0]} {/* First word usually core role */}
                </motion.text>
                 <motion.text
                    y={18}
                    textAnchor="middle"
                    fill="#78350f"
                    fontSize="10"
                    fontWeight="bold"
                    style={{ fontFamily: theme.font }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 3.1 }}
                >
                    {data.star_label.split(' ').slice(1).join(' ')}
                </motion.text>
            </g>

            {/* 10. Bottom Scroll (Trunk Label / Interpretation Title) */}
            <g transform={`translate(${width/2}, ${height - 60})`}>
                <motion.path
                    d="M-120,0 Q-140,10 -120,20 L120,20 Q140,10 120,0 Q0,-10 -120,0 Z"
                    fill="#fef3c7" // Parchment color
                    stroke="#d97706"
                    strokeWidth="2"
                    filter="url(#shadow)"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 3.2 }}
                />
                 <motion.text
                    y={14}
                    textAnchor="middle"
                    fill="#78350f"
                    fontSize="14"
                    fontStyle="italic"
                    fontWeight="bold"
                    style={{ fontFamily: theme.font }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 3.5 }}
                >
                    {data.trunk_core_role}
                </motion.text>
            </g>

            {/* Watermark */}
            <text
                x={width - 20}
                y={height - 20}
                textAnchor="end"
                fill="rgba(255,255,255,0.3)"
                fontSize="10"
                style={{ fontFamily: theme.font }}
            >
                Haigoo Christmas Tree
            </text>
        </svg>
    );
};
