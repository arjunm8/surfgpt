document.addEventListener('DOMContentLoaded', function() {
  var maxPartsInput = document.getElementById('maxParts');
  //var licenseKeyInput = document.getElementById('licenseKey');
  var apiKeyInput = document.getElementById('apiKey');
  chrome.storage.sync.get(['maxParts'], function(data) {
    if (data.maxParts) {
      maxPartsInput.value = data.maxParts;
    }else{
      maxPartsInput.value = 2;
    }
  });
  chrome.storage.sync.get(['apiKey'], function(data) {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
  });
  /*
  chrome.storage.sync.get(['licenseKey'], function(data) {
    if (data.licenseKey) {
      licenseKeyInput.value = data.licenseKey;
    }
  });
  */
  document.querySelector('form').addEventListener('submit', function(e) {
    e.preventDefault();
    var apiKey = apiKeyInput.value.trim();
    //var licenseKey = licenseKeyInput.value.trim();
    var maxParts = maxPartsInput.value;
    if (apiKey
      //&& licenseKey
      && maxParts
    ) {
      chrome.storage.sync.set({
        apiKey: apiKey,
        //licenseKey: licenseKey,
        maxParts: maxParts
      }, function() {
        alert('Settings Saved!');
      });
    } else {
      alert('Please fill in all fields!');
    }
  });

});
