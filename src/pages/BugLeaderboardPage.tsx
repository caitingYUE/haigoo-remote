import React, { useEffect, useState } from 'react';
import { Loader2, Trophy, Medal, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LeaderboardEntry {
    user_nickname: string;
    total_bugs: string; // count returns string from postgres
    fixed_bugs: string;
}

export default function BugLeaderboardPage() {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Trophy className="w-6 h-6 text-yellow-500" />;
            case 1: return <Medal className="w-6 h-6 text-slate-400" />;
            case 2: return <Medal className="w-6 h-6 text-amber-700" />;
            default: return <span className="font-bold text-slate-400 w-6 text-center">{index + 1}</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        Bug Hunter Hall of Fame
                    </h1>
                    <Link to="/" className="text-indigo-600 hover:text-indigo-800">
                        Back to Home
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">
                        {error}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                            <h2 className="text-xl font-bold">Top Contributors</h2>
                            <p className="opacity-90 mt-1">Thank you to everyone helping improve Haigoo!</p>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 text-sm font-semibold text-slate-600 w-24 text-center">Rank</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600">Contributor</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 text-right">Bugs Reported</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 text-right">Fixed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {leaders.map((entry, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 flex justify-center items-center">
                                            {getRankIcon(index)}
                                        </td>
                                        <td className="p-4 font-medium text-slate-900">
                                            {entry.user_nickname}
                                            {index < 3 && <Star className="w-3 h-3 text-yellow-400 inline ml-2 fill-yellow-400" />}
                                        </td>
                                        <td className="p-4 text-right font-mono text-indigo-600 font-bold">
                                            {entry.total_bugs}
                                        </td>
                                        <td className="p-4 text-right font-mono text-green-600">
                                            {entry.fixed_bugs}
                                        </td>
                                    </tr>
                                ))}
                                {leaders.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-12 text-center text-slate-500">
                                            No bug reports yet. Be the first to report one!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
