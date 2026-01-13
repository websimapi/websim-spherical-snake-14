import * as THREE from 'three';
import { getRandomPointOnSphere } from './math-utils.js';

export class IslandManager {
    constructor(scene) {
        this.scene = scene;
        this.islands = []; 
        this.islandIdCounter = 0;
    }

    reset() {
        this.islands.forEach(i => {
            this.scene.remove(i.mesh);
            if(i.mesh.geometry) i.mesh.geometry.dispose();
            if(i.mesh.material) i.mesh.material.dispose();
        });
        this.islands = [];
        this.islandIdCounter = 0;
    }

    spawnIsland(currentRadius) {
        // Create geometry - randomized low poly mound
        const radius = 3.0 + Math.random() * 2.0; 
        const height = 1.8 + Math.random() * 1.5; 
        
        // ConeGeometry(radius, height, radialSegments)
        const geo = new THREE.ConeGeometry(radius, height, 7, 1);
        // Pivot adjustment: Move base to 0 so scaling works from base
        geo.translate(0, height/2, 0); 
        
        const mat = new THREE.MeshStandardMaterial({
            color: 0x2e8b57, // SeaGreen
            roughness: 0.8,
            flatShading: true,
            emissive: 0x0a2211,
            emissiveIntensity: 0.2
        });

        const mesh = new THREE.Mesh(geo, mat);
        // Start at center
        mesh.position.set(0, 0, 0);
        mesh.scale.set(0, 0, 0);
        
        // Target random position
        const targetNormal = getRandomPointOnSphere(1).normalize();
        
        this.scene.add(mesh);

        this.islands.push({
            id: this.islandIdCounter++,
            mesh,
            targetNormal,
            radius, 
            height, 
            progress: 0,
            settled: false
        });
    }

    update(dt, currentEarthRadius) {
        for (const island of this.islands) {
            if (!island.settled) {
                island.progress += dt * 0.15; // Float up slowly (approx 6-7s)
                
                if (island.progress >= 1.0) {
                    island.progress = 1.0;
                    island.settled = true;
                }

                const t = island.progress;
                // Cubic ease out for position
                // const ease = 1 - Math.pow(1 - t, 3);
                
                const dist = t * currentEarthRadius;
                island.mesh.position.copy(island.targetNormal).multiplyScalar(dist);
                
                // Scale up
                const s = t;
                island.mesh.scale.set(s, s, s);
                
                // Orient: Top of cone (+Y) should point along Normal
                // lookAt aligns +Z to target. 
                // We look at (0,0,0) (Center). So +Z points IN.
                // We want +Y to point OUT (-Z). 
                island.mesh.lookAt(new THREE.Vector3(0,0,0));
                island.mesh.rotateX(-Math.PI / 2);

            } else {
                // Keep attached to growing surface
                island.mesh.position.copy(island.targetNormal).multiplyScalar(currentEarthRadius);
                island.mesh.lookAt(new THREE.Vector3(0,0,0));
                island.mesh.rotateX(-Math.PI / 2);
            }
        }
    }

    getTerrainHeight(pos, earthRadius) {
        let maxH = 0;
        const posNorm = pos.clone().normalize();

        for (const island of this.islands) {
            // Visual radius collision check
            // Use angle distance for sphere
            const distAngle = posNorm.angleTo(island.targetNormal);
            const dist = distAngle * earthRadius;
            
            // Effective collision radius (slightly smaller than visual to avoid edge clipping)
            const r = island.radius * 0.9 * island.progress; 
            
            if (dist < r) {
                // Parabolic shape: H * (1 - (d/r)^2)
                const h = island.height * island.progress * (1 - Math.pow(dist / r, 2));
                if (h > maxH) maxH = h;
            }
        }
        return maxH;
    }
    
    getSnapshot() {
        return this.islands.map(i => ({
            id: i.id,
            pos: i.mesh.position.toArray(),
            quat: i.mesh.quaternion.toArray(),
            scale: i.mesh.scale.toArray(),
            radius: i.radius,
            height: i.height
        }));
    }
}