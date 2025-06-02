// Board dimensions
let BOARD_SIZE = 6; // Default value
let EDGE_SIZE = BOARD_SIZE - 1;

// Get board size from CSS variable
function getBoardSize() {
    const grid = document.querySelector('.trail-grid');
    if (grid) {
        const rows = getComputedStyle(grid).getPropertyValue('--rows');
        if (rows) {
            BOARD_SIZE = parseInt(rows);
            EDGE_SIZE = BOARD_SIZE - 1;
            return BOARD_SIZE;
        }
    }
    return 6; // Fallback to default
}

// Cell state types
const CellState = {
    EMPTY: 'empty',
    PATH: 'path'
};

// Edge state types
const EdgeState = {
    EMPTY: 'empty',
    FILLED: 'filled'
};

// Main solver class
class ZipSolver {
    constructor() {
        this.baseGameState = {
            board: [],
            edges: {
                horizontal: [],
                vertical: []
            }
        };
        this.simulatedGameState = {
            board: [],
            edges: null  // Will reference baseGameState.edges
        };
        this.hasFilledEdges = false;
        BOARD_SIZE = getBoardSize(); // Set board size when solver is created
        EDGE_SIZE = BOARD_SIZE - 1;
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

        const closeTutorialButton = document.querySelector('.trail-tutorial-modal button.artdeco-modal__dismiss');
        if (closeTutorialButton) {
            closeTutorialButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Wait for board to appear
        let board = null;
        const startTime = Date.now();
        while (Date.now() - startTime < 5000) {
            board = document.querySelector('.trail-grid');
            if (board) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!board) {
            throw new Error('Board not found after initialization');
        }

        // Initialize the edge arrays with the correct size
        this.baseGameState.edges = {
            horizontal: Array(BOARD_SIZE).fill().map(() => Array(EDGE_SIZE).fill().map(() => ({ state: EdgeState.EMPTY }))),
            vertical: Array(EDGE_SIZE).fill().map(() => Array(BOARD_SIZE).fill().map(() => ({ state: EdgeState.EMPTY })))
        };
        this.simulatedGameState.edges = this.baseGameState.edges;
    }

    async parseBoardState() {
        const board = [];
        const edges = {
            horizontal: Array(BOARD_SIZE).fill().map(() => Array(EDGE_SIZE).fill().map(() => ({ state: EdgeState.EMPTY }))),
            vertical: Array(EDGE_SIZE).fill().map(() => Array(BOARD_SIZE).fill().map(() => ({ state: EdgeState.EMPTY })))
        };
        let hasFilledEdges = false;

        const cells = document.querySelectorAll('.trail-grid .trail-cell');

        // Parse cells
        for (let i = 0; i < BOARD_SIZE; i++) {
            board[i] = [];
            for (let j = 0; j < BOARD_SIZE; j++) {
                const cell = cells[i * BOARD_SIZE + j];
                let number = null;
                const cellContent = cell.querySelector('.trail-cell-content');
                if (cellContent) {
                    number = parseInt(cellContent.textContent);
                }
                board[i][j] = { number, contains: CellState.EMPTY };
            }
        }

        // Parse edges
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                const cell = cells[i * BOARD_SIZE + j];

                // Parse right edge (horizontal)
                if (j < EDGE_SIZE) {
                    const rightEdge = cell.querySelector('.trail-cell-wall.trail-cell-wall--right');
                    if (rightEdge) {
                        edges.horizontal[i][j].state = EdgeState.FILLED;
                        hasFilledEdges = true;
                    }
                }

                // Parse bottom edge (vertical)
                if (i < EDGE_SIZE) {
                    const bottomEdge = cell.querySelector('.trail-cell-wall.trail-cell-wall--down');
                    if (bottomEdge) {
                        edges.vertical[i][j].state = EdgeState.FILLED;
                        hasFilledEdges = true;
                    }
                }
            }
        }

        this.hasFilledEdges = hasFilledEdges;
        return { board, edges, hasFilledEdges };
    }

    isValidPathPlacement(board, edges, row, col, nextNumber, currentNumber) {
        // Check if cell is empty or contains the target number
        if (board[row][col].contains !== CellState.EMPTY &&
            board[row][col].number !== nextNumber) {
            return false;
        }

        // Check if cell overlaps with any number that isn't our target
        if (board[row][col].number && board[row][col].number !== nextNumber) {
            return false;
        }

        // Check if cell is adjacent to the current path head
        let isAdjacentToPath = false;
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // Only adjacent, not diagonal
        for (const [dx, dy] of directions) {
            const newRow = row + dx;
            const newCol = col + dy;

            // Skip if out of bounds
            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                continue;
            }

            // Check path adjacency first (simpler check)
            if (board[newRow][newCol].contains === CellState.PATH) {
                // Only check edge constraints if there are filled edges and we found a path
                if (this.hasFilledEdges) {
                    // Check if the move is blocked by an edge
                    if (dx === 1 && edges.vertical[row][col].state === EdgeState.FILLED) continue;
                    if (dx === -1 && edges.vertical[row - 1][col].state === EdgeState.FILLED) continue;
                    if (dy === 1 && edges.horizontal[row][col].state === EdgeState.FILLED) continue;
                    if (dy === -1 && edges.horizontal[row][col - 1].state === EdgeState.FILLED) continue;
                }
                isAdjacentToPath = true;
                break;
            }
        }

        if (!isAdjacentToPath) {
            return false;
        }

        return true;
    }

    solvePuzzle() {
        if (this.shouldStop) return null;

        // Find all number cells and sort them
        const numberCells = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (this.simulatedGameState.board[i][j].number) {
                    numberCells.push([i, j]);
                }
            }
        }
        numberCells.sort((a, b) => {
            const numA = this.simulatedGameState.board[a[0]][a[1]].number;
            const numB = this.simulatedGameState.board[b[0]][b[1]].number;
            return numA - numB;
        });

        // State object to track current state
        const state = {
            board: JSON.parse(JSON.stringify(this.simulatedGameState.board)),
            edges: this.simulatedGameState.edges,  // Reference the edges
            path: [], // Array of [row, col] coordinates
            currentNumber: 1,
            nextNumber: 2
        };

        // Start with number 1
        const [startRow, startCol] = numberCells[0];
        state.path.push([startRow, startCol]);
        state.board[startRow][startCol].contains = CellState.PATH;

        // Save state for backtracking
        const saveState = () => {
            return {
                board: JSON.parse(JSON.stringify(state.board)),
                edges: state.edges,  // Just reference the edges
                path: [...state.path],
                currentNumber: state.currentNumber,
                nextNumber: state.nextNumber
            };
        };

        // Restore state
        const restoreState = (savedState) => {
            state.board = JSON.parse(JSON.stringify(savedState.board));
            state.edges = savedState.edges;  // Just reference the edges
            state.path = [...savedState.path];
            state.currentNumber = savedState.currentNumber;
            state.nextNumber = savedState.nextNumber;
        };

        // Calculate Manhattan distance between two points
        const manhattanDistance = (r1, c1, r2, c2) => {
            return Math.abs(r1 - r2) + Math.abs(c1 - c2);
        };

        // Find the target number's position
        const findTargetPosition = (targetNumber) => {
            for (let i = 0; i < BOARD_SIZE; i++) {
                for (let j = 0; j < BOARD_SIZE; j++) {
                    if (state.board[i][j].number === targetNumber) {
                        return [i, j];
                    }
                }
            }
            return null;
        };

        // Check if a cell is valid for path expansion
        const isValidExpansion = (row, col) => {
            // Check if cell is within bounds
            if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
                return false;
            }

            // Check if cell is already in path
            if (state.board[row][col].contains === CellState.PATH) {
                return false;
            }

            // Check if cell is empty or contains the next number
            const cellNumber = state.board[row][col].number;
            if (cellNumber && cellNumber !== state.nextNumber) {
                return false;
            }

            // Check if the move is blocked by an edge
            const [currentRow, currentCol] = state.path[state.path.length - 1];
            const dx = row - currentRow;
            const dy = col - currentCol;

            if (dx === 1 && state.edges.vertical[currentRow][currentCol].state === EdgeState.FILLED) return false;
            if (dx === -1 && state.edges.vertical[currentRow - 1][currentCol].state === EdgeState.FILLED) return false;
            if (dy === 1 && state.edges.horizontal[currentRow][currentCol].state === EdgeState.FILLED) return false;
            if (dy === -1 && state.edges.horizontal[currentRow][currentCol - 1].state === EdgeState.FILLED) return false;

            return true;
        };

        // Check if board is completely filled
        const isBoardFilled = () => {
            for (let i = 0; i < BOARD_SIZE; i++) {
                for (let j = 0; j < BOARD_SIZE; j++) {
                    if (state.board[i][j].contains !== CellState.PATH) {
                        return false;
                    }
                }
            }
            return true;
        };

        // DFS function to expand path
        const expandPath = () => {
            if (this.shouldStop) return false;

            // If we've reached the next number
            const [currentRow, currentCol] = state.path[state.path.length - 1];
            if (state.board[currentRow][currentCol].number === state.nextNumber) {
                state.currentNumber = state.nextNumber;
                state.nextNumber++;

                // If we've reached all numbers, check if board is filled
                if (state.nextNumber > numberCells.length) {
                    if (isBoardFilled()) {
                        return true;
                    }
                    return false;
                }
            }

            // Get target position for heuristic
            const [targetRow, targetCol] = findTargetPosition(state.nextNumber) || [0, 0];

            // Try expanding in all four directions, sorted by heuristic
            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            const moves = directions
                .map(([dx, dy]) => ({
                    dx,
                    dy,
                    row: currentRow + dx,
                    col: currentCol + dy
                }))
                .filter(move => isValidExpansion(move.row, move.col))
                .map(move => ({
                    ...move,
                    distance: manhattanDistance(move.row, move.col, targetRow, targetCol)
                }))
                .sort((a, b) => a.distance - b.distance);

            for (const move of moves) {

                if (this.shouldStop) return false;
                // Save state before trying this expansion
                const savedState = saveState();

                // Add cell to path
                state.path.push([move.row, move.col]);
                state.board[move.row][move.col].contains = CellState.PATH;

                // Recursively try to expand from new cell
                if (expandPath()) {
                    return true;
                }

                // Backtrack if expansion failed
                restoreState(savedState);
            }

            return false;
        };

        // Start solving
        if (expandPath()) {
            return state.path;
        }

        throw new Error('No solution found');
    }

    async inputSolution(solution) {
        if (this.shouldStop) return false;

        // Minimize solution path by removing unnecessary intermediate cells
        const minimizedSolution = [];
        if (solution.length > 0) {
            minimizedSolution.push(solution[0]); // Always keep the first cell

            for (let i = 1; i < solution.length - 1; i++) {
                const prev = solution[i - 1];
                const curr = solution[i];
                const next = solution[i + 1];

                // Check if current cell is in a straight line between prev and next
                const isHorizontalLine = prev[0] === curr[0] && curr[0] === next[0];
                const isVerticalLine = prev[1] === curr[1] && curr[1] === next[1];

                // Keep cell if it's not in a straight line (i.e., path changes direction)
                if (!isHorizontalLine && !isVerticalLine) {
                    minimizedSolution.push(curr);
                }
            }

            // Always keep the last cell
            minimizedSolution.push(solution[solution.length - 1]);
        }

        // Click cells to place path
        for (const [row, col] of minimizedSolution) {
            if (this.shouldStop) return false;

            const cell = document.querySelector(`.trail-grid .trail-cell:nth-child(${row * BOARD_SIZE + col + 1})`);

            // Create and dispatch mouse events for more reliable click simulation
            const createMouseEvent = (type) => new MouseEvent(type, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            });

            // First click
            cell.dispatchEvent(createMouseEvent('mousedown'));
            await new Promise(resolve => setTimeout(resolve, 10));
            cell.dispatchEvent(createMouseEvent('mouseup'));
            cell.dispatchEvent(createMouseEvent('click'));

            // Wait between cells
            await new Promise(resolve => setTimeout(resolve, 10));

            if (this.shouldStop) return false;
        }
        if (this.shouldStop) return false;
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
                // If close action, stop any active solver
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
                const solver = new ZipSolver();
                activeSolver = solver;
                await solver.initialize();

                const state = await solver.parseBoardState();
                solver.baseGameState = state;
                solver.simulatedGameState = {
                    board: JSON.parse(JSON.stringify(state.board)),
                    edges: state.edges
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
        return true; // Will respond asynchronously
    }
}); 