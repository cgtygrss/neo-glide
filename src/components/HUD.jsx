import React from 'react';
import { Zap, Coins } from 'lucide-react';

export default function HUD({ distance, currency, energy, ammo, maxAmmo, onShoot }) {
    return (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 flex flex-col justify-between p-4">

            {/* Top Bar: Stats */}
            <div className="flex justify-between items-start w-full">
                {/* Left Panel: Distance & Currency */}
                <div className="flex flex-col gap-2">
                    <div className="clip-angled bg-black/60 backdrop-blur-md border-l-4 border-neon-blue p-2 pr-6 min-w-[120px]">
                        <div className="text-xs text-neon-blue font-bold tracking-widest mb-1">DISTANCE</div>
                        <div className="text-2xl text-white font-mono font-bold drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]">
                            {Math.floor(distance)}<span className="text-sm text-gray-400 ml-1">m</span>
                        </div>
                    </div>

                    <div className="clip-angled bg-black/60 backdrop-blur-md border-l-4 border-neon-green p-2 pr-6 min-w-[120px]">
                        <div className="text-xs text-neon-green font-bold tracking-widest mb-1">CREDITS</div>
                        <div className="text-xl text-white font-mono font-bold drop-shadow-[0_0_5px_rgba(0,255,153,0.8)]">
                            ${currency}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Energy & Ammo */}
                <div className="flex flex-col items-end gap-2">
                    {/* Energy Bar */}
                    <div className="clip-angled bg-black/60 backdrop-blur-md border-r-4 border-neon-pink p-2 pl-6 w-48">
                        <div className="text-xs text-neon-pink font-bold tracking-widest mb-1 text-right">ENERGY</div>
                        <div className="w-full h-3 bg-gray-900 rounded-sm overflow-hidden relative border border-gray-700">
                            <div
                                className={`h-full transition-all duration-200 ${energy < 30 ? 'bg-red-500 animate-pulse' : 'bg-neon-pink'}`}
                                style={{ width: `${Math.max(0, Math.min(100, energy))}%` }}
                            />
                        </div>
                    </div>

                    {/* Ammo Counter */}
                    <div className={`clip-angled bg-black/60 backdrop-blur-md border-r-4 p-2 pl-6 min-w-[100px] transition-colors duration-300 ${ammo === 0 ? 'border-red-500 animate-pulse-red' : 'border-yellow-400'}`}>
                        <div className={`text-xs font-bold tracking-widest mb-1 text-right ${ammo === 0 ? 'text-red-500' : 'text-yellow-400'}`}>
                            WEAPON
                        </div>
                        <div className="text-xl text-white font-mono font-bold text-right">
                            {ammo} <span className="text-gray-500 text-sm">/ {maxAmmo}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Right: Shoot Button (Mobile) */}
            <div className="pointer-events-auto flex justify-end pb-8 pr-4">
                <button
                    className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-white font-bold text-lg tracking-widest transition-all active:scale-95 shadow-lg ${ammo >= 1
                            ? 'bg-red-600/80 border-red-400 shadow-[0_0_20px_#ff0000] hover:bg-red-500'
                            : 'bg-gray-800/50 border-gray-600 opacity-50 cursor-not-allowed'
                        }`}
                    onClick={onShoot}
                    disabled={ammo < 1}
                >
                    <div className="flex flex-col items-center">
                        <span>FIRE</span>
                        <span className="text-[10px] opacity-70">{ammo}/{maxAmmo}</span>
                    </div>
                </button>
            </div>
        </div>
    );
}
