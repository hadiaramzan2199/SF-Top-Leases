import dotenv from 'dotenv';
import { verifyStorageConnection } from '../src/storage.js';

dotenv.config();

verifyStorageConnection()
  .then((status) => {
    console.log('S3 storage OK');
    console.log(JSON.stringify(status, null, 2));
  })
  .catch((error) => {
    console.error('S3 storage check failed:', error.message);
    process.exitCode = 1;
  });
