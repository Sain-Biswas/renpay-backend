import { Hono } from "hono";
import { getSignedCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { COOKIE_PRIVATE_SECRET, JWT_PRIVATE_SECRET } from "../constants/env";
import prisma from "../lib/prisma";

const currentuserRouter = new Hono();

currentuserRouter.get("/", async (c) => {
  try {
    const token = await getSignedCookie(c, COOKIE_PRIVATE_SECRET, "auth_token");

    if (!token) {
      return c.json(
        {
          success: false,
          error: "User not Authenticated",
        },
        401
      );
    }

    let decoded;
    try {
      decoded = await verify(token, JWT_PRIVATE_SECRET);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: "Invalid or expired token.",
        },
        401
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        id: decoded.id as string,
      },
      include: {
        recievingTransactions: true,
        sendingTransaction: true,
      },
      omit: {
        password: true,
      },
    });

    if (!user) {
      return c.json(
        {
          success: false,
          error: "Sender does not exist.",
        },
        404
      );
    }

    return c.json(
      {
        success: true,
        data: {
          load: user,
          name: "Success",
        },
      },
      200
    );
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: "Internal server error." }, 500);
  }
});

export default currentuserRouter;
