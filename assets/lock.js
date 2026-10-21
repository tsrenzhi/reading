/* 主站(8080)内容锁定：锁定元素可点击，按权限规则处置（零权限→跳兑换页 /intro.html；
   有部分权限但缺这项→弹「暂无查看权限」提示，不跳转不刷新）。
   仅主站加载；VIP 站(82)由 split_sites 移除本脚本引用后自动全解锁。

   === 视觉时序（2026-10-15 用户拍板：消灭"闪锁"）===
   旧逻辑：lock.js 先给所有锁定元素加灰+锁标 → gate2 拿到权限后再解锁 → 登录用户每页
   都先看到一遍全灰枷锁再恢复（切分类/切 tab 时整页闪锁）。
   新逻辑：lock.js 只装「点击守卫 + data-reqperm」，不加任何视觉；
   视觉统一由权限就绪后 applyVisuals() 一次性刷正确状态（持权→无视觉，无权限→灰+锁标）。
   gate2 侧配 localStorage 权限缓存（vip_ent），登录用户进门即正确态，零闪烁。
   第二大脑图谱节点永不置灰（用户明令）：只拦点击，不加视觉。 */
(function(){
  "use strict";
  // 注意：不要在这里清掉 vip_token。gate2.js 需要凭 vip_token 查实时权限来决定解锁。

  // 免费模型 = 8 个核心 + 思维陷阱 → 错误的思维方式（11 个）
  var FREE_MODELS = "jie-gou-hua-si-wei|di-yi-xing-yuan-li|bian-zheng-si-wei|luo-ji-si-wei|chou-xiang-si-wei|xi-tong-si-wei|pi-pan-xing-si-wei|ni-xiang-si-wei|yi-yuan-si-wei|er-yuan-si-wei|guan-xing-si-wei|lu-jing-yi-lai|xian-xing-si-wei|jue-dui-si-wei|xue-sheng-si-wei|qiong-ren-si-wei|ruo-zhe-si-wei|da-gong-si-wei|wei-ke-xue-si-wei".split("|");
  var FREE_BOOKS  = "纳瓦尔宝典|富爸爸穷爸爸|人类简史|国富论|孙子兵法".split("|");
  var FREE_CATS   = "cat-1|cat-2".split("|");
  var PAIN_FIRST  = {"自我认知":"迷茫","情绪管理":"焦虑","思考与决策":"盲目跟风","做事与执行":"拖延","人际关系":"总是讨好别人"};
  var FREE_PAINS  = [];
  for(var k in PAIN_FIRST){ if(PAIN_FIRST.hasOwnProperty(k)) FREE_PAINS.push(PAIN_FIRST[k]); }
  var INTRO = "/intro.html";

  // 注入锁标视觉样式：与免费站 free-lock.css 同色系 #9C928A（仅图标 + 文字色，无背景/边框）
  (function injectStyle(){
    try {
      var s = document.createElement("style");
      s.textContent =
        ".main-locked, .main-locked *{color:#9C928A !important;}" +
        ".main-locked{cursor:pointer;}" +
        ".main-locked .count{opacity:.55;}" +
        ".main-lock-icon{display:inline-block;width:13px;height:13px;vertical-align:-2px;margin-right:4px;flex-shrink:0;}" +
        ".main-locked > span{display:inline-flex;align-items:center;}" +
        ".m-cta-locked{color:#9C928A !important;}" +
        ".side-nav-problems a.problem-locked, .side-nav-problems a.problem-locked *{color:#9C928A !important;}" +
        ".side-nav-problems a.problem-locked{position:relative;}" +
        "#gate2-toast{position:fixed;top:64px;left:50%;transform:translateX(-50%) translateY(-6px);z-index:10000;" +
        "display:inline-flex;align-items:center;gap:8px;" +
        "background:#FFFDFA;color:#201914;border:1px solid #ECE2D6;border-radius:10px;" +
        "font-size:13.5px;font-weight:500;letter-spacing:.02em;padding:10px 20px;" +
        "opacity:0;pointer-events:none;transition:opacity .18s ease, transform .18s ease;" +
        "box-shadow:0 8px 24px rgba(0,0,0,.08);}" +
        "#gate2-toast::before{content:\"\";width:6px;height:6px;border-radius:50%;background:#E0432E;flex-shrink:0;}" +
        "#gate2-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}" +
        "body.brain-page:not(.light) #gate2-toast{" +
        "background:rgba(28,23,19,.92);color:#F2E9DF;border-color:rgba(255,255,255,.14);" +
        "box-shadow:0 10px 28px rgba(0,0,0,.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}" +
        "#gate2-expiry{display:inline-flex;align-items:center;font-size:13px;font-weight:600;color:inherit;" +
        "opacity:.78;margin-left:auto;padding-left:16px;border-left:1px solid rgba(255,255,255,.22);white-space:nowrap;}" +
        "body.light #gate2-expiry{border-left-color:rgba(0,0,0,.14);}" +
        /* 模型锁卡：锁图标（在 m-foot 内）常显——pending 常态 m-foot 默认 opacity:0，必须拉回来 */
        ".model.main-locked .m-foot{opacity:1;}" +
        /* 能力页无权限隐藏侧栏时：主区去左偏移、评估卡片回正中 */
        "body.abm-nav-hidden .wrap{margin-left:auto;margin-right:auto;}" +
        /* 无侧栏时评估卡居中；有侧栏时贴齐侧栏（间距 28px，见 gen_ability_model 注释） */
        "body.abm-nav-hidden .asm-hero{margin:0 auto;}";
      document.head.appendChild(s);
    } catch(err) {}
  })();

  var LOCK_SVG = '<svg class="main-lock-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  // 在 el 内插入灰色 SVG 锁（在第一个子节点前）
  function prefixLock(el){
    if(!el || el.dataset.mainLockedIcon) return;
    el.dataset.mainLockedIcon = "1";
    var tmp = document.createElement("span");
    tmp.innerHTML = LOCK_SVG;
    var svg = tmp.querySelector("svg");
    if(!svg) return;
    if(el.firstChild) el.insertBefore(svg, el.firstChild);
    else el.appendChild(svg);
    var space = document.createTextNode(" ");
    el.insertBefore(space, svg.nextSibling);
  }

  // 「暂无查看权限」轻提示（有部分权限但缺这一项时用：不跳转、不刷新）
  function toastNoPerm(){
    try {
      var t = document.getElementById("gate2-toast");
      if(!t){
        t = document.createElement("div");
        t.id = "gate2-toast";
        (document.body || document.documentElement).appendChild(t);
      }
      t.textContent = "暂无查看权限";
      t.classList.add("show");
      clearTimeout(t._hideTm);
      t._hideTm = setTimeout(function(){ t.classList.remove("show"); }, 1800);
    } catch(err) {}
  }

  // 无权限处置分两条线（用户 2026-10-15 深夜定稿）：
  //   图谱专用 denyGraph：零权限→跳兑换页；有部分权限但缺这项→弹「暂无查看权限」（toast 只在图谱）；
  //   页面元素（模型卡/侧栏/书卡）denyJump：未登录→跳兑换页；
  //     **已登录（有 token）但无权限 → 什么都不做**（锁已表明状态，跳兑换页会被"已解锁"检查弹回首页，
  //     用户 2026-10-15 拍板："已经登录了，他没有权限的时候就不要动它了"）。
  function denyGraph(e){
    if(e && e.preventDefault) e.preventDefault();
    if(e && e.stopPropagation) e.stopPropagation();
    if(e && e.stopImmediatePropagation) e.stopImmediatePropagation();
    var perms = window.Gate2 ? window.Gate2.getPermissions() : null;
    if(perms && perms.length > 0){ toastNoPerm(); return false; }
    try { window.location.href = INTRO; } catch(err) {}
    return false;
  }
  function hasToken(){
    try { return !!localStorage.getItem("vip_token"); } catch(err) { return false; }
  }
  function denyJump(e){
    if(e && e.preventDefault) e.preventDefault();
    if(e && e.stopPropagation) e.stopPropagation();
    if(e && e.stopImmediatePropagation) e.stopImmediatePropagation();
    if(hasToken()) return false; // 已登录无权限：不动（锁即提示）
    try { window.location.href = INTRO; } catch(err) {}
    return false;
  }

  // 权限守卫：点击已锁元素时调用。用户持有该元素所需权限 → 放行（不拦截）；
  // 否则直接跳兑换页。window.Gate2 由 gate2.js 注入（异步加载，可能未就绪 → 当未登录，锁住）。
  function guardedJump(e, el){
    if(window.Gate2 && window.Gate2.mayPass(el)) return; // 持权限 → 放行
    return denyJump(e);
  }

  // 只装守卫 + 标记所需权限，不加视觉（视觉由 applyVisuals 在权限就绪后统一刷）
  function lockLink(a, reqperm){
    if(!a || a.dataset.mainLocked) return;
    a.dataset.mainLocked = "1";
    if(reqperm) a.setAttribute("data-reqperm", reqperm);
    a.addEventListener("click", function(e){ guardedJump(e, a); }, true);
  }

  // 思维模型分类页：只有「错误的思维方式」子类 + 19 个免费模型可点；其余加锁。
  function lockModelCards(){
    document.querySelectorAll("a.model.done").forEach(function(a){
      // 1) 思维陷阱页：只有「错误的思维方式」子类开放
      if(a.closest('[data-sub="错误的思维方式"]')) return;
      // 2) 思维模型页：免费模型放行
      var href = a.getAttribute("href") || "";
      var m = href.match(/models\/([a-z0-9-]+)\.html/);
      var slug = m ? m[1] : "";
      if(slug && FREE_MODELS.indexOf(slug) !== -1) return;
      // 3) 其余：锁（所需权限 = model；视觉由 applyVisuals 补）
      lockLink(a, "model");
    });
  }

  // 分类侧栏：非免费分类页(cat-1/cat-2) -> 加锁
  function lockSideNav(){
    document.querySelectorAll(".side-nav ul li a").forEach(function(a){
      var href = a.getAttribute("href") || "";
      var m = href.match(/category\/cat-(\d+)\.html/);
      var cat = m ? "cat-" + m[1] : "";
      if(!cat || FREE_CATS.indexOf(cat) !== -1) return;
      lockLink(a, "model"); // 非免费分类页 = 思维模型内容，所需权限 model
    });
  }

  // 成长之路侧栏：每个分类的「第一个链接」= 置顶项（位置驱动，不写死名称），保持可点；
  // 其余标 any：持有任意一个权限(model/ability/book 任一)即解锁（成长痛点属附加功能）。
  // 注意：能力页(ability-model.html)侧栏也带 side-nav-problems 类，必须排除，
  // 否则本函数会误标 ability 页的链接（2026-10-15 修：曾导致 any 覆盖 ability 锁）。
  function lockGrowthRoad(){
    if(/ability-model\.html$/.test(location.pathname)) return; // 能力页侧栏由 lockAbilityPage 管
    document.querySelectorAll(".side-nav-problems .nav-group").forEach(function(g){
      var links = g.querySelectorAll("ul li a");
      for(var i = 0; i < links.length; i++){
        var a = links[i];
        if(i === 0) continue; // 每个分类第一个（置顶项）保持可点
        lockLink(a, "any");
      }
    });
  }

  // 第二大脑：节点点击拦截 + 来源不可点。
  // 注意：页面内 showPanel/canJump 为 initGraph 闭包内局部函数，无法从外部覆盖，
  // 故改为在节点元素上以「捕获阶段」拦截点击，按节点数据(d.type/d.label/d.slug)判定。
  function isFreeNode(d){
    if(!d || !d.type) return false;
    if(d.type === "pain"){
      return FREE_PAINS.indexOf(d.label) !== -1; // 迷茫/焦虑/盲目跟风/拖延/总是讨好别人 放行
    }
    if(d.type === "book"){
      var key = (d.label || "").trim();
      var norm = key.replace(/[（(].*?[)）]/g, "").trim(); // 去掉括号后缀
      return FREE_BOOKS.indexOf(key) !== -1 || FREE_BOOKS.indexOf(norm) !== -1;
    }
    if(d.type === "thinking"){
      var raw = d.slug || (d.id ? d.id.replace(/^thinking-/, "") : "") || "";
      var slug = raw.replace(/ /g, "-").replace(/\.md$/i, "");
      return FREE_MODELS.indexOf(raw) !== -1 || FREE_MODELS.indexOf(slug) !== -1;
    }
    return false; // ability/theme 及其它：锁定
  }

  function patchGrowthBrain(){
    // 权限映射（用户 2026-10-15 深夜定稿）：
    //   thinking→model / book→book / pain→any（持任意权限即解锁，成长痛点属附加功能）；
    //   insight（认知洞察）→any：无详情页，持任意权限 → 图谱默认弹窗（showPanel），不跳详情；
    //   theme（主题大圆圈）/quote/case/method/list/story/reflection 等类型：
    //     本来就没有权限概念 → 不拦、不标，图谱默认行为原样保留。
    var NODE_PERM = { thinking: "model", book: "book", ability: "ability", pain: "any", insight: "any" };
    function bindNodes(){
      var nodes = document.querySelectorAll(".node");
      if(!nodes.length){ setTimeout(bindNodes, 300); return; }
      nodes.forEach(function(el){
        if(el.dataset.gbLocked) return;
        el.dataset.gbLocked = "1";
        var d = el.__data__;
        var req = d && d.type ? NODE_PERM[d.type] : null;
        if(!isFreeNode(d) && req){
          el.setAttribute("data-reqperm", req);
        }
        el.addEventListener("click", function(ev){
          var dd = el.__data__;
          if(!dd || isFreeNode(dd) || !NODE_PERM[dd.type]) return; // 免费节点/无权限概念类型：不拦截
          if(window.Gate2 && window.Gate2.mayPass(el)) return; // 持对应权限 → 放行（图谱自身逻辑：有详情直跳/无详情弹窗）
          denyGraph(ev); // 图谱专用：零权限→跳兑换页；有部分权限→提示，不刷新不跳转
        }, true);
      });
    }
    bindNodes();
    // 来源链接可点（2026-10-15 用户拍板恢复）：public/knowledge-base/sources/html/ 已随站点分发，
    // 弹窗内"来源"可继续点进原文页——不再静默拦截。
  }

  // 防御：分类标题展开时调用的全局 showProblem 可能被传入被锁项，拦截以免切到不可看的内容
  function patchShowProblem(){
    if(typeof window.showProblem !== "function") return;
    var original = window.showProblem;
    window.showProblem = function(id, noScroll, animate){
      if(id){
        var targetLink = document.querySelector('.side-nav a[data-target="' + id + '"]');
        // 以 data-reqperm 为锁判据（视觉类可能还没刷，不能依赖 class）
        if(targetLink && targetLink.getAttribute("data-reqperm")){
          if(window.Gate2 && window.Gate2.mayPass(targetLink)) return original.apply(this, arguments);
          return denyJump(null); // 无权限：直接跳兑换页（加锁了就引导兑换）
        }
      }
      return original.apply(this, arguments);
    };
  }

  // 思维陷阱页：三个子分类 tab 全部可切换（让用户看到有哪些卡片）。
  function patchTrapTabs(){
    // 故意不锁 tab。tab 切换是浏览行为，不算「解锁」；锁卡片才是真正限制。
  }

  // 书单锁卡（动态渲染，翻页/筛选会重建）→ 文档级捕获委托：
  // 有 book 权限放行进书详情；零权限跳兑换页；部分权限提示。
  function lockBookCards(){
    document.addEventListener("click", function(ev){
      if(ev.defaultPrevented) return;
      var a = ev.target && ev.target.closest ? ev.target.closest('a.book-card[data-reqperm="book"]') : null;
      if(!a) return;
      if(window.Gate2 && window.Gate2.mayPass(a)){
        // 持权放行；但无详情页的卡目标是 intro.html，持权点了也不该进兑换页 → 原地拦住
        if(/intro\.html$/.test(a.getAttribute("href") || "")){
          if(ev.preventDefault) ev.preventDefault();
        }
        return;
      }
      denyJump(ev); // 无权限：直接跳兑换页（加锁了就引导兑换，不提示）
    }, true);
    // 翻页/筛选重渲染后：按当前权限重刷视觉（新卡默认带静态锁视觉）
    document.addEventListener("booksRendered", function(){
      if(window.GBReapply) window.GBReapply();
    });
  }

  // 付费书/付费模型详情页整页门（books/<名>.html 或 models/<slug>.html，非免费项）：
  // 有所需权限正常看；零权限直接跳兑换页；部分权限提示后离开（整页内容不能留人）。
  function lockDetailPage(kind){
    var m = kind === "book"
      ? location.pathname.match(/\/books\/([^\/]+)\.html$/)
      : location.pathname.match(/\/models\/([a-z0-9-]+)\.html$/);
    if(!m) return;
    var name = m[1];
    try { name = decodeURIComponent(name); } catch(err) {}
    if(kind === "book"){
      var norm = name.replace(/[（(].*?[)）]/g, "").trim();
      if(FREE_BOOKS.indexOf(name) !== -1 || FREE_BOOKS.indexOf(norm) !== -1) return; // 免费书放行
    } else {
      if(FREE_MODELS.indexOf(name) !== -1) return; // 免费模型放行
    }
    var req = kind === "book" ? "book" : "model";
    function check(){
      var fake = { getAttribute: function(){ return req; } };
      if(window.Gate2 && window.Gate2.mayPass(fake)) return; // 有权限 → 正常阅读
      var perms = window.Gate2 ? window.Gate2.getPermissions() : null;
      if(perms && perms.length > 0){
        toastNoPerm();
        setTimeout(function(){ try { window.location.href = INTRO; } catch(err) {} }, 900);
      } else {
        try { window.location.href = INTRO; } catch(err) {}
      }
    }
    if(window.Gate2 && window.Gate2.isReady && window.Gate2.isReady()){ check(); return; }
    var tries = 0;
    (function wait(){
      if(window.Gate2 && window.Gate2.isReady && window.Gate2.isReady()){ check(); return; }
      if(++tries > 50){ try { window.location.href = INTRO; } catch(err) {} return; } // 5s 无门：保守跳兑换
      setTimeout(wait, 100);
    })();
  }
  function lockBookDetailPage(){ lockDetailPage("book"); }
  function lockModelDetailPage(){ lockDetailPage("model"); }

  // 能力页（ability-model.html）—— 用户 2026-10-15 深夜最终定稿：
  //   「个人能力评估」= 免费功能，谁都能测（不跳兑换、不锁、不提示）；
  //   左侧导航（43 个能力详情）= 需 ability 权限：**无权限 → 整个左侧导航直接隐藏**
  //   （不显示、不提示；用户原话"没权限直接隐藏不就行了"）；
  //   深链直达 #p-xxx 无权限 → 静默回评估首页（不刷新、不提示）。
  //   「暂无查看权限」toast 只服务第二大脑图谱（用户指定），能力页一律不用。
  function lockAbilityPage(){
    if(!/\/ability-model\.html$/.test(location.pathname)) return;
    function hasAbility(){
      var fake = { getAttribute: function(){ return "ability"; } };
      return !!(window.Gate2 && window.Gate2.mayPass(fake));
    }
    function setNavVisible(v){
      var sn = document.querySelector(".side-nav");
      var ov = document.querySelector(".side-nav-overlay");
      var mt = document.getElementById("menuToggle");
      if(sn) sn.style.display = v ? "" : "none";
      if(ov) ov.style.display = v ? "" : "none";
      if(mt) mt.style.display = v ? "" : "none";
      // 隐藏侧栏时主区去左偏移（评估卡片回正中，不跟侧栏留大空档）
      try { document.body.classList.toggle("abm-nav-hidden", !v); } catch(e) {}
    }
    function gate(){
      if(hasAbility()){ setNavVisible(true); return; } // 有权限：正常显示
      setNavVisible(false); // 无权限：隐藏左侧导航
      // 深链直达能力详情：静默回评估首页（不刷新、不提示）
      var h = "";
      try { h = decodeURIComponent(location.hash.replace('#', '')); } catch(err) { h = location.hash.replace('#', ''); }
      if(h.indexOf('p-') === 0 && location.hash !== '#abm-home'){ location.hash = 'abm-home'; }
    }
    // 默认（未校验/无权限）即隐藏：本函数在 DOMContentLoaded 首帧前同步执行，
    // 未登录用户根本看不到导航出现，杜绝"先展示再隐藏"的闪烁（用户 2026-10-15 拍板）
    setNavVisible(false);
    // 轮询状态机：校验成功/缓存还原出 ability 权限 → 立即恢复显示（含缓存先到、fetch 后纠正的时序差）
    var lastState = false;
    var bootP = bootPerms();
    if(bootP !== null && bootP.indexOf("ability") !== -1){ lastState = true; setNavVisible(true); }
    (function poll(){
      if(window.Gate2 && window.Gate2.isReady && window.Gate2.isReady()){
        var v = hasAbility();
        if(v !== lastState){ lastState = v; gate(); }
      }
      setTimeout(poll, 50);
    })();
  }

  // ---------- 视觉统一刷新（权限就绪后调用；幂等，可反复调） ----------
  function addVisuals(el){
    if(!el) return;
    if(el.classList.contains("book-card")) return;   // 书卡：生成器已输出静态锁视觉
    if(el.classList.contains("node")) return;        // 图谱节点：永不置灰（用户明令）
    var req = el.getAttribute("data-reqperm");
    if(!req || req === "none" || req === "locked") return;
    if(el.tagName !== "A") return;
    // 思维模型卡：回归原版锁卡样式（用户 2026-10-15 拍板）——
    //   pending 灰态（无 hover 交互）+ 右下「查看详情」位置换成锁图标；绝不在标题前插锁
    if(el.classList.contains("model")){
      el.classList.remove("done");
      el.classList.add("pending", "main-locked");
      var cta = el.querySelector(".m-cta");
      if(cta && !cta.dataset.ctaHtml){
        cta.dataset.ctaHtml = cta.innerHTML; // 备份「查看详情+箭头」，解锁时还原
        cta.innerHTML = LOCK_SVG;
      }
      return;
    }
    if(el.closest(".side-nav-problems")) el.classList.add("problem-locked");
    else el.classList.add("main-locked");
    if(!el.dataset.mainLockedIcon){
      var node = el.firstElementChild, done = false;
      while(node){
        if(node.tagName === "SPAN"){ prefixLock(node); done = true; break; }
        node = node.nextElementSibling;
      }
      if(!done) prefixLock(el); // 兜底：没有 span 子元素时直接插在 a 里
    }
  }

  function stripVisuals(el){
    if(!el) return;
    el.classList.remove("main-locked", "m-cta-locked", "problem-locked", "book-locked");
    // 思维模型卡：恢复 done 可交互态 + 还原「查看详情」
    if(el.classList.contains("model")){
      el.classList.remove("pending");
      el.classList.add("done");
      var cta = el.querySelector(".m-cta");
      if(cta && cta.dataset.ctaHtml){
        cta.innerHTML = cta.dataset.ctaHtml;
        try { delete cta.dataset.ctaHtml; } catch(e) {}
      }
    }
    if(el.classList && el.classList.contains("book-card")){
      // 书卡三态（用户 2026-10-15 拍板：权限只控制锁，不控制样式）：
      //   有详情 → 恢复正常态（和免费书完全一样）；无详情 → 保留灰样式，只是解锁
      if(el.getAttribute("data-hasdetail") === "1"){ el.classList.remove("pending"); el.classList.add("done"); }
    }
    try { delete el.dataset.mainLocked; } catch(e) {}
    try { delete el.dataset.mainLockedIcon; } catch(e) {}
    var icons = el.querySelectorAll ? el.querySelectorAll(".main-lock-icon, .book-lock-icon") : [];
    for(var i = 0; i < icons.length; i++) icons[i].parentNode && icons[i].remove();
  }

  function applyVisuals(permsOverride){
    var useOverride = permsOverride !== undefined;
    var els = document.querySelectorAll("[data-reqperm]");
    for(var i = 0; i < els.length; i++){
      var el = els[i];
      var pass = useOverride ? passFor(el, permsOverride) : !!(window.Gate2 && window.Gate2.mayPass(el));
      if(pass) stripVisuals(el); else addVisuals(el);
    }
  }
  // 按 perms 数组判定放行（boot 阶段 Gate2 尚未就绪时用）
  function passFor(el, perms){
    if(!el || !el.getAttribute) return true;
    var req = el.getAttribute("data-reqperm");
    if(!req || req === "none") return true;
    if(req === "any") return !!(perms && perms.length > 0);
    if(perms === null) return false;
    return perms.indexOf(req) !== -1;
  }
  // 本地权限快照（与 gate2 缓存同源）：[] =未登录；[..]=缓存权限；null=有 token 无缓存（未知，等 Gate2）
  function bootPerms(){
    try {
      var token = localStorage.getItem("vip_token");
      if(!token) return [];
      var c = JSON.parse(localStorage.getItem("vip_ent") || "null");
      if(c && Array.isArray(c.p)){
        if(c.max != null && c.max <= Date.now()) return [];
        return c.p;
      }
      return null;
    } catch(err) { return []; }
  }
  window.GBVisuals = { apply: applyVisuals, strip: stripVisuals };
  // 供动态渲染（书单翻页/筛选）后调用：按当前权限重刷视觉
  window.GBReapply = function(){
    if(window.Gate2 && window.Gate2.isReady && window.Gate2.isReady()){
      if(window.Gate2.unlockAll) window.Gate2.unlockAll();
      applyVisuals();
    }
  };

  // 拉起 gate2.js（按权限解锁 + 过期提示）。路径跟随 lock.js 自身 src 推导，兼容子目录页面。
  function loadGate2(){
    try {
      if(window.Gate2) return; // 已注入（避免重复）
      var me = document.querySelector('script[src*="assets/lock.js"]');
      var base = me ? me.getAttribute("src").replace(/lock\.js(\?.*)?$/, "") : "assets/";
      var s = document.createElement("script");
      s.src = base + "gate2.js";
      s.async = true;
      document.body.appendChild(s);
    } catch(e) {}
  }

  // 视觉时序：run() 内同步用 boot 快照刷一次（首帧前完成，未登录/有缓存用户零闪）；
  // Gate2 就绪后用实时权限再校准一遍（幂等，状态相同则无视觉变化）。
  (function waitVisuals(){
    if(window.Gate2 && window.Gate2.isReady && window.Gate2.isReady()){
      applyVisuals();
      // 书单：权限就绪后按权限分组重排（无权限=免费组优先；有权限=有卡片组优先）
      if(/\/book-list\.html$/.test(location.pathname) && typeof window.render === "function"){
        try { window.render(); } catch(e) {}
      }
      return;
    }
    setTimeout(waitVisuals, 50);
  })();

  function run(){
    var steps = [lockModelCards, lockSideNav, lockGrowthRoad, patchGrowthBrain, patchShowProblem, patchTrapTabs, lockBookCards, lockBookDetailPage, lockModelDetailPage, lockAbilityPage];
    for(var i = 0; i < steps.length; i++){
      try { steps[i](); } catch(err) { /* 单步失败不阻断其它 */ }
    }
    loadGate2(); // 锁定完成后再拉闸门，确保 Gate2 能看到已锁元素
    // 同步初始视觉：未登录=立刻全锁态；有缓存=立刻正确态（都在首帧前，杜绝"先亮后灰"闪锁）
    var boot = bootPerms();
    if(boot !== null) applyVisuals(boot);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
