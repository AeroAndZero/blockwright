(function () {
  "use strict";

  // Guard: dependencies loaded?
  if (
    typeof marked === "undefined" ||
    typeof DOMPurify === "undefined" ||
    typeof Sortable === "undefined"
  ) {
    document.body.innerHTML =
      '<div class="load-fail">Couldn\'t load required libraries (Markdown / drag-and-drop).<br>Check your internet connection and reopen this file — it pulls three small scripts from a CDN on first load.</div>';
    return;
  }

  marked.setOptions({ breaks: true, gfm: true });

  var LS_LIB = "blockwright.library.v1";
  var LS_CANVAS = "blockwright.canvas.v1";
  var LS_SEEDED = "blockwright.seeded.v1";
  var LS_TITLE = "blockwright.title.v1";

  var storageOK = true;
  try {
    var t = "__bw__";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
  } catch (e) {
    storageOK = false;
  }

  // ---------- State ----------
  var library = load(LS_LIB, []); // [{id, title, md}]
  var canvas = load(LS_CANVAS, []); // [{iid, blockId}]
  var pageMargin = 16; // mm — page margin; intentionally NOT persisted

  function load(key, fallback) {
    if (!storageOK) return fallback;
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return Array.isArray(v) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function persist() {
    if (!storageOK) return;
    try {
      localStorage.setItem(LS_LIB, JSON.stringify(library));
      localStorage.setItem(LS_CANVAS, JSON.stringify(canvas));
    } catch (e) {
      toast("Storage is full — couldn't save.");
    }
  }
  function uid(p) {
    return (
      (p || "id") +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function renderMD(md) {
    return DOMPurify.sanitize(marked.parse(md || ""));
  }
  function plain(md) {
    var d = document.createElement("div");
    d.innerHTML = renderMD(md);
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }
  function findBlock(id) {
    return library.filter(function (b) {
      return b.id === id;
    })[0];
  }

  // ---------- Elements ----------
  var libList = document.getElementById("lib-list");
  var libHint = document.getElementById("lib-hint");
  var libCount = document.getElementById("lib-count");
  var pageInner = document.getElementById("page-inner");
  var page = document.getElementById("page");
  var pageCount = document.getElementById("pagecount");
  var pageTitle = document.getElementById("inTitle");

  // ---------- Seed first-run examples ----------
  if (storageOK && !localStorage.getItem(LS_SEEDED) && library.length === 0) {
    var seeds = [
      {
        title: "Header",
        md: "# Alex Morgan\nProduct Designer\n\nalex.morgan@email.com · +1 (555) 234-5678 · Austin, TX · [portfolio.alexmorgan.com](https://example.com)",
      },
      {
        title: "Summary",
        md: "## Summary\nProduct designer with 6+ years shipping consumer and B2B software. I turn ambiguous problems into simple, measurable interfaces — and I like to prototype before I argue.",
      },
      {
        title: "Experience",
        md: "## Experience\n\n**Senior Product Designer — Northwind** *(2021–Present)*\n- Led the redesign of the onboarding flow, lifting activation **31%**.\n- Built the team's first design system, now used across 4 product lines.\n\n**Product Designer — Fable Labs** *(2018–2021)*\n- Shipped the mobile app from 0→1 to 120k monthly users.\n- Ran weekly usability tests and cut support tickets by a quarter.",
      },
      {
        title: "Education",
        md: "## Education\n**B.S. Human–Computer Interaction** — University of Michigan *(2014–2018)*",
      },
      {
        title: "Skills",
        md: "## Skills\nFigma · Prototyping · Design systems · User research · HTML/CSS · Data-informed design",
      },
    ];
    seeds.forEach(function (s) {
      library.push({ id: uid("blk"), title: s.title, md: s.md });
    });
    localStorage.setItem(LS_SEEDED, "1");
    persist();
  }

  // ---------- Library rendering ----------
  var ICON = {
    handle:
      '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m1 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    drag: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    remove:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    align: {
      left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h13M3 12h18M3 18h11"/></svg>',
      center:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6h12M3 12h18M7 18h10"/></svg>',
      right:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M3 12h18M10 18h11"/></svg>',
    },
    lineheight:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7v10M2.5 8.5 4 7l1.5 1.5M2.5 15.5 4 17l1.5-1.5M9 6h12M9 12h12M9 18h12"/></svg>',
  };

  function renderLibrary() {
    libList.innerHTML = "";
    if (library.length === 0) {
      var e = document.createElement("div");
      e.className = "lib-empty";
      e.innerHTML =
        "<strong>No blocks yet</strong><span>Hit “Create new block”, write some Markdown, and it lands here ready to drag onto the page.</span>";
      libList.appendChild(e);
      libHint.style.display = "none";
    } else {
      libHint.style.display = "";
      library.forEach(function (b) {
        var el = document.createElement("div");
        el.className = "lib-block";
        el.dataset.blockId = b.id;
        el.innerHTML =
          '<span class="lib-handle" title="Drag to page">' +
          ICON.handle +
          "</span>" +
          '<div class="lib-title"></div>' +
          '<div class="lib-preview"></div>' +
          '<div class="lib-tools">' +
          '<button class="icon-btn" data-act="edit" title="Edit">' +
          ICON.edit +
          "</button>" +
          '<button class="icon-btn danger" data-act="del" title="Delete">' +
          ICON.del +
          "</button>" +
          "</div>";
        el.querySelector(".lib-title").textContent =
          b.title || "Untitled block";
        el.querySelector(".lib-preview").textContent =
          plain(b.md) || "Empty block";
        libList.appendChild(el);
      });
    }
    libCount.textContent = library.length ? "· " + library.length : "";
    updatePageCount();
  }

  // Library tool clicks
  libList.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-act]");
    if (!btn) return;
    var host = ev.target.closest(".lib-block");
    var id = host && host.dataset.blockId;
    if (!id) return;
    if (btn.dataset.act === "edit") {
      openModal(id);
      console.log(id);
    }
    if (btn.dataset.act === "del") deleteBlock(id);
  });

  function deleteBlock(id) {
    var b = findBlock(id);
    if (!b) return;
    if (
      !confirm(
        "Delete “" +
          (b.title || "Untitled block") +
          "”?\nAny copies already on the page will be removed too.",
      )
    )
      return;
    library = library.filter(function (x) {
      return x.id !== id;
    });
    canvas = canvas.filter(function (c) {
      return c.blockId !== id;
    });
    persist();
    renderLibrary();
    renderCanvas();
    toast("Block deleted.");
  }

  // ---------- Canvas rendering ----------
  var DEFAULT_LH = 1.15;
  function makeCanvasNode(blockId, iid, align, lh) {
    var b = findBlock(blockId);
    align = align === "center" || align === "right" ? align : "left";
    lh = parseFloat(lh);
    if (!(lh >= 1 && lh <= 2.2)) lh = DEFAULT_LH;
    var el = document.createElement("div");
    el.className = "canvas-block";
    el.dataset.blockId = blockId;
    el.dataset.iid = iid || uid("i");
    el.dataset.align = align;
    el.dataset.lh = lh;
    el.innerHTML =
      '<div class="cb-bar">' +
      '<span class="icon-btn cb-drag" title="Drag to reorder">' +
      ICON.drag +
      "</span>" +
      '<button class="icon-btn cb-edit" data-act="edit" title="Edit">' +
      ICON.edit +
      "</button>" +
      '<button class="icon-btn cb-align" title="Align: ' +
      align +
      ' (click to change)">' +
      ICON.align[align] +
      "</button>" +
      '<button class="icon-btn cb-lh" title="Line spacing">' +
      ICON.lineheight +
      "</button>" +
      '<button class="icon-btn danger cb-remove" title="Remove from page">' +
      ICON.remove +
      "</button>" +
      "</div>" +
      '<div class="cb-lh-pop">' +
      '<div class="lh-head"><b>Line spacing</b><span class="lh-val">' +
      lh.toFixed(2) +
      "</span></div>" +
      '<input type="range" class="lh-range" min="0.5" max="2.2" step="0.05" value="' +
      lh +
      '">' +
      '<button type="button" class="lh-reset">Reset to default</button>' +
      "</div>" +
      '<div class="cb-content doc align-' +
      align +
      '" style="line-height:' +
      lh +
      '"></div>';
    el.querySelector(".cb-content").innerHTML = b
      ? renderMD(b.md)
      : '<p style="color:#b4443a">Source block was deleted.</p>';
    return el;
  }

  function renderCanvas() {
    // wipe blocks (keep nothing else in inner)
    pageInner.innerHTML = "";
    if (canvas.length === 0) {
      var e = document.createElement("div");
      e.className = "canvas-empty";
      e.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>' +
        "<strong>Your A4 page is empty</strong>" +
        "<span>Drag blocks from the left onto this sheet. Rearrange them any time by dragging.</span>";
      pageInner.appendChild(e);
    } else {
      canvas.forEach(function (c) {
        pageInner.appendChild(makeCanvasNode(c.blockId, c.iid, c.align, c.lh));
      });
    }
    updatePageCount();
  }

  // read DOM order back into state
  function syncCanvasFromDOM() {
    canvas = [];
    pageInner.querySelectorAll(".canvas-block").forEach(function (el) {
      canvas.push({
        iid: el.dataset.iid,
        blockId: el.dataset.blockId,
        align: el.dataset.align || "left",
        lh: parseFloat(el.dataset.lh) || DEFAULT_LH,
      });
    });
    // toggle empty placeholder
    if (canvas.length === 0 && !pageInner.querySelector(".canvas-empty"))
      renderCanvas();
    persist();
    updatePageCount();
  }

  function updatePageCount() {
    // usable height = A4 height (297mm) minus top+bottom margin
    var contentPx = (297 - 2 * pageMargin) * 3.7795; // mm -> px @96dpi
    var h = pageInner.scrollHeight;
    var pages = Math.max(1, Math.ceil(h / contentPx));
    pageCount.textContent = canvas.length
      ? pages + (pages > 1 ? " pages" : " page")
      : "";
  }

  // ---------- Canvas block controls (remove / align / line spacing) ----------
  var ALIGN_ORDER = ["left", "center", "right"];

  function closeAllPopovers() {
    pageInner.querySelectorAll(".cb-lh-pop.open").forEach(function (p) {
      p.classList.remove("open");
    });
    pageInner.querySelectorAll(".canvas-block.pop-open").forEach(function (b) {
      b.classList.remove("pop-open");
    });
  }
  function applyLH(node, val, persist) {
    val = Math.min(2.2, Math.max(0.5, Math.round(val * 20) / 20)); // snap to .05, clamp
    node.dataset.lh = val;
    node.querySelector(".cb-content").style.lineHeight = val;
    var lab = node.querySelector(".lh-val");
    if (lab) lab.textContent = val.toFixed(2);
    var rng = node.querySelector(".lh-range");
    if (rng && parseFloat(rng.value) !== val) rng.value = val;
    if (persist) syncCanvasFromDOM();
  }

  pageInner.addEventListener("click", function (ev) {
    var node = ev.target.closest(".canvas-block");
    if (!node) return;

    if (ev.target.closest(".lh-reset")) {
      applyLH(node, DEFAULT_LH, true);
      return;
    }
    if (ev.target.closest(".cb-lh-pop")) return; // clicks inside the slider popover

    if (ev.target.closest(".cb-remove")) {
      node.remove();
      syncCanvasFromDOM();
      if (canvas.length === 0) renderCanvas();
      return;
    }

    if(ev.target.closest(".cb-edit")){
      openModal(node.dataset.blockId);
    }

    var alignBtn = ev.target.closest(".cb-align");
    if (alignBtn) {
      var cur = node.dataset.align || "left";
      var next =
        ALIGN_ORDER[(ALIGN_ORDER.indexOf(cur) + 1) % ALIGN_ORDER.length];
      node.dataset.align = next;
      var content = node.querySelector(".cb-content");
      content.classList.remove("align-left", "align-center", "align-right");
      content.classList.add("align-" + next);
      alignBtn.innerHTML = ICON.align[next];
      alignBtn.title = "Align: " + next + " (click to change)";
      syncCanvasFromDOM();
      return;
    }

    var lhBtn = ev.target.closest(".cb-lh");
    if (lhBtn) {
      ev.stopPropagation();
      var pop = node.querySelector(".cb-lh-pop");
      var wasOpen = pop.classList.contains("open");
      closeAllPopovers();
      if (!wasOpen) {
        pop.classList.add("open");
        node.classList.add("pop-open");
      }
      return;
    }
  });

  // live slider drag (update as you move) + persist on release
  pageInner.addEventListener("input", function (ev) {
    var rng = ev.target.closest(".lh-range");
    if (!rng) return;
    applyLH(ev.target.closest(".canvas-block"), parseFloat(rng.value), false);
  });
  pageInner.addEventListener("change", function (ev) {
    if (ev.target.closest(".lh-range")) syncCanvasFromDOM();
  });

  // dismiss the spacing popover
  document.addEventListener("click", function (ev) {
    if (ev.target.closest(".cb-lh") || ev.target.closest(".cb-lh-pop")) return;
    closeAllPopovers();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeAllPopovers();
  });

  // ---------- Drag & drop ----------
  new Sortable(libList, {
    group: { name: "blocks", pull: "clone", put: false },
    sort: false,
    animation: 150,
    handle: ".lib-handle",
    draggable: ".lib-block",
    ghostClass: "sortable-ghost",
  });

  new Sortable(pageInner, {
    group: { name: "blocks", pull: false, put: true },
    animation: 150,
    draggable: ".canvas-block",
    handle: ".cb-drag",
    filter: ".canvas-empty",
    ghostClass: "sortable-ghost",
    onAdd: function (evt) {
      var clone = evt.item; // a cloned .lib-block
      var blockId = clone.dataset.blockId;
      var node = makeCanvasNode(blockId);
      var placeholder = pageInner.querySelector(".canvas-empty");
      if (placeholder) placeholder.remove();
      pageInner.insertBefore(node, clone);
      clone.remove();
      syncCanvasFromDOM();
    },
    onUpdate: syncCanvasFromDOM,
    onSort: function () {
      /* covered by add/update */
    },
  });

  // Drop highlight on the sheet
  ["dragenter", "dragover"].forEach(function (t) {
    page.addEventListener(t, function () {
      page.classList.add("drop-hot");
    });
  });
  ["dragleave", "drop"].forEach(function (t) {
    page.addEventListener(t, function (e) {
      if (t === "dragleave" && page.contains(e.relatedTarget)) return;
      page.classList.remove("drop-hot");
    });
  });

  // ---------- Modal (create / edit) ----------
  var overlay = document.getElementById("overlay");
  var titleEl = document.getElementById("block-title");
  var mdInput = document.getElementById("md-input");
  var mdPreview = document.getElementById("md-preview");
  var modalTitle = document.getElementById("modal-title");
  var editingId = null;

  var SAMPLE =
    "## Experience\n\n**Senior Engineer — Acme Corp** *(2022–Present)*\n- Cut API latency 40% by rewriting the caching layer.\n- Mentored 3 engineers; led migration to TypeScript.\n\n**Engineer — Globex** *(2019–2022)*\n- Shipped the billing service handling $2M/mo.";

  function openModal(id) {
    editingId = id || null;
    if (editingId) {
      var b = findBlock(editingId);
      modalTitle.textContent = "Edit block";
      titleEl.value = b ? b.title : "";
      mdInput.value = b ? b.md : "";
    } else {
      modalTitle.textContent = "New block";
      titleEl.value = "";
      mdInput.value = "";
    }
    updatePreview();
    overlay.classList.add("open");
    setTimeout(function () {
      titleEl.focus();
    }, 20);
  }
  function closeModal() {
    overlay.classList.remove("open");
    editingId = null;
  }

  function updatePreview() {
    var html = renderMD(mdInput.value);
    mdPreview.innerHTML =
      html ||
      '<p style="color:#8a92a0;font-family:var(--ui)">Nothing to preview yet.</p>';
  }

  function saveBlock() {
    var title = titleEl.value.trim();
    var md = mdInput.value;
    if (!title) {
      toast("Give the block a title first.");
      titleEl.focus();
      return;
    }
    // if (!md.trim()) {
    //   toast("Write some Markdown before saving.");
    //   mdInput.focus();
    //   return;
    // }
    if (editingId) {
      var b = findBlock(editingId);
      if (b) {
        b.title = title;
        b.md = md;
      }
      // refresh any copies on the page
      pageInner
        .querySelectorAll(
          '.canvas-block[data-block-id="' + editingId + '"] .cb-content',
        )
        .forEach(function (c) {
          c.innerHTML = renderMD(md);
        });
      toast("Block updated.");
    } else {
      library.push({ id: uid("blk"), title: title, md: md });
      toast("Block added to your library.");
    }
    persist();
    renderLibrary();
    updatePageCount();
    closeModal();
  }

  document
    .getElementById("new-block-btn")
    .addEventListener("click", function () {
      openModal(null);
    });
  document.getElementById("save-btn").addEventListener("click", saveBlock);
  document.getElementById("cancel-btn").addEventListener("click", closeModal);
  document.getElementById("empty-character").addEventListener("click", function () {
    mdInput.value = mdInput.value.slice(0, mdInput.selectionStart) 
                    + "\n&ZeroWidthSpace; " 
                    + mdInput.value.slice(mdInput.selectionEnd, mdInput.value.length);
    updatePreview();
    mdInput.focus();
  });
  document.getElementById("sample-link").addEventListener("click", function () {
    if (!mdInput.value.trim()) {
      mdInput.value = SAMPLE;
    } else {
      mdInput.value += "\n\n" + SAMPLE;
    }
    updatePreview();
    mdInput.focus();
  });
  mdInput.addEventListener("input", updatePreview);
  overlay.addEventListener("mousedown", function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
    if (
      (e.metaKey || e.ctrlKey) &&
      e.key === "Enter" &&
      overlay.classList.contains("open")
    )
      saveBlock();
  });

  // ---------- Page tools ----------
  document
    .getElementById("clear-page-btn")
    .addEventListener("click", function () {
      if (canvas.length === 0) {
        toast("The page is already empty.");
        return;
      }
      if (
        !confirm(
          "Remove all blocks from the page? Your saved blocks stay in the library.",
        )
      )
        return;
      canvas = [];
      persist();
      renderCanvas();
      toast("Page cleared.");
    });

  var exportedOnce = false;
  document.getElementById("export-btn").addEventListener("click", function () {
    if (canvas.length === 0) {
      toast("Add at least one block to the page first.");
      return;
    }
    if (!exportedOnce) {
      exportedOnce = true;
      toast("In the print dialog, choose “Save as PDF”. Opening it now…");
      setTimeout(function () {
        window.print();
      }, 1100);
    } else {
      window.print();
    }
  });

  // ---------- Page margin (not persisted) ----------
  var marginRange = document.getElementById("marginRange");
  var marginVal = document.getElementById("marginVal");
  function applyMargin(mm) {
    pageMargin = mm;
    page.style.setProperty("--page-pad", mm + "mm");
    marginVal.textContent = mm + " mm";
    updatePageCount();
  }
  marginRange.addEventListener("input", function () {
    applyMargin(parseInt(marginRange.value, 10) || 16);
  });
  applyMargin(parseInt(marginRange.value, 10) || 16); // initialise from default

  // Change title
  pageTitle.addEventListener("change", ()=>{
    updateTitle(pageTitle.value);
  })

  function updateTitle(value){
    document.title = value;
    localStorage.setItem(LS_TITLE, value);
    pageTitle.value = value;
  }

  function getTitle(){
    let title = localStorage.getItem(LS_TITLE);
    if(title == null){
      title = "Blockwright - resume builder";
    }
    updateTitle(title);
  }

  // ---------- Toast ----------
  var toastEl = document.getElementById("toast"),
    toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2600);
  }

  // ---------- Boot ----------
  renderLibrary();
  renderCanvas();
  getTitle();
  if (!storageOK)
    toast("Private-mode browser: blocks won't be saved between sessions.");
})();
