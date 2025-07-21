import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({
  logger: true
});

// Register CORS for frontend access
await fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:8080'],
  credentials: true
});

// Basic health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API routes
fastify.get('/api/scenarios', async () => {
  return { scenarios: [] };
});

fastify.get('/api/characters', async () => {
  return { characters: [] };
});

fastify.get('/api/lorebooks', async () => {
  return { lorebooks: [] };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ 
      port: 3001, 
      host: '0.0.0.0' // Allow LAN access
    });
    console.log('🚀 Backend server running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();