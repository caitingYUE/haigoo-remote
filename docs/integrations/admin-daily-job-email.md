# 管理员每日精选岗位邮件

## 目标

每天北京时间上午 10:00，自动向管理员邮箱发送 3-5 条岗位：

- 优先发送 `is_featured = true` 的已审核岗位
- 近 5 天内不重复发送同一个 `job_id`
- 若精选岗位不足，则自动从非精选已审核岗位补足

## 依赖

- `RESEND_API_KEY`
- `FROM_EMAIL`
- `FROM_NAME`
- `ADMIN_DAILY_DIGEST_EMAIL`
- `DATABASE_URL`

## 定时入口

- Vercel Cron: `/api/cron/admin-daily-featured-email`
- 调度时间: `0 2 * * *`（UTC），即 `10:00`（UTC+8 / Asia/Shanghai）

## 手动验证

查看配置状态：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain/api/cron/admin-daily-featured-email?action=status"
```

预览本次会选中的岗位，不发邮件：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain/api/cron/admin-daily-featured-email?action=preview"
```

立即执行一次发送：

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain/api/cron/admin-daily-featured-email?action=run"
```

如果当天已经发送过，但本次需要重新尝试失败批次：

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain/api/cron/admin-daily-featured-email?action=run&force=true"
```

## 数据表

- `admin_daily_job_email_runs`
  - 记录每天是否已发送、是否失败、发送了多少条
- `admin_daily_job_email_history`
  - 记录每次邮件中的 `job_id`
  - 用于“5 天内不重复”筛选
