"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsDB = void 0;
const Room_1 = require("./Room");
class RoomsDB {
    constructor() {
        this.rooms = [];
    }
    addRoom(room) {
        this.rooms.push(room);
    }
    getRoomById(id) {
        return this.rooms.find((r) => r.id === id);
    }
    getPlayerByRoomIdAndId(roomId, playerId) {
        var _a;
        const room = this.getRoomById(roomId);
        if (!room) {
            return null;
        }
        if (room.player1.id === playerId) {
            return room.player1;
        }
        else if (((_a = room.player2) === null || _a === void 0 ? void 0 : _a.id) === playerId) {
            return room.player2;
        }
        return null;
    }
    // checks if player with given id is in this room
    verifyPlayerInRoom(roomId, playerId) {
        return this.getPlayerByRoomIdAndId(roomId, playerId) != null;
    }
    setSocketForPlayer(roomId, playerId, socket) {
        const player = this.getPlayerByRoomIdAndId(roomId, playerId);
        if (!player) {
            return false;
        }
        player.socket = socket;
        return true;
    }
    bothPlayersReady(roomId) {
        var _a;
        const room = this.getRoomById(roomId);
        if (!room) {
            return false;
        }
        return (room.player1.status === Room_1.PlayerStatus.READY &&
            ((_a = room.player2) === null || _a === void 0 ? void 0 : _a.status) === Room_1.PlayerStatus.READY);
    }
}
exports.RoomsDB = RoomsDB;
//# sourceMappingURL=RoomsDB.js.map