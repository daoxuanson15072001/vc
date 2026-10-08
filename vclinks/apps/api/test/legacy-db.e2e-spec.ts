import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';

describe('Legacy database migration (vczalo → vcconnect → vclinks)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let client: MongoClient;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongo.getUri());
    // Newest legacy generation holds the data; the oldest is an empty leftover.
    await client.db('old_zalo').collection('messages').insertOne({ _id: 'stale' } as never);
    const legacy = client.db('old_connect');
    await legacy.collection('accounts').insertOne({ _id: '5300', label: 'Zalo', createdAt: new Date() } as never);
    await legacy.collection('messages').insertOne({ _id: '5300:1', uid: '5300', threadId: '9', sentAt: new Date() } as never);
  });

  afterAll(async () => {
    delete process.env.LEGACY_DB_NAMES;
    await app?.close();
    await client?.close();
    await mongo?.stop();
  });

  it('moves every collection of the newest legacy db and keeps tokens valid', async () => {
    // A token created by the app before the rename must keep working after it.
    process.env.MONGO_URI = mongo.getUri('old_connect');
    process.env.LEGACY_DB_NAMES = '';
    const old = await createApp({ logger: false });
    await old.init();
    const token = await old.get(TokenService).create('Claude Desktop', ['mcp', 'dashboard']);
    await old.close();

    process.env.MONGO_URI = mongo.getUri('new_links');
    process.env.LEGACY_DB_NAMES = 'old_connect,old_zalo';
    app = await createApp({ logger: false });
    await app.init();

    const res = await request(app.getHttpServer()).get('/api/me').set({ Authorization: `Bearer ${token}` }).expect(200);
    expect(res.body.name).toBe('Claude Desktop');
    const db = client.db('new_links');
    expect(await db.collection('accounts').countDocuments()).toBe(1);
    expect(await db.collection('messages').countDocuments()).toBe(1);
    expect(await client.db('old_connect').collection('accounts').countDocuments()).toBe(0);
    // The older, non-chosen generation is left untouched.
    expect(await client.db('old_zalo').collection('messages').countDocuments()).toBe(1);
  });
});
