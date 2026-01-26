import { useState, useEffect } from 'react';

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            // Coarse pointer indicates a touch screen (usually)
            const isTouch = window.matchMedia('(pointer: coarse)').matches;
            // Also check width just in case
            const isOneColumn = window.innerWidth < 768;

            setIsMobile(isTouch || isOneColumn);
        };

        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);

        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    return isMobile;
};
