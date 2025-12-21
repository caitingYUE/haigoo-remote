import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import { motion } from 'framer-motion';
import { BugReportModal } from './BugReportModal';

export const BugReportButton: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const constraintsRef = React.useRef(null);

    return (
        <>
            <div ref={constraintsRef} className="fixed inset-4 pointer-events-none z-[9990]" />
            <motion.button
                drag
                dragConstraints={constraintsRef}
                dragMomentum={false}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-24 right-6 z-[9990] p-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors cursor-pointer flex items-center gap-2 group pointer-events-auto"
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                title="提报 Bug / 反馈"
            >
                <Bug className="w-6 h-6" />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap text-sm font-medium">
                    反馈问题
                </span>
            </motion.button>

            <BugReportModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};
