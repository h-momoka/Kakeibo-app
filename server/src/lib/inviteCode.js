"use strict";

const { customAlphabet } = require("nanoid");

// Avoid visually ambiguous characters (0/O, 1/I/L) since this code is typed
// by hand when inviting the other person.
const nanoid = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 8);

function generateInviteCode() {
  return nanoid();
}

module.exports = { generateInviteCode };
