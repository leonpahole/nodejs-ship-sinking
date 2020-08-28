"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipSinkingServer = void 0;
const express_1 = __importDefault(require("express"));
const socket_io_1 = __importDefault(require("socket.io"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const GameEvent_1 = require("./GameEvent");
const Room_1 = require("./Room");
const RoomsDB_1 = require("./RoomsDB");
const GameUtils_1 = require("./GameUtils");
const GameState_1 = require("./GameState");
const logger_1 = require("./logger");
class ShipSinkingServer {
    constructor() {
        this.roomsDB = new RoomsDB_1.RoomsDB();
        this._app = express_1.default();
        this.port = process.env.PORT || ShipSinkingServer.PORT;
        this._app.use(cors_1.default());
        this._app.use(express_1.default.json());
        this._app.use(logger_1.expressLogger);
        this._app.options("*", cors_1.default());
        this.server = http_1.createServer(this._app);
        this.initSocket();
        this.listen();
    }
    initSocket() {
        this.io = socket_io_1.default(this.server);
    }
    listen() {
        this.server.listen(this.port, () => {
            logger_1.logger.info("Running server on port %s", this.port);
            // create room (with or without computer)
            this._app.post("/room", async (req, res) => {
                const room = Room_1.createRoom();
                const player = Room_1.createPlayer();
                room.player1 = player;
                if (req.body.isComputer) {
                    const computer = Room_1.createComputer(room.width, room.height);
                    room.player2 = computer;
                }
                // add room to rooms array
                this.roomsDB.addRoom(room);
                logger_1.logger.info("Created room %s with isComputer=%s", room.id, req.body.isComputer);
                res.json({ roomId: room.id, playerId: player.id });
            });
            // does room exist and is provided player in it?
            this._app.get("/room/:id/playerInside/:pid", async (req, res) => {
                const roomId = req.params.id;
                const playerId = req.params.pid;
                const p = this.roomsDB.getPlayerByRoomIdAndId(roomId, playerId);
                const roomExists = p != null;
                res.json({ roomExists });
            });
            // try to join room if it exists and is free
            this._app.post("/room/:id/join", async (req, res) => {
                const roomId = req.params.id;
                const room = this.roomsDB.getRoomById(roomId);
                // player1 will always be filled with the player who created the room so check only player 2
                if (room != null && room.player2 == null) {
                    // exists and is free - join
                    room.player2 = Room_1.createPlayer();
                    res.json({ joinSuccess: true, playerId: room.player2.id });
                    return;
                }
                logger_1.logger.error("Unable to join room %s", roomId, req.body.isComputer);
                // unable to join
                res.json({ joinSuccess: false, playerId: null });
            });
        });
        const room = this.io.of("/room");
        // on socket connect: /room
        room.on(GameEvent_1.GameEvent.CONNECT, (socket) => {
            logger_1.logger.info("New client connected to socket");
            const gameData = this.validateSocketConnection(socket);
            // disconnect on any error
            if (gameData == null) {
                socket.disconnect();
                logger_1.logger.error("Client disconnected due to invalid data");
                return;
            }
            socket.gameData = gameData;
            logger_1.logger.info("Client validated: %s, sending initial data", gameData.player.id);
            // send initial data that might have been saved before from previous connections
            GameUtils_1.sendInitialExistingData(socket.gameData);
            const chatMessageJoined = GameUtils_1.sendEnemyJoinedOrLeftRoomSignal(socket.gameData.player, socket.gameData.room, false);
            GameUtils_1.addMessageToChatsAndBroadcastToBothPlayers(socket.gameData.room, chatMessageJoined);
            socket.on(GameEvent_1.GameEvent.SHIPS_PICKED, ({ stateTable }) => {
                logger_1.logger.info("Ships picked for user %s", socket.gameData.player.id);
                const chatMessageReady = GameUtils_1.setPlayerReady(socket.gameData.player, stateTable);
                GameUtils_1.addMessageToChatsAndBroadcastToBothPlayers(socket.gameData.room, chatMessageReady);
                const areBothPlayersReady = this.roomsDB.bothPlayersReady(socket.gameData.room.id);
                if (areBothPlayersReady) {
                    logger_1.logger.info("Both players ready in room %s", socket.gameData.room.id);
                    socket.gameData.room.gameState = GameState_1.GameState.IN_PROGRESS;
                    const chatMessageGameStarted = GameUtils_1.sendStartGameSignalToPlayers(socket.gameData);
                    GameUtils_1.addMessageToChatsAndBroadcastToBothPlayers(socket.gameData.room, chatMessageGameStarted);
                }
                else {
                    GameUtils_1.sendEnemyReadySignal(socket.gameData.player, socket.gameData);
                }
            });
            // player changed mind about picking ships
            socket.on(GameEvent_1.GameEvent.NOT_READY, () => {
                logger_1.logger.info("Shot cell: %s changed mind in room %s", socket.gameData.player.id, socket.gameData.room.id);
                const chatMessageNotReady = GameUtils_1.setPlayerNotReady(socket.gameData.player);
                GameUtils_1.addMessageToChatsAndBroadcastToBothPlayers(socket.gameData.room, chatMessageNotReady);
                GameUtils_1.sendEnemyReadySignal(socket.gameData.player, socket.gameData);
            });
            socket.on(GameEvent_1.GameEvent.SHOOT_CELL, ({ x, y }) => {
                logger_1.logger.info("Shot cell: %s (%s, %s) in room %s", socket.gameData.player.id, x, y, socket.gameData.room.id);
                GameUtils_1.shootCell({ x, y }, socket.gameData.player, socket.gameData);
            });
            socket.on(GameEvent_1.GameEvent.PLAYER_LEFT, () => {
                logger_1.logger.info("Client %s left", socket.gameData.player.id);
                const chatMessageLeave = GameUtils_1.onPlayerLeave(socket.gameData.player, socket.gameData.room);
                if (chatMessageLeave) {
                    GameUtils_1.addMessageToChatsAndBroadcastToBothPlayers(socket.gameData.room, chatMessageLeave);
                }
            });
            socket.on(GameEvent_1.GameEvent.CHAT_MESSAGE_SENT, ({ message }) => {
                logger_1.logger.info("Client %s sent %s", socket.gameData.player.id, message);
                const chatMessage = GameUtils_1.createChatMessage(gameData.player, message);
                GameUtils_1.addMessageToChatsAndBroadcastToBothPlayers(socket.gameData.room, chatMessage);
            });
            socket.on(GameEvent_1.GameEvent.DISCONNECT, () => {
                logger_1.logger.info("Client %s disconnected", socket.gameData.player.id);
                const chatMessage = GameUtils_1.sendEnemyJoinedOrLeftRoomSignal(socket.gameData.player, socket.gameData.room, true);
                socket.gameData.player.socket = undefined;
                GameUtils_1.addMessageToChatsAndBroadcastToBothPlayers(socket.gameData.room, chatMessage);
            });
        });
    }
    // queries database and checks if socket request is valid
    validateSocketConnection(socket) {
        // get query parameters
        const roomId = socket.handshake.query.roomId;
        const playerId = socket.handshake.query.playerId;
        const playerName = socket.handshake.query.playerName;
        // validate that they exist and are not empty
        if (roomId == null ||
            roomId.length === 0 ||
            playerId == null ||
            playerId.length === 0 ||
            playerName == null ||
            playerName.length === 0) {
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
        player.name = playerName;
        // check if player has existing socket connections and disconnect it
        if (player.socket) {
            player.socket.disconnect();
        }
        // construct game data object, containing current player,
        // current room and enemy of current player
        const gameData = {
            room,
            player,
        };
        gameData.player.socket = socket;
        return gameData;
    }
    get app() {
        return this._app;
    }
}
exports.ShipSinkingServer = ShipSinkingServer;
ShipSinkingServer.PORT = 8080;
//# sourceMappingURL=ShipSinkingServer.js.map