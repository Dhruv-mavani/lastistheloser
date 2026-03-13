class ChallengeUI {
    constructor(gameContainer, onComplete) {
        this.container = gameContainer;
        this.onComplete = onComplete;
        this.startTime = 0;
    }

    clear() {
        this.container.innerHTML = '';
    }

    startChallenge(challenge) {
        this.clear();
        this.startTime = Date.now();

        switch (challenge.type) {
            case 'CLICK':
                this.renderClick(challenge);
                break;
            case 'COLOR_MATCH':
                this.renderColorMatch(challenge);
                break;
            case 'TYPE':
                this.renderTypeChallenge(challenge);
                break;
            case 'WAIT_TRAP':
                this.renderWaitTrap(challenge);
                break;
            case 'MOVING_TARGET':
                this.renderMovingTarget(challenge);
                break;
            case 'MATH':
                this.renderMathChallenge(challenge);
                break;
            case 'SEQUENCE':
                this.renderSequenceChallenge(challenge);
                break;
            case 'REACTION_FAST':
                this.renderReactionFast(challenge);
                break;
            case 'SHAPE_CLICK':
                this.renderShapeClick(challenge);
                break;
            case 'FIND_NUMBER':
                this.renderFindNumber(challenge);
                break;
        }
    }

    renderClick(challenge) {
        const btn = document.createElement('button');
        btn.className = 'btn primary large-challenge-btn';
        btn.innerText = challenge.instruction;
        btn.onclick = () => {
            const reactionTime = Date.now() - this.startTime;
            this.onComplete({ reactionTime, valid: true });
        };
        this.container.appendChild(btn);
    }

    renderColorMatch(challenge) {
        const instruction = document.createElement('h2');
        instruction.innerText = challenge.instruction;
        instruction.className = 'challenge-instruction';
        this.container.appendChild(instruction);

        const grid = document.createElement('div');
        grid.className = 'color-grid';

        challenge.colors.forEach(color => {
            const circle = document.createElement('div');
            circle.className = `color-circle ${color.toLowerCase()}`;
            circle.onclick = () => {
                const reactionTime = Date.now() - this.startTime;
                this.onComplete({ reactionTime, valid: color === challenge.targetColor });
            };
            grid.appendChild(circle);
        });

        this.container.appendChild(grid);
    }

    renderTypeChallenge(challenge) {
        const instruction = document.createElement('h2');
        instruction.innerText = challenge.instruction;
        this.container.appendChild(instruction);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'type-challenge-input';
        input.autofocus = true;

        input.oninput = () => {
            if (input.value.toUpperCase() === challenge.targetWord) {
                const reactionTime = Date.now() - this.startTime;
                this.onComplete({ reactionTime, valid: true });
            }
        };

        this.container.appendChild(input);
        setTimeout(() => input.focus(), 100);
    }

    renderWaitTrap(challenge) {
        const instruction = document.createElement('h2');
        instruction.innerText = 'DO NOT CLICK... WAIT';
        this.container.appendChild(instruction);

        const trapBtn = document.createElement('button');
        trapBtn.className = 'btn error trap-btn';
        trapBtn.innerText = 'WAIT...';

        let trapActivated = false;

        trapBtn.onclick = () => {
            if (!trapActivated) {
                this.onComplete({ reactionTime: 0, valid: false });
            } else {
                const reactionTime = Date.now() - this.activationTime;
                this.onComplete({ reactionTime, valid: true });
            }
        };

        this.container.appendChild(trapBtn);

        setTimeout(() => {
            trapActivated = true;
            this.activationTime = Date.now();
            instruction.innerText = 'CLICK NOW!';
            instruction.style.color = 'var(--primary-accent)';
            trapBtn.innerText = 'CLICK!';
            trapBtn.classList.remove('error');
            trapBtn.classList.add('primary');
        }, challenge.delay);
    }

    renderMovingTarget(challenge) {
        const target = document.createElement('div');
        target.className = 'moving-target';
        target.innerText = 'HIT ME';

        target.style.left = '50%';
        target.style.top = '50%';

        let angle = Math.random() * Math.PI * 2;
        let x = 50, y = 50;
        const speed = challenge.speed;

        const move = () => {
            x += Math.cos(angle) * speed;
            y += Math.sin(angle) * speed;

            if (x < 10 || x > 90) angle = Math.PI - angle;
            if (y < 20 || y > 80) angle = -angle;

            target.style.left = x + '%';
            target.style.top = y + '%';
            this.moveAnim = requestAnimationFrame(move);
        };
        this.moveAnim = requestAnimationFrame(move);

        target.onclick = () => {
            cancelAnimationFrame(this.moveAnim);
            const reactionTime = Date.now() - this.startTime;
            this.onComplete({ reactionTime, valid: true });
        };

        this.container.appendChild(target);
    }

    renderMathChallenge(challenge) {
        const instruction = document.createElement('h2');
        instruction.innerText = challenge.instruction;
        this.container.appendChild(instruction);

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'type-challenge-input';
        input.oninput = () => {
            if (parseInt(input.value) === challenge.answer) {
                const reactionTime = Date.now() - this.startTime;
                this.onComplete({ reactionTime, valid: true });
            }
        };
        this.container.appendChild(input);
        setTimeout(() => input.focus(), 100);
    }

    renderReactionFast(challenge) {
        this.container.innerHTML = '<h1>READY...</h1>';
        setTimeout(() => {
            this.activationTime = Date.now();
            this.container.innerHTML = '<h1 class="green-text">CLICK NOW!</h1>';
            this.container.style.backgroundColor = 'var(--primary-accent)';

            const btn = document.createElement('div');
            btn.style.position = 'absolute';
            btn.style.top = '0'; btn.style.left = '0';
            btn.style.width = '100%'; btn.style.height = '100%';
            btn.onclick = () => {
                const reactionTime = Date.now() - this.activationTime;
                this.container.style.backgroundColor = 'transparent';
                this.onComplete({ reactionTime, valid: true });
            };
            this.container.appendChild(btn);
        }, challenge.delay);
    }

    renderSequenceChallenge(challenge) {
        const instruction = document.createElement('h2');
        instruction.innerText = 'REPEAT THE SEQUENCE';
        this.container.appendChild(instruction);

        const buttons = [];
        const grid = document.createElement('div');
        grid.className = 'color-grid';

        for (let i = 0; i < 4; i++) {
            const b = document.createElement('div');
            b.className = `color-circle ${['red', 'blue', 'green', 'yellow'][i]}`;
            buttons.push(b);
            grid.appendChild(b);
        }
        this.container.appendChild(grid);

        // Play sequence
        let i = 0;
        const play = setInterval(() => {
            const colorIdx = challenge.sequence[i];
            buttons[colorIdx].style.opacity = '0.5';
            setTimeout(() => buttons[colorIdx].style.opacity = '1', 300);
            i++;
            if (i >= challenge.sequence.length) {
                clearInterval(play);
                this.enableSequenceInput(buttons, challenge.sequence);
            }
        }, 600);
    }

    enableSequenceInput(buttons, sequence) {
        let inputIdx = 0;
        buttons.forEach((btn, idx) => {
            btn.onclick = () => {
                if (idx === sequence[inputIdx]) {
                    inputIdx++;
                    if (inputIdx === sequence.length) {
                        const reactionTime = Date.now() - this.startTime;
                        this.onComplete({ reactionTime, valid: true });
                    }
                } else {
                    this.onComplete({ reactionTime: 0, valid: false });
                }
            };
        });
    }

    renderShapeClick(challenge) {
        const instruction = document.createElement('h2');
        instruction.innerText = challenge.instruction;
        this.container.appendChild(instruction);

        const shapes = ['SQUARE', 'CIRCLE', 'TRIANGLE', 'STAR'];
        const grid = document.createElement('div');
        grid.className = 'color-grid';

        shapes.forEach(shape => {
            const s = document.createElement('div');
            s.className = `shape-item ${shape.toLowerCase()}`;
            s.innerText = shape;
            s.onclick = () => {
                const reactionTime = Date.now() - this.startTime;
                this.onComplete({ reactionTime, valid: shape === challenge.targetShape });
            };
            grid.appendChild(s);
        });
        this.container.appendChild(grid);
    }

    renderFindNumber(challenge) {
        const instruction = document.createElement('h2');
        instruction.innerText = challenge.instruction;
        this.container.appendChild(instruction);

        const grid = document.createElement('div');
        grid.className = 'color-grid';
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';

        challenge.numbers.forEach(num => {
            const n = document.createElement('div');
            n.className = 'btn secondary small-btn';
            n.innerText = num;
            n.onclick = () => {
                const reactionTime = Date.now() - this.startTime;
                this.onComplete({ reactionTime, valid: num === challenge.targetNum });
            };
            grid.appendChild(n);
        });
        this.container.appendChild(grid);
    }
}
