import { getAllMetaSettings } from "@/app/actions/meta-settings";
import { MetaSettingsHeader } from "./meta-settings-header";
import { MetaSettingsTabs } from "./meta-settings-tabs";

export default async function MetaSettingsPage() {
  const [settings, error] = await getAllMetaSettings();

  if (error) {
    const isConnectionError = error.message.includes("Connection is closed") || 
                              error.message.includes("Not connected");
    
    return (
      <div className="p-6">
        <MetaSettingsHeader />
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start">
            <i className="tabler-alert-circle text-amber-600 text-xl mr-3 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">
                {isConnectionError ? "Gateway não está disponível" : "Erro ao carregar configurações"}
              </h3>
              <p className="text-sm text-amber-700">
                {isConnectionError 
                  ? "O serviço de gateway não está rodando. Inicie o gateway para gerenciar as configurações do Meta."
                  : error.message
                }
              </p>
              {isConnectionError && (
                <p className="text-xs text-amber-600 mt-2">
                  Execute: <code className="bg-amber-100 px-1 py-0.5 rounded">pnpm run dev:gateway</code>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <MetaSettingsHeader />
      <div className="mt-6">
        <MetaSettingsTabs initialSettings={settings ?? []} />
      </div>
    </div>
  );
}
