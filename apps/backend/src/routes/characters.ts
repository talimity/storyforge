import { FastifyInstance } from 'fastify';
import { mockCharacters } from '../data/mockData';
import { Character } from '@storyforge/shared';

interface GetCharacterParams {
  id: string;
}

export async function charactersRoutes(fastify: FastifyInstance) {
  // Get all characters
  fastify.get('/api/characters', async () => {
    return {
      characters: mockCharacters
    };
  });

  // Get single character
  fastify.get<{ Params: GetCharacterParams }>('/api/characters/:id', async (request, reply) => {
    const { id } = request.params;
    const character = mockCharacters.find(c => c.id === id);
    
    if (!character) {
      return reply.code(404).send({ error: 'Character not found' });
    }
    
    return character;
  });

  // Create character
  fastify.post<{ Body: Omit<Character, 'id'> }>('/api/characters', async (request, reply) => {
    const newCharacter: Character = {
      id: `char-${Date.now()}`,
      ...request.body
    };
    
    mockCharacters.push(newCharacter);
    return reply.code(201).send(newCharacter);
  });

  // Update character
  fastify.put<{ Params: GetCharacterParams; Body: Partial<Character> }>('/api/characters/:id', async (request, reply) => {
    const { id } = request.params;
    const characterIndex = mockCharacters.findIndex(c => c.id === id);
    
    if (characterIndex === -1) {
      return reply.code(404).send({ error: 'Character not found' });
    }
    
    const updatedCharacter = {
      ...mockCharacters[characterIndex],
      ...request.body,
      id // Ensure ID cannot be changed
    } as Character;
    
    mockCharacters[characterIndex] = updatedCharacter;
    return updatedCharacter;
  });

  // Delete character
  fastify.delete<{ Params: GetCharacterParams }>('/api/characters/:id', async (request, reply) => {
    const { id } = request.params;
    const characterIndex = mockCharacters.findIndex(c => c.id === id);
    
    if (characterIndex === -1) {
      return reply.code(404).send({ error: 'Character not found' });
    }
    
    mockCharacters.splice(characterIndex, 1);
    return reply.code(204).send();
  });
}