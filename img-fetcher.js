#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { Command } = require('commander');
const packageJson = require('./package.json');
const { resolve } = require('url');
const { basename } = require('path');

const program = new Command();
program.version(packageJson.version);

program
  .option('-o, --output <directory>', 'Specify the output directory for downloaded images', process.cwd())
  .option('-l, --limit <n>', 'Set the maximum number of images to download', parseInt)
  .arguments('<url> <selector>')
  .action((url, selector) => {
    const options = program.opts();
    downloadImagesFromWebPage(url, selector, options.output, options.limit);
  })
  .parse(process.argv);

async function downloadImagesFromWebPage(url, selector, outputDirectory, limit) {
  try {
    const baseImageUrl = new URL(url);
    const baseProtocol = baseImageUrl.protocol;
    const baseHostname = baseImageUrl.hostname;
    const basePath = baseImageUrl.pathname.replace(/\/[^/]*$/, '');

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
      console.log(`Created output directory: ${outputDirectory}`);
    }

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
      let absoluteImageUrl = imageUrl;

      // check if image url is relative
      if ( !/^(?:[a-z]+:)?\/\//i.test(imageUrl) ) {
        absoluteImageUrl = resolve(`${baseProtocol}//${baseHostname}${basePath}`, imageUrl);
      }

      const { pathname } = new URL(absoluteImageUrl);
      const imageName = basename(pathname);

      if (!downloadedSet.has(imageName)) {
        if (limit && downloadedCount >= limit) {
          break;
        }

        const filePath = `${outputDirectory}/${imageName}`;
        if (fs.existsSync(filePath)) {
          console.log(`Skipping download: ${imageName} (Already downloaded)`);
        } else {
          await downloadImage(absoluteImageUrl, filePath);
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

async function downloadImage(imageUrl, filePath) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(filePath, Buffer.from(response.data));
    console.log(`Downloaded: ${filePath}`);
  } catch (error) {
    console.error('Error occurred while downloading image:', error.message);
  }
}
