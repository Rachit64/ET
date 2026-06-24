import { useState, useEffect, useRef } from "react";

export function useAISStream(wsUrl = "ws://localhost:8000/ws") {
  const [ships, setShips] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    let reconnectTimeout;
    
    function connect() {
      console.log(`Connecting to backend AIS stream: ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("Connected to AIS backend stream.");
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && (data.type === "CONNECTION_ESTABLISHED" || data.type === "AIS_UPDATE")) {
            // Pre-existing backend broadcasts a list of vessels in the "vessels" field
            setShips(data.vessels || []);
          }
        } catch (err) {
          console.error("Failed to parse AIS message:", err);
        }
      };

      socket.onclose = () => {
        console.log("AIS backend stream disconnected.");
        setIsConnected(false);
        // Try to reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("AIS socket error:", err);
        socket.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [wsUrl]);

  return { ships, isConnected };
}
