/* ==========================================================================
   SKILLCONNECT — MOCK DATABASE LAYER
   ==========================================================================
   Everything here is plain JavaScript backed by localStorage, so the whole
   app runs from static files with no server. It is written so that later
   you can swap each function's body for a real fetch() to Strapi (or any
   API) without touching the pages that call it — every page only ever
   talks to the `DB` object below.
   ========================================================================== */
(function (global) {
  "use strict";

  var STORE_KEY = "skillconnect_v2";
  function getStrapiBaseUrl() {
    var defaultUrl = global.location && global.location.hostname !== "localhost" && global.location.hostname !== "127.0.0.1"
      ? "https://skillconnect-api-l18c.onrender.com"
      : "http://localhost:1337";
    var configured = global.STRAPI_API_URL || localStorage.getItem("sc_strapi_url") || defaultUrl;
    return String(configured).replace(/\/+$/, "");
  }
  var STRAPI_API = getStrapiBaseUrl();
  var STRAPI_REMOTE_MARKER = "sc_strapi_remote_v1";

  var SKILL_CATEGORIES = ["Electronics", "Appliance Repair", "Electrical", "Welding", "Plumbing", "Small Engine Repair"];

  var BARANGAYS = ["Guinobatan", "Camansihan", "Bayanan I", "Lumangbayan", "Sta. Isabel", "San Vicente"];

  /* --------------------------------------------------------------------
     GEOGRAPHY
     Approximate coordinates for barangays in Calapan City, Oriental
     Mindoro. Close enough for the map + "nearest worker" demo; replace
     them with surveyed coordinates before any real deployment.
     -------------------------------------------------------------------- */
  var BARANGAY_GEO = {
    "Guinobatan":  { lat: 13.4262, lng: 121.1734 },
    "Camansihan":  { lat: 13.3947, lng: 121.1624 },
    "Bayanan I":   { lat: 13.3865, lng: 121.1902 },
    "Lumangbayan": { lat: 13.4098, lng: 121.2010 },
    "Sta. Isabel": { lat: 13.4160, lng: 121.1516 },
    "San Vicente": { lat: 13.4116, lng: 121.1806 }
  };

  // Bounding box the SVG map draws inside.
  var MAP_BOUNDS = { minLat: 13.3770, maxLat: 13.4350, minLng: 121.1420, maxLng: 121.2110 };

  /* --------------------------------------------------------------------
     RATE CARD — indicative barangay rates in PHP. The chatbot quotes from
     this, and worker profiles fall back to it when they have not set a
     rate of their own.
     -------------------------------------------------------------------- */
  var RATE_CARD = {
    "Electronics": {
      visit: [200, 350],
      jobs: [
        { label: "TV / monitor no-power repair", min: 600, max: 2200 },
        { label: "Karaoke or amplifier repair", min: 500, max: 1800 },
        { label: "Phone charging port replacement", min: 450, max: 1200 },
        { label: "Speaker re-coning / rewire", min: 400, max: 1500 }
      ],
      note: "Parts are billed separately — most technicians quote the final price after a free diagnosis."
    },
    "Appliance Repair": {
      visit: [250, 400],
      jobs: [
        { label: "Washing machine not spinning", min: 800, max: 2800 },
        { label: "Refrigerator not cooling (freon recharge)", min: 1500, max: 3500 },
        { label: "Electric fan rewind", min: 350, max: 900 },
        { label: "Rice cooker / microwave repair", min: 300, max: 1100 }
      ],
      note: "Compressor and motor replacements cost more; ask for a written quotation first."
    },
    "Electrical": {
      visit: [250, 400],
      jobs: [
        { label: "Breaker keeps tripping (troubleshoot)", min: 600, max: 1500 },
        { label: "New outlet or switch installation", min: 350, max: 800 },
        { label: "Light fixture / chandelier install", min: 500, max: 1500 },
        { label: "House rewiring (per room)", min: 2500, max: 6000 }
      ],
      note: "Anything touching the main panel should only be done by a verified electrician."
    },
    "Welding": {
      visit: [300, 500],
      jobs: [
        { label: "Gate hinge or latch re-weld", min: 800, max: 2000 },
        { label: "Window grill fabrication (per sq.m.)", min: 1200, max: 2500 },
        { label: "Steel railing repair", min: 900, max: 2600 },
        { label: "Water tank stand fabrication", min: 3500, max: 9000 }
      ],
      note: "Fabrication prices usually exclude the steel; confirm whether materials are included."
    },
    "Plumbing": {
      visit: [200, 350],
      jobs: [
        { label: "Leaking faucet or pipe repair", min: 400, max: 1200 },
        { label: "Clogged drain / toilet snaking", min: 500, max: 1500 },
        { label: "Water closet installation", min: 800, max: 2000 },
        { label: "Water line re-route (per meter)", min: 250, max: 600 }
      ],
      note: "Emergency night calls are usually charged an extra ₱200–₱400."
    },
    "Small Engine Repair": {
      visit: [200, 350],
      jobs: [
        { label: "Motorcycle tune-up", min: 400, max: 1200 },
        { label: "Water pump / generator repair", min: 600, max: 2500 },
        { label: "Grass cutter carburetor cleaning", min: 350, max: 900 },
        { label: "Chainsaw servicing", min: 500, max: 1600 }
      ],
      note: "Oil, filters and spark plugs are charged on top of labor."
    }
  };

  function uid(prefix) {
    return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 9);
  }

  var ticketSeq = 1000;
  function ticketId() {
    ticketSeq += 1 + Math.floor(Math.random() * 4);
    return "SC-" + ticketSeq;
  }

  function initials(name) {
    return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("");
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function daysAgo(n, hour) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour || 9, Math.floor(Math.random() * 59), 0, 0);
    return d.toISOString();
  }

  function daysAhead(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Scatter a point around a barangay centre so pins don't stack.
  function near(barangay, dx, dy) {
    var c = BARANGAY_GEO[barangay] || BARANGAY_GEO["San Vicente"];
    return { lat: +(c.lat + (dy || 0)).toFixed(5), lng: +(c.lng + (dx || 0)).toFixed(5) };
  }

  // Great-circle distance in kilometres.
  function distanceKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    var R = 6371;
    var toRad = function (v) { return (v * Math.PI) / 180; };
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function seedData() {
    var g;

    function C(id, name, email, barangay, phone) {
      g = near(barangay, (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004);
      return { id: id, name: name, email: email, password: "customer123", role: "customer", barangay: barangay, phone: phone, createdAt: nowISO(), lat: g.lat, lng: g.lng };
    }

    function W(o) {
      g = near(o.barangay, (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004);
      o.email = o.email || (o.name.split(" ")[0].toLowerCase() + "@skillconnect.ph");
      o.password = "worker123";
      o.role = "worker";
      o.createdAt = nowISO();
      o.lat = g.lat;
      o.lng = g.lng;
      o.certificates = o.certificates || [];
      o.works = o.works || [];
      return o;
    }

    var users = [
      { id: "u_admin", name: "Kagawad Elena Torres", email: "admin@skillconnect.ph", password: "admin123", role: "admin", barangay: "Guinobatan", createdAt: nowISO() },

      C("u_cust1", "Marites Aquino", "maria@gmail.com", "Guinobatan", "0917 200 1122"),
      C("u_cust2", "Danilo Reyes", "danilo@gmail.com", "Camansihan", "0917 555 8890"),
      C("u_cust3", "Luzviminda Ocampo", "luz@gmail.com", "Lumangbayan", "0918 771 3341"),
      C("u_cust4", "Rogelio Bautista", "roger@gmail.com", "Bayanan I", "0916 220 7734"),
      C("u_cust5", "Cristina Malabanan", "cristina@gmail.com", "Sta. Isabel", "0919 448 9012"),
      C("u_cust6", "Arnel Pascual", "arnel@gmail.com", "San Vicente", "0917 889 4410"),

      W({ id: "u_w1", name: "Ramon Dela Cruz", email: "ramon@skillconnect.ph", barangay: "Guinobatan", phone: "0918 442 1190",
        skillCategory: "Electronics", verified: true, rating: 4.9, jobs: 32, availability: "available",
        bio: "TV, karaoke, and small appliance repair. 12 years experience.", rateMin: 500, rateMax: 2200,
        certificates: [
          { id: "c_w1a", title: "TESDA NC II — Consumer Electronics Servicing", issuer: "TESDA Oriental Mindoro", year: "2015", image: null },
          { id: "c_w1b", title: "Barangay Verification Slip", issuer: "PESO Calapan", year: "2026", image: null }
        ],
        works: [
          { id: "p_w1a", caption: "Rebuilt a karaoke amplifier board", image: "assets/img/workshop.jpg" },
          { id: "p_w1b", caption: "Bench testing a repaired power supply", image: "assets/img/worker-grinder.jpg" }
        ] }),

      W({ id: "u_w2", name: "Fe Santos", email: "fe@skillconnect.ph", barangay: "Camansihan", phone: "0918 220 4471",
        skillCategory: "Electrical", verified: true, rating: 4.8, jobs: 27, availability: "available",
        bio: "Household wiring, breaker issues, and outlet installs.", rateMin: 600, rateMax: 3000,
        certificates: [
          { id: "c_w2a", title: "TESDA NC II — Electrical Installation & Maintenance", issuer: "TESDA", year: "2018", image: null },
          { id: "c_w2b", title: "Registered Master Electrician (RME)", issuer: "PRC", year: "2021", image: null }
        ],
        works: [{ id: "p_w2a", caption: "Panel board re-labelling and breaker replacement", image: "assets/img/workshop.jpg" }] }),

      W({ id: "u_w3", name: "Jun Marasigan", email: "jun@skillconnect.ph", barangay: "Bayanan I", phone: "0917 903 2201",
        skillCategory: "Welding", verified: true, rating: 5.0, jobs: 19, availability: "busy",
        bio: "Gate repair, metal fabrication, and welding jobs.", rateMin: 800, rateMax: 9000,
        certificates: [{ id: "c_w3a", title: "TESDA NC II — SMAW (Shielded Metal Arc Welding)", issuer: "TESDA", year: "2017", image: null }],
        works: [
          { id: "p_w3a", caption: "Fabricated steel gate frame", image: "assets/img/hero-welder.jpg" },
          { id: "p_w3b", caption: "Grinding welds flush on a railing job", image: "assets/img/worker-grinder.jpg" }
        ] }),

      W({ id: "u_w4", name: "Rico Villanueva", email: "rico@skillconnect.ph", barangay: "Lumangbayan", phone: "0916 771 0043",
        skillCategory: "Appliance Repair", verified: false, rating: 4.6, jobs: 8, availability: "available",
        bio: "Washing machines and refrigerators. Pending verification.", rateMin: 600, rateMax: 3200 }),

      W({ id: "u_w5", name: "Liza Camacho", email: "liza@skillconnect.ph", barangay: "Guinobatan", phone: "0919 330 6612",
        skillCategory: "Plumbing", verified: true, rating: 4.7, jobs: 21, availability: "offline",
        bio: "Leaks, clogged pipes, and faucet installation.", rateMin: 400, rateMax: 2000,
        certificates: [{ id: "c_w5a", title: "TESDA NC II — Plumbing", issuer: "TESDA", year: "2019", image: null }],
        works: [{ id: "p_w5a", caption: "Replaced a corroded supply line under a kitchen sink", image: "assets/img/workshop.jpg" }] }),

      W({ id: "u_w6", name: "Boy Reyes", email: "boy@skillconnect.ph", barangay: "Camansihan", phone: "0917 664 5528",
        skillCategory: "Electronics", verified: true, rating: 4.9, jobs: 40, availability: "available",
        bio: "Phones, speakers, and small electronics of any brand.", rateMin: 450, rateMax: 1800,
        certificates: [{ id: "c_w6a", title: "TESDA NC II — Consumer Electronics Servicing", issuer: "TESDA", year: "2014", image: null }],
        works: [{ id: "p_w6a", caption: "Micro-soldering a phone charging port", image: "assets/img/worker-grinder.jpg" }] }),

      W({ id: "u_w7", name: "Ernesto Gutierrez", email: "ernesto@skillconnect.ph", barangay: "San Vicente", phone: "0918 004 7719",
        skillCategory: "Small Engine Repair", verified: true, rating: 4.8, jobs: 24, availability: "available",
        bio: "Motorcycles, water pumps, generators, and grass cutters.", rateMin: 350, rateMax: 2500,
        certificates: [{ id: "c_w7a", title: "TESDA NC II — Small Engine Servicing", issuer: "TESDA", year: "2016", image: null }],
        works: [{ id: "p_w7a", caption: "Overhauled a barangay water pump", image: "assets/img/workshop.jpg" }] }),

      W({ id: "u_w8", name: "Melvin Aguinaldo", email: "melvin@skillconnect.ph", barangay: "Sta. Isabel", phone: "0917 335 2288",
        skillCategory: "Plumbing", verified: true, rating: 4.6, jobs: 15, availability: "available",
        bio: "Septic lines, water meters, and bathroom installations.", rateMin: 450, rateMax: 2200 }),

      W({ id: "u_w9", name: "Grace Dimaano", email: "grace@skillconnect.ph", barangay: "Lumangbayan", phone: "0916 559 3301",
        skillCategory: "Appliance Repair", verified: true, rating: 4.9, jobs: 31, availability: "available",
        bio: "Aircon cleaning, refrigerators, and washing machines.", rateMin: 500, rateMax: 3500,
        certificates: [{ id: "c_w9a", title: "TESDA NC II — RAC Servicing (Domestic)", issuer: "TESDA", year: "2020", image: null }],
        works: [{ id: "p_w9a", caption: "Split-type aircon deep cleaning", image: "assets/img/workshop.jpg" }] }),

      W({ id: "u_w10", name: "Dante Almazan", email: "dante@skillconnect.ph", barangay: "Bayanan I", phone: "0919 776 1140",
        skillCategory: "Electrical", verified: true, rating: 4.5, jobs: 12, availability: "busy",
        bio: "Sub-meter installation and lighting for small shops.", rateMin: 500, rateMax: 2800 }),

      W({ id: "u_w11", name: "Noel Ferrer", email: "noel@skillconnect.ph", barangay: "San Vicente", phone: "0918 662 5590",
        skillCategory: "Welding", verified: false, rating: 4.4, jobs: 6, availability: "available",
        bio: "Grills, railings, and steel furniture. Pending verification.", rateMin: 700, rateMax: 5000 }),

      W({ id: "u_w12", name: "Alvin Sarmiento", email: "alvin@skillconnect.ph", barangay: "Sta. Isabel", phone: "0917 118 6673",
        skillCategory: "Small Engine Repair", verified: true, rating: 4.7, jobs: 18, availability: "offline",
        bio: "Tricycle engines, chainsaws, and farm equipment.", rateMin: 400, rateMax: 2400 })
    ];

    function R(o) {
      var p = near(o.barangay, (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004);
      o.id = uid("req");
      o.ticketId = ticketId();
      o.lat = p.lat;
      o.lng = p.lng;
      if (!o.photos) o.photos = [];
      if (o.workerId === undefined) { o.workerId = null; o.workerName = null; }
      return o;
    }

    var requests = [
      /* ---- history and jobs already in flight ---- */
      R({ customerId: "u_cust1", customerName: "Marites Aquino", barangay: "Guinobatan", contactNumber: "0917 200 1122",
        skillNeeded: "Electronics", description: "Karaoke machine won't power on, need it fixed before the weekend.", preferredDate: daysAhead(3),
        status: "completed", workerId: "u_w1", workerName: "Ramon Dela Cruz", rating: 5, createdAt: daysAgo(15, 9),
        photos: ["assets/img/workshop.jpg"] }),

      R({ customerId: "u_cust2", customerName: "Danilo Reyes", barangay: "Camansihan", contactNumber: "0917 555 8890",
        skillNeeded: "Electrical", description: "Breaker keeps tripping whenever the aircon turns on.", preferredDate: daysAhead(2),
        status: "working", workerId: "u_w2", workerName: "Fe Santos", createdAt: daysAgo(7, 13) }),

      R({ customerId: "u_cust1", customerName: "Marites Aquino", barangay: "Guinobatan", contactNumber: "0917 200 1122",
        skillNeeded: "Welding", description: "Front gate hinge broke, needs re-welding and a new latch.", preferredDate: daysAhead(5),
        status: "accepted", workerId: "u_w3", workerName: "Jun Marasigan", createdAt: daysAgo(4, 8),
        photos: ["assets/img/hero-welder.jpg"] }),

      R({ customerId: "u_cust3", customerName: "Luzviminda Ocampo", barangay: "Lumangbayan", contactNumber: "0918 771 3341",
        skillNeeded: "Appliance Repair", description: "Aircon compressor runs but the room never gets cold.", preferredDate: daysAhead(1),
        status: "working", workerId: "u_w9", workerName: "Grace Dimaano", createdAt: daysAgo(3, 10) }),

      R({ customerId: "u_cust4", customerName: "Rogelio Bautista", barangay: "Bayanan I", contactNumber: "0916 220 7734",
        skillNeeded: "Small Engine Repair", description: "Tricycle engine overheats after 20 minutes of driving.", preferredDate: daysAhead(2),
        status: "completed", workerId: "u_w7", workerName: "Ernesto Gutierrez", rating: 5, createdAt: daysAgo(20, 15) }),

      R({ customerId: "u_cust5", customerName: "Cristina Malabanan", barangay: "Sta. Isabel", contactNumber: "0919 448 9012",
        skillNeeded: "Plumbing", description: "Comfort room flush tank keeps running, water bill doubled.", preferredDate: daysAhead(4),
        status: "accepted", workerId: "u_w8", workerName: "Melvin Aguinaldo", createdAt: daysAgo(2, 11) }),

      /* ---- open jobs waiting for a worker ---- */
      R({ customerId: "u_cust2", customerName: "Danilo Reyes", barangay: "Camansihan", contactNumber: "0917 555 8890",
        skillNeeded: "Plumbing", description: "Kitchen faucet leaking continuously, water bill going up.", preferredDate: daysAhead(4), status: "pending", createdAt: daysAgo(1, 16) }),

      R({ customerId: "u_cust1", customerName: "Marites Aquino", barangay: "Guinobatan", contactNumber: "0917 200 1122",
        skillNeeded: "Appliance Repair", description: "Washing machine drum not spinning, makes a grinding sound.", preferredDate: daysAhead(6), status: "pending", createdAt: daysAgo(1, 11) }),

      R({ customerId: "u_cust3", customerName: "Luzviminda Ocampo", barangay: "Lumangbayan", contactNumber: "0918 771 3341",
        skillNeeded: "Electronics", description: "Smart TV has sound but no picture, screen stays black.", preferredDate: daysAhead(3), status: "pending", createdAt: daysAgo(0, 8) }),

      R({ customerId: "u_cust4", customerName: "Rogelio Bautista", barangay: "Bayanan I", contactNumber: "0916 220 7734",
        skillNeeded: "Electrical", description: "Half of the house lost power after the storm, only one line works.", preferredDate: daysAhead(1), status: "pending", createdAt: daysAgo(0, 7) }),

      R({ customerId: "u_cust5", customerName: "Cristina Malabanan", barangay: "Sta. Isabel", contactNumber: "0919 448 9012",
        skillNeeded: "Welding", description: "Window grills are rusted through at the bottom, need patch welding.", preferredDate: daysAhead(7), status: "pending", createdAt: daysAgo(2, 14) }),

      R({ customerId: "u_cust6", customerName: "Arnel Pascual", barangay: "San Vicente", contactNumber: "0917 889 4410",
        skillNeeded: "Small Engine Repair", description: "Water pump motor hums but won't draw water anymore.", preferredDate: daysAhead(2), status: "pending", createdAt: daysAgo(0, 17) }),

      R({ customerId: "u_cust6", customerName: "Arnel Pascual", barangay: "San Vicente", contactNumber: "0917 889 4410",
        skillNeeded: "Electronics", description: "Bluetooth speaker charges but shuts off after a minute.", preferredDate: daysAhead(5), status: "pending", createdAt: daysAgo(3, 12) }),

      R({ customerId: "u_cust2", customerName: "Danilo Reyes", barangay: "Camansihan", contactNumber: "0917 555 8890",
        skillNeeded: "Electrical", description: "Need two extra outlets installed in the sari-sari store.", preferredDate: daysAhead(8), status: "pending", createdAt: daysAgo(2, 9) }),

      R({ customerId: "u_cust3", customerName: "Luzviminda Ocampo", barangay: "Lumangbayan", contactNumber: "0918 771 3341",
        skillNeeded: "Plumbing", description: "Bathroom drain clogged, water backs up into the shower area.", preferredDate: daysAhead(1), status: "pending", createdAt: daysAgo(0, 6) }),

      R({ customerId: "u_cust4", customerName: "Rogelio Bautista", barangay: "Bayanan I", contactNumber: "0916 220 7734",
        skillNeeded: "Appliance Repair", description: "Refrigerator freezer ices over and the lower shelf stays warm.", preferredDate: daysAhead(4), status: "pending", createdAt: daysAgo(4, 10) }),

      R({ customerId: "u_cust5", customerName: "Cristina Malabanan", barangay: "Sta. Isabel", contactNumber: "0919 448 9012",
        skillNeeded: "Electronics", description: "Old amplifier hums loudly and one channel has no sound.", preferredDate: daysAhead(6), status: "pending", createdAt: daysAgo(5, 15) }),

      R({ customerId: "u_cust1", customerName: "Marites Aquino", barangay: "Guinobatan", contactNumber: "0917 200 1122",
        skillNeeded: "Small Engine Repair", description: "Grass cutter starts then dies, carburetor may need cleaning.", preferredDate: daysAhead(3), status: "pending", createdAt: daysAgo(1, 13) }),

      R({ customerId: "u_cust6", customerName: "Arnel Pascual", barangay: "San Vicente", contactNumber: "0917 889 4410",
        skillNeeded: "Welding", description: "Water tank stand is wobbling, two joints look cracked.", preferredDate: daysAhead(9), status: "pending", createdAt: daysAgo(6, 8),
        photos: ["assets/img/worker-grinder.jpg"] }),

      R({ customerId: "u_cust2", customerName: "Danilo Reyes", barangay: "Camansihan", contactNumber: "0917 555 8890",
        skillNeeded: "Appliance Repair", description: "Electric fan wobbles and smells like burnt rubber when running.", preferredDate: daysAhead(2), status: "pending", createdAt: daysAgo(0, 19) }),

      R({ customerId: "u_cust3", customerName: "Luzviminda Ocampo", barangay: "Lumangbayan", contactNumber: "0918 771 3341",
        skillNeeded: "Electrical", description: "Ceiling light flickers and the switch feels warm to the touch.", preferredDate: daysAhead(1), status: "pending", createdAt: daysAgo(0, 20) }),

      R({ customerId: "u_cust4", customerName: "Rogelio Bautista", barangay: "Bayanan I", contactNumber: "0916 220 7734",
        skillNeeded: "Plumbing", description: "Water meter area is leaking, a small puddle forms every morning.", preferredDate: daysAhead(3), status: "pending", createdAt: daysAgo(3, 7) }),

      R({ customerId: "u_cust5", customerName: "Cristina Malabanan", barangay: "Sta. Isabel", contactNumber: "0919 448 9012",
        skillNeeded: "Small Engine Repair", description: "Generator won't start after being stored for the rainy season.", preferredDate: daysAhead(5), status: "pending", createdAt: daysAgo(2, 16) }),

      R({ customerId: "u_cust6", customerName: "Arnel Pascual", barangay: "San Vicente", contactNumber: "0917 889 4410",
        skillNeeded: "Electrical", description: "Want a proper breaker box installed, the current one still uses fuses.", preferredDate: daysAhead(10), status: "pending", createdAt: daysAgo(7, 11) }),

      R({ customerId: "u_cust1", customerName: "Marites Aquino", barangay: "Guinobatan", contactNumber: "0917 200 1122",
        skillNeeded: "Welding", description: "Need a small steel table welded for the carinderia.", preferredDate: daysAhead(12), status: "pending", createdAt: daysAgo(5, 9) }),

      R({ customerId: "u_cust2", customerName: "Danilo Reyes", barangay: "Camansihan", contactNumber: "0917 555 8890",
        skillNeeded: "Electronics", description: "CCTV monitor shows no signal on two of the four cameras.", preferredDate: daysAhead(2), status: "pending", createdAt: daysAgo(1, 18) }),

      R({ customerId: "u_cust5", customerName: "Cristina Malabanan", barangay: "Sta. Isabel", contactNumber: "0919 448 9012",
        skillNeeded: "Appliance Repair", description: "Rice cooker keeps switching to warm before the rice is done.", preferredDate: daysAhead(4), status: "pending", createdAt: daysAgo(4, 13) }),

      R({ customerId: "u_cust3", customerName: "Luzviminda Ocampo", barangay: "Lumangbayan", contactNumber: "0918 771 3341",
        skillNeeded: "Welding", description: "Gate wheel snapped off the track, needs to be re-welded.", preferredDate: daysAhead(6), status: "pending", createdAt: daysAgo(6, 15) }),

      R({ customerId: "u_cust4", customerName: "Rogelio Bautista", barangay: "Bayanan I", contactNumber: "0916 220 7734",
        skillNeeded: "Electronics", description: "Laptop charger port is loose, only charges at a certain angle.", preferredDate: daysAhead(3), status: "pending", createdAt: daysAgo(2, 10) }),

      R({ customerId: "u_cust6", customerName: "Arnel Pascual", barangay: "San Vicente", contactNumber: "0917 889 4410",
        skillNeeded: "Plumbing", description: "Need a new water closet installed in the back comfort room.", preferredDate: daysAhead(7), status: "pending", createdAt: daysAgo(4, 8) })
    ];

    var announcements = [
      { id: uid("ann"), category: "Program", date: "Sep 2, 2026", title: "SkillConnect pilot opens in Barangay Guinobatan", body: "Residents can now submit repair requests directly at the barangay hall or through this site." },
      { id: uid("ann"), category: "Registration", date: "Aug 26, 2026", title: "Worker registration now open for electricians and welders", body: "Bring a valid ID to the PESO desk to begin verification. Registration is free." },
      { id: uid("ann"), category: "Office hours", date: "Aug 18, 2026", title: "Saturday hours extended for worker verification", body: "The barangay office will process worker applications until 12 PM on Saturdays this month." }
    ];

    return { users: users, requests: requests, announcements: announcements, session: null };
  }

  function read() {
    if (isStrapiMode() && localStorage.getItem(STRAPI_REMOTE_MARKER) !== "true") {
      localStorage.removeItem(STORE_KEY);
      localStorage.setItem(STRAPI_REMOTE_MARKER, "true");
    }
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (!raw) {
      var seeded = seedData();
      write(seeded);
      return seeded;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      var fresh = seedData();
      write(fresh);
      return fresh;
    }
  }

  function isStrapiMode() {
    var enabled = String(localStorage.getItem("sc_use_strapi") || "").toLowerCase() === "true";
    var configuredUrl = global.STRAPI_API_URL || localStorage.getItem("sc_strapi_url") || "";
    if (!configuredUrl && global.location && global.location.hostname !== "localhost" && global.location.hostname !== "127.0.0.1") {
      configuredUrl = "https://skillconnect-api-l18c.onrender.com";
    }
    var hasUrl = Boolean(configuredUrl);
    if (hasUrl) {
      try {
        var apiHost = new URL(configuredUrl, global.location.href).hostname;
        var pageHost = global.location.hostname;
        var localApi = apiHost === "localhost" || apiHost === "127.0.0.1";
        var localPage = !pageHost || pageHost === "localhost" || pageHost === "127.0.0.1";
        if (localApi && !localPage) return false;
      } catch (e) {
        return false;
      }
    }
    return enabled || hasUrl;
  }

  function apiHeaders() {
    var headers = { "Content-Type": "application/json" };
    var jwt = localStorage.getItem("sc_jwt");
    if (jwt) headers.Authorization = "Bearer " + jwt;
    return headers;
  }

  function apiRequest(path, options) {
    options = options || {};
    var baseUrl = getStrapiBaseUrl();
    var headers = Object.assign({}, apiHeaders(), options.headers || {});
    var finalOptions = Object.assign({}, options, { headers: headers });
    return fetch(baseUrl + path, finalOptions).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (body) {
          var msg = body && body.error && body.error.message ? body.error.message : "Request failed.";
          throw new Error(msg);
        }, function () {
          throw new Error("Request failed.");
        });
      }
      return res.text().then(function (text) {
        return text ? JSON.parse(text) : null;
      });
    });
  }

  function normalizeStrapiUser(raw) {
    if (!raw) return null;
    var data = raw.attributes ? raw.attributes : raw;
    var out = Object.assign({}, data, {
      id: raw.id || data.id || data._id || null,
      role: data.role && typeof data.role === "object" ? data.role.name || data.role.type || data.role : data.role || "customer",
      initials: data.initials || (data.name ? DB.initials(data.name) : "")
    });
    if (out.role === "authenticated") out.role = "customer";
    return out;
  }

  function normalizeStrapiRequest(raw) {
    if (!raw) return null;
    var data = raw.attributes ? raw.attributes : raw;
    var obj = Object.assign({}, data, {
      id: raw.id || data.id || data._id || null,
      documentId: raw.documentId || data.documentId || null,
      photos: Array.isArray(data.photos) ? data.photos.map(function (p) { return p.url ? (p.url.startsWith("http") ? p.url : STRAPI_API + p.url) : p; }) : (data.photos || []),
      customerId: data.customer && data.customer.id ? data.customer.id : data.customerId || null,
      workerId: data.worker && data.worker.id ? data.worker.id : data.workerId || null
    });
    return obj;
  }

  function write(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      // Most likely the ~5MB quota was hit by uploaded photos.
      if (global.UI && UI.toast) UI.toast("Storage is full — try uploading fewer or smaller photos.");
      return false;
    }
  }

  var STRAPI_COLLECTIONS = {
    users: "/api/users?populate=*",
    requests: "/api/requests?populate=*",
    announcements: "/api/announcements?populate=*"
  };

  var strapiSyncLock = {};

  function syncStrapiCollection(key, customPath, mapper) {
    if (!isStrapiMode() || strapiSyncLock[key]) return;
    var path = customPath || STRAPI_COLLECTIONS[key] || null;
    if (!path) return;

    strapiSyncLock[key] = true;
    apiRequest(path, { method: "GET" }).then(function (res) {
      var rows = res && res.data ? res.data : (Array.isArray(res) ? res : []);
      var next = rows.map(function (item) {
        return mapper ? mapper(item) : item;
      });
      var data = read();
      data[key] = next;
      write(data);
      global.dispatchEvent(new CustomEvent("sc:strapi-sync", { detail: { key: key } }));
    }).catch(function () {
      // Keep the local mock dataset as the fallback until the Strapi API is reachable.
    }).then(function () {
      strapiSyncLock[key] = false;
    });
  }

  function syncStrapiState() {
    if (!isStrapiMode()) return;
    syncStrapiCollection("users", STRAPI_COLLECTIONS.users, normalizeStrapiUser);
    syncStrapiCollection("requests", STRAPI_COLLECTIONS.requests, normalizeStrapiRequest);
    syncStrapiCollection("announcements", STRAPI_COLLECTIONS.announcements, function (item) {
      if (!item) return item;
      var data = item.attributes ? item.attributes : item;
      return Object.assign({}, data, { id: item.id || data.id || data._id || null });
    });
  }

  var DB = {
    SKILL_CATEGORIES: SKILL_CATEGORIES,
    BARANGAYS: BARANGAYS,
    BARANGAY_GEO: BARANGAY_GEO,
    MAP_BOUNDS: MAP_BOUNDS,
    RATE_CARD: RATE_CARD,
    uid: uid,
    ticketId: ticketId,
    initials: initials,
    distanceKm: distanceKm,

    reset: function () { write(seedData()); },

    // Coordinates for any record — falls back to its barangay centre.
    coordsOf: function (rec) {
      if (!rec) return null;
      if (rec.lat != null && rec.lng != null) return { lat: rec.lat, lng: rec.lng };
      var g = BARANGAY_GEO[rec.barangay];
      return g ? { lat: g.lat, lng: g.lng } : null;
    },

    // ---- users -------------------------------------------------------
    isStrapiMode: isStrapiMode,
    apiRequest: apiRequest,
    normalizeStrapiUser: normalizeStrapiUser,
    normalizeStrapiRequest: normalizeStrapiRequest,
    getUsers: function () {
      if (isStrapiMode()) {
        syncStrapiCollection("users", STRAPI_COLLECTIONS.users, normalizeStrapiUser);
      }
      return read().users;
    },
    getUserById: function (id) {
      if (isStrapiMode()) {
        syncStrapiCollection("users", STRAPI_COLLECTIONS.users, normalizeStrapiUser);
      }
      return read().users.find(function (u) { return String(u.id) === String(id); }) || null;
    },
    getUserByEmail: function (email) {
      email = String(email || "").trim().toLowerCase();
      if (isStrapiMode()) {
        syncStrapiCollection("users", STRAPI_COLLECTIONS.users, normalizeStrapiUser);
      }
      return read().users.find(function (u) { return String(u.email || "").toLowerCase() === email; }) || null;
    },
    createUser: function (user) {
      var data = read();
      user.id = uid("u");
      user.createdAt = nowISO();
      var g = near(user.barangay, (Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.004);
      user.lat = g.lat;
      user.lng = g.lng;
      if (user.role === "worker") {
        user.verified = false;
        user.rating = 0;
        user.jobs = 0;
        user.availability = "offline";
        user.certificates = [];
        user.works = [];
      }
      data.users.push(user);
      write(data);
      if (isStrapiMode()) {
        syncStrapiCollection("users", STRAPI_COLLECTIONS.users, normalizeStrapiUser);
      }
      return user;
    },
    updateUser: function (id, patch) {
      var data = read();
      var u = data.users.find(function (x) { return x.id === id; });
      if (!u) return null;
      Object.assign(u, patch);
      write(data);
      if (isStrapiMode()) {
        syncStrapiCollection("users", STRAPI_COLLECTIONS.users, normalizeStrapiUser);
      }
      return u;
    },
    getWorkers: function () {
      if (isStrapiMode()) {
        syncStrapiCollection("users", STRAPI_COLLECTIONS.users, normalizeStrapiUser);
      }
      return read().users.filter(function (u) { return u.role === "worker"; });
    },

    // ---- worker portfolio (credibility) ------------------------------
    addCertificate: function (workerId, cert) {
      var w = DB.getUserById(workerId);
      if (!w) return null;
      cert.id = uid("cert");
      cert.addedAt = nowISO();
      return DB.updateUser(workerId, { certificates: (w.certificates || []).concat([cert]) });
    },
    removeCertificate: function (workerId, certId) {
      var w = DB.getUserById(workerId);
      if (!w) return null;
      return DB.updateUser(workerId, { certificates: (w.certificates || []).filter(function (c) { return c.id !== certId; }) });
    },
    addWork: function (workerId, work) {
      var w = DB.getUserById(workerId);
      if (!w) return null;
      work.id = uid("work");
      work.addedAt = nowISO();
      return DB.updateUser(workerId, { works: (w.works || []).concat([work]) });
    },
    removeWork: function (workerId, workId) {
      var w = DB.getUserById(workerId);
      if (!w) return null;
      return DB.updateUser(workerId, { works: (w.works || []).filter(function (p) { return p.id !== workId; }) });
    },

    // ---- requests ----------------------------------------------------
    getRequests: function () {
      if (isStrapiMode()) {
        syncStrapiCollection("requests", STRAPI_COLLECTIONS.requests, normalizeStrapiRequest);
      }
      return read().requests.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    },
    getRequestsByCustomer: function (customerId) { return DB.getRequests().filter(function (r) { return String(r.customerId) === String(customerId); }); },
    getRequestsByWorker: function (workerId) { return DB.getRequests().filter(function (r) { return String(r.workerId) === String(workerId); }); },
    getRequestById: function (id) {
      if (isStrapiMode()) {
        syncStrapiCollection("requests", STRAPI_COLLECTIONS.requests, normalizeStrapiRequest);
      }
      return read().requests.find(function (r) { return String(r.id) === String(id); }) || null;
    },
    createRequest: function (req) {
      var data = read();
      req.id = uid("req");
      req.ticketId = ticketId();
      req.status = "pending";
      req.workerId = req.workerId || null;
      req.workerName = req.workerName || null;
      req.photos = req.photos || [];
      req.createdAt = nowISO();
      if (req.lat == null) {
        var g = near(req.barangay, (Math.random() - 0.5) * 0.003, (Math.random() - 0.5) * 0.003);
        req.lat = g.lat;
        req.lng = g.lng;
      }
      data.requests.push(req);
      write(data);
      if (isStrapiMode()) {
        syncStrapiCollection("requests", STRAPI_COLLECTIONS.requests, normalizeStrapiRequest);
      }
      return req;
    },
    updateRequest: function (id, patch) {
      var data = read();
      var r = data.requests.find(function (x) { return String(x.id) === String(id); });
      if (!r) return null;
      Object.assign(r, patch);
      write(data);
      if (isStrapiMode()) {
        var documentId = r.documentId || r.id;
        apiRequest("/api/requests/" + encodeURIComponent(documentId), {
          method: "PUT",
          body: JSON.stringify({ data: patch })
        }).then(function () {
          syncStrapiCollection("requests", STRAPI_COLLECTIONS.requests, normalizeStrapiRequest);
        }).catch(function () {
          // Keep the local state responsive if the API permission is not enabled yet.
        });
      }
      return r;
    },
    deleteRequest: function (id) {
      var data = read();
      data.requests = data.requests.filter(function (x) { return x.id !== id; });
      write(data);
      if (isStrapiMode()) {
        syncStrapiCollection("requests", STRAPI_COLLECTIONS.requests, normalizeStrapiRequest);
      }
    },

    // ---- announcements -----------------------------------------------
    getAnnouncements: function () {
      if (isStrapiMode()) {
        syncStrapiCollection("announcements", STRAPI_COLLECTIONS.announcements, function (item) {
          if (!item) return item;
          var data = item.attributes ? item.attributes : item;
          return Object.assign({}, data, { id: item.id || data.id || data._id || null });
        });
      }
      return read().announcements;
    },

    // ---- session -----------------------------------------------------
    getSession: function () { return read().session; },
    setSession: function (userId) {
      var data = read();
      data.session = userId;
      write(data);
    },
    clearSession: function () {
      var data = read();
      data.session = null;
      write(data);
    },
    getCurrentUser: function () {
      var sid = DB.getSession();
      if (!sid) return null;
      var localUser = DB.getUserById(sid);
      if (localUser) return localUser;
      try {
        var strapiUser = JSON.parse(localStorage.getItem("sc_user") || "null");
        return strapiUser && String(strapiUser.id) === String(sid) ? strapiUser : null;
      } catch (e) {
        return null;
      }
    }
  };

  global.DB = DB;
})(window);
