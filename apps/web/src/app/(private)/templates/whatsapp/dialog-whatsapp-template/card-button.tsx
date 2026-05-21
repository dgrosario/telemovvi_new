import { Card, CardActionArea, CardContent, Typography } from "@mui/material";

type Props = {
  onOpen(): void;
};
export const CardButton: React.FC<Props> = (props) => (
  <Card variant="outlined">
    <CardActionArea onClick={() => props.onOpen()}>
      <CardContent>
        <Typography gutterBottom variant="h5" component="div">
          Modelos do WhatsApp
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Crie modelos do WhatsApp e peça aprovação à Meta para iniciar chats,
          enviar transmissões e interagir com seus clientes.
        </Typography>

        <ul className="flex flex-col gap-2 py-3">
          <li>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              <span className="text-[20px] pr-2">🚀</span>Alcance clientes no
              WhatsApp Business
            </Typography>
          </li>
          <li>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              <span className="text-[20px] pr-2">📢</span>Envie campanhas de
              marketing
            </Typography>
          </li>
          <li>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              <span className="text-[20px] pr-2">💬</span>Inicie novas conversas
              com os clientes
            </Typography>
          </li>
          <li>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              <span className="text-[20px] pr-2">💸</span>Taxas de mensagem se
              aplicam
            </Typography>
          </li>
        </ul>
      </CardContent>
    </CardActionArea>
  </Card>
);
