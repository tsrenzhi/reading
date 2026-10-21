/* gate2.js —— 前端「按权限解锁 + 过期提示」闸门（被 lock.js 在末尾动态加载）。
 *
 * 职责（直接回应「所有加锁的地方都得带权限校验」「权限过期后登录要有失效提示」）：
 *   1. 读取 localStorage 里的 token（vip_token），调 entitlement 云函数拿「实时生效权限 + 到期」。
 *   2. 对 lock.js 已加锁、并标了 data-reqperm 的元素，若用户持有该权限 → 解锁（去灰、去锁标、可点进详情）。
 *   3. 已登录但权限全过期 → 页面底部弹「兑换码已失效，如需继续使用请重新兑换」，不写「付费」字样。
 *   4. 未登录 / 网络失败 / token 无效 → 维持 lock.js 的默认锁定（跳转兑换页），绝不越过权限放行。
 *
 * 关键：entitlement 请求带 cache:'no-store'，且每次页面加载都重打 → 锁标状态永远实时，
 *       不会出现「过期了前端还缓存着旧解锁状态」。这是用户第三问「缓存导致过期仍可见」的根除。
 *
 * 与 content 网关同一套判定：所需权限写在元素的 data-reqperm（model/ability/book），
 *       与 permissions-manifest.json 的网关判据一一对应。
 */
(function () {
  "use strict";

  var ENV = "thinking-model-d2gmrpzkyc0e1ae4d";
  // 本地验证（file:// 直接打开或 localhost/127.0.0.1）走本地一体化服务
  // scripts/local_auth_server.js:8081（静态站 + verify2/entitlement 同端口）；
  // 线上(https)仍走云函数——判定是同一套纯函数，本地通过=线上逻辑通过。
  var IS_LOCAL = false;
  try {
    IS_LOCAL = location.protocol === "file:" ||
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
  } catch (e) {}
  var BASE = IS_LOCAL
    ? "http://127.0.0.1:8081"
    : "https://" + ENV + "-1344110321.tcloudbaseapp.com";
  var TOKEN_KEY = "vip_token";
  var CACHE_KEY = "vip_ent"; // 权限快照缓存（配合 lock.js 的视觉延迟刷新，消灭登录用户"闪锁"）

  // permissions: null=未登录/未知（保守锁）; []=已登录但全过期; [..]=生效权限
  var permissions = null;
  var ready = false;
  var bannerShown = false;

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }

  // 缓存读：永不过期(max=null)或未到期(max>now)才有效；过期缓存一律丢弃
  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!c || !Array.isArray(c.p)) return null;
      if (c.max != null && c.max <= Date.now()) return null;
      return c;
    } catch (e) { return null; }
  }
  function writeCache(perms, expiring) {
    try {
      var max = null;
      if (expiring && typeof expiring === "object") {
        for (var k in expiring) {
          var t = expiring[k];
          if (t == null) { max = null; break; } // 有永久 → 永不过期
          if (typeof t === "number" && (max === null || t > max)) max = t;
        }
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify({ p: perms, e: expiring || null, max: max, at: Date.now() }));
    } catch (e) {}
  }

  // 元素是否放行：free(none) 永远放行；未登录锁；已登录看是否持有所需权限
  function mayPass(el) {
    if (!el || !el.getAttribute) return false;
    var req = el.getAttribute("data-reqperm");
    if (!req || req === "none") return true;
    if (req === "any") return permissions !== null && permissions.length > 0; // 任意权限即放行
    if (permissions === null) return false;
    return permissions.indexOf(req) !== -1;
  }

  // 暴露给 lock.js 的点击守卫/视觉刷新用
  window.Gate2 = {
    mayPass: mayPass,
    getPermissions: function () { return permissions; },
    isReady: function () { return ready; },
    unlockAll: applyUnlock,
    reapply: function () { applyUnlock(); if (window.GBVisuals) window.GBVisuals.apply(); }
  };

  // 解锁视觉：去灰态、去锁标 SVG（书卡三态规则以 lock.js 的 stripVisuals 为准，优先委托）
  function unlockEl(el) {
    if (!el) return;
    if (window.GBVisuals && window.GBVisuals.strip) { window.GBVisuals.strip(el); return; }
    el.classList.remove("main-locked", "m-cta-locked", "problem-locked", "book-locked");
    if (el.classList && el.classList.contains("book-card")) el.classList.remove("pending");
    try { delete el.dataset.mainLocked; } catch (e) {}
    try { delete el.dataset.mainLockedIcon; } catch (e) {}
    var icons = el.querySelectorAll ? el.querySelectorAll(".main-lock-icon, .book-lock-icon") : [];
    for (var i = 0; i < icons.length; i++) icons[i].parentNode && icons[i].remove();
  }

  function applyUnlock() {
    var nodes = document.querySelectorAll("[data-reqperm]");
    for (var i = 0; i < nodes.length; i++) {
      if (mayPass(nodes[i])) unlockEl(nodes[i]);
    }
  }

  // 底部失效提示（已登录但全过期）
  function showExpiredBanner() {
    if (bannerShown) return;
    bannerShown = true;
    try {
      var bar = document.createElement("div");
      bar.id = "gate2-expired-bar";
      bar.innerHTML =
        '<span class="g2-txt">兑换码已失效，如需继续使用请重新兑换</span>' +
        '<a class="g2-link" href="intro.html">重新兑换</a>';
      var s = document.createElement("style");
      s.textContent =
        "#gate2-expired-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:center;gap:14px;" +
        "background:#FBF1ED;color:#E0432E;font-size:14px;font-weight:600;padding:12px 16px;box-shadow:0 -2px 12px rgba(0,0,0,.08);}" +
        "#gate2-expired-bar .g2-link{color:#fff;background:#E0432E;border-radius:8px;padding:6px 14px;text-decoration:none;font-weight:700;}" +
        "#gate2-expired-bar .g2-link:active{opacity:.9;}";
      document.head.appendChild(s);
      document.body.appendChild(bar);
    } catch (e) {}
  }

  // 首页（第二大脑）「兑换码有效期」文字（已登录且有权限时显示）。
  // 规则（用户拍板）：
  //   - 只在首页展示（用户 2026-10-15 定稿：其它页面不显示，避免挤占各页布局/搜索框）；
  //   - 不同权限到期时间不同时，取最晚（最长）的那个；
  //   - 任一权限为永久(null) → 标「永久有效」；
  //   - 否则显示剩余天数（向上取整，到期当天=剩 1 天），附最晚到期日期。
  // 与 computeEntitlement 返回的 expiring 一一对应（null=永久）。
  function showExpiry(expiring) {
    if (!expiring || typeof expiring !== "object") return;
    var keys = Object.keys(expiring);
    if (!keys.length) return; // 无权益：不显示
    var isHome = false;
    try {
      isHome = location.pathname === "/" ||
        /(^|\/)growth-brain\.html$/.test(location.pathname) ||
        /(^|\/)index\.html$/.test(location.pathname);
    } catch (e) {}
    if (!isHome) return; // 仅首页
    var hasPermanent = keys.some(function (p) { return expiring[p] == null; });
    if (hasPermanent) {
      setExpiryText("永久有效"); // 永久：不启动 tick
      return;
    }
    var max = null;
    for (var i = 0; i < keys.length; i++) {
      var t = expiring[keys[i]];
      if (typeof t === "number" && (max === null || t > max)) max = t;
    }
    if (max === null) return;
    startExpiryTick(max); // 实时倒计时：≥1天=天级；<24h=小时+分；<1h=分:秒；归零→自动重拉权限
  }

  // 倒计时文案（用户 2026-10-16 拍板：≥1天按天（带到期日）→ <24h 按小时+分 → <1h 按 分:秒）
  function formatRemain(remain) {
    if (remain >= 86400000) {
      var days = Math.ceil(remain / 86400000); // 到期当天=剩1天
      var d = new Date(expiryMaxVal);
      var mm = ("0" + (d.getMonth() + 1)).slice(-2);
      var dd = ("0" + d.getDate()).slice(-2);
      return "兑换码剩 " + days + " 天（至 " + d.getFullYear() + "-" + mm + "-" + dd + "）";
    }
    if (remain >= 3600000) {
      var h = Math.floor(remain / 3600000);
      var mi = Math.floor((remain % 3600000) / 60000);
      return "兑换码剩 " + h + " 小时 " + mi + " 分";
    }
    var s = Math.max(0, Math.floor(remain / 1000));
    var mm2 = ("0" + Math.floor(s / 60)).slice(-2);
    var ss = ("0" + (s % 60)).slice(-2);
    return "兑换码剩 " + mm2 + ":" + ss;
  }

  var expiryTimer = null;
  var expiryMaxVal = null;
  function setExpiryText(txt) {
    try {
      var el = document.getElementById("gate2-expiry");
      if (!el) {
        el = document.createElement("span");
        el.id = "gate2-expiry";
        var host = document.getElementById("top") || document.querySelector(".site-nav .right");
        if (host) host.appendChild(el);
        else {
          el.style.cssText = "position:fixed;top:66px;right:16px;z-index:9998;";
          (document.body || document.documentElement).appendChild(el);
        }
      }
      if (el._lastTxt !== txt) { el.textContent = txt; el._lastTxt = txt; }
    } catch (e) {}
  }

  function startExpiryTick(max) {
    expiryMaxVal = max;
    if (expiryTimer) return; // 单例，不重复开
    expiryTimer = setInterval(function () {
      if (expiryMaxVal == null) return;
      var remain = expiryMaxVal - Date.now();
      if (remain <= 0) {
        // 到期：清缓存 → 重新拉权限（云端判定全过期 → 权限清空 + 锁视觉自动恢复 + 底部失效提示）。
        // 已打开的详情/面板不强制关闭（不驱逐当前会话），下次操作/进页时按新权限判定。
        clearInterval(expiryTimer); expiryTimer = null; expiryMaxVal = null;
        try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
        loadEntitlement();
        return;
      }
      setExpiryText(formatRemain(remain));
    }, 1000);
    setExpiryText(formatRemain(max - Date.now()));
  }

  function applyEntitlement(res) {
    if (res && res.loggedIn) {
      permissions = Array.isArray(res.permissions) ? res.permissions : [];
      writeCache(permissions, res.expiring); // 写缓存：下次进门即时正确态
      if (permissions.length) showExpiry(res.expiring); // 已登录且有权限 → 显示到期时间（取最晚）
      if (res.allExpired) showExpiredBanner();
    } else {
      permissions = null; // token 无效：当未登录处理（保持锁）
      try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
    }
  }

  function loadEntitlement() {
    var token = getToken();
    if (!token) { ready = true; return; } // 未登录：维持锁定（当前行为）
    // 1) 缓存优先：同步还原权限 + 刷视觉（登录用户零闪；访客无缓存=维持锁定原样）
    var cached = readCache();
    if (cached) {
      permissions = Array.isArray(cached.p) ? cached.p : [];
      ready = true;
      if (permissions.length) showExpiry(cached.e);
      if (window.Gate2.reapply) window.Gate2.reapply();
    }
    // 2) 再打实时接口校准（no-store，过期即时反映）
    fetch(BASE + "/entitlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token }),
      cache: "no-store"
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        applyEntitlement(res);
        ready = true;
        if (window.Gate2.reapply) window.Gate2.reapply();
      })
      .catch(function () {
        ready = true; // 网络/云函数未部署：有缓存用缓存，无缓存保守锁住，不越过权限放行
        if (window.Gate2.reapply) window.Gate2.reapply();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadEntitlement);
  } else {
    loadEntitlement();
  }
})();
