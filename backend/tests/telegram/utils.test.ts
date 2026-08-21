import { isAuthorizedChat, escapeMd, buildTaskKeyboard } from '../../src/telegram/utils';

describe('Telegram utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isAuthorizedChat', () => {
    it('returns true when TELEGRAM_CHAT_ID is not set with a warning', () => {
      delete process.env.TELEGRAM_CHAT_ID;
      const ctx: any = { chat: { id: 12345 } };
      expect(isAuthorizedChat(ctx)).toBe(true);
    });

    it('returns true when chat.id matches TELEGRAM_CHAT_ID', () => {
      process.env.TELEGRAM_CHAT_ID = '12345';
      const ctx: any = { chat: { id: 12345 } };
      expect(isAuthorizedChat(ctx)).toBe(true);
    });

    it('returns true when from.id matches TELEGRAM_CHAT_ID if chat is absent', () => {
      process.env.TELEGRAM_CHAT_ID = '12345';
      const ctx: any = { from: { id: 12345 } };
      expect(isAuthorizedChat(ctx)).toBe(true);
    });

    it('returns false when chat.id does not match TELEGRAM_CHAT_ID', () => {
      process.env.TELEGRAM_CHAT_ID = '12345';
      const ctx: any = { chat: { id: 99999 } };
      expect(isAuthorizedChat(ctx)).toBe(false);
    });
  });

  describe('re-exports', () => {
    it('re-exports escapeMd and buildTaskKeyboard correctly', () => {
      expect(typeof escapeMd).toBe('function');
      expect(typeof buildTaskKeyboard).toBe('function');
    });
  });
});
