export function mockInterviewSetupUrl(jobRole?: string) {
  const role = jobRole?.trim();
  if (!role) return '/interviews/mock';
  return `/interviews/mock?role=${encodeURIComponent(role)}`;
}
