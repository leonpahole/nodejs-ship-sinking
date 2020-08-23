import { CellState } from "./CellState";
import { GameState } from "./GameState";
import { randomPoint } from "./GameUtils";
import crypto from "crypto";

export class Room {
  id: string;
  player1: Player;
  player2: Player;
  width: number;
  height: number;
  gameState: number;

  constructor(id: string, width: number, height: number) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.gameState = GameState.PICKING_SHIPS;
  }
}

export enum PlayerStatus {
  PICKING,
  READY,
  WAITING_ON_TURN,
  ON_TURN,
  HAS_WON,
  HAS_LOST,
}

export class Player {
  id: string;
  isComputer: boolean;
  stateTable: number[][];
  status: PlayerStatus;
  socket?: SocketIO.Socket;

  constructor(id: string, isComputer: boolean = false) {
    this.id = id;
    this.isComputer = isComputer;
  }
}

export const ships = [
  { length: 4, capacity: 1, currentCapacity: 0 },
  { length: 3, capacity: 2, currentCapacity: 0 },
  { length: 2, capacity: 3, currentCapacity: 0 },
  { length: 1, capacity: 4, currentCapacity: 0 },
];

// create room object for the game
export const createRoom = (): Room => {
  const room: Room = new Room(createId(7), 10, 10);
  return room;
};

// create player object for the game
export const createPlayer = (): Player => {
  const player: Player = new Player(createId(10));
  player.status = PlayerStatus.PICKING;
  return player;
};

// create id from numbers and upper case letters with given length
const createId = (length: number) => {
  return crypto
    .randomBytes(length / 2)
    .toString("hex")
    .toUpperCase();
};

export const createComputer = (width: number, height: number): Player => {
  const player: Player = new Player("", true);
  player.stateTable = generateRandomShips(width, height);
  player.status = PlayerStatus.READY;
  return player;
};

const initialState = (width: number, height: number) => {
  const field = new Array(width);

  for (let w = 0; w < width; w++) {
    field[w] = new Array(height);

    for (let h = 0; h < height; h++) {
      field[w][h] = CellState.UNTOUCHED;
    }
  }

  return field;
};

const generateRandomShips = (width: number, height: number): number[][] => {
  const stateTable = initialState(width, height);

  for (let ship = 0; ship < ships.length; ship++) {
    const currentShip = ships[ship];

    for (let shipAmount = 0; shipAmount < currentShip.capacity; shipAmount++) {
      let shipPlaced = false;

      while (shipPlaced === false) {
        const rPoint = randomPoint(width, height);
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
        } else if (randomDirection == 1) {
          finalX = randomX + currentShip.length - 1;
          finalY = randomY;
          direction = 1;
        } else if (randomDirection == 2) {
          finalX = randomX;
          finalY = randomY - currentShip.length + 1;
          direction = -1;
        } else if (randomDirection == 3) {
          finalX = randomX - currentShip.length + 1;
          finalY = randomY;
          direction = -1;
        }

        let stateInvalid = false;

        if (finalX >= 0 && finalY >= 0 && finalX < width && finalY < height) {
          for (
            let x = randomX;
            direction == -1 ? x >= finalX : x <= finalX;
            x += direction
          ) {
            if (stateInvalid === true) break;

            for (
              let y = randomY;
              direction == -1 ? y >= finalY : y <= finalY;
              y += direction
            ) {
              if (stateTable[x][y] == CellState.SHIP_PLACED) {
                stateInvalid = true;
                break;
              }

              /* check for fields around the ship */
              for (let aroundX = -1; aroundX <= 1; aroundX++) {
                for (let aroundY = -1; aroundY <= 1; aroundY++) {
                  if (
                    x + aroundX >= 0 &&
                    y + aroundY >= 0 &&
                    x + aroundX < width &&
                    y + aroundY < height
                  ) {
                    if (
                      stateTable[x + aroundX][y + aroundY] ==
                      CellState.SHIP_PLACED
                    ) {
                      stateInvalid = true;
                      break;
                    }
                  }
                }
              }
            }
          }

          if (stateInvalid === false) {
            for (
              let x = randomX;
              direction == -1 ? x >= finalX : x <= finalX;
              x += direction
            ) {
              for (
                let y = randomY;
                direction == -1 ? y >= finalY : y <= finalY;
                y += direction
              ) {
                stateTable[x][y] = CellState.SHIP_PLACED;
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
