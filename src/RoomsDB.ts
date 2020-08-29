import { Room, Player, PlayerStatus } from "./Room";

export class RoomsDB {
  rooms: Room[];

  constructor() {
    this.rooms = [];
  }

  public addRoom(room: Room): void {
    this.rooms.push(room);
  }

  public getRoomById(id: string): Room | undefined {
    return this.rooms.find((r) => r.id === id);
  }

  public getPlayerByRoomIdAndId(
    roomId: string,
    playerId: string
  ): Player | null {
    const room = this.getRoomById(roomId);
    if (!room) {
      return null;
    }

    if (room.player1.id === playerId) {
      return room.player1;
    } else if (room.player2?.id === playerId) {
      return room.player2;
    }

    return null;
  }

  // checks if player with given id is in this room
  public verifyPlayerInRoom(roomId: string, playerId: string): boolean {
    return this.getPlayerByRoomIdAndId(roomId, playerId) != null;
  }

  public setSocketForPlayer(
    roomId: string,
    playerId: string,
    socket: SocketIO.Socket
  ): boolean {
    const player: Player | null = this.getPlayerByRoomIdAndId(roomId, playerId);
    if (!player) {
      return false;
    }

    player.socket = socket;
    return true;
  }

  public bothPlayersReady(roomId: string): boolean {
    const room = this.getRoomById(roomId);
    if (!room) {
      return false;
    }

    return (
      room.player1.status === PlayerStatus.READY &&
      room.player2?.status === PlayerStatus.READY
    );
  }

  public bothPlayersLeft(roomId: string): boolean {
    const room = this.getRoomById(roomId);
    if (!room) {
      return false;
    }

    return (
      room.player1.status === PlayerStatus.LEFT &&
      (room.player2 == null ||
        room.player2.isComputer === true ||
        room.player2.status === PlayerStatus.LEFT)
    );
  }

  public removeRoom(roomId: string) {
    const roomIndex = this.rooms.findIndex((r) => r.id === roomId);
    if (roomIndex < 0) {
      return;
    }

    this.rooms.splice(roomIndex, 1);
  }
}
