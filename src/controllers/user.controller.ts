import type { Request, Response } from "express";

import * as userService from "../services/user.service.js";

export const createUser = async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);

  res.status(201).json({
    success: true,
    data: user
  });
};

export const getUsers = async (_req: Request, res: Response) => {
  const users = await userService.getUsers();

  res.status(200).json({
    success: true,
    data: users
  });
};
