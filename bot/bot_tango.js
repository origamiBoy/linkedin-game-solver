const { chromium } = require('playwright');
const chalk = require('chalk');

// Game URL
const GAME_URL = 'https://www.linkedin.com/games/view/tango/desktop/';

// Board dimensions
const BOARD_SIZE = 6;
const EDGE_SIZE = BOARD_SIZE - 1;

// Cell and Edge States
const CellState = {
    EMPTY: 'empty',
    MOON: 'moon',
    SUN: 'sun'
};

const ThemedCellState = [
    {
        MOON: 'Heels',
        SUN: 'Sara Blakely'
    }
];

const EdgeState = {
    EMPTY: 'empty',
    EQUAL: 'equal',
    OPPOSITE: 'opposite'
};

// Debug visualization function
function visualizeBoard(board, edges) {
    console.log('\nBoard State:');
    // Print column numbers with proper spacing
    let header = '  ';
    for (let i = 0; i < BOARD_SIZE; i++) {
        header += i + '   ';  // Add extra space to align with cell content
    }
    console.log(header);

    for (let row = 0; row < BOARD_SIZE; row++) {
        let rowStr = `${row} `;
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = board[row][col];
            let symbol = ' ';
            if (cell.contains === CellState.MOON) symbol = 'M';
            else if (cell.contains === CellState.SUN) symbol = 'S';
            rowStr += symbol + ' ';

            // Print horizontal edge
            if (col < EDGE_SIZE) {
                const edge = edges.horizontal[row][col];
                if (edge.state === EdgeState.OPPOSITE) rowStr += 'X ';
                else if (edge.state === EdgeState.EQUAL) rowStr += '= ';
                else rowStr += '| ';
            }
        }
        console.log(rowStr);

        // Print vertical edges
        if (row < EDGE_SIZE) {
            let edgeStr = '  ';
            for (let col = 0; col < BOARD_SIZE; col++) {
                const edge = edges.vertical[row][col];
                if (edge.state === EdgeState.OPPOSITE) edgeStr += 'X ';
                else if (edge.state === EdgeState.EQUAL) edgeStr += '= ';
                else edgeStr += '- ';
                edgeStr += '  '; // Add space after each edge to align with cell content
            }
            console.log(edgeStr);
        }
    }
    console.log('\n');
}

class TangoSolver {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseGameState = {
            board: Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill().map(() => ({ contains: CellState.EMPTY }))),
            edges: {
                horizontal: Array(BOARD_SIZE).fill().map(() => Array(EDGE_SIZE).fill().map(() => ({ state: EdgeState.EMPTY }))),
                vertical: Array(EDGE_SIZE).fill().map(() => Array(BOARD_SIZE).fill().map(() => ({ state: EdgeState.EMPTY })))
            }
        };
        this.simulatedGameState = {
            board: Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill().map(() => ({ contains: CellState.EMPTY }))),
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
            await this.page.waitForSelector('.lotka-tutorial-modal button.artdeco-modal__dismiss', { timeout: 100 });
            await this.page.click('.lotka-tutorial-modal button.artdeco-modal__dismiss');
        } catch (error) {
            // Tutorial button not found, continue silently
        }

        // Wait for the board to appear
        await this.page.waitForSelector('.lotka-grid');
        this.simulatedGameState.edges = this.baseGameState.edges; // Reference the base game's edges
        console.log('Step 1 complete: Game launched and board loaded.');
    }

    async parseBoardState() {
        console.log('Parsing board state...');
        const state = await this.page.evaluate(({ boardSize, themedCellState }) => {
            // Create 2D arrays for board and edges
            const board = Array(boardSize).fill().map(() => Array(boardSize).fill().map(() => ({ contains: 'empty' })));
            const edges = {
                // For 6x6 grid: 6 horizontal edges per row and 6 rows
                horizontal: Array(boardSize).fill().map(() => Array(boardSize).fill().map(() => ({ state: 'empty' }))),
                // For 6x6 grid: 6 vertical edges per column and 5 rows
                vertical: Array(boardSize - 1).fill().map(() => Array(boardSize).fill().map(() => ({ state: 'empty' })))
            };

            // Get all cells and convert to 2D array
            const cells = document.querySelectorAll('.lotka-cell');
            const cells2D = Array(boardSize).fill().map(() => Array(boardSize).fill(null));

            cells.forEach((cell, index) => {
                const row = Math.floor(index / boardSize);
                const col = index % boardSize;
                cells2D[row][col] = cell;
            });

            // Parse cells and edges using 2D array
            for (let row = 0; row < boardSize; row++) {
                for (let col = 0; col < boardSize; col++) {
                    const cell = cells2D[row][col];
                    if (!cell) continue;

                    // Parse cell content
                    if (cell.querySelector('.lotka-cell-content .lotka-cell-empty')) {
                        board[row][col].contains = 'empty';
                    } else if (cell.querySelector('.lotka-cell-content #Moon')) {
                        board[row][col].contains = 'moon';
                    } else if (cell.querySelector('.lotka-cell-content #Sun')) {
                        board[row][col].contains = 'sun';
                    }
                    else {
                        // themed cells
                        for (const themedCell of themedCellState) {
                            if (cell.querySelector(`.lotka-cell-content [aria-label="${themedCell.MOON}"]`)) {
                                board[row][col].contains = 'moon';
                            } else if (cell.querySelector(`.lotka-cell-content [aria-label="${themedCell.SUN}"]`)) {
                                board[row][col].contains = 'sun';
                            }
                        }
                    }

                    // Parse right edge (horizontal edge)
                    const rightEdge = cell.querySelector('.lotka-cell-edge.lotka-cell-edge--right');
                    if (rightEdge) {
                        const svg = rightEdge.querySelector('svg');
                        if (svg) {
                            const label = svg.getAttribute('aria-label');
                            edges.horizontal[row][col].state = label === 'Cross' ? 'opposite' : 'equal';
                        } else {
                            edges.horizontal[row][col].state = 'empty';
                        }
                    }

                    // Parse bottom edge (vertical edge)
                    const bottomEdge = cell.querySelector('.lotka-cell-edge.lotka-cell-edge--down');
                    if (bottomEdge) {
                        const svg = bottomEdge.querySelector('svg');
                        if (svg) {
                            const label = svg.getAttribute('aria-label');
                            edges.vertical[row][col].state = label === 'Cross' ? 'opposite' : 'equal';
                        } else {
                            edges.vertical[row][col].state = 'empty';
                        }
                    }
                }
            }

            return { board, edges };
        }, { boardSize: BOARD_SIZE, themedCellState: ThemedCellState });

        // Create a proper deep copy of the state
        this.baseGameState = JSON.parse(JSON.stringify(state));
        this.simulatedGameState = {
            board: JSON.parse(JSON.stringify(state.board)),
            edges: this.baseGameState.edges  // Reference the base game's edges
        };

        console.log('Step 2 complete: Board state parsed.');

        // Visualize the parsed board using the existing function
        console.log('\nParsed Board State:');
        visualizeBoard(this.baseGameState.board, this.baseGameState.edges);
    }

    // Place a symbol and apply deduction rules
    placeSymbol(row, col, symbol) {
        this.simulatedGameState.board[row][col].contains = symbol;
        return true;
    }

    // Check if a cell placement is valid
    isValidPlacement(row, col, symbol) {
        // Check for three in a row (horizontal)
        // Check left side
        if (col >= 2) {
            if (this.simulatedGameState.board[row][col - 1].contains === symbol &&
                this.simulatedGameState.board[row][col - 2].contains === symbol) {
                return false;
            }
        }
        // Check right side
        if (col <= BOARD_SIZE - 3) {
            if (this.simulatedGameState.board[row][col + 1].contains === symbol &&
                this.simulatedGameState.board[row][col + 2].contains === symbol) {
                return false;
            }
        }
        // Check middle position
        if (col > 0 && col < BOARD_SIZE - 1) {
            if (this.simulatedGameState.board[row][col - 1].contains === symbol &&
                this.simulatedGameState.board[row][col + 1].contains === symbol) {
                return false;
            }
        }

        // Check for three in a row (vertical)
        // Check top
        if (row >= 2) {
            if (this.simulatedGameState.board[row - 1][col].contains === symbol &&
                this.simulatedGameState.board[row - 2][col].contains === symbol) {
                return false;
            }
        }
        // Check bottom
        if (row <= BOARD_SIZE - 3) {
            if (this.simulatedGameState.board[row + 1][col].contains === symbol &&
                this.simulatedGameState.board[row + 2][col].contains === symbol) {
                return false;
            }
        }
        // Check middle position
        if (row > 0 && row < BOARD_SIZE - 1) {
            if (this.simulatedGameState.board[row - 1][col].contains === symbol &&
                this.simulatedGameState.board[row + 1][col].contains === symbol) {
                return false;
            }
        }

        // Check column balance
        const colCounts = { [CellState.MOON]: 0, [CellState.SUN]: 0 };
        for (let r = 0; r < BOARD_SIZE; r++) {
            if (r !== row && this.simulatedGameState.board[r][col].contains !== CellState.EMPTY) {
                colCounts[this.simulatedGameState.board[r][col].contains]++;
            }
        }
        if (colCounts[symbol] + 1 > BOARD_SIZE / 2) {
            return false;
        }

        // Check row balance
        const rowCounts = { [CellState.MOON]: 0, [CellState.SUN]: 0 };
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (c !== col && this.simulatedGameState.board[row][c].contains !== CellState.EMPTY) {
                rowCounts[this.simulatedGameState.board[row][c].contains]++;
            }
        }
        if (rowCounts[symbol] + 1 > BOARD_SIZE / 2) {
            return false;
        }

        // Check edge constraints
        // Horizontal edges
        if (col < EDGE_SIZE) {
            const edge = this.simulatedGameState.edges.horizontal[row][col];
            if (edge.state === EdgeState.EQUAL &&
                this.simulatedGameState.board[row][col + 1].contains !== CellState.EMPTY &&
                this.simulatedGameState.board[row][col + 1].contains !== symbol) {
                return false;
            }
            if (edge.state === EdgeState.OPPOSITE &&
                this.simulatedGameState.board[row][col + 1].contains !== CellState.EMPTY &&
                this.simulatedGameState.board[row][col + 1].contains === symbol) {
                return false;
            }
        }
        if (col > 0) {
            const edge = this.simulatedGameState.edges.horizontal[row][col - 1];
            if (edge.state === EdgeState.EQUAL &&
                this.simulatedGameState.board[row][col - 1].contains !== CellState.EMPTY &&
                this.simulatedGameState.board[row][col - 1].contains !== symbol) {
                return false;
            }
            if (edge.state === EdgeState.OPPOSITE &&
                this.simulatedGameState.board[row][col - 1].contains !== CellState.EMPTY &&
                this.simulatedGameState.board[row][col - 1].contains === symbol) {
                return false;
            }
        }

        // Vertical edges
        if (row < EDGE_SIZE) {
            const edge = this.simulatedGameState.edges.vertical[row][col];
            if (edge.state === EdgeState.EQUAL &&
                this.simulatedGameState.board[row + 1][col].contains !== CellState.EMPTY &&
                this.simulatedGameState.board[row + 1][col].contains !== symbol) {
                return false;
            }
            if (edge.state === EdgeState.OPPOSITE &&
                this.simulatedGameState.board[row + 1][col].contains !== CellState.EMPTY &&
                this.simulatedGameState.board[row + 1][col].contains === symbol) {
                return false;
            }
        }
        if (row > 0) {
            const edge = this.simulatedGameState.edges.vertical[row - 1][col];
            if (edge.state === EdgeState.EQUAL &&
                this.simulatedGameState.board[row - 1][col].contains !== CellState.EMPTY &&
                this.simulatedGameState.board[row - 1][col].contains !== symbol) {
                return false;
            }
            if (edge.state === EdgeState.OPPOSITE &&
                this.simulatedGameState.board[row - 1][col].contains !== CellState.EMPTY &&
                this.simulatedGameState.board[row - 1][col].contains === symbol) {
                return false;
            }
        }

        return true;
    }

    // Get adjacent cells that are empty
    getAdjacentEmptyCells(row, col) {
        const adjacent = [];
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (const [dx, dy] of directions) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (newRow >= 0 && newRow < BOARD_SIZE &&
                newCol >= 0 && newCol < BOARD_SIZE &&
                this.simulatedGameState.board[newRow][newCol].contains === CellState.EMPTY) {
                adjacent.push([newRow, newCol]);
            }
        }

        return adjacent;
    }

    // Solve the puzzle using DFS
    solvePuzzle() {
        console.log('\nStarting puzzle solve...');
        const emptyCells = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (this.simulatedGameState.board[row][col].contains === CellState.EMPTY) {
                    emptyCells.push([row, col]);
                }
            }
        }

        // Sort empty cells by number of adjacent empty cells (heuristic)
        emptyCells.sort((a, b) => {
            const aAdjacent = this.getAdjacentEmptyCells(a[0], a[1]).length;
            const bAdjacent = this.getAdjacentEmptyCells(b[0], b[1]).length;
            // Most adjacent empty cells first
            return aAdjacent - bAdjacent;
        });

        const solution = [];
        let attempts = 0;

        const dfs = (index) => {
            attempts++;

            if (index === emptyCells.length) {
                console.log('Solution found!');
                return true;
            }

            const [row, col] = emptyCells[index];

            // Try placing moon
            if (this.isValidPlacement(row, col, CellState.MOON)) {
                if (this.placeSymbol(row, col, CellState.MOON)) {
                    solution.push([row, col, CellState.MOON]);
                    if (dfs(index + 1)) {
                        return true;
                    }
                    solution.pop();
                    this.simulatedGameState.board[row][col].contains = CellState.EMPTY;
                }
            }

            // Try placing sun
            if (this.isValidPlacement(row, col, CellState.SUN)) {
                if (this.placeSymbol(row, col, CellState.SUN)) {
                    solution.push([row, col, CellState.SUN]);
                    if (dfs(index + 1)) {
                        return true;
                    }
                    solution.pop();
                    this.simulatedGameState.board[row][col].contains = CellState.EMPTY;
                }
            }
            return false;
        };

        if (dfs(0)) {
            console.log('Step 3 complete: Puzzle solved.');
            console.log(`Total attempts: ${attempts}`);
            console.log('\nFinal Board State:');
            visualizeBoard(this.simulatedGameState.board, this.simulatedGameState.edges);
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
        const newPlacements = solution.filter(([row, col, symbol]) =>
            this.baseGameState.board[row][col].contains === CellState.EMPTY
        );

        // Sort placements by row first, then column
        newPlacements.sort(([rowA, colA], [rowB, colB]) => {
            if (rowA !== rowB) return rowA - rowB;
            return colA - colB;
        });

        // Click cells to place symbols in order
        for (const [row, col, symbol] of newPlacements) {
            const cell = await this.page.$(`#lotka-cell-${row * BOARD_SIZE + col}`);
            if (cell) {
                if (symbol === CellState.SUN) {
                    await cell.click();
                }
                else if (symbol === CellState.MOON) {
                    await cell.click();
                    await cell.click();
                }
                await this.page.waitForTimeout(10); // Small delay between clicks
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
    const solver = new TangoSolver();
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