import React from 'react';
import { Zap, Coins } from 'lucide-react';

export default function HUD({ distance, currency, energy, ammo, maxAmmo, health, maxHealth, onShoot }) {
    return (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3 pb-4">
            
            {/* Top HUD - Compact Single Bar */}
            <div className="flex items-center justify-between gap-2 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-cyan-500/30 mx-1">
                
                {/* Left: Distance */}
                <div className="flex items-center gap-1.5 min-w-[70px]">
                    <div className="w-1 h-5 bg-cyan-400 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.6)] ml-2"></div>
                    <div>
                        <div className="text-[7px] text-cyan-300 font-bold leading-none">DIST</div>
                        <div className="text-sm text-white font-bold leading-tight">{Math.floor(distance)}m</div>
                    </div>
                </div>

                {/* Center: Credits */}
                <div className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/20 rounded-full border border-emerald-400/40">
                    <div className="text-[10px] text-emerald-300 font-bold">$</div>
                    <div className="text-xs text-white font-bold">{currency}</div>
                </div>

                {/* Right: Ammo */}
                <div className="flex items-center gap-1.5 min-w-[55px] justify-end">
                    <div className='mr-2'>
                        <div className="text-[7px] text-yellow-300 font-bold leading-none text-right">AMMO</div>
                        <div className="text-sm text-white font-bold leading-tight text-right">{ammo}/{maxAmmo}</div>
                    </div>
                    <div className="w-1 h-5 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(250,204,21,0.6)]"></div>
                </div>
            </div>

            {/* Bottom HUD */}
            <div className="flex items-end justify-between gap-2 pointer-events-auto px-1">
                
                {/* Bottom Left: Status Bars */}
                <div className="flex flex-col gap-1.5 w-28 sm:w-36">
                    
                    {/* Health Bar */}
                    <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 border border-red-500/40">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[7px] text-red-400 font-bold">HULL</span>
                            <span className="text-[8px] text-white font-bold">{Math.ceil(health)}/{maxHealth}</span>
                        </div>
                        <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                            <div 
                                className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-200 rounded-full"
                                style={{ width: `${Math.max(0, Math.min(100, (health / maxHealth) * 100))}%` }}
                            />
                        </div>
                    </div>

                    {/* Energy Bar */}
                    <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 border border-pink-500/40">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[7px] text-pink-400 font-bold">ENERGY</span>
                            <span className="text-[8px] text-white font-bold">{Math.floor(energy)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                            <div 
                                className={`h-full transition-all duration-200 rounded-full ${
                                    energy < 30 
                                        ? 'bg-gradient-to-r from-red-600 to-red-500 animate-pulse' 
                                        : 'bg-gradient-to-r from-pink-600 to-fuchsia-500'
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, energy))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Right: Fire Button */}
                <div className="flex items-center justify-center">
                    <button
                        className={`relative w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full border-[3px] flex items-center justify-center font-bold transition-all active:scale-90 shadow-2xl ${
                            ammo >= 1
                                ? 'bg-gradient-to-br from-red-500/40 to-orange-600/40 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] active:shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                                : 'bg-gray-800/30 border-gray-600 opacity-50 cursor-not-allowed'
                        }`}
                        onClick={onShoot}
                        disabled={ammo < 1}
                    >
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-xs sm:text-sm text-white font-black tracking-wide drop-shadow-lg">FIRE</span>
                            <span className="text-[8px] text-white/80 font-bold mt-0.5">{ammo}/{maxAmmo}</span>
                        </div>
                        {ammo >= 1 && (
                            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-red-400/20 to-transparent animate-pulse"></div>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
