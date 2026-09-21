window.geotab = window.geotab || {};
geotab.addin = geotab.addin || {};

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
  var session = null; // { credentials: { database, userName, sessionId }, path }

  function setStatus(text) {
    elStatus.textContent = text || "";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function authHeaders() {
    return {
      "x-geotab-server": session.path,
      "x-geotab-database": session.credentials.database,
      "x-geotab-user": session.credentials.userName,
      "x-geotab-session": session.credentials.sessionId
    };
  }

  function loadCameras() {
    if (!session) return;

    setStatus("Loading cameras…");
    elGrid.innerHTML = "";

    fetch("/api/cameras?limit=50", { headers: authHeaders() })
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

    fetch("/api/cameras/" + camera.id + "/stream", {
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
  }

  elRefresh.addEventListener("click", loadCameras);
  elClose.addEventListener("click", closePlayer);

  return {
    initialize: function (api, state, callback) {
      callback();
    },

    focus: function (api) {
      api.getSession(function (result) {
        session = result;
        loadCameras();
      });
    },

    blur: function () {
      // Stream URLs die once playback stops anyway, but don't leave one
      // running in the background while the user is on another page.
      closePlayer();
    }
  };
};
