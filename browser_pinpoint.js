

// Main solver class
class PinpointSolver {
    constructor() {
        this.phrases = [];
        this.solutions = [];
        // the maximum number of attempts to solve the puzzle, as ai solutions are not deterministic
        this.maxAttempts = 3;
        this.openaiAttempts = 3;
        this.shouldStop = false;
        this.getDirectSolution = false;
        this.templateSolution = "placeholder";
        this.currentAttempt = 0;
    }

    async initialize() {
        // Wait for the start game button and click it
        const startButton = document.querySelector('#launch-footer-start-button');
        if (startButton) {
            startButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Wait for the close tutorial button and click it
        const closeTutorialButton = document.querySelector('.pinpoint-tutorial-modal button.artdeco-modal__dismiss');
        if (closeTutorialButton) {
            closeTutorialButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async parsePhrases() {
        const phraseElements = document.querySelectorAll('.pinpoint__card.pinpoint__card--clue');
        this.phrases = Array.from(phraseElements).map(element => element.textContent.trim());
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
                //const prompt = `You are solving the LinkedIn puzzle Pinpoint. Given these words or phrases: "${phrases.join('", "')}", what is the common category, theme, concept, or word play that connects all of them? Respond only with exactly a single word that best represents the category.${previousSolutionsText}`;

                // Send message to background script to make OpenAI API call
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
                const solution = response.solution.trim().toLowerCase().replace(/[.,;:"'`]/g, '');
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
                //const solution = `test${previousSolutions.length}`;
                return solution;
            } catch (error) {
                if (attempt === this.openaiAttempts - 1) {
                    return false;
                }
            }
        }
        // maximum openai attempts reached, continue current attempt until end of clues and forcefully parse the solution
        this.getDirectSolution = true;
        return this.templateSolution;
    }

    async inputSolution(solution) {
        try {
            if (this.shouldStop) {
                return false;
            }
            // Find the input field and type the solution
            const inputField = document.querySelector('.pinpoint__input');
            if (!inputField) {
                throw new Error('Input field not found');
            }
            inputField.value = solution;
            inputField.dispatchEvent(new Event('input', { bubbles: true }));

            // Wait for submit button to appear (up to 1 second)
            const startTime = Date.now();
            let submitButton = null;

            while (Date.now() - startTime < 1000) {
                submitButton = document.querySelector('.pinpoint__submit-btn');
                if (submitButton) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (!submitButton) {
                throw new Error('Submit button not found after waiting');
            }

            submitButton.click();

            // Wait for the result
            await new Promise(resolve => setTimeout(resolve, 100));
            return true;
        } catch (error) {
            return false;
        }
    }

    async checkSolution() {
        const successElement = document.querySelector('.pinpoint__card__answer_text svg');
        return !!successElement;
    }

    // Function to parse the solution from the game interface
    async parseSolution() {
        const solutionElement = document.querySelector('.pinpoint__card__answer_text');
        if (!solutionElement) {
            return false;
        }
        return solutionElement.textContent.trim();
    }

    stopSolving() {
        this.shouldStop = true;
    }

    async getCorrectSolution() {
        this.shouldStop = false; // Reset stop flag at start

        // Get stored state or initialize new state
        const data = await chrome.storage.local.get('pinpointSolveState');
        let currentAttempt = 0;

        if (data.pinpointSolveState) {
            // Restore state from storage
            this.solutions = data.pinpointSolveState.solutions;
            currentAttempt = data.pinpointSolveState.attempts;
            this.phrases = data.pinpointSolveState.phrases;
        } else {
            // Initialize new state
            await chrome.storage.local.set({
                'pinpointSolveState': {
                    attempts: 0,
                    solutions: [],
                    phrases: null,
                    timestamp: Date.now(),
                    maxAttempts: this.maxAttempts
                }
            });
        }

        // Get number of clues dynamically
        const clues = document.querySelectorAll('.pinpoint__card__container').length;

        // Loop for clues
        for (let clueIndex = 0; clueIndex < clues && !this.shouldStop; clueIndex++) {

            if (this.shouldStop) {
                await chrome.storage.local.remove('pinpointSolveState');
                break;
            }

            // Step 1: Parse phrases (only on first attempt)
            if (currentAttempt === 0) {
                const phrases = await this.parsePhrases();
                if (!phrases || phrases.length === 0) {
                    // Clear the solve state since we're done
                    await chrome.storage.local.remove('pinpointSolveState');
                    return {
                        success: false,
                        solutions: this.solutions,
                        error: 'Failed to parse phrases'
                    };
                }
                this.phrases = phrases;
            }

            if (this.shouldStop) {
                await chrome.storage.local.remove('pinpointSolveState');
                break;
            }

            // Step 2: Find solution
            let solution = await this.findSolution(this.phrases, this.solutions);

            if (this.shouldStop) {
                await chrome.storage.local.remove('pinpointSolveState');
                break;
            }
            if (!solution) {
                await chrome.storage.local.remove('pinpointSolveState');
                return {
                    success: false,
                    solutions: this.solutions,
                    error: 'OpenAI error'
                };
            }

            // Step 3: Input solution
            const inputSuccess = await this.inputSolution(solution);
            if (this.shouldStop) {
                await chrome.storage.local.remove('pinpointSolveState');
                break;
            }
            if (!inputSuccess) {
                await chrome.storage.local.remove('pinpointSolveState');
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
            const isAfterLastAttempt = currentAttempt === this.maxAttempts - 1 && clueIndex === clues - 1;

            if (isForcedSolution || isAfterLastAttempt) {
                const forcedSolution = await this.parseSolution();
                if (forcedSolution) {
                    solution = forcedSolution;
                    // assumes directly provided solution is correct
                    isCorrect = true;
                }
            }

            if (isCorrect) {
                // Save the correct solution
                await chrome.storage.local.set({
                    'pinpointSolution': {
                        solution: solution,
                        timestamp: new Date().toISOString()
                    }
                });

                // Clear the solve state since we're done
                await chrome.storage.local.remove('pinpointSolveState');

                return {
                    success: true,
                    solution: solution,
                    attemptsMade: currentAttempt
                };
            } else {
                if (!this.solutions.includes(solution)) {
                    this.solutions.push(solution);
                }
            }
        }

        if (this.shouldStop) {
            // Clear the solve state since we're done
            await chrome.storage.local.remove('pinpointSolveState');
            return {
                success: false,
                solutions: this.solutions,
                attemptsMade: currentAttempt,
                error: 'Solving stopped by user'
            };
        }

        // After trying all clues, increment attempt counter
        currentAttempt++;

        // Check if we've hit max attempts
        if (currentAttempt >= this.maxAttempts) {
            // Clear the solve state since we're done
            await chrome.storage.local.remove('pinpointSolveState');
            return {
                success: false,
                solutions: this.solutions,
                attemptsMade: currentAttempt,
                error: 'Maximum attempts reached'
            };
        }

        // Store current state with incremented attempt
        await chrome.storage.local.set({
            'pinpointSolveState': {
                attempts: currentAttempt,
                solutions: this.solutions,
                phrases: this.phrases,
                timestamp: Date.now(),
                maxAttempts: this.maxAttempts
            }
        });

        // Request refresh from background
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'refreshAndContinue'
            });

            if (response.error) {
                // Clear the solve state since we're done
                await chrome.storage.local.remove('pinpointSolveState');
                return {
                    success: false,
                    solutions: this.solutions,
                    attemptsMade: currentAttempt,
                    error: response.error
                };
            }

            // Return refresh state to prevent further processing
            return {
                success: false,
                solutions: this.solutions,
                attemptsMade: currentAttempt,
                isRefreshing: true
            };
        } catch (error) {
            // Clear the solve state since we're done
            await chrome.storage.local.remove('pinpointSolveState');
            return {
                success: false,
                solutions: this.solutions,
                attemptsMade: currentAttempt,
                error: `Failed to refresh: ${error.message}`
            };
        }
    }

    async inputCorrectSolution() {
        // Get the most recent solution from storage
        const data = await chrome.storage.local.get('pinpointSolution');
        const storedSolution = data.pinpointSolution;

        if (!storedSolution) {
            return {
                success: false,
                error: 'No stored solution found'
            };
        }

        // Input the stored solution
        const inputSuccess = await this.inputSolution(storedSolution.solution);
        if (!inputSuccess) {
            return {
                success: false,
                error: 'Failed to input solution'
            };
        }

        // Check if solution is correct
        const isCorrect = await this.checkSolution();
        if (isCorrect) {
            return {
                success: true,
                solution: storedSolution.solution,
                timestamp: storedSolution.timestamp
            };
        } else {
            return {
                success: false,
                error: 'Stored solution is no longer correct'
            };
        }
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
                    // Clear the solve state
                    await chrome.storage.local.remove('pinpointSolveState');
                    // Send immediate close response
                    chrome.runtime.sendMessage({
                        action: 'solveComplete',
                        success: false,
                        result: { message: 'Closed Execution' }
                    });
                    sendResponse({ success: true });
                    return;
                }

                // Create new solver for solve/input actions
                activeSolver = new PinpointSolver();
                await activeSolver.initialize();

                let result;
                if (request.action === 'solve') {
                    // Check for existing solve state
                    const data = await chrome.storage.local.get('pinpointSolveState');
                    if (data.pinpointSolveState) {
                        // Restore state from storage
                        activeSolver.solutions = data.pinpointSolveState.solutions;
                        activeSolver.currentAttempt = data.pinpointSolveState.attempts;
                        activeSolver.maxAttempts = data.pinpointSolveState.maxAttempts;
                    } else {
                        // Clear any existing state at the start of a new solve
                        await chrome.storage.local.remove('pinpointSolveState');
                    }
                    result = await activeSolver.getCorrectSolution();
                } else if (request.action === 'inputStoredSolution') {
                    result = await activeSolver.inputCorrectSolution();
                }

                // Clear active solver reference after completion
                activeSolver = null;

                // If we're refreshing, don't send any solveComplete message
                if (result.isRefreshing) {
                    sendResponse({ success: true });
                    return;
                }

                // If input was stopped and failed
                if (!result.success) {
                    if (result.error === 'Maximum attempts reached') {
                        chrome.runtime.sendMessage({
                            action: 'solveComplete',
                            success: false,
                            result: { message: 'Maximum attempts reached' }
                        });
                    } else if (result.error === 'OpenAI error') {
                        chrome.runtime.sendMessage({
                            action: 'solveComplete',
                            success: false,
                            result: { message: 'OpenAI error' }
                        });
                    } else {
                        chrome.runtime.sendMessage({
                            action: 'solveComplete',
                            success: false,
                            result: { message: 'Closed Execution' }
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
        return true; // Will respond asynchronously
    }
}); 