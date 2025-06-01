const { chromium } = require('playwright');
const chalk = require('chalk');
const OpenAI = require('openai');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Game URL
const GAME_URL = 'https://www.linkedin.com/games/view/crossclimb/desktop/';

// Attempt limits
const middleClueAttempts = 3;
const finalClueAttempts = 5;
const openaiAttempts = 3;

// OpenAI configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Word size (will be determined dynamically)
let WORD_SIZE = 0;
let MIDDLE_CLUES_COUNT = 0;

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
function visualizeWords(words) {
    console.log('\nWord Chain:');
    words.forEach((word, index) => {
        const colorFn = colorMap[(index % 8) + 1];
        console.log(colorFn(`${index + 1}. ${word}`));
    });
    console.log('');
}

// Helper function to check if two words differ by exactly one letter
function differsByOneLetter(word1, word2) {
    if (word1.length !== word2.length) return false;
    let differences = 0;
    for (let i = 0; i < word1.length; i++) {
        if (word1[i] !== word2[i]) differences++;
        if (differences > 1) return false;
    }
    return differences === 1;
}

// Main solver class
class CrossclimbSolver {
    constructor() {
        this.browser = null;
        this.page = null;
        this.middleClues = [];
        this.solutionsFile = path.join(__dirname, 'solutions', 'crossclimb_solutions.json');
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
            await this.page.waitForSelector('.crossclimb-tutorial-modal button.artdeco-modal__dismiss', { timeout: 1000 });
            await this.page.click('.crossclimb-tutorial-modal button.artdeco-modal__dismiss');
        } catch (error) {
            // Tutorial button not found, continue silently
        }

        // Get word size from the first middle guess container
        await this.page.waitForSelector('.crossclimb__guess__container .crossclimb__guess--middle');
        WORD_SIZE = await this.page.evaluate(() => {
            const container = document.querySelector('.crossclimb__guess__container .crossclimb__guess--middle');
            return container.querySelectorAll('.crossclimb__guess_box').length;
        });

        console.log('Step 1 complete: Game launched and word size determined:', WORD_SIZE);
    }

    async middleCluesParse() {
        console.log('Parsing middle clues...');

        // Click the crab button until it's disabled
        while (true) {

            // Get current clue
            await this.page.waitForSelector('.crossclimb__clue');
            const clue = await this.page.evaluate(() => {
                const clueElement = document.querySelector('.crossclimb__clue');
                return clueElement ? clueElement.textContent.trim() : '';
            });

            if (!clue) break; // If no clue found, break the loop

            this.middleClues.push(clue);


            try {
                await this.page.waitForSelector('.crossclimb__crab-btn[aria-label="Go to next row"]', { timeout: 100 });
                const isDisabled = await this.page.evaluate(() => {
                    const button = document.querySelector('.crossclimb__crab-btn[aria-label="Go to next row"]');
                    return button.hasAttribute('disabled');
                });
                if (isDisabled) break;
            } catch (error) {
                break;
            }

            // Click crab button
            await this.page.click('.crossclimb__crab-btn[aria-label="Go to next row"]');
            await this.page.waitForTimeout(50);
        }

        MIDDLE_CLUES_COUNT = this.middleClues.length;
        console.log('Step 2 complete: Middle clues parsed. Count:', MIDDLE_CLUES_COUNT);
    }

    async middleCluesFindSolution(undoResult = null) {
        console.log('Finding solution for middle clues...');

        if (MIDDLE_CLUES_COUNT === 0) {
            console.log('No middle clues found. Exiting...');
            return { solutions: false, invalidWords: [] };
        }

        const cluesText = this.middleClues.map((clue, index) => `${index + 1} ${clue}`).join(' ');
        const invalidWords = new Set(); // Use Set to prevent duplicates

        for (let attempt = 0; attempt < openaiAttempts; attempt++) {
            // Combine undoResult incorrect words with any internal incorrect words
            const incorrectWords = new Set(); // Use Set to prevent duplicates

            // Add undoResult incorrect words
            if (undoResult && undoResult.incorrect.length > 0) {
                undoResult.incorrect.forEach(item => incorrectWords.add(item.word));
            }

            // Add any invalid words from previous attempts
            invalidWords.forEach(word => incorrectWords.add(word));

            const incorrectWordsText = incorrectWords.size > 0
                ? `\nNote: These previous words were incorrect: ${Array.from(incorrectWords).join(', ')}. Please provide different answers.`
                : '';

            const prompt = `you are solving the middle clues from the LinkedIn puzzle Crossclimb. There are ${MIDDLE_CLUES_COUNT} clues each with ${WORD_SIZE} letters. The words be able to be arrange in a way such that each word differs by only one letter. Output only the exact word answers in the order of the clue given with one space between them, and nothing else, like the following: 'cork hook corn cook torn'. the clues are ${cluesText}${incorrectWordsText}`;

            try {
                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 100,
                    temperature: 0.7,
                });

                const solution = response.choices[0].message.content.trim();
                //const solution = "shore stone shorn shone stine";

                // Parse the response into an array of words
                const words = solution.split(' ').map(word => word.toLowerCase());

                // Check word lengths and count
                if (words.length !== MIDDLE_CLUES_COUNT) {
                    console.error('Invalid number of words:', words);
                    continue;
                }

                if (!words.every(word => word.length === WORD_SIZE)) {
                    console.error('Invalid word lengths:', words);
                    words.forEach(word => {
                        if (word.length !== WORD_SIZE) {
                            invalidWords.add(word);
                        }
                    });
                    continue;
                }

                // Try to arrange the words in a valid chain
                const arrangedSolution = this.arrangeWordChain(words);
                if (!arrangedSolution) {
                    console.error('Could not arrange words in a valid chain:', words);
                    continue;
                }

                // Create the final solution array with word-location pairs
                const solutions = this.findRearrangedValues(words, arrangedSolution);
                console.log('Step 3 complete: Middle clues solution found.');
                return { solutions, invalidWords: Array.from(invalidWords) };
            } catch (error) {
                console.error('Error in attempt', attempt + 1, ':', error);
                if (attempt === openaiAttempts - 1) {
                    return { solutions: false, invalidWords: Array.from(invalidWords) };
                }
            }
        }
        return { solutions: false, invalidWords: Array.from(invalidWords) };
    }

    arrangeWordChain(words) {
        // Helper function to find all possible next words in the chain
        function findNextWords(currentWord, remainingWords) {
            return remainingWords.filter(word => differsByOneLetter(currentWord, word));
        }

        // Helper function to try building a chain starting from a specific word
        function tryBuildChain(startWord, remainingWords) {
            if (remainingWords.length === 0) {
                return [startWord];
            }

            const nextWords = findNextWords(startWord, remainingWords);
            for (const nextWord of nextWords) {
                const newRemaining = remainingWords.filter(w => w !== nextWord);
                const chain = tryBuildChain(nextWord, newRemaining);
                if (chain) {
                    return [startWord, ...chain];
                }
            }
            return null;
        }

        // Try building a chain starting from each word
        for (const startWord of words) {
            const remainingWords = words.filter(w => w !== startWord);
            const chain = tryBuildChain(startWord, remainingWords);
            if (chain) {
                return chain;
            }
        }

        return false;
    }

    findRearrangedValues(initialWords, rearrangedWords) {
        return initialWords.map(word => {
            const finalOrder = rearrangedWords.indexOf(word);
            return {
                final_order: finalOrder,
                word: word
            };
        });
    }

    async middleCluesInput(solutions, undoResult = null) {
        console.log('Inputting middle clues solution...');

        for (let i = 0; i < solutions.length; i++) {
            // Skip if this index was previously correct
            if (undoResult && undoResult.correct.some(item => item.index === i)) {
                continue;
            }

            // + 2 because index to nth and for ignoring top container
            await this.page.waitForSelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${i + 2})`);
            await this.page.click(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${i + 2})`);
            for (const letter of solutions[i].word) {
                await this.page.keyboard.type(letter);
                await this.page.waitForTimeout(50);
            }
        }
    }

    async slideUp(index, moves) {
        // + 2 because index to nth and for ignoring top container
        await this.page.waitForSelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${index + 2})`);
        await this.page.click(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${index + 2})`);
        await this.page.waitForTimeout(50);

        await this.page.keyboard.press('Tab');
        await this.page.keyboard.press('Enter');

        // Press up arrow moves times
        for (let i = 0; i < moves; i++) {
            await this.page.keyboard.press('ArrowUp');
        }

        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(50);
    }

    async correctMiddleWords() {
        console.log('Checking if middle words are correct...');

        // Get all middle guess containers
        const containers = await this.page.$$('.crossclimb__guess__container .crossclimb__guess--middle');

        for (let i = 0; i < containers.length; i++) {
            const isCorrect = await this.page.evaluate((index) => {
                const element = document.querySelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${index + 2})`);
                return !element.classList.contains('crossclimb__guess--incorrect');
            }, i);

            if (!isCorrect) {
                return false;
            }
        }
        return true;
    }

    async middleCluesRearrange(solutions) {
        console.log('Rearranging middle clues solution...');

        // Create a deep copy of solutions for rearrangement
        const solutionsCopy = JSON.parse(JSON.stringify(solutions));

        // Rearrange words according to final_order
        const sortedSolutions = [...solutionsCopy].sort((a, b) => a.final_order - b.final_order);

        for (let i = 0; i < sortedSolutions.length; i++) {
            const currentIndex = solutionsCopy.findIndex(s => s.final_order === sortedSolutions[i].final_order);
            if (currentIndex !== i) {
                await this.slideUp(currentIndex, currentIndex - i);

                // Update the solutions array to reflect the slide up
                // For each move up, swap the current word with the word above it
                for (let move = 0; move < currentIndex - i; move++) {
                    const currentPos = currentIndex - move;
                    const swapPos = currentPos - 1;

                    // Swap the words in the solutions array
                    const temp = solutionsCopy[currentPos];
                    solutionsCopy[currentPos] = solutionsCopy[swapPos];
                    solutionsCopy[swapPos] = temp;
                }
            }
        }
        console.log('Step 4 complete: Middle clues solution inputted and rearranged.');
        return;
    }

    async middleClueCheckSolution() {
        // for animation to complete
        await this.page.waitForTimeout(2000);
        const isComplete = await this.page.evaluate(() => {
            const clue = document.querySelector('.crossclimb__clue');
            return clue.id === 'crossclimb-clue-section-0';
        });

        if (!isComplete) {
            console.log('Middle solution not found');
        }

        return isComplete;
    }

    async undoMiddleCluesInput(middleSolutions) {
        console.log('Undoing middle clues input...');
        const result = {
            correct: [],
            incorrect: []
        };

        // Get all middle guess containers
        const containers = await this.page.$$('.crossclimb__guess__container .crossclimb__guess--middle');
        for (let i = 0; i < containers.length; i++) {
            const isCorrect = await this.page.evaluate((index) => {
                const element = document.querySelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${index + 2})`);
                return !element.classList.contains('crossclimb__guess--incorrect');
            }, i);

            if (isCorrect) {
                result.correct.push({ index: i, word: middleSolutions[i].word });
            } else {
                result.incorrect.push({ index: i, word: middleSolutions[i].word });
                // Click the incorrect word and delete it
                await this.page.waitForSelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${i + 2}) .crossclimb__guess_box:nth-child(${WORD_SIZE})`);
                await this.page.click(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${i + 2}) .crossclimb__guess_box:nth-child(${WORD_SIZE})`);
                await this.page.waitForTimeout(50);
                for (let j = 0; j < WORD_SIZE; j++) {
                    await this.page.keyboard.press('Backspace');
                    await this.page.waitForTimeout(50);
                }
            }
        }

        return result;
    }

    async solveMiddleClues() {
        console.log('Starting middle clues solution...');

        await this.middleCluesParse();
        let middleSolutions = false;
        let undoResult = {
            correct: [],
            incorrect: []
        };

        for (let attempt = 0; attempt < middleClueAttempts; attempt++) {
            // only undo on subsequent attempts
            const result = await this.middleCluesFindSolution(undoResult);
            middleSolutions = result.solutions;

            // Add any invalid words to the incorrect list with index -1
            if (result.invalidWords.length > 0) {
                // Create a Set of existing words to prevent duplicates
                const existingWords = new Set(undoResult.incorrect.map(item => item.word));

                // Add only new invalid words
                const newInvalidWords = result.invalidWords
                    .filter(word => !existingWords.has(word))
                    .map(word => ({ index: -1, word }));

                undoResult.incorrect = [...undoResult.incorrect, ...newInvalidWords];
            }

            if (!middleSolutions) {
                console.log('Failed to find valid middle solutions');
                continue;
            }

            await this.middleCluesInput(middleSolutions, undoResult);

            // Check if all words are correct
            if (await this.correctMiddleWords()) {
                // If all words are correct, try rearranging
                await this.middleCluesRearrange(middleSolutions);
                if (await this.middleClueCheckSolution()) {
                    return middleSolutions;
                } else {
                    //all board words are correct, but rearangment is invalid
                    return false;
                }
            }

            // only undo after failure on attempt
            if (attempt < middleClueAttempts - 1) {
                const newUndoResult = await this.undoMiddleCluesInput(middleSolutions);

                // Merge new results with existing ones, ensuring no duplicates
                undoResult.correct = [...undoResult.correct, ...newUndoResult.correct.filter(newItem =>
                    !undoResult.correct.some(existingItem =>
                        existingItem.index === newItem.index && existingItem.word === newItem.word
                    )
                )];
                undoResult.incorrect = [...undoResult.incorrect, ...newUndoResult.incorrect.filter(newItem =>
                    !undoResult.incorrect.some(existingItem =>
                        existingItem.index === newItem.index && existingItem.word === newItem.word
                    )
                )];
            }
        }

        return false;
    }

    async finalClueParse() {
        console.log('Parsing final clue...');
        const finalClue = await this.page.evaluate(() => {
            const clue = document.querySelector('.crossclimb__clue');
            return clue.textContent.trim();
        });

        // Trim specific phrases from the clue
        let trimmedClue = finalClue;
        if (trimmedClue.startsWith('The top + bottom rows = ')) {
            trimmedClue = trimmedClue.substring('The top + bottom rows = '.length);
        }
        if (trimmedClue.endsWith('Keep in mind: The first word may be at the bottom.')) {
            trimmedClue = trimmedClue.substring(0, trimmedClue.length - 'Keep in mind: The first word may be at the bottom.'.length);
        }

        console.log('Step 5 complete: Final clue parsed.');
        return trimmedClue;
    }

    async finalClueFindSolution(finalClue, middleSolutions, undoResult = null) {
        console.log('Finding solution for final clue...');

        const orderedWords = [...middleSolutions].sort((a, b) => a.final_order - b.final_order).map(s => s.word);
        const firstWord = orderedWords[0];
        const lastWord = orderedWords[orderedWords.length - 1];
        const invalidWords = new Set(); // Use Set to prevent duplicates

        for (let attempt = 0; attempt < openaiAttempts; attempt++) {
            // Combine undoResult incorrect words with any internal incorrect words
            const incorrectWords = new Set(); // Use Set to prevent duplicates

            // Add undoResult incorrect words
            if (undoResult && undoResult.incorrect.length > 0) {
                undoResult.incorrect.forEach(item => incorrectWords.add(item.word));
            }

            // Add any invalid words from previous attempts
            invalidWords.forEach(word => incorrectWords.add(word));

            const incorrectWordsText = incorrectWords.size > 0
                ? `\nNote: These previous words were incorrect: ${Array.from(incorrectWords).join(', ')}. Please provide different answers that still connect to "${firstWord}" and "${lastWord}".`
                : '';

            const prompt = `You are solving the final two clues from the LinkedIn puzzle Crossclimb. Their are one or two related clues, each with a single word answer of exactly ${WORD_SIZE} letters. One word solution should only differ from one letter of "${firstWord}" and the other solution should differ from only one letter of "${lastWord}". Output only the exact word answers with one space between them and nothing else. The clue is: "${finalClue}"${incorrectWordsText}`;

            try {
                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 50,
                    temperature: 0.7,
                });

                const solution = response.choices[0].message.content.trim();
                // const solution = "thorn spine";

                const final_solutions = solution.split(' ').map(word => word.toLowerCase());

                // Verify solution
                if (final_solutions.length !== 2) {
                    console.error('Invalid number of final solutions:', final_solutions);
                    // doesn't have an invalid check cause its output is not in the format requested
                    continue;
                }

                if (!final_solutions.every(word => word.length === WORD_SIZE)) {
                    console.error('Invalid word lengths in final solutions:', final_solutions);
                    final_solutions.forEach(word => {
                        if (word.length !== WORD_SIZE) {
                            invalidWords.add(word);
                        }
                        // check valid word length but invalid chain
                        else if (!differsByOneLetter(word, firstWord) && !differsByOneLetter(word, lastWord)) {
                            invalidWords.add(word);
                        }
                    });
                    continue;
                }

                // Check if solutions form a valid chain
                const firstSolutionConnectsToFirst = differsByOneLetter(final_solutions[0], firstWord);
                const firstSolutionConnectsToLast = differsByOneLetter(final_solutions[0], lastWord);
                const secondSolutionConnectsToFirst = differsByOneLetter(final_solutions[1], firstWord);
                const secondSolutionConnectsToLast = differsByOneLetter(final_solutions[1], lastWord);

                const isValidChain = (
                    (firstSolutionConnectsToFirst && secondSolutionConnectsToLast) ||
                    (firstSolutionConnectsToLast && secondSolutionConnectsToFirst)
                );

                if (!isValidChain) {
                    console.error('Invalid word chain in final solutions:', final_solutions);
                    // Find which words are invalid
                    if (!firstSolutionConnectsToFirst && !firstSolutionConnectsToLast) {
                        invalidWords.add(final_solutions[0]);
                    }
                    if (!secondSolutionConnectsToFirst && !secondSolutionConnectsToLast) {
                        invalidWords.add(final_solutions[1]);
                    }
                    continue;
                }

                // Reorder solutions so first solution connects to first word
                const orderedFinalSolutions = firstSolutionConnectsToFirst
                    ? final_solutions
                    : [final_solutions[1], final_solutions[0]];

                console.log('Step 6 complete: Final clue solution found.');
                return { solutions: orderedFinalSolutions, invalidWords: Array.from(invalidWords) };
            } catch (error) {
                console.error('Error in attempt', attempt + 1, ':', error);
                if (attempt === openaiAttempts - 1) {
                    return { solutions: false, invalidWords: Array.from(invalidWords) };
                }
            }
        }
        return { solutions: false, invalidWords: Array.from(invalidWords) };
    }

    async finalCluesInput(finalSolutions, undoResult = null) {
        console.log('Inputting final clues solution...');

        // Input first word if it was incorrect or not previously tried
        if (!undoResult || !undoResult.correct.some(item => item.index === 0)) {
            await this.page.waitForSelector('.crossclimb__guess:nth-child(1)');
            await this.page.click('.crossclimb__guess:nth-child(1)');
            await this.page.waitForTimeout(50);

            for (const letter of finalSolutions[0]) {
                await this.page.keyboard.type(letter);
                await this.page.waitForTimeout(50);
            }
        }

        // Input last word if it was incorrect or not previously tried
        if (!undoResult || !undoResult.correct.some(item => item.index === 1)) {
            await this.page.waitForSelector('div.crossclimb__guess--last');
            await this.page.click('div.crossclimb__guess--last');
            await this.page.waitForTimeout(50);

            for (const letter of finalSolutions[1]) {
                await this.page.keyboard.type(letter);
                await this.page.waitForTimeout(50);
            }
        }

        console.log('Step 7 complete: Final clues solution inputted.');
    }

    async finalClueCheckSolution() {
        const isComplete = await this.page.evaluate(() => {
            const hintButton = document.querySelector('[data-control-btn="hint"]');
            return hintButton.disabled;
        });
        if (isComplete) {
            console.log('Final solution found');
        }
        else {
            console.log('Final solution not found');
        }
        return isComplete;
    }

    async undoFinalCluesInput(finalSolutions) {
        console.log('Undoing final clues input...');
        const result = {
            correct: [],
            incorrect: []
        };

        // Check first word
        const firstWordCorrect = await this.page.evaluate(() => {
            const element = document.querySelector('.crossclimb__guess:nth-child(1)');
            return !element.classList.contains('crossclimb__guess--incorrect');
        });

        if (firstWordCorrect) {
            result.correct.push({ index: 0, word: finalSolutions[0] });
        } else {
            result.incorrect.push({ index: 0, word: finalSolutions[0] });
            await this.page.waitForSelector(`.crossclimb__guess:nth-child(1) .crossclimb__guess_box:nth-child(${WORD_SIZE})`);
            await this.page.click(`.crossclimb__guess:nth-child(1) .crossclimb__guess_box:nth-child(${WORD_SIZE})`);
            for (let i = 0; i < WORD_SIZE; i++) {
                await this.page.keyboard.press('Backspace');
                await this.page.waitForTimeout(50);
            }
        }

        // Check last word
        const lastWordCorrect = await this.page.evaluate(() => {
            const element = document.querySelector('.crossclimb__guess--last');
            return !element.classList.contains('crossclimb__guess--incorrect');
        });

        if (lastWordCorrect) {
            result.correct.push({ index: 1, word: finalSolutions[1] });
        } else {
            result.incorrect.push({ index: 1, word: finalSolutions[1] });

            await this.page.waitForSelector(`.crossclimb__guess--last .crossclimb__guess_box:nth-child(${WORD_SIZE})`);
            await this.page.click(`.crossclimb__guess--last .crossclimb__guess_box:nth-child(${WORD_SIZE})`);
            for (let i = 0; i < WORD_SIZE; i++) {
                await this.page.keyboard.press('Backspace');
                await this.page.waitForTimeout(50);
            }
        }

        return result;
    }

    async solveFinalClues(middleSolutions) {
        console.log('Starting final clues solution...');

        const finalClue = await this.finalClueParse();
        let finalSolutions = false;
        let undoResult = {
            correct: [],
            incorrect: []
        };

        for (let attempt = 0; attempt < finalClueAttempts; attempt++) {
            const result = await this.finalClueFindSolution(finalClue, middleSolutions, undoResult);
            finalSolutions = result.solutions;

            // Add any invalid words to the incorrect list with index -1
            if (result.invalidWords.length > 0) {
                // Create a Set of existing words to prevent duplicates
                const existingWords = new Set(undoResult.incorrect.map(item => item.word));

                // Add only new invalid words
                const newInvalidWords = result.invalidWords
                    .filter(word => !existingWords.has(word))
                    .map(word => ({ index: -1, word }));

                undoResult.incorrect = [...undoResult.incorrect, ...newInvalidWords];
            }

            if (!finalSolutions) {
                console.log('Failed to find valid final solutions');
                continue;
            }

            await this.finalCluesInput(finalSolutions, undoResult);
            if (await this.finalClueCheckSolution()) {
                // Save the complete word chain
                this.saveWordChain(middleSolutions, finalSolutions);
                return finalSolutions;
            }

            // only undo after failure on attempt
            if (attempt < finalClueAttempts - 1) {
                const newUndoResult = await this.undoFinalCluesInput(finalSolutions);

                // Merge new results with existing ones, ensuring no duplicates
                undoResult.correct = [...undoResult.correct, ...newUndoResult.correct.filter(newItem =>
                    !undoResult.correct.some(existingItem =>
                        existingItem.index === newItem.index && existingItem.word === newItem.word
                    )
                )];
                undoResult.incorrect = [...undoResult.incorrect, ...newUndoResult.incorrect.filter(newItem =>
                    !undoResult.incorrect.some(existingItem =>
                        existingItem.index === newItem.index && existingItem.word === newItem.word
                    )
                )];
            }
        }

        return false;
    }

    saveWordChain(middleSolutions, finalSolutions) {
        try {
            // Sort solutions for ordered words
            const sortedSolutions = [...middleSolutions].sort((a, b) => a.final_order - b.final_order);
            const orderedWords = sortedSolutions.map(s => s.word);

            const solutionData = {
                middleSolutions: middleSolutions,
                rearrangedChain: [finalSolutions[0], ...orderedWords, finalSolutions[1]]
            };

            fs.writeFileSync(this.solutionsFile, JSON.stringify(solutionData, null, 2));
        } catch (error) {
            console.error('Error saving word chain:', error);
        }
    }

    getSavedWordChain() {
        try {
            if (!fs.existsSync(this.solutionsFile)) {
                return null;
            }

            const data = fs.readFileSync(this.solutionsFile, 'utf8');
            const solutionData = JSON.parse(data);

            if (!solutionData.middleSolutions || !solutionData.rearrangedChain) {
                return null;
            }

            return solutionData;
        } catch (error) {
            console.error('Error reading word chain:', error);
            return null;
        }
    }

    async getCorrectSolution() {
        const middleSolutions = await this.solveMiddleClues();
        if (!middleSolutions) {
            return { success: false, rearrangedChain: [], error: 'Failed to find valid middle solutions after all attempts' };
        }

        const sortedMiddleSolutions = [...middleSolutions].sort((a, b) => a.final_order - b.final_order);
        const orderedMiddleWords = sortedMiddleSolutions.map(s => s.word);

        console.log('Middle solutions:');
        visualizeWords(orderedMiddleWords);

        const finalSolutions = await this.solveFinalClues(middleSolutions);
        if (!finalSolutions) {
            return { success: false, rearrangedChain: [], error: 'Failed to find valid final solutions after all attempts' };
        }

        console.log('Final solutions:');
        visualizeWords([finalSolutions[0], finalSolutions[1]]);

        return { success: true, rearrangedChain: [finalSolutions[0], ...orderedMiddleWords, finalSolutions[1]] };
    }

    async inputCorrectSolution() {

        const wordChain = this.getSavedWordChain();
        if (!wordChain) {
            return { success: false, rearrangedChain: [], error: 'No stored solution found' };
        }

        console.log('Step 2 skipped: Middle clues parsing, not needed');
        console.log('Step 3 skipped: Middle solutions found, not needed');
        console.log('Inputting saved word chain solution...');

        // Calculate words from solutions
        const middleWords = wordChain.middleSolutions.map(s => s.word);

        // First input all middle words in original order
        for (let i = 0; i < middleWords.length; i++) {
            // + 2 because index to nth and for ignoring top container
            await this.page.waitForSelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${i + 2})`);
            await this.page.click(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${i + 2})`);
            await this.page.waitForTimeout(50);
            for (const letter of middleWords[i]) {
                await this.page.keyboard.type(letter);
                await this.page.waitForTimeout(50);
            }
        }

        if (await this.correctMiddleWords()) {
            // Rearrange middle words using the solutions
            await this.middleCluesRearrange(wordChain.middleSolutions);
            if (!await this.middleClueCheckSolution()) {
                console.log("Rearranged middle words not correct");
                return { success: false, rearrangedChain: wordChain.rearrangedChain, error: 'Rearranged middle words not correct' };
            }
        }
        else {
            console.log("Middle words not correct");
            return { success: false, rearrangedChain: wordChain.rearrangedChain, error: 'Middle words not correct' };
        }

        console.log('Step 5 skipped: Final solutions parsed, not needed');
        console.log('Step 6 skipped: Final solutions found, not needed');
        console.log('Inputting final clues solution...');
        // Input final words
        // First word
        await this.page.waitForSelector('.crossclimb__guess:nth-child(1)');
        await this.page.click('.crossclimb__guess:nth-child(1)');
        await this.page.waitForTimeout(50);
        for (const letter of wordChain.rearrangedChain[0]) {
            await this.page.keyboard.type(letter);
            await this.page.waitForTimeout(50);
        }

        // Last word
        await this.page.waitForSelector('div.crossclimb__guess--last');
        await this.page.click('div.crossclimb__guess--last');
        await this.page.waitForTimeout(50);
        for (const letter of wordChain.rearrangedChain[wordChain.rearrangedChain.length - 1]) {
            await this.page.keyboard.type(letter);
            await this.page.waitForTimeout(50);
        }

        console.log('Step 7 complete: Final clues solution inputted.');

        const isComplete = await this.finalClueCheckSolution();
        console.log('Word chain input complete');
        return { success: isComplete, rearrangedChain: wordChain.rearrangedChain };
    }

    async cleanup() {
        console.log('Cleaning up...');
        await this.page.waitForTimeout(5000); // Wait 5 seconds
        await this.browser.close();
        console.log('Step 8 complete: Browser closed.');
    }
}

// Main execution
async function main() {
    const solver = new CrossclimbSolver();
    try {
        await solver.initialize();

        // Get command line arguments
        const args = process.argv.slice(2);
        const useStoredSolution = args.includes('--stored-solution') || args.includes('-s');
        const useGetSolution = args.includes('--get-solution') || args.includes('-g');

        let result;
        if (useStoredSolution) {
            console.log('Using stored solution...');
            result = await solver.inputCorrectSolution();
        } else if (useGetSolution) {
            console.log('Getting new solution...');
            result = await solver.getCorrectSolution();
        } else {
            console.log('Using default solver...');
            result = await solver.getCorrectSolution();
        }

        if (result.success) {
            console.log('Puzzle solved, final solution:');
            visualizeWords(result.rearrangedChain);
        }
        else {
            console.log('Failed to solve puzzle. Error:', result.error);
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