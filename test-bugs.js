// Static HTML analysis — uses Node.js built-in fetch (no browser needed)
const BASE = 'https://brian940916-commits.github.io/SAD_AgentTT';

const results = [];
function pass(id, desc, note = '') { results.push({ id, status: '✅', desc, note }); }
function fail(id, desc, note = '') { results.push({ id, status: '❌', desc, note }); }
function warn(id, desc, note = '') { results.push({ id, status: '⚠️', desc, note }); }

async function fetchPage(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${BASE}/${path}`);
  return res.text();
}

function textOf(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

async function run() {

  // ── Fetch key pages ──
  console.log('⏳ 抓取頁面中...');
  const pages = {};
  const targets = {
    search:   'train-search.html',
    booking:  'train-booking.html',
    tickets:  'train-tickets.html',
    refund:   'train-refund.html',
    points:   'train-points.html',
  };
  for (const [k, v] of Object.entries(targets)) {
    try {
      pages[k] = await fetchPage(v);
      console.log(`   ✓ ${v}`);
    } catch(e) {
      pages[k] = '';
      console.log(`   ✗ ${v} — ${e.message}`);
    }
  }

  const search  = pages.search;
  const booking = pages.booking;
  const tickets = pages.tickets;

  // ─────────────────────────────────────────────
  // 1. 進階篩選：直達車 + 允許轉乘
  // ─────────────────────────────────────────────
  {
    const text = textOf(search);
    const hasDirect   = /直達車|直達/.test(text);
    const hasTransfer = /允許轉乘|轉乘/.test(text);
    if (hasDirect && hasTransfer) {
      pass(1, '進階篩選同時有「直達車」和「允許轉乘」選項');
    } else {
      fail(1, '進階篩選缺少部分選項', `直達車:${hasDirect} 允許轉乘:${hasTransfer}`);
    }
  }

  // ─────────────────────────────────────────────
  // 2. 座位偏好多選（checkbox）
  // ─────────────────────────────────────────────
  {
    const text = textOf(search);
    const hasSeatPref = /座位偏好|靠窗|靠走道|上鋪|下鋪|窗邊|走道/.test(text);
    // Count checkboxes in seat preference block via HTML
    const checkboxMatches = search.match(/type=["']checkbox["'][^>]*(?:seat|window|aisle|pref|偏好)/gi) || [];
    const genericCheckboxes = (search.match(/type=["']checkbox/gi) || []).length;

    // Check for multiple="true" or multiple checkboxes for seat preference
    const seatBlock = search.match(/座位偏好[\s\S]{0,500}/);
    const seatBlockCheckboxes = seatBlock ? (seatBlock[0].match(/type=["']checkbox/gi) || []).length : 0;

    if (!hasSeatPref) {
      fail(2, '找不到座位偏好選項（靠窗/靠走道等）');
    } else if (seatBlockCheckboxes >= 2 || genericCheckboxes >= 2) {
      pass(2, `座位偏好有多個 checkbox 可多選`, `座位區 checkbox 數: ${seatBlockCheckboxes}, 全頁 checkbox: ${genericCheckboxes}`);
    } else {
      warn(2, '有座位偏好但 checkbox 數量不確定，需手動驗證多選', `座位偏好 checkbox: ${seatBlockCheckboxes}`);
    }
  }

  // ─────────────────────────────────────────────
  // 3. 取消允許轉乘後是否仍顯示轉乘組合（邏輯層）
  // ─────────────────────────────────────────────
  {
    // Look for the JS filter logic
    const jsBlock = search.match(/(filterTrains|showTransfer|transfer|轉乘)[\s\S]{0,1000}/);
    const hasFilterLogic = /transfer.*false|!.*transfer|allowTransfer|filterByTransfer/.test(search);
    const hasComboSection = /combo|轉乘組合|transfer.?combo/.test(search);

    if (hasFilterLogic) {
      // Check if the filter actually hides combo results
      const hiddenWhenFalse = /transfer.*display.*none|transfer.*hidden|combo.*display.*none/.test(search);
      if (hiddenWhenFalse) {
        pass(3, '有轉乘篩選邏輯且取消時會隱藏轉乘組合');
      } else {
        warn(3, '有轉乘篩選相關程式碼，但需手動確認取消後是否真的隱藏', '建議：取消允許轉乘後執行搜尋，確認結果不含轉乘組合');
      }
    } else {
      // Look for simpler logic
      const hasTransferCheck = /allowTransfer|allow_transfer|showTransfer/.test(search);
      if (hasTransferCheck) {
        warn(3, '找到轉乘相關變數，需手動測試取消後的行為');
      } else {
        fail(3, '找不到轉乘篩選邏輯，取消允許轉乘可能不會過濾轉乘組合');
      }
    }
  }

  // ─────────────────────────────────────────────
  // 4. 分票功能可輸入不存在帳號
  // ─────────────────────────────────────────────
  {
    const text = textOf(tickets);
    const hasSplit = /分票/.test(text);
    if (!hasSplit) {
      fail(4, '找不到分票功能');
    } else {
      // Look for email validation logic
      const hasValidation = /找不到|not.found|user.*exist|帳號不存在|無效帳號/.test(tickets);
      const hasUserLookup  = /agenttt_users|users\.find|getUser/.test(tickets);
      if (hasValidation) {
        pass(4, '分票有輸入不存在帳號的錯誤提示');
      } else if (hasUserLookup) {
        // Check what happens when user not found
        const lookupCode = tickets.match(/users\.find[\s\S]{0,200}/);
        const handlesNotFound = lookupCode && /null|undefined|!.*user|alert|error/.test(lookupCode[0]);
        if (handlesNotFound) {
          pass(4, '分票會查詢帳號，並處理找不到的情況', lookupCode[0].substring(0, 80).trim());
        } else {
          fail(4, '分票查詢帳號但找不到處理「不存在」的錯誤邏輯', '可能允許輸入任意帳號');
        }
      } else {
        fail(4, '分票找不到帳號驗證邏輯，可能可輸入不存在帳號不報錯');
      }
    }
  }

  // ─────────────────────────────────────────────
  // 5. 非 QR Code 取票方式仍顯示 QR Code
  // ─────────────────────────────────────────────
  {
    const text = textOf(tickets);
    const hasPickupOptions = /取票方式|取票/.test(text);
    const hasQR = /QR|qr.code|qr_code/.test(tickets);
    const hasPickupSelect = /select.*pickup|pickup.*select|取票.*radio|radio.*取票|取票.*option/.test(tickets.toLowerCase());

    if (!hasPickupOptions) {
      fail(5, '找不到取票方式選項');
    } else {
      // Look for conditional QR display logic
      const qrCondition = /pickup.*qr|qr.*pickup|method.*qr|if.*qr|show.*qr|display.*qr/i.test(tickets);
      const qrAlwaysShown = hasQR && !qrCondition;

      if (qrAlwaysShown) {
        fail(5, '有取票方式選項，但 QR Code 顯示邏輯不依賴取票方式，可能總是顯示');
      } else if (qrCondition) {
        pass(5, '取票方式與 QR Code 顯示有條件邏輯關聯');
      } else {
        warn(5, '需手動確認：切換非 QR Code 取票方式後 QR 是否消失', `QR存在:${hasQR} 條件顯示:${qrCondition}`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // 6. 準點/誤點/已過站狀態
  // ─────────────────────────────────────────────
  {
    const text = textOf(search);
    const hasOnTime  = /準點/.test(text);
    const hasDelayed = /誤點|延誤/.test(text);
    const hasPassed  = /已過站|已過/.test(text);
    // Also check booking page
    const bText = textOf(booking);
    const bHasStatus = /準點|誤點|延誤|已過站/.test(bText);

    if (hasOnTime || hasDelayed || hasPassed || bHasStatus) {
      pass(6, '頁面有準點/誤點/已過站狀態文字', `準點:${hasOnTime} 誤點:${hasDelayed} 已過站:${hasPassed}`);
    } else {
      fail(6, '找不到準點/誤點/已過站任何狀態資訊');
    }
  }

  // ─────────────────────────────────────────────
  // 7. 訂購已過時間的車票
  // ─────────────────────────────────────────────
  {
    // Look for time-check logic before booking
    const hasTimeCheck = /new Date|Date\.now|getTime|getHours|isExpired|過期|已過/.test(search);
    const hasDisableLogic = /disabled|btn.*disable|disable.*btn|past.*disable|已過.*disable/.test(search);
    const hasBlockPast = /past.*train|train.*past|time.*past|cannot.*book|無法.*訂|不可.*訂/.test(search);

    if (hasDisableLogic || hasBlockPast) {
      pass(7, '有程式碼阻止訂購已過時間的車次');
    } else if (hasTimeCheck) {
      warn(7, '有時間判斷邏輯，需手動確認是否阻止訂購已過時間車票');
    } else {
      fail(7, '找不到阻止訂購已過時間車次的邏輯，可能可直接訂購過期車票');
    }
  }

  // ─────────────────────────────────────────────
  // 8. 剩餘座位數
  // ─────────────────────────────────────────────
  {
    const text = textOf(search);
    const bText = textOf(booking);
    const hasRemaining = /剩餘|剩 \d|seats|remaining|\d+ 座/.test(text) || /剩餘|剩 \d/.test(bText);
    const hasSeatsInCode = /seats|remainingSeats|seatCount|剩餘座位/.test(search);
    if (hasRemaining || hasSeatsInCode) {
      pass(8, '車次結果有剩餘座位數資訊', `文字:${hasRemaining} 程式碼:${hasSeatsInCode}`);
    } else {
      fail(8, '找不到剩餘座位數（座位剩餘量未顯示）');
    }
  }

  // ─────────────────────────────────────────────
  // 9. 停靠站資訊
  // ─────────────────────────────────────────────
  {
    const text = textOf(search);
    const hasStops   = /停靠站|停站|途經|中途站/.test(text);
    const hasStopBtn = /停靠站|stops|via-stations/.test(search);
    if (hasStops || hasStopBtn) {
      pass(9, '有停靠站資訊或入口按鈕');
    } else {
      fail(9, '找不到停靠站資訊（無停靠站列表或入口）');
    }
  }

  // ─────────────────────────────────────────────
  // 10. 敬老票折扣幾折
  // ─────────────────────────────────────────────
  {
    const bText = textOf(booking);
    const sText = textOf(search);
    const combined = bText + sText;
    const hasElderly = /敬老|長者|老人/.test(combined);

    if (!hasElderly) {
      fail(10, '找不到敬老票選項');
    } else {
      // Extract discount rate
      const discountPatterns = [
        combined.match(/敬老[^。\n]{0,40}?(\d+)\s*折/),
        combined.match(/敬老[^。\n]{0,40}?(\d+)\s*%\s*off/i),
        combined.match(/敬老[^。\n]{0,40}?(\d+)\s*%/),
      ];
      const m = discountPatterns.find(x => x);
      // Also try to get the context
      const ctx = combined.match(/敬老[^\n<>]{0,60}/);
      if (m) {
        const pct = parseInt(m[1]);
        // 5折 = 50%, standard TRA senior discount
        if (pct === 5 || pct === 50) {
          pass(10, `敬老票折扣：${pct <= 10 ? pct+'折' : pct+'%'}（台鐵標準 5 折）`, ctx ? ctx[0].trim() : '');
        } else {
          fail(10, `敬老票折扣顯示 ${pct <= 10 ? pct+'折' : pct+'%'}，不符合台鐵標準（應為 5 折）`, ctx ? ctx[0].trim() : '');
        }
      } else if (ctx) {
        warn(10, '找到敬老票但折扣數字無法解析，需手動確認', ctx[0].trim().substring(0, 80));
      } else {
        warn(10, '找到敬老關鍵字但無法提取折扣詳情，需手動確認');
      }
    }
  }

  // ─────────────────────────────────────────────
  // 11. 車廂類型選項
  // ─────────────────────────────────────────────
  {
    const bText = textOf(booking);
    const sText = textOf(search);
    const combined = bText + sText;
    const hasCarType = /車廂類型|對號座|自由座|商務車廂|商務座|普悠瑪|太魯閣/.test(combined);
    const hasCarSelect = /車廂|cabin|carType|car_type/.test(combined);
    if (hasCarType) {
      pass(11, '有車廂類型選項（對號座/自由座/商務等）');
    } else if (hasCarSelect) {
      warn(11, '有車廂相關文字但類型不明，需手動確認');
    } else {
      fail(11, '找不到車廂類型選項');
    }
  }

  // ─────────────────────────────────────────────
  // 12. 完整付款流程
  // ─────────────────────────────────────────────
  {
    const bText = textOf(booking);
    const hasPaymentMethod = /信用卡|ATM|超商|Line Pay|街口|台灣Pay|付款方式/.test(bText);
    const hasPayBtn = /確認購票|立即付款|前往付款|結帳|pay/i.test(bText);
    const hasOrderConfirm = /訂單確認|訂單成立|booking.?confirm/i.test(bText);

    if (hasPaymentMethod && hasPayBtn) {
      pass(12, '有完整付款流程（付款方式選項 + 購票按鈕）');
    } else if (hasPaymentMethod || hasPayBtn) {
      fail(12, '付款流程不完整', `付款方式:${hasPaymentMethod} 購票按鈕:${hasPayBtn}`);
    } else {
      fail(12, '找不到付款流程（付款方式選項和購票按鈕均缺失）');
    }
  }

  // ─────────────────────────────────────────────
  // 13. 時間制折扣
  // ─────────────────────────────────────────────
  {
    const sText = textOf(search);
    const bText = textOf(booking);
    const combined = sText + bText;
    const hasTimeDiscount = /時間制|早鳥|離峰|非尖峰|特惠時段|平日優惠|假日優惠|off.?peak|early.?bird/i.test(combined);
    if (hasTimeDiscount) {
      pass(13, '有時間制折扣資訊（早鳥/離峰/特惠時段等）');
    } else {
      fail(13, '找不到時間制折扣（早鳥/離峰/非尖峰/特惠時段均未出現）');
    }
  }

  // ─────────────────────────────────────────────
  // Print Report
  // ─────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62));
  console.log('                     測試報告');
  console.log('═'.repeat(62));

  const failed  = results.filter(r => r.status === '❌');
  const passed  = results.filter(r => r.status === '✅');
  const warned  = results.filter(r => r.status === '⚠️');

  console.log('\n❌ 確認存在的問題（Bug）：');
  if (failed.length === 0) { console.log('   （無）'); }
  failed.forEach(r => {
    console.log(`\n  ❌ [${r.id}] ${r.desc}`);
    if (r.note) console.log(`       → ${r.note}`);
  });

  console.log('\n✅ 沒有問題的項目：');
  if (passed.length === 0) { console.log('   （無）'); }
  passed.forEach(r => {
    console.log(`\n  ✅ [${r.id}] ${r.desc}`);
    if (r.note) console.log(`       → ${r.note}`);
  });

  console.log('\n⚠️  需要手動確認的項目：');
  if (warned.length === 0) { console.log('   （無）'); }
  warned.forEach(r => {
    console.log(`\n  ⚠️  [${r.id}] ${r.desc}`);
    if (r.note) console.log(`       → ${r.note}`);
  });

  console.log('\n' + '═'.repeat(62));
  console.log(`  總計：✅ ${passed.length} 項正常   ❌ ${failed.length} 項有問題   ⚠️  ${warned.length} 項需手動確認`);
  console.log('═'.repeat(62) + '\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
