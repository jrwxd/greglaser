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

    // Check if Potrace is available
    if (typeof Potrace === 'undefined') {
        alert('Error: Potrace library is not loaded. Please make sure you have included the Potrace script in your HTML.');
        convertBtn.disabled = true;
    }

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

        if (files.length > 0 && files[0].type.match('image.*')) {
            handleFile(files[0]);
        }
    }

    // File input handler
    fileInput.addEventListener('change', function () {
        if (this.files.length > 0) {
            handleFile(this.files[0]);
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
        console.log(file.type);

        // Show preview of the original image
        const reader = new FileReader();
        reader.onload = function (e) {
            originalPreview.src = e.target.result;
            previewSection.style.display = 'block';
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
                    
                    // Enable download button
                    downloadBtn.disabled = false;

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
            if (typeof saveAs === 'undefined') {
                // Fallback if FileSaver.js is not available
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 0);
            } else {
                saveAs(blob, fileName);
            }
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
                try {
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
                        binaryData[pixel] = gray < threshold ? 1 : 0;
                    }

                    // Create a new Potrace instance
                    const potrace = new Potrace();
                    
                    // Set options
                    potrace.setParameters({
                        turdsize: 2,
                        optcurve: true,
                        alphamax: 1,
                        opttolerance: 0.2
                    });

                    // Process the image data
                    potrace.loadImageFromBinary(binaryData, width, height);
                    potrace.process();

                    if (outputFormat === 'svg') {
                        // Get SVG with appropriate scaling
                        const svgScale = 1;
                        const svgData = potrace.getSVG(svgScale, 'px');
                        resolve(svgData);
                    } else {
                        // Convert to DXF
                        const dxfData = convertSvgToDxf(potrace);
                        resolve(dxfData);
                    }
                } catch (error) {
                    console.error('Processing error:', error);
                    reject(new Error('Failed to process image. Make sure Potrace library is properly loaded.'));
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
    function convertSvgToDxf(potraceResult) {
        // This is a simplified DXF generation
        let dxf = '0\nSECTION\n';
        dxf += '2\nHEADER\n';
        dxf += '0\nENDSEC\n';
        dxf += '0\nSECTION\n';
        dxf += '2\nENTITIES\n';

        try {
            // Get path data from potrace result
            const pathData = potraceResult.getPathTag();
            
            // Extract d attribute from the path tag
            const dMatch = pathData.match(/d="([^"]*)"/);
            if (dMatch && dMatch[1]) {
                const pathCommands = dMatch[1].trim().split(/(?=[MLHVCSQTAZmlhvcsqtaz])/);
                
                let currentX = 0;
                let currentY = 0;
                
                for (let i = 0; i < pathCommands.length; i++) {
                    const cmd = pathCommands[i];
                    const type = cmd[0];
                    const points = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
                    
                    switch (type) {
                        case 'M': // Move to
                            currentX = points[0];
                            currentY = points[1];
                            break;
                            
                        case 'L': // Line to
                            dxf += '0\nLINE\n';
                            dxf += '8\n0\n'; // Layer 0
                            dxf += `10\n${currentX}\n`; // Start X
                            dxf += `20\n${currentY}\n`; // Start Y
                            dxf += `11\n${points[0]}\n`; // End X
                            dxf += `21\n${points[1]}\n`; // End Y
                            
                            currentX = points[0];
                            currentY = points[1];
                            break;
                            
                        case 'Z': // Close path
                            // No need to add anything for DXF
                            break;
                            
                        // Simplified handling - convert curves to polylines
                        case 'C': // Cubic bezier
                            if (points.length >= 6) {
                                dxf += '0\nPOLYLINE\n';
                                dxf += '8\n0\n'; // Layer 0
                                dxf += '66\n1\n'; // Vertices follow
                                
                                // Start vertex
                                dxf += '0\nVERTEX\n';
                                dxf += '8\n0\n';
                                dxf += `10\n${currentX}\n`;
                                dxf += `20\n${currentY}\n`;
                                
                                // Approximate the bezier curve with points
                                const steps = 10;
                                for (let j = 1; j <= steps; j++) {
                                    const t = j / steps;
                                    const x = bezierPoint(
                                        currentX, 
                                        points[0], 
                                        points[2], 
                                        points[4], 
                                        t
                                    );
                                    const y = bezierPoint(
                                        currentY, 
                                        points[1], 
                                        points[3], 
                                        points[5], 
                                        t
                                    );
                                    
                                    dxf += '0\nVERTEX\n';
                                    dxf += '8\n0\n';
                                    dxf += `10\n${x}\n`;
                                    dxf += `20\n${y}\n`;
                                }
                                
                                dxf += '0\nSEQEND\n';
                                
                                currentX = points[4];
                                currentY = points[5];
                            }
                            break;
                    }
                }
            }
        } catch (error) {
            console.error('DXF conversion error:', error);
        }

        dxf += '0\nENDSEC\n';
        dxf += '0\nEOF\n';

        return dxf;
    }

    // Function to calculate a point on a cubic bezier curve
    function bezierPoint(p0, p1, p2, p3, t) {
        return (1-t)*(1-t)*(1-t)*p0 + 
               3*(1-t)*(1-t)*t*p1 + 
               3*(1-t)*t*t*p2 + 
               t*t*t*p3;
    }
});
