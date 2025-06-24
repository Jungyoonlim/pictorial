// Core command pattern for scalable undo/redo system
export interface Command {
  id: string
  type: string
  execute(): void | Promise<void>
  undo(): void | Promise<void>
  canMerge?(other: Command): boolean
  merge?(other: Command): Command
  serialize(): any
}

export interface CommandContext {
  timestamp: number
  userId?: string
  sessionId: string
}

export class CommandManager {
  private history: Array<{ command: Command; context: CommandContext }> = []
  private currentIndex: number = -1
  private maxHistorySize: number = 1000
  private isExecuting: boolean = false
  
  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize
  }
  
  async execute(command: Command, context?: Partial<CommandContext>): Promise<void> {
    if (this.isExecuting) return
    
    this.isExecuting = true
    
    try {
      // Execute the command
      await command.execute()
      
      // Add to history
      const commandContext: CommandContext = {
        timestamp: Date.now(),
        sessionId: crypto.randomUUID(),
        ...context
      }
      
      // Remove any commands after current index (for redo functionality)
      this.history = this.history.slice(0, this.currentIndex + 1)
      
      // Try to merge with previous command if possible
      const lastEntry = this.history[this.history.length - 1]
      if (lastEntry && command.canMerge?.(lastEntry.command)) {
        const mergedCommand = command.merge!(lastEntry.command)
        this.history[this.history.length - 1] = { 
          command: mergedCommand, 
          context: commandContext 
        }
      } else {
        this.history.push({ command, context: commandContext })
        this.currentIndex++
      }
      
      // Limit history size
      if (this.history.length > this.maxHistorySize) {
        this.history = this.history.slice(-this.maxHistorySize)
        this.currentIndex = this.history.length - 1
      }
      
    } finally {
      this.isExecuting = false
    }
  }
  
  async undo(): Promise<boolean> {
    if (this.currentIndex < 0 || this.isExecuting) return false
    
    this.isExecuting = true
    
    try {
      const entry = this.history[this.currentIndex]
      await entry.command.undo()
      this.currentIndex--
      return true
    } finally {
      this.isExecuting = false
    }
  }
  
  async redo(): Promise<boolean> {
    if (this.currentIndex >= this.history.length - 1 || this.isExecuting) return false
    
    this.isExecuting = true
    
    try {
      this.currentIndex++
      const entry = this.history[this.currentIndex]
      await entry.command.execute()
      return true
    } finally {
      this.isExecuting = false
    }
  }
  
  canUndo(): boolean {
    return this.currentIndex >= 0 && !this.isExecuting
  }
  
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1 && !this.isExecuting
  }
  
  clear(): void {
    this.history = []
    this.currentIndex = -1
  }
  
  getHistory(): Array<{ command: Command; context: CommandContext }> {
    return [...this.history]
  }
}

// Color-specific commands
export class SetColorCommand implements Command {
  id: string = crypto.randomUUID()
  type: string = 'SET_COLOR'
  
  constructor(
    private colorStore: any,
    private newColor: string,
    private previousColor?: string
  ) {
    this.previousColor = previousColor || colorStore.currentColor.hex
  }
  
  execute(): void {
    this.colorStore.setCurrentColor(this.newColor)
  }
  
  undo(): void {
    if (this.previousColor) {
      this.colorStore.setCurrentColor(this.previousColor)
    }
  }
  
  canMerge(other: Command): boolean {
    return other.type === 'SET_COLOR' && 
           (Date.now() - (other as any).timestamp) < 500 // 500ms merge window
  }
  
  merge(other: Command): Command {
    return new SetColorCommand(this.colorStore, this.newColor, (other as any).previousColor)
  }
  
  serialize() {
    return {
      type: this.type,
      newColor: this.newColor,
      previousColor: this.previousColor
    }
  }
} 