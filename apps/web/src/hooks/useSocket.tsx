import { createContext, useContext, useCallback, type ReactNode } from "react";

// Socket.IO has been removed — the v2 Rust backend uses native WebSocket
// at /ws/v2. This provider is a no-op stub that keeps the interface stable
// until the DM page is migrated to the v2 WebSocket.

interface SocketContextType {
  socket: null;
  isConnected: boolean;
  joinDm: (conversationId: string) => void;
  leaveDm: (conversationId: string) => void;
  emitTypingDm: (conversationId: string) => void;
  typingInDm: Record<string, string[]>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const joinDm = useCallback((_conversationId: string) => {}, []);
  const leaveDm = useCallback((_conversationId: string) => {}, []);
  const emitTypingDm = useCallback((_conversationId: string) => {}, []);

  return (
    <SocketContext.Provider
      value={{
        socket: null,
        isConnected: false,
        joinDm,
        leaveDm,
        emitTypingDm,
        typingInDm: {},
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
