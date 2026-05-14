import puppeteer from 'puppeteer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const LINE_NOTIFY_TOKEN = process.env.LINE_NOTIFY_TOKEN;
const TARGET_URL = process.env.TARGET_URL;

async function run() {
  if (!LINE_NOTIFY_TOKEN || !TARGET_URL) {
    console.error('Missing LINE_NOTIFY_TOKEN or TARGET_URL environment variables.');
    process.exit(1);
  }

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // Set a wide viewport for the dashboard
  await page.setViewport({ width: 1400, height: 900 });
  
  console.log(`Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
  
  // Wait explicitly for the loading state to finish and table to appear
  try {
    await page.waitForFunction(() => !document.body.innerText.includes('Loading dashboard data...'), { timeout: 15000 });
    // Additional wait to make sure rendering is complete
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    console.log('Timeout waiting for data to load, taking screenshot anyway.');
  }

  const screenshotPath = 'dashboard.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${screenshotPath}`);

  await browser.close();

  // Send to LINE Notify
  const form = new FormData();
  form.append('message', 'Daily Inventory Dashboard Report');
  form.append('imageFile', fs.createReadStream(screenshotPath));

  console.log('Sending to LINE group...');
  try {
    await axios.post('https://notify-api.line.me/api/notify', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${LINE_NOTIFY_TOKEN}`
      }
    });
    console.log('Successfully sent screenshot to LINE.');
  } catch (error) {
    console.error('Failed to send to LINE:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

run();
