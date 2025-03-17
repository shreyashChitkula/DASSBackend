import multer from "multer";
import { S3Client } from "@aws-sdk/client-s3";
import multerS3 from "multer-s3";
import dotenv from "dotenv";
dotenv.config();

// MinIO S3 configuration
export const bucket = "minio-test";
export const modelsBucket = "models"; // New bucket for models

export const s3 = new S3Client({
  endpoint: "http://127.0.0.1:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "PytqoFlewjIlm46gW35Z",
    secretAccessKey: "pVxlkjGGPoEpePnfB5f4R4QFVgIkwev6AzJuxN8y",
  },
  forcePathStyle: true, // Required for MinIO
});

const storage = multerS3({
  s3: s3,
  bucket: bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    cb(null, Date.now().toString());
  },
});

const modelStorage = multerS3({
  s3: s3,
  bucket: modelsBucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    cb(null, Date.now().toString());
  },
});

export const upload = multer({ storage });
export const uploadModel = multer({ storage: modelStorage });

// module.exports = { bucket, s3, upload };
