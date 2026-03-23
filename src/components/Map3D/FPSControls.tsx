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
    movementSpeed = 1.8,
    initialPosition,
    collidablesRef,
    cameraPoseRef,
}) => {
    const { camera } = useThree();
    const controlsRef = useRef<any>(null);
    const [keys, setKeys] = useState({ forward: false, backward: false, left: false, right: false, jump: false });

    // Track manual override to cancel auto-walk
    const [manualOverride, setManualOverride] = useState(false);

    // Gravity state
    const yVelocity = useRef(0);
    const isJumping = useRef(false);

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
            // Ignore ALL camera keys when user is typing in chat / any input
            const tag = (document.activeElement as HTMLElement)?.tagName;
            const isEditable = (document.activeElement as HTMLElement)?.isContentEditable;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;

            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW': setKeys(k => ({ ...k, forward: true })); setManualOverride(true); break;
                case 'ArrowLeft':
                case 'KeyA': setKeys(k => ({ ...k, left: true })); setManualOverride(true); break;
                case 'ArrowDown':
                case 'KeyS': setKeys(k => ({ ...k, backward: true })); setManualOverride(true); break;
                case 'ArrowRight':
                case 'KeyD': setKeys(k => ({ ...k, right: true })); setManualOverride(true); break;
                case 'Space':
                    e.preventDefault(); // Prevent browser 'click focused button' behavior
                    setKeys(k => ({ ...k, jump: true })); setManualOverride(true); break;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            // Same guard: ignore if user is typing
            const tag = (document.activeElement as HTMLElement)?.tagName;
            const isEditable = (document.activeElement as HTMLElement)?.isContentEditable;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;
            switch (e.code) {
                case 'ArrowUp':
                case 'KeyW': setKeys(k => ({ ...k, forward: false })); break;
                case 'ArrowLeft':
                case 'KeyA': setKeys(k => ({ ...k, left: false })); break;
                case 'ArrowDown':
                case 'KeyS': setKeys(k => ({ ...k, backward: false })); break;
                case 'ArrowRight':
                case 'KeyD': setKeys(k => ({ ...k, right: false })); break;
                case 'Space': setKeys(k => ({ ...k, jump: false })); break;
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
        const raycaster = new THREE.Raycaster(rayOrigin, dir, 0, dist + 0.15); // Reduced padding from 0.5 to 0.15
        
        // The default threshold for Lines is 1 unit! This was creating massive invisible bubbles.
        raycaster.params.Line.threshold = 0; 

        const intersects = raycaster.intersectObject(collidablesRef.current, true);
        
        // Filter out non-solid meshes (Lines, UI indicators)
        for (let i = 0; i < intersects.length; i++) {
            if (intersects[i].object.type === 'LineSegments' || intersects[i].object.type === 'Points') {
                continue;
            }
            return true; // Hit a solid mesh!
        }
        
        return false;
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
            const oldPos = camera.position.clone();

            // Crisp instant-stop movement (no momentum/friction delays)
            const speed = movementSpeed * delta;
            
            if (keys.forward) controlsRef.current.moveForward(speed);
            if (keys.backward) controlsRef.current.moveForward(-speed);
            if (keys.right) controlsRef.current.moveRight(speed);
            if (keys.left) controlsRef.current.moveRight(-speed);

            const targetPos = camera.position.clone();
            camera.position.copy(oldPos); // Revert back temporarily

            moveX = targetPos.x - oldPos.x;
            moveZ = targetPos.z - oldPos.z;
        }

        // --- APPLY MOVEMENT WITH COLLISIONS ---
        if (moveX !== 0) {
            const hitX = checkCollision(camera.position, new THREE.Vector3(Math.sign(moveX), 0, 0), Math.abs(moveX));
            if (!hitX) camera.position.x += moveX;
        }

        if (moveZ !== 0) {
            const hitZ = checkCollision(camera.position, new THREE.Vector3(0, 0, Math.sign(moveZ)), Math.abs(moveZ));
            if (!hitZ) camera.position.z += moveZ;
        }

        // Gravity & Jumping physics
        yVelocity.current -= 20.0 * delta; // Gravity (made snappy for FPS)

        if (keys.jump && !isJumping.current) {
            yVelocity.current = 6.0; // Snappy Jump force
            isJumping.current = true;
        }

        camera.position.y += yVelocity.current * delta;

        // Grounding (Basic floor check)
        if (camera.position.y <= EYE_LEVEL) {
            camera.position.y = EYE_LEVEL;
            yVelocity.current = 0;
            isJumping.current = false;
        }

        // Export pose for minimap pose ref every frame
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
