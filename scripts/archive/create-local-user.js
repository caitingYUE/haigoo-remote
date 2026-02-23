
import { saveUser } from '../server-utils/user-storage.js';
import bcrypt from 'bcryptjs';

async function createTestUser() {
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
        id: 'test-user-id-' + Date.now(),
        email,
        passwordHash: hashedPassword,
        username: 'Test User',
        roles: { user: true, admin: true },
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    console.log('Creating test user:', user.email);
    const result = await saveUser(user);

    if (result.success) {
        console.log('Test user created successfully!');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('Provider:', result.provider);
    } else {
        console.error('Failed to create test user.');
    }
    process.exit(0);
}

createTestUser();
