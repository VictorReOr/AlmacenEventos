import React, { useRef, useState } from 'react';
import { Group, Shape } from 'three';
import type { Ubicacion } from '../../types';

interface Van3DProps {
    location: Ubicacion;
    onHover: (id: string | null, pos?: { x: number, y: number }, payload?: any) => void;
}

export const Van3D: React.FC<Van3DProps> = ({ location, onHover }) => {
    const groupRef = useRef<Group>(null);
    const [hovered, setHovered] = useState(false);

    // Parse location data with Z-axis inversion for physical chirality match
    const x = location.x;
    const z = -location.y; // Flip Z to place Muro 4 on Left and Muro 2 on Right
    // For van_v3, w is almost 5m and d is almost 2m.
    const w = location.width || 4.97;
    const d = location.depth || 1.94;
    const rotationY = location.rotation ? (-location.rotation * Math.PI) / 180 + Math.PI : Math.PI;

    // Dimensions
    const chassisHeight = 0.35; // Ground clearance

    const length = w * 0.95;
    const depth = d * 0.95;
    const height = 1.9; // Van height

    // Front of the van is at X = length/2, Back is at X = -length/2
    // We draw the shape from X=0 to X=length, then translate it to center.
    const shape = React.useMemo(() => {
        const s = new Shape();

        s.moveTo(0, 0); // Bottom rear
        s.lineTo(0, height * 0.9); // Straight up the back
        s.bezierCurveTo(0, height, length * 0.05, height, length * 0.1, height); // Top rear corner

        s.lineTo(length * 0.7, height); // Straight flat roof

        // Roof to windshield smooth curve
        s.bezierCurveTo(length * 0.75, height, length * 0.78, height * 0.95, length * 0.82, height * 0.85);

        // Slope down for windshield (Aerodynamic profile)
        s.lineTo(length * 0.94, height * 0.45);

        // Short, curved hood
        s.bezierCurveTo(length * 0.98, height * 0.4, length * 0.99, height * 0.3, length, height * 0.2);

        // Front bumper curving down
        s.bezierCurveTo(length, 0.05, length * 0.98, 0, length * 0.9, 0);
        s.lineTo(0, 0); // Back to bottom rear

        return s;
    }, [length, height]);

    // Compute exact Coordinates for Windshield to perfectly overlay the ExtrudeGeometry slope
    // Looking at the shape from X=0 (back) to X=length (front)
    const wsTopX = length * 0.82;
    const wsTopY = height * 0.85;
    const wsBotX = length * 0.94;
    const wsBotY = height * 0.45;

    const wsDx = wsBotX - wsTopX;
    const wsDy = wsBotY - wsTopY; // This will be negative since it drops down
    const wsLen = Math.sqrt(wsDx * wsDx + wsDy * wsDy);

    // Angle of the slope
    const wsAngle = Math.atan2(wsDy, wsDx);

    // Position of the center of the windshield relative to the mesh center
    const wsMidX = (wsTopX + wsBotX) / 2 - length / 2;
    const wsMidY = (wsTopY + wsBotY) / 2 + chassisHeight;

    const extrudeSettings = React.useMemo(() => ({
        depth: depth - 0.1, // Subtract bevel to keep overall width
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05
    }), [depth]);

    // Wheels
    const wheelRadius = 0.35;
    const wheelThickness = 0.25;
    const wheelY = wheelRadius;
    const wheelZOffset = depth / 2 + 0.02; // Push wheels out slightly

    // Front wheels X (Relative to center)
    const frontWheelX = length / 2 * 0.65;
    // Back wheels X
    const backWheelX = -length / 2 * 0.65;

    const Wheel = ({ pos }: { pos: [number, number, number] }) => (
        <group position={pos}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[wheelRadius, wheelRadius, wheelThickness, 32]} />
                <meshStandardMaterial color="#111111" roughness={0.9} />
            </mesh>
            {/* Hubcap */}
            <mesh position={[0, 0, pos[2] > 0 ? (wheelThickness / 2 + 0.01) : -(wheelThickness / 2 + 0.01)]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[wheelRadius * 0.6, wheelRadius * 0.6, 0.02, 16]} />
                <meshStandardMaterial color="#cccccc" roughness={0.2} metalness={0.8} />
            </mesh>
        </group>
    );

    // Front Headlights (yellow)
    // Straightened: only rotate on Y axis to face forward (or slightly angled for the curve)
    // Front face is roughly on X-Z plane. X is forward.
    const Headlight = ({ pos }: { pos: [number, number, number] }) => (
        <mesh position={pos} rotation={[0, Math.PI / 2, 0]} castShadow>
            <boxGeometry args={[0.2, 0.15, 0.05]} />
            <meshStandardMaterial color="#FFFFaa" emissive="#FFFF00" emissiveIntensity={1} />
        </mesh>
    );

    // Rear Taillights (red)
    const Taillight = ({ pos }: { pos: [number, number, number] }) => (
        <mesh position={pos} rotation={[0, -Math.PI / 2, 0]} castShadow>
            <boxGeometry args={[0.1, 0.6, 0.05]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.8} />
        </mesh>
    );

    // Toyota Proace Metallic Sage Green
    const bodyColor = hovered ? "#b1c4b7" : "#9db0a3";

    return (
        <group
            ref={groupRef}
            position={[x, 0, z]}
            rotation={[0, rotationY, 0]}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
                document.body.style.cursor = 'pointer';
                onHover(location.id, { x: e.clientX, y: e.clientY }, location);
            }}
            onPointerOut={(e) => {
                e.stopPropagation();
                setHovered(false);
                document.body.style.cursor = 'auto';
                onHover(null);
            }}
        >
            {/* Aerodynamic Extruded Body */}
            <mesh position={[-length / 2, chassisHeight, -depth / 2 + 0.05]} castShadow receiveShadow>
                <extrudeGeometry args={[shape, extrudeSettings]} />
                <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={0.6} />
            </mesh>

            {/* Front Grill/Bumper detailing */}
            <mesh position={[length / 2 - 0.02, chassisHeight + 0.2, 0]} rotation={[0, 0, Math.PI / 16]} castShadow>
                <boxGeometry args={[0.05, 0.4, depth * 0.8]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.5} />
            </mesh>

            {/* Rear Bumper */}
            <mesh position={[-length / 2 - 0.02, chassisHeight + 0.2, 0]} castShadow>
                <boxGeometry args={[0.05, 0.4, depth * 0.9]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.5} />
            </mesh>

            {/* Windshield Glass (dark blue/black tinted) */}
            {/* Windshield slope is mathematically calculated from the bezier endpoints */}
            <mesh position={[wsMidX, wsMidY, 0]} rotation={[0, 0, wsAngle]} castShadow>
                <boxGeometry args={[wsLen, 0.03, depth * 0.9]} />
                <meshStandardMaterial color="#0a151c" roughness={0.05} metalness={0.9} transparent opacity={0.9} />
            </mesh>

            {/* Headlights */}
            <Headlight pos={[length / 2 - 0.15, chassisHeight + height * 0.45, depth * 0.4]} />
            <Headlight pos={[length / 2 - 0.15, chassisHeight + height * 0.45, -depth * 0.4]} />

            {/* Taillights */}
            <Taillight pos={[-length / 2 + 0.02, chassisHeight + height * 0.5, depth * 0.42]} />
            <Taillight pos={[-length / 2 + 0.02, chassisHeight + height * 0.5, -depth * 0.42]} />

            {/* Wheels */}
            <Wheel pos={[frontWheelX, wheelY, wheelZOffset]} />
            <Wheel pos={[frontWheelX, wheelY, -wheelZOffset]} />
            <Wheel pos={[backWheelX, wheelY, wheelZOffset]} />
            <Wheel pos={[backWheelX, wheelY, -wheelZOffset]} />

            {/* Chassis Undercarriage */}
            <mesh position={[0, chassisHeight / 2 + 0.05, 0]} castShadow receiveShadow>
                <boxGeometry args={[length * 0.9, 0.15, depth * 0.85]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.5} />
            </mesh>
        </group>
    );
};
