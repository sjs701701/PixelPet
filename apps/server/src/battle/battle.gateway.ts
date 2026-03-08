import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Inject } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { AuthSessionService } from "../common/session.service";
import { BattleService } from "./battle.service";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class BattleGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(AuthSessionService)
    private readonly sessions: AuthSessionService,
    @Inject(BattleService)
    private readonly battles: BattleService,
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth.token as string | undefined;
    this.sessions.verifyToken(token);
  }

  @SubscribeMessage("battle:join")
  joinBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string },
  ) {
    client.join(payload.battleId);
  }

  @SubscribeMessage("battle:turn-submit")
  submitTurn(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; action: "attack" | "guard" | "skill" },
  ) {
    const token = client.handshake.auth.token as string | undefined;
    const userId = this.sessions.verifyToken(token);
    const snapshot = this.battles.submitAction(payload.battleId, userId, payload.action);
    this.server.to(payload.battleId).emit("battle:state", snapshot);
    return snapshot;
  }
}
