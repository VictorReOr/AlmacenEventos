import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { PROGRAM_COLORS } from '../../types';
import type { Ubicacion } from '../../types';

interface Shelf3DProps {
    location: Ubicacion;
    activeFilter: string | null;
    onHover: (id: string | null, pos?: { x: number, y: number }, payload?: any) => void;
}

export const Shelf3D: React.FC<Shelf3DProps> = ({ location, activeFilter, onHover }) => {
    const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

    const [metalTex, boxTex] = useTexture([
        `${import.meta.env.BASE_URL}textures/texture_brushed_metal_1773221723747.png`,
        `${import.meta.env.BASE_URL}textures/texture_corrugated_cardboard.bmp`
    ]);

    useMemo(() => {
        metalTex.wrapS = THREE.RepeatWrapping;
        metalTex.wrapT = THREE.RepeatWrapping;
        metalTex.repeat.set(1, 4);

        boxTex.wrapS = THREE.RepeatWrapping;
        boxTex.wrapT = THREE.RepeatWrapping;
        boxTex.repeat.set(2, 2);
    }, [metalTex, boxTex]);

    // Parsing basics with Z-axis inversion for physical chirality match
    const x = location.x;
    const z = -location.y; // Flip Z to place Muro 4 on Left and Muro 2 on Right
    const w = location.width || 6;
    const d = location.depth || 0.45;
    const rotationY = location.rotation ? (-location.rotation * Math.PI) / 180 : 0;

    // Assuming shelf is divided into modules: 1 module width = ~1m
    const numModules = Math.round(w / 1.0) || 1;
    const modWidth = w / numModules;

    // Shelf physical parameters
    const levels = 4;
    const levelHeight = 0.8;
    const shelfThickness = 0.05;
    const trueHeight = levels * levelHeight + levels * shelfThickness;

    const renderSlots = () => {
        const slots = [];
        const cajasEstanteria = location.cajasEstanteria || {};

        let _localMatches = 0;
        let _hasActiveFilterAndNoMatch = false;

        // Check overarching filter
        if (activeFilter && activeFilter !== 'Otros') {
            Object.values(cajasEstanteria).forEach(caja => {
                if (caja.programa === activeFilter) _localMatches++;
            });
            if (_localMatches === 0) _hasActiveFilterAndNoMatch = true;
        }

        for (let m = 1; m <= numModules; m++) {
            for (let l = 1; l <= levels; l++) {
                const slotId = `M${m}-A${l}`;
                const contents = cajasEstanteria[slotId];

                // Filter logic for specific slot
                let isDimmed = _hasActiveFilterAndNoMatch;
                let isSlotDimmed = false;
                if (activeFilter && contents) {
                    isSlotDimmed = contents.programa !== activeFilter;
                }

                // Position relative to group origin (center-bottom)
                // We reverse the order so M1 is on the correct side (closer to Muro 4)
                const slotX = (w / 2) - (m - 0.5) * modWidth;
                // Content size
                const itemW = modWidth * 0.85;
                const itemH = levelHeight * 0.8;
                const itemD = d * 0.85;

                // The slot Y center: (level - 1) * levelHeight + (level - 1) * shelfThickness + half content height
                // So l=1 sits right on the bottom shelf at y=0 (+ shelf thickness)
                const shelfY = (l - 1) * levelHeight + (l - 1) * shelfThickness;
                const slotY = shelfY + shelfThickness + itemH / 2;

                if (contents && contents.programa !== 'Vacio') {
                    const prg = contents.programa;
                    const color = PROGRAM_COLORS[prg] || PROGRAM_COLORS['Otros'];
                    const opacity = (isDimmed || isSlotDimmed) ? 0.15 : (hoveredSlot === slotId ? 1 : 0.9);
                    const isGray = isDimmed || isSlotDimmed;

                    slots.push(
                        <mesh
                            key={slotId}
                            position={[slotX, slotY, 0]}
                            castShadow
                            receiveShadow
                            onPointerOver={(e) => {
                                e.stopPropagation();
                                setHoveredSlot(slotId);
                                document.body.style.cursor = 'pointer';
                                onHover(`${location.id} - ${slotId}`, { x: e.clientX, y: e.clientY }, location);
                            }}
                            onPointerOut={(e) => {
                                e.stopPropagation();
                                setHoveredSlot(null);
                                document.body.style.cursor = 'auto';
                                onHover(null);
                            }}
                        >
                            {/* We make the box slightly smaller than the slot volume */}
                            <boxGeometry args={[itemW, itemH, itemD]} />
                            <meshStandardMaterial
                                map={boxTex}
                                color={isGray ? '#777777' : '#ffffff'}
                                transparent
                                opacity={opacity}
                                emissive={hoveredSlot === slotId && !isGray ? color : '#000000'}
                                emissiveIntensity={hoveredSlot === slotId ? 0.3 : 0}
                                roughness={0.9}
                            />
                            {/* Color Sticker on the front and back */}
                            {!isGray && (
                                <>
                                    <mesh position={[0, 0, itemD / 2 + 0.005]}>
                                        <planeGeometry args={[itemW * 0.4, itemH * 0.3]} />
                                        <meshBasicMaterial color={color} transparent opacity={opacity} />
                                    </mesh>
                                    <mesh position={[0, 0, -itemD / 2 - 0.005]} rotation={[0, Math.PI, 0]}>
                                        <planeGeometry args={[itemW * 0.4, itemH * 0.3]} />
                                        <meshBasicMaterial color={color} transparent opacity={opacity} />
                                    </mesh>
                                </>
                            )}
                        </mesh>
                    );
                }
            }
        }
        return slots;
    };

    return (
        <group
            position={[x, 0, z]}
            rotation={[0, rotationY, 0]}
            userData={{ locationId: location.id, tipo: location.tipo }}
        >
            {/* Advanced Industrial Rack Frame */}

            {/* Vertical Posts (Pillars) */}
            {Array.from({ length: numModules + 1 }).map((_, i) => (
                <group key={`post-${i}`} position={[-(w / 2) + i * modWidth, trueHeight / 2, 0]}>
                    {/* Front Post */}
                    <mesh position={[0, 0, d / 2 - shelfThickness / 2]} receiveShadow castShadow>
                        <boxGeometry args={[shelfThickness, trueHeight, shelfThickness]} />
                        <meshStandardMaterial map={metalTex} color="#b0b0b0" metalness={0.6} roughness={0.4} />
                    </mesh>
                    {/* Back Post */}
                    <mesh position={[0, 0, -d / 2 + shelfThickness / 2]} receiveShadow castShadow>
                        <boxGeometry args={[shelfThickness, trueHeight, shelfThickness]} />
                        <meshStandardMaterial map={metalTex} color="#b0b0b0" metalness={0.6} roughness={0.4} />
                    </mesh>
                </group>
            ))}

            {/* Shelves (Horizontal crossbeams & platforms) */}
            {/* Loop from 0 to levels so we get a ground floor platform + 4 raised platforms */}
            {Array.from({ length: levels + 1 }).map((_, i) => (
                <group key={`shelf-${i}`} position={[0, i * levelHeight + i * shelfThickness, 0]}>
                    {/* Main platform */}
                    <mesh receiveShadow castShadow>
                        <boxGeometry args={[w, shelfThickness / 2, d]} />
                        <meshStandardMaterial map={metalTex} color="#909090" metalness={0.9} roughness={0.25} />
                    </mesh>
                    {/* Front crossbeam */}
                    <mesh position={[0, -shelfThickness / 4, d / 2 - shelfThickness / 2]} receiveShadow castShadow>
                        <boxGeometry args={[w, shelfThickness, shelfThickness]} />
                        <meshStandardMaterial map={metalTex} color="#a0a0a0" metalness={0.95} roughness={0.2} />
                    </mesh>
                    {/* Back crossbeam */}
                    <mesh position={[0, -shelfThickness / 4, -d / 2 + shelfThickness / 2]} receiveShadow castShadow>
                        <boxGeometry args={[w, shelfThickness, shelfThickness]} />
                        <meshStandardMaterial map={metalTex} color="#a0a0a0" metalness={0.95} roughness={0.2} />
                    </mesh>
                </group>
            ))}

            {/* Content Slots mapped from data */}
            {renderSlots()}

        </group>
    );
};
