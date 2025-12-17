
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Cpu, Database, Activity, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

interface DetailedTokenUsage extends TokenUsage {
  translation?: TokenUsage;
  resume_parsing?: TokenUsage;
  job_matching?: TokenUsage;
  other?: TokenUsage;
}

interface SystemSettings {
  ai_translation_enabled: { value: boolean };
  ai_token_usage: { value: DetailedTokenUsage };
}

export default function AdminSystemSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-ops?action=system-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setMessage({ type: 'error', text: '加载设置失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggleAi = async () => {
    if (!settings) return;
    const newValue = !settings.ai_translation_enabled?.value;
    
    setSaving(true);
    try {
      const res = await fetch('/api/admin-ops?action=system-settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          key: 'ai_translation_enabled',
          value: newValue
        })
      });
      
      if (res.ok) {
        setSettings(prev => prev ? ({
          ...prev,
          ai_translation_enabled: { ...prev.ai_translation_enabled, value: newValue }
        }) : null);
        setMessage({ type: 'success', text: `AI 翻译已${newValue ? '启用' : '禁用'}` });
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存设置失败' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading && !settings) {
    return <div className="p-8 text-center text-slate-500">加载设置中...</div>;
  }

  const aiEnabled = settings?.ai_translation_enabled?.value ?? false;
  const tokenUsage = settings?.ai_token_usage?.value ?? { input: 0, output: 0, total: 0 };

  const renderUsageCard = (title: string, usage?: TokenUsage, colorClass: string = 'bg-white') => {
    const safeUsage = usage || { input: 0, output: 0, total: 0 };
    return (
      <div className={`p-4 rounded-lg border border-slate-200 shadow-sm ${colorClass}`}>
        <div className="text-sm font-semibold text-slate-700 mb-2">{title}</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-slate-500">Total</div>
            <div className="text-lg font-bold text-slate-900">{safeUsage.total.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Input</div>
            <div className="text-sm text-slate-600">{safeUsage.input.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Output</div>
            <div className="text-sm text-slate-600">{safeUsage.output.toLocaleString()}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Cpu className="w-6 h-6 text-indigo-600" />
          系统服务设置
        </h2>
        <button 
          onClick={fetchSettings} 
          className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* AI Translation Service Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">AI 翻译服务 (DeepSeek/Bailian)</h3>
            <p className="text-sm text-slate-500 mt-1">
              使用高级 AI 模型进行精准翻译。启用后将产生 API 调用费用。
              <br/>
              禁用时将回退到 Google/LibreTranslate 等免费服务。
            </p>
          </div>
          <button
            onClick={handleToggleAi}
            disabled={saving}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              aiEnabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                aiEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        <div className="p-6 bg-slate-50/50">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            API Token 消耗统计 (总览)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 mb-1">Total Tokens</div>
              <div className="text-2xl font-bold text-slate-900">{tokenUsage.total.toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 mb-1">Input Tokens</div>
              <div className="text-xl font-semibold text-slate-700">{tokenUsage.input.toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 mb-1">Output Tokens</div>
              <div className="text-xl font-semibold text-slate-700">{tokenUsage.output.toLocaleString()}</div>
            </div>
          </div>

          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Database className="w-4 h-4" />
            分模块统计详情
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderUsageCard('翻译服务', tokenUsage.translation)}
            {renderUsageCard('简历解析', tokenUsage.resume_parsing)}
            {renderUsageCard('职位匹配', tokenUsage.job_matching)}
            {renderUsageCard('其他', tokenUsage.other)}
          </div>

          <p className="text-xs text-slate-400 mt-4 text-right">
            统计数据仅供参考，实际计费请以云服务商后台为准。
          </p>
        </div>
      </div>

      {/* Placeholder for other settings */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 opacity-50 pointer-events-none">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">其他系统设置</h3>
        <p className="text-slate-500">更多配置项开发中...</p>
      </div>
    </div>
  );
}
