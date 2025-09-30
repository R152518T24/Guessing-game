const gameService = require('./gameService');
const config = require('./config');

function initializeSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);
    
    socket.on('create_session', ({ sessionId, playerName }, callback) => {
      try {
        const session = gameService.createSession(sessionId, playerName);
        socket.join(sessionId);
        socket.data = { sessionId, playerName };
        
        io.to(sessionId).emit('session_updated', session);
        callback({ success: true, session });
        console.log(`🎮 Session created: ${sessionId} by ${playerName}`);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('join_session', ({ sessionId, playerName }, callback) => {
      try {
        const result = gameService.joinSession(sessionId, playerName);
        
        if (result.error) {
          callback({ error: result.error });
          return;
        }
        
        socket.join(sessionId);
        socket.data = { sessionId, playerName };
        
        io.to(sessionId).emit('session_updated', result.session);
        io.to(sessionId).emit('player_joined', { playerName });
        callback({ success: true, session: result.session });
        console.log(`👤 ${playerName} joined session: ${sessionId}`);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('set_question', ({ sessionId, question, answer }, callback) => {
      try {
        const result = gameService.setQuestion(sessionId, question, answer);
        
        if (result.error) {
          callback({ error: result.error });
          return;
        }
        
        io.to(sessionId).emit('session_updated', result.session);
        io.to(sessionId).emit('message', { 
          text: 'Question has been set by the game master',
          type: 'system'
        });
        callback({ success: true });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('start_game', ({ sessionId, playerName }, callback) => {
      try {
        const result = gameService.startGame(sessionId, playerName);
        
        if (result.error) {
          callback({ error: result.error });
          return;
        }
        
        const session = result.session;
        
        // Start server-side timer
        session.timerInterval = setInterval(() => {
          const tickResult = gameService.tick(sessionId);
          
          if (!tickResult) {
            clearInterval(session.timerInterval);
            return;
          }
          
          if (tickResult.timeUp) {
            io.to(sessionId).emit('game_ended', {
              session: tickResult.session,
              reason: 'timeout'
            });
            io.to(sessionId).emit('message', {
              text: `Time's up! The answer was: ${tickResult.session.answer}`,
              type: 'system'
            });
            
            setTimeout(() => {
              const resetSession = gameService.resetGameForNextRound(sessionId);
              if (resetSession) {
                io.to(sessionId).emit('session_updated', resetSession);
              }
            }, config.SESSION_CLEANUP_DELAY);
          } else {
            io.to(sessionId).emit('timer_tick', { 
              timeRemaining: tickResult.session.timeRemaining 
            });
          }
        }, 1000);
        
        io.to(sessionId).emit('game_started', session);
        io.to(sessionId).emit('message', {
          text: `Game started! Question: ${session.question}`,
          type: 'system'
        });
        callback({ success: true });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('submit_guess', ({ sessionId, playerName, guess }, callback) => {
      try {
        const result = gameService.submitGuess(sessionId, playerName, guess);
        
        if (result.error) {
          callback({ error: result.error });
          return;
        }
        
        if (result.correct) {
          const session = gameService.endGame(sessionId, playerName);
          
          io.to(sessionId).emit('game_ended', {
            session,
            reason: 'winner',
            winner: playerName
          });
          io.to(sessionId).emit('message', {
            text: `${playerName} won! The answer was: ${session.answer}`,
            type: 'success'
          });
          
          setTimeout(() => {
            const resetSession = gameService.resetGameForNextRound(sessionId);
            if (resetSession) {
              io.to(sessionId).emit('session_updated', resetSession);
            }
          }, config.SESSION_CLEANUP_DELAY);
          
          callback({ success: true, correct: true });
        } else {
          io.to(sessionId).emit('session_updated', result.session);
          io.to(sessionId).emit('message', {
            text: `${playerName} guessed: ${guess} - Wrong! ${result.attemptsLeft} attempts left`,
            type: 'guess'
          });
          callback({ success: true, correct: false, attemptsLeft: result.attemptsLeft });
        }
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('leave_session', ({ sessionId, playerName }, callback) => {
      try {
        const result = gameService.leaveSession(sessionId, playerName);
        
        if (result && !result.deleted) {
          io.to(sessionId).emit('session_updated', result.session);
          io.to(sessionId).emit('message', {
            text: `${playerName} left the game`,
            type: 'system'
          });
        }
        
        socket.leave(sessionId);
        callback({ success: true });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('disconnect', () => {
      const { sessionId, playerName } = socket.data || {};
      
      if (sessionId && playerName) {
        const result = gameService.leaveSession(sessionId, playerName);
        
        if (result && !result.deleted) {
          io.to(sessionId).emit('session_updated', result.session);
          io.to(sessionId).emit('message', {
            text: `${playerName} disconnected`,
            type: 'system'
          });
        }
      }
      
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initializeSocketHandlers };
