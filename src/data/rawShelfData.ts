export interface RawShelfItem {
    location: string;    // "E1-M1-A1"
    quantity: number;    // 1, 8, etc.
    description: string; // "Caja de 5 extintores", "Rollos de cinta..."
    program: string;     // "Andalucía", "Liga LED", "Mentor 10"
    type: string;        // "estanteria_modulo"
}

export const RAW_SHELF_DATA: RawShelfItem[] = [];
