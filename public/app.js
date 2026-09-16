const state = {
  category: 'ALL',
  categories: {},
  order: [],
  news: [],
  bots: {},
  schedules: {},
  knownGroups: {}
};

function getToken() {
  return localStorage.getItem('adminToken') || '';
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

async function loadNews() {
  const qs = state.category !== 'ALL' ? `?category=${state.category}` : '';
  const data = await api(`/api/news${qs}`);
  state.categories = data.categories;
  state.order = data.order;
  state.news = data.news;
  renderTabs();
  renderNews();
}

async function loadSchedules() {
  const data = await api('/api/schedules');
  state.bots = data.bots;
  state.schedules = data.schedules;
  state.knownGroups = data.knownGroups;
  renderSchedules();
}

function renderTabs() {
  const nav = document.getElementById('categoryTabs');
  const tabs = [{ id: 'ALL', name: '全部' }, ...state.order.map((id) => state.categories[id])];
  nav.innerHTML = '';
  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.textContent = tab.id === 'ALL' ? '全部' : `${tab.id}．${tab.name}`;
    btn.className = tab.id === state.category ? 'active' : '';
    btn.onclick = () => {
      state.category = tab.id;
      loadNews();
    };
    nav.appendChild(btn);
  }
}

function renderNews() {
  const container = document.getElementById('newsList');
  container.innerHTML = '';

  if (state.news.length === 0) {
    container.innerHTML = '<p style="color:#888">目前沒有新聞，請按右上角「立即抓新聞」，或稍後由排程自動擷取。</p>';
    return;
  }

  for (const item of state.news) {
    const card = document.createElement('div');
    card.className = 'news-card';

    const catInfo = state.categories[item.category];
    const statusLabel = { pending: '未處理', selected: '已勾選待發', posted: '已發布', failed: '發送失敗', rejected: '已略過' }[item.status] || item.status;

    card.innerHTML = `
      <h3>${escapeHtml(item.title)}
        <span class="status-tag ${item.status}">${statusLabel}</span>
      </h3>
      <p class="news-meta">
        分類：${catInfo ? `${catInfo.id}．${catInfo.name}` : item.category}
        來源：${escapeHtml(item.source)}
        時間：${item.publishedAt ? new Date(item.publishedAt).toLocaleString('zh-TW') : '未知'}
      </p>
      <p>${escapeHtml(item.summary || '')}</p>
      ${item.link ? `<p><a href="${item.link}" target="_blank" rel="noopener">原文連結</a></p>` : ''}
      <div class="bot-checks">
        ${['A', 'B', 'C', 'D']
          .map(
            (botKey) => `
          <label>
            <input type="checkbox" data-news="${item.id}" data-bot="${botKey}" ${item.selectedForBot?.[botKey] ? 'checked' : ''} />
            推 ${botKey}（${state.categories[botKey]?.name || botKey}）
          </label>`
          )
          .join('')}
      </div>
    `;
    container.appendChild(card);
  }

  container.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', async (e) => {
      const newsId = e.target.dataset.news;
      const botKey = e.target.dataset.bot;
      try {
        await api(`/api/news/${newsId}`, {
          method: 'PATCH',
          body: JSON.stringify({ selectedForBot: { [botKey]: e.target.checked } })
        });
        loadNews();
      } catch (err) {
        alert('更新失敗：' + err.message);
      }
    });
  });
}

function renderSchedules() {
  const container = document.getElementById('botCards');
  container.innerHTML = '';

  for (const botKey of ['A', 'B', 'C', 'D']) {
    const bot = state.bots[botKey] || {};
    const schedule = state.schedules[botKey] || {};
    const known = state.knownGroups[botKey] || [];

    const card = document.createElement('div');
    card.className = 'bot-card';
    card.innerHTML = `
      <h4>
        <span>${botKey}．${escapeHtml(bot.name || '')}</span>
        ${bot.configured ? '' : '<span class="badge-not-configured">未設定金鑰</span>'}
      </h4>

      <label><input type="checkbox" data-field="enabled" ${schedule.enabled ? 'checked' : ''} /> 啟用每日自動發文</label>

      <label>發文時間</label>
      <input type="time" data-field="time" value="${schedule.time || '09:00'}" />

      <label>目標群組 ID（每行一個）</label>
      <textarea data-field="groupIds">${(schedule.groupIds || []).join('\n')}</textarea>

      ${known.length ? `<p style="font-size:11px;color:#888;margin-top:6px;">已知群組（機器人加入過的）：<br>${known.join('<br>')}</p>` : ''}

      <div class="row">
        <button data-action="save">儲存設定</button>
        <button data-action="run-now">立即依目前勾選發送</button>
      </div>
    `;

    card.querySelector('[data-action="save"]').addEventListener('click', async () => {
      const enabled = card.querySelector('[data-field="enabled"]').checked;
      const time = card.querySelector('[data-field="time"]').value;
      const groupIds = card
        .querySelector('[data-field="groupIds"]')
        .value.split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      try {
        await api(`/api/schedules/${botKey}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled, time, groupIds })
        });
        alert(`${botKey} 頻道設定已儲存`);
        loadSchedules();
      } catch (err) {
        alert('儲存失敗：' + err.message);
      }
    });

    card.querySelector('[data-action="run-now"]').addEventListener('click', async () => {
      try {
        await api(`/api/schedules/${botKey}/run-now`, { method: 'POST' });
        alert(`${botKey} 頻道已觸發發送`);
        loadNews();
      } catch (err) {
        alert('發送失敗：' + err.message);
      }
    });

    container.appendChild(card);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.getElementById('saveToken').addEventListener('click', () => {
  localStorage.setItem('adminToken', document.getElementById('adminToken').value.trim());
  init();
});

document.getElementById('fetchNewsBtn').addEventListener('click', async () => {
  try {
    const result = await api('/api/news/fetch', { method: 'POST' });
    alert(`擷取完成，共 ${result.total} 則，新增 ${result.added} 則`);
    loadNews();
  } catch (err) {
    alert('擷取失敗：' + err.message);
  }
});

document.getElementById('adminToken').value = getToken();

function init() {
  loadNews().catch((err) => console.error(err));
  loadSchedules().catch((err) => console.error(err));
}

init();
