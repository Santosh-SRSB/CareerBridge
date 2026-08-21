"use client";

import { PassportStartChoices } from "@/features/candidate/passport/PassportStartChoices";
import { PassportCard } from "@/features/candidate/passport/PassportCard";
import { getStoredUser } from "@/lib/session";

export function CreatePassportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const user = getStoredUser();

  return (
    <div className="passport-modal" role="dialog" aria-modal="true" aria-labelledby="passport-choice-title">
      <button className="passport-modal-scrim" type="button" aria-label="Close" onClick={onClose} />
      <PassportCard>
        <PassportStartChoices onPicked={onClose} welcomeName={user?.firstName} />
      </PassportCard>
    </div>
  );
}
