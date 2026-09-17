(function () {
  "use strict";

  var user = Auth.requireRole("worker");
  if (!user) return;

  UI.renderShell(user, { section: "jobfeed", title: "Job Feed", subtitle: "Requests matching your specialty: " + user.skillCategory + "." });

  var activeTab = "available";
  var me = DB.coordsOf(user);

  window.addEventListener("sc:section", function (e) { go(e.detail); });
  go("jobfeed");

  function go(section) {
    if (section === "jobfeed") { UI.setTopbar("Job Feed", "Requests matching your specialty: " + user.skillCategory + "."); renderJobFeed(); }
    if (section === "profile") { UI.setTopbar("Availability & Profile", "Build your credibility — availability, certificates, and past work."); renderProfile(); }
  }

  function refreshUser() {
    var fresh = DB.getUserById(user.id);
    if (fresh) Object.assign(user, fresh);
  }

  function tabCounts() {
    var all = DB.getRequests();
    var available = all.filter(function (r) { return r.status === "pending" && r.skillNeeded === user.skillCategory && (!r.workerId || r.workerId === user.id); });
    var mine = DB.getRequestsByWorker(user.id);
    return {
      available: available,
      accepted: mine.filter(function (r) { return r.status === "accepted"; }),
      working: mine.filter(function (r) { return r.status === "working"; }),
      completed: mine.filter(function (r) { return r.status === "completed"; })
    };
  }

  /* ====================================================================
     JOB FEED
     ==================================================================== */
  function reqCard(r, mode) {
    var action = "";
    if (mode === "available") action = '<button class="btn btn-primary" style="height:36px;padding:0 14px;font-size:13px;" data-accept="' + r.id + '">Accept job</button>';
    if (mode === "accepted") action = '<button class="btn btn-primary" style="height:36px;padding:0 14px;font-size:13px;" data-start="' + r.id + '">Start job</button>';
    if (mode === "working") action = '<button class="btn btn-primary" style="height:36px;padding:0 14px;font-size:13px;" data-complete="' + r.id + '">Mark complete</button>';
    if (mode === "completed") action = r.rating ? '<span style="font-size:12.5px;color:var(--ink-soft);">' + UI.starRow(r.rating) + "</span>" : '<span style="font-size:12.5px;color:var(--ink-soft);">Not yet rated</span>';

    var dist = DB.distanceKm(me, DB.coordsOf(r));

    return (
      '<article class="req-card">' +
        '<div class="req-top"><span class="req-id">' + r.ticketId + '</span><span class="badge ' + r.status + '">' + r.status + "</span></div>" +
        '<div><span class="req-skill">' + UI.esc(r.skillNeeded) + "</span>" +
          (dist != null ? '<span class="dist-tag" style="margin-left:8px;">' + UI.distanceLabel(dist) + "</span>" : "") +
          (r.photos && r.photos.length ? '<span class="chip-count">' + UI.ICONS.image + r.photos.length + "</span>" : "") +
        "</div>" +
        '<p class="req-desc">' + UI.esc(r.description) + "</p>" +
        (r.photos && r.photos.length ? UI.gallery(r.photos, { alt: "Photo from the resident" }) : "") +
        '<div class="req-meta">' + UI.esc(r.customerName) + " · Brgy. " + UI.esc(r.barangay) + " · " + UI.esc(r.contactNumber) + " · Preferred " + UI.fmtDate(r.preferredDate) + "</div>" +
        '<div class="req-foot"><span class="req-people">Submitted ' + UI.timeAgo(r.createdAt) + "</span>" + action + "</div>" +
      "</article>"
    );
  }

  function renderJobFeed() {
    refreshUser();
    var c = tabCounts();
    var tabs = [
      { id: "available", label: "Available", list: c.available },
      { id: "accepted", label: "Pending (accepted)", list: c.accepted },
      { id: "working", label: "Working", list: c.working },
      { id: "completed", label: "Completed", list: c.completed }
    ];
    var tabsHtml = tabs.map(function (t) {
      return '<button class="tab-btn' + (t.id === activeTab ? " is-active" : "") + '" data-tab="' + t.id + '">' + t.label + ' <span class="count">' + t.list.length + "</span></button>";
    }).join("");

    var active = tabs.filter(function (t) { return t.id === activeTab; })[0];

    // sort open jobs by how close they are
    if (active.id === "available") {
      active.list = active.list.slice().sort(function (a, b) {
        var da = DB.distanceKm(me, DB.coordsOf(a));
        var db = DB.distanceKm(me, DB.coordsOf(b));
        return (da == null ? 999 : da) - (db == null ? 999 : db);
      });
    }

    var listHtml;
    if (!active.list.length) {
      var msgs = { available: "No matching requests right now — check back soon.", accepted: "Nothing accepted yet. Grab a job from the Available tab.", working: "Nothing in progress at the moment.", completed: "You haven't completed any jobs yet." };
      listHtml = '<div class="panel"><div class="empty-state">' + UI.ICONS.inbox + "<h4>All clear</h4><p>" + msgs[active.id] + "</p></div></div>";
    } else {
      listHtml = '<div class="req-list">' + active.list.map(function (r) { return reqCard(r, active.id); }).join("") + "</div>";
    }

    // Map of open jobs so a worker can see which ones are on their route.
    var mapHtml = "";
    if (active.id === "available" && active.list.length) {
      mapHtml =
        '<div class="panel map-panel" style="margin-bottom:20px;"><div class="panel-head">' +
          "<div><h3>" + UI.ICONS.mapPin + " Open jobs near you</h3>" +
          '<div class="sub">' + active.list.length + " job" + (active.list.length === 1 ? "" : "s") + " in " + UI.esc(user.skillCategory) + " — closest first.</div></div></div>" +
          '<div id="jobMap" class="map-holder"></div></div>';
    }

    var banner = "";
    if (!user.verified) {
      banner = '<div class="panel" style="margin-bottom:20px;"><div class="panel-body" style="display:flex;gap:14px;align-items:center;">' +
        '<div class="icon" style="width:34px;height:34px;border-radius:9px;background:rgba(180,86,47,0.1);color:var(--clay);display:grid;place-items:center;flex:none;">' + UI.ICONS.bolt + "</div><div>" +
        '<div style="font-weight:700;">Your account is pending verification</div>' +
        '<div style="font-size:13.5px;color:var(--ink-soft);margin-top:2px;">Visit the barangay or PESO desk with a valid ID. Uploading your certificates and past work under <b>Availability &amp; Profile</b> speeds this up.</div>' +
        "</div></div></div>";
    }

    UI.content().innerHTML = banner + '<div class="tabs" style="margin-bottom:18px;">' + tabsHtml + "</div>" + mapHtml + listHtml;
    UI.bindLightbox(UI.content());

    if (document.getElementById("jobMap")) {
      var pts = active.list.map(function (r) {
        var g = DB.coordsOf(r);
        return { id: r.id, lat: g.lat, lng: g.lng, label: r.ticketId + " · " + r.skillNeeded, sub: r.customerName + " · Brgy. " + r.barangay,
          distance: DB.distanceKm(me, g), initials: "!", kind: "request", state: "request" };
      });
      if (me) pts.push({ id: "me", lat: me.lat, lng: me.lng, label: "You (Brgy. " + user.barangay + ")", kind: "me" });
      SCMap.render(document.getElementById("jobMap"), {
        points: pts,
        showRequestLegend: true,
        onSelect: function (pt) {
          if (!pt || pt.kind === "me") return;
          var card = UI.content().querySelectorAll(".req-list .req-card");
          var idx = active.list.findIndex(function (r) { return r.id === pt.id; });
          if (idx >= 0 && card[idx]) {
            card[idx].classList.add("is-selected");
            card[idx].scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(function () { card[idx].classList.remove("is-selected"); }, 2200);
          }
        }
      });
    }

    UI.content().querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () { activeTab = btn.getAttribute("data-tab"); renderJobFeed(); });
    });
    UI.content().querySelectorAll("[data-accept]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        DB.updateRequest(btn.getAttribute("data-accept"), { status: "accepted", workerId: user.id, workerName: user.name });
        UI.toast("Job accepted — find it under Pending.");
        activeTab = "accepted";
        renderJobFeed();
      });
    });
    UI.content().querySelectorAll("[data-start]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        DB.updateRequest(btn.getAttribute("data-start"), { status: "working" });
        UI.toast("Job marked as in progress.");
        activeTab = "working";
        renderJobFeed();
      });
    });
    UI.content().querySelectorAll("[data-complete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        DB.updateRequest(btn.getAttribute("data-complete"), { status: "completed" });
        DB.updateUser(user.id, { jobs: (user.jobs || 0) + 1 });
        user.jobs = (user.jobs || 0) + 1;
        UI.toast("Nice work! Job marked complete.");
        activeTab = "completed";
        renderJobFeed();
      });
    });
  }

  /* ====================================================================
     PROFILE — availability, certificates, past work
     ==================================================================== */
  function renderProfile() {
    refreshUser();

    var opts = ["available", "busy", "offline"];
    var switcherHtml = opts.map(function (o) {
      return '<button class="avail-opt' + (user.availability === o ? " is-active" : "") + '" data-val="' + o + '"><span class="dot"></span>' + o.charAt(0).toUpperCase() + o.slice(1) + "</button>";
    }).join("");

    var certs = user.certificates || [];
    var works = user.works || [];

    var certList = certs.length
      ? '<ul class="cert-list">' + certs.map(function (c) {
          return "<li>" + (c.image
              ? '<button type="button" class="cert-thumb" data-lightbox="' + UI.esc(c.image) + '" data-caption="' + UI.esc(c.title) + '"><img src="' + UI.esc(c.image) + '" alt=""></button>'
              : '<span class="cert-thumb is-blank">' + UI.ICONS.award + "</span>") +
            '<span class="cert-txt"><b>' + UI.esc(c.title) + "</b><em>" + UI.esc([c.issuer, c.year].filter(Boolean).join(" · ")) + "</em></span>" +
            '<button type="button" class="pill-btn danger" data-del-cert="' + c.id + '">Remove</button>' +
            "</li>";
        }).join("") + "</ul>"
      : '<p class="muted-note">No certificates yet. Residents trust profiles with a TESDA NC II, PRC licence, or training certificate.</p>';

    var workGrid = works.length
      ? '<div class="work-grid">' + works.map(function (p) {
          return '<figure class="work-item"><button type="button" data-lightbox="' + UI.esc(p.image) + '" data-caption="' + UI.esc(p.caption || "") + '">' +
            '<img src="' + UI.esc(p.image) + '" alt=""></button>' +
            "<figcaption>" + UI.esc(p.caption || "") + "</figcaption>" +
            '<button type="button" class="work-remove" data-del-work="' + p.id + '" aria-label="Remove photo">' + UI.ICONS.x + "</button></figure>";
        }).join("") + "</div>"
      : '<p class="muted-note">No work photos yet. Before/after shots of finished jobs are the fastest way to win requests.</p>';

    UI.content().innerHTML =
      '<div class="grid-2">' +
        '<div class="panel"><div class="panel-head"><div><h3>Availability</h3><div class="sub">Residents only see you as bookable when you\'re Available.</div></div></div>' +
          '<div class="panel-body"><div class="avail-switcher">' + switcherHtml + "</div></div></div>" +
        '<div class="panel"><div class="panel-head"><h3>Credibility score</h3></div><div class="panel-body">' +
          '<span class="badge ' + (user.verified ? "verified" : "unverified") + '">' + (user.verified ? "Verified" : "Pending verification") + "</span>" +
          '<div class="cred-rows">' +
            credRow("Verified by PESO", user.verified) +
            credRow("Profile bio written", !!(user.bio && user.bio.length > 20)) +
            credRow("At least 1 certificate", certs.length > 0) +
            credRow("At least 3 work photos", works.length >= 3) +
          "</div>" +
        "</div></div>" +
      "</div>" +

      '<div class="panel" style="margin-top:22px;"><div class="panel-head"><h3>Your profile</h3><div class="sub">Shown to residents browsing the directory.</div></div>' +
        '<div class="panel-body"><form id="profileForm" class="form-grid">' +
          '<div class="field"><label>Full name</label><input name="name" value="' + UI.esc(user.name) + '" disabled></div>' +
          '<div class="field"><label>Skill category</label><input value="' + UI.esc(user.skillCategory) + '" disabled></div>' +
          '<div class="field"><label>Barangay</label><input value="' + UI.esc(user.barangay) + '" disabled></div>' +
          '<div class="field"><label>Contact number</label><input name="phone" value="' + UI.esc(user.phone || "") + '"></div>' +
          '<div class="field"><label>Usual rate — from (\u20B1)</label><input type="number" min="0" name="rateMin" value="' + UI.esc(user.rateMin || "") + '"></div>' +
          '<div class="field"><label>Usual rate — up to (\u20B1)</label><input type="number" min="0" name="rateMax" value="' + UI.esc(user.rateMax || "") + '"></div>' +
          '<div class="field full"><label>Bio (shown to residents)</label><textarea name="bio">' + UI.esc(user.bio || "") + "</textarea></div>" +
          '<div class="field full"><button class="btn btn-primary" type="submit">Save profile</button></div>' +
        "</form></div></div>" +

      '<div class="panel" style="margin-top:22px;"><div class="panel-head"><div><h3>' + UI.ICONS.award + " Certificates &amp; credentials</h3>" +
        '<div class="sub">TESDA NC II, PRC licence, seminars — upload a photo of the paper if you have one.</div></div></div>' +
        '<div class="panel-body">' + certList +
          '<form id="certForm" class="inline-form">' +
            '<div class="field"><label>Certificate title</label><input name="title" required placeholder="e.g. TESDA NC II — Electrical Installation"></div>' +
            '<div class="field"><label>Issued by</label><input name="issuer" placeholder="e.g. TESDA Oriental Mindoro"></div>' +
            '<div class="field" style="max-width:120px;"><label>Year</label><input name="year" placeholder="2024"></div>' +
            '<div class="field full"><label>Photo of the certificate <span class="label-opt">optional</span></label><div id="certPhoto" class="photo-picker"></div></div>' +
            '<div class="field full"><button class="btn btn-outline" type="submit">' + UI.ICONS.plus + " Add certificate</button></div>" +
          "</form>" +
        "</div></div>" +

      '<div class="panel" style="margin-top:22px;"><div class="panel-head"><div><h3>' + UI.ICONS.image + " Photos of your work</h3>" +
        '<div class="sub">Finished jobs, before/after shots, fabrication work — proof beats promises.</div></div></div>' +
        '<div class="panel-body">' + workGrid +
          '<form id="workForm" class="inline-form">' +
            '<div class="field full"><label>Caption</label><input name="caption" required placeholder="e.g. Rewired a two-storey house in Brgy. Camansihan"></div>' +
            '<div class="field full"><label>Photo</label><div id="workPhoto" class="photo-picker"></div></div>' +
            '<div class="field full"><button class="btn btn-outline" type="submit">' + UI.ICONS.plus + " Add work photo</button></div>" +
          "</form>" +
        "</div></div>";

    UI.bindLightbox(UI.content());

    var certPicker = UI.photoPicker(document.getElementById("certPhoto"), { max: 1, label: "Upload certificate", hint: "One clear photo or scan of the certificate." });
    var workPicker = UI.photoPicker(document.getElementById("workPhoto"), { max: 1, label: "Upload photo", hint: "One photo per entry — add another entry for more." });

    UI.content().querySelectorAll("[data-val]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var val = btn.getAttribute("data-val");
        DB.updateUser(user.id, { availability: val });
        user.availability = val;
        UI.toast("Availability set to " + val + ".");
        renderProfile();
      });
    });

    document.getElementById("profileForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      DB.updateUser(user.id, {
        phone: data.phone,
        bio: data.bio,
        rateMin: data.rateMin ? parseInt(data.rateMin, 10) : null,
        rateMax: data.rateMax ? parseInt(data.rateMax, 10) : null
      });
      UI.toast("Profile updated.");
      renderProfile();
    });

    document.getElementById("certForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.title.trim()) return;
      DB.addCertificate(user.id, {
        title: data.title.trim(),
        issuer: (data.issuer || "").trim(),
        year: (data.year || "").trim(),
        image: certPicker.getPhotos()[0] || null
      });
      UI.toast("Certificate added to your profile.");
      renderProfile();
    });

    document.getElementById("workForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      var img = workPicker.getPhotos()[0];
      if (!img) { UI.toast("Add a photo first."); return; }
      DB.addWork(user.id, { caption: (data.caption || "").trim(), image: img });
      UI.toast("Work photo added.");
      renderProfile();
    });

    UI.content().querySelectorAll("[data-del-cert]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        DB.removeCertificate(user.id, btn.getAttribute("data-del-cert"));
        UI.toast("Certificate removed.");
        renderProfile();
      });
    });
    UI.content().querySelectorAll("[data-del-work]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        DB.removeWork(user.id, btn.getAttribute("data-del-work"));
        UI.toast("Work photo removed.");
        renderProfile();
      });
    });
  }

  function credRow(label, done) {
    return '<div class="cred-row' + (done ? " is-done" : "") + '">' +
      '<span class="tick">' + (done ? UI.ICONS.check : "") + "</span>" + UI.esc(label) + "</div>";
  }
})();
