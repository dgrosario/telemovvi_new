import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { Option, Step, Tab as TabType, Type } from ".";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TabContext, TabPanel } from "@mui/lab";
import { useMemo } from "react";

type Props = {
  activeStep: Step;
  setActiveStep(activeStep: Step): void;
  closeDialog(): void;
  tab: TabType;
  setTab(tab: TabType): void;
  setType(type: Type): void;
  type: Type;
  options: Option[];
  optionsUtility: Option[];
};

export const CategorySteps: React.FC<Props> = (props) => {
  const imgExample = useMemo(() => {
    const mapImages = new Map<Type, string>([
      ["carrousel", "carrousel.gif"],
      ["custom", "custom.png"],
      ["custom-utility", "custom-utility.png"],
      ["flow-utility", "flow-utility.gif"],
      ["flows", "flows.gif"],
    ]);
    return mapImages.get(props.type)!;
  }, [props.type]);

  return (
    <div
      className="w-full h-screen max-h-[700px]"
      data-hidden={props.activeStep !== "category"}
    >
      <div className="flex justify-between pb-5 items-center">
        <Typography variant="h5" className="font-semibold">
          Categoria de modelo do WhatsApp
        </Typography>
        <div className="flex gap-4 justify-between">
          <Button
            variant="text"
            onClick={() => {
              if (props.activeStep === "category") {
                props.closeDialog();
                return;
              }
              props.setActiveStep("category");
            }}
          >
            {props.activeStep === "category" ? "Cancelar" : "Voltar"}
          </Button>
          {props.activeStep === "category" ? (
            <Button
              variant="contained"
              onClick={() => props.setActiveStep("register")}
            >
              Próximo
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Enviar para análise</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Enviar para análise?</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-orange-400 hover:bg-orange-400/80">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction>Enviar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="flex gap-4 pb-10">
        <div className="flex w-full flex-col">
          <TabContext value={props.tab}>
            <Tabs value={props.tab} onChange={(_, tab) => props.setTab(tab)}>
              <Tab value="marketing" label="Marketing" />
              <Tab value="utility" label="Utilidade" />
            </Tabs>

            <TabPanel value="marketing">
              <Typography variant="body2" paddingBottom={4}>
                Para mensagens promocionais, como ofertas especiais, vendas ou
                anúncios de novos produtos
              </Typography>

              <RadioGroup
                value={props.type}
                onChange={(e) => props.setType(e.target.value as Type)}
              >
                <div className="space-y-2">
                  {props.options.map((opt) => (
                    <Card
                      key={opt.value}
                      variant="outlined"
                      sx={{
                        borderColor:
                          props.type === opt.value ? "primary.main" : "divider",
                        boxShadow: props.type === opt.value ? 3 : 0,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <CardActionArea onClick={() => props.setType(opt.value)}>
                        <CardContent
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                          }}
                        >
                          <Radio
                            checked={props.type === opt.value}
                            value={opt.value}
                            sx={{ mr: 2 }}
                          />
                          <div>
                            <Typography
                              variant="subtitle2"
                              fontWeight="bold"
                              color="black"
                            >
                              {opt.title}
                            </Typography>
                            <Typography variant="body2">
                              {opt.description}
                            </Typography>
                          </div>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  ))}
                </div>
              </RadioGroup>
            </TabPanel>

            <TabPanel value="utility">
              <Typography variant="body2" gutterBottom>
                Para mensagens que mantêm os clientes informados, como
                rastreamento de pedidos, lembretes de reservas, confirmações ou
                atualizações de pagamento.
              </Typography>

              <RadioGroup
                value={props.type}
                onChange={(e) => props.setType(e.target.value as Type)}
              >
                <Box display="flex" flexDirection="column" gap={2} mt={2}>
                  {props.optionsUtility.map((opt) => (
                    <Card
                      key={opt.value}
                      variant="outlined"
                      sx={{
                        borderColor:
                          props.type === opt.value ? "primary.main" : "divider",
                        boxShadow: props.type === opt.value ? 3 : 0,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <CardActionArea onClick={() => props.setType(opt.value)}>
                        <CardContent
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                          }}
                        >
                          <Radio
                            checked={props.type === opt.value}
                            value={opt.value}
                            sx={{ mr: 2 }}
                          />
                          <div>
                            <Typography
                              variant="subtitle2"
                              fontWeight="bold"
                              color="black"
                            >
                              {opt.title}
                            </Typography>
                            <Typography variant="body2">
                              {opt.description}
                            </Typography>
                          </div>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  ))}
                </Box>
              </RadioGroup>
            </TabPanel>
          </TabContext>
        </div>
        <div
          style={{
            backgroundImage: `url('${imgExample}')`,
          }}
          className="h-screen max-h-[600px] bg-center bg-contain bg-no-repeat min-w-[300px]"
        />
      </div>
    </div>
  );
};
