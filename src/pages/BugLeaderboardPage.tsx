import React, { useEffect, useState } from 'react';
import { Loader2, Trophy, Medal, Star, Calendar, MessageCircle, X, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LeaderboardEntry {
    user_nickname: string;
    total_bugs: string;
    fixed_bugs: string;
    last_submission: string;
}

interface UserBug {
    id: number;
    title: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    created_at: string;
    admin_reply?: string;
}

export default function BugLeaderboardPage() {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // User Detail Modal State
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [userBugs, setUserBugs] = useState<UserBug[]>([]);
    const [loadingBugs, setLoadingBugs] = useState(false);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin-ops?action=bug_report&mode=leaderboard');
            const json = await res.json();
            if (json.success) {
                setLeaders(json.data);
            } else {
                throw new Error(json.error || 'Failed to fetch leaderboard');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUserClick = async (nickname: string) => {
        setSelectedUser(nickname);
        setLoadingBugs(true);
        setUserBugs([]);
        try {
            const res = await fetch(`/api/admin-ops?action=bug_report&mode=public_list&nickname=${encodeURIComponent(nickname)}`);
            const json = await res.json();
            if (json.success) {
                setUserBugs(json.data);
            } else {
                console.error(json.error || 'Failed to fetch user bugs');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingBugs(false);
        }
    };

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Trophy className="w-6 h-6 text-yellow-500" />;
            case 1: return <Medal className="w-6 h-6 text-slate-400" />;
            case 2: return <Medal className="w-6 h-6 text-amber-700" />;
            default: return <span className="font-bold text-slate-400 w-6 text-center">{index + 1}</span>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open': return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium border border-red-200">Pending</span>;
            case 'in_progress': return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200">In Progress</span>;
            case 'resolved': return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium border border-green-200">Fixed</span>;
            case 'closed': return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200">Closed</span>;
            default: return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{status}</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        Bug Hunter Hall of Fame
                    </h1>
                    <Link to="/" className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors">
                        Back to Home
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center border border-red-100">
                        {error}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                        <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                            <h2 className="text-xl font-bold text-white">Top Contributors</h2>
                            <p className="opacity-90 mt-1 text-sm text-indigo-50">Thank you to everyone helping improve Haigoo!</p>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 text-sm font-semibold text-slate-600 w-24 text-center">Rank</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600">Contributor</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 text-right">Bugs Reported</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 text-right">Fixed</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 text-right">Last Active</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {leaders.map((entry, index) => (
                                    <tr 
                                        key={index} 
                                        onClick={() => handleUserClick(entry.user_nickname)}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                    >
                                        <td className="p-4 flex justify-center items-center">
                                            {getRankIcon(index)}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                {entry.user_nickname}
                                                {index < 3 && <Star className="w-3 h-3 text-yellow-400 inline ml-2 fill-yellow-400" />}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-indigo-600 font-bold">
                                            {entry.total_bugs}
                                        </td>
                                        <td className="p-4 text-right font-mono text-green-600">
                                            {entry.fixed_bugs}
                                        </td>
                                        <td className="p-4 text-right text-sm text-slate-500">
                                            {entry.last_submission ? new Date(entry.last_submission).toLocaleDateString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {leaders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-500">
                                            No bug reports yet. Be the first to report one!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedUser(null)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <span className="text-indigo-600">@{selectedUser}</span>'s Contributions
                            </h3>
                            <button onClick={() => setSelectedUser(null)} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto p-4">
                            {loadingBugs ? (
                                <div className="py-12 flex justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                </div>
                            ) : userBugs.length > 0 ? (
                                <div className="space-y-3">
                                    {userBugs.map(bug => (
                                        <div key={bug.id} className="border border-slate-100 rounded-lg p-4 hover:border-indigo-100 transition-colors bg-slate-50/50">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(bug.status)}
                                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(bug.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <h4 className="font-medium text-slate-800 mb-2">{bug.title}</h4>
                                            
                                            {bug.admin_reply && (
                                                <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm">
                                                    <div className="flex items-center gap-2 text-indigo-700 font-bold mb-1 text-xs">
                                                        <MessageCircle className="w-3 h-3" />
                                                        Admin Reply
                                                    </div>
                                                    <p className="text-slate-700">{bug.admin_reply}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    No details available.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
