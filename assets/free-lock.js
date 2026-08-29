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
    var cards = Array.from(grid.querySelectorAll(":scope > a.book-card, :scope > div.book-card"));
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
    // 每个分类分组只保留第一个问题可点，其余全部锁死（不 care 名称，只 care 索引）
    document.querySelectorAll(".side-nav-problems .nav-group").forEach(function(g){
      var ul = g.querySelector("ul");
      if(!ul) return;
      var links = Array.from(ul.querySelectorAll(":scope > li a[data-target]"));
      links.forEach(function(a, idx){
        if(idx === 0){
          a.classList.remove("problem-locked");
          a.classList.remove("free-locked");
          return;
        }
        lockLink(a);
        a.classList.add("problem-locked");
        a.setAttribute("href", "javascript:void(0)");
        // 锁标由 free-lock.css 伪元素统一渲染，这里不再插入 SVG
        // 捕获阶段阻止点击，防止原站局部 show 函数被触发
        a.addEventListener("click", function(e){
          e.preventDefault();
          e.stopImmediatePropagation();
        }, true);
      });
    });
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
    lockModelCards();
    lockSideNav();
    lockBookCards();
    lockGrowthRoad();
    patchGrowthBrain();
    patchBookListHeader();
    patchShowProblem();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
