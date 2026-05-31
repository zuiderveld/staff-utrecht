/**
 * Staff portaal — onderhoud (beheer-rollen slaan overlay over)
 */
(function () {
  if (/\/admin\/?$/.test(window.location.pathname)) return;

  function showMaintenance(message) {
    if (document.getElementById('staffMaintOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'staffMaintOverlay';
    overlay.innerHTML =
      '<style>#staffMaintOverlay{position:fixed;inset:0;z-index:99999;background:#0c0a12;display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center;color:#eef2ff;font-family:Segoe UI,sans-serif}#staffMaintOverlay .box{max-width:420px}#staffMaintOverlay i{font-size:3rem;color:#8b5cf6;margin-bottom:1rem}#staffMaintOverlay h1{font-size:1.4rem;margin-bottom:0.75rem}#staffMaintOverlay p{color:#9ca3af;line-height:1.5}</style>' +
      '<div class="box"><i class="fas fa-tools"></i><h1>Staff portaal in onderhoud</h1><p></p></div>';
    overlay.querySelector('p').textContent = message;
    document.body.appendChild(overlay);
  }

  fetch(window.location.origin + '/api/maintenance', { cache: 'no-store' })
    .then(function (r) {
      return r.json();
    })
    .then(function (state) {
      if (!state || !state.global) return;
      showMaintenance(
        state.message || 'Het staff portaal is momenteel in onderhoud. Probeer het later opnieuw.'
      );
    })
    .catch(function () {});
})();
