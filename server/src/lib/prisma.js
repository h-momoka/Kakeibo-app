"use strict";

const { PrismaClient } = require("@prisma/client");

// A single shared Prisma client for the whole process (recommended by Prisma
// for long-running servers — avoids exhausting Postgres connections).
const prisma = new PrismaClient();

module.exports = prisma;
