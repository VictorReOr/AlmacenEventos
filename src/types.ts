
export type Programa = string; // Was strict union, now dynamic

export const PROGRAM_COLORS: Record<string, string> = {
  'Mentor 10': '#FFB74D', // Orange
  'Liga LED': '#81C784',  // Green
  'Liga M100': '#64B5F6', // Blue
  'Otros': '#E57373',     // Red
  'Vacio': '#E0E0E0'      // Grey
};

// --- INVENTORY TYPES ---

export interface Material {
  id: string;
  nombre: string;
  cantidad: number;
  unidad?: string; // e.g., 'uds', 'kg', 'cajas'
}

export interface Caja {
  id: string;
  nombre: string; // e.g., "Caja 1", "Pack A"
  contenido: Material[];
}

export type ItemInventario = Material | Caja;

export interface NivelEstanteria {
  nivel: 1 | 2 | 3 | 4;
  items: ItemInventario[];
}

export interface Ubicacion {
  id: string;      // "1", "2", ...
  tipo: 'palet' | 'estanteria_modulo' | 'zona_carga' | 'puerta' | 'muro';
  programa: Programa;
  contenido: string;

  // Physical Properties
  x: number;       // Meters (User Coords)
  y: number;       // Meters (User Coords)
  rotation: number;// Degrees (0-360)
  width: number;   // Meters (X-size usually)
  depth: number;   // Meters (Y-size usually)

  // Extended Data
  cantidad?: number;
  notas?: string;

  // RELATIONAL INVENTORY (New Standard)
  items?: InventoryItem[]; // For Pallets: items directly on it

  // Key: "M{module}-A{level}" (e.g. "M1-A1") -> Value: List of items
  shelfItems?: Record<string, InventoryItem[]>;

  // Legacy (Deprecated)
  shelfContents?: Record<string, string>; // Checking if we can migrate this to items with ID "E1-M1-A1"
  niveles?: NivelEstanteria[];
  estanteriaId?: number;
  mensaje?: string;
}

export interface InventoryItem {
  id: string; // UUID or random ID
  tipo: 'Caja' | 'Material';
  contenido: string; // "Balones Nike"
  cantidad: number; // 1
  programa: string; // "Liga LED"
}

export interface AlmacenState {
  ubicaciones: Record<string, Ubicacion>;
  geometry: { x: number; y: number }[];
}
