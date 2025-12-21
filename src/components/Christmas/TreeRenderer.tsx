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

        // Generate Layout: Spiral / Phyllotaxis Pattern (Organic & Dense)
        // This creates a natural "pine cone" or "sunflower" distribution which is visually dense and spiral.
        const treeItems = useMemo(() => {
            if (typeof window === 'undefined') return [];
    
            const items: any[] = [];
            const centerX = width / 2;
            const topY = 140; 
            const bottomY = height - 160; 
            const treeHeight = bottomY - topY;
            
            // Canvas for measuring text width/height
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return [];
    
            let workingKeywords = [...allKeywords];
            
            // Add extra decorations to fill gaps
            const DECORATIONS = ['❄', '❅', '❆', '★', '✦', '✨', '•'];
            for(let i=0; i<80; i++) {
                 workingKeywords.push({
                     text: DECORATIONS[Math.floor(Math.random() * DECORATIONS.length)],
                     weight: 1, 
                     isDecoration: true
                 } as any);
            }
    
            // Sort: Important words first, they take the "best" spots in the spiral
            workingKeywords.sort((a, b) => {
                 const wa = (a as any).isDecoration ? 0 : a.weight;
                 const wb = (b as any).isDecoration ? 0 : b.weight;
                 return wb - wa;
            });
    
            // Helper: Check collision
            const checkCollision = (rect: any) => {
                const pad = 2; // Tighter padding for denser look
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
    
            // Spiral Layout Parameters
            // We trace a spiral from top to bottom.
            // But actually, for a Christmas tree, we want to fill a CONE.
            // Let's use a specialized "Cone Spiral" scan.
            
            // We try to place each word. For each word, we search along a spiral path starting from a random angle but specific height range.
            // Actually, phyllotaxis is good for 2D circles. For a cone, we can map Y to the radius.
            
            for (const kw of workingKeywords) {
                const isDeco = (kw as any).isDecoration;
                const font = isDeco ? 'Arial' : FONTS[Math.floor(Math.random() * FONTS.length)];
                const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                
                let fontSize = 12;
                if (!isDeco) {
                     // Logarithmic scaling for better size distribution
                     fontSize = 12 + Math.log2(kw.weight + 2) * 5; 
                     if (fontSize > 48) fontSize = 48; // Max size cap
                } else {
                     fontSize = 8 + Math.random() * 8;
                }
    
                ctx.font = `${fontSize}px ${font}`;
                const metrics = ctx.measureText(kw.text);
                const textWidth = metrics.width;
                const textHeight = fontSize * 0.8; 
    
                // Attempt to place the word
                let placed = false;
                
                // We define a "Cone" shape:
                // At Y = topY, radius = 20
                // At Y = bottomY, radius = width * 0.4
                
                // Strategy: 
                // 1. Pick a "preferred" Y based on weight? (Heavier words lower? Or random?)
                //    Random Y usually looks better for mixed clouds.
                // 2. Or, iterate Y from top to bottom with step, and at each level try to place?
                //    That creates lines.
                // 3. Best: Randomized Spiral Search
                //    Pick a random Y within tree bounds.
                //    Calculate max Radius at that Y.
                //    Spiral out from center (x=0) to maxRadius at that Y.
                
                // Let's try 50 attempts per word to find a spot
                // We want heavier words to be more central generally, but distributed vertically.
                
                // Optimization: We scan vertically (Y) and for each Y, we scan horizontally (X).
                // But to get the "Spiral" look, we can actually calculate positions on a spiral curve.
                
                const angleStep = 1; // Radians
                const radiusStep = 5; 
                
                // New Strategy: "Fermat's Spiral on a Cone"
                // Iterate through points generated by a golden angle spiral projected onto a cone.
                // But we need to place arbitrary rectangles, not points.
                
                // Fallback to "Monte Carlo with Bias":
                // Try random positions within the cone. If collision, retry.
                // Bias: Higher weight words -> Closer to center line.
                
                const maxAttempts = 150;
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    // Random Y
                    // Bias Y slightly towards bottom for visual stability? No, uniform is fine.
                    const y = topY + Math.random() * treeHeight;
                    
                    // Calculate max width at this Y (Cone shape)
                    const progress = (y - topY) / treeHeight;
                    // Cone width function: Power curve for "Christmas Tree" sweep
                    const maxRadius = 20 + (width * 0.4 - 20) * Math.pow(progress, 1.2);
                    
                    // Random X within this radius
                    // Bias towards center for non-deco words
                    const r = (Math.random() + Math.random()) / 2 * maxRadius; // Triangular distribution peaking at 0? No.
                    // Let's use simple random for X, but bounded by cone.
                    // Actually, let's use a spiral-like search for placement if we really want structure.
                    // But random placement with collision detection usually yields a good "cloud".
                    
                    // To get the "Spiral" visual EFFECT mentioned by user, usually means the words themselves follow a curve.
                    // Or simply that they are dense and organic. 
                    // Let's stick to "Dense Cone" for now, as true spiral text layout is hard with rectangles.
                    // However, we can rotate words to follow the spiral tangent? 
                    // User said "Spiral Effect". Let's try to arrange words along a 3D helix projected to 2D?
                    // That might be too complex.
                    // Let's stick to "Dense Packing" but maybe rotate words slightly?
                    
                    const xOffset = (Math.random() - 0.5) * 2 * maxRadius;
                    const x = centerX + xOffset;
                    
                    // Check if inside cone
                    if (Math.abs(x - centerX) > maxRadius) continue;
    
                    const rect = {
                        x: x - textWidth / 2,
                        y: y - textHeight / 2,
                        width: textWidth,
                        height: textHeight
                    };
    
                    if (!checkCollision(rect)) {
                        items.push({
                            text: kw.text,
                            x: x,
                            y: y,
                            width: textWidth,
                            height: textHeight,
                            fontSize,
                            font,
                            color,
                            // Rotation: 
                            // 1. Decoration: Random
                            // 2. Words: Slight random tilt (-15 to 15) to look organic but readable
                            // 3. "Spiral" feel: maybe tilt based on position? 
                            //    Let's try tilting based on X distance to exaggerate the "swirl"
                            rotation: isDeco ? Math.random() * 360 : (x - centerX) * 0.1 + (Math.random() - 0.5) * 10,
                            delay: items.length * 0.005
                        });
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
            
            {/* 7. Base/Label */}
            <text 
                x={width/2} 
                y={height - 50} 
                textAnchor="middle" 
                fill="#1e293b" 
                fontSize="20" 
                fontWeight="bold"
                fontFamily="Great Vibes, cursive"
            >
                {data.trunk_core_role}
            </text>

        </svg>
    );
};
