# PaddyLab

A portfolio web app around the original six-class rice leaf CNN. The home page is the analyzer: upload a photo, try a test-set sample, and inspect class scores. The About page at `/about` explains the project, model, result, and six class examples.

## Run locally (Windows, Python 3.12)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Open http://127.0.0.1:5000. The first request loads the 89 MB saved model; it may take several seconds. The app uses `Rice Leaf Disease Detection v2.h5` from this directory. No uploaded images are saved to disk.

## Original project context

The local training notebooks train a TensorFlow/Keras CNN: three convolution/max-pooling blocks, a 128-unit dense layer, dropout, and six softmax outputs. Input images are RGB, resized to 256 × 256 with TensorFlow bilinear interpolation, and divided by 255. Class order follows the training directory order: bacterial leaf blight, brown spot, healthy, leaf blast, leaf scald, rice hispa. The notebooks and original dataset stay local and are ignored by Git.

The notebook uses `take` and `skip` on a shuffled dataset without a stable independent split. Training and validation membership may overlap across iterations. Treat saved validation metrics as exploratory, and evaluate on an independent test set before advertising accuracy. Confidence is a softmax score, not a calibrated probability of a correct diagnosis. The model always chooses among its six classes, including for unrelated photos.

## Verification

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests
```

The checks cover upload validation, samples, preprocessing, API behavior, and real inference on a test image.

`tests/browser.cjs` is an optional end-to-end check using Playwright and installed Microsoft Edge. With the app running and Playwright available to Node, run `node tests/browser.cjs`. It checks predictions, reset behavior, and mobile overflow, and saves screenshots in `tests/`.

## Publishing

The app needs a Python server with TensorFlow and enough memory for the model. The built-in Flask server is for local development; use a production WSGI server when hosting. Set upload limits and resource/time limits at the hosting layer for public traffic. This version has no accounts or database. Fonts use Google Fonts with local system fallbacks. The repository includes six compressed samples under `public/static/samples/`; the original dataset stays local for training and is excluded from Git and Vercel uploads.

### Deploy to Vercel

Vercel detects the top-level Flask app in `app.py` automatically. Connect this repository in Vercel, or run `vercel` from the project directory. The deployment config includes the v2 model and excludes the dataset, v1 model, notebooks, tests, and local environment. TensorFlow is large, so verify the function bundle size in the Vercel build output before treating the deployment as production-ready.

Scroll interpolation uses vendored Lenis 1.3.17 (MIT, license in `public/static/lenis.LICENSE`). Section reveals use IntersectionObserver. Both effects turn off for `prefers-reduced-motion`; touch scrolling stays native. The visual direction follows the spacing and rounded typography of the Camemera and DIA references.
