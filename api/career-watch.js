import careerWatchHandler from '../lib/api-handlers/career-watch.js'

export default async function handler(req, res) {
  return careerWatchHandler(req, res)
}
