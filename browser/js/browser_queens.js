// Board dimensions
let BOARD_SIZE = 8; // Default value

// Get board size from CSS variable
function getBoardSize() {
    const grid = document.querySelector('#queens-grid');
    if (grid) {
        const rows = getComputedStyle(grid).getPropertyValue('--rows');
        if (rows) {
            return parseInt(rows);
        }
    }
    return 8; // Fallback to default
}

// Cell state types
const CellState = {
    EMPTY: 'empty',
    QUEEN: 'queen',
    X: 'X'
};

// Main solver class
class QueensSolver {
    constructor() {
        this.baseGameState = [];
        this.simulatedGameState = [];
        BOARD_SIZE = getBoardSize(); // Set board size when solver is created
        this.shouldStop = false;
    }

    async initialize() {
        // Click start game button if present
        const startButton = document.querySelector('#launch-footer-start-button');
        if (startButton) {
            startButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Click close tutorial button if present
        const closeTutorialButton = document.querySelector('.queens-tutorial-modal button.artdeco-modal__dismiss');
        if (closeTutorialButton) {
            closeTutorialButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Wait for board to appear
        let board = null;
        const startTime = Date.now();
        while (Date.now() - startTime < 5000) {
            board = document.querySelector('#queens-grid');
            if (board) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!board) {
            throw new Error('Board not found after initialization');
        }
    }

    async parseBoardState() {
        const board = [];
        const cells = document.querySelectorAll('#queens-grid .queens-cell-with-border');

        for (let i = 0; i < BOARD_SIZE; i++) {
            board[i] = [];
            for (let j = 0; j < BOARD_SIZE; j++) {
                const cell = cells[i * BOARD_SIZE + j];
                const colorId = parseInt(cell.className.match(/color-(\d+)/)[1]);
                const cellContent = cell.querySelector('.cell-content .cell-input');

                let contains = CellState.EMPTY;
                if (cellContent) {
                    if (cellContent.classList.contains('cell-input--queen')) {
                        contains = CellState.QUEEN;
                    } else if (cellContent.classList.contains('cell-input--cross')) {
                        contains = CellState.X;
                    }
                }

                board[i][j] = { colorId, contains };
            }
        }
        return board;
    }

    isValidQueenPlacement(board, row, col) {
        // Check if cell is empty
        if (board[row][col].contains !== CellState.EMPTY) {
            return false;
        }

        // Check 1-tile radius
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const newRow = row + i;
                const newCol = col + j;
                if (newRow >= 0 && newRow < BOARD_SIZE &&
                    newCol >= 0 && newCol < BOARD_SIZE &&
                    board[newRow][newCol].contains === CellState.QUEEN) {
                    return false;
                }
            }
        }

        // Check same row and column
        for (let i = 0; i < BOARD_SIZE; i++) {
            if (board[row][i].contains === CellState.QUEEN ||
                board[i][col].contains === CellState.QUEEN) {
                return false;
            }
        }

        // Check same color
        const colorId = board[row][col].colorId;
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j].contains === CellState.QUEEN &&
                    board[i][j].colorId === colorId) {
                    return false;
                }
            }
        }

        return true;
    }

    placeQueen(board, row, col) {
        board[row][col].contains = CellState.QUEEN;
        const colorId = board[row][col].colorId;

        // Mark invalid adjacent cells as X (1-tile radius)
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const newRow = row + i;
                const newCol = col + j;
                if (newRow >= 0 && newRow < BOARD_SIZE &&
                    newCol >= 0 && newCol < BOARD_SIZE &&
                    board[newRow][newCol].contains === CellState.EMPTY) {
                    board[newRow][newCol].contains = CellState.X;
                }
            }
        }

        // Mark invalid cells in same row and column
        for (let i = 0; i < BOARD_SIZE; i++) {
            // Mark same row
            if (i !== col && board[row][i].contains === CellState.EMPTY) {
                board[row][i].contains = CellState.X;
            }
            // Mark same column
            if (i !== row && board[i][col].contains === CellState.EMPTY) {
                board[i][col].contains = CellState.X;
            }
        }

        // Mark cells with same color
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j].colorId === colorId &&
                    board[i][j].contains === CellState.EMPTY) {
                    board[i][j].contains = CellState.X;
                }
            }
        }
    }

    checkBoardValidity(board) {
        // Check if any row is all X's
        for (let i = 0; i < BOARD_SIZE; i++) {
            let allX = true;
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j].contains !== CellState.X) {
                    allX = false;
                    break;
                }
            }
            if (allX) return false;
        }

        // Check if any column is all X's
        for (let j = 0; j < BOARD_SIZE; j++) {
            let allX = true;
            for (let i = 0; i < BOARD_SIZE; i++) {
                if (board[i][j].contains !== CellState.X) {
                    allX = false;
                    break;
                }
            }
            if (allX) return false;
        }

        // Check if any color group is all X's
        for (let colorId = 1; colorId <= BOARD_SIZE; colorId++) {
            let allX = true;
            for (let i = 0; i < BOARD_SIZE; i++) {
                for (let j = 0; j < BOARD_SIZE; j++) {
                    if (board[i][j].colorId === colorId &&
                        board[i][j].contains !== CellState.X) {
                        allX = false;
                        break;
                    }
                }
                if (!allX) break;
            }
            if (allX) return false;
        }

        return true;
    }

    stopSolving() {
        this.shouldStop = true;
    }

    solvePuzzle() {
        const stack = [];
        const solution = [];
        if (this.shouldStop) return false;

        // First, mark invalid tiles for existing queens
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (this.simulatedGameState[i][j].contains === CellState.QUEEN) {
                    this.placeQueen(this.simulatedGameState, i, j);
                }
            }
        }

        // Count cells of each color
        const colorCounts = new Array(BOARD_SIZE + 1).fill(0);
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                const colorId = this.simulatedGameState[i][j].colorId;
                colorCounts[colorId]++;
            }
        }

        // Find all valid spots
        const validSpots = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (this.isValidQueenPlacement(this.simulatedGameState, i, j)) {
                    validSpots.push([i, j]);
                }
            }
        }

        // DFS implementation
        const dfs = (spots) => {
            if (this.shouldStop) return false;

            // Count current queens on the board
            const queenCount = this.simulatedGameState.reduce((count, row) =>
                count + row.filter(cell => cell.contains === CellState.QUEEN).length, 0);

            // Check win condition
            if (queenCount === BOARD_SIZE) {
                return true;
            }

            if (spots.length === 0) {
                return false;
            }

            // Sort spots to try most constrained positions first
            spots.sort((a, b) => {
                const [rowA, colA] = a;
                const [rowB, colB] = b;

                // Get color IDs for both spots
                const colorIdA = this.simulatedGameState[rowA][colA].colorId;
                const colorIdB = this.simulatedGameState[rowB][colB].colorId;

                // First sort by color region size (smaller regions first)
                if (colorCounts[colorIdA] !== colorCounts[colorIdB]) {
                    return colorCounts[colorIdA] - colorCounts[colorIdB];
                }

                // If color regions are the same size, sort by empty cells in row and column
                const countEmptyA = this.simulatedGameState[rowA].filter(cell =>
                    cell.contains === CellState.EMPTY).length +
                    this.simulatedGameState.map(row => row[colA]).filter(cell =>
                        cell.contains === CellState.EMPTY).length;

                const countEmptyB = this.simulatedGameState[rowB].filter(cell =>
                    cell.contains === CellState.EMPTY).length +
                    this.simulatedGameState.map(row => row[colB]).filter(cell =>
                        cell.contains === CellState.EMPTY).length;

                return countEmptyA - countEmptyB;
            });

            for (let i = 0; i < spots.length; i++) {
                if (this.shouldStop) return false;
                const [row, col] = spots[i];
                if (this.isValidQueenPlacement(this.simulatedGameState, row, col)) {
                    // Save current state
                    const currentState = JSON.parse(JSON.stringify(this.simulatedGameState));
                    stack.push(currentState);

                    // Place queen and mark invalid tiles
                    this.placeQueen(this.simulatedGameState, row, col);
                    solution.push([row, col]);

                    // Get remaining valid spots
                    const remainingSpots = spots.filter((_, index) => index !== i);

                    if (dfs(remainingSpots)) {
                        return true;
                    }

                    // Backtrack
                    this.simulatedGameState = stack.pop();
                    solution.pop();
                }
            }

            return false;
        };

        if (dfs(validSpots)) {
            return solution;
        }

        throw new Error('No solution found');
    }

    async inputSolution(solution) {
        if (this.shouldStop) return false;

        try {
            // Find only new queen placements
            const newQueens = solution.filter(([row, col]) =>
                this.baseGameState[row][col].contains !== CellState.QUEEN
            );

            // Click cells to place queens
            for (const [row, col] of newQueens) {
                if (this.shouldStop) return false;

                const cell = document.querySelector(`#queens-grid .queens-cell-with-border:nth-child(${row * BOARD_SIZE + col + 1})`);

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

                // Wait longer between clicks
                await new Promise(resolve => setTimeout(resolve, 10));

                // Second click
                cell.dispatchEvent(createMouseEvent('mousedown'));
                await new Promise(resolve => setTimeout(resolve, 10));
                cell.dispatchEvent(createMouseEvent('mouseup'));
                cell.dispatchEvent(createMouseEvent('click'));

                // Wait between cells
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            if (this.shouldStop) return false;
            return true;
        } catch (error) {
            return false;
        }
    }

    async saveSolution(solution) {
        try {
            // Save the solution to Chrome storage
            await chrome.storage.local.set({
                'queensSolution': {
                    solution: solution,
                    boardSize: BOARD_SIZE
                }
            });
            return true;
        } catch (error) {
            console.error('Error saving solution:', error);
            return false;
        }
    }

    async getMostRecentSolution() {
        try {
            const data = await chrome.storage.local.get('queensSolution');
            const storedSolution = data.queensSolution;

            if (!storedSolution || !storedSolution.solution) {
                return null;
            }

            return storedSolution;
        } catch (error) {
            console.error('Error reading solution:', error);
            return null;
        }
    }

    async inputStoredSolution() {
        // Get the most recent solution from storage
        const storedSolution = await this.getMostRecentSolution();
        if (!storedSolution) {
            return {
                success: false,
                error: 'No stored solution found'
            };
        }

        // Check if board size matches
        if (storedSolution.boardSize !== BOARD_SIZE) {
            return {
                success: false,
                error: `Board size doesn't match`
            };
        }

        // Input the stored solution
        const inputSuccess = await this.inputSolution(storedSolution.solution);
        if (inputSuccess) {
            return {
                success: true,
                solution: storedSolution.solution
            };
        } else {
            if (this.shouldStop) {
                return {
                    success: false,
                    error: 'Solving stopped by user'
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to input solution'
                };
            }
        }
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'solve' || request.action === 'inputStoredSolution' || request.action === 'close') {
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

                let result;
                if (request.action === 'solve') {
                    // Create new solver for solve action
                    const solver = new QueensSolver();
                    activeSolver = solver;
                    await solver.initialize();

                    solver.baseGameState = await solver.parseBoardState();
                    solver.simulatedGameState = JSON.parse(JSON.stringify(solver.baseGameState));

                    const solution = solver.solvePuzzle();
                    if (!solution) {
                        result = {
                            success: false,
                            error: 'Solving stopped by user'
                        };
                    } else {
                        const inputResult = await solver.inputSolution(solution);
                        if (inputResult) {
                            // Save the solution
                            await solver.saveSolution(solution);
                            result = {
                                success: true,
                                solution: solution
                            };
                        } else {
                            if (solver.shouldStop) {
                                result = {
                                    success: false,
                                    error: 'Solving stopped by user'
                                };
                            }
                            else {
                                result = {
                                    success: false,
                                    error: 'Failed to input solution'
                                };
                            }
                        }
                    }
                } else if (request.action === 'inputStoredSolution') {
                    // Create new solver for input stored solution action
                    const solver = new QueensSolver();
                    activeSolver = solver;
                    await solver.initialize();

                    // Parse board state to get board size
                    solver.baseGameState = await solver.parseBoardState();

                    result = await solver.inputStoredSolution();
                }

                // Clear active solver reference after completion
                activeSolver = null;

                // If input was stopped and failed
                if (!result.success) {
                    if (result.error === 'Solving stopped by user') {
                        chrome.runtime.sendMessage({
                            action: 'solveComplete',
                            success: false,
                            result: { message: 'Closed Execution' }
                        });
                    } else {
                        chrome.runtime.sendMessage({
                            action: 'solveComplete',
                            success: false,
                            result: { error: result.error }
                        });
                    }
                    sendResponse({ success: true });
                    return;
                }

                // Only send success message if we actually solved it
                else if (result.success) {
                    chrome.runtime.sendMessage({
                        action: 'solveComplete',
                        success: true
                    });
                    sendResponse({ success: true });
                    return;
                }

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