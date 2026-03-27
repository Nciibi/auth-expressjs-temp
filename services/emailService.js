const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    pool: true,
    maxConnections: 3,
    maxMessages: Infinity,
    rateDelta: 1000,
    rateLimit: 5,
    tls: { rejectUnauthorized: true }

});

console.log(process.env.EMAIL_USER, process.env.EMAIL_PASS);
const sendVerificationEmail = async (email, code) => {
    try {
        return await transporter.sendMail({
            from: { name: 'App Admin', address: process.env.EMAIL_USER },
            to: email,
            subject: 'Your Verification Code',
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #f5f7fa; padding: 40px; border-radius: 10px;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Your verification code is: <strong>${code}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        </div>`
        });
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
};

const sendResetPasswordEmail = async (email, resetUrl) => {
    try {
        console.log(process.env.EMAIL_USER, process.env.EMAIL_PASS);
        return await transporter.sendMail({
            from: { name: 'App Admin', address: process.env.EMAIL_USER },
            to: email,
            subject: 'Password Reset',
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #f5f7fa; padding: 40px; border-radius: 10px;">
          <h2 style="color: #333;">Password Reset</h2>
          <p>You requested a password reset. Click below to reset your password:</p>
          <a href="${resetUrl}" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>This link expires in 1 hour.</p>
        </div>`
        });
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
};

const sendResetPasswordConfirmationEmail = async (email) => {
    try {
        return await transporter.sendMail({
            from: { name: 'App Admin', address: process.env.EMAIL_USER },
            to: email,
            subject: 'Password Reset Successful',
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #f5f7fa; padding: 40px; border-radius: 10px;">
          <h2 style="color: #333;">Password Successfully Reset</h2>
          <p>Your password has been successfully reset. You can now log in with your new password.</p>
        </div>`
        });
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
};

module.exports = {
    sendVerificationEmail,
    sendResetPasswordEmail,
    sendResetPasswordConfirmationEmail,
    emailRateLimiter: rateLimit({
        windowMs: 60 * 1000,
        max: 3
    })
};
