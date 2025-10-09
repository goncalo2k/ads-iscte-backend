export interface DecodedJwt {
    sid: string,
    sub: string,
    username: string,
    iat: number,
    exp: number
}