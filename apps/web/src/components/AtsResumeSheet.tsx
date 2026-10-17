'use client';

import { resolveResumeTemplateId, type ResumeContent } from '@careerbridge/shared';
import { getTemplateComponent } from '@/components/resume-templates/index.js';
import { toAtsTemplateData } from '@/lib/resume-ats-data';

export function AtsResumeSheet({
  content,
  template,
  photoUrl,
  withPhoto,
  targetJobTitle,
  className,
}: {
  content: ResumeContent;
  template?: string | null;
  photoUrl?: string | null;
  withPhoto?: boolean;
  targetJobTitle?: string | null;
  className?: string;
}) {
  const templateId = resolveResumeTemplateId(template);
  const Template = getTemplateComponent(templateId);
  const showPhoto = withPhoto ?? templateId.startsWith('photo-');
  const data = toAtsTemplateData(content, {
    title: targetJobTitle,
    photoUrl: showPhoto ? photoUrl : '',
  });

  return (
    <div className={className || 'cb-ats-sheet'}>
      <Template data={data} />
    </div>
  );
}
