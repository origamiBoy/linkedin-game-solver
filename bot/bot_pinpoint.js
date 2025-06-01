require('dotenv').config();
const { chromium } = require('playwright');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Game URL
const GAME_URL = 'https://www.linkedin.com/games/view/pinpoint/desktop/';

// OpenAI configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Main solver class
class PinpointSolver {
    constructor() {
        this.browser = null;
        this.page = null;
        this.phrases = [];
        this.solutions = [];
        // the maximum number of attempts to solve the puzzle, as ai solutions are not deterministic
        this.maxAttempts = 3;
        this.openaiAttempts = 3;
        this.getDirectSolution = false;
        this.templateSolution = "placeholder";
        this.currentAttempt = 0;
        this.solutionsFile = path.join(__dirname, 'solutions', 'pinpoint_solutions.json');
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
            await this.page.waitForSelector('.pinpoint-tutorial-modal button.artdeco-modal__dismiss', { timeout: 100 });
            await this.page.click('.pinpoint-tutorial-modal button.artdeco-modal__dismiss');
        } catch (error) {
            // Tutorial button not found, continue silently
        }

        console.log('Step 1 complete: Game launched and loaded.');
    }

    async parsePhrases() {
        this.phrases = await this.page.evaluate(() => {
            const phraseElements = document.querySelectorAll('.pinpoint__card.pinpoint__card--clue');
            return Array.from(phraseElements).map(element => element.textContent.trim());
        });
        return this.phrases;
    }

    async findSolution(phrases, previousSolutions = []) {
        if (this.getDirectSolution) {
            return this.templateSolution;
        }
        for (let attempt = 0; attempt < this.openaiAttempts; attempt++) {
            if (this.shouldStop) {
                return false;
            }
            try {
                const previousSolutionsText = previousSolutions.length > 0
                    ? `\nNote: These previous solutions were incorrect: "${previousSolutions.join('", "')}". Please provide a different answer.`
                    : '';

                const prompt = `You are solving the LinkedIn puzzle Pinpoint. Given these words or phrases: "${phrases.join('", "')}", what is the common category that related to meaning of each of them? Respond only with exactly a single word that best represents the category.${previousSolutionsText}`;

                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 50,
                    temperature: 0.7,
                });

                const solution = response.choices[0].message.content.trim().toLowerCase().replace(/[.,;:"'`]/g, '');
                // validates that it is not a repeat answer
                if (this.solutions.includes(solution)) {
                    continue;
                }
                // validates that the solution is a single word
                const words = solution.split(' ');
                if (words.length !== 1) {
                    this.solutions.push(solution);
                    continue;
                }
                return solution;
            } catch (error) {
                if (attempt === this.openaiAttempts - 1) {
                    return false;
                }
            }
        }
        // maximum openai attempts reached, continue current attempt until end of clues and forcefully parse the solution
        console.log(`Maximum openai attempts reached, continuing with direct solution`);
        this.getDirectSolution = true;
        return this.templateSolution;
    }

    async inputSolution(solution) {
        try {
            // Find the input field and type the solution
            const inputField = await this.page.$('.pinpoint__input');
            await inputField.fill(solution);

            // Find and click the submit button
            const submitButton = await this.page.$('.pinpoint__submit-btn');
            await submitButton.click();

            // Wait for the result
            await this.page.waitForTimeout(1000);
            return true;
        } catch (error) {
            console.error('Error inputting solution:', error);
            return false;
        }
    }

    async checkSolution() {
        const isCorrect = await this.page.evaluate(() => {
            const successElement = document.querySelector('.pinpoint__card__answer_text svg');
            return !!successElement;
        });
        return isCorrect;
    }

    async parseSolution() {
        this.solution = await this.page.evaluate(() => {
            const solutionElement = document.querySelector('.pinpoint__card__answer_text');
            return solutionElement ? solutionElement.textContent.trim() : null;
        });
        return this.solution;
    }

    async getCorrectSolution() {

        // Get number of clues dynamically
        const clues = await this.page.evaluate(() => {
            return document.querySelectorAll('.pinpoint__card__container').length;
        });

        let parsedPhrases = null;
        let attemptsMade = 0;

        // Outer loop for attempts
        for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
            attemptsMade++;
            console.log(`\nStarting attempt ${attempt + 1} of ${this.maxAttempts}`);

            // Refresh page for subsequent attempts
            if (attempt > 0) {
                await this.page.reload();
                // Wait for the start game button and click it
                await this.page.waitForSelector('#launch-footer-start-button');
                await this.page.click('#launch-footer-start-button');
            }

            // Inner loop for clues
            for (let clueIndex = 0; clueIndex < clues; clueIndex++) {
                console.log(`Solving clue ${clueIndex + 1} of ${clues}`);

                // Step 1: Parse phrases (only on first attempt)
                if (attempt === 0) {
                    const phrases = await this.parsePhrases();
                    if (!phrases || phrases.length === 0) {
                        console.log('Failed to parse phrases');
                        return {
                            success: false,
                            solutions: this.solutions,
                            error: 'Failed to parse phrases'
                        };
                    }
                    parsedPhrases = phrases;
                }

                // Step 2: Find solution
                let solution = await this.findSolution(parsedPhrases, this.solutions);
                if (!solution) {
                    console.log('Failed to generate solution from OpenAI');
                    return {
                        success: false,
                        solutions: this.solutions,
                        error: 'OpenAI failed to generate solution'
                    };
                }

                // Step 3: Input solution
                const inputSuccess = await this.inputSolution(solution);
                if (!inputSuccess) {
                    console.log('Failed to input solution');
                    return {
                        success: false,
                        solutions: this.solutions,
                        error: 'Failed to input solution'
                    };
                }

                // Step 4: Check if solution is correct
                let isCorrect = await this.checkSolution();

                // if forced solution is needed
                const isForcedSolution = this.getDirectSolution && clueIndex === clues - 1;
                const isAfterLastAttempt = attempt === this.maxAttempts - 1 && clueIndex === clues - 1;

                if (isForcedSolution || isAfterLastAttempt) {
                    const forcedSolution = await this.parseSolution();
                    if (forcedSolution) {
                        solution = forcedSolution;
                        // assumes directly provided solution is correct
                        isCorrect = true;
                    }
                }

                if (isCorrect) {
                    console.log('Correct solution found:', solution);

                    // Save the correct solution
                    this.saveSolution(solution);

                    return {
                        success: true,
                        solution: solution,
                        attemptsMade: attemptsMade
                    };
                } else {
                    console.log('Solution incorrect:', solution);
                    if (!this.solutions.includes(solution)) {
                        this.solutions.push(solution);
                    }
                }
            }
        }


        // If we get here, all attempts failed
        console.log('All attempts failed. Attempted solutions:', this.solutions);
        return {
            success: false,
            solutions: this.solutions,
            attemptsMade: attemptsMade
        };
    }

    async inputCorrectSolution() {

        // Get the most recent solution
        const storedSolution = this.getMostRecentSolution();
        if (!storedSolution) {
            console.log('No stored solution found');
            return {
                success: false,
                error: 'No stored solution found'
            };
        }

        // Input the stored solution
        const inputSuccess = await this.inputSolution(storedSolution.solution);
        if (!inputSuccess) {
            console.log('Failed to input solution');
            return {
                success: false,
                error: 'Failed to input solution'
            };
        }

        // Check if solution is correct
        const isCorrect = await this.checkSolution();
        if (isCorrect) {
            console.log('Correct solution inputted:', storedSolution.solution);
            return {
                success: true,
                solution: storedSolution.solution,
                timestamp: storedSolution.timestamp
            };
        } else {
            console.log('Stored solution is no longer correct');
            return {
                success: false,
                error: 'Stored solution is no longer correct'
            };
        }
    }

    saveSolution(solution) {
        try {
            const solutionData = {
                solution: solution,
                timestamp: new Date().toISOString()
            };

            fs.writeFileSync(this.solutionsFile, JSON.stringify(solutionData, null, 2));
        } catch (error) {
            console.error('Error saving solution:', error);
        }
    }

    getMostRecentSolution() {
        try {
            if (!fs.existsSync(this.solutionsFile)) {
                return null;
            }

            const data = fs.readFileSync(this.solutionsFile, 'utf8');
            const solutionData = JSON.parse(data);

            if (!solutionData.solution) {
                return null;
            }

            return solutionData;
        } catch (error) {
            console.error('Error reading solution:', error);
            return null;
        }
    }

    async cleanup() {
        console.log('Cleaning up...');
        await this.page.waitForTimeout(5000); // Wait 5 seconds
        await this.browser.close();
        console.log('Browser closed.');
    }
}

// Main execution
async function main() {
    const solver = new PinpointSolver();
    try {
        await solver.initialize();

        // Get command line arguments
        const args = process.argv.slice(2);
        const useStoredSolution = args.includes('--stored-solution') || args.includes('-s');
        const useGetSolution = args.includes('--get-solution') || args.includes('-g');

        if (useStoredSolution) {
            console.log('Using stored solution...');
            await solver.inputCorrectSolution();
        } else if (useGetSolution) {
            console.log('Getting new solution...');
            await solver.getCorrectSolution();
        } else {
            console.log('Using default solver...');
            await solver.getCorrectSolution();
        }

        await solver.cleanup();
    } catch (error) {
        console.error('Error:', error);
        if (solver.browser) {
            await solver.browser.close();
        }
    }
}

main(); 