#!/usr/bin/env node
// generate-pin-hash.js — Cross-platform PIN hash generator
// Usage: node generate-pin-hash.js [4-digit-PIN]
// If no argument is given, prompts for PIN interactively.

const crypto = require('crypto');
const readline = require('readline');

const ITERATIONS = 100000;

function hashPin(pin) {
  let buf = Buffer.from(String(pin), 'utf8');
  for (let i = 0; i < ITERATIONS; i++) {
    buf = crypto.createHash('sha256').update(buf).digest();
  }
  return buf.toString('hex');
}

function askPin() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Enter 4-digit PIN: ', (pin) => {
    rl.close();
    run(pin);
  });
}

function run(pin) {
  const clean = String(pin).trim();
  if (!/^\d{4}$/.test(clean)) {
    console.error('Error: PIN must be exactly 4 digits.');
    process.exit(1);
  }
  const hash = hashPin(clean);
  console.log(`\nPIN : ${clean}`);
  console.log(`Iterations : ${ITERATIONS}`);
  console.log(`Hash : ${hash}`);
  console.log(`\nCopy this hash into your security-audit.js / test.html files.`);
}

const arg = process.argv[2];
if (arg) {
  run(arg);
} else {
  askPin();
}
