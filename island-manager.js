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
        const radius = 3.5 + Math.random() * 2.5; 
        const height = 1.2 + Math.random() * 1.0; 
        
        // Detailed Procedural Geometry: Cylinder with noise
        const radialSegments = 12;
        const heightSegments = 3;
        const geo = new THREE.CylinderGeometry(radius * 0.7, radius, height, radialSegments, heightSegments);
        
        // Randomize vertices for a rocky/natural look
        const posAttr = geo.attributes.position;
        const colors = [];
        const color = new THREE.Color();

        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);
            
            // Add noise (except at the base for stability)
            if (y > -height/2 + 0.1) {
                const noise = 0.4;
                posAttr.setXYZ(i, 
                    x + (Math.random() - 0.5) * noise, 
                    y + (Math.random() - 0.5) * noise * 0.5, 
                    z + (Math.random() - 0.5) * noise
                );
            }

            // Vertex Coloring: Bottom is sand, Top is grass
            const heightFactor = (y + height/2) / height;
            if (heightFactor < 0.3) {
                color.setHex(0xd2b48c); // Tan/Sand
            } else if (heightFactor < 0.5) {
                color.setHex(0xc2b280); // Sand/Grass transition
            } else {
                color.setHex(0x2e8b57); // SeaGreen Grass
            }
            colors.push(color.r, color.g, color.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        // Pivot adjustment: Move base to 0
        geo.translate(0, height/2, 0); 
        
        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            flatShading: true,
            emissive: 0x111111,
            emissiveIntensity: 0.1
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, 0, 0);
        mesh.scale.set(0, 0, 0);
        
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