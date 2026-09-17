/* ==========================================================================
   SKILLCONNECT — AUTH HELPERS
   ========================================================================== */
(function (global) {
  "use strict";

  var ROLE_HOME = {
    customer: "customer.html",
    worker: "worker.html",
    admin: "admin.html"
  };

  var Auth = {
    login: function (email, password) {
      if (DB.isStrapiMode && DB.isStrapiMode()) {
        var strapiBase = (window.STRAPI_API_URL || localStorage.getItem("sc_strapi_url") || "http://localhost:1337").replace(/\/+$/, "");
        return fetch(strapiBase + "/api/auth/local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email, password: password })
        }).then(function (res) {
          return res.json().then(function (body) {
            if (body && body.error) {
              throw new Error(body.error.message || "Email or password is incorrect.");
            }
            if (body && body.jwt) localStorage.setItem("sc_jwt", body.jwt);
            var user = body && body.user ? Object.assign({}, body.user, { id: body.user.id }) : null;
            if (user && (user.role === "authenticated" || (user.role && typeof user.role === "object"))) {
              user.role = "customer";
            }
            if (user) {
              localStorage.setItem("sc_user", JSON.stringify(user));
              DB.setSession(user.id);
            }
            return { ok: true, user: user };
          });
        }).catch(function (err) {
          return { ok: false, message: err.message || "Email or password is incorrect." };
        });
      }

      var user = DB.getUserByEmail(email);
      if (!user || user.password !== password) {
        return { ok: false, message: "Email or password is incorrect." };
      }
      DB.setSession(user.id);
      return { ok: true, user: user };
    },

    register: function (payload) {
      if (DB.isStrapiMode && DB.isStrapiMode()) {
        var strapiBase = (window.STRAPI_API_URL || localStorage.getItem("sc_strapi_url") || "http://localhost:1337").replace(/\/+$/, "");
        return fetch(strapiBase + "/api/auth/local/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: payload.email,
            email: payload.email,
            password: payload.password
          })
        }).then(function (res) {
          return res.json().then(function (body) {
            if (body && body.error) {
              throw new Error(body.error.message || "Unable to create account.");
            }
            if (body && body.jwt) localStorage.setItem("sc_jwt", body.jwt);
            var user = body && body.user ? Object.assign({}, body.user, { id: body.user.id }) : null;
            if (user && (user.role === "authenticated" || (user.role && typeof user.role === "object"))) {
              user.role = "customer";
            }
            if (user) {
              localStorage.setItem("sc_user", JSON.stringify(user));
              DB.setSession(user.id);
            }
            return { ok: true, user: user };
          });
        }).catch(function (err) {
          return { ok: false, message: err.message || "Unable to create account." };
        });
      }

      if (DB.getUserByEmail(payload.email)) {
        return { ok: false, message: "An account with that email already exists." };
      }
      if (payload.role === "worker") {
        payload.initials = DB.initials(payload.name);
      }
      var user = DB.createUser(payload);
      DB.setSession(user.id);
      return { ok: true, user: user };
    },

    logout: function () {
      if (localStorage.getItem("sc_jwt")) localStorage.removeItem("sc_jwt");
      if (localStorage.getItem("sc_user")) localStorage.removeItem("sc_user");
      DB.clearSession();
      window.location.href = "index.html";
    },

    homeFor: function (role) { return ROLE_HOME[role] || "index.html"; },

    // Call at the top of a protected page. Redirects to login if not
    // authenticated, or to the correct dashboard if the role doesn't match.
    requireRole: function (role) {
      var user = DB.getCurrentUser();
      if (!user) {
        window.location.href = "login.html";
        return null;
      }
      if (user.role !== role) {
        window.location.href = ROLE_HOME[user.role] || "index.html";
        return null;
      }
      return user;
    },

    // Call on the landing/login/register pages to bounce logged-in users
    // straight to their dashboard.
    redirectIfLoggedIn: function () {
      var user = DB.getCurrentUser();
      if (user) window.location.href = ROLE_HOME[user.role] || "index.html";
    }
  };

  global.Auth = Auth;
})(window);
