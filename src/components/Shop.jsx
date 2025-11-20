import React, { useState } from 'react';
import { Zap, Magnet, Rocket, Shield, ArrowLeft, Crosshair, Anchor, EyeOff } from 'lucide-react';

const UPGRADES = [
    { id: 'battery', name: 'Battery Capacity', icon: Zap, cost: 100, desc: 'Boost for longer duration.' },
    { id: 'thruster', name: 'Thruster Power', icon: Rocket, cost: 150, desc: 'Climb faster and higher.' },
    { id: 'magnet', name: 'Magnet Range', icon: Magnet, cost: 200, desc: 'Attract data from further away.' },
    { id: 'hull', name: 'Hull Strength', icon: Shield, cost: 500, desc: 'Survive one collision.' },
];

const SHIPS = [
    { id: 'default', name: 'Standard Glider', icon: Rocket, cost: 0, desc: 'Reliable and balanced.' },
    { id: 'interceptor', name: 'Interceptor', icon: Crosshair, cost: 1000, desc: 'Aerodynamic combat design.' },
    { id: 'cruiser', name: 'Heavy Cruiser', icon: Anchor, cost: 2500, desc: 'Robust industrial frame.' },
    { id: 'stealth', name: 'Stealth Wing', icon: EyeOff, cost: 5000, desc: 'Advanced prototype tech.' },
];

export default function Shop({ currency, upgrades, ownedShips = [], equippedShip = 'default', onBuy, onEquip, onClose }) {
    const [activeTab, setActiveTab] = useState('upgrades'); // 'upgrades' or 'ships'

    return (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="glass-panel p-8 w-full max-w-2xl relative h-[80vh] flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>

                <h2 className="text-3xl font-bold text-center mb-4 neon-text-pink">CYBER SHOP</h2>

                {/* Tabs */}
                <div className="flex justify-center gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('upgrades')}
                        className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'upgrades'
                                ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        UPGRADES
                    </button>
                    <button
                        onClick={() => setActiveTab('ships')}
                        className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'ships'
                                ? 'bg-pink-600 text-white shadow-[0_0_10px_rgba(219,39,119,0.5)]'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        SHIPS
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    {activeTab === 'upgrades' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {UPGRADES.map((item) => {
                                const level = upgrades[item.id] || 1;
                                const currentCost = Math.floor(item.cost * Math.pow(1.5, level - 1));
                                const canAfford = currency >= currentCost;

                                return (
                                    <div key={item.id} className="border border-gray-700 p-4 rounded hover:border-blue-500 transition-colors bg-black/40">
                                        <div className="flex items-center gap-3 mb-2">
                                            <item.icon className="w-6 h-6 text-blue-400" />
                                            <h3 className="font-bold text-lg">{item.name}</h3>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-3">{item.desc}</p>

                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500">Lvl {level}</span>
                                            <button
                                                onClick={() => onBuy(item.id, currentCost, 'upgrade')}
                                                disabled={!canAfford}
                                                className={`px-4 py-1 rounded font-bold text-sm transition-all ${canAfford
                                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]'
                                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                    }`}
                                            >
                                                Buy {currentCost}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {SHIPS.map((item) => {
                                const isOwned = ownedShips.includes(item.id);
                                const isEquipped = equippedShip === item.id;
                                const canAfford = currency >= item.cost;

                                return (
                                    <div key={item.id} className={`border p-4 rounded transition-colors bg-black/40 ${isEquipped ? 'border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]' : 'border-gray-700 hover:border-pink-500'}`}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <item.icon className={`w-6 h-6 ${isEquipped ? 'text-pink-400' : 'text-gray-400'}`} />
                                            <h3 className="font-bold text-lg">{item.name}</h3>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-3">{item.desc}</p>

                                        <div className="flex justify-end items-center">
                                            {isOwned ? (
                                                <button
                                                    onClick={() => onEquip(item.id)}
                                                    disabled={isEquipped}
                                                    className={`px-4 py-1 rounded font-bold text-sm transition-all ${isEquipped
                                                            ? 'bg-green-600 text-white cursor-default'
                                                            : 'bg-gray-600 hover:bg-gray-500 text-white'
                                                        }`}
                                                >
                                                    {isEquipped ? 'EQUIPPED' : 'EQUIP'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onBuy(item.id, item.cost, 'ship')}
                                                    disabled={!canAfford}
                                                    className={`px-4 py-1 rounded font-bold text-sm transition-all ${canAfford
                                                            ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-[0_0_10px_rgba(219,39,119,0.5)]'
                                                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                        }`}
                                                >
                                                    Buy {item.cost}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center pt-4 border-t border-gray-700">
                    <span className="text-xl text-yellow-400 font-bold">Balance: {currency} Data</span>
                </div>
            </div>
        </div>
    );
}
