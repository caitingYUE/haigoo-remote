
/**
 * Utility to obfuscate Job IDs in share links
 * This prevents exposing internal ID structures (like "crawled_company_") to end users.
 */

const PREFIX = 'E-';

interface DecodeJobIdOptions {
  allowBareToken?: boolean;
}

const encodeBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const decodeBase64Url = (value: string): string => {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeJobId = (jobId: string): string => {
  if (!jobId) return '';
  try {
    const encoded = encodeBase64Url(jobId);
    return `${PREFIX}${encoded}`;
  } catch (e) {
    console.error('Failed to encode job ID', e);
    return jobId;
  }
};

export const encodeJobToken = (jobId: string): string => {
  if (!jobId) return '';
  try {
    return encodeBase64Url(jobId);
  } catch (e) {
    console.error('Failed to encode job ID', e);
    return jobId;
  }
};

export const decodeJobId = (encodedId: string, options: DecodeJobIdOptions = {}): string => {
  if (!encodedId) return '';
  
  // If it doesn't start with our legacy prefix, assume it's a raw ID unless
  // the caller knows the current route uses a short encoded token.
  if (!encodedId.startsWith(PREFIX)) {
    if (options.allowBareToken) {
      try {
        return decodeBase64Url(encodedId);
      } catch (e) {
        console.warn('Failed to decode short job token, falling back to original', e);
      }
    }
    return encodedId;
  }

  try {
    return decodeBase64Url(encodedId.slice(PREFIX.length));
  } catch (e) {
    console.warn('Failed to decode job ID, falling back to original', e);
    return encodedId;
  }
};

export const getShareLink = (jobId: string): string => {
  return `${window.location.origin}${getJobSharePath(jobId)}`;
};

export const getJobDetailPath = (jobId: string): string => {
  const encodedId = encodeJobId(jobId);
  return `/job/${encodedId}`;
};

export const getJobSharePath = (jobId: string): string => {
  const encodedToken = encodeJobToken(jobId);
  return `/j/${encodedToken}?source=share`;
};

export const getJobDetailLink = (jobId: string): string => {
  return `${window.location.origin}${getJobDetailPath(jobId)}`;
};

export const getBundleDetailPath = (bundleId: string | number): string => {
  return `/b/${encodeURIComponent(String(bundleId))}`;
};

export const getBundleDetailLink = (bundleId: string | number): string => {
  return `${window.location.origin}${getBundleDetailPath(bundleId)}`;
};

export const getCompanyDetailPath = (companyName: string): string => {
  return `/c/${encodeURIComponent(companyName)}`;
};
