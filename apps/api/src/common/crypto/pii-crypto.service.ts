import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@careerbridge/shared';
import {
  PiiConfigError,
  decryptPii,
  encryptPii,
  isPiiCiphertext,
  loadPiiKeyring,
  piiKeyringFingerprint,
  piiLookupHash,
  type PiiField,
  type PiiKeyring,
  type PiiLookupKind,
} from './pii-crypto';

/** Shown instead of a masked value when a stored ciphertext cannot be decrypted with the configured keys. */
export const PII_UNAVAILABLE = 'Unavailable';

const ENV_KEYS = ['PII_ENCRYPTION_KEYS', 'PII_ENCRYPTION_ACTIVE_KEY_ID', 'PII_LOOKUP_KEY'] as const;

@Injectable()
export class PiiCryptoService implements OnModuleInit {
  private readonly logger = new Logger(PiiCryptoService.name);
  private ring: PiiKeyring | null | undefined;
  private configError: string | null = null;

  constructor(private readonly config: ConfigService) {}

  /** The fingerprint is what the backfill's --expect-key-fingerprint is checked against; it reveals no key material. */
  onModuleInit() {
    const ring = this.keyring();
    if (!ring) return;
    this.logger.log(
      `PII keyring loaded: active key id=${ring.activeKeyId}, keys=${ring.keys.size}, fingerprint=${piiKeyringFingerprint(ring)}`,
    );
  }

  private keyring(): PiiKeyring | null {
    if (this.ring !== undefined) return this.ring;
    const env = Object.fromEntries(
      ENV_KEYS.map((name) => [name, this.config.get<string>(name) ?? process.env[name]]),
    );
    try {
      this.ring = loadPiiKeyring(env);
      if (!this.ring) this.configError = 'PII_ENCRYPTION_KEYS and PII_LOOKUP_KEY are not set.';
    } catch (err) {
      this.ring = null;
      this.configError = err instanceof PiiConfigError ? err.message : 'PII encryption configuration is invalid.';
    }
    if (!this.ring) this.logger.error(`PII encryption is not available: ${this.configError}`);
    return this.ring;
  }

  isConfigured() {
    return Boolean(this.keyring());
  }

  /** Writes of sensitive identifiers fail closed: without keys nothing is stored, never plaintext. */
  assertConfigured(message = 'Company KYC details cannot be saved right now. Please try again later.') {
    if (!this.keyring()) {
      throw new ServiceUnavailableException({ code: ErrorCode.INTERNAL_ERROR, message });
    }
  }

  encrypt(field: PiiField, plaintext: string): string {
    const ring = this.keyring();
    if (!ring) this.assertConfigured();
    return encryptPii(ring as PiiKeyring, field, plaintext);
  }

  /**
   * Plaintext for an authorised backend operation. Legacy rows written before encryption are returned as stored.
   * Returns null for empty values and for ciphertext that cannot be decrypted (logged without the value).
   */
  decrypt(field: PiiField, stored: string | null | undefined): string | null {
    if (!stored) return null;
    if (!isPiiCiphertext(stored)) return stored;
    const ring = this.keyring();
    if (!ring) return null;
    try {
      return decryptPii(ring, field, stored);
    } catch (err) {
      this.logger.warn(`PII decrypt failed field=${field}: ${err instanceof Error ? err.message : 'unknown error'}`);
      return null;
    }
  }

  /** Masked display value; the plaintext never leaves this call. */
  mask(field: PiiField, stored: string | null | undefined, maskFn: (plain: string) => string): string | null {
    if (!stored) return null;
    const plain = this.decrypt(field, stored);
    return plain ? maskFn(plain) : PII_UNAVAILABLE;
  }

  lookupHash(kind: PiiLookupKind, normalized: string): string {
    const ring = this.keyring();
    if (!ring) this.assertConfigured();
    return piiLookupHash(ring as PiiKeyring, kind, normalized);
  }
}
