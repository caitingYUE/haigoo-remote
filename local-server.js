
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

async function startServer() {
    try {
        console.log('Importing auth handler...');
        const authHandler = (await import('./api/auth.js')).default;
        app.all('/api/auth', async (req, res) => { await authHandler(req, res); });
        console.log('Auth handler imported.');

        console.log('Importing users handler...');
        const usersHandler = (await import('./api/users.js')).default;
        app.all('/api/users', async (req, res) => { await usersHandler(req, res); });
        console.log('Users handler imported.');

        console.log('Importing user-profile handler...');
        const userProfileHandler = (await import('./api/user-profile.js')).default;
        app.all('/api/user-profile', async (req, res) => { await userProfileHandler(req, res); });
        console.log('User-profile handler imported.');

        console.log('Importing parse-resume handler...');
        const parseResumeHandler = (await import('./api/parse-resume-new.js')).default;
        app.all('/api/parse-resume-new', async (req, res) => { await parseResumeHandler(req, res); });
        console.log('Parse-resume handler imported.');

        app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', env: 'local' });
        });

        app.listen(PORT, () => {
            console.log(`Local API server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
