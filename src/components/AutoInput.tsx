import React, { useState, useEffect, useRef } from 'react';

interface AutoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    minWidth?: number;
    value: string;
}

export const AutoInput = ({ value, placeholder, minWidth = 100, className, ...props }: AutoInputProps) => {
    const [width, setWidth] = useState(minWidth);
    const spanRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (spanRef.current) {
            // Measure the text content (either value or placeholder)
            spanRef.current.textContent = value || placeholder || '';
            // We need to ensure the span has the same font styles as the input for accurate measurement
            // detailed font matching is handled by passing the same 'className'
            const newWidth = Math.max(minWidth, spanRef.current.offsetWidth + 10); // +10px buffer
            setWidth(newWidth);
        }
    }, [value, placeholder, minWidth]);

    return (
        <div className="inline-block relative align-baseline">
            {/* Hidden span for measurement. 
          Must match input font-family, font-size, font-weight, letter-spacing, etc. 
          We strip layout classes like padding/margin for the measurement or just include them if they affect width. 
      */}
            <span
                ref={spanRef}
                className={`${className} invisible absolute whitespace-pre h-0 overflow-hidden text-transparent pointer-events-none left-0 top-0`}
            >
            </span>

            <input
                {...props}
                value={value}
                className={className}
                placeholder={placeholder}
                style={{ width: `${width}px`, boxSizing: 'content-box' }}
            />
        </div>
    );
};
