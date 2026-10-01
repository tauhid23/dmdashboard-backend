import "dotenv/config";

import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { startNotificationWorker } from "./services/notification.service.js";
import { startInvoiceSchedule } from "./billing/invoiceSchedule.service.js";

const server = app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
const stopNotificationWorker = startNotificationWorker();
const stopInvoiceSchedule = startInvoiceSchedule();

const shutdown = async () => {
  stopNotificationWorker();
  stopInvoiceSchedule();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
