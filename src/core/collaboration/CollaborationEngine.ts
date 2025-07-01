import { io, Socket } from 'socket.io-client'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import SimplePeer from 'simple-peer'
import { v4 as uuid } from 'uuid'
import { VectorElement, Point, CollaborationCursor, HistoryItem } from '../vector/VectorTypes'

export interface User {
  id: string
  name: string
  color: string
  avatar?: string
  isOnline: boolean
  lastSeen: number
  cursor?: CollaborationCursor
}

export interface Room {
  id: string
  name: string
  users: Map<string, User>
  ownerId: string
  createdAt: number
  updatedAt: number
}

export interface Operation {
  id: string
  type: 'create' | 'update' | 'delete' | 'transform'
  elementId: string
  data: any
  userId: string
  timestamp: number
  version: number
}

export interface Conflict {
  id: string
  operations: Operation[]
  type: 'concurrent-edit' | 'delete-edit' | 'transform-conflict'
  timestamp: number
  resolved: boolean
}

export interface LiveCursor {
  userId: string
  userName: string
  color: string
  position: Point
  tool: string
  isVisible: boolean
  lastUpdate: number
}

export interface CollaborationState {
  isConnected: boolean
  room: Room | null
  currentUser: User | null
  liveCursors: Map<string, LiveCursor>
  pendingOperations: Operation[]
  conflicts: Conflict[]
  connectionType: 'websocket' | 'webrtc' | 'hybrid'
}

export class CollaborationEngine {
  private state: CollaborationState
  private socket: Socket | null = null
  private doc: Y.Doc
  private provider: WebsocketProvider | null = null
  private peers: Map<string, SimplePeer.Instance> = new Map()
  private operationQueue: Operation[] = []
  private isProcessingQueue = false
  private conflictResolver: ConflictResolver
  private eventHandlers: Map<string, Function[]> = new Map()

  constructor() {
    this.state = {
      isConnected: false,
      room: null,
      currentUser: null,
      liveCursors: new Map(),
      pendingOperations: [],
      conflicts: [],
      connectionType: 'websocket'
    }

    this.doc = new Y.Doc()
    this.conflictResolver = new ConflictResolver()
    this.setupYjsEvents()
  }

  // CONNECTION MANAGEMENT

  async connect(roomId: string, user: User, serverUrl: string = 'ws://localhost:8000'): Promise<void> {
    try {
      this.state.currentUser = user
      
      // Setup WebSocket connection
      this.socket = io(serverUrl, {
        transports: ['websocket'],
        query: { roomId, userId: user.id, userName: user.name }
      })

      // Setup Y.js websocket provider
      this.provider = new WebsocketProvider(serverUrl.replace('ws://', 'ws://'), roomId, this.doc)
      
      this.setupSocketEvents()
      this.state.isConnected = true
      
      this.emit('connected', { roomId, user })
    } catch (error) {
      console.error('Failed to connect:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    if (this.provider) {
      this.provider.disconnect()
      this.provider = null
    }

    // Close all peer connections
    for (const peer of this.peers.values()) {
      peer.destroy()
    }
    this.peers.clear()

    this.state.isConnected = false
    this.state.room = null
    this.state.liveCursors.clear()
    
    this.emit('disconnected')
  }

  // OPERATIONAL TRANSFORMS

  applyOperation(operation: Operation): void {
    this.operationQueue.push(operation)
    this.processOperationQueue()
    
    // Broadcast to other users
    this.broadcastOperation(operation)
  }

  private async processOperationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) return
    
    this.isProcessingQueue = true
    
    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift()!
      
      try {
        await this.processOperation(operation)
      } catch (error) {
        console.error('Failed to process operation:', error)
        this.handleOperationError(operation, error)
      }
    }
    
    this.isProcessingQueue = false
  }

  private async processOperation(operation: Operation): Promise<void> {
    // Check for conflicts with pending operations
    const conflicts = this.detectConflicts(operation)
    
    if (conflicts.length > 0) {
      const conflict: Conflict = {
        id: uuid(),
        operations: [operation, ...conflicts],
        type: this.determineConflictType(operation, conflicts),
        timestamp: Date.now(),
        resolved: false
      }
      
      this.state.conflicts.push(conflict)
      await this.resolveConflict(conflict)
    } else {
      // Apply operation directly
      this.applyOperationToDocument(operation)
    }
  }

  private detectConflicts(operation: Operation): Operation[] {
    return this.state.pendingOperations.filter(pending => {
      // Same element, different users, overlapping timestamps
      return pending.elementId === operation.elementId &&
             pending.userId !== operation.userId &&
             Math.abs(pending.timestamp - operation.timestamp) < 1000 // 1 second window
    })
  }

  private determineConflictType(operation: Operation, conflicts: Operation[]): Conflict['type'] {
    if (operation.type === 'delete' && conflicts.some(c => c.type === 'update')) {
      return 'delete-edit'
    } else if (operation.type === 'transform' && conflicts.some(c => c.type === 'transform')) {
      return 'transform-conflict'
    } else {
      return 'concurrent-edit'
    }
  }

  private async resolveConflict(conflict: Conflict): Promise<void> {
    const resolvedOperations = await this.conflictResolver.resolve(conflict)
    
    for (const operation of resolvedOperations) {
      this.applyOperationToDocument(operation)
    }
    
    conflict.resolved = true
    this.emit('conflict-resolved', conflict)
  }

  private applyOperationToDocument(operation: Operation): void {
    const yElements = this.doc.getMap('elements')
    
    switch (operation.type) {
      case 'create':
        yElements.set(operation.elementId, operation.data)
        break
      case 'update':
        const existing = yElements.get(operation.elementId)
        if (existing) {
          yElements.set(operation.elementId, { ...existing, ...operation.data })
        }
        break
      case 'delete':
        yElements.delete(operation.elementId)
        break
      case 'transform':
        const element = yElements.get(operation.elementId)
        if (element) {
          element.transform = operation.data.transform
          element.boundingBox = operation.data.boundingBox
          yElements.set(operation.elementId, element)
        }
        break
    }
    
    this.emit('operation-applied', operation)
  }

  // LIVE CURSORS

  updateCursor(position: Point, tool: string): void {
    if (!this.state.currentUser || !this.state.isConnected) return
    
    const cursor: LiveCursor = {
      userId: this.state.currentUser.id,
      userName: this.state.currentUser.name,
      color: this.state.currentUser.color,
      position,
      tool,
      isVisible: true,
      lastUpdate: Date.now()
    }
    
    this.broadcastCursor(cursor)
  }

  hideCursor(): void {
    if (!this.state.currentUser || !this.state.isConnected) return
    
    const cursor: LiveCursor = {
      userId: this.state.currentUser.id,
      userName: this.state.currentUser.name,
      color: this.state.currentUser.color,
      position: { x: 0, y: 0 },
      tool: '',
      isVisible: false,
      lastUpdate: Date.now()
    }
    
    this.broadcastCursor(cursor)
  }

  private broadcastCursor(cursor: LiveCursor): void {
    if (this.socket) {
      this.socket.emit('cursor-update', cursor)
    }
    
    // Also broadcast via WebRTC for better performance
    for (const peer of this.peers.values()) {
      if (peer.connected) {
        peer.send(JSON.stringify({
          type: 'cursor-update',
          data: cursor
        }))
      }
    }
  }

  // WEBRTC PEER-TO-PEER

  private async initializeWebRTC(roomUsers: User[]): Promise<void> {
    for (const user of roomUsers) {
      if (user.id !== this.state.currentUser?.id) {
        await this.createPeerConnection(user.id, true)
      }
    }
  }

  private async createPeerConnection(userId: string, initiator: boolean): Promise<void> {
    const peer = new SimplePeer({
      initiator,
      trickle: false
    })

    peer.on('signal', (data) => {
      if (this.socket) {
        this.socket.emit('webrtc-signal', {
          target: userId,
          signal: data
        })
      }
    })

    peer.on('connect', () => {
      console.log(`WebRTC connection established with user ${userId}`)
    })

    peer.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString())
        this.handlePeerMessage(userId, message)
      } catch (error) {
        console.error('Failed to parse peer message:', error)
      }
    })

    peer.on('error', (error) => {
      console.error(`WebRTC error with user ${userId}:`, error)
      this.peers.delete(userId)
    })

    this.peers.set(userId, peer)
  }

  private handlePeerMessage(userId: string, message: any): void {
    switch (message.type) {
      case 'cursor-update':
        this.handleCursorUpdate(message.data)
        break
      case 'operation':
        this.handleRemoteOperation(message.data)
        break
      default:
        console.warn('Unknown peer message type:', message.type)
    }
  }

  // EVENT HANDLING

  private setupSocketEvents(): void {
    if (!this.socket) return

    this.socket.on('room-joined', (room: Room) => {
      this.state.room = room
      this.emit('room-joined', room)
    })

    this.socket.on('user-joined', (user: User) => {
      if (this.state.room) {
        this.state.room.users.set(user.id, user)
        this.emit('user-joined', user)
      }
    })

    this.socket.on('user-left', (userId: string) => {
      if (this.state.room) {
        this.state.room.users.delete(userId)
        this.state.liveCursors.delete(userId)
        this.peers.delete(userId)
        this.emit('user-left', userId)
      }
    })

    this.socket.on('cursor-update', (cursor: LiveCursor) => {
      this.handleCursorUpdate(cursor)
    })

    this.socket.on('operation', (operation: Operation) => {
      this.handleRemoteOperation(operation)
    })

    this.socket.on('webrtc-signal', async ({ from, signal }) => {
      const peer = this.peers.get(from)
      if (peer) {
        peer.signal(signal)
      } else {
        await this.createPeerConnection(from, false)
        this.peers.get(from)?.signal(signal)
      }
    })

    this.socket.on('disconnect', () => {
      this.state.isConnected = false
      this.emit('disconnected')
    })
  }

  private setupYjsEvents(): void {
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        // Handle remote Y.js updates
        this.emit('document-updated', update)
      }
    })
  }

  private handleCursorUpdate(cursor: LiveCursor): void {
    if (cursor.userId !== this.state.currentUser?.id) {
      this.state.liveCursors.set(cursor.userId, cursor)
      this.emit('cursor-updated', cursor)
      
      // Clean up old cursors
      setTimeout(() => {
        const current = this.state.liveCursors.get(cursor.userId)
        if (current && Date.now() - current.lastUpdate > 5000) {
          this.state.liveCursors.delete(cursor.userId)
          this.emit('cursor-removed', cursor.userId)
        }
      }, 5000)
    }
  }

  private handleRemoteOperation(operation: Operation): void {
    if (operation.userId !== this.state.currentUser?.id) {
      this.applyOperation(operation)
    }
  }

  private broadcastOperation(operation: Operation): void {
    if (this.socket) {
      this.socket.emit('operation', operation)
    }
    
    // Also broadcast via WebRTC
    for (const peer of this.peers.values()) {
      if (peer.connected) {
        peer.send(JSON.stringify({
          type: 'operation',
          data: operation
        }))
      }
    }
  }

  private handleOperationError(operation: Operation, error: any): void {
    console.error('Operation failed:', operation, error)
    this.emit('operation-error', { operation, error })
  }

  // HELPER METHODS

  createOperation(type: Operation['type'], elementId: string, data: any): Operation {
    return {
      id: uuid(),
      type,
      elementId,
      data,
      userId: this.state.currentUser?.id || 'unknown',
      timestamp: Date.now(),
      version: this.doc.clientID
    }
  }

  getUsers(): User[] {
    return this.state.room ? Array.from(this.state.room.users.values()) : []
  }

  getLiveCursors(): LiveCursor[] {
    return Array.from(this.state.liveCursors.values())
  }

  getConflicts(): Conflict[] {
    return this.state.conflicts.filter(c => !c.resolved)
  }

  // EVENT SYSTEM

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index >= 0) {
        handlers.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }
  }

  // STATE GETTERS

  getState(): CollaborationState {
    return { ...this.state }
  }

  isConnected(): boolean {
    return this.state.isConnected
  }

  getCurrentUser(): User | null {
    return this.state.currentUser
  }

  getRoom(): Room | null {
    return this.state.room
  }
}

// CONFLICT RESOLUTION

class ConflictResolver {
  async resolve(conflict: Conflict): Promise<Operation[]> {
    switch (conflict.type) {
      case 'concurrent-edit':
        return this.resolveConcurrentEdit(conflict)
      case 'delete-edit':
        return this.resolveDeleteEdit(conflict)
      case 'transform-conflict':
        return this.resolveTransformConflict(conflict)
      default:
        return conflict.operations
    }
  }

  private async resolveConcurrentEdit(conflict: Conflict): Promise<Operation[]> {
    // Last writer wins for now
    // In a more sophisticated system, we could merge changes
    const sortedOps = conflict.operations.sort((a, b) => b.timestamp - a.timestamp)
    return [sortedOps[0]]
  }

  private async resolveDeleteEdit(conflict: Conflict): Promise<Operation[]> {
    // Delete operations take precedence
    const deleteOp = conflict.operations.find(op => op.type === 'delete')
    return deleteOp ? [deleteOp] : []
  }

  private async resolveTransformConflict(conflict: Conflict): Promise<Operation[]> {
    // Combine transforms using operational transform principles
    const transformOps = conflict.operations.filter(op => op.type === 'transform')
    
    if (transformOps.length < 2) return transformOps
    
    // Apply transforms in timestamp order
    const sortedOps = transformOps.sort((a, b) => a.timestamp - b.timestamp)
    const baseOp = sortedOps[0]
    
    // For now, just apply the most recent transform
    // In a more sophisticated system, we could compose transforms
    return [sortedOps[sortedOps.length - 1]]
  }
} 