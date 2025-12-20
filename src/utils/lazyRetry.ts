import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that automatically reloads the page
 * if a chunk fails to load (e.g. after a new deployment).
 */
export const lazyRetry = (
  componentImport: () => Promise<{ default: ComponentType<any> }>,
  name: string = 'unknown'
) => {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error: any) {
      console.error(`[lazyRetry] Failed to load component ${name}:`, error);

      // Check if it's a chunk load error (network error or 404 on JS file)
      const isChunkError = 
        error.message?.includes('Failed to fetch dynamically imported module') ||
        error.message?.includes('Importing a module script failed') ||
        error.name === 'ChunkLoadError';

      if (isChunkError) {
        // Check if we've already retried to avoid infinite loops
        const storageKey = `retry-lazy-${name}`;
        const hasRetried = sessionStorage.getItem(storageKey);
        
        if (!hasRetried) {
          console.log(`[lazyRetry] Chunk load error detected for ${name}. Reloading page...`);
          sessionStorage.setItem(storageKey, 'true');
          window.location.reload();
          // Return a never-resolving promise to suspend React while reloading
          return new Promise(() => {});
        } else {
            // Clear the flag so next time (if it's a persistent error) we don't block
            // but for now, we have to throw because reload didn't fix it
            console.error(`[lazyRetry] Reloading didn't fix the issue for ${name}.`);
            sessionStorage.removeItem(storageKey);
        }
      }
      
      throw error;
    }
  });
};
