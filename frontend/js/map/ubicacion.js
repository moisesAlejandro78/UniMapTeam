/* =========================================================
   map/ubicacion.js — "Usted aquí" en tiempo real
   GPS → coordenadas del plano 2D → ruta que se actualiza
   ========================================================= */
(function () {
    'use strict';

    var UniMap = window.UniMap;
    var util = UniMap.util;
    var estado = UniMap.estado;

    /* ── Calibración del campus (AJUSTA con puntos reales) ──
       Esquina SO y NE del área que cubre el plano 800×600.
       Valores de ejemplo para Univalle (La Paz); cámbialos
       midiendo 2 puntos conocidos en el campus. */
    /* ── Calibración por torre (GPS real) ─────────────────
   /* TI — cluster GPS ~ -16.5033, -68.1193 */
var GEO_TI = {
  minLng: -68.1208,
  maxLng: -68.1178,
  minLat: -16.5050,
  maxLat: -16.5018
};

/* TA — cluster GPS ~ -16.5035, -68.1198 */
var GEO_TA = {
  minLng: -68.1215,
  maxLng: -68.1180,
  minLat: -16.5055,
  maxLat: -16.5018
};

    /* Rectángulo activo = unión de ambas (sirve también en TA+TI) */
    function geoActivo() {
  var a = GEO_TA;
  var b = GEO_TI;
  return {
    minLng: Math.min(a.minLng, b.minLng),
    maxLng: Math.max(a.maxLng, b.maxLng),
    minLat: Math.min(a.minLat, b.minLat),
    maxLat: Math.max(a.maxLat, b.maxLat),
    anchoPlano: 800,
    altoPlano: 600
  };
}

    var watchId = null;
    var ultimaPos = null;
    var METROS_RECALCULAR = 4; /* recalcular ruta si te moviste ~4 m */

    function geoAPlano(lat, lng) {
        var GEO = geoActivo();
        var x = ((lng - GEO.minLng) / (GEO.maxLng - GEO.minLng)) * GEO.anchoPlano;
        var y = ((GEO.maxLat - lat) / (GEO.maxLat - GEO.minLat)) * GEO.altoPlano;
        if (x < 20) x = 20;
        if (x > GEO.anchoPlano - 20) x = GEO.anchoPlano - 20;
        if (y < 20) y = 20;
        if (y > GEO.altoPlano - 20) y = GEO.altoPlano - 20;
        return { x: Math.round(x), y: Math.round(y) };
    }

    var METROS_POR_UNIDAD = 0.12; /* igual que ruta.js */
    var ultimoRecalcTs = 0;

    function distanciaMetrosApprox(a, b) {
        if (!a || !b) return 9999;
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy) * METROS_POR_UNIDAD;
    }

    function intentarRecalcularRuta(plano) {
        var ra = estado.rutaActiva;
        if (!ra || !UniMap.ruta || !UniMap.ruta.trazar) return;

        var ahora = Date.now();
        if (ahora - ultimoRecalcTs < 1200) return;

        var mov = distanciaMetrosApprox(ultimaPos, plano);
        if (ultimaPos && mov < METROS_RECALCULAR) return;

        var dest = ra.destino || null;
        if (!dest && ra.espacioId) {
            var todos = estado.todosLosEspacios || [];
            for (var i = 0; i < todos.length; i++) {
                if (todos[i].id === ra.espacioId) {
                    dest = todos[i];
                    break;
                }
            }
        }
        if (!dest && estado.espacioSeleccionado) dest = estado.espacioSeleccionado;
        if (!dest) return;

        ultimoRecalcTs = ahora;
        UniMap.ruta.trazar(dest, ra.modo);
    }

    var ultimoErrorTs = 0;

    function alError(err) {
        var ahora = Date.now();
        if (ahora - ultimoErrorTs < 8000) return; /* evitar lluvia de avisos */
        ultimoErrorTs = ahora;

        var msg = 'No se pudo obtener la ubicación';
        if (err && err.code === 1) msg = 'Permiso de ubicación denegado';
        if (err && err.code === 2) msg = 'Ubicación no disponible';
        if (err && err.code === 3) {
            msg = 'GPS lento o débil (típico en interiores). Sal cerca de una ventana o entrada y vuelve a intentar.';
        }
        if (util.notificar) util.notificar(msg, 4000);
        console.warn('[ubicacion]', err);
    }

    function iniciarSeguimiento() {
        if (!navigator.geolocation) {
            if (util.notificar) util.notificar('Este dispositivo no soporta geolocalización', 3500);
            return false;
        }
        if (watchId !== null) return true;

        watchId = navigator.geolocation.watchPosition(
            function (pos) {
                aplicarPosicion(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    pos.coords.accuracy
                );
            },
            alError,
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 25000
            }
        );

        var fab = util.el('boton-ubicacion-fab');
        if (fab) fab.classList.add('activo');

        if (util.notificar) util.notificar('Seguimiento de ubicación activado', 2500);
        return true;
    }

    function detenerSeguimiento() {
        if (watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        var fab = util.el('boton-ubicacion-fab');
        if (fab) fab.classList.remove('activo');
    }
    function dentroDelCampus(lat, lng) {
        var GEO = geoActivo();
        var m = 0.0015; /* ~150 m de margen por imprecisión indoor */
        return lng >= GEO.minLng - m && lng <= GEO.maxLng + m &&
            lat >= GEO.minLat - m && lat <= GEO.maxLat + m;
    }

    function aplicarPosicion(lat, lng, accuracy) {
        if (!isFinite(lat) || !isFinite(lng)) return;

        if (accuracy && accuracy > 80) {
            if (util.notificar) {
                util.notificar(
                    'GPS poco preciso (±' + Math.round(accuracy) + ' m). Busca una ventana o la entrada.',
                    4000
                );
            }
            console.warn('[ubicacion] accuracy alta', accuracy, lat, lng);
            return;
        }

        if (!dentroDelCampus(lat, lng)) {
            if (util.notificar) {
                util.notificar(
                    'Estás fuera del área del campus (o el GPS es impreciso). Se mantiene la posición actual.',
                    4000
                );
            }
            console.warn('[ubicacion] fuera de GEO', lat, lng);
            return;
        }

        var plano = geoAPlano(lat, lng);
        estado.ubicacionUsuario = {
            x: plano.x,
            y: plano.y,
            lat: lat,
            lng: lng,
            accuracy: accuracy || null,
            ts: Date.now()
        };
        estado.ubicacionEdificio = estado.edificioActual === 0 ? 1 : estado.edificioActual;
        estado.ubicacionPiso = estado.pisoActual;

        if (UniMap.mapa2D && UniMap.mapa2D.dibujar) UniMap.mapa2D.dibujar();
        intentarRecalcularRuta(plano);
        ultimaPos = plano;

        /* ← esto es lo que faltaba */
        console.log(
            '[GPS]',
            lat.toFixed(6),
            lng.toFixed(6),
            'acc=', accuracy,
            'plano=', plano.x, plano.y
        );
        if (util.notificar) {
            util.notificar(
                'GPS: ' + lat.toFixed(5) + ', ' + lng.toFixed(5) +
                (accuracy ? ' (±' + Math.round(accuracy) + ' m)' : ''),
                5000
            );
        }
    }

    /** Una sola lectura (botón "ubicarme") */
    function obtenerUnaVez() {
        if (!navigator.geolocation) {
            if (util.notificar) util.notificar('Sin geolocalización', 3000);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function (pos) {
                aplicarPosicion(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            },
            alError,
            { enableHighAccuracy: true, timeout: 25000, maximumAge: 10000 }
        );
    }

    /** PC / demo: mover con teclado cuando NO hay GPS móvil */
    function activarTecladoDemo() {
        if (estado._ubiTeclado) return;
        estado._ubiTeclado = true;

        document.addEventListener('keydown', function (e) {
            if (!estado.ubicacionUsuario) return;
            var tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            var paso = 8;
            var dx = 0, dy = 0;
            var k = e.key;
            if (k === 'ArrowUp' || k === 'w' || k === 'W') dy = -paso;
            else if (k === 'ArrowDown' || k === 's' || k === 'S') dy = paso;
            else if (k === 'ArrowLeft' || k === 'a' || k === 'A') dx = -paso;
            else if (k === 'ArrowRight' || k === 'd' || k === 'D') dx = paso;
            else return;

            e.preventDefault();

            var p = estado.ubicacionUsuario;
            var nx = Math.max(20, Math.min(780, (p.x || 400) + dx));
            var ny = Math.max(20, Math.min(580, (p.y || 280) + dy));

            estado.ubicacionUsuario = {
                x: nx,
                y: ny,
                lat: p.lat || null,
                lng: p.lng || null,
                accuracy: null,
                ts: Date.now(),
                demo: true
            };
            estado.ubicacionEdificio = estado.edificioActual === 0 ? 1 : estado.edificioActual;
            estado.ubicacionPiso = estado.pisoActual;

            if (UniMap.mapa2D && UniMap.mapa2D.dibujar) UniMap.mapa2D.dibujar();
            intentarRecalcularRuta({ x: nx, y: ny });
            ultimaPos = { x: nx, y: ny };
        });
    }

    function iniciar() {
        if (!estado.ubicacionUsuario) {
            estado.ubicacionUsuario = { x: 400, y: 280 };
        }
        activarTecladoDemo();

        function activarGPS() {
            obtenerUnaVez();
            iniciarSeguimiento();
        }

        var fab = util.el('boton-ubicacion-fab');
        if (fab) fab.addEventListener('click', activarGPS);

        /* El botón oculto sigue sirviendo si otros menús lo “cliquean” */
        var oculto = util.el('boton-ubicacion');
        if (oculto) oculto.addEventListener('click', activarGPS);
    }

    UniMap.ubicacion = {
        iniciar: iniciar,
        iniciarSeguimiento: iniciarSeguimiento,
        detenerSeguimiento: detenerSeguimiento,
        obtenerUnaVez: obtenerUnaVez,
        geoAPlano: geoAPlano,
        aplicarPosicion: aplicarPosicion
    };
})();