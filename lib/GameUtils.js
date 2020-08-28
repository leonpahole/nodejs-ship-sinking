"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomPoint = exports.shootCell = exports.getEnemy = exports.sendEnemyReadySignal = exports.setPlayerNotReady = exports.addMessageToChatsAndBroadcastToBothPlayers = exports.createChatMessage = exports.onPlayerLeave = exports.pickStartingPlayer = exports.sendGameInfoSignalToPlayer = exports.sendStartGameSignalToPlayers = exports.setPlayerReady = exports.sendEnemyJoinedOrLeftRoomSignal = exports.sendInitialExistingData = void 0;
const Room_1 = require("./Room");
const GameEvent_1 = require("./GameEvent");
const CellState_1 = require("./CellState");
const GameState_1 = require("./GameState");
exports.sendInitialExistingData = (gameData) => {
    exports.sendGameInfoSignalToPlayer(gameData.player, gameData.room);
};
exports.sendEnemyJoinedOrLeftRoomSignal = (player, room, left = false) => {
    var _a;
    const enemy = exports.getEnemy(player, room);
    if (enemy && enemy.isComputer === false) {
        (_a = enemy.socket) === null || _a === void 0 ? void 0 : _a.emit(left
            ? GameEvent_1.GameEvent.ENEMY_DISCONNECTED_FROM_ROOM
            : GameEvent_1.GameEvent.ENEMY_CONNECTED_TO_ROOM);
    }
    return exports.createChatMessage(null, player.name + " has " + (left ? "left" : "joined") + " the room.");
};
exports.setPlayerReady = (player, stateTable) => {
    player.status = Room_1.PlayerStatus.READY;
    player.stateTable = stateTable;
    return exports.createChatMessage(null, player.name + " is ready.");
};
exports.sendStartGameSignalToPlayers = (gameData) => {
    exports.sendGameInfoSignalToPlayer(gameData.room.player1, gameData.room);
    exports.sendGameInfoSignalToPlayer(gameData.room.player2, gameData.room);
    exports.pickStartingPlayer(gameData);
    return exports.createChatMessage(null, "Game has started!");
};
const hideCell = (cell) => {
    if (cell === CellState_1.CellState.SHIP_PLACED) {
        return CellState_1.CellState.UNTOUCHED;
    }
    return cell;
};
const hideStateTable = (stateTable) => {
    if (stateTable == null) {
        return null;
    }
    return stateTable.map((r) => r.map((c) => hideCell(c)));
};
exports.sendGameInfoSignalToPlayer = (player, room) => {
    var _a;
    if (player == null) {
        return;
    }
    const enemy = exports.getEnemy(player, room);
    let infoObject = {
        stateTable: player.stateTable,
        eStateTable: enemy ? hideStateTable(enemy.stateTable) : null,
        myTurn: player.status === Room_1.PlayerStatus.ON_TURN,
        hasWon: player.status === Room_1.PlayerStatus.HAS_WON,
        gState: room.gameState,
        enemyReady: (enemy === null || enemy === void 0 ? void 0 : enemy.status) === Room_1.PlayerStatus.READY,
        enemyConnected: enemy != null && (enemy.isComputer || enemy.socket != null),
        amIReady: player.status === Room_1.PlayerStatus.READY,
        isComputer: enemy ? enemy.isComputer : false,
        chats: room.chats.map((c) => c.transformForPlayer(player)),
        enemyName: enemy ? enemy.name : "",
    };
    if (player.isComputer === false) {
        (_a = player.socket) === null || _a === void 0 ? void 0 : _a.emit(GameEvent_1.GameEvent.GAME_INFO, infoObject);
    }
};
exports.pickStartingPlayer = (gameData) => {
    if (gameData.room.player2 == null) {
        return;
    }
    const playerIndex = Math.random();
    let firstPlayer, secondPlayer;
    if (gameData.room.player2.isComputer || playerIndex < 0.5) {
        firstPlayer = gameData.room.player1;
        secondPlayer = gameData.room.player2;
    }
    else {
        firstPlayer = gameData.room.player2;
        secondPlayer = gameData.room.player1;
    }
    firstPlayer.status = Room_1.PlayerStatus.ON_TURN;
    secondPlayer.status = Room_1.PlayerStatus.WAITING_ON_TURN;
    sendTurnChangedSignal(firstPlayer, true);
    sendTurnChangedSignal(secondPlayer, false);
};
exports.onPlayerLeave = (playerThatLeft, room) => {
    var _a;
    if (room.gameState === GameState_1.GameState.FINISHED) {
        return null;
    }
    const enemy = exports.getEnemy(playerThatLeft, room);
    room.gameState = GameState_1.GameState.FINISHED;
    let playerWonText = "";
    if (enemy && enemy.isComputer === false) {
        (_a = enemy.socket) === null || _a === void 0 ? void 0 : _a.emit(GameEvent_1.GameEvent.ENEMY_LEFT);
        playerWonText = " " + enemy.name + " won!";
    }
    return exports.createChatMessage(null, playerThatLeft.name + " left." + playerWonText);
};
exports.createChatMessage = (sender, message) => {
    return new Room_1.ChatMessage(sender ? sender.name : null, sender ? sender.id : null, message);
};
exports.addMessageToChatsAndBroadcastToBothPlayers = (room, chatMessage) => {
    room.chats.push(chatMessage);
    broadcastChatMessageToBothPlayers(room, chatMessage);
};
const broadcastChatMessageToBothPlayers = (room, chatMessage) => {
    sendChatToPlayer(room.player1, chatMessage);
    sendChatToPlayer(room.player2, chatMessage);
};
const sendChatToPlayer = (player, chatMessage) => {
    if (player && player.socket && player.isComputer === false) {
        player.socket.emit(GameEvent_1.GameEvent.CHAT_MESSAGE_SENT, {
            chatMessage: chatMessage.transformForPlayer(player),
        });
    }
};
exports.setPlayerNotReady = (player) => {
    player.status = Room_1.PlayerStatus.PICKING;
    return exports.createChatMessage(null, player.name + " changed their mind!");
};
exports.sendEnemyReadySignal = (player, gameData) => {
    var _a;
    if (player == null) {
        return;
    }
    const enemy = exports.getEnemy(player, gameData.room);
    if (enemy == null) {
        return;
    }
    if (enemy.isComputer === false) {
        (_a = enemy.socket) === null || _a === void 0 ? void 0 : _a.emit(GameEvent_1.GameEvent.ENEMY_READY, {
            isReady: player.status === Room_1.PlayerStatus.READY,
        });
    }
};
const sendGameOverSignal = (player, hasWon) => {
    var _a;
    if (player.isComputer) {
        return;
    }
    (_a = player.socket) === null || _a === void 0 ? void 0 : _a.emit(GameEvent_1.GameEvent.GAME_OVER, {
        hasWon,
    });
};
const sendTurnChangedSignal = (player, yourTurn) => {
    var _a;
    player.status = yourTurn
        ? Room_1.PlayerStatus.ON_TURN
        : Room_1.PlayerStatus.WAITING_ON_TURN;
    if (player.isComputer) {
        return;
    }
    (_a = player.socket) === null || _a === void 0 ? void 0 : _a.emit(GameEvent_1.GameEvent.TURN_CHANGED, {
        yourTurn,
    });
};
exports.getEnemy = (player, room) => {
    if (player.id === room.player1.id) {
        return room.player2;
    }
    return room.player1;
};
const hasPlayerLost = (player) => {
    return (player.stateTable.find((r) => r.find((l) => l === CellState_1.CellState.SHIP_PLACED) != null) == null);
};
exports.shootCell = async (point, player, gameData) => {
    // check if player is on turn
    if (player.status === Room_1.PlayerStatus.WAITING_ON_TURN) {
        return false;
    }
    const enemy = exports.getEnemy(player, gameData.room);
    let hitState;
    if ((enemy === null || enemy === void 0 ? void 0 : enemy.stateTable[point.x][point.y]) === CellState_1.CellState.UNTOUCHED) {
        hitState = CellState_1.CellState.MISSED;
    }
    else if ((enemy === null || enemy === void 0 ? void 0 : enemy.stateTable[point.x][point.y]) === CellState_1.CellState.SHIP_PLACED) {
        hitState = CellState_1.CellState.HIT;
    }
    else {
        // already hit cell was pressed, do nothing
        return false;
    }
    let pointUpdates = [{ point, state: hitState }];
    enemy.stateTable[point.x][point.y] = hitState;
    let hasEnemyLost = false;
    if (hitState === CellState_1.CellState.HIT) {
        const shipPath = getShipPathAtCell(point, enemy.stateTable);
        if (shipPath && isShipDestroyed(enemy.stateTable, shipPath) === true) {
            pointUpdates = [];
            for (let i = 0; i < shipPath.length; i++) {
                enemy.stateTable[shipPath[i].x][shipPath[i].y] = CellState_1.CellState.DESTROYED;
                pointUpdates.push({ point: shipPath[i], state: CellState_1.CellState.DESTROYED });
            }
            hasEnemyLost = hasPlayerLost(enemy);
            broadcastChatMessageToBothPlayers(gameData.room, exports.createChatMessage(null, player.name +
                " has destroyed" +
                enemy.name +
                "'s ship. Looks like a lot of damage."));
        }
    }
    sendShootResultSignal(pointUpdates, player);
    sendShootSignal(pointUpdates, enemy);
    if (hasEnemyLost) {
        gameData.room.gameState = GameState_1.GameState.FINISHED;
        enemy.status = Room_1.PlayerStatus.HAS_LOST;
        player.status = Room_1.PlayerStatus.HAS_WON;
        sendGameOverSignal(enemy, false);
        sendGameOverSignal(player, true);
        broadcastChatMessageToBothPlayers(gameData.room, exports.createChatMessage(null, player.name + " has won! They earned a hug."));
        return false;
    }
    else if (hitState === CellState_1.CellState.MISSED) {
        // next player's turn
        sendTurnChangedSignal(enemy, true);
        sendTurnChangedSignal(player, false);
        // handle computer
        if (enemy.isComputer) {
            let computerIsHit;
            do {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const computerMove = randomComputerMove(player, gameData.room);
                computerIsHit = await exports.shootCell(computerMove, enemy, gameData);
            } while (computerIsHit === true);
        }
    }
    return hitState === CellState_1.CellState.HIT;
};
const isCellNotHitYet = (cell) => {
    return cell === CellState_1.CellState.UNTOUCHED || cell === CellState_1.CellState.SHIP_PLACED;
};
const randomComputerMove = (player, room) => {
    let point = null;
    do {
        point = exports.randomPoint(room.width, room.height);
    } while (isCellNotHitYet(player.stateTable[point.x][point.y]) === false);
    return point;
};
exports.randomPoint = (width, height) => {
    const point = {
        x: Math.floor(Math.random() * width),
        y: Math.floor(Math.random() * height),
    };
    return point;
};
const sendShootSignal = (pointUpdates, player) => {
    var _a;
    if (player.isComputer === false) {
        (_a = player.socket) === null || _a === void 0 ? void 0 : _a.emit(GameEvent_1.GameEvent.CELL_SHOT, { pointUpdates });
    }
};
const sendShootResultSignal = (pointUpdates, player) => {
    var _a;
    if (player.isComputer === false) {
        (_a = player.socket) === null || _a === void 0 ? void 0 : _a.emit(GameEvent_1.GameEvent.SHOOT_CELL_RESULT, { pointUpdates });
    }
};
const isCellShip = (cellState) => {
    return (cellState === CellState_1.CellState.HIT ||
        cellState === CellState_1.CellState.DESTROYED ||
        cellState === CellState_1.CellState.SHIP_PLACED);
};
const isShipDestroyed = (stateTable, shipPath) => {
    if (shipPath == null) {
        return false;
    }
    return shipPath.every((s) => stateTable[s.x][s.y] === CellState_1.CellState.HIT);
};
const getShipPathAtCell = (point, stateTable) => {
    // check if this cell has ship placed
    if (isCellShip(stateTable[point.x][point.y]) === false) {
        // no
        return null;
    }
    const width = stateTable.length;
    const height = stateTable[0].length;
    const shipCells = [{ x: point.x, y: point.y }];
    // yes
    // go left as much as possible until end of table or no more ship
    for (let xi = point.x - 1; xi >= 0 && isCellShip(stateTable[xi][point.y]); xi--) {
        shipCells.push({ x: xi, y: point.y });
    }
    // go right as much as possible until end of table or no more ship
    for (let xi = point.x + 1; xi < width && isCellShip(stateTable[xi][point.y]); xi++) {
        shipCells.push({ x: xi, y: point.y });
    }
    // go up as much as possible until end of table or no more ship
    for (let yi = point.y - 1; yi >= 0 && isCellShip(stateTable[point.x][yi]); yi--) {
        shipCells.push({ x: point.x, y: yi });
    }
    // go down as much as possible until end of table or no more ship
    for (let yi = point.y + 1; yi < height && isCellShip(stateTable[point.x][yi]); yi++) {
        shipCells.push({ x: point.x, y: yi });
    }
    return shipCells;
};
//# sourceMappingURL=GameUtils.js.map