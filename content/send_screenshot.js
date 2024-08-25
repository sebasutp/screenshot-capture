if (chrome.runtime) {
    console.log('plugin: Adding chrome message listener');
    // Add listener on component mount
    chrome.runtime.onMessage.addListener((msg) => {
        console.log("Plugin: Calling sendScreenshot");
        console.log(msg)
        // Send the values to the app by setting the urlInput and imgContent inputs
        const urlInput = document.getElementById('urlInput');
        console.log(urlInput);
        //const imgContent = document.getElementById('imgContent');
        //imgContent.value = msg.img;
        const screenshotImg = document.getElementById('screenshotImg');
        console.log(screenshotImg);
        urlInput.value = msg.url;
        screenshotImg.src = msg.img;
        // We trigger the change event manually for the app to react as if it was a user
        // const event1 = new Event('change');
        // const event2 = new Event('change');
        // imgContent.dispatchEvent(event1);
        // urlInput.dispatchEvent(event2);
    });
} else {
    console.log("Plugin: chrome.runtime not defined");
}