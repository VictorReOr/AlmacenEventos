import React, { Suspense, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useTexture, SoftShadows } from '@react-three/drei';
import type { Ubicacion } from '../../types';
import { Pallet3D } from './Pallet3D';
import { Shelf3D } from './Shelf3D';
import { Van3D } from './Van3D';
import { FPSControls } from './FPSControls';
import { Minimap3D } from './Minimap3D';
import { CrosshairRaycaster } from './CrosshairRaycaster';
import * as THREE from 'three';

interface WarehouseMap3DProps {
    locations: Record<string, Ubicacion>;
    activeFilter: string | null;
    geometry: { x: number; y: number }[];
    onHover: (id: string | null, pos?: { x: number, y: number }, locationData?: any) => void;
}

const FloorAndWalls = ({ geometry, solidsRef, cameraMode, setClickTarget }: any) => {
    const floorTexture = useTexture(`${import.meta.env.BASE_URL}textures/texture_concrete_floor_1773221698115.png`);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(15, 15);

    const wallTexture = useTexture(`${import.meta.env.BASE_URL}textures/texture_light_stucco.png`);
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(4, 1);

    // Procedural corrugated metal texture (no external file needed)
    const roofTexture = React.useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        const numRidges = 8;
        const ridgeH = canvas.height / numRidges;
        ctx.fillStyle = '#a8b4bc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < numRidges; i++) {
            const y = i * ridgeH;
            const grad = ctx.createLinearGradient(0, y, 0, y + ridgeH);
            grad.addColorStop(0,    'rgba(220,230,235,0.95)');
            grad.addColorStop(0.25, 'rgba(240,248,255,1.0)');
            grad.addColorStop(0.5,  'rgba(170,185,195,0.95)');
            grad.addColorStop(0.75, 'rgba(130,145,155,0.9)');
            grad.addColorStop(1,    'rgba(160,175,185,0.85)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, y, canvas.width, ridgeH);
            // thin highlight on ridge peak
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillRect(0, y + ridgeH * 0.2, canvas.width, 2);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(6, 2);
        return tex;
    }, []);

    // The A logo of Junta de Andalucia
    const juntaLogo = useTexture(`${import.meta.env.BASE_URL}junta_a.svg`);

    // Calculate bounding box for the floor
    let minX = 0, maxX = 10;
    let minZ = 0, maxZ = 10;

    if (geometry && geometry.length > 0) {
        minX = Math.min(...geometry.map((p: any) => p.x));
        maxX = Math.max(...geometry.map((p: any) => p.x));
        minZ = Math.min(...geometry.map((p: any) => -p.y)); // Note: Z is inverted Y
        maxZ = Math.max(...geometry.map((p: any) => -p.y));
    }

    const margin = 4; // 2 meters on each side
    const floorWidth = (maxX - minX) + margin;
    const floorDepth = (maxZ - minZ) + margin;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    floorTexture.repeat.set(floorWidth / 4, floorDepth / 4); // Scale texture tiling with floor size

    return (
        <group ref={solidsRef}>
            {/* Infinity Outer Floor to prevent dark void */}
            <mesh
                receiveShadow
                rotation={[-Math.PI / 2, 0, 0]}
                position={[centerX, -0.02, centerZ]}
                onClick={(e) => {
                    // Prevenir que clics fuera del almacén hagan cosas raras
                    e.stopPropagation();
                }}
            >
                <planeGeometry args={[1000, 1000]} />
                {/* Lighter color for the "outside" world */}
                <meshStandardMaterial color="#c8d6e5" roughness={1} metalness={0} />
            </mesh>

            {/* Ground Plane: Catch double clicks to walk */}
            <mesh
                receiveShadow
                rotation={[-Math.PI / 2, 0, 0]}
                position={[centerX, -0.01, centerZ]}
                onDoubleClick={(e) => {
                    if (cameraMode === 'fps') {
                        e.stopPropagation();
                        setClickTarget(e.point);
                    }
                }}
                onContextMenu={(e) => {
                    if (cameraMode === 'fps') {
                        e.stopPropagation();
                        setClickTarget(e.point);
                    }
                }}
            >
                <planeGeometry args={[floorWidth, floorDepth]} />
                <meshStandardMaterial map={floorTexture} roughness={0.8} metalness={0.1} />
            </mesh>

            {/* Junta de Andalucia Brand Logo on the floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.005, centerZ]}>
                <planeGeometry args={[6, 6]} />
                <meshBasicMaterial map={juntaLogo} transparent opacity={0.6} depthWrite={false} color="#ffffff" />
            </mesh>

            {/* Perimeter Walls mapped from data.ts geometryFinal */}
            {geometry && geometry.length > 0 && (
                <group>
                    {geometry.map((pt: any, i: number) => {
                        const nextPt = geometry[(i + 1) % geometry.length];
                        const ptX = pt.x; const ptZ = -pt.y;
                        const nextPtX = nextPt.x; const nextPtZ = -nextPt.y;
                        const dx = nextPtX - ptX; const dz = nextPtZ - ptZ;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        const angle = Math.atan2(dz, dx);
                        let textAngle = -angle;
                        if (i === 0 || i === 1 || i === 2) textAngle += Math.PI;

                        const cx = ptX + dx / 2;
                        const cz = ptZ + dz / 2;
                        const wallHeight = 4;
                        const wallThickness = 0.2;

                        return (
                            <group key={`wall-${i}`}>
                                <mesh position={[cx, wallHeight / 2, cz]} rotation={[0, -angle, 0]} receiveShadow castShadow>
                                    <boxGeometry args={[dist, wallHeight, wallThickness]} />
                                    {/* Light stucco texture for walls */}
                                    <meshStandardMaterial map={wallTexture} color="#E8E8E8" roughness={0.9} />
                                </mesh>
                            </group>
                        );
                    })}
                </group>
            )}

            {/* === Gabled Metal Roof (techo a 2 aguas) === */}
            {(() => {
                const wallH = 4;           // wall height
                const ridgeH = 2;          // ridge rises 2m above walls → peak at y=6
                const halfW = floorWidth / 2;
                const panelLen = Math.sqrt(halfW * halfW + ridgeH * ridgeH);
                const slopeAngle = Math.atan2(ridgeH, halfW);
                const panelMidY = wallH + ridgeH / 2;
                const thickness = 0.08;

                // Corrugated galvanized steel - procedural bright silver
                const roofMat = <meshStandardMaterial
                    map={roofTexture}
                    roughness={0.5}
                    metalness={0.4}
                    emissive="#263238"
                    emissiveIntensity={0.08}
                    side={THREE.DoubleSide}
                />;

                // Triangle shape for the gable ends (front and back gaps)
                const shape = new THREE.Shape();
                shape.moveTo(-halfW, 0);
                shape.lineTo(0, ridgeH);
                shape.lineTo(halfW, 0);
                shape.lineTo(-halfW, 0);
                const extrudeSettings = { depth: 0.2, bevelEnabled: false };

                return (
                    <>
                        {/* Left panel */}
                        <mesh
                            position={[centerX - halfW / 2, panelMidY, centerZ]}
                            rotation={[0, 0, slopeAngle]}
                            castShadow receiveShadow
                        >
                            <boxGeometry args={[panelLen, thickness, floorDepth + 0.4]} />
                            {roofMat}
                        </mesh>

                        {/* Right panel */}
                        <mesh
                            position={[centerX + halfW / 2, panelMidY, centerZ]}
                            rotation={[0, 0, -slopeAngle]}
                            castShadow receiveShadow
                        >
                            <boxGeometry args={[panelLen, thickness, floorDepth + 0.4]} />
                            {roofMat}
                        </mesh>

                        {/* Ridge beam */}
                        <mesh
                            position={[centerX, wallH + ridgeH - 0.05, centerZ]}
                            castShadow
                        >
                            <boxGeometry args={[0.3, 0.3, floorDepth + 0.5]} />
                            <meshStandardMaterial color="#3a4550" roughness={0.7} metalness={0.5} />
                        </mesh>

                        {/* Back Gable Triangle (closes the gap above the back wall) */}
                        <mesh position={[centerX, wallH, centerZ - floorDepth / 2]} castShadow receiveShadow>
                            <extrudeGeometry args={[shape, extrudeSettings]} />
                            <meshStandardMaterial color="#E8E8E8" roughness={0.9} />
                        </mesh>

                        {/* Front Gable Triangle (closes the gap above the front wall) */}
                        <mesh position={[centerX, wallH, centerZ + floorDepth / 2 - 0.2]} castShadow receiveShadow>
                            <extrudeGeometry args={[shape, extrudeSettings]} />
                            <meshStandardMaterial color="#E8E8E8" roughness={0.9} />
                        </mesh>
                    </>
                );
            })()}
        </group>
    );
};

export const WarehouseMap3D: React.FC<WarehouseMap3DProps> = ({
    locations,
    activeFilter,
    geometry,
    onHover
}) => {
    const [tooltipData, setTooltipData] = useState<{ id: string, x: number, y: number, payload?: any } | null>(null);

    const handleHover = (id: string | null, pos?: { x: number, y: number }, payload?: any) => {
        // Call parent
        if (onHover) onHover(id, pos, payload);

        // Update local tooltip state
        if (id && pos) {
            setTooltipData({ id, x: pos.x, y: pos.y, payload });
        } else {
            setTooltipData(null);
        }
    };

    const [cameraMode, setCameraMode] = useState<'orbit' | 'fps'>('fps');
    const [clickTarget, setClickTarget] = useState<THREE.Vector3 | null>(null);
    const [aimTarget, setAimTarget] = useState<{ id: string; tipo: string; cajas?: any[]; programa?: string } | null>(null);
    const handleAim = useCallback((data: any) => setAimTarget(data), []);

    // Ref to all physical solid geometries in the scene for collisions
    const solidsRef = React.useRef<THREE.Group>(null);

    // Shared camera pose for minimap — updated every frame from inside the Canvas (FPSControls)
    // Initialized with zeros; FPSControls writes the real position on the very first frame.
    const cameraPoseRef = React.useRef<{ x: number; z: number; angle: number }>({
        x: 0,
        z: 0,
        angle: 0,
    });

    // Calculate a safe spawn point near the edge of the warehouse instead of the center
    const fpsSpawnPosition = React.useMemo(() => {
        if (!geometry || geometry.length === 0) return new THREE.Vector3(10, 1.7, 10);
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        geometry.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minZ = Math.min(minZ, -p.y);
            maxZ = Math.max(maxZ, -p.y);
        });
        const centerX = (minX + maxX) / 2;
        // The green dot in user's minimap is at the top (minZ), so we spawn 8 meters from the top boundary
        return new THREE.Vector3(centerX, 1.7, minZ + 8);
    }, [geometry]);

    return (
        <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', position: 'relative' }} id="canvas-container">
            {/* Camera Mode UI Overlay */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                gap: '10px'
            }}>
                <button
                    onClick={() => {
                        setCameraMode('orbit');
                        setClickTarget(null);
                    }}
                    style={{
                        padding: '10px 20px',
                        background: cameraMode === 'orbit' ? '#4CAF50' : '#333',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    🚁 Modo Órbita
                </button>
                <button
                    onClick={() => setCameraMode('fps')}
                    style={{
                        padding: '10px 20px',
                        background: cameraMode === 'fps' ? '#4CAF50' : '#333',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    🚶 Modo Explorador
                </button>
            </div>

            {cameraMode === 'fps' && (
                <div style={{
                    position: 'absolute',
                    bottom: 90,
                    left: 20,
                    zIndex: 10,
                    background: 'rgba(0,0,0,0.8)',
                    color: '#ddd',
                    padding: '15px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(4px)',
                    lineHeight: '1.5'
                }}>
                    <strong>Controles:</strong><br />
                    • Haz Click en el lienzo para girar la cabeza.<br />
                    • Usa W, A, S, D para caminar.<br />
                    • Pulsa <strong>Espacio</strong> para saltar.<br />
                    • Doble Click / Click Derecho en el suelo para caminar allá automáticamente.<br />
                    • Pulsa ESC para liberar el ratón.
                </div>
            )}

            <Canvas shadows camera={{ position: [20, 20, 20], fov: 45 }}>
                <SoftShadows size={10} samples={16} focus={0.5} />
                {/* Environment & Lighting */}
                {/* Match the background color to the infinity floor to blend the horizon */}
                <color attach="background" args={['#c8d6e5']} />
                <ambientLight intensity={0.7} />
                <directionalLight
                    castShadow
                    position={[20, 30, 20]}
                    intensity={3.5}
                    shadow-bias={-0.0005}
                    shadow-mapSize={[2048, 2048]}
                    shadow-camera-left={-60}
                    shadow-camera-right={60}
                    shadow-camera-top={60}
                    shadow-camera-bottom={-60}
                />
                <Environment preset="city" />

                {/* Controls */}
                {cameraMode === 'orbit' ? (
                    <OrbitControls
                        makeDefault
                        minPolarAngle={0}
                        maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going below ground
                        enableDamping
                        dampingFactor={0.05}
                    />
                ) : (
                    <FPSControls
                        initialPosition={fpsSpawnPosition}
                        targetPosition={clickTarget}
                        onTargetReached={() => setClickTarget(null)}
                        collidablesRef={solidsRef}
                        cameraPoseRef={cameraPoseRef}
                    />
                )}

                    {/* Crosshair raycaster — only in FPS mode */}
                    {cameraMode === 'fps' && (
                        <CrosshairRaycaster solidsRef={solidsRef} onAim={handleAim} />
                    )}

                <Suspense fallback={null}>
                    {/* ENTIRE SCENE CONTENT UNDER SOLIDSREF FOR COLLISIONS */}
                    <group ref={solidsRef}>
                        <FloorAndWalls geometry={geometry} cameraMode={cameraMode} setClickTarget={setClickTarget} />

                        <group>
                            {Object.entries(locations).map(([id, loc]) => {
                            if (loc.tipo === 'estanteria_modulo') {
                                return <Shelf3D key={id} location={loc} activeFilter={activeFilter} onHover={handleHover} />;
                            } else if (id.includes('van') || loc.contenido === 'van_v3') {
                                return <Van3D key={id} location={loc} onHover={handleHover} />;
                            } else if (loc.tipo === 'palet' || loc.tipo === 'zona_carga') {
                                return <Pallet3D key={id} location={loc} activeFilter={activeFilter} onHover={handleHover} />;
                            } else if (loc.tipo === 'puerta') {
                                // Snap door to nearest wall to prevent z-fighting / wall clipping
                                let finalX = loc.x;
                                let finalZ = -loc.y;
                                let finalRot = -loc.rotation * (Math.PI / 180);

                                if (geometry && geometry.length > 0) {
                                    let closestDist = Infinity;
                                    for (let i = 0; i < geometry.length; i++) {
                                        const p1 = geometry[i];
                                        const p2 = geometry[(i + 1) % geometry.length];
                                        const x1 = p1.x, z1 = -p1.y;
                                        const x2 = p2.x, z2 = -p2.y;
                                        
                                        const l2 = (x2 - x1) ** 2 + (z2 - z1) ** 2;
                                        if (l2 === 0) continue;
                                        
                                        let t = ((loc.x - x1) * (x2 - x1) + (-loc.y - z1) * (z2 - z1)) / l2;
                                        t = Math.max(0, Math.min(1, t));
                                        
                                        const projX = x1 + t * (x2 - x1);
                                        const projZ = z1 + t * (z2 - z1);
                                        const dist = Math.sqrt((loc.x - projX) ** 2 + (-loc.y - projZ) ** 2);
                                        
                                        if (dist < closestDist && dist < 2.0) { // Only snap if within 2 meters
                                            closestDist = dist;
                                            finalX = projX;
                                            finalZ = projZ;
                                            finalRot = Math.atan2(z2 - z1, x2 - x1);
                                        }
                                    }
                                }

                                const w = loc.width || 3.3; // Default 3.3m wide like in data.ts
                                const d = 0.4; // frame depth (thicker than 0.2 wall)
                                const frameH = 3;
                                const frameT = 0.15; // frame thickness

                                const leafW = w / 2 - frameT;
                                const leafH = frameH - frameT;
                                const leafD = 0.35; // Thicker than the 0.2 wall to hide it completely

                                return (
                                    <group key={id} position={[finalX, 0, finalZ]} rotation={[0, -finalRot, 0]}>
                                        <group>
                                            {/* Left Frame */}
                                            <mesh position={[-w / 2 + frameT / 2, frameH / 2, 0]} castShadow receiveShadow>
                                                <boxGeometry args={[frameT, frameH, d]} />
                                                <meshStandardMaterial color="#263238" metalness={0.8} roughness={0.4} /> {/* Very dark metallic grey */}
                                            </mesh>
                                            {/* Right Frame */}
                                            <mesh position={[w / 2 - frameT / 2, frameH / 2, 0]} castShadow receiveShadow>
                                                <boxGeometry args={[frameT, frameH, d]} />
                                                <meshStandardMaterial color="#263238" metalness={0.8} roughness={0.4} />
                                            </mesh>
                                            {/* Top Frame */}
                                            <mesh position={[0, frameH - frameT / 2, 0]} castShadow receiveShadow>
                                                <boxGeometry args={[w, frameT, d]} />
                                                <meshStandardMaterial color="#263238" metalness={0.8} roughness={0.4} />
                                            </mesh>

                                            {/* Left Solid Metal Door Leaf */}
                                            <mesh position={[-w / 4 + frameT / 2 - 0.01, leafH / 2, 0]} castShadow> {/* shifted slightly left for gap */}
                                                <boxGeometry args={[leafW - 0.02, leafH, leafD]} />
                                                <meshStandardMaterial color="#90a4ae" metalness={0.7} roughness={0.4} /> {/* Steel grey */}
                                            </mesh>

                                            {/* Right Solid Metal Door Leaf */}
                                            <mesh position={[w / 4 - frameT / 2 + 0.01, leafH / 2, 0]} castShadow> {/* shifted slightly right for gap */}
                                                <boxGeometry args={[leafW - 0.02, leafH, leafD]} />
                                                <meshStandardMaterial color="#90a4ae" metalness={0.7} roughness={0.4} />
                                            </mesh>
                                            
                                            {/* Center separating line / gap shadow */}
                                            <mesh position={[0, leafH / 2, 0]} castShadow>
                                                <boxGeometry args={[0.02, leafH, leafD + 0.01]} />
                                                <meshStandardMaterial color="#1a252c" roughness={1} />
                                            </mesh>
                                            
                                            {/* Handles (Front) */}
                                            <mesh position={[-0.1, frameH / 2, leafD / 2 + 0.02]} castShadow>
                                                <boxGeometry args={[0.04, 0.4, 0.04]} />
                                                <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
                                            </mesh>
                                            <mesh position={[0.1, frameH / 2, leafD / 2 + 0.02]} castShadow>
                                                <boxGeometry args={[0.04, 0.4, 0.04]} />
                                                <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
                                            </mesh>
                                            
                                            {/* Handles (Back) */}
                                            <mesh position={[-0.1, frameH / 2, -leafD / 2 - 0.02]} castShadow>
                                                <boxGeometry args={[0.04, 0.4, 0.04]} />
                                                <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
                                            </mesh>
                                            <mesh position={[0.1, frameH / 2, -leafD / 2 - 0.02]} castShadow>
                                                <boxGeometry args={[0.04, 0.4, 0.04]} />
                                                <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
                                            </mesh>
                                        </group>
                                    </group>
                                );
                            }
                            return null;
                        })}
                    </group>
                    
                    {/* Contact Shadows removed as requested, using precise directional shadows instead */}
                    </group>
                </Suspense>
            </Canvas>

            {/* Minimap overlay — only in FPS mode */}
            {cameraMode === 'fps' && (
                <Minimap3D
                    geometry={geometry}
                    locations={locations}
                    cameraPoseRef={cameraPoseRef}
                />
            )}

            {/* Aim-target HUD — appears when crosshair points at a pallet/shelf */}
            {cameraMode === 'fps' && aimTarget && (
                <div style={{
                    position: 'absolute',
                    top: '36%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 20,
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        background: 'rgba(10, 20, 15, 0.82)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(105, 240, 174, 0.35)',
                        borderRadius: '10px',
                        padding: '10px 18px',
                        color: '#e0f5ec',
                        minWidth: '160px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#69F0AE' }}>
                            {aimTarget.id}
                        </div>
                        {aimTarget.programa && aimTarget.programa !== 'Vacio' && (
                            <div style={{ fontSize: '12px', marginTop: '4px', color: 'rgba(255,255,255,0.7)' }}>
                                📦 {aimTarget.programa}
                            </div>
                        )}
                        {aimTarget.cajas && aimTarget.cajas.length > 0 && (
                            <div style={{ fontSize: '11px', marginTop: '3px', color: 'rgba(255,255,255,0.5)' }}>
                                {aimTarget.cajas.length} caja{aimTarget.cajas.length !== 1 ? 's' : ''}
                            </div>
                        )}
                        {(!aimTarget.cajas || aimTarget.cajas.length === 0) && aimTarget.programa === 'Vacio' && (
                            <div style={{ fontSize: '12px', marginTop: '4px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                                Palet vacío
                            </div>
                        )}
                    </div>
                    <div style={{ width: '1px', height: '28px', background: 'rgba(105, 240, 174, 0.25)', margin: '0 auto' }} />
                </div>
            )}

            {/* FPS Sniper Crosshair Overlay */}
            {cameraMode === 'fps' && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.7)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 2px rgba(0,0,0,0.5)'
                }}>
                    <div style={{
                        width: '4px',
                        height: '4px',
                        backgroundColor: '#ff3333',
                        borderRadius: '50%',
                        boxShadow: '0 0 2px rgba(0,0,0,0.8)'
                    }} />
                </div>
            )}

            {/* HTML Tooltip Overlay directly ported from 2D map */}
            {tooltipData && tooltipData.payload && (
                <div
                    className="map-tooltip"
                    style={{ left: tooltipData.x, top: tooltipData.y }}
                >
                    {(() => {
                        const loc = tooltipData.payload;
                        if (loc.tipo === 'muro' || loc.tipo === 'puerta' || loc.tipo === 'zona_carga') return <div>{loc.contenido || loc.id}</div>;

                        // Recolectar datos
                        const lots = new Set<string>();
                        const progs = new Set<string>();
                        const materials = new Set<string>();
                        let totalQty = 0;
                        let labelHead = loc.id;

                        // Handle Shelves vs Pallets
                        if (loc.tipo === 'estanteria_modulo') {
                            // If the hover is a specific slot (e.g. 'E1-M1 - M1-A1'), the id has the slot info
                            labelHead = tooltipData.id;

                            // Extract the slot ID from the string, e.g., "M1-A1"
                            const parts = tooltipData.id.split(' - ');
                            const slotId = parts.length > 1 ? parts[1] : null;

                            const processCajasList = (cajaList: any) => {
                                const arr = Array.isArray(cajaList) ? cajaList : [(cajaList as any)];
                                arr.forEach((c: any) => {
                                    const anyC = c as any;
                                    if (anyC['LOTE'] || anyC['lote']) lots.add(String(anyC['LOTE'] || anyC['lote']));
                                    if (c.programa && c.programa !== 'Vacio') progs.add(c.programa);
                                    totalQty += (c.cantidad || anyC['CANTIDAD'] || 0);
                                    if (c.descripcion) materials.add(c.descripcion);
                                    if (c.contenido && Array.isArray(c.contenido)) {
                                        c.contenido.forEach((mat: any) => {
                                            if (mat.nombre) materials.add(mat.nombre);
                                        });
                                    }
                                });
                            };

                            if (slotId && loc.cajasEstanteria && loc.cajasEstanteria[slotId]) {
                                // EXACT ISOLATED SLOT DATA
                                processCajasList(loc.cajasEstanteria[slotId]);
                            } else {
                                // FALLBACK: FULL AGGREGATION
                                Object.values(loc.cajasEstanteria || {}).forEach(processCajasList);
                            }
                        } else {
                            // Palet
                            if (loc['LOTE']) lots.add(String(loc['LOTE']));
                            if (loc.programa && loc.programa !== 'Vacio') progs.add(loc.programa);
                            (loc.cajas || []).forEach((c: any) => {
                                const anyC = c as any;
                                if (anyC['LOTE'] || anyC['lote']) lots.add(String(anyC['LOTE'] || anyC['lote']));
                                if (c.programa && c.programa !== 'Vacio') progs.add(c.programa);
                                totalQty += (c.cantidad || anyC['CANTIDAD'] || 0);
                                if (c.descripcion) materials.add(c.descripcion);
                                if (c.contenido && Array.isArray(c.contenido)) {
                                    c.contenido.forEach((mat: any) => {
                                        if (mat.nombre) materials.add(mat.nombre);
                                    });
                                }
                            });

                            // For loose materials
                            if (loc.materiales && Array.isArray(loc.materiales)) {
                                loc.materiales.forEach((mat: any) => {
                                    if (mat.nombre) materials.add(mat.nombre);
                                    totalQty += (mat.cantidad || 0);
                                });
                            }
                        }

                        const lotArray = Array.from(lots);
                        const progArray = Array.from(progs);
                        const matArray = Array.from(materials);

                        return (
                            <>
                                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #ffffff40', paddingBottom: '4px', marginBottom: '8px' }}>
                                    {labelHead}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', fontSize: '13px' }}>
                                    <span className="label">Programas:</span>
                                    <span>{progArray.length > 0 ? (progArray.length > 2 ? `${progArray.length} prog.` : progArray.join(', ')) : '-'}</span>

                                    {lotArray.length > 0 && lotArray[0] !== '-' && lotArray[0] !== '' && (
                                        <>
                                            <span className="label">Lotes:</span>
                                            <span style={{ fontSize: lotArray.length > 2 ? '11px' : '13px' }}>
                                                {lotArray.length > 3 ? `${lotArray.length} lotes` : lotArray.join(', ')}
                                            </span>
                                        </>
                                    )}

                                    <span className="label">Total uds:</span>
                                    <span style={{ fontWeight: 'bold', color: '#4CAF50' }}>{totalQty > 0 ? totalQty : '-'}</span>
                                </div>

                                {matArray.length > 0 && (
                                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dotted #ffffff40', fontSize: '12px', color: '#ddd' }}>
                                        <span className="label">Contenido:</span>
                                        <div style={{ marginTop: '2px', lineHeight: 1.2 }}>
                                            {matArray.length > 3 ? `${matArray.slice(0, 3).join(', ')}... (+${matArray.length - 3})` : matArray.join(', ')}
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};
