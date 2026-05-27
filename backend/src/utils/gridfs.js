const mongoose = require('mongoose');
const { Readable } = require('stream');
const { getBackendBaseUrl } = require('./runtimeUrls');

let bucket = null;

function getBucket() {
  if (!bucket) {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB not connected yet');
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
  }
  return bucket;
}

/**
 * Upload a file buffer to GridFS (MongoDB).
 * Returns { fileId, fileUrl } where fileUrl is the API endpoint to serve it.
 */
async function uploadToGridFS(buffer, filename, mimetype, metadata = {}) {
  const b = getBucket();
  const fileId = new mongoose.Types.ObjectId();

  return new Promise((resolve, reject) => {
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    const uploadStream = b.openUploadStreamWithId(fileId, filename, {
      contentType: mimetype,
      metadata: { ...metadata, mimetype },
    });

    readable.pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => {
        const backendUrl = getBackendBaseUrl();
        const apiPath = '/api/' + (process.env.API_VERSION || 'v1') + '/files/' + fileId;
        const fileUrl = backendUrl ? (backendUrl + apiPath) : apiPath;
        resolve({ fileId: fileId.toString(), fileUrl });
      });
  });
}

/**
 * Download a file from GridFS by its ObjectId.
 * Returns a readable stream + file metadata.
 */
async function downloadFromGridFS(fileId) {
  const b = getBucket();
  const objectId = new mongoose.Types.ObjectId(fileId);
  const files = await b.find({ _id: objectId }).toArray();
  if (!files || files.length === 0) return null;
  const file = files[0];
  const stream = b.openDownloadStream(objectId);
  return { stream, file };
}

/**
 * Delete a file from GridFS by its ObjectId.
 */
async function deleteFromGridFS(fileId) {
  const b = getBucket();
  const objectId = new mongoose.Types.ObjectId(fileId);
  await b.delete(objectId);
}

module.exports = { uploadToGridFS, downloadFromGridFS, deleteFromGridFS, getBucket };
