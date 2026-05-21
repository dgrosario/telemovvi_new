"use client";

import { useState } from "react";
import { MetaAppSetting, MetaChannelType } from "@/lib/gateway-client";
import { MetaSettingsForm } from "./meta-settings-form";
import { cn } from "@/lib/utils";

interface MetaSettingsTabsProps {
  initialSettings: MetaAppSetting[];
}

const CHANNEL_TABS: { type: MetaChannelType; label: string; icon: string }[] = [
  { type: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
  { type: "instagram", label: "Instagram", icon: "instagram" },
  { type: "messenger", label: "Messenger", icon: "messenger" },
];

export function MetaSettingsTabs({ initialSettings }: MetaSettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<MetaChannelType>("whatsapp");
  const [settings, setSettings] = useState<MetaAppSetting[]>(initialSettings);

  const getSettingForChannel = (channelType: MetaChannelType) => {
    return settings.find((s) => s.channelType === channelType);
  };

  const handleSettingSaved = (newSetting: MetaAppSetting) => {
    setSettings((prev) => {
      const existing = prev.findIndex(
        (s) => s.channelType === newSetting.channelType
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newSetting;
        return updated;
      }
      return [...prev, newSetting];
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px" aria-label="Tabs">
          {CHANNEL_TABS.map((tab) => {
            const setting = getSettingForChannel(tab.type);
            const isActive = activeTab === tab.type;

            return (
              <button
                key={tab.type}
                onClick={() => setActiveTab(tab.type)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <span>{tab.label}</span>
                {setting?.isActive && (
                  <span className="flex h-2 w-2 rounded-full bg-green-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-6">
        <MetaSettingsForm
          channelType={activeTab}
          initialSetting={getSettingForChannel(activeTab)}
          onSettingSaved={handleSettingSaved}
        />
      </div>
    </div>
  );
}
