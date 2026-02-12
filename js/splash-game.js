;(function() {
    'use strict';

    // Game state
    const game = {
        canvas: null,
        ctx: null,
        container: null,
        width: 0,
        height: 0,
        toucan: null,
        toucanImg: null,
        toucanLoaded: false,
        targets: [],
        particles: [],
        score: 0,
        isDragging: false,
        isLaunched: false,
        launchStart: { x: 0, y: 0 },
        dragPos: { x: 0, y: 0 },
        gravity: 0.3,
        friction: 0.99,
        maxPullDistance: 100,
        gameStarted: false,
        animationId: null
    };

    // Colors from Toucan's palette
    const colors = {
        toucan: '#fb6e14',
        toucanBeak: '#fed330',
        toucanBody: '#1a1a2e',
        target: '#58ca7e',
        targetHit: '#fb4f59',
        slingshot: '#a99c92',
        particle: ['#fb6e14', '#fed330', '#58ca7e', '#1784fb', '#fb4f59']
    };

    function init() {
        game.canvas = document.getElementById('splash-game');
        game.container = document.getElementById('splash-game-wrapper');
        if (!game.canvas || !game.container) return;

        game.ctx = game.canvas.getContext('2d');

        // Load toucan sprite
        game.toucanImg = new Image();
        game.toucanImg.onload = function() {
            game.toucanLoaded = true;
        };
        game.toucanImg.src = 'images/big_toucan.png';

        resize();
        window.addEventListener('resize', resize);

        // Input handlers
        game.canvas.addEventListener('mousedown', handleStart);
        game.canvas.addEventListener('mousemove', handleMove);
        game.canvas.addEventListener('mouseup', handleEnd);
        game.canvas.addEventListener('mouseleave', handleEnd);

        // Touch support
        game.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        game.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        game.canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

        // Initialize toucan
        resetToucan();

        // Spawn initial targets
        for (let i = 0; i < 4; i++) {
            spawnTarget();
        }

        // Start game loop
        gameLoop();
    }

    function resize() {
        const rect = game.container.getBoundingClientRect();
        game.width = rect.width;
        game.height = rect.height;
        game.canvas.width = game.width;
        game.canvas.height = game.height;

        // Adjust slingshot position - center of game area
        game.launchStart.x = game.width * 0.5;
        game.launchStart.y = game.height * 0.6;

        // Adjust max pull distance based on container size
        game.maxPullDistance = Math.min(100, game.width * 0.15);

        if (game.toucan && !game.isLaunched) {
            game.toucan.x = game.launchStart.x;
            game.toucan.y = game.launchStart.y;
        }

        // Adjust toucan size
        if (game.toucan) {
            game.toucan.radius = Math.min(25, Math.max(18, game.width * 0.04));
        }
    }

    function resetToucan() {
        game.toucan = {
            x: game.launchStart.x || game.width * 0.5,
            y: game.launchStart.y || game.height * 0.6,
            vx: 0,
            vy: 0,
            radius: Math.min(25, Math.max(18, game.width * 0.04)),
            rotation: 0
        };
        game.isLaunched = false;
        game.isDragging = false;
    }

    function spawnTarget() {
        const padding = 50;
        const minX = padding;
        const maxX = game.width - padding;
        const minY = padding + 60;
        const maxY = game.height - padding - 60;

        // Avoid spawning too close to slingshot center
        let x, y;
        do {
            x = minX + Math.random() * (maxX - minX);
            y = minY + Math.random() * (maxY - minY);
        } while (Math.abs(x - game.launchStart.x) < 80 && Math.abs(y - game.launchStart.y) < 80);

        game.targets.push({
            x: x,
            y: y,
            radius: 15 + Math.random() * 12,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            hit: false,
            opacity: 1,
            pulsePhase: Math.random() * Math.PI * 2
        });
    }

    function getEventPos(e) {
        const rect = game.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function handleStart(e) {
        const pos = getEventPos(e);

        if (!game.isLaunched && isNearToucan(pos.x, pos.y)) {
            game.isDragging = true;
            game.dragPos.x = pos.x;
            game.dragPos.y = pos.y;
            game.gameStarted = true;

            const instructions = document.getElementById('splash-instructions');
            if (instructions) instructions.classList.add('fade-out');
        }
    }

    function handleMove(e) {
        if (!game.isDragging) return;

        const pos = getEventPos(e);
        game.dragPos.x = pos.x;
        game.dragPos.y = pos.y;

        // Limit pull distance
        const dx = game.launchStart.x - game.dragPos.x;
        const dy = game.launchStart.y - game.dragPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > game.maxPullDistance) {
            const angle = Math.atan2(dy, dx);
            game.dragPos.x = game.launchStart.x - Math.cos(angle) * game.maxPullDistance;
            game.dragPos.y = game.launchStart.y - Math.sin(angle) * game.maxPullDistance;
        }

        game.toucan.x = game.dragPos.x;
        game.toucan.y = game.dragPos.y;
    }

    function handleEnd() {
        if (!game.isDragging) return;

        game.isDragging = false;

        const dx = game.launchStart.x - game.toucan.x;
        const dy = game.launchStart.y - game.toucan.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
            game.toucan.vx = dx * 0.22;
            game.toucan.vy = dy * 0.22;
            game.isLaunched = true;
        } else {
            resetToucan();
        }
    }

    function handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        handleStart({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        handleMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        handleEnd();
    }

    function isNearToucan(x, y) {
        const dx = x - game.toucan.x;
        const dy = y - game.toucan.y;
        return Math.sqrt(dx * dx + dy * dy) < game.toucan.radius + 25;
    }

    function update() {
        if (game.isLaunched) {
            game.toucan.vy += game.gravity;
            game.toucan.x += game.toucan.vx;
            game.toucan.y += game.toucan.vy;
            game.toucan.vx *= game.friction;
            game.toucan.rotation += game.toucan.vx * 0.02;

            // Check collision with targets
            game.targets.forEach(target => {
                if (!target.hit) {
                    const dx = game.toucan.x - target.x;
                    const dy = game.toucan.y - target.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < game.toucan.radius + target.radius) {
                        target.hit = true;
                        game.score += 10;
                        updateScore();
                        createExplosion(target.x, target.y);
                    }
                }
            });

            // Reset if out of bounds
            if (game.toucan.x < -50 || game.toucan.x > game.width + 50 ||
                game.toucan.y > game.height + 50) {
                setTimeout(resetToucan, 300);
            }
        }

        // Update targets
        game.targets.forEach(target => {
            if (!target.hit) {
                target.x += target.vx;
                target.y += target.vy;
                target.pulsePhase += 0.05;

                const minX = target.radius + 50;
                const maxX = game.width - target.radius - 50;
                const minY = target.radius + 60;
                const maxY = game.height - target.radius - 60;

                if (target.x < minX || target.x > maxX) target.vx *= -1;
                if (target.y < minY || target.y > maxY) target.vy *= -1;
            } else {
                target.opacity -= 0.05;
            }
        });

        // Remove faded targets and spawn new ones
        game.targets = game.targets.filter(t => t.opacity > 0);
        if (game.targets.filter(t => !t.hit).length < 3) {
            spawnTarget();
        }

        // Update particles
        game.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= 0.025;
        });
        game.particles = game.particles.filter(p => p.life > 0);
    }

    function createExplosion(x, y) {
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 / 10) * i;
            const speed = 2 + Math.random() * 2;
            game.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: colors.particle[Math.floor(Math.random() * colors.particle.length)],
                size: 3 + Math.random() * 3
            });
        }
    }

    function updateScore() {
        const scoreEl = document.getElementById('score-value');
        if (scoreEl) scoreEl.textContent = game.score;
    }

    function draw() {
        const ctx = game.ctx;
        ctx.clearRect(0, 0, game.width, game.height);

        drawStars();
        drawSlingshot();
        game.targets.forEach(drawTarget);
        game.particles.forEach(drawParticle);
        drawToucan();
    }

    function drawStars() {
        const ctx = game.ctx;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

        for (let i = 0; i < 30; i++) {
            const x = ((i * 137) % game.width);
            const y = ((i * 89) % game.height);
            const size = (i % 3) + 1;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawSlingshot() {
        const ctx = game.ctx;
        const x = game.launchStart.x;
        const y = game.launchStart.y;
        const scale = Math.min(1, game.width / 400);

        ctx.strokeStyle = colors.slingshot;
        ctx.lineWidth = 6 * scale;
        ctx.lineCap = 'round';

        // Left prong
        ctx.beginPath();
        ctx.moveTo(x - 20 * scale, y + 40 * scale);
        ctx.lineTo(x - 15 * scale, y - 8 * scale);
        ctx.stroke();

        // Right prong
        ctx.beginPath();
        ctx.moveTo(x + 20 * scale, y + 40 * scale);
        ctx.lineTo(x + 15 * scale, y - 8 * scale);
        ctx.stroke();

        // Draw elastic band
        if (game.isDragging || (!game.isLaunched && game.toucan)) {
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 3 * scale;

            ctx.beginPath();
            ctx.moveTo(x - 15 * scale, y - 8 * scale);
            ctx.lineTo(game.toucan.x - game.toucan.radius * 0.5, game.toucan.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x + 15 * scale, y - 8 * scale);
            ctx.lineTo(game.toucan.x + game.toucan.radius * 0.5, game.toucan.y);
            ctx.stroke();
        } else if (!game.isLaunched) {
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 3 * scale;
            ctx.beginPath();
            ctx.moveTo(x - 15 * scale, y - 8 * scale);
            ctx.quadraticCurveTo(x, y + 8 * scale, x + 15 * scale, y - 8 * scale);
            ctx.stroke();
        }
    }

    function drawToucan() {
        const ctx = game.ctx;
        const t = game.toucan;
        const size = t.radius * 2.5; // Sprite size

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.rotation);

        // Draw pixel art toucan sprite
        if (game.toucanLoaded) {
            // Disable image smoothing for crisp pixel art
            ctx.imageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;

            ctx.drawImage(
                game.toucanImg,
                -size / 2,
                -size / 2,
                size,
                size
            );
        } else {
            // Fallback circle while loading
            ctx.fillStyle = colors.toucan;
            ctx.beginPath();
            ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    function drawTarget(target) {
        const ctx = game.ctx;

        ctx.globalAlpha = target.opacity;

        const pulse = 1 + Math.sin(target.pulsePhase) * 0.1;
        const r = target.radius * pulse;

        // Glow
        const gradient = ctx.createRadialGradient(target.x, target.y, r * 0.5, target.x, target.y, r * 1.3);
        gradient.addColorStop(0, target.hit ? 'rgba(251, 79, 89, 0.3)' : 'rgba(88, 202, 126, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Main circle
        ctx.fillStyle = target.hit ? colors.targetHit : colors.target;
        ctx.beginPath();
        ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Inner ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
    }

    function drawParticle(p) {
        const ctx = game.ctx;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function gameLoop() {
        update();
        draw();
        game.animationId = requestAnimationFrame(gameLoop);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
