import React, { useState, useEffect } from 'react';
import { ForestGrid } from '../components/Christmas/ForestGrid';
import { TreeRenderer } from '../components/Christmas/TreeRenderer';
import { Loader2, ArrowLeft, Download, Share2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChristmasForestPage() {
    const navigate = useNavigate();
    const [trees, setTrees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [selectedTree, setSelectedTree] = useState<any>(null);

    const fetchTrees = async (pageNum: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/campaign/forest?page=${pageNum}&limit=12`);
            const json = await res.json();
            if (json.success) {
                if (pageNum === 1) {
                    setTrees(json.data);
                } else {
                    setTrees(prev => [...prev, ...json.data]);
                }
                setHasMore(json.data.length === 12);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrees(1);
    }, []);

    const loadMore = () => {
        setPage(prev => prev + 1);
        fetchTrees(page + 1);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 relative overflow-hidden font-serif">
            {/* Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-md z-40 border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/christmas')}
                        className="flex items-center gap-2 text-slate-600 hover:text-[#b91c1c] transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">返回我的树</span>
                    </button>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#b91c1c] to-[#15803d]" style={{ fontFamily: 'Cinzel, serif' }}>
                        🎄 Talent Forest
                    </h1>
                    <div className="w-20"></div> {/* Spacer */}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto py-8">
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold text-[#1e293b] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>Explore Career Diversity</h2>
                    <p className="text-slate-500 italic" style={{ fontFamily: 'Great Vibes, cursive', fontSize: '1.2rem' }}>Every tree tells a unique winter story</p>
                </div>

                <ForestGrid trees={trees} onTreeClick={setSelectedTree} />

                {loading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                )}

                {!loading && hasMore && (
                    <div className="flex justify-center py-8">
                        <button
                            onClick={loadMore}
                            className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-full hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            加载更多
                        </button>
                    </div>
                )}
            </div>

            {/* Tree Detail Modal */}
            <AnimatePresence>
                {selectedTree && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
                        onClick={() => setSelectedTree(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-2xl p-6 md:p-10 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setSelectedTree(null)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 rounded-full"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>

                            <div className="flex flex-col items-center">
                                <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                                    <TreeRenderer data={selectedTree.tree_data.tree_structure} />
                                </div>

                                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                                    {selectedTree.star_label}
                                </h3>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="text-sm text-slate-500">
                                        Owner: {selectedTree.user_nickname}
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-sm text-slate-400">
                                        {new Date(selectedTree.created_at).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Interpretation (if stored, usually interpretation is private, depends on PRD) */}
                                {/* For now showing only tree */}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
