import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import './index.scss'

const privacySections = [
  {
    title: '一、我们收集的信息',
    body: '为提供账号连接、企业资料、职业成长笔记、职业咨询和会员权益购买服务，我们可能处理微信 OpenID、邮箱、账号信息、会员权益状态、企业与内容访问记录、咨询方向、微信号和问题描述，以及支付订单号、所购方案、金额和交易状态。我们不会保存您的银行卡号、支付密码，也不会在小程序中保存您的账号密码。'
  },
  {
    title: '二、信息使用目的',
    body: '上述信息仅用于身份识别、同步网站账号权益、提供企业与成长内容、跟进您主动提交的咨询、处理支付与退款、发放会员权益、处理反馈、排查故障和防范滥用。未经授权，我们不会将信息用于与上述目的无关的用途。'
  },
  {
    title: '三、存储与第三方处理',
    body: '小程序服务使用腾讯云云开发/云托管，通过 Haigoo Remote 网站服务处理账号与业务数据，并使用微信官方小程序虚拟支付处理交易。部分网站基础设施可能部署在中国大陆以外地区；我们会遵循适用法律采取访问控制、传输加密和最小化处理措施。具体第三方清单及跨境安排以正式隐私保护指引为准。'
  },
  {
    title: '四、保存期限与安全',
    body: '我们仅在实现服务目的和履行法定义务所需的期限内保存信息。账号注销后将按法律要求删除或匿名化相关数据；安全审计、争议处理和注销锁定记录可能在必要期限内保留。'
  },
  {
    title: '五、您的权利',
    body: '您可以在“我的—账号与安全”中退出登录、解除微信绑定或申请注销账号，也可以联系我们查询、更正或删除个人信息。注销后相关数据不可恢复，且同一邮箱 30 天内不能重新注册。'
  },
  {
    title: '六、联系我们',
    body: '运营主体：行渡科技（杭州）有限责任公司。隐私与投诉邮箱：hi@haigooremote.com。我们会在核验身份后处理您的请求。'
  }
]

const termsSections = [
  {
    title: '一、服务性质',
    body: 'Haigoo Remote 提供远程企业资料、职业成长内容、职业咨询和会员服务。相关资料用于职业研究与准备，不代表任何企业作出录用承诺，也不保证获得特定职业结果。'
  },
  {
    title: '二、账号与安全',
    body: '您应提供真实、有效的邮箱并妥善保管账号密码。一个微信身份只能连接一个 Haigoo Remote 账号。发现账号异常时请及时修改密码或联系我们。'
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
        <Text className='legal-page__version'>版本：2026-07-29 · 生效日期：正式发布之日</Text>
      </View>
      <View className='legal-page__content'>
        <Text className='legal-page__intro'>欢迎使用 Haigoo Remote 微信小程序。请在注册或继续使用前仔细阅读以下内容。</Text>
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
