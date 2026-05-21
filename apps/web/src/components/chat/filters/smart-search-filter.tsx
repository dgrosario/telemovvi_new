"use client";

import CustomTextField from "@/components/custom-text-field";
import {
  getSearchTypeIcon,
  getSearchTypeLabel,
  type SearchType,
  useSmartSearch,
} from "@/hooks/use-smart-search";
import {
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { Icon } from "@iconify/react";
import React, { useEffect } from "react";

interface SmartSearchFilterProps {
  value: string;
  searchType: SearchType;
  onChange: (value: string, type: SearchType) => void;
}

export function SmartSearchFilter({
  value,
  searchType,
  onChange,
}: SmartSearchFilterProps) {
  const { searchResult, setSearch } = useSmartSearch();
  const [disambiguationType, setDisambiguationType] = React.useState<
    "client-name" | "attendant-name"
  >("client-name");

  useEffect(() => {
    if (value) {
      const disambiguatedType = searchType === "client-name" || searchType === "attendant-name"
        ? searchType
        : undefined;
      setSearch(value, disambiguatedType);
    }
  }, [value, searchType, setSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearch(newValue);

    if (searchResult.needsDisambiguation) {
      onChange(newValue, "all");
    } else {
      onChange(newValue, searchResult.type);
    }
  };

  const handleDisambiguationChange = (_: React.MouseEvent<HTMLElement>, newType: "client-name" | "attendant-name" | null) => {
    if (newType) {
      setDisambiguationType(newType);
      onChange(value, newType);
    }
  };

  return (
    <Stack spacing={2}>
      <CustomTextField
        label="Busca Inteligente"
        placeholder="Ex: 5561998202165, @cliente, João Silva"
        value={value}
        onChange={handleInputChange}
        fullWidth
        size="small"
        slotProps={{
          input: {
            startAdornment: searchResult.type !== "all" && (
              <Icon
                icon={getSearchTypeIcon(searchResult.type)}
                width={20}
                height={20}
                style={{ marginRight: 8, color: "#666" }}
              />
            ),
          },
        }}
      />

      {searchResult.needsDisambiguation && value.length >= 2 && (
        <ToggleButtonGroup
          value={disambiguationType}
          exclusive
          onChange={handleDisambiguationChange}
          size="small"
          fullWidth
          sx={{
            "& .MuiToggleButtonGroup-grouped": {
              flex: 1,
              "&:not(:first-of-type)": {
                marginLeft: 0,
                borderLeft: "1px solid",
                borderLeftColor: "divider",
              },
            },
          }}
        >
          <ToggleButton value="client-name">
            <Icon icon="tabler-user" width={18} height={18} />
            <span style={{ marginLeft: 6 }}>Cliente</span>
          </ToggleButton>
          <ToggleButton value="attendant-name">
            <Icon icon="tabler-user-check" width={18} height={18} />
            <span style={{ marginLeft: 6 }}>Atendente</span>
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      {searchResult.type !== "all" && !searchResult.needsDisambiguation && value && (
        <Chip
          label={getSearchTypeLabel(searchResult.type)}
          size="small"
          color="primary"
          variant="outlined"
          icon={
            <Icon
              icon={getSearchTypeIcon(searchResult.type)}
              width={16}
              height={16}
            />
          }
          sx={{
            width: "fit-content",
          }}
        />
      )}
    </Stack>
  );
}
