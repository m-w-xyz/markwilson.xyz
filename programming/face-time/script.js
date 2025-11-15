// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const videoCheckbox = document.getElementById('videoCheckbox');

// State variables
let faceMesh = null;
let isCameraOn = false;
let stream = null;
let isVideoVisible = false; // Start with video hidden (checkbox checked by default)
let growthFactor = 0;
let isGrowing = false;
let growthAnimationId = null;
let clickStartTime = 0;
let isMouseDown = false;
let smoothedLandmarks = null; // For smoothing
const smoothingFactor = 0.7; // Higher = more smoothing (0-1)
let previousLandmarks = null; // For motion detection
let motionIntensity = 0; // 0-1 based on head movement speed

// Initialize Face Mesh
async function initializeFaceMesh() {
    try {
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onResults);
    } catch (error) {
        console.error('Error initializing Face Mesh:', error);
    }
}

// Handle Face Mesh results
function onResults(results) {
    // Set canvas to viewport size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Fill canvas with black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate scale factors to fit video to viewport while maintaining aspect ratio
    const videoAspect = video.videoWidth / video.videoHeight;
    const viewportAspect = canvas.width / canvas.height;
    
    let scale, drawWidth, drawHeight, offsetX, offsetY;
    
    if (videoAspect > viewportAspect) {
        // Video is wider - fit to width
        scale = canvas.width / video.videoWidth;
        drawWidth = canvas.width;
        drawHeight = canvas.width / videoAspect;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
    } else {
        // Video is taller - fit to height
        scale = canvas.height / video.videoHeight;
        drawWidth = canvas.height * videoAspect;
        drawHeight = canvas.height;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
    }

    // Draw video frame (mirrored) only if visible
    if (isVideoVisible) {
        ctx.save();
        ctx.translate(offsetX + drawWidth, offsetY);
        ctx.scale(-1, 1); // Mirror the video
        ctx.drawImage(results.image, 0, 0, drawWidth, drawHeight);
        ctx.restore();
    }

    // Always draw face landmarks (mirrored to match video) if detected
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        // Smooth the landmarks
        const currentLandmarks = results.multiFaceLandmarks[0];
        
        // Calculate motion intensity
        if (previousLandmarks && previousLandmarks.length === currentLandmarks.length) {
            let totalMovement = 0;
            for (let i = 0; i < currentLandmarks.length; i++) {
                const dx = currentLandmarks[i].x - previousLandmarks[i].x;
                const dy = currentLandmarks[i].y - previousLandmarks[i].y;
                totalMovement += Math.sqrt(dx * dx + dy * dy);
            }
            // Normalize movement (average per landmark, scaled)
            const avgMovement = totalMovement / currentLandmarks.length;
            const newMotion = Math.min(1, avgMovement * 50); // Scale factor to make it visible
            // Smooth the motion intensity
            motionIntensity = motionIntensity * 0.8 + newMotion * 0.2;
        }
        previousLandmarks = currentLandmarks.map(l => ({ x: l.x, y: l.y, z: l.z }));
        
        if (!smoothedLandmarks || smoothedLandmarks.length !== currentLandmarks.length) {
            smoothedLandmarks = currentLandmarks.map(l => ({ x: l.x, y: l.y, z: l.z }));
        } else {
            // Interpolate between previous and current positions
            for (let i = 0; i < currentLandmarks.length; i++) {
                smoothedLandmarks[i].x = smoothedLandmarks[i].x * smoothingFactor + currentLandmarks[i].x * (1 - smoothingFactor);
                smoothedLandmarks[i].y = smoothedLandmarks[i].y * smoothingFactor + currentLandmarks[i].y * (1 - smoothingFactor);
                smoothedLandmarks[i].z = smoothedLandmarks[i].z * smoothingFactor + currentLandmarks[i].z * (1 - smoothingFactor);
            }
        }
        
        ctx.save();
        
        // Apply the EXACT same transformation sequence as the video
        // Step 1: Translate to the right edge of the video area
        ctx.translate(offsetX + drawWidth, offsetY);
        
        // Step 2: Mirror horizontally (same as video)
        ctx.scale(-1, 1);
        
        // Step 3: Scale by multiplying normalized coordinates by video dimensions
        // This ensures proper alignment without distortion
        
        // Now draw with original (non-mirrored) landmarks
        const landmarksToDraw = smoothedLandmarks;
        
        if (growthFactor > 0) {
            // Draw with growth and pink gradient when clicked
            drawTriangularOverlayWithMotion(ctx, landmarksToDraw, growthFactor, motionIntensity, drawWidth, drawHeight);
        } else {
            // Draw normal face mesh with motion-reactive glow
            drawFaceMeshWithMotion(ctx, landmarksToDraw, motionIntensity, drawWidth, drawHeight);
        }
        
        ctx.restore();
    } else {
        // Reset smoothed landmarks when no face detected
        smoothedLandmarks = null;
        previousLandmarks = null;
        motionIntensity = 0;
    }
}

// Draw face mesh with motion-reactive glow
function drawFaceMeshWithMotion(ctx, landmarks, motion, drawWidth, drawHeight) {
    // Create gradient color based on motion
    const baseColor = [255, 255, 255]; // White
    const motionColor = [255, 105, 180]; // Pink
    
    const r = Math.round(baseColor[0] * (1 - motion) + motionColor[0] * motion);
    const g = Math.round(baseColor[1] * (1 - motion) + motionColor[1] * motion);
    const b = Math.round(baseColor[2] * (1 - motion) + motionColor[2] * motion);
    
    // Create gradient for strokes
    const gradient = ctx.createLinearGradient(0, 0, drawWidth, drawHeight);
    const glowIntensity = Math.min(1, motion * 2);
    
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.8 + glowIntensity * 0.2})`);
    gradient.addColorStop(0.5, `rgba(${motionColor[0]}, ${motionColor[1]}, ${motionColor[2]}, ${motion})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.8 + glowIntensity * 0.2})`);
    
    // Draw connections with gradient
    for (let i = 0; i < FACEMESH_TESSELATION.length; i += 2) {
        if (i + 1 < FACEMESH_TESSELATION.length) {
            const start = FACEMESH_TESSELATION[i];
            const end = FACEMESH_TESSELATION[i + 1];
            
            const p1 = landmarks[start];
            const p2 = landmarks[end];
            
            ctx.beginPath();
            ctx.moveTo(p1.x * drawWidth, p1.y * drawHeight);
            ctx.lineTo(p2.x * drawWidth, p2.y * drawHeight);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1 + motion * 2;
            ctx.stroke();
        }
    }
    
    // Add glow effect when moving
    if (motion > 0.1) {
        ctx.shadowColor = `rgba(${motionColor[0]}, ${motionColor[1]}, ${motionColor[2]}, ${motion})`;
        ctx.shadowBlur = 10 + motion * 20;
    }
}

// Draw triangular overlay with pink gradient and motion
function drawTriangularOverlayWithMotion(ctx, landmarks, growth, motion, drawWidth, drawHeight) {
    // Get face center for growth direction (normalized coordinates)
    const faceCenter = {
        x: landmarks[10].x, // Nose tip
        y: landmarks[10].y
    };
    
    // Create pink gradient with motion intensity
    const gradient = ctx.createLinearGradient(0, 0, drawWidth, drawHeight);
    const intensity = Math.max(growth, motion);
    gradient.addColorStop(0, `rgba(255, 105, 180, ${0.5 + intensity * 0.5})`);
    gradient.addColorStop(0.5, `rgba(255, 20, 147, ${0.7 + intensity * 0.3})`);
    gradient.addColorStop(1, `rgba(255, 105, 180, ${0.5 + intensity * 0.5})`);
    
    ctx.strokeStyle = gradient;
    ctx.fillStyle = gradient;
    ctx.lineWidth = 2 + growth * 0.5 + motion * 2;
    
    // Add glow based on motion
    if (motion > 0.1) {
        ctx.shadowColor = `rgba(255, 105, 180, ${motion})`;
        ctx.shadowBlur = 15 + motion * 25;
    }
    
    // Build connection map from tessellation
    const connections = new Map();
    for (let i = 0; i < FACEMESH_TESSELATION.length; i += 2) {
        if (i + 1 < FACEMESH_TESSELATION.length) {
            const start = FACEMESH_TESSELATION[i];
            const end = FACEMESH_TESSELATION[i + 1];
            
            if (!connections.has(start)) connections.set(start, new Set());
            if (!connections.has(end)) connections.set(end, new Set());
            connections.get(start).add(end);
            connections.get(end).add(start);
        }
    }
    
    // Draw triangles by finding closed loops of 3 connected points
    const drawnTriangles = new Set();
    
    connections.forEach((neighbors, p1Idx) => {
        neighbors.forEach(p2Idx => {
            const p2Neighbors = connections.get(p2Idx);
            if (p2Neighbors) {
                p2Neighbors.forEach(p3Idx => {
                    const p3Neighbors = connections.get(p3Idx);
                    if (p3Neighbors && p3Neighbors.has(p1Idx)) {
                        // Found triangle: p1Idx -> p2Idx -> p3Idx
                        const triangleKey = [p1Idx, p2Idx, p3Idx].sort((a, b) => a - b).join(',');
                        if (!drawnTriangles.has(triangleKey)) {
                            drawnTriangles.add(triangleKey);
                            
                            // Get normalized coordinates
                            const p1 = { x: landmarks[p1Idx].x, y: landmarks[p1Idx].y };
                            const p2 = { x: landmarks[p2Idx].x, y: landmarks[p2Idx].y };
                            const p3 = { x: landmarks[p3Idx].x, y: landmarks[p3Idx].y };
                            
                            // Deform points outward from face center
                            const deformPoint = (p) => {
                                const dx = p.x - faceCenter.x;
                                const dy = p.y - faceCenter.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                const angle = Math.atan2(dy, dx);
                                const newDist = dist * (1 + growth * 2.5);
                                return {
                                    x: (faceCenter.x + Math.cos(angle) * newDist) * drawWidth,
                                    y: (faceCenter.y + Math.sin(angle) * newDist) * drawHeight
                                };
                            };
                            
                            const dp1 = deformPoint(p1);
                            const dp2 = deformPoint(p2);
                            const dp3 = deformPoint(p3);
                            
                            // Draw triangle
                            ctx.beginPath();
                            ctx.moveTo(dp1.x, dp1.y);
                            ctx.lineTo(dp2.x, dp2.y);
                            ctx.lineTo(dp3.x, dp3.y);
                            ctx.closePath();
                            
                            if (growth > 0) {
                                ctx.globalAlpha = 0.2 + growth * 0.4;
                                ctx.fill();
                                ctx.globalAlpha = 1.0;
                            }
                            ctx.stroke();
                        }
                    }
                });
            }
        });
    });
}

// Handle click and hold
function handleMouseDown() {
    isMouseDown = true;
    isGrowing = true;
    clickStartTime = Date.now();
    // Start with immediate growth for click
    growthFactor = Math.min(2, growthFactor + 0.3);
    startGrowthAnimation();
}

function handleMouseUp() {
    isMouseDown = false;
    if (growthAnimationId) {
        cancelAnimationFrame(growthAnimationId);
        growthAnimationId = null;
    }
    // Gradually reduce growth after release
    const reduceGrowth = () => {
        if (growthFactor > 0 && !isMouseDown) {
            growthFactor = Math.max(0, growthFactor - 0.05);
            if (growthFactor > 0) {
                requestAnimationFrame(reduceGrowth);
            } else {
                isGrowing = false;
            }
        } else if (!isMouseDown) {
            isGrowing = false;
        }
    };
    reduceGrowth();
}

function startGrowthAnimation() {
    const animate = () => {
        if (isMouseDown) {
            // Continue growing while held
            growthFactor = Math.min(2, growthFactor + 0.08);
            growthAnimationId = requestAnimationFrame(animate);
        } else {
            growthAnimationId = null;
        }
    };
    animate();
}

// Start camera
async function startCamera() {
    try {
        // First check if we have Face Mesh initialized
        if (!faceMesh) {
            await initializeFaceMesh();
        }

        // Try to get camera access
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            }
        });

        // Set up video element
        video.srcObject = stream;
        isCameraOn = true;

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });
        await video.play();

        // Start face tracking
        await sendToFaceMesh();
    } catch (err) {
        console.error('Error accessing camera:', err);
    }
}

// Toggle video visibility
function toggleVideoVisibility() {
    // When checkbox is checked, hide video (show black)
    isVideoVisible = !videoCheckbox.checked;
}

// Send video frame to Face Mesh
async function sendToFaceMesh() {
    if (!isCameraOn) return;

    try {
        await faceMesh.send({ image: video });
        requestAnimationFrame(sendToFaceMesh);
    } catch (error) {
        console.error('Error in face tracking:', error);
    }
}

// Event listeners
videoCheckbox.addEventListener('change', toggleVideoVisibility);

// Click and hold handlers
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mouseleave', handleMouseUp);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleMouseDown();
});
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleMouseUp();
});

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Initialize
(async () => {
    try {
        // Set initial video visibility based on checkbox
        isVideoVisible = !videoCheckbox.checked;
        await initializeFaceMesh();
        await startCamera();
    } catch (error) {
        console.error('Initialization error:', error);
    }
})();
