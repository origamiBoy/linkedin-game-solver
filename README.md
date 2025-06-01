# LinkedIn Solver

A collection of automated solutions for LinkedIn Games puzzles. This project uses Playwright for browser automation and OpenAI for puzzle-solving assistance.

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

### Queens Puzzle
```bash
npm run start:queens
```

### Zip Puzzle
```bash
npm run start:zip
```

### Tango Puzzle
```bash
npm run start:tango
```

### Pinpoint Puzzle
```bash
# Solve new puzzle
npm run start:pinpoint

# Use stored solution
npm run start:pinpoint:stored

# Get solution without solving
npm run start:pinpoint:get
```

### Crossclimb Puzzle
```bash
# Solve new puzzle
npm run start:crossclimb

# Use stored solution
npm run start:crossclimb:stored

# Get solution without solving
npm run start:crossclimb:get
```

## Project Structure

- `bot_*.js` files: Individual puzzle solvers
- `utils/`: Utility functions and shared code
- `solutions/`: Stored solutions for puzzles

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This project is for educational purposes only. Use responsibly and in accordance with LinkedIn's terms of service. 