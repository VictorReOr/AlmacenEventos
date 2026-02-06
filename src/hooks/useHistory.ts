import { useState } from 'react';
import type { AlmacenState } from '../types';

export const useHistory = (initialState: AlmacenState) => {
    const [history, setHistory] = useState<AlmacenState[]>([initialState]);
    const [pointer, setPointer] = useState(0);

    const currentState = history[pointer];

    const pushState = (newState: AlmacenState) => {
        const nextHistory = [...history.slice(0, pointer + 1), newState];
        // Limit history size to 50
        if (nextHistory.length > 50) nextHistory.shift();

        setHistory(nextHistory);
        setPointer(nextHistory.length - 1);
    };

    const undo = () => {
        if (pointer > 0) setPointer(pointer - 1);
    };

    const redo = () => {
        if (pointer < history.length - 1) setPointer(pointer + 1);
    };

    return {
        state: currentState,
        pushState,
        undo,
        redo,
        canUndo: pointer > 0,
        canRedo: pointer < history.length - 1
    };
};
