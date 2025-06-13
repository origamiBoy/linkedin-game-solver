// State management
const state = {
    isSolving: false,
    currentTab: null,
    gameType: 'Unknown',
    hasApiKey: false,
    statusMessage: 'Ready',
    statusType: 'ready',
    isReady: false,
    solvingGameType: null,
    solvingWithApiKey: false,
    isRefreshing: false,
    refreshStartTime: null,
    activeButton: null,
    viewPreference: 'list', // 'list' or 'grid'
    hasCorrectUrl: false,
    hasResultsUrl: false,
    hasGuestUrl: false
};

// Import game config for service worker
importScripts('game_config_sw.js');

// Helper function to get game URL
function getGameUrl(gameType) {
    return self.GAME_CONFIG[gameType.toLowerCase()]?.url;
}

// OpenAI API key should be stored in extension's storage
let openaiApiKey = null;

// Helper function to persist state to storage
async function persistState() {
    try {
        await chrome.storage.local.set({ 'extensionState': state });
    } catch (error) {
        // Silent error handling
    }
}

// Helper function to restore state from storage
async function restoreState() {
    try {
        const data = await chrome.storage.local.get(['extensionState', 'openaiApiKey']);
        if (data.extensionState) {
            Object.assign(state, data.extensionState);
        }
        if (data.openaiApiKey) {
            openaiApiKey = data.openaiApiKey;
            state.hasApiKey = true;
        }
    } catch (error) {
        // Silent error handling
    }
}

// Initialize by getting API key from storage and detecting game type
async function initialize() {
    try {
        // Restore state from storage
        await restoreState();

        // Get current tab and detect game type
        await updateCurrentTab();

        // Persist the updated state
        await persistState();
    } catch (error) {
        // Silent error handling
    }
}

// Helper function to update current tab and detect game type
async function updateCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            state.statusMessage = 'Not Ready - No Active Tab';
            state.statusType = 'error';
            state.isReady = false;
            state.hasCorrectUrl = false;
            state.hasResultsUrl = false;
            state.hasGuestUrl = false;
            await persistState();
            return;
        }

        // Only update currentTab if we're not solving
        if (!state.isSolving) {
            state.currentTab = tab;
        }

        // Always detect game type and update URL match state
        detectGameType(tab.url);
        const expectedUrl = getGameUrl(state.gameType);
        state.hasCorrectUrl = state.gameType !== 'Unknown' && tab.url === expectedUrl;
        state.hasResultsUrl = tab.url.includes('/results/');
        state.hasGuestUrl = tab.url.includes('/guest/');

        // Update status based on solving state and URL
        if (state.isSolving) {
            state.isReady = false;
            await setLoadingState();
        } else if (state.gameType === 'Unknown') {
            state.statusMessage = 'Not Ready - Unknown Game';
            state.statusType = 'error';
            state.isReady = false;
        } else {
            // Only update status message if we're not on a results page
            if (!state.hasResultsUrl) {
                if (!state.hasCorrectUrl) {
                    state.statusMessage = 'Not Ready - Incorrect Game URL';
                    state.statusType = 'error';
                    state.isReady = false;
                } else {
                    state.statusMessage = 'Ready';
                    state.statusType = 'ready';
                    state.isReady = true;
                }
            } else if (state.hasGuestUrl) {
                state.statusMessage = 'Puzzle Solved Successfully';
                state.statusType = 'success';
                state.isReady = false;
            } else {
                state.statusMessage = 'Puzzle Saved Successfully';
                state.statusType = 'success';
                state.isReady = false;
            }

        }

        // Persist state after update
        await persistState();
    } catch (error) {
        state.statusMessage = 'Error updating tab state';
        state.statusType = 'error';
        state.isReady = false;
        state.hasCorrectUrl = false;
        state.hasResultsUrl = false;
        state.hasGuestUrl = false;
        await persistState();
    }
}

// Helper function to detect game type from URL
function detectGameType(url) {
    if (!url) {
        state.gameType = 'Unknown';
        return;
    }

    // Check each game's ID in the URL path
    for (const [gameId, gameConfig] of Object.entries(self.GAME_CONFIG)) {
        if (url.includes(`${gameId}`)) {
            state.gameType = gameConfig.name;
            return;
        }
    }
    state.gameType = 'Unknown';
}

// Initialize on startup
initialize();

// Helper function to update popup state
async function updatePopupState() {
    try {
        // Persist state before sending to popup
        await persistState();

        // Send message to popup and ignore connection errors
        chrome.runtime.sendMessage({
            action: 'updateState',
            state: {
                isSolving: state.isSolving,
                gameType: state.gameType,
                hasApiKey: state.hasApiKey,
                statusMessage: state.statusMessage,
                statusType: state.statusType,
                isReady: state.isReady,
                solvingGameType: state.solvingGameType,
                solvingWithApiKey: state.solvingWithApiKey,
                viewPreference: state.viewPreference,
                hasCorrectUrl: state.hasCorrectUrl,
                hasResultsUrl: state.hasResultsUrl,
                hasGuestUrl: state.hasGuestUrl
            }
        }).catch(error => {
            // Ignore connection errors when popup is closed
        });
    } catch (error) {
        // Silent error handling
    }
}

// Listen for messages from popup and browser scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Wrap async operations in an immediately invoked async function
    (async () => {
        try {
            // Handle getState request
            if (request.action === 'getState') {
                // Always update current tab to ensure correct game detection
                await updateCurrentTab();
                sendResponse({ state });
                return;
            }

            // Handle login button click
            if (request.action === 'clickLoginButton') {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) {
                        chrome.tabs.sendMessage(tab.id, { action: 'clickLoginButton' });
                    }
                } catch (error) {
                }
                return;
            }

            // API Key management
            if (request.action === 'clearApiKey') {
                openaiApiKey = null;
                state.hasApiKey = false;
                await chrome.storage.local.remove('openaiApiKey');
                await persistState();
                updatePopupState();
                sendResponse({ success: true });
                return;
            }

            if (request.action === 'updateApiKey') {
                openaiApiKey = request.apiKey;
                state.hasApiKey = true;
                await chrome.storage.local.set({ 'openaiApiKey': request.apiKey });
                await persistState();
                updatePopupState();
                sendResponse({ success: true });
                return;
            }

            // Game solving actions
            if (request.action === 'startSolving') {
                // Get the current active tab instead of using sender.tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) {
                    state.statusMessage = 'No active tab found';
                    state.statusType = 'error';
                    state.isReady = false;
                    updatePopupState();
                    sendResponse({ error: 'No active tab found' });
                    return;
                }

                state.isSolving = true;
                state.isReady = false;
                state.currentTab = tab;
                state.solvingGameType = state.gameType;
                state.solvingWithApiKey = request.requiresApiKey;
                state.activeButton = request.solveAction;
                await setLoadingState();
                updatePopupState();

                try {
                    // Forward solve request to browser script
                    await chrome.tabs.sendMessage(tab.id, {
                        action: request.solveAction,
                        timestamp: Date.now()
                    });
                    sendResponse({ success: true });
                } catch (error) {
                    // Handle case where browser script isn't ready
                    state.isSolving = false;
                    state.solvingGameType = null;
                    state.solvingWithApiKey = false;
                    state.statusMessage = 'Error: Browser script not ready, refresh the page and try again';
                    state.statusType = 'error';
                    updatePopupState();
                    sendResponse({ error: 'Browser script not ready' });
                }
                return;
            }

            if (request.action === 'cancelSolving') {
                // If we're solving, send close message to the solving tab
                if (state.isSolving && state.currentTab) {
                    try {
                        // Send close message to the tab that's being solved
                        await chrome.tabs.sendMessage(state.currentTab.id, {
                            action: 'close',
                            timestamp: Date.now()
                        });
                        state.statusMessage = 'Solving canceled';
                        state.statusType = 'error';
                        resetState();
                    } catch (error) {
                        // If we can't send the message, the tab might be closed
                        state.statusMessage = 'Error canceling solve';
                        state.statusType = 'error';
                        resetState();
                    }
                } else {
                    state.statusMessage = 'No active solve to cancel';
                    state.statusType = 'error';
                }
                updatePopupState();
                sendResponse({ success: true });
                return;
            }

            // Handle refresh and continue request
            if (request.action === 'refreshAndContinue') {

                // Handle refresh in progress
                if (state.isRefreshing) {
                    // Reset refresh state if it's been too long
                    if (state.refreshStartTime && Date.now() - state.refreshStartTime > 2000) {
                        state.isRefreshing = false;
                        state.refreshStartTime = null;
                    } else {
                        sendResponse({ error: 'Refresh already in progress' });
                        return;
                    }
                }

                state.isRefreshing = true;
                state.refreshStartTime = Date.now();
                state.isSolving = true;
                await setLoadingState();
                updatePopupState();

                try {
                    // Get the current active tab
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab) {
                        throw new Error('No active tab found');
                    }

                    await chrome.tabs.reload(tab.id);

                    // Set up a listener for the page load
                    const loadListener = async (tabId, changeInfo) => {
                        if (tabId === tab.id && changeInfo.status === 'complete') {
                            // Remove the listener
                            chrome.tabs.onUpdated.removeListener(loadListener);

                            // Wait a bit for the page to fully initialize
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            // Send solve message to the page
                            try {
                                await chrome.tabs.sendMessage(tabId, {
                                    action: 'solve'
                                });

                                // Reset refresh state after successful solve message
                                state.isRefreshing = false;
                                state.refreshStartTime = null;
                                state.isSolving = true; // Keep solving state active
                                updatePopupState();
                            } catch (error) {
                                state.statusMessage = 'Error continuing solve after refresh';
                                state.statusType = 'error';
                                state.isRefreshing = false;
                                state.refreshStartTime = null;
                                state.isSolving = false;
                                updatePopupState();
                            }
                        }
                    };

                    // Add the listener
                    chrome.tabs.onUpdated.addListener(loadListener);

                    sendResponse({ success: true });
                } catch (error) {
                    state.isRefreshing = false;
                    state.refreshStartTime = null;
                    state.isSolving = false;
                    state.statusMessage = `Error during refresh: ${error.message}`;
                    state.statusType = 'error';
                    updatePopupState();
                    sendResponse({ error: error.message });
                }
                return;
            }

            // Handle solveComplete message
            if (request.action === 'solveComplete') {
                // Only reset solving state if we're not refreshing
                state.isSolving = false;
                state.solvingGameType = null;
                state.solvingWithApiKey = false;

                // Update isReady based on current URL
                await updateCurrentTab();

                if (request.success) {
                    state.statusMessage = 'Puzzle Solved Successfully';
                    state.statusType = 'success';
                    state.isReady = false;
                } else {
                    // Special handling for closed execution
                    if (request.result && request.result.message === 'Closed Execution') {
                        // If we have a solution despite being stopped, show success
                        if (request.result.solution) {
                            state.statusMessage = 'Puzzle Solved Successfully';
                            state.statusType = 'success';
                            state.isReady = false;
                        } else {
                            state.statusMessage = 'Solving stopped';
                            state.statusType = 'error';
                        }
                    } else if (request.result && request.result.error) {
                        state.statusMessage = request.result.error;
                        state.statusType = 'error';
                    } else if (request.error) {
                        state.statusMessage = request.error;
                        state.statusType = 'error';
                    } else {
                        state.statusMessage = 'Failed to solve puzzle';
                        state.statusType = 'error';
                    }
                }
                updatePopupState();
                sendResponse({ success: true });
                return;
            }

            if (request.action === 'solveError') {
                state.isSolving = false;
                if (request.errorType === 'NO_API_KEY') {
                    state.statusMessage = 'Please enter your OpenAI API key first';
                    state.statusType = 'error';
                } else if (request.errorType === 'INVALID_API_KEY') {
                    state.statusMessage = 'Invalid API Key';
                    state.statusType = 'error';
                } else {
                    state.statusMessage = request.error || 'Error solving puzzle';
                    state.statusType = 'error';
                }
                updatePopupState();
                sendResponse({ success: true });
                return;
            }

            // OpenAI API requests
            if (request.action === 'getOpenAIResponse') {
                if (!openaiApiKey) {
                    sendResponse({
                        error: 'OpenAI API key not set. Please enter your API key in the extension popup.',
                        errorType: 'NO_API_KEY'
                    });
                    return;
                }

                // Make OpenAI API call
                fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiApiKey}`
                    },
                    body: JSON.stringify({
                        model: "gpt-3.5-turbo",
                        messages: [{ role: "user", content: request.prompt }],
                        max_tokens: 50,
                        temperature: 0.7
                    })
                })
                    .then(response => {
                        if (!response.ok) {
                            return response.json().then(data => {
                                const errorMessage = data.error?.message || 'OpenAI API request failed';
                                const errorType = data.error?.type || 'API_ERROR';
                                throw new Error(JSON.stringify({ message: errorMessage, type: errorType }));
                            });
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.error) {
                            sendResponse({
                                error: data.error.message,
                                errorType: data.error.type || 'API_ERROR'
                            });
                        } else {
                            sendResponse({ solution: data.choices[0].message.content });
                        }
                    })
                    .catch(error => {
                        let errorObj;
                        try {
                            errorObj = JSON.parse(error.message);
                        } catch {
                            errorObj = { message: error.message, type: 'UNKNOWN_ERROR' };
                        }
                        sendResponse({
                            error: errorObj.message,
                            errorType: errorObj.type
                        });
                    });
                return;
            }

            // Handle view preference update
            if (request.action === 'updateViewPreference') {
                state.viewPreference = request.viewPreference;
                await persistState();
                updatePopupState();
                sendResponse({ success: true });
                return;
            }
        } catch (error) {
            state.statusMessage = `Error: ${error.message}`;
            state.statusType = 'error';
            updatePopupState();
            sendResponse({ error: error.message });
        }
    })();
    return true; // Keep the message channel open for async response
});

// Helper function to reset state
async function resetState() {
    state.isSolving = false;
    state.currentTab = null;
    state.statusMessage = 'Ready';
    state.statusType = 'ready';
    state.isReady = false;
    state.solvingGameType = null;
    state.solvingWithApiKey = false;
    state.activeButton = null;
    await persistState();
    updatePopupState();
}

// Listen for tab updates to detect game type and reset solving state
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    //manage switch to results page
    //if (changeInfo.status === 'complete' && tab.url && !tab.url.includes('/results/')) {
    if (changeInfo.status === 'complete' && tab.url) {
        await updateCurrentTab();
        await updatePopupState();
    }
});

// Helper function to set loading state message
async function setLoadingState() {
    if (state.activeButton === 'solve' && state.gameType === 'Pinpoint') {
        // Get stored state for attempt count
        const data = await chrome.storage.local.get('pinpointSolveState');
        if (!data.pinpointSolveState) {
            state.statusMessage = '<div class="loading-spinner"></div> Solving... (Attempt 1)';
        } else {
            const attemptCount = data.pinpointSolveState.attempts + 1;
            const maxAttempts = data.pinpointSolveState.maxAttempts;
            state.statusMessage = `<div class="loading-spinner"></div> Solving... (Attempt ${attemptCount}/${maxAttempts})`;
        }
    } else {
        state.statusMessage = '<div class="loading-spinner"></div> Solving...';
    }
    state.statusType = 'solving';
} 