
async function checkJobUrl() {
    const url = "https://scopicsoftware.zohorecruit.com/jobs/Careers/741923000037955058/Remote-Marketing-Specialist?source=CareerSite";
    console.log(`Checking Job URL: ${url}`);
    
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log(`Status: ${response.status}`);
    } catch (e) {
        console.error('Check failed:', e);
    }
}

checkJobUrl();
