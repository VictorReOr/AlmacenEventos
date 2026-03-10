export type Programa = string; // Antes era una unión estricta, ahora es dinámico

export const PROGRAM_COLORS: Record<string, string> = {
  'Mentor 10': '#003366', // Azul Marino Oscuro
  'Liga LED': '#FFD600',  // Amarillo/Dorado Puro (Mejorado para dar más fuerza)
  'Liga M100': '#1B5E20', // Verde Militar Oscuro (Totalmente distinto del lima)
  'Material Deportivo': '#6A1B9A', // Morado
  'CEEDA': '#E65100',     // Naranja Sangre/Teja (Más intenso que el butano normal)
  'Señalización': '#00B8D4', // Turquesa/Cian Brillante
  'Comunicaciones': '#E91E63', // Rosa Magenta Puro
  'Andalucía': '#009739', // Verde Bandera Andalucía (Contrastará maravillosamente con M100)
  'Imagen Corporativa': '#212121', // Negro Suave
  'Otros': '#D50000',     // Rojo Carmesí Sangre Puro (Se aleja radicalmente del Magenta de Comunicaciones)
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
  labelXV?: number; // Posición manual para vista vertical
  labelYV?: number;

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
