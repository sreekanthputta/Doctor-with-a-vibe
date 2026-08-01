import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Railway deployment configuration', () => {
  it('uses the single verified build, start, and healthcheck contract', async () => {
    const configuration = await readFile(`${process.cwd()}/railway.toml`, 'utf8');

    expect(configuration).toContain('builder = "railpack"');
    expect(configuration).toContain('buildCommand = "npm run build"');
    expect(configuration).toContain('startCommand = "npm run start"');
    expect(configuration).toContain('healthcheckPath = "/health"');
    expect(configuration).toContain('healthcheckTimeout = 120');
    expect(configuration).toContain('restartPolicyType = "on_failure"');
    expect(configuration).not.toMatch(/NIXPACKS|npm ci|restartPolicyMaxRetries/);
  });
});
