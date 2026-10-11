'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../src/ai');

const KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'AI_API_KEY', 'API_KEY', 'AI_PROVIDER', 'AI_MODEL', 'OPENAI_BASE_URL'];
function withEnv(env, fn) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  KEYS.forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  const realFetch = global.fetch;
  return Promise.resolve(fn()).finally(() => {
    global.fetch = realFetch;
    KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  });
}

test('provayder kalitdan aniqlanadi', async () => {
  await withEnv({}, () => assert.equal(ai.enabled(), false));
  await withEnv({ OPENAI_API_KEY: 'sk-proj-abc' }, () => assert.deepEqual([ai.info().provider, ai.info().model], ['openai', 'gpt-4o-mini']));
  await withEnv({ ANTHROPIC_API_KEY: 'sk-ant-abc' }, () => assert.equal(ai.info().provider, 'anthropic'));
  await withEnv({ API_KEY: 'sk-proj-abc' }, () => assert.equal(ai.info().provider, 'openai')); // ChatGPT kaliti "API_KEY" nomida
  await withEnv({ API_KEY: 'sk-ant-abc' }, () => assert.equal(ai.info().provider, 'anthropic'));
  await withEnv({ OPENAI_API_KEY: 'sk-x', ANTHROPIC_API_KEY: 'sk-ant-y', AI_PROVIDER: 'anthropic' }, () => assert.equal(ai.info().provider, 'anthropic'));
  await withEnv({ OPENAI_API_KEY: 'sk-x', AI_MODEL: 'gpt-4.1-mini' }, () => assert.equal(ai.info().model, 'gpt-4.1-mini'));
});

test('OpenAI: so‘rov formati va javob', async () => {
  await withEnv({ OPENAI_API_KEY: 'sk-proj-secret123456' }, async () => {
    let seen;
    global.fetch = async (url, init) => { seen = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ choices: [{ message: { content: ' Salom ' } }] }), { status: 200 }); };
    assert.equal(await ai.ask('tizim', 'savol', { maxTokens: 50 }), 'Salom');
    assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(seen.init.headers.authorization, 'Bearer sk-proj-secret123456');
    assert.equal(seen.body.model, 'gpt-4o-mini');
    assert.deepEqual(seen.body.messages.map((m) => m.role), ['system', 'user']);
    assert.equal(seen.body.max_completion_tokens, 50);
  });
});

test('Anthropic: so‘rov formati', async () => {
  await withEnv({ ANTHROPIC_API_KEY: 'sk-ant-abc' }, async () => {
    let seen;
    global.fetch = async (url, init) => { seen = { url, h: init.headers, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Xo‘p' }] }), { status: 200 }); };
    assert.equal(await ai.ask('s', 'u'), 'Xo‘p');
    assert.match(seen.url, /anthropic\.com/); assert.equal(seen.h['x-api-key'], 'sk-ant-abc'); assert.equal(seen.body.system, 's');
  });
});

test('xatolar: kalit yashiriladi, ask() null qaytaradi, test() sababni ko‘rsatadi', async () => {
  await withEnv({ OPENAI_API_KEY: 'sk-proj-secret123456' }, async () => {
    global.fetch = async () => new Response(JSON.stringify({ error: { message: 'Incorrect API key provided: sk-proj-secret123456.' } }), { status: 401 });
    assert.equal(await ai.ask('s', 'u'), null);
    assert.match(ai.lastAiError(), /401/);
    const t = await ai.test();
    assert.equal(t.ok, false); assert.match(t.error, /401/); assert.ok(!t.error.includes('secret123456'));
    global.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { status: 200 });
    assert.deepEqual(await ai.test(), { ok: true, provider: 'openai', model: 'gpt-4o-mini', reply: 'OK' });
  });
});

test('OpenAI orqali motivatsiya va jurnal moslik tahlili (JSON ```blok``` ichida ham)', async () => {
  await withEnv({ OPENAI_API_KEY: 'sk-proj-abc' }, async () => {
    global.fetch = async (url, init) => {
      const b = JSON.parse(init.body);
      const u = b.messages[1].content;
      const content = /baholang/.test(u) ? '```json\n[{"id":1,"score":77,"text":"Mos jurnal."}]\n```' : 'Hurmatli Test, davom eting!';
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    };
    assert.match(await ai.motivation({ name: 'Test', progressPct: 10, daysLeft: 5, topic: 't', doneTasks: 1, totalTasks: 9, nextTask: 'x' }), /^Hurmatli Test/);
    const fits = await ai.journalFits({ topic: 't' }, { code: '1', name: 'n' }, [{ id: 1, name: 'J', matchScore: 50, acceptance: 3 }]);
    assert.deepEqual([fits.get(1).score, fits.get(1).text, fits.get(1).ai], [77, 'Mos jurnal.', true]);
  });
});
