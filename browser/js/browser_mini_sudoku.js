// Board dimensions - 6 columns, 6 rows with 3x2 subsections
const BOARD_COLS = 2 * 3;
const BOARD_ROWS = 3 * 2;
const BOARD_SUB_COLS = 3;
const BOARD_SUB_ROWS = 2;
const BOARD_SIZE = BOARD_COLS * BOARD_ROWS; // 36 total cells

// Cell States
const CellState = {
    EMPTY: 'empty',
    ONE: '1',
    TWO: '2',
    THREE: '3',
    FOUR: '4',
    FIVE: '5',
    SIX: '6'
};

// Main solver class
class MiniSudokuSolver {
    constructor() {
        this.baseGameState = {
            board: Array(BOARD_ROWS).fill().map(() => Array(BOARD_COLS).fill().map(() => ({ contains: CellState.EMPTY })))
        };
        this.simulatedGameState = {
            board: Array(BOARD_ROWS).fill().map(() => Array(BOARD_COLS).fill().map(() => ({ contains: CellState.EMPTY })))
        };
        this.shouldStop = false;
    }

    stopSolving() {
        this.shouldStop = true;
    }

    async initialize() {
        // Click start game button if present
        const startButton = document.querySelector('#launch-footer-start-button');
        if (startButton) {
            startButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Click close tutorial button if present
        const closeTutorialButton = document.querySelector('.sudoku-tutorial-modal button.artdeco-modal__dismiss');
        if (closeTutorialButton) {
            closeTutorialButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Click skip tutorial button if present
        const skipTutorialButton = document.querySelector('[aria-label="Skip tutorial"]');
        if (skipTutorialButton) {
            skipTutorialButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Wait for board to appear
        let board = null;
        const startTime = Date.now();
        while (Date.now() - startTime < 5000) {
            board = document.querySelector('.sudoku-grid');
            if (board) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!board) {
            throw new Error('Board not found after initialization');
        }
    }

    async parseBoardState() {
        const state = {
            board: Array(BOARD_ROWS).fill().map(() => Array(BOARD_COLS).fill().map(() => ({ contains: CellState.EMPTY })))
        };

        // Get all cells and convert to 2D array
        const cells = document.querySelectorAll('.sudoku-cell');
        const cells2D = Array(BOARD_ROWS).fill().map(() => Array(BOARD_COLS).fill(null));

        cells.forEach((cell, index) => {
            const row = Math.floor(index / BOARD_COLS);
            const col = index % BOARD_COLS;
            if (row < BOARD_ROWS && col < BOARD_COLS) {
                cells2D[row][col] = cell;
            }
        });

        // Parse cells
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                const cell = cells2D[row][col];
                if (!cell) continue;

                // Parse cell content - look for numbers 1-6
                const cellContent = cell.querySelector('.sudoku-cell-content');
                if (cellContent) {
                    // Check if cell is empty
                    if (cellContent.textContent.trim() === '') {
                        state.board[row][col].contains = CellState.EMPTY;
                    } else {
                        state.board[row][col].contains = cellContent.textContent.trim();
                    }
                }
            }
        }

        return state;
    }

    // Check if a cell placement is valid according to sudoku rules
    isValidPlacement(row, col, number) {
        // Check row constraint - no duplicate numbers in the same row
        for (let c = 0; c < BOARD_COLS; c++) {
            if (c !== col && this.simulatedGameState.board[row][c].contains === number) {
                return false;
            }
        }

        // Check column constraint - no duplicate numbers in the same column
        for (let r = 0; r < BOARD_ROWS; r++) {
            if (r !== row && this.simulatedGameState.board[r][col].contains === number) {
                return false;
            }
        }

        // Check subregion constraint - check only the 3x2 subregion containing this cell
        const subRegionStartRow = Math.floor(row / BOARD_SUB_ROWS) * BOARD_SUB_ROWS;
        const subRegionStartCol = Math.floor(col / BOARD_SUB_COLS) * BOARD_SUB_COLS;

        for (let r = subRegionStartRow; r < subRegionStartRow + BOARD_SUB_ROWS; r++) {
            for (let c = subRegionStartCol; c < subRegionStartCol + BOARD_SUB_COLS; c++) {
                if ((r !== row || c !== col) && this.simulatedGameState.board[r][c].contains === number) {
                    return false;
                }
            }
        }

        return true;
    }

    // Place a number on the board
    placeNumber(row, col, number) {
        this.simulatedGameState.board[row][col].contains = number;
        return true;
    }

    // Get all valid numbers for a cell
    getValidNumbers(row, col) {
        const validNumbers = [];
        for (let num = 1; num <= 6; num++) {
            if (this.isValidPlacement(row, col, num.toString())) {
                validNumbers.push(num.toString());
            }
        }
        return validNumbers;
    }

    // Solve the puzzle using backtracking
    solvePuzzle() {
        if (this.shouldStop) return null;

        // Find empty cells
        const emptyCells = [];
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                if (this.simulatedGameState.board[row][col].contains === CellState.EMPTY) {
                    emptyCells.push([row, col]);
                }
            }
        }

        if (emptyCells.length === 0) {
            return [];
        }

        // Sort empty cells by number of valid options (heuristic)
        emptyCells.sort((a, b) => {
            const aValid = this.getValidNumbers(a[0], a[1]).length;
            const bValid = this.getValidNumbers(b[0], b[1]).length;
            return aValid - bValid; // Fewer options first
        });

        const solution = [];
        let attempts = 0;

        const solve = (index) => {
            if (this.shouldStop) return false;

            attempts++;
            if (index === emptyCells.length) {
                return true;
            }

            const [row, col] = emptyCells[index];

            // Try placing numbers 1-6
            for (let num = 1; num <= 6; num++) {
                const numberStr = num.toString();
                if (this.isValidPlacement(row, col, numberStr)) {
                    this.placeNumber(row, col, numberStr);
                    solution.push([row, col, numberStr]);

                    if (solve(index + 1)) {
                        return true;
                    }

                    solution.pop();
                    this.simulatedGameState.board[row][col].contains = CellState.EMPTY;
                }
            }

            return false;
        };

        if (solve(0)) {
            return solution;
        }
        return null;
    }

    async inputSolution(solution) {
        if (this.shouldStop) return false;

        if (!solution || solution.length === 0) {
            return true;
        }

        // Filter out cells that are already filled in the base game
        const newPlacements = solution.filter(([row, col, number]) =>
            this.baseGameState.board[row][col].contains === CellState.EMPTY
        );

        // Sort placements by row first, then column
        newPlacements.sort(([rowA, colA], [rowB, colB]) => {
            if (rowA !== rowB) return rowA - rowB;
            return colA - colB;
        });

        // Create mouse event helper function
        const createMouseEvent = (type) => new MouseEvent(type, {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        });

        // Input numbers directly instead of clicking multiple times
        for (const [row, col, number] of newPlacements) {
            if (this.shouldStop) return false;

            const cell = document.querySelector(`[data-cell-idx="${row * BOARD_COLS + col}"]`);
            if (cell) {
                // Skip if the target number is empty
                if (number === CellState.EMPTY || number === 'empty') {
                    continue;
                }

                // Click the cell to select/activate it
                cell.dispatchEvent(createMouseEvent('mousedown'));
                await new Promise(resolve => setTimeout(resolve, 10));
                cell.dispatchEvent(createMouseEvent('mouseup'));
                cell.dispatchEvent(createMouseEvent('click'));

                await new Promise(resolve => setTimeout(resolve, 10));

                // Find and click the corresponding number button
                const numberButton = document.querySelector(`.sudoku-input-button[data-number="${number}"]`);
                if (numberButton) {
                    numberButton.dispatchEvent(createMouseEvent('mousedown'));
                    await new Promise(resolve => setTimeout(resolve, 10));
                    numberButton.dispatchEvent(createMouseEvent('mouseup'));
                    numberButton.dispatchEvent(createMouseEvent('click'));
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
        }

        return true;
    }
}

// Global reference to active solver
let activeSolver = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'solve' || request.action === 'close') {
        (async () => {
            try {
                if (request.action === 'close' && activeSolver) {
                    activeSolver.stopSolving();
                    // Clear any existing timeouts
                    if (window.solveTimeout) {
                        clearTimeout(window.solveTimeout);
                        window.solveTimeout = null;
                    }
                    // Clear any existing intervals
                    if (window.solveInterval) {
                        clearInterval(window.solveInterval);
                        window.solveInterval = null;
                    }
                    // Reset any solving state
                    isSolving = false;
                    activeSolver = null;
                    // Send immediate close response
                    chrome.runtime.sendMessage({
                        action: 'solveComplete',
                        success: false,
                        result: { message: 'Closed Execution' }
                    });
                    sendResponse({ success: true });
                    return;
                }

                // Create new solver for solve action
                const solver = new MiniSudokuSolver();
                activeSolver = solver;
                await solver.initialize();

                solver.baseGameState = await solver.parseBoardState();
                solver.simulatedGameState = {
                    board: JSON.parse(JSON.stringify(solver.baseGameState.board))
                };

                const solution = solver.solvePuzzle();
                const inputResult = await solver.inputSolution(solution);

                // Clear active solver reference after completion
                activeSolver = null;

                // If input was stopped and failed
                if (!inputResult) {
                    chrome.runtime.sendMessage({
                        action: 'solveComplete',
                        success: false,
                        result: { message: 'Closed Execution' }
                    });
                    sendResponse({ success: true });
                    return;
                }

                // Send success message
                chrome.runtime.sendMessage({
                    action: 'solveComplete',
                    success: true
                });

                // Send response to popup
                sendResponse({ success: true });
            } catch (error) {
                activeSolver = null;
                // Send solveComplete message with error
                chrome.runtime.sendMessage({
                    action: 'solveComplete',
                    success: false,
                    error: error.message
                });
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});
