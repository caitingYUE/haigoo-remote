
import 'dotenv/config';
import neonHelper from './server-utils/dal/neon-helper.js';

async function debugData() {
    console.log('--- Debugging Data for caitlinyct@gmail.com ---');
    
    try {
        // 1. Get User ID
        const users = await neonHelper.query("SELECT id, user_id, email, roles, membership_level FROM users WHERE email = 'caitlinyct@gmail.com'");
        if (!users || users.length === 0) {
            console.log('❌ User not found');
            return;
        }
        const user = users[0];
        console.log('User:', user);
        const userId = user.user_id;

        // 2. Check Notifications
        const notifs = await neonHelper.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
        console.log(`Found ${notifs ? notifs.length : 0} notifications.`);
        if (notifs && notifs.length > 0) {
            console.log('Latest notification:', notifs[0]);
        }

        // 3. Check Applications
        const apps = await neonHelper.query("SELECT * FROM club_applications WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
        console.log(`Found ${apps ? apps.length : 0} applications.`);
        if (apps && apps.length > 0) {
            console.log('Latest application:', apps[0]);
        } else {
            console.log('Creating test application...');
            await neonHelper.query(`
                INSERT INTO club_applications (user_id, experience, career_ideal, portfolio, expectations, contribution, contact, contact_type, status)
                VALUES ($1, 'Test Experience', 'Test Ideal', 'Test Portfolio', 'Test Expectations', 'Test Contribution', 'test@test.com', 'email', 'pending')
            `, [userId]);
            console.log('Test application created.');
        }

        // 4. Check Feedbacks & Replies
        // We need to find feedbacks from this user to check if they have replies
        const feedbacks = await neonHelper.query("SELECT * FROM feedbacks WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
        console.log(`Found ${feedbacks ? feedbacks.length : 0} feedbacks.`);
        if (feedbacks && feedbacks.length > 0) {
            console.log('Latest feedback:', feedbacks[0]);
        }

    } catch (e) {
        console.error('Debug failed:', e);
    }
}

debugData().then(() => process.exit(0));
