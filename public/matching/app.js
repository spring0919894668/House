const API_BASE = '/api/matching';

let state = {
  token: localStorage.getItem('matchingToken') || '',
  me: null,
  cases: [],
  users: [],
  buyerNeeds: [],
  feedback: [],
  activeTab: 'cases'
};

const TAB_LABEL = { cases: '案件牆', buyerNeeds: '客需媒合', users: '成員與權限', feedback: '意見回饋' };

const OWNERSHIP_LABEL = { confirmed: '產權已確認', pending: '產權確認中', disputed: '產權有糾紛' };
const OWNERSHIP_CLASS = { confirmed: 'ok', pending: 'warn', disputed: 'danger' };
const STATUS_LABEL = { inUse: '使用中', vacant: '閒置', seized: '查封／法拍', other: '其他' };
const PERM_LABEL = { owner: '建立者', edit: '可編輯', view: '僅檢視' };

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({ ok: false, error: '伺服器回應格式錯誤' }));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `發生錯誤 (HTTP ${res.status})`);
  }
  return data;
}

function money(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('zh-Hant-TW');
}

function el(html) {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild;
}

function showModal(innerHtml, onMount) {
  closeModal();
  const overlay = el(`<div class="modal-overlay"><div class="modal-box">${innerHtml}</div></div>`);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById('modalRoot').appendChild(overlay);
  if (onMount) onMount(overlay.querySelector('.modal-box'));
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

// ---------- 登入 ----------

async function tryLoadMe() {
  if (!state.token) return false;
  try {
    const data = await api('/users/me');
    state.me = data.user;
    return true;
  } catch (err) {
    state.token = '';
    localStorage.removeItem('matchingToken');
    return false;
  }
}

async function login() {
  const input = document.getElementById('tokenInput');
  const token = input.value.trim();
  if (!token) return;
  state.token = token;
  const ok = await tryLoadMe();
  if (!ok) {
    alert('登入失敗，請確認權杖是否正確');
    return;
  }
  localStorage.setItem('matchingToken', token);
  input.value = '';
  await afterLogin();
}

function logout() {
  state.token = '';
  state.me = null;
  localStorage.removeItem('matchingToken');
  document.getElementById('tabs').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginHint').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.add('hidden');
  document.getElementById('whoami').textContent = '';
  document.getElementById('feedbackFab').classList.add('hidden');
  document.getElementById('loginFields').classList.remove('hidden');
}

async function afterLogin() {
  document.getElementById('tabs').classList.remove('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('loginHint').classList.add('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
  document.getElementById('feedbackFab').classList.remove('hidden');
  document.getElementById('loginFields').classList.add('hidden');
  document.getElementById('whoami').textContent = `${state.me.name}（${state.me.role === 'admin' ? '管理者' : '經紀人'}）`;
  const isAdmin = state.me.role === 'admin';
  document.querySelector('button[data-tab="users"]').style.display = isAdmin ? '' : 'none';
  document.querySelector('button[data-tab="feedback"]').style.display = isAdmin ? '' : 'none';
  await refreshAll();
}

// ---------- 分頁切換 ----------

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('nav#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('main .view').forEach((v) => v.classList.toggle('active', v.id === `view-${tab}`));
}

async function refreshAll() {
  const tasks = [loadCases(), loadUsers(), loadBuyerNeeds()];
  if (state.me.role === 'admin') tasks.push(loadFeedback());
  await Promise.all(tasks);
}

// ---------- 案件牆 ----------

async function loadCases() {
  const data = await api('/cases');
  state.cases = data.cases;
  renderCases();
}

function renderCases() {
  const box = document.getElementById('caseList');
  if (state.cases.length === 0) {
    box.innerHTML = '<p class="hint">目前尚無案件，點右上角「＋ 新增案件」建立第一筆。</p>';
    return;
  }
  box.innerHTML = '';
  state.cases.forEach((c) => {
    const unitPrice = c.area ? Math.round(c.askingPrice / c.area) : null;
    const card = el(`
      <div class="card">
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.region || '未填地區')} ・ ${escapeHtml(c.propertyType || '未分類')}</p>
        <p>開價 ${money(c.askingPrice)} 元${unitPrice ? `（約每${escapeHtml(c.unit)} ${money(unitPrice)} 元）` : ''}</p>
        <span class="tag ${OWNERSHIP_CLASS[c.ownershipStatus] || ''}">${OWNERSHIP_LABEL[c.ownershipStatus] || c.ownershipStatus}</span>
        <span class="tag">${STATUS_LABEL[c.currentStatus] || c.currentStatus}</span>
        <span class="tag ${c.visibility === 'team' ? 'ok' : ''}">${c.visibility === 'team' ? '團隊共享' : '私人案件'}</span>
        <span class="tag perm">${PERM_LABEL[c.myPermission] || c.myPermission}</span>
      </div>
    `);
    card.addEventListener('click', () => openCaseDetail(c.id));
    box.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

function openNewCaseModal() {
  showModal(`
    <button class="modal-close">×</button>
    <h2>新增案件</h2>
    <div class="form-grid">
      <label class="field">案件名稱<input id="f-title" /></label>
      <label class="field">物件類型<input id="f-propertyType" placeholder="例如：重廠、輕廠、倉儲" /></label>
      <label class="field">地區<input id="f-region" placeholder="例如：桃園觀音" /></label>
      <label class="field">地址<input id="f-address" /></label>
      <label class="field">面積<input id="f-area" type="number" min="0" /></label>
      <label class="field">面積單位<input id="f-unit" value="坪" /></label>
      <label class="field">開價（元）<input id="f-askingPrice" type="number" min="0" /></label>
      <label class="field">屋主/地主<input id="f-ownerName" /></label>
      <label class="field">產權狀態
        <select id="f-ownershipStatus">
          <option value="pending">確認中</option>
          <option value="confirmed">已確認</option>
          <option value="disputed">有糾紛</option>
        </select>
      </label>
      <label class="field">現況
        <select id="f-currentStatus">
          <option value="inUse">使用中</option>
          <option value="vacant">閒置</option>
          <option value="seized">查封／法拍</option>
          <option value="other">其他</option>
        </select>
      </label>
      <label class="field full">可見範圍
        <select id="f-visibility">
          <option value="private">僅自己（可再個別授權同事）</option>
          <option value="team">團隊全體可檢視</option>
        </select>
      </label>
    </div>
    <div id="formError" class="error-msg"></div>
    <div class="form-row" style="margin-top:14px;">
      <button class="primary-btn" id="submitCase">建立案件</button>
    </div>
  `, (box) => {
    box.querySelector('.modal-close').addEventListener('click', closeModal);
    box.querySelector('#submitCase').addEventListener('click', async () => {
      try {
        await api('/cases', {
          method: 'POST',
          body: {
            title: box.querySelector('#f-title').value.trim(),
            propertyType: box.querySelector('#f-propertyType').value.trim(),
            region: box.querySelector('#f-region').value.trim(),
            address: box.querySelector('#f-address').value.trim(),
            area: box.querySelector('#f-area').value,
            unit: box.querySelector('#f-unit').value.trim() || '坪',
            askingPrice: box.querySelector('#f-askingPrice').value,
            ownerName: box.querySelector('#f-ownerName').value.trim(),
            ownershipStatus: box.querySelector('#f-ownershipStatus').value,
            currentStatus: box.querySelector('#f-currentStatus').value,
            visibility: box.querySelector('#f-visibility').value
          }
        });
        closeModal();
        await loadCases();
      } catch (err) {
        box.querySelector('#formError').textContent = err.message;
      }
    });
  });
}

async function openCaseDetail(caseId) {
  const [caseData, commentsData] = await Promise.all([
    api(`/cases/${caseId}`),
    api(`/cases/${caseId}/comments`)
  ]);
  const c = caseData.case;
  const canEdit = c.myPermission === 'owner' || c.myPermission === 'edit';
  const isOwner = c.myPermission === 'owner';
  const unitPrice = c.area ? Math.round(c.askingPrice / c.area) : null;

  showModal(`
    <button class="modal-close">×</button>
    <h2>${escapeHtml(c.title)}</h2>
    <p class="hint">你的權限：${PERM_LABEL[c.myPermission] || c.myPermission}</p>

    <div class="form-grid">
      <label class="field">案件名稱<input id="d-title" value="${escapeHtml(c.title)}" ${canEdit ? '' : 'disabled'} /></label>
      <label class="field">物件類型<input id="d-propertyType" value="${escapeHtml(c.propertyType)}" ${canEdit ? '' : 'disabled'} /></label>
      <label class="field">地區<input id="d-region" value="${escapeHtml(c.region)}" ${canEdit ? '' : 'disabled'} /></label>
      <label class="field">地址<input id="d-address" value="${escapeHtml(c.address)}" ${canEdit ? '' : 'disabled'} /></label>
      <label class="field">面積<input id="d-area" type="number" value="${c.area}" ${canEdit ? '' : 'disabled'} /></label>
      <label class="field">開價（元）<input id="d-askingPrice" type="number" value="${c.askingPrice}" ${canEdit ? '' : 'disabled'} /></label>
      <label class="field">屋主/地主<input id="d-ownerName" value="${escapeHtml(c.ownerName)}" ${canEdit ? '' : 'disabled'} /></label>
      <label class="field">屋主聯絡方式<input id="d-ownerContact" value="${escapeHtml(c.ownerContact)}" ${canEdit ? '' : 'disabled'} /></label>
      <label class="field">產權狀態
        <select id="d-ownershipStatus" ${canEdit ? '' : 'disabled'}>
          <option value="pending" ${c.ownershipStatus === 'pending' ? 'selected' : ''}>確認中</option>
          <option value="confirmed" ${c.ownershipStatus === 'confirmed' ? 'selected' : ''}>已確認</option>
          <option value="disputed" ${c.ownershipStatus === 'disputed' ? 'selected' : ''}>有糾紛</option>
        </select>
      </label>
      <label class="field">現況
        <select id="d-currentStatus" ${canEdit ? '' : 'disabled'}>
          <option value="inUse" ${c.currentStatus === 'inUse' ? 'selected' : ''}>使用中</option>
          <option value="vacant" ${c.currentStatus === 'vacant' ? 'selected' : ''}>閒置</option>
          <option value="seized" ${c.currentStatus === 'seized' ? 'selected' : ''}>查封／法拍</option>
          <option value="other" ${c.currentStatus === 'other' ? 'selected' : ''}>其他</option>
        </select>
      </label>
      <label class="field full">產權備註<textarea id="d-ownershipNote" ${canEdit ? '' : 'disabled'}>${escapeHtml(c.ownershipNote)}</textarea></label>
      <label class="field full">現況備註<textarea id="d-currentStatusNote" ${canEdit ? '' : 'disabled'}>${escapeHtml(c.currentStatusNote)}</textarea></label>
    </div>
    ${unitPrice ? `<p class="hint">目前單價約每${escapeHtml(c.unit)} ${money(unitPrice)} 元</p>` : ''}
    ${canEdit ? '<button class="small-btn" id="saveCaseBtn">儲存變更</button>' : ''}
    ${isOwner ? `<label class="field" style="display:inline-block;margin-left:10px;">可見範圍
      <select id="d-visibility">
        <option value="private" ${c.visibility === 'private' ? 'selected' : ''}>僅自己＋被授權同事</option>
        <option value="team" ${c.visibility === 'team' ? 'selected' : ''}>團隊全體可檢視</option>
      </select></label>` : ''}
    <div id="detailError" class="error-msg"></div>

    <div class="section-title">帶看紀錄</div>
    <div id="viewingList">${renderViewings(c)}</div>
    ${canEdit ? `
      <div class="form-grid">
        <label class="field">帶看日期<input id="v-date" type="date" /></label>
        <label class="field">陪同/客戶<input id="v-attendee" /></label>
        <label class="field full">現場紀錄<textarea id="v-note"></textarea></label>
      </div>
      <button class="small-btn" id="addViewingBtn">新增帶看紀錄</button>
    ` : ''}

    <div class="section-title">比較案例（供實價分析試算，可手動輸入成交/開價行情）</div>
    <div id="comparableList">${renderComparables(c)}</div>
    ${canEdit ? `
      <div class="form-grid">
        <label class="field">日期<input id="cp-date" type="date" /></label>
        <label class="field">成交/開價（元）<input id="cp-price" type="number" min="0" /></label>
        <label class="field">面積<input id="cp-area" type="number" min="0" /></label>
        <label class="field full">備註<input id="cp-note" placeholder="例如：同路段近期成交案" /></label>
      </div>
      <button class="small-btn" id="addComparableBtn">新增比較案例</button>
    ` : ''}

    <div class="section-title">實價合理性分析</div>
    <div id="priceAnalysisBox"><button class="small-btn" id="runPriceAnalysisBtn">執行分析</button></div>

    <div class="section-title">產出文件</div>
    <a class="report-link" target="_blank" href="presentation.html?caseId=${c.id}">🧾 買方銷售簡報</a>
    <a class="report-link" target="_blank" href="negotiation-report.html?caseId=${c.id}">📊 賣方議價報告書</a>

    ${isOwner ? `<div class="section-title">案件成員權限</div><div id="memberBox">${renderMemberEditor(c)}</div>` : ''}

    <div class="section-title">案件討論區</div>
    <div id="commentList">${renderComments(commentsData.comments)}</div>
    <div class="form-row">
      <textarea id="newComment" placeholder="輸入討論內容（例如：對案件的了解、疑問、帶看回饋…）" style="width:100%;min-height:50px;"></textarea>
      <button class="small-btn" id="addCommentBtn" style="margin-top:6px;">送出留言</button>
    </div>
  `, (box) => {
    box.querySelector('.modal-close').addEventListener('click', closeModal);

    if (canEdit) {
      box.querySelector('#saveCaseBtn').addEventListener('click', async () => {
        try {
          await api(`/cases/${c.id}`, {
            method: 'PATCH',
            body: {
              title: box.querySelector('#d-title').value.trim(),
              propertyType: box.querySelector('#d-propertyType').value.trim(),
              region: box.querySelector('#d-region').value.trim(),
              address: box.querySelector('#d-address').value.trim(),
              area: box.querySelector('#d-area').value,
              askingPrice: box.querySelector('#d-askingPrice').value,
              ownerName: box.querySelector('#d-ownerName').value.trim(),
              ownerContact: box.querySelector('#d-ownerContact').value.trim(),
              ownershipStatus: box.querySelector('#d-ownershipStatus').value,
              currentStatus: box.querySelector('#d-currentStatus').value,
              ownershipNote: box.querySelector('#d-ownershipNote').value,
              currentStatusNote: box.querySelector('#d-currentStatusNote').value
            }
          });
          await loadCases();
          closeModal();
          openCaseDetail(c.id);
        } catch (err) {
          box.querySelector('#detailError').textContent = err.message;
        }
      });

      box.querySelector('#addViewingBtn').addEventListener('click', async () => {
        try {
          await api(`/cases/${c.id}/viewings`, {
            method: 'POST',
            body: {
              date: box.querySelector('#v-date').value,
              attendee: box.querySelector('#v-attendee').value.trim(),
              note: box.querySelector('#v-note').value.trim()
            }
          });
          closeModal();
          openCaseDetail(c.id);
        } catch (err) {
          box.querySelector('#detailError').textContent = err.message;
        }
      });

      box.querySelector('#addComparableBtn').addEventListener('click', async () => {
        try {
          await api(`/cases/${c.id}/comparables`, {
            method: 'POST',
            body: {
              date: box.querySelector('#cp-date').value,
              price: box.querySelector('#cp-price').value,
              area: box.querySelector('#cp-area').value,
              note: box.querySelector('#cp-note').value.trim()
            }
          });
          closeModal();
          openCaseDetail(c.id);
        } catch (err) {
          box.querySelector('#detailError').textContent = err.message;
        }
      });
    }

    if (isOwner) {
      box.querySelector('#d-visibility').addEventListener('change', async (e) => {
        try {
          await api(`/cases/${c.id}/visibility`, { method: 'PUT', body: { visibility: e.target.value } });
          await loadCases();
        } catch (err) {
          box.querySelector('#detailError').textContent = err.message;
        }
      });
      bindMemberEditor(box, c);
    }

    box.querySelector('#runPriceAnalysisBtn').addEventListener('click', async () => {
      const target = box.querySelector('#priceAnalysisBox');
      target.innerHTML = '分析中…';
      try {
        const { analysis } = await api(`/cases/${c.id}/price-analysis`);
        target.innerHTML = renderPriceAnalysis(analysis);
      } catch (err) {
        target.innerHTML = `<p class="error-msg">${escapeHtml(err.message)}</p>`;
      }
    });

    box.querySelector('#addCommentBtn').addEventListener('click', async () => {
      const textarea = box.querySelector('#newComment');
      const content = textarea.value.trim();
      if (!content) return;
      try {
        await api(`/cases/${c.id}/comments`, { method: 'POST', body: { content } });
        closeModal();
        openCaseDetail(c.id);
      } catch (err) {
        box.querySelector('#detailError').textContent = err.message;
      }
    });
  });
}

function renderViewings(c) {
  if (!c.viewings.length) return '<p class="hint">尚無帶看紀錄</p>';
  return c.viewings
    .slice()
    .reverse()
    .map((v) => `<div class="list-row"><span>${escapeHtml(v.date)}｜${escapeHtml(v.attendee || '未填')}</span><span>${escapeHtml(v.note)}</span></div>`)
    .join('');
}

function renderComparables(c) {
  if (!c.comparables.length) return '<p class="hint">尚無比較案例</p>';
  return c.comparables
    .map((cp) => `<div class="list-row"><span>${escapeHtml(cp.date || '未填日期')}｜${money(cp.price)} 元 / ${cp.area}${escapeHtml(c.unit)}</span><span>${escapeHtml(cp.note)}</span></div>`)
    .join('');
}

function renderPriceAnalysis(a) {
  const assessmentLabel = { aboveMarket: '開價高於行情區間', belowMarket: '開價低於行情區間', withinRange: '開價落在合理區間內' };
  return `
    <p>資料來源：${a.source === 'external-ai' ? '外部實價 AI 服務' : a.source === 'local-estimate' ? '系統內部比較案例試算' : '資料不足'}</p>
    ${a.avgUnitPrice ? `<p>比較案例平均單價：約 ${money(a.avgUnitPrice)} 元</p>` : ''}
    ${a.suggestedLow != null ? `<p>建議合理總價區間：${money(a.suggestedLow)} ～ ${money(a.suggestedHigh)} 元</p>` : ''}
    ${a.assessment ? `<p><strong>${assessmentLabel[a.assessment] || ''}</strong>（目前開價 ${money(a.askingPrice)} 元）</p>` : ''}
    ${a.note ? `<p class="hint">${escapeHtml(a.note)}</p>` : ''}
  `;
}

function renderComments(comments) {
  if (!comments.length) return '<p class="hint">尚無討論，開始第一則留言吧。</p>';
  return comments
    .map(
      (cm) => `<div class="comment"><div class="meta">${escapeHtml(cm.authorName)}・${new Date(cm.createdAt).toLocaleString('zh-Hant-TW')}</div>${escapeHtml(cm.content)}</div>`
    )
    .join('');
}

function renderMemberEditor(c) {
  if (!state.users.length) return '<p class="hint">尚無其他同事帳號</p>';
  return state.users
    .filter((u) => u.id !== c.createdBy)
    .map((u) => {
      const member = (c.members || []).find((m) => m.userId === u.id);
      const perm = member ? member.permission : 'none';
      return `
        <div class="list-row">
          <span>${escapeHtml(u.name)}${u.role === 'admin' ? '（管理者）' : ''}</span>
          <select data-user-id="${u.id}" class="member-perm-select">
            <option value="none" ${perm === 'none' ? 'selected' : ''}>無權限</option>
            <option value="view" ${perm === 'view' ? 'selected' : ''}>可檢視</option>
            <option value="edit" ${perm === 'edit' ? 'selected' : ''}>可編輯</option>
          </select>
        </div>
      `;
    })
    .join('');
}

function bindMemberEditor(box, c) {
  box.querySelectorAll('.member-perm-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const members = [];
      box.querySelectorAll('.member-perm-select').forEach((s) => {
        if (s.value !== 'none') members.push({ userId: s.dataset.userId, permission: s.value });
      });
      try {
        await api(`/cases/${c.id}/members`, { method: 'PUT', body: { members } });
      } catch (err) {
        box.querySelector('#detailError').textContent = err.message;
      }
    });
  });
}

// ---------- 客需媒合 ----------

async function loadBuyerNeeds() {
  const data = await api('/buyer-needs');
  state.buyerNeeds = data.buyerNeeds;
  renderBuyerNeeds();
}

function renderBuyerNeeds() {
  const box = document.getElementById('needList');
  if (!state.buyerNeeds.length) {
    box.innerHTML = '<p class="hint">目前尚無買方客需，點右上角「＋ 張貼客需」讓同事幫忙推薦案件。</p>';
    return;
  }
  box.innerHTML = '';
  const statusLabel = { open: '媒合中', matched: '已媒合', closed: '已結案' };
  state.buyerNeeds.forEach((n) => {
    const r = n.requirement || {};
    const card = el(`
      <div class="card">
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(r.region || '不限地區')} ・ ${escapeHtml(r.propertyType || '不限類型')}</p>
        <p>需求面積 ≥ ${r.minArea || '不限'}　預算上限 ${r.maxBudget ? money(r.maxBudget) + ' 元' : '不限'}</p>
        <p class="hint">${escapeHtml(r.note || '')}</p>
        <p>張貼人：${escapeHtml(n.createdByName)}</p>
        <span class="tag ${n.status === 'matched' ? 'ok' : n.status === 'closed' ? '' : 'warn'}">${statusLabel[n.status]}</span>
      </div>
    `);
    card.addEventListener('click', () => openNeedDetail(n.id));
    box.appendChild(card);
  });
}

function openNewNeedModal() {
  showModal(`
    <button class="modal-close">×</button>
    <h2>張貼買方客需</h2>
    <div class="form-grid">
      <label class="field full">客需標題<input id="n-title" placeholder="例如：桃園沿海重廠 300坪以上" /></label>
      <label class="field">物件類型<input id="n-propertyType" /></label>
      <label class="field">地區<input id="n-region" /></label>
      <label class="field">最小面積<input id="n-minArea" type="number" min="0" /></label>
      <label class="field">預算上限（元）<input id="n-maxBudget" type="number" min="0" /></label>
      <label class="field full">補充說明<textarea id="n-note"></textarea></label>
    </div>
    <div id="formError" class="error-msg"></div>
    <div class="form-row" style="margin-top:14px;"><button class="primary-btn" id="submitNeed">送出</button></div>
  `, (box) => {
    box.querySelector('.modal-close').addEventListener('click', closeModal);
    box.querySelector('#submitNeed').addEventListener('click', async () => {
      try {
        await api('/buyer-needs', {
          method: 'POST',
          body: {
            title: box.querySelector('#n-title').value.trim(),
            requirement: {
              propertyType: box.querySelector('#n-propertyType').value.trim(),
              region: box.querySelector('#n-region').value.trim(),
              minArea: box.querySelector('#n-minArea').value,
              maxBudget: box.querySelector('#n-maxBudget').value,
              note: box.querySelector('#n-note').value.trim()
            }
          }
        });
        closeModal();
        await loadBuyerNeeds();
      } catch (err) {
        box.querySelector('#formError').textContent = err.message;
      }
    });
  });
}

async function openNeedDetail(needId) {
  const need = state.buyerNeeds.find((n) => n.id === needId);
  const { referrals } = await api(`/buyer-needs/${needId}/referrals`);
  const isOwner = need.createdBy === state.me.id || state.me.role === 'admin';
  const statusLabel = { pending: '待回應', accepted: '已接受', rejected: '已婉拒' };

  showModal(`
    <button class="modal-close">×</button>
    <h2>${escapeHtml(need.title)}</h2>
    <p class="hint">${escapeHtml(need.requirement.note || '')}</p>

    <div class="section-title">同事推薦的案件</div>
    <div id="referralList">
      ${referrals.length ? referrals.map((r) => `
        <div class="list-row">
          <span>${escapeHtml(r.case ? r.case.title : '案件已刪除')}（${escapeHtml(r.recommendedByName)} 推薦）${r.note ? '：' + escapeHtml(r.note) : ''}</span>
          <span>
            <span class="tag ${r.status === 'accepted' ? 'ok' : r.status === 'rejected' ? 'danger' : 'warn'}">${statusLabel[r.status]}</span>
            ${isOwner && r.status === 'pending' ? `<button class="small-btn" data-accept="${r.id}">接受</button><button class="small-btn danger" data-reject="${r.id}">婉拒</button>` : ''}
          </span>
        </div>
      `).join('') : '<p class="hint">尚無推薦案件</p>'}
    </div>

    <div class="section-title">推薦我手上的案件給此客需</div>
    <div class="form-grid">
      <label class="field">選擇案件
        <select id="r-caseId">
          ${state.cases.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('')}
        </select>
      </label>
      <label class="field full">推薦說明<input id="r-note" placeholder="為何符合此客需" /></label>
    </div>
    <button class="small-btn" id="submitReferralBtn">送出推薦</button>
    <div id="needError" class="error-msg"></div>

    ${isOwner ? `
      <div class="section-title">客需狀態</div>
      <select id="needStatusSelect">
        <option value="open" ${need.status === 'open' ? 'selected' : ''}>媒合中</option>
        <option value="matched" ${need.status === 'matched' ? 'selected' : ''}>已媒合</option>
        <option value="closed" ${need.status === 'closed' ? 'selected' : ''}>已結案</option>
      </select>
    ` : ''}
  `, (box) => {
    box.querySelector('.modal-close').addEventListener('click', closeModal);
    box.querySelector('#submitReferralBtn').addEventListener('click', async () => {
      try {
        await api(`/buyer-needs/${need.id}/referrals`, {
          method: 'POST',
          body: { caseId: box.querySelector('#r-caseId').value, note: box.querySelector('#r-note').value.trim() }
        });
        closeModal();
        openNeedDetail(need.id);
      } catch (err) {
        box.querySelector('#needError').textContent = err.message;
      }
    });
    box.querySelectorAll('[data-accept]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/buyer-needs/referrals/${btn.dataset.accept}`, { method: 'PATCH', body: { status: 'accepted' } });
        closeModal();
        await loadBuyerNeeds();
        openNeedDetail(need.id);
      });
    });
    box.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/buyer-needs/referrals/${btn.dataset.reject}`, { method: 'PATCH', body: { status: 'rejected' } });
        closeModal();
        openNeedDetail(need.id);
      });
    });
    if (isOwner) {
      box.querySelector('#needStatusSelect').addEventListener('change', async (e) => {
        await api(`/buyer-needs/${need.id}`, { method: 'PATCH', body: { status: e.target.value } });
        await loadBuyerNeeds();
      });
    }
  });
}

// ---------- 成員與權限（帳號管理，僅管理者） ----------

async function loadUsers() {
  const data = await api('/users');
  state.users = data.users;
  if (state.me && state.me.role === 'admin') renderUsers();
}

function renderUsers() {
  const box = document.getElementById('userList');
  box.innerHTML = '';
  state.users.forEach((u) => {
    const card = el(`
      <div class="card" style="cursor:default;">
        <h3>${escapeHtml(u.name)} ${u.role === 'admin' ? '（管理者）' : ''}</h3>
        <p>${escapeHtml(u.email || '未填 email')}</p>
        <p>身份：${{ buyer: '買方經紀', seller: '賣方經紀', both: '買賣皆可' }[u.agentType]}</p>
        <span class="tag ${u.active ? 'ok' : 'danger'}">${u.active ? '啟用中' : '已停用'}</span>
        <div class="form-row" style="margin-top:8px;">
          <button class="small-btn" data-toggle="${u.id}">${u.active ? '停用帳號' : '啟用帳號'}</button>
          <button class="small-btn" data-reset="${u.id}">重設權杖</button>
        </div>
      </div>
    `);
    box.appendChild(card);
  });
  box.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const u = state.users.find((x) => x.id === btn.dataset.toggle);
      await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } });
      await loadUsers();
    });
  });
  box.querySelectorAll('[data-reset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { token } = await api(`/users/${btn.dataset.reset}/reset-token`, { method: 'POST' });
      alert(`新的存取權杖（請盡快交給本人，且不會再顯示）：\n${token}`);
    });
  });
}

function openNewUserModal() {
  showModal(`
    <button class="modal-close">×</button>
    <h2>新增同事帳號</h2>
    <div class="form-grid">
      <label class="field">姓名<input id="u-name" /></label>
      <label class="field">Email<input id="u-email" /></label>
      <label class="field">角色
        <select id="u-role"><option value="broker">一般經紀人</option><option value="admin">系統管理者</option></select>
      </label>
      <label class="field">經紀身份
        <select id="u-agentType">
          <option value="both">買賣皆可</option>
          <option value="buyer">買方經紀</option>
          <option value="seller">賣方經紀</option>
        </select>
      </label>
    </div>
    <div id="formError" class="error-msg"></div>
    <div class="form-row" style="margin-top:14px;"><button class="primary-btn" id="submitUser">建立帳號</button></div>
  `, (box) => {
    box.querySelector('.modal-close').addEventListener('click', closeModal);
    box.querySelector('#submitUser').addEventListener('click', async () => {
      try {
        const { token } = await api('/users', {
          method: 'POST',
          body: {
            name: box.querySelector('#u-name').value.trim(),
            email: box.querySelector('#u-email').value.trim(),
            role: box.querySelector('#u-role').value,
            agentType: box.querySelector('#u-agentType').value
          }
        });
        closeModal();
        await loadUsers();
        alert(`帳號已建立，請將以下存取權杖交給本人（僅顯示這一次）：\n${token}`);
      } catch (err) {
        box.querySelector('#formError').textContent = err.message;
      }
    });
  });
}

// ---------- 意見回饋 ----------

async function loadFeedback() {
  const data = await api('/feedback');
  state.feedback = data.feedback;
  renderFeedback();
}

function renderFeedback() {
  const box = document.getElementById('feedbackList');
  if (!box) return;
  if (!state.feedback.length) {
    box.innerHTML = '<p class="hint">目前還沒有收到任何意見回饋。</p>';
    return;
  }
  box.innerHTML = '';
  state.feedback.forEach((f) => {
    const stars = f.rating ? '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating) : '（未評分）';
    const card = el(`
      <div class="feedback-card">
        <div class="meta">
          <span>${escapeHtml(f.authorName)}・${escapeHtml(TAB_LABEL[f.page] || f.page || '未指定畫面')}・${stars}・${new Date(f.createdAt).toLocaleString('zh-Hant-TW')}</span>
          <span>
            <span class="tag status-${f.status}">${f.status === 'reviewed' ? '已處理' : '待處理'}</span>
            <button class="small-btn" data-toggle-status="${f.id}">${f.status === 'reviewed' ? '標記為待處理' : '標記已處理'}</button>
          </span>
        </div>
        <div class="body">${escapeHtml(f.content || '（無文字意見，僅評分）')}</div>
      </div>
    `);
    box.appendChild(card);
  });
  box.querySelectorAll('[data-toggle-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const f = state.feedback.find((x) => x.id === btn.dataset.toggleStatus);
      await api(`/feedback/${f.id}`, { method: 'PATCH', body: { status: f.status === 'reviewed' ? 'new' : 'reviewed' } });
      await loadFeedback();
    });
  });
}

function openFeedbackModal() {
  showModal(`
    <button class="modal-close">×</button>
    <h2>意見回饋</h2>
    <p class="hint">試用時想到什麼都可以直接留言，管理者會在「意見回饋」頁籤彙整查看。</p>
    <div class="form-grid">
      <label class="field full">這則回饋跟哪個畫面有關？
        <select id="fb-page">
          ${Object.entries(TAB_LABEL).map(([k, v]) => `<option value="${k}" ${k === state.activeTab ? 'selected' : ''}>${v}</option>`).join('')}
          <option value="other">其他／整體</option>
        </select>
      </label>
      <label class="field full">整體滿意度（可不選）
        <div class="rating-select" id="fb-rating">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-rating="${n}">${n}</button>`).join('')}
        </div>
      </label>
      <label class="field full">意見內容<textarea id="fb-content" placeholder="例如：哪個步驟卡住、畫面看不懂、希望增加什麼功能…"></textarea></label>
    </div>
    <div id="fbError" class="error-msg"></div>
    <div class="form-row" style="margin-top:14px;"><button class="primary-btn" id="submitFeedback">送出</button></div>
  `, (box) => {
    box.querySelector('.modal-close').addEventListener('click', closeModal);
    let selectedRating = null;
    box.querySelectorAll('#fb-rating button').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRating = selectedRating === Number(btn.dataset.rating) ? null : Number(btn.dataset.rating);
        box.querySelectorAll('#fb-rating button').forEach((b) => b.classList.toggle('selected', Number(b.dataset.rating) === selectedRating));
      });
    });
    box.querySelector('#submitFeedback').addEventListener('click', async () => {
      try {
        await api('/feedback', {
          method: 'POST',
          body: {
            page: box.querySelector('#fb-page').value,
            rating: selectedRating,
            content: box.querySelector('#fb-content').value.trim()
          }
        });
        closeModal();
        if (state.me && state.me.role === 'admin') await loadFeedback();
        alert('謝謝你的回饋！');
      } catch (err) {
        box.querySelector('#fbError').textContent = err.message;
      }
    });
  });
}

// ---------- 初始化 ----------

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('tokenInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
document.getElementById('logoutBtn').addEventListener('click', logout);
document.querySelectorAll('nav#tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.getElementById('newCaseBtn').addEventListener('click', openNewCaseModal);
document.getElementById('newNeedBtn').addEventListener('click', openNewNeedModal);
document.getElementById('newUserBtn').addEventListener('click', openNewUserModal);
document.getElementById('feedbackFab').addEventListener('click', openFeedbackModal);

(async function init() {
  if (state.token) {
    const ok = await tryLoadMe();
    if (ok) await afterLogin();
  }
})();
