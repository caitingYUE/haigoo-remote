
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';

// Helper to clean text
const cleanText = (text) => {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
};

// Regex patterns
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
const PHONE_REGEX = /(\+?\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/;

// Common Skills (can be expanded)
const COMMON_SKILLS = [
    'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'Go', 'Golang',
    'C++', 'C#', '.NET', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Flutter', 'React Native',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'Git',
    'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'Machine Learning', 'AI', 'Deep Learning', 'NLP', 'TensorFlow', 'PyTorch',
    'Product Management', 'Agile', 'Scrum', 'Jira',
    'UI/UX', 'Figma', 'Sketch', 'Adobe'
];

export async function parseResume(buffer, fileType) {
    let text = '';
    
    try {
        if (fileType === 'application/pdf') {
            const data = await pdf(buffer);
            text = data.text;
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // docx
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        } else if (fileType === 'text/plain') {
            text = buffer.toString('utf8');
        } else {
            // Try text anyway
            text = buffer.toString('utf8');
        }
    } catch (e) {
        console.error('Resume parsing failed:', e);
        return { text: '', metadata: {} };
    }

    const cleanContent = cleanText(text);

    // Extract Metadata
    const emailMatch = cleanContent.match(EMAIL_REGEX);
    const phoneMatch = cleanContent.match(PHONE_REGEX);
    
    // Extract Skills
    const skills = COMMON_SKILLS.filter(skill => {
        // Simple case-insensitive match, boundary check
        const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(cleanContent);
    });

    // Heuristic for Name: First non-empty line usually
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const potentialName = lines.length > 0 ? lines[0].substring(0, 50) : '';

    return {
        text: cleanContent,
        metadata: {
            email: emailMatch ? emailMatch[0] : null,
            phone: phoneMatch ? phoneMatch[0] : null,
            name: potentialName,
            skills: skills
        }
    };
}
