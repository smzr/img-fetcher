#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const { Command } = require('commander');
const packageJson = require('./package.json');
const { resolve } = require('url');
const { basename } = require('path');

/**
 * Downloads images from a web page based on a CSS selector.
 * @param {string} url - The URL of the web page to download images from.
 * @param {string} selector - The CSS selector to use to find images on the web page.
 * @param {string} outputDirectory - The directory to save downloaded images to.
 * @param {number} limit - The maximum number of images to download.
 */
async function downloadImagesFromWebPage(url, selector, outputDirectory, limit) {
  try {
    const baseImageUrl = new URL(url);
    const baseProtocol = baseImageUrl.protocol;
    const baseHostname = baseImageUrl.hostname;
    const basePath = baseImageUrl.pathname.replace(/\/[^/]*$/, '');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
      console.log(`Created output directory: ${outputDirectory}`);
    }

    /**
     * Formats the progress bar for data fetching.
     * @param {object} options - The options for the progress bar.
     * @param {object} params - The parameters for the progress bar.
     * @param {object} _payload - The payload for the progress bar.
     * @returns {string} - The formatted progress bar string.
     */
    function dataProgessBarFormatter(options, params, _payload) {
      const bar = options.barCompleteString.substr(0, Math.round(params.progress * options.barsize));

      // Sometimes we don't have access to the total
      if (params.total <= 0) {
        return `Fetching data | ${bar} | ${params.value}`;
      } else {
        return `Fetching data | ${bar} | ${params.value}/${params.total}`;
      }
    }

    // Create progress bar for data fetching
    const dataProgessBar = new cliProgress.SingleBar({
      clearOnComplete: false,
      hideCursor: true,
      forceRedraw: true,
      format: dataProgessBarFormatter
    }, cliProgress.Presets.shades_classic);

    // Fetch data from web page
    dataProgessBar.start(0);
    const response = await axios.get(url, {
      onDownloadProgress: progressEvent => {
        if (progressEvent.total) {
          dataProgessBar.setTotal(progressEvent.total);
        } else {
          dataProgessBar.setTotal(0);
        }
        dataProgessBar.update(progressEvent.loaded);
      }
    });
    dataProgessBar.stop();

    // Load data into cheerio
    const html = response.data;
    const $ = cheerio.load(html);

    // Find images on web page using CSS selector
    const images = [];
    $(selector).each((_index, element) => {
      const src = $(element).attr('src');
      if (src) images.push(src);
    });

    // Download images using fs
    const downloadedSet = new Set();
    let downloadedCount = 0;
    let skippedCount = 0;
    const imageProgessBar = new cliProgress.SingleBar({
      clearOnComplete: false,
      hideCursor: true,
      forceRedraw: true,
      format: 'Downloading images | {bar} | {imageName} | {value}/{total}',
    }, cliProgress.Presets.shades_classic);

    if (images.length > 0) {
      imageProgessBar.start(Math.min(limit, images.length));
      for (const imageUrl of images) {
        // Check if we've exceeded the limit
        if (downloadedCount + skippedCount >= limit) {
          break;
        }

        let absoluteImageUrl = imageUrl;

        // Check if image URL is relative
        if (isRelativeURL(imageUrl)) {
          absoluteImageUrl = new URL(imageUrl, baseImageUrl).href;
        }

        const { pathname } = new URL(absoluteImageUrl);
        const imageName = basename(pathname);

        if (!downloadedSet.has(imageName)) {
          const filePath = `${outputDirectory}/${imageName}`;

          if (fs.existsSync(filePath)) {
            imageProgessBar.increment({imageName: `Skipping ${imageName} (Already downloaded)`});
            skippedCount++;
          } else {
            imageProgessBar.increment({imageName: `Downloading ${imageName}`});
            await downloadImage(absoluteImageUrl, filePath);
            downloadedSet.add(imageName);
            downloadedCount++;
          }
        } else {
          imageProgessBar.increment({imageName: `Skipping ${imageName} (Already downloaded)`});
          skippedCount++;
        }
      }
      imageProgessBar.stop();
    }

    // Log results
    if (downloadedCount > 0) {
      console.log(`${downloadedCount} image${downloadedCount > 1 ? 's' : ''} were successfully downloaded.`);
    } else {
      console.log('No images were downloaded.');
    }
    if (skippedCount > 0) {
      console.log(`${skippedCount} image${skippedCount > 1 ? 's' : ''} were already downloaded (or appeared more than once).`);
    }
  } catch (error) {
    console.error('Error occurred:', error.message);
  }
}

/**
 * Checks if a URL is relative.
 * @param {string} url - The URL to check.
 * @returns {boolean} - True if the URL is relative, false otherwise.
 */
function isRelativeURL(url) {
  try {
    const parsedURL = new URL(url);
    return !parsedURL.protocol; // Returns true for relative URLs (no protocol)
  } catch (error) {
    // If parsing the URL throws an error, it is likely a relative URL
    return true;
  }
}

/**
 * Downloads an image from a URL and saves it to a file.
 * @param {string} imageUrl - The URL of the image to download.
 * @param {string} filePath - The path to save the downloaded image to.
 */
async function downloadImage(imageUrl, filePath) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(filePath, Buffer.from(response.data));
  } catch (error) {
    console.error('Error occurred while downloading image:', error.message);
  }
}

const program = new Command();
program.version(packageJson.version);

program
  .option('-o, --output <directory>', 'Specify the output directory for downloaded images', process.cwd())
  .option('-l, --limit <n>', 'Set the maximum number of images to download', Math.floor, 100)
  .arguments('<url> <selector>')
  .action((url, selector) => {
    const options = program.opts();
    downloadImagesFromWebPage(url, selector, options.output, options.limit);
  })
  .parse(process.argv);
