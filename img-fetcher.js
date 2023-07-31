#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const { Command } = require('commander');
const packageJson = require('./package.json');
const { resolve } = require('url');
const { basename } = require('path');
const { rejects } = require('assert');

/**
 * Helper for creating a download progress bar format.
 * @param {string} description - Description of progress bar.
*/
function createDownloadProgressBarFormat(description) {
  return function dataProgessBarFormatter(options, params, _payload) {
    // Sometimes we don't have access to the total
    const barProgress = Math.round(params.progress * options.barCompleteString.length);
    const bar = options.barCompleteString.substr(0, barProgress).padEnd(options.barCompleteString.length);
    if (params.total <= 0) {
      return `${description.substring(0, 50)} | ${bar} | ${params.value} bytes`;
    } else {
      return `${description.substring(0, 50)} | ${bar} | ${params.value}/${params.total} bytes`;
    }
  }
}

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

    // Create a progress bar for fetching the web page data
    const dataProgessBar = new cliProgress.SingleBar({
      hideCursor: true, forceRedraw: true,
      format: createDownloadProgressBarFormat('Downloading data')
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

    // Create progress bars for downloading the images
    let imageProgessBars = new cliProgress.MultiBar({},
      cliProgress.Presets.shades_classic
    );

    // Create promises for downloading images
    let downloadedSet = new Set();
    let downloadedCount = 0;
    let skippedCount = 0;
    let downloadTasks = images.map((imageUrl) => new Promise((resolve, reject) => {
      // If the limit is exceeded, then resolve this task
      if (downloadedCount + skippedCount >= limit) {
        resolve();
      }

      // Check if image URL is relative
      const absoluteImageUrl = imageUrl;
      if (!/^(?:[a-z]+:)?\/\//i.test(imageUrl)) {
        absoluteImageUrl = resolve(`${baseProtocol}//${baseHostname}${basePath}`, imageUrl);
      }

      // Create a name and path for to-be-downloaded image
      const { pathname } = new URL(absoluteImageUrl);
      const imageName = basename(pathname);
      const filePath = `${outputDirectory}/${imageName}`;

      // If we should skip, then resolve this task
      if (downloadedSet.has(imageName) || fs.existsSync(filePath)) {
        skippedCount++;
        resolve();
      // Otherwise, attempt to download this image
      } else {
        // Create a progress bar for downloading this image
        const paddedLength = 35;
        const imageNamePadded = imageName.length > paddedLength
          ? `${imageName.substring(0, paddedLength - 3)}...`
          : imageName.padEnd(paddedLength);
        const imageProgessBar = imageProgessBars.create(null, null, {}, {
          hideCursor: true, forceRedraw: true, stopOnComplete: true,
          format: createDownloadProgressBarFormat(`${imageNamePadded}`)
        });

        // Download this image
        imageProgessBar.start(0);
        downloadImage(absoluteImageUrl, filePath, (progressEvent) => {
            if (progressEvent.total) {
              imageProgessBar.setTotal(progressEvent.total);
            } else {
              imageProgessBar.setTotal(0);
            }
            imageProgessBar.update(progressEvent.loaded);
        }, () => {
          // If we succeed, then resolve this task
          downloadedSet.add(imageName);
          downloadedCount++;
          resolve();
        }, () => {
          // If we fail, then reject this task
          reject();
        });
      }
    }));

    // Run all our download tasks 
    imageProgessBars.log('Downloading images\n');
    Promise.all(downloadTasks).then(() => {
      imageProgessBars.stop();
      
      if (downloadedCount > 0) {
        console.log(`${downloadedCount} image${downloadedCount > 1 ? 's' : ''} were successfully downloaded.`);
      } else {
        console.log('No images were downloaded.');
      }
      if (skippedCount > 0) {
        console.log(`${skippedCount} image${skippedCount > 1 ? 's' : ''} were already downloaded (or appeared more than once).`);
      }
    });
  } catch (error) {
    console.error('Error occurred:', error.message);
  }
}

/**
 * Downloads an image from a URL and saves it to a file.
 * @param {string} imageUrl - The URL of the image to download.
 * @param {string} filePath - The path to save the downloaded image to.
.* @param {function} onProgress - Callback that provides download progress events
.* @param {function} onDone - Callback that should be called when an error occurs.
.* @param {function} onError - Callback that should be called when completed.
 */
async function downloadImage(imageUrl, filePath, onProgress, onDone, onError) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      onDownloadProgress: onProgress
    });
    fs.writeFileSync(filePath, Buffer.from(response.data));
    onDone();
  } catch (error) {
    console.error('Error occurred while downloading image:', error.message);
    onError();
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
