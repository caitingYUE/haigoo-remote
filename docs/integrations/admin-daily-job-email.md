# 管理员每日社群推送邮件

## 目标

每天北京时间上午 10:00，自动向管理员邮箱发送两套可复制的社群推送文案：

- `非会员群`
  - 优先发送 `is_featured = true` 且 `can_refer != true` 的已审核岗位
  - 近 3 天内不重复发送同一个 `job_id`
  - 若精选岗位不足，则自动从非精选、非会员专属岗位补足
- `会员群`
  - 优先发送 `can_refer = true` 的会员专属岗位
  - 其次发送精选岗位
  - 近 5 天内不重复发送同一个 `job_id`
  - 若优先池不足，则自动从非精选、非会员专属岗位补足

邮件正文会附带两段中文可复制文案，同时在管理后台 `/admin_team?tab=social-push` 提供独立预览和一键复制按钮。

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
  - 通过 `recipient::public` / `recipient::member` 区分两套去重历史
