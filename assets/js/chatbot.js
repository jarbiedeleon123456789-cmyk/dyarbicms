/* ==========================================================================
   SKILLCONNECT — FLOATING ASSISTANT ("Konek")
   ==========================================================================
   A rule-based helper that answers questions about the site using the same
   `DB` data the pages use: indicative repair costs, who the nearest
   available worker is, how to submit a request, ticket status, and how
   verification works. It understands common Taglish phrasing too
   ("magkano", "malapit", "paano").

   It is intentionally offline and deterministic — no API key, no network
   call — so it keeps working during a demo or defense with no internet.
   To upgrade later, replace `answer()` with a fetch() to a real model and
   keep the same return shape: { html: string, chips: [string] }.
   ========================================================================== */
(function (global) {
  "use strict";

  var BOT_NAME = "Konek";
  var BOT_IMG = "assets/img/bot.png";

  /* ------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function peso(n) {
    return "\u20B1" + Number(n).toLocaleString("en-PH");
  }

  function range(a, b) {
    return peso(a) + " – " + peso(b);
  }

  var SKILL_HINTS = {
    "Electronics": ["electronic", "tv", "television", "karaoke", "speaker", "amplifier", "amp", "phone", "cellphone", "cp", "laptop", "radio", "cctv", "monitor", "charger", "soldering"],
    "Appliance Repair": ["appliance", "aircon", "air con", "aircondition", "ref ", "refrigerator", "freezer", "washing machine", "labahan", "fan", "bentilador", "rice cooker", "microwave", "oven", "dryer"],
    "Electrical": ["electric", "breaker", "wiring", "rewire", "outlet", "saksakan", "kuryente", "switch", "circuit", "voltage", "meter", "ilaw", "light", "bombilya", "panel"],
    "Welding": ["weld", "welder", "gate", "grill", "rehas", "steel", "bakal", "railing", "fabricat", "tank stand", "hinge", "metal"],
    "Plumbing": ["plumb", "leak", "tulo", "pipe", "tubo", "faucet", "gripo", "clog", "barado", "toilet", "inodoro", "drain", "water closet", "septic", "shower", "sink", "lababo"],
    "Small Engine Repair": ["engine", "motor", "motorcycle", "tricycle", "generator", "genset", "pump", "bomba", "chainsaw", "grass cutter", "lawn", "makina", "carburetor", "tune up", "tune-up"]
  };

  function detectSkill(text) {
    var t = " " + text.toLowerCase() + " ";
    var best = null;
    Object.keys(SKILL_HINTS).forEach(function (skill) {
      if (best) return;
      if (t.indexOf(skill.toLowerCase()) !== -1) best = skill;
    });
    if (best) return best;
    Object.keys(SKILL_HINTS).forEach(function (skill) {
      if (best) return;
      SKILL_HINTS[skill].forEach(function (kw) {
        if (!best && t.indexOf(kw) !== -1) best = skill;
      });
    });
    return best;
  }

  function detectBarangay(text) {
    var t = text.toLowerCase();
    var found = null;
    DB.BARANGAYS.forEach(function (b) {
      if (!found && t.indexOf(b.toLowerCase().replace(".", "")) !== -1) found = b;
      if (!found && t.indexOf(b.toLowerCase()) !== -1) found = b;
    });
    return found;
  }

  function has(text, words) {
    var t = " " + text.toLowerCase() + " ";
    return words.some(function (w) { return t.indexOf(w) !== -1; });
  }

  /* ----------------------------------------------------- answer builders */
  var ctx = { skill: null, barangay: null };

  function currentUser() {
    try { return DB.getCurrentUser(); } catch (e) { return null; }
  }

  function originCoords() {
    var u = currentUser();
    if (u && DB.coordsOf(u)) return { coords: DB.coordsOf(u), label: "Brgy. " + u.barangay };
    if (ctx.barangay) return { coords: DB.BARANGAY_GEO[ctx.barangay], label: "Brgy. " + ctx.barangay };
    return null;
  }

  function workerLine(w, dist) {
    return '<div class="scbot-worker">' +
      '<span class="av">' + esc(DB.initials(w.name)) + "</span>" +
      '<span class="who"><b>' + esc(w.name) + "</b>" +
        "<em>" + esc(w.skillCategory) + " · Brgy. " + esc(w.barangay) + (w.verified ? " · Verified" : " · Unverified") + "</em></span>" +
      '<span class="meta">' + (dist != null ? dist.toFixed(1) + " km" : "") +
        '<em>' + (w.rating ? "★ " + w.rating.toFixed(1) : "new") + "</em></span>" +
      "</div>";
  }

  function answerCost(text) {
    var skill = detectSkill(text) || ctx.skill;
    if (!skill) {
      return {
        html: "<p>I can give you the usual barangay rate. Which kind of repair is it?</p>",
        chips: DB.SKILL_CATEGORIES
      };
    }
    ctx.skill = skill;
    var card = DB.RATE_CARD[skill];
    var rows = card.jobs.map(function (j) {
      return '<div class="scbot-rate"><span>' + esc(j.label) + "</span><b>" + range(j.min, j.max) + "</b></div>";
    }).join("");

    var workers = DB.getWorkers().filter(function (w) { return w.skillCategory === skill && w.verified; });
    var quoted = workers.filter(function (w) { return w.rateMin; });
    var avgLow = quoted.length ? Math.round(quoted.reduce(function (s, w) { return s + w.rateMin; }, 0) / quoted.length) : null;
    var avgHigh = quoted.length ? Math.round(quoted.reduce(function (s, w) { return s + w.rateMax; }, 0) / quoted.length) : null;

    return {
      html:
        "<p>Here are the usual <b>" + esc(skill) + "</b> rates around the barangay:</p>" +
        '<div class="scbot-rates">' + rows + "</div>" +
        "<p class='scbot-note'>Home visit / check-up fee: <b>" + range(card.visit[0], card.visit[1]) + "</b>." +
        (avgLow ? " Our verified " + esc(skill.toLowerCase()) + " workers currently quote around <b>" + range(avgLow, avgHigh) + "</b> per job." : "") +
        "</p>" +
        "<p class='scbot-note'>" + esc(card.note) + " These are estimates only — the final price comes from the worker after they see the unit.</p>",
      chips: ["Who is nearest to me?", "Post this as a request", "Another skill"]
    };
  }

  function answerNearest(text) {
    var skill = detectSkill(text) || ctx.skill;
    var brgy = detectBarangay(text);
    if (brgy) ctx.barangay = brgy;

    var origin = originCoords();
    if (!origin) {
      return {
        html: "<p>Sure — which barangay are you in? I'll measure from there.</p>",
        chips: DB.BARANGAYS
      };
    }

    var list = DB.getWorkers().filter(function (w) {
      if (!w.verified) return false;
      if (skill && w.skillCategory !== skill) return false;
      return true;
    }).map(function (w) {
      return { w: w, d: DB.distanceKm(origin.coords, DB.coordsOf(w)) };
    }).sort(function (a, b) {
      // available first, then distance
      var rank = { available: 0, busy: 1, offline: 2 };
      if (rank[a.w.availability] !== rank[b.w.availability]) return rank[a.w.availability] - rank[b.w.availability];
      return (a.d == null ? 99 : a.d) - (b.d == null ? 99 : b.d);
    }).slice(0, 4);

    if (!list.length) {
      return {
        html: "<p>No verified " + esc(skill || "") + " worker is listed yet. You can still submit the request — the barangay will match you once someone is verified.</p>",
        chips: ["How do I submit a request?", "See all skills"]
      };
    }

    var top = list[0];
    return {
      html:
        "<p>Closest to <b>" + esc(origin.label) + "</b>" + (skill ? " for <b>" + esc(skill) + "</b>" : "") + ":</p>" +
        list.map(function (x) { return workerLine(x.w, x.d); }).join("") +
        "<p class='scbot-note'>" + esc(top.w.name) + " is about <b>" + (top.d != null ? top.d.toFixed(1) + " km" : "nearby") +
        "</b> away and is <b>" + esc(top.w.availability) + "</b>. Open <i>Find a Worker</i> to see them on the map and request them directly.</p>",
      chips: ["How much will it cost?", "Open Find a Worker", "Are they verified?"]
    };
  }

  function answerHowToRequest() {
    return {
      html:
        "<p>Submitting a job takes about a minute:</p>" +
        "<ol class='scbot-steps'>" +
          "<li>Go to <b>New Request</b> in the sidebar.</li>" +
          "<li>Pick the <b>skill needed</b> and describe the problem.</li>" +
          "<li><b>Attach photos</b> of the unit or the damage — workers quote much faster with a picture.</li>" +
          "<li>Set your barangay, preferred date, and contact number, then submit.</li>" +
        "</ol>" +
        "<p class='scbot-note'>You'll get a ticket number (like SC-1042) and your feed shows the live status: pending → accepted → working → completed.</p>",
      chips: ["What photos should I attach?", "How much will it cost?", "Who is nearest to me?"]
    };
  }

  function answerPhotos() {
    return {
      html:
        "<p>Attach 1–4 clear shots:</p>" +
        "<ul class='scbot-steps'>" +
          "<li>The <b>whole unit</b> so the worker recognises the model.</li>" +
          "<li>A <b>close-up of the damage</b> — the crack, leak, burnt part, or rust.</li>" +
          "<li>The <b>nameplate or model sticker</b>, which tells them what spare parts to bring.</li>" +
        "</ul>" +
        "<p class='scbot-note'>Photos are resized automatically before they're saved, so uploading from your phone is fine.</p>",
      chips: ["How do I submit a request?", "How much will it cost?"]
    };
  }

  function answerStatus() {
    var u = currentUser();
    if (!u || u.role !== "customer") {
      return { html: "<p>Log in as a resident and I can read your ticket status from your feed.</p>", chips: ["How do I submit a request?", "How much will it cost?"] };
    }
    var list = DB.getRequestsByCustomer(u.id);
    if (!list.length) {
      return { html: "<p>You have no requests yet. Want to post one?</p>", chips: ["How do I submit a request?", "Who is nearest to me?"] };
    }
    var open = list.filter(function (r) { return r.status !== "completed" && r.status !== "cancelled"; });
    var rows = (open.length ? open : list).slice(0, 4).map(function (r) {
      return '<div class="scbot-rate"><span><b>' + esc(r.ticketId) + "</b> · " + esc(r.skillNeeded) +
        (r.workerName ? " · " + esc(r.workerName) : "") + "</span><b class='st st-" + esc(r.status) + "'>" + esc(r.status) + "</b></div>";
    }).join("");
    return {
      html: "<p>You have <b>" + list.length + "</b> request" + (list.length > 1 ? "s" : "") + ", " + open.length + " still open:</p>" +
        '<div class="scbot-rates">' + rows + "</div>" +
        "<p class='scbot-note'>Pending means no worker has accepted yet. If it stays pending for more than a day, the barangay desk can assign someone manually.</p>",
      chips: ["Who is nearest to me?", "How do I cancel a request?"]
    };
  }

  function answerCancel() {
    return {
      html: "<p>Open <b>My Requests</b> and press <b>Cancel</b> on any ticket that is still <i>pending</i>. Once a worker has accepted or started the job, message them first — the barangay desk can then cancel it for you.</p>",
      chips: ["Check my requests", "How do I submit a request?"]
    };
  }

  function answerVerification() {
    var workers = DB.getWorkers();
    var verified = workers.filter(function (w) { return w.verified; }).length;
    return {
      html:
        "<p><b>Verified</b> means barangay/PESO staff checked the worker's valid ID and skill category in person. Right now <b>" + verified + " of " + workers.length + "</b> registered workers are verified.</p>" +
        "<p>On a worker's profile you can also see:</p>" +
        "<ul class='scbot-steps'>" +
          "<li><b>Certificates</b> — TESDA NC II, PRC licence, training records.</li>" +
          "<li><b>Past work photos</b> — jobs they've actually finished.</li>" +
          "<li><b>Rating and job count</b> from residents who hired them.</li>" +
        "</ul>" +
        "<p class='scbot-note'>Unverified workers can still appear, but they're clearly labelled <i>Pending</i>. For electrical and welding work, stick to verified workers.</p>",
      chips: ["Who is nearest to me?", "How do workers get verified?"]
    };
  }

  function answerBecomeWorker() {
    return {
      html:
        "<p>To join as a skilled worker:</p>" +
        "<ol class='scbot-steps'>" +
          "<li>Register an account and choose <b>Skilled worker</b> plus your skill category.</li>" +
          "<li>Visit the barangay or PESO desk with a <b>valid ID</b> (and your TESDA certificate if you have one).</li>" +
          "<li>Once staff verify you, your profile goes public and jobs in your category appear in your feed.</li>" +
          "<li>Upload your <b>certificates and photos of past work</b> — profiles with proof get requested far more often.</li>" +
        "</ol>" +
        "<p class='scbot-note'>Registration is free. The barangay runs this as a community service, not a marketplace — no commission is taken.</p>",
      chips: ["How does verification work?", "What skills are listed?"]
    };
  }

  function answerSkills() {
    var counts = {};
    DB.getWorkers().forEach(function (w) {
      if (!w.verified) return;
      counts[w.skillCategory] = (counts[w.skillCategory] || 0) + 1;
    });
    var rows = DB.SKILL_CATEGORIES.map(function (s) {
      return '<div class="scbot-rate"><span>' + esc(s) + "</span><b>" + (counts[s] || 0) + " verified</b></div>";
    }).join("");
    return {
      html: "<p>The directory covers six trades:</p><div class='scbot-rates'>" + rows + "</div>",
      chips: ["How much will it cost?", "Who is nearest to me?"]
    };
  }

  function answerOpenJobs() {
    var pending = DB.getRequests().filter(function (r) { return r.status === "pending"; });
    var byS = {};
    pending.forEach(function (r) { byS[r.skillNeeded] = (byS[r.skillNeeded] || 0) + 1; });
    var rows = Object.keys(byS).sort(function (a, b) { return byS[b] - byS[a]; }).map(function (s) {
      return '<div class="scbot-rate"><span>' + esc(s) + "</span><b>" + byS[s] + " open</b></div>";
    }).join("");
    return {
      html: "<p>There are <b>" + pending.length + "</b> open jobs waiting for a worker right now:</p><div class='scbot-rates'>" + rows + "</div>" +
        "<p class='scbot-note'>Workers see only the jobs that match their own skill category in their Job Feed.</p>",
      chips: ["How do I become a worker?", "Who is nearest to me?"]
    };
  }

  function answerMap() {
    return {
      html: "<p>Open <b>Find a Worker</b> — the map at the top plots every verified worker around you. Green pins are available, amber are busy, grey are offline, and the pulsing blue pin is you. Tap any pin to see that worker's profile, distance, certificates and past work.</p>",
      chips: ["Who is nearest to me?", "How does verification work?"]
    };
  }

  function answerContact() {
    return {
      html: "<p>Barangay / PESO desk:</p>" +
        "<ul class='scbot-steps'><li>Phone: <b>0917 000 0000</b></li><li>Email: <b>peso@barangay.gov.ph</b></li>" +
        "<li>Barangay Hall, Oriental Mindoro — Mon–Fri 8 AM–5 PM, Sat until 12 PM for worker verification.</li></ul>",
      chips: ["How do I submit a request?", "How does verification work?"]
    };
  }

  function answerHelp() {
    return {
      html: "<p>I can help with:</p>" +
        "<ul class='scbot-steps'>" +
          "<li>How much a repair usually costs</li>" +
          "<li>Which worker is nearest and available</li>" +
          "<li>Submitting a request and attaching photos</li>" +
          "<li>Checking your ticket status</li>" +
          "<li>How verification, certificates and ratings work</li>" +
        "</ul>",
      chips: ["How much will it cost?", "Who is nearest to me?", "How do I submit a request?"]
    };
  }

  /* --------------------------------------------------------- the router */
  function answer(raw) {
    var text = String(raw || "").trim();
    if (!text) return answerHelp();
    var t = text.toLowerCase();

    // A bare skill name usually follows a "which skill?" question.
    var bare = DB.SKILL_CATEGORIES.filter(function (s) { return s.toLowerCase() === t; })[0];
    if (bare) { ctx.skill = bare; return answerCost(bare); }

    var bareB = DB.BARANGAYS.filter(function (b) { return b.toLowerCase() === t; })[0];
    if (bareB) { ctx.barangay = bareB; return answerNearest(text); }

    if (has(t, ["another skill", "see all skills", "what skills", "anong serbisyo", "services", "categories", "list of skills"])) return answerSkills();
    if (has(t, ["thank", "salamat", "maraming salamat"])) {
      return { html: "<p>Walang anuman! Ask me anything else about the site.</p>", chips: ["How much will it cost?", "Who is nearest to me?"] };
    }
    if (has(t, ["hi", "hello", "hey", "kumusta", "kamusta", "good morning", "good afternoon", "good evening", "musta"]) && t.length < 24) {
      var u = currentUser();
      return {
        html: "<p>Hello" + (u ? " " + esc(u.name.split(" ")[0]) : "") + "! I'm " + BOT_NAME + ", the SkillConnect assistant. Ask me about repair costs, the nearest worker, or how to post a job.</p>",
        chips: ["How much will it cost?", "Who is nearest to me?", "How do I submit a request?"]
      };
    }

    if (has(t, ["magkano", "how much", "cost", "price", "presyo", "bayad", "rate", "singil", "budget", "fee", "quote", "estimate"])) return answerCost(text);
    if (has(t, ["near", "nearest", "closest", "malapit", "pinakamalapit", "sino", "who can", "available worker", "who is available", "assign", "recommend", "best worker", "malapit sa akin"])) return answerNearest(text);
    if (has(t, ["map", "mapa", "location", "saan sila", "track", "distance", "layo"])) return answerMap();
    if (has(t, ["photo", "picture", "image", "larawan", "litrato", "upload", "attach"])) return answerPhotos();
    if (has(t, ["status", "ticket", "follow up", "my request", "requests ko", "saan na", "check my request", "update ng request"])) return answerStatus();
    if (has(t, ["cancel", "kanselahin", "withdraw"])) return answerCancel();
    if (has(t, ["verif", "certificate", "sertipiko", "credential", "legit", "trust", "scam", "licens", "tesda", "proof"])) return answerVerification();
    if (has(t, ["become a worker", "be a worker", "register as worker", "maging worker", "apply", "sign up as", "join as worker", "trabaho", "hanap trabaho", "job"]) && !has(t, ["job feed", "open job"])) return answerBecomeWorker();
    if (has(t, ["open job", "available request", "how many request", "pending request", "job feed", "ilan"])) return answerOpenJobs();
    if (has(t, ["how do i submit", "submit", "request a worker", "post a job", "paano", "how to", "how do i", "mag request", "magpaayos", "book"])) return answerHowToRequest();
    if (has(t, ["contact", "office", "hotline", "tawag", "barangay hall", "hours", "email", "number"])) return answerContact();
    if (has(t, ["free", "libre", "commission", "charge me", "bayad ba"])) {
      return { html: "<p>SkillConnect itself is <b>free</b> — no fee to register, post a request, or be listed. You only pay the worker directly for the repair.</p>", chips: ["How much will it cost?", "How do I submit a request?"] };
    }
    if (has(t, ["help", "tulong", "what can you do", "ano kaya mo", "ano ang magagawa"])) return answerHelp();

    // Last chance: if they described a broken thing, treat it as a cost question.
    var guessed = detectSkill(text);
    if (guessed) {
      ctx.skill = guessed;
      return {
        html: "<p>That sounds like a <b>" + esc(guessed) + "</b> job. Do you want the usual price range, or the nearest worker who can do it?</p>",
        chips: ["How much will it cost?", "Who is nearest to me?", "How do I submit a request?"]
      };
    }

    return {
      html: "<p>I'm not sure about that one yet — I'm a small barangay helper, not a search engine. Try one of these:</p>",
      chips: ["How much will it cost?", "Who is nearest to me?", "How do I submit a request?", "How does verification work?"]
    };
  }

  /* --------------------------------------------------------------- VIEW */
  var els = {};
  var mounted = false;

  function mount() {
    if (mounted) return;
    mounted = true;

    var wrap = document.createElement("div");
    wrap.className = "scbot";
    wrap.innerHTML =
      '<div class="scbot-panel" id="scbotPanel" role="dialog" aria-label="SkillConnect assistant" hidden>' +
        '<div class="scbot-head">' +
          '<img class="scbot-head-av" src="' + BOT_IMG + '" alt="">' +
          "<div class='scbot-head-txt'><b>" + BOT_NAME + "</b><span>SkillConnect assistant · always on</span></div>" +
          '<button class="scbot-close" id="scbotClose" aria-label="Close chat">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
          "</button>" +
        "</div>" +
        '<div class="scbot-body" id="scbotBody"></div>' +
        '<div class="scbot-chips" id="scbotChips"></div>' +
        '<form class="scbot-input" id="scbotForm">' +
          '<input id="scbotText" type="text" autocomplete="off" placeholder="Ask about price, nearest worker…" aria-label="Message">' +
          '<button type="submit" aria-label="Send">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12l16-8-6 8 6 8-16-8Z" fill="currentColor"/></svg>' +
          "</button>" +
        "</form>" +
      "</div>" +
      '<button class="scbot-fab" id="scbotFab" aria-label="Open the SkillConnect assistant">' +
        '<span class="scbot-fab-ping"></span>' +
        '<img src="' + BOT_IMG + '" alt="">' +
        '<span class="scbot-fab-badge">?</span>' +
      "</button>" +
      '<div class="scbot-teaser" id="scbotTeaser">Need help? Ask me the price or who\'s nearest.</div>';

    document.body.appendChild(wrap);

    els.panel = wrap.querySelector("#scbotPanel");
    els.body = wrap.querySelector("#scbotBody");
    els.chips = wrap.querySelector("#scbotChips");
    els.form = wrap.querySelector("#scbotForm");
    els.text = wrap.querySelector("#scbotText");
    els.fab = wrap.querySelector("#scbotFab");
    els.teaser = wrap.querySelector("#scbotTeaser");

    els.fab.addEventListener("click", function () { toggle(); });
    wrap.querySelector("#scbotClose").addEventListener("click", function () { toggle(false); });
    els.teaser.addEventListener("click", function () { toggle(true); });

    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = els.text.value.trim();
      if (!v) return;
      els.text.value = "";
      send(v);
    });

    setTimeout(function () { wrap.classList.add("is-ready"); }, 500);
    setTimeout(function () { els.teaser.classList.add("is-gone"); }, 9000);
  }

  function bubble(role, html) {
    var row = document.createElement("div");
    row.className = "scbot-msg scbot-msg-" + role;
    row.innerHTML = (role === "bot" ? '<img class="scbot-msg-av" src="' + BOT_IMG + '" alt="">' : "") +
      '<div class="scbot-bubble">' + html + "</div>";
    els.body.appendChild(row);
    els.body.scrollTop = els.body.scrollHeight;
    return row;
  }

  function setChips(list) {
    els.chips.innerHTML = (list || []).map(function (c) {
      return '<button type="button" class="scbot-chip">' + esc(c) + "</button>";
    }).join("");
    els.chips.querySelectorAll(".scbot-chip").forEach(function (b) {
      b.addEventListener("click", function () { send(b.textContent); });
    });
  }

  function typing() {
    return bubble("bot", '<span class="scbot-typing"><i></i><i></i><i></i></span>');
  }

  function navigateIfNeeded(text) {
    var t = text.toLowerCase();
    var here = location.pathname.split("/").pop();
    if (has(t, ["open find a worker"]) && here === "customer.html") {
      global.dispatchEvent(new CustomEvent("sc:section", { detail: "directory" }));
      return true;
    }
    if (has(t, ["check my requests"]) && here === "customer.html") {
      global.dispatchEvent(new CustomEvent("sc:section", { detail: "feed" }));
      return true;
    }
    if (has(t, ["post this as a request"]) && here === "customer.html") {
      global.dispatchEvent(new CustomEvent("sc:section", { detail: "new" }));
      return true;
    }
    return false;
  }

  function send(text) {
    bubble("me", esc(text));
    setChips([]);
    var t = typing();
    var jumped = navigateIfNeeded(text);
    setTimeout(function () {
      var res = answer(text);
      t.remove();
      bubble("bot", res.html + (jumped ? "<p class='scbot-note'>Opened that page for you.</p>" : ""));
      setChips(res.chips);
    }, 420 + Math.random() * 280);
  }

  function greet() {
    if (els.body.childElementCount) return;
    var u = currentUser();
    bubble("bot",
      "<p>Hi" + (u ? " " + esc(u.name.split(" ")[0]) : "") + "! I'm <b>" + BOT_NAME + "</b>, your SkillConnect assistant. 👋</p>" +
      "<p class='scbot-note'>Ask me things like <i>“magkano ang pagpapaayos ng aircon?”</i> or <i>“who is the nearest electrician?”</i></p>");
    setChips(["How much will it cost?", "Who is nearest to me?", "How do I submit a request?", "How does verification work?"]);
  }

  function toggle(force) {
    var open = force === undefined ? els.panel.hasAttribute("hidden") : force;
    if (open) {
      els.panel.removeAttribute("hidden");
      requestAnimationFrame(function () { els.panel.classList.add("is-open"); });
      els.teaser.classList.add("is-gone");
      els.fab.classList.add("is-open");
      greet();
      setTimeout(function () { els.text.focus(); }, 220);
    } else {
      els.panel.classList.remove("is-open");
      els.fab.classList.remove("is-open");
      setTimeout(function () { els.panel.setAttribute("hidden", ""); }, 200);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  global.SCBot = { open: function () { mount(); toggle(true); }, ask: function (q) { mount(); toggle(true); send(q); }, answer: answer };
})(window);
