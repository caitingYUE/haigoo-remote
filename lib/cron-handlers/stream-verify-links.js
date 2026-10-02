import jobSyncHandler from './job-sync.js'
import { verifyPosting } from '../services/job-sync/adapters.js'
import { externalIdentity } from '../services/job-sync/policy.js'

export async function checkUrlStatus(url) {
    const result = await verifyPosting({ external_id: externalIdentity(url), payload: { url } })
    return { status: result.state === 'closed' ? 'dead' : result.state === 'open' ? 'alive' : 'ambiguous', reason: result.reason }
}

// The legacy scheduled endpoint is retired; URL checks require a manual session.
export default jobSyncHandler
