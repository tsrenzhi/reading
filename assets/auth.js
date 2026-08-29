/*
 * auth.js —— 前端鉴权桥（Tier A 轻量云函数门禁）
 * 依赖：先加载 assets/tcb-js-sdk.js（@cloudbase/js-sdk 浏览器 IIFE，全局 cloudbase）
 * 暴露：window.VipAuth = { verify(code), checkEntitlement(token) } 均返回 Promise
 *
 * 设计原则：前端只持云端下发的 token，绝不存明文兑换码；码可作废、可限设备数。
 * 注意：CloudBase 云函数默认要求登录，调用前会先匿名登录；需在控制台开启
 *       「身份认证 -> 登录方式 -> 匿名登录」开关。
 */
(function (global) {
  var ENV = 'thinking-model-d2gmrpzkyc0e1ae4d';

  var SDK = global.cloudbase || global.tcb;
  var app = null;
  var anonReady = null;

  function getApp() {
    if (app) return app;
    if (!SDK) {
      throw new Error('cloudbase SDK 未加载（缺少 assets/tcb-js-sdk.js）');
    }
    app = SDK.init({ env: ENV });
    return app;
  }

  function deviceId() {
    try {
      var d = localStorage.getItem('vip_device');
      if (!d) {
        d = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('vip_device', d);
      }
      return d;
    } catch (e) { return 'web'; }
  }

  function ensureAnonymous() {
    if (anonReady) return anonReady;
    anonReady = new Promise(function (resolve, reject) {
      var a = getApp();
      var auth = a.auth && a.auth();
      if (!auth) {
        reject(new Error('CloudBase auth 未初始化'));
        return;
      }
      // SDK v3+ 使用 signInAnonymously，旧版使用 anonymousSignIn
      var fn = (typeof auth.signInAnonymously === 'function' && auth.signInAnonymously) ||
               (typeof auth.anonymousSignIn === 'function' && auth.anonymousSignIn);
      if (!fn) {
        reject(new Error('当前 SDK 不支持匿名登录'));
        return;
      }
      fn.call(auth)
        .then(function () { resolve(); })
        .catch(function (e) {
          console.warn('匿名登录失败：', e);
          reject(e || new Error('匿名登录失败'));
        });
    });
    return anonReady;
  }

  function call(name, data) {
    return ensureAnonymous().then(function () {
      return getApp().callFunction({ name: name, data: data });
    }).then(function (res) {
      return (res && res.result) || { ok: false, msg: '空响应' };
    });
  }

  global.VipAuth = {
    env: ENV,
    verify: function (code) {
      return call('verify', { code: code, deviceEnv: deviceId() });
    },
    checkEntitlement: function (token) {
      return call('checkEntitlement', { token: token });
    }
  };
})(window);
