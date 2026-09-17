/* ==========================================================================
   SKILLCONNECT — BARANGAY MAP
   ==========================================================================
   A dependency-free SVG map. It draws a stylised plan of the barangays in
   the service area (coastline, river, road network, barangay centres) and
   plots pins for workers, open requests and the signed-in resident.

   Nothing here touches the network, so the map works offline and inside a
   school LAN. Coordinates come from DB.BARANGAY_GEO / DB.MAP_BOUNDS, so
   swapping in real surveyed coordinates — or a real tile map later — only
   means changing this one file.

   Usage:
     SCMap.render(containerEl, {
       points: [{ id, lat, lng, label, sub, kind, state, initials }],
       onSelect: function (point) {},
       selectedId: "u_w1"
     });
   ========================================================================== */
(function (global) {
  "use strict";

  var VB_W = 1000;
  var VB_H = 620;

  function project(lat, lng) {
    var b = DB.MAP_BOUNDS;
    var x = ((lng - b.minLng) / (b.maxLng - b.minLng)) * VB_W;
    // latitude grows upward, y grows downward
    var y = (1 - (lat - b.minLat) / (b.maxLat - b.minLat)) * VB_H;
    return { x: x, y: y };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------------------------------------------------------- BASE */
  function baseLayers() {
    // Decorative geometry is authored directly in viewBox space.
    var sea =
      '<path class="scmap-sea" d="M1000,0 L1000,300 C930,282 880,250 840,205 C795,155 760,96 742,0 Z"/>' +
      '<path class="scmap-surf" d="M742,0 C760,96 795,155 840,205 C880,250 930,282 1000,300" fill="none"/>' +
      '<path class="scmap-surf scmap-surf-2" d="M716,0 C736,100 772,163 818,214 C860,260 918,294 986,314" fill="none"/>';

    var river =
      '<path class="scmap-river" d="M120,620 C200,520 236,470 262,398 C292,314 356,262 448,236 C540,210 596,168 640,96 C662,58 678,28 690,0"/>';

    var greens =
      '<ellipse class="scmap-green" cx="150" cy="150" rx="132" ry="96"/>' +
      '<ellipse class="scmap-green" cx="330" cy="560" rx="150" ry="86"/>' +
      '<ellipse class="scmap-green" cx="810" cy="512" rx="128" ry="82"/>' +
      '<ellipse class="scmap-green" cx="560" cy="330" rx="96" ry="62"/>';

    // Road network: a coastal highway plus barangay feeder roads.
    var roads =
      '<g class="scmap-roads">' +
        '<path class="scmap-road scmap-road-major" d="M40,520 C190,486 300,430 392,352 C486,272 566,196 664,140 C740,96 812,70 900,54"/>' +
        '<path class="scmap-road scmap-road-major" d="M96,232 C230,244 352,286 452,336 C560,390 664,430 796,438"/>' +
        '<path class="scmap-road" d="M392,352 C400,430 396,500 372,580"/>' +
        '<path class="scmap-road" d="M452,336 C520,300 566,254 596,196"/>' +
        '<path class="scmap-road" d="M664,140 C690,214 716,286 752,352"/>' +
        '<path class="scmap-road" d="M196,196 C214,280 226,362 214,462"/>' +
        '<path class="scmap-road" d="M796,438 C838,400 876,366 924,340"/>' +
        '<path class="scmap-road" d="M300,430 C368,466 452,492 548,500 C640,508 720,498 796,472"/>' +
      "</g>";

    var grid = '<g class="scmap-grid">';
    for (var gx = 100; gx < VB_W; gx += 100) grid += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + VB_H + '"/>';
    for (var gy = 100; gy < VB_H; gy += 100) grid += '<line x1="0" y1="' + gy + '" x2="' + VB_W + '" y2="' + gy + '"/>';
    grid += "</g>";

    return '<rect class="scmap-land" x="0" y="0" width="' + VB_W + '" height="' + VB_H + '"/>' + grid + greens + sea + river + roads;
  }

  function barangayLayer() {
    return '<g class="scmap-brgys">' + Object.keys(DB.BARANGAY_GEO).map(function (name) {
      var g = DB.BARANGAY_GEO[name];
      var p = project(g.lat, g.lng);
      return '<g class="scmap-brgy" transform="translate(' + p.x.toFixed(1) + "," + p.y.toFixed(1) + ')">' +
        '<circle class="scmap-brgy-halo" r="34"/>' +
        '<circle class="scmap-brgy-dot" r="4.5"/>' +
        '<text class="scmap-brgy-label" y="30">Brgy. ' + esc(name) + "</text>" +
        "</g>";
    }).join("") + "</g>";
  }

  /* ---------------------------------------------------------------- PINS */
  /* Two workers in the same street would otherwise draw on top of each
     other, so nudge overlapping pins apart in a small spiral. The nudge is
     cosmetic only — reported distances still use the true coordinates. */
  var MIN_GAP = 44;

  function layout(points) {
    var placed = [];
    return points.map(function (pt) {
      var p = project(pt.lat, pt.lng);
      var x = p.x, y = p.y;
      var step = 0;
      while (step < 60 && placed.some(function (q) {
        return Math.abs(q.x - x) < MIN_GAP && Math.abs(q.y - y) < MIN_GAP;
      })) {
        step += 1;
        var angle = step * 2.399963; // golden angle — spreads evenly
        var radius = MIN_GAP * 0.62 * Math.sqrt(step);
        x = p.x + Math.cos(angle) * radius;
        y = p.y + Math.sin(angle) * radius * 0.78;
      }
      x = Math.max(28, Math.min(VB_W - 28, x));
      y = Math.max(46, Math.min(VB_H - 22, y));
      placed.push({ x: x, y: y });
      pt._x = x;
      pt._y = y;
      return pt;
    });
  }

  function pinMarkup(pt, selected) {
    var p = { x: pt._x, y: pt._y };
    var cls = "scmap-pin scmap-pin-" + (pt.kind || "worker") + (pt.state ? " is-" + pt.state : "") + (selected ? " is-selected" : "");

    if (pt.kind === "me") {
      return '<g class="' + cls + '" transform="translate(' + p.x.toFixed(1) + "," + p.y.toFixed(1) + ')" data-pin="' + esc(pt.id) + '">' +
        '<circle class="scmap-me-pulse" r="26"/>' +
        '<circle class="scmap-me-ring" r="13"/>' +
        '<circle class="scmap-me-dot" r="6.5"/>' +
        '<text class="scmap-pin-label" y="-22">' + esc(pt.label || "You") + "</text>" +
        "</g>";
    }

    var body =
      '<path class="scmap-pin-body" d="M0,2 C-11,2 -19,-7 -19,-18 C-19,-29 -11,-37 0,-37 C11,-37 19,-29 19,-18 C19,-7 11,2 0,2 Z"/>' +
      '<path class="scmap-pin-tail" d="M0,10 L-6,-2 L6,-2 Z"/>' +
      '<text class="scmap-pin-initials" y="-14">' + esc(pt.initials || "") + "</text>";

    return '<g class="' + cls + '" transform="translate(' + p.x.toFixed(1) + "," + p.y.toFixed(1) + ')" data-pin="' + esc(pt.id) + '" tabindex="0" role="button" aria-label="' + esc(pt.label || "") + '">' +
      '<ellipse class="scmap-pin-shadow" cy="12" rx="10" ry="3.5"/>' + body +
      "</g>";
  }

  /* -------------------------------------------------------------- RENDER */
  function render(container, opts) {
    opts = opts || {};
    var points = layout((opts.points || []).filter(function (p) { return p && p.lat != null && p.lng != null; }));

    container.classList.add("scmap");
    container.innerHTML =
      '<div class="scmap-stage">' +
        '<svg class="scmap-svg" viewBox="0 0 ' + VB_W + " " + VB_H + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map of workers near you">' +
          '<g class="scmap-viewport">' + baseLayers() + barangayLayer() +
            '<g class="scmap-pins">' + points.map(function (p) { return pinMarkup(p, p.id === opts.selectedId); }).join("") + "</g>" +
          "</g>" +
        "</svg>" +
        '<div class="scmap-tooltip" hidden></div>' +
        '<div class="scmap-controls">' +
          '<button type="button" data-zoom="in" aria-label="Zoom in">+</button>' +
          '<button type="button" data-zoom="out" aria-label="Zoom out">−</button>' +
          '<button type="button" data-zoom="reset" aria-label="Reset view">⤢</button>' +
        "</div>" +
        '<div class="scmap-legend">' +
          '<span><i class="dot dot-me"></i>You</span>' +
          '<span><i class="dot dot-available"></i>Available</span>' +
          '<span><i class="dot dot-busy"></i>Busy</span>' +
          '<span><i class="dot dot-offline"></i>Offline</span>' +
          (opts.showRequestLegend ? '<span><i class="dot dot-request"></i>Open job</span>' : "") +
        "</div>" +
        '<div class="scmap-scale"><span class="bar"></span><span class="txt">approx. 1 km</span></div>' +
      "</div>";

    var svg = container.querySelector(".scmap-svg");
    var viewport = container.querySelector(".scmap-viewport");
    var tooltip = container.querySelector(".scmap-tooltip");

    /* ---- pan & zoom ---- */
    var view = { scale: 1, x: 0, y: 0 };

    function apply() {
      viewport.setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.scale + ")");
      viewport.style.setProperty("--scmap-zoom", view.scale);
    }

    function clamp() {
      var maxX = VB_W * (view.scale - 1);
      var maxY = VB_H * (view.scale - 1);
      view.x = Math.min(0, Math.max(-maxX, view.x));
      view.y = Math.min(0, Math.max(-maxY, view.y));
    }

    function zoomAt(factor, cx, cy) {
      var next = Math.min(4, Math.max(1, view.scale * factor));
      if (next === view.scale) return;
      var k = next / view.scale;
      view.x = cx - k * (cx - view.x);
      view.y = cy - k * (cy - view.y);
      view.scale = next;
      clamp();
      apply();
    }

    function svgPoint(evt) {
      var rect = svg.getBoundingClientRect();
      // preserveAspectRatio="slice" — work out the real drawn box
      var scale = Math.max(rect.width / VB_W, rect.height / VB_H);
      var drawnW = VB_W * scale;
      var drawnH = VB_H * scale;
      var offX = (rect.width - drawnW) / 2;
      var offY = (rect.height - drawnH) / 2;
      return {
        x: (evt.clientX - rect.left - offX) / scale,
        y: (evt.clientY - rect.top - offY) / scale
      };
    }

    container.querySelectorAll("[data-zoom]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-zoom");
        if (mode === "reset") { view = { scale: 1, x: 0, y: 0 }; apply(); return; }
        zoomAt(mode === "in" ? 1.45 : 1 / 1.45, VB_W / 2, VB_H / 2);
      });
    });

    svg.addEventListener("wheel", function (e) {
      e.preventDefault();
      var p = svgPoint(e);
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
    }, { passive: false });

    var drag = null;
    svg.addEventListener("pointerdown", function (e) {
      if (e.target.closest("[data-pin]")) return;
      drag = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
      svg.setPointerCapture(e.pointerId);
      svg.classList.add("is-dragging");
    });
    svg.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var rect = svg.getBoundingClientRect();
      var scale = Math.max(rect.width / VB_W, rect.height / VB_H);
      view.x = drag.ox + (e.clientX - drag.sx) / scale;
      view.y = drag.oy + (e.clientY - drag.sy) / scale;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
      clamp();
      apply();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (evt) {
      svg.addEventListener(evt, function () { drag = null; svg.classList.remove("is-dragging"); });
    });

    /* ---- pin interactions ---- */
    var byId = {};
    points.forEach(function (p) { byId[p.id] = p; });

    function showTip(el, pt) {
      if (!pt || pt.kind === "me") return;
      var rect = container.getBoundingClientRect();
      var pinRect = el.getBoundingClientRect();
      tooltip.innerHTML =
        '<b>' + esc(pt.label) + "</b>" +
        (pt.sub ? "<span>" + esc(pt.sub) + "</span>" : "") +
        (pt.distance != null ? '<span class="dist">' + pt.distance.toFixed(1) + " km away</span>" : "");
      tooltip.hidden = false;
      var left = pinRect.left - rect.left + pinRect.width / 2;
      var top = pinRect.top - rect.top;
      tooltip.style.left = Math.max(8, Math.min(rect.width - 8, left)) + "px";
      tooltip.style.top = Math.max(4, top - 10) + "px";
    }
    function hideTip() { tooltip.hidden = true; }

    container.querySelectorAll("[data-pin]").forEach(function (el) {
      var pt = byId[el.getAttribute("data-pin")];
      el.addEventListener("mouseenter", function () { showTip(el, pt); });
      el.addEventListener("mouseleave", hideTip);
      el.addEventListener("focus", function () { showTip(el, pt); });
      el.addEventListener("blur", hideTip);
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        if (drag && drag.moved) return;
        if (opts.onSelect) opts.onSelect(pt);
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (opts.onSelect) opts.onSelect(pt); }
      });
    });

    apply();

    return {
      select: function (id) {
        container.querySelectorAll("[data-pin]").forEach(function (el) {
          el.classList.toggle("is-selected", el.getAttribute("data-pin") === id);
        });
      },
      focusOn: function (id) {
        var pt = byId[id];
        if (!pt) return;
        var p = { x: pt._x, y: pt._y };
        view.scale = 2.2;
        view.x = VB_W / 2 - p.x * view.scale;
        view.y = VB_H / 2 - p.y * view.scale;
        clamp();
        apply();
      }
    };
  }

  global.SCMap = { render: render, project: project };
})(window);
