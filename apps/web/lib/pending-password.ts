let pendingPassword = '';

export function setPendingPassword(password: string) {
  pendingPassword = password;
}

export function getPendingPassword() {
  return pendingPassword;
}

export function clearPendingPassword() {
  pendingPassword = '';
}
