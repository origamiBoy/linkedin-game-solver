// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clickLoginButton') {
        const loginButton = document.querySelector('.pr-guest-streak__button');
        if (loginButton) {
            // Create and dispatch mouse events for more reliable click simulation
            const createMouseEvent = (type) => new MouseEvent(type, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            });

            loginButton.dispatchEvent(createMouseEvent('click'));

            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Login button not found' });
        }
    }
    return true; // Keep the message channel open for async response
}); 