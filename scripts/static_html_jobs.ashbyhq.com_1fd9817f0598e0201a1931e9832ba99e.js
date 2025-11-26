// https://jobs.ashbyhq.com/everai
// generate by deepseek
async function extractInfo(htmlContent, cheerio) {
    const $ = cheerio.load(htmlContent);
    let result = "职位名称,职位类型,简介,详情,地点要求,申请链接\n";
    
    // 从script标签中提取JSON数据
    const scriptContent = $('script[nonce]').html();
    const appDataMatch = scriptContent.match(/window\.__appData\s*=\s*({[^;]+});/);
    
    if (appDataMatch && appDataMatch[1]) {
        try {
            const appData = JSON.parse(appDataMatch[1]);
            const jobPostings = appData.jobBoard?.jobPostings || [];
            
            jobPostings.forEach(job => {
                if (job.isListed) {
                    const title = job.title || '';
                    const department = job.departmentName || '';
                    const team = job.teamName || '';
                    const location = job.locationName || '';
                    const workplaceType = job.workplaceType || '';
                    const employmentType = job.employmentType || '';
                    
                    // 构建职位类型
                    const jobType = `${department} - ${team}`;
                    
                    // 构建简介
                    const intro = `${employmentType} | ${workplaceType}`;
                    
                    // 构建详情
                    const details = `发布时间: ${job.publishedDate || 'N/A'}`;
                    
                    // 构建地点要求
                    const locationRequirement = `${location} (${workplaceType})`;
                    
                    // 构建申请链接
                    const applyLink = `https://jobs.ashbyhq.com/everai/${job.id}`;
                    
                    // 添加到结果中
                    result += `"${title}","${jobType}","${intro}","${details}","${locationRequirement}","${applyLink}"\n`;
                }
            });
            
        } catch (error) {
            result = "解析JSON数据时出错";
        }
    } else {
        result = "未找到职位数据";
    }
    
    return result;
}