// Mouse interaction
let mousePosition = new THREE.Vector3(0, 0, 0);
let isMouseActive = false;
let isMouseDown = false;
let fieldIntensity = 1.0; // Base field intensity
let targetFieldIntensity = 1.0; // Target intensity (grows when clicked)
let currentFieldRadius = 2.0; // Current field radius
let targetFieldRadius = 2.0; // Target radius (grows when clicked)

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Position camera
camera.position.z = 5;

// Particle system parameters
const particleCount = 150000; // Doubled from 60000
const particleSize = 0.02;
const spread = 10;
const baseFieldRadius = 2.0;
const maxFieldRadius = 5.0;
const baseFieldStrength = 0.025; // Reduced from 0.05 (50% weaker)
const maxFieldStrength = 0.15; // Reduced from 0.3 (50% weaker)
const constantMotionStrength = 0.0005; // Further reduced for smoother motion
const motionEasing = 0.25; // Increased easing for smoother movement

// Create particle geometry
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const velocities = new Float32Array(particleCount * 3);

// Get initial cursor position (center of screen)
const initialCursorX = window.innerWidth / 2;
const initialCursorY = window.innerHeight / 2;
let initialCursorWorld = null;

// Initialize particles with many more near cursor
for (let i = 0; i < particleCount * 3; i += 3) {
    // 60% of particles start near cursor, 40% random
    const nearCursor = Math.random() < 0.6;
    
    if (nearCursor) {
        // Particles near cursor - smaller radius distribution
        const radius = Math.random() * 3; // Much smaller radius
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        // Start near center (cursor will be at center initially)
        positions[i] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = radius * Math.cos(phi);
    } else {
        // Random positions in a sphere for remaining particles
        const radius = Math.random() * spread;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        positions[i] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = radius * Math.cos(phi);
    }
    
    // Random initial velocities for constant movement (reduced for smoother motion)
    velocities[i] = (Math.random() - 0.5) * 0.01;
    velocities[i + 1] = (Math.random() - 0.5) * 0.01;
    velocities[i + 2] = (Math.random() - 0.5) * 0.01;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

// Create particle material
const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: particleSize,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
});

// Create particle system
const particles = new THREE.Points(geometry, material);
scene.add(particles);

// Orbital motion parameters
const orbitalSpeed = 0.00001; // Very slow orbital speed
const orbitalAcceleration = 0.0000001; // Very slow acceleration to build up orbital motion
let orbitalVelocity = 0; // Current orbital velocity (builds up over time)

// Convert screen coordinates to 3D world coordinates
function screenToWorld(x, y) {
    const vector = new THREE.Vector3();
    vector.set(
        (x / window.innerWidth) * 2 - 1,
        -(y / window.innerHeight) * 2 + 1,
        0.5
    );
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    return camera.position.clone().add(dir.multiplyScalar(distance));
}

// Mouse interaction
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// Initialize mouse position to center
mousePosition = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
isMouseActive = true;

document.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    mousePosition = screenToWorld(event.clientX, event.clientY);
    isMouseActive = true;
});

document.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    targetFieldIntensity = 1.0;
    targetFieldRadius = baseFieldRadius;
});

document.addEventListener('mouseup', () => {
    isMouseDown = false;
    targetFieldIntensity = 1.0;
    targetFieldRadius = baseFieldRadius;
});

document.addEventListener('mouseleave', () => {
    isMouseActive = false;
    isMouseDown = false;
    targetFieldIntensity = 1.0;
    targetFieldRadius = baseFieldRadius;
});

// Touch interaction for mobile
document.addEventListener('touchstart', (event) => {
    event.preventDefault(); // Prevent scrolling
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    mousePosition = screenToWorld(touch.clientX, touch.clientY);
    isMouseActive = true;
    isMouseDown = true;
    targetFieldIntensity = 1.0;
    targetFieldRadius = baseFieldRadius;
}, { passive: false });

document.addEventListener('touchmove', (event) => {
    event.preventDefault(); // Prevent scrolling
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    mousePosition = screenToWorld(touch.clientX, touch.clientY);
    isMouseActive = true;
}, { passive: false });

document.addEventListener('touchend', (event) => {
    event.preventDefault();
    isMouseDown = false;
    targetFieldIntensity = 1.0;
    targetFieldRadius = baseFieldRadius;
    // Keep mouse active briefly to allow smooth transition
    setTimeout(() => {
        isMouseActive = false;
    }, 100);
}, { passive: false });

document.addEventListener('touchcancel', (event) => {
    event.preventDefault();
    isMouseActive = false;
    isMouseDown = false;
    targetFieldIntensity = 1.0;
    targetFieldRadius = baseFieldRadius;
}, { passive: false });


// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Gradually build up orbital velocity (very slowly)
    orbitalVelocity = Math.min(orbitalVelocity + orbitalAcceleration, orbitalSpeed);
    
    // Smoothly interpolate field intensity and radius
    const intensitySpeed = 0.05;
    const radiusSpeed = 0.1;
    
    if (isMouseDown) {
        // Grow field when mouse is held
        targetFieldIntensity = Math.min(targetFieldIntensity + 0.02, 3.0);
        targetFieldRadius = Math.min(targetFieldRadius + 0.05, maxFieldRadius);
    }
    
    // Interpolate towards target
    fieldIntensity += (targetFieldIntensity - fieldIntensity) * intensitySpeed;
    currentFieldRadius += (targetFieldRadius - currentFieldRadius) * radiusSpeed;
    
    const positions = geometry.attributes.position.array;
    const interactionPoint = isMouseActive ? mousePosition : null;
    
    // Calculate current field strength based on intensity
    const currentFieldStrength = baseFieldStrength * fieldIntensity;
    const currentRadius = currentFieldRadius;
    
    // Update particle positions with eased movement
    for (let i = 0; i < positions.length; i += 3) {
        const particlePos = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
        
        // Constant motion - always add some random drift (eased)
        const targetVelX = (Math.random() - 0.5) * constantMotionStrength;
        const targetVelY = (Math.random() - 0.5) * constantMotionStrength;
        const targetVelZ = (Math.random() - 0.5) * constantMotionStrength;
        
        // Ease velocities for smoother motion with stronger interpolation
        const velEasing = motionEasing * 0.8; // Slightly reduced for smoother transitions
        velocities[i] += (targetVelX - velocities[i] * 0.15) * velEasing;
        velocities[i + 1] += (targetVelY - velocities[i + 1] * 0.15) * velEasing;
        velocities[i + 2] += (targetVelZ - velocities[i + 2] * 0.15) * velEasing;
        
        // Apply magnetic field if interaction point is active
        if (interactionPoint) {
            const distance = particlePos.distanceTo(interactionPoint);
            if (distance < currentRadius) {
                // Magnetic attraction (particles are pulled towards interaction point)
                const direction = new THREE.Vector3()
                    .subVectors(interactionPoint, particlePos)
                    .normalize();
                
                // Stronger force when closer, weaker when farther
                const force = (1 - distance / currentRadius) * currentFieldStrength;
                
                // Ease the force application for smoother movement with stronger easing
                velocities[i] += direction.x * force * motionEasing * 0.8;
                velocities[i + 1] += direction.y * force * motionEasing * 0.8;
                velocities[i + 2] += direction.z * force * motionEasing * 0.8;
            }
        }
        
        // Apply velocity with smooth movement
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
        
        // Calculate distance from origin for orbital motion and boundary
        const distanceFromOrigin = Math.sqrt(
            positions[i] * positions[i] + 
            positions[i + 1] * positions[i + 1] + 
            positions[i + 2] * positions[i + 2]
        );
        
        // Apply very slow orbital motion around center (gradually builds up)
        if (distanceFromOrigin > 0.1 && orbitalVelocity > 0) {
            // Calculate radial direction from origin
            const radialDir = new THREE.Vector3(
                positions[i] / distanceFromOrigin,
                positions[i + 1] / distanceFromOrigin,
                positions[i + 2] / distanceFromOrigin
            );
            
            // Calculate tangential direction for orbital motion (perpendicular to radial)
            // Use Y-axis as reference for vertical rotation
            const up = new THREE.Vector3(0, 1, 0);
            let tangential = new THREE.Vector3().crossVectors(up, radialDir);
            
            // If tangential is too small, use X-axis instead
            if (tangential.length() < 0.1) {
                const right = new THREE.Vector3(1, 0, 0);
                tangential.crossVectors(right, radialDir);
            }
            
            tangential.normalize();
            
            // Apply very slow orbital velocity (inversely proportional to distance for stability)
            const orbitalForce = orbitalVelocity * (1 / (distanceFromOrigin * 0.5 + 1));
            velocities[i] += tangential.x * orbitalForce;
            velocities[i + 1] += tangential.y * orbitalForce;
            velocities[i + 2] += tangential.z * orbitalForce;
        }
        
        // Increased damping for smoother, more controlled motion
        velocities[i] *= 0.998; // Higher damping for smoother motion
        velocities[i + 1] *= 0.998;
        velocities[i + 2] *= 0.998;
        
        // Boundary check - soft boundary
        
        if (distanceFromOrigin > spread) {
            const pullBack = (distanceFromOrigin - spread) * 0.01;
            const direction = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]).normalize();
            positions[i] -= direction.x * pullBack;
            positions[i + 1] -= direction.y * pullBack;
            positions[i + 2] -= direction.z * pullBack;
            // Add some bounce
            velocities[i] -= direction.x * 0.1;
            velocities[i + 1] -= direction.y * 0.1;
            velocities[i + 2] -= direction.z * 0.1;
        }
    }
    
    geometry.attributes.position.needsUpdate = true;
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();
