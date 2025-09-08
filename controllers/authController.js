// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const resend = require('../utils/resendClient');
const {
  createUser,
  getUserByEmail,
  updateUserResetToken,
  getUserByResetToken,
  updateUserPassword
} = require('../models/UserModel');

// POST /api/auth/register
const register = async (req, res) => {
  const { nombre, apellidos, email, password } = req.body;

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ msg: 'El correo ya está registrado.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await createUser(nombre, apellidos, email, hash);

    res.status(201).json({ msg: 'Usuario registrado correctamente' });
  } catch (err) {
    console.error('Error en register:', err);
    res.status(500).json({ msg: 'Error al registrarte', error: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ msg: 'Correo o contraseña incorrectos.' });
    }

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ msg: 'Error al iniciar sesión', error: err.message });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ msg: 'No existe ninguna cuenta con ese correo.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hora
    await updateUserResetToken(user.id, token, expires);

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    // Envío del correo con Resend
    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // cámbialo en producción
      to: email,
      subject: 'Restablecer contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #ffffff;">
        <div style="max-width: 500px; margin: auto; background-color: #191919; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://res.cloudinary.com/dkicsjbbb/image/upload/v1753870525/logo_ajelbg.png" alt="Logo" style="max-width: 120px; height: auto;" />
          </div>
          <h2 style="color: #ffec10; text-align: center;">Restablecer tu contraseña</h2>
          <p>Hola ${user.nombre},</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
          <p>Haz clic en el botón de abajo para cambiarla. Este enlace caduca en 1 hora.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #ffec10; color: #465d64; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Restablecer contraseña
            </a>
          </div>
          <p style="font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
        </div>
      </div>
      `
    });

    if (error) {
      console.error('Error al enviar email:', error);
      return res.status(500).json({ message: 'Error enviando el correo' });
    }

    res.json({ message: 'Correo de recuperación enviado' });
  } catch (err) {
    console.error('Error en forgotPassword:', err);
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    const user = await getUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ msg: 'Enlace inválido o caducado.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await updateUserPassword(user.id, hashed);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en resetPassword:', err);
    res.status(500).json({ message: 'Fallo al actualizar la contraseña', error: err.message });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword
};
