import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import './index.scss'

const privacySections = [
  {
    title: '一、我们收集的信息',
    body: '为提供账号连接、岗位浏览、收藏、申请入口记录和会员订阅服务，我们可能处理微信 OpenID、邮箱、账号信息、会员状态、收藏与申请记录、订阅方向、搜索和岗位浏览记录，以及保障服务安全所需的设备、网络和运行日志。我们不会在小程序中保存您的账号密码。'
  },
  {
    title: '二、信息使用目的',
    body: '上述信息仅用于身份识别、同步网站账号权益、提供岗位筛选和咨询配套功能、控制免费浏览额度、发送您主动订阅的邮件、处理反馈、排查故障和防范滥用。未经授权，我们不会将信息用于与上述目的无关的用途。'
  },
  {
    title: '三、存储与第三方处理',
    body: '小程序服务使用腾讯云云开发/云托管，并通过 Haigoo Remote 网站服务处理账号与业务数据。部分网站基础设施可能部署在中国大陆以外地区；我们会遵循适用法律采取访问控制、传输加密和最小化处理措施。具体第三方清单及跨境安排以正式隐私保护指引为准。'
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
    body: 'Haigoo Remote 提供远程岗位信息筛选、展示及职业咨询配套工具。我们不是岗位发布企业，不代表用人单位作出录用承诺，也不保证外部岗位持续有效、申请成功或获得特定结果。'
  },
  {
    title: '二、账号与安全',
    body: '您应提供真实、有效的邮箱并妥善保管账号密码。一个微信身份只能连接一个 Haigoo Remote 账号。发现账号异常时请及时修改密码或联系我们。'
  },
  {
    title: '三、岗位与外部申请',
    body: '小程序展示的信息来自企业官网或其他公开、可信来源，并可能经过筛选、翻译和整理。申请会在企业官网、邮箱或网站内推说明中完成；打开或复制申请入口不代表已经完成申请，您应自行确认岗位真实性及外部网站规则。'
  },
  {
    title: '四、会员与订阅',
    body: '首发版本仅展示会员服务并同步已有会员权益，不在小程序内完成付款。会员服务的具体内容、期限和开通方式以双方确认的咨询服务方案为准。'
  },
  {
    title: '五、合理使用',
    body: '不得利用本服务批量抓取、倒卖岗位数据、攻击接口、冒用他人身份或从事违法活动。为保障安全，我们可以对异常访问采取限流、暂停服务等措施。'
  },
  {
    title: '六、反馈与争议',
    body: '如发现岗位失效、信息错误、权利侵害或其他问题，请通过“我的—帮助与反馈”或 hi@haigooremote.com 联系我们。'
  }
]

export default function LegalPage() {
  const router = useRouter()
  const isTerms = router.params.type === 'terms'
  const sections = isTerms ? termsSections : privacySections

  return (
    <View className='legal-page'>
      <View className='legal-page__hero'>
        <Text className='legal-page__eyebrow'>HAIGOO REMOTE</Text>
        <Text className='legal-page__title'>{isTerms ? '用户服务协议' : '隐私政策'}</Text>
        <Text className='legal-page__version'>版本：2026-07-23 · 生效日期：正式发布之日</Text>
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
