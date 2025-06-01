# LinkedIn Solver

A collection of automated solvers for all of the LinkedIn games including Queens, Pinpoint, Crossclimb, Tango, and Zip. There are two versions for each solver, stand alone browser automation scripts using Playwright, and a browser extention using HTML, CSS, and JS. Used OpenAI's GPT for puzzle solving where applicable.

## Features

- Queens Puzzle Solver
- Zip Puzzle Solver
- Tango Puzzle Solver
- Pinpoint Puzzle Solver
- Crossclimb Puzzle Solver

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- A LinkedIn account
- OpenAI API key (for AI-assisted solving)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/linkedin-solver.git
cd linkedin-solver
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

## Usage

Each puzzle solver can be run using npm scripts:

### Queens Solver
```bash
npm run start:queens
```

### Zip Solver
```bash
npm run start:zip
```

### Tango Solver
```bash
npm run start:tango
```

### Pinpoint Solver
```bash
# Get new solution
npm run start:pinpoint:get

# Use stored solution
npm run start:pinpoint:stored

# Default solver
npm run start:pinpoint
```

### Crossclimb Solver
```bash
# Get new solution
npm run start:crossclimb:get

# Use stored solution
npm run start:crossclimb:stored

# Default solver
npm run start:crossclimb
```

## How it Works

### Queens/Zip/Tango Solver
- Parses the board for current configuration
- Uses depth-first search to find puzzle solutions
- Automatically clicks appropriate cells to input solution

### Pinpoint/Crossclimb Solvers
- Uses GPT to analyze and solve word-based puzzles
- Implements multiple attempts with different strategies
- Stores successful solutions for future use
- Can use stored solutions to quickly solve repeated puzzles

## Browser Extension

The project also includes a Chrome extension that can be used to solve puzzles directly in the browser. To use the extension:

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the project directory
4. The extension icon will appear in your browser toolbar

## Notes

- All solvers run in non-headless mode for visibility
- GPT-based solvers require an OpenAI API key
- Solutions are cached in JSON files for future use
- The extension version provides a more user-friendly interface

## Contributing

Not accepting contributions right now as this is a personal project, but feel free to clone it and make it your own.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 