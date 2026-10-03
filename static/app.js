const $ = (selector) => document.querySelector(selector);
const sampleKeys = ['bacterial_leaf_blight', 'brown_spot', 'healthy', 'leaf_blast', 'leaf_scald', 'rice_hispa'];
let selectedFile, previewUrl, reading, busy = false, selectionVersion = 0;
const pct = (value) => `${(value * 100).toFixed(1)}%`;
function showError(message) { $('#error').textContent = message; }
function setFile(file) {
  if (busy) return;
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return showError('Choose a JPG, PNG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) return showError('Keep image uploads under 10 MB.');
  selectionVersion++;
  selectedFile = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  $('#preview').src = previewUrl;
  $('#preview').hidden = false;
  $('#upload-empty').hidden = true;
  $('#replace-label').hidden = false;
  $('#clear').hidden = false;
  $('#filename').textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB`;
  $('#analyze').disabled = false;
  $('#result').hidden = true;
  $('#result-empty').hidden = false;
  reading = null;
  showError('');
}
$('#image-input').addEventListener('change', (event) => setFile(event.target.files[0]));
for (const name of ['dragenter', 'dragover']) $('#dropzone').addEventListener(name, (event) => { event.preventDefault(); $('#dropzone').classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) $('#dropzone').addEventListener(name, (event) => { event.preventDefault(); $('#dropzone').classList.remove('dragging'); });
$('#dropzone').addEventListener('drop', (event) => setFile(event.dataTransfer.files[0]));
$('#clear').addEventListener('click', () => {
  if (busy) return;
  selectionVersion++;
  selectedFile = null;
  reading = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  $('#image-input').value = '';
  $('#preview').hidden = true;
  $('#upload-empty').hidden = false;
  $('#replace-label').hidden = true;
  $('#clear').hidden = true;
  $('#filename').textContent = 'No image selected';
  $('#analyze').disabled = true;
  $('#result').hidden = true;
  $('#result-empty').hidden = false;
  showError('');
});
async function loadSample(category) {
  if (busy) return;
  if (!sampleKeys.includes(category)) return;
  const version = ++selectionVersion;
  try {
    const response = await fetch(`/api/samples/${category}`);
    if (!response.ok) throw new Error('Sample unavailable. Try uploading your own image.');
    const blob = await response.blob();
    if (version === selectionVersion && !busy) setFile(new File([blob], `${category}.jpg`, { type: blob.type }));
  } catch (error) { if (version === selectionVersion) showError(error.message); }
}
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => loadSample(button.dataset.sample)));
const initialSample = new URLSearchParams(location.search).get('sample');
if (initialSample) loadSample(initialSample);

function setBusy(value) {
  busy = value;
  $('#analyze').disabled = value || !selectedFile;
  $('#image-input').disabled = value;
  $('#clear').disabled = value;
  document.querySelectorAll('[data-sample]').forEach(button => { button.disabled = value; });
  $('.results-panel').setAttribute('aria-busy', String(value));
  if (value) {
    $('#analyze').textContent = 'Analyzing…';
    $('#result-empty h3').textContent = 'Analyzing your photo…';
  } else {
    $('#analyze').textContent = 'Analyze Photo';
    $('#result-empty h3').textContent = 'Your result goes here.';
  }
}
$('#analyze').addEventListener('click', async () => {
  if (!selectedFile || busy) return;
  setBusy(true);
  showError('');
  const body = new FormData(); body.append('image', selectedFile);
  try {
    const response = await fetch('/api/predict', { method: 'POST', body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not analyze this image.');
    reading = { ...data, filename: selectedFile.name, analyzed_at: new Date().toISOString() };
    $('#result-label').textContent = data.prediction.label;
    $('#result-description').textContent = data.prediction.description;
    $('#confidence').textContent = pct(data.prediction.confidence);
    $('#confidence-fill').style.width = pct(data.prediction.confidence);
    $('#uncertain').hidden = data.prediction.confidence >= 0.6;
    $('#scores').replaceChildren();
    for (const score of data.scores) {
      const row = document.createElement('div'); row.className = 'score';
      const label = document.createElement('span'); label.textContent = score.label;
      const track = document.createElement('div'), fill = document.createElement('i'); fill.style.width = pct(score.confidence); track.append(fill);
      const value = document.createElement('span'); value.textContent = pct(score.confidence);
      row.append(label, track, value); $('#scores').append(row);
    }
    $('#result-empty').hidden = true; $('#result').hidden = false;
  } catch (error) { showError(error.message || 'Connection failed. Try again.'); }
  finally { setBusy(false); }
});
$('#download').addEventListener('click', () => {
  if (!reading) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(reading, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'paddylab-reading.json';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
fetch('/api/status').then(async (response) => {
  const data = await response.json();
  $('#model-status').textContent = data.ready ? 'Ready to analyze' : 'Model unavailable';
  $('#model-status').className = `model-status ${data.ready ? 'ready' : 'unavailable'}`;
}).catch(() => { $('#model-status').textContent = 'Server offline'; $('#model-status').className = 'model-status unavailable'; });
