// Crossword Puzzle App - Frontend Logic

class CrosswordApp {
    constructor() {
        this.currentPuzzle = null;
        this.gridSize = 9;
        this.difficulty = 'medium';
        this.generatorMode = 'standard';
        this.userGrid = [];
        this.currentDirection = 'across'; // Track cursor direction
        this.currentCell = null; // Track active cell {row, col}
        this.wordMap = null; // Map cells to words

        // DOM elements
        this.generateBtn = document.getElementById('generateBtn');
        this.checkBtn = document.getElementById('checkBtn');
        this.revealBtn = document.getElementById('revealBtn');
        this.gridSizeSelect = document.getElementById('gridSize');
        this.difficultySelect = document.getElementById('difficulty');
        this.gridContainer = document.getElementById('gridContainer');
        this.acrossClues = document.getElementById('acrossClues');
        this.downClues = document.getElementById('downClues');
        this.messageDiv = document.getElementById('message');
        this.directionIndicator = document.getElementById('directionIndicator');
        this.directionText = document.getElementById('directionText');
        this.metricsContainer = document.getElementById('metrics');
        this.metricMode = document.getElementById('metric-mode');
        this.metricTime = document.getElementById('metric-time');
        this.metricWords = document.getElementById('metric-words');
        this.metricSize = document.getElementById('metric-size');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.generateBtn.addEventListener('click', () => this.generatePuzzle());
        this.checkBtn.addEventListener('click', () => this.checkSolution());
        this.revealBtn.addEventListener('click', () => this.revealSolution());
        this.gridSizeSelect.addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
        });
        this.difficultySelect.addEventListener('change', (e) => {
            this.difficulty = e.target.value;
        });

        // Generator mode radio buttons
        const modeRadios = document.querySelectorAll('input[name="generatorMode"]');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.generatorMode = e.target.value;
            });
        });
    }

    async generatePuzzle() {
        try {
            this.showMessage('Generating puzzle...', 'info');
            this.generateBtn.disabled = true;

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    grid_size: this.gridSize,
                    difficulty: this.difficulty,
                    mode: this.generatorMode
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate puzzle');
            }

            this.currentPuzzle = await response.json();
            this.initializeUserGrid();
            this.renderPuzzle();
            this.enableButtons();

            // Display metrics if available
            if (this.currentPuzzle.metrics) {
                this.displayMetrics(this.currentPuzzle.metrics);
            }

            this.showMessage(`Puzzle generated successfully! Difficulty: ${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)}. Start solving.`, 'success');

        } catch (error) {
            console.error('Error generating puzzle:', error);
            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.generateBtn.disabled = false;
        }
    }

    initializeUserGrid() {
        this.userGrid = Array(this.currentPuzzle.size)
            .fill(null)
            .map(() => Array(this.currentPuzzle.size).fill(''));
    }

    buildWordMap() {
        // Build a map of cells to words that pass through them
        this.wordMap = {};
        const { clues } = this.currentPuzzle;

        console.log('buildWordMap called');
        console.log('Across clues:', clues.across);
        console.log('Down clues:', clues.down);

        // Process across words
        clues.across.forEach(clue => {
            const { row, col, length } = clue;
            console.log(`Processing across word at (${row}, ${col}), length ${length}`);
            for (let i = 0; i < length; i++) {
                const key = `${row}-${col + i}`;
                if (!this.wordMap[key]) {
                    this.wordMap[key] = { across: null, down: null };
                }
                this.wordMap[key].across = clue;
            }
        });

        // Process down words
        clues.down.forEach(clue => {
            const { row, col, length } = clue;
            console.log(`Processing down word at (${row}, ${col}), length ${length}`);
            for (let i = 0; i < length; i++) {
                const key = `${row + i}-${col}`;
                if (!this.wordMap[key]) {
                    this.wordMap[key] = { across: null, down: null };
                }
                this.wordMap[key].down = clue;
            }
        });

        console.log('Final wordMap:', this.wordMap);
    }

    renderPuzzle() {
        if (!this.currentPuzzle) return;

        // Build word map for directional navigation
        this.buildWordMap();

        // Render grid
        this.renderGrid();

        // Render clues
        this.renderClues();

        // Show direction indicator
        this.directionIndicator.classList.add('active');
        this.updateDirectionDisplay();
    }

    updateDirectionDisplay() {
        if (this.directionText) {
            this.directionText.textContent = this.currentDirection === 'across' ? 'Across' : 'Down';
        }
    }

    renderGrid() {
        const { grid, size } = this.currentPuzzle;

        // Set grid template
        this.gridContainer.style.gridTemplateColumns = `repeat(${size}, 40px)`;
        this.gridContainer.style.gridTemplateRows = `repeat(${size}, 40px)`;

        // Clear existing grid
        this.gridContainer.innerHTML = '';

        // Create cells
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const cellData = grid[row][col];
                const cell = this.createCell(row, col, cellData);
                this.gridContainer.appendChild(cell);
            }
        }
    }

    createCell(row, col, cellData) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        if (cellData.blocked) {
            cell.classList.add('blocked');
            return cell;
        }

        // Add cell number if present
        if (cellData.number) {
            const numberSpan = document.createElement('span');
            numberSpan.className = 'cell-number';
            numberSpan.textContent = cellData.number;
            cell.appendChild(numberSpan);
        }

        // Add input field
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        input.dataset.row = row;
        input.dataset.col = col;

        // Event listeners for navigation
        input.addEventListener('input', (e) => this.handleInput(e, row, col));
        input.addEventListener('keydown', (e) => this.handleKeydown(e, row, col));
        input.addEventListener('focus', (e) => this.handleFocus(e, row, col));
        input.addEventListener('blur', () => this.clearHighlights());
        input.addEventListener('click', (e) => this.handleCellClick(e, row, col));

        cell.appendChild(input);
        return cell;
    }

    handleCellClick(event, row, col) {
        // If clicking the same cell, toggle direction
        if (this.currentCell && this.currentCell.row === row && this.currentCell.col === col) {
            this.toggleDirection(row, col);
        } else {
            // New cell - determine best direction
            this.setDirectionForCell(row, col);
        }
    }

    handleFocus(event, row, col) {
        this.currentCell = { row, col };
        this.highlightCurrentWord(row, col);
    }

    setDirectionForCell(row, col) {
        const key = `${row}-${col}`;
        const words = this.wordMap[key];

        if (!words) return;

        // If only one direction available, use it
        if (words.across && !words.down) {
            this.currentDirection = 'across';
        } else if (words.down && !words.across) {
            this.currentDirection = 'down';
        }
        // Otherwise keep current direction if valid, or default to across
        else if (words.across && words.down) {
            if (!words[this.currentDirection]) {
                this.currentDirection = 'across';
            }
        }

        this.updateDirectionDisplay();
        this.highlightCurrentWord(row, col);
    }

    toggleDirection(row, col) {
        const key = `${row}-${col}`;
        const words = this.wordMap[key];

        if (!words) return;

        // Toggle between across and down if both are available
        if (words.across && words.down) {
            this.currentDirection = this.currentDirection === 'across' ? 'down' : 'across';
            this.updateDirectionDisplay();
            this.highlightCurrentWord(row, col);
        }
    }

    handleInput(event, row, col) {
        const input = event.target;
        let value = input.value.toUpperCase();

        // Only allow letters
        value = value.replace(/[^A-Z]/g, '');
        input.value = value;

        // Update user grid
        this.userGrid[row][col] = value;
    }

    handleKeydown(event, row, col) {
        const key = event.key;

        // Spacebar toggles direction
        if (key === ' ') {
            event.preventDefault();
            this.toggleDirection(row, col);
            return;
        }

        // Handle letter keys - manually set value and auto-advance
        if (key.length === 1 && /[a-zA-Z]/.test(key)) {
            event.preventDefault(); // Prevent default to control behavior
            const input = event.target;
            const letter = key.toUpperCase();

            console.log(`Letter key pressed: ${letter} at (${row}, ${col}), direction: ${this.currentDirection}`);

            // Manually set the input value
            input.value = letter;
            this.userGrid[row][col] = letter;

            // Immediately advance to next cell
            console.log('Attempting to move in direction:', this.currentDirection);
            this.moveInDirection(row, col, this.currentDirection);
            return;
        }

        // Handle arrow keys
        if (key === 'ArrowRight') {
            event.preventDefault();
            this.moveFocus(row, col, 0, 1);
        } else if (key === 'ArrowLeft') {
            event.preventDefault();
            this.moveFocus(row, col, 0, -1);
        } else if (key === 'ArrowDown') {
            event.preventDefault();
            this.moveFocus(row, col, 1, 0);
        } else if (key === 'ArrowUp') {
            event.preventDefault();
            this.moveFocus(row, col, -1, 0);
        } else if (key === 'Backspace' && !event.target.value) {
            event.preventDefault();
            this.moveInDirection(row, col, this.currentDirection, true); // Move backward
        }
    }

    moveFocus(row, col, rowDelta, colDelta) {
        const size = this.currentPuzzle.size;
        let newRow = row + rowDelta;
        let newCol = col + colDelta;

        // Find next non-blocked cell
        while (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
            if (!this.currentPuzzle.grid[newRow][newCol].blocked) {
                const input = this.gridContainer.querySelector(
                    `input[data-row="${newRow}"][data-col="${newCol}"]`
                );
                if (input) {
                    input.focus();
                    input.select();
                }
                return;
            }
            newRow += rowDelta;
            newCol += colDelta;
        }
    }

    moveInDirection(row, col, direction, backward = false) {
        console.log(`moveInDirection called: row=${row}, col=${col}, direction=${direction}, backward=${backward}`);
        const key = `${row}-${col}`;
        const words = this.wordMap[key];
        console.log('wordMap for this cell:', words);

        if (!words || !words[direction]) {
            console.log('No words found for this direction');
            return;
        }

        const word = words[direction];
        const { row: wordRow, col: wordCol, length } = word;
        console.log(`Word info: row=${wordRow}, col=${wordCol}, length=${length}`);

        let nextRow, nextCol;

        if (direction === 'across') {
            const currentIndex = col - wordCol;
            const nextIndex = backward ? currentIndex - 1 : currentIndex + 1;
            console.log(`Across: currentIndex=${currentIndex}, nextIndex=${nextIndex}`);

            if (nextIndex >= 0 && nextIndex < length) {
                nextRow = row;
                nextCol = wordCol + nextIndex;
            }
        } else { // down
            const currentIndex = row - wordRow;
            const nextIndex = backward ? currentIndex - 1 : currentIndex + 1;
            console.log(`Down: currentIndex=${currentIndex}, nextIndex=${nextIndex}`);

            if (nextIndex >= 0 && nextIndex < length) {
                nextRow = wordRow + nextIndex;
                nextCol = col;
            }
        }

        console.log(`Next cell: nextRow=${nextRow}, nextCol=${nextCol}`);

        if (nextRow !== undefined && nextCol !== undefined) {
            const input = this.gridContainer.querySelector(
                `input[data-row="${nextRow}"][data-col="${nextCol}"]`
            );
            console.log('Found input element:', input);
            if (input) {
                input.focus();
                input.select();
                console.log('Focused and selected next input');
            }
        }
    }

    highlightCurrentWord(row, col) {
        // Clear previous highlights
        this.clearHighlights();

        const key = `${row}-${col}`;
        const words = this.wordMap[key];
        if (!words || !words[this.currentDirection]) return;

        const word = words[this.currentDirection];
        const { row: wordRow, col: wordCol, length } = word;

        // Highlight all cells in the current word
        for (let i = 0; i < length; i++) {
            let cellRow, cellCol;

            if (this.currentDirection === 'across') {
                cellRow = wordRow;
                cellCol = wordCol + i;
            } else {
                cellRow = wordRow + i;
                cellCol = wordCol;
            }

            const cell = this.gridContainer.querySelector(
                `.grid-cell[data-row="${cellRow}"][data-col="${cellCol}"]`
            );
            if (cell && !cell.classList.contains('blocked')) {
                cell.classList.add('highlighted');
            }
        }
    }

    clearHighlights() {
        const highlighted = this.gridContainer.querySelectorAll('.highlighted');
        highlighted.forEach(cell => cell.classList.remove('highlighted'));
    }

    renderClues() {
        const { clues } = this.currentPuzzle;

        // Render across clues
        this.acrossClues.innerHTML = clues.across
            .map(clue => this.createClueHTML(clue))
            .join('');

        // Render down clues
        this.downClues.innerHTML = clues.down
            .map(clue => this.createClueHTML(clue))
            .join('');
    }

    createClueHTML(clue) {
        return `
            <div class="clue-item">
                <span class="clue-number">${clue.number}.</span>
                <span class="clue-text">${clue.clue}</span>
                <span class="clue-length">(${clue.length})</span>
            </div>
        `;
    }

    async checkSolution() {
        try {
            this.checkBtn.disabled = true;

            const response = await fetch('/api/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    grid: this.userGrid
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to check solution');
            }

            const result = await response.json();
            this.displayCheckResult(result);

        } catch (error) {
            console.error('Error checking solution:', error);
            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.checkBtn.disabled = false;
        }
    }

    displayCheckResult(result) {
        // Clear previous highlighting
        const cells = this.gridContainer.querySelectorAll('.grid-cell');
        cells.forEach(cell => {
            cell.classList.remove('correct', 'incorrect');
        });

        if (result.correct) {
            this.showMessage(
                `🎉 Congratulations! Puzzle completed! (100%)`,
                'success'
            );
        } else {
            // Highlight incorrect cells
            result.errors.forEach(error => {
                const cell = this.gridContainer.querySelector(
                    `.grid-cell[data-row="${error.row}"][data-col="${error.col}"]`
                );
                if (cell) {
                    cell.classList.add('incorrect');
                }
            });

            this.showMessage(
                `Progress: ${result.correctCount}/${result.totalCount} (${result.percentage}%) - ${result.errors.length} error(s) found`,
                'info'
            );
        }
    }

    async revealSolution() {
        if (!confirm('Are you sure you want to reveal the solution? This will show all answers.')) {
            return;
        }

        try {
            this.revealBtn.disabled = true;

            const response = await fetch('/api/reveal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to reveal solution');
            }

            const result = await response.json();
            this.fillSolution(result.solution);
            this.showMessage('Solution revealed!', 'info');

        } catch (error) {
            console.error('Error revealing solution:', error);
            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            this.revealBtn.disabled = false;
        }
    }

    fillSolution(solution) {
        const size = this.currentPuzzle.size;

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const letter = solution[row][col];
                if (letter) {
                    this.userGrid[row][col] = letter;
                    const input = this.gridContainer.querySelector(
                        `input[data-row="${row}"][data-col="${col}"]`
                    );
                    if (input) {
                        input.value = letter;
                    }
                }
            }
        }
    }

    enableButtons() {
        this.checkBtn.disabled = false;
        this.revealBtn.disabled = false;
    }

    showMessage(text, type) {
        this.messageDiv.textContent = text;
        this.messageDiv.className = `message ${type}`;

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.messageDiv.className = 'message';
            }, 5000);
        }
    }

    displayMetrics(metrics) {
        // Show metrics container
        this.metricsContainer.style.display = 'block';

        // Update metric values
        this.metricMode.textContent = metrics.mode === 'standard' ? 'Standard Generator' : 'Advanced Heuristics';
        this.metricTime.textContent = `${metrics.generation_time}s`;
        this.metricWords.textContent = metrics.word_count;
        this.metricSize.textContent = `${metrics.grid_size}x${metrics.grid_size}`;

        // Add color coding for mode
        if (metrics.mode === 'advanced') {
            this.metricMode.style.color = '#667eea';
        } else {
            this.metricMode.style.color = '#48bb78';
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new CrosswordApp();
});
