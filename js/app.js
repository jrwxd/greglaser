document.addEventListener('DOMContentLoaded', function () {
    // Get DOM elements
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const thresholdSlider = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');
    const originalPreview = document.getElementById('originalPreview');
    const vectorPreview = document.getElementById('vectorPreview');
    const previewSection = document.querySelector('.preview-section');
    const processingOverlay = document.getElementById('processingOverlay');

    // Variables to store current state
    let currentFile = null;
    let vectorOutput = null;

    // Check if required libraries are loaded
    if (typeof Potrace === 'undefined') {
        console.error('Potrace library is not loaded');
        alert('Error: Potrace library is missing. Please check your script includes.');
        return;
    }

    // Initialize UI
    downloadBtn.disabled = true;
    convertBtn.disabled = true;
    thresholdValue.textContent = thresholdSlider.value;

    // File drag & drop handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
        dropArea.addEventListener(event, preventDefaults);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(event => {
        dropArea.addEventListener(event, () => dropArea.classList.add('active'));
    });

    ['dragleave', 'drop'].forEach(event => {
        dropArea.addEventListener(event, () => dropArea.classList.remove('active'));
    });

    // Handle file drop
    dropArea.addEventListener('drop', function(e) {
        const file = e.dataTransfer.files[0];
        if (file && file.type.match('image.*')) {
            processSelectedFile(file);
        }
    });

    // Handle file selection via input
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            processSelectedFile(this.files[0]);
        }
    });

    // Click on drop area triggers file input
    dropArea.addEventListener('click', () => fileInput.click());

    // Process the selected file
    function processSelectedFile(file) {
        currentFile = file;
        convertBtn.disabled = false;
        
        // Show image preview
        const reader = new FileReader();
        reader.onload = function(e) {
            originalPreview.src = e.target.result;
            previewSection.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    // Update threshold display
    thresholdSlider.addEventListener('input', function() {
        thresholdValue.textContent = this.value;
    });

    // Handle convert button click
    convertBtn.addEventListener('click', function() {
        if (!currentFile) return;
        
        processingOverlay.style.display = 'flex';
        
        const threshold = parseInt(thresholdSlider.value);
        const resolutionScale = parseInt(document.getElementById('resolution').value);
        const outputFormat = document.querySelector('input[name="outputFormat"]:checked').value;
        
        // Allow UI to update before starting processing
        setTimeout(() => {
            processImage(currentFile, threshold, resolutionScale, outputFormat)
                .then(result => {
                    vectorOutput = result;
                    downloadBtn.disabled = false;
                    
                    if (outputFormat === 'svg') {
                        vectorPreview.innerHTML = result;
                    } else {
                        vectorPreview.innerHTML = '<div style="padding: 20px; background: #f8f9fa; border: 1px dashed #ccc;">' +
                            '<p>DXF preview not available. Please download the file to view it in a compatible application.</p></div>';
                    }
                    
                    processingOverlay.style.display = 'none';
                })
                .catch(error => {
                    console.error('Processing error:', error);
                    alert('Error converting image: ' + error.message);
                    processingOverlay.style.display = 'none';
                });
        }, 50);
    });

    // Handle download button click
    downloadBtn.addEventListener('click', function() {
        if (!vectorOutput) return;
        
        const outputFormat = document.querySelector('input[name="outputFormat"]:checked').value;
        const fileName = `converted.${outputFormat}`;
        
        const blob = new Blob([vectorOutput], { 
            type: outputFormat === 'svg' ? 'image/svg+xml' : 'application/dxf' 
        });
        
        // Use FileSaver if available, otherwise fallback
        if (typeof saveAs !== 'undefined') {
            saveAs(blob, fileName);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
    });

    // Main image processing function
    async function processImage(file, threshold, resolutionScale, outputFormat) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = function() {
                try {
                    console.log("Image loaded, processing...");
                    
                    // Create a canvas for processing
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Scale dimensions based on resolution setting
                    const width = Math.floor(img.width / resolutionScale);
                    const height = Math.floor(img.height / resolutionScale);
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw image to canvas with scaling
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Get image data
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    
                    // Create binary data for Potrace (1 = black, 0 = white)
                    const binaryData = new Uint8Array(width * height);
                    
                    for (let i = 0; i < data.length; i += 4) {
                        // Calculate grayscale using luminance formula
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                        
                        // Apply threshold
                        const pixelIndex = i / 4;
                        binaryData[pixelIndex] = gray < threshold ? 1 : 0;
                    }
                    
                    // Set Potrace parameters
                    Potrace.setParameter({
                        turdsize: 2,
                        optcurve: true,
                        alphamax: 1,
                        opttolerance: 0.2
                    });
                    
                    // Create Bitmap for Potrace
                    const potraceInput = {
                        data: binaryData,
                        width: width,
                        height: height
                    };
                    
                    // Trace the image
                    const result = trace(potraceInput, outputFormat);
                    resolve(result);
                    
                } catch (error) {
                    console.error("Processing error:", error);
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            
            img.src = URL.createObjectURL(file);
        });
    }
    
    // Function to trace the image using Potrace
    function trace(imgData, outputFormat) {
        // Create a Potrace bitmap
        const bm = new Potrace.Bitmap(imgData.width, imgData.height);
        
        // Copy the binary data to the bitmap
        for (let i = 0; i < imgData.data.length; i++) {
            bm.data[i] = imgData.data[i];
        }
        
        // Trace the bitmap
        Potrace.process(function(){});
        
        // Get the SVG output
        const svgData = Potrace.getSVG(1, 'px');
        
        if (outputFormat === 'svg') {
            return svgData;
        } else {
            // Convert SVG to DXF (simplified implementation)
            return svgToDxf(svgData);
        }
    }

    // Convert SVG to DXF (simplified implementation)
    function svgToDxf(svgData) {
        // This is a very simplified DXF conversion
        // In a real application, you'd need a proper SVG parser
        
        let dxf = '0\nSECTION\n';
        dxf += '2\nHEADER\n';
        dxf += '0\nENDSEC\n';
        dxf += '0\nSECTION\n';
        dxf += '2\nENTITIES\n';
        
        // Extract path data from SVG (simplified)
        const pathMatch = svgData.match(/<path d="([^"]+)"/);
        if (pathMatch && pathMatch[1]) {
            const pathData = pathMatch[1];
            const commands = pathData.match(/[MLCZm][^MLCZm]*/g) || [];
            
            for (let cmd of commands) {
                const type = cmd[0];
                const coords = cmd.substring(1).trim().split(/[\s,]+/).map(parseFloat);
                
                if (type === 'M' || type === 'm') {
                    // Move command - skip in DXF
                } else if (type === 'L') {
                    // Line command
                    if (coords.length >= 2) {
                        dxf += '0\nLINE\n';
                        dxf += '8\n0\n'; // Layer 0
                        dxf += `10\n${coords[0]}\n`; // Start X
                        dxf += `20\n${coords[1]}\n`; // Start Y
                        dxf += `11\n${coords[0]}\n`; // End X (simplified)
                        dxf += `21\n${coords[1]}\n`; // End Y (simplified)
                    }
                } else if (type === 'C') {
                    // Bezier curve - approximate with line in this simplified version
                    if (coords.length >= 6) {
                        dxf += '0\nLINE\n';
                        dxf += '8\n0\n';
                        dxf += `10\n${coords[0]}\n`;
                        dxf += `20\n${coords[1]}\n`;
                        dxf += `11\n${coords[4]}\n`;
                        dxf += `21\n${coords[5]}\n`;
                    }
                }
            }
        }
        
        // DXF footer
        dxf += '0\nENDSEC\n';
        dxf += '0\nEOF\n';
        
        return dxf;
    }
});
```
