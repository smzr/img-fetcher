#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const [, , url, selector] = process.argv;

async function downloadImagesFromWebPage(url, selector) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const images = [];
    $(selector).each((index, element) => {
      const src = $(element).attr('src');
      if (src) images.push(src);
    });

    // Download images using fs
    const downloadedSet = new Set();
    let downloadedCount = 0;
    for (const imageUrl of images) {
      const imageName = imageUrl.split('/').pop();

      if (!downloadedSet.has(imageName)) {
        if (await downloadImage(imageUrl)) {
          downloadedSet.add(imageName);
          downloadedCount++;
        }
      }
    }

    if (downloadedCount > 0) {
      console.log(`Successfully downloaded ${downloadedCount} image${downloadedCount > 1 ? 's' : ''}.`);
    } else {
      console.log('No images were downloaded.');
    }
  } catch (error) {
    console.error('Error occurred:', error.message);
  }
}

async function downloadImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageName = imageUrl.split('/').pop();

    if (fs.existsSync(imageName)) {
      console.log(`Skipping download: ${imageName} (Already downloaded)`);
      return false;
    }
    
    fs.writeFileSync(imageName, Buffer.from(response.data));
    console.log(`Downloaded: ${imageName}`);
    return true;
  } catch (error) {
    console.error('Error occurred while downloading image:', error.message);
    return false;
  }
}

if (!url || !selector) {
  console.error('Please provide the URL and selector as command line arguments.');
  process.exit(1);
}

downloadImagesFromWebPage(url, selector);
