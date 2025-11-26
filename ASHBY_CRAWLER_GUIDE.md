# Ashby Job Crawler - Quick Reference

## 🚀 Quick Start

### For EverAI (or any Ashby-hosted company)

1. **Navigate to Admin Panel** → Trusted Companies
2. **Find or Add EverAI**
   - Name: EverAI
   - Careers Page: `https://jobs.ashbyhq.com/everai`
3. **Click "Crawl Jobs"**
4. **Wait for completion** - Should find ~247 jobs

## 📊 Expected Results

- **Total Jobs**: 247 (as of test date)
- **All Remote**: Yes (100%)
- **Categories**:
  - 市场营销 (Marketing): 135
  - 人工智能 (AI): 75
  - UI/UX设计 (Design): 36
  - 质量保证 (QA): 1

## 🔧 API Usage

### Basic Crawl
```bash
curl -X POST 'http://localhost:3000/api/data/trusted-companies?action=crawl-jobs&id=everai' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### With Details
```bash
curl -X POST 'http://localhost:3000/api/data/trusted-companies?action=crawl-jobs&id=everai&fetchDetails=true&maxDetails=10' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

## 🧪 Testing

```bash
# Run test script
node test-ashby-parser.js

# Expected output: 247 jobs found
```

## ✅ Verification Checklist

- [ ] Jobs appear in admin panel
- [ ] Job titles are in Chinese (中级营销人员)
- [ ] Locations show correctly (Albania (Remote))
- [ ] Categories are properly assigned (市场营销)
- [ ] Tags are extracted (Growth, Adult Marketing)
- [ ] Job URLs are clickable and valid
- [ ] "已审核" badge shows (for trusted companies)
- [ ] "可内推" badge shows (if company.canRefer is true)

## 🐛 Troubleshooting

### No jobs found
- Check if URL is correct: `https://jobs.ashbyhq.com/[company]`
- Verify company has active job listings
- Check browser console for errors

### Jobs not displaying
- Clear browser cache
- Refresh the page
- Check if jobs were saved to database

### Wrong categories
- Review department/team names in Ashby data
- Update categorization logic in `ashby-parser.js`

## 📝 Supported Ashby URLs

- `jobs.ashbyhq.com/*`
- `*.ashbyhq.com/*`
- Any URL containing `ashby`

## 🎯 Key Features

✅ Automatic detection of Ashby job boards
✅ Extracts all job data from window.__appData
✅ Smart categorization (28 categories)
✅ Tag extraction (tech stack, department, team)
✅ Remote job detection
✅ Experience level inference
✅ Optional AI enhancement (DeepSeek)

## 📚 Related Files

- [ashby-parser.js](file:///Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/lib/ashby-parser.js) - Main parser
- [job-crawler.js](file:///Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/lib/job-crawler.js) - Crawler integration
- [deepseek-parser.js](file:///Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/lib/deepseek-parser.js) - AI enhancement
- [test-ashby-parser.js](file:///Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/test-ashby-parser.js) - Test script
