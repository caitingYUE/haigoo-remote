// Debug script for Ashby GraphQL API
const orgName = 'kraken.com';
const jobId = '13c6eb61-693f-406b-98bf-b7b2a2d521fb';

async function test() {
    console.log('Testing GraphQL fetch...');
    console.log('Org:', orgName);
    console.log('Job ID:', jobId);

    const response = await fetch('https://jobs.ashbyhq.com/api/non-user-graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            operationName: 'apiJobPosting',
            variables: {
                organizationHostedJobsPageName: orgName,
                jobPostingId: jobId
            },
            query: `query apiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
                jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) {
                    id
                    title
                    descriptionHtml
                }
            }`
        })
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Has descriptionHtml:', !!data?.data?.jobPosting?.descriptionHtml);
    console.log('descriptionHtml length:', data?.data?.jobPosting?.descriptionHtml?.length || 0);
    console.log('Preview:', data?.data?.jobPosting?.descriptionHtml?.substring(0, 100));
}

test().catch(console.error);
