import { Request } from 'express';

export interface RequestWithUser extends Request {
  user?: { sub: string; username: string; _id: string }; // Extend with user payload
}
