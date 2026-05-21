"use client";

import { useCallback, useRef, useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  Divider,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useShallow } from "zustand/shallow";
import { useFlowTestStore } from "@/stores/flow-test-store";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { FlowTestEngine } from "@/lib/flow-test-engine";
import { TestMiniChat } from "./test-mini-chat";
import { TestVariablesPanel } from "./test-variables-panel";
import { TestExecutionLog } from "./test-execution-log";

const DRAWER_WIDTH = 420;

export function TestModeDrawer() {
  // Usar selectors individuais para evitar re-renders desnecessarios
  const isTestModeActive = useFlowTestStore((s) => s.isTestModeActive);
  const isExecuting = useFlowTestStore((s) => s.isExecuting);
  const awaitingUserInput = useFlowTestStore((s) => s.awaitingUserInput);
  const simulatedContact = useFlowTestStore(useShallow((s) => s.simulatedContact));
  const closeTestMode = useFlowTestStore((s) => s.closeTestMode);
  const startTest = useFlowTestStore((s) => s.startTest);
  const stopTest = useFlowTestStore((s) => s.stopTest);
  const resetTest = useFlowTestStore((s) => s.resetTest);
  const setCurrentNode = useFlowTestStore((s) => s.setCurrentNode);
  const addMessage = useFlowTestStore((s) => s.addMessage);
  const addLogEntry = useFlowTestStore((s) => s.addLogEntry);
  const setVariable = useFlowTestStore((s) => s.setVariable);
  const setPendingMenuSelection = useFlowTestStore((s) => s.setPendingMenuSelection);
  const setAwaitingUserInput = useFlowTestStore((s) => s.setAwaitingUserInput);
  const addToExecutionHistory = useFlowTestStore((s) => s.addToExecutionHistory);

  const setTestHighlightedNode = useFlowEditorStore((s) => s.setTestHighlightedNode);

  const engineRef = useRef<FlowTestEngine | null>(null);

  const handleStartTest = useCallback(() => {
    startTest();
    setTestHighlightedNode(null);

    // Obter nodes e edges diretamente do store para evitar re-renders desnecessarios
    const { nodes, edges } = useFlowEditorStore.getState();

    const engine = new FlowTestEngine({
      nodes,
      edges,
      simulatedContact,
      executionDelay: 400,
      callbacks: {
        onNodeEnter: (nodeId) => {
          setCurrentNode(nodeId);
          setTestHighlightedNode(nodeId);
          addToExecutionHistory(nodeId);
        },
        onNodeExit: () => {
          setTestHighlightedNode(null);
        },
        onMessage: (message) => {
          addMessage(message);
        },
        onLogEntry: (entry) => {
          addLogEntry(entry);
        },
        onVariableSet: (key, value) => {
          setVariable(key, value);
        },
        onWaitForInput: (nodeId, inputType, options) => {
          setAwaitingUserInput(true);
          if (inputType === "menu" && options) {
            setPendingMenuSelection({ nodeId, options });
          } else {
            setPendingMenuSelection(null);
          }
        },
        onComplete: () => {
          stopTest();
          setTestHighlightedNode(null);
          addMessage({
            type: "system",
            content: "Fluxo finalizado",
          });
        },
        onError: (error) => {
          stopTest();
          setTestHighlightedNode(null);
          addMessage({
            type: "system",
            content: `Erro: ${error}`,
          });
        },
      },
    });

    engineRef.current = engine;
    engine.start();
  }, [
    simulatedContact,
    startTest,
    setCurrentNode,
    setTestHighlightedNode,
    addMessage,
    addLogEntry,
    setVariable,
    setPendingMenuSelection,
    setAwaitingUserInput,
    addToExecutionHistory,
    stopTest,
  ]);

  const handleStopTest = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    stopTest();
    setTestHighlightedNode(null);
  }, [stopTest, setTestHighlightedNode]);

  const handleResetTest = useCallback(() => {
    handleStopTest();
    resetTest();
  }, [handleStopTest, resetTest]);

  const handleUserMessage = useCallback(
    (message: string) => {
      if (engineRef.current && awaitingUserInput) {
        setAwaitingUserInput(false);
        setPendingMenuSelection(null);
        engineRef.current.provideUserInput(message);
      }
    },
    [awaitingUserInput, setAwaitingUserInput, setPendingMenuSelection]
  );

  const handleStartWithMessage = useCallback(
    (initialMessage: string) => {
      addMessage({
        type: "user",
        content: initialMessage,
      });

      handleStartTest();
    },
    [addMessage, handleStartTest]
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setTestHighlightedNode(nodeId);
      setTimeout(() => setTestHighlightedNode(null), 1500);
    },
    [setTestHighlightedNode]
  );

  const handleClose = useCallback(() => {
    handleStopTest();
    closeTestMode();
  }, [handleStopTest, closeTestMode]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
    };
  }, []);

  return (
    <Drawer
      anchor="right"
      open={isTestModeActive}
      onClose={handleClose}
      variant="persistent"
      sx={{
        width: isTestModeActive ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">Modo de Teste</Typography>
              {isExecuting && (
                <Chip
                  label={awaitingUserInput ? "Aguardando" : "Executando"}
                  size="small"
                  color={awaitingUserInput ? "warning" : "success"}
                />
              )}
            </Stack>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            {!isExecuting ? (
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handleStartTest}
                fullWidth
                color="success"
              >
                Iniciar Teste
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<StopIcon />}
                onClick={handleStopTest}
                fullWidth
                color="error"
              >
                Parar
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={handleResetTest}
              disabled={!isExecuting && useFlowTestStore.getState().messages.length === 0}
            >
              Reset
            </Button>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <TestMiniChat onUserMessage={handleUserMessage} onStartWithMessage={handleStartWithMessage} />
          </Box>

          <Divider />

          <Box sx={{ p: 1, maxHeight: 300, overflow: "auto" }}>
            <TestVariablesPanel />
            <TestExecutionLog onNodeClick={handleNodeClick} />
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
