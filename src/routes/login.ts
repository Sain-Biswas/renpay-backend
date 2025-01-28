import { zValidator } from "@hono/zod-validator";
import { compare } from "bcryptjs";
import { Hono } from "hono";
import { setSignedCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { z } from "zod";
import { COOKIE_PRIVATE_SECRET, JWT_PRIVATE_SECRET } from "../constants/env";
import prisma from "../lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const loginRouter = new Hono();

loginRouter.post("/", zValidator("json", loginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid("json");

    const user = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        password: true,
        createdAt: true,
      },
    });

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            issues: [
              {
                validation: "email",
                code: "no_email",
                message: "Unregistered email",
                path: ["email"],
              },
            ],
            name: "UserError",
          },
        },
        406
      );
    }

    const isCorrectPassword = await compare(password, user.password);

    if (!isCorrectPassword) {
      return c.json(
        {
          success: false,
          error: {
            issues: [
              {
                validation: "password",
                code: "incorrect_password",
                message: "Wrong Password",
                path: ["password"],
              },
            ],
            name: "UserError",
          },
        },
        403
      );
    }

    const newUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      createdAt: user.createdAt,
    };

    const token = await sign(newUser, JWT_PRIVATE_SECRET);
    await setSignedCookie(c, "auth_token", token, COOKIE_PRIVATE_SECRET);

    return c.json({
      success: true,
      data: {
        load: newUser,
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

export default loginRouter;

