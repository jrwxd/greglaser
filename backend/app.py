from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

# Set up basic logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/')
def index():
    return "Laser cutter backend is running!"

@app.route('/api/connect', methods=['POST'])
def connect_laser():
    """
    Endpoint to establish connection with the laser cutter.
    In a real scenario, this would handle serial port connections.
    """
    app.logger.info("Received request to connect to laser.")
    # Simulate connection success
    return jsonify({"status": "success", "message": "Laser connected successfully"})

@app.route('/api/send_vector_data', methods=['POST'])
def send_vector_data():
    """
    Endpoint to receive vector data (SVG or DXF) from the frontend.
    """
    data = request.json
    if not data or 'vector_data' not in data:
        return jsonify({"status": "error", "message": "No vector data provided"}), 400

    vector_data = data['vector_data']
    app.logger.info(f"Received vector data:\n{vector_data[:200]}...") # Log the first 200 chars

    # In a real app, you would process this data and convert it to G-code
    return jsonify({"status": "success", "message": "Vector data received"})

@app.route('/api/start_job', methods=['POST'])
def start_job():
    """
    Endpoint to start the laser cutting job.
    """
    app.logger.info("Received request to start the job.")
    # Here you would start sending G-code to the laser
    return jsonify({"status": "success", "message": "Job started"})

@app.route('/api/stop_job', methods=['POST'])
def stop_job():
    """
    Endpoint to stop or pause the current job.
    """
    app.logger.info("Received request to stop the job.")
    # Here you would send a command to halt the laser
    return jsonify({"status": "success", "message": "Job stopped"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
