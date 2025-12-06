import React from 'react';

interface MoodCardProps {
    name: string;
    description: string;
    color: string;
    selected: boolean;
    onClick: () => void;
}

export function MoodCard({ name, description, color, selected, onClick }: MoodCardProps) {
    return (
        <div
            onClick={onClick}
            className={`group relative h-[180px] w-full cursor-pointer flex flex-col justify-center px-8 transition-all duration-500 border-l-2 ${selected
                ? 'bg-white border-oura-dark'
                : 'bg-transparent border-stone-200 hover:border-oura-accent/50 hover:bg-white/40'
                }`}
        >
            {/* Top UI Elements: Label and Plus */}
            <div className={`absolute top-6 left-6 transition-opacity duration-500 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}>
                <span className="text-[10px] uppercase tracking-[0.3em] font-sans text-stone-400">Vibe</span>
            </div>

            <div className={`absolute top-6 right-6 transition-all duration-500 ${selected ? 'rotate-45' : 'group-hover:rotate-90'}`}>
                <span className={`text-xl font-light leading-none ${selected ? 'text-oura-dark' : 'text-stone-300 group-hover:text-stone-500'}`}>+</span>
            </div>

            <div className="flex flex-col space-y-2 transition-transform duration-700 ease-out group-hover:translate-x-4">
                <span className={`font-serif text-5xl tracking-tight transition-colors duration-500 ${selected ? 'text-oura-dark italic' : 'text-stone-300 group-hover:text-oura-dark'
                    }`}>
                    {name}
                </span>
                <span className={`text-[10px] font-sans tracking-[0.3em] uppercase transition-colors duration-500 ${selected ? 'text-oura-accent' : 'text-stone-300/60 group-hover:text-stone-400'
                    }`}>
                    {description}
                </span>
            </div>
        </div>
    );
}
