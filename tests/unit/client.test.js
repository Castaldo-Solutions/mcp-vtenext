import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { VTENextClient } from '../../client.js';

vi.mock('axios');

const CHALLENGE_TOKEN = 'testtoken123';
const ACCESS_KEY = 'testaccesskey';
const SESSION_NAME = 'sess_abc123';

const challengeResponse = {
  data: { success: true, result: { token: CHALLENGE_TOKEN, serverTime: 1000000, expireTime: 1000300 } },
};
const loginResponse = {
  data: { success: true, result: { sessionName: SESSION_NAME, userId: '19x1', version: '0.22' } },
};

let client;

beforeEach(() => {
  vi.clearAllMocks();
  client = new VTENextClient({
    url: 'http://localhost:8080',
    username: 'admin',
    accessKey: ACCESS_KEY,
  });
});

describe('VTENextClient — autenticazione', () => {
  it('costruisce il baseUrl correttamente (rimuove slash finale)', () => {
    const c = new VTENextClient({ url: 'http://localhost:8080/', username: 'admin', accessKey: 'key' });
    expect(c.baseUrl).toBe('http://localhost:8080/webservice.php');
  });

  it('esegue challenge + login e salva la sessione', async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce(loginResponse);

    const session = await client.login();

    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:8080/webservice.php',
      expect.objectContaining({ params: { operation: 'getchallenge', username: 'admin' } })
    );
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/webservice.php',
      expect.stringContaining('operation=login'),
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }) })
    );
    expect(session).toBe(SESSION_NAME);
    expect(client.sessionName).toBe(SESSION_NAME);
  });

  it('calcola l\'MD5 correttamente (token + accessKey)', async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce(loginResponse);
    await client.login();

    const body = axios.post.mock.calls[0][1]; // form-encoded string
    const params = Object.fromEntries(new URLSearchParams(body));
    // MD5(CHALLENGE_TOKEN + ACCESS_KEY) deve essere una stringa hex di 32 caratteri
    expect(params.accessKey).toMatch(/^[a-f0-9]{32}$/);
  });

  it('riusa la sessione se non è scaduta (no doppio login)', async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce(loginResponse);

    await client.getSession();
    await client.getSession(); // seconda chiamata — non deve rifare login

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('rifa il login se la sessione è scaduta', async () => {
    axios.get.mockResolvedValue(challengeResponse);
    axios.post.mockResolvedValue(loginResponse);

    client.sessionName = SESSION_NAME;
    client.sessionExpiry = Date.now() - 1000; // già scaduta

    await client.getSession();

    expect(axios.get).toHaveBeenCalledTimes(1); // ha rifatto challenge
  });

  it('lancia errore se challenge fallisce', async () => {
    axios.get.mockResolvedValueOnce({ data: { success: false, error: { message: 'Server error' } } });
    await expect(client.login()).rejects.toThrow('Challenge failed');
  });

  it('lancia errore se login fallisce', async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce({ data: { success: false, error: { message: 'Invalid credentials' } } });
    await expect(client.login()).rejects.toThrow('Login failed');
  });
});

describe('VTENextClient — query', () => {
  beforeEach(async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce(loginResponse);
    await client.login();
    vi.clearAllMocks(); // resetta mock dopo login
  });

  it('esegue una query VTQL e restituisce i risultati', async () => {
    const fakeResults = [{ id: '13x1', potentialname: 'Cantiere Roma', sales_stage: 'Prospecting' }];
    axios.get.mockResolvedValueOnce({ data: { success: true, result: fakeResults } });

    const results = await client.query('SELECT * FROM Potentials LIMIT 5;');

    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:8080/webservice.php',
      expect.objectContaining({ params: expect.objectContaining({ operation: 'query', sessionName: SESSION_NAME }) })
    );
    expect(results).toEqual(fakeResults);
  });

  it('lancia errore se query fallisce', async () => {
    axios.get.mockResolvedValueOnce({ data: { success: false, error: { message: 'Invalid query' } } });
    await expect(client.query('INVALID SQL')).rejects.toThrow('Query failed');
  });
});

describe('VTENextClient — retrieve', () => {
  beforeEach(async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce(loginResponse);
    await client.login();
    vi.clearAllMocks();
  });

  it('recupera un record per ID', async () => {
    const fakeRecord = { id: '13x42', potentialname: 'Cantiere Milano' };
    axios.get.mockResolvedValueOnce({ data: { success: true, result: fakeRecord } });

    const result = await client.retrieve('13x42');

    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:8080/webservice.php',
      expect.objectContaining({ params: expect.objectContaining({ operation: 'retrieve', id: '13x42' }) })
    );
    expect(result).toEqual(fakeRecord);
  });

  it('lancia errore se retrieve fallisce', async () => {
    axios.get.mockResolvedValueOnce({ data: { success: false, error: { message: 'Record not found' } } });
    await expect(client.retrieve('13x99')).rejects.toThrow('Retrieve failed');
  });
});

describe('VTENextClient — create', () => {
  beforeEach(async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce(loginResponse);
    await client.login();
    vi.clearAllMocks();
  });

  it('crea un record e restituisce il risultato', async () => {
    const newRecord = { id: '13x99', potentialname: 'Nuovo Cantiere' };
    axios.post.mockResolvedValueOnce({ data: { success: true, result: newRecord } });

    const result = await client.create('Potentials', { potentialname: 'Nuovo Cantiere' });

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/webservice.php',
      expect.stringContaining('operation=create'),
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }) })
    );
    expect(result).toEqual(newRecord);
  });

  it('lancia errore se create fallisce', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: false, error: { message: 'Validation error' } } });
    await expect(client.create('Potentials', {})).rejects.toThrow('Create failed');
  });
});

describe('VTENextClient — update', () => {
  beforeEach(async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce(loginResponse);
    await client.login();
    vi.clearAllMocks();
  });

  it('aggiorna un record esistente', async () => {
    const updated = { id: '13x42', potentialname: 'Cantiere Aggiornato' };
    axios.post.mockResolvedValueOnce({ data: { success: true, result: updated } });

    const result = await client.update({ id: '13x42', potentialname: 'Cantiere Aggiornato' });

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/webservice.php',
      expect.stringContaining('operation=update'),
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }) })
    );
    expect(result).toEqual(updated);
  });
});

describe('VTENextClient — describe', () => {
  beforeEach(async () => {
    axios.get.mockResolvedValueOnce(challengeResponse);
    axios.post.mockResolvedValueOnce(loginResponse);
    await client.login();
    vi.clearAllMocks();
  });

  it('descrive i campi di un modulo', async () => {
    const fakeDescribe = { fields: [{ name: 'potentialname', type: { name: 'string' }, label: 'Name' }] };
    axios.get.mockResolvedValueOnce({ data: { success: true, result: fakeDescribe } });

    const result = await client.describe('Potentials');
    expect(result).toEqual(fakeDescribe);
  });
});
