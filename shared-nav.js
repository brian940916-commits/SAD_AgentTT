/* ============================================================
   Agent TT — shared-nav.js
   共用導覽列與頁尾注入
   ============================================================ */

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
      _dropdownItem('trip-list.html',      '📅 我的行程'),
      _dropdownItem('property-orders.html','🏠 我的訂單'),
      _dropdownItem('train-tickets.html',  '🎫 我的票券'),
      _dropdownItem('train-points.html',   '⭐ 點數中心'),
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

/* ── 右側使用者區塊 ───────────────────────────────────────── */
function _rightSection(user) {
  if (!user) {
    return `<a href="login.html" class="btn btn-outline btn-sm"
              style="color:#FAF6EC;border-color:#FAF6EC;">登入</a>`;
  }

  return `
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

  const active = _getActiveModule();
  const user   = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  const link = (href, label, key) => {
    const isActive = active === key;
    return `<a href="${href}" class="navbar-link${isActive ? ' active' : ''}">${label}</a>`;
  };

  container.innerHTML = `
    <nav id="navbar" role="navigation" aria-label="主導覽列">
      <div class="navbar-inner">

        <!-- 左側 Logo -->
        <a href="index.html" class="navbar-brand" aria-label="Agent TT 首頁">
          ${_logoSVG()}
          <div>
            <div class="navbar-brand-name">Agent TT</div>
            <div class="navbar-brand-sub">中彰投小站旅遊</div>
          </div>
        </a>

        <!-- 中間連結 -->
        <div class="navbar-links" role="list">
          ${link('index.html',           '首頁',     'home')}
          ${link('trip-list.html',       '行程規劃', 'trip')}
          ${link('property-search.html', '住宿訂房', 'property')}
          ${link('train-search.html',    '台鐵車票', 'train')}
        </div>

        <!-- 右側使用者 -->
        <div class="navbar-right">
          ${_rightSection(user)}
        </div>

      </div>
    </nav>`;

  _bindNavEvents();
}

/* ── 事件綁定 ─────────────────────────────────────────────── */
function _bindNavEvents() {
  /* 頭像切換下拉 */
  const avatar   = document.getElementById('nav-avatar');
  const dropdown = document.getElementById('nav-dropdown');

  if (avatar && dropdown) {
    avatar.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden', isOpen);
      avatar.setAttribute('aria-expanded', String(!isOpen));
    });

    avatar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        avatar.click();
      }
    });
  }

  /* 登出按鈕 */
  const logoutBtn = document.getElementById('nav-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (typeof logout === 'function') logout();
      window.location.href = 'login.html';
    });
  }

  /* 點擊外部關閉下拉 */
  document.addEventListener('click', () => {
    if (dropdown) {
      dropdown.classList.add('hidden');
      if (avatar) avatar.setAttribute('aria-expanded', 'false');
    }
  }, { capture: false });
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
