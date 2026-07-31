const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const SALT_ROUNDS = 10;

function signToken(user) {
    return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
}

async function register(req, res) {
    const { firstName, email, password } = req.body;

    if (!firstName || !email || !password) {
        return res.status(400).json({ message: "Prénom, email et mot de passe sont requis" });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ message: "Un compte existe déjà avec cet email" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            profile: {
                create: { firstName },
            },
        },
        include: { profile: true },
    });

    const token = signToken(user);
    res.status(201).json({
        token,
        user: { id: user.id, email: user.email, firstName: user.profile.firstName },
    });
}

async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email et mot de passe sont requis" });
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user) {
        return res.status(401).json({ message: "Email ou mot de passe invalide" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
        return res.status(401).json({ message: "Email ou mot de passe invalide" });
    }

    const token = signToken(user);
    res.status(200).json({
        token,
        user: { id: user.id, email: user.email, firstName: user.profile?.firstName ?? null },
    });
}

module.exports = { register, login };
