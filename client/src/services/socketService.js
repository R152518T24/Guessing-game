import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data, callback) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit(event, data, callback);
  }

  on(event, callback) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  createSession(sessionId, playerName) {
    return new Promise((resolve, reject) => {
      this.emit('create_session', { sessionId, playerName }, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.session);
      });
    });
  }

  joinSession(sessionId, playerName) {
    return new Promise((resolve, reject) => {
      this.emit('join_session', { sessionId, playerName }, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.session);
      });
    });
  }

  setQuestion(sessionId, question, answer) {
    return new Promise((resolve, reject) => {
      this.emit('set_question', { sessionId, question, answer }, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  startGame(sessionId, playerName) {
    return new Promise((resolve, reject) => {
      this.emit('start_game', { sessionId, playerName }, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  submitGuess(sessionId, playerName, guess) {
    return new Promise((resolve, reject) => {
      this.emit('submit_guess', { sessionId, playerName, guess }, (response) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }

  leaveSession(sessionId, playerName) {
    return new Promise((resolve) => {
      this.emit('leave_session', { sessionId, playerName }, (response) => {
        resolve(response);
      });
    });
  }
}

export default new SocketService();
