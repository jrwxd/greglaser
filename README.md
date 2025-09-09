# Laser Cutter Frontend and Backend

This project provides a web-based interface for converting raster images to vector formats (SVG or DXF) and a simulated backend for controlling a laser cutter.

## Overview

The application consists of two main parts:

1.  **Frontend:** A static HTML, CSS, and JavaScript application that allows users to upload an image, convert it to a vector format using the Potrace algorithm, and preview the result.
2.  **Backend:** A Python Flask server that provides a simulated API for controlling a laser cutter. It has endpoints for connecting to the laser, sending vector data, and starting/stopping a job.

## Features

-   Drag and drop interface for easy image uploading.
-   Converts images to SVG or DXF vector formats.
-   Adjustable threshold for black and white conversion.
-   Real-time preview of the vector output.
-   Simulated laser cutter control via a backend API.

## Local Development

### Prerequisites

-   Python 3.6+
-   pip

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create a virtual environment (optional but recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

### Running the Application

To run the application, you need to start both the backend server and a simple HTTP server for the frontend.

1.  **Start the backend server:**
    In the `backend` directory, run the following command:
    ```bash
    python app.py
    ```
    The backend server will be running at `http://127.0.0.1:5000`.

2.  **Start the frontend server:**
    In the root directory of the project, run the following command:
    ```bash
    python -m http.server 8000
    ```
    The frontend will be available at `http://localhost:8000/index.html`.

Now you can open `http://localhost:8000/index.html` in your browser to use the application.

## API Endpoints

The backend provides the following API endpoints:

-   `POST /api/connect`: Simulates connecting to the laser cutter.
-   `POST /api/send_vector_data`: Receives vector data (SVG or DXF) from the frontend.
-   `POST /api/start_job`: Simulates starting a laser cutting job.
-   `POST /api/stop_job`: Simulates stopping a laser cutting job.

## Technologies Used

-   **Frontend:** HTML, CSS, JavaScript, Potrace.js, FileSaver.js
-   **Backend:** Python, Flask, Flask-CORS
