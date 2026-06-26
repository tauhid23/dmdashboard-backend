import { prisma } from "../config/prisma.js";
import type { CreateUserInput } from "../types/user.types.js";

export const createUser = async (payload: CreateUserInput) => {
  return prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email
    }
  });
};

export const getUsers = async () => {
  return prisma.user.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });
};
