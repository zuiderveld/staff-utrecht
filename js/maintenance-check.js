/**
 * Staff portaal — onderhoud (beheer slaat overlay over)
 */
(function () {
  var path = window.location.pathname || '';
  if (/\/admin\/?$/.test(path)) return;

  function isBeheerUser() {
    try {
      return sessionStorage.getItem('urpStaffBeheer') === 'true';
    } catch (e) {
      return false;
    }
  }

  function showMaintenance(title, message) {
    if (document.getElementById('staffMaintOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'staffMaintOverlay';
    overlay.innerHTML =
      '<style>#staffMaintOverlay{position:fixed;inset:0;z-index:99999;background:#0c0a12;display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center;color:#eef2ff;font-family:Segoe UI,sans-serif}#staffMaintOverlay .box{max-width:420px}#staffMaintOverlay i{font-size:3rem;color:#8b5cf6;margin-bottom:1rem}#staffMaintOverlay h1{font-size:1.4rem;margin-bottom:0.75rem}#staffMaintOverlay p{color:#9ca3af;line-height:1.5}</style>' +
      '<div class="box"><i class="fas fa-tools"></i><h1></h1><p></p></div>';
    overlay.querySelector('h1').textContent = title;
    overlay.querySelector('p').textContent = message;
    document.body.appendChild(overlay);
  }

  var isOnderwereldPage = /\/onderwereld\.html$/i.test(path);

  fetch(window.location.origin + '/api/maintenance', { cache: 'no-store' })
    .then(function (r) {
      return r.json();
    })
    .then(function (state) {
      if (!state || isBeheerUser()) return;

      if (state.global) {
        showMaintenance(
          'Staff portaal in onderhoud',
          state.message || 'Het staff portaal is momenteel in onderhoud. Probeer het later opnieuw.'
        );
        return;
      }

      if (isOnderwereldPage && state.onderwereld) {
        showMaintenance(
          'Onderwereld store in onderhoud',
          state.onderwereldMessage ||
            'De onderwereld store (gangshop prijzen) is tijdelijk gesloten voor onderhoud. Probeer het later opnieuw.'
        );
      }
    })
    .catch(function () {});
})();
