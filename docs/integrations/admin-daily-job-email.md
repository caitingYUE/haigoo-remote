# 管理后台社群推送缓存

## 目标

每天北京时间上午 10:00（UTC+8 / Asia/Shanghai），在管理后台生成并缓存两套可复制的社群推送文案：

- `非会员群`
  - 优先发送 `is_featured = true` 且 `can_refer != true` 的已审核岗位
  - 近 3 天内不重复发送同一个 `job_id`
  - 若精选岗位不足，则自动从非精选、非会员专属岗位补足
- `会员群`
  - 优先发送 `can_refer = true` 的会员专属岗位
  - 其次发送精选岗位
  - 近 5 天内不重复发送同一个 `job_id`
  - 若优先池不足，则自动从非精选、非会员专属岗位补足

管理员只需要在 `/admin_team?tab=social-push` 查看和复制，不再发送邮件。
页面默认展示“当前调度批次”的缓存内容：
- 若当前时间已到 10:00，则展示当天批次
- 若当前时间未到 10:00，则展示上一批次
- 点击“手动刷新”会确保“当天批次”存在；同一天多次点击不会重复计算，只返回当天已缓存结果

## 依赖

- `ADMIN_DAILY_DIGEST_EMAIL`
- `DATABASE_URL`

## 接口入口

- 预览当前应展示的批次：`/api/cron/admin-daily-featured-email?action=preview`
- 手动确保当天批次存在：`/api/cron/admin-daily-featured-email?action=refresh`

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

手动生成当天缓存（若当天已生成，则直接返回缓存）：

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain/api/cron/admin-daily-featured-email?action=refresh"
```

## 数据表

- `admin_daily_job_email_runs`
  - 现在作为“按天缓存表”使用
  - 记录某个批次是否已生成、生成了多少条、以及完整预览 payload
- `admin_daily_job_email_history`
  - 记录每次批次中的 `job_id`
  - 通过 `recipient::public` / `recipient::member` 区分两套去重历史
