let id = null;
const connections = {};

chrome.runtime.onConnect.addListener(devToolsConnection => {
    // Assign the listener function to a variable so we can remove it later
    let devToolsListener = (message, sender, sendResponse) => {
        if (message.name == "init") {
            id = message.tabId;
            connections[id] = devToolsConnection;
            // Send a message back to DevTools
            connections[id].postMessage("Connected!");
        }
    };

    // Listen to messages sent from the DevTools page
    devToolsConnection.onMessage.addListener(devToolsListener);

    devToolsConnection.onDisconnect.addListener(() => {
        devToolsConnection.onMessage.removeListener(devToolsListener);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getActiveTab") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
                sendResponse({ url: tabs[0].url });
            } else {
                sendResponse({ url: null });
            }
        });
        return true; // Keep the messaging channel open for async response
    }
});
