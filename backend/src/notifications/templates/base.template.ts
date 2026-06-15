export interface BusinessConfig {
  name: string;
  systemName: string;
  supportEmail: string;
  website: string;
}

/**
 * Wraps arbitrary HTML content in the shared branded email shell.
 * All email templates should call this instead of writing their own <html> wrapper.
 */
export function baseEmailTemplate(content: string, biz: BusinessConfig): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${biz.systemName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #333; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 32px; text-align: center; }
    .header h1 { color: #e94560; font-size: 30px; font-weight: 800; letter-spacing: 3px; }
    .header p { color: rgba(255,255,255,0.6); margin-top: 4px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; }
    .body { padding: 36px 32px; }
    .info-card { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 16px 0; border-left: 4px solid #e94560; }
    .info-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .label { color: #777; font-weight: 500; }
    .value { color: #222; font-weight: 600; text-align: right; max-width: 60%; }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; background: #e94560; color: white; text-transform: uppercase; }
    .badge-green { background: #22c55e; }
    .badge-orange { background: #f59e0b; }
    .footer { background: #1a1a2e; padding: 24px 32px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.45); font-size: 12px; line-height: 1.8; }
    .footer a { color: #e94560; text-decoration: none; }
    .divider { height: 1px; background: #eee; margin: 24px 0; }
    .note { color: #666; font-size: 13px; line-height: 1.6; margin-top: 16px; padding: 12px 16px; background: #fffbf0; border-radius: 6px; border-left: 3px solid #f59e0b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${biz.systemName.toUpperCase()}</h1>
      <p>${biz.name}</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${biz.name}. All rights reserved.</p>
      <p style="margin-top:6px;">
        Questions? <a href="mailto:${biz.supportEmail}">${biz.supportEmail}</a>
        &nbsp;·&nbsp;
        <a href="${biz.website}">${biz.website}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
