export interface PublicKeyCredentialCreationOptionsJSON {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout?: number;
  attestation?: 'none' | 'direct' | 'indirect';
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey?: boolean;
    residentKey?: 'required' | 'preferred' | 'discouraged';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  excludeCredentials?: Array<{ id: string; type: 'public-key'; transports?: string[] }>;
}

export interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials?: Array<{ id: string; type: 'public-key'; transports?: string[] }>;
  userVerification: 'required' | 'preferred' | 'discouraged';
}

export interface WebAuthnCredential {
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    attestationObject?: string;
    authenticatorData?: string;
    signature?: string;
    userHandle?: string;
  };
  type: 'public-key';
  transports?: Array<'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'>;
}

function base64URLEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64URLDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function prepareRegistrationCredential(
  credential: PublicKeyCredential
): WebAuthnCredential {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: base64URLEncode(credential.rawId),
    response: {
      clientDataJSON: base64URLEncode(response.clientDataJSON),
      attestationObject: base64URLEncode(response.attestationObject!),
    },
    type: 'public-key',
    transports: (credential as any).transports as WebAuthnCredential['transports'],
  };
}

export function prepareAuthenticationCredential(
  credential: PublicKeyCredential
): WebAuthnCredential {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: base64URLEncode(credential.rawId),
    response: {
      clientDataJSON: base64URLEncode(response.clientDataJSON),
      authenticatorData: base64URLEncode(response.authenticatorData),
      signature: base64URLEncode(response.signature),
      userHandle: response.userHandle ? base64URLEncode(response.userHandle) : undefined,
    },
    type: 'public-key',
    transports: (credential as any).transports as WebAuthnCredential['transports'],
  };
}

export function parseRegistrationOptions(options: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64URLDecode(options.challenge),
    user: {
      ...options.user,
      id: base64URLDecode(options.user.id),
    },
    excludeCredentials: options.excludeCredentials?.map((c) => ({
      ...c,
      id: base64URLDecode(c.id),
      transports: c.transports as AuthenticatorTransport[],
    })),
  } as PublicKeyCredentialCreationOptions;
}

export function parseAuthenticationOptions(options: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64URLDecode(options.challenge),
    allowCredentials: options.allowCredentials?.map((c) => ({
      ...c,
      id: base64URLDecode(c.id),
      transports: c.transports as AuthenticatorTransport[],
    })),
  } as PublicKeyCredentialRequestOptions;
}

export async function registerPasskey(options: PublicKeyCredentialCreationOptionsJSON): Promise<WebAuthnCredential> {
  const publicKey = parseRegistrationOptions(options);
  const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
  if (!credential) throw new Error('Passkey registration failed');
  return prepareRegistrationCredential(credential);
}

export async function authenticatePasskey(options: PublicKeyCredentialRequestOptionsJSON): Promise<WebAuthnCredential> {
  const publicKey = parseAuthenticationOptions(options);
  const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential;
  if (!credential) throw new Error('Passkey authentication failed');
  return prepareAuthenticationCredential(credential);
}

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined' &&
    typeof navigator.credentials.create === 'function';
}

export function isConditionalUISupported(): boolean {
  return isPasskeySupported() &&
    typeof PublicKeyCredential !== 'undefined' &&
    typeof PublicKeyCredential.isConditionalMediationAvailable === 'function';
}