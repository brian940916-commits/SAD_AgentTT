/* ============================================================
   Agent TT — shared-data.js
   localStorage 資料層：資料結構定義、CRUD 函數、假資料初始化
   ============================================================ */

/* ── localStorage Key 常數 ──────────────────────────────── */
const KEYS = {
  USER:           'agenttt_user',
  USERS:          'agenttt_users',
  TRIPS:          'agenttt_trips',
  TICKETS:        'agenttt_tickets',
  BOOKINGS:       'agenttt_bookings',
  POINTS:         'agenttt_points',
  POINTS_HISTORY: 'agenttt_points_history',
  COUPONS:        'agenttt_coupons',
  COMPLAINTS:     'agenttt_complaints',
  PROPERTIES:     'agenttt_properties',
  FAVORITES:      'agenttt_favorites',
  MESSAGES:       'agenttt_messages',
  REVIEWS:        'agenttt_reviews',
  NOTIFICATIONS:  'agenttt_notifications',
};

const MESSAGES_SCHEMA_VERSION = '2';
const SCHEMA_KEY = 'agenttt_schema_version';

function migrateMessagesIfNeeded() {
  const currentVersion = localStorage.getItem(SCHEMA_KEY);
  if (currentVersion === MESSAGES_SCHEMA_VERSION) return;

  const oldData = localStorage.getItem('agenttt_messages');
  if (oldData) {
    console.log('[AgentTT] 偵測到舊版訊息格式，已自動清空');
    localStorage.removeItem('agenttt_messages');
  }
  localStorage.setItem(SCHEMA_KEY, MESSAGES_SCHEMA_VERSION);
}

/* ============================================================
   資料結構定義（JSDoc）

   User: {
     id: string, name: string, email: string, phone: string,
     password: string, role: 'guest'|'host'|'admin',
     createdAt: string (ISO)
   }

   Trip: {
     id: string, name: string, startDate: string, endDate: string,
     station: string, status: 'planning'|'completed'|'cancelled',
     budget: number, members: Member[], items: TripItem[],
     expenses: Expense[], tickets: string[], bookings: string[],
     messages: Message[], votes: Vote[], logs: Log[],
     ownerId: string, createdAt: string
   }

   Member: { userId: string, name: string, email: string,
             role: 'owner'|'member', joinedAt: string }

   TripItem: {
     id: string, tripId: string, day: number,
     type: 'attraction'|'restaurant'|'activity'|'hotel'|'train',
     name: string, time: string, endTime: string, note: string,
     priority: 'must'|'candidate', order: number,
     linkedTicketId: string|null, linkedBookingId: string|null
   }

   Expense: {
     id: string, tripId: string, name: string, amount: number,
     type: 'transport'|'accommodation'|'food'|'ticket'|'shopping'|'other',
     paidBy: string, createdAt: string
   }

   Ticket: {
     id: string, orderId: string, fromStation: string, toStation: string,
     trainNo: string, trainType: string, departTime: string, arriveTime: string,
     date: string, ticketType: 'general'|'student'|'senior'|'disabled'|'child',
     price: number, passengerName: string, passengerPhone: string,
     status: 'unused'|'used'|'refunded'|'split',
     qrCode: string, linkedTripId: string|null, userId: string, createdAt: string
   }

   Booking: {
     id: string, propertyId: string, propertyName: string,
     checkIn: string, checkOut: string, guests: number, nights: number,
     totalPrice: number, status: 'paid'|'pending'|'cancelled'|'completed',
     guestName: string, guestPhone: string, guestEmail: string, note: string,
     linkedTripId: string|null, userId: string, createdAt: string
   }

   Complaint: {
     id: string, userId: string, userName: string, title: string,
     type: string, orderId: string, description: string,
     status: 'pending'|'active'|'closed',
     messages: Message[], createdAt: string, closedAt: string|null
   }

   Property: {
     id: string, hostId: string, name: string, station: string,
     description: string, roomType: string, checkInTime: string,
     checkOutTime: string, maxGuests: number, priceWeekday: number,
     priceWeekend: number, priceHoliday: number, facilities: string[],
     status: 'pending'|'online'|'offline', rating: number,
     reviewCount: number, createdAt: string
   }

   PointHistory: { id: string, userId: string, amount: number,
                   type: 'earn'|'use'|'compensate', reason: string, createdAt: string }

   Coupon: { id: string, userId: string, type: string,
             discount: number, expiresAt: string, usedAt: string|null }

   Message (legacy 行程留言用): { id, userId, userName, content, createdAt }

   Conversation (v2 訂單對話): {
     id: 'conv_<bookingId>', bookingId, propertyId, propertyName,
     hostId, guestId, guestName,
     messages: Message[], lastMessageAt, createdAt
   }

   Message (v2 訂單對話用): {
     id, senderId, senderRole: 'guest'|'host',
     text, createdAt, readBy: string[]
   }

   Notification: {
     id, userId, type, title, content, link, read, createdAt
   }

   Vote: { id: string, tripId: string, title: string,
           options: VoteOption[], createdAt: string }

   VoteOption: { id: string, label: string, votes: string[] }

   Log: { id: string, userId: string, userName: string,
          action: string, detail: string, timestamp: string }
   ============================================================ */

/* ── 通用工具 ────────────────────────────────────────────── */

function getData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function nowISO() {
  return new Date().toISOString();
}

/* ── 圖片處理 ─────────────────────────────────────────────── */
/* 把上傳的 File 用 canvas 縮圖並轉成 JPEG base64，避免原圖塞爆 localStorage。
   依 EXIF 不處理（canvas 會吃瀏覽器自動方向校正），預設最寬 1000px、品質 0.8。
   回傳 Promise<string|null>（非圖片或失敗回 null）。 */
function downscaleImageFile(file, maxW, quality) {
  maxW = maxW || 1000;
  quality = quality || 0.8;
  return new Promise(resolve => {
    if (!file || !file.type || !file.type.startsWith('image/')) { resolve(null); return; }
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL('image/jpeg', quality)); }
        catch (err) { resolve(null); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* 批次縮圖：FileList/Array<File> → Promise<Array<string>>，可限制最多幾張 */
function downscaleImageFiles(files, max, maxW, quality) {
  const arr = Array.from(files || []).slice(0, max || 5);
  return Promise.all(arr.map(f => downscaleImageFile(f, maxW, quality)))
    .then(list => list.filter(Boolean));
}

/* 安全寫入 localStorage：容量不足時回傳 false（讓呼叫端提示使用者），不丟例外 */
function trySetData(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

/* ── 使用者 ──────────────────────────────────────────────── */

function getCurrentUser() {
  return getData(KEYS.USER);
}

function setCurrentUser(user) {
  setData(KEYS.USER, user);
}

function logout() {
  localStorage.removeItem(KEYS.USER);
}

function getUserById(id) {
  const users = getData(KEYS.USERS) || [];
  return users.find(u => u.id === id) || null;
}

function getUsers() {
  return getData(KEYS.USERS) || [];
}

function saveUser(user) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) users[idx] = user;
  else users.push(user);
  setData(KEYS.USERS, users);
}

function findUserByEmail(email) {
  const lower = (email || '').toLowerCase();
  return getUsers().find(u => (u.email || '').toLowerCase() === lower) || null;
}

/* ── 行程 ────────────────────────────────────────────────── */

function getTrips() {
  return getData(KEYS.TRIPS) || [];
}

function getTripById(id) {
  return getTrips().find(t => t.id === id) || null;
}

function saveTrip(trip) {
  const trips = getTrips();
  const idx = trips.findIndex(t => t.id === trip.id);
  if (idx >= 0) trips[idx] = trip;
  else trips.push(trip);
  setData(KEYS.TRIPS, trips);
}

function deleteTrip(id) {
  setData(KEYS.TRIPS, getTrips().filter(t => t.id !== id));
}

function getTripsByUser(userId) {
  return getTrips().filter(t =>
    t.ownerId === userId || t.members.some(m => m.userId === userId)
  );
}

/* ── 台鐵票券 ────────────────────────────────────────────── */

function getTickets() {
  return getData(KEYS.TICKETS) || [];
}

function getTicketsByUser(userId) {
  return getTickets().filter(t => t.userId === userId);
}

function getTicketsByTripId(tripId) {
  return getTickets().filter(t => t.linkedTripId === tripId);
}

function getTicketById(id) {
  return getTickets().find(t => t.id === id) || null;
}

function saveTicket(ticket) {
  const tickets = getTickets();
  const idx = tickets.findIndex(t => t.id === ticket.id);
  if (idx >= 0) tickets[idx] = ticket;
  else tickets.push(ticket);
  setData(KEYS.TICKETS, tickets);
}

function linkTicketToTrip(ticketId, tripId) {
  const ticket = getTicketById(ticketId);
  if (!ticket) return;
  ticket.linkedTripId = tripId;
  saveTicket(ticket);

  const trip = getTripById(tripId);
  if (!trip) return;
  if (!trip.tickets.includes(ticketId)) trip.tickets.push(ticketId);
  saveTrip(trip);
}

/* ── 訂房 ────────────────────────────────────────────────── */

function getBookings() {
  return getData(KEYS.BOOKINGS) || [];
}

function getBookingsByUser(userId) {
  return getBookings().filter(b => b.userId === userId);
}

function getBookingsByTripId(tripId) {
  return getBookings().filter(b => b.linkedTripId === tripId);
}

function getBookingById(id) {
  return getBookings().find(b => b.id === id) || null;
}

function saveBooking(booking) {
  const bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === booking.id);
  if (idx >= 0) bookings[idx] = booking;
  else bookings.push(booking);
  setData(KEYS.BOOKINGS, bookings);
}

/* ── 房源可訂日檢查 ───────────────────────────────────────── */
/* 列出 [checkIn, checkOut) 期間每一晚的日期字串（本地時區，避免 off-by-one） */
function eachNight(checkIn, checkOut) {
  const out = [];
  if (!checkIn || !checkOut) return out;
  let d = new Date(checkIn + 'T00:00:00');
  const end = new Date(checkOut + 'T00:00:00');
  while (d < end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* 國定假日（採國定假日房價 priceHoliday）；週六/週日採假日房價 priceWeekend */
const TW_HOLIDAYS = new Set([
  '2026-01-01',                                                         // 元旦
  '2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',     // 春節
  '2026-02-28',                                                         // 和平紀念日
  '2026-04-03','2026-04-04','2026-04-05','2026-04-06',                  // 兒童節/清明連假
  '2026-05-01',                                                         // 勞動節
  '2026-06-19',                                                         // 端午節
  '2026-09-25',                                                         // 中秋節
  '2026-10-10',                                                         // 國慶日
]);

/* 依日期回傳當晚房價：國定假日 > 週末 > 平日 */
function getNightlyRate(prop, dateStr) {
  if (!prop) return 0;
  if (TW_HOLIDAYS.has(dateStr)) return prop.priceHoliday || prop.priceWeekend || prop.priceWeekday || 0;
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  if (dow === 0 || dow === 6) return prop.priceWeekend || prop.priceWeekday || 0;
  return prop.priceWeekday || 0;
}

/* 加總入住期間每一晚的房價（平日/週末/假日分別計價） */
function calcRoomTotal(prop, checkIn, checkOut) {
  return eachNight(checkIn, checkOut).reduce((sum, d) => sum + getNightlyRate(prop, d), 0);
}

/* 檢查房源在指定入住期間是否可預訂（房東未關閉該日、且無既有訂單衝突）
   回傳 { ok: boolean, reason: string } */
function checkAvailability(propertyId, checkIn, checkOut, ignoreBookingId) {
  const nights = eachNight(checkIn, checkOut);
  if (!nights.length) return { ok: false, reason: '請選擇有效的入住與退房日期' };

  // 1) 房東於月曆上關閉的日期（agenttt_pricing[propId][date] === 'closed'）
  let pricing = {};
  try { pricing = JSON.parse(localStorage.getItem('agenttt_pricing') || '{}'); } catch (e) {}
  const propPricing = pricing[propertyId] || {};
  const closed = nights.find(d => propPricing[d] === 'closed');
  if (closed) return { ok: false, reason: `房東已關閉 ${closed} 的預訂，請改選其他日期` };

  // 2) 與既有訂單（未取消）日期衝突
  const bookings = getBookings().filter(b =>
    b.propertyId === propertyId && b.status !== 'cancelled' && b.id !== ignoreBookingId
  );
  for (const b of bookings) {
    const occupied = new Set(eachNight(b.checkIn, b.checkOut));
    const clash = nights.find(d => occupied.has(d));
    if (clash) return { ok: false, reason: `${clash} 已有訂單，該日期不可重複預訂` };
  }
  return { ok: true, reason: '' };
}

function linkBookingToTrip(bookingId, tripId) {
  const booking = getBookingById(bookingId);
  if (!booking) return;
  booking.linkedTripId = tripId;
  saveBooking(booking);

  const trip = getTripById(tripId);
  if (!trip) return;
  if (!trip.bookings.includes(bookingId)) trip.bookings.push(bookingId);
  saveTrip(trip);
}

/* ── 訂單對話（v2）────────────────────────────────────────── */

function getConversations() {
  return getData(KEYS.MESSAGES) || [];
}

function getConversationByBookingId(bookingId) {
  return getConversations().find(c => c.bookingId === bookingId) || null;
}

function getOrCreateConversation(booking) {
  const convs = getConversations();
  const existing = convs.find(c => c.bookingId === booking.id);
  if (existing) return existing;

  const prop = getPropertyById(booking.propertyId);
  const conv = {
    id:            'conv_' + booking.id,
    bookingId:     booking.id,
    propertyId:    booking.propertyId,
    propertyName:  booking.propertyName,
    hostId:        prop ? prop.hostId : null,
    guestId:       booking.userId,
    guestName:     booking.guestName || '旅客',
    messages:      [],
    lastMessageAt: nowISO(),
    createdAt:     nowISO(),
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
    id:        generateId(),
    senderId:  user ? user.id : '',
    senderRole,
    text,
    createdAt: nowISO(),
    readBy:    user ? [user.id] : [],
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

/* ── 通知 ────────────────────────────────────────────────── */

function getNotifications() {
  return getData(KEYS.NOTIFICATIONS) || [];
}

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

/* ── 點數 ────────────────────────────────────────────────── */

function getPoints() {
  return getData(KEYS.POINTS) || 0;
}

function getPointsHistory() {
  return getData(KEYS.POINTS_HISTORY) || [];
}

function addPoints(amount, reason) {
  const current = getPoints();
  setData(KEYS.POINTS, current + amount);

  const history = getPointsHistory();
  const user = getCurrentUser();
  history.push({
    id: generateId(),
    userId: user ? user.id : '',
    amount,
    type: 'earn',
    reason,
    createdAt: nowISO(),
  });
  setData(KEYS.POINTS_HISTORY, history);
}

function usePoints(amount) {
  const current = getPoints();
  if (current < amount) return false;
  setData(KEYS.POINTS, current - amount);

  const history = getPointsHistory();
  const user = getCurrentUser();
  history.push({
    id: generateId(),
    userId: user ? user.id : '',
    amount: -amount,
    type: 'use',
    reason: '點數折抵',
    createdAt: nowISO(),
  });
  setData(KEYS.POINTS_HISTORY, history);
  return true;
}

/* ── 優惠券 ──────────────────────────────────────────────── */

function getCoupons() {
  return getData(KEYS.COUPONS) || [];
}

function getValidCoupons() {
  const now = new Date();
  return getCoupons().filter(c => !c.usedAt && new Date(c.expiresAt) > now);
}

function addCoupon(type, expiresAt) {
  const coupons = getCoupons();
  const user = getCurrentUser();
  coupons.push({
    id: generateId(),
    userId: user ? user.id : '',
    type,
    discount: 0.8,
    expiresAt,
    usedAt: null,
  });
  setData(KEYS.COUPONS, coupons);
}

function useCoupon(id) {
  const coupons = getCoupons();
  const c = coupons.find(c => c.id === id);
  if (!c || c.usedAt) return false;
  c.usedAt = nowISO();
  setData(KEYS.COUPONS, coupons);
  return true;
}

/* ── 房源 ────────────────────────────────────────────────── */

function getProperties() {
  return getData(KEYS.PROPERTIES) || [];
}

function getPropertyById(id) {
  return getProperties().find(p => p.id === id) || null;
}

function saveProperty(property) {
  const properties = getProperties();
  const idx = properties.findIndex(p => p.id === property.id);
  if (idx >= 0) properties[idx] = property;
  else properties.push(property);
  setData(KEYS.PROPERTIES, properties);
}

/* ── 客訴 ────────────────────────────────────────────────── */

function getComplaints() {
  return getData(KEYS.COMPLAINTS) || [];
}

function getComplaintById(id) {
  return getComplaints().find(c => c.id === id) || null;
}

function saveComplaint(complaint) {
  const complaints = getComplaints();
  const idx = complaints.findIndex(c => c.id === complaint.id);
  if (idx >= 0) complaints[idx] = complaint;
  else complaints.push(complaint);
  setData(KEYS.COMPLAINTS, complaints);
}

/* ── 收藏 ────────────────────────────────────────────────── */

function getFavorites() {
  return getData(KEYS.FAVORITES) || [];
}

function toggleFavorite(propertyId) {
  const favs = getFavorites();
  const idx = favs.indexOf(propertyId);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(propertyId);
  setData(KEYS.FAVORITES, favs);
  return idx < 0;
}


/* ── 評價 ────────────────────────────────────────────────── */

function getReviews(propertyId) {
  const all = getData(KEYS.REVIEWS) || [];
  return propertyId ? all.filter(r => r.propertyId === propertyId) : all;
}

function saveReview(review) {
  const all = getData(KEYS.REVIEWS) || [];
  all.push(review);
  setData(KEYS.REVIEWS, all);
}

/* ── 假資料初始化 ─────────────────────────────────────────── */

function init() {
  migrateMessagesIfNeeded();

  if (getData('agenttt_initialized')) return;

  /* 使用者 */
  const u_guest = {
    id: 'u_guest_01',
    name: '王小明',
    email: 'test@test.com',
    password: 'test123',
    phone: '0912-345-678',
    role: 'guest',
    createdAt: '2026-01-10T08:00:00.000Z',
  };
  const u_host = {
    id: 'u_host_01',
    name: '陳房東',
    email: 'host@test.com',
    password: 'test123',
    phone: '0922-111-222',
    role: 'host',
    createdAt: '2026-01-05T08:00:00.000Z',
  };
  const u_admin = {
    id: 'u_admin_01',
    name: '平台管理員',
    email: 'admin@test.com',
    password: 'test123',
    phone: '0900-000-000',
    role: 'admin',
    createdAt: '2026-01-01T08:00:00.000Z',
  };
  setData(KEYS.USERS, [u_guest, u_host, u_admin]);

  /* 房源 */
  const prop_01 = {
    id: 'prop_01',
    hostId: 'u_host_01',
    name: '集集小站民宿',
    station: '集集站',
    description: '位於集集車站旁，步行三分鐘即可抵達，房間寬敞明亮，享有田園景致。',
    roomType: '雙人房',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    maxGuests: 2,
    priceWeekday: 1800,
    priceWeekend: 2400,
    priceHoliday: 2800,
    facilities: ['Wi-Fi', '冷氣', '停車場', '早餐', '自行車租借'],
    status: 'online',
    rating: 4.8,
    reviewCount: 23,
    createdAt: '2026-02-01T08:00:00.000Z',
  };
  const prop_02 = {
    id: 'prop_02',
    hostId: 'u_host_01',
    name: '車埕木頭人旅宿',
    station: '車埕站',
    description: '以台灣檜木為主題的特色民宿，保留舊式木業工廠建築風格，每晚均可聞到淡淡木香。',
    roomType: '家庭房',
    checkInTime: '15:00',
    checkOutTime: '10:00',
    maxGuests: 4,
    priceWeekday: 3200,
    priceWeekend: 4200,
    priceHoliday: 4800,
    facilities: ['Wi-Fi', '冷氣', '停車場', '早餐', '木作體驗'],
    status: 'online',
    rating: 4.9,
    reviewCount: 41,
    createdAt: '2026-02-15T08:00:00.000Z',
  };
  const prop_03 = {
    id: 'prop_03',
    hostId: 'u_host_01',
    name: '彰化扇形驛站',
    station: '彰化站',
    description: '彰化扇形車庫旁的輕工業風青旅，提供多人床位與私人房型，是鐵道迷的最愛。',
    roomType: '標準單人房',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    maxGuests: 1,
    priceWeekday: 980,
    priceWeekend: 1280,
    priceHoliday: 1500,
    facilities: ['Wi-Fi', '冷氣', '共用廚房', '行李寄放'],
    status: 'online',
    rating: 4.5,
    reviewCount: 17,
    createdAt: '2026-03-01T08:00:00.000Z',
  };
  setData(KEYS.PROPERTIES, [prop_01, prop_02, prop_03]);

  /* 訂房記錄 */
  const booking_01 = {
    id: 'bk_01',
    propertyId: 'prop_01',
    propertyName: '集集小站民宿',
    checkIn: '2026-07-10',
    checkOut: '2026-07-12',
    guests: 2,
    nights: 2,
    totalPrice: 3600,
    status: 'paid',
    guestName: '王小明',
    guestPhone: '0912-345-678',
    guestEmail: 'test@test.com',
    note: '請準備嬰兒床',
    linkedTripId: 'trip_01',
    userId: 'u_guest_01',
    createdAt: '2026-06-01T10:00:00.000Z',
  };
  const booking_02 = {
    id: 'bk_02',
    propertyId: 'prop_02',
    propertyName: '車埕木頭人旅宿',
    checkIn: '2026-08-01',
    checkOut: '2026-08-03',
    guests: 3,
    nights: 2,
    totalPrice: 8400,
    status: 'paid',
    guestName: '王小明',
    guestPhone: '0912-345-678',
    guestEmail: 'test@test.com',
    note: '',
    linkedTripId: null,
    userId: 'u_guest_01',
    createdAt: '2026-07-01T10:00:00.000Z',
  };
  setData(KEYS.BOOKINGS, [booking_01, booking_02]);

  /* 台鐵票券 */
  const ticket_01 = {
    id: 'tk_01',
    orderId: 'ORD-2026-001',
    fromStation: '彰化',
    toStation: '二水',
    trainNo: '2750',
    trainType: '區間車',
    departTime: '09:20',
    arriveTime: '09:45',
    date: '2026-07-10',
    ticketType: 'general',
    price: 63,
    passengerName: '王小明',
    passengerPhone: '0912-345-678',
    status: 'unused',
    qrCode: 'QR-TK01-2026',
    linkedTripId: 'trip_01',
    userId: 'u_guest_01',
    createdAt: '2026-06-05T10:00:00.000Z',
  };
  const ticket_02 = {
    id: 'tk_02',
    orderId: 'ORD-2026-001',
    fromStation: '二水',
    toStation: '集集',
    trainNo: '6315',
    trainType: '集集線普通車',
    departTime: '10:05',
    arriveTime: '10:35',
    date: '2026-07-10',
    ticketType: 'general',
    price: 113,
    passengerName: '王小明',
    passengerPhone: '0912-345-678',
    status: 'unused',
    qrCode: 'QR-TK02-2026',
    linkedTripId: 'trip_01',
    userId: 'u_guest_01',
    createdAt: '2026-06-05T10:00:00.000Z',
  };
  const ticket_03 = {
    id: 'tk_03',
    orderId: 'ORD-2026-002',
    fromStation: '台中',
    toStation: '彰化',
    trainNo: '1127',
    trainType: '自強號',
    departTime: '08:30',
    arriveTime: '08:55',
    date: '2026-08-01',
    ticketType: 'general',
    price: 49,
    passengerName: '王小明',
    passengerPhone: '0912-345-678',
    status: 'used',
    qrCode: 'QR-TK03-2026',
    linkedTripId: null,
    userId: 'u_guest_01',
    createdAt: '2026-07-15T10:00:00.000Z',
  };
  setData(KEYS.TICKETS, [ticket_01, ticket_02, ticket_03]);

  /* 行程 */
  const trip_01 = {
    id: 'trip_01',
    name: '集集線慢旅三天',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    station: '集集站',
    status: 'planning',
    budget: 8000,
    members: [
      { userId: 'u_guest_01', name: '王小明', email: 'test@test.com', role: 'owner', joinedAt: '2026-06-01T08:00:00.000Z' },
    ],
    items: [
      { id: 'item_01', tripId: 'trip_01', day: 1, type: 'train', name: '彰化→二水（區間車 2750）', time: '09:20', endTime: '09:45', note: '車廂請選靠窗', priority: 'must', order: 1, linkedTicketId: 'tk_01', linkedBookingId: null },
      { id: 'item_02', tripId: 'trip_01', day: 1, type: 'train', name: '二水→集集（普通車 6315）', time: '10:05', endTime: '10:35', note: '集集線慢慢坐', priority: 'must', order: 2, linkedTicketId: 'tk_02', linkedBookingId: null },
      { id: 'item_03', tripId: 'trip_01', day: 1, type: 'attraction', name: '集集車站', time: '11:00', endTime: '12:00', note: '日式木造車站打卡', priority: 'must', order: 3, linkedTicketId: null, linkedBookingId: null },
      { id: 'item_04', tripId: 'trip_01', day: 1, type: 'restaurant', name: '集集香蕉餐廳', time: '12:30', endTime: '13:30', note: '香蕉特餐必點', priority: 'must', order: 4, linkedTicketId: null, linkedBookingId: null },
      { id: 'item_05', tripId: 'trip_01', day: 1, type: 'hotel', name: '集集小站民宿 Check-in', time: '15:00', endTime: '15:30', note: '', priority: 'must', order: 5, linkedTicketId: null, linkedBookingId: 'bk_01' },
      { id: 'item_06', tripId: 'trip_01', day: 2, type: 'attraction', name: '明新書院', time: '09:00', endTime: '10:00', note: '百年古廟', priority: 'must', order: 1, linkedTicketId: null, linkedBookingId: null },
      { id: 'item_07', tripId: 'trip_01', day: 2, type: 'attraction', name: '車埕木業村', time: '11:00', endTime: '13:00', note: '需搭集集線前往', priority: 'candidate', order: 2, linkedTicketId: null, linkedBookingId: null },
      { id: 'item_08', tripId: 'trip_01', day: 3, type: 'attraction', name: '濁水溪河濱公園', time: '08:00', endTime: '09:30', note: '早晨散步', priority: 'candidate', order: 1, linkedTicketId: null, linkedBookingId: null },
    ],
    expenses: [
      { id: 'exp_01', tripId: 'trip_01', name: '台鐵車票（彰化→集集）', amount: 176, type: 'transport', paidBy: '王小明', createdAt: '2026-06-05T10:00:00.000Z' },
      { id: 'exp_02', tripId: 'trip_01', name: '集集小站民宿（2晚）', amount: 3600, type: 'accommodation', paidBy: '王小明', createdAt: '2026-06-01T10:00:00.000Z' },
      { id: 'exp_03', tripId: 'trip_01', name: '集集香蕉餐廳午餐', amount: 480, type: 'food', paidBy: '王小明', createdAt: '2026-07-10T13:00:00.000Z' },
    ],
    tickets: ['tk_01', 'tk_02'],
    bookings: ['bk_01'],
    messages: [
      { id: 'msg_01', userId: 'u_guest_01', userName: '王小明', content: '行程都規劃好了，出發！', createdAt: '2026-06-15T10:00:00.000Z' },
    ],
    votes: [
      {
        id: 'vote_01',
        tripId: 'trip_01',
        title: '第二天下午要去哪裡？',
        options: [
          { id: 'vo_01', label: '車埕木業村', votes: ['u_guest_01'] },
          { id: 'vo_02', label: '明潭壩頂', votes: [] },
        ],
        createdAt: '2026-06-20T10:00:00.000Z',
      },
    ],
    logs: [
      { id: 'log_01', userId: 'u_guest_01', userName: '王小明', action: '建立行程', detail: '建立了「集集線慢旅三天」', timestamp: '2026-06-01T08:00:00.000Z' },
      { id: 'log_02', userId: 'u_guest_01', userName: '王小明', action: '新增票券', detail: '連結台鐵票券 tk_01、tk_02', timestamp: '2026-06-05T10:00:00.000Z' },
    ],
    ownerId: 'u_guest_01',
    createdAt: '2026-06-01T08:00:00.000Z',
  };

  const trip_02 = {
    id: 'trip_02',
    name: '彰化扇形車庫一日遊',
    startDate: '2026-07-20',
    endDate: '2026-07-20',
    station: '彰化站',
    status: 'planning',
    budget: 1500,
    members: [
      { userId: 'u_guest_01', name: '王小明', email: 'test@test.com', role: 'owner', joinedAt: '2026-07-01T08:00:00.000Z' },
    ],
    items: [
      { id: 'item_09', tripId: 'trip_02', day: 1, type: 'attraction', name: '彰化扇形車庫', time: '09:00', endTime: '11:00', note: '週末可能人多，早點去', priority: 'must', order: 1, linkedTicketId: null, linkedBookingId: null },
      { id: 'item_10', tripId: 'trip_02', day: 1, type: 'restaurant', name: '彰化肉圓老店', time: '11:30', endTime: '12:30', note: '在地必吃', priority: 'must', order: 2, linkedTicketId: null, linkedBookingId: null },
      { id: 'item_11', tripId: 'trip_02', day: 1, type: 'attraction', name: '彰化孔廟', time: '13:00', endTime: '14:00', note: '', priority: 'candidate', order: 3, linkedTicketId: null, linkedBookingId: null },
    ],
    expenses: [
      { id: 'exp_04', tripId: 'trip_02', name: '交通費', amount: 200, type: 'transport', paidBy: '王小明', createdAt: '2026-07-20T08:00:00.000Z' },
    ],
    tickets: [],
    bookings: [],
    messages: [],
    votes: [],
    logs: [
      { id: 'log_03', userId: 'u_guest_01', userName: '王小明', action: '建立行程', detail: '建立了「彰化扇形車庫一日遊」', timestamp: '2026-07-01T08:00:00.000Z' },
    ],
    ownerId: 'u_guest_01',
    createdAt: '2026-07-01T08:00:00.000Z',
  };
  setData(KEYS.TRIPS, [trip_01, trip_02]);

  /* 點數 */
  setData(KEYS.POINTS, 60);
  setData(KEYS.POINTS_HISTORY, [
    { id: 'ph_01', userId: 'u_guest_01', amount: 9,  type: 'earn',       reason: '訂票點數（ORD-2026-001）', createdAt: '2026-06-05T10:00:00.000Z' },
    { id: 'ph_02', userId: 'u_guest_01', amount: 9,  type: 'earn',       reason: '訂票點數（ORD-2026-002）', createdAt: '2026-07-15T10:00:00.000Z' },
    { id: 'ph_03', userId: 'u_guest_01', amount: 30, type: 'compensate', reason: '列車延誤補償（2026-05-12）',  createdAt: '2026-05-12T18:00:00.000Z' },
    { id: 'ph_04', userId: 'u_guest_01', amount: 12, type: 'earn',       reason: '完成行程回饋',               createdAt: '2026-06-30T08:00:00.000Z' },
  ]);

  /* 優惠券 */
  setData(KEYS.COUPONS, [
    {
      id: 'cp_01',
      userId: 'u_guest_01',
      type: 'train_80percent',
      discount: 0.8,
      expiresAt: '2026-12-31T23:59:59.000Z',
      usedAt: null,
    },
  ]);

  /* 客訴（示範） */
  setData(KEYS.COMPLAINTS, [
    {
      id: 'comp_01',
      userId: 'u_guest_01',
      userName: '王小明',
      title: '訂票付款後未收到確認信',
      type: '付款問題',
      orderId: 'ORD-2026-001',
      description: '付款完成後超過30分鐘仍未收到確認信，請協助確認。',
      status: 'closed',
      messages: [
        { id: 'cm_01', userId: 'u_guest_01',  userName: '王小明',  content: '付款完成後超過30分鐘仍未收到確認信。', createdAt: '2026-06-06T09:00:00.000Z' },
        { id: 'cm_02', userId: 'u_admin_01',  userName: '客服人員', content: '您好，已確認訂單，確認信已補發至您的信箱。', createdAt: '2026-06-06T10:30:00.000Z' },
      ],
      createdAt: '2026-06-06T09:00:00.000Z',
      closedAt: '2026-06-06T10:30:00.000Z',
    },
  ]);


  /* 標記初始化完成 */
  setData('agenttt_initialized', true);
}

/* ── 頁面載入時自動執行 ───────────────────────────────────── */
init();
