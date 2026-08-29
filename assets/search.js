/* 全站统一搜索逻辑：提交 / 跳转 / 排序 / 渲染 / 二级分类筛选 */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

  function showToast(msg) {
    var t = document.querySelector(".gtoast");
    if (!t) {
      t = document.createElement("div");
      t.className = "gtoast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  function tokenize(q) {
    return String(q).trim().split(/\s+/).filter(Boolean);
  }

  // 加权模糊检索：模型名称(100) > 简介/板块标题(40) > 痛点价值(20) > 正文案例(5)
  function rank(q, index) {
    var terms = tokenize(q);
    if (!terms.length) return [];
    var out = [];
    index.forEach(function (m) {
      var s = 0;
      var name = m.name || "";
      var intro = m.intro || "";
      var t = m.t || "";
      var mid = m.m || "";
      var body = m.b || "";
      terms.forEach(function (term) {
        if (name.indexOf(term) >= 0) s += 100;
        if (intro.indexOf(term) >= 0) s += 40;
        if (t.indexOf(term) >= 0) s += 40;
        if (mid.indexOf(term) >= 0) s += 20;
        if (body.indexOf(term) >= 0) s += 5;
        // 关联解决问题的主题标签：solves(解决XX问题) +80，tags(主题标签) +60
        var tl = term.toLowerCase();
        (m.tags || []).forEach(function (tag) {
          if (tag && tag.toLowerCase().indexOf(tl) >= 0) s += 60;
        });
        (m.solves || []).forEach(function (sol) {
          if (sol && sol.toLowerCase().indexOf(tl) >= 0) s += 80;
        });
      });
      if (s > 0) out.push({ m: m, s: s });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out.map(function (x) { return x.m; });
  }

  function cardHTML(m, prefix) {
    prefix = prefix || "";
    var intro = m.intro ? '<div class="m-val">' + escapeHtml(m.intro) + "</div>" : "";
    var cta = '<div class="m-foot"><span class="m-cta">查看详情' + ARROW + "</span></div>";
    var ref = "";
    if (location.pathname.indexOf("search.html") >= 0) {
      var q = new URLSearchParams(location.search).get("q") || "";
      ref = "?ref=search" + (q ? "&q=" + encodeURIComponent(q) : "");
    }
    if (m.file) {
      return '<a class="model done" href="' + prefix + "models/" + m.file + ref + '">' +
        '<div class="m-head"><span class="name">' + escapeHtml(m.name) + "</span></div>" +
        intro + cta + "</a>";
    }
    return '<div class="model pending" title="待制作"><span class="name">' +
      escapeHtml(m.name) + "</span>" + intro +
      '<div class="m-foot"><span class="m-cta">敬请期待' + ARROW + "</span></div>" + "</div>";
  }

  function renderResults(q, results, prefix) {
    var meta = document.getElementById("searchMeta");
    var box = document.getElementById("results");
    if (meta) meta.innerHTML = "搜索关键词：【" + escapeHtml(q) + "】 | 共找到 " + results.length + " 条相关模型";
    if (!box) return;
    if (!results.length) {
      box.innerHTML =
        '<div class="empty">未找到相关思维模型</div>' +
        '<div class="empty-sub">请更换关键词重新尝试，或先从 8 个核心模型开始浏览。</div>' +
        '<div class="grid core-grid">' + (window.CORE_HTML || "") + "</div>";
      return;
    }
    box.innerHTML = '<div class="grid">' + results.map(function (m) { return cardHTML(m, prefix); }).join("") + "</div>";
  }

  function doSearch(q, prefix) {
    q = (q || "").trim();
    if (!q) { showToast("请输入搜索关键词"); return; }
    var results = rank(q, window.INDEX || []);
    renderResults(q, results, prefix);
  }

  function submitSearch(q, searchPath) {
    q = (q || "").trim();
    if (!q) { showToast("请输入搜索关键词"); return; }
    searchPath = searchPath || "search.html";
    if (location.pathname.indexOf("search.html") >= 0) {
      history.replaceState(null, "", "search.html?q=" + encodeURIComponent(q));
      doSearch(q, "");
      window.scrollTo(0, 0);
    } else {
      location.href = searchPath + "?q=" + encodeURIComponent(q);
    }
  }

  function initCategoryFilter() {
    var chips = document.querySelectorAll(".chip[data-sub]");
    if (!chips.length) return;
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var sub = chip.getAttribute("data-sub");
        var willActive = !chip.classList.contains("active");
        chips.forEach(function (c) { c.classList.remove("active"); });
        if (willActive) chip.classList.add("active");
        document.querySelectorAll(".subblock[data-sub]").forEach(function (sb) {
          if (!willActive || sb.getAttribute("data-sub") === sub) {
            sb.style.display = "";
          } else {
            sb.style.display = "none";
          }
        });
      });
    });
  }

  function initBars() {
    document.querySelectorAll(".gsearch").forEach(function (bar) {
      var inp = bar.querySelector(".gsearch-input");
      var sp = bar.getAttribute("data-search");
      var clear = bar.querySelector(".gsearch-clear");
      function updateClear() {
        if (!clear) return;
        clear.classList.toggle("show", inp.value.trim().length > 0);
      }
      bar.querySelector(".gsearch-form").addEventListener("submit", function (e) {
        e.preventDefault(); submitSearch(inp.value, sp);
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submitSearch(inp.value, sp); }
      });
      inp.addEventListener("input", function () {
        updateClear();
        if (!inp.value.trim() && location.pathname.indexOf("search.html") >= 0) {
          // 清空搜索内容后回到搜索前的页面（用 location.href 避免 bfcache 残留）
          location.href = document.referrer || "all.html";
        }
      });
      if (clear) {
        clear.addEventListener("click", function () {
          inp.value = "";
          updateClear();
          if (location.pathname.indexOf("search.html") >= 0) {
            // 用 location.href 返回，避免 bfcache 保留旧关键词
            location.href = document.referrer || "all.html";
          } else {
            inp.focus();
          }
        });
      }
      updateClear();
    });
    if (location.pathname.indexOf("search.html") >= 0) {
      var params = new URLSearchParams(location.search);
      var q = params.get("q") || "";
      // 随机探索：从有详情页的模型里随机挑一个跳转
      if (params.get("r") === "1" && window.INDEX && window.INDEX.length) {
        var done = window.INDEX.filter(function (m) { return m.file; });
        if (done.length) {
          var pick = done[Math.floor(Math.random() * done.length)];
          location.replace("models/" + pick.file);
          return;
        }
      }
      document.querySelectorAll(".gsearch-input").forEach(function (i) { i.value = q; });
      // URL 回填关键词后，重新计算清空按钮显示状态
      document.querySelectorAll(".gsearch").forEach(function (bar) {
        var inp = bar.querySelector(".gsearch-input");
        var clear = bar.querySelector(".gsearch-clear");
        if (clear) clear.classList.toggle("show", inp.value.trim().length > 0);
      });
      doSearch(q, "");
    } else {
      // 非搜索页清空搜索框，避免从搜索页返回后残留旧关键词
      document.querySelectorAll(".gsearch-input").forEach(function (i) { i.value = ""; });
    }
    initCategoryFilter();

    // 从浏览器缓存（bfcache）恢复且非搜索页时，兜底清空残留关键词
    window.addEventListener("pageshow", function (e) {
      if (e.persisted && location.pathname.indexOf("search.html") < 0) {
        document.querySelectorAll(".gsearch-input").forEach(function (i) { i.value = ""; });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBars);
  } else {
    initBars();
  }
})();
