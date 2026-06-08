/* ============================================================
   Agent TT — shared-chat.js
   全域訂單對話 Modal：window.openChatModal(bookingId)
   ============================================================ */

(function() {
  const MODAL_ID  = 'agenttt-chat-modal';
  const POLL_MS   = 2000;

  let currentBookingId = null;
  let pollTimer        = null;

  // 訂房後顧客快速訊息（純送出，由房東本人回覆，不自動回覆）
  const POST_BOOKING_GUEST_CANNED = [
    '請問可以提早入住嗎？', '方便提供停車資訊嗎？',
    '我可能會晚一點到，沒問題嗎？', '請問退房時間是幾點？',
  ];
  // 房東快速回覆（填入輸入框讓房東微調再送）
  const HOST_CANNED = [
    '您好！已收到您的訊息，我盡快回覆您 🙏', '可以的，沒問題！',
    '麻煩您提供訂單編號，我為您查詢。', '感謝您的詢問，期待您的入住 😊',
  ];

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (isToday) return `${hh}:${mm}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
  }

  function _injectOnce() {
    if (document.getElementById(MODAL_ID)) return;

    const style = document.createElement('style');
    style.textContent = `
      .att-chat-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.45);
        display: none; align-items: center; justify-content: center;
        z-index: 9999; font-family: 'Noto Sans TC','PingFang TC',sans-serif;
      }
      .att-chat-overlay.open { display: flex; }
      .att-chat-box {
        width: 92%; max-width: 480px; height: 88vh; max-height: 640px;
        background: #FAF6EC; border-radius: 12px; overflow: hidden;
        display: flex; flex-direction: column;
        box-shadow: 0 10px 40px rgba(0,0,0,.25);
      }
      .att-chat-head {
        background: #2C4A3E; color: #fff;
        padding: 14px 18px; display: flex; align-items: center; gap: 10px;
      }
      .att-chat-head-info { flex: 1; min-width: 0; }
      .att-chat-head-title {
        font-size: 15px; font-weight: 700;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .att-chat-head-sub {
        font-size: 12px; color: #C5B886; margin-top: 2px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .att-chat-close {
        background: transparent; border: none; color: #fff;
        font-size: 22px; cursor: pointer; padding: 0 4px;
      }
      .att-chat-body {
        flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
        background: #FAF6EC; display: flex; flex-direction: column; gap: 10px;
      }
      .att-chat-empty {
        text-align: center; color: #999; font-size: 13px;
        padding: 40px 20px;
      }
      .att-msg-row { display: flex; flex-direction: column; max-width: 78%; }
      .att-msg-row.mine { align-self: flex-end; align-items: flex-end; }
      .att-msg-row.theirs { align-self: flex-start; align-items: flex-start; }
      .att-msg-bubble {
        padding: 8px 13px; border-radius: 14px;
        font-size: 14px; line-height: 1.55; word-break: break-word;
        white-space: pre-wrap;
      }
      .att-msg-row.mine .att-msg-bubble {
        background: #2C4A3E; color: #fff; border-bottom-right-radius: 4px;
      }
      .att-msg-row.theirs .att-msg-bubble {
        background: #fff; color: #333; border: 1px solid #E5DFCB;
        border-bottom-left-radius: 4px;
      }
      .att-msg-time {
        font-size: 10px; color: #999; margin-top: 3px; padding: 0 4px;
      }
      .att-chat-foot {
        padding: 10px 12px; background: #fff;
        border-top: 1px solid #E5DFCB;
        display: flex; gap: 8px; align-items: flex-end;
      }
      .att-chat-input {
        flex: 1; border: 1.5px solid #E5DFCB; border-radius: 18px;
        padding: 8px 14px; font-size: 14px; resize: none;
        font-family: inherit; outline: none; max-height: 90px;
        line-height: 1.4;
      }
      .att-chat-input:focus { border-color: #2C4A3E; }
      .att-chat-send {
        background: #2C4A3E; color: #fff; border: none;
        width: 38px; height: 38px; border-radius: 50%;
        font-size: 16px; cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .att-chat-send:hover { background: #1f3a30; }
      .att-chat-send:disabled { background: #999; cursor: not-allowed; }
      .att-chat-canned {
        display: flex; gap: 6px; flex-wrap: wrap;
        padding: 8px 12px 0; background: #FAF6EC;
      }
      .att-canned-chip {
        padding: 4px 10px; border: 1.5px solid #E5DFCB; border-radius: 16px;
        font-size: 12px; cursor: pointer; background: #fff; color: #5a5040;
        font-family: inherit; transition: all .15s; white-space: nowrap;
      }
      .att-canned-chip:hover { border-color: #2C4A3E; color: #2C4A3E; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'att-chat-overlay';
    overlay.innerHTML = `
      <div class="att-chat-box" onclick="event.stopPropagation()">
        <div class="att-chat-head">
          <div class="att-chat-head-info">
            <div class="att-chat-head-title" id="att-chat-title">對話</div>
            <div class="att-chat-head-sub" id="att-chat-sub"></div>
          </div>
          <button class="att-chat-close" id="att-chat-close" aria-label="關閉">✕</button>
        </div>
        <div class="att-chat-body" id="att-chat-body"></div>
        <div class="att-chat-canned" id="att-chat-canned"></div>
        <div class="att-chat-foot">
          <textarea class="att-chat-input" id="att-chat-input"
            placeholder="輸入訊息…" rows="1"></textarea>
          <button class="att-chat-send" id="att-chat-send" aria-label="送出">➤</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) _close();
    });
    document.getElementById('att-chat-close').addEventListener('click', _close);
    document.getElementById('att-chat-send').addEventListener('click', _send);
    document.getElementById('att-chat-canned').addEventListener('click', e => {
      const chip = e.target.closest('.att-canned-chip');
      if (!chip) return;
      const text = chip.dataset.text;
      if (chip.dataset.action === 'fill') {
        const input = document.getElementById('att-chat-input');
        input.value = text; input.focus();
      } else {
        _sendText(text, chip.dataset.action === 'send-faq');
      }
    });
    document.getElementById('att-chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _send();
      }
    });
  }

  function _render() {
    if (!currentBookingId) return;
    const user = getCurrentUser();
    if (!user) return;
    const conv = getConversationByBookingId(currentBookingId);
    if (!conv) return;

    // 標題
    const titleEl = document.getElementById('att-chat-title');
    const subEl   = document.getElementById('att-chat-sub');
    if (user.role === 'host') {
      titleEl.textContent = '👤 ' + (conv.guestName || '旅客');
      subEl.textContent   = '📍 ' + (conv.propertyName || '');
    } else {
      const host = conv.hostId ? getUserById(conv.hostId) : null;
      titleEl.textContent = '🏡 ' + (conv.propertyName || '房源');
      subEl.textContent   = host ? `房東：${host.name}` : '';
    }

    // 訊息列表（用 senderRole 對比 user.role，避免共用 localStorage 時 senderId 失準）
    const myRole = user.role === 'host' ? 'host' : 'guest';
    const bodyEl = document.getElementById('att-chat-body');
    if (!conv.messages.length) {
      bodyEl.innerHTML = `<div class="att-chat-empty">尚無訊息，傳送第一則訊息開啟對話 👋</div>`;
    } else {
      bodyEl.innerHTML = conv.messages.map(m => {
        const mine = m.senderRole === myRole;
        return `
          <div class="att-msg-row ${mine ? 'mine' : 'theirs'}">
            <div class="att-msg-bubble">${_esc(m.text)}</div>
            <div class="att-msg-time">${_fmtTime(m.createdAt)}</div>
          </div>`;
      }).join('');
    }
    bodyEl.scrollTop = bodyEl.scrollHeight;

    _renderCanned(conv, user);
  }

  // 依角色與對話類型顯示罐頭按鈕
  function _renderCanned(conv, user) {
    const el = document.getElementById('att-chat-canned');
    let chips;
    if (user.role === 'host') {
      chips = HOST_CANNED.map(t => ({ text: t, action: 'fill' }));                 // 房東：填入再送
    } else if (conv.type === 'inquiry') {
      chips = getPropertyFaq(conv.propertyId).map(f => ({ text: f.q, action: 'send-faq' })); // 訂房前：FAQ 提問（觸發自動回覆）
    } else {
      chips = POST_BOOKING_GUEST_CANNED.map(t => ({ text: t, action: 'send' }));    // 訂房後：通用快速訊息
    }
    el.innerHTML = chips.map(c => {
      const label = c.text.length > 14 ? c.text.slice(0, 14) + '…' : c.text;
      return `<button class="att-canned-chip" data-text="${_esc(c.text)}" data-action="${c.action}">${_esc(label)}</button>`;
    }).join('');
  }

  // 送出一則訊息（text）；fromFaq=true 時於訂房前諮詢由系統代房東自動回覆
  function _sendText(text, fromFaq) {
    if (!currentBookingId || !text) return;
    const user = getCurrentUser();
    if (!user) return;
    const senderRole = user.role === 'host' ? 'host' : 'guest';
    sendMessage(currentBookingId, senderRole, text);
    _render();
    window.dispatchEvent(new Event('agenttt:unread-changed'));

    if (fromFaq && senderRole === 'guest') {
      const conv = getConversationByBookingId(currentBookingId);
      const faq  = conv ? getPropertyFaq(conv.propertyId) : [];
      const hit  = faq.find(f => f.q === text);
      const reply = hit ? hit.a : '感謝您的詢問，房東會盡快回覆您！如需即時協助，完成訂房後可於「我的訂單」聯繫。';
      setTimeout(() => { pushAutoReply(currentBookingId, reply); _render(); }, 700);
    }
  }

  function _send() {
    const input = document.getElementById('att-chat-input');
    const text  = input.value.trim();
    if (!text) return;
    input.value = '';
    const conv = getConversationByBookingId(currentBookingId);
    const user = getCurrentUser();
    const guestInquiry = !!conv && conv.type === 'inquiry' && !!user && user.role !== 'host';
    _sendText(text, guestInquiry);
  }

  function _close() {
    document.getElementById(MODAL_ID).classList.remove('open');
    document.body.style.overflow = '';
    currentBookingId = null;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function _onStorage(e) {
    if (e.key === 'agenttt_messages' && currentBookingId) _render();
  }

  window.openChatModal = function(key) {
    _injectOnce();

    const user = getCurrentUser();
    if (!user) { alert('請先登入'); return; }

    // 支援兩種對話：訂房後（bookingId）與訂房前諮詢（inq_ 合成鍵）
    let conv = getConversationByBookingId(key);
    if (!conv) {
      const booking = getBookingById(key);
      if (booking) conv = getOrCreateConversation(booking);
    }
    if (!conv) { console.warn('[shared-chat] conversation not found:', key); return; }

    // 訂房前諮詢：首次開啟由系統代房東送出歡迎自動回覆
    if (conv.type === 'inquiry' && conv.messages.length === 0) {
      pushAutoReply(conv.bookingId, `您好！歡迎詢問「${conv.propertyName}」，有任何問題都可以問我，或點選下方常見問題 😊`);
    }

    currentBookingId = conv.bookingId;

    document.getElementById('att-chat-input').value = '';
    document.getElementById(MODAL_ID).classList.add('open');
    document.body.style.overflow = 'hidden';

    _render();
    markConversationRead(currentBookingId, user.id);
    window.dispatchEvent(new Event('agenttt:unread-changed'));

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (currentBookingId) {
        _render();
        markConversationRead(currentBookingId, user.id);
      }
    }, POLL_MS);

    setTimeout(() => document.getElementById('att-chat-input').focus(), 100);
  };

  window.addEventListener('storage', _onStorage);
})();
