#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

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

    const imageUrls = images.join('\n');
    fs.writeFileSync('images.txt', imageUrls);

    // Using wget to download the images
    execSync('wget -i images.txt', { stdio: 'inherit' });

    console.log('Images downloaded successfully!');
  } catch (error) {
    console.error('Error occurred:', error.message);
  }
}

if (!url || !selector) {
  console.error('Please provide the URL and selector as command line arguments.');
  process.exit(1);
}

downloadImagesFromWebPage(url, selector);
