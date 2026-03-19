// ============================================================
// Haigoo Dream Land — App Logic (Light Theme)
// ============================================================

const $ = (id) => document.getElementById(id);

let state = {
  view: 'task',
  taskFilter: 'all',
  skillFilter: 'all',
};

// ── SVG icon helpers ────────────────────────────────────────
const ICONS = {
  clock: `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.75"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  check: `<svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.75"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:#D97706;stroke:none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
};

const SUBTASK_ICONS = {
  design: `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--brand-indigo);fill:none;stroke-width:2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>`,
  dev: `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--brand-indigo);fill:none;stroke-width:2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  backend: `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--brand-indigo);fill:none;stroke-width:2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  data: `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--brand-indigo);fill:none;stroke-width:2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>`,
  writing: `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--brand-indigo);fill:none;stroke-width:2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderTaskCards();
  renderSkillCards();
  bindToggle();
  bindFilters();
  bindModals();
  bindDrawer();
  $('upload-skill-submit')?.addEventListener('click', () => {
    closeAllModals();
    showToast('技能包已成功上架！', 'success');
  });
});

// ============================================================
// PERSPECTIVE TOGGLE
// ============================================================
function bindToggle() {
  const btnTask = $('toggle-task');
  const btnSkill = $('toggle-skill');
  const slider = $('toggle-slider');

  function switchView(view) {
    state.view = view;
    const isTask = view === 'task';

    btnTask.classList.toggle('active', isTask);
    btnSkill.classList.toggle('active', !isTask);

    $('task-store-view').classList.toggle('active', isTask);
    $('skill-store-view').classList.toggle('active', !isTask);

    $('sidebar-task').style.display = isTask ? 'block' : 'none';
    $('sidebar-skill').style.display = isTask ? 'none' : 'block';

    // Move slider
    const ref = isTask ? btnTask : btnSkill;
    slider.style.left = ref.offsetLeft + 'px';
    slider.style.width = ref.offsetWidth + 'px';
  }

  btnTask.addEventListener('click', () => switchView('task'));
  btnSkill.addEventListener('click', () => switchView('skill'));

  // Init slider
  setTimeout(() => {
    slider.style.left = btnTask.offsetLeft + 'px';
    slider.style.width = btnTask.offsetWidth + 'px';
  }, 50);
}

// ============================================================
// FILTERS
// ============================================================
function bindFilters() {
  document.querySelectorAll('.task-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.task-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.taskFilter = chip.dataset.filter;
      renderTaskCards();
    });
  });
  document.querySelectorAll('.skill-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.skill-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.skillFilter = chip.dataset.filter;
      renderSkillCards();
    });
  });
  document.querySelectorAll('.skill-chip-tag').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });
}

// ============================================================
// RENDER TASK CARDS
// ============================================================
function renderTaskCards() {
  const grid = $('tasks-grid');
  const filtered = state.taskFilter === 'all'
    ? TASKS : TASKS.filter(t => t.category === state.taskFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><div class="empty-text">暂无相关任务</div></div>`;
    return;
  }
  grid.innerHTML = filtered.map(renderTaskCard).join('');
  grid.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
      const t = TASKS.find(t => t.id === card.dataset.id);
      if (t) openTaskDrawer(t);
    });
  });
}

function renderTaskCard(task) {
  const cat = CATEGORY_LABELS[task.category] || { label: task.category, color: '#6B7280', bg: '#F3F4F6' };
  const urgency = URGENCY_LABELS[task.urgency] || URGENCY_LABELS.normal;
  const isDecomposing = task.status === 'decomposing';
  const postedAgo = ['刚刚发布', '1小时前', '2小时前', '5小时前', '昨天'][Math.floor(Math.random() * 5)];

  const tagsHtml = task.tags.slice(0, 3).map(t =>
    `<span class="tag" style="background:${cat.bg};color:${cat.color};border-color:transparent">${t}</span>`
  ).join('');

  const status = isDecomposing
    ? `<span class="status-badge decomposing"><span class="status-dot"></span>AI 拆解中</span>`
    : `<span class="status-badge open"><span class="status-dot"></span>ACTIVE</span>`;

  return `
    <div class="task-card" data-id="${task.id}">
      <div class="task-card-top">
        ${status}
        <span class="posted-time">${postedAgo}</span>
      </div>
      <div class="task-card-title">${task.title}</div>
      <div class="task-card-desc">${task.description}</div>
      <div class="task-card-tags">
        <span class="tag" style="background:${cat.bg};color:${cat.color};font-weight:700;border-color:transparent">${cat.label}</span>
        ${tagsHtml}
      </div>
      <div class="task-card-footer">
        <div>
          <div class="task-budget">¥${task.budget.toLocaleString()} <span class="task-budget-label">/ 次</span></div>
        </div>
        <div style="text-align:right">
          <div class="task-deadline">${ICONS.clock} ${task.deadline}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${ICONS.users} ${task.applicants} 人竞标</div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// RENDER SKILL CARDS
// ============================================================
function renderSkillCards() {
  const grid = $('skills-grid');
  const filtered = state.skillFilter === 'all'
    ? SKILLS : SKILLS.filter(s => s.category === state.skillFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><div class="empty-text">暂无相关技能</div></div>`;
    return;
  }
  grid.innerHTML = filtered.map(renderSkillCard).join('');
  grid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openBuyModal(SKILLS.find(s => s.id === btn.dataset.id));
    });
  });
  grid.querySelectorAll('.skill-card').forEach(card => {
    card.addEventListener('click', () => {
      const s = SKILLS.find(s => s.id === card.dataset.id);
      if (s) openSkillDrawer(s);
    });
  });
}

function renderSkillCard(skill) {
  const user = USERS.find(u => u.id === skill.userId);
  const cat = CATEGORY_LABELS[skill.category] || { label: skill.category, color: '#6B7280', bg: '#F3F4F6' };
  const initials = (user?.name || '?').slice(0, 2);
  const stars = '★'.repeat(Math.floor(skill.rating));
  const tagsHtml = skill.tags.slice(0, 3).map(t =>
    `<span class="tag" style="background:${cat.bg};color:${cat.color};border-color:transparent">${t}</span>`
  ).join('');

  return `
    <div class="skill-card" data-id="${skill.id}">
      <div class="skill-card-header">
        <div class="seller-avatar">${initials}</div>
        <div style="flex:1">
          <div class="seller-name">${user?.name || '未知'}</div>
          <div class="seller-badge">${user?.badge || '卖家'}</div>
        </div>
        <div>
          <div class="seller-stats-row">
            <span class="seller-rating">${ICONS.star} ${skill.rating}</span>
            <span class="seller-orders">${skill.orders} 单</span>
          </div>
        </div>
      </div>
      <div class="skill-card-title">${skill.title}</div>
      <div class="task-card-tags" style="margin-bottom:10px">
        <span class="tag" style="background:${cat.bg};color:${cat.color};font-weight:700;border-color:transparent">${cat.label}</span>
        ${tagsHtml}
      </div>
      <div class="skill-io">
        <div class="skill-io-row"><span class="skill-io-label">输入</span>${skill.input}</div>
        <div class="skill-io-row"><span class="skill-io-label">输出</span>${skill.output}</div>
      </div>
      <div class="skill-highlight">${ICONS.zap} ${skill.highlight}</div>
      <div class="skill-card-footer">
        <div>
          <div class="skill-price">¥${skill.price} <span class="skill-price-unit">/ 次</span></div>
          <div class="skill-delivery">${ICONS.clock} ${skill.deliveryHours}小时内交付</div>
        </div>
        <button class="btn-buy" data-id="${skill.id}">立即购买</button>
      </div>
    </div>
  `;
}

// ============================================================
// DRAWERS
// ============================================================
function openTaskDrawer(task) {
  const cat = CATEGORY_LABELS[task.category] || { label: task.category, color: '#6B7280', bg: '#F3F4F6' };
  const urgency = URGENCY_LABELS[task.urgency] || URGENCY_LABELS.normal;
  $('task-drawer-title').textContent = task.title;
  $('task-drawer-content').innerHTML = `
    <div class="drawer-section">
      <div class="task-card-tags" style="margin-bottom:12px">
        <span class="tag" style="background:${cat.bg};color:${cat.color};font-weight:700;border-color:transparent">${cat.label}</span>
        ${task.tags.map(t => `<span class="tag" style="background:${cat.bg};color:${cat.color};border-color:transparent">${t}</span>`).join('')}
        <span class="status-badge open" style="display:inline-flex"><span class="status-dot"></span>ACTIVE</span>
      </div>
      <div class="drawer-section-label">任务描述</div>
      <div class="drawer-desc">${task.description}</div>
    </div>
    <div class="drawer-section">
      <div class="drawer-section-label">输入 / 输出要求</div>
      <div class="drawer-io">
        ${task.requirements.split('\n').map(line => {
    const [k, v] = line.split('：');
    return `<div class="drawer-io-row"><span class="drawer-io-key">${k}</span>${v || ''}</div>`;
  }).join('')}
      </div>
    </div>
    <div class="drawer-section">
      <div class="drawer-section-label">任务详情</div>
      <div class="drawer-io">
        <div class="drawer-io-row"><span class="drawer-io-key">预算</span>¥${task.budget.toLocaleString()}</div>
        <div class="drawer-io-row"><span class="drawer-io-key">截止</span>${task.deadline}</div>
        <div class="drawer-io-row"><span class="drawer-io-key">竞标</span>${task.applicants} 人</div>
        <div class="drawer-io-row"><span class="drawer-io-key">状态</span>${task.status === 'decomposing' ? 'AI 拆解中' : '接单中'}</div>
      </div>
    </div>
    <div class="drawer-action-row">
      <div>
        <div class="drawer-price">¥${task.budget.toLocaleString()}</div>
        <div class="drawer-price-sub">按结果交付</div>
      </div>
      <button class="btn-apply" onclick="applyTask('${task.id}')">立即接单</button>
    </div>
  `;
  showDrawer('task-drawer');
}

function openSkillDrawer(skill) {
  const user = USERS.find(u => u.id === skill.userId);
  const cat = CATEGORY_LABELS[skill.category] || { label: skill.category, color: '#6B7280', bg: '#F3F4F6' };
  const initials = (user?.name || '?').slice(0, 2);
  $('skill-drawer-title').textContent = skill.title;
  $('skill-drawer-content').innerHTML = `
    <div class="skill-card-header" style="margin-bottom:16px;padding:12px;background:var(--bg-page);border-radius:var(--radius-md);border:1px solid var(--border)">
      <div class="seller-avatar">${initials}</div>
      <div style="flex:1">
        <div class="seller-name">${user?.name}</div>
        <div class="seller-badge">${user?.badge}</div>
      </div>
      <div class="seller-stats-row">
        <span class="seller-rating">${ICONS.star} ${skill.rating}</span>
        <span class="seller-orders">${skill.orders} 单</span>
      </div>
    </div>
    <div class="drawer-section">
      <div class="task-card-tags" style="margin-bottom:12px">
        <span class="tag" style="background:${cat.bg};color:${cat.color};font-weight:700;border-color:transparent">${cat.label}</span>
        ${skill.tags.map(t => `<span class="tag" style="background:${cat.bg};color:${cat.color};border-color:transparent">${t}</span>`).join('')}
      </div>
      <div class="drawer-section-label">关于这项技能</div>
      <div class="drawer-desc">${skill.description}</div>
    </div>
    <div class="drawer-section">
      <div class="drawer-section-label">交付规格</div>
      <div class="drawer-io">
        <div class="drawer-io-row"><span class="drawer-io-key">输入</span>${skill.input}</div>
        <div class="drawer-io-row"><span class="drawer-io-key">输出</span>${skill.output}</div>
        <div class="drawer-io-row"><span class="drawer-io-key">时效</span>${skill.deliveryHours} 小时内交付</div>
      </div>
    </div>
    <div class="skill-highlight">${ICONS.zap} ${skill.highlight}</div>
    <div class="drawer-action-row">
      <div>
        <div class="drawer-price">¥${skill.price}</div>
        <div class="drawer-price-sub">/ 次，按结果交付</div>
      </div>
      <button class="btn-apply" onclick="hideDrawers();openBuyModal(SKILLS.find(s=>s.id==='${skill.id}'))">立即购买</button>
    </div>
  `;
  showDrawer('skill-drawer');
}

function showDrawer(id) {
  $('drawer-overlay').classList.add('show');
  $(id).classList.add('show');
}
function hideDrawers() {
  $('drawer-overlay').classList.remove('show');
  document.querySelectorAll('.drawer').forEach(d => d.classList.remove('show'));
}
function bindDrawer() {
  $('drawer-overlay').addEventListener('click', hideDrawers);
  document.querySelectorAll('.drawer-close').forEach(btn => btn.addEventListener('click', hideDrawers));
}
function applyTask(id) {
  hideDrawers();
  showToast('接单成功！任务方将在 2 小时内与你联系', 'success');
}

// ============================================================
// MODALS
// ============================================================
function bindModals() {
  $('btn-post-task')?.addEventListener('click', () => openModal('post-task-modal'));
  $('btn-post-task-banner')?.addEventListener('click', () => openModal('post-task-modal'));
  $('btn-upload-skill')?.addEventListener('click', () => openModal('upload-skill-modal'));
  $('btn-sell-skill-banner')?.addEventListener('click', () => openModal('upload-skill-modal'));
  $('btn-ai-analyze')?.addEventListener('click', runAIAnalysis);
  $('btn-parse-resume')?.addEventListener('click', runResumeAI);
  $('resume-upload-area')?.addEventListener('click', () => {
    showToast('简历文件上传功能 (Demo 模式)', 'success');
    setTimeout(() => runResumeAI(), 800);
  });
  $('confirm-buy-btn')?.addEventListener('click', () => {
    closeAllModals();
    showToast('下单成功！技能方将在 2 小时内响应', 'success');
  });
  $('post-task-submit')?.addEventListener('click', submitTask);
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeAllModals(); });
  });
  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeAllModals));
  document.querySelectorAll('.modal-btn-cancel').forEach(btn => btn.addEventListener('click', closeAllModals));
}

function openModal(id) {
  closeAllModals();
  $(id).classList.add('show');
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
  const aiBox = $('ai-analysis-box');
  if (aiBox) aiBox.classList.remove('show');
  const aiResult = $('ai-result');
  if (aiResult) { aiResult.classList.remove('show'); aiResult.innerHTML = ''; }
  const aiThinking = $('ai-thinking');
  if (aiThinking) aiThinking.style.display = 'flex';
  const recPanel = $('ai-rec-panel');
  if (recPanel) recPanel.classList.remove('show');
}

function openBuyModal(skill) {
  hideDrawers();
  if (!skill) return;
  const user = USERS.find(u => u.id === skill.userId);
  const initials = (user?.name || '?').slice(0, 2);
  const buyContent = $('buy-skill-content');
  if (buyContent) {
    buyContent.innerHTML = `
      <div class="skill-card-header" style="margin-bottom:14px;padding:12px;background:var(--bg-page);border-radius:var(--radius-md);border:1px solid var(--border)">
        <div class="seller-avatar">${initials}</div>
        <div style="flex:1">
          <div class="seller-name">${user?.name}</div>
          <div class="seller-badge">${user?.badge}</div>
        </div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:10px;line-height:1.4">${skill.title}</div>
      <div class="skill-io" style="margin-bottom:14px">
        <div class="skill-io-row"><span class="skill-io-label">输入</span>${skill.input}</div>
        <div class="skill-io-row"><span class="skill-io-label">输出</span>${skill.output}</div>
      </div>
    `;
  }
  const buyPrice = $('buy-price');
  if (buyPrice) buyPrice.textContent = `¥${skill.price}`;
  openModal('buy-skill-modal');
}

// ── AI Task Analysis ──────────────────────────────────────
function runAIAnalysis() {
  const input = $('task-desc-input')?.value?.trim();
  if (!input || input.length < 5) { showToast('请先描述你的需求', 'error'); return; }

  const aiBox = $('ai-analysis-box');
  const aiThinking = $('ai-thinking');
  const aiResult = $('ai-result');

  aiBox.classList.add('show');
  aiThinking.style.display = 'flex';
  aiResult.classList.remove('show');
  aiResult.innerHTML = '';

  const isComplex = input.length > 20 || /网站|App|应用|系统|平台|完整|电商/.test(input);

  setTimeout(() => {
    aiThinking.style.display = 'none';
    aiResult.classList.add('show');
    isComplex ? renderAIDecompose(aiResult) : renderAIAtomic(aiResult, input);
  }, 2000);
}

function renderAIDecompose(container) {
  const d = AI_DECOMPOSE_RESULT;
  const iconMap = ['design', 'dev', 'backend', 'data', 'writing'];
  container.innerHTML = `
    <div class="ai-result-badge complex">
      <svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      复合需求 — AI 已拆解为 ${d.subtasks.length} 个原子任务
    </div>
    <div class="ai-label">${d.analysis}</div>
    <div class="subtask-list">
      ${d.subtasks.map((st, i) => `
        <div class="subtask-item">
          <div class="subtask-icon-wrap">${SUBTASK_ICONS[iconMap[i] || 'dev']}</div>
          <div class="subtask-info">
            <div class="subtask-title">${st.title}</div>
            <div class="subtask-meta">匹配：${st.matchedSkill} · 预计 ${st.deadline}</div>
          </div>
          <div class="subtask-budget">¥${st.budget}</div>
        </div>
      `).join('')}
    </div>
    <div class="ai-total-row">
      <span>总预算估算</span>
      <span class="ai-total-budget">¥${d.totalBudget.toLocaleString()}</span>
    </div>
  `;
}

function renderAIAtomic(container, input) {
  container.innerHTML = `
    <div class="ai-result-badge atomic">
      <svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>
      原子任务 — 可直接发布匹配
    </div>
    <div class="ai-label">这是一个明确的单一任务，已找到最佳匹配技能方：</div>
    <div class="subtask-item">
      <div class="subtask-icon-wrap">${SUBTASK_ICONS.dev}</div>
      <div class="subtask-info">
        <div class="subtask-title">${input.slice(0, 45)}${input.length > 45 ? '…' : ''}</div>
        <div class="subtask-meta">匹配：林晓云 · 全栈工程师 · 4.9 分</div>
      </div>
      <div class="subtask-budget">¥99</div>
    </div>
  `;
}

function submitTask() {
  if (!$('task-desc-input')?.value?.trim()) { showToast('请输入需求描述', 'error'); return; }
  closeAllModals();
  showToast('需求已发布，正在为你匹配技能方…', 'success');
}

// ── AI Resume Parse ───────────────────────────────────────
function runResumeAI() {
  const btn = $('btn-parse-resume');
  if (btn) { btn.disabled = true; btn.textContent = 'AI 分析中…'; }
  setTimeout(() => {
    $('ai-rec-panel').classList.add('show');
    renderAIRecommendations();
    if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> 重新解析`; }
  }, 2200);
}

function renderAIRecommendations() {
  const list = $('ai-rec-list');
  if (!list) return;
  list.innerHTML = AI_RECOMMENDATIONS.map(rec => {
    const urgency = URGENCY_LABELS[rec.urgency] || URGENCY_LABELS.normal;
    return `
      <div class="ai-rec-item">
        <div class="ai-rec-match">${rec.matchScore}%</div>
        <div class="ai-rec-info">
          <div class="ai-rec-task-title">${rec.title}</div>
          <div class="ai-rec-reason">${rec.matchReason}</div>
        </div>
        <div class="ai-rec-right">
          <div class="ai-rec-budget">¥${rec.budget}</div>
          <div class="ai-rec-urgency" style="color:${urgency.color}">${urgency.label}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'success') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success'
    ? `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  toast.innerHTML = `${icon}<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.transform = 'translateX(90px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
