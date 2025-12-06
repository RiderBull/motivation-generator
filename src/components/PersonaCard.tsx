import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PersonaCardProps {
    name: string;
    description: string;
    icon: React.ReactNode;
    imageSrc: string;
    selected: boolean;
    onClick: () => void;
}

export function PersonaCard({ name, description, icon, imageSrc, selected, onClick }: PersonaCardProps) {
    return (
        <div
            onClick={onClick}
            className={`group relative h-[450px] w-full rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-700 ${selected ? 'ring-4 ring-white shadow-2xl scale-[1.02]' : 'hover:scale-[1.01] hover:shadow-xl'}`}
        >
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
                style={{ backgroundImage: `url('${imageSrc}')` }}
            />

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Top UI Elements */}
            <div className="absolute top-6 left-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-3 h-3 text-white" }) : icon}
                    <span className="text-[10px] font-medium text-white uppercase tracking-widest">Coach</span>
                </div>
            </div>

            <div className="absolute top-6 right-6">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 ${selected ? 'bg-white text-black border-white' : 'bg-white/10 text-white border-white/20 group-hover:bg-white group-hover:text-black'}`}>
                    <span className="text-xl leading-none mb-1">+</span>
                </div>
            </div>

            {/* Bottom Content */}
            <div className="absolute bottom-0 left-0 p-8 w-full">
                <h3 className="text-3xl text-white font-sans font-light leading-tight">
                    {name} <br />
                    <span className="font-serif italic capitalize text-white/90">{description}</span>
                </h3>
            </div>
        </div>
    );
}
