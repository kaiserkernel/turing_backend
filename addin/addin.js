window.geotab = window.geotab || {};
geotab.addin = geotab.addin || {};

/**
 * MyGeotab strips this page's <head> (and any <style> in it) when it injects
 * the fetched HTML/JS into its own document, so styling has to be added from
 * script instead - this runs immediately, the moment addin.js itself loads.
 */
(function injectStyles() {
  var css =
    "#turingCameras{font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a202c;background:#f7fafc}" +
    ".tc-toolbar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff;border-bottom:1px solid #e2e8f0}" +
    ".tc-title{font-weight:600;font-size:16px}" +
    ".tc-btn{border:1px solid #cbd5e0;background:#fff;border-radius:6px;padding:10px 20px;cursor:pointer;font-size:15px}" +
    ".tc-btn:hover{background:#edf2f7}" +
    ".tc-status{padding:8px 14px;color:#718096}" +
    ".tc-grid{display:grid;grid-template-columns:repeat(2,40vw);justify-content:center;gap:16px;padding:16px}" +
    ".tc-grid[hidden]{display:none}" +
    ".tc-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:40vw;height:40vw;border:1px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;text-align:center;font:inherit}" +
    ".tc-card:hover{border-color:#2b6cb0}" +
    ".tc-card.tc-offline{opacity:.5;cursor:not-allowed}" +
    ".tc-card-name{font-weight:600;font-size:18px}" +
    ".tc-card-meta{color:#718096;font-size:13px}" +
    ".tc-player{padding:16px}" +
    ".tc-player-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}" +
    ".tc-player-bar span{font-weight:600;font-size:16px}" +
    ".tc-player video{display:block;width:40vw;height:40vw;background:#000;border-radius:10px;object-fit:cover}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

/**
 * MyGeotab loads this page in an iframe and calls the lifecycle methods
 * below directly - see https://developers.geotab.com/myGeotab/addIns/developingAddIns/
 */
geotab.addin.turingCameras = function () {
  "use strict";

  var elGrid = document.getElementById("tcGrid");
  var elStatus = document.getElementById("tcStatus");
  var elRefresh = document.getElementById("tcRefresh");
  var elPlayer = document.getElementById("tcPlayer");
  var elPlayerName = document.getElementById("tcPlayerName");
  var elClose = document.getElementById("tcClose");
  var elVideo = document.getElementById("tcVideo");

  var hls = null;
  var session = null; // { database, userName, sessionId, server }
  // MyGeotab runs this script as part of its own page, so a relative fetch()
  // would otherwise resolve against my.geotab.com instead of this backend.
  var BACKEND = window.__TURING_BACKEND__ || "";

  function setStatus(text) {
    elStatus.textContent = text || "";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function referrerHost() {
    try {
      return new URL(document.referrer).host;
    } catch (e) {
      return "";
    }
  }

  /**
   * Geotab's published samples call api.getSession(function (session) { session.userName })
   * directly - the object is flat, not nested under a `credentials` key the way the
   * standalone mg-api-js library's getSession() is documented. Accepting either shape
   * here means a wrong guess about which one MyGeotab actually sends doesn't throw
   * inside MyGeotab's own callback (which is what produces "Issue Loading This Page").
   */
  function normalizeSession(raw) {
    var creds = raw.credentials || raw;
    return {
      database: creds.database,
      userName: creds.userName,
      sessionId: creds.sessionId,
      server: raw.path || raw.server || creds.server || referrerHost()
    };
  }

  function authHeaders() {
    return {
      "x-geotab-server": session.server,
      "x-geotab-database": session.database,
      "x-geotab-user": session.userName,
      "x-geotab-session": session.sessionId
    };
  }

  function loadCameras() {
    if (!session) return;

    setStatus("Loading cameras…");
    elGrid.innerHTML = "";

    fetch(BACKEND + "/api/cameras?limit=50", { headers: authHeaders() })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (body) {
            throw new Error(body.error || res.statusText);
          });
        }
        return res.json();
      })
      .then(function (data) {
        setStatus(data.cameras.length + " camera(s)");
        renderGrid(data.cameras);
      })
      .catch(function (err) {
        setStatus("Failed to load cameras: " + err.message);
      });
  }

  function renderGrid(cameras) {
    elGrid.innerHTML = "";
    cameras.forEach(function (camera) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "tc-card" + (camera.online ? "" : " tc-offline");
      card.innerHTML =
        '<span class="tc-card-name">' + escapeHtml(camera.name) + "</span>" +
        '<span class="tc-card-meta">' +
        escapeHtml(camera.model || "") +
        " · " +
        (camera.online ? "online" : "offline") +
        "</span>";
      card.addEventListener("click", function () {
        if (camera.online) playCamera(camera);
      });
      elGrid.appendChild(card);
    });
  }

  function playCamera(camera) {
    setStatus("Requesting stream…");

    fetch(BACKEND + "/api/cameras/" + camera.id + "/stream", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ resolution: "sub" })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (body) {
            throw new Error(body.error || res.statusText);
          });
        }
        return res.json();
      })
      .then(function (data) {
        setStatus("");
        openPlayer(camera.name, data.playUrl);
      })
      .catch(function (err) {
        setStatus("Failed to start stream: " + err.message);
      });
  }

  function openPlayer(name, playUrl) {
    teardownPlayer();

    elPlayerName.textContent = name;
    elGrid.hidden = true;
    elPlayer.hidden = false;

    if (window.Hls && Hls.isSupported()) {
      // Worker disabled: avoids needing a CSP worker-src/blob: exception for
      // what is otherwise a small, same-origin-only policy.
      hls = new Hls({ enableWorker: false });
      hls.loadSource(playUrl);
      hls.attachMedia(elVideo);
    } else if (elVideo.canPlayType("application/vnd.apple.mpegurl")) {
      elVideo.src = playUrl;
    } else {
      setStatus("This browser cannot play HLS streams.");
      return;
    }

    elVideo.play().catch(function () {
      // Autoplay can be blocked; the visible controls let the user start it.
    });
  }

  function teardownPlayer() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    elVideo.removeAttribute("src");
    elVideo.load();
  }

  function closePlayer() {
    teardownPlayer();
    elPlayer.hidden = true;
    elPlayerName.textContent = "";
    elGrid.hidden = false;
  }

  elRefresh.addEventListener("click", loadCameras);
  elClose.addEventListener("click", closePlayer);

  return {
    initialize: function (api, state, callback) {
      callback();
    },

    focus: function (api) {
      api.getSession(function (result) {
        try {
          session = normalizeSession(result);
          loadCameras();
        } catch (err) {
          setStatus("Could not read the MyGeotab session: " + err.message);
        }
      });
    },

    blur: function () {
      // Stream URLs die once playback stops anyway, but don't leave one
      // running in the background while the user is on another page.
      closePlayer();
    }
  };
};
