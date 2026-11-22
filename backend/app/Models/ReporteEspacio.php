<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReporteEspacio extends Model
{
    protected $table = 'reportesEspacio';
    protected $primaryKey = 'idReporte';

    protected $fillable = [
        'idEspacio',
        'idUsuario',
        'tipo',
        'mensaje',
        'correoContacto',
        'estado',
    ];
}