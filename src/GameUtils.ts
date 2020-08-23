import { Room, Player, PlayerStatus } from "./Room";
import { GameEvent } from "./GameEvent";
import { CellState } from "./CellState";
import { GameState } from "./GameState";

export interface GameData {
  room: Room;
  player: Player;
}

export interface Point {
  x: number;
  y: number;
}

export interface PointUpdate {
  point: Point;
  state: number;
}

export interface ExtendedSocket extends SocketIO.Socket {
  gameData: GameData;
}

export const sendInitialExistingData = (gameData: GameData) => {
  sendGameInfoSignalToPlayer(gameData.player, gameData.room);
};

export const sendEnemyJoinedOrLeftRoomSignal = (
  player: Player,
  room: Room,
  left = false
) => {
  const enemy = getEnemy(player, room);
  if (enemy && enemy.isComputer === false) {
    enemy.socket?.emit(
      left
        ? GameEvent.ENEMY_DISCONNECTED_FROM_ROOM
        : GameEvent.ENEMY_CONNECTED_TO_ROOM
    );
  }
};

export const sendStartGameSignalToPlayers = (gameData: GameData) => {
  sendGameInfoSignalToPlayer(gameData.room.player1, gameData.room);
  sendGameInfoSignalToPlayer(gameData.room.player2, gameData.room);

  pickStartingPlayer(gameData);
};

const hideCell = (cell: number) => {
  if (cell === CellState.SHIP_PLACED) {
    return CellState.UNTOUCHED;
  }

  return cell;
};

const hideStateTable = (stateTable: number[][]) => {
  if (stateTable == null) {
    return null;
  }

  return stateTable.map((r) => r.map((c) => hideCell(c)));
};

export const sendGameInfoSignalToPlayer = (player: Player, room: Room) => {
  if (player == null) {
    return;
  }

  const enemy = getEnemy(player, room);

  let infoObject = {
    stateTable: player.stateTable,
    eStateTable: enemy ? hideStateTable(enemy.stateTable) : null,
    myTurn: player.status === PlayerStatus.ON_TURN,
    hasWon: player.status === PlayerStatus.HAS_WON,
    gState: room.gameState,
    enemyReady: enemy?.status === PlayerStatus.READY,
    enemyConnected: enemy != null && (enemy.isComputer || enemy.socket != null),
    amIReady: player.status === PlayerStatus.READY,
  };

  if (player.isComputer === false) {
    player.socket?.emit(GameEvent.GAME_INFO, infoObject);
  }
};

export const pickStartingPlayer = (gameData: GameData) => {
  if (gameData.room.player2 == null) {
    return;
  }

  const playerIndex = Math.random();
  let firstPlayer, secondPlayer;
  if (gameData.room.player2.isComputer || playerIndex < 0.5) {
    firstPlayer = gameData.room.player1;
    secondPlayer = gameData.room.player2;
  } else {
    firstPlayer = gameData.room.player2;
    secondPlayer = gameData.room.player1;
  }

  firstPlayer.status = PlayerStatus.ON_TURN;
  secondPlayer.status = PlayerStatus.WAITING_ON_TURN;

  sendTurnChangedSignal(firstPlayer, true);
  sendTurnChangedSignal(secondPlayer, false);
};

export const onPlayerLeave = (playerThatLeft: Player, room: Room) => {
  if (room.gameState === GameState.FINISHED) {
    return;
  }

  const enemy = getEnemy(playerThatLeft, room);
  room.gameState = GameState.FINISHED;
  if (enemy && enemy.isComputer === false) {
    enemy.socket?.emit(GameEvent.ENEMY_LEFT);
  }
};

export const setPlayerNotReady = (player: Player) => {
  player.status = PlayerStatus.PICKING;
};

export const sendEnemyReadySignal = (player: Player, gameData: GameData) => {
  if (player == null) {
    return;
  }

  const enemy = getEnemy(player, gameData.room);
  if (enemy == null) {
    return;
  }

  if (enemy.isComputer === false) {
    enemy.socket?.emit(GameEvent.ENEMY_READY, {
      isReady: player.status === PlayerStatus.READY,
    });
  }
};

const sendGameOverSignal = (player: Player, hasWon: boolean) => {
  if (player.isComputer) {
    return;
  }

  player.socket?.emit(GameEvent.GAME_OVER, {
    hasWon,
  });
};

const sendTurnChangedSignal = (player: Player, yourTurn: boolean) => {
  player.status = yourTurn
    ? PlayerStatus.ON_TURN
    : PlayerStatus.WAITING_ON_TURN;

  if (player.isComputer) {
    return;
  }

  player.socket?.emit(GameEvent.TURN_CHANGED, {
    yourTurn,
  });
};

export const getEnemy = (player: Player, room: Room): Player => {
  if (player.id === room.player1.id) {
    return room.player2;
  }

  return room.player1;
};

const hasPlayerLost = (player: Player) => {
  return (
    player.stateTable.find(
      (r) => r.find((l) => l === CellState.SHIP_PLACED) != null
    ) == null
  );
};

export const shootCell = async (
  point: Point,
  player: Player,
  gameData: GameData
) => {
  // check if player is on turn
  if (player.status === PlayerStatus.WAITING_ON_TURN) {
    return false;
  }

  const enemy = getEnemy(player, gameData.room);
  let hitState;
  if (enemy?.stateTable[point.x][point.y] === CellState.UNTOUCHED) {
    hitState = CellState.MISSED;
  } else if (enemy?.stateTable[point.x][point.y] === CellState.SHIP_PLACED) {
    hitState = CellState.HIT;
  } else {
    // already hit cell was pressed, do nothing
    return false;
  }

  let pointUpdates: PointUpdate[] = [{ point, state: hitState }];

  enemy.stateTable[point.x][point.y] = hitState;
  let hasEnemyLost = false;

  if (hitState === CellState.HIT) {
    const shipPath = getShipPathAtCell(point, enemy.stateTable);
    if (shipPath && isShipDestroyed(enemy.stateTable, shipPath) === true) {
      pointUpdates = [];
      for (let i = 0; i < shipPath.length; i++) {
        enemy.stateTable[shipPath[i].x][shipPath[i].y] = CellState.DESTROYED;
        pointUpdates.push({ point: shipPath[i], state: CellState.DESTROYED });
      }

      hasEnemyLost = hasPlayerLost(enemy);
    }
  }

  sendShootResultSignal(pointUpdates, player);
  sendShootSignal(pointUpdates, enemy);

  if (hasEnemyLost) {
    gameData.room.gameState = GameState.FINISHED;
    enemy.status = PlayerStatus.HAS_LOST;
    player.status = PlayerStatus.HAS_WON;
    sendGameOverSignal(enemy, false);
    sendGameOverSignal(player, true);
    return false;
  } else if (hitState === CellState.MISSED) {
    // next player's turn
    sendTurnChangedSignal(enemy, true);
    sendTurnChangedSignal(player, false);

    // handle computer
    if (enemy.isComputer) {
      let computerIsHit;
      do {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const computerMove = randomComputerMove(player, gameData.room);
        computerIsHit = await shootCell(computerMove, enemy, gameData);
      } while (computerIsHit === true);
    }
  }

  return hitState === CellState.HIT;
};

const isCellNotHitYet = (cell: number) => {
  return cell === CellState.UNTOUCHED || cell === CellState.SHIP_PLACED;
};

const randomComputerMove = (player: Player, room: Room): Point => {
  let point: Point | null = null;
  do {
    point = randomPoint(room.width, room.height);
  } while (isCellNotHitYet(player.stateTable[point.x][point.y]) === false);

  return point;
};

export const randomPoint = (width: number, height: number): Point => {
  const point: Point = {
    x: Math.floor(Math.random() * width),
    y: Math.floor(Math.random() * height),
  };

  return point;
};

const sendShootSignal = (pointUpdates: PointUpdate[], player: Player) => {
  if (player.isComputer === false) {
    player.socket?.emit(GameEvent.CELL_SHOT, { pointUpdates });
  }
};

const sendShootResultSignal = (pointUpdates: PointUpdate[], player: Player) => {
  if (player.isComputer === false) {
    player.socket?.emit(GameEvent.SHOOT_CELL_RESULT, { pointUpdates });
  }
};

const isCellShip = (cellState: number) => {
  return (
    cellState === CellState.HIT ||
    cellState === CellState.DESTROYED ||
    cellState === CellState.SHIP_PLACED
  );
};

const isShipDestroyed = (stateTable: number[][], shipPath: Point[] | null) => {
  if (shipPath == null) {
    return false;
  }

  return shipPath.every((s) => stateTable[s.x][s.y] === CellState.HIT);
};

const getShipPathAtCell = (point: Point, stateTable: number[][]) => {
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
  for (
    let xi = point.x - 1;
    xi >= 0 && isCellShip(stateTable[xi][point.y]);
    xi--
  ) {
    shipCells.push({ x: xi, y: point.y });
  }

  // go right as much as possible until end of table or no more ship
  for (
    let xi = point.x + 1;
    xi < width && isCellShip(stateTable[xi][point.y]);
    xi++
  ) {
    shipCells.push({ x: xi, y: point.y });
  }

  // go up as much as possible until end of table or no more ship
  for (
    let yi = point.y - 1;
    yi >= 0 && isCellShip(stateTable[point.x][yi]);
    yi--
  ) {
    shipCells.push({ x: point.x, y: yi });
  }

  // go down as much as possible until end of table or no more ship
  for (
    let yi = point.y + 1;
    yi < height && isCellShip(stateTable[point.x][yi]);
    yi++
  ) {
    shipCells.push({ x: point.x, y: yi });
  }

  return shipCells;
};
