import React from 'react';
import { TreeRenderer } from './TreeRenderer';
import { motion } from 'framer-motion';

interface ForestTree {
    id: number;
    tree_id: string;
    tree_data: any;
    star_label: string;
    user_nickname: string;
    likes: number;
}

interface ForestGridProps {
    trees: ForestTree[];
    onTreeClick: (tree: ForestTree) => void;
}

export const ForestGrid: React.FC<ForestGridProps> = ({ trees, onTreeClick }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
            {trees.map((tree, index) => (
                <motion.div
                    key={tree.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative group cursor-pointer bg-white rounded-xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden border border-slate-100"
                    onClick={() => onTreeClick(tree)}
                >
                    {/* Mini Tree Viewer */}
                    <div className="w-full aspect-[3/4] p-4 scale-75 origin-center">
                        <TreeRenderer data={tree.tree_data.tree_structure} />
                    </div>

                    {/* Info Overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-sm p-3 border-t border-slate-100 flex justify-between items-center">
                        <div>
                            <p className="text-xs font-bold text-slate-700 truncate max-w-[100px]">
                                {tree.star_label}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                by {tree.user_nickname}
                            </p>
                        </div>
                        <div className="flex items-center gap-1 text-pink-500 bg-pink-50 px-2 py-1 rounded-full">
                            <span className="text-xs">❤️</span>
                            <span className="text-[10px] font-bold">{tree.likes}</span>
                        </div>
                    </div>

                    {/* Hover Effect */}
                    <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors" />
                </motion.div>
            ))}
        </div>
    );
};
