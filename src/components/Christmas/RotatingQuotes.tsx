import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const QUOTES = [
    "这是你亲手照料的一棵树。它独一无二，也已经足够美丽。",
    "世界上不会再有第二棵这样的树。",
    "它不是被评判出来的，而是被你一点点养出来的。",
    "你的每一段经历，都是这棵树上的一个年轮。",
    "扎根向下，才能生长向上。"
];

export const RotatingQuotes = () => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex(prev => (prev + 1) % QUOTES.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-12 flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.p
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5 }}
                    className="text-slate-500 italic text-sm md:text-base font-serif"
                >
                    "{QUOTES[index]}"
                </motion.p>
            </AnimatePresence>
        </div>
    );
};
