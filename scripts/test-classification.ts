import { ClassificationService } from '../src/services/classification-service';

const testJobs = [
    { title: 'Senior Frontend Engineer', description: 'React, TypeScript, CSS' },
    { title: 'Backend Developer', description: 'Node.js, PostgreSQL, Redis' },
    { title: 'Product Manager', description: 'Roadmap, User Stories, Agile' },
    { title: 'Data Scientist', description: 'Python, Machine Learning, SQL' },
    { title: 'Customer Support Specialist', description: 'Zendesk, Email, Chat' },
    { title: 'HR Manager', description: 'Recruiting, Employee Relations' },
    { title: 'DevOps Engineer', description: 'AWS, Docker, Kubernetes' },
    { title: 'Unknown Role', description: 'Some random description' }
];

const testCompanies = [
    { name: 'Google', description: 'Search engine and internet services' },
    { name: 'OpenAI', description: 'Artificial Intelligence research and deployment' },
    { name: 'Stripe', description: 'Financial infrastructure platform for the internet' },
    { name: 'Coursera', description: 'Online learning platform' },
    { name: 'Pfizer', description: 'Pharmaceutical and biotechnology corporation' },
    { name: 'Shopify', description: 'E-commerce platform for online stores' },
    { name: 'Unity', description: 'Real-time 3D development platform (Game Engine)' }
];

console.log('--- Testing Job Classification ---');
testJobs.forEach(job => {
    const category = ClassificationService.classifyJob(job.title, job.description);
    console.log(`Job: "${job.title}" -> Category: ${category}`);
});

console.log('\n--- Testing Company Classification ---');
testCompanies.forEach(company => {
    const result = ClassificationService.classifyCompany(company.name, company.description);
    console.log(`Company: "${company.name}" -> Industry: ${result.industry}, Tags: [${result.tags.join(', ')}]`);
});
