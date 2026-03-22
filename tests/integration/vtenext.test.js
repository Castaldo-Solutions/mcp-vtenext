import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VTENextClient } from '../../client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const VTENEXT_URL = process.env.VTENEXT_URL || 'http://localhost:8080';
const VTENEXT_USERNAME = process.env.VTENEXT_USERNAME || 'admin';
const VTENEXT_ACCESS_KEY = process.env.VTENEXT_ACCESS_KEY;

if (!VTENEXT_ACCESS_KEY) {
  throw new Error('VTENEXT_ACCESS_KEY non configurata nel .env');
}

let client;
let createdId; // ID opportunità creata nel test, da pulire dopo

beforeAll(() => {
  client = new VTENextClient({
    url: VTENEXT_URL,
    username: VTENEXT_USERNAME,
    accessKey: VTENEXT_ACCESS_KEY,
  });
});

describe('Integration — autenticazione', () => {
  it('ottiene challenge e si logga con successo', async () => {
    const session = await client.login();
    expect(session).toBeTruthy();
    expect(session).toMatch(/^[a-z0-9]+$/i);
  });

  it('getSession riusa la sessione senza rifare login', async () => {
    const s1 = await client.getSession();
    const s2 = await client.getSession();
    expect(s1).toBe(s2);
  });
});

describe('Integration — query su Potentials', () => {
  it('esegue SELECT su Potentials senza errori', async () => {
    const results = await client.query('SELECT id, potentialname, sales_stage FROM Potentials LIMIT 5;');
    expect(Array.isArray(results)).toBe(true);
  });

  it('filtra per sales_stage', async () => {
    const results = await client.query(
      "SELECT id, potentialname, sales_stage FROM Potentials WHERE sales_stage = 'Prospecting' LIMIT 5;"
    );
    expect(Array.isArray(results)).toBe(true);
    results.forEach(r => expect(r.sales_stage).toBe('Prospecting'));
  });
});

describe('Integration — query su Contacts', () => {
  it('esegue SELECT su Contacts senza errori', async () => {
    const results = await client.query('SELECT id, firstname, lastname, email FROM Contacts LIMIT 5;');
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('Integration — describe modulo', () => {
  it('descrive Potentials e restituisce i campi', async () => {
    const result = await client.describe('Potentials');
    expect(result).toHaveProperty('fields');
    expect(Array.isArray(result.fields)).toBe(true);
    expect(result.fields.length).toBeGreaterThan(0);
    const fieldNames = result.fields.map(f => f.name);
    expect(fieldNames).toContain('potentialname');
    expect(fieldNames).toContain('sales_stage');
    expect(fieldNames).toContain('amount');
  });

  it('descrive Contacts e restituisce i campi', async () => {
    const result = await client.describe('Contacts');
    expect(result).toHaveProperty('fields');
    const fieldNames = result.fields.map(f => f.name);
    expect(fieldNames).toContain('firstname');
    expect(fieldNames).toContain('email');
  });
});

describe('Integration — CRUD su Potentials', () => {
  it('crea una nuova opportunità', async () => {
    const result = await client.create('Potentials', {
      potentialname: '[TEST] Opportunità Vitest',
      sales_stage: 'Prospecting',
      amount: 1000,
      closingdate: '2026-12-31',
      assigned_user_id: '19x1',
      related_to: '3x19',
    });
    expect(result).toHaveProperty('id');
    expect(result.potentialname).toBe('[TEST] Opportunità Vitest');
    createdId = result.id;
  });

  it('recupera l\'opportunità appena creata', async () => {
    if (!createdId) return;
    const result = await client.retrieve(createdId);
    expect(result.id).toBe(createdId);
    expect(result.potentialname).toBe('[TEST] Opportunità Vitest');
  });

  it('aggiorna lo stato dell\'opportunità', async () => {
    if (!createdId) return;
    const current = await client.retrieve(createdId);
    const updated = await client.update({ ...current, sales_stage: 'Qualification' });
    expect(updated.sales_stage).toBe('Qualification');
  });

  it('la opportunità aggiornata appare nella query', async () => {
    if (!createdId) return;
    const results = await client.query(
      "SELECT id, potentialname, sales_stage FROM Potentials WHERE potentialname LIKE '%[TEST]%' LIMIT 5;"
    );
    expect(results.some(r => r.id === createdId)).toBe(true);
  });
});
