import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CrosshairRaycasterProps {
    solidsRef: React.RefObject<THREE.Group>;
    onAim: (payload: { id: string; tipo: string; cajas?: any[]; programa?: string } | null) => void;
}

export const CrosshairRaycaster: React.FC<CrosshairRaycasterProps> = ({ solidsRef, onAim }) => {
    const { camera } = useThree();
    const lastHitId = useRef<string | null>(null);
    const raycaster = useRef(new THREE.Raycaster());

    useFrame(() => {
        if (!solidsRef?.current) return;

        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        raycaster.current.set(camera.position, dir);
        raycaster.current.far = 8;
        raycaster.current.params.Line = { threshold: 0 };

        const hits = raycaster.current.intersectObject(solidsRef.current, true);

        let hit: THREE.Intersection | null = null;
        for (const h of hits) {
            if (h.object.type !== 'LineSegments' && h.object.type !== 'Points') {
                hit = h;
                break;
            }
        }

        if (!hit) {
            if (lastHitId.current !== null) {
                lastHitId.current = null;
                onAim(null);
            }
            return;
        }

        // Walk up object hierarchy to find userData with locationId
        let obj: THREE.Object3D | null = hit.object;
        let locationData: any = null;
        while (obj) {
            if (obj.userData?.locationId) {
                locationData = obj.userData;
                break;
            }
            obj = obj.parent;
        }

        const hitId = locationData?.locationId ?? hit.object.uuid;
        if (hitId !== lastHitId.current) {
            lastHitId.current = hitId;
            onAim(locationData ? {
                id: locationData.locationId,
                tipo: locationData.tipo,
                cajas: locationData.cajas,
                programa: locationData.programa,
            } : null);
        }
    });

    return null;
};
