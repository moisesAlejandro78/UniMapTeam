<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
{
    if (Schema::hasTable('reportesEspacio')) {
        return;
    }

    Schema::create('reportesEspacio', function (Blueprint $table) {
        $table->id('idReporte');
        $table->unsignedBigInteger('idEspacio');
        $table->unsignedBigInteger('idUsuario')->nullable();
        $table->string('tipo', 40);
        $table->text('mensaje');
        $table->string('correoContacto', 120)->nullable();
        $table->string('estado', 20)->default('pendiente');
        $table->timestamps();

        $table->foreign('idEspacio')
            ->references('idEspacio')
            ->on('espacios')
            ->cascadeOnDelete();
    });
}

    public function down(): void
    {
        Schema::dropIfExists('reportesEspacio');
    }
};