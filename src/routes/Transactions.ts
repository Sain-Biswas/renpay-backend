import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ulid } from "ulid";
import { z } from "zod";
import prisma from "../lib/prisma";
import { verify } from "hono/jwt";
import { COOKIE_PRIVATE_SECRET, JWT_PRIVATE_SECRET } from "../constants/env";
import { getSignedCookie } from "hono/cookie";

const transactionSchema = z.object({
  receiverId: z.string().nonempty(),
  amount: z.number().positive(),
});

const transactionRouter = new Hono();

transactionRouter.post("/", zValidator("json", transactionSchema), async (c) => {
  try {
    const { receiverId, amount } = c.req.valid("json");

    if (!receiverId || !amount) {
      return c.json(
        {
          success: false,
          error: "Something is Missing",
        },
        400
      );
    }

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

    const senderId = decoded.id;

    const senderDetails = await prisma.user.findUnique({
      where: { id: senderId },
    });

    if (!senderDetails) {
      return c.json(
        { 
          success: false, 
          error: "Sender does not exist." 
        }, 
        404
      );
    }

    const receiverDetails = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiverDetails) {
      return c.json({ success: false, error: "Receiver does not exist." }, 404);
    }

    if (amount > senderDetails.currentBalance) {
      return c.json({ success: false, error: "Insufficient balance." }, 400);
    }


    await prisma.$transaction(async () => {

      await prisma.user.update({
        where: { id: senderId },
        data: { currentBalance: { decrement: amount } },
      });

      await prisma.user.update({
        where: { id: receiverId },
        data: { currentBalance: { increment: amount } },
      });


      const transactionRecord = await prisma.transactions.create({
        data: {
          senderId: senderId,
          recieverId: receiverId,
          amount: amount,
          transactionId: ulid(),
        },
      });


      if (amount >= 40) {
        await prisma.user.update({
          where: { id: senderId },
          data: { currentScore: { increment: amount } },
        });
      }

      await prisma.user.update({
        where: { id: senderId },
        data: {
          sendingTransaction: {
            connect: { id: transactionRecord.id },
          },
        },
      });

      await prisma.user.update({
        where: { id: receiverId },
        data: {
          recievingTransactions: {
            connect: { id: transactionRecord.id },
          },
        },
      });
    });

    return c.json({
      success: true,
      message: "Transaction completed successfully.",
    });
  } catch (error: any) {
    console.error(error);
    return c.json(
      { success: false, error: "Internal server error." },
      500
    );
  }
});

export default transactionRouter;
