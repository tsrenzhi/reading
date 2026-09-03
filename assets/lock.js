/* 主站(8080)内容锁定：锁定卡仍可点击，点击跳兑换码页 /intro.html。
   仅主站加载；VIP 站(82)由 split_sites 移除本脚本引用后自动全解锁。
   锁标视觉：与免费站 81 同款——在链接第一个 span 前插灰色 SVG 小锁 + 文字变灰。 */
(function(){
  "use strict";
  // 防御：旧版 public 站点的 lock.js 可能残留 vip_token 并自动跳 /full/；
  // 主站（8080）不走那条逻辑，直接清理避免本地测试时乱跳。
  try { localStorage.removeItem('vip_token'); } catch(e){}

  var FREE_MODELS = "jie-gou-hua-si-wei|di-yi-xing-yuan-li|bian-zheng-si-wei|luo-ji-si-wei|chou-xiang-si-wei|xi-tong-si-wei|pi-pan-xing-si-wei|ni-xiang-si-wei".split("|");
  var FREE_BOOKS  = "纳瓦尔宝典|富爸爸穷爸爸|人类简史|国富论|孙子兵法".split("|");
  var FREE_CATS   = "cat-1|cat-2".split("|");
  var PAIN_FIRST  = {"自我认知":"迷茫","情绪管理":"焦虑","思考与决策":"盲目跟风","做事与执行":"拖延","人际关系":"过度在意他人看法"};
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
        ".side-nav-problems a.problem-locked{position:relative;}";
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

  function jump(e){
    if(!e) return false;
    if(e.preventDefault) e.preventDefault();
    if(e.stopPropagation) e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    try { window.location.href = INTRO; } catch(err) {}
    return false;
  }

  function lockLink(a, jumper){
    if(!a || a.dataset.mainLocked) return;
    a.dataset.mainLocked = "1";
    a.classList.add("main-locked");
    a.addEventListener("click", jumper, true);
    // 锁标视觉：在 a 的第一个 span 子元素前插灰色 SVG 小锁
    var node = a.firstElementChild;
    while(node){
      if(node.tagName === "SPAN"){
        prefixLock(node);
        break;
      }
      node = node.nextElementSibling;
    }
  }

  // 思维模型分类页：非 8 核心模型 + 非「错误的思维方式」子类 -> 加锁跳 intro
  // 重要：cat-1 思维陷阱页内，split_sites.py 会把所有卡片 href 改写到 ../intro.html
  // （避免 public 站 404），所以不能用 href 反推 slug。改为：
  //   1) 优先用 closest('[data-sub="错误的思维方式"]') 判断：找到 = 放行
  //   2) 兜底：如果 href 能解析 slug 且在 8 核心里 = 放行
  //   3) 其余：锁（加 main-locked + 灰色 SVG + 拦截 click 跳 intro）
  function lockModelCards(){
    document.querySelectorAll("a.model.done").forEach(function(a){
      // 1) 思维陷阱页：只有「错误的思维方式」子类开放
      if(a.closest('[data-sub="错误的思维方式"]')) return;
      // 2) 思维模型页：8 核心放行
      var href = a.getAttribute("href") || "";
      var m = href.match(/models\/([a-z0-9-]+)\.html/);
      var slug = m ? m[1] : "";
      if(slug && FREE_MODELS.indexOf(slug) !== -1) return;
      // 3) 其余：锁（href 可能已经是 intro.html，但视觉锁 + click 拦截仍要加）
      lockLink(a, jump);
      var cta = a.querySelector(".m-cta");
      if(cta){ cta.innerHTML = LOCK_SVG; cta.classList.add("m-cta-locked"); }
    });
  }

  // 分类侧栏：非免费分类页(cat-1/cat-2) -> 加锁跳 intro
  function lockSideNav(){
    document.querySelectorAll(".side-nav ul li a").forEach(function(a){
      var href = a.getAttribute("href") || "";
      var m = href.match(/category\/cat-(\d+)\.html/);
      var cat = m ? "cat-" + m[1] : "";
      if(!cat || FREE_CATS.indexOf(cat) !== -1) return;
      lockLink(a, jump);
    });
  }

  // 成长之路侧栏：每个分类的「第一个链接」= 置顶项（位置驱动，不写死名称，
  // 顺序由 lock_main_site 脚本保证），保持可点；其余加 problem-locked + 跳 intro。
  function lockGrowthRoad(){
    document.querySelectorAll(".side-nav-problems .nav-group").forEach(function(g){
      var links = g.querySelectorAll("ul li a");
      for(var i = 0; i < links.length; i++){
        var a = links[i];
        if(i === 0) continue; // 每个分类第一个（置顶项）保持可点
        a.classList.add("problem-locked");
        lockLink(a, jump);
      }
    });
  }

  // 第二大脑：节点点击拦截 + 来源不可点。
  // 注意：页面内 showPanel/canJump 为 initGraph 闭包内局部函数，无法从外部覆盖，
  // 故改为在节点元素上以「捕获阶段」拦截点击，按节点数据(d.type/d.label/d.slug)判定。
  function isFreeNode(d){
    if(!d || !d.type) return false;
    if(d.type === "pain"){
      return FREE_PAINS.indexOf(d.label) !== -1; // 迷茫/焦虑/盲目跟风/拖延/过度在意他人看法 放行
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
    return false; // ability/theme 及其它：锁定（跳 intro）
  }

  function patchGrowthBrain(){
    // 1) 节点点击：非免费节点跳 /intro.html；免费节点放行（原逻辑打开详情）
    function bindNodes(){
      var nodes = document.querySelectorAll(".node");
      if(!nodes.length){ setTimeout(bindNodes, 300); return; }
      nodes.forEach(function(el){
        if(el.dataset.gbLocked) return;
        el.dataset.gbLocked = "1";
        el.addEventListener("click", function(ev){
          var d = el.__data__;
          if(!d || isFreeNode(d)) return; // 免费节点：不拦截
          if(ev.preventDefault) ev.preventDefault();
          if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          try { window.location.href = INTRO; } catch(err) {}
        }, true);
      });
    }
    bindNodes();
    // 2) 来源链接不可点（静默拦截，不跳 intro、不导航）
    document.addEventListener("click", function(ev){
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href*="knowledge-base/sources/html/"]') : null;
      if(a){
        if(ev.preventDefault) ev.preventDefault();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }
    }, true);
  }

  // 防御：分类标题展开时调用的全局 showProblem 可能被传入被锁项，拦截以免切到不可看的内容
  function patchShowProblem(){
    if(typeof window.showProblem !== "function") return;
    var original = window.showProblem;
    window.showProblem = function(id, noScroll, animate){
      if(id){
        var targetLink = document.querySelector('.side-nav a[data-target="' + id + '"]');
        if(targetLink && targetLink.classList.contains('problem-locked')) return;
      }
      return original.apply(this, arguments);
    };
  }

  // 思维陷阱页：三个子分类 tab 全部可切换（让用户看到有哪些卡片）。
  // 卡片本身的加锁交给 lockModelCards 处理：非「错误的思维方式」子类的卡片 → 锁。
  // 注意：历史曾有 patchTrapTabs 把 tab 本身锁住，导致用户看不到其他子分类的卡片列表——
  // 是错误的设计，已删除。
  function patchTrapTabs(){
    // 故意不锁 tab。tab 切换是浏览行为，不算「解锁」；锁卡片才是真正限制。
  }

  function run(){
    var steps = [lockModelCards, lockSideNav, lockGrowthRoad, patchGrowthBrain, patchShowProblem, patchTrapTabs];
    for(var i = 0; i < steps.length; i++){
      try { steps[i](); } catch(err) { /* 单步失败不阻断其它 */ }
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();