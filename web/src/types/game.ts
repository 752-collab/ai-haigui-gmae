/** 与后端对齐的展示用类型占位（权威状态以后端为准）。 */

export type GameStatus = 'playing' | 'revealed' | 'finished' | 'aborted'

/** 本局前端会话状态（无后端时本地 authoritative） */
export type GameSessionStatus = 'playing' | 'abandoned' | 'revealed'

export type GameListItem = {
  gameId: string
  status: GameStatus
  questionUsed: number
}
