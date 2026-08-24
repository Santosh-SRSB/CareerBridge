const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "dev_secret_change_me", {
    expiresIn: "7d",
  });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are all required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const normalizedEmail = email.toLowerCase();
  const existing = db.findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = db.createUser({ name, email: normalizedEmail, passwordHash });

  const token = signToken(user.id);
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = db.findUserByEmail(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

module.exports = router;
