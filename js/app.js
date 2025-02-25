document.addEventListener('DOMContentLoaded', function () {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const thresholdSlider = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');
    const previewSection = document.querySelector('.preview-section');
    const originalPreview = document.getElementById('originalPreview');
    const vectorPreview = document.getElementById('vectorPreview');
    const processingOverlay = document.getElementById('processingOverlay');

    let currentFile = null;
    let vectorOutput = null;

    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('active');
    }

    function unhighlight() {
        dropArea.classList.remove('active');
    }

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0 && files.type.match('image.*')) {
            handleFile(files);
        }
    }

    // File input handler
    fileInput.addEventListener('change', function () {
        if (this.files.length > 0) {
            handleFile(this.files);
        }
    });

    // Click on drop area should trigger file input
    dropArea.addEventListener('click', function () {
        fileInput.click();
    });

    // Handle the file selection
    function handleFile(file) {
        currentFile = file;
        convertBtn.disabled = false;
        console.log(files.type)

        // Show preview of the original image
        const reader = new FileReader();
        reader.onload = function (e) {
            originalPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Update threshold value display
    thresholdSlider.addEventListener('input', function () {
        thresholdValue.textContent = this.value;
    });

    // Convert button click handler
    convertBtn.addEventListener('click', function () {
        if (!currentFile) return;

        processingOverlay.style.display = 'flex';

        const threshold = parseInt(thresholdSlider.value);
        const resolutionScale = parseInt(document.getElementById('resolution').value);
        const outputFormat = document.querySelector('input[name="outputFormat"]:checked').value;

        // Use setTimeout to allow the UI to update before starting the intensive processing
        setTimeout(() => {
            convertImageToVector(currentFile, threshold, resolutionScale, outputFormat)
              .then(result => {
                    vectorOutput = result;

                    // Display the result
                    previewSection.style.display = 'block';

                    if (outputFormat === 'svg') {
                        vectorPreview.innerHTML = result;
                    } else {
                        // For DXF, show a placeholder message
                        vectorPreview.innerHTML = '<div style="padding: 20px; background: #f8f9fa; border: 1px dashed #ccc;">' +
                            '<p>DXF preview not available. Please download the file to view it in a compatible application.</p></div>';
                    }

                    processingOverlay.style.display = 'none';
                })
              .catch(error => {
                    console.error('Conversion error:', error);
                    alert('Error converting image: ' + error.message);
                    processingOverlay.style.display = 'none';
                });
        }, 50);
    });

    // Download button click handler
    downloadBtn.addEventListener('click', function () {
        if (!vectorOutput) return;

        const outputFormat = document.querySelector('input[name="outputFormat"]:checked').value;
        const fileName = `converted.${outputFormat}`;

        // Function to trigger download with Blob and FileSaver.js
        function downloadBlob(blob, fileName) {
            saveAs(blob, fileName);
        }

        if (outputFormat === 'svg') {
            const blob = new Blob([vectorOutput], { type: 'image/svg+xml' });
            downloadBlob(blob, fileName);
        } else {
            const blob = new Blob([vectorOutput], { type: 'application/dxf' });
            downloadBlob(blob, fileName);
        }
    });

    // Function to convert image to vector
    async function convertImageToVector(file, threshold, resolutionScale, outputFormat) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function () {
                // Create canvas to process the image
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Scale down the image if it's very large
                let width = img.width;
                let height = img.height;

                // Apply resolution scaling
                width = Math.floor(width / resolutionScale);
                height = Math.floor(height / resolutionScale);

                canvas.width = width;
                canvas.height = height;

                // Draw and process the image
                ctx.drawImage(img, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);

                // Apply threshold to create a binary image
                const binaryData = new Uint8Array(width * height);

                for (let i = 0; i < imageData.data.length; i += 4) {
                    // Convert to grayscale
                    const r = imageData.data[i];
                    const g = imageData.data[i + 1];
                    const b = imageData.data[i + 2];
                    const gray = 0.3 * r + 0.59 * g + 0.11 * b;

                    // Apply threshold
                    const pixel = Math.floor(i / 4);
                    binaryData[pixel] = gray < threshold? 1: 0;
                }

                try {
                    // Use Potrace to convert to vector
                    const traceResult = Potrace.trace(binaryData, {
                        width: width,
                        height: height,
                        turdsize: 2,
                        optcurve: true,
                        alphamax: 1,
                        opttolerance: 0.2
                    });

                    if (outputFormat === 'svg') {
                        // Get SVG with appropriate scaling
                        const svgScale = 1;
                        const svgData = traceResult.getSVG(svgScale, 'px');
                        resolve(svgData);
                    } else {
                        // Convert to DXF (simplified approach)
                        const dxfData = convertSvgToDxf(traceResult);
                        resolve(dxfData);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = function () {
                reject(new Error('Failed to load image'));
            };

            // Load the image from file
            img.src = URL.createObjectURL(file);
        });
    }

    // Function to convert SVG path data to DXF
    function convertSvgToDxf(traceResult) {
        // This is a simplified DXF generation
        // In a real app, you'd want a more robust SVG to DXF converter

        let dxf = '0\nSECTION\n';
        dxf += '2\nHEADER\n';
        dxf += '0\nENDSEC\n';
        dxf += '0\nSECTION\n';
        dxf += '2\nENTITIES\n';

        // Get all paths from the trace result
        const paths = traceResult.getPaths();

        // Process each path
        paths.forEach(path => {
            // For each curve in the path
            path.curves.forEach(curve => {
                if (curve.type === 'line') {
                    // Add line entity
                    dxf += '0\nLINE\n';
                    dxf += '8\n0\n'; // Layer 0
                    dxf += `10\n${curve.x1}\n`; // Start X
                    dxf += `20\n${curve.y1}\n`; // Start Y
                    dxf += `11\n${curve.x2}\n`; // End X
                    dxf += `21\n${curve.y2}\n`; // End Y
                } else if (curve.type === 'bezier') {
                    // Approximate bezier with polyline
                    dxf += '0\nPOLYLINE\n';
                    dxf += '8\n0\n'; // Layer 0
                    dxf += '66\n1\n'; // Vertices follow

                    // Approximate the bezier curve with points
                    const steps = 10;
                    for (let i = 0; i <= steps; i++) {
                        const t = i / steps;
                        const point = getBezierPoint(
                            { x: curve.x1, y: curve.y1 },
                            { x: curve.x2, y: curve.y2 },
                            { x: curve.x3, y: curve.y3 },
                            { x: curve.x4, y: curve.y4 },
                            t
                        );

                        dxf += '0\nVERTEX\n';
                        dxf += '8\n0\n';
                        dxf += `10\n${point.x}\n`;
                        dxf += `20\n${point.y}\n`;
                    }

                    dxf += '0\nSEQEND\n';
                }
            });
        });

        dxf += '0\nENDSEC\n';
        dxf += '0\nEOF\n';

        return dxf;
    }

    // Function to get a point on a cubic bezier curve
    function getBezierPoint(p0, p1, p2, p3, t) {
        const x =
            Math.pow(1 - t, 3) * p0.x +
            3 * Math.pow(1 - t, 2) * t * p1.x +
            3 * (1 - t) * Math.pow(t, 2) * p2.x +
            Math.pow(t, 3) * p3.x;

        const y =
            Math.pow(1 - t, 3) * p0.y +
            3 * Math.pow(1 - t, 2) * t * p1.y +
            3 * (1 - t) * Math.pow(t, 2) * p2.y +
            Math.pow(t, 3) * p3.y;

        return { x, y };
    }
});
