import React, { useEffect, useRef } from 'react';
import type { Ubicacion } from '../../types';

interface CameraPose {
    x: number;
    z: number;
    angle: number; // yaw in radians
}

interface MinimapProps {
    geometry: { x: number; y: number }[];
    locations: Record<string, Ubicacion>;
    cameraPoseRef: React.MutableRefObject<CameraPose>;
}

const MINIMAP_SIZE = 200;
const PADDING = 14;
const DRAW_AREA = MINIMAP_SIZE - PADDING * 2;

// Compute the world→canvas transform given the geometry bounding box
function computeTransform(geometry: { x: number; y: number }[]) {
    if (!geometry || geometry.length === 0) {
        return { scale: 1, offsetX: 0, offsetZ: 0 };
    }
    const xs = geometry.map(p => p.x);
    const zs = geometry.map(p => -p.y); // note: 2D Y → 3D -Z
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const scale = DRAW_AREA / Math.max(rangeX, rangeZ);
    // Center the geometry inside the draw area
    const offsetX = PADDING + (DRAW_AREA - rangeX * scale) / 2 - minX * scale;
    const offsetZ = PADDING + (DRAW_AREA - rangeZ * scale) / 2 - minZ * scale;
    return { scale, offsetX, offsetZ };
}

function worldToCanvas(wx: number, wz: number, t: ReturnType<typeof computeTransform>) {
    return {
        cx: wx * t.scale + t.offsetX,
        cy: wz * t.scale + t.offsetZ,
    };
}

export const Minimap3D: React.FC<MinimapProps> = ({ geometry, locations, cameraPoseRef }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const transformRef = useRef(computeTransform(geometry));

    // Recompute transform when geometry changes
    useEffect(() => {
        transformRef.current = computeTransform(geometry);
    }, [geometry]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            const t = transformRef.current;
            const { x: camX, z: camZ, angle: camAngle } = cameraPoseRef.current;

            // Clear
            ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

            // ── Background ───────────────────────────────────────────
            ctx.fillStyle = 'rgba(15, 30, 18, 0.88)';
            ctx.beginPath();
            ctx.roundRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE, 12);
            ctx.fill();

            // ── Warehouse floor polygon ──────────────────────────────
            if (geometry && geometry.length > 0) {
                ctx.beginPath();
                geometry.forEach((pt, i) => {
                    const { cx, cy } = worldToCanvas(pt.x, -pt.y, t);
                    if (i === 0) ctx.moveTo(cx, cy);
                    else ctx.lineTo(cx, cy);
                });
                ctx.closePath();
                ctx.fillStyle = 'rgba(40, 80, 45, 0.6)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(100, 200, 110, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // ── Locations (pallets / shelves) ────────────────────────
            Object.values(locations).forEach(loc => {
                if (!loc.x || !loc.y) return;
                if (loc.tipo === 'puerta' || loc.tipo === 'muro') return;

                const { cx, cy } = worldToCanvas(loc.x, -loc.y, t);

                let color = '#6B8F71'; // default
                if (loc.tipo === 'estanteria_modulo') color = '#4A90D9';
                else if (loc.tipo === 'zona_carga') color = '#E8A838';
                else if (loc.id?.includes('van')) color = '#E05252';
                else if (loc.tipo === 'palet') {
                    // Color by fill status
                    const hasContent = (loc.cajas && loc.cajas.length > 0) ||
                        (loc.cajasEstanteria && Object.keys(loc.cajasEstanteria).length > 0);
                    color = hasContent ? '#4CAF50' : '#546E7A';
                }

                const r = loc.tipo === 'estanteria_modulo' ? 3.5 : 2.5;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            });

            // ── Camera position ──────────────────────────────────────
            const { cx: camCx, cy: camCy } = worldToCanvas(camX, camZ, t);

            // Glow halo
            const glow = ctx.createRadialGradient(camCx, camCy, 0, camCx, camCy, 14);
            glow.addColorStop(0, 'rgba(105, 240, 174, 0.35)');
            glow.addColorStop(1, 'rgba(105, 240, 174, 0)');
            ctx.beginPath();
            ctx.arc(camCx, camCy, 14, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            // FOV cone
            const fovHalf = Math.PI / 4; // 45° each side
            const coneLen = 22;
            ctx.beginPath();
            ctx.moveTo(camCx, camCy);
            ctx.arc(camCx, camCy, coneLen, camAngle - fovHalf, camAngle + fovHalf);
            ctx.closePath();
            ctx.fillStyle = 'rgba(105, 240, 174, 0.12)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(105, 240, 174, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Direction triangle
            const triSize = 6;
            ctx.save();
            ctx.translate(camCx, camCy);
            ctx.rotate(camAngle);
            ctx.beginPath();
            ctx.moveTo(0, -triSize);
            ctx.lineTo(-triSize * 0.55, triSize * 0.65);
            ctx.lineTo(triSize * 0.55, triSize * 0.65);
            ctx.closePath();
            ctx.fillStyle = '#69F0AE';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();

            // ── Border ───────────────────────────────────────────────
            ctx.strokeStyle = 'rgba(100, 200, 110, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(0.5, 0.5, MINIMAP_SIZE - 1, MINIMAP_SIZE - 1, 12);
            ctx.stroke();

            // ── Label ────────────────────────────────────────────────
            ctx.fillStyle = 'rgba(165, 214, 167, 0.65)';
            ctx.font = '700 9px Inter, system-ui, sans-serif';
            ctx.letterSpacing = '1px';
            ctx.fillText('MINIMAPA', 10, 14);

            rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [geometry, locations, cameraPoseRef]);

    return (
        <div style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            zIndex: 20,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(100,200,110,0.3)',
            backdropFilter: 'blur(4px)',
            // Subtle pulse on first render
            animation: 'mmFadeIn 0.4s ease-out both',
        }}>
            <style>{`
                @keyframes mmFadeIn {
                    from { opacity: 0; transform: scale(0.88) translateY(8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
            <canvas
                ref={canvasRef}
                width={MINIMAP_SIZE}
                height={MINIMAP_SIZE}
                style={{ display: 'block' }}
                title="Minimapa — muestra tu posición en el almacén"
            />
        </div>
    );
};
