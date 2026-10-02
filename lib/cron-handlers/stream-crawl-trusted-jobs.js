// Permanently retire every legacy entry, including the direct local-server route.
export default function handler(_req, res) {
  return res.status(410).json({ success: false, error: '旧企业爬虫已停用；请在可信企业页面手动使用“更新检查”。' })
}
