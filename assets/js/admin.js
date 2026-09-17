(function () {
  "use strict";

  var user = Auth.requireRole("admin");
  if (!user) return;

  UI.renderShell(user, { section: "overview", title: "Overview", subtitle: "Program-wide analytics for the barangay directory." });

  window.addEventListener("sc:section", function (e) { go(e.detail); });
  go("overview");

  function go(section) {
    if (section === "overview") { UI.setTopbar("Overview", "Program-wide analytics for the barangay directory."); renderOverview(); }
    if (section === "requests") { UI.setTopbar("Requests", "Every service request submitted across barangays."); renderRequests(); }
    if (section === "workers") { UI.setTopbar("Workers", "Verify, suspend, and monitor registered workers."); renderWorkers(); }
    if (section === "users") { UI.setTopbar("Residents", "Everyone who has created a resident account."); renderUsers(); }
  }

  function colorFor(i) {
    var palette = ["#123324", "#24614A", "#E3A83A", "#B4562F", "#57604F", "#B37F22"];
    return palette[i % palette.length];
  }

  function barChart(rows, total) {
    return '<div class="bar-chart">' + rows.map(function (r) {
      var pct = total ? Math.round((r.value / total) * 100) : 0;
      return '<div class="bar-row"><span class="bar-label">' + UI.esc(r.label) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + "%; background:" + r.color + ';"></div></div>' +
        '<span class="bar-val">' + r.value + "</span></div>";
    }).join("") + "</div>";
  }

  function donut(rows, total) {
    var r = 60, c = 2 * Math.PI * r, offset = 0;
    var segs = rows.map(function (row, i) {
      var frac = total ? row.value / total : 0;
      var len = frac * c;
      var seg = '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + colorFor(i) + '" stroke-width="24" stroke-dasharray="' + len + " " + (c - len) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 90 90)"></circle>';
      offset += len;
      return seg;
    }).join("");
    return '<svg viewBox="0 0 180 180" width="180" height="180">' + segs + '<circle cx="90" cy="90" r="40" fill="var(--paper-2)"/></svg>';
  }

  function renderOverview() {
    var users = DB.getUsers();
    var workers = users.filter(function (u) { return u.role === "worker"; });
    var residents = users.filter(function (u) { return u.role === "customer"; });
    var requests = DB.getRequests();
    var verified = workers.filter(function (w) { return w.verified; });

    var statusCounts = {};
    ["pending", "accepted", "working", "completed", "cancelled"].forEach(function (s) { statusCounts[s] = 0; });
    requests.forEach(function (r) { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

    var skillCounts = {};
    DB.SKILL_CATEGORIES.forEach(function (s) { skillCounts[s] = 0; });
    requests.forEach(function (r) { skillCounts[r.skillNeeded] = (skillCounts[r.skillNeeded] || 0) + 1; });

    var barangayCounts = {};
    requests.forEach(function (r) { barangayCounts[r.barangay] = (barangayCounts[r.barangay] || 0) + 1; });

    var statusRows = Object.keys(statusCounts).map(function (s, i) { return { label: s.charAt(0).toUpperCase() + s.slice(1), value: statusCounts[s], color: colorFor(i) }; });
    var skillRows = Object.keys(skillCounts).map(function (s, i) { return { label: s, value: skillCounts[s], color: colorFor(i) }; }).sort(function (a, b) { return b.value - a.value; });
    var barangayRows = Object.keys(barangayCounts).map(function (b, i) { return { label: b, value: barangayCounts[b], color: colorFor(i) }; }).sort(function (a, b) { return b.value - a.value; });

    var completionRate = requests.length ? Math.round((statusCounts.completed / requests.length) * 100) : 0;

    UI.content().innerHTML =
      '<div class="stat-cards">' +
        statCard(UI.ICONS.users, residents.length, "Registered residents") +
        statCard(UI.ICONS.shield, workers.length, "Registered workers (" + verified.length + " verified)") +
        statCard(UI.ICONS.inbox, requests.length, "Total service requests") +
        statCard(UI.ICONS.bolt, completionRate + "%", "Requests completed") +
      "</div>" +
      '<div class="grid-2">' +
        '<div class="panel"><div class="panel-head"><div><h3>Requests by status</h3><div class="sub">Where every ticket currently stands.</div></div></div>' +
          '<div class="panel-body">' + barChart(statusRows, requests.length) + "</div></div>" +
        '<div class="panel"><div class="panel-head"><h3>Requests by status</h3></div><div class="panel-body" style="display:flex;flex-direction:column;align-items:center;gap:14px;">' +
          donut(statusRows, requests.length) +
          '<div class="chart-legend">' + statusRows.map(function (r, i) { return '<span class="item"><span class="swatch" style="background:' + colorFor(i) + ';"></span>' + r.label + " (" + r.value + ")</span>"; }).join("") + "</div>" +
        "</div></div>" +
      "</div>" +
      '<div class="grid-2" style="margin-top:22px;">' +
        '<div class="panel"><div class="panel-head"><div><h3>Demand by skill category</h3><div class="sub">Which trades residents ask for most.</div></div></div>' +
          '<div class="panel-body">' + barChart(skillRows, requests.length) + "</div></div>" +
        '<div class="panel"><div class="panel-head"><div><h3>Requests by barangay</h3><div class="sub">Where activity is concentrated.</div></div></div>' +
          '<div class="panel-body">' + (barangayRows.length ? barChart(barangayRows, requests.length) : '<div class="empty-state">No requests yet.</div>') + "</div></div>" +
      "</div>";
  }

  function statCard(icon, num, label) {
    return '<div class="stat-card"><div class="top-row"><div class="icon">' + icon + "</div></div>" +
      '<div class="num">' + num + '</div><div class="label">' + label + "</div></div>";
  }

  /* ------------------------------ REQUESTS ------------------------------ */
  var reqFilters = { status: "All", skill: "All", q: "" };

  function renderRequests() {
    var all = DB.getRequests();
    var list = all.filter(function (r) {
      if (reqFilters.status !== "All" && r.status !== reqFilters.status) return false;
      if (reqFilters.skill !== "All" && r.skillNeeded !== reqFilters.skill) return false;
      if (reqFilters.q) {
        var q = reqFilters.q.toLowerCase();
        if ((r.customerName + " " + r.ticketId + " " + r.description).toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });

    var statusOpts = ["All", "pending", "accepted", "working", "completed", "cancelled"].map(function (s) { return '<option value="' + s + '"' + (s === reqFilters.status ? " selected" : "") + ">" + s + "</option>"; }).join("");
    var skillOpts = ["All"].concat(DB.SKILL_CATEGORIES).map(function (s) { return '<option value="' + s + '"' + (s === reqFilters.skill ? " selected" : "") + ">" + s + "</option>"; }).join("");

    var rows = list.map(function (r) {
      var workerOptions = availableWorkersFor(r).map(function (w) { return '<option value="' + w.id + '"' + (r.workerId === w.id ? " selected" : "") + ">" + UI.esc(w.name) + "</option>"; }).join("");
      var statusSelect = ["pending", "accepted", "working", "completed", "cancelled"].map(function (s) { return '<option value="' + s + '"' + (s === r.status ? " selected" : "") + ">" + s + "</option>"; }).join("");
      return (
        "<tr>" +
          "<td><b>" + r.ticketId + "</b><div style='font-size:11.5px;color:var(--ink-faint);'>" + UI.fmtDate(r.createdAt) + "</div></td>" +
          "<td>" + UI.esc(r.customerName) + "<div style='font-size:11.5px;color:var(--ink-faint);'>Brgy. " + UI.esc(r.barangay) + "</div></td>" +
          "<td><span class='req-skill'>" + UI.esc(r.skillNeeded) + "</span></td>" +
          "<td style='max-width:240px;'>" + UI.esc(r.description.length > 60 ? r.description.slice(0, 60) + "…" : r.description) +
            (r.photos && r.photos.length ? UI.gallery(r.photos, { alt: "Photo from " + r.customerName }) : "") + "</td>" +
          "<td><select class='select-inline' data-assign='" + r.id + "'><option value=''>Unassigned</option>" + workerOptions + "</select></td>" +
          "<td><select class='select-inline' data-status='" + r.id + "'>" + statusSelect + "</select></td>" +
          "<td><div class='row-actions'><button class='icon-btn' data-del='" + r.id + "' title='Delete'>" + UI.ICONS.trash + "</button></div></td>" +
        "</tr>"
      );
    }).join("");

    UI.content().innerHTML =
      '<div class="section-toolbar">' +
        '<div class="search-box">' + UI.ICONS.search + '<input id="reqSearch" placeholder="Search ticket, resident, description…" value="' + UI.esc(reqFilters.q) + '"></div>' +
        '<div style="display:flex;gap:10px;">' +
          '<select class="select-inline" id="statusFilter">' + statusOpts + "</select>" +
          '<select class="select-inline" id="skillFilter">' + skillOpts + "</select>" +
        "</div>" +
      "</div>" +
      '<div class="panel"><div class="table-wrap"><table class="data-table">' +
        "<thead><tr><th>Ticket</th><th>Resident</th><th>Skill</th><th>Description</th><th>Assigned worker</th><th>Status</th><th></th></tr></thead>" +
        "<tbody>" + (rows || "<tr><td colspan='7' style='text-align:center;padding:30px;color:var(--ink-soft);'>No requests match these filters.</td></tr>") + "</tbody>" +
      "</table></div></div>";

    UI.bindLightbox(UI.content());

    document.getElementById("reqSearch").addEventListener("input", function (e) { reqFilters.q = e.target.value; renderRequests(); document.getElementById("reqSearch").focus(); document.getElementById("reqSearch").value = reqFilters.q; document.getElementById("reqSearch").setSelectionRange(reqFilters.q.length, reqFilters.q.length); });
    document.getElementById("statusFilter").addEventListener("change", function (e) { reqFilters.status = e.target.value; renderRequests(); });
    document.getElementById("skillFilter").addEventListener("change", function (e) { reqFilters.skill = e.target.value; renderRequests(); });

    UI.content().querySelectorAll("[data-assign]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var id = sel.getAttribute("data-assign");
        var w = DB.getUserById(sel.value);
        DB.updateRequest(id, { workerId: w ? w.id : null, workerName: w ? w.name : null, status: w ? "accepted" : "pending" });
        UI.toast(w ? "Assigned to " + w.name + "." : "Unassigned.");
        renderRequests();
      });
    });
    UI.content().querySelectorAll("[data-status]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        DB.updateRequest(sel.getAttribute("data-status"), { status: sel.value });
        UI.toast("Status updated.");
        renderRequests();
      });
    });
    UI.content().querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!window.confirm("Delete this request permanently?")) return;
        DB.deleteRequest(btn.getAttribute("data-del"));
        UI.toast("Request deleted.");
        renderRequests();
      });
    });
  }

  function availableWorkersFor(r) {
    return DB.getWorkers().filter(function (w) { return w.skillCategory === r.skillNeeded; });
  }

  /* ------------------------------ WORKERS ------------------------------ */
  function renderWorkers() {
    var workers = DB.getWorkers();
    var rows = workers.map(function (w) {
      var nc = (w.certificates || []).length;
      var nw = (w.works || []).length;
      return (
        "<tr>" +
          "<td class='name-cell'><div class='mini-avatar'>" + UI.esc(DB.initials(w.name)) + "</div><div><b>" + UI.esc(w.name) + "</b><div style='font-size:11.5px;color:var(--ink-faint);'>" + UI.esc(w.email) + "</div></div></td>" +
          "<td><span class='req-skill'>" + UI.esc(w.skillCategory) + "</span></td>" +
          "<td>Brgy. " + UI.esc(w.barangay) + "</td>" +
          "<td>" + UI.starRow(w.rating) + " <span style='color:var(--ink-faint);font-size:12px;'>(" + (w.jobs || 0) + ")</span></td>" +
          "<td>" + (nc + nw
            ? "<button class='pill-btn' data-proof='" + w.id + "'>" + nc + " cert · " + nw + " photo" + (nw === 1 ? "" : "s") + "</button>"
            : "<span style='color:var(--ink-faint);font-size:12px;'>none yet</span>") + "</td>" +
          "<td><span class='badge " + w.availability + "'>" + w.availability + "</span></td>" +
          "<td><span class='badge " + (w.verified ? "verified" : "unverified") + "'>" + (w.verified ? "Verified" : "Pending") + "</span></td>" +
          "<td><div class='row-actions'>" +
            "<button class='pill-btn" + (w.verified ? "" : " primary") + "' data-toggle-verify='" + w.id + "'>" + (w.verified ? "Unverify" : "Verify") + "</button>" +
          "</div></td>" +
        "</tr>"
      );
    }).join("");

    UI.content().innerHTML =
      '<div class="panel"><div class="table-wrap"><table class="data-table">' +
        "<thead><tr><th>Worker</th><th>Skill</th><th>Barangay</th><th>Rating</th><th>Proof</th><th>Availability</th><th>Status</th><th></th></tr></thead>" +
        "<tbody>" + (rows || "<tr><td colspan='8' style='text-align:center;padding:30px;'>No workers registered yet.</td></tr>") + "</tbody>" +
      "</table></div></div>";

    UI.content().querySelectorAll("[data-proof]").forEach(function (btn) {
      btn.addEventListener("click", function () { openProof(btn.getAttribute("data-proof")); });
    });

    UI.content().querySelectorAll("[data-toggle-verify]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var w = DB.getUserById(btn.getAttribute("data-toggle-verify"));
        DB.updateUser(w.id, { verified: !w.verified });
        UI.toast(w.verified ? "Worker unverified." : "Worker verified.");
        renderWorkers();
      });
    });
  }

  // Review a worker's uploaded credentials before verifying them.
  function openProof(workerId) {
    var w = DB.getUserById(workerId);
    if (!w) return;
    var certs = (w.certificates || []).length
      ? '<ul class="cert-list">' + w.certificates.map(function (c) {
          return "<li>" + (c.image
            ? '<button type="button" class="cert-thumb" data-lightbox="' + UI.esc(c.image) + '" data-caption="' + UI.esc(c.title) + '"><img src="' + UI.esc(c.image) + '" alt=""></button>'
            : '<span class="cert-thumb is-blank">' + UI.ICONS.award + "</span>") +
            '<span class="cert-txt"><b>' + UI.esc(c.title) + "</b><em>" + UI.esc([c.issuer, c.year].filter(Boolean).join(" · ")) + "</em></span></li>";
        }).join("") + "</ul>"
      : '<p class="muted-note">No certificates uploaded.</p>';

    var works = (w.works || []).length
      ? '<div class="work-grid">' + w.works.map(function (p) {
          return '<figure class="work-item"><button type="button" data-lightbox="' + UI.esc(p.image) + '" data-caption="' + UI.esc(p.caption || "") + '"><img src="' + UI.esc(p.image) + '" alt=""></button>' +
            "<figcaption>" + UI.esc(p.caption || "") + "</figcaption></figure>";
        }).join("") + "</div>"
      : '<p class="muted-note">No work photos uploaded.</p>';

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay is-visible";
    overlay.innerHTML =
      '<div class="modal-box modal-wide">' +
        "<h3>" + UI.esc(w.name) + " — submitted proof</h3>" +
        '<div class="sub">' + UI.esc(w.skillCategory) + " · Brgy. " + UI.esc(w.barangay) + " · " + UI.esc(w.phone || "no number") + "</div>" +
        '<h4 class="profile-sec">' + UI.ICONS.award + " Certificates</h4>" + certs +
        '<h4 class="profile-sec">' + UI.ICONS.image + " Past work</h4>" + works +
        '<div class="modal-actions"><button class="btn btn-outline" data-close type="button">Close</button>' +
        '<button class="btn btn-primary" data-verify type="button">' + (w.verified ? "Unverify worker" : "Verify worker") + "</button></div>" +
      "</div>";
    document.body.appendChild(overlay);
    UI.bindLightbox(overlay);
    overlay.querySelector("[data-close]").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-verify]").addEventListener("click", function () {
      DB.updateUser(w.id, { verified: !w.verified });
      overlay.remove();
      UI.toast(w.verified ? "Worker unverified." : "Worker verified.");
      renderWorkers();
    });
  }

  /* ------------------------------- USERS -------------------------------- */
  function renderUsers() {
    var residents = DB.getUsers().filter(function (u) { return u.role === "customer"; });
    var rows = residents.map(function (u) {
      var count = DB.getRequestsByCustomer(u.id).length;
      return (
        "<tr>" +
          "<td class='name-cell'><div class='mini-avatar'>" + UI.esc(DB.initials(u.name)) + "</div><b>" + UI.esc(u.name) + "</b></td>" +
          "<td>" + UI.esc(u.email) + "</td>" +
          "<td>Brgy. " + UI.esc(u.barangay) + "</td>" +
          "<td>" + UI.esc(u.phone || "—") + "</td>" +
          "<td>" + count + " request" + (count === 1 ? "" : "s") + "</td>" +
        "</tr>"
      );
    }).join("");

    UI.content().innerHTML =
      '<div class="panel"><div class="table-wrap"><table class="data-table">' +
        "<thead><tr><th>Resident</th><th>Email</th><th>Barangay</th><th>Phone</th><th>Requests</th></tr></thead>" +
        "<tbody>" + (rows || "<tr><td colspan='5' style='text-align:center;padding:30px;'>No residents registered yet.</td></tr>") + "</tbody>" +
      "</table></div></div>";
  }
})();
