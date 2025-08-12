const { chromium } = require('playwright');
const chalk = require('chalk');

// Game URL
const GAME_URL = 'https://www.linkedin.com/games/view/mini-sudoku/desktop/';

// Board dimensions - 2 columns, 3 rows
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

// Debug visualization function
function visualizeBoard(board) {
    console.log('\nMini Sudoku Board State:');

    // Create column headers
    let headerRow = '   ';
    for (let col = 0; col < BOARD_COLS; col++) {
        headerRow += col + ' ';
        if ((col + 1) % BOARD_SUB_COLS === 0 && col < BOARD_COLS - 1) {
            headerRow += '| ';
        }
    }
    console.log(headerRow);

    // Create separator line
    let separator = '   ';
    for (let col = 0; col < BOARD_COLS; col++) {
        separator += '--';
        if ((col + 1) % BOARD_SUB_COLS === 0 && col < BOARD_COLS - 1) {
            separator += '+-';
        }
    }
    console.log(separator);

    for (let row = 0; row < BOARD_ROWS; row++) {
        let rowStr = `${row.toString().padStart(2)} `;
        for (let col = 0; col < BOARD_COLS; col++) {
            const cell = board[row][col];
            let symbol = cell.contains === CellState.EMPTY ? ' ' : cell.contains;
            rowStr += symbol + ' ';

            // Add vertical divider after every BOARD_SUB_COLS columns
            if ((col + 1) % BOARD_SUB_COLS === 0 && col < BOARD_COLS - 1) {
                rowStr += '| ';
            }
        }
        console.log(rowStr);

        // Add horizontal divider after every BOARD_SUB_ROWS rows
        if ((row + 1) % BOARD_SUB_ROWS === 0 && row < BOARD_ROWS - 1) {
            let dividerRow = '   ';
            for (let col = 0; col < BOARD_COLS; col++) {
                dividerRow += '--';
                if ((col + 1) % BOARD_SUB_COLS === 0 && col < BOARD_COLS - 1) {
                    dividerRow += '+-';
                }
            }
            console.log(dividerRow);
        }
    }
    console.log('\n');
}

class MiniSudokuSolver {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseGameState = {
            board: Array(BOARD_ROWS).fill().map(() => Array(BOARD_COLS).fill().map(() => ({ contains: CellState.EMPTY })))
        };
        this.simulatedGameState = {
            board: Array(BOARD_ROWS).fill().map(() => Array(BOARD_COLS).fill().map(() => ({ contains: CellState.EMPTY })))
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

        // Wait for the how to play button and click it if it exists
        try {
            await this.page.waitForSelector('.sudoku-tutorial-modal button.artdeco-modal__dismiss', { timeout: 100 });
            await this.page.click('.sudoku-tutorial-modal button.artdeco-modal__dismiss');
        } catch (error) {
            // How to play button not found, continue silently
        }

        // Wait for the skip tutorial button and click it if it exists
        try {
            await this.page.waitForSelector('[aria-label="Skip tutorial"]', { timeout: 100 });
            await this.page.click('[aria-label="Skip tutorial"]');
        } catch (error) {
            // Skip tutorial button not found, continue silently
        }

        // Wait for the board to appear
        await this.page.waitForSelector('.sudoku-grid');
        console.log('Step 1 complete: Game launched and board loaded.');
    }

    async parseBoardState() {
        console.log('Parsing board state...');
        const state = await this.page.evaluate(({ boardRows, boardCols }) => {
            // Create 2D array for board
            const board = Array(boardRows).fill().map(() => Array(boardCols).fill().map(() => ({ contains: 'empty' })));

            // Get all cells and convert to 2D array
            const cells = document.querySelectorAll('.sudoku-cell');
            const cells2D = Array(boardRows).fill().map(() => Array(boardCols).fill(null));

            cells.forEach((cell, index) => {
                const row = Math.floor(index / boardCols);
                const col = index % boardCols;
                if (row < boardRows && col < boardCols) {
                    cells2D[row][col] = cell;
                }
            });

            // Parse cells
            for (let row = 0; row < boardRows; row++) {
                for (let col = 0; col < boardCols; col++) {
                    const cell = cells2D[row][col];
                    if (!cell) continue;

                    // Parse cell content - look for numbers 1-6
                    const cellContent = cell.querySelector('.sudoku-cell-content');
                    if (cellContent) {
                        // Check if cell is empty
                        if (cellContent.textContent.trim() === '') {
                            board[row][col].contains = 'empty';
                        } else {
                            board[row][col].contains = cellContent.textContent.trim();
                        }
                    }
                }
            }

            return { board };
        }, { boardRows: BOARD_ROWS, boardCols: BOARD_COLS });

        // Create a proper deep copy of the state
        this.baseGameState = JSON.parse(JSON.stringify(state));
        this.simulatedGameState = {
            board: JSON.parse(JSON.stringify(state.board))
        };

        console.log('Step 2 complete: Board state parsed.');

        // Visualize the parsed board
        console.log('\nParsed Board State:');
        visualizeBoard(this.baseGameState.board);
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
        console.log('\nStarting puzzle solve...');

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
            console.log('Puzzle is already solved!');
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
            attempts++;

            if (index === emptyCells.length) {
                console.log('Solution found!');
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
            console.log('Step 3 complete: Puzzle solved.');
            console.log(`Total attempts: ${attempts}`);
            console.log('\nFinal Board State:');
            visualizeBoard(this.simulatedGameState.board);
            return solution;
        }

        console.log('Step 3 failed: No solution found.');
        console.log(`Total attempts: ${attempts}`);
        return null;
    }

    async inputSolution(solution) {
        console.log('Inputting solution...');

        if (!solution || solution.length === 0) {
            console.log('No solution to input');
            return;
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

        // Input numbers directly instead of clicking multiple times
        for (const [row, col, number] of newPlacements) {
            const cell = await this.page.$(`[data-cell-idx="${row * BOARD_COLS + col}"]`);
            if (cell) {
                // Skip if the target number is empty
                if (number === CellState.EMPTY || number === 'empty') {
                    continue;
                }

                // Click the cell once to activate it, then type the number directly
                await cell.click();

                // Type the number character directly using the correct method
                await cell.press(number);
                await this.page.waitForTimeout(50); // Small delay after input
            }
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
    const solver = new MiniSudokuSolver();
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
