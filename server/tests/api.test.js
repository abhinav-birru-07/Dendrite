import request from 'supertest';
import app from '../index.js';
import db, { initDb } from '../db.js';
import { promisify } from 'util';

const dbRun = promisify(db.run.bind(db));

// In tests we mock the Gemini generation so we don't hit the real API
jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: () => ({
                startChat: () => ({
                    sendMessage: async () => ({
                        response: { text: () => 'Mocked response' }
                    })
                }),
                generateContent: async () => ({
                    response: { text: () => 'Mock Title' }
                })
            })
        }))
    };
});

describe('Dendrite API', () => {
    beforeAll(async () => {
        // Ensure DB is clean before tests start
        await dbRun("DROP TABLE IF EXISTS nodes");
        await dbRun("DROP TABLE IF EXISTS conversations");
        await initDb();
    });

    afterAll((done) => {
        db.close(done);
    });

    let conversationId;
    let rootNodeId;

    it('creates a new conversation', async () => {
        const res = await request(app).post('/api/conversations');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('conversationId');
        expect(res.body).toHaveProperty('rootNodeId');
        conversationId = res.body.conversationId;
        rootNodeId = res.body.rootNodeId;
    });

    it('lists conversations', async () => {
        const res = await request(app).get('/api/conversations');
        expect(res.statusCode).toEqual(200);
        expect(res.body.conversations).toBeInstanceOf(Array);
        expect(res.body.conversations.length).toBeGreaterThan(0);
        expect(res.body.conversations[0].id).toEqual(conversationId);
    });

    it('sends a message and auto-generates title', async () => {
        const res = await request(app)
            .post(`/api/conversations/${conversationId}/messages`)
            .send({
                message: 'Hello test',
                parentNodeId: rootNodeId
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('response', 'Mocked response');
        expect(res.body).toHaveProperty('userNodeId');
        expect(res.body).toHaveProperty('assistantNodeId');
        expect(res.body).toHaveProperty('generatedName');
        // Test the mock logic
        expect(res.body.generatedName).toEqual('Mock Title');
    });

    it('renames a conversation', async () => {
        const res = await request(app)
            .patch(`/api/conversations/${conversationId}/name`)
            .send({ name: 'Renamed Chat' });

        expect(res.statusCode).toEqual(200);

        // Verify it updated in the DB by refetching the list
        const getRes = await request(app).get('/api/conversations');
        const conv = getRes.body.conversations.find(c => c.id === conversationId);
        expect(conv.name).toEqual('Renamed Chat');
    });

    it('deletes a conversation', async () => {
        const delRes = await request(app).delete(`/api/conversations/${conversationId}`);
        expect(delRes.statusCode).toEqual(200);

        const checkRes = await request(app).get('/api/conversations');
        expect(checkRes.body.conversations.length).toEqual(0);
    });
});
