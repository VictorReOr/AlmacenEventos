export type Programa = string; // Was strict union, now dynamic

export const PROGRAM_COLORS: Record<string, string> = {
  'Mentor 10': '#003366', // Azul Marino Oscuro
  'Liga LED': '#FFFF00',  // Amarillo Puro
  'Liga M100': '#4CAF50', // Verde Andalucía claro
  'Otros': '#E57373',     // Red
  'Vacio': '#E0E0E0'      // Grey
};

// --- SOLID BASE MODEL TYPES ---

// 3. CONTENIDO
export interface Material {
  id: string; // "m1", "m2"
  nombre: string; // "Balones Nike"
  // Catalog info, not inventory
}

export interface MaterialEnCaja {
  id: string; // Unique ID for this record
  materialId: string; // Ref to Material catalog (optional for now, can use name)
  nombre: string; // Copied for display speed
  cantidad: number;
  estado: 'operativo' | 'prestamo' | 'baja';
  programa?: string; // Derived from LOTE for granular coloring
}

// 2. CONTENEDORES
export interface Caja {
  id: string; // "C-1023"
  descripcion: string; // "Caja de Balones"
  programa: string;
  contenido: MaterialEnCaja[];
  cantidad?: number; // Added for grouped display (e.g. "x8 boxes")
  tipoContenedor?: 'Caja' | 'Suelto';
}

// 1. ESTRUCTURA FISICA & UBICACIONES
export interface Ubicacion {
  id: string;
  tipo: 'palet' | 'estanteria_modulo' | 'zona_carga' | 'puerta' | 'muro';
  programa: Programa;
  contenido: string; // Human readable label

  // Physical Properties
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;

  // --- NEW STRICT STRUCTURE ---

  // For Pallets => List of Boxes
  cajas?: Caja[];

  // For Shelves => Matrix of Boxes
  // Key: "M{module}-A{level}" (e.g. "M1-A1") -> Box (0 or 1)
  // We can treat shelves as having specific slots.
  // To keep compatibility with Map rendering loop, we just need a way to look up content.
  // Let's use `cajasEstanteria` map.
  cajasEstanteria?: Record<string, Caja>;

  // For loose materials (not in boxes) on Pallets
  materiales?: MaterialEnCaja[];


  // Legacy/Optional props to be cleaned up or kept for UI helpers
  notas?: string;

  // Shelf Specific Properties
  estanteriaId?: number;
  mensaje?: string;
  niveles?: {
    nivel: number;
    items: Caja[];
  }[];

  // Index signature to allow for legacy/nested properties
  [key: string]: any;
}

// State Wrapper
export interface AlmacenState {
  ubicaciones: Record<string, Ubicacion>;
  geometry: { x: number; y: number }[];
}
