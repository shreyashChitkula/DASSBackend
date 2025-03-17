from flask import Flask, request, jsonify
from ultralytics import YOLO
import torch
from PIL import Image
import io
import requests
from transformers import DetrImageProcessor, DetrForObjectDetection
from transformers import YolosImageProcessor, YolosForObjectDetection

app = Flask(__name__)

# Load the YOLO models
yolo_models = {
    'YOLOv5s': YOLO('yolov5s.pt'),
    'YOLOv5m': YOLO('yolov5m.pt'),
    'YOLOv5l': YOLO('yolov5l.pt'),
    'YOLOv5x': YOLO('yolov5x.pt')
}

# Load Hugging Face models
detr_processor = DetrImageProcessor.from_pretrained('facebook/detr-resnet-50')
detr_model = DetrForObjectDetection.from_pretrained('facebook/detr-resnet-50')

yolos_processor = YolosImageProcessor.from_pretrained('hustvl/yolos-tiny')
yolos_model = YolosForObjectDetection.from_pretrained('hustvl/yolos-tiny')

# Move models to GPU if available
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
detr_model.to(device)
yolos_model.to(device)

# Class names for COCO dataset (used by all models)
COCO_CLASSES = [
    'N/A', 'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus',
    'train', 'truck', 'boat', 'traffic light', 'fire hydrant', 'N/A',
    'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse',
    'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'N/A', 'backpack',
    'umbrella', 'N/A', 'N/A', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis',
    'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'N/A', 'wine glass',
    'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich',
    'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
    'chair', 'couch', 'potted plant', 'bed', 'N/A', 'dining table', 'N/A',
    'N/A', 'toilet', 'N/A', 'tv', 'laptop', 'mouse', 'remote', 'keyboard',
    'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
    'N/A', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
    'toothbrush'
]

@app.route('/models', methods=['GET'])
def get_models():
    model_list = [
        # YOLO Models
        {'name': 'YOLOv5s', 'type': 'yolo', 'description': 'Small model, fast inference'},
        {'name': 'YOLOv5m', 'type': 'yolo', 'description': 'Medium model, balanced performance'},
        {'name': 'YOLOv5l', 'type': 'yolo', 'description': 'Large model, high accuracy'},
        {'name': 'YOLOv5x', 'type': 'yolo', 'description': 'Extra-large model, highest accuracy'},
        # Hugging Face Models
        {'name': 'DETR', 'type': 'huggingface', 'description': 'Facebook DETR model with ResNet-50 backbone'},
        {'name': 'YOLOS', 'type': 'huggingface', 'description': 'Vision Transformer based object detection'}
    ]
    return jsonify(model_list)

def process_detr_detection(image):
    inputs = detr_processor(images=image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    outputs = detr_model(**inputs)
    
    # Convert outputs to COCO format
    target_sizes = torch.tensor([image.size[::-1]])
    results = detr_processor.post_process_object_detection(
        outputs, target_sizes=target_sizes, threshold=0.7
    )[0]
    
    detections = []
    for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
        box = [round(i, 2) for i in box.tolist()]
        detections.append({
            'box': box,
            'confidence': round(score.item(), 3),
            'class': label.item(),
            'class_name': COCO_CLASSES[label.item()]
        })
    
    return detections

def process_yolos_detection(image):
    inputs = yolos_processor(images=image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    outputs = yolos_model(**inputs)
    
    # Convert outputs to COCO format
    target_sizes = torch.tensor([image.size[::-1]])
    results = yolos_processor.post_process_object_detection(
        outputs, target_sizes=target_sizes, threshold=0.7
    )[0]
    
    detections = []
    for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
        box = [round(i, 2) for i in box.tolist()]
        detections.append({
            'box': box,
            'confidence': round(score.item(), 3),
            'class': label.item(),
            'class_name': COCO_CLASSES[label.item()]
        })
    
    return detections

@app.route('/detect', methods=['POST'])
def detect_objects():
    if 'imageUrl' not in request.json or 'model' not in request.json:
        return jsonify({'error': 'No imageUrl or model provided'}), 400

    image_url = request.json['imageUrl']
    model_name = request.json['model']
    
    # Download and open image
    response = requests.get(image_url)
    img = Image.open(io.BytesIO(response.content))
    original_width, original_height = img.size

    # Process based on model type
    if model_name in yolo_models:
        # YOLO detection
        results = yolo_models[model_name](img)
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                detections.append({
                    'box': [x1, y1, x2, y2],
                    'confidence': conf,
                    'class': cls,
                    'class_name': COCO_CLASSES[cls]
                })
    
    elif model_name == 'DETR':
        detections = process_detr_detection(img)
    
    elif model_name == 'YOLOS':
        detections = process_yolos_detection(img)
    
    else:
        return jsonify({'error': 'Invalid model name'}), 400

    return jsonify({
        'detections': detections,
        'original_width': original_width,
        'original_height': original_height
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)