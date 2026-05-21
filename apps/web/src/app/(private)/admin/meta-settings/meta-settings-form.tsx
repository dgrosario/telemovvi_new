"use client";

import { useState, useEffect } from "react";
import { useServerAction } from "zsa-react";
import {
  getMetaSettings,
  saveMetaSettings,
  setMetaSettingsActive,
  testMetaSettingsConnection,
} from "@/app/actions/meta-settings";
import { MetaAppSetting, MetaChannelType } from "@/lib/gateway-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "react-toastify";

interface MetaSettingsFormProps {
  channelType: MetaChannelType;
  initialSetting?: MetaAppSetting;
  onSettingSaved: (setting: MetaAppSetting) => void;
}

const CHANNEL_LABELS: Record<MetaChannelType, string> = {
  whatsapp: "WhatsApp Business",
  instagram: "Instagram Business",
  messenger: "Facebook Messenger",
  evolution: "Evolution API",
};

export function MetaSettingsForm({
  channelType,
  initialSetting,
  onSettingSaved,
}: MetaSettingsFormProps) {
  const isEvolution = channelType === "evolution";
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [configId, setConfigId] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "online" | "offline">("idle");
  const [connectionMessage, setConnectionMessage] = useState("");

  const saveAction = useServerAction(saveMetaSettings);
  const setActiveAction = useServerAction(setMetaSettingsActive);
  const getSettingsAction = useServerAction(getMetaSettings);
  const testConnectionAction = useServerAction(testMetaSettingsConnection);

  useEffect(() => {
    if (initialSetting) {
      setAppId(initialSetting.appId);
      setConfigId(initialSetting.configId);
      setIsActive(initialSetting.isActive);
      setAppSecret("");
    } else {
      setAppId("");
      setAppSecret("");
      setConfigId("");
      setIsActive(false);
    }
  }, [channelType, initialSetting]);

  const loadFullSettings = async () => {
    if (!initialSetting) return;

    setIsLoading(true);
    try {
      const [result, error] = await getSettingsAction.execute({ 
        channelType,
        includeSecret: true 
      });
      
      if (error) {
        toast.error("Erro ao carregar configurações");
        return;
      }
      
      if (result && 'appSecret' in result && result.appSecret) {
        setAppSecret(String(result.appSecret));
        toast.success("Secret carregado com sucesso");
      } else {
        toast.error("Secret não disponível");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const secretToSave = appSecret || (initialSetting ? "" : "");

    if (!appId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    if (channelType !== "instagram" && !configId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!initialSetting && !appSecret) {
      toast.error("App Secret é obrigatório para nova configuração");
      return;
    }

    const [result, error] = await saveAction.execute({
      channelType,
      appId,
      appSecret: secretToSave || "placeholder-will-keep-existing",
      configId: channelType === "instagram" ? "" : configId || "",
    });

    if (error) {
      toast.error(error.message || "Erro ao salvar configurações");
      return;
    }

    if (result) {
      toast.success("Configurações salvas com sucesso");
      onSettingSaved(result);
      setAppSecret("");
    }
  };

  const handleTestConnection = async () => {
    const [result, error] = await testConnectionAction.execute({ channelType });

    if (error) {
      setConnectionStatus("offline");
      setConnectionMessage(error.message || "Falha ao testar conexão");
      toast.error("Falha ao testar conexão");
      return;
    }

    const isOnline = !!result?.online;
    setConnectionStatus(isOnline ? "online" : "offline");
    setConnectionMessage(result?.message || (isOnline ? "Conexão online" : "Sem conexão"));
    toast[isOnline ? "success" : "warning"](result?.message || (isOnline ? "Conexão online" : "Sem conexão"));
  };

  const handleToggleActive = async () => {
    if (!initialSetting) {
      toast.error("Salve as configurações antes de ativar");
      return;
    }

    const newActive = !isActive;

    const [, error] = await setActiveAction.execute({
      channelType,
      isActive: newActive,
    });

    if (error) {
      toast.error(error.message || "Erro ao atualizar status");
      return;
    }

    setIsActive(newActive);
    toast.success(newActive ? "Canal ativado" : "Canal desativado");
    onSettingSaved({ ...initialSetting, isActive: newActive });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {CHANNEL_LABELS[channelType]}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {isEvolution
              ? "Configure as credenciais da Evolution para integração no workspace"
              : `Configure as credenciais do aplicativo Meta para ${CHANNEL_LABELS[channelType]}`}
          </p>
        </div>

        {initialSetting && (
          <div className="flex items-center gap-3">
            <Label htmlFor="active-toggle" className="text-sm text-gray-600">
              {isActive ? "Ativo" : "Inativo"}
            </Label>
            <Switch
              id="active-toggle"
              checked={isActive}
              onCheckedChange={handleToggleActive}
              disabled={setActiveAction.isPending}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="appId">{isEvolution ? "URL da API *" : "App ID *"}</Label>
          <Input
            id="appId"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder={
              isEvolution
                ? "Ex: https://evolution.seudominio.com"
                : "Ex: 579228267872440"
            }
            required
          />
          <p className="text-xs text-gray-500">
            {isEvolution
              ? "URL base usada para comunicação com a Evolution API"
              : "ID do aplicativo no Meta Developers"}
          </p>
        </div>

        {channelType !== "instagram" && (
          <div className="space-y-2">
            <Label htmlFor="configId">
              {isEvolution ? "Nome da Instância *" : "Config ID *"}
            </Label>
            <Input
              id="configId"
              value={configId}
              onChange={(e) => setConfigId(e.target.value)}
              placeholder={
                isEvolution ? "Ex: atendimento-principal" : "Ex: 1378912180505580"
              }
              required
            />
            <p className="text-xs text-gray-500">
              {isEvolution
                ? "Identificador da instância Evolution que será usada no workspace"
                : "ID da configuração de Embedded Signup"}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="appSecret">
            {isEvolution ? "Token / API Key" : "App Secret"} {!initialSetting && "*"}
          </Label>
          {initialSetting && !appSecret && (
            <Button
              type="button"
              variant="ghost"
              onClick={loadFullSettings}
              disabled={isLoading}
              className="text-xs h-auto py-1 px-2"
            >
              {isLoading ? "Carregando..." : "Mostrar secret atual"}
            </Button>
          )}
        </div>
        <div className="relative">
          <Input
            id="appSecret"
            type={showSecret ? "text" : "password"}
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            placeholder={
              initialSetting
                ? "Deixe em branco para manter o atual"
                : isEvolution
                  ? "Token de autenticação da Evolution API"
                  : "App Secret do aplicativo"
            }
            required={!initialSetting}
          />
          <Button
            type="button"
            variant="ghost"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-auto py-1 px-2"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? "Ocultar" : "Mostrar"}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          {isEvolution
            ? "Token usado para autenticar chamadas na Evolution API"
            : "Secret do aplicativo no Meta Developers (mínimo 32 caracteres)"}
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pt-4 border-t border-gray-100">
        <div className="text-sm">
          {connectionStatus !== "idle" && (
            <span className={connectionStatus === "online" ? "text-emerald-600" : "text-red-600"}>
              {connectionStatus === "online" ? "● Online" : "● Offline"} {connectionMessage ? `- ${connectionMessage}` : ""}
            </span>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={handleTestConnection} disabled={testConnectionAction.isPending}>
            {testConnectionAction.isPending ? "Testando..." : "Testar conexão"}
          </Button>
          <Button type="submit" disabled={saveAction.isPending}>
            {saveAction.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

    </form>
  );
}
