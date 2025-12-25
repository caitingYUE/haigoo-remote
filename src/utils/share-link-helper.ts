
/**
 * Utility to obfuscate Job IDs in share links
 * This prevents exposing internal ID structures (like "crawled_company_") to end users.
 */

const PREFIX = 'E-';

export const encodeJobId = (jobId: string): string => {
  if (!jobId) return '';
  try {
    // Simple Base64 URL-safe encoding
    const encoded = btoa(jobId)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `${PREFIX}${encoded}`;
  } catch (e) {
    console.error('Failed to encode job ID', e);
    return jobId;
  }
};

export const decodeJobId = (encodedId: string): string => {
  if (!encodedId) return '';
  
  // If it doesn't start with our prefix, assume it's a raw ID
  if (!encodedId.startsWith(PREFIX)) {
    return encodedId;
  }

  try {
    const base64 = encodedId.slice(PREFIX.length)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed (though atob usually handles it, strictly valid base64 length % 4 === 0)
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;

    return atob(padded);
  } catch (e) {
    console.warn('Failed to decode job ID, falling back to original', e);
    return encodedId;
  }
};

export const getShareLink = (jobId: string): string => {
  const encodedId = encodeJobId(jobId);
  return `${window.location.origin}/job/${encodedId}?source=share`;
};
