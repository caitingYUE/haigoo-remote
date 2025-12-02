
import usersHandler from '../lib/api-handlers/users.js';
import userProfileHandler from '../lib/api-handlers/user-profile.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  console.log('[API:Users] Request Path:', path);

  if (path.includes('user-profile')) {
    return await userProfileHandler(req, res);
  }

  // Default to users handler for /api/users or generic calls
  return await usersHandler(req, res);
}