"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEvent = void 0;
var GameEvent;
(function (GameEvent) {
    GameEvent["CONNECT"] = "connect";
    GameEvent["DISCONNECT"] = "disconnect";
    GameEvent["SHIPS_PICKED"] = "shipsPicked";
    GameEvent["ENEMY_READY"] = "enemyReady";
    GameEvent["GAME_INFO"] = "gameStarted";
    GameEvent["TURN_CHANGED"] = "turnChanged";
    GameEvent["SHOOT_CELL"] = "shootCell";
    GameEvent["SHOOT_CELL_RESULT"] = "shootCellResult";
    GameEvent["CELL_SHOT"] = "cellShot";
    GameEvent["GAME_OVER"] = "gameOver";
    GameEvent["PLAYER_LEFT"] = "playerLeft";
    GameEvent["ENEMY_LEFT"] = "enemyLeft";
    GameEvent["NOT_READY"] = "notReady";
    GameEvent["ENEMY_CONNECTED_TO_ROOM"] = "enemyConnectedToRoom";
    GameEvent["ENEMY_DISCONNECTED_FROM_ROOM"] = "enemyDisconnectedFromRoom";
    GameEvent["CHAT_MESSAGE_SENT"] = "chatMessageSent";
})(GameEvent = exports.GameEvent || (exports.GameEvent = {}));
//# sourceMappingURL=GameEvent.js.map