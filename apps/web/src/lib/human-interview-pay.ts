const KEY = 'cb_human_interview_paid';

export function humanInterviewPaid() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markHumanInterviewPaid() {
  sessionStorage.setItem(KEY, '1');
}
