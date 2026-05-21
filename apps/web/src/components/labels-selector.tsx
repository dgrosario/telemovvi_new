"use client";

import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  createFilterOptions,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useState } from "react";
import CustomTextField from "./custom-text-field";
import { LabelChip } from "./label-chip";
import { CreateLabelDialog } from "./labels/create-label-dialog";
import { listLabels } from "@/app/actions/labels";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { Label } from "@omnichannel/core/domain/entities/label";
import { normalizeAccents } from "@/lib/utils";

type LabelsSelectorProps = {
  value: string[];
  onChange: (labelIds: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function LabelsSelector({
  value,
  onChange,
  label = "Etiquetas",
  placeholder = "Selecione etiquetas...",
  disabled = false,
}: LabelsSelectorProps) {
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const [mobileDraftValue, setMobileDraftValue] = useState<string[]>(value);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { data: labels = [], isLoading } = useServerActionQuery(listLabels, {
    input: undefined,
    queryKey: ["labels"],
  });

  const selectedLabels = labels.filter((l) => value.includes(l.id));

  const handleChange = (_: unknown, newValue: Label.Raw[]) => {
    onChange(newValue.map((l) => l.id));
  };

  const handleLabelCreated = (labelId: string) => {
    if (isMobile && mobileSelectorOpen) {
      setMobileDraftValue((prev) =>
        prev.includes(labelId) ? prev : [...prev, labelId]
      );
      return;
    }

    if (!value.includes(labelId)) {
      onChange([...value, labelId]);
    }
  };

  const openMobileSelector = () => {
    if (disabled) return;
    setMobileDraftValue(value);
    setMobileSearch("");
    setMobileSelectorOpen(true);
  };

  const closeMobileSelector = () => {
    setMobileSelectorOpen(false);
  };

  const applyMobileSelector = () => {
    onChange(mobileDraftValue);
    closeMobileSelector();
  };

  const toggleMobileLabel = (labelId: string) => {
    setMobileDraftValue((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  const mobileSelectedLabels = labels.filter((l) => mobileDraftValue.includes(l.id));
  const filteredMobileLabels = labels.filter((l) =>
    normalizeAccents(l.name.toLowerCase()).includes(
      normalizeAccents(mobileSearch.toLowerCase())
    )
  );

  const filterOptions = createFilterOptions<Label.Raw>({
    stringify: (option) => normalizeAccents(option.name),
  });

  return (
    <>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        {isMobile ? (
          <Box sx={{ flex: 1 }}>
            <CustomTextField
              fullWidth
              label={label}
              placeholder={placeholder}
              value={selectedLabels.map((item) => item.name).join(", ")}
              onClick={openMobileSelector}
              disabled={disabled}
              InputProps={{
                readOnly: true,
              }}
            />
            {selectedLabels.length > 0 && (
              <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selectedLabels.map((item) => (
                  <LabelChip key={item.id} name={item.name} color={item.color} />
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <Autocomplete
            multiple
            options={labels}
            value={selectedLabels}
            onChange={handleChange}
            filterOptions={filterOptions}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, val) => option.id === val.id}
            disabled={disabled}
            loading={isLoading}
            noOptionsText="Nenhuma etiqueta encontrada"
            sx={{ flex: 1 }}
            renderInput={(params) => (
              <CustomTextField
                {...params}
                label={label}
                placeholder={placeholder}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isLoading && <CircularProgress color="inherit" size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <Box component="li" {...otherProps} key={option.id}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: option.color,
                      marginRight: 1.5,
                      flexShrink: 0,
                    }}
                  />
                  {option.name}
                </Box>
              );
            }}
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <LabelChip
                    key={key}
                    name={option.name}
                    color={option.color}
                    onDelete={tagProps.onDelete}
                  />
                );
              })
            }
          />
        )}
        <Tooltip title="Criar nova etiqueta">
          <IconButton
            size="small"
            onClick={() => setLabelDialogOpen(true)}
            disabled={disabled}
            sx={{ mt: 1 }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <CreateLabelDialog
        open={labelDialogOpen}
        onClose={() => setLabelDialogOpen(false)}
        onSuccess={handleLabelCreated}
      />

      <Dialog
        open={isMobile && mobileSelectorOpen}
        onClose={closeMobileSelector}
        fullScreen
      >
        <DialogTitle>Selecionar etiquetas</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <CustomTextField
              fullWidth
              autoFocus
              label="Buscar etiqueta"
              placeholder="Digite para filtrar..."
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
            />
          </Box>

          {isLoading ? (
            <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : filteredMobileLabels.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
              Nenhuma etiqueta encontrada
            </Typography>
          ) : (
            <List sx={{ px: 0 }}>
              {filteredMobileLabels.map((item) => {
                const checked = mobileDraftValue.includes(item.id);
                return (
                  <ListItemButton
                    key={item.id}
                    onClick={() => toggleMobileLabel(item.id)}
                    dense
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox edge="start" checked={checked} tabIndex={-1} />
                    </ListItemIcon>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: item.color,
                        mr: 1.5,
                        flexShrink: 0,
                      }}
                    />
                    <ListItemText primary={item.name} />
                  </ListItemButton>
                );
              })}
            </List>
          )}

          {mobileSelectedLabels.length > 0 && (
            <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {mobileSelectedLabels.map((item) => (
                <LabelChip key={item.id} name={item.name} color={item.color} />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMobileSelector}>Cancelar</Button>
          <Button variant="contained" onClick={applyMobileSelector}>
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
