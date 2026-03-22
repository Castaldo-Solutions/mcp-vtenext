import axios from 'axios';
import crypto from 'crypto';

export class VTENextClient {
  constructor({ url, username, accessKey }) {
    this.baseUrl = url.replace(/\/$/, '') + '/webservice.php';
    this.username = username;
    this.accessKey = accessKey;
    this.sessionName = null;
    this.sessionExpiry = null;
  }

  async getSession() {
    if (this.sessionName && this.sessionExpiry > Date.now()) {
      return this.sessionName;
    }
    return this.login();
  }

  async login() {
    const { data: challenge } = await axios.get(this.baseUrl, {
      params: { operation: 'getchallenge', username: this.username },
    });
    if (!challenge.success) throw new Error('Challenge failed: ' + challenge.error?.message);

    const token = challenge.result.token;
    const md5 = crypto.createHash('md5').update(token + this.accessKey).digest('hex');

    const body = new URLSearchParams({ operation: 'login', username: this.username, accessKey: md5 });
    const { data: login } = await axios.post(this.baseUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!login.success) throw new Error('Login failed: ' + login.error?.message);

    this.sessionName = login.result.sessionName;
    this.sessionExpiry = Date.now() + 4 * 60 * 1000; // 4 minuti (token dura 5)
    return this.sessionName;
  }

  async query(vtql) {
    const session = await this.getSession();
    const { data } = await axios.get(this.baseUrl, {
      params: { operation: 'query', sessionName: session, query: vtql },
    });
    if (!data.success) throw new Error('Query failed: ' + data.error?.message);
    return data.result;
  }

  async retrieve(id) {
    const session = await this.getSession();
    const { data } = await axios.get(this.baseUrl, {
      params: { operation: 'retrieve', sessionName: session, id },
    });
    if (!data.success) throw new Error('Retrieve failed: ' + data.error?.message);
    return data.result;
  }

  async create(elementType, element) {
    const session = await this.getSession();
    const body = new URLSearchParams({
      operation: 'create',
      sessionName: session,
      elementType,
      element: JSON.stringify(element),
    });
    const { data } = await axios.post(this.baseUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!data.success) throw new Error('Create failed: ' + data.error?.message);
    return data.result;
  }

  async update(element) {
    const session = await this.getSession();
    const body = new URLSearchParams({
      operation: 'update',
      sessionName: session,
      element: JSON.stringify(element),
    });
    const { data } = await axios.post(this.baseUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!data.success) throw new Error('Update failed: ' + data.error?.message);
    return data.result;
  }

  async describe(module) {
    const session = await this.getSession();
    const { data } = await axios.get(this.baseUrl, {
      params: { operation: 'describe', sessionName: session, elementType: module },
    });
    if (!data.success) throw new Error('Describe failed: ' + data.error?.message);
    return data.result;
  }
}
