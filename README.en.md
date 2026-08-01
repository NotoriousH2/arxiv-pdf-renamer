# ArXiv PDF Renamer

> [한국어 버전](README.md)

When downloading papers from ArXiv, files are saved with their ID as the filename (e.g., `2301.07041.pdf`). This Chrome extension lets you save PDFs with the paper's **actual title** as the filename.

![Usage Example](example.png)

## Features

- **Filename templates**: Combine title, authors, date, ArXiv ID, and category
- **Quick downloads**: Use page/link context menus or `Alt+Shift+D`
- **Batch downloads**: Select and download up to 50 papers from listing pages
- **Reliable metadata**: Fall back to the official ArXiv API automatically
- **Version and history management**: Choose current/latest versions and duplicate behavior
- **Remembered folder**: Save directly to a user-approved directory
- Supports modern format (`2301.07041`) and legacy format (`hep-th/9901001`)
- Stores preferences and metadata cache locally in the browser

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/NotoriousH2/arxiv-pdf-renamer.git
   ```
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the cloned folder.

## Usage

1. Navigate to an ArXiv paper page (abs or pdf).
2. Click the ArXiv PDF Renamer icon in the browser toolbar.
3. The paper title is automatically displayed.
4. Choose the PDF version, duplicate behavior, save location, and filename format.
5. Click **Download PDF**.

Custom templates support `{title}`, `{firstAuthor}`, `{authors}`, `{year}`,
`{year2}`, `{month}`, `{arxivId}`, and `{category}`. Configure a fixed save
folder with **Choose Folder** in the extension settings. On a page containing
multiple ArXiv links, open the extension to select papers for a batch download.

## Development and Testing

No build step is required. Run `npm test` for unit tests and `npm run check`
for JavaScript syntax validation.

## Supported URL Formats

| Format | Example |
|--------|---------|
| Modern abs | `arxiv.org/abs/2301.07041` |
| Modern pdf | `arxiv.org/pdf/2301.07041` |
| PDF extension | `arxiv.org/pdf/2301.07041.pdf` |
| With version | `arxiv.org/pdf/2301.07041v2` |
| Legacy | `arxiv.org/abs/hep-th/9901001` |

## License

[MIT](LICENSE)
