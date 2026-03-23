import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

interface FPSControlsProps {
    targetPosition?: THREE.Vector3 | null; // For click-to-move
    onTargetReached?: () => void;
    movementSpeed?: number;
    initialPosition?: THREE.Vector3; // Safe spawn point inside
    collidablesRef?: React.RefObject<THREE.Group>; // Reference to solids for collision
    cameraPoseRef?: React.MutableRefObject<{ x: number; z: number; angle: number }>; // Live camera pose for minimap
}

export const FPSControls: React.FC<FPSControlsProps> = ({
    targetPosition,
    onTargetReached,
    movementSpeed = 8,
    initialPosition,
    collidablesRef,
    cameraPoseRef,
}) => {
    const { camera } = useThree();
    const controlsRef = useRef<any>(null);
    const [keys, setKeys] = useState({ forward: false, backward: false, left: false, right: false });

    // Track manual override to cancel auto-walk
    const [manualOverride, setManualOverride] = useState(false);

    // We maintain velocity for smooth acceleration/deceleration
    const velocity = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());

    // Eye level height
    const EYE_LEVEL = 1.7;

    // Set initial position once on mount
    useEffect(() => {
        if (initialPosition) {
            camera.position.set(initialPosition.x, EYE_LEVEL, initialPosition.z);
            // Optionally look somewhere specific (e.g. forward)
            camera.lookAt(initialPosition.x, EYE_LEVEL, initialPosition.z - 10);
        }
    }, [initialPosition, camera]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW': setKeys(k => ({ ...k, forward: true })); setManualOverride(true); break;
                case 'ArrowLeft':
                case 'KeyA': setKeys(k => ({ ...k, left: true })); setManualOverride(true); break;
                case 'ArrowDown':
                case 'KeyS': setKeys(k => ({ ...k, backward: true })); setManualOverride(true); break;
                case 'ArrowRight':
                case 'KeyD': setKeys(k => ({ ...k, right: true })); setManualOverride(true); break;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW': setKeys(k => ({ ...k, forward: false })); break;
                case 'ArrowLeft':
                case 'KeyA': setKeys(k => ({ ...k, left: false })); break;
                case 'ArrowDown':
                case 'KeyS': setKeys(k => ({ ...k, backward: false })); break;
                case 'ArrowRight':
                case 'KeyD': setKeys(k => ({ ...k, right: false })); break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // When a new target is set, disable manual override so we can walk there
    useEffect(() => {
        if (targetPosition) {
            setManualOverride(false);
        }
    }, [targetPosition]);

    const checkCollision = (start: THREE.Vector3, dir: THREE.Vector3, dist: number) => {
        if (!collidablesRef?.current || dist === 0) return false;
        // Cast ray from chest level (1.2m) to collide with full pallets but step over floor bumps
        const rayOrigin = start.clone();
        rayOrigin.y = 1.2;
        const raycaster = new THREE.Raycaster(rayOrigin, dir, 0, dist + 0.5);
        const intersects = raycaster.intersectObject(collidablesRef.current, true);
        return intersects.length > 0;
    };

    useFrame((_, delta) => {
        let moveX = 0;
        let moveZ = 0;

        // --- CLICK TO MOVE LOGIC ---
        if (targetPosition && !manualOverride) {
            const currentPos = camera.position.clone();
            currentPos.y = 0; // Ignore Y for distance

            const destPos = targetPosition.clone();
            destPos.y = 0;

            const distance = currentPos.distanceTo(destPos);

            if (distance > 0.5) {
                // Move towards target
                const travelDir = destPos.sub(currentPos).normalize();
                moveX = travelDir.x * movementSpeed * delta;
                moveZ = travelDir.z * movementSpeed * delta;
            } else {
                // Arrived
                if (onTargetReached) onTargetReached();
            }
        }
        // --- WASD MANUAL LOGIC ---
        else if (controlsRef.current && controlsRef.current.isLocked) {
            // Calculate movement direction relative to camera facing
            direction.current.z = Number(keys.forward) - Number(keys.backward);
            direction.current.x = Number(keys.right) - Number(keys.left);
            direction.current.normalize(); // Ensure diagonal is not faster

            // Apply velocity damping and acceleration
            const friction = 10.0;
            velocity.current.x -= velocity.current.x * friction * delta;
            velocity.current.z -= velocity.current.z * friction * delta;

            const accel = 60.0;
            if (keys.forward || keys.backward) velocity.current.z -= direction.current.z * accel * delta;
            if (keys.left || keys.right) velocity.current.x -= direction.current.x * accel * delta;

            const oldPos = camera.position.clone();
            controlsRef.current.moveRight(-velocity.current.x * delta);
            controlsRef.current.moveForward(-velocity.current.z * delta);
            const targetPos = camera.position.clone();
            camera.position.copy(oldPos); // Revert back temporarily

            moveX = targetPos.x - oldPos.x;
            moveZ = targetPos.z - oldPos.z;
        }

        // --- APPLY MOVEMENT WITH COLLISIONS ---
        if (moveX !== 0 || moveZ !== 0) {
            // Se testea el movimiento en X y Z por separado. Esto permite "deslizarse" por el muro
            // si el jugador camina en diagonal contra él, en lugar de quedarse clavado en seco.
            const hitX = checkCollision(camera.position, new THREE.Vector3(Math.sign(moveX), 0, 0), Math.abs(moveX));
            if (!hitX) {
                camera.position.x += moveX;
            } else if (manualOverride) {
                velocity.current.x = 0; // Stop pushing into the wall
            }

            const hitZ = checkCollision(camera.position, new THREE.Vector3(0, 0, Math.sign(moveZ)), Math.abs(moveZ));
            if (!hitZ) {
                camera.position.z += moveZ;
            } else if (manualOverride) {
                velocity.current.z = 0; // Stop pushing into the wall
            }
        }

        // Always enforce eye level (keep us grounded)
        camera.position.y = EYE_LEVEL;

        // Update minimap pose ref every frame
        if (cameraPoseRef) {
            // Extract yaw from camera quaternion
            const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
            cameraPoseRef.current = {
                x: camera.position.x,
                z: camera.position.z,
                angle: -euler.y - Math.PI / 2, // Convert THREE yaw to canvas 2D angle
            };
        }
    });

    return (
        <PointerLockControls ref={controlsRef} selector="#canvas-container" />
    );
};
