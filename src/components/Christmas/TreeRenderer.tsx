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

    // Generate Positions (Cone Shape)
    const treeItems = useMemo(() => {
        const items: any[] = [];
        const centerX = width / 2;
        const topY = 150;
        const bottomY = height - 100;
        const treeHeight = bottomY - topY;

        // Distribute keywords from top (high weight?) No, usually small at top, big at bottom for visual balance?
        // Or actually, main skills at center?
        // Let's try random distribution within a cone.

        allKeywords.forEach((kw, i) => {
            // Normlized height position (0 = top, 1 = bottom)
            // We want to fill the cone.
            // Simple algorithm: assign random Y, then calculate max X width at that Y.

            // Let's do structured layers for better readability
            const layerCount = 6;
            const layerIndex = i % layerCount;
            // This is naive. Let's maximize density.

            const progress = (i / allKeywords.length);
            // Let larger weights be distributed throughout, or maybe concentrated in middle?
            // Let's just random scatter within cone for organic look

            const yNorm = 0.1 + (Math.random() * 0.8); // 10% to 90% down the tree
            const y = topY + (yNorm * treeHeight);

            const coneWidthAtY = (yNorm) * (width * 0.8); // Cone gets wider
            const xOffset = (Math.random() - 0.5) * coneWidthAtY;
            const x = centerX + xOffset;

            const fontSize = 12 + (kw.weight * 2); // 14px to 32px

            items.push({
                text: kw.text,
                x,
                y,
                fontSize,
                color: Math.random() > 0.7 ? theme.accent : (Math.random() > 0.5 ? theme.secondary : theme.primary),
                rotation: (Math.random() - 0.5) * 20 // Slight tilt
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
            </defs>

            {/* Trunk */}
            <rect x={width / 2 - 20} y={height - 120} width={40} height={80} rx={4} fill="#854d0e" />
            <text x={width / 2} y={height - 60} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" style={{ fontFamily: theme.font }}>{data.trunk_core_role}</text>

            {/* Tree Content */}
            {treeItems.map((item, i) => (
                <text
                    key={i}
                    x={item.x}
                    y={item.y}
                    textAnchor="middle"
                    fill={item.color}
                    fontSize={item.fontSize}
                    fontWeight="bold"
                    transform={`rotate(${item.rotation}, ${item.x}, ${item.y})`}
                    style={{ fontFamily: theme.font, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                >
                    {item.text}
                </text>
            ))}

            {/* Star */}
            <g transform={`translate(${width / 2}, 100)`}>
                <path
                    d="M0,-30 L7,-10 L28,-10 L11,5 L17,26 L0,14 L-17,26 L-11,5 L-28,-10 L-7,-10 Z"
                    fill={theme.accent}
                    filter="url(#glow)"
                />
                <text y={50} textAnchor="middle" fill={theme.text} fontSize="18" fontWeight="bold" letterSpacing="2" style={{ fontFamily: theme.font }}>
                    {data.star_label}
                </text>
            </g>

            {/* Data Label */}
            <text x={width - 20} y={height - 20} textAnchor="end" fill={theme.text} opacity="0.5" fontSize="12" style={{ fontFamily: theme.font }}>
                Haigoo 简历圣诞树
            </text>
        </svg>
    );
};
