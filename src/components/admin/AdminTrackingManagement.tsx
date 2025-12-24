import React from 'react';
import { 
  BarChart2, 
  Map, 
  MousePointer, 
  Eye, 
  FileText, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const AdminTrackingManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h2>埋点管理 (Tracking Management)</h2>
          <span className="status-badge high">设计中</span>
        </div>
        <div className="card-content">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 flex items-start">
            <InfoIcon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm">埋点设计规范</h4>
              <p className="text-sm mt-1">
                统一记录用户行为、页面访问及关键业务转化。当前重点关注简历来源及转化路径。
              </p>
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-indigo-600" />
            简历来源埋点 (Resume Sources)
          </h3>
          
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>来源标识 (Source Key)</th>
                  <th>业务场景</th>
                  <th>触发时机</th>
                  <th>包含参数</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>personal_center</code></td>
                  <td>个人中心</td>
                  <td>用户在个人中心页面点击上传/更新简历</td>
                  <td><code>user_id</code>, <code>file_name</code></td>
                  <td><span className="status-badge high">已上线</span></td>
                </tr>
                <tr>
                  <td><code>christmas_tree</code></td>
                  <td>圣诞树活动</td>
                  <td>用户在圣诞树活动页生成/上传简历</td>
                  <td><code>email</code>, <code>campaign_id</code></td>
                  <td><span className="status-badge high">已上线</span></td>
                </tr>
                <tr>
                  <td><code>job_application</code></td>
                  <td>岗位申请</td>
                  <td>用户在申请内推/投递时上传新简历</td>
                  <td><code>job_id</code>, <code>company_id</code></td>
                  <td><span className="status-badge high">已上线</span></td>
                </tr>
                <tr>
                  <td><code>job_tracking</code></td>
                  <td>岗位追踪</td>
                  <td>用户在岗位追踪/远程岗位列表页上传简历</td>
                  <td><code>tracking_id</code></td>
                  <td><span className="status-badge high">已上线</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold text-slate-800 mt-8 mb-4 flex items-center">
            <MousePointer className="w-5 h-5 mr-2 text-indigo-600" />
            功能点击埋点 (Events)
          </h3>
          
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>事件ID (Event ID)</th>
                  <th>事件名称</th>
                  <th>描述</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>click_apply_job</code></td>
                  <td>点击申请职位</td>
                  <td>用户点击职位详情页的"申请"按钮</td>
                  <td><span className="status-badge medium">规划中</span></td>
                </tr>
                <tr>
                  <td><code>click_download_resume</code></td>
                  <td>下载简历</td>
                  <td>管理员下载简历文件</td>
                  <td><span className="status-badge medium">规划中</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
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
