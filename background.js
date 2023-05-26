/* //License key verification
async function setValidationStatus(status) {
  chrome.storage.sync.set({ validationStatus: status });
}

async function validateLicenseKey() {
  chrome.storage.sync.get("licenseKey", async (data) => {
    const licenseKey = data.licenseKey;
    if (licenseKey) {
      try {
        const response = await fetch(
          "https://api.gumroad.com/v2/licenses/verify",
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              product_id: "<REDACTED>",
              license_key: licenseKey,
              increment_uses_count: false,
            }),
          }
        );

        const responseData = await response.json();
        if (
          responseData.success
          && responseData.purchase.refunded === false
          && responseData.purchase.chargebacked === false
          //&& responseData.purchase.test === false
        ) {
          setValidationStatus("valid");
        } else {
          setValidationStatus("invalid");
        }
      } catch (err) {
        setValidationStatus("validation_error");
        console.log(err.message);
      }
    } else {
      console.log("No license key found.");
      setValidationStatus("not_present");
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
  validateLicenseKey();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Browser started.");
  validateLicenseKey();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.licenseKey) {
    console.log("License key changed.");
    validateLicenseKey();
  }
});
*/
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Received message', request, 'from sender', sender);
  if (request.type === 'requestSummary') {
    console.log('Received request to summarize page content', sender);
    extractPageContent(request.tab).then((result) => {
      if(result.status == 200){
        getSummary(result.content).then((summary) => {
            chrome.runtime.sendMessage({ type: 'showSummary', summary: summary });
        });
      }else{
        chrome.runtime.sendMessage({ type: 'showSummary', summary: result.content });
      }
    });
    return true;
  } else if (request.type === 'requestQA') {
    console.log('Received request for QA on page content', sender);
    extractPageContent(request.tab).then((result) => {
      if(result.status == 200){
        getQA(result.content,request.question).then((summary) => {
            chrome.runtime.sendMessage({ type: 'showQA', summary: summary });
        });
      }else{
        chrome.runtime.sendMessage({ type: 'showQA', summary: result.content });
      }
    });
    return true;
  }/* else if (request.type === 'revalidateKey'){ //ignore license checks
    validateLicenseKey()
  }*/
});

async function extractPageContent(tabId) {
  try{
    console.log('Extracting page content for tab', tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Recursive function to extract visible and copyable text content
        function extractVisibleTextContent(el) {
        if (el.nodeType === Node.TEXT_NODE) {
          return el.textContent.trim();
        } else if (el.nodeType === Node.ELEMENT_NODE && el.getAttribute('contenteditable') !== 'true') {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            let text = '';
            Array.from(el.childNodes).forEach(child => {
              if (child.nodeType === Node.ELEMENT_NODE && (child.tagName.toLowerCase() === 'script' || child.tagName.toLowerCase() === 'style' || child.tagName.toLowerCase() === 'link' || child.tagName.toLowerCase() === 'noscript' || child.tagName.toLowerCase() === 'iframe')) {
                // ignore script, style, link, noscript, and iframe tags
              } else {
                text += (text.charAt(text.length - 1) !="\n")? "\n"+extractVisibleTextContent(child).trim():extractVisibleTextContent(child).trim();
              }
            });
            return text;
          }
        }
        return '';
      }

      // Extract visible text content from the body element
      const visibleContent = extractVisibleTextContent(document.body);
      return visibleContent.trim();

      }
    });
    if(result[0].result){
      return {
        status : 200,
        content : result[0].result
      };
    } else{
      return {
        status : 404,
        content : "No page content found"
      }
    }
  }catch (error) {
    return {
      status : 500,
      content : "Extracting page content failed: "+error.message
    };
   }
}

async function divideContent(content) {
  const MAX_CHARS = 3000*4;
  if (content.length <= (MAX_CHARS)) { //token limit per call (excluding response) x ~chars per token
      return [content];
    }

    const parts = [];
    const numParts = Math.ceil(content.length / (MAX_CHARS));
    const partLength = Math.ceil(content.length / numParts);

    for (let i = 0; i < content.length; i += partLength) {
      parts.push(content.substring(i, i + partLength));
    }

  return parts;
}


async function getSummary(content) {
  const MAX_PARTS = await getMaxParts();
  console.log('Requesting summary');
  if (!content) {
    console.log("No content found");
    return;
  }

  const contentParts = await divideContent(content);
  console.log(contentParts);
  let summary = '';

  const openaiApiKey = await getOpenaiApiKey();
  if (!openaiApiKey) {
    return "Your OpenAI key is missing, update it by <a target='_blank' href='options.html'>clicking here</a> or follow the steps below:\n\n1. Right click on this extension's icon.\n2. Click on options.\n3. Add your key.\n4. Save."
  }

  try {
    for (let i = 0; i < ((contentParts.length <= MAX_PARTS)?contentParts.length: MAX_PARTS); i++) {
      const response = await requestOpenaiCompletion(
      [
        {
          role: "user",
          content: "As an AI language model, your job is to create detailed bullet lists from scraped web content. For tutorials/guides, summarize the steps and include specific measurements, specifications, and steps. For articles/wikis, you must cover significant facts. For conversations like email/reddit/twitter/etc threads, you must capture summarize the dialog exchange."
        },{
          role: "assistant",
          content: "As an AI language model, I am committed to providing detailed bullet lists with accurate and complete information from various sources: focusing on specific measurements, specifications, and steps for tutorials and guides; significant facts for articles and wikis; and the summarize the dialog exchange for conversations like email/reddit/twitter/etc threads."
        },{
          role: "user",
          content:`Here's the page content:\n${contentParts[i]}`,
        }
      ],
        openaiApiKey
      );
      summary += "**Section "+(i+1)+":**\n\n"+response.choices[0].message.content.trim()+"\n\n";
    }
    return summary.trim();
  } catch (error) {
    return "Request to ChatGPT failed: " + error.message;
  }
}

async function getQA(content, question) {
  const MAX_PARTS = await getMaxParts();

  console.log('Requesting answer');
  if (!content) {
    console.log("No content received");
    return;
  }else if (!question){
    console.log("No question received");
    return
  }

  const contentParts = await divideContent(content);
  console.log(contentParts);
  let summary = '';

  const openaiApiKey = await getOpenaiApiKey();
  if (!openaiApiKey) {
    return "Your OpenAI key is missing, update it by <a target='_blank' href='options.html'>clicking here</a> or follow the steps below:\n\n1. Right click on this extension's icon.\n2. Click on options.\n3. Add your key.\n4. Save."
  }

  try {
    for (let i = 0; i < ((contentParts.length <= MAX_PARTS)?contentParts.length: MAX_PARTS); i++) {
      const response = await requestOpenaiCompletion(
        [
          {
            role: "user",
            content: "As an AI language model, your job is to provide answer questions by analyzing scraped webpage content. For tutorials/guides, analyze the steps, specific measurements, specifications, and steps. For articles/wikis, analyze significant facts. For conversations like email/reddit/twitter/etc threads, analyze the dialog exchange."
          },{
            role: "assistant",
            content: "As an AI language model, I am committed to providing detailed answers by analyzing scraping webpage content: focusing on specific measurements, specifications, and steps for tutorials and guides; significant facts for articles and wikis; and the dialog exchange for conversations like email/reddit/twitter/etc threads."
          },{
            role: "user",
            content: `question:"${question}"\nWebpage content:\n${contentParts[i]}`
          }
        ],
        openaiApiKey
      );
      summary += "**Answer as per Section "+(i+1)+":**\n\n"+response.choices[0].message.content.trim()+"\n\n";
    }
    return summary.trim();
  } catch (error) {
    return "Request to ChatGPT failed: " + error.message;
  }
}

async function requestOpenaiCompletion(prompt, apiKey) {
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: prompt,
      max_tokens: 500
    })
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", requestOptions);

  if (!response.ok) {
    let errorMessage;

    switch (response.status) {
      case 400:
        errorMessage = "Invalid request, please contact support";
        break;
      case 401:
        errorMessage = "Authentication failed.\n\nDid you enter the right OpenAI API key in the <a target='_blank' href='options.html'>options page</a>?\n\nRight click on the SurfGPT icon and select 'options' to check.";
        break;
      case 403:
        errorMessage = "Access denied";
        break;
      case 404:
        errorMessage = "Endpoint not found";
        break;
      case 429:
        errorMessage = 'Usage limit exceeded.\nCheck your usage on the <a target="_blank" href="https://platform.openai.com/account/billing/overview">OpenAI Billing Page</a>.\n\nNote: If you\'re using free credits then the billing page will also show you when they expire.';
        break;
      case 500:
        errorMessage = "Internal server error";
        break;
      default:
        errorMessage = "status " + response.status;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

async function getMaxParts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("maxParts", function (data) {
      resolve(data.maxParts?data.maxParts:2);
    });
  });
}

async function getOpenaiApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("apiKey", function (data) {
      resolve(data.apiKey);
    });
  });
}
