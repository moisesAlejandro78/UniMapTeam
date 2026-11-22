<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('espacios', function (Blueprint $table) {
            // URL pública o ruta relativa, ej: assets/espacios/lab-computacion.png
            // o https://...supabase.co/storage/v1/object/public/espacios/lab.png
            $table->string('urlImagen', 500)->nullable()->after('contactoEspacio');
        });
    }

    public function down(): void
    {
        Schema::table('espacios', function (Blueprint $table) {
            $table->dropColumn('urlImagen');
        });
    }
};