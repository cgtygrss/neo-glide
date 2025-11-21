import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Trophy, Medal, AlertCircle } from 'lucide-react';

export default function Leaderboard({ currentScore, onClose, onReward }) {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [rank, setRank] = useState(null);

    useEffect(() => {
        fetchScores();
    }, []);

    const fetchScores = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('scores')
                .select('*')
                .order('score', { ascending: false })
                .limit(10);

            if (error) throw error;
            setScores(data || []);
        } catch (err) {
            console.error('Error fetching scores:', err);
            setError('Could not load leaderboard. Check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('scores')
                .insert([{ player_name: name.trim(), score: currentScore }])
                .select();

            if (error) throw error;

            setSubmitted(true);
            await fetchScores();

            // Check rank
            const { count, error: countError } = await supabase
                .from('scores')
                .select('*', { count: 'exact', head: true })
                .gt('score', currentScore);

            if (!countError) {
                const newRank = count + 1;
                setRank(newRank);
                if (newRank === 1) {
                    onReward();
                }
            }

        } catch (err) {
            console.error('Error submitting score:', err);
            setError('Failed to submit score.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.2)]">

                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 p-4 border-b border-cyan-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        <h2 className="text-xl font-bold text-white tracking-wide">LEADERBOARD</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="text-center py-8 text-cyan-400 animate-pulse">Loading scores...</div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-8 text-red-400 gap-2">
                            <AlertCircle className="w-8 h-8" />
                            <p className="text-sm text-center">{error}</p>
                            <p className="text-xs text-gray-500">Make sure Supabase is configured.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {scores.map((entry, index) => (
                                <div
                                    key={entry.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${index === 0 ? 'bg-yellow-500/10 border-yellow-500/50' :
                                            index === 1 ? 'bg-gray-400/10 border-gray-400/50' :
                                                index === 2 ? 'bg-orange-700/10 border-orange-700/50' :
                                                    'bg-gray-800/50 border-gray-700/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${index === 0 ? 'bg-yellow-500 text-black' :
                                                index === 1 ? 'bg-gray-400 text-black' :
                                                    index === 2 ? 'bg-orange-700 text-white' :
                                                        'bg-gray-700 text-gray-300'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <span className="text-white font-medium truncate max-w-[120px] sm:max-w-[150px]">
                                            {entry.player_name}
                                        </span>
                                    </div>
                                    <span className="text-cyan-300 font-mono font-bold">
                                        {entry.score.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                            {scores.length === 0 && (
                                <div className="text-center py-8 text-gray-500">No scores yet. Be the first!</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer / Submission */}
                <div className="p-4 bg-gray-900/50 border-t border-cyan-500/20">
                    {!submitted ? (
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                maxLength={12}
                                className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                                disabled={submitting}
                            />
                            <button
                                type="submit"
                                disabled={!name.trim() || submitting}
                                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                {submitting ? '...' : 'Submit'}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center">
                            <p className="text-green-400 font-bold mb-1">Score Submitted!</p>
                            {rank && (
                                <p className="text-white text-sm">
                                    You are ranked <span className="font-bold text-yellow-400">#{rank}</span>
                                </p>
                            )}
                            {rank === 1 && (
                                <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg animate-pulse">
                                    <p className="text-yellow-300 font-bold text-sm">🏆 NEW RECORD! +$100,000</p>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
                        <span>Your Score: <span className="text-white font-bold">{currentScore}</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
