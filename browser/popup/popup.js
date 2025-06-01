document.addEventListener('DOMContentLoaded', async () => {
    // Menu functionality
    const kebabButton = document.getElementById('kebabButton');
    const modalMenu = document.getElementById('modalMenu');
    const menuItems = document.querySelectorAll('.menu-item');
    const contentSections = document.querySelectorAll('.content-section');
    const closeButtons = document.querySelectorAll('.close-button');

    // Toggle menu visibility
    kebabButton.addEventListener('click', (e) => {
        e.stopPropagation();
        modalMenu.classList.toggle('visible');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!modalMenu.contains(e.target) && e.target !== kebabButton) {
            modalMenu.classList.remove('visible');
        }
    });

    // Handle menu item clicks
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.getAttribute('data-section');

            // Hide all content sections
            contentSections.forEach(section => {
                section.style.display = 'none';
            });

            // Show selected content section
            const selectedSection = document.getElementById(`${sectionId}Section`);
            if (selectedSection) {
                selectedSection.style.display = 'block';
            }

            // Close menu
            modalMenu.classList.remove('visible');
        });
    });

    // Handle close button clicks
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-section');
            const section = document.getElementById(`${sectionId}Section`);
            if (section) {
                section.style.display = 'none';
            }
        });
    });

    const elements = {
        status: document.getElementById('status'),
        gameTag: document.getElementById('gameTag'),
        solvingStatus: document.getElementById('solvingStatus'),
        cancelButton: document.getElementById('cancelButton'),
        solveButton: document.getElementById('solveButton'),
        apiKeySection: document.getElementById('apiKeySection'),
        apiKeyContent: document.getElementById('apiKeyContent'),
        apiKeyHeader: document.getElementById('apiKeyHeader'),
        apiKeyInput: document.getElementById('apiKeyInput'),
        saveApiKey: document.getElementById('saveApiKey'),
        deleteApiKey: document.getElementById('deleteApiKey'),
        pinpointControls: document.getElementById('pinpointControls'),
        solvePinpoint: document.getElementById('solvePinpoint'),
        inputStoredPinpoint: document.getElementById('inputStoredPinpoint'),
        crossclimbControls: document.getElementById('crossclimbControls'),
        solveCrossclimb: document.getElementById('solveCrossclimb'),
        inputStoredCrossclimb: document.getElementById('inputStoredCrossclimb')
    };

    // Array of buttons that require an API key
    const API_KEY_REQUIRED_BUTTONS = [elements.solvePinpoint, elements.solveCrossclimb];

    // Array of all solve buttons
    const SOLVE_BUTTONS = [elements.solveButton, elements.solvePinpoint, elements.inputStoredPinpoint, elements.solveCrossclimb, elements.inputStoredCrossclimb];

    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Helper functions
    const showStatus = (message, type = 'ready') => {
        elements.status.innerHTML = message;
        elements.status.className = `status-message ${type}`;
    };

    const updateUI = (state) => {
        // Update game tag
        elements.gameTag.textContent = `Game detected: ${state.gameType}`;

        // Update solving status
        if (state.solvingGameType && state.solvingGameType !== state.gameType) {
            elements.solvingStatus.textContent = `Currently Solving: ${state.solvingGameType}`;
            elements.solvingStatus.style.display = 'block';
        } else {
            elements.solvingStatus.style.display = 'none';
        }

        // Update solve button state
        // Pinpoint and Crossclimb have apikeys section
        if (state.gameType === 'Pinpoint' || state.gameType === 'Crossclimb') {
            elements.solveButton.style.display = 'none';
            elements.apiKeySection.style.display = 'block';

            if (state.gameType === 'Pinpoint') {
                elements.pinpointControls.style.display = 'block';
                elements.crossclimbControls.style.display = 'none';
                elements.solvePinpoint.disabled = !state.isReady || !state.hasApiKey;
                elements.solvePinpoint.classList.toggle('api-key-required', !state.hasApiKey);
            } else if (state.gameType === 'Crossclimb') {
                elements.pinpointControls.style.display = 'none';
                elements.crossclimbControls.style.display = 'block';
                elements.solveCrossclimb.disabled = !state.isReady || !state.hasApiKey;
                elements.solveCrossclimb.classList.toggle('api-key-required', !state.hasApiKey);
            }
        } else {
            elements.solveButton.style.display = 'block';
            elements.pinpointControls.style.display = 'none';
            elements.crossclimbControls.style.display = 'none';
            elements.apiKeySection.style.display = 'none';
        }

        // Update close button state
        elements.cancelButton.disabled = !state.isSolving;
        elements.cancelButton.textContent = 'Cancel';
        elements.cancelButton.classList.toggle('solving', state.isSolving);

        // Update solve buttons
        SOLVE_BUTTONS.forEach(button => {
            if (button) {
                const requiresApiKey = API_KEY_REQUIRED_BUTTONS.includes(button);
                button.disabled = state.isSolving || !state.isReady || (requiresApiKey && !state.hasApiKey);
                button.classList.toggle('solving', state.isSolving);
            }
        });

        // Update API key section
        elements.deleteApiKey.disabled = !state.hasApiKey || (state.isSolving && state.solvingWithApiKey);
        if (state.hasApiKey) {
            // Get API key directly from storage
            chrome.storage.local.get('openaiApiKey', (data) => {
                if (data.openaiApiKey) {
                    elements.apiKeyInput.value = data.openaiApiKey;
                } else {
                    elements.apiKeyInput.value = '';
                    elements.apiKeyInput.placeholder = 'Enter your OpenAI API key';
                }
            });
        } else {
            elements.apiKeyInput.value = '';
            elements.apiKeyInput.placeholder = 'Enter your OpenAI API key';
        }

        // Show status
        showStatus(state.statusMessage, state.statusType);
    };

    // Listen for state updates from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateState') {
            const { state } = request;
            updateUI(state);
        }
    });

    // Initialize game-specific controls
    if (tab.url.includes('pinpoint')) {
        initializePinpointControls();
    } else if (tab.url.includes('crossclimb')) {
        initializeCrossclimbControls();
    } else {
        initializeOtherGameControls();
    }

    // Close button handler
    elements.cancelButton.addEventListener('click', async () => {
        chrome.runtime.sendMessage({ action: 'cancelSolving' });
    });

    // API Key section handlers
    elements.apiKeyHeader.addEventListener('click', () => {
        elements.apiKeyContent.classList.toggle('expanded');
        elements.apiKeyHeader.querySelector('span:last-child').innerHTML =
            elements.apiKeyContent.classList.contains('expanded') ? '&#9662;' : '&#9656;';
    });

    elements.saveApiKey.addEventListener('click', async () => {
        const apiKey = elements.apiKeyInput.value.trim();
        if (apiKey) {
            chrome.runtime.sendMessage({
                action: 'updateApiKey',
                apiKey: apiKey
            });
        } else {
            chrome.runtime.sendMessage({
                action: 'updateState',
                state: {
                    statusMessage: 'Please enter a valid API key',
                    statusType: 'error'
                }
            });
        }
    });

    elements.deleteApiKey.addEventListener('click', async () => {
        chrome.runtime.sendMessage({ action: 'clearApiKey' });
    });

    // Request initial state from background script
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getState' });
        if (response && response.state) {
            updateUI(response.state);
        }
    } catch (error) {
        console.warn('Error getting initial state:', error);
        showStatus('Error loading state', 'error');
    }

    function initializePinpointControls() {
        elements.solvePinpoint.addEventListener('click', async () => {
            chrome.runtime.sendMessage({
                action: 'startSolving',
                solveAction: 'solve',
                requiresApiKey: API_KEY_REQUIRED_BUTTONS.includes(elements.solvePinpoint)
            });
        });

        elements.inputStoredPinpoint.addEventListener('click', async () => {
            chrome.runtime.sendMessage({
                action: 'startSolving',
                solveAction: 'inputStoredSolution',
                requiresApiKey: API_KEY_REQUIRED_BUTTONS.includes(elements.inputStoredPinpoint)
            });
        });
    }

    function initializeCrossclimbControls() {
        elements.solveCrossclimb.addEventListener('click', async () => {
            chrome.runtime.sendMessage({
                action: 'startSolving',
                solveAction: 'solve',
                requiresApiKey: API_KEY_REQUIRED_BUTTONS.includes(elements.solveCrossclimb)
            });
        });

        elements.inputStoredCrossclimb.addEventListener('click', async () => {
            chrome.runtime.sendMessage({
                action: 'startSolving',
                solveAction: 'inputStoredSolution',
                requiresApiKey: API_KEY_REQUIRED_BUTTONS.includes(elements.inputStoredCrossclimb)
            });
        });
    }

    function initializeOtherGameControls() {
        elements.solveButton.addEventListener('click', async () => {
            chrome.runtime.sendMessage({
                action: 'startSolving',
                solveAction: 'solve',
                requiresApiKey: API_KEY_REQUIRED_BUTTONS.includes(elements.solveButton)
            });
        });
    }
}); 