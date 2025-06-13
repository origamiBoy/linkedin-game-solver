// Import game config
let GAME_CONFIG;
let configLoaded = false;

// Initialize config loading
const configPromise = import('./game_config.js').then(module => {
    GAME_CONFIG = module.default;
    configLoaded = true;
    return GAME_CONFIG;
});

// Global content manager instance
let contentManager;

// Global state for selected control
let selectedControl = null;

// Initialize DOM elements
const elements = {
    status: document.getElementById('status'),
    apiKeySection: document.getElementById('apiKeySection'),
    apiKeyContent: document.getElementById('apiKeyContent'),
    apiKeyHeader: document.getElementById('apiKeyHeader'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKey: document.getElementById('saveApiKey'),
    deleteApiKey: document.getElementById('deleteApiKey'),
    viewToggle: document.getElementById('viewToggle'),
    gameCardsContainer: document.getElementById('gameCardsContainer'),
    gameInfoRow: document.getElementById('gameInfoRow'),
    gameInfoIcon: document.getElementById('gameInfoIcon'),
    gameInfoName: document.getElementById('gameInfoName'),
    gameInfoPuzzleButton: document.getElementById('gameInfoPuzzleButton'),
    gameInfoHelpButton: document.getElementById('gameInfoHelpButton'),
    gameInfoSolvingRow: document.getElementById('gameInfoSolvingRow'),
    gameInfoSolvingIcon: document.getElementById('gameInfoSolvingIcon'),
    gameInfoSolvingName: document.getElementById('gameInfoSolvingName'),
    gameInfoSolvingRight: document.getElementById('gameInfoSolvingRight'),
    gameAboutSection: document.getElementById('gameAboutSection'),
    linksGameCardsContainer: document.getElementById('linksGameCardsContainer'),
    headerRow: document.getElementById('headerRow')
};

// Helper function to ensure config is loaded
async function ensureConfigLoaded() {
    if (!configLoaded) {
        await configPromise;
    }
    return GAME_CONFIG;
}

// Helper function to get latest state
async function getLatestState() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getState' });
        return response?.state || {};
    } catch (error) {
        console.warn('Error getting state:', error);
        return {};
    }
}

// Helper function to show status
function showStatus(message, type = 'ready', state) {
    if (elements.status) {
        // Update status message
        const statusMessage = elements.status.querySelector('.status-message');
        if (statusMessage) {
            statusMessage.innerHTML = message;
            statusMessage.className = `status-message ${type}`;
        }

        // Handle login button
        let loginButton = elements.status.querySelector('.status-login-button');
        if (type === 'success') {
            if (!loginButton) {
                // Create login button
                loginButton = document.createElement('button');
                loginButton.className = 'status-login-button';
                /*
                // Can not get the log out functionality to work when logged in to LinkedIn
                // If not guest, show log out
                if (state?.hasResultsUrl && !state?.hasGuestUrl) {
                    loginButton.textContent = 'Log Out';
                    loginButton.addEventListener('click', () => {
                        chrome.runtime.sendMessage({ action: 'clickLogoutButton' });
                        console.log('clickLogoutButton');
                    });
                } else {
                    // If guest results or general success, show log in
                    loginButton.textContent = 'Log In';
                    loginButton.addEventListener('click', () => {
                        chrome.runtime.sendMessage({ action: 'clickLoginButton' });
                    });
                }
                */
                loginButton.textContent = 'Log In';
                loginButton.addEventListener('click', () => {
                    chrome.runtime.sendMessage({ action: 'clickLoginButton' });
                });
                elements.status.appendChild(loginButton);
            }

            // if log out is funtional
            //loginButton.disabled = !state?.hasResultsUrl;
            loginButton.disabled = !state?.hasResultsUrl || !state?.hasGuestUrl;
        } else if (loginButton) {
            loginButton.remove();
        }
    }
}

// Helper function to show API key status
function showApiKeyStatus(message, type = 'success') {
    const apiKeyStatus = document.getElementById('apiKeyStatus');
    if (apiKeyStatus) {
        apiKeyStatus.textContent = message;
        apiKeyStatus.className = `api-key-status ${type}`;
    }
    setTimeout(() => {
        apiKeyStatus.textContent = '';
    }, 3000);
}

// Helper function to check if a game has stored solutions
async function hasStoredSolutions(gameType) {
    try {
        const gameConfig = GAME_CONFIG[gameType.toLowerCase()];
        if (!gameConfig?.storageKey) return false;

        const data = await chrome.storage.local.get(gameConfig.storageKey);

        return !!data[gameConfig.storageKey];
    } catch (error) {
        console.warn('Error checking stored solutions:', error);
        return false;
    }
}

// Function to create game card HTML for grid/list views
function createGameCard(gameId, gameConfig, viewMode, showAbout = false, newTab = true) {
    const card = document.createElement('a');
    card.href = gameConfig.url;
    if (newTab) {
        card.target = '_blank';
    }
    else {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.update({ url: gameConfig.url });
        });
    }
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
        about.textContent = gameConfig.tagline;
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
async function createControlCard(control, gameType, state) {
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
    let hasStored = false;

    if (requiresStored) {
        hasStored = await hasStoredSolutions(gameType);
    }

    const isReady = state?.isReady &&
        (!requiresApiKey || state?.hasApiKey) &&
        (!requiresStored || hasStored);

    // If button is disabled for non-solving reasons, unselect it
    if (!isReady && !state?.isSolving) {
        if (selectedControl === control) {
            selectedControl = null;
            updateControlDescription(null);
            updateStartButton(state);
        }
    }

    card.disabled = state?.isSolving || !isReady;
    card.classList.toggle('api-key-required', requiresApiKey && !state?.hasApiKey);
    card.classList.toggle('stored-required', requiresStored && !hasStored);

    // Add tag indicators if needed
    if (requiresApiKey || requiresStored) {
        const tagIndicators = document.createElement('div');
        tagIndicators.className = 'tag-indicators';

        if (requiresApiKey) {
            const aiTag = document.createElement('div');
            aiTag.className = `tag-indicator ai ${state?.hasApiKey ? 'success-tag' : 'failure-tag'}`;
            aiTag.title = state?.hasApiKey ? 'AI API Key Available' : 'AI API Key Required';
            aiTag.innerHTML = '<span class="material-icons">smart_toy</span>';

            // Add click handler to navigate to settings
            aiTag.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card selection
                // Find the settings button and click it
                const settingsButton = document.getElementById('settingsButton');
                if (settingsButton) {
                    settingsButton.click();
                }
            });

            tagIndicators.appendChild(aiTag);
        }

        if (requiresStored) {
            const storageTag = document.createElement('div');
            storageTag.className = `tag-indicator storage ${hasStored ? 'success-tag' : 'failure-tag'}`;
            storageTag.title = hasStored ? 'Stored Solutions Available' : 'No Stored Solutions';
            storageTag.innerHTML = '<span class="material-icons">storage</span>';
            tagIndicators.appendChild(storageTag);
        }

        card.appendChild(tagIndicators);
    }

    // Add click handler for radio button behavior
    card.addEventListener('click', () => {
        if (card.disabled) return;

        // If this card is already selected, deselect it
        if (selectedControl === control) {
            selectedControl = null;
            card.classList.remove('selected');
            updateControlDescription(null);
            updateStartButton(state);
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
        updateStartButton(state);
    });

    return card;
}

// Function to update control description
function updateControlDescription(control) {
    const descriptionElement = document.getElementById('controlDescription');
    if (!descriptionElement) return;

    if (control && control.description) {
        descriptionElement.textContent = control.description;
        descriptionElement.classList.add('has-selection');
    } else {
        descriptionElement.textContent = 'Select a solver button';
        descriptionElement.classList.remove('has-selection');
    }
}

// Function to update start button state
function updateStartButton(state) {
    const startButton = document.getElementById('startButton');
    if (!startButton) return;

    startButton.disabled = !selectedControl || state?.isSolving;
}

// Function to create a cancel button
function createCancelButton(state, isIconOnly = false) {
    const button = document.createElement('button');
    button.className = isIconOnly ? 'icon-button' : 'cancel-button';
    button.id = 'cancelButton';
    button.title = 'Cancel';
    button.innerHTML = isIconOnly ?
        '<span class="material-icons">close</span>' :
        `<span class="material-icons">close</span>
        <span>Cancel</span>`;

    // Set button state - enabled only when solving
    button.disabled = !state?.isSolving;

    // Add click handler
    button.addEventListener('click', () => {
        if (state?.isSolving) {
            chrome.runtime.sendMessage({ action: 'cancelSolving' });
        }
    });

    return button;
}

// Function to create controls container structure
function createControlsContainer(state) {
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
    const cancelButton = createCancelButton(state, true);

    // Assemble the controls
    controlsActions.appendChild(refreshButton);
    controlsActions.appendChild(startButton);
    controlsActions.appendChild(cancelButton);

    controlsContainer.appendChild(controlsGrid);
    controlsContainer.appendChild(controlDescription);

    return { controlsContainer, controlsActions };
}

// Function to update game controls
async function updateGameControls(gameConfig, state) {
    // Ensure config is loaded before proceeding
    await ensureConfigLoaded();

    const gameControlsContainer = document.getElementById('gameControlsContainer');
    if (!gameControlsContainer) return;

    // Check for existing controls container and actions
    let controlsContainer = gameControlsContainer.querySelector('.controls-container');
    let controlsActions = gameControlsContainer.querySelector('.controls-actions');

    // Only create new containers if they don't exist
    if (!controlsContainer || !controlsActions) {
        // Clear existing controls
        gameControlsContainer.innerHTML = '';

        // Create new controls container structure
        const newContainers = createControlsContainer(state);
        controlsContainer = newContainers.controlsContainer;
        controlsActions = newContainers.controlsActions;
        gameControlsContainer.appendChild(controlsContainer);
        gameControlsContainer.appendChild(controlsActions);
    }

    // Check for stored solutions
    const hasStored = await hasStoredSolutions(state?.gameType);
    state.hasStoredSolutions = hasStored;

    // Get references to the elements
    const controlsGrid = controlsContainer.querySelector('#controlsGrid');
    const refreshButton = controlsActions.querySelector('#refreshButton');
    const startButton = controlsActions.querySelector('#startButton');
    const cancelButton = controlsActions.querySelector('#cancelButton');

    if (!controlsGrid || !refreshButton || !startButton || !cancelButton) return;

    // Clear existing control cards
    controlsGrid.innerHTML = '';

    // Create control cards
    for (const control of gameConfig.controls) {
        const card = await createControlCard(control, state?.gameType, state);
        // If this control was previously selected, restore its selected state
        if (selectedControl && selectedControl.id === control.id) {
            card.classList.add('selected');
            updateControlDescription(control);
            startButton.disabled = false; // Enable start button if control is selected
        }
        controlsGrid.appendChild(card);
    }

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

    updateStartButton(state);

    // Set up cancel button
    cancelButton.disabled = !state?.isSolving;
    cancelButton.onclick = () => {
        if (state?.isSolving) {
            chrome.runtime.sendMessage({ action: 'cancelSolving' });
        }
    };
}

// Function to update game cards view
async function updateGameCardsView(viewMode, container = 'gameCardsContainer') {
    // Ensure config is loaded before proceeding
    await ensureConfigLoaded();

    const containerElement = document.getElementById(container);
    if (!containerElement) return;

    // Clear existing content
    containerElement.innerHTML = '';

    // Get current state to check if solving
    const state = await getLatestState();


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
    // Ensure config is loaded before proceeding
    await ensureConfigLoaded();

    // Get latest state if none provided
    if (!state) {
        state = await getLatestState();
    }

    // Update game info rows
    if (elements.gameInfoRow && elements.gameInfoIcon && elements.gameInfoName) {
        // Handle main game info row
        if (state?.gameType && state.gameType !== 'Unknown') {
            elements.gameInfoRow.style.display = 'flex';
            const gameConfig = GAME_CONFIG[state.gameType.toLowerCase()];
            if (gameConfig) {
                elements.gameInfoIcon.src = gameConfig.icon.normal;
                elements.gameInfoName.textContent = gameConfig.name;
                if (elements.gameAboutSection) {
                    elements.gameAboutSection.textContent = gameConfig.about || '';
                }
            }
            // Divider styling
            elements.headerRow?.classList.add('hasDivider');
        } else {
            elements.gameInfoRow.style.display = 'none';
            if (elements.gameAboutSection) {
                elements.gameAboutSection.classList.remove('active');
            }
            // Divider styling
            elements.headerRow?.classList.remove('hasDivider');
        }

        // Handle solving game info row
        if (state?.solvingGameType && state.solvingGameType !== state.gameType) {
            elements.gameInfoSolvingRow.style.display = 'flex';
            const solvingGameConfig = GAME_CONFIG[state.solvingGameType.toLowerCase()];
            if (solvingGameConfig) {
                elements.gameInfoSolvingIcon.src = solvingGameConfig.icon.normal;
                elements.gameInfoSolvingName.textContent = solvingGameConfig.name;
            }
            // Divider styling
            elements.headerRow?.classList.add('hasDivider');

            // Add cancel button to solving row
            if (elements.gameInfoSolvingRight) {
                // Clear existing cancel button
                elements.gameInfoSolvingRight.innerHTML = '';
                // Create and add new cancel button
                const cancelButton = createCancelButton(state, false);
                elements.gameInfoSolvingRight.appendChild(cancelButton);
            }


            const divider = elements.gameInfoRow.querySelector('.game-info-divider');
            const solvingText = elements.gameInfoRow.querySelector('.game-info-solving-text');
            if (divider) divider.style.display = 'block';
            if (solvingText) solvingText.style.display = 'inline';

        } else {
            elements.gameInfoSolvingRow.style.display = 'none';
            // Divider styling
            if (!(state?.gameType && state.gameType !== 'Unknown')) {
                elements.headerRow?.classList.remove('hasDivider');
            }
            // Clear cancel button
            if (elements.gameInfoSolvingRight) {
                elements.gameInfoSolvingRight.innerHTML = '';
            }

            const divider = elements.gameInfoRow.querySelector('.game-info-divider');
            const solvingText = elements.gameInfoRow.querySelector('.game-info-solving-text');
            if (divider) divider.style.display = 'none';
            if (solvingText) solvingText.style.display = 'none';
        }
    }

    // Update game controls and single game card
    const gameControlsContainer = document.getElementById('gameControlsContainer');
    const singleGameCardContainer = document.getElementById('singleGameCardContainer');

    if (gameControlsContainer && singleGameCardContainer) {
        // Clear existing controls
        gameControlsContainer.innerHTML = '';
        singleGameCardContainer.innerHTML = '';

        if (state?.gameType && state.gameType !== 'Unknown') {
            const gameConfig = GAME_CONFIG[state.gameType.toLowerCase()];
            if (gameConfig) {
                if (state?.hasCorrectUrl || state?.hasResultsUrl) {
                    // Show game controls when URL is correct
                    gameControlsContainer.style.display = 'block';
                    singleGameCardContainer.style.display = 'none';
                    await updateGameControls(gameConfig, state);
                    // Set default control description message if no control is selected
                    if (!selectedControl) {
                        updateControlDescription(null);
                    }
                } else {
                    // Show single game card when URL is incorrect but game is detected
                    gameControlsContainer.style.display = 'none';
                    singleGameCardContainer.style.display = 'block';

                    const card = createGameCard(state.gameType.toLowerCase(), gameConfig, 'grid', true, false);
                    singleGameCardContainer.appendChild(card);
                }
            }
        }
    }

    // Update API key section
    if (elements.deleteApiKey) {
        elements.deleteApiKey.disabled = !state?.hasApiKey || (state?.isSolving && state?.solvingWithApiKey);
    }
    if (elements.saveApiKey) {
        elements.saveApiKey.disabled = (state?.isSolving && state?.solvingWithApiKey);
    }
    if (elements.apiKeyInput) {
        if (state?.hasApiKey) {
            const data = await chrome.storage.local.get('openaiApiKey');
            elements.apiKeyInput.value = data.openaiApiKey || '';
        } else {
            elements.apiKeyInput.value = '';
        }
        elements.apiKeyInput.placeholder = 'Enter your OpenAI API key';
        elements.apiKeyInput.disabled = (state?.isSolving && state?.solvingWithApiKey);
    }

    // Show status
    showStatus(state?.statusMessage || 'Ready', state?.statusType || 'ready', state);

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
                const state = await getLatestState();
                const viewPreference = await getViewPreference(state);
                this.showSection('home', true);
                await updateGameCardsView(viewPreference);
            } catch (error) {
                console.warn('Error getting state for home view:', error);
                this.showSection('home', true);
                await updateGameCardsView('list');
            }
        });

        this.headerButtons.settings.addEventListener('click', () => {
            this.showSection('settings', true);
        });

        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.getAttribute('data-section');
                this.showSection(sectionId, false);
            });
        });

        document.querySelectorAll('.close-button').forEach(button => {
            button.addEventListener('click', () => {
                const sectionId = button.getAttribute('data-section');
                this.hideSection(sectionId);
            });
        });
    }

    updateHeaderButtonStates(activeButton) {
        Object.values(this.headerButtons).forEach(button => button.classList.remove('active'));
        if (activeButton && this.headerButtons[activeButton]) {
            this.headerButtons[activeButton].classList.add('active');
        }
    }

    async showSection(sectionId, updateSameHeader = true) {
        // Get latest state before showing section
        // const state = await getLatestState();

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

        // // Update UI with latest state
        // await updateUI(state);

        // Update header button states based on updateSameHeader parameter
        this.updateHeaderButtonStates(updateSameHeader ? sectionId : null);
    }

    async hideSection(sectionId) {
        // State needed for home page redirect on close if necessary
        // Get state first
        let state;
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getState' });
            state = response?.state;
        } catch (error) {
            console.warn('Error getting state:', error);
            state = {};
        }

        // Make all UI changes synchronously
        document.getElementById(`${sectionId}Section`)?.classList.remove('active');
        this.contentManager.classList.remove('active');

        if (state?.gameType && state.gameType !== 'Unknown') {
            this.mainContent.classList.add('active');
        } else {
            this.showSection('home', true);
        }

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

    // Initialize state first
    const initialState = await getLatestState();

    // Get view preference
    const viewPreference = await getViewPreference(initialState);
    initialState.viewPreference = viewPreference;

    // Initialize both home and links views with the initial state
    await Promise.all([
        updateGameCardsView(viewPreference, 'gameCardsContainer'),
        updateGameCardsView('condensed', 'linksGameCardsContainer')
    ]);

    // Menu functionality
    const kebabButton = document.getElementById('kebabButton');
    const modalMenu = document.getElementById('modalMenu');

    // Add menu item click handlers
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const sectionId = item.getAttribute('data-section');
            contentManager.showSection(sectionId, false);

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

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateState') {
            // Show appropriate content based on initial state
            if (request.state?.gameType && request.state.gameType !== 'Unknown') {
                contentManager.showMainContent();
            } else {
                contentManager.showSection('home', true);
            }
            updateUI(request.state || {});
        } else if (request.action === 'solveComplete') {
            // Only reset selected control if solving was successful
            if (request.success) {
                selectedControl = null;
                updateControlDescription(null);
                updateStartButton(request.state || {});
            }
            if (request.state?.gameType && request.state.gameType !== 'Unknown') {
                contentManager.showMainContent();
            } else {
                contentManager.showSection('home', true);
            }
            updateUI(request.state || {});
        }
    });

    // Show appropriate content based on initial state
    if (initialState?.gameType && initialState.gameType !== 'Unknown') {
        contentManager.showMainContent();
    } else {
        contentManager.showSection('home', true);
    }

    // Update UI with initial state
    await updateUI(initialState);

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
            try {
                await chrome.runtime.sendMessage({ action: 'updateApiKey', apiKey });
                showApiKeyStatus('API key saved', 'success');
            } catch (error) {
                showApiKeyStatus('Error saving API key', 'error');
            }
        } else {
            showApiKeyStatus('Enter valid API key', 'error');
        }
    });

    elements.deleteApiKey?.addEventListener('click', async () => {
        try {
            await chrome.runtime.sendMessage({ action: 'clearApiKey' });
            showApiKeyStatus('API key deleted', 'success');
        } catch (error) {
            showApiKeyStatus('Error deleting API key', 'error');
        }
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