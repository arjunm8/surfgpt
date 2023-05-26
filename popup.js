async function updateUI(validationStatus) {
  const unActivatedContainer = document.getElementById("unActivatedContainer");
  const activatedContainer = document.querySelector(".container");
  var errorMessage = document.querySelector(".license-error-container");
  if(!errorMessage){
    errorMessage = document.createElement('div');
    errorMessage.classList.add("license-error-container");
  }

  if (validationStatus === "valid") {
    unActivatedContainer.style.display = "none";
    activatedContainer.style.display = "block";
    await initializeExtension();
  } else{
    activatedContainer.style.display = "none";
    unActivatedContainer.style.display = "block";
    if (validationStatus === "not_present") {
      errorMessage.innerHTML = `<p class="license-missing">Looks like you're yet to activate SurfGPT.<br>Please <a target='_blank' href='options.html'>click here</a> to go to options and enter a valid license key to activate it.<br></p>`
    } else if (validationStatus === "invalid") {
      errorMessage.innerHTML = `<p class="license-fail">Your license key seems to be invalid.<br>Please <a target='_blank' href='options.html'>click here</a> and enter a valid license key or contact support.</p>`
    } else {
      errorMessage.innerHTML = "<p class='license-warn'>There was an error verifying your license key.<br>Please check your network and <a id='retry-validation' href='#'>click here to retry</a>. Contact support if the problem persist.</p>"
      errorMessage.querySelector("#retry-validation").addEventListener("click", function() {
        errorMessage.innerHTML = "<p class='license-warn'>Revalidation attempted.<br>If this popup doesn't auto refresh in 5 seconds, please close and reopen it.</p>"
        chrome.runtime.sendMessage({type: 'revalidateKey'});
      });
    }
    unActivatedContainer.appendChild(errorMessage);
  }
}

/*
// Listen for changes in storage and update the UI if needed
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.validationStatus) {
    updateUI(changes.validationStatus.newValue);
  }
});
*/

async function initializeExtension() {
      // Your extension logic here

    document.getElementById("summary-tab-button").addEventListener("click", function() {
      openTab(event, "summary-tab");
    });

    document.getElementById("qa-tab-button").addEventListener("click", function() {
      openTab(event, "qa-tab");
    });

    function openTab(evt, tabName) {
      // Declare all variables
      var i, tabcontent, tablinks;

      // Get all elements with class="tabcontent" and hide them
      tabcontent = document.getElementsByClassName("tabcontent");
      for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
      }

      // Get all elements with class="tablinks" and remove the class "active"
      tablinks = document.getElementsByClassName("tablinks");
      for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
      }

      // Show the current tab, and add an "active" class to the button that opened the tab
      document.getElementById(tabName).style.display = "block";
      evt.currentTarget.className += " active";
    }


    async function getMaxParts() {
      return new Promise((resolve) => {
        chrome.storage.sync.get("maxParts", function (data) {
          resolve(data.maxParts ? data.maxParts : 2);
        });
      });
    }

    // Create loading spinner element
    var loadingSpinner = document.createElement('div');
    loadingSpinner.classList.add('loading-spinner');
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement('div');
      dot.classList.add('dot');
      loadingSpinner.appendChild(dot);
    }

    var MAX_PARTS = await getMaxParts();
    var waitTime = `This could take upto <strong>${MAX_PARTS * 20} seconds</strong> depending on the length of this page...`;


    // Add event listener to button or link
    document.getElementById('qa-button').addEventListener('click', function() {
      var buttonElement = document.getElementById('qa-button');
      var loaderElement = document.getElementById('qa-loader');
      var summaryElement = document.getElementById('qa-summary');
      var question = document.getElementById('question-input').value;
      if (!question){
        summaryElement.innerHTML = "Please type in a question before hitting submit.";
        return;
      }
      summaryElement.innerHTML = waitTime;
      loaderElement.appendChild(loadingSpinner); // add the loading spinner
      loadingSpinner.style.display = 'block'; // show the loading spinner

      // Send requestSummary message to background script
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.runtime.sendMessage({type: 'requestQA', tab: tabs[0].id, question: question});
      });
    });

    // Add event listener to button or link
    document.getElementById('summarize-button').addEventListener('click', function() {
      var buttonElement = document.getElementById('summarize-button');
      var loaderElement = document.getElementById('loader');
      var summaryElement = document.getElementById('summary');
      summaryElement.innerHTML = waitTime;
      buttonElement.style.display = 'none'; // hide the button
      loaderElement.appendChild(loadingSpinner); // add the loading spinner
      loadingSpinner.style.display = 'block'; // show the loading spinner


      // Send requestSummary message to background script
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.runtime.sendMessage({type: 'requestSummary', tab: tabs[0].id});
      });
    });

    // Check if summary is stored in local storage and display it
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var url = tabs[0].url;
      var storedSummary = localStorage.getItem("sum-"+url);
      if (storedSummary) {
        var summaryElement = document.getElementById('summary');
        summaryElement.innerHTML = summaryElement.innerHTML = marked.parse(storedSummary);
      }

      var storedQA = localStorage.getItem("qa-"+url);
      if (storedQA) {
        var summaryElement = document.getElementById('qa-summary');
        var questionInput = document.getElementById('question-input');
        qa = JSON.parse(storedQA)
        questionInput.value = qa.question
        summaryElement.innerHTML = marked.parse(qa.answer);
      }
    });


  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Message received in popup.js:', request);
    if (request.type === 'showSummary') {
      var summary = request.summary;
      var summaryElement = document.getElementById('summary');
      var buttonElement = document.getElementById('summarize-button');
      var loadingSpinner = document.querySelector('.loading-spinner');
      if(loadingSpinner){
        loadingSpinner.style.display = 'none'; // hide the loading spinner
      }
      summaryElement.innerHTML = marked.parse(summary);

      buttonElement.style.display = 'inline-block'; // show the button

      // Store summary in local storage with URL as key
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var url = tabs[0].url;
        localStorage.setItem("sum-"+url, summary);
      });

    } else if (request.type === 'showQA') {
        var summary = request.summary;
        var summaryElement = document.getElementById('qa-summary');
        var loadingSpinner = document.querySelector('.loading-spinner');
        if(loadingSpinner){
          loadingSpinner.style.display = 'none'; // hide the loading spinner
        }
        summaryElement.innerHTML = marked.parse(summary);
        // Store in local storage with URL as key
        question = document.getElementById('question-input').value
        if(question){
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            var url = tabs[0].url;
            localStorage.setItem("qa-"+url, JSON.stringify({
              question: question,
              answer: summary
            }));
          });
        }

    } else if (request.type === 'error') {
      console.log('Error: ' + request.message);
    } else {
      console.log('Unexpected request received:', request);
    }
  });
}

document.addEventListener('DOMContentLoaded', async function() {
  console.log('Popup DOMContentLoaded event has fired.');
  updateUI("valid");
  /*
  chrome.storage.sync.get("validationStatus", (data) => {
    updateUI(data.validationStatus);
  });*/
});
