
export interface Point { x: number; y: number; }
export interface Rect { x: number; y: number; width: number; depth: number; rotation: number; }

// --- CORE MATH ---

export const toRad = (deg: number) => (deg * Math.PI) / 180;

export const rotatePoint = (p: Point, center: Point, angleDeg: number): Point => {
    const rad = toRad(angleDeg);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
        x: center.x + (dx * cos - dy * sin),
        y: center.y + (dx * sin + dy * cos)
    };
};

// Get corners of a rotated rectangle (Order: TL, TR, BR, BL relative to unrotated)
export const getCorners = (r: Rect): Point[] => {
    // x,y are CENTER (Standardized)

    // Half dims
    const hw = r.width / 2;
    const hd = r.depth / 2;

    // Unrotated corners relative to center
    const corners = [
        { x: -hw, y: -hd }, // TL
        { x: hw, y: -hd },  // TR
        { x: hw, y: hd },   // BR
        { x: -hw, y: hd }   // BL
    ];

    return corners.map(p => rotatePoint({ x: r.x + p.x, y: r.y + p.y }, { x: r.x, y: r.y }, r.rotation));
};

// --- SAT COLLISION ---

// Project polygon onto axis
const project = (poly: Point[], axis: Point) => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of poly) {
        const dot = p.x * axis.x + p.y * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    return { min, max };
};

// Check if two polygons intersect
export const polygonsIntersect = (polyA: Point[], polyB: Point[]): boolean => {
    const polygons = [polyA, polyB];
    const EPSILON = 0.015; // Allow 1.5cm overlap to tolerate manual corner penetration

    for (let i = 0; i < polygons.length; i++) {
        const poly = polygons[i];
        for (let j = 0; j < poly.length; j++) {
            const p1 = poly[j];
            const p2 = poly[(j + 1) % poly.length];
            const normal = { x: -(p2.y - p1.y), y: p2.x - p1.x }; // Normal vector

            const projA = project(polyA, normal);
            const projB = project(polyB, normal);

            if (projA.max <= projB.min + EPSILON || projB.max <= projA.min + EPSILON) {
                return false; // Gap found (or touching)
            }
        }
    }
    return true; // No gap
};

// --- WAREHOUSE BOUNDARIES ---
// Defined as Polygons (Inward normals would be nice, but we just check if Pallet intersects Wall Polygon)
// To prevent going OUTSIDE, we can either:
// 1. Define the walkable floor as a polygon and check "contains".
// 2. Define Walls as solid polygons and check "intersects". -> Easier for robustness.

// We need "thick" walls.
// We need "thick" walls.
// We need "thick" walls.
export const WALL_THICKNESS = 0.001; // Reduced to 1mm to allow practically flush placement

// --- WAREHOUSE BOUNDARIES ---
// Dynamic Wall Generation based on Floor Polygon

// Helper to get wall polygon from a segment p1->p2
// Returns a "thick" rectangle around the line segment
const createWallFromSegment = (p1: Point, p2: Point, thickness: number): Point[] => {
    // Vector along wall
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return [];

    // Normal vector (normalized)
    const nx = -dy / len;
    const ny = dx / len;

    // We want the wall to be "outside" or centered?
    // Let's make it centered for simplicity, or slightly offset outward if we knew winding order.
    // For collision, centered thickness is robust enough if thick enough.
    const h = thickness / 2;

    return [
        { x: p1.x + nx * h, y: p1.y + ny * h },
        { x: p2.x + nx * h, y: p2.y + ny * h },
        { x: p2.x - nx * h, y: p2.y - ny * h },
        { x: p1.x - nx * h, y: p1.y - ny * h }
    ];
};

export const generateWallsFromFloor = (floor: Point[]): Point[][] => {
    const walls: Point[][] = [];
    for (let i = 0; i < floor.length; i++) {
        const p1 = floor[i];
        const p2 = floor[(i + 1) % floor.length]; // Loop back to start
        walls.push(createWallFromSegment(p1, p2, WALL_THICKNESS));
    }
    return walls;
};

// Static WALLS removed. Now we use generateWallsFromFloor(geometry) in the component.

// --- SNAPPING HELPERS ---

export interface SnapLine {
    x1: number; y1: number;
    x2: number; y2: number;
    vertical: boolean; // true = vertical line (draw along Y), false = horizontal
}

// --- SNAPPING LOGIC ---

export const calculateSnap = (
    currentX: number,
    currentY: number,
    width: number,
    depth: number,
    rotation: number,
    obstacles: { x: number, y: number, width: number, depth: number, rotation: number }[],
    ignoreGap: boolean = false
) => {
    // Current Edges (assuming rotation is close to 0 or 180 for standard width/depth usage, or handle 90)
    // Simplified: We snap center-to-center, edge-to-edge AND edge-to-gap (15cm).
    // For simplicity in this version, we'll snap:
    // 1. Center X to Center X
    // 2. Center Y to Center Y
    // 3. Edges to Edges
    // 4. Edges to Edges +/- 15cm

    const SNAP_DIST = ignoreGap ? 0.15 : 0.1; // Reduced from 0.3 to 0.15 to prevent jumpiness
    const GAP = 0.15; // 15cm standard gap
    let newX = currentX;
    let newY = currentY;
    const lines: SnapLine[] = [];
    let bestRotation: number | undefined;

    // Resolve Dimensions based on rotation (visual bounding box approx)
    const isRotated = Math.abs(rotation % 180 - 90) < 5;
    const effW = isRotated ? depth : width;
    const effD = isRotated ? width : depth;

    const myEdges = {
        l: currentY - effD / 2, // Y is Horizontal (Screen X)
        r: currentY + effD / 2,
        t: currentX - effW / 2, // X is Vertical (Screen Y)
        b: currentX + effW / 2,
        cx: currentY,
        cy: currentX
    };

    const rangeY = [myEdges.l, myEdges.r, myEdges.cx]; // Check Horizontal Alignment
    const rangeX = [myEdges.t, myEdges.b, myEdges.cy]; // Check Vertical Alignment

    let snappedX = false;
    let snappedY = false;

    for (const obs of obstacles) {
        const oIsRot = Math.abs(obs.rotation % 180 - 90) < 5;
        const oW = oIsRot ? obs.depth : obs.width;
        const oD = oIsRot ? obs.width : obs.depth;

        const obsEdges = {
            l: obs.y - oD / 2,
            r: obs.y + oD / 2,
            t: obs.x - oW / 2,
            b: obs.x + oW / 2,
            cx: obs.y,
            cy: obs.x
        };

        // Align Vertical Pos (X)
        if (!snappedX) {
            // Targets: Top, Bottom, Center, Top-Gap, Bottom+Gap
            // Note: Use simple array of target values. 
            // We want myTop to match obsBottom+Gap, or myBottom to match obsTop-Gap
            // Actually it's simpler to check "My Edge" vs "Target Edge +/- Gap"

            let targetsX = [
                { val: obsEdges.t, type: 'edge' }, { val: obsEdges.b, type: 'edge' }, { val: obsEdges.cy, type: 'center' },
                { val: obsEdges.t - GAP, type: 'gap_before' }, { val: obsEdges.b + GAP, type: 'gap_after' }
            ];

            if (ignoreGap) {
                targetsX = targetsX.filter(t => !t.type.includes('gap'));
            }

            for (const target of targetsX) {
                // Try to align my Top, Bottom, or Center to this Target
                // Filter: Center only aligns with Center. Edge/Gap only with Edge.

                for (const myP of rangeX) {
                    const isMyCenter = (myP === myEdges.cy);
                    if (isMyCenter && target.type !== 'center') continue;
                    if (!isMyCenter && target.type === 'center') continue;

                    if (Math.abs(myP - target.val) < SNAP_DIST) {
                        const diff = target.val - myP; // Shift needed
                        newX += diff;
                        snappedX = true;

                        // Line Logic
                        const minY = Math.min(myEdges.l, obsEdges.l) - 0.5;
                        const maxY = Math.max(myEdges.r, obsEdges.r) + 0.5;
                        // const color = (target.type.includes('gap')) ? '#4CAF50' : '#ff00ff'; // Green for Gap

                        // We store lines but currently WarehouseMap just draws them default color. 
                        // Passing color would require updating SnapLine interface or just accepting default.
                        // Let's stick to default interface for now.
                        lines.push({ x1: target.val, y1: minY, x2: target.val, y2: maxY, vertical: false });
                        break;
                    }
                }
                if (snappedX) break;
            }
        }

        // Align Horizontal Pos (Y)
        if (!snappedY) {
            let targetsY = [
                { val: obsEdges.l, type: 'edge' }, { val: obsEdges.r, type: 'edge' }, { val: obsEdges.cx, type: 'center' },
                { val: obsEdges.l - GAP, type: 'gap_before' }, { val: obsEdges.r + GAP, type: 'gap_after' }
            ];

            if (ignoreGap) {
                targetsY = targetsY.filter(t => !t.type.includes('gap'));
            }

            for (const target of targetsY) {
                for (const myP of rangeY) {
                    const isMyCenter = (myP === myEdges.cx);
                    if (isMyCenter && target.type !== 'center') continue;
                    if (!isMyCenter && target.type === 'center') continue;

                    if (Math.abs(myP - target.val) < SNAP_DIST) {
                        const diff = target.val - myP;
                        newY += diff;
                        snappedY = true;
                        const minX = Math.min(myEdges.t, obsEdges.t) - 0.5;
                        const maxX = Math.max(myEdges.b, obsEdges.b) + 0.5;
                        lines.push({ x1: minX, y1: target.val, x2: maxX, y2: target.val, vertical: true });

                        // Capture rotation of the object we snapped to (if it helps alignment)
                        // Only if we haven't already captured a "stronger" rotation?
                        // For now, simple: last snap wins.
                        bestRotation = obs.rotation;
                        break;
                    }
                }
                if (snappedY) break;
            }
        }
    }

    return { x: newX, y: newY, lines, snappedRotation: bestRotation };
};

export const snapAngle = (rot: number): number => {
    // Snap to 0, 90, 180, 270 if close (< 5 deg)
    const normalized = (rot % 360 + 360) % 360;
    const targets = [0, 90, 180, 270, 360];
    for (const t of targets) {
        if (Math.abs(normalized - t) < 5) return t % 360;
    }
    return rot;
};

// --- SEGMENT MATH ---

function sqr(x: number) { return x * x }
function dist2(v: Point, w: Point) { return sqr(v.x - w.x) + sqr(v.y - w.y) }

export const projectPointOnSegment = (p: Point, v: Point, w: Point): Point => {
    const l2 = dist2(v, w);
    if (l2 === 0) return v;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
};

export const distanceToSegment = (p: Point, v: Point, w: Point): number => {
    const proj = projectPointOnSegment(p, v, w);
    return Math.sqrt(dist2(p, proj));
};
