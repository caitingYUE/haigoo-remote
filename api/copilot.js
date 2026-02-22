
import copilotHandler from '../lib/api-handlers/copilot.js';

export default async function handler(req, res) {
  return await copilotHandler(req, res);
}
