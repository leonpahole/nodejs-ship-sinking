"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComputer = exports.createPlayer = exports.createRoom = exports.ships = exports.Player = exports.PlayerStatus = exports.Room = exports.ChatMessage = void 0;
const CellState_1 = require("./CellState");
const GameState_1 = require("./GameState");
const GameUtils_1 = require("./GameUtils");
const crypto_1 = __importDefault(require("crypto"));
class ChatMessage {
    constructor(from, fromId, message) {
        this.from = from;
        this.fromId = fromId;
        this.message = message;
        this.isMine = false;
    }
    transformForPlayer(player) {
        let isMine = false;
        if (this.fromId === player.id) {
            isMine = true;
        }
        return { from: this.from, message: this.message, isMine };
    }
}
exports.ChatMessage = ChatMessage;
class Room {
    constructor(id, width, height) {
        this.chats = [];
        this.id = id;
        this.width = width;
        this.height = height;
        this.gameState = GameState_1.GameState.PICKING_SHIPS;
    }
}
exports.Room = Room;
var PlayerStatus;
(function (PlayerStatus) {
    PlayerStatus[PlayerStatus["PICKING"] = 0] = "PICKING";
    PlayerStatus[PlayerStatus["READY"] = 1] = "READY";
    PlayerStatus[PlayerStatus["WAITING_ON_TURN"] = 2] = "WAITING_ON_TURN";
    PlayerStatus[PlayerStatus["ON_TURN"] = 3] = "ON_TURN";
    PlayerStatus[PlayerStatus["HAS_WON"] = 4] = "HAS_WON";
    PlayerStatus[PlayerStatus["HAS_LOST"] = 5] = "HAS_LOST";
})(PlayerStatus = exports.PlayerStatus || (exports.PlayerStatus = {}));
class Player {
    constructor(id, isComputer = false) {
        this.id = id;
        this.isComputer = isComputer;
    }
}
exports.Player = Player;
exports.ships = [
    { length: 4, capacity: 1, currentCapacity: 0 },
    { length: 3, capacity: 2, currentCapacity: 0 },
    { length: 2, capacity: 3, currentCapacity: 0 },
    { length: 1, capacity: 4, currentCapacity: 0 },
];
// create room object for the game
exports.createRoom = () => {
    const room = new Room(createId(7), 10, 10);
    return room;
};
// create player object for the game
exports.createPlayer = () => {
    const player = new Player(createId(10));
    player.status = PlayerStatus.PICKING;
    return player;
};
// create id from numbers and upper case letters with given length
const createId = (length) => {
    return crypto_1.default
        .randomBytes(length / 2)
        .toString("hex")
        .toUpperCase();
};
exports.createComputer = (width, height) => {
    const player = new Player("Comp Uter", true);
    player.stateTable = generateRandomShips(width, height);
    player.status = PlayerStatus.READY;
    return player;
};
const initialState = (width, height) => {
    const field = new Array(width);
    for (let w = 0; w < width; w++) {
        field[w] = new Array(height);
        for (let h = 0; h < height; h++) {
            field[w][h] = CellState_1.CellState.UNTOUCHED;
        }
    }
    return field;
};
const generateRandomShips = (width, height) => {
    const stateTable = initialState(width, height);
    for (let ship = 0; ship < exports.ships.length; ship++) {
        const currentShip = exports.ships[ship];
        for (let shipAmount = 0; shipAmount < currentShip.capacity; shipAmount++) {
            let shipPlaced = false;
            while (shipPlaced === false) {
                const rPoint = GameUtils_1.randomPoint(width, height);
                let randomX = rPoint.x;
                let randomY = rPoint.y;
                /*
                 * 0 - up
                 * 1 - right
                 * 2 - down
                 * 3 - left
                 */
                let randomDirection = Math.floor(Math.random() * 4);
                let finalX = -1;
                let finalY = -1;
                let direction = 0;
                if (randomDirection == 0) {
                    finalX = randomX;
                    finalY = randomY + currentShip.length - 1;
                    direction = 1;
                }
                else if (randomDirection == 1) {
                    finalX = randomX + currentShip.length - 1;
                    finalY = randomY;
                    direction = 1;
                }
                else if (randomDirection == 2) {
                    finalX = randomX;
                    finalY = randomY - currentShip.length + 1;
                    direction = -1;
                }
                else if (randomDirection == 3) {
                    finalX = randomX - currentShip.length + 1;
                    finalY = randomY;
                    direction = -1;
                }
                let stateInvalid = false;
                if (finalX >= 0 && finalY >= 0 && finalX < width && finalY < height) {
                    for (let x = randomX; direction == -1 ? x >= finalX : x <= finalX; x += direction) {
                        if (stateInvalid === true)
                            break;
                        for (let y = randomY; direction == -1 ? y >= finalY : y <= finalY; y += direction) {
                            if (stateTable[x][y] == CellState_1.CellState.SHIP_PLACED) {
                                stateInvalid = true;
                                break;
                            }
                            /* check for fields around the ship */
                            for (let aroundX = -1; aroundX <= 1; aroundX++) {
                                for (let aroundY = -1; aroundY <= 1; aroundY++) {
                                    if (x + aroundX >= 0 &&
                                        y + aroundY >= 0 &&
                                        x + aroundX < width &&
                                        y + aroundY < height) {
                                        if (stateTable[x + aroundX][y + aroundY] ==
                                            CellState_1.CellState.SHIP_PLACED) {
                                            stateInvalid = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (stateInvalid === false) {
                        for (let x = randomX; direction == -1 ? x >= finalX : x <= finalX; x += direction) {
                            for (let y = randomY; direction == -1 ? y >= finalY : y <= finalY; y += direction) {
                                stateTable[x][y] = CellState_1.CellState.SHIP_PLACED;
                            }
                        }
                        shipPlaced = true;
                    }
                }
            }
        }
    }
    return stateTable;
};
//# sourceMappingURL=Room.js.map