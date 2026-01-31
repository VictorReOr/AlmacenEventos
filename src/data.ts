import type { Ubicacion, Caja } from './types';
import { INITIAL_INVENTORY_UPDATES } from './initialInventory';

export const SHELF_MODULE_WIDTH = 1.0;
export const SHELF_DEPTH = 0.45;

const generateDummyBox = (id: string, program: string): Caja => {
    return {
        id: `BOX-${id}-${Math.floor(Math.random() * 1000)}`,
        descripcion: `Caja ${id}`,
        programa: program,
        contenido: [
            { id: crypto.randomUUID(), materialId: 'm1', nombre: 'Material Genérico', cantidad: 5, estado: 'operativo' }
        ]
    };
};

export const generateInitialState = (): { ubicaciones: Record<string, Ubicacion>, geometry: { x: number; y: number }[] } => {

    const geometryFinal = [
        { "x": 0, "y": 0 },
        { "x": 8.15, "y": 0 },
        { "x": 10.123777578084171, "y": 26.945009114327945 },
        { "x": -0.8602329973537217, "y": 27.000000000000004 }
    ];


    const ubicaciones: Record<string, Ubicacion> = {
        "1": {
            "id": "1",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "1",
            "x": 0.294545,
            "y": 14.299999999999999,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "2": {
            "id": "2",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "2",
            "x": 0.3248025,
            "y": 13.35,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "3": {
            "id": "3",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "3",
            "x": 0.35506,
            "y": 12.399999999999999,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "4": {
            "id": "4",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "4",
            "x": 0.3853175,
            "y": 11.45,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "5": {
            "id": "5",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "5",
            "x": 0.41557499999999997,
            "y": 10.5,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "6": {
            "id": "6",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "6",
            "x": 0.4458325,
            "y": 9.549999999999999,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "7": {
            "id": "7",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "7",
            "x": 0.47608999999999996,
            "y": 8.6,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "8": {
            "id": "8",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "8",
            "x": 0.5063475,
            "y": 7.6499999999999995,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "9": {
            "id": "9",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "9",
            "x": 0.536605,
            "y": 6.699999999999999,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "10": {
            "id": "10",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "10",
            "x": 0.5668625,
            "y": 5.75,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "11": {
            "id": "11",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "11",
            "x": 0.59712,
            "y": 4.8,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "12": {
            "id": "12",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "12",
            "x": 0.6273775,
            "y": 3.8499999999999996,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "13": {
            "id": "13",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "13",
            "x": 0.657635,
            "y": 2.9,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "14": {
            "id": "14",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "14",
            "x": 0.6878925,
            "y": 1.95,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "15": {
            "id": "15",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "15",
            "x": 0.71815,
            "y": 1,
            "rotation": 88.18,
            "width": 0.8,
            "depth": 1.2
        },
        "16": {
            "id": "16",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "16",
            "x": 2.29,
            "y": 0.85,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "17": {
            "id": "17",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "17",
            "x": 4.065,
            "y": 0.85,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "18": {
            "id": "18",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "18",
            "x": 5.949999999999999,
            "y": 0.85,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "19": {
            "id": "19",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "19",
            "x": 7.473125,
            "y": 1,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "20": {
            "id": "20",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "20",
            "x": 7.54259375,
            "y": 1.95,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "21": {
            "id": "21",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "21",
            "x": 7.6120625,
            "y": 2.9,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "22": {
            "id": "22",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "22",
            "x": 7.681531250000001,
            "y": 3.8499999999999996,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "23": {
            "id": "23",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "23",
            "x": 7.751000000000001,
            "y": 4.8,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "24": {
            "id": "24",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "24",
            "x": 7.82046875,
            "y": 5.75,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "25": {
            "id": "25",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "25",
            "x": 7.8899375,
            "y": 6.699999999999999,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "26": {
            "id": "26",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "26",
            "x": 7.959406250000001,
            "y": 7.6499999999999995,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "27": {
            "id": "27",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "27",
            "x": 8.028875000000001,
            "y": 8.6,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "28": {
            "id": "28",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "28",
            "x": 8.09834375,
            "y": 9.549999999999999,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "29": {
            "id": "29",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "29",
            "x": 8.1678125,
            "y": 10.5,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "30": {
            "id": "30",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "30",
            "x": 8.23728125,
            "y": 11.45,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "31": {
            "id": "31",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "31",
            "x": 8.306750000000001,
            "y": 12.399999999999999,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "32": {
            "id": "32",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "32",
            "x": 8.37621875,
            "y": 13.35,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "33": {
            "id": "33",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "33",
            "x": 8.4456875,
            "y": 14.299999999999999,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "34": {
            "id": "34",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "34",
            "x": 8.51515625,
            "y": 15.25,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "35": {
            "id": "35",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "35",
            "x": 8.584625,
            "y": 16.2,
            "rotation": 94.18,
            "width": 0.8,
            "depth": 1.2
        },
        "36": {
            "id": "36",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "36",
            "x": 3.4,
            "y": 4,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "37": {
            "id": "37",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "37",
            "x": 3.4,
            "y": 4.95,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "38": {
            "id": "38",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "38",
            "x": 3.4,
            "y": 5.9,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "39": {
            "id": "39",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "39",
            "x": 3.4,
            "y": 6.85,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "40": {
            "id": "40",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "40",
            "x": 3.4,
            "y": 7.8,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "41": {
            "id": "41",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "41",
            "x": 3.4,
            "y": 8.75,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "42": {
            "id": "42",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "42",
            "x": 3.4,
            "y": 9.7,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "43": {
            "id": "43",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "43",
            "x": 3.4,
            "y": 10.649999999999999,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "44": {
            "id": "44",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "44",
            "x": 3.4,
            "y": 11.6,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "45": {
            "id": "45",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "45",
            "x": 3.4,
            "y": 12.549999999999999,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "46": {
            "id": "46",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "46",
            "x": 3.4,
            "y": 13.5,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "47": {
            "id": "47",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "47",
            "x": 3.4,
            "y": 14.45,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "48": {
            "id": "48",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "48",
            "x": 3.4,
            "y": 15.399999999999999,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "49": {
            "id": "49",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "49",
            "x": 3.4,
            "y": 16.35,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "50": {
            "id": "50",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "50",
            "x": 3.4,
            "y": 17.299999999999997,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "51": {
            "id": "51",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "51",
            "x": 3.4,
            "y": 18.25,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "52": {
            "id": "52",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "52",
            "x": 4.6,
            "y": 18.25,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "53": {
            "id": "53",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "53",
            "x": 4.6,
            "y": 17.299999999999997,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "54": {
            "id": "54",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "54",
            "x": 4.6,
            "y": 16.35,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "55": {
            "id": "55",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "55",
            "x": 4.6,
            "y": 15.399999999999999,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "56": {
            "id": "56",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "56",
            "x": 4.6,
            "y": 14.45,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "57": {
            "id": "57",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "57",
            "x": 4.6,
            "y": 13.5,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "58": {
            "id": "58",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "58",
            "x": 4.6,
            "y": 12.549999999999999,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "59": {
            "id": "59",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "59",
            "x": 4.6,
            "y": 11.6,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "60": {
            "id": "60",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "60",
            "x": 4.6,
            "y": 10.649999999999999,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "61": {
            "id": "61",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "61",
            "x": 4.6,
            "y": 9.7,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "62": {
            "id": "62",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "62",
            "x": 4.6,
            "y": 8.75,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "63": {
            "id": "63",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "63",
            "x": 4.6,
            "y": 7.8,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "64": {
            "id": "64",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "64",
            "x": 4.6,
            "y": 6.85,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "65": {
            "id": "65",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "65",
            "x": 4.6,
            "y": 5.9,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "66": {
            "id": "66",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "66",
            "x": 4.6,
            "y": 4.95,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },
        "67": {
            "id": "67",
            "tipo": "palet",
            "programa": "Vacio",
            "contenido": "67",
            "x": 4.6,
            "y": 4.95,
            "rotation": 90,
            "width": 0.8,
            "depth": 1.2
        },

        "E2": {
            "id": "E2",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E2",
            "x": 4.29,
            "y": 23.86,
            "rotation": 90,
            "width": 6,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 2 (6 Módulos)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                },
                {
                    "nivel": 3,
                    "items": []
                },
                {
                    "nivel": 4,
                    "items": []
                }
            ]
        },
        "E3": {
            "id": "E3",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E3",
            "x": 1.7690225707348484,
            "y": 23.88689312948991,
            "rotation": 90,
            "width": 6,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 3 (6 Módulos)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                },
                {
                    "nivel": 3,
                    "items": []
                },
                {
                    "nivel": 4,
                    "items": []
                }
            ]
        },
        "E1": {
            "id": "E1",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E1",
            "x": 6.26,
            "y": 24.91,
            "rotation": 90,
            "width": 3,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 1 (3M)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                },
                {
                    "nivel": 3,
                    "items": []
                },
                {
                    "nivel": 4,
                    "items": []
                }
            ]
        },
        "E7": {
            "id": "E7",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E7",
            "x": 0.54,
            "y": 26.64,
            "rotation": 0,
            "width": 2,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 7 (2 Módulos)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                },
                {
                    "nivel": 3,
                    "items": []
                },
                {
                    "nivel": 4,
                    "items": []
                }
            ]
        },
        "E6": {
            "id": "E6",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E6",
            "x": 3.005194751497788,
            "y": 26.635941657732552,
            "rotation": 0,
            "width": 2,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 6 (2 Módulos)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                },
                {
                    "nivel": 3,
                    "items": []
                },
                {
                    "nivel": 4,
                    "items": []
                }
            ]
        },
        "E5": {
            "id": "E5",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E5",
            "x": 5.55,
            "y": 26.63,
            "rotation": 0,
            "width": 2,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 5 (2 Módulos)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                },
                {
                    "nivel": 3,
                    "items": []
                },
                {
                    "nivel": 4,
                    "items": []
                }
            ]
        },
        "E8": {
            "id": "E8",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E8",
            "x": -0.17,
            "y": 24.65,
            "rotation": 358,
            "width": 1,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 8 (1 Módulo)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                }
            ]
        },
        "E4a": {
            "id": "E4a",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E4a",
            "x": -0.49,
            "y": 25.9,
            "rotation": 87.88,
            "width": 2,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 4a (2 Módulos)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                },
                {
                    "nivel": 3,
                    "items": []
                },
                {
                    "nivel": 4,
                    "items": []
                }
            ]
        },
        "E4b": {
            "id": "E4b",
            "tipo": "estanteria_modulo",
            "programa": "Vacio",
            "contenido": "E4b",
            "x": -0.35,
            "y": 21.4,
            "rotation": 88.18,
            "width": 6,
            "depth": 0.45,
            "estanteriaId": 0,
            "mensaje": "Estantería 4b (6 Módulos)",
            "niveles": [
                {
                    "nivel": 1,
                    "items": []
                },
                {
                    "nivel": 2,
                    "items": []
                },
                {
                    "nivel": 3,
                    "items": []
                },
                {
                    "nivel": 4,
                    "items": []
                }
            ]
        },
        "van_v3": {
            "id": "van_v3",
            "tipo": "zona_carga",
            "programa": "Otros",
            "contenido": "Reparto",
            "x": 8.12,
            "y": 20.8,
            "width": 4.971,
            "depth": 1.94,
            "rotation": 94.67
        },
        "door_v3": {
            "id": "door_v3",
            "tipo": "puerta",
            "programa": "Otros",
            "contenido": "",
            "x": 8.35,
            "y": 27,
            "width": 3.3,
            "depth": 0.2,
            "rotation": 0
        },
        "muro_pared_entrada": {
            "id": "muro_pared_entrada",
            "tipo": "muro",
            "programa": "Vacio",
            "contenido": "",
            "x": 6.6,
            "y": 25.22,
            "width": 0.2,
            "depth": 3.56,
            "rotation": 0,
            "estanteriaId": 999,
            "niveles": []
        }
    };

    // --- DATA MIGRATION / INITIALIZATION ---
    // Populate boxes for non-empty pallets to match new Data Model
    Object.values(ubicaciones).forEach(u => {
        if (u.tipo === 'palet' && u.programa !== 'Vacio' && (!u.cajas || u.cajas.length === 0)) {
            u.cajas = [generateDummyBox(u.id, u.programa)];
        }
    });

    // --- MERGE USER INVENTORY UPDATES ---
    Object.entries(INITIAL_INVENTORY_UPDATES).forEach(([key, update]) => {
        let locationId = key;
        // Map keys if necessary (e.g. E1 -> E-1)
        // if (key === 'E1') locationId = 'E-1'; // REMOVED: We now have a real E1 shelf.

        const location = ubicaciones[locationId];
        if (!location) return;

        // Apply basic fields
        if (update.programa) location.programa = update.programa;
        if (update.contenido) location.contenido = update.contenido;

        // Apply Pallet Boxes (Box Array)
        if (update.cajas) {
            location.cajas = update.cajas;
        }

        // Apply Shelf Boxes (Custom mapping from cajasEstanteria)
        // We strip this type check for compilation if 'cajasEstanteria' isn't explicitly in Partial<Ubicacion>
        const updateAny = update as any;
        if (updateAny.cajasEstanteria) {
            Object.entries(updateAny.cajasEstanteria as Record<string, Caja | undefined>).forEach(([posKey, box]) => {
                if (!box) return;
                // Expected format: M1-A1 (Module 1, Level 1)
                // We map A1 -> Level 1 (Index 0), A2 -> Level 2 (Index 1) etc.
                const match = posKey.match(/A(\d+)/);
                if (match) {
                    const levelNum = parseInt(match[1]);
                    const levelIndex = levelNum - 1; // 0-indexed in array
                    if (location.niveles && location.niveles[levelIndex]) {
                        location.niveles[levelIndex].items.push(box);
                    }
                }
            });
        }
    });

    return { ubicaciones, geometry: geometryFinal };
};
