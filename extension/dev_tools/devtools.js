// Create a custom sidebar in the Elements panel
chrome.devtools.panels.elements.createSidebarPane("My Crawler", (sidebar) => {
    // Set the HTML page for the sidebar
    sidebar.setPage("dev_tools/panel.html");
});