
import 'dotenv/config'
import neonHelper from '../server-utils/dal/neon-helper.js'

async function setupSubscriptionTracking() {
  console.log('Checking subscription tracking columns...')
  
  if (!neonHelper.isConfigured) {
    console.error('Neon is not configured.')
    process.exit(1)
  }

  try {
    // Add fail_count column if not exists
    await neonHelper.query(`
      ALTER TABLE subscriptions 
      ADD COLUMN IF NOT EXISTS fail_count INTEGER DEFAULT 0;
    `)
    console.log('Added fail_count column.')

    // Add last_active_at column if not exists (for general activity tracking)
    await neonHelper.query(`
      ALTER TABLE subscriptions 
      ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;
    `)
    console.log('Added last_active_at column.')
    
  } catch (error) {
    console.error('Error migrating subscriptions table:', error)
  }
}

setupSubscriptionTracking()
