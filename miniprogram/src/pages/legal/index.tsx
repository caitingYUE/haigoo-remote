import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { MINI_AGREEMENT_VERSION, MINI_PRIVACY_VERSION } from '../../config/legal'
import './index.scss'

const privacySections = [
  {
    title: '一、我们收集的信息',
    body: '为提供账号连接、企业资料、职业成长笔记、职业咨询和会员权益购买服务，我们可能处理微信 OpenID、邮箱、账号信息、会员权益状态、企业与内容访问记录、咨询方向、微信号和问题描述，以及支付订单号、所购方案、金额和交易状态。我们不会保存您的银行卡号、支付密码，也不会在小程序中保存您的账号密码。'
  },
  {
    title: '二、邮箱的收集与使用',
    body: '收集方式：在您主动填写邮箱、勾选同意《用户服务协议》和《隐私政策》并提交注册、登录连接或找回密码请求后，我们将邮箱通过加密传输提交至 HaigooRemote 账号服务；微信登录已连接的账号时，会同步该账号已保存的邮箱，用于账号识别与展示。我们不会读取您的邮箱通讯录或收件箱。\n\n使用目的：邮箱用于账号注册与验证、登录和网站账号连接、忘记密码时发送重置邮件，以及会员生效、失效等必要服务通知。注册成功后会发送验证邮件；注册或验证失败等操作结果也可能通过页面反馈，并非每次失败都会发送邮件。密码重置是否发送取决于账号状态，为保护账号安全，页面不会披露邮箱是否已注册。\n\n处理方式：邮箱随账号资料保存在服务端数据库；登录后的小程序本地会保存账号邮箱，用于账号展示，退出登录时清除本地会话资料。发送邮件时，我们委托 Resend 邮件服务处理收件邮箱、邮件主题及必要正文（如昵称、验证或重置链接、会员期限），并处理必要的邮件发送与故障日志。不会向邮件服务发送您的账号密码。上述服务通知不等同于营销订阅，不因同意本政策而自动订阅营销邮件。\n\n拒绝与管理：您可以不勾选同意、不提交邮箱，继续浏览公开企业和岗位；邮箱账号注册、连接及密码找回将无法完成。您可以通过“账号与安全”申请注销，或联系 hi@haigooremote.com 查询、更正、删除邮箱及相关信息。解除微信绑定不会删除网站账号邮箱。'
  },
  {
    title: '三、其他信息使用目的',
    body: '上述信息仅用于身份识别、同步网站账号权益、提供企业与成长内容、跟进您主动提交的咨询、处理支付与退款、发放会员权益、处理反馈、排查故障和防范滥用。未经授权，我们不会将信息用于与上述目的无关的用途。'
  },
  {
    title: '四、存储与第三方处理',
    body: '小程序服务使用腾讯云云开发/云托管，通过 HaigooRemote 网站服务处理账号与业务数据，并使用微信官方小程序虚拟支付处理交易。部分网站基础设施可能部署在中国大陆以外地区；我们会遵循适用法律采取访问控制、传输加密和最小化处理措施。具体第三方清单及跨境安排以正式隐私保护指引为准。'
  },
  {
    title: '五、保存期限与安全',
    body: '邮箱随账号在提供账号识别、找回密码和服务通知所必需的期间保存；邮件发送及故障日志仅在实现发送、安全排查和履行法定义务所需的必要期限内保留。账号注销后将按法律要求删除或匿名化相关数据；安全审计、交易争议处理和注销锁定记录可能在必要期限内保留。退出登录会清除小程序本地会话资料，但不会注销网站账号。我们通过加密传输和访问控制限制邮箱等信息的使用范围。'
  },
  {
    title: '六、您的权利',
    body: '您可以在“我的—账号与安全”中退出登录、解除微信绑定或申请注销账号，也可以联系我们查询、更正或删除个人信息。注销后相关数据不可恢复，且同一邮箱 30 天内不能重新注册。'
  },
  {
    title: '七、联系我们',
    body: '运营主体：行渡科技（杭州）有限责任公司。隐私与投诉邮箱：hi@haigooremote.com。我们会在核验身份后处理您的请求。'
  }
]

const termsSections = [
  {
    title: '一、服务性质',
    body: 'HaigooRemote 提供远程企业资料、职业成长内容、职业咨询和会员服务。相关资料用于职业研究与准备，不代表任何企业作出录用承诺，也不保证获得特定职业结果。'
  },
  {
    title: '二、账号与安全',
    body: '您应提供真实、有效的邮箱并妥善保管账号密码。一个微信身份只能连接一个 HaigooRemote 账号。发现账号异常时请及时修改密码或联系我们。'
  },
  {
    title: '三、企业与成长内容',
    body: '小程序展示的企业信息和职业成长内容来自公开、可信来源或经授权整理的材料，并可能经过筛选、翻译和编辑。内容仅作职业研究和学习参考，您应结合自身情况独立判断。'
  },
  {
    title: '四、会员权益',
    body: '小程序内的 Club 权益属于虚拟服务，购买统一使用微信官方小程序虚拟支付。付款前页面会展示方案名称、价格和服务期限；微信确认到账后，网站与小程序权益自动同步生效。客户端支付成功提示不作为到账或发放权益的唯一依据。'
  },
  {
    title: '五、退款与售后',
    body: '退款将依据适用法律、微信虚拟支付规则、方案约定和服务实际交付情况处理。如发生重复扣款、到账后权益未开通或其他交易异常，请通过“我的—帮助与反馈”或 hi@haigooremote.com 联系我们，并提供订单号以便核验。'
  },
  {
    title: '六、合理使用',
    body: '不得利用本服务批量抓取、倒卖企业或内容数据、攻击接口、冒用他人身份或从事违法活动。为保障安全，我们可以对异常访问采取限流、暂停服务等措施。'
  },
  {
    title: '七、反馈与争议',
    body: '如发现企业资料错误、内容权利问题、服务争议或其他问题，请通过“我的—帮助与反馈”或 hi@haigooremote.com 联系我们。'
  }
]

export default function LegalPage() {
  const router = useRouter()
  const isTerms = router.params.type === 'terms'
  const sections = isTerms ? termsSections : privacySections

  return (
    <View className='legal-page'>
      <View className='legal-page__hero'>
        <Text className='legal-page__title'>{isTerms ? '用户服务协议' : '隐私政策'}</Text>
        <Text className='legal-page__version'>版本：{isTerms ? MINI_AGREEMENT_VERSION : MINI_PRIVACY_VERSION} · 生效日期：正式发布之日</Text>
      </View>
      <View className='legal-page__content'>
        <Text className='legal-page__intro'>欢迎使用 HaigooRemote 微信小程序。请在登录、注册或提交个人信息前仔细阅读以下内容，并自主决定是否同意。</Text>
        {sections.map((section) => (
          <View className='legal-section' key={section.title}>
            <Text className='legal-section__title'>{section.title}</Text>
            <Text className='legal-section__body'>{section.body}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
