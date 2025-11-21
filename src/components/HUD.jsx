import React from 'react';
import { Zap, Coins } from 'lucide-react';

export default function HUD({ distance, currency, energy, ammo, maxAmmo, health, maxHealth, onShoot }) {
    return (
        <div
            className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between"
            style={{
                paddingTop: 'max(8px, env(safe-area-inset-top))',
                paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
                paddingLeft: 'max(8px, env(safe-area-inset-left))',
                paddingRight: 'max(8px, env(safe-area-inset-right))'
            }}
        >

            {/* Top HUD - Compact Single Bar */}
            <div className="flex items-center justify-between gap-3 bg-black/40 backdrop-blur-sm rounded-full px-3.5 py-2 border border-cyan-500/30">

                {/* Left: Distance */}
                <div className="flex items-center gap-2 min-w-[85px]">
                    <div className="w-1.5 h-6 bg-cyan-400 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.6)] ml-2"></div>
                    <div>
                        <div className="text-[10px] text-cyan-300 font-bold leading-none">DIST</div>
                        <div className="text-lg text-white font-bold leading-tight">{Math.floor(distance)}m</div>
                    </div>
                </div>

                {/* Center: Credits */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-400/40">
                    <div className="text-sm text-emerald-300 font-bold">$</div>
                    <div className="text-base text-white font-bold">{currency}</div>
                </div>

                {/* Right: Ammo */}
                <div className="flex items-center gap-2 min-w-[70px] justify-end">
                    <div className='mr-2'>
                        <div className="text-[10px] text-yellow-300 font-bold leading-none text-right">AMMO</div>
                        <div className="text-lg text-white font-bold leading-tight text-right">{ammo}/{maxAmmo}</div>
                    </div>
                    <div className="w-1.5 h-6 bg-yellow-400 rounded-full shadow-[0_0_6px_rgba(250,204,21,0.6)]"></div>
                </div>
            </div>

            {/* Bottom HUD */}
            <div className="flex items-end justify-between gap-2 pointer-events-auto">

                {/* Bottom Left: Status Bars */}
                <div className="flex flex-col gap-2 w-32 sm:w-40">

                    {/* Health Bar */}
                    <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-red-500/40">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-red-400 font-bold">HULL</span>
                            <span className="text-xs text-white font-bold">{Math.ceil(health)}/{maxHealth}</span>
                        </div>
                        <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                            <div
                                className="h-full bg-linear-to-r from-red-600 to-red-500 transition-all duration-200 rounded-full"
                                style={{ width: `${Math.max(0, Math.min(100, (health / maxHealth) * 100))}%` }}
                            />
                        </div>
                    </div>

                    {/* Energy Bar */}
                    <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-pink-500/40">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-pink-400 font-bold">ENERGY</span>
                            <span className="text-xs text-white font-bold">{Math.floor(energy)}%</span>
                        </div>
                        <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                            <div
                                className={`h-full transition-all duration-200 rounded-full ${energy < 30
                                    ? 'bg-linear-to-r from-red-600 to-red-500 animate-pulse'
                                    : 'bg-linear-to-r from-pink-600 to-fuchsia-500'
                                    }`}
                                style={{ width: `${Math.max(0, Math.min(100, energy))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Right: Fire Button */}
                <div className="flex items-center justify-center">
                    <button
                        className={`relative w-20 h-20 sm:w-20 sm:h-20 rounded-full border-[3px] flex items-center justify-center font-bold transition-all active:scale-90 shadow-2xl ${ammo >= 1
                            ? 'bg-linear-to-br from-red-500/40 to-orange-600/40 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] active:shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                            : 'bg-gray-800/30 border-gray-600 opacity-50 cursor-not-allowed'
                            }`}
                        onClick={onShoot}
                        disabled={ammo < 1}
                    >
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-base sm:text-lg text-white font-black tracking-wide drop-shadow-lg">FIRE</span>
                            <span className="text-xs text-white/80 font-bold mt-0.5">{ammo}/{maxAmmo}</span>
                        </div>
                        {ammo >= 1 && (
                            <div className="absolute inset-0 rounded-full bg-linear-to-tr from-transparent via-red-400/20 to-transparent animate-pulse"></div>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
