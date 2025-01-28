import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import registerRouter from "./routes/register";
import loginRouter from "./routes/login";
import transactionRouter from "./routes/Transactions";

const app = new Hono();

app.use(cors());
app.use(logger());

app.route("/register", registerRouter);
app.route("/login", loginRouter);
app.route("/transaction", transactionRouter);

app.get("/", (c) => {
  return c.json({
    message: "Welcome to Renpay Fintech!",
  });
});

export default app;

