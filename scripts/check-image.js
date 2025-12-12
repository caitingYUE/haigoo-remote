
async function checkImage() {
    const url = 'https://www.bluente.com/_next/static/media/single-logo.d14663a6.png';
    try {
        const res = await fetch(url);
        console.log(`URL: ${url}`);
        console.log(`Status: ${res.status} ${res.statusText}`);
        console.log(`Content-Type: ${res.headers.get('content-type')}`);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
checkImage();
