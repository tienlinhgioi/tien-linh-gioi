// Trạng thái người chơi trong RAM, mỗi map là một room
export interface Player {
  characterId: number
  name: string
  mapId: number
  x: number
  y: number
}

export const players = new Map<string, Player>() // key: socket.id

export const mapRoom = (mapId: number) => `map:${mapId}`

export function playersInMap(mapId: number) {
  return [...players.values()].filter((p) => p.mapId === mapId)
}
