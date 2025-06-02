// Main solver class
class CrossclimbSolver {
    constructor() {
        this.browser = null;
        this.page = null;
        this.middleClues = [];
        this.middleClueAttempts = 3;
        this.finalClueAttempts = 5;
        this.openaiAttempts = 3;
        this.shouldStop = false;
    }

    async initialize() {
        // Wait for the start game button and click it
        const startButton = document.querySelector('#launch-footer-start-button');
        if (startButton) {
            startButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Wait for the close tutorial button and click it if it exists
        const closeTutorialButton = document.querySelector('.crossclimb-tutorial-modal button.artdeco-modal__dismiss');
        if (closeTutorialButton) {
            closeTutorialButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Get word size from the first middle guess container
        const container = document.querySelector('.crossclimb__guess__container .crossclimb__guess--middle');
        if (!container) {
            throw new Error('Could not find middle guess container');
        }
        this.WORD_SIZE = container.querySelectorAll('.crossclimb__guess_box').length;
    }

    async middleCluesParse() {

        // Click the middle guess container first
        const container = document.querySelector('.crossclimb__guess__container .crossclimb__guess--middle');
        if (container) {
            container.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const clues = [];
        let currentClue = document.querySelector('.crossclimb__clue');

        while (currentClue) {
            const clue = currentClue.textContent.trim();
            if (!clue) break;

            clues.push(clue);

            const nextButton = document.querySelector('.crossclimb__crab-btn[aria-label="Go to next row"]');
            if (!nextButton || nextButton.hasAttribute('disabled')) break;

            nextButton.click();
            await new Promise(resolve => setTimeout(resolve, 50));
            currentClue = document.querySelector('.crossclimb__clue');
        }

        this.middleClues = clues;
        this.MIDDLE_CLUES_COUNT = clues.length;
        return clues;
    }

    async middleCluesFindSolution(undoResult = null) {
        if (this.MIDDLE_CLUES_COUNT === 0) {
            return { solutions: false, invalidWords: [], invalidWordChain: [] };
        }

        const cluesText = this.middleClues.map((clue, index) => `{${index + 1}: ${clue}}`).join(' ');

        // Initialize state Sets
        const invalidWordsCombined = new Set();
        const invalidWordChainCombined = new Set();

        // Initialize from undoResult if it exists
        if (undoResult) {
            if (undoResult.incorrect) {
                undoResult.incorrect.forEach(item => invalidWordsCombined.add(item));
            }
            if (undoResult.invalidWordChain) {
                undoResult.invalidWordChain.forEach(chain => invalidWordChainCombined.add(chain.join(' ')));
            }
        }

        for (let attempt = 0; attempt < this.openaiAttempts; attempt++) {
            if (this.shouldStop) {
                return { solutions: false, invalidWords: Array.from(invalidWordsCombined), invalidWordChain: Array.from(invalidWordChainCombined) };
            }

            // Display variables
            let invalidWordsDisplay = "";
            let validWordsDisplay = "";
            let invalidWordChainDisplay = "";

            // Convert to display format
            if (invalidWordsCombined.size > 0) {
                const invalidWordsDisplayList = new Set();
                invalidWordsCombined.forEach((item) => {
                    if (item.index !== -1) {
                        invalidWordsDisplayList.add(`{${item.index + 1}: ${item.word}}`);
                    } else {
                        invalidWordsDisplayList.add(`"${item.word}"`);
                    }
                });
                invalidWordsDisplay = Array.from(invalidWordsDisplayList).join(', ');
            }

            if (undoResult?.correct?.length > 0) {
                const validWordsDisplayList = new Set();
                undoResult.correct.forEach((item) => validWordsDisplayList.add(`{${item.index + 1}: ${item.word}}`));
                validWordsDisplay = Array.from(validWordsDisplayList).join(', ');
            }

            if (invalidWordChainCombined.size > 0) {
                invalidWordChainDisplay = Array.from(invalidWordChainCombined).map(chain => `"${chain}"`).join(', ');
            }

            const incorrectWordsText = invalidWordsDisplay
                ? `\nNote: These previous words were incorrect with their respective clue numbers if relevant: ${invalidWordsDisplay}. Please provide different answers.`
                : '';

            const correctWordsText = validWordsDisplay
                ? `\nNote: These previous words were correct with their respective clue numbers: ${validWordsDisplay}. Include these in the final answer.`
                : '';

            const invalidWordChainText = invalidWordChainDisplay
                ? `\nNote: These previous entire solutions were incorrect and could not be arranged in a valid chain: ${invalidWordChainDisplay}. Please provide different answers.`
                : '';

            const prompt = `You are solving the middle clues from the LinkedIn puzzle Crossclimb. There are ${this.MIDDLE_CLUES_COUNT} clues each with ${this.WORD_SIZE} letters. The words be able to be arrange in a way such that each word differs by only one letter, there are no duplicate words. The output should only consist of the word answers with one space between them, with no other text or numbers. An example output is: 'cork hook corn cook torn'. The clues are ${cluesText}${incorrectWordsText}${correctWordsText}${invalidWordChainText}`;

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'getOpenAIResponse',
                    prompt: prompt
                });

                if (response.error) {
                    throw new Error('Error from OpenAI');
                }

                if (!response.solution) {
                    throw new Error('No solution received from OpenAI');
                }

                const solution = response.solution.trim();
                const words = solution.split(' ').map(word => word.toLowerCase());

                if (words.length !== this.MIDDLE_CLUES_COUNT) {
                    continue;
                }

                if (!words.every(word => word.length === this.WORD_SIZE)) {
                    words.forEach(word => {
                        if (word.length !== this.WORD_SIZE) {
                            invalidWordsCombined.add({ index: -1, word });
                        }
                    });
                    continue;
                }

                const arrangedSolution = this.arrangeWordChain(words);
                if (!arrangedSolution) {
                    invalidWordChainCombined.add(words.join(' '));
                    continue;
                }

                const solutions = this.findRearrangedValues(words, arrangedSolution);
                return {
                    solutions,
                    invalidWords: Array.from(invalidWordsCombined),
                    invalidWordChain: Array.from(invalidWordChainCombined)
                };
            } catch (error) {
                return {
                    solutions: false,
                    invalidWords: Array.from(invalidWordsCombined),
                    invalidWordChain: Array.from(invalidWordChainCombined),
                    error: "OpenAI error"
                };
            }
        }
        return {
            solutions: false,
            invalidWords: Array.from(invalidWordsCombined),
            invalidWordChain: Array.from(invalidWordChainCombined),
            error: "Maximum attempts reached"
        };
    }

    arrangeWordChain(words) {
        // Use arrow function to preserve this binding
        const findNextWords = (currentWord, remainingWords) => {
            return remainingWords.filter(word => this.differsByOneLetter(currentWord, word));
        };

        // Use arrow function to preserve this binding
        const tryBuildChain = (startWord, remainingWords) => {
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
        };

        // If duplicate words, invalid arrangement
        for (let i = 0; i < words.length; i++) {
            for (let j = 0; j < words.length; j++) {
                if (i == j) continue;
                if (words[i] == words[j]) {
                    return false;
                }
            }
        }

        for (const startWord of words) {
            const remainingWords = words.filter(w => w !== startWord);
            const chain = tryBuildChain(startWord, remainingWords);
            if (chain) {
                return chain;
            }
        }

        return false;
    }

    differsByOneLetter(word1, word2) {
        if (word1.length !== word2.length) return false;
        let differences = 0;
        for (let i = 0; i < word1.length; i++) {
            if (word1[i] !== word2[i]) differences++;
            if (differences > 1) return false;
        }
        return differences === 1;
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

    /* async changeSettings() {
        console.log('CrossclimbSolver: Changing settings');
        const settingsButton = document.querySelector('#pr-game-web-settings-btn');
        if (!settingsButton) {
            console.log('CrossclimbSolver: Could not find settings button');
            return;
        }

        // Open settings
        console.log('CrossclimbSolver: Opening settings');
        settingsButton.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Click the toggle
        const toggle = document.querySelector('.settings-item:nth-child(3) > .settings-toggle div.artdeco-toggle');
        if (toggle) {
            console.log('CrossclimbSolver: Clicking toggle');
            toggle.click();
            await new Promise(resolve => setTimeout(resolve, 50));
        } else {
            console.log('CrossclimbSolver: Could not find toggle');
        }

        // Close settings
        console.log('CrossclimbSolver: Closing settings');
        settingsButton.click();
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    */

    async middleCluesInput(solutions, undoResult = null) {

        for (let i = 0; i < solutions.length; i++) {
            if (undoResult && undoResult.correct.some(item => item.index === i)) {
                continue;
            }

            const container = document.querySelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${i + 2})`);
            if (!container) {
                continue;
            }

            container.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Find all letter input boxes within the guess container
            const letterBoxes = container.querySelectorAll('.crossclimb__guess_box input');

            for (let j = 0; j < solutions[i].word.length; j++) {
                const letter = solutions[i].word[j];

                if (letterBoxes[j]) {
                    letterBoxes[j].value = letter;
                    letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }
    }

    async correctMiddleWords() {
        const containers = document.querySelectorAll('.crossclimb__guess__container .crossclimb__guess--middle');
        for (const container of containers) {
            if (container.classList.contains('crossclimb__guess--incorrect')) {
                return false;
            }
        }
        return true;
    }

    async middleCluesRearrange(solutions) {
        const solutionsCopy = JSON.parse(JSON.stringify(solutions));
        const sortedSolutions = [...solutionsCopy].sort((a, b) => a.final_order - b.final_order);

        for (let i = 0; i < sortedSolutions.length; i++) {
            const currentIndex = solutionsCopy.findIndex(s => s.final_order === sortedSolutions[i].final_order);
            if (currentIndex !== i) {
                await this.slideUp(currentIndex, currentIndex - i);

                for (let move = 0; move < currentIndex - i; move++) {
                    const currentPos = currentIndex - move;
                    const swapPos = currentPos - 1;

                    const temp = solutionsCopy[currentPos];
                    solutionsCopy[currentPos] = solutionsCopy[swapPos];
                    solutionsCopy[swapPos] = temp;
                }
            }
        }
        return;
    }

    async slideUp(index, moves) {

        const dragger = document.querySelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${index + 2}) .crossclimb__guess-dragger__left`);
        if (!dragger) {
            return;
        }

        try {
            // Focus and activate dragger
            dragger.focus();
            await new Promise(resolve => setTimeout(resolve, 50));
            dragger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 50));

            // Move up
            for (let i = 0; i < moves; i++) {
                dragger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Confirm move
            dragger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
            // Silently caught
        }
    }

    async middleClueCheckSolution() {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const clue = document.querySelector('.crossclimb__clue');
        return clue && clue.id === 'crossclimb-clue-section-0';
    }

    async undoMiddleCluesInput(middleSolutions) {
        const result = {
            correct: [],
            incorrect: []
        };

        const containers = document.querySelectorAll('.crossclimb__guess__container .crossclimb__guess--middle');
        for (let i = 0; i < containers.length; i++) {
            const isCorrect = !containers[i].classList.contains('crossclimb__guess--incorrect');

            if (isCorrect) {
                result.correct.push({ index: i, word: middleSolutions[i].word });
            } else {
                result.incorrect.push({ index: i, word: middleSolutions[i].word });
                containers[i].click();
                await new Promise(resolve => setTimeout(resolve, 50));

                const letterBoxes = containers[i].querySelectorAll('.crossclimb__guess_box input');

                for (let j = 0; j < letterBoxes.length; j++) {
                    if (letterBoxes[j]) {
                        letterBoxes[j].value = '';
                        letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
            }
        }

        return result;
    }

    async solveMiddleClues() {
        await this.middleCluesParse();
        let middleSolutions = false;
        let undoResult = {
            correct: [],
            incorrect: [],
            invalidWordChain: []
        };

        for (let attempt = 0; attempt < this.middleClueAttempts; attempt++) {
            if (this.shouldStop) {
                return false;
            }

            let result = await this.middleCluesFindSolution(undoResult);
            if (result.error) {
                return {
                    success: false,
                    solutions: middleSolutions,
                    error: result.error
                }
            }
            middleSolutions = result.solutions;

            if (result.invalidWords.length > 0) {
                const existingWords = new Set(undoResult.incorrect.map(item => item.word));
                const newInvalidWords = result.invalidWords
                    .filter(word => !existingWords.has(word.word))
                    .map(word => ({ index: -1, word: word.word }));

                undoResult.incorrect = [...undoResult.incorrect, ...newInvalidWords];
            }

            // Add any invalid chains, ensuring no duplicates
            if (result.invalidWordChain.length > 0) {
                const existingChains = new Set(undoResult.invalidWordChain.map(chain => chain.join(' ')));
                const newInvalidChains = result.invalidWordChain
                    .filter(chain => !existingChains.has(chain))
                    .map(chain => chain.split(' '));

                undoResult.invalidWordChain = [...undoResult.invalidWordChain, ...newInvalidChains];
            }

            if (!middleSolutions) {
                continue;
            }

            await this.middleCluesInput(middleSolutions, undoResult);

            if (await this.correctMiddleWords()) {
                await this.middleCluesRearrange(middleSolutions);
                if (await this.middleClueCheckSolution()) {
                    return middleSolutions;
                } else {
                    return false;
                }
            }

            if (attempt < this.middleClueAttempts - 1) {
                const newUndoResult = await this.undoMiddleCluesInput(middleSolutions);

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

    async finalClueFindSolution(finalClue, middleSolutions, undoResult = null) {
        const orderedWords = [...middleSolutions].sort((a, b) => a.final_order - b.final_order).map(s => s.word);
        const firstWord = orderedWords[0];
        const lastWord = orderedWords[orderedWords.length - 1];

        // Initialize state Set for invalid words
        const invalidWordsCombined = new Set();

        // Initialize from undoResult if it exists
        if (undoResult?.incorrect) {
            undoResult.incorrect.forEach(item => invalidWordsCombined.add(item.word));
        }

        for (let attempt = 0; attempt < this.openaiAttempts; attempt++) {
            if (this.shouldStop) {
                return { solutions: false, invalidWords: Array.from(invalidWordsCombined) };
            }

            // Display variables
            let invalidWordsDisplay = "";
            let validWordsDisplay = "";
            let middleWordsDisplay = "";

            // Convert to display format
            if (invalidWordsCombined.size > 0) {
                invalidWordsDisplay = Array.from(invalidWordsCombined).map(word => `"${word}"`).join(', ');
            }

            if (undoResult?.correct?.length > 0) {
                validWordsDisplay = Array.from(undoResult.correct).map(item => `"${item.word}"`).join(', ');
            }

            if (middleSolutions.map(s => s.word).length > 0) {
                middleWordsDisplay = Array.from(middleSolutions.map(s => s.word)).map(item => `"${item}"`).join(', ');
            }

            const incorrectWordsText = invalidWordsDisplay
                ? `\nNote: These previous words were incorrect: ${invalidWordsDisplay}. Please provide different answers that still connect to "${firstWord}" and "${lastWord}".`
                : '';

            const correctWordsText = validWordsDisplay
                ? `\nNote: These previous words were correct: ${validWordsDisplay}. Include these in the final answer.`
                : '';

            const middleWordsText = middleWordsDisplay
                ? `\nNote: No answer can match the following words: ${middleWordsDisplay}. Please provide different answers.`
                : '';

            const prompt = `You are solving the final two clues from the LinkedIn puzzle Crossclimb. Their are one or two related clues, each with a single word answer of exactly ${this.WORD_SIZE} letters. One word solution should only differ from one letter of "${firstWord}" and the other solution should differ from only one letter of "${lastWord}". Output only the exact word answers with one space between them and nothing else. The clue is: {${finalClue}}${incorrectWordsText}${correctWordsText}${middleWordsText}`;

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'getOpenAIResponse',
                    prompt: prompt
                });

                if (response.error) {
                    throw new Error('Error from OpenAI');
                }

                if (!response.solution) {
                    throw new Error('No solution received from OpenAI');
                }

                const solution = response.solution.trim();
                const final_solutions = solution.split(' ').map(word => word.toLowerCase());

                if (final_solutions.length !== 2) {
                    continue;
                }

                if (!final_solutions.every(word => word.length === this.WORD_SIZE)) {
                    final_solutions.forEach(word => {
                        if (word.length !== this.WORD_SIZE) {
                            invalidWordsCombined.add(word);
                        }
                        else if (!this.differsByOneLetter(word, firstWord) && !this.differsByOneLetter(word, lastWord)) {
                            invalidWordsCombined.add(word);
                        }
                    });
                    continue;
                }

                const firstSolutionConnectsToFirst = this.differsByOneLetter(final_solutions[0], firstWord);
                const firstSolutionConnectsToLast = this.differsByOneLetter(final_solutions[0], lastWord);
                const secondSolutionConnectsToFirst = this.differsByOneLetter(final_solutions[1], firstWord);
                const secondSolutionConnectsToLast = this.differsByOneLetter(final_solutions[1], lastWord);

                const isValidChain = (
                    (firstSolutionConnectsToFirst && secondSolutionConnectsToLast) ||
                    (firstSolutionConnectsToLast && secondSolutionConnectsToFirst)
                );

                if (!isValidChain) {
                    if (!firstSolutionConnectsToFirst && !firstSolutionConnectsToLast) {
                        invalidWordsCombined.add(final_solutions[0]);
                    }
                    if (!secondSolutionConnectsToFirst && !secondSolutionConnectsToLast) {
                        invalidWordsCombined.add(final_solutions[1]);
                    }
                    continue;
                }

                const orderedFinalSolutions = firstSolutionConnectsToFirst
                    ? final_solutions
                    : [final_solutions[1], final_solutions[0]];

                return { solutions: orderedFinalSolutions, invalidWords: Array.from(invalidWordsCombined) };
            } catch (error) {
                return { solutions: false, invalidWords: Array.from(invalidWordsCombined), error: "OpenAI error" };
            }
        }
        return { solutions: false, invalidWords: Array.from(invalidWordsCombined) };
    }

    async finalClueCheckSolution() {
        const hintButton = document.querySelector('[data-control-btn="hint"]');
        return hintButton && hintButton.disabled;
    }

    async undoFinalCluesInput(finalSolutions) {
        const result = {
            correct: [],
            incorrect: []
        };

        // Handle first word
        const firstWordElement = document.querySelector('.crossclimb__guess:nth-child(1)');
        const firstWordCorrect = !firstWordElement.classList.contains('crossclimb__guess--incorrect');

        if (firstWordCorrect) {
            result.correct.push({ index: 0, word: finalSolutions[0] });
        } else {
            result.incorrect.push({ index: 0, word: finalSolutions[0] });
            firstWordElement.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            const letterBoxes = firstWordElement.querySelectorAll('.crossclimb__guess_box input');

            for (let j = 0; j < letterBoxes.length; j++) {
                if (letterBoxes[j]) {
                    letterBoxes[j].value = '';
                    letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }

        // Handle last word
        const lastWordElement = document.querySelector('div.crossclimb__guess--last');
        const lastWordCorrect = !lastWordElement.classList.contains('crossclimb__guess--incorrect');

        if (lastWordCorrect) {
            result.correct.push({ index: 1, word: finalSolutions[1] });
        } else {
            result.incorrect.push({ index: 1, word: finalSolutions[1] });
            lastWordElement.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            const letterBoxes = lastWordElement.querySelectorAll('.crossclimb__guess_box input');

            for (let j = 0; j < letterBoxes.length; j++) {
                if (letterBoxes[j]) {
                    letterBoxes[j].value = '';
                    letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }

        return result;
    }

    async finalCluesInput(finalSolutions, undoResult = null) {
        // Handle first word
        if (!undoResult || !undoResult.correct.some(item => item.index === 0)) {
            const firstWordElement = document.querySelector('.crossclimb__guess:nth-child(1)');
            if (firstWordElement) {
                firstWordElement.click();
                await new Promise(resolve => setTimeout(resolve, 50));

                const letterBoxes = firstWordElement.querySelectorAll('.crossclimb__guess_box input');

                for (let j = 0; j < finalSolutions[0].length; j++) {
                    const letter = finalSolutions[0][j];

                    if (letterBoxes[j]) {
                        letterBoxes[j].value = letter;
                        letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } else {
                    }
                }
            }
        }

        // Handle last word
        if (!undoResult || !undoResult.correct.some(item => item.index === 1)) {
            const lastWordElement = document.querySelector('div.crossclimb__guess--last');
            if (lastWordElement) {
                lastWordElement.click();
                await new Promise(resolve => setTimeout(resolve, 50));

                const letterBoxes = lastWordElement.querySelectorAll('.crossclimb__guess_box input');

                for (let j = 0; j < finalSolutions[1].length; j++) {
                    const letter = finalSolutions[1][j];

                    if (letterBoxes[j]) {
                        letterBoxes[j].value = letter;
                        letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                        await new Promise(resolve => setTimeout(resolve, 50));
                    } else {
                    }
                }
            }
        }
    }

    async finalClueParse() {
        const clue = document.querySelector('.crossclimb__clue');
        if (!clue) return '';

        let trimmedClue = clue.textContent.trim();
        if (trimmedClue.startsWith('The top + bottom rows = ')) {
            trimmedClue = trimmedClue.substring('The top + bottom rows = '.length);
        }
        if (trimmedClue.endsWith('Keep in mind: The first word may be at the bottom.')) {
            trimmedClue = trimmedClue.substring(0, trimmedClue.length - 'Keep in mind: The first word may be at the bottom.'.length);
        }

        return trimmedClue;
    }

    async solveFinalClues(middleSolutions) {
        const finalClue = await this.finalClueParse();
        let finalSolutions = false;
        let undoResult = {
            correct: [],
            incorrect: []
        };

        for (let attempt = 0; attempt < this.finalClueAttempts; attempt++) {
            if (this.shouldStop) {
                return false;
            }

            let result = await this.finalClueFindSolution(finalClue, middleSolutions, undoResult);
            if (result.error) {
                return {
                    success: false,
                    solutions: false,
                    error: result.error
                }
            }
            finalSolutions = result.solutions;

            if (result.invalidWords.length > 0) {
                const existingWords = new Set(undoResult.incorrect.map(item => item.word));
                const newInvalidWords = result.invalidWords
                    .filter(word => !existingWords.has(word))
                    .map(word => ({ index: -1, word }));

                undoResult.incorrect = [...undoResult.incorrect, ...newInvalidWords];
            }

            if (!finalSolutions) {
                continue;
            }

            await this.finalCluesInput(finalSolutions, undoResult);
            if (await this.finalClueCheckSolution()) {
                const sortedMiddleSolutions = [...middleSolutions].sort((a, b) => a.final_order - b.final_order);
                const orderedMiddleWords = sortedMiddleSolutions.map(s => s.word);
                const rearrangedChain = [finalSolutions[0], ...orderedMiddleWords, finalSolutions[1]];

                await chrome.storage.local.set({
                    'crossclimbSolution': {
                        middleSolutions: middleSolutions,
                        finalSolutions: finalSolutions,
                        rearrangedChain: rearrangedChain,
                        timestamp: new Date().toISOString()
                    }
                });

                return finalSolutions;
            }

            if (attempt < this.finalClueAttempts - 1) {
                const newUndoResult = await this.undoFinalCluesInput(finalSolutions);

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

    async getCorrectSolution() {
        this.shouldStop = false;

        const middleSolutions = await this.solveMiddleClues();
        if (middleSolutions.error) {
            return {
                success: false,
                rearrangedChain: [],
                error: middleSolutions.error
            };
        }
        else if (!middleSolutions) {
            return {
                success: false,
                rearrangedChain: [],
                error: 'Failed to find valid middle solutions after all attempts'
            };
        }

        const sortedMiddleSolutions = [...middleSolutions].sort((a, b) => a.final_order - b.final_order);
        const orderedMiddleWords = sortedMiddleSolutions.map(s => s.word);

        const finalSolutions = await this.solveFinalClues(middleSolutions);
        if (!finalSolutions) {
            return {
                success: false,
                rearrangedChain: [],
                error: 'Failed to find valid final solutions after all attempts'
            };
        }

        return {
            success: true,
            rearrangedChain: [finalSolutions[0], ...orderedMiddleWords, finalSolutions[1]]
        };
    }

    async inputCorrectSolution() {
        const data = await chrome.storage.local.get('crossclimbSolution');
        const storedSolution = data.crossclimbSolution;

        if (!storedSolution) {
            return {
                success: false,
                rearrangedChain: [],
                error: 'No stored solution found'
            };
        }

        // Input middle words
        for (let i = 0; i < storedSolution.middleSolutions.length; i++) {
            const container = document.querySelector(`.crossclimb__guess__container .crossclimb__guess--middle:nth-child(${i + 2})`);
            if (!container) continue;

            container.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            const letterBoxes = container.querySelectorAll('.crossclimb__guess_box input');

            for (let j = 0; j < storedSolution.middleSolutions[i].word.length; j++) {
                const letter = storedSolution.middleSolutions[i].word[j];

                if (letterBoxes[j]) {
                    letterBoxes[j].value = letter;
                    letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }

        if (await this.correctMiddleWords()) {
            await this.middleCluesRearrange(storedSolution.middleSolutions);
            if (!await this.middleClueCheckSolution()) {
                return {
                    success: false,
                    rearrangedChain: storedSolution.rearrangedChain,
                    error: 'Rearranged middle words not correct'
                };
            }
        } else {
            return {
                success: false,
                rearrangedChain: storedSolution.rearrangedChain,
                error: 'Middle words not correct'
            };
        }

        // Input first word
        const firstWordElement = document.querySelector('.crossclimb__guess:nth-child(1)');
        if (firstWordElement) {
            firstWordElement.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            const letterBoxes = firstWordElement.querySelectorAll('.crossclimb__guess_box input');

            for (let j = 0; j < storedSolution.finalSolutions[0].length; j++) {
                const letter = storedSolution.finalSolutions[0][j];

                if (letterBoxes[j]) {
                    letterBoxes[j].value = letter;
                    letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }

        // Input last word
        const lastWordElement = document.querySelector('div.crossclimb__guess--last');
        if (lastWordElement) {
            lastWordElement.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            const letterBoxes = lastWordElement.querySelectorAll('.crossclimb__guess_box input');

            for (let j = 0; j < storedSolution.finalSolutions[1].length; j++) {
                const letter = storedSolution.finalSolutions[1][j];

                if (letterBoxes[j]) {
                    letterBoxes[j].value = letter;
                    letterBoxes[j].dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }

        const isComplete = await this.finalClueCheckSolution();
        return {
            success: isComplete,
            rearrangedChain: storedSolution.rearrangedChain,
            timestamp: storedSolution.timestamp
        };
    }

    stopSolving() {
        this.shouldStop = true;
    }
}

// Global reference to active solver
let activeSolver = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'solve' || request.action === 'inputStoredSolution' || request.action === 'close') {
        (async () => {
            try {
                // If close action, stop any active solver
                if (request.action === 'close' && activeSolver) {
                    activeSolver.stopSolving();
                    activeSolver = null;
                    chrome.runtime.sendMessage({
                        action: 'solveComplete',
                        success: false,
                        result: { message: 'Closed Execution' }
                    });
                    sendResponse({ success: true });
                    return;
                }

                // Create new solver for solve/input actions
                activeSolver = new CrossclimbSolver();
                await activeSolver.initialize();

                let result;
                if (request.action === 'solve') {
                    result = await activeSolver.getCorrectSolution();
                } else if (request.action === 'inputStoredSolution') {
                    result = await activeSolver.inputCorrectSolution();
                }

                // Clear active solver reference after completion
                activeSolver = null;

                // If input was stopped and failed
                if (!result.success) {
                    chrome.runtime.sendMessage({
                        action: 'solveComplete',
                        success: false,
                        result: { message: result.error || 'Failed to solve puzzle' }
                    });
                    sendResponse({ success: true });
                    return;
                }

                // Only send success message if we actually solved it
                else if (result.success) {
                    chrome.runtime.sendMessage({
                        action: 'solveComplete',
                        success: true,
                        result: { rearrangedChain: result.rearrangedChain }
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
        return true; // Will respond asynchronously
    }
}); 