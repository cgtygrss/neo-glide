import React, { useState } from 'react';
import { Zap, Magnet, Rocket, Shield, ArrowLeft, Crosshair, Anchor, EyeOff, Star, Activity, ShoppingCart, Circle, Minus } from 'lucide-react';

const UPGRADES = [
    { id: 'battery', name: 'Battery Capacity', icon: Zap, cost: 100, desc: 'Boost for longer duration.' },
    { id: 'thruster', name: 'Thruster Power', icon: Rocket, cost: 150, desc: 'Climb faster and higher.' },
    { id: 'magnet', name: 'Magnet Range', icon: Magnet, cost: 200, desc: 'Attract data from further away.' },
    { id: 'hull', name: 'Hull Strength', icon: Shield, cost: 500, desc: 'Survive one collision.' },
    { id: 'multiplier', name: 'Data Multiplier', icon: Star, cost: 1000, desc: 'Earn 2x currency per pickup.' },
    { id: 'shield_gen', name: 'Shield Generator', icon: Activity, cost: 2000, desc: 'Regenerate hull over time.' },
];

const SHIPS = [
    { id: 'default', name: 'Standard Glider', icon: Rocket, cost: 0, desc: 'Reliable and balanced.' },
    { id: 'interceptor', name: 'Interceptor', icon: Crosshair, cost: 1000, desc: 'Aerodynamic combat design.' },
    { id: 'cruiser', name: 'Heavy Cruiser', icon: Anchor, cost: 2500, desc: 'Robust industrial frame.' },
    { id: 'stealth', name: 'Stealth Wing', icon: EyeOff, cost: 5000, desc: 'Advanced prototype tech.' },
    { id: 'void_runner', name: 'Void Runner', icon: Zap, cost: 10000, desc: 'Phases through small obstacles.' },
    { id: 'plasma_breaker', name: 'Plasma Breaker', icon: Shield, cost: 20000, desc: 'Destroys obstacles on impact.' },
];

const WEAPONS = [
    { id: 'default', name: 'Pulse Laser', icon: Zap, cost: 0, desc: 'Standard rapid-fire energy bolts.' },
    { id: 'blaster', name: 'Solar Blaster', icon: Crosshair, cost: 1500, desc: 'High-velocity orange plasma.' },
    { id: 'cannon', name: 'Magma Cannon', icon: Circle, cost: 3000, desc: 'Heavy red energy spheres.' },
    { id: 'beam', name: 'Ion Beam', icon: Minus, cost: 6000, desc: 'Precise blue laser stream.' },
    { id: 'wave', name: 'Void Wave', icon: Activity, cost: 12000, desc: 'Oscillating purple energy.' },
    { id: 'shock', name: 'Tesla Arc', icon: Zap, cost: 25000, desc: 'Unstable green lightning.' },
];

export default function Shop({ currency, upgrades, ownedShips = [], equippedShip = 'default', ownedWeapons = [], equippedWeapon = 'default', onBuy, onEquip, onClose }) {
    const [activeTab, setActiveTab] = useState('upgrades'); // 'upgrades', 'ships', 'weapons'

    return (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 animate-fade-in">
            {/* Background Grid Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

            <div className="relative w-full max-w-2xl h-[60vh] flex flex-col bg-gray-900/80 border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-neon-blue/20 rounded-lg border border-neon-blue/50 shadow-[0_0_15px_rgba(0,243,255,0.3)]">
                            <ShoppingCart className="w-6 h-6 text-neon-blue" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tighter italic">
                                CYBER<span className="text-neon-blue">MARKET</span>
                            </h2>
                            <p className="text-xs text-gray-400 tracking-widest uppercase">Black Market Upgrades</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-xs text-gray-400 font-bold tracking-widest">AVAILABLE CREDITS</span>
                            <div className="text-2xl font-mono font-bold text-neon-green drop-shadow-[0_0_8px_rgba(0,255,153,0.6)]">
                                ${currency.toLocaleString()}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-white/10 rounded-full transition-all hover:rotate-90 active:scale-90 group"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-400 group-hover:text-white" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-black/20">
                    <button
                        onClick={() => setActiveTab('upgrades')}
                        className={`flex-1 py-4 text-sm font-bold tracking-widest transition-all relative overflow-hidden group ${activeTab === 'upgrades' ? 'text-neon-blue bg-neon-blue/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Zap className={`w-4 h-4 ${activeTab === 'upgrades' ? 'animate-pulse' : ''}`} />
                            SYSTEM UPGRADES
                        </div>
                        {activeTab === 'upgrades' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-neon-blue shadow-[0_0_10px_#00f3ff]" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('ships')}
                        className={`flex-1 py-4 text-sm font-bold tracking-widest transition-all relative overflow-hidden group ${activeTab === 'ships' ? 'text-neon-pink bg-neon-pink/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Rocket className={`w-4 h-4 ${activeTab === 'ships' ? 'animate-pulse' : ''}`} />
                            FLIGHT CHASSIS
                        </div>
                        {activeTab === 'ships' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-neon-pink shadow-[0_0_10px_#ff00ff]" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('weapons')}
                        className={`flex-1 py-4 text-sm font-bold tracking-widest transition-all relative overflow-hidden group ${activeTab === 'weapons' ? 'text-neon-green bg-neon-green/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Crosshair className={`w-4 h-4 ${activeTab === 'weapons' ? 'animate-pulse' : ''}`} />
                            WEAPONRY
                        </div>
                        {activeTab === 'weapons' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-neon-green shadow-[0_0_10px_#00ff99]" />
                        )}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {activeTab === 'upgrades' ? (
                        <div className="flex flex-wrap justify-center content-center gap-6 min-h-full">
                            {UPGRADES.map((item) => {
                                const level = upgrades[item.id] || 1;
                                const currentCost = Math.floor(item.cost * Math.pow(1.5, level - 1));
                                const canAfford = currency >= currentCost;

                                return (
                                    <div key={item.id} className="group relative bg-black/40 border border-white/10 rounded-xl p-5 hover:border-neon-blue/50 transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.15)] hover:-translate-y-1 min-w-[280px] max-w-[400px]">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <item.icon className="w-24 h-24 text-neon-blue" />
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 group-hover:border-neon-blue/30 transition-colors">
                                                    <item.icon className="w-6 h-6 text-neon-blue" />
                                                </div>
                                                <span className="px-2 py-1 bg-neon-blue/10 text-neon-blue text-[10px] font-bold rounded border border-neon-blue/20">
                                                    LVL {level}
                                                </span>
                                            </div>

                                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-neon-blue transition-colors">{item.name}</h3>
                                            <p className="text-sm text-gray-400 mb-6 h-10 leading-tight">{item.desc}</p>

                                            <button
                                                onClick={() => onBuy(item.id, currentCost, 'upgrade')}
                                                disabled={!canAfford}
                                                className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${canAfford
                                                    ? 'bg-neon-blue hover:bg-blue-500 text-black shadow-[0_0_15px_rgba(0,243,255,0.4)] hover:shadow-[0_0_25px_rgba(0,243,255,0.6)]'
                                                    : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                                                    }`}
                                            >
                                                {canAfford ? (
                                                    <>
                                                        <span>UPGRADE</span>
                                                        <span className="bg-black/20 px-2 py-0.5 rounded text-xs">${currentCost}</span>
                                                    </>
                                                ) : (
                                                    <span>MISSING ${currentCost - currency}</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : activeTab === 'ships' ? (
                        <div className="flex flex-wrap justify-center content-center gap-6 min-h-full">
                            {SHIPS.map((item) => {
                                const isOwned = ownedShips.includes(item.id);
                                const isEquipped = equippedShip === item.id;
                                const canAfford = currency >= item.cost;

                                return (
                                    <div key={item.id} className={`group relative bg-black/40 border rounded-xl p-5 transition-all hover:-translate-y-1 min-w-[280px] max-w-[400px] ${isEquipped
                                        ? 'border-neon-pink shadow-[0_0_20px_rgba(236,72,153,0.2)]'
                                        : 'border-white/10 hover:border-neon-pink/50 hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]'
                                        }`}>
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <item.icon className="w-24 h-24 text-neon-pink" />
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-3 rounded-lg border transition-colors ${isEquipped ? 'bg-neon-pink/20 border-neon-pink/50' : 'bg-gray-800 border-gray-700 group-hover:border-neon-pink/30'
                                                    }`}>
                                                    <item.icon className={`w-6 h-6 ${isEquipped ? 'text-neon-pink' : 'text-gray-400 group-hover:text-neon-pink'}`} />
                                                </div>
                                                {isEquipped && (
                                                    <span className="px-2 py-1 bg-neon-pink/10 text-neon-pink text-[10px] font-bold rounded border border-neon-pink/20 animate-pulse">
                                                        ACTIVE
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className={`text-lg font-bold mb-1 transition-colors ${isEquipped ? 'text-neon-pink' : 'text-white group-hover:text-neon-pink'}`}>
                                                {item.name}
                                            </h3>
                                            <p className="text-sm text-gray-400 mb-6 h-10 leading-tight">{item.desc}</p>

                                            {isOwned ? (
                                                <button
                                                    onClick={() => onEquip(item.id)}
                                                    disabled={isEquipped}
                                                    className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all ${isEquipped
                                                        ? 'bg-gray-800 text-neon-pink border border-neon-pink/30 cursor-default'
                                                        : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                                                        }`}
                                                >
                                                    {isEquipped ? 'EQUIPPED' : 'EQUIP CHASSIS'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onBuy(item.id, item.cost, 'ship')}
                                                    disabled={!canAfford}
                                                    className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${canAfford
                                                        ? 'bg-neon-pink hover:bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)] hover:shadow-[0_0_25px_rgba(236,72,153,0.6)]'
                                                        : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                                                        }`}
                                                >
                                                    {canAfford ? (
                                                        <>
                                                            <span>PURCHASE</span>
                                                            <span className="bg-black/20 px-2 py-0.5 rounded text-xs">${item.cost.toLocaleString()}</span>
                                                        </>
                                                    ) : (
                                                        <span>MISSING ${item.cost - currency}</span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-wrap justify-center content-center gap-6 min-h-full">
                            {WEAPONS.map((item) => {
                                const isOwned = ownedWeapons.includes(item.id);
                                const isEquipped = equippedWeapon === item.id;
                                const canAfford = currency >= item.cost;

                                return (
                                    <div key={item.id} className={`group relative bg-black/40 border rounded-xl p-5 transition-all hover:-translate-y-1 min-w-[280px] max-w-[400px] ${isEquipped
                                        ? 'border-neon-green shadow-[0_0_20px_rgba(0,255,153,0.2)]'
                                        : 'border-white/10 hover:border-neon-green/50 hover:shadow-[0_0_20px_rgba(0,255,153,0.15)]'
                                        }`}>
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <item.icon className="w-24 h-24 text-neon-green" />
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-3 rounded-lg border transition-colors ${isEquipped ? 'bg-neon-green/20 border-neon-green/50' : 'bg-gray-800 border-gray-700 group-hover:border-neon-green/30'
                                                    }`}>
                                                    <item.icon className={`w-6 h-6 ${isEquipped ? 'text-neon-green' : 'text-gray-400 group-hover:text-neon-green'}`} />
                                                </div>
                                                {isEquipped && (
                                                    <span className="px-2 py-1 bg-neon-green/10 text-neon-green text-[10px] font-bold rounded border border-neon-green/20 animate-pulse">
                                                        ACTIVE
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className={`text-lg font-bold mb-1 transition-colors ${isEquipped ? 'text-neon-green' : 'text-white group-hover:text-neon-green'}`}>
                                                {item.name}
                                            </h3>
                                            <p className="text-sm text-gray-400 mb-6 h-10 leading-tight">{item.desc}</p>

                                            {isOwned ? (
                                                <button
                                                    onClick={() => onEquip(item.id, 'weapon')}
                                                    disabled={isEquipped}
                                                    className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all ${isEquipped
                                                        ? 'bg-gray-800 text-neon-green border border-neon-green/30 cursor-default'
                                                        : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                                                        }`}
                                                >
                                                    {isEquipped ? 'EQUIPPED' : 'EQUIP WEAPON'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onBuy(item.id, item.cost, 'weapon')}
                                                    disabled={!canAfford}
                                                    className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${canAfford
                                                        ? 'bg-neon-green hover:bg-green-500 text-black shadow-[0_0_15px_rgba(0,255,153,0.4)] hover:shadow-[0_0_25px_rgba(0,255,153,0.6)]'
                                                        : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                                                        }`}
                                                >
                                                    {canAfford ? (
                                                        <>
                                                            <span>PURCHASE</span>
                                                            <span className="bg-black/20 px-2 py-0.5 rounded text-xs">${item.cost.toLocaleString()}</span>
                                                        </>
                                                    ) : (
                                                        <span>MISSING ${item.cost - currency}</span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
