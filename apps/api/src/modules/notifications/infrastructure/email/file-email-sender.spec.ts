import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileEmailSender } from './file-email-sender';

describe('FileEmailSender', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'outbox-spec-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes each email as its own JSON file, creating the folder if needed', async () => {
    const outbox = join(root, 'nested', 'outbox');
    const sender = new FileEmailSender(outbox);
    const first = { to: 'a@example.com', subject: 'One', text: 'text 1', html: '<p>1</p>' };
    const second = { to: 'b@example.com', subject: 'Two', text: 'text 2', html: '<p>2</p>' };

    await sender.send(first);
    await sender.send(second);

    const files = (await readdir(outbox)).sort();
    expect(files).toHaveLength(2);
    expect(files.every((name) => name.endsWith('.json'))).toBe(true);
    const written = await Promise.all(
      files.map(async (name) => JSON.parse(await readFile(join(outbox, name), 'utf8')) as unknown),
    );
    expect(written).toEqual(expect.arrayContaining([first, second]));
  });

  it('never leaves a half-written .json behind for a reader to pick up', async () => {
    const sender = new FileEmailSender(root);

    await sender.send({ to: 'a@example.com', subject: 'One', text: 't', html: 'h' });

    expect((await readdir(root)).filter((name) => !name.endsWith('.json'))).toEqual([]);
  });
});
