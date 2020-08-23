import express from "express";
import socketio from "socket.io";
import { createServer, Server } from "http";
import cors from "cors";
import { GameEvent } from "./GameEvent";
import { Room, createRoom, Player, createPlayer, createComputer } from "./Room";
import { RoomsDB } from "./RoomsDB";
import {
  ExtendedSocket,
  sendStartGameSignalToPlayers,
  shootCell,
  sendEnemyReadySignal,
  GameData,
  sendInitialExistingData,
  onPlayerLeave,
  setPlayerNotReady,
  sendEnemyJoinedOrLeftRoomSignal,
} from "./GameUtils";
import { GameState } from "./GameState";
import { expressLogger, logger } from "./logger";

export class ShipSinkingServer {
  public static readonly PORT: number = 8080;
  private _app: express.Application;
  private server: Server;
  private io!: SocketIO.Server;
  private port: string | number;
  private roomsDB: RoomsDB;

  constructor() {
    this.roomsDB = new RoomsDB();
    this._app = express();
    this.port = process.env.PORT || ShipSinkingServer.PORT;
    this._app.use(cors());
    this._app.use(express.json());
    this._app.use(expressLogger);
    this._app.options("*", cors());
    this.server = createServer(this._app);
    this.initSocket();
    this.listen();
  }
  private initSocket(): void {
    this.io = socketio(this.server);
  }

  private listen(): void {
    this.server.listen(this.port, () => {
      logger.info("Running server on port %s", this.port);

      // create room (with or without computer)
      this._app.post("/room", async (req, res) => {
        const room: Room = createRoom();
        const player: Player = createPlayer();
        room.player1 = player;

        if (req.body.isComputer) {
          const computer: Player = createComputer(room.width, room.height);
          room.player2 = computer;
        }

        // add room to rooms array
        this.roomsDB.addRoom(room);

        logger.info(
          "Created room %s with isComputer=%s",
          room.id,
          req.body.isComputer
        );

        res.json({ roomId: room.id, playerId: player.id });
      });

      // does room exist and is provided player in it?
      this._app.get("/room/:id/playerInside/:pid", async (req, res) => {
        const roomId = req.params.id as string;
        const playerId = req.params.pid as string;

        const p = this.roomsDB.getPlayerByRoomIdAndId(roomId, playerId);

        const roomExists = p != null;
        res.json({ roomExists });
      });

      // try to join room if it exists and is free
      this._app.post("/room/:id/join", async (req, res) => {
        const roomId = req.params.id as string;

        const room = this.roomsDB.getRoomById(roomId);

        // player1 will always be filled with the player who created the room so check only player 2
        if (room != null && room.player2 == null) {
          // exists and is free - join
          room.player2 = createPlayer();
          res.json({ joinSuccess: true, playerId: room.player2.id });
          return;
        }

        logger.error("Unable to join room %s", roomId, req.body.isComputer);

        // unable to join
        res.json({ joinSuccess: false, playerId: null });
      });
    });

    const room: SocketIO.Namespace = this.io.of("/room");

    // on socket connect: /room
    room.on(GameEvent.CONNECT, (socket: ExtendedSocket) => {
      logger.info("New client connected to socket");

      const gameData = this.validateSocketConnection(socket);

      // disconnect on any error
      if (gameData == null) {
        socket.disconnect();
        logger.error("Client disconnected due to invalid data");
        return;
      }

      socket.gameData = gameData;

      logger.info(
        "Client validated: %s, sending initial data",
        gameData.player.id
      );

      // send initial data that might have been saved before from previous connections
      sendInitialExistingData(socket.gameData);
      sendEnemyJoinedOrLeftRoomSignal(
        socket.gameData.player,
        socket.gameData.room,
        false
      );

      socket.on(
        GameEvent.SHIPS_PICKED,
        ({ stateTable }: { stateTable: number[][] }) => {
          logger.info("Ships picked for user %s", socket.gameData.player.id);

          this.roomsDB.setPlayerReady(
            socket.gameData.room.id,
            socket.gameData.player.id,
            stateTable
          );

          const areBothPlayersReady: boolean = this.roomsDB.bothPlayersReady(
            socket.gameData.room.id
          );

          if (areBothPlayersReady) {
            logger.info(
              "Both players ready in room %s",
              socket.gameData.room.id
            );
            socket.gameData.room.gameState = GameState.IN_PROGRESS;
            sendStartGameSignalToPlayers(socket.gameData);
          } else {
            sendEnemyReadySignal(socket.gameData.player, socket.gameData);
          }
        }
      );

      // player changed mind about picking ships
      socket.on(GameEvent.NOT_READY, () => {
        logger.info(
          "Shot cell: %s changed mind in room %s",
          socket.gameData.player.id,
          socket.gameData.room.id
        );

        setPlayerNotReady(socket.gameData.player);
        sendEnemyReadySignal(socket.gameData.player, socket.gameData);
      });

      socket.on(GameEvent.SHOOT_CELL, ({ x, y }: { x: number; y: number }) => {
        logger.info(
          "Shot cell: %s (%s, %s) in room %s",
          socket.gameData.player.id,
          x,
          y,
          socket.gameData.room.id
        );
        shootCell({ x, y }, socket.gameData.player, socket.gameData);
      });

      socket.on(GameEvent.PLAYER_LEFT, () => {
        logger.info("Client %s left", socket.gameData.player.id);
        onPlayerLeave(socket.gameData.player, socket.gameData.room);
      });

      socket.on(GameEvent.DISCONNECT, () => {
        logger.info("Client %s disconnected", socket.gameData.player.id);
        sendEnemyJoinedOrLeftRoomSignal(
          socket.gameData.player,
          socket.gameData.room,
          true
        );
        socket.gameData.player.socket = undefined;
      });
    });
  }

  // queries database and checks if socket request is valid
  private validateSocketConnection(socket: ExtendedSocket): GameData | null {
    // get query parameters
    const roomId: string | undefined = socket.handshake.query.roomId;
    const playerId: string | undefined = socket.handshake.query.playerId;

    // validate that they exist and are not empty
    if (
      roomId == null ||
      roomId.length === 0 ||
      playerId == null ||
      playerId.length === 0
    ) {
      return null;
    }

    // get room by provided id
    const room = this.roomsDB.getRoomById(roomId);

    if (room == null) {
      console.log("Room does not exist");
      return null;
    }

    // get player by provided id and make sure they are in this room
    const player = this.roomsDB.getPlayerByRoomIdAndId(roomId, playerId);

    if (player == null) {
      console.log("Player does not belong to this room");
      return null;
    }

    // check if player has existing socket connections and disconnect it
    if (player.socket) {
      player.socket.disconnect();
    }

    // construct game data object, containing current player,
    // current room and enemy of current player
    const gameData: GameData = {
      room,
      player,
    };

    gameData.player.socket = socket;
    return gameData;
  }

  get app(): express.Application {
    return this._app;
  }
}
