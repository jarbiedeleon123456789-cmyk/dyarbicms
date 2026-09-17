/* ==========================================================================
   SKILLCONNECT — SHARED UI HELPERS (used by customer.js / worker.js / admin.js)
   ========================================================================== */
(function (global) {
  "use strict";

  var ICONS = {
    feed: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4 10-10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l2.6 5.9 6.4.6-4.8 4.2 1.4 6.3-5.6-3.4-5.6 3.4 1.4-6.3-4.8-4.2 6.4-.6z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none"><path d="M22 12h-6l-2 3h-4l-2-3H2M5.4 5h13.2L22 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 8a2 2 0 0 1 2-2h2.2l1.2-2h7.2l1.2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12.5" r="3.5" stroke="currentColor" stroke-width="2"/></svg>',
    mapPin: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.6" stroke="currentColor" stroke-width="2"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9" r="5.5" stroke="currentColor" stroke-width="2"/><path d="m8.5 13.5-1.4 7 4.9-2.6 4.9 2.6-1.4-7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.8" stroke="currentColor" stroke-width="2"/><path d="m4 17 5-4.5 4 3.2 3-2.4 4 3.7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    brandMark: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.7 6.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4-1.4l7-7a1 1 0 0 1 1.4 0Z" fill="#E3A83A"/><path d="M18.5 3.5a4 4 0 0 0-5.4 5.4l-8.6 8.6a2 2 0 1 0 2.8 2.8l8.6-8.6a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.2-2.2 2.6-2.6a4 4 0 0 0-.6-.6Z" fill="#F5F1E6" fill-opacity=".9"/></svg>'
  };

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  }

  function timeAgo(iso) {
    var diff = Date.now() - new Date(iso).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    var days = Math.floor(hrs / 24);
    if (days < 30) return days + "d ago";
    return fmtDate(iso);
  }

  function toast(message) {
    var el = document.getElementById("scToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "scToast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.innerHTML = ICONS.bell + "<span>" + esc(message) + "</span>";
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("is-visible"); }, 2600);
  }

  var NAV_CONFIG = {
    customer: [
      { id: "feed", label: "My Requests", icon: "feed", page: "customer.html" },
      { id: "new", label: "New Request", icon: "plus", page: "customer.html" },
      { id: "directory", label: "Find a Worker", icon: "users", page: "customer.html" }
    ],
    worker: [
      { id: "jobfeed", label: "Job Feed", icon: "feed", page: "worker.html" },
      { id: "profile", label: "Availability & Profile", icon: "user", page: "worker.html" }
    ],
    admin: [
      { id: "overview", label: "Overview", icon: "grid", page: "admin.html" },
      { id: "requests", label: "Requests", icon: "inbox", page: "admin.html" },
      { id: "workers", label: "Workers", icon: "shield", page: "admin.html" },
      { id: "users", label: "Residents", icon: "users", page: "admin.html" }
    ]
  };

  function renderShell(user, opts) {
    // opts: { section: activeSectionId, title, subtitle }
    var role = user.role;
    var items = NAV_CONFIG[role];
    var navHtml = items.map(function (it) {
      var active = it.id === opts.section ? " is-active" : "";
      return '<a href="#" data-section="' + it.id + '" class="nav-item' + active + '">' + ICONS[it.icon] + "<span>" + it.label + "</span></a>";
    }).join("");

    var shellHtml =
      '<div class="app-shell">' +
        '<aside class="app-sidebar">' +
          '<a href="index.html" class="brand"><span class="brand-mark">' + ICONS.brandMark + '</span><span class="brand-name">Ayusan.PH</span></a>' +
          '<nav class="app-nav" id="appNav">' + navHtml + "</nav>" +
          '<div class="app-sidebar-foot">' +
            '<div class="sidebar-user"><div class="av">' + esc((user.initials || DB.initials(user.name))) + '</div>' +
              '<div class="who"><b>' + esc(user.name) + '</b><span>' + esc(role) + '</span></div></div>' +
            '<button class="logout-btn" id="logoutBtn">' + ICONS.logout + " Log out</button>" +
          "</div>" +
        "</aside>" +
        '<main class="app-main">' +
          '<div class="mobile-topbar">' +
            '<a href="index.html" class="brand" style="display:flex;align-items:center;gap:8px;"><span class="brand-mark" style="width:28px;height:28px;border-radius:8px;background:var(--amber-deep);display:grid;place-items:center;">' + ICONS.brandMark + '</span><span class="brand-name" style="font-family:var(--ff-display);font-weight:700;">Ayusan.PH</span></a>' +
            '<select id="mobileNavSelect">' + items.map(function (it) { return '<option value="' + it.id + '"' + (it.id === opts.section ? " selected" : "") + ">" + it.label + "</option>"; }).join("") + "</select>" +
          "</div>" +
          '<div class="app-topbar"><div><h1 id="topbarTitle">' + esc(opts.title || "") + '</h1><div class="sub" id="topbarSub">' + esc(opts.subtitle || "") + "</div></div>" +
            '<div class="badge ' + esc(role) + '" style="text-transform:capitalize;">' + esc(role) + " account</div>" +
          "</div>" +
          '<div class="app-content" id="appContent"></div>' +
        "</main>" +
      "</div>";

    document.body.innerHTML = shellHtml;

    document.getElementById("logoutBtn").addEventListener("click", function () { Auth.logout(); });
    var mobileSel = document.getElementById("mobileNavSelect");
    if (mobileSel) mobileSel.addEventListener("change", function () { global.dispatchEvent(new CustomEvent("sc:section", { detail: mobileSel.value })); });

    document.querySelectorAll("#appNav .nav-item").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        document.querySelectorAll("#appNav .nav-item").forEach(function (x) { x.classList.remove("is-active"); });
        a.classList.add("is-active");
        global.dispatchEvent(new CustomEvent("sc:section", { detail: a.getAttribute("data-section") }));
      });
    });
  }

  function setTopbar(title, subtitle) {
    var t = document.getElementById("topbarTitle");
    var s = document.getElementById("topbarSub");
    if (t) t.textContent = title;
    if (s) s.textContent = subtitle || "";
  }

  function content() { return document.getElementById("appContent"); }

  function starRow(rating) {
    return '<span style="display:inline-flex;align-items:center;gap:3px;color:var(--amber-deep);">' + ICONS.star + '</span><span style="font-size:12.5px;color:var(--ink-soft);margin-left:2px;">' + (rating ? rating.toFixed(1) : "—") + "</span>";
  }

  /* ======================================================================
     PHOTOS
     Images are stored as data-URLs inside localStorage, so every upload is
     downscaled and re-encoded first — a 4MB phone photo becomes ~60–120KB.
     ====================================================================== */
  var MAX_DIM = 900;
  var JPEG_QUALITY = 0.72;

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("Not an image"));
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Could not read the file")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("Could not decode the image")); };
        img.onload = function () {
          var scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function compressAll(fileList, limit) {
    var files = Array.prototype.slice.call(fileList || []).slice(0, limit || 4);
    return Promise.all(files.map(function (f) {
      return compressImage(f).catch(function () { return null; });
    })).then(function (list) { return list.filter(Boolean); });
  }

  /* A reusable "add photos" control.
     Returns { getPhotos(), setPhotos(), clear() } and keeps its own previews. */
  function photoPicker(host, opts) {
    opts = opts || {};
    var max = opts.max || 4;
    var photos = (opts.photos || []).slice();
    var inputId = "pp_" + Math.random().toString(36).slice(2, 8);

    function draw() {
      host.innerHTML =
        '<div class="photo-strip">' +
          photos.map(function (src, i) {
            return '<div class="photo-thumb"><img src="' + src + '" alt="Attached photo ' + (i + 1) + '">' +
              '<button type="button" class="photo-remove" data-remove="' + i + '" aria-label="Remove photo">' + ICONS.x + "</button></div>";
          }).join("") +
          (photos.length < max
            ? '<label class="photo-add" for="' + inputId + '">' + ICONS.camera +
              "<span>" + (photos.length ? "Add more" : (opts.label || "Add photos")) + "</span>" +
              '<input id="' + inputId + '" type="file" accept="image/*" multiple hidden></label>'
            : "") +
        "</div>" +
        '<div class="photo-hint">' + esc(opts.hint || ("Up to " + max + " photos — a clear shot of the damage helps workers quote faster.")) + "</div>";

      var input = host.querySelector("input[type=file]");
      if (input) {
        input.addEventListener("change", function () {
          var room = max - photos.length;
          host.classList.add("is-busy");
          compressAll(input.files, room).then(function (list) {
            host.classList.remove("is-busy");
            if (!list.length) { toast("That file could not be read as an image."); return; }
            photos = photos.concat(list).slice(0, max);
            draw();
            if (opts.onChange) opts.onChange(photos.slice());
          });
        });
      }
      host.querySelectorAll("[data-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          photos.splice(parseInt(btn.getAttribute("data-remove"), 10), 1);
          draw();
          if (opts.onChange) opts.onChange(photos.slice());
        });
      });
    }

    draw();

    return {
      getPhotos: function () { return photos.slice(); },
      setPhotos: function (list) { photos = (list || []).slice(0, max); draw(); },
      clear: function () { photos = []; draw(); }
    };
  }

  /* Read-only gallery of stored photos, with a click-to-enlarge lightbox. */
  function gallery(photos, opts) {
    opts = opts || {};
    if (!photos || !photos.length) return "";
    return '<div class="photo-strip is-readonly">' + photos.map(function (src, i) {
      return '<button type="button" class="photo-thumb" data-lightbox="' + esc(src) + '" aria-label="View photo ' + (i + 1) + '">' +
        '<img src="' + esc(src) + '" alt="' + esc(opts.alt || "Job photo") + '"></button>';
    }).join("") + "</div>";
  }

  // Wire every [data-lightbox] inside a root element.
  function bindLightbox(root) {
    (root || document).querySelectorAll("[data-lightbox]").forEach(function (el) {
      if (el._lb) return;
      el._lb = true;
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        lightbox(el.getAttribute("data-lightbox"), el.getAttribute("data-caption"));
      });
    });
  }

  function lightbox(src, caption) {
    var overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.innerHTML =
      '<button class="lightbox-close" aria-label="Close">' + ICONS.x + "</button>" +
      '<figure><img src="' + esc(src) + '" alt="">' + (caption ? "<figcaption>" + esc(caption) + "</figcaption>" : "") + "</figure>";
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("is-visible"); });
    function close() {
      overlay.classList.remove("is-visible");
      setTimeout(function () { overlay.remove(); }, 180);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    overlay.addEventListener("click", function (e) { if (e.target !== overlay.querySelector("img")) close(); });
    document.addEventListener("keydown", onKey);
  }

  function distanceLabel(km) {
    if (km == null) return "";
    if (km < 1) return Math.round(km * 1000) + " m away";
    return km.toFixed(1) + " km away";
  }

  global.UI = {
    ICONS: ICONS,
    esc: esc,
    fmtDate: fmtDate,
    timeAgo: timeAgo,
    toast: toast,
    renderShell: renderShell,
    setTopbar: setTopbar,
    content: content,
    starRow: starRow,
    compressImage: compressImage,
    compressAll: compressAll,
    photoPicker: photoPicker,
    gallery: gallery,
    bindLightbox: bindLightbox,
    lightbox: lightbox,
    distanceLabel: distanceLabel
  };
})(window);
