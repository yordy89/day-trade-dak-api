import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    userId: string;
    _id: string;
    email: string;
    role: string;
  };
}
