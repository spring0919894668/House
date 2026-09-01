const state = {
  requests: [],
  ads: [],
  adsAll: []
};

function getToken() {
  return localStorage.getItem('adminToken') || '';
}

function isAdmin() {
  return Boolean(getToken());
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function lineUrl(agentLine) {
  const value = String(agentLine || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://line.me/ti/p/~${encodeURIComponent(value)}`;
}

function formatBudget(min, max) {
  if (min == null && max == null) return '面議';
  if (min != null && max != null) return `${min} ~ ${max}`;
  if (min != null) return `${min} 以上`;
  return `${max} 以下`;
}

// ---------- 客需總表 ----------

function buildQuery() {
  const params = new URLSearchParams();
  const district = document.getElementById('fDistrict').value.trim();
  const type = document.getElementById('fType').value;
  const minBudget = document.getElementById('fMinBudget').value;
  const maxBudget = document.getElementById('fMaxBudget').value;
  const keyword = document.getElementById('fKeyword').value.trim();
  const showHidden = document.getElementById('showHidden')?.checked;

  if (district) params.set('district', district);
  if (type) params.set('type', type);
  if (minBudget) params.set('minBudget', minBudget);
  if (maxBudget) params.set('maxBudget', maxBudget);
  if (keyword) params.set('keyword', keyword);
  if (isAdmin() && showHidden) params.set('status', 'all');

  return params.toString();
}

async function loadRequests() {
  const qs = buildQuery();
  const data = await api(`/api/buyer-requests${qs ? '?' + qs : ''}`);
  state.requests = data.buyerRequests;
  renderRequests();
}

function renderRequests() {
  const tbody = document.getElementById('requestTbody');
  const emptyMsg = document.getElementById('emptyMsg');
  tbody.innerHTML = '';

  document.querySelectorAll('.admin-only').forEach((el) => {
    el.hidden = !isAdmin();
  });

  if (state.requests.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  for (const item of state.requests) {
    const tr = document.createElement('tr');
    const line = lineUrl(item.agentLine);
    tr.innerHTML = `
      <td>${escapeHtml(item.agentBrand)}${item.status === 'hidden' ? '<span class="status-tag hidden-status">已下架</span>' : ''}</td>
      <td>${escapeHtml(item.clientCode) || '<span class="muted">-</span>'}</td>
      <td>${escapeHtml(item.district)}</td>
      <td>${escapeHtml(item.propertyType)}</td>
      <td>${escapeHtml(formatBudget(item.budgetMin, item.budgetMax))}</td>
      <td>${escapeHtml(item.conditions) || '<span class="muted">-</span>'}</td>
      <td>${escapeHtml(item.remark) || '<span class="muted">-</span>'}</td>
      <td>${new Date(item.createdAt).toLocaleDateString('zh-TW')}</td>
      <td>
        ${line ? `<a class="line-btn" href="${line}" target="_blank" rel="noopener">LINE聯絡</a>` : ''}
        <a class="phone-link" href="tel:${escapeHtml(item.agentPhone)}">${escapeHtml(item.agentPhone)}</a>
      </td>
      <td class="admin-only row-actions" ${isAdmin() ? '' : 'hidden'}>
        <button data-action="toggle" data-id="${item.id}" data-status="${item.status}">
          ${item.status === 'hidden' ? '上架' : '下架'}
        </button>
        <button data-action="delete" data-id="${item.id}">刪除</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newStatus = btn.dataset.status === 'hidden' ? 'published' : 'hidden';
      try {
        await api(`/api/buyer-requests/${btn.dataset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus })
        });
        loadRequests();
      } catch (err) {
        alert('更新失敗：' + err.message);
      }
    });
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('確定要刪除這筆客需刊登嗎？')) return;
      try {
        await api(`/api/buyer-requests/${btn.dataset.id}`, { method: 'DELETE' });
        loadRequests();
      } catch (err) {
        alert('刪除失敗：' + err.message);
      }
    });
  });
}

document.getElementById('toggleFormBtn').addEventListener('click', () => {
  const form = document.getElementById('requestForm');
  form.hidden = !form.hidden;
});

// ---------- 刊登前手機驗證 ----------

const phoneState = { verified: false, verifiedPhone: '' };

const agentPhoneInput = document.getElementById('agentPhoneInput');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const codeWrap = document.getElementById('codeWrap');
const verifyCodeInput = document.getElementById('verifyCodeInput');
const confirmCodeBtn = document.getElementById('confirmCodeBtn');
const verifyStatus = document.getElementById('verifyStatus');
const submitRequestBtn = document.getElementById('submitRequestBtn');

function setVerifyStatus(text, cls) {
  verifyStatus.textContent = text;
  verifyStatus.className = 'verify-status' + (cls ? ' ' + cls : '');
}

function resetVerification() {
  phoneState.verified = false;
  phoneState.verifiedPhone = '';
  submitRequestBtn.disabled = true;
  setVerifyStatus('尚未驗證手機門號，請先發送並輸入驗證碼');
}

agentPhoneInput.addEventListener('input', () => {
  if (agentPhoneInput.value.trim() !== phoneState.verifiedPhone) resetVerification();
});

sendCodeBtn.addEventListener('click', async () => {
  const phone = agentPhoneInput.value.trim();
  if (!/^09\d{8}$/.test(phone)) {
    setVerifyStatus('請輸入正確的手機格式（09 開頭共 10 碼）', 'error');
    return;
  }
  sendCodeBtn.disabled = true;
  try {
    const result = await api('/api/verify/send', { method: 'POST', body: JSON.stringify({ phone }) });
    codeWrap.hidden = false;
    if (result.devCode) {
      verifyCodeInput.value = result.devCode;
      setVerifyStatus(`驗證碼已產生（測試模式尚未串接簡訊商，已自動帶入：${result.devCode}）`, 'ok');
    } else {
      setVerifyStatus('驗證碼已發送至該手機，請查收簡訊', 'ok');
    }
  } catch (err) {
    setVerifyStatus('發送失敗：' + err.message, 'error');
  } finally {
    setTimeout(() => {
      sendCodeBtn.disabled = false;
    }, 3000);
  }
});

confirmCodeBtn.addEventListener('click', async () => {
  const phone = agentPhoneInput.value.trim();
  const code = verifyCodeInput.value.trim();
  try {
    await api('/api/verify/confirm', { method: 'POST', body: JSON.stringify({ phone, code }) });
    phoneState.verified = true;
    phoneState.verifiedPhone = phone;
    submitRequestBtn.disabled = false;
    setVerifyStatus('手機驗證成功 ✓，可以送出刊登了', 'ok');
  } catch (err) {
    setVerifyStatus('驗證失敗：' + err.message, 'error');
  }
});

resetVerification();

document.getElementById('requestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('formMsg');
  msg.textContent = '';
  msg.className = 'form-msg';

  if (!phoneState.verified || phoneState.verifiedPhone !== agentPhoneInput.value.trim()) {
    msg.textContent = '請先完成手機門號驗證';
    msg.classList.add('error');
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    await api('/api/buyer-requests', { method: 'POST', body: JSON.stringify(payload) });
    msg.textContent = '刊登成功！';
    msg.classList.add('ok');
    form.reset();
    codeWrap.hidden = true;
    resetVerification();
    loadRequests();
    // 讓使用者先看到成功訊息，2 秒後再收合表單
    setTimeout(() => {
      form.hidden = true;
      msg.textContent = '';
      msg.className = 'form-msg';
    }, 2000);
  } catch (err) {
    msg.textContent = '刊登失敗：' + err.message;
    msg.classList.add('error');
  }
});

document.getElementById('filterBtn').addEventListener('click', () => loadRequests());
document.getElementById('resetFilterBtn').addEventListener('click', () => {
  ['fDistrict', 'fType', 'fMinBudget', 'fMaxBudget', 'fKeyword'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  loadRequests();
});

// ---------- 廣告版位 ----------

async function loadAds() {
  const data = await api('/api/ads');
  state.ads = data.ads;
  renderAds();
}

function renderAds() {
  const container = document.getElementById('adList');
  container.innerHTML = '';

  if (state.ads.length === 0) {
    container.innerHTML = '<p class="ad-empty">目前尚無廣告刊登。</p>';
    return;
  }

  for (const ad of state.ads) {
    const card = document.createElement('a');
    card.className = 'ad-card';
    card.href = ad.linkUrl || '#';
    card.target = ad.linkUrl ? '_blank' : '_self';
    card.rel = 'noopener';
    card.innerHTML = `
      <img src="${escapeHtml(ad.imageUrl)}" alt="${escapeHtml(ad.title)}" />
      <div class="ad-caption">${escapeHtml(ad.title)}${ad.sponsor ? ' · ' + escapeHtml(ad.sponsor) : ''}</div>
    `;
    card.addEventListener('click', () => {
      api(`/api/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
    });
    container.appendChild(card);
  }
}

async function loadAdsAdmin() {
  if (!isAdmin()) return;
  const data = await api('/api/ads/all');
  state.adsAll = data.ads;
  renderAdsAdmin();
}

function renderAdsAdmin() {
  const container = document.getElementById('adAdminList');
  container.innerHTML = '';

  if (state.adsAll.length === 0) {
    container.innerHTML = '<p class="ad-empty">尚未新增任何廣告。</p>';
    return;
  }

  for (const ad of state.adsAll) {
    const div = document.createElement('div');
    div.className = 'ad-admin-item';
    div.innerHTML = `
      <strong>${escapeHtml(ad.title)}</strong>（排序 ${ad.position}）
      <div class="meta">
        贊助：${escapeHtml(ad.sponsor) || '-'}｜
        ${ad.startDate || '不限'} ~ ${ad.endDate || '不限'}｜
        曝光 ${ad.impressions || 0} / 點擊 ${ad.clicks || 0}
      </div>
      <div class="meta">
        狀態：${ad.status === 'active' ? '上架中' : '已下架'}｜
        收費：${ad.paidStatus === 'paid' ? '已收費' : '未收費'}
      </div>
      <div class="row-actions">
        <button data-action="toggle-status" data-id="${ad.id}" data-status="${ad.status}">
          ${ad.status === 'active' ? '下架' : '上架'}
        </button>
        <button data-action="toggle-paid" data-id="${ad.id}" data-paid="${ad.paidStatus}">
          ${ad.paidStatus === 'paid' ? '標記未收費' : '標記已收費'}
        </button>
        <button data-action="delete-ad" data-id="${ad.id}">刪除</button>
      </div>
    `;
    container.appendChild(div);
  }

  container.querySelectorAll('[data-action="toggle-status"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const status = btn.dataset.status === 'active' ? 'inactive' : 'active';
      await api(`/api/ads/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      loadAdsAdmin();
      loadAds();
    });
  });

  container.querySelectorAll('[data-action="toggle-paid"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const paidStatus = btn.dataset.paid === 'paid' ? 'unpaid' : 'paid';
      await api(`/api/ads/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ paidStatus }) });
      loadAdsAdmin();
    });
  });

  container.querySelectorAll('[data-action="delete-ad"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('確定要刪除這則廣告嗎？')) return;
      await api(`/api/ads/${btn.dataset.id}`, { method: 'DELETE' });
      loadAdsAdmin();
      loadAds();
    });
  });
}

document.getElementById('adForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api('/api/ads', { method: 'POST', body: JSON.stringify(payload) });
    e.target.reset();
    loadAdsAdmin();
    loadAds();
  } catch (err) {
    alert('新增廣告失敗：' + err.message);
  }
});

// ---------- Admin Token ----------

document.getElementById('saveToken').addEventListener('click', () => {
  localStorage.setItem('adminToken', document.getElementById('adminToken').value.trim());
  init();
});

document.getElementById('adminToken').value = getToken();

document.addEventListener('change', (e) => {
  if (e.target.id === 'showHidden') loadRequests();
});

function init() {
  document.querySelectorAll('.admin-only').forEach((el) => {
    el.hidden = !isAdmin();
  });
  loadRequests().catch((err) => console.error(err));
  loadAds().catch((err) => console.error(err));
  loadAdsAdmin().catch((err) => console.error(err));
}

init();
