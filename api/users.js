
import usersHandler from '../lib/api-handlers/users.js';
import userProfileHandler from '../lib/api-handlers/user-profile.js';
import applicationsHandler from '../lib/api-handlers/applications.js';
import resumesHandler from '../lib/api-handlers/resumes.js';
import jobMatchingHandler from '../lib/api-handlers/job-matching.js';
import translationUsageHandler from '../lib/api-handlers/translation-usage.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const resource = url.searchParams.get('resource');
  const path = url.pathname;

  console.log('[API:Users] Request Path:', path, 'Resource:', resource);

  if (resource === 'translation-usage') {
      return await translationUsageHandler(req, res);
  }

  if (resource === 'applications') {
      return await applicationsHandler(req, res);
  }
  
  if (resource === 'resumes') {
      return await resumesHandler(req, res);
  }

  if (resource === 'job-matching') {
      return await jobMatchingHandler(req, res);
  }

  if (path.includes('user-profile')) {
    return await userProfileHandler(req, res);
  }

  // Default to users handler for /api/users or generic calls
  return await usersHandler(req, res);
}
