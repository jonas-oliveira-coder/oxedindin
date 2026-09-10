import { describe, it, expect } from 'vitest';
import {
  parseRegistrationOptions,
  parseAuthenticationOptions,
  prepareRegistrationCredential,
  prepareAuthenticationCredential,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from './passkey';

function base64URLEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function toArrayBuffer(input: string): ArrayBuffer {
  return new TextEncoder().encode(input).buffer;
}

describe('parseRegistrationOptions', () => {
  it('decodes challenge and user id from base64url to ArrayBuffer', () => {
    const options: PublicKeyCredentialCreationOptionsJSON = {
      challenge: base64URLEncode('challenge-bytes'),
      rp: { name: 'OxeDinDin', id: 'localhost' },
      user: { id: base64URLEncode('user-id'), name: 'a@b.com', displayName: 'Ana' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
      attestation: 'none',
    };

    const parsed = parseRegistrationOptions(options);
    expect(parsed.challenge).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(parsed.challenge)).toBe('challenge-bytes');
    expect(new TextDecoder().decode(parsed.user.id)).toBe('user-id');
  });

  it('decodes excludeCredentials ids', () => {
    const options: PublicKeyCredentialCreationOptionsJSON = {
      challenge: base64URLEncode('challenge-bytes'),
      rp: { name: 'OxeDinDin', id: 'localhost' },
      user: { id: base64URLEncode('user-id'), name: 'a@b.com', displayName: 'Ana' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: [{ id: base64URLEncode('cred-1'), type: 'public-key' }],
    };

    const parsed = parseRegistrationOptions(options);
    expect(new TextDecoder().decode(parsed.excludeCredentials![0]!.id)).toBe('cred-1');
  });
});

describe('parseAuthenticationOptions', () => {
  it('decodes challenge and allowCredentials ids', () => {
    const options: PublicKeyCredentialRequestOptionsJSON = {
      challenge: base64URLEncode('auth-challenge'),
      timeout: 60000,
      rpId: 'localhost',
      allowCredentials: [{ id: base64URLEncode('cred-1'), type: 'public-key' }],
      userVerification: 'required',
    };

    const parsed = parseAuthenticationOptions(options);
    expect(new TextDecoder().decode(parsed.challenge)).toBe('auth-challenge');
    expect(new TextDecoder().decode(parsed.allowCredentials![0]!.id)).toBe('cred-1');
  });
});

describe('prepareRegistrationCredential', () => {
  it('serializes raw credential fields to base64url strings', () => {
    const credential = {
      id: 'credential-id',
      rawId: toArrayBuffer('raw-id-bytes'),
      response: {
        clientDataJSON: toArrayBuffer('{"type":"webauthn.create"}'),
        attestationObject: toArrayBuffer('attestation-object-bytes'),
      },
      type: 'public-key',
    } as any;

    const prepared = prepareRegistrationCredential(credential);
    expect(prepared.id).toBe('credential-id');
    expect(prepared.type).toBe('public-key');
    expect(prepared.rawId).toBe(base64URLEncode('raw-id-bytes'));
    expect(prepared.response.clientDataJSON).toBe(base64URLEncode('{"type":"webauthn.create"}'));
    expect(prepared.response.attestationObject).toBe(base64URLEncode('attestation-object-bytes'));
  });
});

describe('prepareAuthenticationCredential', () => {
  it('serializes assertion response fields', () => {
    const credential = {
      id: 'credential-id',
      rawId: toArrayBuffer('raw-id-bytes'),
      response: {
        clientDataJSON: toArrayBuffer('{"type":"webauthn.get"}'),
        authenticatorData: toArrayBuffer('auth-data'),
        signature: toArrayBuffer('signature-bytes'),
        userHandle: toArrayBuffer('user-handle'),
      },
      type: 'public-key',
    } as any;

    const prepared = prepareAuthenticationCredential(credential);
    expect(prepared.response.authenticatorData).toBe(base64URLEncode('auth-data'));
    expect(prepared.response.signature).toBe(base64URLEncode('signature-bytes'));
    expect(prepared.response.userHandle).toBe(base64URLEncode('user-handle'));
  });

  it('omits userHandle when not present', () => {
    const credential = {
      id: 'credential-id',
      rawId: toArrayBuffer('raw-id-bytes'),
      response: {
        clientDataJSON: toArrayBuffer('{"type":"webauthn.get"}'),
        authenticatorData: toArrayBuffer('auth-data'),
        signature: toArrayBuffer('signature-bytes'),
      },
      type: 'public-key',
    } as any;

    const prepared = prepareAuthenticationCredential(credential);
    expect(prepared.response.userHandle).toBeUndefined();
  });
});