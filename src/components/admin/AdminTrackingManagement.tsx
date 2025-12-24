import React from 'react';
import { 
  BarChart2, 
  Map, 
  MousePointer, 
  Eye, 
  FileText, 
  CheckCircle,
  AlertCircle,
  User,
  ShoppingBag,
  Search,
  Share2
} from 'lucide-react';

const AdminTrackingManagement: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header & Overview */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Map className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">全链路埋点设计方案</h2>
              <p className="text-sm text-slate-500 mt-1">
                基于 AARRR 模型 (Acquisition, Activation, Retention, Revenue, Referral) 设计的全站数据追踪体系。
              </p>
            </div>
          </div>
          <span className="status-badge high">设计中</span>
        </div>
        
        <div className="card-content">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
              <BarChart2 className="w-5 h-5 mr-2 text-indigo-600" />
              核心转化漏斗 (Core Funnel)
            </h3>
            <div className="flex items-center justify-between text-sm relative">
              {/* Funnel Steps */}
              {[
                { label: '浏览访问 (Acquisition)', metric: 'UV / PV' },
                { label: '激活/注册 (Activation)', metric: '注册率' },
                { label: '浏览岗位 (Engagement)', metric: '人均浏览量' },
                { label: '简历/申请 (Action)', metric: '投递转化率' },
                { label: '会员订阅 (Revenue)', metric: '付费转化率' }
              ].map((step, index, arr) => (
                <div key={index} className="flex flex-col items-center relative z-10 bg-slate-50 px-2">
                  <div className="w-10 h-10 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center font-bold text-indigo-600 mb-2 shadow-sm">
                    {index + 1}
                  </div>
                  <span className="font-medium text-slate-900">{step.label}</span>
                  <span className="text-xs text-slate-500 mt-1">{step.metric}</span>
                </div>
              ))}
              {/* Connector Line */}
              <div className="absolute top-5 left-0 w-full h-0.5 bg-indigo-100 -z-0"></div>
            </div>
          </div>

          {/* 1. 流量与浏览 (Traffic) */}
          <TrackingSection 
            title="1. 流量与浏览 (Traffic & Views)" 
            icon={<Eye className="w-5 h-5" />}
            color="blue"
            events={[
              { id: 'view_landing', name: '访问首页', desc: '用户访问 Landing Page', params: 'source (utm)' },
              { id: 'view_job_list', name: '浏览岗位列表', desc: '用户访问远程岗位列表页', params: 'page, filters, sort' },
              { id: 'view_job_detail', name: '浏览岗位详情', desc: '用户进入岗位详情页', params: 'job_id, job_title, company' },
              { id: 'view_company_detail', name: '浏览企业详情', desc: '用户查看企业信息页', params: 'company_id, company_name' },
              { id: 'view_profile', name: '访问个人中心', desc: '用户进入个人中心', params: 'tab (resume/jobs/settings)' },
              { id: 'view_membership', name: '访问会员页', desc: '用户查看会员订阅方案', params: 'source (entry_point)' }
            ]}
          />

          {/* 2. 用户互动 (Interaction) */}
          <TrackingSection 
            title="2. 岗位互动 (Interaction)" 
            icon={<MousePointer className="w-5 h-5" />}
            color="indigo"
            events={[
              { id: 'click_save_job', name: '收藏岗位', desc: '点击收藏按钮', params: 'job_id' },
              { id: 'click_apply_init', name: '点击申请(唤起)', desc: '点击申请按钮，唤起拦截/内推弹窗', params: 'job_id, user_level' },
              { id: 'click_apply_external', name: '跳转外部申请', desc: '确认前往外部官网投递', params: 'job_id, external_url' },
              { id: 'search_jobs', name: '搜索岗位', desc: '执行岗位搜索', params: 'keyword' },
              { id: 'filter_jobs', name: '筛选岗位', desc: '使用筛选器', params: 'filter_type, value' },
              { id: 'share_job', name: '分享岗位', desc: '点击分享/复制链接', params: 'job_id, channel' }
            ]}
          />

          {/* 3. 简历与转化 (Conversion - Resume & Apply) */}
          <TrackingSection 
            title="3. 简历与转化 (Resume & Application)" 
            icon={<FileText className="w-5 h-5" />}
            color="green"
            events={[
              { id: 'upload_resume', name: '上传简历', desc: '成功上传简历文件', params: 'source (personal/christmas/apply/track), file_type' },
              { id: 'analyze_resume', name: 'AI简历分析', desc: '触发AI简历分析功能', params: 'resume_id, score' },
              { id: 'submit_referral', name: '提交内推申请', desc: '成功提交站内内推申请', params: 'job_id, resume_id' },
              { id: 'join_talent_pool', name: '加入人才库', desc: '勾选加入人才库选项', params: 'source' },
              { id: 'download_resume', name: '下载简历', desc: '用户/管理员下载简历', params: 'resume_id' }
            ]}
          />

          {/* 4. 账户与会员 (Account & Revenue) */}
          <TrackingSection 
            title="4. 账户与会员 (Account & Revenue)" 
            icon={<User className="w-5 h-5" />}
            color="purple"
            events={[
              { id: 'signup_success', name: '注册成功', desc: '用户完成注册', params: 'method (email/google)' },
              { id: 'login_success', name: '登录成功', desc: '用户完成登录', params: 'method' },
              { id: 'click_subscribe', name: '点击订阅', desc: '点击具体的订阅计划按钮', params: 'plan_id, price' },
              { id: 'payment_success', name: '支付成功', desc: '会员支付成功回调', params: 'order_id, amount, plan' }
            ]}
          />
        </div>
      </div>
    </div>
  );
};

// Helper Components
const TrackingSection = ({ title, icon, color, events }: any) => {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    green: 'text-green-600 bg-green-50 border-green-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
  };

  return (
    <div className="mb-8 last:mb-0">
      <h4 className={`text-base font-bold mb-4 flex items-center p-3 rounded-lg border ${colorMap[color]}`}>
        <span className="mr-2">{icon}</span>
        {title}
      </h4>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-1/4">事件ID (Event ID)</th>
              <th className="w-1/4">事件名称</th>
              <th className="w-1/3">描述</th>
              <th className="w-1/6">关键参数</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event: any) => (
              <tr key={event.id}>
                <td className="font-mono text-xs text-indigo-600">{event.id}</td>
                <td className="font-medium">{event.name}</td>
                <td className="text-slate-600 text-sm">{event.desc}</td>
                <td className="text-xs text-slate-500 font-mono">{event.params}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InfoIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export default AdminTrackingManagement;
