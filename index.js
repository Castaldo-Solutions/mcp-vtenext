#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { config } from 'dotenv';
import { VTENextClient } from './client.js';

config();

const READ_ONLY = process.env.READ_ONLY === 'true';

const client = new VTENextClient({
  url: process.env.VTENEXT_URL || 'http://localhost:8080',
  username: process.env.VTENEXT_USERNAME || 'admin',
  accessKey: process.env.VTENEXT_ACCESS_KEY,
});

const server = new McpServer({
  name: 'mcp-vtenext',
  version: '1.0.0',
});

// ─── OPPORTUNITÀ (Potentials) ─────────────────────────────────────────────────

server.tool(
  'list_opportunita',
  'Elenca le opportunità con filtri opzionali',
  {
    limit: z.number().optional().default(20).describe('Numero massimo di risultati'),
    stato: z.string().optional().describe('Stato (es. Prospecting, Qualification, Closed Won)'),
    search: z.string().optional().describe('Testo da cercare nel nome opportunità'),
  },
  async ({ limit, stato, search }) => {
    let query = `SELECT id, potentialname, sales_stage, amount, closingdate, assigned_user_id FROM Potentials`;
    const conditions = [];
    if (stato) conditions.push(`sales_stage = '${stato}'`);
    if (search) conditions.push(`potentialname LIKE '%${search}%'`);
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ` LIMIT ${limit};`;

    const results = await client.query(query);
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  'get_opportunita',
  'Recupera i dettagli completi di un\'opportunità tramite ID',
  {
    id: z.string().describe('ID dell\'opportunità (es. 13x42)'),
  },
  async ({ id }) => {
    const result = await client.retrieve(id);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'search_opportunita',
  'Cerca opportunità per nome',
  {
    q: z.string().describe('Testo da cercare nel nome dell\'opportunità'),
    limit: z.number().optional().default(10),
  },
  async ({ q, limit }) => {
    const results = await client.query(
      `SELECT id, potentialname, sales_stage, amount, closingdate FROM Potentials WHERE potentialname LIKE '%${q}%' LIMIT ${limit};`
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  'create_opportunita',
  'Crea una nuova opportunità in VTENext (non disponibile in modalità sola lettura)',
  {
    nome: z.string().describe('Nome dell\'opportunità'),
    stato: z.string().optional().default('Prospecting').describe('Stato (es. Prospecting, Qualification, Closed Won)'),
    importo: z.number().optional().describe('Valore stimato'),
    data_chiusura: z.string().optional().describe('Data chiusura prevista (YYYY-MM-DD)'),
    descrizione: z.string().optional().describe('Note o descrizione'),
  },
  async ({ nome, stato, importo, data_chiusura, descrizione }) => {
    if (READ_ONLY) return { content: [{ type: 'text', text: 'Errore: server in modalità sola lettura, operazioni di scrittura non consentite.' }] };
    const element = {
      potentialname: nome,
      sales_stage: stato,
      amount: importo || 0,
      closingdate: data_chiusura || new Date().toISOString().split('T')[0],
      description: descrizione || '',
    };
    const result = await client.create('Potentials', element);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'update_opportunita',
  'Aggiorna i dati di un\'opportunità esistente (non disponibile in modalità sola lettura)',
  {
    id: z.string().describe('ID dell\'opportunità (es. 13x42)'),
    stato: z.string().optional().describe('Nuovo stato'),
    importo: z.number().optional().describe('Nuovo importo'),
    descrizione: z.string().optional().describe('Note aggiornate'),
  },
  async ({ id, stato, importo, descrizione }) => {
    if (READ_ONLY) return { content: [{ type: 'text', text: 'Errore: server in modalità sola lettura, operazioni di scrittura non consentite.' }] };
    const current = await client.retrieve(id);
    const element = { ...current };
    if (stato) element.sales_stage = stato;
    if (importo !== undefined) element.amount = importo;
    if (descrizione) element.description = descrizione;
    const result = await client.update(element);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ─── CONTATTI ────────────────────────────────────────────────────────────────

server.tool(
  'search_contatti',
  'Cerca contatti per nome, email o azienda',
  {
    q: z.string().describe('Testo da cercare'),
    limit: z.number().optional().default(10),
  },
  async ({ q, limit }) => {
    const results = await client.query(
      `SELECT id, firstname, lastname, email, phone, account_id FROM Contacts WHERE firstname LIKE '%${q}%' OR lastname LIKE '%${q}%' OR email LIKE '%${q}%' LIMIT ${limit};`
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

// ─── ATTIVITÀ / NOTE ─────────────────────────────────────────────────────────

server.tool(
  'add_nota_opportunita',
  'Aggiunge una nota/commento a un\'opportunità (non disponibile in modalità sola lettura)',
  {
    opportunita_id: z.string().describe('ID dell\'opportunità (es. 13x42)'),
    testo: z.string().describe('Testo della nota'),
  },
  async ({ opportunita_id, testo }) => {
    if (READ_ONLY) return { content: [{ type: 'text', text: 'Errore: server in modalità sola lettura, operazioni di scrittura non consentite.' }] };
    const result = await client.create('ModComments', {
      commentcontent: testo,
      related_to: opportunita_id,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'list_attivita_opportunita',
  'Elenca le attività associate a un\'opportunità',
  {
    opportunita_id: z.string().describe('ID dell\'opportunità (es. 13x42)'),
    limit: z.number().optional().default(10),
  },
  async ({ opportunita_id, limit }) => {
    const results = await client.query(
      `SELECT id, subject, activitytype, date_start, status FROM Activities WHERE related_id = '${opportunita_id}' LIMIT ${limit};`
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

// ─── UTILITÀ ─────────────────────────────────────────────────────────────────

server.tool(
  'describe_modulo',
  'Mostra i campi disponibili per un modulo VTENext',
  {
    modulo: z.string().describe('Nome del modulo (es. Potentials, Contacts, Activities)'),
  },
  async ({ modulo }) => {
    const result = await client.describe(modulo);
    const fields = result.fields.map(f => ({ name: f.name, type: f.type.name, label: f.label }));
    return {
      content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }],
    };
  }
);

server.tool(
  'query_raw',
  'Esegue una query VTQL grezza su VTENext (solo lettura)',
  {
    query: z.string().describe('Query VTQL (es. SELECT * FROM Potentials LIMIT 5)'),
  },
  async ({ query }) => {
    if (!/^SELECT/i.test(query.trim())) {
      return { content: [{ type: 'text', text: 'Errore: solo query SELECT permesse.' }] };
    }
    const results = await client.query(query);
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

// ─── AVVIO ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
