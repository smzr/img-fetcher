# img-fetcher

![npm](https://img.shields.io/npm/v/img-fetcher)
![npm](https://img.shields.io/npm/dw/img-fetcher)

img-fetcher is a simple CLI tool that allows you to download images from a web page using a CSS selector.

## How to Use

### Prerequisites

- Node.js (>= 10.0.0)

### Installation

You can use the `npx` command to run the tool directly from the command line without installing it globally:

```bash
npx img-fetcher <URL> <SELECTOR>
```

Alternatively, you can install the package globally using npm to use the img-fetcher command directly:

```bash
npm install -g img-fetcher
img-fetcher <URL> <SELECTOR>
```

### Usage

To use img-fetcher, provide the URL of the web page you want to fetch images from and a CSS selector that targets the images you want to download. The downloaded images will be saved in the current directory.

```bash
img-fetcher <URL> <SELECTOR>
```

Replace `<URL>` with the URL of the web page and `<SELECTOR>` with the CSS selector. For example:

```bash
img-fetcher https://example.com/ 'img'
```

## Contributing
If you find any issues with the tool or want to contribute, feel free to open an issue or submit a pull request on GitHub. 

## License

MIT License © 2023 [Sammy McKay](https://github.com/smzr)