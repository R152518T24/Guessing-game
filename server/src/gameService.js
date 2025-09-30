const config = require('./config');

class GameService {
  constructor() {
    this.sessions = new Map();
  }

  createSession(sessionId, hostName) {
    const session = {
      id: sessionId,
      host: hostName,
      players: [{ name: hostName, score: 0, isHost: true }],
      status: 'waiting',
      question: '',
      answer: '',
      currentMaster: hostName,
      timeRemaining: config.GAME_DURATION,
      attempts: new Map(),
      winner: null,
      timerInterval: null,
      createdAt: new Date()
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  joinSession(sessionId, playerName) {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'Session not found' };
    if (session.status === 'playing') return { error: 'Game in progress' };
    
    const exists = session.players.some(p => p.name === playerName);
    if (exists) return { error: 'Name already taken' };
    
    session.players.push({ name: playerName, score: 0, isHost: false });
    return { success: true, session };
  }

  leaveSession(sessionId, playerName) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.players = session.players.filter(p => p.name !== playerName);
    
    if (session.players.length === 0) {
      this.clearTimer(sessionId);
      this.sessions.delete(sessionId);
      return { deleted: true };
    }
    
    if (session.currentMaster === playerName) {
      session.currentMaster = session.players[0].name;
    }
    
    return { session };
  }

  setQuestion(sessionId, question, answer) {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'Session not found' };
    if (!question.trim() || !answer.trim()) return { error: 'Invalid question/answer' };
    
    session.question = question.trim();
    session.answer = answer.trim().toLowerCase();
    return { success: true, session };
  }

  startGame(sessionId, playerName) {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'Session not found' };
    if (session.currentMaster !== playerName) return { error: 'Only master can start' };
    if (session.players.length < config.MIN_PLAYERS) return { error: `Need at least ${config.MIN_PLAYERS} players` };
    if (!session.question || !session.answer) return { error: 'Set question first' };
    
    session.status = 'playing';
    session.timeRemaining = config.GAME_DURATION;
    session.winner = null;
    session.attempts = new Map();
    session.players.forEach(p => session.attempts.set(p.name, 0));
    
    return { success: true, session };
  }

  submitGuess(sessionId, playerName, guess) {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'Session not found' };
    if (session.status !== 'playing') return { error: 'Game not active' };
    if (session.currentMaster === playerName) return { error: 'Master cannot guess' };
    
    const attempts = session.attempts.get(playerName) || 0;
    if (attempts >= config.MAX_ATTEMPTS) return { error: 'No attempts left' };
    
    session.attempts.set(playerName, attempts + 1);
    
    const isCorrect = guess.trim().toLowerCase() === session.answer;
    
    return {
      correct: isCorrect,
      attemptsLeft: config.MAX_ATTEMPTS - (attempts + 1),
      session
    };
  }

  endGame(sessionId, winnerName = null) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    this.clearTimer(sessionId);
    
    session.status = 'ended';
    session.winner = winnerName;
    
    if (winnerName) {
      const winner = session.players.find(p => p.name === winnerName);
      if (winner) winner.score += config.WINNING_POINTS;
    }
    
    // Rotate master
    const currentIdx = session.players.findIndex(p => p.name === session.currentMaster);
    const nextIdx = (currentIdx + 1) % session.players.length;
    session.currentMaster = session.players[nextIdx].name;
    
    return session;
  }

  resetGameForNextRound(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.status = 'waiting';
    session.question = '';
    session.answer = '';
    session.attempts = new Map();
    session.winner = null;
    session.timeRemaining = config.GAME_DURATION;
    
    return session;
  }

  tick(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'playing') return null;
    
    session.timeRemaining--;
    
    if (session.timeRemaining <= 0) {
      return { timeUp: true, session: this.endGame(sessionId) };
    }
    
    return { session };
  }

  clearTimer(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && session.timerInterval) {
      clearInterval(session.timerInterval);
      session.timerInterval = null;
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }
}

module.exports = new GameService();