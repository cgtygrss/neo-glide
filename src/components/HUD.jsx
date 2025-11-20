import React from 'react';
import { Zap, Coins } from 'lucide-react';

export default function HUD({ distance, currency, energy }) {
    return (
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
            {/* Distance */}
            <div className="flex flex-col">
                <span className="text-sm text-gray-400">DISTANCE</span>
                <span className="text-4xl font-bold neon-text-blue">{Math.floor(distance)}m</span>
            </div>

            {/* Energy Bar */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-64 h-4 border border-gray-600 rounded overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-red-500 transition-all duration-100"
                    style={{ width: `${energy}%` }}
                />
            </div>

            {/* Currency */}
            <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-full">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-xl font-bold text-yellow-400">{currency}</span>
            </div>
        </div>
    );
}
