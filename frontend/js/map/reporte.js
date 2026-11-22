/* =========================================================
   map/reporte.js — reportes / sugerencias de un espacio
   ========================================================= */
(function () {
  'use strict';

  var UniMap = window.UniMap;
  var espacioActual = null;

  function $(id) { return document.getElementById(id); }

  function abrir(espacio) {
    if (!espacio) return;
    espacioActual = espacio;

    var idBackend = espacio.idBackend || UniMap.api.idDeBackend(espacio.id);
    if (!idBackend) {
      if (UniMap.ui && UniMap.ui.aviso) {
        UniMap.ui.aviso('Este espacio aún no está sincronizado con el servidor.', 'aviso');
      }
      return;
    }

    $('reporte-id-espacio').value = idBackend;
    $('reporte-nombre-espacio').textContent = espacio.nombre || 'Espacio';
    $('reporte-tipo').value = 'error_datos';
    $('reporte-mensaje').value = '';
    $('reporte-correo').value = '';
    var est = $('reporte-estado');
    est.classList.add('hidden');
    est.textContent = '';

    $('modal-reporte').classList.remove('hidden');
  }

  function cerrar() {
    $('modal-reporte').classList.add('hidden');
    espacioActual = null;
  }

  function enviar(e) {
    e.preventDefault();
    var idEspacio = Number($('reporte-id-espacio').value);
    var tipo = $('reporte-tipo').value;
    var mensaje = ($('reporte-mensaje').value || '').trim();
    var correo = ($('reporte-correo').value || '').trim() || null;
    var est = $('reporte-estado');
    var btn = $('btn-enviar-reporte');

    if (!idEspacio || mensaje.length < 5) {
      est.textContent = 'Escribe un mensaje de al menos 5 caracteres.';
      est.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    est.textContent = 'Enviando…';
    est.classList.remove('hidden');

    UniMap.api.solicitar('POST', '/reportes-espacio', {
      idEspacio: idEspacio,
      tipo: tipo,
      mensaje: mensaje,
      correoContacto: correo
    }).then(function (r) {
      btn.disabled = false;
      if (r.ok) {
        est.textContent = (r.json && r.json.mensaje) || 'Enviado. Gracias.';
        setTimeout(cerrar, 1200);
      } else {
        est.textContent = (r.json && r.json.mensaje) || 'No se pudo enviar. Intenta de nuevo.';
      }
    });
  }

  function init() {
    var modal = $('modal-reporte');
    if (!modal) return;

    modal.querySelectorAll('[data-cerrar-reporte]').forEach(function (el) {
      el.addEventListener('click', cerrar);
    });
    $('form-reporte').addEventListener('submit', enviar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  UniMap.reporte = { abrir: abrir, cerrar: cerrar };
})();