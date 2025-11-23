import React, { useState, useEffect } from 'react';
import { Zap, Target, Rocket } from 'lucide-react';

export default function Tutorial({ onComplete, onSkip }) {
    const [step, setStep] = useState(0);
    const [shipY, setShipY] = useState(50); // Ship vertical position (percentage)
    const [showProjectile, setShowProjectile] = useState(false);
    const [projectileX, setProjectileX] = useState(0);

    const tutorialSteps = [
        {
            duration: 2500,
            title: "WELCOME TO",
            subtitle: "NEO GLIDE",
            description: "Master the controls to survive",
            icon: <Rocket className="w-16 h-16" />
        },
        {
            duration: 4000,
            title: "HOLD TO FLY",
            description: "Press and hold anywhere on screen to boost upward",
            showFlyIndicator: true
        },
        {
            duration: 4000,
            title: "TAP TO FIRE",
            description: "Tap the FIRE button to shoot enemies",
            showFireIndicator: true
        },
        {
            duration: 1500,
            title: "READY!",
            description: "Good luck, pilot",
            icon: <Target className="w-16 h-16" />
        }
    ];

    useEffect(() => {
        if (step >= tutorialSteps.length) {
            onComplete();
            return;
        }

        const timer = setTimeout(() => {
            setStep(s => s + 1);
        }, tutorialSteps[step].duration);

        return () => clearTimeout(timer);
    }, [step, onComplete]);

    // Animate ship flying in step 1
    useEffect(() => {
        if (step === 1) {
            const flyInterval = setInterval(() => {
                setShipY(y => {
                    const newY = y - 15;
                    if (newY < 20) return 50; // Reset to bottom
                    return newY;
                });
            }, 1500);

            return () => clearInterval(flyInterval);
        } else {
            setShipY(50);
        }
    }, [step]);

    // Animate projectile firing in step 2
    useEffect(() => {
        if (step === 2) {
            const fireInterval = setInterval(() => {
                setShowProjectile(true);
                setProjectileX(0);

                const animateProjectile = setInterval(() => {
                    setProjectileX(x => {
                        if (x > 100) {
                            clearInterval(animateProjectile);
                            setShowProjectile(false);
                            return 0;
                        }
                        return x + 5;
                    });
                }, 50);
            }, 2000);

            return () => clearInterval(fireInterval);
        } else {
            setShowProjectile(false);
        }
    }, [step]);

    if (step >= tutorialSteps.length) return null;

    const currentStep = tutorialSteps[step];

    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center">
            {/* Skip Button */}
            <button
                onClick={onSkip}
                className="absolute top-8 right-8 px-6 py-3 bg-gray-800/80 hover:bg-gray-700 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-bold rounded-lg transition-all"
                style={{
                    top: 'max(32px, calc(env(safe-area-inset-top) + 24px))',
                    right: 'max(32px, env(safe-area-inset-right))'
                }}
            >
                SKIP TUTORIAL
            </button>

            {/* Main Tutorial Content */}
            <div className="relative w-full h-full flex flex-col items-center justify-center">

                {/* Tutorial Text */}
                <div className="text-center mb-12 animate-fadeIn">
                    {currentStep.icon && (
                        <div className="flex justify-center mb-6 text-cyan-400 animate-pulse">
                            {currentStep.icon}
                        </div>
                    )}

                    <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-4 tracking-wider drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]">
                        {currentStep.title}
                    </h2>

                    {currentStep.subtitle && (
                        <h3 className="text-4xl font-bold text-white mb-6 tracking-widest">
                            {currentStep.subtitle}
                        </h3>
                    )}

                    <p className="text-xl text-gray-300 tracking-wide">
                        {currentStep.description}
                    </p>
                </div>

                {/* Interactive Demo Area */}
                <div className="relative w-full max-w-2xl h-64 flex items-center justify-center">

                    {/* Ship Visualization */}
                    <div
                        className="absolute left-1/4 transition-all duration-1000 ease-out"
                        style={{ top: `${shipY}%` }}
                    >
                        {/* Simple Ship Representation */}
                        <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.8)] flex items-center justify-center">
                                <Zap className="w-6 h-6 text-white" />
                            </div>

                            {/* Boost Effect when flying */}
                            {step === 1 && shipY < 45 && (
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-b from-orange-500/80 to-transparent rounded-full blur-sm animate-pulse" />
                            )}
                        </div>
                    </div>

                    {/* Projectile Animation */}
                    {step === 2 && showProjectile && (
                        <div
                            className="absolute left-1/4 top-1/2 -translate-y-1/2 transition-all duration-100"
                            style={{ transform: `translateX(${projectileX}%) translateY(-50%)` }}
                        >
                            <div className="w-8 h-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                        </div>
                    )}

                    {/* Hold to Fly Indicator */}
                    {currentStep.showFlyIndicator && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse">
                            <div className="relative">
                                {/* Pulsing Circle */}
                                <div className="w-32 h-32 rounded-full border-4 border-cyan-400 animate-ping opacity-75" />
                                <div className="absolute inset-0 w-32 h-32 rounded-full border-4 border-cyan-400 flex items-center justify-center">
                                    <div className="text-6xl">👆</div>
                                </div>
                                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-cyan-400 font-bold text-lg">
                                    HOLD HERE
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fire Button Indicator */}
                    {currentStep.showFireIndicator && (
                        <div className="absolute right-1/4 bottom-8 animate-pulse">
                            <div className="relative">
                                {/* Mock Fire Button */}
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/40 to-orange-600/40 border-4 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.8)] flex items-center justify-center">
                                    <span className="text-white font-black text-sm">FIRE</span>
                                </div>

                                {/* Pulsing Ring */}
                                <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-red-400 animate-ping" />

                                {/* Arrow Pointer */}
                                <div className="absolute -top-16 left-1/2 -translate-x-1/2 text-5xl animate-bounce">
                                    👇
                                </div>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-red-400 font-bold text-lg">
                                    TAP HERE
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress Indicator */}
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3">
                    {tutorialSteps.map((_, index) => (
                        <div
                            key={index}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${index === step
                                    ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] scale-125'
                                    : index < step
                                        ? 'bg-cyan-600'
                                        : 'bg-gray-600'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
