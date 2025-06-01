const { chromium } = require('playwright');

// Game URL
const GAME_URL = 'https://www.linkedin.com/games/view/zip/desktop/';

// Board dimensions
let BOARD_SIZE = 6; // Default value
let EDGE_SIZE = BOARD_SIZE - 1;

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

// Debug visualization function
function visualizeBoard(board, edges, path = []) {
    console.log('\nBoard State:');
    // Print column numbers with padding, aligned with columns
    let header = '   '; // 3 spaces for row numbers
    for (let i = 0; i < BOARD_SIZE; i++) {
        // Match the 2-character cell width + 1 space spacing
        header += i.toString().padStart(2, ' ') + '  ';
    }
    header += '\n';
    console.log(header);

    // Create a map of path positions for gradient calculation
    const pathMap = new Map(path.map(([r, c], index) => [`${r},${c}`, index + 1]));
    const maxPathLength = path.length;

    // Helper function to get gradient color
    const getGradientColor = (index) => {
        const gradient = Math.floor((index / maxPathLength) * 255);
        return `\x1b[38;2;${gradient};${255 - gradient};255m`;
    };

    for (let i = 0; i < BOARD_SIZE; i++) {
        // Print row number with padding
        let row = `${i.toString().padStart(2, ' ')} `;
        for (let j = 0; j < BOARD_SIZE; j++) {
            const cell = board[i][j];
            let symbol;
            if (cell.number) {
                // For numbers, ensure they take up exactly 2 spaces, right-aligned
                const pathIndex = pathMap.get(`${i},${j}`);
                if (pathIndex !== undefined) {
                    const color = getGradientColor(pathIndex);
                    const reset = '\x1b[0m';
                    symbol = `${color}${cell.number.toString().padStart(2, ' ')}${reset}`;
                } else {
                    symbol = cell.number.toString().padStart(2, ' ');
                }
            } else if (cell.contains === CellState.PATH) {
                // Calculate gradient color based on path position
                const pathIndex = pathMap.get(`${i},${j}`);
                const color = getGradientColor(pathIndex);
                const reset = '\x1b[0m';
                // Right-align the P character within 2 spaces
                symbol = `${color}${'P'.padStart(2, ' ')}${reset}`;
            } else {
                // Right-align the O character within 2 spaces
                symbol = 'O'.padStart(2, ' ');
            }
            row += symbol + ' ';

            // Print horizontal edge
            if (j < EDGE_SIZE) {
                const edge = edges.horizontal[i][j];
                row += edge.state === EdgeState.FILLED ? '|' : ' ';
            }
        }
        console.log(row);

        // Print vertical edges
        if (i < EDGE_SIZE) {
            let edgeRow = '   ';
            for (let j = 0; j < BOARD_SIZE; j++) {
                const edge = edges.vertical[i][j];
                edgeRow += edge.state === EdgeState.FILLED ? '-' : ' ';
                edgeRow += '   ';
            }
            console.log(edgeRow);
        }
    }
    console.log('\n');
}

// Main solver class
class ZipSolver {
    constructor() {
        this.browser = null;
        this.page = null;
        this.hasFilledEdges = false;
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
    }

    async initialize() {
        console.log('Launching browser...');
        this.browser = await chromium.launch({ headless: false });
        this.page = await this.browser.newPage();

        console.log('Navigating to game...');
        await this.page.goto(GAME_URL);

        // Wait for the start game button and click it
        await this.page.waitForSelector('#launch-footer-start-button');
        await this.page.click('#launch-footer-start-button');

        // Wait for the close tutorial button and click it if it exists
        try {
            await this.page.waitForSelector('.trail-tutorial-modal button.artdeco-modal__dismiss', { timeout: 100 });
            await this.page.click('.trail-tutorial-modal button.artdeco-modal__dismiss');
        } catch (error) {
            // Tutorial button not found, continue silently
        }

        // Wait for the board to appear and get its size
        await this.page.waitForSelector('.trail-grid');
        BOARD_SIZE = await this.page.evaluate(() => {
            const grid = document.querySelector('.trail-grid');
            if (grid) {
                const rows = getComputedStyle(grid).getPropertyValue('--rows');
                if (rows) {
                    return parseInt(rows);
                }
            }
            return 6; // Fallback to default
        });
        EDGE_SIZE = BOARD_SIZE - 1; // Update EDGE_SIZE when BOARD_SIZE changes

        // Initialize the edge arrays with the correct size
        this.baseGameState.edges = {
            horizontal: Array(BOARD_SIZE).fill().map(() => Array(EDGE_SIZE).fill().map(() => ({ state: EdgeState.EMPTY }))),
            vertical: Array(EDGE_SIZE).fill().map(() => Array(BOARD_SIZE).fill().map(() => ({ state: EdgeState.EMPTY })))
        };
        this.simulatedGameState.edges = this.baseGameState.edges; // Reference the base game's edges

        console.log('Step 1 complete: Game launched and board loaded. Board size:', BOARD_SIZE);
    }

    async parseBoardState() {
        console.log('Parsing board state...');
        const state = await this.page.evaluate((boardSize) => {
            const edgeSize = boardSize - 1;
            const board = [];
            const edges = {
                horizontal: Array(boardSize).fill().map(() => Array(edgeSize).fill().map(() => ({ state: 'empty' }))),
                vertical: Array(edgeSize).fill().map(() => Array(boardSize).fill().map(() => ({ state: 'empty' })))
            };

            // Parse cells
            const cells = document.querySelectorAll('.trail-grid .trail-cell');
            for (let i = 0; i < boardSize; i++) {
                board[i] = [];
                for (let j = 0; j < boardSize; j++) {
                    const cell = cells[i * boardSize + j];
                    let number = null;
                    const cellContent = cell.querySelector('.trail-cell-content');
                    if (cellContent) {
                        number = parseInt(cellContent.textContent);
                    }
                    board[i][j] = { number, contains: 'empty' };
                }
            }

            // Parse edges
            let hasFilledEdges = false;
            for (let i = 0; i < boardSize; i++) {
                for (let j = 0; j < boardSize; j++) {
                    const cell = cells[i * boardSize + j];

                    // Parse right edge (horizontal)
                    if (j < edgeSize) {
                        const rightEdge = cell.querySelector('.trail-cell-wall.trail-cell-wall--right');
                        if (rightEdge) {
                            edges.horizontal[i][j].state = 'filled';
                            hasFilledEdges = true;
                        }
                    }

                    // Parse bottom edge (vertical)
                    if (i < edgeSize) {
                        const bottomEdge = cell.querySelector('.trail-cell-wall.trail-cell-wall--down');
                        if (bottomEdge) {
                            edges.vertical[i][j].state = 'filled';
                            hasFilledEdges = true;
                        }
                    }
                }
            }

            return { board, edges, hasFilledEdges };
        }, BOARD_SIZE);

        // Create a proper deep copy of the state
        this.baseGameState = JSON.parse(JSON.stringify(state));
        this.simulatedGameState = {
            board: JSON.parse(JSON.stringify(state.board)),
            edges: this.baseGameState.edges  // Reference the base game's edges
        };
        this.hasFilledEdges = state.hasFilledEdges;
        console.log('Step 2 complete: Board state parsed.');
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

    findClosestPathToNextNumber(board, startRow, startCol, targetNumber) {
        visualizeBoard(board);

        const visited = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(false));
        let foundPath = null;

        const dfs = (row, col, currentPath) => {

            // Check if we found the target number
            if (board[row][col].number === targetNumber) {
                foundPath = currentPath;
                return true;
            }

            // Try all adjacent directions
            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of directions) {
                const newRow = row + dx;
                const newCol = col + dy;

                if (newRow >= 0 && newRow < BOARD_SIZE &&
                    newCol >= 0 && newCol < BOARD_SIZE &&
                    !visited[newRow][newCol]) {

                    if (board[newRow][newCol].contains === CellState.EMPTY ||
                        board[newRow][newCol].number === targetNumber) {

                        if (this.isValidPathPlacement(board, targetNumber)) {
                            visited[newRow][newCol] = true;
                            if (dfs(newRow, newCol, [...currentPath, [newRow, newCol]])) {
                                return true;
                            }
                            visited[newRow][newCol] = false; // Backtrack
                        }
                    }
                }
            }

            return false;
        };

        // Start DFS from the initial position
        visited[startRow][startCol] = true;
        if (dfs(startRow, startCol, [])) {
            return foundPath;
        }

        console.log(`\nNo path found to number ${targetNumber}`);
        return null;
    }

    placePath(board, row, col) {
        board[row][col].contains = CellState.PATH;
    }

    checkPathValidity(board) {
        // Check if numbers are connected in sequence
        const visited = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(false));
        let startRow = -1, startCol = -1;

        // Find first number (1)
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j].number === 1) {
                    startRow = i;
                    startCol = j;
                    break;
                }
            }
            if (startRow !== -1) break;
        }

        if (startRow === -1) return false;

        // DFS to check connectivity between numbers
        const dfs = (row, col, targetNumber) => {
            if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE ||
                visited[row][col] || board[row][col].contains !== CellState.PATH) {
                return false;
            }

            visited[row][col] = true;

            // If we found the target number, we're done
            if (board[row][col].number === targetNumber) {
                return true;
            }

            // Check adjacent cells
            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of directions) {
                const newRow = row + dx;
                const newCol = col + dy;
                if (dfs(newRow, newCol, targetNumber)) {
                    return true;
                }
            }

            return false;
        };

        // Check connection between each consecutive pair of numbers
        for (let num = 1; num < BOARD_SIZE; num++) {
            // Reset visited array
            visited.forEach(row => row.fill(false));

            // Find current number
            let currentRow = -1, currentCol = -1;
            for (let i = 0; i < BOARD_SIZE; i++) {
                for (let j = 0; j < BOARD_SIZE; j++) {
                    if (board[i][j].number === num) {
                        currentRow = i;
                        currentCol = j;
                        break;
                    }
                }
                if (currentRow !== -1) break;
            }

            if (currentRow === -1) continue;

            // Check if we can reach the next number
            if (!dfs(currentRow, currentCol, num + 1)) {
                return false;
            }
        }

        return true;
    }

    checkWinCondition(board) {
        // Check if all cells are filled
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                if (board[i][j].contains === CellState.EMPTY) {
                    return false;
                }
            }
        }
        return true;
    }

    solvePuzzle() {
        console.log('Solving puzzle...');

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

        console.log('\nInitial board state:');
        visualizeBoard(this.simulatedGameState.board, this.simulatedGameState.edges);

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
            console.log('Step 3 complete: Puzzle solved.');
            console.log('Final board state:');
            visualizeBoard(state.board, state.edges, state.path);
            return state.path;
        }

        throw new Error('No solution found');
    }

    async inputSolution(solution) {
        console.log('Inputting solution...');

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
            const cell = await this.page.$(`.trail-grid .trail-cell:nth-child(${row * BOARD_SIZE + col + 1})`);
            await cell.click();
            await this.page.waitForTimeout(10); // Small delay between clicks
        }

        console.log('Step 4 complete: Solution inputted.');
    }

    async cleanup() {
        console.log('Cleaning up...');
        await this.page.waitForTimeout(5000); // Wait 5 seconds
        await this.browser.close();
        console.log('Step 5 complete: Browser closed.');
    }
}

// Main execution
async function main() {
    const solver = new ZipSolver();
    try {
        await solver.initialize();
        await solver.parseBoardState();
        const solution = solver.solvePuzzle();
        await solver.inputSolution(solution);
        await solver.cleanup();
    } catch (error) {
        console.error('Error:', error);
        if (solver.browser) {
            await solver.browser.close();
        }
    }
}

main(); 