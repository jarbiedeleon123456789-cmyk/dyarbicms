(function () {
  "use strict";

  var SAMPLE_TESTIMONIALS = [
    { quote: "Our karaoke machine broke down two days before the fiesta. I found a technician through SkillConnect the same afternoon.", authorName: "Marites Aquino", authorRole: "Resident, Brgy. Guinobatan", initials: "MA" },
    { quote: "I used to only get jobs from neighbors who already knew me. Now the barangay sends requests straight to my phone.", authorName: "Jun Marasigan", authorRole: "Welder, Brgy. Bayanan I", initials: "JM" },
    { quote: "We finally have an actual record of who's available instead of relying on whoever people remember to call.", authorName: "Barangay Kagawad Torres", authorRole: "PESO Desk, Oriental Mindoro", initials: "BT" },
    { quote: "The ticket number made it easy to follow up. I knew exactly who to ask about my request at the office.", authorName: "Danilo Reyes", authorRole: "Resident, Brgy. Camansihan", initials: "DR" }
  ];

  var SAMPLE_FAQS = [
    { question: "Is SkillConnect free for residents?", answer: "Yes. Creating an account and submitting a service request costs nothing. The barangay runs this as a community service, not a marketplace." },
    { question: "How do workers get verified?", answer: "Workers register for free, then visit the barangay or PESO office with a valid ID. Staff confirm their identity and skill category before the profile goes public." },
    { question: "What if no worker is available for my skill category?", answer: "Your request stays on file and you'll see it update in your feed as soon as a matching worker becomes available or is verified." },
    { question: "Can I request a worker from another barangay?", answer: "Yes, if no one in your barangay covers that skill. Staff can match the closest available verified worker." },
    { question: "Can I switch from resident to worker later?", answer: "Create a separate worker account with the same details — this keeps your resident request history and worker job history cleanly separated." }
  ];

  /* ---------------------------- NAV ---------------------------- */
  var nav = document.getElementById("nav");
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  function onScroll() {
    if (window.scrollY > 24) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  navToggle.addEventListener("click", function () {
    var open = navToggle.classList.toggle("is-open");
    navLinks.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  navLinks.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      navToggle.classList.remove("is-open");
      navLinks.classList.remove("is-open");
    });
  });

  /* ------------------------ HERO REVEAL ------------------------ */
  var heroCopy = document.getElementById("heroCopy");
  requestAnimationFrame(function () { setTimeout(function () { heroCopy.classList.add("is-ready"); }, 60); });
  document.getElementById("heroVisual").classList.add("is-ready");

  window.addEventListener("mousemove", function (e) {
    var dx = (e.clientX / window.innerWidth - 0.5);
    var dy = (e.clientY / window.innerHeight - 0.5);
    document.querySelectorAll("[data-parallax]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-parallax")) || 10;
      el.style.transform = "translate(" + (dx * strength) + "px," + (dy * strength) + "px)";
    });
  });

  function animateCounters() {
    document.querySelectorAll("[data-count]").forEach(function (el) {
      var target = parseInt(el.getAttribute("data-count"), 10);
      var start = null;
      var duration = 1100;
      function step(ts) {
        if (!start) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  animateCounters();

  /* --------------------------- MARQUEE -------------------------- */
  var marqueeItems = DB.SKILL_CATEGORIES;
  var track = document.getElementById("marqueeTrack");
  var toolIcon = '<svg viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4-1.4l7-7a1 1 0 0 1 1.4 0Z" fill="currentColor"/></svg>';
  var marqueeHtml = marqueeItems.map(function (item) { return "<span>" + toolIcon + item + "</span>"; }).join("");
  track.innerHTML = marqueeHtml + marqueeHtml;

  /* ------------------------ DIRECTORY PREVIEW ------------------------ */
  var filterRow = document.getElementById("filterRow");
  var ticketGrid = document.getElementById("ticketGrid");
  var activeFilter = "All";
  var CATS = ["All"].concat(DB.SKILL_CATEGORIES);

  function starIcon() {
    return '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l2.6 5.9 6.4.6-4.8 4.2 1.4 6.3-5.6-3.4-5.6 3.4 1.4-6.3-4.8-4.2 6.4-.6z"/></svg>';
  }

  function renderFilters() {
    filterRow.innerHTML = CATS.map(function (cat) {
      var active = cat === activeFilter ? " is-active" : "";
      return '<button class="filter-chip' + active + '" data-cat="' + cat + '">' + cat + "</button>";
    }).join("");
    filterRow.querySelectorAll(".filter-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeFilter = btn.getAttribute("data-cat");
        renderFilters();
        renderWorkers();
      });
    });
  }

  function renderWorkers() {
    var workers = DB.getWorkers();
    var list = (activeFilter === "All" ? workers : workers.filter(function (w) { return w.skillCategory === activeFilter; })).slice(0, 6);
    ticketGrid.innerHTML = list.map(function (w) {
      var statusClass = w.verified ? "verified" : "pending";
      var statusLabel = w.verified ? "Verified" : "Pending";
      return (
        '<article class="ticket">' +
          '<div class="ticket-top">' +
            '<div class="ticket-avatar">' + DB.initials(w.name) + "</div>" +
            "<div><div class='ticket-name'>" + w.name + "</div><div class='ticket-loc'>Brgy. " + w.barangay + "</div></div>" +
            "<span class='ticket-status " + statusClass + "'>" + statusLabel + "</span>" +
          "</div>" +
          "<span class='ticket-skill'>" + w.skillCategory + "</span>" +
          "<p class='ticket-bio'>" + (w.bio || "") + "</p>" +
          "<div class='ticket-foot'>" +
            "<div class='ticket-rating'>" + starIcon() + "<span>" + (w.rating ? w.rating.toFixed(1) : "New") + " (" + (w.jobs || 0) + " jobs)</span></div>" +
            "<a href='register.html' class='ticket-link'>Request &rsaquo;</a>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  renderFilters();
  renderWorkers();

  /* ------------------------ ANNOUNCEMENTS ------------------------ */
  var announceGrid = document.getElementById("announceGrid");
  announceGrid.innerHTML = DB.getAnnouncements().map(function (a) {
    return (
      "<article class='announce-card'>" +
        "<div class='announce-meta'><span class='cat'>" + a.category + "</span><span>" + a.date + "</span></div>" +
        "<h4>" + a.title + "</h4>" +
        "<p>" + a.body + "</p>" +
      "</article>"
    );
  }).join("");

  /* ------------------------ TESTIMONIALS ------------------------ */
  var testiTrack = document.getElementById("testiTrack");
  testiTrack.innerHTML = SAMPLE_TESTIMONIALS.map(function (t) {
    return (
      "<article class='testi-card'>" +
        "<p class='testi-quote'>" + t.quote + "</p>" +
        "<div class='testi-person'>" +
          "<div class='testi-avatar'>" + t.initials + "</div>" +
          "<div><div class='testi-name'>" + t.authorName + "</div><div class='testi-role'>" + t.authorRole + "</div></div>" +
        "</div>" +
      "</article>"
    );
  }).join("");
  document.getElementById("testiNext").addEventListener("click", function () { testiTrack.scrollBy({ left: 360, behavior: "smooth" }); });
  document.getElementById("testiPrev").addEventListener("click", function () { testiTrack.scrollBy({ left: -360, behavior: "smooth" }); });

  /* ---------------------------- FAQ ---------------------------- */
  var faqList = document.getElementById("faqList");
  faqList.innerHTML = SAMPLE_FAQS.map(function (f, i) {
    return (
      "<div class='faq-item' data-i='" + i + "'>" +
        "<button class='faq-q' aria-expanded='false'>" + f.question +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        "</button>" +
        "<div class='faq-a'><p>" + f.answer + "</p></div>" +
      "</div>"
    );
  }).join("");
  faqList.querySelectorAll(".faq-item").forEach(function (item) {
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    q.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");
      faqList.querySelectorAll(".faq-item.is-open").forEach(function (openItem) {
        openItem.classList.remove("is-open");
        openItem.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        openItem.querySelector(".faq-a").style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("is-open");
        q.setAttribute("aria-expanded", "true");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  /* ------------------------ SCROLL REVEAL ------------------------ */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }
})();
