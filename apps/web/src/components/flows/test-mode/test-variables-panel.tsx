"use client";

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Stack,
  Chip,
  TextField,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useFlowTestStore } from "@/stores/flow-test-store";

export function TestVariablesPanel() {
  const { variables, simulatedContact, setSimulatedContact } = useFlowTestStore();

  const variableEntries = Object.entries(variables);

  return (
    <Box>
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Contato Simulado</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Nome"
              value={simulatedContact.name}
              onChange={(e) =>
                setSimulatedContact({ ...simulatedContact, name: e.target.value })
              }
              fullWidth
            />
            <TextField
              size="small"
              label="Telefone"
              value={simulatedContact.phone}
              onChange={(e) =>
                setSimulatedContact({ ...simulatedContact, phone: e.target.value })
              }
              fullWidth
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2">Variáveis</Typography>
            <Chip label={variableEntries.length} size="small" />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {variableEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma variável definida
            </Typography>
          ) : (
            <Stack spacing={1}>
              {variableEntries.map(([key, value]) => (
                <Box
                  key={key}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    p: 1,
                    bgcolor: "grey.50",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight="medium">
                    {key}
                  </Typography>
                  <Chip
                    label={String(value)}
                    size="small"
                    variant="outlined"
                    sx={{ maxWidth: 150 }}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
