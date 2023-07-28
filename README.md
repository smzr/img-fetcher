# img-fetcher

<p><a href="https://www.npmjs.com/package/img-fetcher" target="_new"><img src="https://img.shields.io/npm/v/img-fetcher" alt="NPM Version"></a>
<a href="https://www.npmjs.com/package/img-fetcher" target="_new"><img src="https://img.shields.io/npm/dw/img-fetcher" alt="NPM Downloads"></a></p>


img-fetcher is a simple CLI tool that allows you to download images from a web page using a CSS selector.

## How to Use

### Prerequisites

- Node.js (>= 10.0.0)

### Installation

You can use the `npx` command to run the tool directly from the command line without installing it globally:

```bash
npx img-fetcher [options] <URL> <SELECTOR>
```

Alternatively, you can install the package globally using npm to use the img-fetcher command directly:

```bash
npm install -g img-fetcher
img-fetcher [options] <URL> <SELECTOR>
```

### Usage

To use img-fetcher, provide the URL of the web page you want to fetch images from and a CSS selector that targets the images you want to download. The downloaded images will be saved in the current directory or specified output directory.

#### Options:
`-o, --output <directory>`: Specify the output directory for downloaded images. If not provided, the default output directory will be the current working directory.

`-l, --limit <n>`: Set the maximum number of images to download. When specified, the tool will stop downloading images once the specified limit is reached.

```bash
img-fetcher [options] <URL> <SELECTOR>
```

Replace `<URL>` with the URL of the web page and `<SELECTOR>` with the CSS selector. For example:

```bash
img-fetcher -o images https://example.com/ 'img'
```

The above command will download images from `https://example.com/` using the `img` selector and save them in the `images` directory.

## Contributing
If you find any issues with the tool or want to contribute, feel free to open an issue or submit a pull request on GitHub. 

## License

MIT License © 2023 [Sammy McKay](https://github.com/smzr)