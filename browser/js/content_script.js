// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        // Create mouse event
        const createMouseEvent = (type) => new MouseEvent(type, {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        });

        try {
            if (request.action === 'clickLoginButton') {
                const loginButton = document.querySelector('.pr-guest-streak__button');
                if (!loginButton) {
                    sendResponse({ success: false, error: 'Login button not found' });
                    return;
                }
                loginButton.dispatchEvent(createMouseEvent('click'));
                sendResponse({ success: true });

            }
            /*
                            // Can not any interaction to work when logged in to LinkedIn
                            else if (request.action === 'clickLogoutButton') {
                            const logoutMenu = document.querySelector('.global-nav__primary-link-me-menu-trigger');
                            if (!logoutMenu) {
                                sendResponse({ success: false, error: 'Logout menu not found' });
                                return;
                            }
                            logoutMenu.dispatchEvent(createMouseEvent('click'));
            
                            await new Promise(resolve => setTimeout(resolve, 100));
            
                            const logoutButton = document.querySelector('.global-nav__secondary-link.mv1');
                            if (!logoutButton) {
                                sendResponse({ success: false, error: 'Logout button not found' });
                                return;
                            }
                            logoutButton.dispatchEvent(createMouseEvent('click'));
                            sendResponse({ success: true });
                        }
            */

        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true; // Keep the message channel open
}); 