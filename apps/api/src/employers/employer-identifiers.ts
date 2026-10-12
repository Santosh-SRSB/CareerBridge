import { maskCinForDisplay, maskGstinForDisplay, maskPanForDisplay } from '@careerbridge/shared';
import type { PiiCryptoService } from '../common/crypto/pii-crypto.service';

export type StoredBusinessIdentifiers = {
  gstNumber: string | null;
  panNumber: string | null;
  cin: string | null;
};

/** The only form in which employer GSTIN / PAN / CIN leave the API. */
export function maskedBusinessIdentifiers(pii: PiiCryptoService, row: StoredBusinessIdentifiers) {
  return {
    gstNumber: pii.mask('employers.gst_number', row.gstNumber, maskGstinForDisplay),
    panNumber: pii.mask('employers.pan_number', row.panNumber, maskPanForDisplay),
    cin: pii.mask('employers.cin', row.cin, maskCinForDisplay),
  };
}
