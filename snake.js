// snake.js - Production Grade Core State Machine Engine Block
(function() {
    // Stage Element Context Retrieval Configurations
    const canvas = document.getElementById("game-surface");
    const ctx = canvas.getContext("2d");

    // Primary Document Interface DOM Element Selectors Cache Matrix
    const DOM = {
        score: document.getElementById("count-score"),
        high: document.getElementById("count-high"),
        overlay: document.getElementById("modal-screen-overlay"),
        overlayHeading: document.getElementById("overlay-main-heading"),
        btnPlay: document.getElementById("action-trigger-play"),
        
        btnMenuToggle: document.getElementById("btn-menu-toggle"),
        btnStatsToggle: document.getElementById("btn-stats-toggle"),
        btnCloseSettings: document.getElementById("close-settings-panel"),
        btnCloseStats: document.getElementById("close-stats-panel"),
        drawerSettings: document.getElementById("drawer-settings"),
        drawerStats: document.getElementById("drawer-stats"),
        
        optGridDensity: document.getElementById("opt-grid-density"),
        optGameSpeed: document.getElementById("opt-game-speed"),
        optAudioToggle: document.getElementById("opt-audio-toggle"),
        optWrapToggle: document.getElementById("opt-wrap-toggle"),
        
        statTotalRuns: document.getElementById("profile-total-runs"),
        statTotalApples: document.getElementById("profile-total-apples"),
        statAvgScore: document.getElementById("profile-total-apples"), 
        statTotalSteps: document.getElementById("profile-total-steps"),
        btnResetProfile: document.getElementById("action-reset-profile"),
        
        padUp: document.getElementById("pad-up"),
        padDown: document.getElementById("pad-down"),
        padLeft: document.getElementById("pad-left"),
        padRight: document.getElementById("pad-right")
    };

    // Global Core Mutable State Object Variables
    let gridCount = parseInt(DOM.optGridDensity.value, 10);
    let cellSize = canvas.width / gridCount;
    
    let snake = [];
    let food = { x: 0, y: 0 };
    let headingVector = { x: 1, y: 0 };
    let inputBufferQueue = { x: 1, y: 0 };
    
    let currentScore = 0;
    let isActiveSession = false;
    let engineTickerIntervalId = null;

    // Cosmetic Swatch Configuration Parameters
    let cosmeticAppleStyle = "red";
    let cosmeticSnakeStyle = "blue";

    // Engine Audio Synthesizer Controller Context Module Block
    const AudioEngine = {
        ctx: null,
        init() {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },
        playBip(freq, duration, type = "sine") {
            if (!DOM.optAudioToggle.checked) return;
            this.init();
            try {
                let osc = this.ctx.createOscillator();
                let gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) { console.warn("Audio Context blocked by policy matrix triggers."); }
        }
    };

    // User Profile Scoreboard Metrics Storage Handlers Object
    let profileStore = JSON.parse(localStorage.getItem("g-snake-profile-suite")) || {
        highScore: 0, runs: 0, apples: 0, steps: 0, accumulatedScores: 0
    };

    function synchronizedStatsViewDOMUpdates() {
        DOM.high.textContent = String(profileStore.highScore).padStart(3, '0');
        DOM.statTotalRuns.textContent = profileStore.runs;
        DOM.statTotalApples.textContent = profileStore.apples;
        DOM.statTotalSteps.textContent = profileStore.steps;
        
        let calculationAvg = profileStore.runs > 0 ? Math.round(profileStore.accumulatedScores / profileStore.runs) : 0;
        document.getElementById("profile-avg-score").textContent = calculationAvg;
    }

    function paintRenderCanvasLoopFrameCycle() {
        cellSize = canvas.width / gridCount;
        
        // Render two-tone geometric checkered vector board blocks maps
        for (let r = 0; r < gridCount; r++) {
            for (let c = 0; c < gridCount; c++) {
                ctx.fillStyle = (r + c) % 2 === 0 ? "#aad751" : "#a2d149";
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }

        // Render target apple entity layout
        ctx.fillStyle = cosmeticAppleStyle === "gold" ? "#fbbc05" : "#e93b16";
        ctx.beginPath();
        let targetRadiusOffset = cellSize / 2 - 2;
        let cX = food.x * cellSize + cellSize / 2;
        let cY = food.y * cellSize + cellSize / 2;
        ctx.arc(cX, cY, targetRadiusOffset, 0, 2 * Math.PI);
        ctx.fill();

        // Secondary Pass Stem Element Overlay Detail Accent Decoration
        ctx.strokeStyle = "#224411";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cX, cY - targetRadiusOffset);
        ctx.quadraticCurveTo(cX + 3, cY - targetRadiusOffset - 4, cX + 5, cY - targetRadiusOffset - 3);
        ctx.stroke();

        // Render Snake coordinate structures
        snake.forEach((part, index) => {
            if (index === 0) {
                ctx.fillStyle = cosmeticSnakeStyle === "purple" ? "#7e22ce" : "#3b82f6";
                ctx.fillRect(part.x * cellSize + 1, part.y * cellSize + 1, cellSize - 2, cellSize - 2);
                
                // Add minimal eye nodes indicator to clarify alignment headings paths
                ctx.fillStyle = "#ffffff";
                let eyeOffsetSize = 3;
                if (headingVector.x !== 0) { // Moving Horizontally
                    ctx.fillRect(part.x * cellSize + cellSize/2, part.y * cellSize + 4, eyeOffsetSize, eyeOffsetSize);
                    ctx.fillRect(part.x * cellSize + cellSize/2, part.y * cellSize + cellSize - 7, eyeOffsetSize, eyeOffsetSize);
                } else { // Moving Vertically
                    ctx.fillRect(part.x * cellSize + 4, part.y * cellSize + cellSize/2, eyeOffsetSize, eyeOffsetSize);
                    ctx.fillRect(part.x * cellSize + cellSize - 7, part.y * cellSize + cellSize/2, eyeOffsetSize, eyeOffsetSize);
                }
            } else {
                ctx.fillStyle = cosmeticSnakeStyle === "purple" ? "#a855f7" : "#60a5fa";
                ctx.fillRect(part.x * cellSize + 2, part.y * cellSize + 2, cellSize - 4, cellSize - 4);
            }
        });
    }

    function processEngineClockCycleStepTick() {
        headingVector = inputBufferQueue;
        
        let currentHeadNode = snake[0];
        let projectedNewHeadNode = { x: currentHeadNode.x + headingVector.x, y: currentHeadNode.y + headingVector.y };

        profileStore.steps++;

        // Edge Bounds Wrap Constraints vs Definite Crash Matrix Evaluation Logic Blocks
        if (DOM.optWrapToggle.checked) {
            if (projectedNewHeadNode.x < 0) projectedNewHeadNode.x = gridCount - 1;
            else if (projectedNewHeadNode.x >= gridCount) projectedNewHeadNode.x = 0;
            
            if (projectedNewHeadNode.y < 0) projectedNewHeadNode.y = gridCount - 1;
            else if (projectedNewHeadNode.y >= gridCount) projectedNewHeadNode.y = 0;
        } else {
            if (projectedNewHeadNode.x < 0 || projectedNewHeadNode.x >= gridCount || projectedNewHeadNode.y < 0 || projectedNewHeadNode.y >= gridCount) {
                executeGameOverSequence();
                return;
            }
        }

        // Evaluate intersection limits checks against existing body array allocations
        for (let segment of snake) {
            if (segment.x === projectedNewHeadNode.x && segment.y === projectedNewHeadNode.y) {
                executeGameOverSequence();
                return;
            }
        }

        // Shift vector structures unshift transitions nodes allocations array
        snake.unshift(projectedNewHeadNode);

        // Apple processing consumption verification blocks
        if (projectedNewHeadNode.x === food.x && projectedNewHeadNode.y === food.y) {
            currentScore++;
            profileStore.apples++;
            DOM.score.textContent = String(currentScore).padStart(3, '0');
            AudioEngine.playBip(587.33, 0.12, "sine"); // High-pitched clean tone (D5)
            triggerAppleRepositioningAssignment();
        } else {
            snake.pop();
        }

        paintRenderCanvasLoopFrameCycle();
    }

    function triggerAppleRepositioningAssignment() {
        while (true) {
            let potentialCoordinate = {
                x: Math.floor(Math.random() * gridCount),
                y: Math.floor(Math.random() * gridCount)
            };
            let collisionConflict = snake.some(s => s.x === potentialCoordinate.x && s.y === potentialCoordinate.y);
            if (!collisionConflict) {
                food = potentialCoordinate;
                break;
            }
        }
    }

    function executeInitializationSequenceStart() {
        DOM.overlay.classList.remove("state-visible");
        currentScore = 0;
        DOM.score.textContent = "000";
        
        gridCount = parseInt(DOM.optGridDensity.value, 10);
        let dynamicCenterPivot = Math.floor(gridCount / 2);

        snake = [
            { x: dynamicCenterPivot, y: dynamicCenterPivot },
            { x: dynamicCenterPivot - 1, y: dynamicCenterPivot },
            { x: dynamicCenterPivot - 2, y: dynamicCenterPivot }
        ];

        headingVector = { x: 1, y: 0 };
        inputBufferQueue = { x: 1, y: 0 };

        triggerAppleRepositioningAssignment();
        
        clearInterval(engineTickerIntervalId);
        let calculatedPacingInterval = parseInt(DOM.optGameSpeed.value, 10);
        engineTickerIntervalId = setInterval(processEngineClockCycleStepTick, calculatedPacingInterval);
        
        isActiveSession = true;
        paintRenderCanvasLoopFrameCycle();
    }

    function executeGameOverSequence() {
        clearInterval(engineTickerIntervalId);
        isActiveSession = false;
        AudioEngine.playBip(220.00, 0.35, "sawtooth"); // Deep low crash warning tone (A3)

        profileStore.runs++;
        profileStore.accumulatedScores += currentScore;

        if (currentScore > profileStore.highScore) {
            profileStore.highScore = currentScore;
        }

        localStorage.setItem("g-snake-profile-suite", JSON.stringify(profileStore));
        synchronizedStatsViewDOMUpdates();

        DOM.overlayHeading.textContent = "GAME OVER";
        DOM.overlay.classList.add("state-visible");
    }

    function interceptInputTriggersRouting(actionDirectionKey) {
        if (!isActiveSession) return;

        // Block backward axis tracking modifications directly onto oneself
        switch(actionDirectionKey) {
            case "UP":
                if (headingVector.y === 0) inputBufferQueue = { x: 0, y: -1 };
                break;
            case "DOWN":
                if (headingVector.y === 0) inputBufferQueue = { x: 0, y: 1 };
                break;
            case "LEFT":
                if (headingVector.x === 0) inputBufferQueue = { x: -1, y: 0 };
                break;
            case "RIGHT":
                if (headingVector.x === 0) inputBufferQueue = { x: 1, y: 0 };
                break;
        }
    }

    function setupSystemBindingsEventListenersHooks() {
        // Hardware Keyboard Interceptor Triggers
        window.addEventListener("keydown", (e) => {
            let k = e.key;
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d"].includes(k)) {
                e.preventDefault(); // Extinguish scrolling defaults layouts parameters
            }

            if (!isActiveSession && k === " ") {
                executeInitializationSequenceStart();
                return;
            }

            if (k === "ArrowUp" || k === "w") interceptInputTriggersRouting("UP");
            else if (k === "ArrowDown" || k === "s") interceptInputTriggersRouting("DOWN");
            else if (k === "ArrowLeft" || k === "a") interceptInputTriggersRouting("LEFT");
            else if (k === "ArrowRight" || k === "d") interceptInputTriggersRouting("RIGHT");
        });

        // Virtual Screen Controls D-Pad Interaction Hub Bindings
        DOM.padUp.onclick = () => interceptInputTriggersRouting("UP");
        DOM.padDown.onclick = () => interceptInputTriggersRouting("DOWN");
        DOM.padLeft.onclick = () => interceptInputTriggersRouting("LEFT");
        DOM.padRight.onclick = () => interceptInputTriggersRouting("RIGHT");

        // Primary Core Framework Layout Drawer Sliders Triggers Controls
        DOM.btnMenuToggle.onclick = () => DOM.drawerSettings.classList.add("open");
        DOM.btnCloseSettings.onclick = () => DOM.drawerSettings.classList.remove("open");
        DOM.btnStatsToggle.onclick = () => { synchronizedStatsViewDOMUpdates(); DOM.drawerStats.classList.add("open"); };
        DOM.btnCloseStats.onclick = () => DOM.drawerStats.classList.remove("open");

        // Configuration Control Form Value Trackers
        DOM.optGridDensity.onchange = () => { gridCount = parseInt(DOM.optGridDensity.value, 10); paintRenderCanvasLoopFrameCycle(); };
        
        DOM.btnResetProfile.onclick = () => {
            if (confirm("Are you certain you wish to wipe out all localized scores profiles metrics snapshots arrays?")) {
                profileStore = { highScore: 0, runs: 0, apples: 0, steps: 0, accumulatedScores: 0 };
                localStorage.setItem("g-snake-profile-suite", JSON.stringify(profileStore));
                synchronizedStatsViewDOMUpdates();
            }
        };

        // Cosmetic Options Preselectors Selection Interceptor Logic Block
        const preselectorsCards = document.querySelectorAll(".selector-card");
        preselectorsCards.forEach(card => {
            card.onclick = () => {
                let segmentCategoryType = card.getAttribute("data-type");
                let internalTargetValue = card.getAttribute("data-val");

                // Clear structural sibling classes configuration nodes
                preselectorsCards.forEach(c => {
                    if (c.getAttribute("data-type") === segmentCategoryType) c.classList.remove("active");
                });
                card.classList.add("active");

                if (segmentCategoryType === "apple") cosmeticAppleStyle = internalTargetValue;
                if (segmentCategoryType === "snake") cosmeticSnakeStyle = internalTargetValue;

                paintRenderCanvasLoopFrameCycle();
            };
        });

        DOM.btnPlay.onclick = executeInitializationSequenceStart;
    }

    // Initialize Startup System Layout Context Rendering Pipelines
    setupSystemBindingsEventListenersHooks();
    synchronizedStatsViewDOMUpdates();
    paintRenderCanvasLoopFrameCycle();
})();
