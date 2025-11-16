// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const textInput = document.getElementById('text-input');

// Set canvas size
function resizeCanvas() {
    // Canvas dimensions are fixed at 1080x1350
    // The CSS will handle the scaling
    canvas.width = 2160;
    canvas.height = 1350;
}

// Load custom font
const font = new FontFace('CourtRegular', 'url(../../assets/fonts/court-Regular.otf)');
font.load().then(() => {
    document.fonts.add(font);
}).catch(err => {
    console.error('Font loading failed:', err);
});

// Text particles
class TextParticle {
    constructor(x, y, char, fontSize) {
        this.x = x;
        this.y = y;
        this.char = char;
        this.fontSize = fontSize;
        this.velocityY = 0;
        this.velocityX = (Math.random() - 0.5) * 1.5; // Slightly reduced initial velocity
        this.gravity = 0.12; // Further reduced gravity for even slower falling
        this.friction = 0.99;
        this.bounce = 0.5; // Reduced bounce for more natural feel
        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.03; // Much more subtle rotation
        this.airResistance = 0.985; // Increased air resistance for slower movement
    }

    update() {
        // Apply air resistance
        this.velocityX *= this.airResistance;
        this.velocityY *= this.airResistance;
        
        // Apply gravity
        this.velocityY += this.gravity;
        
        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.rotation += this.rotationSpeed;

        // Remove particle if it falls below canvas
        if (this.y > canvas.height + 100) {
            return true;
        }

        // Bounce off sides with reduced velocity
        if (this.x < 0) {
            this.x = 0;
            this.velocityX *= -this.bounce * 0.7;
        } else if (this.x > canvas.width) {
            this.x = canvas.width;
            this.velocityX *= -this.bounce * 0.7;
        }

        return false;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${this.fontSize}px CourtRegular, Arial`;
        ctx.fillText(this.char, 0, 0);
        ctx.restore();
    }
}

// Add circle class for N markers
class Circle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 50; // 100px diameter = 50px radius
        this.isFalling = false;
    }

    draw() {
        ctx.save();
        ctx.globalCompositeOperation = 'hard-light';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#808080';
        ctx.fill();
        ctx.restore();
    }
}

class FallingCircle extends Circle {
    constructor(x, y) {
        super(x, y);
        this.velocityY = 0;
        this.velocityX = (Math.random() - 0.5) * 1.5;
        this.gravity = 0.12;
        this.friction = 0.99;
        this.bounce = 0.5;
        this.airResistance = 0.985;
        this.isFalling = true;
    }

    update() {
        // Apply air resistance
        this.velocityX *= this.airResistance;
        this.velocityY *= this.airResistance;
        
        // Apply gravity
        this.velocityY += this.gravity;
        
        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Remove particle if it falls below canvas
        if (this.y > canvas.height + 100) {
            return true;
        }

        // Bounce off sides with reduced velocity
        if (this.x < 0) {
            this.x = 0;
            this.velocityX *= -this.bounce * 0.7;
        } else if (this.x > canvas.width) {
            this.x = canvas.width;
            this.velocityX *= -this.bounce * 0.7;
        }

        return false;
    }
}

let particles = [];
let currentText = '';
let textLines = [];
let fontSize = 72; // Default font size
let lineHeight = 60; // Reduced line height for tighter spacing
let circles = [];
let fallingCircles = [];

// Handle text input
textInput.addEventListener('input', (e) => {
    currentText = e.target.value;
    updateTextPosition();
});

// Handle enter key
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        triggerFallAnimation();
    }
});

function calculateOptimalFontSize(text) {
    if (!text) return 72;
    
    // Define minimum and maximum font sizes
    const MIN_FONT_SIZE = 72;
    const MAX_FONT_SIZE = 300;
    
    // Calculate available space
    const maxWidth = canvas.width - 40;
    const maxHeight = canvas.height - 100;
    
    // Binary search to find the optimal font size
    let minSize = MIN_FONT_SIZE;
    let maxSize = MAX_FONT_SIZE;
    
    while (minSize <= maxSize) {
        const midSize = Math.floor((minSize + maxSize) / 2);
        ctx.font = `${midSize}px CourtRegular, Arial`;
        
        // Check if text fits width-wise
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';
        let fits = true;
        
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = ctx.measureText(testLine).width;
            
            if (testWidth > maxWidth) {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    // If a single word is too long, it doesn't fit
                    fits = false;
                    break;
                }
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // Check if text fits height-wise
        const totalHeight = lines.length * (midSize * 1.2); // 1.2 is line height multiplier
        if (totalHeight > maxHeight) {
            fits = false;
        }
        
        if (fits) {
            // Text fits, try a larger size
            minSize = midSize + 1;
        } else {
            // Text doesn't fit, try a smaller size
            maxSize = midSize - 1;
        }
    }
    
    // Ensure we never go below the minimum font size
    return Math.max(MIN_FONT_SIZE, maxSize);
}

function updateTextPosition() {
    if (!currentText) {
        textLines = [];
        circles = [];
        return;
    }
    
    // Calculate optimal font size
    fontSize = calculateOptimalFontSize(currentText);
    lineHeight = fontSize * 0.8; // Reduced line height multiplier
    
    ctx.font = `${fontSize}px CourtRegular, Arial`;
    const maxWidth = canvas.width - 40;
    const words = currentText.split(' ');
    textLines = [];
    let currentLine = '';
    let charCount = 0;
    circles = [];

    words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > maxWidth) {
            if (currentLine) {
                textLines.push(currentLine);
                currentLine = word;
            } else {
                // If a single word is too long, split it
                const chars = word.split('');
                let tempLine = '';
                chars.forEach(char => {
                    const testChar = tempLine + char;
                    if (ctx.measureText(testChar).width > maxWidth) {
                        textLines.push(tempLine);
                        tempLine = char;
                    } else {
                        tempLine += char;
                    }
                });
                currentLine = tempLine;
            }
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine) {
        textLines.push(currentLine);
    }

    // Add circles for every 4th character, alternating between random and text-adjacent placement
    textLines.forEach((line, lineIndex) => {
        const lineWidth = ctx.measureText(line).width;
        const startX = (canvas.width - lineWidth) / 2;
        const startY = (canvas.height - (textLines.length * lineHeight)) / 2 + (lineIndex * lineHeight);
        
        const chars = line.split('');
        chars.forEach((char, charIndex) => {
            charCount++;
            if (charCount % 4 === 0) {
                // Alternate between random and text-adjacent placement
                if (charCount % 8 === 0) {
                    // Random position anywhere on canvas
                    const randomX = Math.random() * canvas.width;
                    const randomY = Math.random() * canvas.height;
                    circles.push(new Circle(randomX, randomY));
                } else {
                    // Position near the text
                    const x = startX + ctx.measureText(line.substring(0, charIndex)).width;
                    const randomX = x + (Math.random() * 200 - 100);
                    const randomY = startY + (Math.random() * 200 - 100);
                    circles.push(new Circle(randomX, randomY));
                }
            }
        });
    });
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw current text
    if (textLines.length > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${fontSize}px CourtRegular, Arial`;
        
        const totalHeight = textLines.length * lineHeight;
        const startY = (canvas.height - totalHeight) / 2;
        
        textLines.forEach((line, index) => {
            const lineWidth = ctx.measureText(line).width;
            const x = (canvas.width - lineWidth) / 2;
            const y = startY + (index * lineHeight);
            ctx.fillText(line, x, y);
        });

        // Draw circles
        circles.forEach(circle => circle.draw());
    }
    
    // Update and draw particles
    particles = particles.filter(particle => {
        particle.update();
        particle.draw();
        return !particle.update();
    });

    // Update and draw falling circles
    fallingCircles = fallingCircles.filter(circle => {
        circle.update();
        circle.draw();
        return !circle.update();
    });
    
    requestAnimationFrame(animate);
}

// Function to trigger the fall animation
function triggerFallAnimation() {
    if (textLines.length > 0) {
        // Create falling text particles
        textLines.forEach((line, lineIndex) => {
            const lineWidth = ctx.measureText(line).width;
            const startX = (canvas.width - lineWidth) / 2;
            const startY = (canvas.height - (textLines.length * lineHeight)) / 2 + (lineIndex * lineHeight);
            
            const chars = line.split('');
            chars.forEach((char, charIndex) => {
                const x = startX + ctx.measureText(line.substring(0, charIndex)).width;
                particles.push(new TextParticle(x, startY, char, fontSize));
            });
        });

        // Create falling circles
        circles.forEach(circle => {
            fallingCircles.push(new FallingCircle(circle.x, circle.y));
        });
        
        currentText = '';
        textInput.value = '';
        textLines = [];
        circles = [];
    }
}

// Handle canvas click
canvas.addEventListener('click', () => {
    triggerFallAnimation();
});

// Initial setup
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
animate(); 