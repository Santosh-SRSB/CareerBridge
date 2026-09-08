import { downloadResume, saveBase64File, savePrimaryResume } from '@/lib/api';
import { masterResumeToResumeContent } from '@/features/resume/master-to-resume-content';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';

export type ResumeCloudDownloadResult = {
  resumeId: string;
  storageError: string | null;
  uploaded: boolean;
};

export async function downloadResumeWithCloudSync(options: {
  resumeId?: string;
  resume: MasterResumeDocument;
  targetJobTitle?: string;
  template?: string;
  title?: string;
}): Promise<ResumeCloudDownloadResult> {
  const template = options.template || 'resume-template-01';
  const title =
    options.title || `${options.resume.personalInfo.fullName || 'My'} Resume`;

  const saved = await savePrimaryResume({
    resumeId: options.resumeId,
    title,
    targetJobTitle: options.targetJobTitle?.trim() || undefined,
    template,
    content: masterResumeToResumeContent(options.resume),
  });

  const result = await downloadResume(saved.id);
  if (!result.pdf) {
    throw new Error('Resume PDF was not returned by the server.');
  }

  saveBase64File(result.pdf, result.fileName, result.mimeType || 'application/pdf');

  const storageError = result.storageError || saved.storageError || null;

  return {
    resumeId: saved.id,
    storageError,
    uploaded: Boolean(result.storage?.pdfStorageUri || result.pdfStorageUri),
  };
}
