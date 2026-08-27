import { useState } from 'react';
import { ArrowRight, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import clubLogo from '../assets/logo.webp';
import miniprogramQr from '../../miniprogram/public/miniprogram_qrcode.jpg';
import { LinkedInLogo, OutlookLogo, WeChatLogo, XiaohongshuLogo } from './SocialIcons';
import { useLanguage } from '../contexts/LanguageContext';

interface HaigooClubInfoCardProps {
  className?: string;
}

export default function HaigooClubInfoCard({ className = '' }: HaigooClubInfoCardProps) {
  const [openQr, setOpenQr] = useState<'miniprogram' | 'wechat' | null>(null);
  const { text } = useLanguage();

  return (
    <section className={`haigoo-brand-footer ${className}`} aria-labelledby="haigoo-brand-footer-title">
      <div className="haigoo-brand-footer__main">
        <div className="haigoo-brand-footer__intro">
          <img src={clubLogo} alt="" loading="lazy" decoding="async" className="haigoo-brand-footer__mark" />
          <p className="haigoo-editorial-label">Haigoo Remote</p>
          <h3 id="haigoo-brand-footer-title">{text('海狗远程', 'Haigoo Remote')}</h3>
          <p>{text('持续整理来自全球企业公开渠道的远程工作信息，陪你探索适合自己的生活和工作方式。', 'We continuously organise remote-work information from public company sources, helping you explore ways of working and living that suit you.')}</p>
          <a href="/profile?tab=about" className="haigoo-brand-footer__about-link">
            {text('了解 Haigoo', 'About Haigoo')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <div className="haigoo-brand-footer__column">
          <MapPin className="haigoo-brand-footer__icon" aria-hidden="true" />
          <p className="haigoo-editorial-label">{text('运营主体', 'Operated by')}</p>
          <p>{text('行渡科技（杭州）有限责任公司', 'Xingdu Technology (Hangzhou) Co., Ltd.')}<br />{text('杭州市余杭区', 'Yuhang District, Hangzhou')}</p>
        </div>
        <div className="haigoo-brand-footer__column">
          <ShieldCheck className="haigoo-brand-footer__icon" aria-hidden="true" />
          <p className="haigoo-editorial-label">{text('联系方式', 'Contact')}</p>
          <a href="mailto:hi@haigooremote.com">hi@haigooremote.com</a>
          <p>{text('周一至周日 9:00–22:00', 'Daily, 9:00–22:00 (China Standard Time)')}</p>
        </div>
      </div>
      <div className="haigoo-brand-footer__base">
        <small>{text('© 2026 行渡科技（杭州）有限责任公司 版权所有', '© 2026 Xingdu Technology (Hangzhou) Co., Ltd. All rights reserved.')}</small>
        <span className="haigoo-brand-footer__tagline">Be free. Work anywhere. Live fully.</span>
        <div className="haigoo-brand-footer__socials">
          <a
            href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9"
            target="_blank"
            rel="noopener noreferrer"
            className="haigoo-brand-footer__social haigoo-brand-footer__social--labeled"
            aria-label={text('小红书', 'Xiaohongshu')}
          >
            <XiaohongshuLogo className="h-4 w-4" />
            {text('小红书', 'Xiaohongshu')}
          </a>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenQr((value) => value === 'miniprogram' ? null : 'miniprogram')}
              onMouseEnter={() => setOpenQr('miniprogram')}
              className="haigoo-brand-footer__social"
              aria-label={text('微信小程序二维码', 'WeChat Mini Program QR code')}
              aria-expanded={openQr === 'miniprogram'}
            >
              <QrCode className="h-4 w-4" aria-hidden="true" />
            </button>
            {openQr === 'miniprogram' ? (
              <div
                className="haigoo-brand-footer__qr-popover"
                onMouseEnter={() => setOpenQr('miniprogram')}
                onMouseLeave={() => setOpenQr(null)}
              >
                <div className="text-xs font-black text-slate-700">{text('微信小程序', 'WeChat Mini Program')}</div>
                <div className="haigoo-brand-footer__qr-image">
                  <img src={miniprogramQr} alt={text('Haigoo Remote 微信小程序二维码', 'Haigoo Remote WeChat Mini Program QR code')} className="h-full w-full object-contain" />
                </div>
                <div className="mt-2 text-[11px] font-bold leading-5 text-slate-500">{text('微信扫码打开', 'Scan in WeChat to open')}</div>
                <div className="haigoo-brand-footer__qr-caret" />
              </div>
            ) : null}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenQr((value) => value === 'wechat' ? null : 'wechat')}
              onMouseEnter={() => setOpenQr('wechat')}
              className="haigoo-brand-footer__social"
              aria-label={text('微信公众号二维码', 'WeChat official account QR code')}
              aria-expanded={openQr === 'wechat'}
            >
              <WeChatLogo className="h-4 w-4" />
            </button>
            {openQr === 'wechat' ? (
              <div
                className="haigoo-brand-footer__qr-popover"
                onMouseEnter={() => setOpenQr('wechat')}
                onMouseLeave={() => setOpenQr(null)}
              >
                <div className="text-xs font-black text-slate-700">{text('微信公众号', 'WeChat official account')}</div>
                <div className="haigoo-brand-footer__qr-image">
                  <img src="/qrcode.webp" alt={text('Haigoo Remote 微信公众号二维码', 'Haigoo Remote WeChat QR code')} className="h-full w-full object-contain" />
                </div>
                <div className="mt-2 text-[11px] font-bold leading-5 text-slate-500">{text('微信扫码加入', 'Scan to join on WeChat')}</div>
                <div className="haigoo-brand-footer__qr-caret" />
              </div>
            ) : null}
          </div>
          <a
            href="https://www.linkedin.com/company/haigoo/"
            target="_blank"
            rel="noopener noreferrer"
            className="haigoo-brand-footer__social"
            aria-label="LinkedIn"
          >
            <LinkedInLogo className="h-4 w-4" />
          </a>
          <a
            href="mailto:hi@haigooremote.com"
            className="haigoo-brand-footer__social"
            aria-label={text('邮箱', 'Email')}
          >
            <OutlookLogo className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
