import bugReportsHandler from '../lib/api-handlers/bug-reports.js'

export default async function handler(req, res) {
  return await bugReportsHandler(req, res)
}
