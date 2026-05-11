const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const SITE_URL = process.env.SITE_URL;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_GROUP_ID = process.env.LINE_GROUP_ID;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

async function runReport() {
  if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_GROUP_ID) {
    console.error('Error: Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_GROUP_ID');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(SITE_URL, { waitUntil: 'networkidle2' });
    
    // Wait for data to load
    await new Promise(r => setTimeout(r, 5000)); 

    const screenshotPath = 'report.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Upload to ImgBB
    const formData = new FormData();
    formData.append('image', fs.createReadStream(screenshotPath));
    const imgbbRes = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData, {
      headers: formData.getHeaders()
    });
    
    const imageUrl = imgbbRes.data.data.url;

    // Send to LINE Group
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: LINE_GROUP_ID,
      messages: [{ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      }
    });
    console.log('Success! Report sent to LINE.');
  } catch (error) {
    console.error('Action failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runReport();
