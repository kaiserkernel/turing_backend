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
    ".tc-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 14px;background:#fff;border-bottom:1px solid #e2e8f0}" +
    ".tc-title{font-weight:600;font-size:16px}" +
    ".tc-toolbar-actions{display:flex;align-items:center;gap:10px}" +
    ".tc-btn{border:1px solid #cbd5e0;background:#fff;border-radius:6px;padding:10px 20px;cursor:pointer;font-size:15px;text-decoration:none;color:inherit;display:inline-block}" +
    ".tc-btn:hover{background:#edf2f7}" +
    ".tc-btn[hidden]{display:none!important}" +
    ".tc-status{padding:8px 14px;color:#718096}" +
    ".tc-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px;background:#f7fafc;border-bottom:1px solid #e2e8f0}" +
    ".tc-toggle{display:inline-flex;border:1px solid #cbd5e0;border-radius:6px;overflow:hidden}" +
    ".tc-toggle[hidden]{display:none!important}" +
    ".tc-toggle-btn{border:none;background:#fff;padding:8px 14px;cursor:pointer;font-size:13px;color:#1a202c;font:inherit}" +
    ".tc-toggle-btn+.tc-toggle-btn{border-left:1px solid #cbd5e0}" +
    ".tc-toggle-btn:hover{background:#edf2f7}" +
    ".tc-toggle-btn.tc-active{background:#2b6cb0;color:#fff}" +
    ".tc-toggle-btn.tc-active:hover{background:#2b6cb0}" +
    // auto-fit + minmax: as many 28vw-or-wider columns as fit, normally 3.
    // Unlike auto-fill, auto-fit collapses empty tracks, so with fewer
    // cameras than columns the 1fr component lets the real ones grow to
    // fill the row instead of leaving blank space - a single camera fills it.
    ".tc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(28vw,1fr));justify-content:center;gap:16px;padding:16px}" +
    // !important: without it, .tc-grid.tc-solo{display:flex} below has equal
    // specificity and, being later in this stylesheet, would win over this
    // whenever both apply - leaving the grid visible even while "hidden".
    ".tc-grid[hidden]{display:none!important}" +
    // Only one camera total: a big, explicitly-sized tile centered on the
    // page, rather than letting the grid's auto-fit stretch it edge to edge.
    ".tc-grid.tc-solo{display:flex;justify-content:center;align-items:center;min-height:80vh}" +
    ".tc-grid.tc-solo .tc-card{width:70vw;height:75vh;aspect-ratio:unset}" +
    ".tc-all-view[hidden]{display:none!important}" +
    // Same auto-fit/minmax idea as the Main camera grid, but a 16:9 tile
    // reads better for real video than a square, and a slightly larger gap
    // keeps live feeds from feeling cramped together.
    // Fixed 30vw tiles rather than auto-fit/1fr stretching - a flat repeated
    // track matching the tile's own width, centered as a row.
    ".tc-all-grid{display:grid;grid-template-columns:repeat(auto-fit,30vw);justify-content:center;gap:20px;padding:16px}" +
    ".tc-all-list{display:flex;flex-direction:column;gap:20px;padding:16px}" +
    ".tc-all-list .tc-tile{width:100%}" +
    // .tc-card (Main camera, square) and .tc-tile (All cameras, 16:9) share
    // one internal look - a label bar, a centered status placeholder, and a
    // video that fills the box - so clicking either one behaves and looks
    // the same: idle button in, live video out, same size, same position.
    ".tc-card,.tc-tile{position:relative;background:#11161c;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;font:inherit}" +
    ".tc-card{width:100%;aspect-ratio:1/1}" +
    // 30vw wide, 16:9 tall (~16.9vw) - a standard video ratio that reads
    // comfortably rather than an arbitrary fixed height.
    ".tc-tile{width:30vw;aspect-ratio:16/9}" +
    ".tc-card video,.tc-tile video{width:100%;height:100%;object-fit:cover;display:block}" +
    ".tc-tile-label{position:absolute;top:0;left:0;right:0;padding:6px 10px;background:linear-gradient(to bottom,rgba(0,0,0,.65),transparent);color:#fff;font-size:13px;font-weight:600;display:flex;justify-content:space-between;gap:8px;z-index:1}" +
    ".tc-tile-status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#a0aec0;font-size:13px;background:#11161c;text-align:center;padding:0 10px}" +
    // !important: same reason as .tc-grid[hidden] above - display:flex on
    // the rule directly above has equal specificity to this and otherwise
    // wins, so status.hidden=true in JS would silently do nothing and the
    // "Loading…" overlay would sit on top of the video forever.
    ".tc-tile-status[hidden]{display:none!important}" +
    ".tc-tile-expand{position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:4px;padding:4px 9px;cursor:pointer;font-size:14px;z-index:1}" +
    ".tc-tile-expand:hover{background:rgba(0,0,0,.8)}" +
    // Idle = online but not yet tapped. Offline = can't be tapped at all.
    ".tc-idle{cursor:pointer}" +
    ".tc-idle:hover,.tc-idle:focus-visible{border-color:#2b6cb0}" +
    ".tc-idle .tc-tile-status{color:#cbd5e0}" +
    ".tc-offline{opacity:.5;cursor:not-allowed}";

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
  var elAllView = document.getElementById("tcAllView");
  var elStatus = document.getElementById("tcStatus");
  var elRefresh = document.getElementById("tcRefresh");
  var elDashboardLink = document.getElementById("tcDashboardLink");
  var elViewToggle = document.getElementById("tcViewToggle");
  var elLayoutToggle = document.getElementById("tcLayoutToggle");

  var session = null; // { database, userName, sessionId, server }
  var lastCameras = [];
  var activeTiles = []; // every tile currently playing, in either view
  // MyGeotab runs this script as part of its own page, so a relative fetch()
  // would otherwise resolve against my.geotab.com instead of this backend.
  var BACKEND = window.__TURING_BACKEND__ || "";

  function readPref(key, fallback) {
    try {
      // Namespaced: this script runs inside MyGeotab's own page, so an
      // unprefixed key could collide with something else using localStorage.
      return localStorage.getItem("turingCameras." + key) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writePref(key, value) {
    try {
      localStorage.setItem("turingCameras." + key, value);
    } catch (e) {
      // Private browsing, storage disabled, etc. - not worth failing over.
    }
  }

  var viewMode = readPref("viewMode", "single"); // "single" | "all"
  var layoutMode = readPref("layoutMode", "grid"); // "grid" | "list"

  // Opens Turing's own Vision Dashboard directly - that's a separate site
  // with its own login, not something this backend proxies.
  if (window.__TURING_DASHBOARD_URL__) {
    elDashboardLink.href = window.__TURING_DASHBOARD_URL__;
  } else {
    elDashboardLink.hidden = true;
  }

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
    elAllView.innerHTML = "";

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
        lastCameras = data.cameras;
        setStatus(data.cameras.length + " camera(s)");
        renderCurrentView();
      })
      .catch(function (err) {
        setStatus("Failed to load cameras: " + err.message);
      });
  }

  /** Renders whichever view matches the current viewMode. Both views are
   * built from the same tile component - see buildCameraTile - so clicking
   * a camera behaves identically either way: idle button swaps for its live
   * feed, in place, at the same size. Switching modes always tears down
   * whatever was playing rather than leaving it running out of view. */
  function renderCurrentView() {
    teardownAllTiles();

    if (viewMode === "all") {
      elGrid.hidden = true;
      elAllView.hidden = false;
      renderAllView(lastCameras);
    } else {
      elAllView.hidden = true;
      elGrid.hidden = false;
      renderGrid(lastCameras);
    }
  }

  function setViewMode(mode) {
    if (mode === viewMode) return;
    viewMode = mode;
    writePref("viewMode", mode);
    updateToggleUi();
    renderCurrentView();
  }

  function setLayoutMode(mode) {
    if (mode === layoutMode) return;
    layoutMode = mode;
    writePref("layoutMode", mode);
    updateToggleUi();
    if (viewMode === "all") renderAllView(lastCameras);
  }

  function updateToggleUi() {
    setToggleActive(elViewToggle, "data-view", viewMode);
    setToggleActive(elLayoutToggle, "data-layout", layoutMode);
    elLayoutToggle.hidden = viewMode !== "all";
  }

  function setToggleActive(group, attr, value) {
    var buttons = group.querySelectorAll(".tc-toggle-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("tc-active", buttons[i].getAttribute(attr) === value);
    }
  }

  /** Main camera: a grid of square buttons. Only one plays at a time -
   * starting a new one stops whichever was already playing. */
  function renderGrid(cameras) {
    elGrid.innerHTML = "";
    elGrid.classList.toggle("tc-solo", cameras.length === 1);
    cameras.forEach(function (camera) {
      elGrid.appendChild(buildCameraTile(camera, "tc-card", true));
    });
  }

  /** All cameras: a grid or list of wide tiles, each independently
   * toggleable - tapping one doesn't stop any others already playing. */
  function renderAllView(cameras) {
    elAllView.innerHTML = "";
    elAllView.className = "tc-all-view " + (layoutMode === "grid" ? "tc-all-grid" : "tc-all-list");
    cameras.forEach(function (camera) {
      elAllView.appendChild(buildCameraTile(camera, "tc-tile", false));
    });
  }

  /** The actual POST-for-a-stream-URL call, shared by every tile. Never
   * cached - see the backend's own comment on why a fresh URL is required
   * per request. */
  function fetchStreamUrl(cameraId) {
    return fetch(BACKEND + "/api/cameras/" + cameraId + "/stream", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ resolution: "sub" })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (body) {
          throw new Error(body.error || res.statusText);
        });
      }
      return res.json();
    });
  }

  function attachHls(video, playUrl) {
    if (window.Hls && Hls.isSupported()) {
      // Worker disabled: avoids needing a CSP worker-src/blob: exception for
      // what is otherwise a small, same-origin-only policy.
      var instance = new Hls({ enableWorker: false });
      instance.loadSource(playUrl);
      instance.attachMedia(video);
      return instance;
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playUrl;
      return null;
    }
    throw new Error("This browser cannot play HLS streams.");
  }

  /**
   * One camera's clickable tile, used for both the Main camera grid (shape
   * "tc-card", exclusive) and the All cameras view (shape "tc-tile", shared).
   * States: offline (inert) -> idle ("Tap to view") -> loading -> playing,
   * and playing -> idle again on a second tap (stop) or on failure (retry).
   * `exclusive` means starting this one stops every other active tile first -
   * that's what makes "Main camera" a single focus rather than a mosaic.
   */
  function buildCameraTile(camera, shapeClass, exclusive) {
    var tile = document.createElement("div");
    tile.className = shapeClass + (camera.online ? " tc-idle" : " tc-offline");

    var label = document.createElement("div");
    label.className = "tc-tile-label";
    label.innerHTML =
      "<span>" + escapeHtml(camera.name) + "</span><span>" + (camera.online ? "online" : "offline") + "</span>";
    tile.appendChild(label);

    var status = document.createElement("div");
    status.className = "tc-tile-status";
    status.textContent = camera.online ? "Tap to view" : "Offline";
    tile.appendChild(status);

    if (!camera.online) return tile;

    tile.setAttribute("role", "button");
    tile.setAttribute("tabindex", "0");

    var entry = { stop: stop };

    function stop() {
      if (entry.hls) entry.hls.destroy();
      if (entry.videoEl) entry.videoEl.remove();
      entry.hls = null;
      entry.videoEl = null;

      var idx = activeTiles.indexOf(entry);
      if (idx !== -1) activeTiles.splice(idx, 1);

      tile.classList.remove("tc-playing");
      tile.classList.add("tc-idle");
      status.hidden = false;
      status.textContent = "Tap to view";
    }

    function start() {
      if (exclusive) {
        activeTiles.slice().forEach(function (other) {
          if (other !== entry) other.stop();
        });
      }

      tile.classList.remove("tc-idle");
      status.textContent = "Loading…";

      fetchStreamUrl(camera.id)
        .then(function (data) {
          var video = document.createElement("video");
          video.muted = true;
          video.autoplay = true;
          video.playsInline = true;
          tile.appendChild(video);

          var expandBtn = document.createElement("button");
          expandBtn.type = "button";
          expandBtn.className = "tc-tile-expand";
          expandBtn.title = "Expand";
          expandBtn.textContent = "⛶";
          expandBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var request = video.requestFullscreen || video.webkitRequestFullscreen;
            if (request) request.call(video);
          });
          tile.appendChild(expandBtn);

          entry.hls = attachHls(video, data.playUrl);
          entry.videoEl = video;
          activeTiles.push(entry);

          status.hidden = true;
          tile.classList.add("tc-playing");
          video.play().catch(function () {
            // Autoplay can be blocked; the visible controls let the user start it.
          });
        })
        .catch(function (err) {
          status.textContent = "Failed: " + err.message + " (tap to retry)";
          tile.classList.add("tc-idle");
        });
    }

    tile.addEventListener("click", function () {
      if (tile.classList.contains("tc-playing")) {
        stop();
      } else if (tile.classList.contains("tc-idle")) {
        start();
      }
      // Mid-load (neither class): ignore repeat clicks instead of double-fetching.
    });

    tile.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        tile.click();
      }
    });

    return tile;
  }

  function teardownAllTiles() {
    activeTiles.slice().forEach(function (entry) {
      entry.stop();
    });
  }

  elRefresh.addEventListener("click", loadCameras);

  elViewToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".tc-toggle-btn");
    if (btn) setViewMode(btn.getAttribute("data-view"));
  });
  elLayoutToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".tc-toggle-btn");
    if (btn) setLayoutMode(btn.getAttribute("data-layout"));
  });
  updateToggleUi();

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
      teardownAllTiles();
    }
  };
};
