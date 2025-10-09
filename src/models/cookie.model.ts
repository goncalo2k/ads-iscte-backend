export interface Cookie {
    cookieName: string,
    appJwt: string,
    options: CookieOptions
}

export enum SameSitePolicy {
    Lax = 'lax',
    Strict = 'strict',
    None = 'none'
}

export interface CookieOptions {
    httpOnly: boolean;
    secure: boolean;
    sameSite: SameSitePolicy;
    domain?: string;
    maxAge: number;
}