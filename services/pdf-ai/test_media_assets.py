import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parent))
from media_assets import publish_pdf_images

class MediaAssetsTests(unittest.TestCase):
    def test_publish_generated_images_only(self):
        with tempfile.TemporaryDirectory() as d:
            job = str(uuid4())
            folder = Path(d) / job / 'lc'
            folder.mkdir(parents=True)
            (folder / 'page-01.jpg').write_bytes(b'picture')
            (folder / 'input.json').write_text('private')
            paths = []
            class Response:
                status = 200
                def __enter__(self):return self
                def __exit__(self,*_):pass
            def fake_urlopen(req, timeout):
                paths.append((req.full_url, req.data, req.headers['X-internal-token']))
                return Response()
            with patch.dict(os.environ, MEDIA_INTERNAL_TOKEN='t'*32, MEDIA_BRIDGE_URL='http://bridge:8010'):
                with patch('media_assets.urlopen', fake_urlopen):
                    self.assertEqual(publish_pdf_images(job, Path(d)), 1)
            self.assertEqual(len(paths), 1)
            self.assertTrue(paths[0][0].endswith(f'/objects/pdf-ai/{job}/lc/page-01.jpg'))
            self.assertEqual(paths[0][1], b'picture')

    def test_does_not_report_success_when_upload_fails(self):
        with tempfile.TemporaryDirectory() as d:
            job = str(uuid4()); folder = Path(d)/job
            folder.mkdir(); (folder/'one.png').write_bytes(b'image')
            with patch.dict(os.environ, MEDIA_INTERNAL_TOKEN='t'*32):
                with patch('media_assets.urlopen', side_effect=OSError('bridge down')):
                    with self.assertRaises(OSError):publish_pdf_images(job,Path(d))

if __name__=='__main__':unittest.main()
