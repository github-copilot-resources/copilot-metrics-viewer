/**
 * Unit tests for server/utils/proxy-agent.ts
 *
 * Covers:
 *   - Returns null when HTTP_PROXY is not set
 *   - Creates and returns a ProxyAgent when HTTP_PROXY is set
 *   - Calls setGlobalDispatcher with the created agent
 *   - Reads CA certificate when CUSTOM_CA_PATH is set and file exists
 *   - Throws (and optionally calls process.exit) when CUSTOM_CA_PATH file is missing
 *   - exitOnError=false rethrows instead of calling process.exit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---

const mockSetGlobalDispatcher = vi.fn();
const mockProxyAgentInstance = { uri: '' };
const MockProxyAgent = vi.fn((opts: { uri: string }) => {
  mockProxyAgentInstance.uri = opts.uri;
  return mockProxyAgentInstance;
});

vi.mock('undici', () => ({
  ProxyAgent: MockProxyAgent,
  setGlobalDispatcher: mockSetGlobalDispatcher,
}));

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('fs', () => ({
  default: { existsSync: mockExistsSync, readFileSync: mockReadFileSync },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

// Import AFTER mocks are registered
const { initializeProxyAgent } = await import('../server/utils/proxy-agent');

describe('initializeProxyAgent', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when HTTP_PROXY is not set', () => {
    delete process.env.HTTP_PROXY;
    const result = initializeProxyAgent();
    expect(result).toBeNull();
    expect(MockProxyAgent).not.toHaveBeenCalled();
    expect(mockSetGlobalDispatcher).not.toHaveBeenCalled();
  });

  it('creates a ProxyAgent and sets global dispatcher when HTTP_PROXY is set', () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
    delete process.env.CUSTOM_CA_PATH;

    const result = initializeProxyAgent();

    expect(MockProxyAgent).toHaveBeenCalledOnce();
    expect(MockProxyAgent).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'http://proxy.example.com:8080' })
    );
    expect(mockSetGlobalDispatcher).toHaveBeenCalledOnce();
    expect(mockSetGlobalDispatcher).toHaveBeenCalledWith(mockProxyAgentInstance);
    expect(result).toBe(mockProxyAgentInstance);
  });

  it('reads the CA file and passes tls options when CUSTOM_CA_PATH is set and file exists', () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
    process.env.CUSTOM_CA_PATH = '/certs/custom-ca.crt';
    const fakeBuffer = Buffer.from('cert-data');
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(fakeBuffer);

    const result = initializeProxyAgent();

    expect(mockExistsSync).toHaveBeenCalledWith('/certs/custom-ca.crt');
    expect(mockReadFileSync).toHaveBeenCalledWith('/certs/custom-ca.crt');
    expect(MockProxyAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'http://proxy.example.com:8080',
        requestTls: { ca: [fakeBuffer] },
      })
    );
    expect(result).toBe(mockProxyAgentInstance);
  });

  it('throws an error when CUSTOM_CA_PATH is set but the file does not exist (exitOnError=false)', () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
    process.env.CUSTOM_CA_PATH = '/certs/missing-ca.crt';
    mockExistsSync.mockReturnValue(false);

    expect(() => initializeProxyAgent(false)).toThrowError(
      'CUSTOM_CA_PATH file not found: /certs/missing-ca.crt'
    );
    expect(mockSetGlobalDispatcher).not.toHaveBeenCalled();
  });

  it('calls process.exit(1) when initialization fails and exitOnError=true', () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
    process.env.CUSTOM_CA_PATH = '/certs/missing-ca.crt';
    mockExistsSync.mockReturnValue(false);

    // Throw a sentinel so execution stops after process.exit — matching real process termination.
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(
      (() => { throw new Error('process.exit called'); }) as () => never
    );

    expect(() => initializeProxyAgent(true)).toThrowError('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
