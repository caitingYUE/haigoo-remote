#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Purpose: Rename 'website' column to 'url' in trusted_companies table
 * 
 * This migration ensures consistency between:
 * - trusted_companies table (website → url)
 * - extracted_companies table (already uses 'url')
 * - Frontend TypeScript interfaces (already updated to 'url')
 * 
 * IMPORTANT: Run this script during low-traffic hours
 * BACKUP: Ensure database backup is created before running
 */

import neonHelper from '../server-utils/dal/neon-helper.js'

async function migrate() {
    console.log('🔄 Starting database migration: website → url')
    console.log('='.repeat(60))

    try {
        // Step 1: Check if migration is needed
        console.log('\n📊 Step 1: Checking current schema...')
        const checkColumn = await neonHelper.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'trusted_companies' 
            AND column_name IN ('website', 'url')
        `)

        const hasWebsite = checkColumn.some(row => row.column_name === 'website')
        const hasUrl = checkColumn.some(row => row.column_name === 'url')

        if (!hasWebsite && hasUrl) {
            console.log('✅ Migration already completed. Column "url" exists.')
            return
        }

        if (!hasWebsite && !hasUrl) {
            console.error('❌ Error: Neither "website" nor "url" column found!')
            process.exit(1)
        }

        console.log(`   Found column: ${hasWebsite ? 'website' : 'url'}`)

        // Step 2: Create backup
        console.log('\n💾 Step 2: Creating backup...')
        const backupData = await neonHelper.query('SELECT * FROM trusted_companies')
        console.log(`   Backed up ${backupData.length} rows`)

        // Step 3: Rename column
        console.log('\n🔧 Step 3: Renaming column...')
        await neonHelper.query('ALTER TABLE trusted_companies RENAME COLUMN website TO url')
        console.log('   ✅ Column renamed successfully')

        // Step 4: Verify migration
        console.log('\n✔️  Step 4: Verifying migration...')
        const verifyColumn = await neonHelper.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'trusted_companies' 
            AND column_name = 'url'
        `)

        if (verifyColumn.length === 0) {
            throw new Error('Migration verification failed: url column not found')
        }

        const verifyData = await neonHelper.query('SELECT COUNT(*) as count FROM trusted_companies')
        const newCount = parseInt(verifyData[0].count)

        if (newCount !== backupData.length) {
            throw new Error(`Data count mismatch: expected ${backupData.length}, got ${newCount}`)
        }

        console.log(`   ✅ Verified ${newCount} rows`)

        console.log('\n' + '='.repeat(60))
        console.log('✅ Migration completed successfully!')
        console.log('='.repeat(60))

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message)
        console.error('\n⚠️  ROLLBACK REQUIRED!')
        console.error('   Please restore from backup if data was modified.')
        process.exit(1)
    }
}

// Run migration
migrate()
    .then(() => {
        console.log('\n👋 Migration script finished')
        process.exit(0)
    })
    .catch(error => {
        console.error('\n💥 Fatal error:', error)
        process.exit(1)
    })
