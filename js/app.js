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
        alert('Error: Potrace library is missing. Please include it in your HTML.');
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
                    // Create canvas and get binary data
                    const { width, height, binaryData } = imageToThresholdData(img, threshold, resolutionScale);
                    
                    // Process with Potrace
                    const options = {
                        turdsize: 2,
                        optcurve: true,
                        alphamax: 1,
                        opttolerance: 0.2
                    };
                    
                    // Add dimensions to options
                    options.width = width;
                    options.height = height;
                    
                    try {
                        // Trace the image
                        const traceResult = Potrace.trace(binaryData, options);
                        
                        if (outputFormat === 'svg') {
                            const svgData = traceResult.getSVG(1, 'px');
                            resolve(svgData);
                        } else {
                            const dxfData = svgToDxf(traceResult);
                            resolve(dxfData);
                        }
                    } catch (traceError) {
                        console.error('Potrace error:', traceError);
                        reject(new Error('Failed to trace image. Potrace error: ' + traceError.message));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            
            img.src = URL.createObjectURL(file);
        });
    }

    // Convert image to binary data with threshold
    function imageToThresholdData(img, threshold, resolutionScale) {
        // Calculate dimensions based on resolution scale
        const width = Math.floor(img.width / resolutionScale);
        const height = Math.floor(img.height / resolutionScale);
        
        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Create binary data array (1 = black, 0 = white)
        const binaryData = new Uint8Array(width * height);
        
        for (let i = 0; i < data.length; i += 4) {
            // Calculate grayscale using luminance formula
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Apply threshold and store in binary array
            const pixelIndex = i / 4;
            binaryData[pixelIndex] = gray < threshold ? 1 : 0;
        }
        
        return { width, height, binaryData };
    }

    // Convert SVG to DXF
    function svgToDxf(traceResult) {
        // Basic DXF header
        let dxf = '0\nSECTION\n';
        dxf += '2\nHEADER\n';
        dxf += '0\nENDSEC\n';
        dxf += '0\nSECTION\n';
        dxf += '2\nENTITIES\n';
        
        try {
            // Get paths from trace result
            const paths = traceResult.getPaths();
            
            // Process each path
            paths.forEach(path => {
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
                        // Add polyline entity to approximate bezier
                        dxf += '0\nPOLYLINE\n';
                        dxf += '8\n0\n'; // Layer 0
                        dxf += '66\n1\n'; // Vertices follow
                        
                        // Approximate bezier with multiple points
                        const steps = 10;
                        for (let i = 0; i <= steps; i++) {
                            const t = i / steps;
                            const point = getBezierPoint(
                                curve.x1, curve.y1,
                                curve.x2, curve.y2,
                                curve.x3, curve.y3,
                                curve.x4, curve.y4,
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
        } catch (error) {
            console.error('DXF conversion error:', error);
        }
        
        // DXF footer
        dxf += '0\nENDSEC\n';
        dxf += '0\nEOF\n';
        
        return dxf;
    }

    // Calculate point on cubic bezier curve
    function getBezierPoint(x1, y1, x2, y2, x3, y3, x4, y4, t) {
        // Cubic Bezier formula
        const x = Math.pow(1-t, 3) * x1 + 
                 3 * Math.pow(1-t, 2) * t * x2 + 
                 3 * (1-t) * Math.pow(t, 2) * x3 + 
                 Math.pow(t, 3) * x4;
                 
        const y = Math.pow(1-t, 3) * y1 + 
                 3 * Math.pow(1-t, 2) * t * y2 + 
                 3 * (1-t) * Math.pow(t, 2) * y3 + 
                 Math.pow(t, 3) * y4;
                 
        return { x, y };
    }
});
