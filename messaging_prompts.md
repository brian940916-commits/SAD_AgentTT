# Agent TT 訊息系統重構 — Claude Code Prompts

> **目的**：把現有破碎的對話功能整合成「以訂單為核心」的雙向訊息系統，加上 navbar 未讀紅點。
> **使用方式**：5 個階段，依序貼給 Claude Code，每個階段做完先驗收再進入下一個。

---

## 📐 整體架構（先讓 Claude Code 讀過再開工）

### 設計原則
1. **每筆住宿訂單 = 一個對話串**（Conversation ID = `conv_<bookingId>`）
2. **資料統一存於 `localStorage['agenttt_messages']`**，雙方共享同一份
3. **所有頁面點 💬 都呼叫共用的 `window.openChatModal(bookingId)`**
4. **navbar 顯示未讀紅點**，輪詢更新 + storage 事件即時同步
5. **房源預諮詢（未下單時）保留現有 AI 模擬**，不入庫，僅訂單成立後才有真實對話
6. **客訴系統獨立**（第 5 階段另做）

### 統一資料結構（Conversation / Message）
```js
Conversation: {
  id: 'conv_<bookingId>',
  bookingId: string,
  propertyId: string,
  propertyName: string,
  hostId: string,
  guestId: string,
  guestName: string,
  messages: Message[],
  lastMessageAt: string,   // ISO，用於排序
  createdAt: string,
}

Message: {
  id: string,
  senderId: string,
  senderRole: 'guest' | 'host',
  text: string,
  createdAt: string,
  readBy: string[],        // 讀取過的 userId 陣列
}
```

---

## 🎯 階段 1：資料層 + 共用對話 Modal

> 這是基礎建設，先做完再做其他。產出：`shared-data.js` 新函數 + 新增 `shared-chat.js`。

### Prompt 1（複製給 Claude Code）

```
請依照下列規格修改 shared-data.js 並新增 shared-chat.js，建立統一的訂單對話系統。

【一、修改 shared-data.js】

0. 在 init() 函數最開頭新增 schema 版本檢查機制，自動清理舊格式訊息資料：

   在檔案頂部（KEYS 物件下方）新增常數：
   const MESSAGES_SCHEMA_VERSION = '2';
   const SCHEMA_KEY = 'agenttt_schema_version';

   新增函數：
   function migrateMessagesIfNeeded() {
     const currentVersion = localStorage.getItem(SCHEMA_KEY);
     if (currentVersion === MESSAGES_SCHEMA_VERSION) return;

     // 偵測到舊格式或無版本標記，清空舊訊息資料
     const oldData = localStorage.getItem('agenttt_messages');
     if (oldData) {
       console.log('[AgentTT] 偵測到舊版訊息格式，已自動清空');
       localStorage.removeItem('agenttt_messages');
     }
     localStorage.setItem(SCHEMA_KEY, MESSAGES_SCHEMA_VERSION);
   }

   在現有的 init() 函數最開頭（任何其他初始化邏輯之前）呼叫：
   migrateMessagesIfNeeded();

   此機制只清「訊息」資料，使用者帳號、訂單、票券、行程等其他資料完全保留。

1. 在檔案上方的資料結構 JSDoc 區塊新增：
   Conversation: {
     id, bookingId, propertyId, propertyName,
     hostId, guestId, guestName,
     messages: Message[], lastMessageAt, createdAt
   }
   Message: {
     id, senderId, senderRole: 'guest'|'host',
     text, createdAt, readBy: string[]
   }

2. 在檔案中新增以下函數（放在 saveBooking 區塊之後）：

   function getConversations() {
     return getData(KEYS.MESSAGES) || [];
   }

   function getConversationByBookingId(bookingId) {
     return getConversations().find(c => c.bookingId === bookingId) || null;
   }

   function getOrCreateConversation(booking) {
     // booking 是一個 Booking 物件
     const convs = getConversations();
     const existing = convs.find(c => c.bookingId === booking.id);
     if (existing) return existing;

     const prop = getPropertyById(booking.propertyId);
     const conv = {
       id:           'conv_' + booking.id,
       bookingId:    booking.id,
       propertyId:   booking.propertyId,
       propertyName: booking.propertyName,
       hostId:       prop ? prop.hostId : null,
       guestId:      booking.userId,
       guestName:    booking.guestName || '旅客',
       messages:     [],
       lastMessageAt: nowISO(),
       createdAt:    nowISO(),
     };
     convs.push(conv);
     setData(KEYS.MESSAGES, convs);
     return conv;
   }

   function sendMessage(bookingId, senderRole, text) {
     const convs = getConversations();
     const idx = convs.findIndex(c => c.bookingId === bookingId);
     if (idx < 0) return null;
     const user = getCurrentUser();
     const msg = {
       id:         generateId(),
       senderId:   user ? user.id : '',
       senderRole, // 'guest' | 'host'
       text,
       createdAt:  nowISO(),
       readBy:     user ? [user.id] : [],
     };
     convs[idx].messages.push(msg);
     convs[idx].lastMessageAt = msg.createdAt;
     setData(KEYS.MESSAGES, convs);
     return msg;
   }

   function markConversationRead(bookingId, userId) {
     const convs = getConversations();
     const idx = convs.findIndex(c => c.bookingId === bookingId);
     if (idx < 0) return;
     let changed = false;
     convs[idx].messages.forEach(m => {
       if (!m.readBy) m.readBy = [];
       if (!m.readBy.includes(userId)) {
         m.readBy.push(userId);
         changed = true;
       }
     });
     if (changed) setData(KEYS.MESSAGES, convs);
   }

   function getUnreadCountForUser(userId, role) {
     // role: 'guest' | 'host'
     const convs = getConversations();
     const myConvs = role === 'host'
       ? convs.filter(c => c.hostId === userId)
       : convs.filter(c => c.guestId === userId);
     return myConvs.reduce((sum, c) => {
       return sum + c.messages.filter(m =>
         m.senderId !== userId && !(m.readBy || []).includes(userId)
       ).length;
     }, 0);
   }

   function getConversationsByHost(hostId) {
     return getConversations()
       .filter(c => c.hostId === hostId)
       .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
   }

   function getConversationsByGuest(guestId) {
     return getConversations()
       .filter(c => c.guestId === guestId)
       .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
   }

【二、新增 shared-chat.js】

建立一個自包含的對話 Modal 元件，提供全域函數 window.openChatModal(bookingId)。
規格：

1. 在 DOMContentLoaded 時注入 Modal 的 HTML 和 CSS 到 body（只注入一次，用 id 防重複）
2. Modal 結構：
   - 標題列：顯示對話對象（顧客看到房源名稱+房東名稱，房東看到房源+顧客名稱）+ 關閉按鈕
   - 訊息列表：類似聊天 App，自己的訊息靠右綠色泡泡，對方訊息靠左灰色泡泡，顯示時間
   - 輸入區：textarea + 送出按鈕（Enter 送出，Shift+Enter 換行）
3. 開啟流程 openChatModal(bookingId)：
   - 取得 booking，呼叫 getOrCreateConversation(booking) 確保對話存在
   - 渲染歷史訊息
   - 開啟時呼叫 markConversationRead(bookingId, currentUser.id) 清除未讀
   - 觸發 window 上的 'agenttt:unread-changed' 事件（讓 navbar 紅點重算）
4. 送出訊息：
   - 判斷 currentUser.role 決定 senderRole（host 或 guest）
   - 呼叫 sendMessage(bookingId, senderRole, text)
   - 重繪訊息列表、清空輸入框
   - 觸發 window storage 事件不需手動，瀏覽器自動發
5. 即時更新：
   - 監聽 window 的 'storage' 事件，若 key === 'agenttt_messages' 且 Modal 開啟中，重繪當前對話
   - 額外加一個 2 秒輪詢（在 Modal 開啟期間），補強同分頁多視窗無 storage 事件的情況
   - Modal 關閉時清除輪詢計時器
6. UI 設計：沿用專案配色（主色 #2C4A3E、背景 #FAF6EC、字型 'Noto Sans TC'），參考 host-dashboard 的對話樣式
7. 不可在 Modal 內使用 form/submit，按鈕用 onclick

最後在所有需要對話功能的 HTML 頁面（property-orders.html、host-dashboard.html、property-detail.html）的 <script src="shared-data.js"></script> 之後加上：
<script src="shared-chat.js"></script>

【驗收方式】
- 開瀏覽器 console 執行 getConversations() 應該不報錯
- 執行 window.openChatModal('任一存在的 bookingId') 應該彈出對話視窗
- 在對話視窗送出訊息後，重新整理頁面再次開啟，訊息仍在
```

### 驗收清單
- [ ] 首次開啟頁面時 console 出現「偵測到舊版訊息格式，已自動清空」（若先前有測試資料）
- [ ] `localStorage.getItem('agenttt_schema_version')` 回傳 `"2"`
- [ ] `getConversations()`、`sendMessage()` 等函數在 console 可呼叫
- [ ] `window.openChatModal('<bookingId>')` 可彈出視窗
- [ ] 送出訊息後重整仍存在
- [ ] localStorage 內 `agenttt_messages` 是新結構

---

## 🎯 階段 2：Navbar 訊息中心 + 未讀紅點

> 產出：修改 `shared-nav.js`，所有頁面 navbar 都會有 💬 圖示。

### Prompt 2

```
請修改 shared-nav.js，在右側使用者區塊（_rightSection 函數）的頭像左邊新增一個訊息中心圖示，要支援未讀紅點與下拉清單。需求如下：

1. 訊息中心圖示
   - 顯示位置：右側區塊中，使用者名稱左邊（未登入時不顯示）
   - 圖示用 emoji 💬，大小與下拉頭像差不多
   - 右上角紅點：當未讀數 > 0 時顯示，數字 > 9 顯示「9+」
   - 紅點樣式：背景 #C4514A，白字，圓形，font-size 10px
   - 點擊圖示展開下拉清單（與頭像下拉是兩個獨立 dropdown，互斥）

2. 下拉清單內容（依角色）
   - guest 角色：列出 getConversationsByGuest(user.id) 的所有對話
     - 每筆顯示：房源名稱、最新訊息預覽（截 20 字）、時間、未讀數紅點
     - 點擊該筆 → 呼叫 window.openChatModal(conv.bookingId)，並關閉下拉
   - host 角色：列出 getConversationsByHost(user.id) 的所有對話
     - 每筆顯示：顧客名稱、房源名稱、最新訊息預覽、時間、未讀數
     - 點擊該筆 → window.openChatModal(conv.bookingId)
   - admin 角色：不顯示訊息中心（admin 走客訴系統，不用這個）
   - 空清單時顯示「目前沒有對話」

3. 未讀計算
   - 圖示載入時呼叫 getUnreadCountForUser(user.id, user.role) 取得總未讀數
   - 監聽 window 的 'storage' 事件，key 為 'agenttt_messages' 時重新計算紅點
   - 監聽 window 的 'agenttt:unread-changed' 自訂事件，重新計算紅點
   - 每 5 秒輪詢一次當作 fallback

4. 不要破壞現有頭像下拉的功能
   - 兩個 dropdown 點 outside 都要關閉
   - 兩個 dropdown 不能同時開啟

5. 樣式參考現有 navbar 內其他元素，務必使用專案主色與字型，下拉清單寬度約 320px，最多顯示 6 筆對話，超出時內部捲動。

【驗收方式】
- 用 guest 帳號登入，property-orders 頁面點「💬 聯絡房東」送一筆訊息後，登出
- 用對應 host 帳號登入，navbar 💬 應該顯示紅點 1
- 點開 💬 應該看到那筆訊息，點該筆即開啟對話 Modal
- Modal 開啟後，紅點應消失
```

### 驗收清單
- [ ] 訊息中心圖示出現在 navbar
- [ ] 紅點數字正確
- [ ] 下拉清單可列出對話
- [ ] 點對話會開 Modal

---

## 🎯 階段 3：訂單頁面接入對話 Modal

> 產出：改寫 `property-orders.html` 和 `host-dashboard.html` 的對話入口。

### Prompt 3

```
請修改 property-orders.html 和 host-dashboard.html，把現有的對話功能整合進新的訊息系統。

【一、property-orders.html】

1. 移除舊的「聯絡房東」Modal（id="contact-modal"）整個 div 和 openContact / closeContact / submitContact 三個函數
2. 訂單卡上的「💬 聯絡房東」按鈕，onclick 改為直接呼叫 window.openChatModal(b.id)
3. 訂單卡新增未讀提示：若該訂單對應的對話有未讀（用 getConversationByBookingId 然後檢查 messages 內 readBy 不含 currentUser.id 的訊息數），按鈕文字改為「💬 聯絡房東（N 則新訊息）」並標紅

【二、host-dashboard.html】

1. §3 訂單管理區的每筆訂單，新增「💬 聯絡旅客」按鈕（放在現有「📋 訂單詳情」旁邊），onclick = window.openChatModal(b.id)
2. §4 顧客訊息分頁的改寫：
   - 移除 initConversations() 內「從訂房自動產生假對話」的邏輯（if convs.length===0 那段整個刪掉）
   - 改為直接呼叫 getConversationsByHost(currentUser.id) 取得真實對話清單
   - 渲染列表保留現有 UI 樣式（左邊對話清單 + 右邊聊天區）
   - 顯示時：左側對話清單每筆顯示顧客名 + 房源名 + 最新訊息 + 未讀紅點
   - 右側聊天區改為呼叫 window.openChatModal(activeConv.bookingId)？或者保留 inline 版本？

     → 採用 inline 版本（保留現有左右分割體驗），但訊息送出改為呼叫 sendMessage(bookingId, 'host', text)
     → 訊息列表改為從 getConversationByBookingId(bookingId).messages 即時讀取
     → 進入該對話時呼叫 markConversationRead(bookingId, currentUser.id)
     → 加入 2 秒輪詢，自動更新訊息列表（顧客在另一視窗送來的訊息會自動出現）
     → 切換對話時清除舊輪詢

3. 移除 §4 區域原本的 const MSG_KEY、getConvs、setConvs 三個本地函數，全部改用 shared-data.js 的統一函數

【三、property-detail.html】

1. 右下角浮動聊天視窗保持「房源預諮詢 AI 模擬」現狀（因為這時尚未下單，沒有 bookingId）
2. 但在最上方訊息加一句說明：「💡 完成訂房後，可在『我的訂單』中與房東進行正式對話」
3. 不需要改 sendMsg() 的儲存邏輯（保持記憶體即可）

【驗收方式】
- guest 在 property-orders 點「💬 聯絡房東」應彈出新 Modal
- 送出訊息後切到 host 帳號，host-dashboard §3 訂單管理應看到對應訂單，點「💬 聯絡旅客」可開對話
- host-dashboard §4 顧客訊息分頁應顯示真實對話（不是假資料）
- 雙方在同瀏覽器不同分頁開啟對話，互傳訊息應在 2-3 秒內互相看到
```

### 驗收清單
- [ ] 顧客點 💬 → 新 Modal（不是舊表單）
- [ ] 房東訂單列表有 💬 按鈕
- [ ] 房東「顧客訊息」分頁顯示真實對話、不是假的
- [ ] 雙方可往返對話

---

## 🎯 階段 4：管理員退件 → 房東通知

> 產出：用簡單通知機制讓房東知道房源被退件。

### Prompt 4

```
請實作房源審核退件的通知機制，讓房東在登入後能主動看到通知。

【一、shared-data.js 新增通知系統】

1. KEYS 物件新增：NOTIFICATIONS: 'agenttt_notifications'

2. 新增 Notification 資料結構（JSDoc 區塊）：
   Notification: {
     id, userId, type, title, content, link, read, createdAt
   }

3. 新增函數：
   function getNotifications() { return getData(KEYS.NOTIFICATIONS) || []; }

   function getNotificationsByUser(userId) {
     return getNotifications()
       .filter(n => n.userId === userId)
       .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
   }

   function addNotification(userId, type, title, content, link) {
     const list = getNotifications();
     list.push({
       id: generateId(), userId, type, title, content, link,
       read: false, createdAt: nowISO()
     });
     setData(KEYS.NOTIFICATIONS, list);
   }

   function markNotificationRead(id) {
     const list = getNotifications();
     const idx = list.findIndex(n => n.id === id);
     if (idx >= 0) { list[idx].read = true; setData(KEYS.NOTIFICATIONS, list); }
   }

   function getUnreadNotificationCount(userId) {
     return getNotifications().filter(n => n.userId === userId && !n.read).length;
   }

【二、admin-platform.html】

修改 confirmReject() 函數，在寫入 rejectReason 之後、closeRejectModal 之前，新增：
addNotification(
  props[idx].hostId,
  'property_rejected',
  '房源審核未通過',
  `「${props[idx].name}」審核未通過：${reason}`,
  'host-dashboard.html'
);

【三、host-dashboard.html】

1. init() 函數最開頭新增一段「未讀通知 banner」：
   - 取得 getNotificationsByUser(currentUser.id).filter(n => !n.read && n.type === 'property_rejected')
   - 若有未讀，在頁面頂端插入一個紅色 banner，列出所有未讀退件通知（房源名 + 退件原因 + 時間）
   - 每筆通知右邊有「我知道了」按鈕，點擊 → markNotificationRead(n.id) + 重繪 banner
   - banner 樣式：背景 #FCEBEB、邊框 #C4514A、padding、border-radius，使用警告 icon ⚠️

2. 不需要修改現有的 renderPropList()（既有的退件原因被動顯示保留）

【四、shared-nav.js】

在 navbar 訊息中心 💬 圖示左邊（admin 角色不顯示，guest/host 都顯示），新增一個鈴鐺 🔔 通知圖示：
- 與訊息中心類似，紅點顯示未讀通知數（getUnreadNotificationCount）
- 點開下拉顯示通知清單（最多 5 筆），點某筆 → markNotificationRead + 導向 notification.link
- 樣式參考訊息中心

【驗收方式】
- admin 退件房源後，host 登入應立即在 host-dashboard 頂端看到紅色 banner
- navbar 鈴鐺應有紅點
- 點「我知道了」banner 消失、紅點減少
```

### 驗收清單
- [ ] 退件後房東登入看到紅色 banner
- [ ] navbar 鈴鐺有紅點
- [ ] 通知可標記已讀

---

## 🎯 階段 5：客訴對話頁（獨立系統）

> 產出：新增「我的客訴」頁，讓顧客看到管理員的客訴回覆。

### Prompt 5

```
請新增 train-complaint-list.html（我的客訴列表頁），並打通顧客 ↔ 管理員的客訴對話。

【一、新增 train-complaint-list.html】

1. 頁面結構參考 property-orders.html，沿用同樣的 navbar、頁尾、配色
2. 頁面標題：「💬 我的客訴」
3. 主內容：
   - 取得 getComplaints().filter(c => c.userId === currentUser.id)，按 createdAt 倒序
   - 每筆客訴卡顯示：
     - 案件編號（caseNo）、類型（title）、狀態（pending/active/closed 用不同顏色標籤）
     - 提交時間、訂單編號（orderId，若有）
     - 問題描述（截斷顯示）
     - 「💬 查看對話」按鈕
   - 空狀態：「目前沒有客訴記錄」+ 連到 train-complaint.html 的提交按鈕

4. 點「💬 查看對話」展開內嵌對話區（不用 Modal，直接展開該卡片）：
   - 顯示完整的客訴 messages 陣列（沿用 admin-platform 的 messages 結構）
   - 訊息泡泡：sender='user' 靠右綠色、sender='admin' 靠左灰色
   - 底部 textarea + 送出按鈕（status === 'closed' 時禁用，顯示「案件已結案」）
   - 送出後寫入：
     const c = getComplaintById(complaintId);
     c.messages = c.messages || [];
     c.messages.push({
       id: generateId(), sender: 'user', userName: currentUser.name,
       text, createdAt: nowISO()
     });
     if (c.status === 'pending') c.status = 'active';
     saveComplaint(c);

【二、train-complaint.html】

提交客訴成功後的「成功頁面」新增一個按鈕「查看我的客訴」連到 train-complaint-list.html

【三、shared-nav.js】

guest 角色的下拉選單中，「💬 客訴服務」項目下方新增一個項目「📋 我的客訴」連到 train-complaint-list.html

【四、admin-platform.html】

當管理員在客訴對話送出訊息時（既有的 messages.push 邏輯），新增一個通知：
addNotification(
  complaint.userId,
  'complaint_reply',
  '客訴有新回覆',
  `案件 ${complaint.caseNo}：${msg.text.substring(0, 30)}...`,
  'train-complaint-list.html'
);

【驗收方式】
- guest 提交客訴後切換到 train-complaint-list.html 應該看到該筆
- admin 在 admin-platform 回覆客訴後，guest 的 navbar 鈴鐺應有紅點
- guest 點通知 → 開啟客訴列表 → 看到回覆 → 可繼續送出訊息
- admin 那邊應立即看到顧客的新訊息
```

### 驗收清單
- [ ] 新頁面 train-complaint-list.html 可顯示客訴
- [ ] 雙向對話可進行
- [ ] admin 回覆會觸發 guest 通知

---

## 🧪 完整測試流程（5 階段全部做完後）

開三個瀏覽器分頁，分別登入三個帳號（同一台電腦、同一瀏覽器即可）：

| 測試項目 | guest 看到 | host 看到 | admin 看到 |
|---------|-----------|----------|-----------|
| guest 訂房後送訊息 | 訊息出現在訂單對話 | navbar 紅點 +1 | — |
| host 回覆 | navbar 紅點 +1 | 訊息出現在分頁 + 訂單對話 | — |
| admin 退件房源 | — | 頂部紅 banner + 🔔 紅點 | toast 提示 |
| guest 提交客訴 | 我的客訴列表 +1 | — | 待處理客訴 +1 |
| admin 回覆客訴 | 🔔 紅點 +1 | — | 客訴狀態變 active |

---

## ⚠️ Claude Code 執行注意事項

1. **務必按階段順序**：階段 1 是基礎，沒做完其他都會壞
2. **每階段做完先測試再進下一個**，不要一次跑五個 prompt
3. **如果出錯**：把錯誤訊息和對應的 Prompt 一起再貼給 Claude Code 修
4. **不要讓 Claude Code 改 login.html / shared-styles.css**，這次重構不涉及這兩個
5. **本專案沒有後端**，所有資料寫 localStorage 是預期行為，不要被 Claude Code 建議改成 fetch API
6. **舊資料會自動清理**：階段 1 已內建 schema 版本檢查機制，使用者開啟新版頁面時會自動清空舊訊息資料，**不需要手動 `localStorage.removeItem`**
