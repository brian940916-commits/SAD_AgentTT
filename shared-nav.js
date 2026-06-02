/* ============================================================
   Agent TT — shared-nav.js
   共用導覽列與頁尾注入
   ============================================================ */

/* ── 注入訊息中心樣式（只執行一次）───────────────────────── */
function _injectMsgCenterStyles() {
  if (document.getElementById('att-msg-center-styles')) return;
  const style = document.createElement('style');
  style.id = 'att-msg-center-styles';
  style.textContent = `
    .nav-msg-wrap { position: relative; }
    .nav-msg-btn {
      background: transparent; border: none; cursor: pointer;
      width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; position: relative; padding: 0;
      transition: background .15s;
    }
    .nav-msg-btn:hover { background: rgba(255,255,255,0.12); }
    .nav-msg-badge {
      position: absolute; top: -2px; right: -2px;
      background: #C4514A; color: #fff;
      min-width: 16px; height: 16px; border-radius: 8px;
      font-size: 10px; font-weight: 700; padding: 0 4px;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    }
    .nav-msg-badge.hidden { display: none; }
    .nav-msg-dropdown {
      position: absolute; top: calc(100% + 8px); right: 0;
      width: 320px; max-height: 460px; overflow: hidden;
      background: #fff; border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0,0,0,.18);
      z-index: 1000; display: flex; flex-direction: column;
      font-family: 'Noto Sans TC','PingFang TC',sans-serif;
    }
    .nav-msg-dropdown.hidden { display: none; }
    .nav-msg-head {
      padding: 12px 16px; border-bottom: 1px solid #F0EDE5;
      font-size: 14px; font-weight: 700; color: #2C4A3E;
    }
    .nav-msg-list { overflow-y: auto; flex: 1; }
    .nav-msg-item {
      padding: 10px 16px; border-bottom: 1px solid #F5F3EC;
      cursor: pointer; display: flex; gap: 10px; align-items: flex-start;
      transition: background .12s;
    }
    .nav-msg-item:hover { background: #FAF6EC; }
    .nav-msg-item-body { flex: 1; min-width: 0; }
    .nav-msg-item-title {
      font-size: 13px; font-weight: 600; color: #333;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .nav-msg-item-sub {
      font-size: 11px; color: #888; margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .nav-msg-item-preview {
      font-size: 12px; color: #666; margin-top: 4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .nav-msg-item-meta {
      display: flex; flex-direction: column; align-items: flex-end;
      flex-shrink: 0; gap: 4px;
    }
    .nav-msg-item-time { font-size: 10px; color: #999; }
    .nav-msg-item-unread {
      background: #C4514A; color: #fff;
      min-width: 18px; height: 16px; padding: 0 5px;
      border-radius: 8px; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .nav-msg-empty {
      padding: 40px 20px; text-align: center;
      font-size: 13px; color: #999;
    }
  `;
  document.head.appendChild(style);
}

/* ── 路徑比對：決定目前頁面屬於哪個模組 ─────────────────── */
function _getActiveModule() {
  const path = window.location.pathname;
  if (path.includes('trip') || path.includes('station-explore') || path.includes('station_explore')) return 'trip';
  if (path.includes('property') || path.includes('host') || path.includes('admin')) return 'property';
  if (path.includes('train')) return 'train';
  return 'home';
}

/* ── Logo SVG ────────────────────────────────────────────── */
function _logoSVG() {
  return `
    <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#E8C547" stroke="#FAF6EC" stroke-width="1.5"/>
      <text x="20" y="26" text-anchor="middle" font-size="15" font-weight="700"
            fill="#2C4A3E" font-family="serif">TT</text>
    </svg>`;
}

/* ── 頭像圓圈（顯示姓名第一個字）──────────────────────────── */
function _avatarHTML(name) {
  const initial = name ? name.charAt(0) : '?';
  return `
    <div class="navbar-avatar" id="nav-avatar" role="button"
         aria-haspopup="true" aria-expanded="false" tabindex="0">
      ${initial}
    </div>`;
}

/* ── 下拉選單項目 ─────────────────────────────────────────── */
function _dropdownItem(href, label, isDanger) {
  const cls = isDanger ? 'dropdown-item danger' : 'dropdown-item';
  return `<a href="${href}" class="${cls}">${label}</a>`;
}

function _logoutItem() {
  return `<button class="dropdown-item danger" id="nav-logout-btn">登出</button>`;
}

/* ── 依角色產生下拉選單內容 ───────────────────────────────── */
function _dropdownMenuByRole(role) {
  if (role === 'guest') {
    return [
      _dropdownItem('trip-list.html',              '📅 我的行程'),
      _dropdownItem('property-orders.html',         '🏠 我的訂單'),
      _dropdownItem('property-search.html?fav=1',   '❤️ 我的收藏'),
      _dropdownItem('train-tickets.html',            '🎫 我的票券'),
      _dropdownItem('train-points.html',             '⭐ 點數中心'),
      _dropdownItem('train-complaint.html',          '💬 客訴服務'),
      '<div class="dropdown-divider"></div>',
      _logoutItem(),
    ].join('');
  }
  if (role === 'host') {
    return [
      _dropdownItem('host-dashboard.html', '🏡 房東後台'),
      '<div class="dropdown-divider"></div>',
      _logoutItem(),
    ].join('');
  }
  if (role === 'admin') {
    return [
      _dropdownItem('admin-platform.html', '⚙️ 管理員後台'),
      '<div class="dropdown-divider"></div>',
      _logoutItem(),
    ].join('');
  }
  return _logoutItem();
}

/* ── 訊息中心（admin 不顯示）──────────────────────────────── */
function _messageCenter(user) {
  if (!user || user.role === 'admin') return '';
  return `
    <div class="nav-msg-wrap">
      <button class="nav-msg-btn" id="nav-msg-btn" aria-haspopup="true"
              aria-expanded="false" aria-label="訊息中心" title="訊息中心">
        💬
        <span class="nav-msg-badge hidden" id="nav-msg-badge">0</span>
      </button>
      <div class="nav-msg-dropdown hidden" id="nav-msg-dropdown" role="menu">
        <div class="nav-msg-head">💬 訊息中心</div>
        <div class="nav-msg-list" id="nav-msg-list">
          <div class="nav-msg-empty">目前沒有對話</div>
        </div>
      </div>
    </div>`;
}

/* ── 右側使用者區塊 ───────────────────────────────────────── */
function _rightSection(user) {
  if (!user) {
    return `<a href="login.html" style="background:#E8C547;color:#2C4A3E;padding:8px 18px;border-radius:4px;font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap;">登入</a>`;
  }

  return `
    ${_messageCenter(user)}
    <span style="font-size:13px;color:#C5B886;">${user.name}</span>
    <div class="dropdown">
      ${_avatarHTML(user.name)}
      <div class="dropdown-menu hidden" id="nav-dropdown" role="menu">
        <div style="padding:10px 16px 8px;border-bottom:1px solid var(--color-border-light);">
          <div style="font-size:13px;font-weight:600;color:var(--color-text-main);">${user.name}</div>
          <div style="font-size:11px;color:var(--color-text-light);">${user.email}</div>
        </div>
        ${_dropdownMenuByRole(user.role)}
      </div>
    </div>`;
}

/* ── renderNav ────────────────────────────────────────────── */
function renderNav() {
  const container = document.getElementById('navbar-container');
  if (!container) return;

  _injectMsgCenterStyles();

  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const path = window.location.pathname;

  /* ── 角色頁面保護 ── */
  if (user) {
    if (user.role === 'host' && (path.includes('trip') || path.includes('train'))) {
      window.location.href = 'host-dashboard.html';
      return;
    }
    if (user.role === 'admin' && !path.includes('admin') && !path.includes('login')) {
      window.location.href = 'admin-platform.html';
      return;
    }
  }

  const active = _getActiveModule();
  const link = (href, label, key) => {
    const isActive = active === key;
    return `<a href="${href}" class="navbar-link${isActive ? ' active' : ''}">${label}</a>`;
  };

  /* ── 依角色決定 Logo 目標與中間連結 ── */
  let logoHref, middleLinks;

  if (user?.role === 'host') {
    logoHref = 'host-dashboard.html';
    middleLinks = `<a href="host-dashboard.html" class="navbar-link${path.includes('host') ? ' active' : ''}">🏡 房東後台</a>`;
  } else if (user?.role === 'admin') {
    logoHref = 'admin-platform.html';
    middleLinks = `<a href="admin-platform.html" class="navbar-link${path.includes('admin') ? ' active' : ''}">⚙️ 管理員後台</a>`;
  } else {
    logoHref = 'index.html';
    middleLinks = [
      link('index.html',           '首頁',     'home'),
      link('trip-list.html',       '行程規劃', 'trip'),
      link('property-search.html', '住宿訂房', 'property'),
      link('train-search.html',    '台鐵車票', 'train'),
    ].join('');
  }

  container.innerHTML = `
    <nav id="navbar" role="navigation" aria-label="主導覽列">
      <div class="navbar-inner">

        <!-- 左側 Logo -->
        <a href="${logoHref}" class="navbar-brand" aria-label="Agent TT 首頁">
          ${_logoSVG()}
          <div>
            <div class="navbar-brand-name">Agent TT</div>
            <div class="navbar-brand-sub">中彰投小站旅遊</div>
          </div>
        </a>

        <!-- 中間連結 -->
        <div class="navbar-links" role="list">
          ${middleLinks}
        </div>

        <!-- 右側使用者 -->
        <div class="navbar-right">
          ${_rightSection(user)}
        </div>

        <!-- 漢堡按鈕（手機版） -->
        <button class="navbar-hamburger" id="nav-hamburger"
                aria-label="展開選單" aria-expanded="false">☰</button>

      </div>
    </nav>`;

  _bindNavEvents();
}

/* ── 事件綁定 ─────────────────────────────────────────────── */
function _bindNavEvents() {
  /* 頭像切換下拉 */
  const avatar    = document.getElementById('nav-avatar');
  const dropdown  = document.getElementById('nav-dropdown');
  const msgBtn    = document.getElementById('nav-msg-btn');
  const msgDrop   = document.getElementById('nav-msg-dropdown');

  if (avatar && dropdown) {
    avatar.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden', isOpen);
      avatar.setAttribute('aria-expanded', String(!isOpen));
      if (msgDrop) msgDrop.classList.add('hidden');
      if (msgBtn)  msgBtn.setAttribute('aria-expanded', 'false');
    });

    avatar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        avatar.click();
      }
    });
  }

  /* 訊息中心切換 */
  if (msgBtn && msgDrop) {
    msgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !msgDrop.classList.contains('hidden');
      if (!isOpen) _renderMsgList();
      msgDrop.classList.toggle('hidden', isOpen);
      msgBtn.setAttribute('aria-expanded', String(!isOpen));
      if (dropdown) dropdown.classList.add('hidden');
      if (avatar)   avatar.setAttribute('aria-expanded', 'false');
    });
    msgDrop.addEventListener('click', (e) => e.stopPropagation());
  }

  /* 登出按鈕 */
  const logoutBtn = document.getElementById('nav-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (typeof logout === 'function') logout();
      window.location.href = 'login.html';
    });
  }

  /* 漢堡選單切換 */
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks  = document.querySelector('#navbar .navbar-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle('mobile-open');
      hamburger.textContent = isOpen ? '✕' : '☰';
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        hamburger.textContent = '☰';
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* 點擊外部關閉下拉與漢堡選單 */
  document.addEventListener('click', () => {
    if (dropdown) {
      dropdown.classList.add('hidden');
      if (avatar) avatar.setAttribute('aria-expanded', 'false');
    }
    if (msgDrop) {
      msgDrop.classList.add('hidden');
      if (msgBtn) msgBtn.setAttribute('aria-expanded', 'false');
    }
    if (navLinks && hamburger) {
      navLinks.classList.remove('mobile-open');
      hamburger.textContent = '☰';
      hamburger.setAttribute('aria-expanded', 'false');
    }
  }, { capture: false });

  /* 未讀紅點：初始化 + 監聽 storage / 自訂事件 / 5 秒輪詢 */
  if (msgBtn) _initUnreadBadge();
}

/* ── 訊息中心未讀紅點與下拉列表 ─────────────────────────── */
let _unreadPollTimer = null;

function _refreshUnreadBadge() {
  const badge = document.getElementById('nav-msg-badge');
  if (!badge) return;
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user || user.role === 'admin') return;
  const n = typeof getUnreadCountForUser === 'function'
    ? getUnreadCountForUser(user.id, user.role)
    : 0;
  if (n > 0) {
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function _initUnreadBadge() {
  _refreshUnreadBadge();
  window.addEventListener('storage', (e) => {
    if (e.key === 'agenttt_messages') {
      _refreshUnreadBadge();
      const dropdown = document.getElementById('nav-msg-dropdown');
      if (dropdown && !dropdown.classList.contains('hidden')) _renderMsgList();
    }
  });
  window.addEventListener('agenttt:unread-changed', _refreshUnreadBadge);
  if (_unreadPollTimer) clearInterval(_unreadPollTimer);
  _unreadPollTimer = setInterval(_refreshUnreadBadge, 5000);
}

function _fmtMsgTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (isToday) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function _escNav(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _renderMsgList() {
  const listEl = document.getElementById('nav-msg-list');
  if (!listEl) return;
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) return;

  const convs = user.role === 'host'
    ? (typeof getConversationsByHost === 'function' ? getConversationsByHost(user.id) : [])
    : (typeof getConversationsByGuest === 'function' ? getConversationsByGuest(user.id) : []);

  if (!convs.length) {
    listEl.innerHTML = `<div class="nav-msg-empty">目前沒有對話</div>`;
    return;
  }

  listEl.innerHTML = convs.slice(0, 6).map(c => {
    const last = c.messages && c.messages.length ? c.messages[c.messages.length - 1] : null;
    const preview = last ? last.text.slice(0, 20) + (last.text.length > 20 ? '…' : '') : '尚無訊息';
    const time    = _fmtMsgTime(c.lastMessageAt || c.createdAt);
    const unread  = (c.messages || []).filter(m =>
      m.senderId !== user.id && !(m.readBy || []).includes(user.id)
    ).length;
    const title = user.role === 'host'
      ? _escNav(c.guestName || '旅客')
      : _escNav(c.propertyName || '房源');
    const sub   = user.role === 'host'
      ? `📍 ${_escNav(c.propertyName || '')}`
      : '';

    return `
      <div class="nav-msg-item" data-booking-id="${_escNav(c.bookingId)}">
        <div class="nav-msg-item-body">
          <div class="nav-msg-item-title">${title}</div>
          ${sub ? `<div class="nav-msg-item-sub">${sub}</div>` : ''}
          <div class="nav-msg-item-preview">${_escNav(preview)}</div>
        </div>
        <div class="nav-msg-item-meta">
          <div class="nav-msg-item-time">${time}</div>
          ${unread > 0 ? `<div class="nav-msg-item-unread">${unread > 9 ? '9+' : unread}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.nav-msg-item').forEach(el => {
    el.addEventListener('click', () => {
      const bid = el.getAttribute('data-booking-id');
      const dropdown = document.getElementById('nav-msg-dropdown');
      const btn      = document.getElementById('nav-msg-btn');
      if (dropdown) dropdown.classList.add('hidden');
      if (btn)      btn.setAttribute('aria-expanded', 'false');
      if (typeof window.openChatModal === 'function') {
        window.openChatModal(bid);
      }
    });
  });
}

/* ── renderFooter ─────────────────────────────────────────── */
function renderFooter() {
  const container = document.getElementById('footer-container');
  if (!container) return;

  container.innerHTML = `
    <footer id="footer" role="contentinfo">
      © 2026 Agent TT × 中彰投鐵道旅遊　|　系統分析與設計 第三大組
    </footer>`;
}
