const { chromium } = require('playwright');
const chalk = require('chalk');

// Game URL
const GAME_URL = 'https://www.linkedin.com/games/view/queens/desktop/';

// Board dimensions
let BOARD_SIZE = 8; // Default value

// Cell state types
const CellState = {
    EMPTY: 'empty',
    QUEEN: 'queen',
    X: 'X'
};

// Color mapping for visualization
const colorMap = {
    1: chalk.red,
    2: chalk.green,
    3: chalk.blue,
    4: chalk.yellow,
    5: chalk.magenta,
    6: chalk.cyan,
    7: chalk.gray,
    8: chalk.white,
    9: chalk.redBright,
    10: chalk.greenBright,
    11: chalk.blueBright,
    12: chalk.yellowBright,
    13: chalk.magentaBright,
    14: chalk.cyanBright,
    15: chalk.whiteBright
};

// Debug visualization function
function visualizeBoard(board) {
    console.log('\nBoard State:');
    console.log('  ' + Array(BOARD_SIZE).fill(0).map((_, i) => i).join(' '));

    for (let i = 0; i < BOARD_SIZE; i++) {
        let row = `${i} `;
        for (let j = 0; j < BOARD_SIZE; j++) {
            const cell = board[i][j];
            const colorFn = colorMap[cell.colorId] || chalk.white;

            let symbol = 'O';
            if (cell.contains === CellState.QUEEN) {
                symbol = 'Q';
            } else if (cell.contains === CellState.X) {
                symbol = 'X';
            }

            row += colorFn(symbol) + ' ';
        }
        console.log(row);
    }
    console.log('\n');
}

// Main solver class
class QueensSolver {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseGameState = [];
        this.simulatedGameState = [];
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
            await this.page.waitForSelector('.queens-tutorial-modal button.artdeco-modal__dismiss', { timeout: 100 });
            await this.page.click('.queens-tutorial-modal button.artdeco-modal__dismiss');
        } catch (error) {
            // Tutorial button not found, continue silently
        }

        // Wait for the board to appear and get its size
        await this.page.waitForSelector('#queens-grid');
        BOARD_SIZE = await this.page.evaluate(() => {
            const grid = document.querySelector('#queens-grid');
            if (grid) {
                const rows = getComputedStyle(grid).getPropertyValue('--rows');
                if (rows) {
                    return parseInt(rows);
                }
            }
            return 8; // Fallback to default
        });
        console.log('Step 1 complete: Game launched and board loaded. Board size:', BOARD_SIZE);
    }

    async parseBoardState() {
        console.log('Parsing board state...');
        this.baseGameState = await this.page.evaluate((boardSize) => {
            const board = [];
            const cells = document.querySelectorAll('#queens-grid .queens-cell-with-border');

            for (let i = 0; i < boardSize; i++) {
                board[i] = [];
                for (let j = 0; j < boardSize; j++) {
                    const cell = cells[i * boardSize + j];
                    const colorId = parseInt(cell.className.match(/color-(\d+)/)[1]);
                    const cellContent = cell.querySelector('.cell-content .cell-input');
                    let contains = 'empty';
                    if (cellContent) {
                        if (cellContent.classList.contains('cell-input--queen')) {
                            contains = 'queen';
                        } else if (cellContent.classList.contains('cell-input--cross')) {
                            contains = 'X';
                        }
                    }

                    board[i][j] = { colorId, contains };
                }
            }
            return board;
        }, BOARD_SIZE);

        // Create a deep copy for simulation
        this.simulatedGameState = JSON.parse(JSON.stringify(this.baseGameState));
        console.log('Step 2 complete: Board state parsed.');
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

    solvePuzzle() {
        console.log('Solving puzzle...');
        const stack = [];
        const solution = [];

        console.log('Initial board state:');
        visualizeBoard(this.simulatedGameState);

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
            console.log('Step 3 complete: Puzzle solved.');
            console.log('Final board state:');
            visualizeBoard(this.simulatedGameState);
            return solution;
        }

        throw new Error('No solution found');
    }

    async inputSolution(solution) {
        console.log('Inputting solution...');

        // Find only new queen placements
        const newQueens = solution.filter(([row, col]) =>
            this.baseGameState[row][col].contains !== CellState.QUEEN
        );

        // Click cells to place queens
        for (const [row, col] of newQueens) {
            const cell = await this.page.$(`#queens-grid .queens-cell-with-border:nth-child(${row * BOARD_SIZE + col + 1})`);
            await cell.click();
            await cell.click(); // Double click to place queen
            await this.page.waitForTimeout(10); // Small delay between clicks
        }

        console.log('Step 4 complete: Solution inputted and saved from clipboard.');
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
    const solver = new QueensSolver();
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