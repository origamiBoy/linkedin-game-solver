// Import game config
let GAME_CONFIG;
import('./game_config.js').then(module => {
    GAME_CONFIG = module.default;
});

// Global content manager instance
let contentManager;

// Global state for selected control
let selectedControl = null;

// Initialize DOM elements
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
    inputStoredCrossclimb: document.getElementById('inputStoredCrossclimb'),
    viewToggle: document.getElementById('viewToggle'),
    gameCardsContainer: document.getElementById('gameCardsContainer'),
    gameInfoRow: document.getElementById('gameInfoRow'),
    gameInfoIcon: document.getElementById('gameInfoIcon'),
    gameInfoName: document.getElementById('gameInfoName'),
    gameInfoPuzzleButton: document.getElementById('gameInfoPuzzleButton'),
    gameInfoHelpButton: document.getElementById('gameInfoHelpButton'),
    gameAboutSection: document.getElementById('gameAboutSection'),
    linksGameCardsContainer: document.getElementById('linksGameCardsContainer')
};

// Array of buttons that require an API key
const API_KEY_REQUIRED_BUTTONS = [elements.solvePinpoint, elements.solveCrossclimb];

// Array of all solve buttons
const SOLVE_BUTTONS = [elements.solveButton, elements.solvePinpoint, elements.inputStoredPinpoint, elements.solveCrossclimb, elements.inputStoredCrossclimb];

// Helper function to show status
function showStatus(message, type = 'ready') {
    if (elements.status) {
        elements.status.innerHTML = message;
        elements.status.className = `status-message ${type}`;
    }
}

// Function to create game card HTML for grid/list views
function createGameCard(gameId, gameConfig, viewMode, showAbout = false) {
    const card = document.createElement('a');
    card.href = gameConfig.url;
    card.target = '_blank';
    card.className = `game-card ${viewMode}`;
    card.style.backgroundColor = gameConfig.backgroundColor;

    const icon = document.createElement('div');
    icon.className = 'game-card-icon';
    const iconImg = document.createElement('img');
    iconImg.src = gameConfig.icon.normal;
    iconImg.alt = `${gameConfig.name} icon`;
    icon.appendChild(iconImg);

    const content = document.createElement('div');
    content.className = 'game-card-content';
    const name = document.createElement('h4');
    name.className = 'game-card-name';
    name.textContent = gameConfig.name;
    content.appendChild(name);

    if (showAbout && gameConfig.about) {
        const about = document.createElement('p');
        about.className = 'game-card-about';
        about.textContent = gameConfig.about;
        content.appendChild(about);
    }

    const tags = document.createElement('div');
    tags.className = 'game-card-tags';
    if (gameConfig.tags.perfect) {
        const perfectTag = document.createElement('span');
        perfectTag.className = 'game-card-tag perfect';
        perfectTag.textContent = '100%';
        tags.appendChild(perfectTag);
    }
    if (gameConfig.tags.ai) {
        const aiTag = document.createElement('span');
        aiTag.className = 'game-card-tag ai';
        aiTag.textContent = 'AI';
        tags.appendChild(aiTag);
    }

    card.appendChild(icon);
    card.appendChild(content);
    card.appendChild(tags);

    return card;
}

// Function to create a control card
function createControlCard(control, gameType, state) {
    const card = document.createElement('button');
    card.className = 'control-card';
    card.id = control.id;
    card.innerHTML = `
        <span class="material-icons">${control.icon}</span>
        <span>${control.name}</span>
    `;

    // Set button state
    const requiresApiKey = control.requirements?.ai || false;
    const requiresStored = control.requirements?.stored || false;
    const isReady = state.isReady && (!requiresApiKey || state.hasApiKey);

    card.disabled = state.isSolving || !isReady;
    card.classList.toggle('api-key-required', requiresApiKey && !state.hasApiKey);

    // Add click handler for radio button behavior
    card.addEventListener('click', () => {
        if (card.disabled) return;

        // If this card is already selected, deselect it
        if (selectedControl === control) {
            selectedControl = null;
            card.classList.remove('selected');
            updateControlDescription(null);
            updateStartButton();
            return;
        }

        // Deselect previously selected card if any
        const previouslySelected = document.querySelector('.control-card.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }

        // Select this card
        selectedControl = control;
        card.classList.add('selected');
        updateControlDescription(control);
        updateStartButton();
    });

    return card;
}

// Function to update control description
function updateControlDescription(control) {
    const descriptionElement = document.getElementById('controlDescription');
    if (!descriptionElement) return;

    if (control && control.description) {
        descriptionElement.textContent = control.description;
        descriptionElement.classList.add('visible');
    } else {
        descriptionElement.textContent = '';
        descriptionElement.classList.remove('visible');
    }
}

// Function to update start button state
function updateStartButton() {
    const startButton = document.getElementById('startButton');
    if (!startButton) return;

    startButton.disabled = !selectedControl;
}

// Function to create a cancel button
function createCancelButton(state, isIconOnly = false) {
    const button = document.createElement('button');
    button.className = isIconOnly ? 'icon-button cancel-icon-button' : 'game-control-button cancel';
    button.id = 'cancelButton';
    button.title = 'Cancel';
    button.innerHTML = isIconOnly ?
        '<span class="material-icons">close</span>' :
        `<span class="material-icons">close</span>
        <span>Cancel</span>`;

    // Set button state - enabled only when solving
    button.disabled = !state.isSolving;

    // Add click handler
    button.addEventListener('click', () => {
        if (state.isSolving) {
            chrome.runtime.sendMessage({ action: 'cancelSolving' });
        }
    });

    return button;
}

// Function to create controls container structure
function createControlsContainer() {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'controls-container';

    const controlsGrid = document.createElement('div');
    controlsGrid.className = 'controls-grid';
    controlsGrid.id = 'controlsGrid';

    const controlDescription = document.createElement('div');
    controlDescription.className = 'control-description';
    controlDescription.id = 'controlDescription';

    const controlsActions = document.createElement('div');
    controlsActions.className = 'controls-actions';

    // Create action buttons
    const refreshButton = document.createElement('button');
    refreshButton.className = 'icon-button refresh-button';
    refreshButton.id = 'refreshButton';
    refreshButton.title = 'Refresh Page';
    refreshButton.innerHTML = '<span class="material-icons">refresh</span>';

    const startButton = document.createElement('button');
    startButton.className = 'start-button';
    startButton.id = 'startButton';
    startButton.disabled = true;
    startButton.innerHTML = `
        <span class="material-icons">play_arrow</span>
        <span>Start</span>
    `;

    // Create icon-only cancel button for controls container
    const cancelButton = createCancelButton({ isSolving: false }, true);

    // Assemble the controls
    controlsActions.appendChild(refreshButton);
    controlsActions.appendChild(startButton);
    controlsActions.appendChild(cancelButton);

    controlsContainer.appendChild(controlsGrid);
    controlsContainer.appendChild(controlDescription);

    return { controlsContainer, controlsActions };
}

// Function to update game controls
function updateGameControls(gameConfig, state) {
    const gameControlsContainer = document.getElementById('gameControlsContainer');
    if (!gameControlsContainer) return;

    // Clear existing controls
    gameControlsContainer.innerHTML = '';

    // Create new controls container structure
    const { controlsContainer, controlsActions } = createControlsContainer();
    gameControlsContainer.appendChild(controlsContainer);
    gameControlsContainer.appendChild(controlsActions);

    // Get references to the newly created elements
    const controlsGrid = document.getElementById('controlsGrid');
    const refreshButton = document.getElementById('refreshButton');
    const startButton = document.getElementById('startButton');
    const cancelButton = document.getElementById('cancelButton');

    if (!controlsGrid || !refreshButton || !startButton || !cancelButton) return;

    // Reset selected control state
    selectedControl = null;
    updateControlDescription(null);
    updateStartButton();

    // Create control cards
    gameConfig.controls.forEach(control => {
        const card = createControlCard(control, state.gameType, state);
        controlsGrid.appendChild(card);
    });

    // Set up refresh button
    refreshButton.onclick = () => {
        chrome.tabs.update({ url: gameConfig.url });
    };

    // Set up start button
    startButton.onclick = () => {
        if (!selectedControl) return;

        chrome.runtime.sendMessage({
            action: 'startSolving',
            solveAction: selectedControl.solveAction,
            requiresApiKey: selectedControl.requirements?.ai || false
        });
    };

    // Set up cancel button
    cancelButton.disabled = !state.isSolving;
    cancelButton.onclick = () => {
        if (state.isSolving) {
            chrome.runtime.sendMessage({ action: 'cancelSolving' });
        }
    };
}

// Function to create a game control button
function createGameControlButton(control, gameType, state) {
    const button = document.createElement('button');
    button.className = 'game-control-button';
    button.id = control.id;
    button.innerHTML = `
        <span class="material-icons">${control.icon}</span>
        <span>${control.name}</span>
    `;

    // Set button state
    const requiresApiKey = control.requirements?.ai || false;
    const requiresStored = control.requirements?.stored || false;
    const isReady = state.isReady && (!requiresApiKey || state.hasApiKey);

    button.disabled = state.isSolving || !isReady;
    button.classList.toggle('api-key-required', requiresApiKey && !state.hasApiKey);
    button.classList.toggle('solving', state.isSolving);

    // Add click handler
    button.addEventListener('click', () => {
        chrome.runtime.sendMessage({
            action: 'startSolving',
            solveAction: control.solveAction,
            requiresApiKey: requiresApiKey
        });
    });

    return button;
}

// Function to update game cards view
async function updateGameCardsView(viewMode, container = 'gameCardsContainer') {
    // Wait for GAME_CONFIG to be loaded
    if (!GAME_CONFIG) {
        await new Promise(resolve => {
            const checkConfig = setInterval(() => {
                if (GAME_CONFIG) {
                    clearInterval(checkConfig);
                    resolve();
                }
            }, 50);
        });
    }

    const containerElement = document.getElementById(container);
    if (!containerElement) return;

    // Clear existing content
    containerElement.innerHTML = '';

    // Get current state to check if solving
    const response = await chrome.runtime.sendMessage({ action: 'getState' });
    const state = response?.state;

    // Add cancel button at the top if solving
    if (state?.isSolving && container === 'gameCardsContainer') {
        const cancelButton = createCancelButton(state, false);
        const cancelContainer = document.createElement('div');
        cancelContainer.style.marginBottom = '8px';
        cancelContainer.appendChild(cancelButton);
        containerElement.appendChild(cancelContainer);
    }

    // Set container class and add game cards
    containerElement.className = `game-cards-container ${viewMode}`;

    Object.entries(GAME_CONFIG).forEach(([gameId, gameConfig]) => {
        containerElement.appendChild(createGameCard(gameId, gameConfig, viewMode));
    });

    // Update view toggle icon if it exists (only for home section)
    if (elements.viewToggle && container === 'gameCardsContainer') {
        const icon = elements.viewToggle.querySelector('.material-icons');
        if (icon) {
            icon.textContent = viewMode === 'grid' ? 'view_list' : 'grid_view';
        }
        elements.viewToggle.classList.toggle('active', viewMode === 'list');
    }
}

// Function to get view preference
async function getViewPreference(state) {
    const storage = await chrome.storage.local.get('viewPreference');
    return state?.viewPreference || storage.viewPreference || 'list';
}

// Update UI function
const updateUI = async (state) => {
    // Update game info row
    if (elements.gameInfoRow && elements.gameInfoIcon && elements.gameInfoName) {
        if (state.gameType && state.gameType !== 'Unknown') {
            elements.gameInfoRow.style.display = 'flex';
            const gameConfig = GAME_CONFIG[state.gameType.toLowerCase()];
            if (gameConfig) {
                elements.gameInfoIcon.src = gameConfig.icon.normal;
                elements.gameInfoName.textContent = gameConfig.name;
                if (elements.gameAboutSection) {
                    elements.gameAboutSection.textContent = gameConfig.about || '';
                }
            }
        } else {
            elements.gameInfoRow.style.display = 'none';
            if (elements.gameAboutSection) {
                elements.gameAboutSection.classList.remove('active');
            }
        }
    }

    // Update solving status
    if (elements.solvingStatus) {
        if (state.solvingGameType && state.solvingGameType !== state.gameType) {
            elements.solvingStatus.textContent = `Currently Solving: ${state.solvingGameType}`;
            elements.solvingStatus.style.display = 'block';
        } else {
            elements.solvingStatus.style.display = 'none';
        }
    }

    // Update game tag
    if (elements.gameTag) {
        elements.gameTag.textContent = `Game detected: ${state.gameType}`;
    }

    // Update game controls and single game card
    const gameControlsContainer = document.getElementById('gameControlsContainer');
    const singleGameCardContainer = document.getElementById('singleGameCardContainer');
    const gameCardsContainer = document.getElementById('gameCardsContainer');

    // Handle cancel button visibility for non-correct URL scenarios
    if (state.isSolving) {
        const cancelButton = createCancelButton(state, false);

        // If we're on the home view, add cancel button to game cards container
        if (contentManager?.isSectionActive('home') && gameCardsContainer) {
            // Remove any existing cancel button
            const existingCancel = gameCardsContainer.querySelector('.game-control-button.cancel');
            if (existingCancel) {
                existingCancel.parentElement.remove();
            }
            // Add cancel button to game cards container
            const cancelContainer = document.createElement('div');
            cancelContainer.style.marginBottom = '8px';
            cancelContainer.appendChild(cancelButton);
            gameCardsContainer.insertBefore(cancelContainer, gameCardsContainer.firstChild);
        }
    } else {
        // Remove cancel button from game cards if not solving
        if (gameCardsContainer) {
            const existingCancel = gameCardsContainer.querySelector('.game-control-button.cancel');
            if (existingCancel) {
                existingCancel.parentElement.remove();
            }
        }
    }

    if (gameControlsContainer && singleGameCardContainer) {
        // Clear existing controls
        gameControlsContainer.innerHTML = '';
        singleGameCardContainer.innerHTML = '';

        if (state.gameType && state.gameType !== 'Unknown') {
            const gameConfig = GAME_CONFIG[state.gameType.toLowerCase()];
            if (gameConfig) {
                if (state.hasCorrectUrl) {
                    // Show game controls when URL is correct
                    gameControlsContainer.style.display = 'block';
                    singleGameCardContainer.style.display = 'none';
                    updateGameControls(gameConfig, state);
                } else {
                    // Show single game card when URL is incorrect but game is detected
                    gameControlsContainer.style.display = 'none';
                    singleGameCardContainer.style.display = 'block';

                    const card = createGameCard(state.gameType.toLowerCase(), gameConfig, 'grid', true);
                    singleGameCardContainer.appendChild(card);

                    // Add full cancel button after game card if solving
                    if (state.isSolving) {
                        const cancelButton = createCancelButton(state, false);
                        const cancelContainer = document.createElement('div');
                        cancelContainer.style.marginTop = '8px';
                        cancelContainer.appendChild(cancelButton);
                        singleGameCardContainer.appendChild(cancelContainer);
                    }
                }
            }
        }
    }

    // Update solve button state
    if (elements.solveButton) {
        // Pinpoint and Crossclimb have apikeys section
        if (state.gameType === 'Pinpoint' || state.gameType === 'Crossclimb') {
            elements.solveButton.style.display = 'none';
            if (elements.apiKeySection) {
                elements.apiKeySection.style.display = 'block';
            }

            if (state.gameType === 'Pinpoint') {
                if (elements.pinpointControls) {
                    elements.pinpointControls.style.display = 'block';
                }
                if (elements.crossclimbControls) {
                    elements.crossclimbControls.style.display = 'none';
                }
                if (elements.solvePinpoint) {
                    elements.solvePinpoint.disabled = !state.isReady || !state.hasApiKey;
                    elements.solvePinpoint.classList.toggle('api-key-required', !state.hasApiKey);
                }
            } else if (state.gameType === 'Crossclimb') {
                if (elements.pinpointControls) {
                    elements.pinpointControls.style.display = 'none';
                }
                if (elements.crossclimbControls) {
                    elements.crossclimbControls.style.display = 'block';
                }
                if (elements.solveCrossclimb) {
                    elements.solveCrossclimb.disabled = !state.isReady || !state.hasApiKey;
                    elements.solveCrossclimb.classList.toggle('api-key-required', !state.hasApiKey);
                }
            }
        } else {
            elements.solveButton.style.display = 'block';
            if (elements.pinpointControls) {
                elements.pinpointControls.style.display = 'none';
            }
            if (elements.crossclimbControls) {
                elements.crossclimbControls.style.display = 'none';
            }
            if (elements.apiKeySection) {
                elements.apiKeySection.style.display = 'none';
            }
        }
    }

    // Update API key section
    if (elements.deleteApiKey) {
        elements.deleteApiKey.disabled = !state.hasApiKey || (state.isSolving && state.solvingWithApiKey);
    }
    if (elements.apiKeyInput) {
        if (state.hasApiKey) {
            const data = await chrome.storage.local.get('openaiApiKey');
            elements.apiKeyInput.value = data.openaiApiKey || '';
        } else {
            elements.apiKeyInput.value = '';
        }
        elements.apiKeyInput.placeholder = 'Enter your OpenAI API key';
    }

    // Show status
    showStatus(state.statusMessage, state.statusType);

    // Update game cards view if contentManager is initialized
    if (contentManager) {
        if (contentManager.isSectionActive('home')) {
            await updateGameCardsView(await getViewPreference(state));
        } else if (contentManager.isSectionActive('links')) {
            await updateGameCardsView('condensed', 'linksGameCardsContainer');
        }
    }
};

// Content Management System
class ContentManager {
    constructor() {
        this.contentManager = document.getElementById('contentManager');
        this.mainContent = document.getElementById('mainContent');
        this.currentSection = null;
        this.headerButtons = {
            home: document.getElementById('homeButton'),
            settings: document.getElementById('settingsButton'),
            kebab: document.getElementById('kebabButton')
        };
        this.setupEventListeners();
        this.contentManager.classList.remove('active');
    }

    setupEventListeners() {
        this.headerButtons.home.addEventListener('click', async () => {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'getState' });
                if (response?.state) {
                    const viewPreference = await getViewPreference(response.state);
                    this.showSection('home');
                    this.updateHeaderButtonStates('home');
                    await updateGameCardsView(viewPreference);
                }
            } catch (error) {
                console.warn('Error getting state for home view:', error);
                this.showSection('home');
                this.updateHeaderButtonStates('home');
                await updateGameCardsView('list');
            }
        });

        this.headerButtons.settings.addEventListener('click', () => {
            this.showSection('settings');
            this.updateHeaderButtonStates('settings');
        });

        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.getAttribute('data-section');
                this.showSection(sectionId);
                this.updateHeaderButtonStates(null);
            });
        });

        document.querySelectorAll('.close-button').forEach(button => {
            button.addEventListener('click', () => {
                const sectionId = button.getAttribute('data-section');
                this.hideSection(sectionId);
                this.updateHeaderButtonStates(null);
            });
        });
    }

    updateHeaderButtonStates(activeButton) {
        Object.values(this.headerButtons).forEach(button => button.classList.remove('active'));
        if (activeButton && this.headerButtons[activeButton]) {
            this.headerButtons[activeButton].classList.add('active');
        }
    }

    showSection(sectionId) {
        this.mainContent.classList.remove('active');
        this.contentManager.classList.add('active');

        document.querySelectorAll('.content-section, .settings-section').forEach(section => {
            section.classList.remove('active');
        });

        const section = document.getElementById(`${sectionId}Section`);
        if (section) {
            section.classList.add('active');
            this.currentSection = sectionId;

            if (sectionId === 'settings' && elements.apiKeySection) {
                elements.apiKeySection.style.display = 'block';
            }
        }

        document.getElementById('modalMenu')?.classList.remove('visible');
    }

    hideSection(sectionId) {
        document.getElementById(`${sectionId}Section`)?.classList.remove('active');
        this.contentManager.classList.remove('active');
        this.mainContent.classList.add('active');
        this.currentSection = null;
        document.getElementById('modalMenu')?.classList.remove('visible');
    }

    showMainContent() {
        this.contentManager.classList.remove('active');
        this.mainContent.classList.add('active');
        this.currentSection = null;
        this.updateHeaderButtonStates(null);
    }

    isSectionActive(sectionId) {
        return this.currentSection === sectionId;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const contentManager = new ContentManager();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Initialize both home and links views
    await Promise.all([
        updateGameCardsView('list', 'gameCardsContainer'),
        updateGameCardsView('condensed', 'linksGameCardsContainer')
    ]);

    // Menu functionality
    const kebabButton = document.getElementById('kebabButton');
    const modalMenu = document.getElementById('modalMenu');

    // Add menu item click handlers
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const sectionId = item.getAttribute('data-section');
            contentManager.showSection(sectionId);
            contentManager.updateHeaderButtonStates(null);

            // Update links view when switching to links section
            if (sectionId === 'links') {
                await updateGameCardsView('condensed', 'linksGameCardsContainer');
            }
        });
    });

    kebabButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        modalMenu?.classList.toggle('visible');
    });

    document.addEventListener('click', (e) => {
        if (modalMenu && !modalMenu.contains(e.target) && e.target !== kebabButton) {
            modalMenu.classList.remove('visible');
        }
    });

    // View toggle handler
    elements.viewToggle?.addEventListener('click', async () => {
        const currentView = elements.gameCardsContainer.classList.contains('grid') ? 'grid' : 'list';
        const newViewMode = currentView === 'grid' ? 'list' : 'grid';

        try {
            await chrome.storage.local.set({ viewPreference: newViewMode });
            await updateGameCardsView(newViewMode);
            await chrome.runtime.sendMessage({
                action: 'updateViewPreference',
                viewPreference: newViewMode
            });
        } catch (error) {
            console.error('Error updating view preference:', error);
            showStatus('Error updating view preference', 'error');
        }
    });

    // Listen for state updates
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateState') {
            updateUI(request.state);
            // Update links view when state changes
            if (contentManager.isSectionActive('links')) {
                updateGameCardsView('condensed', 'linksGameCardsContainer');
            }
        }
    });

    // Initialize state
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getState' });
        if (response?.state) {
            const viewPreference = await getViewPreference(response.state);
            response.state.viewPreference = viewPreference;

            if (response.state.gameType && response.state.gameType !== 'Unknown') {
                contentManager.showMainContent();
            } else {
                contentManager.showSection('home');
                contentManager.updateHeaderButtonStates('home');
                await updateGameCardsView(viewPreference);
            }
            await updateUI(response.state);
        }
    } catch (error) {
        console.warn('Error getting initial state:', error);
        showStatus('Error loading state', 'error');
        // Default to home view on error
        contentManager.showSection('home');
        contentManager.updateHeaderButtonStates('home');
        // Default to list view on error
        await updateGameCardsView('list');
    }

    // Event handlers
    elements.apiKeyHeader?.addEventListener('click', () => {
        elements.apiKeyContent?.classList.toggle('expanded');
        const arrow = elements.apiKeyHeader?.querySelector('span:last-child');
        if (arrow) {
            arrow.innerHTML = elements.apiKeyContent?.classList.contains('expanded') ? '&#9662;' : '&#9656;';
        }
    });

    elements.saveApiKey?.addEventListener('click', async () => {
        const apiKey = elements.apiKeyInput?.value.trim();
        if (apiKey) {
            chrome.runtime.sendMessage({ action: 'updateApiKey', apiKey });
        } else {
            chrome.runtime.sendMessage({
                action: 'updateState',
                state: { statusMessage: 'Please enter a valid API key', statusType: 'error' }
            });
        }
    });

    elements.deleteApiKey?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'clearApiKey' });
    });

    // Game info button handlers
    elements.gameInfoPuzzleButton?.addEventListener('click', () => {
        if (contentManager.currentSection) {
            contentManager.hideSection(contentManager.currentSection);
        }
        contentManager.showMainContent();
    });

    elements.gameInfoHelpButton?.addEventListener('click', () => {
        elements.gameAboutSection?.classList.toggle('active');
    });
}); 