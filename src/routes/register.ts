import { zValidator } from "@hono/zod-validator";
import { hash } from "bcryptjs";
import { Hono } from "hono";
import { setSignedCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { z } from "zod";
import {
  BCRYPT_SALT,
  COOKIE_PRIVATE_SECRET,
  JWT_PRIVATE_SECRET,
} from "../constants/env";
import prisma from "../lib/prisma";

export const registerSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  password: z.string(),
});

const registerRouter = new Hono();

registerRouter.post("/", zValidator("json", registerSchema), async (c) => {
  try {
    const { firstName, lastName, email, password } = c.req.valid("json");

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        email: true,
      },
    });

    if (existingUser) {
      return c.json(
        {
          success: false,
          error: {
            issues: [
              {
                validation: "email",
                code: "duplicate_email",
                message: "Existing email",
                path: ["email"],
              },
            ],
            name: "PrismaError",
          },
        },
        409
      );
    }

    const hashedPassword = await hash(password, BCRYPT_SALT);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
    });

    const token = await sign(user, JWT_PRIVATE_SECRET);
    await setSignedCookie(c, "auth_token", token, COOKIE_PRIVATE_SECRET);

    return c.json({
      success: true,
      data: {
        load: user,
        name: "Success",
      },
    });
  } catch (error: any) {
    console.log(error);

    return c.json(
      {
        success: false,
        error: {
          issues: [
            {
              message: "Internal Server Error.",
            },
          ],
          name: "ServerError",
        },
      },
      500
    );
  }
});

export default registerRouter;

