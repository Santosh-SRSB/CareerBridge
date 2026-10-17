export const storageConfig = () => ({
  gcsBucket: process.env.GCS_BUCKET || 'careerbridge-resumes',
  uploadDir: process.env.STORAGE_UPLOAD_DIR || './uploads',
});
