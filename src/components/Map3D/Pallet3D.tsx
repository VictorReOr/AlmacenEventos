import React, { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Mesh } from 'three';
import { useTexture, Text } from '@react-three/drei';
import { PROGRAM_COLORS } from '../../types';
import type { Ubicacion } from '../../types';

interface Pallet3DProps {
    location: Ubicacion;
    activeFilter: string | null;
    onHover: (id: string | null, pos?: { x: number, y: number }, payload?: any) => void;
}

export const Pallet3D: React.FC<Pallet3DProps> = ({ location, activeFilter, onHover }) => {
    const meshRef = useRef<Mesh>(null);
    const [hovered, setHovered] = useState(false);

    const [woodTex, boxTex] = useTexture([
        `${import.meta.env.BASE_URL}textures/texture_wood_pallet_1773221682858.png`,
        `${import.meta.env.BASE_URL}textures/texture_corrugated_cardboard.bmp`
    ]);

    useMemo(() => {
        woodTex.wrapS = THREE.RepeatWrapping;
        woodTex.wrapT = THREE.RepeatWrapping;
        woodTex.repeat.set(2, 2);

        boxTex.wrapS = THREE.RepeatWrapping;
        boxTex.wrapT = THREE.RepeatWrapping;
        boxTex.repeat.set(1, 1);
    }, [woodTex, boxTex]);

    // Parse location data with Z-axis inversion for physical chirality match
    const x = location.x;
    const z = -location.y; // Flip Z to place Muro 4 on Left and Muro 2 on Right
    const w = location.width || 0.8;
    const d = location.depth || 1.2;
    const rotationY = location.rotation ? (-location.rotation * Math.PI) / 180 : 0;

    // Determine filtering
    let isDimmedByFilter = false;
    if (activeFilter) {
        if (activeFilter === 'Otros') {
            isDimmedByFilter = location.programa !== 'Otros';
        } else {
            const displayPrograms = location.cajas ? location.cajas.map(c => c.programa) : [location.programa];
            isDimmedByFilter = !displayPrograms.includes(activeFilter);
        }
    }

    const baseOpacity = isDimmedByFilter ? 0.15 : 1;
    const cubeOpacity = hovered ? Math.min(baseOpacity + 0.3, 1) : baseOpacity;
    const isGray = isDimmedByFilter;

    // Fixed 2 meters total height
    const TARGET_TOTAL_HEIGHT = 1.8;

    // Pallet Base (Wooden part)
    const palletHeight = 0.15;

    // Total Cargo Height (to reach exactly 2m from the ground)
    const cargoHeight = location.programa === 'Vacio' ? 0 : (TARGET_TOTAL_HEIGHT - palletHeight);

    // Apply a slight margin to visually separate adjacent pallets
    const margin = 0.1;
    const drawW = Math.max(0.1, w - margin);
    const drawD = Math.max(0.1, d - margin);

    // Collect all unique lot colors (programas) within this pallet
    const lotPrograms: string[] = [];
    if (location.cajas && location.cajas.length > 0) {
        location.cajas.forEach(c => {
            if (c.programa && !lotPrograms.includes(c.programa)) {
                lotPrograms.push(c.programa);
            }
        });
    } else if (location.programa) {
        lotPrograms.push(location.programa);
    }

    // Ensure we have at least one color slice if it's not empty
    if (lotPrograms.length === 0 && cargoHeight > 0) {
        lotPrograms.push('Otros');
    }

    const sliceHeight = lotPrograms.length > 0 ? (cargoHeight / lotPrograms.length) : 0;


    return (
        <group
            position={[x, 0, z]}
            rotation={[0, rotationY, 0]}
            userData={{ locationId: location.id, tipo: location.tipo, programa: location.programa, cajas: location.cajas }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
                document.body.style.cursor = 'pointer';
                // We use standard React synthetic event coordinates for the 2D HTML tooltip overlay
                onHover(location.id, { x: e.clientX, y: e.clientY }, location);
            }}
            onPointerOut={(e) => {
                e.stopPropagation();
                setHovered(false);
                document.body.style.cursor = 'auto';
                onHover(null);
            }}
        >
            {/* Wooden Base */}
            <mesh position={[0, palletHeight / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[drawW, palletHeight, drawD]} />
                <meshStandardMaterial map={woodTex} color={isGray ? '#555555' : '#D2B48C'} transparent opacity={baseOpacity} roughness={0.9} />
                {/* Front Text */}
                <Text
                    position={[0, 0, drawD / 2 + 0.002]}
                    fontSize={0.12}
                    color="#5c3a21" // Warm burnt brown
                    outlineWidth={0.005}
                    outlineColor="#3a2010" // Darker burnt edge
                    fontWeight="bold"
                    anchorX="center"
                    anchorY="middle"
                >
                    {location.id}
                </Text>
                {/* Back Text */}
                <Text
                    position={[0, 0, -drawD / 2 - 0.002]}
                    rotation={[0, Math.PI, 0]}
                    fontSize={0.12}
                    color="#5c3a21"
                    outlineWidth={0.005}
                    outlineColor="#3a2010"
                    fontWeight="bold"
                    anchorX="center"
                    anchorY="middle"
                >
                    {location.id}
                </Text>
                {/* Left Text */}
                <Text
                    position={[-drawW / 2 - 0.002, 0, 0]}
                    rotation={[0, -Math.PI / 2, 0]}
                    fontSize={0.12}
                    color="#5c3a21"
                    outlineWidth={0.005}
                    outlineColor="#3a2010"
                    fontWeight="bold"
                    anchorX="center"
                    anchorY="middle"
                >
                    {location.id}
                </Text>
                {/* Right Text */}
                <Text
                    position={[drawW / 2 + 0.002, 0, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                    fontSize={0.12}
                    color="#5c3a21"
                    outlineWidth={0.005}
                    outlineColor="#3a2010"
                    fontWeight="bold"
                    anchorX="center"
                    anchorY="middle"
                >
                    {location.id}
                </Text>
            </mesh>

            {/* Goods block (Sliced by Lot Colors) */}
            {cargoHeight > 0 && lotPrograms.map((prog, index) => {
                const sliceColor = PROGRAM_COLORS[prog] || PROGRAM_COLORS['Otros'];
                const sliceYCenter = palletHeight + (index * sliceHeight) + (sliceHeight / 2);

                return (
                    <group key={index} position={[0, sliceYCenter, 0]}>
                        <mesh castShadow receiveShadow ref={index === 0 ? meshRef : null}>
                            <boxGeometry args={[drawW * 0.95, sliceHeight, drawD * 0.95]} />
                            <meshStandardMaterial
                                map={boxTex}
                                color={isGray ? '#777777' : '#ffffff'}
                                transparent
                                opacity={cubeOpacity}
                                emissive={hovered && !isGray ? sliceColor : '#000000'}
                                emissiveIntensity={hovered ? 0.3 : 0}
                                roughness={0.9}
                            />
                            <lineSegments>
                                <edgesGeometry args={[new THREE.BoxGeometry(drawW * 0.95, sliceHeight, drawD * 0.95)]} />
                                <lineBasicMaterial color="#5C3317" transparent opacity={cubeOpacity} />
                            </lineSegments>
                        </mesh>

                        {/* Color Stickers mapping the program lot visually onto the true cardboard */}
                        {!isGray && (
                            <>
                                {/* Front Sticker */}
                                <mesh position={[0, 0, (drawD * 0.95) / 2 + 0.005]}>
                                    <planeGeometry args={[drawW * 0.6, sliceHeight * 0.5]} />
                                    <meshBasicMaterial color={sliceColor} transparent opacity={cubeOpacity} />
                                </mesh>
                                {/* Back Sticker */}
                                <mesh position={[0, 0, -(drawD * 0.95) / 2 - 0.005]} rotation={[0, Math.PI, 0]}>
                                    <planeGeometry args={[drawW * 0.6, sliceHeight * 0.5]} />
                                    <meshBasicMaterial color={sliceColor} transparent opacity={cubeOpacity} />
                                </mesh>
                                {/* Top Sticker (Useful for Orbit view down) */}
                                {index === lotPrograms.length - 1 && (
                                    <mesh position={[0, sliceHeight / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                        <planeGeometry args={[drawW * 0.8, drawD * 0.8]} />
                                        <meshBasicMaterial color={sliceColor} transparent opacity={cubeOpacity * 0.8} />
                                    </mesh>
                                )}
                            </>
                        )}
                    </group>
                );
            })}
        </group>
    );
};
