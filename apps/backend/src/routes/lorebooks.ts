import { FastifyInstance } from 'fastify';
import { mockLorebooks } from '../data/mockData';
import { Lorebook } from '@storyforge/shared';

interface GetLorebookParams {
  id: string;
}

export async function lorebooksRoutes(fastify: FastifyInstance) {
  // Get all lorebooks
  fastify.get('/api/lorebooks', async () => {
    return {
      lorebooks: mockLorebooks
    };
  });

  // Get single lorebook
  fastify.get<{ Params: GetLorebookParams }>('/api/lorebooks/:id', async (request, reply) => {
    const { id } = request.params;
    const lorebook = mockLorebooks.find(l => l.id === id);
    
    if (!lorebook) {
      return reply.code(404).send({ error: 'Lorebook not found' });
    }
    
    return lorebook;
  });

  // Create lorebook
  fastify.post<{ Body: Omit<Lorebook, 'id'> }>('/api/lorebooks', async (request, reply) => {
    const newLorebook: Lorebook = {
      id: `lore-${Date.now()}`,
      ...request.body
    };
    
    mockLorebooks.push(newLorebook);
    return reply.code(201).send(newLorebook);
  });

  // Update lorebook
  fastify.put<{ Params: GetLorebookParams; Body: Partial<Lorebook> }>('/api/lorebooks/:id', async (request, reply) => {
    const { id } = request.params;
    const lorebookIndex = mockLorebooks.findIndex(l => l.id === id);
    
    if (lorebookIndex === -1) {
      return reply.code(404).send({ error: 'Lorebook not found' });
    }
    
    const updatedLorebook = {
      ...mockLorebooks[lorebookIndex],
      ...request.body,
      id // Ensure ID cannot be changed
    } as Lorebook;
    
    mockLorebooks[lorebookIndex] = updatedLorebook;
    return updatedLorebook;
  });

  // Delete lorebook
  fastify.delete<{ Params: GetLorebookParams }>('/api/lorebooks/:id', async (request, reply) => {
    const { id } = request.params;
    const lorebookIndex = mockLorebooks.findIndex(l => l.id === id);
    
    if (lorebookIndex === -1) {
      return reply.code(404).send({ error: 'Lorebook not found' });
    }
    
    mockLorebooks.splice(lorebookIndex, 1);
    return reply.code(204).send();
  });
}