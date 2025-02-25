# Raster to Vector Converter for LaserGRBL

A web application that converts raster images to vector format suitable for LaserGRBL.

## Features

- Drag and drop interface for easy image uploading
- Supports various raster image formats (PNG, JPG, GIF, BMP, etc.)
- Converts images to SVG or DXF vector formats
- Adjustable threshold for black and white conversion
- Multiple resolution options
- Real-time preview of the vector output
- Works entirely in the browser (no server-side processing)

## How to Use

1. Drag and drop an image or click to select a file
2. Adjust the threshold slider to control the black/white cutoff point
3. Select your desired resolution (higher = more detail but slower processing)
4. Choose between SVG or DXF output format
5. Click "Convert Image" to process
6. Review the preview and download the resulting vector file

## Technologies Used

- HTML5, CSS3, JavaScript
- Potrace algorithm for raster to vector conversion
- FileSaver.js for client-side file saving
- JSZip for handling compression

## Local Development

1. Clone this repository
2. Open `index.html` in your browser
3. That's it! No build steps required

## License

MIT

## Credits

- [Potrace](https://github.com/kilobtye/potrace) for the tracing algorithm
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) for client-side file saving
