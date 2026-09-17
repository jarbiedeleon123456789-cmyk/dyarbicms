(function () {
  "use strict";

  var user = Auth.requireRole("customer");
  if (!user) return;

  UI.renderShell(user, { section: "feed", title: "My Requests", subtitle: "Everything you've submitted to the barangay directory." });

  var directoryFilter = "All";
  var directorySort = "nearest";
  var selectedWorkerId = null;
  var mapApi = null;

  var me = DB.coordsOf(user);

  window.addEventListener("sc:section", function (e) { switchNav(e.detail); });
  go("feed");

  function go(section) {
    if (section === "feed") { UI.setTopbar("My Requests", "Everything you've submitted to the barangay directory."); renderFeed(); }
    if (section === "new") { UI.setTopbar("Submit a Request", "Describe the job, attach photos — a matching verified worker will pick it up."); renderNewForm(); }
    if (section === "directory") { UI.setTopbar("Find a Worker", "See verified workers on the map and request the nearest one."); renderDirectory(); }
  }

  function switchNav(id) {
    document.querySelectorAll("#appNav .nav-item").forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-section") === id);
    });
    go(id);
  }

  function statusMeta(status) {
    return { pending: "Waiting for a worker", accepted: "Worker assigned", working: "Job in progress", completed: "Job completed", cancelled: "Cancelled" }[status] || status;
  }

  /* ====================================================================
     MY REQUESTS
     ==================================================================== */
  function reqCard(r) {
    var actions = "";
    if (r.status === "pending") actions += '<button class="pill-btn danger" data-cancel="' + r.id + '">Cancel</button>';
    if (r.status === "completed" && !r.rating) actions += '<button class="pill-btn primary" data-rate="' + r.id + '">Rate worker</button>';
    if (r.status === "completed" && r.rating) actions += '<span style="font-size:12.5px;color:var(--ink-soft);">You rated ' + r.rating + "/5</span>";

    var photos = r.photos && r.photos.length
      ? UI.gallery(r.photos, { alt: "Photo attached to " + r.ticketId })
      : "";

    return (
      '<article class="req-card">' +
        '<div class="req-top">' +
          '<div><span class="req-id">' + r.ticketId + "</span></div>" +
          '<span class="badge ' + r.status + '">' + r.status + "</span>" +
        "</div>" +
        '<div><span class="req-skill">' + UI.esc(r.skillNeeded) + "</span>" +
          (r.photos && r.photos.length ? '<span class="chip-count">' + UI.ICONS.image + r.photos.length + "</span>" : "") +
        "</div>" +
        '<p class="req-desc">' + UI.esc(r.description) + "</p>" +
        photos +
        '<div class="req-meta">' + statusMeta(r.status) + (r.workerName ? " · <b>" + UI.esc(r.workerName) + "</b>" : "") + " · Preferred " + UI.fmtDate(r.preferredDate) + "</div>" +
        '<div class="req-foot"><span class="req-people">Submitted ' + UI.timeAgo(r.createdAt) + '</span><div class="req-actions">' + actions + "</div></div>" +
      "</article>"
    );
  }

  function renderFeed() {
    var list = DB.getRequestsByCustomer(user.id);
    var open = list.filter(function (r) { return r.status !== "completed" && r.status !== "cancelled"; });

    var html = '<div class="section-toolbar"><div class="tabs">' +
      '<span class="tab-btn is-active">All <span class="count">' + list.length + "</span></span>" +
      '<span class="tab-btn">Open <span class="count">' + open.length + "</span></span></div>" +
      '<a href="#" data-section="new" class="btn btn-primary" style="height:42px;">' + UI.ICONS.plus + " New request</a></div>";

    if (!list.length) {
      html += '<div class="panel"><div class="empty-state">' + UI.ICONS.inbox + "<h4>No requests yet</h4><p>Submit your first repair request and it will show up here with live status updates.</p></div></div>";
    } else {
      html += '<div class="req-list">' + list.map(reqCard).join("") + "</div>";
    }
    UI.content().innerHTML = html;
    UI.bindLightbox(UI.content());

    UI.content().querySelectorAll("[data-section]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); switchNav("new"); });
    });
    UI.content().querySelectorAll("[data-cancel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        DB.updateRequest(btn.getAttribute("data-cancel"), { status: "cancelled" });
        UI.toast("Request cancelled.");
        renderFeed();
      });
    });
    UI.content().querySelectorAll("[data-rate]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var val = window.prompt("Rate this worker from 1 to 5:", "5");
        var n = parseInt(val, 10);
        if (!n || n < 1 || n > 5) return;
        var req = DB.updateRequest(btn.getAttribute("data-rate"), { rating: n });
        if (req && req.workerId) {
          var w = DB.getUserById(req.workerId);
          if (w) {
            var jobs = w.jobs || 0;
            DB.updateUser(w.id, { rating: ((w.rating || 0) * jobs + n) / (jobs + 1) });
          }
        }
        UI.toast("Thanks for rating!");
        renderFeed();
      });
    });
  }

  /* ====================================================================
     NEW REQUEST (with photo attachments)
     ==================================================================== */
  function renderNewForm() {
    var options = DB.SKILL_CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + "</option>"; }).join("");
    var barangays = DB.BARANGAYS.map(function (b) { return '<option value="' + b + '"' + (b === user.barangay ? " selected" : "") + ">" + b + "</option>"; }).join("");

    UI.content().innerHTML =
      '<div class="panel" style="max-width:680px;"><div class="panel-body">' +
        '<form id="reqForm" class="form-grid">' +
          '<div class="field full"><label>Skill needed</label><select name="skillNeeded" required>' + options + "</select></div>" +
          '<div class="field full"><label>Describe the problem</label><textarea name="description" required placeholder="e.g. Aircon not cooling, breaker trips when turned on"></textarea></div>' +
          '<div class="field full"><label>Photos of the problem <span class="label-opt">optional, but recommended</span></label>' +
            '<div id="reqPhotos" class="photo-picker"></div></div>' +
          '<div class="field"><label>Barangay</label><select name="barangay">' + barangays + "</select></div>" +
          '<div class="field"><label>Preferred date</label><input type="date" name="preferredDate" required></div>' +
          '<div class="field full"><label>Contact number</label><input type="tel" name="contactNumber" value="' + UI.esc(user.phone || "") + '" required></div>' +
          '<div class="field full"><button class="btn btn-primary btn-block" type="submit">Submit request</button></div>' +
        "</form>" +
      "</div></div>";

    var picker = UI.photoPicker(document.getElementById("reqPhotos"), {
      max: 4,
      label: "Add photos",
      hint: "Up to 4 photos. Show the whole unit, a close-up of the damage, and the model sticker if there is one."
    });

    document.getElementById("reqForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      data.customerId = user.id;
      data.customerName = user.name;
      data.photos = picker.getPhotos();
      var g = DB.BARANGAY_GEO[data.barangay];
      if (g) {
        data.lat = +(g.lat + (Math.random() - 0.5) * 0.003).toFixed(5);
        data.lng = +(g.lng + (Math.random() - 0.5) * 0.003).toFixed(5);
      }
      DB.createRequest(data);
      UI.toast("Request submitted! A matching worker will pick it up.");
      switchNav("feed");
    });
  }

  /* ====================================================================
     FIND A WORKER — map + directory
     ==================================================================== */
  function visibleWorkers() {
    var list = DB.getWorkers().filter(function (w) {
      return directoryFilter === "All" || w.skillCategory === directoryFilter;
    }).map(function (w) {
      var d = DB.distanceKm(me, DB.coordsOf(w));
      w._dist = d;
      return w;
    });

    var rank = { available: 0, busy: 1, offline: 2 };
    list.sort(function (a, b) {
      if (directorySort === "rating") return (b.rating || 0) - (a.rating || 0);
      if (directorySort === "jobs") return (b.jobs || 0) - (a.jobs || 0);
      if (rank[a.availability] !== rank[b.availability]) return rank[a.availability] - rank[b.availability];
      return (a._dist == null ? 999 : a._dist) - (b._dist == null ? 999 : b._dist);
    });
    return list;
  }

  function mapPoints(list) {
    var pts = list.map(function (w) {
      return {
        id: w.id,
        lat: DB.coordsOf(w).lat,
        lng: DB.coordsOf(w).lng,
        label: w.name,
        sub: w.skillCategory + " · " + (w.verified ? "Verified" : "Unverified") + " · " + w.availability,
        distance: w._dist,
        initials: DB.initials(w.name),
        kind: "worker",
        state: w.availability
      };
    });
    if (me) pts.push({ id: "me", lat: me.lat, lng: me.lng, label: "You (Brgy. " + user.barangay + ")", kind: "me" });
    return pts;
  }

  function workerCard(w) {
    return (
      '<article class="req-card worker-card' + (w.id === selectedWorkerId ? " is-selected" : "") + '" data-worker-card="' + w.id + '">' +
        '<div class="req-top">' +
          '<div style="display:flex;align-items:center;gap:10px;"><div class="mini-avatar">' + UI.esc(DB.initials(w.name)) + "</div>" +
          '<div><div style="font-weight:700;font-size:14.5px;">' + UI.esc(w.name) + "</div>" +
          '<div style="font-size:12.5px;color:var(--ink-soft);">Brgy. ' + UI.esc(w.barangay) +
            (w._dist != null ? ' · <span class="dist-tag">' + UI.distanceLabel(w._dist) + "</span>" : "") + "</div></div></div>" +
          '<span class="badge ' + (w.verified ? "verified" : "unverified") + '">' + (w.verified ? "Verified" : "Pending") + "</span>" +
        "</div>" +
        '<div><span class="req-skill">' + UI.esc(w.skillCategory) + "</span> " +
          '<span class="badge ' + w.availability + '" style="margin-left:6px;">' + w.availability + "</span>" +
          ((w.certificates || []).length ? '<span class="chip-count" title="Certificates">' + UI.ICONS.award + (w.certificates || []).length + "</span>" : "") +
          ((w.works || []).length ? '<span class="chip-count" title="Past work photos">' + UI.ICONS.image + (w.works || []).length + "</span>" : "") +
        "</div>" +
        '<p class="req-desc">' + UI.esc(w.bio || "") + "</p>" +
        ((w.works || []).length ? UI.gallery((w.works || []).slice(0, 3).map(function (p) { return p.image; }), { alt: "Past work" }) : "") +
        '<div class="req-foot">' + UI.starRow(w.rating) + '<span style="font-size:12px;color:var(--ink-soft);">(' + (w.jobs || 0) + " jobs)</span>" +
          '<div class="req-actions" style="margin-left:auto;">' +
            '<button class="pill-btn" data-profile="' + w.id + '">View profile</button>' +
            '<button class="btn btn-primary" style="height:36px;padding:0 14px;font-size:13px;" data-request-worker="' + w.id + '">Request</button>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderDirectory() {
    var chips = ["All"].concat(DB.SKILL_CATEGORIES).map(function (c) {
      return '<button class="filter-chip' + (c === directoryFilter ? " is-active" : "") + '" data-cat="' + c + '">' + c + "</button>";
    }).join("");

    var list = visibleWorkers();
    var availableCount = list.filter(function (w) { return w.availability === "available"; }).length;
    var nearest = list.filter(function (w) { return w._dist != null; })[0];

    UI.content().innerHTML =
      '<div class="panel map-panel"><div class="panel-head">' +
        "<div><h3>" + UI.ICONS.mapPin + " Workers near you</h3>" +
        '<div class="sub">' + list.length + " worker" + (list.length === 1 ? "" : "s") + " in view · " + availableCount + " available now" +
        (nearest ? " · nearest is <b>" + UI.esc(nearest.name) + "</b> at " + UI.distanceLabel(nearest._dist) : "") + "</div></div>" +
        '<div class="map-sort"><label>Sort</label><select id="dirSort">' +
          '<option value="nearest"' + (directorySort === "nearest" ? " selected" : "") + ">Nearest &amp; available</option>" +
          '<option value="rating"' + (directorySort === "rating" ? " selected" : "") + ">Highest rated</option>" +
          '<option value="jobs"' + (directorySort === "jobs" ? " selected" : "") + ">Most jobs done</option>" +
        "</select></div>" +
      "</div>" +
      '<div id="workerMap" class="map-holder"></div>' +
      "</div>" +
      '<div class="filter-row" style="margin:20px 0;">' + chips + "</div>" +
      (list.length ? '<div class="mini-ticket-grid">' + list.map(workerCard).join("") + "</div>"
        : '<div class="panel"><div class="empty-state">' + UI.ICONS.users + "<h4>No workers in this category yet</h4><p>Try another skill category, or check back once staff verifies more workers.</p></div></div>");

    mapApi = SCMap.render(document.getElementById("workerMap"), {
      points: mapPoints(list),
      selectedId: selectedWorkerId,
      onSelect: function (pt) {
        if (!pt || pt.kind === "me") return;
        selectedWorkerId = pt.id;
        mapApi.select(pt.id);
        highlightCard(pt.id);
      }
    });

    UI.bindLightbox(UI.content());

    document.getElementById("dirSort").addEventListener("change", function (e) {
      directorySort = e.target.value;
      renderDirectory();
    });
    UI.content().querySelectorAll("[data-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        directoryFilter = btn.getAttribute("data-cat");
        selectedWorkerId = null;
        renderDirectory();
      });
    });
    UI.content().querySelectorAll("[data-request-worker]").forEach(function (btn) {
      btn.addEventListener("click", function (e) { e.stopPropagation(); openRequestModal(btn.getAttribute("data-request-worker")); });
    });
    UI.content().querySelectorAll("[data-profile]").forEach(function (btn) {
      btn.addEventListener("click", function (e) { e.stopPropagation(); openWorkerProfile(btn.getAttribute("data-profile")); });
    });
    UI.content().querySelectorAll("[data-worker-card]").forEach(function (card) {
      card.addEventListener("click", function () {
        var id = card.getAttribute("data-worker-card");
        selectedWorkerId = id;
        if (mapApi) { mapApi.select(id); mapApi.focusOn(id); }
        highlightCard(id);
      });
    });
  }

  function highlightCard(id) {
    UI.content().querySelectorAll("[data-worker-card]").forEach(function (c) {
      c.classList.toggle("is-selected", c.getAttribute("data-worker-card") === id);
    });
    var el = UI.content().querySelector('[data-worker-card="' + id + '"]');
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------------------------- worker profile ---------------------------- */
  function openWorkerProfile(workerId) {
    var w = DB.getUserById(workerId);
    if (!w) return;
    var dist = DB.distanceKm(me, DB.coordsOf(w));
    var rate = DB.RATE_CARD[w.skillCategory];

    var certs = (w.certificates || []).length
      ? '<ul class="cert-list">' + w.certificates.map(function (c) {
          return "<li>" + (c.image
              ? '<button type="button" class="cert-thumb" data-lightbox="' + UI.esc(c.image) + '" data-caption="' + UI.esc(c.title) + '"><img src="' + UI.esc(c.image) + '" alt=""></button>'
              : '<span class="cert-thumb is-blank">' + UI.ICONS.award + "</span>") +
            '<span class="cert-txt"><b>' + UI.esc(c.title) + "</b><em>" + UI.esc([c.issuer, c.year].filter(Boolean).join(" · ")) + "</em></span></li>";
        }).join("") + "</ul>"
      : '<p class="muted-note">No certificates uploaded yet.</p>';

    var works = (w.works || []).length
      ? '<div class="work-grid">' + w.works.map(function (p) {
          return '<figure class="work-item"><button type="button" data-lightbox="' + UI.esc(p.image) + '" data-caption="' + UI.esc(p.caption || "") + '">' +
            '<img src="' + UI.esc(p.image) + '" alt="' + UI.esc(p.caption || "Past work") + '"></button>' +
            (p.caption ? "<figcaption>" + UI.esc(p.caption) + "</figcaption>" : "") + "</figure>";
        }).join("") + "</div>"
      : '<p class="muted-note">No work photos uploaded yet.</p>';

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay is-visible";
    overlay.innerHTML =
      '<div class="modal-box modal-wide">' +
        '<div class="profile-head">' +
          '<div class="mini-avatar lg">' + UI.esc(DB.initials(w.name)) + "</div>" +
          "<div><h3>" + UI.esc(w.name) + "</h3>" +
            '<div class="sub">' + UI.esc(w.skillCategory) + " · Brgy. " + UI.esc(w.barangay) +
            (dist != null ? " · " + UI.distanceLabel(dist) : "") + "</div>" +
            '<div class="profile-badges">' +
              '<span class="badge ' + (w.verified ? "verified" : "unverified") + '">' + (w.verified ? "Verified by PESO" : "Pending verification") + "</span>" +
              '<span class="badge ' + w.availability + '">' + w.availability + "</span>" +
              '<span class="badge">' + (w.rating ? "★ " + w.rating.toFixed(1) : "No rating") + " · " + (w.jobs || 0) + " jobs</span>" +
            "</div>" +
          "</div>" +
        "</div>" +
        '<p class="profile-bio">' + UI.esc(w.bio || "") + "</p>" +
        '<div class="profile-stats">' +
          '<div><span>Usual rate</span><b>' + (w.rateMin ? "\u20B1" + w.rateMin.toLocaleString() + " – \u20B1" + w.rateMax.toLocaleString() : "Ask for a quote") + "</b></div>" +
          '<div><span>Check-up fee</span><b>' + (rate ? "\u20B1" + rate.visit[0] + " – \u20B1" + rate.visit[1] : "—") + "</b></div>" +
          '<div><span>Contact</span><b>' + UI.esc(w.phone || "—") + "</b></div>" +
        "</div>" +
        '<h4 class="profile-sec">' + UI.ICONS.award + " Certificates &amp; credentials</h4>" + certs +
        '<h4 class="profile-sec">' + UI.ICONS.image + " Past work</h4>" + works +
        '<div class="modal-actions"><button class="btn btn-outline" data-close type="button">Close</button>' +
        '<button class="btn btn-primary" data-req type="button">Request this worker</button></div>' +
      "</div>";

    document.body.appendChild(overlay);
    UI.bindLightbox(overlay);
    function close() { overlay.remove(); }
    overlay.querySelector("[data-close]").addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector("[data-req]").addEventListener("click", function () { close(); openRequestModal(w.id); });
  }

  /* ---------------------------- request a worker ---------------------------- */
  function openRequestModal(workerId) {
    var w = DB.getUserById(workerId);
    if (!w) return;
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay is-visible";
    overlay.innerHTML =
      '<div class="modal-box">' +
        "<h3>Request " + UI.esc(w.name) + "</h3>" +
        '<div class="sub">' + UI.esc(w.skillCategory) + " · Brgy. " + UI.esc(w.barangay) + "</div>" +
        '<form id="modalReqForm" style="margin-top:18px;display:flex;flex-direction:column;gap:14px;">' +
          '<div class="field"><label>Describe the problem</label><textarea name="description" required></textarea></div>' +
          '<div class="field"><label>Photos <span class="label-opt">optional</span></label><div id="modalPhotos" class="photo-picker"></div></div>' +
          '<div class="field"><label>Preferred date</label><input type="date" name="preferredDate" required></div>' +
          '<div class="field"><label>Contact number</label><input type="tel" name="contactNumber" value="' + UI.esc(user.phone || "") + '" required></div>' +
        "</form>" +
        '<div class="modal-actions"><button class="btn btn-outline" id="modalCancel" type="button">Cancel</button><button class="btn btn-primary" id="modalSubmit">Send request</button></div>' +
      "</div>";
    document.body.appendChild(overlay);

    var picker = UI.photoPicker(overlay.querySelector("#modalPhotos"), { max: 3, hint: "A photo of the unit or damage speeds up the quote." });

    overlay.querySelector("#modalCancel").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("#modalSubmit").addEventListener("click", function () {
      var form = overlay.querySelector("#modalReqForm");
      if (!form.reportValidity()) return;
      var data = Object.fromEntries(new FormData(form).entries());
      data.customerId = user.id;
      data.customerName = user.name;
      data.barangay = user.barangay;
      data.skillNeeded = w.skillCategory;
      data.photos = picker.getPhotos();
      if (me) { data.lat = me.lat; data.lng = me.lng; }
      var req = DB.createRequest(data);
      DB.updateRequest(req.id, { workerId: w.id, workerName: w.name });
      overlay.remove();
      UI.toast("Request sent to " + w.name + ".");
      switchNav("feed");
    });
  }
})();
