/* 免费传播站内容锁定：不修改页面结构，仅运行时加锁 */
(function(){
  "use strict";
  var FREE_MODELS = "jie-gou-hua-si-wei|di-yi-xing-yuan-li|bian-zheng-si-wei|luo-ji-si-wei|chou-xiang-si-wei|xi-tong-si-wei|pi-pan-xing-si-wei|ni-xiang-si-wei".split("|");
  var FREE_BOOKS  = "纳瓦尔宝典|富爸爸穷爸爸|人类简史|国富论|孙子兵法".split("|");
  var FREE_CATS   = "cat-1|cat-2".split("|");
  var PAIN_FIRST  = {"自我认知":"迷茫","情绪管理":"焦虑","思考与决策":"盲目跟风","做事与执行":"拖延","人际关系":"过度在意他人看法"};

  var LOCK_SVG = '<svg class="free-lock-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  function stop(e){
    if(!e) return false;
    if(e.preventDefault) e.preventDefault();
    if(e.stopPropagation) e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    return false;
  }

  function prefixLock(el){
    if(!el || el.dataset.freePrefixed) return;
    el.dataset.freePrefixed = "1";
    var tmp = document.createElement("span");
    tmp.innerHTML = LOCK_SVG;
    var svg = tmp.querySelector("svg");
    if(!svg) return;
    // 在 el 的第一个子节点前插入锁
    if(el.firstChild) el.insertBefore(svg, el.firstChild);
    else el.appendChild(svg);
    // 锁和文字之间留一点间距
    var space = document.createTextNode(" ");
    el.insertBefore(space, svg.nextSibling);
  }

  function lockLink(a){
    if(!a || a.dataset.freeLocked) return;
    a.dataset.freeLocked = "1";
    a.classList.add("free-locked");
    a.addEventListener("click", stop, true);
    a.style.pointerEvents = "none";
  }

  function lockModelCards(){
    document.querySelectorAll("a.model.done").forEach(function(a){
      var href = a.getAttribute("href") || "";
      var m = href.match(/models\/([a-z0-9-]+)\.html/);
      var slug = m ? m[1] : "";
      if(!slug) return;
      // 核心 8 个开放
      if(FREE_MODELS.indexOf(slug) !== -1) return;
      // 错误的思维方式子类全部开放
      var block = a.closest('[data-sub="错误的思维方式"]');
      if(block) return;
      // 其余：保留卡片全部样式，仅把右下角 CTA 区域换成锁图标
      lockLink(a);
      var cta = a.querySelector(".m-cta");
      if(cta){
        cta.innerHTML = LOCK_SVG;
        cta.classList.add("m-cta-locked");
      }
    });
  }

  function lockSideNav(){
    document.querySelectorAll(".side-nav ul li a").forEach(function(a){
      var href = a.getAttribute("href") || "";
      var m = href.match(/category\/cat-(\d+)\.html/);
      var cat = m ? "cat-" + m[1] : "";
      if(!cat || FREE_CATS.indexOf(cat) !== -1) return;
      lockLink(a);
      var span = a.querySelector("span");
      if(span) prefixLock(span);
    });
  }

  function lockBookCards(){
    var grid = document.getElementById("booksGrid");
    if(!grid) return;
    // 同样不用 :scope，直接遍历子节点，避免 Safari 兼容问题
    var cards = [];
    var kids = grid.children;
    for(var ki = 0; ki < kids.length; ki++){
      var k = kids[ki];
      if(k.classList && k.classList.contains("book-card")) cards.push(k);
    }
    var freeCards = [], otherCards = [];
    cards.forEach(function(c){
      var href = c.getAttribute("href") || "";
      var m = href.match(/books\/([^/]+)\.html/);
      var title = m ? decodeURIComponent(m[1]) : "";
      var idx = FREE_BOOKS.indexOf(title);
      if(idx !== -1) freeCards.push({idx: idx, el: c});
      else otherCards.push(c);
    });
    freeCards.sort(function(a,b){ return a.idx - b.idx; });
    // 重排 DOM：免费书在前
    freeCards.concat(otherCards).forEach(function(item){
      var c = item.el || item;
      grid.appendChild(c);
    });
    // 非免费书加锁：仅加 class，锁标由 CSS 右上角显示
    otherCards.forEach(function(c){
      lockLink(c);
      c.classList.add("book-locked");
    });
  }

  function lockGrowthRoad(){
    // 排序/加锁已由静态 patch 完成；这里只确保加锁链接真的点不动。
    // 静态 patch 会给锁定项加 class="problem-locked free-locked" 和 href="javascript:void(0)"，
    // 运行时再补 pointer-events:none + 捕获阶段拦截，双重保险。
    var locked = document.querySelectorAll(".side-nav-problems a.problem-locked");
    for(var i = 0; i < locked.length; i++){
      var a = locked[i];
      lockLink(a);
      a.setAttribute("href", "javascript:void(0)");
      a.addEventListener("click", function(e){
        if(e.preventDefault) e.preventDefault();
        if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      }, true);
    }
  }

  // 一级分类点击：不依赖页面内联脚本，用事件委托 + 捕获阶段绑定，最稳。
  // 行为：点哪个分类就展开哪个，收起其它，并打开/跳转到该分类下的第一项。
  function patchGroupTitleClick(){
    // 返回 {type:'show', id: 'p-xxx'} 或 {type:'nav', href: 'common-problems.html#p-xxx'}
    // 铁律：位置驱动。永远以 DOM 里的实际顺序为准，不能优先读 data-first-*
    // 属性——那是生成时的快照，顺序一调整就失效，会打开旧的固定项。
    function firstUnlocked(g, title){
      // 第一优先：DOM 里第一个未加锁的项（顺序怎么调都跟得上）
      var a = g.querySelector("ul li a:not(.problem-locked):not(.free-locked)");
      if(a){
        var href = a.getAttribute("href") || "";
        if(href.indexOf("common-problems.html#p-") !== -1) return {type:"nav", href:href};
        var dt = a.getAttribute("data-target");
        if(dt) return {type:"show", id:dt};
      }
      // 兜底：DOM 读不到时才退回属性快照
      var t = g.getAttribute("data-first-target") || title.getAttribute("data-first-target");
      if(t) return {type:"show", id:t};
      var h = g.getAttribute("data-first-href") || title.getAttribute("data-first-href");
      if(h) return {type:"nav", href:h};
      return null;
    }
    function showTarget(id){
      if(!id) return;
      if(typeof window.showProblem === "function"){
        window.showProblem(id, true);
        return;
      }
      // 兜底：内联脚本没跑起来时手动切
      var secs = document.querySelectorAll(".pain-section");
      for(var i = 0; i < secs.length; i++){
        secs[i].style.display = (secs[i].id === id ? "block" : "none");
      }
      var links = document.querySelectorAll(".side-nav a[data-target]");
      for(var j = 0; j < links.length; j++){
        var isOn = links[j].getAttribute("data-target") === id;
        if(isOn) links[j].classList.add("active");
        else links[j].classList.remove("active");
      }
    }
    document.addEventListener("click", function(e){
      var t = e.target;
      if(!t || !t.closest) return;
      if(t.closest("a")) return;
      var title = t.closest(".side-nav-problems .group-title");
      if(!title) return;
      var g = title.closest(".nav-group");
      if(!g) return;
      // 手风琴：只保留当前分类展开
      var all = document.querySelectorAll(".side-nav-problems .nav-group");
      for(var i = 0; i < all.length; i++){
        if(all[i] !== g) all[i].classList.add("collapsed");
      }
      g.classList.remove("collapsed");
      var action = firstUnlocked(g, title);
      if(!action) return;
      if(action.type === "show"){
        showTarget(action.id);
      } else if(action.type === "nav"){
        window.location.href = action.href;
      }
      if(e.stopPropagation) e.stopPropagation();
    }, true);
  }

  function patchGrowthBrain(){
    // 来源链接改 span（直接改 DOM 里的 href 即可实现不可点）
    document.querySelectorAll('.source a[href*="knowledge-base/sources/html/"]').forEach(function(a){
      var span = document.createElement("span");
      span.className = "free-source";
      span.textContent = a.textContent;
      a.parentNode.replaceChild(span, a);
    });
    // 覆盖全局函数
    if(typeof sourceUrl === "function"){
      window.sourceUrl = function(sid){ return "#"; };
    }
    if(typeof canJump === "function"){
      window.canJump = function(d){
        if(!d) return false;
        if(d.type === "pain") return false;
        if(d.type === "book"){
          var title = typeof normalizeBookTitle === "function" ? normalizeBookTitle(d.label) : d.label;
          return FREE_BOOKS.indexOf(title) !== -1;
        }
        if(d.type === "thinking"){
          var raw = d.slug || (d.id ? d.id.replace(/^thinking-/, "") : "");
          var slug = raw.replace(/\s+/g, "-").replace(/\.md$/i, "");
          return FREE_MODELS.indexOf(raw) !== -1 || FREE_MODELS.indexOf(slug) !== -1;
        }
        return false;
      };
    }
  }

  function patchBookListHeader(){
    document.querySelectorAll(".books-head p, .books-header p, .page-head p").forEach(function(p){
      if(/精选.*130.*好书/.test(p.textContent) && /已上线详情/.test(p.textContent)){
        p.innerHTML = '精选 <span class="books-stat">130</span> 本好书，点击书籍可查看详细内容。';
      }
    });
  }

  function patchShowProblem(){
    // 分类标题展开时调用的是全局 window.showProblem，拦截它防止切到被锁项
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

  function run(){
    // 每一步单独 try/catch：一个页面结构变化不会连累其它功能
    var steps = [
      lockModelCards, lockSideNav, lockBookCards,
      lockGrowthRoad, patchGrowthBrain, patchBookListHeader, patchShowProblem
    ];
    for(var i = 0; i < steps.length; i++){
      try { steps[i](); } catch(err) { /* 单步失败不阻断其它 */ }
    }
  }

  // 分类点击用事件委托，尽早绑定：不依赖 DOM 就绪，也不依赖页面内联脚本是否执行成功
  try { patchGroupTitleClick(); } catch(err) { /* noop */ }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
