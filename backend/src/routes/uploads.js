import { Router } from 'express';
import multer from 'multer';
import { uploadPropertyImage, verifyStorageConnection } from '../storage.js';

const r = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'));
      return;
    }
    cb(null, true);
  },
});

r.get('/health', async (_req, res, next) => {
  try {
    const status = await verifyStorageConnection();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

r.post('/property-image', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Choose an image file to upload' });
      return;
    }

    const uploaded = await uploadPropertyImage({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      filename: req.file.originalname,
      propertyId: req.body?.property_id || 'new',
    });

    res.status(201).json(uploaded);
  } catch (error) {
    next(error);
  }
});

export default r;
