// Crossword Puzzle App - Frontend Logic

class CrosswordApp {
    constructor() {
        this.currentPuzzle = null;
        this.gridSize = 9;
        this.userGrid = [];

        // DOM elements
        this.generateBtn = document.getElementById('generateBtn');
        this.checkBtn = document.getElementById('checkBtn');
        this.revealBtn = document.getElementById('revealBtn');
        this.gridSizeSelect = document.getElementById('gridSize');
        this.gridContainer = document.getElementById('gridContainer');
        this.acrossClues = document.getElementById('acrossClues');
        this.downClues = document.getElementById('downClues');
        this.messageDiv = document.getElementById('message');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.generateBtn.addEventListener('click', () => this.generatePuzzle());
        this.checkBtn.addEventListener('click', () => this.checkSolution());
        this.revealBtn.addEventListener('click', () => this.revealSolution());
        this.gridSizeSelect.addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
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
                    grid_size: this.gridSize
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
            this.showMessage('Puzzle generated successfully! Start solving.', 'success');

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

    renderPuzzle() {
        if (!this.currentPuzzle) return;

        // Render grid
        this.renderGrid();

        // Render clues
        this.renderClues();
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
        input.addEventListener('focus', () => this.highlightRelatedCells(row, col));
        input.addEventListener('blur', () => this.clearHighlights());

        cell.appendChild(input);
        return cell;
    }

    handleInput(event, row, col) {
        const input = event.target;
        let value = input.value.toUpperCase();

        // Only allow letters
        value = value.replace(/[^A-Z]/g, '');
        input.value = value;

        // Update user grid
        this.userGrid[row][col] = value;

        // Auto-advance to next cell
        if (value) {
            this.moveToNextCell(row, col);
        }
    }

    handleKeydown(event, row, col) {
        const key = event.key;

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
            this.moveToPreviousCell(row, col);
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

    moveToNextCell(row, col) {
        // Try to move right first, then down
        this.moveFocus(row, col, 0, 1);
    }

    moveToPreviousCell(row, col) {
        // Try to move left first, then up
        this.moveFocus(row, col, 0, -1);
    }

    highlightRelatedCells(row, col) {
        // Could be enhanced to highlight cells in the same word
        // For now, just basic functionality
    }

    clearHighlights() {
        // Clear any highlights
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
                }
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new CrosswordApp();
});
