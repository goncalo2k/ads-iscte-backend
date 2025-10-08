import { AuthService } from "./auth.service";


describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(authService.getHello()).toBe('Hello World!');
    });
  });
});
