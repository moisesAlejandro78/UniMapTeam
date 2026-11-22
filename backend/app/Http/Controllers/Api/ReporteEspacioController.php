<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReporteEspacio;
use Illuminate\Http\Request;

class ReporteEspacioController extends Controller
{
    public function store(Request $request)
    {
        $datos = $request->validate([
            'idEspacio'      => 'required|integer|exists:espacios,idEspacio',
            'tipo'           => 'required|string|in:error_datos,error_ubicacion,sugerencia,otro',
            'mensaje'        => 'required|string|min:5|max:2000',
            'correoContacto' => 'nullable|email|max:120',
        ]);

        $usuario = $request->user(); // puede ser null si es público

        $reporte = ReporteEspacio::create([
            'idEspacio'      => $datos['idEspacio'],
            'idUsuario'      => $usuario ? $usuario->idUsuario : null,
            'tipo'           => $datos['tipo'],
            'mensaje'        => $datos['mensaje'],
            'correoContacto' => $datos['correoContacto'] ?? null,
            'estado'         => 'pendiente',
        ]);

        return response()->json([
            'mensaje' => 'Reporte enviado. Gracias por ayudarnos a mejorar el mapa.',
            'idReporte' => $reporte->idReporte,
        ], 201);
    }
}