/* =========================================================
   auth/auth.js — login, registro, invitado y sesion
   (funciona en index.html y en mapa.html)
   ========================================================= */
(function () {
  'use strict';

  var UniMap = window.UniMap;
  var util = UniMap.util;
  var estado = UniMap.estado;

  var llaveUsuarios = UniMap.CLAVES.usuarios;
  var llaveSesion = UniMap.CLAVES.sesion;

  /* Rutas segun la pagina actual: index.html vive en la raiz
     y mapa.html dentro de frontend/ */
  var EN_MAPA = !!util.el('pantalla-mapa');
  var RUTA_INDEX = EN_MAPA ? '../index.html' : 'index.html';
  var RUTA_MAPA = EN_MAPA ? 'mapa.html' : 'frontend/mapa.html';

  /* ── USUARIOS ─────────────────────────────────────── */
  function obtenerUsuarios() {
    return util.almacen.leer(llaveUsuarios, []);
  }

  function guardarUsuarios(lista) {
    util.almacen.escribir(llaveUsuarios, lista);
  }

  /* Sin usuarios inventados: la unica fuente de cuentas es el backend
     (seeders de Laravel). Lo unico que vive en localStorage son las
     cuentas que el propio usuario registro con el backend apagado. */

  /* ── SESION ENTRE PAGINAS ─────────────────────────── */
  function guardarSesion(usuario) {
    estado.usuarioActual = usuario;
    util.almacen.escribir(llaveSesion, usuario);
  }

  function sesionGuardada() {
    return util.almacen.leer(llaveSesion, null);
  }

  function cerrarSesion() {
    /* Revoca el token del backend si existe (no bloquea la salida) */
    if (UniMap.api && UniMap.api.token()) UniMap.api.cerrarSesionBackend();
    util.almacen.quitar(llaveSesion);
    estado.usuarioActual = null;
    estado.favoritos = [];
    window.location.href = RUTA_INDEX;
  }

  /* ── TRADUCCION DE CUENTAS DEL BACKEND ────────────── */
  function mapearRolBackend(rol) {
    if (rol === 'administrador' || rol === 'personalAdministrativo') return 'admin';
    if (rol === 'estudiante') return 'estudiante';
    if (rol === 'docente') return 'docente';
    return rol || 'invitado';
  }

  function sesionDesdeBackend(u) {
    /* Los apellidos viajan separados (3FN). Si un backend antiguo no
       los manda, se divide el nombre completo como respaldo. */
    var nombre;
    var apellido;
    if (u.apellidoPaternoUsuario !== undefined || u.apellidoMaternoUsuario !== undefined) {
      nombre = String(u.nombreUsuario || '').trim();
      apellido = (String(u.apellidoPaternoUsuario || '').trim() + ' ' +
        String(u.apellidoMaternoUsuario || '').trim()).trim();
    } else {
      var partes = String(u.nombreUsuario || '').split(' ');
      nombre = partes[0] || u.nombreUsuario || '';
      apellido = partes.slice(1).join(' ') || '';
    }
    return {
      id: 'b' + u.idUsuario,
      nombre: nombre,
      apellido: apellido,
      correo: u.correoUsuario || '',
      rol: mapearRolBackend(u.rol),
      backend: true
    };
  }

  /* ── VALIDACIONES / ERRORES ───────────────────────── */
  var DOMINIO_CORREO = '@univalle.edu.bo';
  var PASS_MIN = 8;
  var PASS_MAX = 64;
  var NOMBRE_MAX = 60;
  var CORREO_MAX = 120;

    function mostrarError(idCampo, mensaje) {
    var campo = util.el(idCampo);
    var error = util.el(idCampo + '-error');
    if (campo) campo.classList.add('error');
    if (error) {
      error.textContent = mensaje;
      error.classList.add('error-msg-alerta');
    }
  }
    function asegurarCajaAlerta() {
    var caja = util.el('auth-alerta');
    if (caja) return caja;
    var cont = document.querySelector('.auth-container');
    if (!cont) return null;
    caja = document.createElement('div');
    caja.id = 'auth-alerta';
    caja.className = 'auth-alerta hidden';
    caja.setAttribute('role', 'alert');
    /* Insertar arriba de los formularios */
    var tabs = cont.querySelector('.auth-tabs');
    if (tabs && tabs.nextSibling) cont.insertBefore(caja, tabs.nextSibling);
    else cont.insertBefore(caja, cont.firstChild);
    return caja;
  }

  function mostrarAlertaAuth(mensaje) {
    var caja = asegurarCajaAlerta();
    if (!caja) return;
    caja.textContent = mensaje;
    caja.classList.remove('hidden');
  }

  function ocultarAlertaAuth() {
    var caja = util.el('auth-alerta');
    if (caja) {
      caja.textContent = '';
      caja.classList.add('hidden');
    }
  }

  function limpiarError(idCampo) {
    var campo = util.el(idCampo);
    var error = util.el(idCampo + '-error');
    if (campo) campo.classList.remove('error');
    if (error) error.textContent = '';
  }

  function limpiarTodosLosErrores() {
    var mensajes = document.querySelectorAll('.error-msg');
    for (var i = 0; i < mensajes.length; i++) mensajes[i].textContent = '';
    var campos = document.querySelectorAll('.error');
    for (var j = 0; j < campos.length; j++) campos[j].classList.remove('error');
  }

  function normalizarCorreo(v) {
    return String(v || '').trim().toLowerCase();
  }

  function soloLetrasNombre(v) {
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/.test(v);
  }

  function validarNombre(id, etiqueta, obligatorio) {
    limpiarError(id);
    var raw = util.el(id);
    if (!raw) return true;
    var v = String(raw.value || '').trim().replace(/\s+/g, ' ');
    raw.value = v;

    if (!v) {
      if (obligatorio) {
        mostrarError(id, 'El campo ' + etiqueta + ' es obligatorio.');
        return false;
      }
      return true;
    }
    if (v.length < 2) {
      mostrarError(id, etiqueta + ' debe tener al menos 2 caracteres.');
      return false;
    }
    if (v.length > NOMBRE_MAX) {
      mostrarError(id, etiqueta + ' no puede superar ' + NOMBRE_MAX + ' caracteres.');
      return false;
    }
    if (!soloLetrasNombre(v)) {
      mostrarError(id, etiqueta + ' solo puede contener letras y espacios.');
      return false;
    }
    return true;
  }

  function validarCorreoUnivalle(id) {
    limpiarError(id);
    var raw = util.el(id);
    if (!raw) return false;
    var v = normalizarCorreo(raw.value);
    raw.value = v;

    if (!v) {
      mostrarError(id, 'El correo es obligatorio.');
      return false;
    }
    if (v.length > CORREO_MAX) {
      mostrarError(id, 'El correo es demasiado largo.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      mostrarError(id, 'Formato de correo no válido.');
      return false;
    }
    var partes = v.split('@');
    if (partes.length !== 2 || partes[1] !== 'univalle.edu.bo') {
      mostrarError(id, 'Solo se permiten correos institucionales @univalle.edu.bo');
      return false;
    }
    if (!partes[0] || partes[0].length < 2) {
      mostrarError(id, 'La parte local del correo es demasiado corta.');
      return false;
    }
    if (!/^[a-z0-9._+-]+$/.test(partes[0])) {
      mostrarError(id, 'El correo contiene caracteres no permitidos.');
      return false;
    }
    return true;
  }

  function validarContrasena(id, esRegistro) {
    limpiarError(id);
    var raw = util.el(id);
    if (!raw) return false;
    var v = String(raw.value || '');

    if (!v) {
      mostrarError(id, 'La contraseña es obligatoria.');
      return false;
    }
    if (v.length < PASS_MIN) {
      mostrarError(id, 'Mínimo ' + PASS_MIN + ' caracteres.');
      return false;
    }
    if (v.length > PASS_MAX) {
      mostrarError(id, 'Máximo ' + PASS_MAX + ' caracteres.');
      return false;
    }
    if (esRegistro) {
      if (!/[A-ZÁÉÍÓÚÜÑ]/.test(v)) {
        mostrarError(id, 'Debe incluir al menos una mayúscula.');
        return false;
      }
      if (!/[a-záéíóúüñ]/.test(v)) {
        mostrarError(id, 'Debe incluir al menos una minúscula.');
        return false;
      }
      if (!/[0-9]/.test(v)) {
        mostrarError(id, 'Debe incluir al menos un número.');
        return false;
      }
      if (!/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(v)) {
        mostrarError(id, 'Debe incluir al menos un símbolo (ej. ! @ # $).');
        return false;
      }
    }
    return true;
  }

  function validarConfirmacion(idPass, idPass2) {
    limpiarError(idPass2);
    var a = util.el(idPass);
    var b = util.el(idPass2);
    if (!a || !b) return false;
    if (a.value !== b.value) {
      mostrarError(idPass2, 'Las contraseñas no coinciden.');
      return false;
    }
    return true;
  }

  function validarLogin() {
    var okCorreo = validarCorreoUnivalle('correo-login');
    var okPass = validarContrasena('contrasena-login', false);
    return okCorreo && okPass;
  }

  function validarRegistro() {
    var okNombre = validarNombre('nombre-registro', 'Nombre', true);
    var okAp = validarNombre('apellido-registro', 'Apellido paterno', true);
    var okAm = validarNombre('apellidoMaterno-registro', 'Apellido materno', false);
    var okCorreo = validarCorreoUnivalle('correo-registro');
    var okPass = validarContrasena('contrasena-registro', true);
    var okPass2 = validarConfirmacion('contrasena-registro', 'contrasena2-registro');
    return okNombre && okAp && okAm && okCorreo && okPass && okPass2;
  }

  /* ── EVENTOS (solo si los elementos existen) ───────============================= */
  function conectarFormularios() {
    var formularioLogin = util.el('formulario-login');
    var formularioRegistro = util.el('formulario-registro');
    if (!formularioLogin || !formularioRegistro) return;

    /* Si ya hay sesion abierta, no hace falta volver a entrar:
       se continua directamente en el mapa */
    if (sesionGuardada()) {
      window.location.replace(RUTA_MAPA);
      return;
    }

    var enlaceRegistro = util.el('mostrar-registro');
    var enlaceLogin = util.el('mostrar-login');

    if (enlaceRegistro) {
      enlaceRegistro.addEventListener('click', function (e) {
        e.preventDefault();
        formularioLogin.classList.remove('active');
        formularioRegistro.classList.add('active');
        limpiarTodosLosErrores();
      });
    }

    if (enlaceLogin) {
      enlaceLogin.addEventListener('click', function (e) {
        e.preventDefault();
        formularioRegistro.classList.remove('active');
        formularioLogin.classList.add('active');
        limpiarTodosLosErrores();
      });
    }

    /* Mostrar / ocultar contrasena */
    var botonesPass = document.querySelectorAll('.boton-mostrar-pass');
    for (var k = 0; k < botonesPass.length; k++) {
      botonesPass[k].addEventListener('click', function () {
        var campo = util.el(this.getAttribute('data-target'));
        if (!campo) return;
        if (campo.type === 'password') { campo.type = 'text'; this.textContent = UniMap.i18n.t('auth.ocultar'); }
        else { campo.type = 'password'; this.textContent = UniMap.i18n.t('auth.mostrar'); }
      });
    }

    /* Fortaleza de contrasena */
    var campoFortaleza = util.el('contrasena-registro');
    if (campoFortaleza) {
      campoFortaleza.addEventListener('input', function () {
        var val = this.value;
        var score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        var barra = util.el('fortaleza-contrasena');
        if (!barra) return;
        var pct = (score / 5) * 100;
        var color = '#dc2626';
        if (score >= 4) color = '#059669';
        else if (score >= 2) color = '#d97706';
        barra.style.background = val
          ? 'linear-gradient(to right, ' + color + ' ' + pct + '%, #e5e7eb ' + pct + '%)'
          : '#e5e7eb';
      });
    }

    /* LOGIN */
    formularioLogin.addEventListener('submit', function (e) {
      e.preventDefault();
      limpiarTodosLosErrores();
      ocultarAlertaAuth();

      if (!validarLogin()) {
        mostrarAlertaAuth('Revisa los campos. Solo correos @univalle.edu.bo');
        return;
      }

      var correo = normalizarCorreo(util.el('correo-login').value);
      var pass = util.el('contrasena-login').value;

      function loginLocal(mensajeSinBackend) {
        var usuarios = obtenerUsuarios();
        var encontrado = null;
        for (var u = 0; u < usuarios.length; u++) {
          if (usuarios[u].correo === correo && usuarios[u].contrasena === pass) {
            encontrado = usuarios[u];
            break;
          }
        }
        if (!encontrado) {
          var msg = UniMap.i18n.t(mensajeSinBackend || 'err.credenciales');
          mostrarError('contrasena-login', msg);
          mostrarAlertaAuth(msg);
          return;
        }
        guardarSesion(encontrado);
        window.location.href = RUTA_MAPA;
      }

      if (UniMap.api && UniMap.api.activa()) {
        UniMap.api.iniciarSesion(correo, pass).then(function (res) {
          if (res.ok) {
            guardarSesion(sesionDesdeBackend(res.usuario));
            window.location.href = RUTA_MAPA;
            return;
          }
          loginLocal(res.estado === 0 ? 'err.sinBackend' : null);
        });
        return;
      }

      loginLocal('err.sinBackend');
    });

    /* REGISTRO */
    formularioRegistro.addEventListener('submit', function (e) {
      e.preventDefault();
      limpiarTodosLosErrores();
      ocultarAlertaAuth();

      if (!validarRegistro()) {
        mostrarAlertaAuth('Revisa los campos marcados. El correo debe ser @univalle.edu.bo');
        return;
      }

      var nombre = util.el('nombre-registro').value.trim();
      var apellido = util.el('apellido-registro').value.trim();
      var correo = normalizarCorreo(util.el('correo-registro').value);
      var pass = util.el('contrasena-registro').value;

      var usuarios = obtenerUsuarios();
      for (var u = 0; u < usuarios.length; u++) {
        if (usuarios[u].correo === correo) {
          mostrarError('correo-registro', UniMap.i18n.t('err.yaRegistrado'));
          mostrarAlertaAuth('Ese correo ya está registrado.');
          return;
        }
      }

      function registroLocal() {
        var nuevo = {
          id: 'u' + Date.now(),
          nombre: nombre,
          apellido: apellido,
          correo: correo,
          rol: 'personal',
          contrasena: pass,
          fechaRegistro: new Date().toISOString()
        };
        usuarios.push(nuevo);
        guardarUsuarios(usuarios);
        guardarSesion(nuevo);
        window.location.href = RUTA_MAPA;
      }

      if (UniMap.api && UniMap.api.activa() && pass.length >= 8) {
        var campoMaterno = util.el('apellidoMaterno-registro');
        UniMap.api.registrarse({
          nombre: nombre,
          apellidoPaterno: apellido,
          apellidoMaterno: campoMaterno ? campoMaterno.value.trim() : '',
          correo: correo,
          contrasena: pass
        }).then(function (res) {
          if (res.ok) {
            guardarSesion(sesionDesdeBackend(res.usuario));
            window.location.href = RUTA_MAPA;
            return;
          }
          registroLocal();
        });
        return;
      }

      registroLocal();
    });
  }

  /* ── BOTON INVITADO ───────────────────────────────── */
  function conectarInvitado() {
    var boton = util.el('boton-invitado');
    if (!boton) return;
    boton.addEventListener('click', function () {
      guardarSesion({ id: 'guest', nombre: 'Invitado', apellido: '', correo: '', rol: 'invitado' });
      window.location.href = RUTA_MAPA;
    });
  }

  /* ── BOTON SALIR (mapa.html) ──────────────────────── */
  function conectarSalida() {
    var boton = util.el('boton-salir');
    if (!boton) return;
    boton.addEventListener('click', cerrarSesion);
  }

  /* ── ARRANQUE DEL MODULO ──────────────────────────── */
  conectarFormularios();
  conectarInvitado();
  conectarSalida();

  UniMap.auth = {
    obtenerUsuarios: obtenerUsuarios,
    guardarUsuarios: guardarUsuarios,
    guardarSesion: guardarSesion,
    sesionGuardada: sesionGuardada,
    cerrarSesion: cerrarSesion,
    mostrarError: mostrarError,
    limpiarTodosLosErrores: limpiarTodosLosErrores
  };
})();
