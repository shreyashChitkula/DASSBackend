from flask import Flask, request, jsonify
from ultralytics import YOLO
import torch
from PIL import Image
import io
import requests

app = Flask(__name__)

# Load the YOLO models
models = {
    'YOLOv5s': YOLO('yolov5s.pt'),
    'YOLOv5m': YOLO('yolov5m.pt'),
    'YOLOv5l': YOLO('yolov5l.pt'),
    'YOLOv5x': YOLO('yolov5x.pt')
}

# Class names for YOLOv5 (COCO dataset)
class_names = models['YOLOv5s'].names

@app.route('/models', methods=['GET'])
def get_models():
    model_list = [
        {'name': 'YOLOv5s', 'description': 'Small model, fast inference'},
        {'name': 'YOLOv5m', 'description': 'Medium model, balanced performance'},
        {'name': 'YOLOv5l', 'description': 'Large model, high accuracy'},
        {'name': 'YOLOv5x', 'description': 'Extra-large model, highest accuracy'}
    ]
    return jsonify(model_list)

@app.route('/detect', methods=['POST'])
def detect_objects():
    if 'imageUrl' not in request.json or 'model' not in request.json:
        return jsonify({'error': 'No imageUrl or model provided'}), 400

    image_url = request.json['imageUrl']
    model_name = request.json['model']
    if model_name not in models:
        return jsonify({'error': 'Invalid model name'}), 400

    model = models[model_name]
    response = requests.get(image_url)
    img = Image.open(io.BytesIO(response.content))

    # Get original image dimensions
    original_width, original_height = img.size

    # Perform object detection
    results = model(img)

    # Extract detection results
    detections = []
    for result in results:
        boxes = result.boxes  # This is the correct way to access bounding boxes in YOLOv8
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()  # Convert tensor to list
            conf = float(box.conf[0])  # Confidence score
            cls = int(box.cls[0])  # Class label
            class_name = class_names[cls]  # Get class name
            detections.append({
                'box': [x1, y1, x2, y2],
                'confidence': conf,
                'class': cls,
                'class_name': class_name
            })

    return jsonify({'detections': detections, 'original_width': original_width, 'original_height': original_height})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)