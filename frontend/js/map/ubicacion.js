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
    var GEO = {
        /* Calibración aprox. Univalle (ajustada con GPS real del usuario)
           Amplía/reduce tras probar en el campus caminando 2–3 puntos conocidos */
        minLng: -68.1210,
        maxLng: -68.1175,
        minLat: -16.5050,
        maxLat: -16.5015,
        anchoPlano: 800,
        altoPlano: 600
    };

    var watchId = null;
    var ultimaPos = null;
    var METROS_RECALCULAR = 4; /* recalcular ruta si te moviste ~4 m */

    function geoAPlano(lat, lng) {
        var x = ((lng - GEO.minLng) / (GEO.maxLng - GEO.minLng)) * GEO.anchoPlano;
        var y = ((GEO.maxLat - lat) / (GEO.maxLat - GEO.minLat)) * GEO.altoPlano;
        /* Limitar al plano */
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

    function aplicarPosicion(lat, lng, accuracy) {
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
    }

    function alError(err) {
        var msg = 'No se pudo obtener la ubicación';
        if (err && err.code === 1) msg = 'Permiso de ubicación denegado';
        if (err && err.code === 2) msg = 'Ubicación no disponible';
        if (err && err.code === 3) msg = 'Tiempo de espera de GPS agotado';
        if (util.notificar) util.notificar(msg, 3500);
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
                maximumAge: 2000,
                timeout: 15000
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
        var m = 0.002; /* ~200 m de margen */
        return lng >= GEO.minLng - m && lng <= GEO.maxLng + m &&
            lat >= GEO.minLat - m && lat <= GEO.maxLat + m;
    }

    function aplicarPosicion(lat, lng, accuracy) {
        if (!isFinite(lat) || !isFinite(lng)) return;

        if (!dentroDelCampus(lat, lng)) {
            if (util.notificar) {
                util.notificar('Estás fuera del área del campus (o el GPS es impreciso). Se mantiene la posición actual.', 4000);
            }
            console.warn('[ubicacion] fuera de GEO', lat, lng);
            return; /* NO muevas el pin al borde */
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
                if (util.notificar) util.notificar('Ubicación actualizada', 2000);
            },
            alError,
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 }
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