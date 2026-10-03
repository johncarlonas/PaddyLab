import io
import unittest
from PIL import Image
from app import app, CLASSES, ROOT


class AppChecks(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_home_and_samples(self):
        self.assertEqual(self.client.get('/').status_code, 200)
        guide = self.client.get('/classes')
        self.assertEqual(guide.status_code, 200)
        self.assertIn(b'class-list', guide.data)
        self.assertNotIn(b'class-list', self.client.get('/').data)
        for category in CLASSES:
            response = self.client.get('/api/samples/' + category)
            self.assertEqual(response.status_code, 200)
            response.close()
        self.assertEqual(self.client.get('/api/samples/nope').status_code, 404)

    def test_upload_validation(self):
        self.assertEqual(self.client.post('/api/predict').status_code, 400)
        self.assertEqual(self.client.post('/api/predict', data={'image': (io.BytesIO(b'not an image'), 'leaf.jpg')}).status_code, 400)
        self.assertEqual(self.client.post('/api/predict', data={'image': (io.BytesIO(b'x' * (10 * 1024 * 1024)), 'large.jpg')}).status_code, 413)
        image = io.BytesIO(); Image.new('RGB', (10, 10)).save(image, format='GIF'); image.seek(0)
        self.assertEqual(self.client.post('/api/predict', data={'image': (image, 'leaf.gif')}).status_code, 400)

    def test_real_model(self):
        self.assertEqual(self.client.get('/api/status').status_code, 200)
        sample = self.client.get('/api/samples/healthy')
        response = self.client.post('/api/predict', data={'image': (io.BytesIO(sample.data), 'leaf.jpg')})
        sample.close()
        self.assertEqual(response.status_code, 200, response.json)
        data = response.json
        self.assertEqual(len(data['scores']), 6)
        self.assertAlmostEqual(sum(row['confidence'] for row in data['scores']), 1, places=4)
        self.assertEqual(data['prediction'], data['scores'][0])
        self.assertTrue(all(0 <= row['confidence'] <= 1 for row in data['scores']))


if __name__ == '__main__':
    unittest.main()
