export type Programa = string; // Antes era una unión estricta, ahora es dinámico

export const PROGRAM_COLORS: Record<string, string> = {
  'Mentor 10': '#003366', // Azul Marino Oscuro
  'Liga LED': '#FFFF00',  // Amarillo Puro
  'Liga M100': '#4CAF50', // Verde Andalucía claro
  'Material Deportivo': '#6A1B9A', // Morado
  'CEEDA': '#FF6F00',     // Naranja
  'Señalización': '#0097A7', // Turquesa
  'Andalucía': '#8BC34A', // Verde Lima
  'Imagen Corporativa': '#212121', // Negro Suave
  'Otros': '#E57373',     // Rojo
  'Vacio': '#E0E0E0'      // Gris
};

// --- TIPOS DEL MODELO BASE SÓLIDO ---

// 3. CONTENIDO
export interface Material {
  id: string; // "m1", "m2"
  nombre: string; // "Balones Nike"
  // Información del catálogo, no del inventario
}

export interface MaterialEnCaja {
  id: string; // ID Único para este registro
  materialId: string; // Ref al catálogo de Materiales (opcional por ahora, puede usar nombre)
  nombre: string; // Copiado para velocidad de dibujado
  cantidad: number;
  estado: 'operativo' | 'prestamo' | 'baja';
  programa?: string; // Derivado del LOTE para coloreado granular
}

// 2. CONTENEDORES
export interface Caja {
  id: string; // "C-1023"
  descripcion: string; // "Caja de Balones"
  programa: string;
  contenido: MaterialEnCaja[];
  cantidad?: number; // Añadido para visualización agrupada (ej. "x8 cajas")
  tipoContenedor?: 'Caja' | 'Suelto';
}

// 1. ESTRUCTURA FÍSICA & UBICACIONES
export interface Ubicacion {
  id: string;
  tipo: 'palet' | 'estanteria_modulo' | 'zona_carga' | 'puerta' | 'muro';
  programa: Programa;
  contenido: string; // Etiqueta legible por humanos

  // Propiedades Físicas
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;

  // Propiedades de Etiqueta (Arrastre Independiente)
  labelX?: number;
  labelY?: number;
  labelRot?: number;

  // --- NUEVA ESTRUCTURA ESTRICTA ---

  // Para Palés => Lista de Cajas
  cajas?: Caja[];

  // Para Estanterías => Matriz de Cajas
  // Clave: "M{module}-A{level}" (ej. "M1-A1") -> Caja (0 o 1)
  // Podemos tratar las estanterías como poseedoras de huecos específicos.
  // Para mantener compatibilidad con el bucle de renderizado del Mapa, solo necesitamos una vía de acceso al contenido.
  // Usemos el mapa `cajasEstanteria`.
  cajasEstanteria?: Record<string, Caja>;

  // Para materiales sueltos (sin caja) en los Palés
  materiales?: MaterialEnCaja[];


  // Propiedades de Herencia/Opcionales a ser limpiadas o mantenidas para ayudas de UI
  notas?: string;

  // Propiedades Específicas de Estantería
  estanteriaId?: number;
  mensaje?: string;
  niveles?: {
    nivel: number;
    items: Caja[];
  }[];

  // Firma de índice para permitir propiedades de herencia o anidadas
  [key: string]: any;
}

// Envoltorio del Estado (State Wrapper)
export interface AlmacenState {
  ubicaciones: Record<string, Ubicacion>;
  geometry: { x: number; y: number }[];
}
