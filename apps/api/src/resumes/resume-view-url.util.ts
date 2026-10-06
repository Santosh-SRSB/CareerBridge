export interface ResumeObjectStore {
  getSignedUrl(path: string, options: { action: 'read'; expiresInMinutes?: number }): Promise<string>;
  downloadFile(path: string): Promise<Buffer>;
}

export type ResumeViewSource = 'signed' | 'inline';

/**
 * Browser-readable URL for a resume object the caller already owns: a short-lived signed URL,
 * else an inline copy (Cloud Run ADC cannot sign; the bucket stays private either way).
 */
export async function readableResumeUrl(
  storage: ResumeObjectStore,
  objectPath: string,
  mimeType: string,
  expiresInMinutes: number,
): Promise<{ url: string; source: ResumeViewSource }> {
  try {
    const url = await storage.getSignedUrl(objectPath, { action: 'read', expiresInMinutes });
    return { url, source: 'signed' };
  } catch {
    const buffer = await storage.downloadFile(objectPath);
    return { url: `data:${mimeType};base64,${buffer.toString('base64')}`, source: 'inline' };
  }
}
