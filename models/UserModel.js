//backend/models/UserModel.js
const db = require('../config/db');

const createUser = async (nombre, apellidos, email, passwordHash) => {
  const [result] = await db.execute(
    'INSERT INTO usuarios (nombre, apellidos, email, password_hash) VALUES (?, ?, ?, ?)',
    [nombre, apellidos, email, passwordHash]
  );
  return result;
};

const getUserByEmail = async (email) => {
  const [rows] = await db.execute(
    'SELECT * FROM usuarios WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0];
};

const updateUserResetToken = async (userId, token, expires) => {
  await db.execute(
    'UPDATE usuarios SET resetToken = ?, resetTokenExpires = ? WHERE id = ?',
    [token, expires, userId]
  );
};

const getUserByResetToken = async (token) => {
  const [rows] = await db.execute(
    'SELECT * FROM usuarios WHERE resetToken = ? AND resetTokenExpires > NOW() LIMIT 1',
    [token]
  );
  return rows[0];
};

const updateUserPassword = async (userId, hashedPassword) => {
  await db.execute(
    'UPDATE usuarios SET password = ?, resetToken = NULL, resetTokenExpires = NULL WHERE id = ?',
    [hashedPassword, userId]
  );
};

module.exports = {
  createUser,
  getUserByEmail,
  updateUserResetToken,
  getUserByResetToken,
  updateUserPassword
};
