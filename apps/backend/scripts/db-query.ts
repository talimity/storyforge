#!/usr/bin/env node
import { db, closeDatabase } from '../src/db/client.js';
import { sql } from 'drizzle-orm';
import * as schema from '../src/db/schema/index.js';

async function executeQuery() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: pnpm tsx scripts/db-query.ts <command> [args...]

Commands:
  raw "<sql>"           - Execute raw SQL query
  select <table>        - Select all from table
  count <table>         - Count rows in table
  schema                - Show all table schemas
  characters            - Show all characters with their greetings
  help                  - Show this help

Examples:
  pnpm tsx scripts/db-query.ts raw "SELECT * FROM characters LIMIT 5"
  pnpm tsx scripts/db-query.ts select characters
  pnpm tsx scripts/db-query.ts count character_greetings
  pnpm tsx scripts/db-query.ts characters
`);
    process.exit(0);
  }

  const command = args[0];
  
  try {
    switch (command) {
      case 'raw':
        if (!args[1]) {
          console.error('❌ SQL query required');
          process.exit(1);
        }
        await executeRawQuery(args[1]);
        break;
        
      case 'select':
        if (!args[1]) {
          console.error('❌ Table name required');
          process.exit(1);
        }
        await selectAll(args[1]);
        break;
        
      case 'count':
        if (!args[1]) {
          console.error('❌ Table name required');
          process.exit(1);
        }
        await countRows(args[1]);
        break;
        
      case 'schema':
        await showSchema();
        break;
        
      case 'characters':
        await showCharactersWithRelations();
        break;
        
      case 'help':
        console.log('Use without arguments to see help');
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Use "help" command to see available options');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Query failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

async function executeRawQuery(query: string) {
  console.log(`🔍 Executing: ${query}`);
  const result = db.all(sql.raw(query));
  console.log(`📊 Results (${result.length} rows):`);
  console.table(result);
}

async function selectAll(tableName: string) {
  console.log(`🔍 Selecting all from ${tableName}`);
  const result = db.all(sql.raw(`SELECT * FROM ${tableName}`));
  console.log(`📊 Results (${result.length} rows):`);
  console.table(result);
}

async function countRows(tableName: string) {
  console.log(`🔍 Counting rows in ${tableName}`);
  const result = db.get(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`)) as { count: number };
  console.log(`📊 Count: ${result.count} rows`);
}

async function showSchema() {
  console.log('🏗️  Database Schema:');
  const tables = db.all(sql.raw(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `)) as { name: string }[];
  
  for (const table of tables) {
    console.log(`\\n📋 Table: ${table.name}`);
    const columns = db.all(sql.raw(`PRAGMA table_info(${table.name})`));
    console.table(columns);
  }
}

async function showCharactersWithRelations() {
  console.log('👥 Characters with their greetings and examples:');
  
  const characters = await db.select().from(schema.characters);
  
  for (const character of characters) {
    console.log(`\\n🎭 Character: ${character.name} (${character.id})`);
    console.log(`   Description: ${character.description}`);
    console.log(`   Creator: ${character.creator || 'Unknown'}`);
    console.log(`   Tags: ${character.tags?.join(', ') || 'None'}`);
    
    // Get greetings
    const greetings = await db.select()
      .from(schema.characterGreetings)
      .where(sql`character_id = ${character.id}`);
    
    if (greetings.length > 0) {
      console.log(`   💬 Greetings (${greetings.length}):`);
      greetings.forEach((g, i) => {
        const marker = g.isPrimary ? '⭐' : '  ';
        console.log(`   ${marker} ${i + 1}. ${g.message.substring(0, 100)}${g.message.length > 100 ? '...' : ''}`);
      });
    }
    
    // Get examples
    const examples = await db.select()
      .from(schema.characterExamples)
      .where(sql`character_id = ${character.id}`);
    
    if (examples.length > 0) {
      console.log(`   📝 Examples (${examples.length}):`);
      examples.forEach((e, i) => {
        console.log(`      ${i + 1}. ${e.exampleTemplate.substring(0, 100)}${e.exampleTemplate.length > 100 ? '...' : ''}`);
      });
    }
  }
}

executeQuery();