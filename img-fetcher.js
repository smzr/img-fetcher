#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const cliProgress = require('cli-progress');
const { Command } = require('commander');
const packageJson = require('./package.json');
const { resolve } = require('url');
const { basename } = require('path');

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

    // Download data using axios
    function dataProgessBarFormatter(options, params, _payload) {
      const bar = options.barCompleteString.substr(0, Math.round(params.progress * options.barsize));
      // Sometimes we don't have access to the total
      if (params.total <= 0) {
        return `Fetching data | ${bar} | ${params.value}`;
      } else {
        return `Fetching data | ${bar} | ${params.value}/${params.total}`;
      }
    }
    const dataProgessBar = new cliProgress.SingleBar({
      clearOnComplete: false,
      hideCursor: true,
      forceRedraw: true,
      format: dataProgessBarFormatter
    }, cliProgress.Presets.shades_classic);
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
    const html = response.data;
    const $ = cheerio.load(html);

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
        // Check if weve exceeded the limit
        if (downloadedCount + skippedCount >= limit) {
          break;
        }

        let absoluteImageUrl = imageUrl;

        // check if image url is relative
        if ( !/^(?:[a-z]+:)?\/\//i.test(imageUrl) ) {
          absoluteImageUrl = resolve(`${baseProtocol}//${baseHostname}${basePath}`, imageUrl);
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

async function downloadImage(imageUrl, filePath) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(filePath, Buffer.from(response.data));
  } catch (error) {
    console.error('Error occurred while downloading image:', error.message);
  }
}
