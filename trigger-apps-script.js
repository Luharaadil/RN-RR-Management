// ==========================================
// GOOGLE APPS SCRIPT FOR TRIGGERING SCREENSHOT
// ==========================================

// 1. SET YOUR DESIRED LOCAL TIME HERE (24-hour format)
const TARGET_HOUR = 8;   // 8 AM
const TARGET_MINUTE = 45;  // 45 minutes

function triggerGitHubAction() {
  // Replace with your new tokens and details
  const githubToken = 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN';
  const repoOwner = 'YOUR_GITHUB_USERNAME'; // e.g. 'Luharaadil'
  const repoName = 'YOUR_NEW_REPOSITORY_NAME'; // The repository where you exported this React app
  
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`;

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + githubToken,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Google-Apps-Script'
    },
    // The "send_screenshot" type matches the "repository_dispatch" type in the .github/workflows/send_screenshot.yml file
    payload: JSON.stringify({ event_type: 'send_screenshot' }),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log('Response Code: ' + response.getResponseCode());
    Logger.log('Response Text: ' + response.getContentText());
  } catch(e) {
    Logger.log('Error triggering GitHub Action: ' + e);
  }

  // Schedule the next day's run
  scheduleNextRun();
}

function scheduleNextRun() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'triggerGitHubAction') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  const now = new Date();
  let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TARGET_HOUR, TARGET_MINUTE, 0);

  if (now > targetDate) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  ScriptApp.newTrigger('triggerGitHubAction')
    .timeBased()
    .at(targetDate)
    .create();
    
  Logger.log('Scheduled next run for: ' + targetDate.toString());
}

function firstTimeSetup() {
  scheduleNextRun();
}
