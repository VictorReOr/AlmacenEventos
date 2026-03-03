
export interface Point { x: number; y: number; }
export interface Rect { x: number; y: number; width: number; depth: number; rotation: number; }

// --- MATEMÁTICAS BÁSICAS ---

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

// Obtener esquinas de un rectángulo rotado (Orden: Superior Izq, Superior Der, Inferior Der, Inferior Izq relativo al no rotado)
export const getCorners = (r: Rect): Point[] => {
    // x,y son el CENTRO (Estandarizado)

    // Mitades de dimensiones
    const hw = r.width / 2;
    const hd = r.depth / 2;

    // Esquinas no rotadas relativas al centro
    const corners = [
        { x: -hw, y: -hd }, // Sup Izq (TL)
        { x: hw, y: -hd },  // Sup Der (TR)
        { x: hw, y: hd },   // Inf Der (BR)
        { x: -hw, y: hd }   // Inf Izq (BL)
    ];

    return corners.map(p => rotatePoint({ x: r.x + p.x, y: r.y + p.y }, { x: r.x, y: r.y }, r.rotation));
};

// --- COLISIÓN SAT (Teorema del Eje de Separación) ---

// Proyectar polígono sobre el eje
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

// Comprobar si dos polígonos intersectan
export const polygonsIntersect = (polyA: Point[], polyB: Point[]): boolean => {
    const polygons = [polyA, polyB];
    const EPSILON = 0.015; // Permitir 1.5cm de superposición para tolerar penetración manual en esquinas

    for (let i = 0; i < polygons.length; i++) {
        const poly = polygons[i];
        for (let j = 0; j < poly.length; j++) {
            const p1 = poly[j];
            const p2 = poly[(j + 1) % poly.length];
            const normal = { x: -(p2.y - p1.y), y: p2.x - p1.x }; // Vector Normal

            const projA = project(polyA, normal);
            const projB = project(polyB, normal);

            if (projA.max <= projB.min + EPSILON || projB.max <= projA.min + EPSILON) {
                return false; // Hueco encontrado (o tocándose)
            }
        }
    }
    return true; // No hay hueco
};

// --- LÍMITES DEL ALMACÉN ---
// Definidos como Polígonos (Las normales hacia adentro estarían bien, pero solo comprobamos si el Pallet intersecta con el Polígono de la Pared)
// Para evitar salir AFUERA, podemos bien:
// 1. Definir el suelo pisable como un polígono y usar "contains".
// 2. Definir los Muros como polígonos sólidos y comprobar "intersects". -> Más fácil para la robustez.

// Necesitamos paredes con "grosor".
// Necesitamos paredes con "grosor".
// Necesitamos paredes con "grosor".
export const WALL_THICKNESS = 0.001; // Reducido a 1mm para permitir colocaciones práticamente al ras

// --- LÍMITES DEL ALMACÉN ---
// Generación Dinámica de Paredes basada en el Polígono del Suelo

// Ayudante para obtener el polígono de la pared de un segmento p1->p2
// Devuelve un rectángulo con "grosor" alrededor del segmento de la línea
const createWallFromSegment = (p1: Point, p2: Point, thickness: number): Point[] => {
    // Vector a lo largo de la pared
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return [];

    // Vector normal (normalizado)
    const nx = -dy / len;
    const ny = dx / len;

    // ¿Queremos la pared hacia "afuera" o centrada?
    // Hagámosla centrada por simplicidad, o ligeramente desplazada hacia afuera si supiéramos el orden del contorno (winding order).
    // Para las colisiones, el grosor centrado es suficientemente robusto si es bastante ancho.
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
        const p2 = floor[(i + 1) % floor.length]; // Bucle de vuelta al principio
        walls.push(createWallFromSegment(p1, p2, WALL_THICKNESS));
    }
    return walls;
};

// Paredes Estáticas (Static WALLS) eliminadas. Ahora usamos generateWallsFromFloor(geometry) en el componente.

// --- AYUDANTES DE ENCAJE (SNAPPING) ---

export interface SnapLine {
    x1: number; y1: number;
    x2: number; y2: number;
    vertical: boolean; // true = línea vertical (dibujar a lo largo de Y), false = horizontal
}

// --- LÓGICA DE ENCAJE (SNAPPING) ---

export const calculateSnap = (
    currentX: number,
    currentY: number,
    width: number,
    depth: number,
    rotation: number,
    obstacles: { x: number, y: number, width: number, depth: number, rotation: number }[],
    ignoreGap: boolean = false
) => {
    // Bordes Actuales (asumiendo que la rotación es cercana a 0 o 180 para el uso estándar de ancho/profundidad, o maneja 90)
    // Simplificado: Encajamos centro a centro, borde a borde Y borde a hueco (15cm).
    // Por simplicidad en esta versión, encajaremos:
    // 1. Centro X a Centro X
    // 2. Centro Y a Centro Y
    // 3. Bordes a Bordes
    // 4. Bordes a Bordes +/- 15cm

    const SNAP_DIST = ignoreGap ? 0.15 : 0.1; // Reducido de 0.3 a 0.15 para prevenir saltos bruscos
    const GAP = 0.15; // Hueco estándar de 15cm
    let newX = currentX;
    let newY = currentY;
    const lines: SnapLine[] = [];
    let bestRotation: number | undefined;

    // Resuelve las Dimensiones basadas en rotación (aproximación de bounding box visual)
    const isRotated = Math.abs(rotation % 180 - 90) < 5;
    const effW = isRotated ? depth : width;
    const effD = isRotated ? width : depth;

    const myEdges = {
        l: currentY - effD / 2, // Y es Horizontal (X en pantalla)
        r: currentY + effD / 2,
        t: currentX - effW / 2, // X es Vertical (Y en pantalla)
        b: currentX + effW / 2,
        cx: currentY,
        cy: currentX
    };

    const rangeY = [myEdges.l, myEdges.r, myEdges.cx]; // Checkea la Alineación Horizontal
    const rangeX = [myEdges.t, myEdges.b, myEdges.cy]; // Checkea la Alineación Vertical

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

        // Alinear Vertical Pos (X)
        if (!snappedX) {
            // Objetivos: Top, Bottom, Centro, Top-Hueco, Bottom+Hueco
            // Nota: Usar un array simple de los objetivos a los valores. 
            // Queremos el Top propio para igualar al Bottom Ajeno+Hueco, o el Bottom propio para al Top Ajeno-Hueco
            // Realmente es más fácil comprobar "Mi Borde" vs "Borde Ajeno +/- Hueco"

            let targetsX = [
                { val: obsEdges.t, type: 'edge' }, { val: obsEdges.b, type: 'edge' }, { val: obsEdges.cy, type: 'center' },
                { val: obsEdges.t - GAP, type: 'gap_before' }, { val: obsEdges.b + GAP, type: 'gap_after' }
            ];

            if (ignoreGap) {
                targetsX = targetsX.filter(t => !t.type.includes('gap'));
            }

            for (const target of targetsX) {
                // Tratar de alinear propio Top, Bottom, or Center a su Objetivo respectivo 
                // Filtrar: El centro solo alinea con Centro. Bordes/Hueco solo con Borde.

                for (const myP of rangeX) {
                    const isMyCenter = (myP === myEdges.cy);
                    if (isMyCenter && target.type !== 'center') continue;
                    if (!isMyCenter && target.type === 'center') continue;

                    if (Math.abs(myP - target.val) < SNAP_DIST) {
                        const diff = target.val - myP; // Distancia a aplicar desplazamiento
                        newX += diff;
                        snappedX = true;

                        // Lógica de Líneas
                        const minY = Math.min(myEdges.l, obsEdges.l) - 0.5;
                        const maxY = Math.max(myEdges.r, obsEdges.r) + 0.5;
                        // const color = (target.type.includes('gap')) ? '#4CAF50' : '#ff00ff'; // Verde para hueco (Gap)

                        // Guardamos las líneas, pero en WarehouseMap se renderizan con el color por defecto. 
                        // El color propuesto requeriría de extender la iterfaz Snapline, por eso lo dejaremos como por defecto.
                        // Mantendremos la línea actual por defecto por ahora.
                        lines.push({ x1: target.val, y1: minY, x2: target.val, y2: maxY, vertical: false });
                        break;
                    }
                }
                if (snappedX) break;
            }
        }

        // Alinear Vertical Horitonal (Y)
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

                        // Capturar la rotación del objetivo alineado (si se requiere)
                        // Solo si no habiamos ya registrado uno de rotacion "Mas ajustado" (?)
                        // Por el momento, lo simplificamos a: Gana el encaje más reciente.
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
    // Encajar (Snap) a los 0, 90, 180, 270 si se acerca (< 5 grados)
    const normalized = (rot % 360 + 360) % 360;
    const targets = [0, 90, 180, 270, 360];
    for (const t of targets) {
        if (Math.abs(normalized - t) < 5) return t % 360;
    }
    return rot;
};

// --- MATEMÁTICAS DE SEGMENTOS ---

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
