import { cleanupOldExports } from "@/app/actions/partners/import-export-jobs";
import { NextResponse } from "next/server";

// Rota para limpar arquivos antigos de exportação
// Pode ser chamada por um cron job externo ou pelo Next.js cron
export async function GET() {
  try {
    console.log("[Cron] Iniciando limpeza de arquivos antigos");
    
    // Nota: Esta rota não tem autenticação pois é chamada por cron
    // Em produção, adicione um token secreto para segurança
    
    const [result, error] = await cleanupOldExports();
    
    if (error) {
      console.error("[Cron] Erro na limpeza:", error);
      return NextResponse.json(
        { success: false, error: "Erro ao limpar arquivos" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      deleted: result?.deleted || 0,
    });
  } catch (error) {
    console.error("[Cron] Erro na limpeza:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao limpar arquivos" },
      { status: 500 }
    );
  }
}
