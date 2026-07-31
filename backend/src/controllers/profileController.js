const prisma = require("../config/prisma");

async function getMe(req, res) {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        include: { profile: true },
    });

    if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    res.json({
        id: user.id,
        email: user.email,
        profile: user.profile,
    });
}

async function updateMe(req, res) {
    const { firstName, lastName, age, gender, bio, city, country } = req.body;

    if (!firstName) {
        return res.status(400).json({ message: "Le prénom est requis" });
    }

    const parsedAge = age === "" || age === null || age === undefined ? null : Number(age);
    if (parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 120)) {
        return res.status(400).json({ message: "L'âge doit être un nombre valide (18 ou plus)" });
    }

    const data = {
        firstName,
        lastName: lastName || null,
        age: parsedAge,
        gender: gender || null,
        bio: bio || null,
        city: city || null,
        country: country || null,
    };

    const profile = await prisma.profile.upsert({
        where: { userId: req.userId },
        update: data,
        create: { ...data, userId: req.userId },
    });

    res.json({ profile });
}

module.exports = { getMe, updateMe };
