import jwt, { SignOptions } from 'jsonwebtoken';

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  name: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as string as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload as object, process.env.JWT_SECRET || 'default_secret', options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload as object, process.env.JWT_REFRESH_SECRET || 'default_refresh_secret', options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'default_refresh_secret') as TokenPayload;
};
