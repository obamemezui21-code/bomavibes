const { eraseAccount } = require("../services/accountDeletionService");

async function deleteAccount(req, res) {
  try {
    await eraseAccount(req.firebaseUser.uid);
    res.json({ message: "Compte supprimé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Impossible de supprimer le compte" });
  }
}

module.exports = { deleteAccount };
