"""PaddyLab: a web interface for the original rice leaf CNN."""
import io
import logging
import os
import threading
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request, send_file
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent
CLASSES = ['bacterial_leaf_blight', 'brown_spot', 'healthy', 'leaf_blast', 'leaf_scald', 'rice_hispa']
LABELS = ['Bacterial Leaf Blight', 'Brown Spot', 'Healthy', 'Leaf Blast', 'Leaf Scald', 'Rice Hispa']
DESCRIPTIONS = [
    'A class associated with blighted rice leaves. The model compares visual patterns with its training examples.',
    'A class associated with brown spotting on rice leaves. Similar-looking damage can lead to incorrect predictions.',
    'The image resembles healthy leaves in the training set. A healthy prediction does not rule out disease.',
    'A class associated with leaf blast patterns. Lighting, background, and image quality can affect the reading.',
    'A class associated with leaf scald patterns in the original dataset. Treat the result as a visual comparison.',
    'A class associated with rice hispa damage. This is the insect-related class in the original dataset.',
]
app = Flask(__name__, static_folder='public/static')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
model = None
model_lock = threading.Lock()


def get_model():
    global model
    if model is None:
        import tensorflow as tf
        model = tf.keras.models.load_model(ROOT / 'Rice Leaf Disease Detection v2.h5', compile=False)
        if model.input_shape[1:] != (256, 256, 3) or model.output_shape[-1] != len(CLASSES):
            model = None
            raise RuntimeError('The saved model does not match the expected six-class CNN.')
    return model


@app.get('/')
def index():
    return render_template('index.html')


@app.get('/about')
def about():
    return render_template('classes.html', guide=zip(CLASSES, LABELS, DESCRIPTIONS))


@app.get('/classes')
def legacy_classes():
    return redirect('/about', code=308)


@app.get('/api/status')
def status():
    try:
        with model_lock:
            get_model()
        return jsonify(ready=True, model='CNN v2', classes=CLASSES)
    except Exception:
        logging.exception('Model initialization failed')
        return jsonify(ready=False, message='Model unavailable. Install the requirements and check the v2 model file.'), 503


@app.get('/api/samples/<category>')
def sample(category):
    if category not in CLASSES:
        return jsonify(error='Unknown sample class.'), 404
    sample_path = ROOT / 'public' / 'static' / 'samples' / f'{category}.jpg'
    if not sample_path.exists():
        return jsonify(error='Sample image unavailable.'), 404
    return send_file(sample_path, max_age=3600)


@app.post('/api/predict')
def predict():
    upload = request.files.get('image')
    if not upload:
        return jsonify(error='Choose an image first.'), 400
    try:
        with Image.open(io.BytesIO(upload.read())) as original:
            if original.format not in {'JPEG', 'PNG', 'WEBP'}:
                return jsonify(error='Use a JPG, PNG, or WebP image.'), 400
            if original.width * original.height > 20_000_000:
                return jsonify(error='Image is too large. Use an image below 20 megapixels.'), 400
            image = ImageOps.exif_transpose(original).convert('RGB')
            import numpy as np
            import tensorflow as tf
            # Match the notebook: RGB, TensorFlow bilinear resize, then /255.
            pixels = tf.image.resize(np.asarray(image), (256, 256)) / 255.0
        with model_lock:
            scores = np.asarray(get_model()(tf.expand_dims(pixels, 0), training=False))[0]
        if scores.shape != (6,) or not np.isfinite(scores).all():
            raise RuntimeError('Invalid model output')
        ranking = sorted([{'class': key, 'label': label, 'confidence': float(score), 'description': description}
                          for key, label, score, description in zip(CLASSES, LABELS, scores, DESCRIPTIONS)],
                         key=lambda item: item['confidence'], reverse=True)
        return jsonify(prediction=ranking[0], scores=ranking, model='CNN v2')
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        return jsonify(error='This file could not be read as an image.'), 400
    except Exception:
        logging.exception('Inference failed')
        return jsonify(error='Prediction unavailable. Check the server model setup and try again.'), 503


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error='Keep image uploads under 10 MB.'), 413


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', 5000)))
