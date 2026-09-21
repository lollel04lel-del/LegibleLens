chrome.action.onClicked.addListener(tab => {
  chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 92 }, async dataUrl => {
    const captureError = chrome.runtime.lastError;
    if (!captureError && dataUrl) {
      await chrome.storage.local.set({
        pendingCapture: {
          dataUrl,
          sourceUrl: tab.url || '',
          capturedAt: Date.now()
        }
      });
      await chrome.tabs.create({ url: chrome.runtime.getURL('index.html?capture=1') });
      return;
    }
    await chrome.tabs.create({ url: chrome.runtime.getURL('index.html?capture=error') });
  });
});
