import React, { useMemo } from 'react';

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
    }
};

export const TreeRenderer: React.FC<TreeRendererProps> = ({ data, width = 600, height = 800, showDecorations = true }) => {
    const theme = THEMES[data.style] || THEMES.growth;

    // Flatten keywords and sort by weight for placement
    const allKeywords = useMemo(() => {
        return data.layers.flatMap(l => l.keywords).sort((a, b) => b.weight - a.weight);
    }, [data]);

    // Generate Positions (Structured Cone with Layers)
    const treeItems = useMemo(() => {
        const items: any[] = [];
        const centerX = width / 2;
        const topY = 120;
        const bottomY = height - 150;
        const treeHeight = bottomY - topY;

        // Sort keywords by weight (heaviest first)
        const sortedKeywords = [...allKeywords].sort((a, b) => b.weight - a.weight);

        // Distribute in structured layers (6 layers)
        const layerCount = 6;
        const keywordsPerLayer = Math.ceil(sortedKeywords.length / layerCount);

        sortedKeywords.forEach((kw, i) => {
            const layerIndex = Math.floor(i / keywordsPerLayer);
            const positionInLayer = i % keywordsPerLayer;
            const totalInLayer = Math.min(keywordsPerLayer, sortedKeywords.length - layerIndex * keywordsPerLayer);

            // Y position: top to bottom
            const yNorm = (layerIndex + 0.5) / layerCount;
            const y = topY + (yNorm * treeHeight);

            // X position: spread across cone width
            const coneWidthAtY = yNorm * (width * 0.7);
            const angleStep = Math.PI / (totalInLayer + 1);
            const angle = angleStep * (positionInLayer + 1) - Math.PI / 2;
            const xOffset = Math.cos(angle) * (coneWidthAtY / 2);
            const x = centerX + xOffset;

            // Font size based on weight
            const fontSize = 11 + (kw.weight * 1.8); // 12px to 29px

            // Color based on layer and theme
            let color = theme.primary;
            if (layerIndex % 3 === 1) color = theme.secondary;
            if (layerIndex % 3 === 2) color = theme.accent;

            items.push({
                text: kw.text,
                x,
                y,
                fontSize,
                color,
                rotation: (Math.random() - 0.5) * 10, // Subtle tilt
                delay: i * 0.05 // For animation
            });
        });
        return items;
    }, [allKeywords, width, height, theme]);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto shadow-2xl rounded-xl" style={{ backgroundColor: theme.bg }}>
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <linearGradient id="trunkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a16207" />
                    <stop offset="100%" stopColor="#854d0e" />
                </linearGradient>
                {/* Theme-specific gradients */}
                {data.style === 'engineering' && (
                    <pattern id="circuitPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M0 10 L20 10 M10 0 L10 20" stroke={theme.primary} strokeWidth="0.5" opacity="0.3" />
                    </pattern>
                )}
            </defs>

            {/* Background Pattern for Engineering Style */}
            {data.style === 'engineering' && (
                <rect width={width} height={height} fill="url(#circuitPattern)" opacity="0.1" />
            )}

            {/* Decorative Branches */}
            <g opacity="0.15">
                {[...Array(8)].map((_, i) => {
                    const angle = (i / 8) * Math.PI - Math.PI / 2;
                    const length = 80 + (i * 15);
                    const startY = height - 200 + (i * 30);
                    return (
                        <path
                            key={i}
                            d={`M${width / 2} ${startY} Q${width / 2 + Math.cos(angle) * length / 2} ${startY - 20} ${width / 2 + Math.cos(angle) * length} ${startY - 40}`}
                            stroke={theme.primary}
                            strokeWidth="3"
                            fill="none"
                            strokeLinecap="round"
                        />
                    );
                })}
            </g>

            {/* Trunk with Gradient */}
            <rect x={width / 2 - 20} y={height - 140} width={40} height={100} rx={6} fill="url(#trunkGradient)" />
            <text x={width / 2} y={height - 70} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" style={{ fontFamily: theme.font }}>
                {data.trunk_core_role}
            </text>

            {/* Tree Content - Keywords */}
            {treeItems.map((item, i) => (
                <text
                    key={i}
                    x={item.x}
                    y={item.y}
                    textAnchor="middle"
                    fill={item.color}
                    fontSize={item.fontSize}
                    fontWeight="600"
                    transform={`rotate(${item.rotation}, ${item.x}, ${item.y})`}
                    style={{
                        fontFamily: theme.font,
                        textShadow: data.style === 'creative' ? '2px 2px 4px rgba(0,0,0,0.1)' : 'none',
                        opacity: 0.95
                    }}
                >
                    {item.text}
                </text>
            ))}

            {/* Star with Enhanced Glow */}
            <g transform={`translate(${width / 2}, 80)`}>
                <circle r="35" fill={theme.accent} opacity="0.2" filter="url(#glow)" />
                <path
                    d="M0,-28 L6,-9 L26,-9 L10,4 L16,24 L0,13 L-16,24 L-10,4 L-26,-9 L-6,-9 Z"
                    fill={theme.accent}
                    filter="url(#glow)"
                />
                <text y={55} textAnchor="middle" fill={theme.text} fontSize="16" fontWeight="bold" letterSpacing="1" style={{ fontFamily: theme.font }}>
                    {data.star_label}
                </text>
            </g>

            {/* Watermark */}
            <text x={width - 15} y={height - 15} textAnchor="end" fill={theme.text} opacity="0.4" fontSize="11" style={{ fontFamily: theme.font }}>
                Haigoo 简历圣诞树
            </text>
        </svg>
    );
};
