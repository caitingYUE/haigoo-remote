
import neonHelper from '../server-utils/dal/neon-helper.js';

async function runOptimization() {
    console.log('Starting Analytics DB Optimization...');
    
    // 1. Ensure Table Exists (Idempotent)
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS analytics_events (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            anonymous_id VARCHAR(255) NOT NULL,
            event_name VARCHAR(100) NOT NULL,
            properties JSONB,
            url TEXT,
            referrer TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    try {
        await neonHelper.query(createTableQuery);
        console.log('✅ Table analytics_events ensured.');
    } catch (e) {
        console.error('❌ Failed to create table:', e.message);
    }

    // 2. Add Indexes for Dashboard Performance
    const indexes = [
        // Time-based filtering is used in ALL dashboard queries
        'CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at)',
        
        // Event name filtering is used in ALL funnel and metric queries
        'CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name)',
        
        // Composite index for specific event counts over time (Covering Index)
        'CREATE INDEX IF NOT EXISTS idx_analytics_event_time ON analytics_events(event_name, created_at)',
        
        // UV calculations rely heavily on anonymous_id
        'CREATE INDEX IF NOT EXISTS idx_analytics_anon_id ON analytics_events(anonymous_id)',
        
        // User-level tracking
        'CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id)'
    ];

    for (const idx of indexes) {
        try {
            await neonHelper.query(idx);
            console.log(`✅ Index created: ${idx.split('ON')[1] || idx}`);
        } catch (e) {
            console.error(`❌ Failed to create index: ${idx}`, e.message);
        }
    }

    console.log('Analytics DB Optimization Completed.');
}

// Execute
runOptimization();

